import type { Combatant } from '../engine';
import { Simulation } from '../engine';
import type { CharacterProfile } from '../profiles';
import { trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * The player as they are the instant combat begins.
 *
 * ----------------------------------------------------------------------------
 * WHY THE CHARACTER SHEET CANNOT JUST CALL `createPlayer`.
 *
 * It did, and it was wrong for every Warrior in Berserker Stance. A stance is
 * an AURA, and an aura's stat modifiers are applied by the simulation when it
 * starts -- `createPlayer` only records which auras to open with. So the sheet
 * was reading a character standing in no stance at all, and a dual-wielder's
 * crit chance came out three percentage points below what the fight would
 * actually roll with.
 *
 * Adding three to the displayed number in the panel would have fixed the
 * symptom and created the real problem: two places that both know what
 * Berserker Stance is worth, which is one more than there should be. This
 * starts a real simulation and runs no events, so the answer comes from the
 * same code the fight uses.
 *
 * Nothing is simulated. `begin()` sets combat up -- opening auras, swing
 * timers, the first decision -- and then the simulation is discarded without
 * ever processing an event, so this costs one object graph and no rolls.
 * ----------------------------------------------------------------------------
 */
export function characterAtCombatStart(profile: CharacterProfile): Combatant | undefined {
  const simulation = new Simulation(trainingDummyEncounter(profile));
  simulation.begin();
  return simulation.combatants.find((actor) => actor.isPlayerControlled);
}
