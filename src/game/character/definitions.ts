import type { ClassId, FactionId, RaceId } from './ids';

/**
 * Character creation data for World of Warcraft: Forever.
 *
 * Forever is its own ruleset, heavily based on Classic but not identical to it.
 * Several combinations here are deliberately different from real Classic and
 * must NOT be "corrected" toward it:
 *
 *   - Paladin is not Alliance-locked and Shaman is not Horde-locked. Dwarf
 *     Shaman and Undead Paladin are intentional, and the result is that both
 *     factions can field all nine classes.
 *   - Human Hunter, Gnome Priest, Orc Mage and Troll Warlock exist here,
 *     though none of them did in real Classic.
 *   - High Order Skyborne and Windshaper Skyborne are Forever-only races.
 *
 * The invariants this data must satisfy are enforced by tests, so a future
 * edit that breaks one fails the build rather than the simulation.
 */

/**
 * The level cap in World of Warcraft: Forever, matching Classic.
 *
 * Kept here rather than in the engine because it is a ruleset decision, not a
 * simulation rule: raising the cap in a future patch is a content change.
 * Anything that scales with level — base stats, rating conversions, ability
 * coefficients — should read this rather than hard-coding 60.
 */
export const MAX_CHARACTER_LEVEL = 60;

/** The lowest level a character can be. */
export const MIN_CHARACTER_LEVEL = 1;

export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
}

export interface RaceDefinition {
  readonly id: RaceId;
  readonly name: string;
  readonly faction: FactionId;
  /** Classes this race may choose. Order is the display order. */
  readonly classes: readonly ClassId[];
}

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
}

export const FACTIONS: readonly FactionDefinition[] = [
  { id: 'alliance', name: 'Alliance' },
  { id: 'horde', name: 'Horde' },
];

export const CLASSES: readonly ClassDefinition[] = [
  { id: 'druid', name: 'Druid' },
  { id: 'hunter', name: 'Hunter' },
  { id: 'mage', name: 'Mage' },
  { id: 'paladin', name: 'Paladin' },
  { id: 'priest', name: 'Priest' },
  { id: 'rogue', name: 'Rogue' },
  { id: 'shaman', name: 'Shaman' },
  { id: 'warlock', name: 'Warlock' },
  { id: 'warrior', name: 'Warrior' },
];

export const RACES: readonly RaceDefinition[] = [
  // --- Alliance ---
  {
    id: 'human',
    name: 'Human',
    faction: 'alliance',
    classes: ['hunter', 'mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    faction: 'alliance',
    classes: ['hunter', 'paladin', 'priest', 'rogue', 'shaman', 'warrior'],
  },
  {
    id: 'night_elf',
    name: 'Night Elf',
    faction: 'alliance',
    classes: ['druid', 'hunter', 'priest', 'rogue', 'warrior'],
  },
  {
    id: 'gnome',
    name: 'Gnome',
    faction: 'alliance',
    classes: ['mage', 'priest', 'rogue', 'warlock', 'warrior'],
  },
  {
    id: 'high_order_skyborne',
    name: 'High Order Skyborne',
    faction: 'alliance',
    classes: ['druid', 'hunter', 'mage', 'rogue', 'warrior'],
  },

  // --- Horde ---
  {
    id: 'orc',
    name: 'Orc',
    faction: 'horde',
    classes: ['hunter', 'mage', 'rogue', 'shaman', 'warlock', 'warrior'],
  },
  {
    id: 'undead',
    name: 'Undead',
    faction: 'horde',
    classes: ['mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
  },
  {
    id: 'tauren',
    name: 'Tauren',
    faction: 'horde',
    classes: ['druid', 'hunter', 'shaman', 'warrior'],
  },
  {
    id: 'troll',
    name: 'Troll',
    faction: 'horde',
    classes: ['hunter', 'mage', 'priest', 'rogue', 'shaman', 'warlock', 'warrior'],
  },
  {
    id: 'windshaper_skyborne',
    name: 'Windshaper Skyborne',
    faction: 'horde',
    classes: ['druid', 'hunter', 'mage', 'rogue', 'shaman', 'warrior'],
  },
];
