/**
 * The vocabulary of character creation: factions, races and classes.
 *
 * These are declared as `as const` arrays in TypeScript rather than loaded from
 * JSON, which is a deliberate exception to the "game data lives in JSON" rule.
 * The reason is that these identifiers are referenced throughout the codebase:
 * profiles store them, abilities will be restricted by them, racial traits will
 * key off them. Deriving literal union types from the arrays means a typo like
 * `'nightelf'` instead of `'night_elf'` is a compile error rather than a
 * simulation that silently produces plausible-looking wrong numbers.
 *
 * JSON imports widen string values to `string`, which would throw that away.
 * Bulk content that arrives from an external export — items, spells — still
 * belongs in JSON; hand-authored vocabulary like this does not.
 */

export const FACTION_IDS = ['alliance', 'horde'] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export const RACE_IDS = [
  // Alliance
  'human',
  'dwarf',
  'night_elf',
  'gnome',
  'high_order_skyborne',
  // Horde
  'orc',
  'undead',
  'tauren',
  'troll',
  'windshaper_skyborne',
] as const;
export type RaceId = (typeof RACE_IDS)[number];

/**
 * Ways of fighting: which weapons auto-attack, and which rotation applies.
 *
 * Combat style and Druid form are deliberately one concept. A Druid's styles
 * ARE its forms — they change its resource and its stat conversions — while
 * every other class has styles that describe a weapon configuration instead.
 * Modelling them separately would mean two selectors that always had to agree.
 */
export const COMBAT_STYLE_IDS = [
  // Weapon configurations
  'two_hander',
  'one_hand_shield',
  'dual_wield',
  'ranged',
  // Caster stance, and the Druid forms that behave like it
  'caster',
  'moonkin',
  'tree',
  // Druid forms with their own attacks and resources
  'bear',
  'cat',
] as const;
export type CombatStyleId = (typeof COMBAT_STYLE_IDS)[number];

export const CLASS_IDS = [
  'druid',
  'hunter',
  'mage',
  'paladin',
  'priest',
  'rogue',
  'shaman',
  'warlock',
  'warrior',
] as const;
export type ClassId = (typeof CLASS_IDS)[number];

const RACE_ID_SET: ReadonlySet<string> = new Set(RACE_IDS);
const CLASS_ID_SET: ReadonlySet<string> = new Set(CLASS_IDS);
const FACTION_ID_SET: ReadonlySet<string> = new Set(FACTION_IDS);

/** Type guard for values arriving from JSON, a URL or user input. */
export function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && FACTION_ID_SET.has(value);
}

export function isRaceId(value: unknown): value is RaceId {
  return typeof value === 'string' && RACE_ID_SET.has(value);
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && CLASS_ID_SET.has(value);
}

const COMBAT_STYLE_ID_SET: ReadonlySet<string> = new Set(COMBAT_STYLE_IDS);

export function isCombatStyleId(value: unknown): value is CombatStyleId {
  return typeof value === 'string' && COMBAT_STYLE_ID_SET.has(value);
}
