import type { Combatant } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { dealDamage } from './damage';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/** Damage varies this much either side of the weapon's base, unless overridden. */
const DEFAULT_DAMAGE_VARIANCE = 0.15;

/**
 * Auto attacks: an off-GCD swing that repeats on its own timer.
 *
 * Modelled separately from abilities because it never competes for the global
 * cooldown, is never chosen by a rotation, and continues on its own once combat
 * starts. Each swing schedules the next, so haste changing mid-fight
 * automatically shortens the following swing without any special handling.
 */
export function startAutoAttack(
  context: SimulationContext,
  attacker: Combatant,
): void {
  if (!attacker.weapon) return;
  scheduleNextSwing(context, attacker, 0);
}

function scheduleNextSwing(
  context: SimulationContext,
  attacker: Combatant,
  delayMs: number,
): void {
  const weapon = attacker.weapon;
  if (!weapon) return;

  context.events.schedule(
    context.clock.now() + delayMs,
    createEvent(`auto-attack:${attacker.id}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;

      const target = ctx.defaultTargetFor(attacker);
      const haste = hasteMultiplierFrom(attacker.stats.effective);

      if (target) {
        swing(ctx, attacker, target);
      }

      // The swing timer keeps running even with no valid target, so that
      // target switching mid-fight does not hand out a free reset.
      scheduleNextSwing(ctx, attacker, applyHaste(weapon.swingTimerMs, haste));
    }),
  );
}

function swing(context: SimulationContext, attacker: Combatant, target: Combatant): void {
  const weapon = attacker.weapon;
  if (!weapon) return;

  const variance = weapon.damageVariance ?? DEFAULT_DAMAGE_VARIANCE;
  const roll = context.rng.nextFloat(1 - variance, 1 + variance);

  dealDamage(context, {
    source: attacker,
    target,
    abilityName: weapon.name,
    school: weapon.school ?? 'physical',
    baseAmount: weapon.baseDamage * roll,
    powerCoefficient: weapon.powerCoefficient ?? 0,
  });

  if (weapon.generates) {
    context.grantResource(attacker, weapon.generates.resource, weapon.generates.amount);
  }
}
