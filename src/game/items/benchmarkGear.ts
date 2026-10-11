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
  /**
   * One of the EIGHT slots that has an armour class, which is where
   * `EXCLUSIVE_PAIRS` applies.
   *
   * Not the same as "has armour": a cloak has armour and no armour class, and
   * the owner's rule is about the eight. It is the same eight
   * `equipRules.ARMOUR_CLASS_SLOTS` names, for the same reason.
   */
  readonly armourClassPiece?: boolean;
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
  { slot: 'head', inventory: 'Head', armourClassPiece: true, slotClass: 'full', stats: 5 },
  { slot: 'neck', inventory: 'Neck', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'shoulders', inventory: 'Shoulder', armourClassPiece: true, slotClass: 'medium', stats: 4 },
  { slot: 'cloak', inventory: 'Back', slotClass: 'light', stats: 3 },
  { slot: 'chest', inventory: 'Chest', armourClassPiece: true, slotClass: 'full', stats: 5 },
  { slot: 'wrists', inventory: 'Wrist', armourClassPiece: true, slotClass: 'light', stats: 3 },
  { slot: 'gloves', inventory: 'Hands', armourClassPiece: true, slotClass: 'medium', stats: 4 },
  { slot: 'waist', inventory: 'Waist', armourClassPiece: true, slotClass: 'medium', stats: 4 },
  { slot: 'legs', inventory: 'Legs', armourClassPiece: true, slotClass: 'full', stats: 5 },
  { slot: 'feet', inventory: 'Feet', armourClassPiece: true, slotClass: 'medium', stats: 4 },
  { slot: 'ring1', inventory: 'Finger', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'ring2', inventory: 'Finger', slotClass: 'light', stats: 3, onePrimary: true, noArmour: true },
  { slot: 'trinket1', inventory: 'Trinket', slotClass: 'trinket', stats: 1, onePrimary: true, noArmour: true },
  { slot: 'trinket2', inventory: 'Trinket', slotClass: 'trinket', stats: 1, onePrimary: true, noArmour: true },
];

/**
 * WHAT A TRINKET CARRIES, declared per template.
 *
 * ==============================================================================
 * IT WAS TWO HARD-CODED ARCHETYPES and the owner has now specified a third
 * shape for the tanks: "Tank (Bear, Prot Warr, Prot Pally) trinkets shouldn't
 * both be stamina only. Let's mix it up and do 1 with half item budget on
 * stamina / half on crit. The other trinket can be similar crit + attack power
 * for bear and prot warr. And one pure spell power trinket for Prot pally."
 *
 * So the pair became a declaration rather than a branch, and the two DPS
 * archetypes are now the DEFAULT rather than the only thing expressible.
 *
 * ------------------------------------------------------------------------------
 * `cappedCrit` IS THE DPS ARCHETYPE'S CRIT: a fixed rating, capped at
 * `TRINKET_CRIT_RATING` across the pair and clamped to what the slot can
 * afford. Listing `Crit` in `stats` instead gives it a SHARE of the budget,
 * which is what "half item budget on crit" asks for -- two different things,
 * and a trinket uses one or the other.
 *
 * **THE TANK PLANS THEREFORE RUN PAST THE 28 CAP, AND THAT IS THE OWNER'S TWO
 * STATEMENTS DISAGREEING RATHER THAN A BUG HERE.** "A maximum of 28 crit
 * rating across both trinkets" was said of the DPS archetypes; "half item
 * budget on crit" is a later and more specific instruction about the tanks,
 * and half a trinket's budget is about 21 rating at E65. The later and more
 * specific statement wins, which is this project's standing rule -- and the
 * figure it produces is printed by `benchmark_stat_report.ts` so the owner can
 * see what their two sentences add up to.
 * ==============================================================================
 */
export interface TrinketPlan {
  /** Takes the capped, clamped crit rating. The DPS archetype's first half. */
  readonly cappedCrit?: boolean;
  /** Stats dividing whatever budget is left. */
  readonly stats: readonly BenchStat[];
  /**
   * Divide it EVENLY rather than by `SHARES`.
   *
   * "Half item budget on stamina / half on crit" is a 50/50 split, where the
   * positional table would give 65/35 and `SHARE_WEIGHT` would then halve the
   * crit again. A trinket is one line or two and has no "first preference" to
   * express, so an even split is the honest reading of the owner's words.
   */
  readonly even?: boolean;
}

/**
 * A WEAPON HELD PURELY FOR ITS STATS, in a slot the build never swings.
 *
 * ==============================================================================
 * THE OWNER ASKED FOR TWO KINDS AT ONCE:
 *
 *   "2H arms, DW Fury, Prot Warr, Venom, Combat, Rupture, Hemo need a ranged
 *    weapon stat stick -- for the warrior profile ranged slots make their stat
 *    budget stamina + crit rating. For the rogue profile ranged slots make
 *    their stat budget agility + hit rating."
 *
 *   "Firelock, SM/DS, Shadow, Fire, Frostfire, and Arcane profiles need a Wand
 *    weapon stat stick -- these should all be a split item budget with
 *    intellect + spell power."
 *
 * ------------------------------------------------------------------------------
 * IT NEVER SWINGS AND NOTHING HAD TO BE ADDED FOR THAT. Only the `ranged`
 * STYLE fires a ranged weapon -- `rangedSlot: 'required'`, which is the four
 * Hunters -- so for every one of these thirteen the item contributes its stats
 * and no attacks. The melee Hunters already proved the arrangement.
 *
 * AND THE SIX WAND PROFILES ARE EXACTLY THE THREE CLASSES WITH THE WAND
 * PROFICIENCY. Warlock, Priest and Mage; the Moonkin and the Elemental Shaman
 * are absent from the owner's list and are also absent from the `wand` column
 * of their table, which is a pleasing cross-check rather than a coincidence.
 * ==============================================================================
 */
export interface StatStick {
  /** `Bow`, `Wand`. Decides the icon and the proficiency the item demands. */
  readonly subclass: string;
  /** What its budget buys, in descending order. */
  readonly stats: readonly BenchStat[];
}

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
 * The most of a slot's budget a hit or expertise rating may take.
 *
 * ==============================================================================
 * THE SECOND HALF OF THE OWNER'S "+1 SPELL POWER" FINDING. Funding the rating
 * out of crit (see `RATING_DONORS`) fixes a slot that HAS crit to give; it
 * cannot fix one where the rating alone costs more than the whole slot.
 *
 * A B55 medium slot has 25.6 budget points, so at the 3/2 power:
 *
 *     10 hit   24% of the slot      20 hit   69%
 *     15 hit   45%                  25 hit   **97%**
 *
 * -- and four slots of every B55 caster set carried 25, which is why they read
 * "+25 Hit Rating, +2 Stamina, +1 Spell Power". There was nothing left to
 * divide, and at the 3/2 power a tiny remainder rounds to 0 or 1.
 *
 * HALF, SO THE REST OF THE ITEM IS STILL AN ITEM. It is the one number here
 * that is a judgement rather than a measurement, and it is stated as a share
 * so it scales with item level: the same 25 hit is 97% of a B55 medium slot
 * and 42% of an E85 one, and only the first is a problem.
 * ==============================================================================
 */
export const RATING_BUDGET_SHARE = 0.5;

/**
 * Ratings are spread in multiples of this.
 *
 * FIVE, because Forever's own items carry hit in whole percentage points --
 * 10 rating is 1% -- and a line reading "+13 Hit Rating" would be the
 * generator showing its arithmetic. It is the realism rule `RATING_SLOTS`
 * already exists for, applied to the amount instead of the count.
 */
export const RATING_STEP = 5;

/** The most rating a slot of this budget may carry, rounded to a real step. */
export function ratingCapacity(budget: number, cost: number): number {
  const points = (RATING_BUDGET_SHARE * budget ** BUDGET_EXPONENT) ** (1 / BUDGET_EXPONENT);
  return Math.floor(points / cost / RATING_STEP) * RATING_STEP;
}

/**
 * Spread a rating total across slots, giving each what it can afford.
 *
 * ==============================================================================
 * LARGEST HEADROOM FIRST, IN STEPS OF FIVE, which replaces "one uniform chunk
 * for every slot". The chunk was the smallest of 10/15/20/25 that fit the
 * total into the slot list -- and because the slot list had itself been
 * filtered by affordability, a set whose small slots could not afford 25 ended
 * up with FEWER eligible slots and therefore a BIGGER chunk. The circle closed
 * on 25 for every one of them.
 *
 * Giving each slot what it can afford is also the more realistic answer: a
 * real set does not put the same 15 hit on a ring and on a chest.
 *
 * ------------------------------------------------------------------------------
 * `taken` IS WHY HIT AND EXPERTISE CANNOT COLLIDE. They are spread in two
 * passes over the same slots, so the second has to know what the first used --
 * without it a Rogue's 120 hit and 10 expertise could land on one slot and put
 * it over the cap that exists to stop exactly that.
 *
 * AND THE TOTAL IS MET EVEN IF THE CAPS CANNOT ABSORB IT, because the owner's
 * figure is absolute: "even though the needed hit cap is mandatory, IT STILL
 * COUNTS AGAINST THE STAT BUDGET ON THE ITEMS". The overflow goes to the
 * biggest slots, which is where it does least harm -- and `benchmarkShape`
 * asserts how often that happens, so a template that outgrows its set is
 * visible rather than silent.
 * ==============================================================================
 */
export function spreadRating(
  total: number,
  slots: readonly EquipmentSlot[],
  capacityOf: (slot: EquipmentSlot) => number,
  taken: ReadonlyMap<EquipmentSlot, number> = new Map(),
): Map<EquipmentSlot, number> {
  const out = new Map<EquipmentSlot, number>();
  if (total <= 0 || slots.length === 0) return out;

  const headroom = new Map<EquipmentSlot, number>(
    slots.map((slot) => [slot, Math.max(0, capacityOf(slot) - (taken.get(slot) ?? 0))] as const),
  );

  let left = total;
  while (left > 0) {
    // The slot with the most room left. Ties break on the list's own order,
    // which is `RATING_SLOTS` -- a stated preference, not an accident.
    let best: EquipmentSlot | undefined;
    let most = 0;
    for (const slot of slots) {
      const room = headroom.get(slot) ?? 0;
      if (room > most) {
        most = room;
        best = slot;
      }
    }
    if (best === undefined) break;

    const step = Math.min(RATING_STEP, left, most);
    out.set(best, (out.get(best) ?? 0) + step);
    headroom.set(best, most - step);
    left -= step;
  }

  /*
   * THE CAPS COULD NOT ABSORB IT. The total is the owner's and is absolute, so
   * the remainder goes onto the slots in order and the cap gives way -- the
   * opposite of `staminaFloor`, where the BUDGET is absolute and the floor
   * gives way, because these two numbers have different owners.
   */
  if (left > 0) {
    for (const slot of slots) {
      if (left <= 0) break;
      const step = Math.min(RATING_STEP, left);
      out.set(slot, (out.get(slot) ?? 0) + step);
      left -= step;
    }
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

/**
 * HOW MUCH OF A SLOT'S BUDGET EACH STAT GETS, RELATIVE TO ITS POSITION.
 *
 * ==============================================================================
 * `SHARES` above is POSITIONAL -- the first preference takes 0.4 of a five-stat
 * slot whatever that preference is. These weights multiply it per STAT, and the
 * result is renormalised, so a stat can be made systematically cheaper or
 * dearer without reordering anybody's preference list.
 *
 * ------------------------------------------------------------------------------
 * BOTH ENTRIES WERE MEASURED AGAINST FOREVER'S OWN ITEMS, not chosen. The owner
 * reported two symptoms -- "crit rating is too prevalent" and "spell power
 * numbers are way down from what I'm expecting" -- and then set the standard:
 * "if 750 isn't reachable that's fine. I want it to be realistic."
 *
 * `tools/real_set_shape.ts` is what answers that. Over real Forever items at
 * item level 60-70 that a class can equip, PvP excluded, summing the per-slot
 * figure across a full set:
 *
 *                      median   p75   best-in-database
 *   crit rating          168    182        210     (a warrior set)
 *   spell power          290    345        397     (a mage set)
 *
 * -- against a benchmark set that was carrying **295 crit and 205 spell
 * power**. So crit sat 40% above the best real set in the game and spell power
 * sat BELOW an ordinary one, which is exactly the pair of symptoms reported.
 *
 * A BENCHMARK SET SHOULD SIT BETWEEN p75 AND BEST, which is the judgement here
 * and the only one: these sets exist so two builds can be compared at the same
 * item level, so each should be a strong set of that item level rather than an
 * average one -- and it must not EXCEED what the game contains, or the
 * comparison stops being about the builds.
 *
 * ------------------------------------------------------------------------------
 * A WEIGHT IS A FRACTION OF BUDGET, SO IT SCALES WITH ITEM LEVEL FOR FREE,
 * which is what the owner asked for -- "for all sets and all item levels". An
 * absolute pullback in rating points would have to be re-derived per set.
 * ==============================================================================
 */
/**
 * The crit rating the two trinkets carry BETWEEN them.
 *
 * The owner's number, and the owner's shape: "a maximum of 28 crit rating (2%)
 * across both trinkets", with the first being the "28 crit rating + a scaling
 * spell power / attack power" archetype and the second "pure spell power". See
 * the trinket branch in `benchmarkSets.ts` for why a real trinket carries
 * neither.
 */
export const TRINKET_CRIT_RATING = 28;

/**
 * The most of a trinket's budget the crit half of the archetype may take.
 *
 * ----------------------------------------------------------------------------
 * A MAXIMUM OF 28 IS NOT THE SAME AS 28, which the B55 sets proved: a blue
 * item-level-55 trinket has a budget of 23.3 points and 28 crit rating costs
 * 28 of them, so the flat figure put the item **20% over its own budget** and
 * left nothing for the scaling half -- turning the owner's "28 crit rating +
 * a scaling spell power / attack power value" back into a pure crit trinket,
 * which is the thing it replaced.
 *
 * THE SAME CLAMP `staminaFloor` ALREADY APPLIES, for the same reason stated
 * there: "a floor that wins against the budget is not a floor, it is a leak,
 * and the honest answer is that such a slot cannot afford it."
 *
 * 0.75 IS WHERE 28 AND THE CLAMP MEET AT E65, which is the set the owner's
 * figure was read off -- so every epic set gets the full 28 and only B55, the
 * blue one, carries less. The remaining quarter is what guarantees the
 * scaling half is never zero.
 * ----------------------------------------------------------------------------
 */
export const TRINKET_CRIT_BUDGET_SHARE = 0.75;

/** The crit a trinket of this budget can carry, capped and clamped. */
export function trinketCrit(budget: number): number {
  const affordable =
    (TRINKET_CRIT_BUDGET_SHARE * budget ** BUDGET_EXPONENT) ** (1 / BUDGET_EXPONENT) / COST.Crit;
  return Math.min(TRINKET_CRIT_RATING, Math.floor(affordable));
}

/**
 * Which stat pays for a hit or expertise rating on the same slot.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S RULING: "Instead of pull from spell power to get more hit
 * rating, it should be pull from crit rating to get more hit rating. Therefore
 * it keeps the spell power reasonable."
 *
 * A LIST SO A SECOND DONOR CAN BE ADDED, and because the ORDER is the rule --
 * the first donor is drained before the second is touched. Crit is the only
 * one today and is the one the owner named. See `toLines`.
 * ----------------------------------------------------------------------------
 */
export const RATING_DONORS: readonly BenchStat[] = ['Crit'];

/**
 * How much of its OWN portion a donor may give up before the rest chips in.
 *
 * ==============================================================================
 * THE OWNER'S RULE, BOUNDED, AND THE BOUND IS A MEASUREMENT RATHER THAN A
 * TASTE. Draining crit without limit is the rule read literally, and it
 * over-corrects: a caster carries 110 hit across almost every slot, so crit
 * has nothing left anywhere. Measured at E65, against the real item-level-60-70
 * population a mage set occupies (crit 154, spell power 290-397):
 *
 *     donor share   caster crit   caster gear spell power
 *     0% (no rule)      181            384
 *     100% (literal)     74            427   <- crit far below real, SP above
 *
 * So the literal reading takes crit BELOW what real sets carry and spell power
 * ABOVE the richest set in the database -- trading one unrealistic number for
 * two. The bound is what keeps the owner's rule pointing the right way without
 * running past the thing it was for.
 * ==============================================================================
 */
export const RATING_DONOR_SHARE = 0.4;

export const SHARE_WEIGHT: Readonly<Partial<Record<BenchStat, number>>> = {
  Crit: 0.5,
  'Spell Power': 2,
};

/**
 * The positional shares for a slot, with `SHARE_WEIGHT` applied and renormalised.
 *
 * RENORMALISED, so the parts still sum to one and the budget arithmetic stays
 * exact rather than iterative. What crit gives up is therefore spread across
 * whatever else the slot carries -- which on every list but the casters' is
 * mostly BASE ATTRIBUTES, the owner's stated destination for it.
 */
export function weightedShares(stats: readonly BenchStat[]): readonly number[] {
  const positional = SHARES[stats.length] ?? SHARES[4];
  const weighted = stats.map((stat, index) => positional[index] * (SHARE_WEIGHT[stat] ?? 1));
  const total = weighted.reduce((sum, value) => sum + value, 0);
  return total === 0 ? positional : weighted.map((value) => value / total);
}

/**
 * STATS A SINGLE ARMOUR PIECE NEVER CARRIES TOGETHER.
 *
 * ==============================================================================
 * THE OWNER'S RULE: "The eight plate armor class item slots shouldn't have
 * BOTH strength and attack power, this should likely only affect the DPS
 * warrior profiles."
 *
 * **AND IT IS NOT PLATE-ONLY, WHICH THE DATA SETTLES RATHER THAN A JUDGEMENT.**
 * Across all 1,374 real armour pieces on file -- every class, every slot --
 * **not one carries both Strength and Attack Power**:
 *
 *     Plate    304 pieces   218 with Strength    1 with Attack Power   BOTH 0
 *     Mail     328           70                 40                     BOTH 0
 *     Leather  363          123                 33                     BOTH 0
 *     Cloth    379            0                  0                     BOTH 0
 *
 * So the rule is general, and the owner's "likely only the DPS warriors" was a
 * guess about which PROFILES it would move rather than about its scope.
 *
 * AGILITY AND ATTACK POWER ARE NOT A PAIR, which is why this is a list of one
 * rather than a blanket "no two offensive stats": 8 leather and 21 mail pieces
 * carry both, so excluding that combination would be inventing a rule the data
 * contradicts.
 *
 * THE EARLIER PREFERENCE WINS, because the spreadsheet's order is the owner's
 * statement of what the build wants most. Every list that names both puts
 * Strength first.
 * ==============================================================================
 */
export const EXCLUSIVE_PAIRS: readonly (readonly [BenchStat, BenchStat])[] = [
  ['Strength', 'Attack Power'],
];

/**
 * How often the LATER member of a pair gets the slot instead of the earlier.
 *
 * ==============================================================================
 * ONE SLOT IN FOUR, SO NEITHER MEMBER VANISHES FROM THE SET.
 *
 * Dropping the later member outright is the obvious reading of "an item should
 * not have both", and it took the Rogue's **Strength to zero across the whole
 * set** -- which is the other rule the owner gave, that a preferred stat going
 * to nothing "is unrealistic to how items are actually designed". The two
 * rules are about different scopes: the pair is about ONE ITEM and the zero
 * check is about the SET, and both can hold at once if the slots take turns.
 *
 * THE RATIO IS THE REAL ITEMS', not a convenience. Over armour at item level
 * 60-80 that each class can equip:
 *
 *     a warrior's plate     130 pieces with Strength    14 with Attack Power
 *     a rogue's leather      33                         22
 *
 * -- both present on both, with the earlier preference commoner on each. Three
 * slots in four is that shape without pretending to a precision two samples
 * cannot support.
 * ==============================================================================
 */
export const EXCLUSIVE_PAIR_PERIOD = 4;

/**
 * The stats a slot carries, after the jewellery rule has narrowed them.
 *
 * ==============================================================================
 * `rotation` IS WHY NO PREFERRED STAT COMES OUT AT ZERO ANY MORE.
 *
 * A template may name more stats than a slot has room for -- Seal Twist Ret
 * names seven and a head holds five -- and this took the first N every time,
 * so the TAIL of a long list was bought nowhere in the whole set. Five of the
 * 25 sets had at least one: Ret had no Attack Power, the Shockadin had no
 * Agility and no Attack Power, both Protection builds had no Block and the
 * Bear had no Defense.
 *
 * The owner on it: stats going to nothing across a whole set "is unrealistic
 * to how items are actually designed" -- and they are right twice over, since
 * real sets also do not put the identical five stats on every piece.
 *
 * SO THE LAST POSITION CYCLES THROUGH THE TAIL, by slot index. The slot keeps
 * its first `stats - 1` preferences, which is the build's core, and its last
 * line rotates -- so over the eight armour slots every tail stat is bought
 * somewhere, and no slot loses a stat it was already getting.
 *
 * IT CHANGES NOTHING FOR A TEMPLATE THAT FITS. When `preferred.length` is at
 * most `plan.stats` the tail is a single stat and the rotation returns it
 * every time, which is twenty of the twenty-five.
 * ==============================================================================
 */
/**
 * Whether this slot's turn of an exclusive pair goes to the OTHER member.
 *
 * Asked of the template's whole `preferred` list rather than of what is
 * already eligible, so the answer does not depend on how far the loop has
 * got -- which is what makes it the same for both members and therefore
 * consistent.
 */
function excluded(
  stat: BenchStat,
  preferred: readonly BenchStat[],
  rotation: number,
): boolean {
  for (const [first, second] of EXCLUSIVE_PAIRS) {
    if (stat !== first && stat !== second) continue;
    if (!preferred.includes(first) || !preferred.includes(second)) continue;
    const laterWins = rotation % EXCLUSIVE_PAIR_PERIOD === EXCLUSIVE_PAIR_PERIOD - 1;
    const wanted = laterWins ? second : first;
    if (stat !== wanted) return true;
  }
  return false;
}

export function statsFor(
  plan: SlotPlan,
  preferred: readonly BenchStat[],
  rotation = 0,
): readonly BenchStat[] {
  const eligible: BenchStat[] = [];
  let primaries = 0;
  for (const stat of preferred) {
    if (PRIMARY.has(stat)) {
      if (plan.onePrimary && primaries >= 1) continue;
      primaries += 1;
    }
    /*
     * NO ARMOUR PIECE CARRIES BOTH HALVES OF AN EXCLUSIVE PAIR, and which half
     * it carries turns with the slot -- the earlier preference on three slots
     * in four. See `EXCLUSIVE_PAIRS` and `EXCLUSIVE_PAIR_PERIOD`.
     */
    if (plan.armourClassPiece === true && excluded(stat, preferred, rotation)) continue;
    eligible.push(stat);
  }

  if (eligible.length <= plan.stats) return eligible;

  const core = eligible.slice(0, plan.stats - 1);
  const tail = eligible.slice(plan.stats - 1);
  return [...core, tail[rotation % tail.length]];
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
