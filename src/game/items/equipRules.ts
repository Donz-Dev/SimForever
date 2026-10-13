import type { ClassId } from '../character/ids';
import { hasProficiency, proficiencyForItem } from '../character/proficiency';
import type { Item, EquipmentSlot, Equipment } from './Item';

/**
 * The weapon slots a newly equipped one DISPLACES.
 *
 * ==============================================================================
 * THE OWNER'S RULING, IN THEIR OWN WORDS: "You cannot ever have the stats of
 * both active. It's one or the other ... Equipping a 2H weapon REMOVES the
 * 1H+shield from the character planner equipped items."
 *
 * TWO LAYERS SAY THE SAME THING AND ONLY ONE OF THEM SAID IT. `liveEquipment`
 * already strips whichever hands a combat style cannot fill, so the STATS were
 * never doubled -- and the equipment MAP could still carry a two-hander and a
 * one-hander at once, which is what a person reads off the planner. "Resolved
 * correctly at the point of use" and "cannot be expressed" are not the same
 * guarantee, and the owner asked for the second.
 *
 * SO THE EXCLUSIVITY IS STRUCTURAL NOW, the way a consumable selection keyed by
 * category is: the state that would be wrong is not representable, rather than
 * being representable and then ignored. That is the argument `consumables.ts`
 * already makes about `RaidBuff.exclusiveWith` -- a shape that cannot express
 * the mistake needs no chooser to be honest.
 *
 * IT IS NOT A STYLE RULE AND MUST NOT READ ONE. A character in a shield style
 * holding a two-hander as a stat stick is `liveEquipment`'s business; this is
 * about what the two HANDS can physically hold, which is the same answer for
 * every class and every style.
 * ==============================================================================
 */
const DISPLACED_BY: Readonly<Partial<Record<EquipmentSlot, readonly EquipmentSlot[]>>> = {
  twoHand: ['mainHand', 'offHand', 'shield'],
  mainHand: ['twoHand'],
  offHand: ['twoHand'],
  shield: ['twoHand'],
};

/**
 * Equip into one slot, removing whatever that makes impossible.
 *
 * Passing `undefined` empties the slot and displaces nothing -- taking a
 * two-hander off does not put a shield back on.
 */
export function equipExclusive(
  equipment: Equipment,
  slot: EquipmentSlot,
  next: Equipment[EquipmentSlot],
): Equipment {
  const result: Record<string, unknown> = { ...equipment };
  if (!next) {
    delete result[slot];
    return result as Equipment;
  }
  result[slot] = next;
  for (const displaced of DISPLACED_BY[slot] ?? []) delete result[displaced];
  return result as Equipment;
}

/**
 * The eight slots an ARMOUR CLASS applies to.
 *
 * The cloak is deliberately not one of them -- every cloak in the data carries
 * the subclass "Cloth" and every class wears one. See `proficiencyForItem`.
 */
export const ARMOUR_CLASS_SLOTS: ReadonlySet<EquipmentSlot> = new Set<EquipmentSlot>([
  'head',
  'shoulders',
  'chest',
  'wrists',
  'gloves',
  'waist',
  'legs',
  'feet',
]);

/**
 * Whether a class may equip this item in this slot.
 *
 * ==============================================================================
 * TWO RULES, AND THE SECOND ONE IS THE EASY ONE TO FORGET.
 *
 * The first is the owner's proficiency table: the item's own kind against the
 * class's row. The second is DUAL WIELD, which is not a property of an item at
 * all -- a one-handed sword is legal for a Paladin in the main hand and
 * illegal in the off hand, because a Paladin may not hold two weapons. Without
 * it the panel would offer a Paladin an off-hand axe, which `weaponsForEquipment`
 * would then happily resolve into a second swinging weapon.
 *
 * A SHIELD AND A HELD OFF-HAND ITEM ARE NOT DUAL WIELDING. Both sit in the
 * off-hand slot and neither is a second weapon: the shield is gated on its own
 * `shield` proficiency and a held item ("Held In Off-hand") is gated on
 * nothing, which is the capture's own distinction and not an invented one.
 * ==============================================================================
 */
export function canEquip(characterClass: ClassId, item: Item, slot: EquipmentSlot): boolean {
  /*
   * THE ITEM'S OWN `Classes:` LINE, AND IT IS CHECKED FIRST.
   *
   * --------------------------------------------------------------------------
   * The proficiency table answers "may this class wear leather"; it cannot
   * answer "may a Warrior wear the ROGUE tier set", which is leather and says
   * so on its own tooltip. **895 of the 1,943 items on file name a class** --
   * nearly half the database -- and offering a Warrior the Rogue and Druid
   * tier was what the owner saw.
   *
   * ABSENT MEANS ANY CLASS. `classRestrictionsFrom` returns `undefined` for a
   * line it cannot parse as well as for an item that has none, so an
   * unrecognised wording OFFERS the item rather than hiding it. That is the
   * same direction `proficiencyForItem` fails in, for the same reason.
   * --------------------------------------------------------------------------
   */
  if (item.classRestrictions && !item.classRestrictions.includes(characterClass)) return false;

  const proficiency = proficiencyForItem(
    item.inventoryType,
    item.subclass,
    ARMOUR_CLASS_SLOTS.has(slot),
  );
  if (proficiency !== undefined && !hasProficiency(characterClass, proficiency)) return false;

  if (slot === 'offHand' && isOffHandWeapon(item)) {
    return hasProficiency(characterClass, 'dual_wield');
  }

  return true;
}

/**
 * An off-hand item that is a WEAPON, as opposed to a shield or a held trinket.
 *
 * Asked of `item.weapon`, which `buildItem` sets only when the capture gave
 * the item damage and a speed -- so this is "does it swing" read off the one
 * field that answers it, rather than a list of subclasses that would go stale
 * the first time a capture adds one.
 */
function isOffHandWeapon(item: Item): boolean {
  return item.weapon !== undefined && item.subclass !== 'Shield';
}
