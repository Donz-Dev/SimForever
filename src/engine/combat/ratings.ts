import type { Stats } from '../stats';

/**
 * Converting secondary ratings into percentages.
 *
 * ----------------------------------------------------------------------------
 * EIGHT OF THESE ARE THE RULESET OWNER'S OWN FIGURES AND ARE NO LONGER
 * PLACEHOLDERS. They were placeholders for the whole project -- "real WoW
 * values vary by expansion and by character level" -- and the owner has since
 * stated Forever's table outright, which is also the first time anything here
 * needed it: Forever grants hit, crit, dodge, defense and expertise as RATINGS
 * on real items where Classic grants flat percentages.
 *
 * CHANGING CRIT FROM 180 TO 14 MOVED NOTHING, which is worth recording because
 * it looks like it should have moved everything. Nothing in the project grants
 * `critRating` -- every profile defaults it to 0 -- and every haste source
 * uses the `percent * RATING_PER_PERCENT.haste` idiom that `hasteMultiplierFrom`
 * divides straight back out, so the constant cancels. All 75 combat-log hashes
 * are unchanged across the change.
 *
 * `mastery` and `versatility` are STILL PLACEHOLDERS: Forever states neither,
 * and nothing in the ruleset grants either. They keep the old invented numbers
 * and say so.
 * ----------------------------------------------------------------------------
 */

/** Rating required for one percentage point. The owner's table. */
export const RATING_PER_PERCENT = {
  /** 14 Rating = +1% Crit Chance. */
  crit: 14,
  /** 10 Rating = +1% Haste. */
  haste: 10,
  /** 10 Rating = +1% Hit Chance. */
  hit: 10,
  /** 1 Rating = 1 Defense Skill -- a SKILL POINT, not a percentage. */
  defense: 1,
  /** 10 Rating = +1% reduced chance to be Dodged or Parried. */
  expertise: 10,
  /** 12 Rating = +1% Dodge Chance. */
  dodge: 12,
  /** 20 Rating = +1% Parry Chance. */
  parry: 20,
  /** 5 Rating = +1% Block Chance. */
  block: 5,
  /** PLACEHOLDER. Forever states nothing and nothing grants it. */
  mastery: 180,
  /** PLACEHOLDER. Forever states nothing and nothing grants it. */
  versatility: 205,
} as const;

/*
 * There is no universal base crit constant any more.
 *
 * A character's base crit is a class constant from the base stats table, and
 * agility adds to it through the class conversion table. Both are content, so
 * the engine reads `stats.critChance` rather than owning a number of its own.
 */

/** Damage multiplier on a critical strike. */
export const CRITICAL_STRIKE_MULTIPLIER = 2.0;

/**
 * The armor constant, which scales with the defender's level:
 *
 *     K = 400 + 85 * level
 *
 * A larger K means armor is worth less. At level 63 it is 5755, which puts a
 * 3731-armor raid boss at just under 40% physical reduction.
 */
export function armorConstantForLevel(level: number): number {
  return 400 + 85 * level;
}

/**
 * Melee and ranged crit chance as a fraction in [0, 1].
 *
 * `stats.critChance` is in percentage POINTS and already includes the class
 * base constant plus whatever agility contributed, so this mostly just converts
 * units. Rating is added on top for gear that grants it.
 *
 * The class constants can be negative (a Hunter's base is -1.53), which is why
 * the result is clamped rather than assumed positive.
 */
export function critChanceFrom(stats: Stats): number {
  const fromRating = stats.critRating / RATING_PER_PERCENT.crit / 100;
  return clamp01(stats.critChance / 100 + fromRating);
}

/**
 * Spell crit chance as a fraction in [0, 1].
 *
 * ----------------------------------------------------------------------------
 * `critRating` FEEDS THIS TOO, which is a ruleset fact rather than a tidy-up.
 * Classic has two separate item lines -- "Improves your chance to get a
 * critical strike by 1%" and "...with spells by 2%" -- and Forever rewrote
 * BOTH into one "+N Critical Strike Rating". The rewrites are in the data and
 * they settle it: across 42 items the melee line converts at exactly 14 rating
 * per point, and across 20 items the SPELL line converts at exactly 14 too.
 * One rating, both tables.
 *
 * So a Forever caster item granting 28 Critical Strike Rating is granting 2%
 * spell crit, and reading the rating on the melee side only would have deleted
 * every point of spell crit Forever gear carries.
 * ----------------------------------------------------------------------------
 */
export function spellCritChanceFrom(stats: Stats): number {
  const fromRating = stats.critRating / RATING_PER_PERCENT.crit / 100;
  return clamp01(stats.spellCritChance / 100 + fromRating);
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
