import type { Combatant, WeaponSlot } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/**
 * PARRY HASTE: parrying an attack hurries the PARRIER's own next swing.
 *
 * ==============================================================================
 * THE UNIT THAT PARRIES IS THE UNIT THAT SPEEDS UP. The ruleset owner: "if I
 * parry an attack MY NEXT ATTACK COMES SOONER. If a boss parries an attack
 * THEIR NEXT ATTACK COMES SOONER." A parry is a counter, and a counter is the
 * parrier acting.
 *
 * IT WAS BUILT THE OTHER WAY ROUND FIRST, off the owner's original sentence --
 * "successfully parrying an attack reduces the attacker's remaining swing timer
 * by 40% of their max swing time" -- where "the attacker" reads naturally as the
 * unit whose blow was turned aside. It means the parrier, who is an attacker in
 * their own right.
 *
 * **THE WRONG READING WAS SELF-CONSISTENT AND DANGEROUS-SOUNDING**, which is
 * what let it stand through a review and a measurement pass: it made a tank
 * parrying a boss speed the BOSS up, which sounds exactly like the thing a tank
 * should fear, and every figure it produced was internally consistent. It even
 * produced a finding -- "parry is worth 42% of dodge" -- that was wrong and
 * read as insight.
 *
 * AND IT BITES THE OTHER WAY ROUND. The boss parries 14% of the TANK's blows,
 * and the tank swings far more often than the boss does, so the boss is hurried
 * by the tank's own ATTACKS rather than by the tank's defence. The tank being
 * hurried by its own parries is a straightforward gain.
 *
 * Both figures are the owner's: 40% of a full swing off the remaining timer,
 * "provided the reduction does not lower the timer below 20% of its original
 * duration", and "this mechanic applies to both players and mobs, including
 * raid bosses".
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
 * a hasted parrier's floor exceed its own swing.
 *
 * THE SLOT IS THE PARRIER'S MAIN HAND, and it has nothing to do with the weapon
 * that was parried. "My next attack" is one swing, so a dual-wielder's off hand
 * is deliberately left alone -- hurrying both would be "my next TWO attacks come
 * sooner", which is not what was stated. Recorded as the reading it is, because
 * nothing in this project dual-wields and parries often enough to measure the
 * difference.
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
 * IT IS STILL SCHEDULED RATHER THAN APPLIED INLINE, THOUGH THE REASON HAS
 * SOFTENED. While this hurried the ATTACKER, inline was fatal: a swing's own
 * handler resolves its blow and only THEN schedules its successor, so the handle
 * on the combatant was the swing that was CURRENTLY FIRING -- no time left on
 * it, nothing to hurry -- and the mechanic fired exactly zero times. Every unit
 * test passed, because a test that calls `dealDamage` by hand DOES leave a real
 * future swing pending, which is the one case that path never presents. What
 * caught it was measuring the mechanism: three tank profiles took 25.5 attacks
 * a fight before the change and 25.5 after it.
 *
 * Hurrying the PARRIER, that case cannot arise -- the parrier is being attacked
 * rather than swinging, so its pending swing is a genuine future one. The
 * schedule is kept anyway: it costs one event, it keeps the mechanic on the
 * ordinary path the way `extraAttack` is, and it is what the end-to-end test
 * pins.
 * ==============================================================================
 */
export function applyParryHaste(context: SimulationContext, parrier: Combatant): void {
  const rule = parrier.parryHaste;
  const slot: WeaponSlot = 'mainHand';
  if (!rule || !parrier.weapons[slot]) return;

  context.events.schedule(
    context.clock.now(),
    createEvent(`parry-haste:${parrier.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!parrier.isAlive || ctx.hasEnded) return;
      hurry(ctx, parrier, slot, rule.reductionFraction, rule.floorFraction);
    }),
  );
}

/** Move the parrier's pending swing earlier, once one actually exists. */
function hurry(
  context: SimulationContext,
  parrier: Combatant,
  slot: WeaponSlot,
  reductionFraction: number,
  floorFraction: number,
): void {
  const weapon = parrier.weapons[slot];
  if (!weapon) return;

  /*
   * NOTHING PENDING MEANS NOTHING TO HURRY. A combatant that does not auto
   * attack has no swing timer at all, so a caster parrying a blow moves
   * nothing -- correctly, because there is no swing for it to move.
   */
  const pending = parrier.pendingSwing(slot);
  if (!pending || pending.cancelled) return;

  const now = context.clock.now();
  const remaining = pending.timestamp - now;
  if (remaining <= 0) return;

  const full = applyHaste(weapon.swingTimerMs, hasteMultiplierFrom(parrier.stats.effective));
  const hurried = Math.max(full * floorFraction, remaining - full * reductionFraction);

  /*
   * ALREADY AT OR INSIDE THE FLOOR, so the parry buys nothing. That is the
   * floor doing its job rather than a case to special-case: a parrier whose
   * swing is nearly due cannot be hurried further.
   */
  if (hurried >= remaining) return;

  context.events.cancel(pending);
  parrier.setPendingSwing(slot, context.events.schedule(now + hurried, pending.event));
}
