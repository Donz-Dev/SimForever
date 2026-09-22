import type { SimulationConfig } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createPlayer } from '../game/actors/createPlayer';
import { createForeverAttackChances } from '../game/combat/attackChances';
import { resolveCombatStyle } from '../game/character';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';

/**
 * How much a fight's length varies from the length asked for, either side.
 *
 * FIXED, and not exposed. It used to be a profile field defaulting to zero,
 * which meant the app shipped with every iteration exactly the same length --
 * and a fixed length lets a rotation line up with the clock in a way no real
 * fight does. Anything keyed to a fraction of the fight, Execute above all,
 * fired at the same absolute second in all three thousand iterations.
 *
 * Five percent is the project owner's figure. It is not a Forever ruleset
 * number and nothing in the source states one: it is a modelling choice about
 * how the encounter is set up, in the same category as fight length itself.
 *
 * Mean DPS barely moves under it, because damage and duration scale together.
 * What it widens is the spread, and what it breaks is the clock alignment.
 */
export const FIGHT_DURATION_VARIANCE = 0.05;

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
    durationVariance: FIGHT_DURATION_VARIANCE,
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
         * A healer is ASSUMED, not modelled: a random 500 to 1500 every
         * second, and nothing behind it. See `encounters/externalHealer.ts`.
         *
         * The character can still be killed, and is stood back up when they
         * are. That pairing is the whole model -- the healer is what stops the
         * fight ending in three swings, and the deaths are what says when it
         * stopped being enough. Both are on the same switch, because a healer
         * with nothing to heal is noise and a revive with nothing to revive
         * from is dead code.
         */
        externalHealing: profile.encounter.targetAttacks,
        revivesOnDeath: profile.encounter.targetAttacks,
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
