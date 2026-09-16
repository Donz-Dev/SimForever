import type { Combatant, WeaponProfile, WeaponSlot } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { dealDamage } from './damage';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/** Damage varies this much either side of the weapon's base, unless overridden. */
const DEFAULT_DAMAGE_VARIANCE = 0.15;

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

  const variance = weapon.damageVariance ?? DEFAULT_DAMAGE_VARIANCE;
  const roll = context.rng.nextFloat(1 - variance, 1 + variance);

  // The multiplier scales the whole swing, attack power contribution included,
  // rather than only the weapon's own damage. A half-damage off-hand that still
  // got full attack power scaling would get stronger as the character geared up.
  const multiplier = weapon.damageMultiplier ?? 1;

  dealDamage(context, {
    source: attacker,
    target,
    abilityName: weapon.name,
    school: weapon.school ?? 'physical',
    baseAmount: weapon.baseDamage * roll * multiplier,
    powerCoefficient: (weapon.powerCoefficient ?? 0) * multiplier,
    // Ranged weapons use the ranged table, which has no dodge, parry or
    // glancing blow.
    attackTable: slot === 'ranged' ? 'ranged-auto' : 'melee-auto',
  });

  if (weapon.generates) {
    context.grantResource(attacker, weapon.generates.resource, weapon.generates.amount);
  }

}
