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

function scheduleSwing(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
  delayMs: number,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;

  context.events.schedule(
    context.clock.now() + delayMs,
    createEvent(`auto-attack:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;

      const target = ctx.defaultTargetFor(attacker);
      if (target) {
        swing(ctx, attacker, weapon, slot);
      }

      // The timer keeps running even with no valid target, so that switching
      // targets mid-fight does not hand out a free reset.
      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
    }),
  );
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
