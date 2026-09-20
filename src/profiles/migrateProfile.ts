import { CURRENT_PROFILE_VERSION } from './CharacterProfile';

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
