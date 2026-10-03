import type { AuraDefinition, Combatant, SimulationConfig } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createPlayer } from '../game/actors/createPlayer';
import { createForeverAttackChances } from '../game/combat/attackChances';
import { resolveCombatStyle } from '../game/character';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';
import type { RaidBuff } from '../game/buffs/raidBuffs';
import { raidBuffPoolStats, selectedRaidBuffs } from '../game/buffs/raidBuffs';
import { createPet } from '../game/actors/createPet';
import { isPetFamilyId } from '../game/character/petFamilies';
import { hasPet } from '../game/rotations/hunter';
import { talentBuild } from '../game/talents/talentBuild';
import { sacrificedDemon } from '../game/rotations/warlock';
import { demonicSacrificeAura } from '../game/auras/warlock';

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

  /*
   * EVERY SELECTED ENTRY LASTS THE WHOLE FIGHT, at twice the planned duration.
   *
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER'S RULE, and the reason for it: Sunder Armor and Thunder
   * Clap were declared with the durations the WARRIOR'S OWN ABILITIES use --
   * thirty seconds each, because a warrior recasts them -- and the raid buff
   * reused those auras rather than declaring a second copy. That is right for a
   * warrior and wrong for everybody else: on a Mage or a Rogue nothing refreshes
   * them, so the raid's debuff fell off halfway through a sixty-second fight and
   * the last half of every such fight was measured against a target with 2,250
   * less armor removed than the first.
   *
   * THEY ARE THE ONLY TWO IT CHANGES. Every other entry is already an hour, five
   * minutes, or zero -- which means permanent here -- so this is a uniform rule
   * that happens to move exactly the two the owner named. It is uniform ON
   * PURPOSE rather than a pair of special cases: the next short-duration entry
   * someone adds gets it for free, and the alternative is a list of exceptions
   * that nobody updates.
   *
   * TWICE THE DURATION RATHER THAN THE DURATION, because a fight does not end at
   * exactly `durationSeconds` -- `FIGHT_DURATION_VARIANCE` moves the end, and an
   * aura expiring one tick before the last swing would be a silent, occasional
   * version of the bug this fixes.
   *
   * APPLIED AS AN OVERRIDE AT APPLICATION TIME, never by editing the aura. The
   * definitions are SHARED: `SUNDER_ARMOR` and `THUNDER_CLAP_SLOW` are the same
   * objects the Warrior's own abilities apply, and lengthening them at the
   * source would hand the Warrior a thirty-second debuff that lasts the fight
   * and quietly delete the reason its rotation refreshes at all.
   * ----------------------------------------------------------------------------
   */
  const raidBuffDurationMs = seconds(profile.simulation.durationSeconds) * 2;
  const forTheFight = (aura: AuraDefinition): AuraDefinition =>
    aura.durationMs === raidBuffDurationMs ? aura : { ...aura, durationMs: raidBuffDurationMs };

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
    /*
     * ------------------------------------------------------------------------
     * A PET IS A SECOND FRIENDLY COMBATANT, and almost everything about that
     * already worked: `dps` has summed every friendly actor since batching was
     * written, `CombatantKind` has had `pet`, and a `Combatant` carries its own
     * rotation. What did NOT work was the reporting -- `abilityBreakdown` read
     * one actor, so a Beast Mastery hunter would have shown a DPS figure its
     * own damage table could not account for.
     *
     * BUILT INSIDE THE FACTORY, after the player, because it reads the
     * player's finished stats: 2 health a stamina, 30% of armor, 10% of the
     * highest attack power source and 100% of crit. A pet built from a
     * half-assembled owner would inherit half a character.
     * ------------------------------------------------------------------------
     */
    createCombatants: () => {
      const player = createPlayerFor(profile, buffs);
      const pet = petFor(profile, player);
      return [player, ...(pet ? [pet] : []), createDummyFor(profile)];
    },

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
      /*
       * DEMONIC SACRIFICE IS APPLIED HERE RATHER THAN CAST.
       *
       * Its buff lasts TWO HOURS, which against a sixty-second fight is
       * forever -- a Warlock arrives having already sacrificed its demon, and
       * spending a global cooldown on it at the pull would be modelling the
       * wrong thing entirely. Which demon decides which buff, and that comes
       * from the profile's chosen companion.
       */
      const demon = sacrificedDemon(profile.talents ?? {}, profile.character.petFamily);
      const sacrifice = demon ? demonicSacrificeAura(demon) : undefined;

      for (const actor of context.combatants) {
        if (sacrifice && actor.kind === 'player') {
          context.applyAura(actor, sacrifice, actor.id);
        }

        /*
         * ------------------------------------------------------------------
         * A PET RECEIVES NO RAID BUFFS, which is a Forever rule and not
         * Classic's: "Pets can no longer receive external buffs. Player-
         * applied buffs that worked on pets in Classic no longer apply."
         *
         * `isPlayerControlled` counts a pet, which is right for deciding who
         * the raid is fighting and WRONG for deciding who the raid buffs. The
         * first version of this used it and handed a Hunter's pet the whole
         * raid -- Battle Shout, Blessing of Kings, the lot -- which also
         * printed every buff twice on the results page. That duplication is
         * how it was noticed.
         *
         * `kind === 'player'` is the narrower test and the correct one.
         * ------------------------------------------------------------------
         */
        if (actor.kind === 'pet' || actor.kind === 'summon') continue;

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
          const aura = forTheFight(buff.aura);
          for (let i = 0; i < (buff.stacks ?? 1); i++) {
            context.applyAura(actor, aura, actor.id);
          }
        }
      }
    },
  };
}

/**
 * The player, built fresh for every Monte Carlo iteration.
 *
 * Extracted from the combatant factory so the PET can be built from the
 * finished article -- a pet reads its owner's assembled stats, and one built
 * from a half-made character inherits half a character.
 */
function createPlayerFor(
  profile: CharacterProfile,
  buffs: readonly RaidBuff[],
): Combatant {
  // ONE CALL PER ENTRY. Judgement of Wisdom's two halves share a closure, so
  // building the damage and cast reactions separately would give it two
  // independent rolls per spell -- see `RaidBuffReactions`.
  const builtReactions = buffs.flatMap((buff) =>
    buff.buildReactions ? [buff.buildReactions()] : [],
  );

  return createPlayer({
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
    /*
     * BUILT HERE, inside the combatant factory, so every iteration gets
     * its own. Windfury's internal cooldown is per-character state, and
     * a reaction built once at module load shares that timer with every
     * fight in the batch -- which silently stopped it proccing at all
     * after the first iteration.
     *
     * FROM EVERY SELECTED ENTRY, not only the ones that land on the player.
     * Judgement of Wisdom is a judgement on the ENEMY whose proc belongs to
     * the attacker, so whose reaction it is and where its aura lands are two
     * different questions -- and reading `onPlayer` here answered the wrong
     * one. Windfury is unaffected: it is a player buff either way.
     */
    extraReactions: builtReactions.flatMap((built) => (built.damage ? [built.damage] : [])),
    extraCastReactions: builtReactions.flatMap((built) => (built.cast ? [built.cast] : [])),
    /*
     * THE POOLS HAVE TO KNOW ABOUT THE BUFFS, and nothing else does.
     * Health and mana are sized once from a stats snapshot, so Power Word:
     * Fortitude's stamina would otherwise grant no health at all -- see
     * `raidBuffPoolStats`.
     */
    poolStats: raidBuffPoolStats(profile.raidBuffs),
    // Which poison is on which hand. A Rogue's choice; ignored by the rest.
    poisons: profile.poisons,
  });
}

function createDummyFor(profile: CharacterProfile): Combatant {
  return createTrainingDummy({
    name: profile.encounter.targetName,
    health: profile.encounter.targetHealth,
    armor: profile.encounter.targetArmor,
    level: profile.encounter.targetLevel,
    attacks: profile.encounter.targetAttacks,
    swingDamage: profile.encounter.targetSwingDamage,
    swingSeconds: profile.encounter.targetSwingSeconds,
  });
}

/**
 * A pet, when the build brings one.
 *
 * ----------------------------------------------------------------------------
 * ONLY THE HUNTER, AND ONLY WITHOUT LONE WOLF. The talent reads "you deal 20%
 * increased damage with all attacks WHILE YOU DO NOT HAVE AN ACTIVE PET", so a
 * build that takes it has chosen not to bring one -- which makes the condition
 * a property of the build rather than something to re-check each swing.
 *
 * THE FAMILY IS A PROFILE FIELD, on the ruleset owner's call: choosing a pet
 * is a player action on the GUI, the same reasoning as the shield and the
 * combat style. A Hunter profile with none named defaults to a Cat.
 * ----------------------------------------------------------------------------
 */
function petFor(profile: CharacterProfile, owner: Combatant): Combatant | undefined {
  if (profile.character.characterClass !== 'hunter') return undefined;
  if (!hasPet(profile.talents ?? {})) return undefined;

  const family = isPetFamilyId(profile.character.petFamily)
    ? profile.character.petFamily
    : 'cat';

  /*
   * THE OWNER'S TALENTS REACH THE PET, which is what `TalentBuild.pet` is
   * for. Six Hunter talents were inert until this line existed -- Endurance
   * Training, Focused Fire's pet half, Unleashed Fury, Ferocity, Frenzy and
   * Bestial Discipline -- and they are most of what a Beast Mastery build
   * spends its points on.
   *
   * Resolved through `talentBuild` rather than read off the allocation here,
   * so illegal talents are stripped by the same rules everything else uses.
   */
  const build = talentBuild('hunter', profile.talents ?? {});
  return createPet({ owner, family, talents: build.pet });
}