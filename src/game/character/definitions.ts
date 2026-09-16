import type { ResourceType } from '../../engine';
import type { ClassId, FactionId, FormId, RaceId } from './ids';

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

/** A form or stance, and the resource that drives play while in it. */
export interface FormDefinition {
  readonly id: FormId;
  readonly name: string;
  readonly resource: ResourceType;
}

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
  /**
   * Every resource pool a character of this class owns.
   *
   * Usually one. The Druid has three, because a bear still has a mana pool it
   * is not currently using — which is exactly how the game models it, and why
   * this is a list rather than a single value.
   *
   * Health is not listed: every combatant has it, so it lives on `Combatant`
   * rather than being repeated on all nine classes.
   */
  readonly resources: readonly ResourceType[];
  /** The resource that drives play by default, i.e. in `forms[0]` if any. */
  readonly primaryResource: ResourceType;
  /** Forms that change the active resource. Empty for every class but Druid. */
  readonly forms: readonly FormDefinition[];
}

export const FACTIONS: readonly FactionDefinition[] = [
  { id: 'alliance', name: 'Alliance' },
  { id: 'horde', name: 'Horde' },
];

/** A class with one resource and no forms, which is eight of the nine. */
function simpleClass(id: ClassId, name: string, resource: ResourceType): ClassDefinition {
  return { id, name, resources: [resource], primaryResource: resource, forms: [] };
}

export const CLASSES: readonly ClassDefinition[] = [
  {
    id: 'druid',
    name: 'Druid',
    // The only class whose resource depends on what it is currently doing.
    // All three pools exist at once; the form decides which one matters.
    resources: ['mana', 'rage', 'energy'],
    primaryResource: 'mana',
    forms: [
      { id: 'caster', name: 'Caster Form', resource: 'mana' },
      { id: 'moonkin', name: 'Moonkin Form', resource: 'mana' },
      // Tree of Life appears in the stat conversion table alongside Caster and
      // Moonkin, but was not in the resource list and has no base stats row.
      // It is assumed to use mana, like the two forms it shares conversions
      // with. Both assumptions are flagged in docs/character-creation.md.
      { id: 'tree', name: 'Tree of Life Form', resource: 'mana' },
      { id: 'bear', name: 'Bear Form', resource: 'rage' },
      { id: 'cat', name: 'Cat Form', resource: 'energy' },
    ],
  },
  simpleClass('hunter', 'Hunter', 'mana'),
  simpleClass('mage', 'Mage', 'mana'),
  simpleClass('paladin', 'Paladin', 'mana'),
  simpleClass('priest', 'Priest', 'mana'),
  simpleClass('rogue', 'Rogue', 'energy'),
  simpleClass('shaman', 'Shaman', 'mana'),
  simpleClass('warlock', 'Warlock', 'mana'),
  simpleClass('warrior', 'Warrior', 'rage'),
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
