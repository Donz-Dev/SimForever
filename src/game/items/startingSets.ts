import type { ClassId, CombatStyleId } from '../character';
import type { Equipment, EquipmentSlot } from './Item';
import { ITEMS_BY_ID } from './itemData';

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

/** Crusader, the only weapon enchant in the item data. */
const CRUSADER = 20034;

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

const STARTING_SETS: Partial<Record<ClassId, (style: CombatStyleId) => Equipment>> = {
  warrior: (style) => ({
    ...(Object.fromEntries(
      Object.entries(WARRIOR_ARMOUR).map(([slot, itemId]) => [slot, { itemId }]),
    ) as Equipment),
    ...(WARRIOR_WEAPONS[style] ?? {}),
  }),
};

/**
 * The gear a newly created character starts in, or an empty set for a class
 * with no curated one.
 *
 * Only the Warrior has items at all. Every other class gets nothing, which is
 * the honest answer rather than dressing a Mage in plate.
 */
export function startingEquipmentFor(
  characterClass: ClassId,
  style: CombatStyleId,
): Equipment {
  const build = STARTING_SETS[characterClass];
  if (!build) return {};

  const equipment: Record<string, { itemId: number; enchantId?: number }> = {};
  for (const [slot, equipped] of Object.entries(build(style))) {
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
