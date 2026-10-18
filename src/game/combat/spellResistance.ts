/*
 * ==============================================================================
 * THE RULESET'S HALF OF SPELL RESISTANCE: the constant K in a hit's average
 * resisted share, `|R| / (|R| + K)`. The roll itself is the engine's --
 * `engine/combat/spellResistance.ts`.
 *
 * NINE TIMES THE CASTER'S LEVEL, BY THE OWNER'S CHOICE (round 46): K = 540 for
 * a level-60 caster. It is the one form in wowsims/forever#76 that fits all
 * four measured caster levels (20 to 30) -- 179, 209, 251 and 270 -- where
 * 5L + 80 (that project's code, 380 at 60) misses levels 29 and 30 by 3 sigma.
 *
 * A FIT, NOT A STATED RULE, and nobody has logged a level-60 caster: the
 * issue's ExpectedStat candidates agree from 20 to 30 and part above it, giving
 * 478 to 823 at 60. So the per-level figure is named as what it is, and the
 * day a level-60 log settles K this is the one number to change.
 * ==============================================================================
 */
export const SPELL_RESISTANCE_K_PER_LEVEL = 9;

/** K for a caster of this level: 540 at 60. */
export const spellResistanceConstant = (casterLevel: number): number =>
  SPELL_RESISTANCE_K_PER_LEVEL * casterLevel;
