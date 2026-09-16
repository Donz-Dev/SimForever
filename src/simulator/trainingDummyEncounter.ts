import type { SimulationConfig } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createPlayer } from '../game/actors/createPlayer';
import { createForeverAttackChances } from '../game/combat/attackChances';
import { resolveCombatStyle } from '../game/character';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';
import { BATTLE_FURY } from '../game/auras/exampleAuras';

/**
 * Build a runnable simulation config from a character profile.
 *
 * This is the seam between profile data (human-facing, in seconds, JSON-safe)
 * and the engine (milliseconds, live objects). It is the only place the two
 * conventions meet.
 */
export function trainingDummyEncounter(
  profile: CharacterProfile,
  seed: number = profile.simulation.seed,
): SimulationConfig {
  return {
    durationMs: seconds(profile.simulation.durationSeconds),
    durationVariance: profile.simulation.durationVariance,
    seed,

    // The combat tables need to know the player's style, because enemy parry
    // only applies to a character standing in front of the target.
    attackChances: createForeverAttackChances((id) =>
      id === 'player_1'
        ? resolveCombatStyle(
            profile.character.characterClass,
            profile.character.combatStyle,
          )
        : undefined,
    ),

    // A factory, not an array: every Monte Carlo iteration needs its own fresh
    // combatants rather than the previous iteration's leftovers.
    createCombatants: () => [
      createPlayer({
        name: profile.character.name,
        race: profile.character.race,
        characterClass: profile.character.characterClass,
        combatStyle: profile.character.combatStyle,
        bonusStats: profile.stats,
      }),
      createTrainingDummy({
        name: profile.encounter.targetName,
        health: profile.encounter.targetHealth,
        armor: profile.encounter.targetArmor,
        level: profile.encounter.targetLevel,
      }),
    ],

    onCombatStart: (context) => {
      // Opening buffs go here. Applied at time 0, before any event fires.
      for (const actor of context.combatants) {
        if (actor.kind === 'player') {
          context.applyAura(actor, BATTLE_FURY, actor.id);
        }
      }
    },
  };
}
