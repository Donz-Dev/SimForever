import type { SimulationConfig } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createPlayer } from '../game/actors/createPlayer';
import { createForeverAttackChances } from '../game/combat/attackChances';
import { resolveCombatStyle } from '../game/character';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';
import { raidBuffPoolStats, selectedRaidBuffs } from '../game/buffs/raidBuffs';

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
  /*
   * Resolved ONCE, outside the combatant factory, because the selection is the
   * same for every iteration of a batch. The auras themselves are shared
   * definitions and hold no per-character state, so there is nothing to
   * rebuild three thousand times.
   */
  const buffs = selectedRaidBuffs(profile.raidBuffs);
  const onPlayer = buffs.filter((buff) => buff.appliesTo === 'player');
  const onTarget = buffs.filter((buff) => buff.appliesTo === 'enemy');

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
        /*
         * WINDFURY AND ANYTHING ELSE THE RAID PROCS. A character standing
         * alone has none of these, which is why they arrive from the encounter
         * rather than from the class or the gear.
         */
        extraReactions: onPlayer.flatMap((buff) =>
          /*
           * BUILT HERE, inside the combatant factory, so every iteration gets
           * its own. Windfury's internal cooldown is per-character state, and
           * a reaction built once at module load shares that timer with every
           * fight in the batch -- which silently stopped it proccing at all
           * after the first iteration.
           */
          buff.buildReaction ? [buff.buildReaction()] : [],
        ),
        /*
         * THE POOLS HAVE TO KNOW ABOUT THE BUFFS, and nothing else does.
         * Health and mana are sized once from a stats snapshot, so Power Word:
         * Fortitude's stamina would otherwise grant no health at all -- see
         * `raidBuffPoolStats`.
         */
        poolStats: raidBuffPoolStats(profile.raidBuffs),
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

    /*
     * THE RAID, applied before anything swings.
     *
     * This used to read "no opening buffs", and said why: `BATTLE_FURY`, an
     * example aura granting an INVENTED +10% attack power, was applied to
     * every player here and inflated every figure the simulator produced. It
     * was deleted, and the note ended "real raid buffs belong here when there
     * is real data for them."
     *
     * There is now. Every number comes from the ruleset owner directly, and
     * NOTHING IS APPLIED THAT WAS NOT CHOSEN -- `profile.raidBuffs` is empty
     * on a new profile and on every migrated one, so the difference between
     * this and the old `BATTLE_FURY` is entirely that somebody asked for it.
     */
    onCombatStart: (context) => {
      for (const actor of context.combatants) {
        const applicable = actor.isPlayerControlled ? onPlayer : onTarget;
        for (const buff of applicable) {
          // An entry with no aura is a PROC -- Windfury Totem -- and its own
          // reaction applies what it has when it fires.
          if (!buff.aura) continue;

          /*
           * APPLIED AS MANY TIMES AS IT TAKES, which for Sunder Armor is five
           * -- the 2,250 armor the ruleset owner states, and the same aura a
           * warrior's own casts refresh rather than a second copy of it.
           *
           * Repeated application rather than setting the stack count, because
           * a stack count written straight onto the instance does NOT rescale
           * the stat modifiers: `applyStatModifiers` multiplies by the stacks
           * it saw when it ran. Sunder read as one stack's worth of armor --
           * 450 instead of 2,250 -- until this went through the normal path.
           */
          for (let i = 0; i < (buff.stacks ?? 1); i++) {
            context.applyAura(actor, buff.aura, actor.id);
          }
        }
      }
    },
  };
}
