import type { EquipmentSlot } from './Item';

/**
 * Synthetic benchmark gear, generated from the itemization budget.
 *
 * ==============================================================================
 * THIS RUNS THE BUDGET MODEL BACKWARDS, WHICH `docs/itemization.md` FORBIDS IN
 * BOLD -- AND THE RULESET OWNER HAS ASKED FOR IT. The prohibition is about
 * INVENTED DATA WEARING A SOURCE'S CLOTHES: a generated item presented as what
 * Forever has would be a confident number nobody can audit. These are the
 * opposite of that and are built so they cannot be mistaken for it.
 *
 *   - Every one is named "<Set> <Slot>", e.g. "E65 Chest". No Forever item is.
 *   - Their ids start at 9,500,000, two orders of magnitude clear of the
 *     highest real id on file (285,281).
 *   - They are NOT in `src/data/items/`, which is captured data only, and they
 *     are deliberately excluded from `itemsForSlot`, so no dropdown offers one.
 *   - Their `source` says what they are rather than where they came from.
 *
 * WHAT THEY ARE FOR. Comparing builds at a fixed item level, which the real
 * sets cannot do: the 25 presets wear a mixture of Classic and Season of
 * Discovery stand-ins at whatever item level the owner's spreadsheets supplied,
 * so "is the Fire Mage ahead of the Arcane Mage" is partly a question about who
 * has better gear. A benchmark set removes that.
 *
 * THEY MOVE NO PUBLISHED FIGURE, because no preset equips one: a profile names
 * its items by id and these are only ever reached by pressing a button.
 * ==============================================================================
 */

/* -------------------------------------------------------------------------- */
/* The four sets                                                              */
/* -------------------------------------------------------------------------- */

export type BenchmarkSetId = 'B55' | 'E65' | 'E75' | 'E85';

export interface BenchmarkSet {
  readonly id: BenchmarkSetId;
  readonly itemLevel: number;
  /** 3 is rare (blue), 4 is epic (purple). */
  readonly quality: 3 | 4;
  readonly description: string;
}

export const BENCHMARK_SETS: readonly BenchmarkSet[] = [
  { id: 'B55', itemLevel: 55, quality: 3, description: 'Rare, item level 55' },
  { id: 'E65', itemLevel: 65, quality: 4, description: 'Epic, item level 65' },
  { id: 'E75', itemLevel: 75, quality: 4, description: 'Epic, item level 75' },
  { id: 'E85', itemLevel: 85, quality: 4, description: 'Epic, item level 85' },
];

/* -------------------------------------------------------------------------- */
/* The budget, which is the sourced part                                      */
/* -------------------------------------------------------------------------- */

export const BUDGET_EXPONENT = 1.5;

/** The quality table, transcribed. Green is here for completeness only. */
export function qualityBase(itemLevel: number, quality: number): number {
  switch (quality) {
    case 2:
      return 0.5 * itemLevel - 2;
    case 3:
      return 0.625 * itemLevel - 1.15;
    default:
      return 0.77 * itemLevel - 1;
  }
}

type SlotClass = 'full' | 'medium' | 'light' | 'trinket' | 'oneHand' | 'ranged';

export const SLOT_MULTIPLIER: Readonly<Record<SlotClass, number>> = {
  full: 1.0,
  medium: 0.77,
  light: 0.55,
  trinket: 0.7,
  oneHand: 0.42,
  ranged: 0.3,
};

/**
 * A stat the spreadsheet can ask for, and what it costs.
 *
 * ----------------------------------------------------------------------------
 * EVERY COST HERE IS SOURCED, which is what makes generating from them
 * defensible at all. The budget source prices the primaries at 1, attack power
 * at 0.5, school-blind spell power at 0.86, armour at 0.1 and ANY RATING at 1
 * -- and Forever grants crit, hit, dodge, parry, block, defense and expertise
 * as ratings, so most of this table is the one line that used to be dead
 * weight.
 *
 * STAMINA IS 1.0 ON THE OWNER'S RULING, not the table's 0.67: the source
 * footnotes that row as having changed with Burning Crusade and been 1
 * originally, and everything here is pre-Burning Crusade. The rares confirmed
 * it independently at a best fit of 0.99.
 * ----------------------------------------------------------------------------
 */
export type BenchStat =
  | 'Crit'
  | 'Hit'
  | 'Expertise'
  | 'Strength'
  | 'Agility'
  | 'Stamina'
  | 'Intellect'
  | 'Spirit'
  | 'Attack Power'
  | 'Spell Power'
  | 'Defense'
  | 'Parry'
  | 'Block'
  | 'Dodge'
  | 'Bonus Armor';

export const COST: Readonly<Record<BenchStat, number>> = {
  Crit: 1,
  Hit: 1,
  Expertise: 1,
  Strength: 1,
  Agility: 1,
  Stamina: 1,
  Intellect: 1,
  Spirit: 1,
  'Attack Power': 0.5,
  'Spell Power': 0.86,
  Defense: 1,
  Parry: 1,
  Block: 1,
  Dodge: 1,
  'Bonus Armor': 0.1,
};

/**
 * The tooltip line each stat is written as.
 *
 * GENERATED AS TEXT AND PARSED BACK, deliberately. `itemData`'s rules turn
 * "+14 Critical Strike Rating" into `critRating` and apply the owner's
 * conversions, so a benchmark item reaches the engine down the SAME path a
 * captured one does. Building `PartialStats` directly would be a second
 * implementation of the item parser, and the one that drifts is the one
 * nobody measures.
 */
export const LINE: Readonly<Record<BenchStat, (value: number) => string>> = {
  Crit: (v) => `Equip: +${v} Critical Strike Rating`,
  Hit: (v) => `Equip: +${v} Hit Rating`,
  Expertise: (v) => `Equip: +${v} Expertise Rating`,
  Strength: (v) => `+${v} Strength`,
  Agility: (v) => `+${v} Agility`,
  Stamina: (v) => `+${v} Stamina`,
  Intellect: (v) => `+${v} Intellect`,
  Spirit: (v) => `+${v} Spirit`,
  'Attack Power': (v) => `Equip: +${v} Attack Power`,
  'Spell Power': (v) => `Equip: +${v} Spell Power`,
  Defense: (v) => `Equip: +${v} Defense Rating`,
  Parry: (v) => `Equip: +${v} Parry Rating`,
  Block: (v) => `Equip: +${v} Block Rating`,
  Dodge: (v) => `Equip: +${v} Dodge Rating`,
  'Bonus Armor': (v) => `+${v} Armor`,
};

/** Stats that count as a base attribute, for the jewellery rule below. */
const PRIMARY: ReadonlySet<BenchStat> = new Set<BenchStat>([
  'Strength',
  'Agility',
  'Stamina',
  'Intellect',
  'Spirit',
]);

/* -------------------------------------------------------------------------- */
/* Base armour and weapon damage, which are DERIVED and not sourced           */
/* -------------------------------------------------------------------------- */

/**
 * Base armour per item level, fitted per slot and armour class.
 *
 * ----------------------------------------------------------------------------
 * DERIVED FROM THE 1,821 ITEMS ON FILE, as a LOWER ENVELOPE: at a given slot,
 * class and item level the minimum armour on file is the base, because bonus
 * armour only ever adds. The fit is iterated -- fit, drop anything more than 8%
 * above the line, refit -- so a level whose only representative carries bonus
 * armour does not drag it up.
 *
 * It does not affect the BUDGET, because base armour is free; it affects
 * mitigation, which is why a tank set needs it right. Worst residual is under
 * 3% of the value on every row.
 * ----------------------------------------------------------------------------
 */
type ArmourClass = 'Cloth' | 'Leather' | 'Mail' | 'Plate';

export const BASE_ARMOUR: Readonly<Record<string, readonly [number, number]>> = {
  'Head|Cloth': [1.358, -10.04],
  'Head|Leather': [2.338, 3.52],
  'Head|Mail': [5.486, -27.62],
  'Head|Plate': [9.437, -24.81],
  'Shoulder|Cloth': [1.197, -4.56],
  'Shoulder|Leather': [2.181, 1.54],
  'Shoulder|Mail': [5.09, -26.17],
  'Shoulder|Plate': [9.148, -56.05],
  'Chest|Cloth': [1.602, -7.33],
  'Chest|Leather': [2.815, 6.47],
  'Chest|Mail': [6.837, -41.54],
  'Chest|Plate': [11.843, -51.46],
  'Wrist|Cloth': [0.703, -2.95],
  'Wrist|Leather': [1.279, -0.22],
  'Wrist|Mail': [2.905, -10.73],
  'Wrist|Plate': [5.348, -34.19],
  'Hands|Cloth': [1.037, -6.74],
  'Hands|Leather': [1.85, -1.54],
  'Hands|Mail': [4.422, -35.95],
  'Hands|Plate': [7.794, -58.95],
  'Waist|Cloth': [1.066, -13.91],
  'Waist|Leather': [1.644, 0.15],
  'Waist|Mail': [3.874, -25.47],
  'Waist|Plate': [7.025, -55.28],
  'Legs|Cloth': [1.384, -4.47],
  'Legs|Leather': [2.544, 1.19],
  'Legs|Mail': [5.866, -25.75],
  'Legs|Plate': [10.173, -25.97],
  'Feet|Cloth': [1.155, -8.61],
  'Feet|Leather': [2.039, -1.29],
  'Feet|Mail': [4.834, -37.35],
  'Feet|Plate': [8.775, -79.46],
  // A cloak is cloth whatever the wearer is.
  'Back|Cloth': [0.993, -15.15],
};

export function baseArmour(slotName: string, armour: ArmourClass, itemLevel: number): number {
  const line = BASE_ARMOUR[`${slotName}|${slotName === 'Back' ? 'Cloth' : armour}`];
  return line ? Math.round(line[0] * itemLevel + line[1]) : 0;
}

/**
 * A shield's INHERENT block value, which comes free with the item level.
 *
 * ----------------------------------------------------------------------------
 * THE SAME SHAPE AS BASE ARMOUR, AND FOR THE SAME REASON. The eighteen shields
 * in the Forever data carry a "44 Block" STAT line -- inherent, like the armour
 * on the line above it -- and The Immovable Object carries a second, BUDGETED
 * "Equip: +27 Block Value" on top. One is free with the slot and the other is
 * bought, which is exactly the base-armour/bonus-armour split.
 *
 * FITTED FROM FOREVER'S OWN SHIELDS and the fit is barely a fit: every one of
 * the nine distinct item levels on file is reproduced EXACTLY once rounded,
 * with a worst residual of 0.44 of a point.
 *
 *   blue   ilvl 52 -> 31, 54 -> 33, 55 -> 34, 56 -> 35, 58 -> 36
 *   epic   ilvl 65 -> 44 (six shields), 70 -> 48, 78 -> 55, 79 -> 55, 81 -> 57
 *
 * THE TWO SLOPES ARE THE SAME TO THREE DECIMALS, 0.818 and 0.813, and quality
 * moves the intercept by about 2.4 points. Two of the four benchmark sets land
 * on an item level that is DIRECTLY OBSERVED -- B55 blue gives 34, which is
 * Sunderbark Vigil, and E65 gives 44, which is what all six epic shields at
 * that level carry -- so only E75 and E85 are interpolated at all.
 *
 * WHAT IT COST TO BE MISSING: the budget bought a tank's shield SIX points of
 * block value where a real one carries 44, because block value at a cost of
 * 0.65 is expensive and a shield is a light slot. Shield Slam adds the
 * wielder's block value to its own damage, so the Protection builds were
 * losing it twice -- once in mitigation and once in damage.
 * ----------------------------------------------------------------------------
 */
export const SHIELD_BLOCK: Readonly<Record<3 | 4, readonly [number, number]>> = {
  3: [0.8182, -11.242],
  4: [0.8128, -8.832],
};

export function shieldBlockValue(quality: 3 | 4, itemLevel: number): number {
  const line = SHIELD_BLOCK[quality];
  return Math.round(line[0] * itemLevel + line[1]);
}

/**
 * Weapon damage per second, fitted per hand and quality.
 *
 * ----------------------------------------------------------------------------
 * DPS IS A LINE AND NOT A BUDGET LINE -- it comes with the item level and the
 * hand, which the Forever data demonstrates rather than suggests: at one item
 * level a hand's dps does not move with speed. These are fitted as an UPPER
 * envelope, because caster weapons sit below the physical line on purpose.
 *
 * The epic fits reproduce Forever's own observed figures at item level 65 --
 * one-hand 47.1 against 47.24, two-hand 61.5 against 61.58, ranged 36.9
 * against 36.94 -- having been fitted across every item on file rather than to
 * those.
 *
 * THE BLUE RANGED LINE IS THE WEAK ONE, n=4 with a worst residual of 2.87, and
 * it is only ever asked for one number: a Hunter's bow at item level 55. It
 * gives 29.4 where the epic line gives 29.7, so the choice barely matters.
 * ----------------------------------------------------------------------------
 */
export const WEAPON_DPS: Readonly<Record<string, readonly [number, number]>> = {
  'oneHand|3': [0.5991, 3.438],
  'oneHand|4': [0.9516, -14.703],
  'twoHand|3': [0.7942, 3.707],
  'twoHand|4': [1.2094, -17.076],
  'ranged|3': [0.1893, 18.959],
  'ranged|4': [0.7254, -10.237],
};

/**
 * What a caster weapon keeps of its hand's physical damage.
 *
 * Forever's own caster weapons at item level 65: a two-hand staff is 45.67
 * against a physical 61.58, and a main-hand dagger 31.5 against 47.24. Both
 * give up 15.6 to 15.9 dps, which is the trade this reproduces.
 */
export const CASTER_DPS_SHARE: Readonly<Record<string, number>> = {
  twoHand: 45.67 / 61.58,
  oneHand: 31.5 / 47.24,
};

/**
 * Budget points bought by one point of forgone weapon damage.
 *
 * FITTED FROM TWO ITEMS and flagged for it -- Forever's two-hand caster staff
 * implies 2.97 and Classic's Azuresong Mageblade and Lok'amir il Romathis
 * imply 2.33 and 2.72. It is what lets a benchmark caster staff carry the ~94
 * spell power Forever's own does; without it the slot budget alone gives about
 * 40, and every caster benchmark would be quietly half-geared.
 */
export const DPS_TO_BUDGET = 2.97;

/* -------------------------------------------------------------------------- */
/* Slots                                                                      */
/* -------------------------------------------------------------------------- */

interface SlotPlan {
  readonly slot: EquipmentSlot;
  /** The inventory type the tooltip states, which decides base armour. */
  readonly inventory: string;
  readonly slotClass: SlotClass;
  /** How many preferred stats this slot carries. */
  readonly stats: number;
  /** Jewellery takes at most ONE base attribute -- the owner's realism rule. */
  readonly onePrimary?: boolean;
  readonly noArmour?: boolean;
}

/**
 * HOW MANY STATS EACH SLOT CARRIES, AND IT IS THE OWNER'S OWN TABLE.
 *
 * ==============================================================================
 * "High value slots (Head, Chest, Legs) should probably always have 5 stats.
 * Shoulders, Hands, Feet, Waist have 4. Trinkets 1 stat. Wrist, Neck, Rings,
 * Shields have 3 stats."
 *
 * WHAT IT IS FOR is the FIFTH AND SIXTH PREFERENCE. Every slot used to take at
 * most four, so a spreadsheet row's fifth entry was never bought at all: a
 * caster benchmark granted **no Spirit**, and the Bear's **Dodge and Defense**
 * were the fifth and sixth of its six and equally absent. The owner's own words
 * on raising the counts: "it should open up some space for Spirit, Dodge,
 * Defense etc."
 *
 * IT CHANGES THE SHAPE RATHER THAN THE TOTAL. A slot's budget is unchanged, so
 * five stats on a head means five smaller numbers -- the owner: "I understand
 * that this may change the shape of the gear". The 3/2 power makes that cost
 * something real: a concentrated item buys more total stat than a spread one,
 * which is exactly what the exponent is for.
 *
 * THE CLOAK IS THE ONE SLOT THE TABLE DOES NOT NAME, and it takes 3 with the
 * other `light` slots -- same slot multiplier as a wrist, a neck and a ring.
 * Said here rather than assumed silently.
 *
 * A TRINKET DROPS FROM TWO STATS TO ONE, which is the only count that FELL.
 * With `onePrimary` as well it is now the purest expression of a build's first
 * preference: one line, the stat the spreadsheet puts first.
 * ==============================================================================
 */
export const ARMOUR_SLOTS: readonly SlotPlan[] = [
  { slot: 'head', inventory: 'Head', slotClass: 'full', stats: 5 },
  { slot: 'neck', inventory: 'Neck', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'shoulders', inventory: 'Shoulder', slotClass: 'medium', stats: 4 },
  { slot: 'cloak', inventory: 'Back', slotClass: 'light', stats: 3 },
  { slot: 'chest', inventory: 'Chest', slotClass: 'full', stats: 5 },
  { slot: 'wrists', inventory: 'Wrist', slotClass: 'light', stats: 3 },
  { slot: 'gloves', inventory: 'Hands', slotClass: 'medium', stats: 4 },
  { slot: 'waist', inventory: 'Waist', slotClass: 'medium', stats: 4 },
  { slot: 'legs', inventory: 'Legs', slotClass: 'full', stats: 5 },
  { slot: 'feet', inventory: 'Feet', slotClass: 'medium', stats: 4 },
  { slot: 'ring1', inventory: 'Finger', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'ring2', inventory: 'Finger', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'trinket1', inventory: 'Trinket', slotClass: 'trinket', stats: 1, onePrimary: true, noArmour: true },
  { slot: 'trinket2', inventory: 'Trinket', slotClass: 'trinket', stats: 1, onePrimary: true, noArmour: true },
];

/** A shield carries three, by the same table. Not an armour slot: see `benchmarkSets`. */
export const SHIELD_STATS = 3;

/**
 * EVERY ARMOUR-CLASS PIECE CARRIES STAMINA, AS A FLOOR ON ITS BUDGET.
 *
 * ==============================================================================
 * THE OWNER'S OBSERVATION: "It's strange to me that stamina was dropped on some
 * of the template items. This was meant to produce very similar items to
 * forever items. Typically all armor class items have stamina -- and I believe
 * the figure was around 10-15% of its item budget for those 8 slots."
 *
 * AND THEY WERE RIGHT ABOUT THE FIRST HALF. Stamina was bought only when it sat
 * inside a template's stat count, so a Rogue's wrists got none (fifth of five
 * preferences on a three-stat slot) and Seal Twist Ret got none ANYWHERE
 * (stamina is sixth of its seven). **93.3% of Forever's own clean armour pieces
 * carry stamina** -- 639 of 685 -- so an armour piece without any is the
 * exception and the generator was making it the rule.
 *
 * A FLOOR AND NOT A FIXED AMOUNT, which is what keeps a tank unharmed. The Bear
 * and both Protection builds lead with stamina and already buy far more than
 * this; the floor only tops up a slot that would otherwise drop it. Dropping it
 * INTO the preference order instead would have moved stamina ahead of a
 * build's first choice on every piece.
 *
 * ------------------------------------------------------------------------------
 * THE SHARE IS 25%, WHICH IS THE OWNER'S RULING AFTER THE DATA WAS PUT IN FRONT
 * OF THEM -- "use 25% and re-measure".
 *
 * They first remembered "around 10-15% of its item budget", which went in at
 * 12.5% with the measurement recorded beside it rather than overriding it,
 * because "I believe" marks a recollection and not a ruling. Measured by
 * `tools/stamina_share.ts` over Forever's own clean NON-PvP armour, stamina's
 * median share of `budget^1.5` is:
 *
 *     head 30.4%   shoulders 25.0%   chest 20.5%   wrists 22.6%
 *     gloves 24.6%  waist 24.4%      legs 30.0%    feet 35.0%
 *
 * -- a median of about 25% across the eight, which is the figure now used. At
 * E65 that is 19 stamina on a chest against Forever's own median of 17, and 19
 * on a head against 24.
 *
 * **SO THE FLAGGED QUESTION IS CLOSED AND THIS NOTE SAYS SO**, which is the half
 * that matters: a caveat outlives the doubt it describes, and a reader who finds
 * one of these next year cannot tell a live question from a settled one. The PvP
 * sets, which are not the comparison, sit at 55.9%.
 *
 * MEASURED IN THE CURRENCY THE BUDGET IS SPENT IN, which is the 3/2 power:
 * `stamina = (share x budget^1.5)^(2/3) / cost`. The linear reading --
 * `stamina = share x budget` -- gives 12 on a chest instead of 19, and the two
 * are a factor of about 1.6 apart on every slot. Both are printed by the tool so
 * the choice is visible rather than implied.
 * ==============================================================================
 */
export const STAMINA_BUDGET_SHARE = 0.25;

/**
 * The least stamina an armour-class piece carries, for a slot of this budget.
 *
 * ----------------------------------------------------------------------------
 * `alreadySpent` IS THE BUDGET POINTS THE SLOT HAS ALREADY COMMITTED, at the
 * 3/2 power, and the floor is CLAMPED to what is left. Without it the floor
 * pushes an item over its own budget, which is what happened on 48 of them: a
 * B55 medium slot has a budget of 25.6 and a Rogue's hit lands 25 Hit Rating on
 * it, which alone is 97% of `budget^1.5` -- so six stamina on top came out at
 * 26.9 of 25.6.
 *
 * THAT IS THE OWNER'S OWN RULE BITING, not a bug in it: "even though the needed
 * hit cap is mandatory, IT STILL COUNTS AGAINST THE STAT BUDGET ON THE ITEMS."
 * A 120-hit Rogue at BLUE item level 55 really is spending almost everything on
 * hit, and the honest answer is that such a slot cannot afford the floor -- not
 * that the floor wins and the budget gives way.
 * ----------------------------------------------------------------------------
 */
export function staminaFloor(budget: number, alreadySpent = 0): number {
  const wanted = (STAMINA_BUDGET_SHARE * budget ** BUDGET_EXPONENT) ** (1 / BUDGET_EXPONENT);
  const remaining = Math.max(0, budget ** BUDGET_EXPONENT - alreadySpent);
  const affordable = remaining ** (1 / BUDGET_EXPONENT);
  return Math.floor(Math.min(wanted, affordable) / COST.Stamina);
}

/**
 * Where hit and expertise go, in order.
 *
 * A REALISM RULE AND NOT AN ARITHMETIC ONE. The budget does not care which slot
 * carries a rating; a reader does, and no real item has 40 hit on it. Hit is
 * spread over these in chunks of 10, 15 or 20 -- whichever is the smallest
 * that fits the profile's total into the list.
 */
export const RATING_SLOTS: readonly EquipmentSlot[] = [
  'gloves',
  'wrists',
  'neck',
  'ring1',
  'ring2',
  'cloak',
  'waist',
  'feet',
  'shoulders',
  'head',
];

/* -------------------------------------------------------------------------- */
/* Allocation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Spread a rating total across slots in realistic chunks.
 *
 * Returns a map from slot to the amount it carries. The chunk is the smallest
 * of 10, 15 or 20 that lets the total fit inside `RATING_SLOTS`, so a Rogue's
 * 120 hit becomes eight items of 15 rather than three of 40.
 */
export function spreadRating(total: number, slots: readonly EquipmentSlot[]): Map<EquipmentSlot, number> {
  const out = new Map<EquipmentSlot, number>();
  if (total <= 0) return out;
  const chunk = [10, 15, 20, 25].find((c) => Math.ceil(total / c) <= slots.length) ?? 25;
  let left = total;
  for (const slot of slots) {
    if (left <= 0) break;
    const amount = Math.min(chunk, left);
    out.set(slot, amount);
    left -= amount;
  }
  return out;
}

/**
 * How a slot's budget divides between its stats, in descending priority.
 *
 * ----------------------------------------------------------------------------
 * THESE ARE FRACTIONS OF THE BUDGET AT THE 3/2 POWER, which is what makes the
 * arithmetic exact rather than iterative: if stat `i` takes fraction `f` of
 * `budget^1.5` then `value = f^(2/3) * budget / cost`, and the parts sum back
 * to the whole by construction.
 *
 * The shape is a judgement -- the spreadsheet gives an ORDER and not weights --
 * and it is a single table here so it can be argued with in one place.
 * ----------------------------------------------------------------------------
 */
export const SHARES: Readonly<Record<number, readonly number[]>> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
  4: [0.45, 0.27, 0.18, 0.1],
  /*
   * FIVE, FOR THE HIGH-VALUE SLOTS, and the fifth share is what makes a fifth
   * preference exist at all -- the row that buys a caster its Spirit and the
   * Bear its Dodge.
   *
   * THE SHAPE FOLLOWS THE FOUR-STAT ROW rather than being invented: each share
   * is about 0.6 of the one above it, which is what gives a first preference
   * visibly more than a last without making the last a rounding error. It sums
   * to 1 exactly, which the arithmetic requires.
   */
  5: [0.4, 0.24, 0.16, 0.12, 0.08],
};

/** The stats a slot carries, after the jewellery rule has narrowed them. */
export function statsFor(plan: SlotPlan, preferred: readonly BenchStat[]): readonly BenchStat[] {
  const picked: BenchStat[] = [];
  let primaries = 0;
  for (const stat of preferred) {
    if (picked.length >= plan.stats) break;
    if (PRIMARY.has(stat)) {
      if (plan.onePrimary && primaries >= 1) continue;
      primaries += 1;
    }
    picked.push(stat);
  }
  return picked;
}

export interface GeneratedItem {
  readonly id: number;
  readonly name: string;
  readonly quality: number;
  readonly icon: string;
  readonly source: string;
  readonly itemLevel: number;
  readonly inventoryType: string;
  readonly subclass: string | null;
  readonly armor: number | null;
  readonly weapon:
    | { readonly minDamage: number; readonly maxDamage: number; readonly speed: number; readonly dps: number }
    | null;
  readonly stats: Readonly<Record<string, number>>;
  readonly resistances: Readonly<Record<string, number>>;
  readonly effects: readonly { readonly kind: string; readonly text: string }[];
  readonly tooltip: string;
  /** What the budget says this item spent, for the test that checks it fits. */
  readonly budget: number;
  readonly spent: number;
}

export type { SlotPlan, ArmourClass };
