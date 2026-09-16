import type { PartialStats, WeaponSlot } from '../../engine';

/**
 * Where an item goes.
 *
 * `twoHand` is a slot in this model even though a two-hander occupies the main
 * hand, because the combat style decides which of the two a character can use
 * and the choice has to be storable independently. `weaponsForEquipment`
 * resolves it into the main hand when the style calls for it.
 */
export type EquipmentSlot =
  | 'head'
  | 'neck'
  | 'shoulders'
  | 'cloak'
  | 'chest'
  | 'wrists'
  | 'gloves'
  | 'waist'
  | 'legs'
  | 'feet'
  | 'ring1'
  | 'ring2'
  | 'trinket1'
  | 'trinket2'
  | 'mainHand'
  | 'offHand'
  | 'twoHand'
  | 'ranged';

/** A weapon's own numbers, straight off the item. */
export interface ItemWeapon {
  readonly minDamage: number;
  readonly maxDamage: number;
  /** Seconds between swings, unhasted. */
  readonly speed: number;
  /** The item's own stated damage per second, kept to check the rest against. */
  readonly dps: number;
  /** `Sword`, `Bow`, and so on. */
  readonly subclass: string;
  /**
   * Bonus weapon skill this item grants, if any.
   *
   * The Obsidian Edged Blade's "Increased Two-handed Swords +3" is the only one
   * here. Weapon skill shifts miss, dodge and glancing, so it is not cosmetic.
   */
  readonly bonusSkill: number;
}

/**
 * Something an item does that the engine cannot yet express.
 *
 * Kept as the source's own words rather than as an invented number. An item
 * carrying one of these is NOT fully implemented, and `unmodelledEffects`
 * across the equipped set is what the UI reports.
 */
export interface UnmodelledEffect {
  /** `Equip`, `Chance on hit`, `Use`. */
  readonly kind: string;
  readonly text: string;
  /** Why it is not modelled, in one line. */
  readonly reason: string;
}

/**
 * An item, resolved into what the simulator can use.
 *
 * `stats` holds only what maps onto an engine stat. Everything else that the
 * item does is in `unmodelled`, verbatim, so nothing is quietly dropped and
 * nothing is quietly invented.
 */
export interface Item {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly source: string;
  readonly itemLevel: number;
  readonly quality: number;
  /** Slots this item may go in. A ring lists both ring slots. */
  readonly slots: readonly EquipmentSlot[];
  readonly stats: PartialStats;
  readonly weapon?: ItemWeapon;
  readonly unmodelled: readonly UnmodelledEffect[];
  /** The full tooltip text, so the source is never more than a glance away. */
  readonly tooltip: string;
}

/** An enchant that can go on a slot. */
export interface Enchant {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly source: string;
  readonly slots: readonly EquipmentSlot[];
  readonly stats: PartialStats;
  readonly unmodelled: readonly UnmodelledEffect[];
  readonly tooltip: string;
}

/** What is equipped, by slot. Item ids, so it is JSON-safe. */
export type Equipment = Readonly<Partial<Record<EquipmentSlot, EquippedSlot>>>;

export interface EquippedSlot {
  readonly itemId: number;
  readonly enchantId?: number;
}

/** The weapon slots an item can occupy, for turning equipment into weapons. */
export const WEAPON_SLOTS: readonly EquipmentSlot[] = [
  'mainHand',
  'offHand',
  'twoHand',
  'ranged',
];

/** Engine weapon slot for an equipment slot, where one exists. */
export function weaponSlotFor(slot: EquipmentSlot): WeaponSlot | undefined {
  switch (slot) {
    case 'mainHand':
    case 'twoHand':
      return 'mainHand';
    case 'offHand':
      return 'offHand';
    case 'ranged':
      return 'ranged';
    default:
      return undefined;
  }
}
