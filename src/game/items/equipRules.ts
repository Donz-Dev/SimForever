import type { ClassId } from '../character/ids';
import { hasProficiency, proficiencyForItem } from '../character/proficiency';
import type { Item, EquipmentSlot } from './Item';

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
