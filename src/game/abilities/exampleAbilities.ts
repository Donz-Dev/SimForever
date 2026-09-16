import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { RENDING_WOUND } from '../auras/exampleAuras';

/**
 * Example abilities.
 *
 * Again, not real WoW spells. Between them they cover the ability features the
 * engine supports: a cooldown, a resource cost, an aura application, and a
 * plain resource dump used as filler.
 *
 * Note how little each one contains. Cooldowns, the global cooldown, resource
 * payment and target validity are all handled by the engine, so an ability
 * definition is only the part that is actually unique to it.
 */

/**
 * On cooldown, costs rage, hits hard and applies a stacking bleed.
 *
 * The rotation's first priority.
 */
export const STRIKE: Ability = {
  id: 'strike',
  name: 'Strike',
  cooldownMs: seconds(4.5),
  cost: { resource: 'rage', amount: 20 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'strike',
      abilityName: 'Strike',
      school: 'physical',
      baseAmount: 120,
      powerCoefficient: 0.9,
    });

    simulation.applyAura(target, RENDING_WOUND, caster.id);
  },
};

/**
 * No cooldown, expensive. Spends rage that would otherwise cap while Strike is
 * recharging, which is what makes the resource system visible in the results.
 */
export const HEROIC_BLOW: Ability = {
  id: 'heroic_blow',
  name: 'Heroic Blow',
  cost: { resource: 'rage', amount: 35 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'heroic_blow',
      abilityName: 'Heroic Blow',
      school: 'physical',
      baseAmount: 95,
      powerCoefficient: 0.75,
    });
  },
};

export const EXAMPLE_ABILITIES: readonly Ability[] = [STRIKE, HEROIC_BLOW];
