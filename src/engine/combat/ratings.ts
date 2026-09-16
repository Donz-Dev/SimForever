import type { Stats } from '../stats';

/**
 * Converting secondary ratings into percentages.
 *
 * Every constant here is a PLACEHOLDER. Real WoW values vary by expansion and
 * by character level, and pinning them down is a content problem, not an
 * engine problem. What matters now is that the conversion lives in exactly one
 * place, so replacing these with real, level-scaled tables later is a change to
 * this file and nothing else.
 */

/** Rating required for one percentage point, at the level this build targets. */
export const RATING_PER_PERCENT = {
  crit: 180,
  haste: 170,
  mastery: 180,
  versatility: 205,
} as const;

/** Crit chance every character has before any rating. */
export const BASE_CRIT_CHANCE = 0.05;

/** Damage multiplier on a critical strike. */
export const CRITICAL_STRIKE_MULTIPLIER = 2.0;

/**
 * Armor constant in `reduction = armor / (armor + K)`. A larger K means armor
 * is worth less. Real WoW scales K with attacker level.
 */
export const ARMOR_CONSTANT = 7390;

/** Armor can never remove more than this fraction of a physical hit. */
export const MAX_ARMOR_REDUCTION = 0.85;

/** Crit chance in [0, 1] from a character's effective stats. */
export function critChanceFrom(stats: Stats): number {
  const fromRating = stats.critRating / RATING_PER_PERCENT.crit / 100;
  return clamp01(BASE_CRIT_CHANCE + fromRating);
}

/**
 * Haste as a multiplier, where 1.0 is no haste and 1.2 is 20% haste.
 * Divide a cast time or swing timer by this to get the hasted value.
 */
export function hasteMultiplierFrom(stats: Stats): number {
  return 1 + stats.hasteRating / RATING_PER_PERCENT.haste / 100;
}

/** Versatility as a damage-done multiplier. */
export function versatilityMultiplierFrom(stats: Stats): number {
  return 1 + stats.versatilityRating / RATING_PER_PERCENT.versatility / 100;
}

/** Apply haste to a duration, rounded to whole milliseconds. */
export function applyHaste(durationMs: number, hasteMultiplier: number): number {
  return Math.max(1, Math.round(durationMs / hasteMultiplier));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
