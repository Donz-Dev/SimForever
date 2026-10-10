/**
 * The Premier PvP cloth sets, transcribed from the ruleset owner's own client.
 *
 * ----------------------------------------------------------------------------
 * THE HIGHEST-AUTHORITY ITEM DATA IN THIS PROJECT, and the only real Forever
 * ARMOUR anywhere in it. `src/data/items/` is Classic and Season of Discovery
 * stand-ins by its own README; the Immovable Object and four spell-power
 * overrides were the whole of the Forever item data until this.
 *
 * IT IS NOT IN `src/data/items/` ON PURPOSE. That directory is loaded by
 * `itemData.ts` through explicit imports and everything in it is equippable;
 * adding 64 items there would put them in the Gear panel and in
 * `itemsForSlot`, which is a change to the simulator and not to what is known
 * about items. **The item database stays frozen.** This is reference data for
 * `tools/item_budget.ts`, which prices items and equips none.
 *
 * Every item: **item level 65, Cloth, Requires Level 60, Binds when picked
 * up.** Sixty-four items across three classes and eight slots, in six rank
 * tiers whose names (Centurion, Legionnaire, Knight-Captain, Knight-Champion,
 * Lieutenant Commander, Champion, General, Marshal, Field Marshal, Warlord)
 * are the Classic PvP rank titles.
 * ----------------------------------------------------------------------------
 */

/** The eight slots these sets cover, and their budget class. */
export type PvpSlot =
  | 'head'
  | 'chest'
  | 'legs'
  | 'shoulder'
  | 'hands'
  | 'waist'
  | 'feet'
  | 'wrist';

/**
 * Cloth armor at item level 65, by slot, read straight off these tooltips.
 *
 * **CONFIRMED AGAINST CLASSIC AT THE SAME ITEM LEVEL.** Classic's own
 * General's Silk Cuffs (item 16538) is item level 65 cloth wrist at **44
 * armor** and General's Silk Sash (16537) is item level 65 cloth waist at
 * **56 armor** -- identical to Forever's. So Forever did not re-derive the
 * base armor curve, and the "base armor is free" reading now rests on the
 * ruleset's own data rather than on Classic's.
 */
export const FOREVER_CLOTH_ARMOR_ILVL65: Readonly<Record<PvpSlot, number>> = {
  head: 81,
  chest: 100,
  legs: 88,
  shoulder: 75,
  hands: 63,
  waist: 56,
  feet: 69,
  wrist: 44,
};

/**
 * What an item grants, in the tooltip's own terms.
 *
 * `sp` is "Equip: +N Spell Power". `heal` and `spellDamage` are the HEALER
 * SPLIT -- "Equip: +22 Healing" and "Equip: +7 Spell Damage" as two lines,
 * where Classic writes one "+N damage and healing". `crit` is "+N Critical
 * Strike Rating", which is a RATING: Classic's PvP cloth grants a flat
 * "+1% spell crit" and Forever grants a rating, so this is a ruleset change
 * and not a transcription difference.
 *
 * `bonusArmor` is an "+N Armor" line listed among the STATS, separately from
 * the slot's own armor at the top of the tooltip -- which is the base/bonus
 * split the budget model predicts, written out by the client itself.
 */
export interface PvpStats {
  readonly stamina?: number;
  readonly intellect?: number;
  readonly spirit?: number;
  readonly sp?: number;
  readonly heal?: number;
  readonly spellDamage?: number;
  readonly crit?: number;
  readonly bonusArmor?: number;
}

export interface PvpItem {
  readonly id: number;
  readonly name: string;
  readonly characterClass: 'Warlock' | 'Mage' | 'Priest';
  readonly slot: PvpSlot;
  readonly stats: PvpStats;
  /** Equip lines the budget cannot price, in the tooltip's own words. */
  readonly unpriced?: readonly string[];
  /** Anything about this row that is not settled. */
  readonly note?: string;
}

export const FOREVER_PVP_ITEM_LEVEL = 65;

const INTERRUPT = (spell: string) =>
  `Gives you a 50% chance to avoid interruption caused by damage while casting ${spell}.`;
const MANA_SHIELD = 'Increases the damage absorbed by your Mana Shield by 285.';

export const FOREVER_PREMIER_PVP_CLOTH: readonly PvpItem[] = [
  // ---- Centurion: feet ----
  { id: 272554, name: "Premier Centurion's Felweave Boots", characterClass: 'Warlock', slot: 'feet', stats: { stamina: 26, intellect: 12, sp: 18 } },
  { id: 272504, name: "Premier Centurion's Magus Boots", characterClass: 'Mage', slot: 'feet', stats: { stamina: 26, intellect: 15, sp: 14 } },
  { id: 272570, name: "Premier Centurion's Satin Boots", characterClass: 'Priest', slot: 'feet', stats: { stamina: 26, intellect: 13, sp: 19 } },
  { id: 273429, name: "Premier Centurion's Silken Boots", characterClass: 'Priest', slot: 'feet', stats: { stamina: 26, intellect: 12, spirit: 11, heal: 22, spellDamage: 7 } },

  // ---- Champion: hands ----
  { id: 272556, name: "Premier Champion's Felweave Gloves", characterClass: 'Warlock', slot: 'hands', stats: { stamina: 26, intellect: 17, sp: 12 }, unpriced: [INTERRUPT('Searing Pain')] },
  { id: 272505, name: "Premier Champion's Magus Handguards", characterClass: 'Mage', slot: 'hands', stats: { stamina: 26, intellect: 15, sp: 14 }, unpriced: [MANA_SHIELD] },
  { id: 272572, name: "Premier Champion's Satin Gloves", characterClass: 'Priest', slot: 'hands', stats: { stamina: 26, intellect: 15, sp: 14 }, unpriced: [INTERRUPT('Mind Blast')] },
  { id: 273431, name: "Premier Champion's Silken Gloves", characterClass: 'Priest', slot: 'hands', stats: { stamina: 28, intellect: 12, heal: 26, spellDamage: 9 }, unpriced: [INTERRUPT('Flash Heal')] },

  // ---- Field Marshal: head and chest ----
  { id: 272802, name: "Premier Field Marshal's Dreadweave Coronal", characterClass: 'Warlock', slot: 'head', stats: { stamina: 34, intellect: 20, bonusArmor: 40, sp: 16 } },
  { id: 272805, name: "Premier Field Marshal's Dreadweave Robe", characterClass: 'Warlock', slot: 'chest', stats: { stamina: 34, intellect: 12, crit: 7, sp: 23 } },
  { id: 273421, name: "Premier Field Marshal's Mooncloth Headdress", characterClass: 'Priest', slot: 'head', stats: { stamina: 34, intellect: 14, spirit: 13, heal: 33, spellDamage: 11 } },
  { id: 273424, name: "Premier Field Marshal's Mooncloth Vestments", characterClass: 'Priest', slot: 'chest', stats: { stamina: 34, intellect: 14, spirit: 9, heal: 40, spellDamage: 13 } },
  { id: 272750, name: "Premier Field Marshal's Silk Coronet", characterClass: 'Mage', slot: 'head', stats: { stamina: 34, intellect: 15, sp: 14, crit: 14 } },
  { id: 272752, name: "Premier Field Marshal's Silk Vestments", characterClass: 'Mage', slot: 'chest', stats: { stamina: 34, intellect: 12, sp: 18, crit: 14 } },
  { id: 272818, name: "Premier Field Marshal's Voidcloth Headdress", characterClass: 'Priest', slot: 'head', stats: { stamina: 34, intellect: 17, crit: 7, sp: 19 } },
  { id: 272821, name: "Premier Field Marshal's Voidcloth Vestments", characterClass: 'Priest', slot: 'chest', stats: { stamina: 34, intellect: 16, bonusArmor: 40, sp: 21 } },

  // ---- General: shoulder and legs ----
  { id: 272558, name: "Premier General's Felweave Mantle", characterClass: 'Warlock', slot: 'shoulder', stats: { stamina: 26, intellect: 12, crit: 7, sp: 14 } },
  { id: 272561, name: "Premier General's Felweave Pants", characterClass: 'Warlock', slot: 'legs', stats: { stamina: 34, intellect: 20, sp: 18 } },
  { id: 272501, name: "Premier General's Magus Amice", characterClass: 'Mage', slot: 'shoulder', stats: { stamina: 26, intellect: 17, sp: 12 } },
  { id: 272499, name: "Premier General's Magus Trousers", characterClass: 'Mage', slot: 'legs', stats: { stamina: 34, intellect: 17, sp: 18, crit: 7 } },
  { id: 272577, name: "Premier General's Satin Leggings", characterClass: 'Priest', slot: 'legs', stats: { stamina: 34, intellect: 18, crit: 7, sp: 18 } },
  { id: 272574, name: "Premier General's Satin Mantle", characterClass: 'Priest', slot: 'shoulder', stats: { stamina: 26, intellect: 14, sp: 16 } },
  { id: 273436, name: "Premier General's Silken Leggings", characterClass: 'Priest', slot: 'legs', stats: { stamina: 34, intellect: 17, spirit: 8, heal: 33, spellDamage: 11 } },
  { id: 273433, name: "Premier General's Silken Mantle", characterClass: 'Priest', slot: 'shoulder', stats: { stamina: 26, intellect: 10, spirit: 10, heal: 26, spellDamage: 9 } },

  // ---- Knight-Captain: wrist and waist ----
  { id: 272806, name: "Premier Knight-Captain's Dreadweave Cuffs", characterClass: 'Warlock', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272809, name: "Premier Knight-Captain's Dreadweave Sash", characterClass: 'Warlock', slot: 'waist', stats: { intellect: 17, stamina: 26, sp: 12 } },
  { id: 273425, name: "Premier Knight-Captain's Mooncloth Bracers", characterClass: 'Priest', slot: 'wrist', stats: { intellect: 12, stamina: 20, heal: 18, spellDamage: 6 } },
  { id: 273428, name: "Premier Knight-Captain's Mooncloth Sash", characterClass: 'Priest', slot: 'waist', stats: { intellect: 12, stamina: 26, spirit: 11, heal: 22, spellDamage: 7 } },
  { id: 272747, name: "Premier Knight-Captain's Silk Bracers", characterClass: 'Mage', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272748, name: "Premier Knight-Captain's Silk Sash", characterClass: 'Mage', slot: 'waist', stats: { intellect: 15, stamina: 26, sp: 14 } },
  { id: 272822, name: "Premier Knight-Captain's Voidcloth Bracers", characterClass: 'Priest', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272825, name: "Premier Knight-Captain's Voidcloth Sash", characterClass: 'Priest', slot: 'waist', stats: { intellect: 17, stamina: 26, sp: 11 } },

  // ---- Knight-Champion: feet ----
  { id: 272807, name: "Premier Knight-Champion's Dreadweave Boots", characterClass: 'Warlock', slot: 'feet', stats: { intellect: 12, stamina: 26, sp: 18 } },
  { id: 273426, name: "Premier Knight-Champion's Mooncloth Sandals", characterClass: 'Priest', slot: 'feet', stats: { intellect: 12, stamina: 26, spirit: 11, heal: 22, spellDamage: 7 } },
  { id: 272746, name: "Premier Knight-Champion's Silk Footwraps", characterClass: 'Mage', slot: 'feet', stats: { intellect: 15, stamina: 26, sp: 14 } },
  { id: 272823, name: "Premier Knight-Champion's Voidcloth Sandals", characterClass: 'Priest', slot: 'feet', stats: { intellect: 13, stamina: 26, sp: 19 } },

  // ---- Legionnaire: wrist and waist ----
  { id: 272557, name: "Premier Legionnaire's Felweave Belt", characterClass: 'Warlock', slot: 'waist', stats: { intellect: 17, stamina: 26, sp: 12 } },
  { id: 272555, name: "Premier Legionnaire's Felweave Bracers", characterClass: 'Warlock', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272503, name: "Premier Legionnaire's Magus Cuffs", characterClass: 'Mage', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272502, name: "Premier Legionnaire's Magus Sash", characterClass: 'Mage', slot: 'waist', stats: { intellect: 15, stamina: 26, sp: 14 } },
  { id: 272571, name: "Premier Legionnaire's Satin Bracers", characterClass: 'Priest', slot: 'wrist', stats: { intellect: 10, stamina: 20, sp: 12 } },
  { id: 272573, name: "Premier Legionnaire's Satin Cinch", characterClass: 'Priest', slot: 'waist', stats: { intellect: 17, stamina: 26, sp: 11 } },
  { id: 273430, name: "Premier Legionnaire's Silken Bracers", characterClass: 'Priest', slot: 'wrist', stats: { intellect: 12, stamina: 20, heal: 18, spellDamage: 6 } },
  { id: 273432, name: "Premier Legionnaire's Silken Cinch", characterClass: 'Priest', slot: 'waist', stats: { intellect: 12, stamina: 26, spirit: 11, heal: 22, spellDamage: 7 } },

  // ---- Lieutenant Commander: hands ----
  { id: 272808, name: "Premier Lieutenant Commander's Dreadweave Gloves", characterClass: 'Warlock', slot: 'hands', stats: { stamina: 26, intellect: 17, sp: 12 }, unpriced: [INTERRUPT('Searing Pain')] },
  { id: 273427, name: "Premier Lieutenant Commander's Mooncloth Gloves", characterClass: 'Priest', slot: 'hands', stats: { stamina: 28, intellect: 12, heal: 26, spellDamage: 9 }, unpriced: [INTERRUPT('Flash Heal')] },
  { id: 272749, name: "Premier Lieutenant Commander's Silk Gloves", characterClass: 'Mage', slot: 'hands', stats: { stamina: 26, intellect: 15, sp: 14 }, unpriced: [MANA_SHIELD] },
  { id: 272824, name: "Premier Lieutenant Commander's Voidcloth Gloves", characterClass: 'Priest', slot: 'hands', stats: { stamina: 26, intellect: 15, sp: 14 }, unpriced: [INTERRUPT('Mind Blast')] },

  // ---- Marshal: legs and shoulder ----
  { id: 272803, name: "Premier Marshal's Dreadweave Leggings", characterClass: 'Warlock', slot: 'legs', stats: { stamina: 34, intellect: 20, sp: 18 } },
  { id: 272804, name: "Premier Marshal's Dreadweave Shoulders", characterClass: 'Warlock', slot: 'shoulder', stats: { stamina: 26, intellect: 12, crit: 7, sp: 14 } },
  { id: 273423, name: "Premier Marshal's Mooncloth Mantle", characterClass: 'Priest', slot: 'shoulder', stats: { stamina: 26, intellect: 10, spirit: 10, heal: 26, spellDamage: 9 } },
  { id: 273422, name: "Premier Marshal's Mooncloth Pants", characterClass: 'Priest', slot: 'legs', stats: { stamina: 34, intellect: 17, spirit: 8, heal: 33, spellDamage: 11 } },
  { id: 272751, name: "Premier Marshal's Silk Leggings", characterClass: 'Mage', slot: 'legs', stats: { stamina: 34, intellect: 17, sp: 18, crit: 7 } },
  { id: 272753, name: "Premier Marshal's Silk Spaulders", characterClass: 'Mage', slot: 'shoulder', stats: { stamina: 26, intellect: 17, sp: 12 } },
  { id: 272820, name: "Premier Marshal's Voidcloth Mantle", characterClass: 'Priest', slot: 'shoulder', stats: { stamina: 26, intellect: 14, sp: 16 } },
  { id: 272819, name: "Premier Marshal's Voidcloth Pants", characterClass: 'Priest', slot: 'legs', stats: { stamina: 34, intellect: 18, crit: 7, sp: 18 } },

  // ---- Warlord: head and chest ----
  { id: 272559, name: "Premier Warlord's Felweave Hood", characterClass: 'Warlock', slot: 'head', stats: { stamina: 34, intellect: 20, bonusArmor: 40, sp: 16 } },
  { id: 272560, name: "Premier Warlord's Felweave Robe", characterClass: 'Warlock', slot: 'chest', stats: { stamina: 34, intellect: 12, crit: 7, sp: 23 } },
  {
    id: 272498,
    name: "Premier Warlord's Magus Cowl",
    characterClass: 'Mage',
    slot: 'head',
    stats: { stamina: 37, intellect: 15, sp: 14, crit: 14 },
    note:
      'THE ONE VALUE IN 64 THAT BREAKS THE PAIRING. Every other stat block here ' +
      'appears exactly twice, once in each of the two rank tiers, and this is ' +
      "Field Marshal's Silk Coronet with 37 stamina instead of 34. Every other " +
      'head piece in these sets is 34. Transcribed as read; worth the owner ' +
      'confirming against the client, because a 7 read off a 4 is the likelier ' +
      'of the two explanations.',
  },
  { id: 272500, name: "Premier Warlord's Magus Raiment", characterClass: 'Mage', slot: 'chest', stats: { stamina: 34, intellect: 12, sp: 18, crit: 14 } },
  { id: 272575, name: "Premier Warlord's Satin Cowl", characterClass: 'Priest', slot: 'head', stats: { stamina: 34, intellect: 17, crit: 7, sp: 19 } },
  { id: 272576, name: "Premier Warlord's Satin Robes", characterClass: 'Priest', slot: 'chest', stats: { stamina: 34, intellect: 16, bonusArmor: 40, sp: 21 } },
  { id: 273434, name: "Premier Warlord's Silken Cowl", characterClass: 'Priest', slot: 'head', stats: { stamina: 34, intellect: 14, spirit: 13, heal: 33, spellDamage: 11 } },
  { id: 273435, name: "Premier Warlord's Silken Robes", characterClass: 'Priest', slot: 'chest', stats: { stamina: 34, intellect: 14, spirit: 9, heal: 40, spellDamage: 13 } },
];
