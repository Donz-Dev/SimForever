import type {
  AbilityModifier,
  AttackTableKind,
  DamageSchool,
  PartialStats,
  WeaponSlot,
} from '../../engine';
import type { ClassId, CombatStyleId } from '../character/ids';

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
  | 'shield'
  | 'ranged'
  /**
   * An idol, libram or totem.
   *
   * Every class that has one -- Druid, Paladin, Shaman -- wears one in the sets
   * the owner supplied, and almost everything a relic does is named for a
   * single ability, so most of one is unmodelled and listed. The slot exists so
   * that a piece of the set is visible rather than absent.
   */
  | 'relic';

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
  /**
   * The source's own word for what KIND of thing this is: `Plate`, `Dagger`,
   * `Shield`, `Idol`. Absent for jewellery and a held off-hand item, which is
   * what the capture says about them.
   *
   * --------------------------------------------------------------------------
   * CARRIED SO THE PROFICIENCY FILTER CAN READ IT. It was on `weapon.subclass`
   * and nowhere else, so an item's armour class -- the thing that decides
   * whether a Rogue may wear it -- was thrown away for every one of the 1,418
   * armour pieces on file the moment `buildItem` ran.
   * --------------------------------------------------------------------------
   */
  readonly subclass?: string;
  /**
   * The source's own word for WHERE it goes: `Two-Hand`, `One-Hand`,
   * `Main Hand`, `Head`, `Thrown`.
   *
   * `slots` is derived from this and is the thing the simulator uses; this is
   * kept because the derivation is LOSSY in the one place the proficiency
   * table needs it. A one-handed and a two-handed axe share the subclass "Axe"
   * and are two different columns of the owner's table, and `slots` cannot
   * tell a `Main Hand` dagger from a `One-Hand` one either.
   */
  readonly inventoryType: string;
  /**
   * The classes this item names, where it names any.
   *
   * --------------------------------------------------------------------------
   * "Classes: Rogue" on a tier piece, and **895 of the 1,943 items on file
   * carry one** -- nearly half the database. It was in the tooltip text and
   * nowhere else, so the proficiency filter offered a Warrior the Rogue and
   * Druid tier sets: both are armour classes a Warrior may wear, and the line
   * that says otherwise was never read.
   *
   * ABSENT MEANS ANY CLASS, which is most items and is the honest default --
   * the same reason `proficiencyForItem` returns `undefined` for a word it
   * does not know. A restriction that fails to parse must offer the item, not
   * hide it.
   * --------------------------------------------------------------------------
   */
  readonly classRestrictions?: readonly ClassId[];
  /** Slots this item may go in. A ring lists both ring slots. */
  readonly slots: readonly EquipmentSlot[];
  readonly stats: PartialStats;
  /**
   * Spell power that only ONE school's damage reads.
   *
   * "Increases damage done by Shadow spells and effects by up to 39" is most
   * of the Priest's set and eight pieces of Lawbringer say the same about
   * Holy. It is NOT in `stats`, because `STAT_NAMES` is a closed flat set with
   * no room for a keyed stat -- it becomes a `SchoolModifiers` entry, beside
   * the crit and damage multiplier already keyed by school, and
   * `spellPowerFor` adds it to the school-blind pool at the point of use.
   *
   * Empty for every item that grants none, which is most of them.
   */
  readonly schoolPower: Readonly<Partial<Record<DamageSchool, number>>>;
  /**
   * Stats that apply only in a given COMBAT STYLE.
   *
   * ----------------------------------------------------------------------------
   * "+172 Attack Power in Cat, Bear, and Dire Bear forms only." The Glaive of
   * Obsidian Fury is the one item line in the data that says this, both feral
   * Druid profiles hold it, and it was recorded in HANDOVER.md as a known
   * understatement of those two figures for as long as the item has existed --
   * "an item stat is not conditional on the combat style".
   *
   * IT WAS ALWAYS KNOWABLE. `statsForStyle` takes the style already -- that is
   * how it strips the slots a style cannot fill -- so the condition is decided
   * in the one function that has the answer, at the same moment it decides
   * whether the item's ordinary stats count at all.
   *
   * EMPTY FOR EVERY OTHER ITEM, and the parser is the guard: a form list it
   * cannot map ENTIRELY onto styles falls through to `unmodelled`, so a line
   * naming Travel Form is reported rather than half-credited.
   * ----------------------------------------------------------------------------
   */
  readonly styleStats: Readonly<Partial<Record<CombatStyleId, PartialStats>>>;
  readonly weapon?: ItemWeapon;
  readonly unmodelled: readonly UnmodelledEffect[];
  /**
   * Resistance by school, FOR DISPLAY ONLY.
   *
   * They are the WEARER's resistance, which only an incoming spell would read,
   * and nothing casts a spell at a profile -- so nothing reads these in a
   * fight. Resistance on the TARGET is modelled since round 46
   * (`Combatant.resistanceFor`); these are carried so the character sheet can
   * total them, on the ruleset owner's instruction, and they stay in
   * `unmodelled` as well so nobody mistakes a displayed number for a
   * simulated one.
   */
  readonly resistances: Readonly<Record<string, number>>;
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
  /**
   * Crit, crit damage, hit or damage scoped to ONE ATTACK TABLE.
   *
   * --------------------------------------------------------------------------
   * The ranged weapon's "+2% Crit Chance" is the only caller and it is the
   * reason this is not a stat: `critChance` is every attack the character
   * makes, and the ruleset owner's ruling is that this one reaches RANGED
   * ATTACKS ONLY -- not melee, and not the pet. `AttackTableKind` is the one
   * scope that draws that line, and it is carried by the PLAYER's combatant, so
   * a Hunter's pet never sees it.
   *
   * EMPTY FOR EVERY OTHER ENCHANT. A flat stat belongs in `stats`, where a
   * buff can move it; this is for the lines that name a kind of attack.
   * --------------------------------------------------------------------------
   */
  readonly attackTableModifiers?: Readonly<Partial<Record<AttackTableKind, AbilityModifier>>>;
  /** "+2% Threat" is 1.02, "-2% Threat" 0.98; it multiplies everything else. */
  readonly threatMultiplier?: number;
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
  'shield',
  'ranged',
];

/** Engine weapon slot for an equipment slot, where one exists. */
export function weaponSlotFor(slot: EquipmentSlot): WeaponSlot | undefined {
  switch (slot) {
    case 'mainHand':
    case 'twoHand':
      return 'mainHand';
    case 'offHand':
    // A shield occupies the off hand. It never swings, but it is the same slot,
    // so anything in it has to resolve there.
    case 'shield':
      return 'offHand';
    case 'ranged':
      return 'ranged';
    default:
      return undefined;
  }
}
