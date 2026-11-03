import type { AuraDefinition, Combatant } from '../../engine';
import { ALL_ABILITIES } from '../../engine';

/**
 * Poised, a passive every Rogue (level 18) and Druid (level 32) learns at
 * 1.60.1.70755:
 *
 *   "When you are not in combat and have your maximum Energy, you will gain
 *    Poised. Poised reduces the Energy cost of your next Energy ability by 10."
 *
 * ----------------------------------------------------------------------------
 * A CAST MODIFIER WITH ONE CHARGE: a flat 10 off the next ability paid in
 * ENERGY, spent by that cast. `requiresResource` is the clause that matters for
 * a Druid, who owns mana and rage as well -- a mana spell must not eat it.
 *
 * WHEN IT IS GAINED IS A STATE, NOT AN EVENT, so it is checked where that state
 * can change from false to true: at the pull, where every character arrives out
 * of combat at full energy, and at the start of each pull of a route, after a
 * gap in which energy has refilled. `grantPoisedIfReady` is that check, and it
 * reads the pool rather than assuming it is full.
 *
 * COMPOSURE (Combat, 1.60.1.70755) adds 5/10 to the reduction, so the aura is
 * built per character with its amount.
 * ----------------------------------------------------------------------------
 */
export const POISED_AURA_ID = 'poised';
export const POISED_ENERGY_REDUCTION = 10;

/** The `abilityBonus` key Composure adds to, on the pseudo-ability `poised`. */
export const POISED_BONUS_ABILITY = 'poised';
export const COMPOSURE_BONUS_KEY = 'composure';

export function poisedAura(extraReduction = 0): AuraDefinition {
  return {
    id: POISED_AURA_ID,
    name: 'Poised',
    // Until spent: no duration is stated.
    durationMs: 0,
    castModifier: {
      abilityIds: [ALL_ABILITIES],
      requiresCost: true,
      requiresResource: 'energy',
      costReduction: POISED_ENERGY_REDUCTION + extraReduction,
      consumedByCast: 'all',
    },
  };
}

/** The classes that learn it. */
export function learnsPoised(characterClass: string): boolean {
  return characterClass === 'rogue' || characterClass === 'druid';
}

/** Whether an out-of-combat character meets "has your maximum Energy". */
export function atMaximumEnergy(actor: Combatant): boolean {
  const energy = actor.resources.get('energy');
  return energy !== undefined && energy.current >= energy.maximum;
}

export const CATALOG_AURAS: readonly AuraDefinition[] = [poisedAura()];
