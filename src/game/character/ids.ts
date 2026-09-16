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
 * Forms and stances that a class can be in.
 *
 * Only the Druid has any right now, and only because its form changes which
 * resource drives play. Warrior stances would slot in here the same way, even
 * though all three use rage.
 */
export const FORM_IDS = ['caster', 'moonkin', 'bear', 'cat'] as const;
export type FormId = (typeof FORM_IDS)[number];

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
