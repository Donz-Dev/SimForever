/**
 * The set of stats the engine knows how to track.
 *
 * This list is deliberately a flat, closed set rather than an open map. A
 * closed set means TypeScript catches a typo like `critRatng` at compile time,
 * and it means a StatBlock is a small fixed-size object rather than a hash map,
 * which matters once a Monte Carlo batch is building thousands of them.
 *
 * Adding a stat is a one-line change here plus a default in BASE_STATS.
 * Nothing in this file encodes WoW's actual formulas; those belong in the
 * rating-conversion layer, which does not exist yet.
 */
export const STAT_NAMES = [
  // Primary
  'strength',
  'agility',
  'stamina',
  'intellect',
  'spirit',

  // Derived offensive power
  'attackPower',
  'rangedAttackPower',
  'spellPower',

  /*
   * Percentage-point chances.
   *
   * These hold percentage POINTS, not fractions: 5.25 means 5.25%. A
   * Classic-style ruleset expresses crit and dodge directly rather than through
   * ratings, and these are what the conversion tables produce.
   */
  'critChance',
  'spellCritChance',
  'dodgeChance',

  /** Mana restored per five seconds. */
  'manaPer5',
  /**
   * Percentage of mana regeneration that continues while casting, in
   * percentage POINTS. 0 means regeneration stops entirely after spending.
   */
  'manaRegenBypass',

  // Secondary ratings (raw rating, not percentage). Kept for rulesets and gear
  // that grant rating rather than a flat percentage.
  'critRating',
  'hasteRating',
  'masteryRating',
  'versatilityRating',

  // Defensive
  'armor',
  'dodgeRating',
  'parryRating',
  'blockRating',
] as const;

export type StatName = (typeof STAT_NAMES)[number];

/**
 * Stats a character has directly, rather than deriving from something else.
 *
 * Conversions read these and produce the rest, so they have to be fully
 * resolved before any derivation runs. See StatBlock.
 */
export const PRIMARY_STAT_NAMES = [
  'strength',
  'agility',
  'stamina',
  'intellect',
  'spirit',
] as const satisfies readonly StatName[];

export type PrimaryStatName = (typeof PRIMARY_STAT_NAMES)[number];

/** A complete set of stat values. */
export type Stats = Record<StatName, number>;

/** An incomplete set, used when declaring gear, buffs or profile overrides. */
export type PartialStats = Partial<Stats>;

/** Every stat at zero. The starting point for any character. */
export function emptyStats(): Stats {
  const stats = {} as Stats;
  for (const name of STAT_NAMES) {
    stats[name] = 0;
  }
  return stats;
}

/** A full stat block built from a partial one, with zeros for the rest. */
export function makeStats(overrides: PartialStats = {}): Stats {
  return { ...emptyStats(), ...overrides };
}

/** Sum of two stat sets. Pure; neither input is modified. */
export function addStats(a: Stats, b: PartialStats): Stats {
  const result = { ...a };
  for (const name of STAT_NAMES) {
    result[name] = a[name] + (b[name] ?? 0);
  }
  return result;
}
