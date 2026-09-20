import type { SimulationConfig } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createPlayer } from '../game/actors/createPlayer';
import { createForeverAttackChances } from '../game/combat/attackChances';
import { resolveCombatStyle } from '../game/character';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';

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
        stance: profile.character.stance,
        bonusStats: profile.stats,
        equipment: profile.equipment,
        talents: profile.talents,
        /*
         * A healer is ASSUMED, not modelled. Without this a warrior taking
         * boss swings dies in three of them and every fight ends early, which
         * would make the whole feature useless. The damage still lands in full
         * and still generates rage; survival is simply not what is being
         * measured. See `survivesLethalDamage`.
         */
        survivesLethalDamage: profile.encounter.targetAttacks,
      }),
      createTrainingDummy({
        name: profile.encounter.targetName,
        health: profile.encounter.targetHealth,
        armor: profile.encounter.targetArmor,
        level: profile.encounter.targetLevel,
        attacks: profile.encounter.targetAttacks,
        swingDamage: profile.encounter.targetSwingDamage,
        swingSeconds: profile.encounter.targetSwingSeconds,
      }),
    ],

    // No opening buffs.
    //
    // This used to apply `BATTLE_FURY`, an example aura granting an invented
    // +10% attack power, to every player. It inflated every damage figure the
    // simulator produced, and a character sheet reading 400 attack power fought
    // at 440. Removed rather than kept, because a buff nobody asked for that
    // silently moves every number is exactly the kind of invented data this
    // project refuses.
    //
    // Real raid buffs belong here when there is real data for them. Battle
    // Shout is already defined in `game/auras/warrior.ts`, awaiting its
    // numbers.
  };
}
