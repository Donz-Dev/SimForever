import type { Combatant, WeaponSlot } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/**
 * PARRY HASTE: a parried attack hurries the attacker's next swing.
 *
 * ==============================================================================
 * THE DEFENDER PARRIES AND THE ATTACKER'S TIMER MOVES, which is the part that
 * reads backwards and is the whole danger of the mechanic for a tank: parrying
 * a boss brings its next swing forward, so a run of parries can land two blows
 * inside one swing's worth of healing.
 *
 * The ruleset owner's rule, and both figures are theirs: "successfully parrying
 * an attack reduces the attacker's remaining swing timer by 40% of their max
 * swing time, provided the reduction does not lower the timer below 20% of its
 * original duration", and "this mechanic applies to both players and mobs,
 * including raid bosses".
 *
 * BOTH FRACTIONS ARE OF A FULL SWING, not one of the swing and one of what is
 * left, and that is what makes it converge: each parry takes a fixed 40% of a
 * swing off and the floor sits at 20% of a swing, so no run of parries can
 * drive the timer to zero. Reading the floor as 20% of the REMAINING time
 * instead would let it be squeezed arbitrarily close, which is a different
 * mechanic and a far more dangerous one.
 *
 * THE FULL SWING IS THE HASTED ONE, which is a choice and is written down. The
 * timer being shortened was set from `applyHaste(swingTimerMs, haste)`, so
 * measuring the reduction and the floor against the unhasted figure would let
 * a hasted attacker's floor exceed its own swing. No boss in this project has
 * haste, so nothing measures the difference today -- it is the day something
 * does that this matters.
 *
 * ------------------------------------------------------------------------------
 * WHY IT IS ITS OWN FILE. `dealDamage` is what sees the parry and `autoAttack`
 * is what owns swing timers, and `autoAttack` already imports `dealDamage` --
 * so reaching the other way would be the first import cycle in `engine/combat`.
 * This imports neither.
 *
 * IT RE-PUSHES THE PENDING EVENT RATHER THAN BUILDING A NEW ONE, which is also
 * what keeps it independent: a swing event is a closure that knows how to
 * resolve itself and to schedule its own successor, so moving it is cancelling
 * the old entry and placing the SAME event earlier. Constructing a swing here
 * would mean a second place that knows what a swing is.
 *
 * THE ONE-PENDING-SWING INVARIANT IS PRESERVED BY DOING BOTH HALVES. The old
 * entry is cancelled and the combatant is handed the new handle, so nothing is
 * left outstanding -- an earlier swing scheduled alongside the old one would be
 * exactly the forked-timer bug `scheduleSwing` exists to prevent.
 *
 * ------------------------------------------------------------------------------
 * IT IS SCHEDULED, NOT APPLIED INLINE, AND THE FIRST VERSION WAS NOT -- WHICH
 * MADE IT FIRE EXACTLY ZERO TIMES.
 *
 * A swing's own event handler resolves the blow and only THEN schedules its
 * successor. So at the moment `dealDamage` sees the parry, the handle on the
 * combatant is still the swing that is CURRENTLY FIRING: its timestamp is now,
 * its remaining time is zero, and hurrying it is a no-op. The real next swing
 * does not exist yet, and a moment later it is scheduled at full speed over
 * the top.
 *
 * NOTHING ABOUT THAT LOOKED WRONG. Every unit test passed, because a test that
 * calls `dealDamage` by hand at a chosen moment DOES have a real future swing
 * pending -- the one case the live path never presents. What caught it was
 * measuring the mechanism: three tank profiles took 25.5 attacks a fight
 * before the change and 25.5 after it.
 *
 * One `events.schedule` at the current timestamp puts it after the swing
 * handler has finished and scheduled its successor, which is the same fix and
 * the same reason `extraAttack` schedules rather than swinging inline.
 * ------------------------------------------------------------------------------
 * ==============================================================================
 */
export function applyParryHaste(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
): void {
  const rule = attacker.parryHaste;
  if (!rule || !attacker.weapons[slot]) return;

  context.events.schedule(
    context.clock.now(),
    createEvent(`parry-haste:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;
      hurry(ctx, attacker, slot, rule.reductionFraction, rule.floorFraction);
    }),
  );
}

/** Move the attacker's pending swing earlier, once one actually exists. */
function hurry(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
  reductionFraction: number,
  floorFraction: number,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;

  /*
   * NOTHING PENDING MEANS NOTHING TO HURRY. A combatant that does not auto
   * attack has no swing timer at all, so a parried special from a caster moves
   * nothing -- correctly, because there is no swing for it to move.
   */
  const pending = attacker.pendingSwing(slot);
  if (!pending || pending.cancelled) return;

  const now = context.clock.now();
  const remaining = pending.timestamp - now;
  if (remaining <= 0) return;

  const full = applyHaste(weapon.swingTimerMs, hasteMultiplierFrom(attacker.stats.effective));
  const hurried = Math.max(full * floorFraction, remaining - full * reductionFraction);

  /*
   * ALREADY AT OR INSIDE THE FLOOR, so the parry buys nothing. That is the
   * floor doing its job rather than a case to special-case: an attacker whose
   * swing is nearly due cannot be hurried further.
   */
  if (hurried >= remaining) return;

  context.events.cancel(pending);
  attacker.setPendingSwing(slot, context.events.schedule(now + hurried, pending.event));
}
