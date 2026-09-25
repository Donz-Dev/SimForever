import type { ClassId, CombatStyleId } from '../character';
import type { Equipment, EquipmentSlot } from './Item';
import { ITEMS_BY_ID } from './itemData';
import {
  CRUSADER as CRUSADER_ENCHANT,
  DRUID_BEAR_GEAR,
  DRUID_CAT_GEAR,
  DRUID_MOONKIN_GEAR,
  HUNTER_ARMOUR,
  HUNTER_MELEE_WEAPONS,
  HUNTER_STAT_STICK,
  MAGE_GEAR,
  PALADIN_PROT_GEAR,
  PALADIN_RET_GEAR,
  PALADIN_SHOCKADIN_GEAR,
  PRIEST_GEAR,
  ROGUE_ARMOUR,
  ROGUE_DAGGERS,
  SHAMAN_ELEMENTAL_GEAR,
  SHAMAN_ENHANCEMENT_GEAR,
  WARLOCK_GEAR,
} from './gearSets';

/**
 * A ready-made set of gear a character starts with, per class and combat style.
 *
 * WHY THIS EXISTS
 *
 * A character created with empty slots fights with placeholder weapons and no
 * stats, and every number it produces is meaningless until someone fills
 * nineteen dropdowns by hand. Worse, it is not OBVIOUSLY meaningless — an
 * ungeared warrior still produces a confident-looking DPS figure. Starting from
 * a real set means the first result a person sees is one worth reading.
 *
 * These are the same Classic items `src/data/items/` holds, which are stand-ins
 * for Forever gear rather than Forever data. The set is therefore a starting
 * POINT, not a recommendation: it is simply everything available, with the
 * obvious choice made where a slot has more than one candidate.
 *
 * The ids are written out rather than derived. Which ring goes in which slot is
 * a curation decision, and "whatever the item loader happened to list first"
 * is not one. A test asserts every id here exists and fits the slot it is in,
 * so a change to the item data cannot leave this silently pointing at nothing.
 */

/** Everything that is not a weapon. Identical for every Warrior style. */
const WARRIOR_ARMOUR: Partial<Record<EquipmentSlot, number>> = {
  head: 226495, // Jaws of Might
  neck: 228685, // Onyxia Tooth Pendant
  shoulders: 226492, // Pauldrons of Might
  cloak: 13340, // Cape of the Black Baron
  chest: 226494, // Hauberk of Might
  wrists: 226499, // Armguards of Might
  gloves: 226497, // Hands of Might
  waist: 226498, // Sash of Might
  legs: 226493, // Leggings of Might
  feet: 226496, // Treads of Might
  ring1: 19325, // Don Julio's Band
  ring2: 228261, // Quick Strike Ring
  trinket1: 13965, // Blackhand's Breadth
  trinket2: 11815, // Hand of Justice
  // A bow does not swing while meleeing, but it is equipped and its stats
  // count -- 22 attack power and 1% hit that a melee warrior keeps.
  ranged: 17069, // Striker's Mark
};

/** Crusader. Named here as well so the Warrior weapons below read as they did. */
const CRUSADER = CRUSADER_ENCHANT;

/** Weapons per style, with the enchant where the set carries one. */
const WARRIOR_WEAPONS: Partial<Record<CombatStyleId, Equipment>> = {
  dual_wield: {
    mainHand: { itemId: 17075 }, // Vis'kag the Bloodletter -- the slower weapon leads
    offHand: { itemId: 228265 }, // Brutality Blade
  },
  two_hander: {
    twoHand: { itemId: 228229 }, // Obsidian Edged Blade
  },
  one_hand_shield: {
    /*
     * Brutality Blade rather than Vis'kag: the ruleset owner's own pairing, and
     * the faster weapon is the better one-hander when it is not being used to
     * carry an off-hand's swing timer.
     *
     * ENCHANTED, which the other sets are not. The ruleset owner names this as
     * the tank build's default gear, and a tank holds one weapon -- so the one
     * enchant it can carry is part of the set rather than a choice to make
     * afterwards.
     */
    mainHand: { itemId: 228265, enchantId: CRUSADER }, // Brutality Blade
    shield: { itemId: 19321 }, // The Immovable Object -- the first real FOREVER item
  },
};

/**
 * What a character created FROM SCRATCH is given, per class and combat style.
 *
 * ----------------------------------------------------------------------------
 * EIGHT OF THE NINE USED TO GIVE NOTHING, and the comment above said so: "Only
 * the Warrior has items at all. Every other class gets nothing, which is the
 * honest answer rather than dressing a Mage in plate." That was honest for
 * exactly as long as there was no Mage gear to give it. There are twelve sets
 * now, from the project owner's own sixtyupgrades links, so the honest answer
 * changed.
 *
 * A PRESET IS STILL NOT THIS. A preset states all five settings that have to
 * agree; this answers the narrower question "which gear, given the class and
 * style on screen". They share the same named sets and neither calls the other.
 *
 * WHERE A STYLE HAS NO SET OF ITS OWN it takes the nearest one that fits and
 * says which: a Druid in caster or tree form takes the Moonkin set, because
 * Balance gear is what a Druid casting anything wants, and a dual-wielding
 * Hunter takes the armour with no weapons, because no Hunter one-hander is on
 * file to put in either hand.
 * ----------------------------------------------------------------------------
 */
const STARTING_SETS: Partial<
  Record<ClassId, (style: CombatStyleId, options: StartingSetOptions) => Equipment>
> = {
  warrior: (style) => ({
    ...(Object.fromEntries(
      Object.entries(WARRIOR_ARMOUR).map(([slot, itemId]) => [slot, { itemId }]),
    ) as Equipment),
    ...(WARRIOR_WEAPONS[style] ?? {}),
  }),

  // Daggers, which is what two of the three Rogue builds use and what makes
  // Backstab and Mutilate castable at all. The Combat set's swords are a choice
  // made afterwards rather than the one to start from.
  rogue: () => ({ ...ROGUE_ARMOUR, ...ROGUE_DAGGERS }),

  druid: (style) => {
    if (style === 'cat') return DRUID_CAT_GEAR;
    if (style === 'bear') return DRUID_BEAR_GEAR;
    // moonkin, caster and tree. The last two have no set of their own.
    return DRUID_MOONKIN_GEAR;
  },

  shaman: (style) =>
    style === 'two_hander' ? SHAMAN_ENHANCEMENT_GEAR : SHAMAN_ELEMENTAL_GEAR,

  /*
   * THE TWO SHIELD BUILDS ARE TOLD APART BY THE ENCOUNTER, not by the style.
   *
   * Protection and Shockadin both hold a one-hander and a shield -- the second
   * only because Earth and Fire is a CASTER shield -- so the style cannot
   * separate them. What does is whether the target swings back, which is the
   * ruleset owner's own answer and the same shape as `isTankBuild`: a build
   * inferred from two fields rather than declared in one.
   */
  paladin: (style, { targetAttacks }) => {
    if (style === 'two_hander') return PALADIN_RET_GEAR;
    if (style === 'one_hand_shield') {
      return targetAttacks ? PALADIN_PROT_GEAR : PALADIN_SHOCKADIN_GEAR;
    }
    // `caster`, which for a Paladin is the Shockadin shape.
    return PALADIN_SHOCKADIN_GEAR;
  },

  hunter: (style) => {
    // The melee build's own two-hander, or the stat stick the two ranged builds
    // hold and never swing. A dual-wielding Hunter gets neither: there is no
    // Hunter one-hander on file.
    if (style === 'two_hander') return { ...HUNTER_ARMOUR, ...HUNTER_MELEE_WEAPONS };
    if (style === 'dual_wield') return HUNTER_ARMOUR;
    return { ...HUNTER_ARMOUR, ...HUNTER_STAT_STICK };
  },

  mage: () => MAGE_GEAR,
  warlock: () => WARLOCK_GEAR,
  priest: () => PRIEST_GEAR,
};

/**
 * Everything beyond the class and the style that changes which set is right.
 *
 * One field, and it exists because two Paladin builds hold a one-hander and a
 * shield. See `STARTING_SETS.paladin`.
 */
export interface StartingSetOptions {
  /**
   * Whether the encounter has the target swinging back.
   *
   * DEFAULTS TO FALSE, which makes a Paladin's shield build the Shockadin one.
   * That is the right default rather than an arbitrary one: a character is
   * created before the encounter is set up, so at the moment this is first
   * called nothing has said the target fights back, and a damage build is the
   * safer thing to hand someone who has not said they are tanking. The Gear
   * panel's "Starting set" button is the same call made later, once it has.
   */
  readonly targetAttacks?: boolean;
}

/**
 * The gear a newly created character starts in.
 *
 * Every class has one now. Eight of them had nothing until their own sets were
 * imported, and the old comment here -- "the honest answer rather than dressing
 * a Mage in plate" -- was honest only while there was no Mage gear to give.
 */
export function startingEquipmentFor(
  characterClass: ClassId,
  style: CombatStyleId,
  options: StartingSetOptions = {},
): Equipment {
  const build = STARTING_SETS[characterClass];
  if (!build) return {};

  const equipment: Record<string, { itemId: number; enchantId?: number }> = {};
  for (const [slot, equipped] of Object.entries(build(style, options))) {
    if (!equipped) continue;
    // Silently skipping an id the data no longer has would produce a set with a
    // hole in it that nothing explains. The test below catches that at build
    // time; this guard keeps a stale id from reaching a profile at runtime.
    if (ITEMS_BY_ID.has(equipped.itemId)) equipment[slot] = { ...equipped };
  }
  return equipment as Equipment;
}

/** Whether a class has a curated starting set at all. */
export function hasStartingEquipment(characterClass: ClassId): boolean {
  return STARTING_SETS[characterClass] !== undefined;
}
