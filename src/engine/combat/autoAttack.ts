import type { Combatant, WeaponProfile, WeaponSlot } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { dealDamage, grantGeneratedResource } from './damage';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/**
 * Auto attacks: off-GCD swings that repeat on their own timers.
 *
 * Modelled separately from abilities because they never compete for the global
 * cooldown, are never chosen by a rotation, and continue on their own once
 * combat starts.
 *
 * Which weapons swing is decided by the combatant's auto-attack mode, which
 * comes from its combat style. Each slot runs an INDEPENDENT timer: a
 * dual-wielder's off-hand does not wait for the main hand, so the two drift
 * apart over a fight exactly as they do in game.
 */
export function startAutoAttack(context: SimulationContext, attacker: Combatant): void {
  for (const slot of swingingSlots(attacker)) {
    const weapon = attacker.weapons[slot];
    if (!weapon) continue;
    scheduleSwing(context, attacker, slot, 0);
  }
}

/** The weapon slots that auto-attack, given the combatant's mode. */
export function swingingSlots(attacker: Combatant): readonly WeaponSlot[] {
  switch (attacker.autoAttack) {
    case 'none':
      return [];
    case 'main-hand':
      return ['mainHand'];
    case 'dual-wield':
      return ['mainHand', 'offHand'];
    case 'ranged':
      return ['ranged'];
  }
}

/**
 * An extra attack: complete this weapon's swing NOW and restart its timer.
 *
 * Hand of Justice and effects like it. The swing is scheduled at the current
 * timestamp rather than run inline, for two reasons. It lets the reaction that
 * triggered it finish first, so the extra swing can itself proc things --
 * an extra attack is a real attack. And it keeps every swing on one code path,
 * so a queued Heroic Strike is consumed by the extra swing exactly as it would
 * be by a normal one.
 *
 * The swing timer resets because `scheduleSwing` keeps at most one pending
 * swing per slot: the one this extra attack schedules replaces whatever was
 * outstanding. That single invariant is also what stops a proc from forking the
 * chain into two independent timers.
 */
export function extraAttack(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;

  context.events.schedule(
    context.clock.now(),
    createEvent(`extra-attack:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;

      if (ctx.defaultTargetFor(attacker)) {
        attacker.auras.consumeSwingCharges(ctx);
        swing(ctx, attacker, weapon, slot);
      }

      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
    }),
  );
}

/**
 * Restart every swinging weapon's timer from now.
 *
 * What a cast does to a melee character by default: the swing in progress is
 * lost and the timer begins again. Exported because casting is what calls it,
 * and casting lives in the abilities layer.
 */
export function resetSwingTimers(context: SimulationContext, attacker: Combatant): void {
  for (const slot of swingingSlots(attacker)) {
    const weapon = attacker.weapons[slot];
    if (!weapon) continue;
    const haste = hasteMultiplierFrom(attacker.stats.effective);
    scheduleSwing(context, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
  }
}

function scheduleSwing(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
  delayMs: number,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;

  // At most ONE pending swing per slot, always.
  //
  // Without this an extra attack forks the chain. It fires from inside a swing,
  // which has not yet scheduled its successor, so the extra attack schedules
  // one and then the original swing schedules another -- two independent
  // timers on one weapon, doubling again with every proc. Four Hand of Justice
  // procs turned 115 main-hand swings into 211.
  //
  // Cancelling here is harmless in the normal case: the handle a firing swing
  // holds is its own, and cancelling an event that has already run does
  // nothing.
  context.events.cancel(attacker.pendingSwing(slot));

  const handle = context.events.schedule(
    context.clock.now() + delayMs,
    createEvent(`auto-attack:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;

      // A swing that comes due mid-cast is HELD, not lost: it waits for the
      // cast to finish and then lands. A cast that resets the swing timer has
      // already pushed this swing back, so in practice only a `hold` cast or a
      // cast longer than a swing timer reaches here.
      const remainingCast = attacker.castEndsAt - ctx.clock.now();
      if (remainingCast > 0) {
        scheduleSwing(ctx, attacker, slot, remainingCast);
        return;
      }

      const target = ctx.defaultTargetFor(attacker);
      if (target) {
        // Spent BEFORE the swing resolves, so an effect applied by this swing's
        // own critical strike is not immediately eaten by it.
        attacker.auras.consumeSwingCharges(ctx);
        swing(ctx, attacker, weapon, slot);
      }

      // The timer keeps running even with no valid target, so that switching
      // targets mid-fight does not hand out a free reset.
      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
    }),
  );

  // Kept so an extra attack can cancel it. A swing that has already fired
  // clears its own handle when it reschedules.
  attacker.setPendingSwing(slot, handle);
}

function swing(
  context: SimulationContext,
  attacker: Combatant,
  weapon: WeaponProfile,
  slot: WeaponSlot,
): void {
  const target = context.defaultTargetFor(attacker);
  if (!target) return;

  // An on-next-swing ability replaces this swing entirely. It was paid for and
  // armed when it was cast, so all that is left is to run its effect. The swing
  // timer is untouched either way, which is what makes these abilities free
  // throughput rather than a replacement for a global cooldown.
  const queuedId = attacker.takeQueuedSwing(slot);
  if (queuedId !== undefined) {
    const queued = attacker.abilities.get(queuedId);
    if (queued) {
      queued.onCast({ simulation: context, caster: attacker, target, ability: queued });
      return;
    }
  }

  // An auto attack IS weapon damage and nothing else, so it goes through the
  // same scaling every weapon-damage ability uses. The damage roll, the attack
  // power contribution and the off-hand penalty are all handled there, which is
  // what stops a swing and a Mortal Strike from ever disagreeing about the same
  // weapon.
  const result = dealDamage(context, {
    source: attacker,
    target,
    abilityName: weapon.name,
    school: weapon.school ?? 'physical',
    baseAmount: 0,
    weaponScaling: { slot },
    // Ranged weapons use the ranged table, which has no dodge, parry or
    // glancing blow.
    attackTable: slot === 'ranged' ? 'ranged-auto' : 'melee-auto',
    weaponSlot: slot,
  });

  // Resource from damage DEALT, proportional to what actually landed. A missed
  // or dodged swing generates nothing, which is the behaviour that makes a
  // high-miss build rage-starved as well as low-damage.
  grantGeneratedResource(context, attacker, weapon.generates, result.amount);

}
