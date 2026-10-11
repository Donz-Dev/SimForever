import type { CombatStyleId } from '../../../game/character';
import type { ClassId } from '../../../game/character';
import type { EquipmentSlot, Item } from '../../../game/items/Item';
import { canEquip } from '../../../game/items/equipRules';
import { itemsForSlot } from '../../../game/items/itemData';
import { scoreItem, type StatValuation } from '../../../game/items/itemValue';

/** A gear slot, as the panel lists it. */
export interface SlotRow {
  readonly id: EquipmentSlot;
  readonly name: string;
}

/**
 * THE TWO ARMOUR COLUMNS, laid out as a character pane and not as a list.
 *
 * ==============================================================================
 * NO MODEL BETWEEN THEM AND NO SHIRT OR TABARD, both on the owner's
 * instruction. A shirt and a tabard are cosmetic, carry no stat this project
 * reads, and would be two permanently empty rows in the middle of the pane --
 * which is what the dead space in the centre of the reference planner is for.
 *
 * THE COLUMNS ARE IDENTICAL RATHER THAN MIRRORED. A real character pane
 * mirrors its right column so the icons frame the model; with the model gone
 * there is nothing to frame, and mirroring would only put two icon columns on
 * the outside edges with the text crammed together in the middle.
 *
 * SEVEN AND EIGHT, with the relic making up the left column's count. The relic
 * is offered to every class, as it already was: `itemsForSlot('relic')` is
 * empty for a class with no idol, libram or totem, so the row simply has
 * nothing in it -- and a Druid, Paladin or Shaman set that wears one can be
 * SEEN, which is the whole point of keeping the row.
 * ==============================================================================
 */
export const LEFT_SLOTS: readonly SlotRow[] = [
  { id: 'head', name: 'Head' },
  { id: 'neck', name: 'Neck' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'cloak', name: 'Back' },
  { id: 'chest', name: 'Chest' },
  { id: 'wrists', name: 'Wrist' },
  { id: 'relic', name: 'Relic' },
];

export const RIGHT_SLOTS: readonly SlotRow[] = [
  { id: 'gloves', name: 'Hands' },
  { id: 'waist', name: 'Waist' },
  { id: 'legs', name: 'Legs' },
  { id: 'feet', name: 'Feet' },
  { id: 'ring1', name: 'Ring 1' },
  { id: 'ring2', name: 'Ring 2' },
  { id: 'trinket1', name: 'Trinket 1' },
  { id: 'trinket2', name: 'Trinket 2' },
];

/**
 * The weapon slots a style can actually fill.
 *
 * ----------------------------------------------------------------------------
 * UNCHANGED FROM THE LIST PANEL THIS REPLACES, deliberately: every branch
 * below was arrived at by something going wrong, and a layout change is no
 * reason to re-derive them. A dual-wielder has no use for a two-hander and a
 * two-hander has no off hand, so showing those invites equipping something
 * that will be ignored; the 1H & Shield style holds a SHIELD, which is a
 * different slot with a different list; and the ranged slot is offered to
 * every melee style because a bow does not swing while meleeing and its stats
 * still count.
 *
 * A RANGED STYLE IS OFFERED THE MELEE HANDS AND A FORM OR CASTER STYLE IS
 * OFFERED EVERYTHING, because in both cases the hands are STAT STICKS -- the
 * Hunter sets hold a two-hander for 12 agility off a weapon that never swings,
 * and the Elemental shaman wears a caster shield. Leaving a row out never
 * stopped a preset equipping one; it only stopped the person SEEING it.
 * ----------------------------------------------------------------------------
 */
export function weaponSlotsFor(style: CombatStyleId): readonly SlotRow[] {
  const ranged: SlotRow = { id: 'ranged', name: 'Ranged' };

  switch (style) {
    case 'two_hander':
      return [{ id: 'twoHand', name: 'Two-Hand' }, ranged];
    case 'one_hand_shield':
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'shield', name: 'Off Hand' },
        ranged,
      ];
    case 'dual_wield':
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'offHand', name: 'Off Hand' },
        ranged,
      ];
    case 'ranged':
      return [
        ranged,
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'twoHand', name: 'Two-Hand' },
      ];
    default:
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'offHand', name: 'Off Hand' },
        { id: 'twoHand', name: 'Two-Hand' },
        { id: 'shield', name: 'Shield' },
        ranged,
      ];
  }
}

/** An item in a picker list, with what it is worth to this build. */
export interface ScoredItem {
  readonly item: Item;
  readonly score: number;
  /** True when the class may not equip it. Only present when showing everything. */
  readonly illegal?: boolean;
}

export interface PickerOptions {
  readonly slot: EquipmentSlot;
  readonly characterClass: ClassId;
  readonly style: CombatStyleId;
  readonly valuation: StatValuation;
  /** Free text, matched against the item name. Empty matches everything. */
  readonly search: string;
  /**
   * Show items this class cannot equip, greyed, instead of hiding them.
   *
   * THE ESCAPE HATCH, and it is not decoration. The proficiency table is one
   * transcription of one spreadsheet, and a filter is the one kind of bug that
   * leaves nothing behind to notice -- a missing item looks exactly like an
   * item that was never in the database. The toggle is how a wrong row is
   * VISIBLE rather than silent.
   */
  readonly showUnusable: boolean;
  /**
   * An item id that must appear whatever the filters say.
   *
   * WHAT IS ALREADY ON THE CHARACTER IS ALWAYS LISTED. A profile loaded from a
   * file, or saved before the filter existed, can be wearing something this
   * table calls illegal -- and a picker that hid it would show the slot's
   * current contents nowhere at all, which is worse than showing it greyed.
   */
  readonly equippedId?: number;
}

/**
 * The items a slot offers, in the order the panel lists them.
 *
 * ==============================================================================
 * SORTED BY WHAT THEY ARE WORTH, DESCENDING, which is the whole point -- and
 * **by ITEM LEVEL when the valuation is empty**, because a build with no
 * benchmark template has no stat preference to derive one from and a column of
 * identical zeroes sorted alphabetically is worse than no sorting at all. The
 * panel says which of the two it is doing; see `GearPanel`.
 *
 * TIES BREAK ON ITEM LEVEL AND THEN ON NAME, so the order is STABLE. Without
 * the name the two halves of a twinned PvP set -- 62 of the 64 Premier pieces
 * have an identical twin under the other rank's name -- would swap places
 * between renders for no reason anybody could see.
 *
 * AN ILLEGAL ITEM SORTS LAST whatever it scores. It is shown so that a wrong
 * proficiency row is visible, not so that it competes for the top of the list.
 * ==============================================================================
 */
export function pickerItems(options: PickerOptions): readonly ScoredItem[] {
  const { slot, characterClass, style, valuation, search, showUnusable, equippedId } = options;
  const needle = search.trim().toLowerCase();
  const scoring = Object.keys(valuation).length > 0;

  const rows: ScoredItem[] = [];
  for (const item of itemsForSlot(slot)) {
    const legal = canEquip(characterClass, item, slot);
    const kept = legal || showUnusable || item.id === equippedId;
    if (!kept) continue;
    if (needle.length > 0 && !item.name.toLowerCase().includes(needle)) continue;
    rows.push({ item, score: scoreItem(item, style, valuation), ...(legal ? {} : { illegal: true }) });
  }

  return rows.sort((a, b) => {
    if (a.illegal !== b.illegal) return a.illegal ? 1 : -1;
    if (scoring && a.score !== b.score) return b.score - a.score;
    if (a.item.itemLevel !== b.item.itemLevel) return b.item.itemLevel - a.item.itemLevel;
    return a.item.name.localeCompare(b.item.name);
  });
}
