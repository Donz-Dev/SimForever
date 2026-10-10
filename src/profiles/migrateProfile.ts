import { CURRENT_PROFILE_VERSION } from './CharacterProfile';
import type { CharacterProfile } from './CharacterProfile';
import { defaultRotationFor } from './rotation';
import { DEFAULT_POISON_LOADOUT } from '../game/reactions/poisons';
import { DEFAULT_WARLOCK_STONE } from '../game/buffs/warlockStones';

/** Transforms a profile one version forward. */
type Migration = (profile: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations keyed by the version they upgrade FROM.
 *
 * `migrations[1]` turns a version-1 profile into a version-2 profile. To change
 * the format: bump CURRENT_PROFILE_VERSION, then add the step that gets old
 * files to the new shape.
 */
const migrations: Record<number, Migration> = {
  /**
   * Version 13 added `rotation`, the Action Priority List written out in full.
   *
   * ----------------------------------------------------------------------------
   * AN OLDER PROFILE GETS ITS BUILD'S STOCK LIST, marked `'default'`, which is
   * exactly what it was already running -- every profile before this version
   * ran whatever `rotationFor` dispatched to, so writing that same list into
   * the file changes no result. That is the version 9 decision again: a saved
   * character with no raid buffs was genuinely fighting unbuffed, and a saved
   * character with no stored list was genuinely running the stock one.
   *
   * DERIVED HERE RATHER THAN LEFT EMPTY, which is the one thing that would
   * change a result: an empty list is a character that casts nothing, so a
   * migration that just added the field would silently reduce every old
   * profile to auto attacks.
   *
   * IT IS ALSO WHY THIS MIGRATION IS THE FIRST TO READ THE REST OF THE
   * PROFILE. Every earlier one supplies a constant -- `{}`, `[]`, a default
   * loadout -- and this one has to look at the class, style, stance and
   * talents to know which list the character was running.
   * ----------------------------------------------------------------------------
   */
  12: (profile) => ({
    ...profile,
    rotation: defaultRotationFor(profile as unknown as CharacterProfile),
  }),

  /**
   * Version 12 added `consumables`, the chosen consumable per category.
   *
   * Older profiles get an EMPTY selection, so nothing about their results
   * changes. That is the version 9 decision rather than the version 10 one, and
   * it turns on the same question: a saved character with no raid buffs was
   * genuinely fighting unbuffed and a saved character with no consumables was
   * genuinely fighting without them, while a saved ROGUE was not choosing to
   * fight without poisons -- those did not exist to choose.
   *
   * ----------------------------------------------------------------------------
   * IT WAS WRITTEN AS VERSION 11 AND KEYED AT 10, AND SO WAS THE WARLOCK STONE
   * BELOW. Two branches took the next version number from the same base, and
   * **git merged the two migration tables without a conflict** -- leaving one
   * object literal with the key `10` twice, where the second silently wins and
   * the first migration simply never runs. That is the same shape as the talent
   * census totals this project has had go wrong: two edits that each move a
   * number by one from the same base, merged cleanly, and short by one.
   *
   * WHAT CAUGHT IT WAS THE TYPECHECKER, not the suite and not the merge:
   * TS1117, an object literal with a duplicate property. Worth knowing because
   * a `Record<number, Migration>` built any other way -- entries pushed into a
   * map, say -- would have taken both and run only one, with nothing to say so.
   * **Re-read the version number after a rebase rather than trusting it.**
   * ----------------------------------------------------------------------------
   */
  11: (profile) => ({ consumables: {}, ...profile }),

  /**
   * Version 10 added `poisons`, which poison a Rogue coats each weapon with.
   *
   * Older profiles get the ruleset owner's stated default -- Instant on the
   * main hand, Deadly on the off hand -- rather than nothing, and THAT CHANGES
   * THEIR RESULTS. It is the opposite decision from version 9's empty raid
   * buffs, and for the opposite reason: a saved profile with no raid buffs was
   * genuinely fighting unbuffed, while a saved ROGUE was not choosing to fight
   * without poisons. Poisons did not exist, so every Rogue figure recorded
   * before this version is a floor.
   *
   * It reaches every class and costs nothing to the eight that cannot use it:
   * the reactions only ever fire for a character with the poisons applied, and
   * only a Rogue gets them.
   */
  9: (profile) => ({ poisons: { ...DEFAULT_POISON_LOADOUT }, ...profile }),

  /**
   * Version 11 added `warlockStone`, the temporary weapon enchant a Warlock
   * carries -- a Firestone or a Spellstone.
   *
   * ----------------------------------------------------------------------------
   * OLDER PROFILES GET `none`, AND THEIR RESULTS DO NOT MOVE. That is the
   * opposite of version 10's decision one step above, and the reason is the
   * authority behind each default: the ruleset owner STATED the poison pairing,
   * so a saved Rogue carrying none was wrong and worth correcting. The owner has
   * not stated which stone a Warlock carries -- the request was for a control to
   * choose with -- so choosing one here would invent a build decision and move
   * every saved Warlock figure on no authority.
   *
   * SO IT IS VERSION 9'S DECISION RATHER THAN VERSION 10'S: an empty default
   * that changes nothing, because the field records a choice nobody has made
   * yet. Both readings are defensible and the difference is only ever which one
   * the owner asked for.
   * ----------------------------------------------------------------------------
   */
  10: (profile) => ({ warlockStone: DEFAULT_WARLOCK_STONE, ...profile }),

  /**
   * Version 9 added `raidBuffs`, the ids of the buffs assumed to be up.
   *
   * Older profiles get an EMPTY list, so nothing about their results changes.
   * That is the whole reason empty is the default rather than a sensible raid
   * loadout: a migration that handed every saved character a raid's worth of
   * attack power would invalidate every figure they had recorded, and would do
   * it silently.
   */
  8: (profile) => ({ raidBuffs: [], ...profile }),

  /**
   * Version 8 took `simulation.durationVariance` off the profile.
   *
   * Fight length now varies by a fixed fraction built into the simulator, so
   * the field has nowhere to be read from and is dropped rather than carried
   * along as dead data -- validation rebuilds a profile field by field, so a
   * leftover key would be silently discarded anyway, and doing it here makes
   * it visible.
   *
   * THIS CHANGES EVERY OLD PROFILE'S RESULTS. They all ran at variance 0, a
   * fixed fight length every iteration; now every iteration is a slightly
   * different length. Mean DPS barely moves -- damage and duration scale
   * together -- but the spread widens, and anything keyed to a fraction of
   * the fight, Execute above all, now fires at a different absolute second in
   * each one. That is the intent: a fixed length let a rotation line up with
   * the clock in a way no real fight does.
   */
  7: (profile) => {
    const simulation = profile.simulation;
    if (typeof simulation !== 'object' || simulation === null) return profile;
    const { durationVariance: _dropped, ...rest } = simulation as Record<string, unknown>;
    return { ...profile, simulation: rest };
  },

  /**
   * Version 7 added `character.stance`.
   *
   * Left UNSET rather than filled in, so an old profile takes its combat
   * style's default -- which is what it was already doing implicitly, because
   * every Warrior opened in Battle Stance regardless of what it was holding.
   *
   * THAT MEANS A MIGRATED DUAL-WIELD OR SHIELD PROFILE CHANGES BEHAVIOUR: it
   * now opens in Berserker or Defensive instead of Battle, which is the stance
   * the build actually wants and is a different fight from the one it recorded.
   * Writing 'battle' here would preserve the old numbers and preserve a
   * character standing in the wrong stance, so the default wins.
   */
  6: (profile) => profile,

  /**
   * Version 6 let the target swing back.
   *
   * Older profiles fought a target that stood still, so they keep doing that:
   * `targetAttacks` defaults to false and nothing about their results changes.
   * That is the point of choosing false as the default -- a migration that
   * silently started hitting every saved character would move every number
   * they had already recorded.
   */
  5: (profile) => {
    const encounter = profile.encounter;
    if (typeof encounter !== 'object' || encounter === null) return profile;
    return {
      ...profile,
      encounter: {
        targetAttacks: false,
        targetSwingDamage: 4000,
        targetSwingSeconds: 2,
        ...(encounter as Record<string, unknown>),
      },
    };
  },

  /**
   * Version 5 added `talents`, the points spent per talent id.
   *
   * Older profiles predate talents affecting anything, so they spend none. That
   * is not a neutral default: from version 5 an empty allocation means a warrior
   * knows no Mortal Strike, Bloodthirst or Shield Slam, because those are
   * 31-point capstones rather than baseline abilities. A version 4 profile
   * therefore produces LOWER damage than it used to, which is the old number
   * being wrong rather than the new one.
   */
  4: (profile) => ({ talents: {}, ...profile }),

  /**
   * Version 4 added `equipment`, which holds what is worn by slot.
   *
   * Older profiles predate items existing at all, so they equip nothing. Their
   * `stats` block still applies on top, which is how a profile written against
   * the old "type your attack power in" model keeps producing the same numbers.
   */
  3: (profile) => ({ equipment: {}, ...profile }),

  /**
   * Version 2 replaced the Druid-only `character.form` with `combatStyle`,
   * which every class has.
   *
   * The values carry over unchanged: a Druid's forms became its combat styles,
   * so `form: 'bear'` is already a valid style id. Profiles for other classes
   * had no form at all and simply pick up their class default.
   */
  /**
   * Version 3 added `encounter.targetLevel`, which drives defense skill, the
   * armor constant and crit suppression.
   *
   * Older profiles were all written against a raid boss, so they take 63.
   */
  2: (profile) => {
    const encounter = profile.encounter;
    if (typeof encounter !== 'object' || encounter === null) return profile;
    return {
      ...profile,
      encounter: { targetLevel: 63, ...(encounter as Record<string, unknown>) },
    };
  },

  1: (profile) => {
    const character = profile.character;
    if (typeof character !== 'object' || character === null) return profile;

    const { form, ...rest } = character as Record<string, unknown>;
    return {
      ...profile,
      character: form === undefined ? rest : { ...rest, combatStyle: form },
    };
  },
};

export type MigrationResult =
  | { readonly ok: true; readonly value: unknown; readonly migrated: boolean }
  | { readonly ok: false; readonly message: string };

/**
 * Bring a parsed profile up to the current version.
 *
 * Runs before validation: an old file is valid for its own version, not for
 * this one, so it has to be upgraded before it can be checked.
 */
export function migrateProfile(value: unknown): MigrationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Profile must be an object.' };
  }

  let current = { ...(value as Record<string, unknown>) };
  const version = current.version;

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, message: 'Profile is missing a valid version number.' };
  }

  if (version > CURRENT_PROFILE_VERSION) {
    return {
      ok: false,
      message:
        `This profile was saved by a newer version of SimForever ` +
        `(format ${version}, this build understands ${CURRENT_PROFILE_VERSION}).`,
    };
  }

  let migrated = false;
  for (let from = version; from < CURRENT_PROFILE_VERSION; from++) {
    const migration = migrations[from];
    if (!migration) {
      return { ok: false, message: `No migration from profile version ${from}.` };
    }
    current = migration(current);
    current.version = from + 1;
    migrated = true;
  }

  return { ok: true, value: current, migrated };
}
