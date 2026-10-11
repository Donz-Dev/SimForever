import type { ClassId } from '../character/ids';
import { MAX_CHARACTER_LEVEL } from '../character/definitions';
import { className } from '../character/selection';
import { benchmarkIcon } from './benchmarkIcons';
import type { Equipment, EquipmentSlot } from './Item';
import {
  ARMOUR_SLOTS,
  BENCHMARK_SETS,
  BUDGET_EXPONENT,
  CASTER_DPS_SHARE,
  COST,
  DPS_TO_BUDGET,
  LINE,
  RATING_SLOTS,
  RATING_DONORS,
  RATING_DONOR_SHARE,
  ratingCapacity,
  SHIELD_STATS,
  trinketCrit,
  SLOT_MULTIPLIER,
  WEAPON_DPS,
  baseArmour,
  qualityBase,
  shieldBlockValue,
  spreadRating,
  staminaFloor,
  statsFor,
  weightedShares,
  type ArmourClass,
  type BenchStat,
  type StatStick,
  type TrinketPlan,
  type BenchmarkSetId,
  type GeneratedItem,
} from './benchmarkGear';

/**
 * The 25 benchmark templates, from the ruleset owner's spreadsheet.
 *
 * ==============================================================================
 * HIT AND EXPERTISE ARE ABSOLUTE TOTALS FOR THE WHOLE SET, not per item, and
 * **they still cost budget** -- the owner's instruction. So a Rogue needing 120
 * hit spends 120 budget points on it before anything else is bought, which is
 * why a Rogue benchmark carries visibly less of everything else than a
 * Warrior's at the same item level. That is the ruleset, not a bug in the set.
 *
 * `preferred` IS IN DESCENDING ORDER OF IMPORTANCE and the allocator reads it
 * that way: the first stat takes the largest share of each slot's budget.
 * ==============================================================================
 */
export interface BenchmarkTemplate {
  readonly presetId: string;
  /**
   * The class this build is, which the generated items STATE on themselves.
   *
   * --------------------------------------------------------------------------
   * The owner's instruction for the item cards: a template piece should name
   * its class the way a real tier piece does, so "Requires Level 60" is
   * followed by "Classes: Paladin" rather than by nothing.
   *
   * DECLARED HERE AND NOT DERIVED, because `game` may not import `profiles`
   * and the preset is the only thing that knows. `benchmarkTemplates.test.ts`
   * cross-checks all 25 against the presets, which is the layer that can see
   * both -- so a declaration that drifts from its preset fails the suite
   * rather than mislabelling a card.
   * --------------------------------------------------------------------------
   */
  readonly characterClass: ClassId;
  readonly label: string;
  /**
   * What the preset calls the CHARACTER, where that differs from the label.
   *
   * Four of the 25 do: the Mage presets are labelled "Frostfire", "Arcane" and
   * "Fire" and name their characters "Frostfire Mage" and so on. The UI joins
   * on the character's name because `game` cannot see `profiles`, so the
   * difference has to be written down rather than assumed away.
   */
  readonly characterName?: string;
  readonly hit: number;
  readonly expertise: number;
  readonly preferred: readonly BenchStat[];
  readonly armour: ArmourClass;
  readonly weapons: WeaponPlan;
  /**
   * The two trinkets, where this build wants something other than the default.
   *
   * ABSENT MEANS THE DPS PAIR -- "28 crit plus a scaling damage stat" and
   * "pure damage stat" -- which is what twenty-two of the twenty-five want.
   * The three tanks declare their own. See `TrinketPlan`.
   */
  readonly trinkets?: readonly [TrinketPlan, TrinketPlan];
  /**
   * A weapon held in the ranged slot purely for its stats.
   *
   * Thirteen of the twenty-five have one on the owner's instruction: a bow for
   * the three Warriors and the four Rogues, a wand for the six casters whose
   * class has the wand proficiency. It never swings -- only the `ranged` STYLE
   * fires one -- so it is stats and nothing else. See `StatStick`.
   */
  readonly statStick?: StatStick;
}

/** What the character holds. `caster` trades damage for stats. */
export interface WeaponPlan {
  readonly kind: 'twoHand' | 'dualWield' | 'oneHandShield';
  readonly subclass: string;
  readonly offSubclass?: string;
  readonly caster?: boolean;
  /** A bow, for the four Hunter builds. */
  readonly ranged?: boolean;
  /**
   * An explicit swing speed, for a row that specifies one.
   *
   * The Shockadin's is the only one: "Fast 2H Mace (2.0 attack speed)". Read by
   * both the two-hand and the one-hand branches -- it was read by only the
   * first, which made the field silently inert for a shield build.
   */
  readonly speed?: number;
}

/**
 * The ranged and wand stat sticks, by what they carry.
 *
 * Named rather than written out per template for the reason `MELEE` and `TANK`
 * are: seven templates share the first two between them and six share the
 * third, and seven copies of a list is seven chances to mistype one.
 */
const WARRIOR_STICK: StatStick = { subclass: 'Bow', stats: ['Stamina', 'Crit'] };
const ROGUE_STICK: StatStick = { subclass: 'Bow', stats: ['Agility', 'Hit'] };
const WAND_STICK: StatStick = { subclass: 'Wand', stats: ['Intellect', 'Spell Power'] };

/**
 * The tank trinket pair, which is the owner's own design.
 *
 * "1 with half item budget on stamina / half on crit. The other trinket can be
 * similar crit + attack power for bear and prot warr. And one pure spell power
 * trinket for Prot pally."
 */
const TANK_TRINKETS: readonly [TrinketPlan, TrinketPlan] = [
  { stats: ['Stamina', 'Crit'], even: true },
  { stats: ['Crit', 'Attack Power'], even: true },
];
const PROT_PALLY_TRINKETS: readonly [TrinketPlan, TrinketPlan] = [
  { stats: ['Stamina', 'Crit'], even: true },
  { stats: ['Spell Power'] },
];

const MELEE: readonly BenchStat[] = ['Crit', 'Strength', 'Stamina', 'Agility', 'Attack Power'];
const ROGUE: readonly BenchStat[] = ['Crit', 'Agility', 'Attack Power', 'Strength', 'Stamina'];
const CASTER: readonly BenchStat[] = ['Crit', 'Spell Power', 'Intellect', 'Stamina', 'Spirit'];
const HUNTER: readonly BenchStat[] = ['Crit', 'Agility', 'Intellect', 'Attack Power', 'Stamina'];
const TANK: readonly BenchStat[] = ['Stamina', 'Strength', 'Agility', 'Defense', 'Parry', 'Block'];
/*
 * THE PROTECTION PALADIN IS A TANK WITH SPELL POWER WHERE AGILITY WOULD BE,
 * the owner's instruction: "the Shockadin and Prot pally template gear should
 * have spell power instead of agility". It holds its position in the order, so
 * the only thing that changes is which stat the slots buy there -- and the
 * weapon, which takes `preferred.slice(0, 3)`, now buys spell power with the
 * budget its caster trade already earned it.
 */
const PROT_PALLY: readonly BenchStat[] = ['Stamina', 'Strength', 'Spell Power', 'Defense', 'Parry', 'Block'];

export const BENCHMARK_TEMPLATES: readonly BenchmarkTemplate[] = [
  { presetId: 'two_hand_arms', characterClass: 'warrior', label: '2H Arms', hit: 80, expertise: 10, preferred: MELEE, armour: 'Plate', weapons: { kind: 'twoHand', subclass: 'Axe' }, statStick: WARRIOR_STICK },
  { presetId: 'dw_fury', characterClass: 'warrior', label: 'DW Fury', hit: 80, expertise: 10, preferred: MELEE, armour: 'Plate', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe' }, statStick: WARRIOR_STICK },
  { presetId: 'prot_warr', characterClass: 'warrior', label: 'Prot Warr', hit: 70, expertise: 20, preferred: TANK, armour: 'Plate', weapons: { kind: 'oneHandShield', subclass: 'Sword' }, trinkets: TANK_TRINKETS, statStick: WARRIOR_STICK },
  { presetId: 'rogue_venom', characterClass: 'rogue', label: 'Venom', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' }, statStick: ROGUE_STICK },
  /*
   * COMBAT MUT IS THE VENOM TEMPLATE WITH TWO FIELDS CHANGED, which is the
   * owner's own framing of the profile: it copies everything from Venom but
   * the APL and the talents. Same leather, same two daggers, same hit cap,
   * same preference order -- so a difference between the two profiles is a
   * difference in the BUILD rather than in what it is wearing, which is the
   * whole point of a benchmark set.
   */
  { presetId: 'rogue_combat_mut', characterClass: 'rogue', label: 'Combat Mut', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' }, statStick: ROGUE_STICK },
  { presetId: 'rogue_combat', characterClass: 'rogue', label: 'Combat', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Sword', offSubclass: 'Dagger' }, statStick: ROGUE_STICK },
  { presetId: 'rogue_rupture', characterClass: 'rogue', label: 'Rupture', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' }, statStick: ROGUE_STICK },
  /*
   * DAGGERS, NOT THE SPREADSHEET'S "MH Mace, OH Dagger" -- the owner's ruling
   * after the conflict was raised. Ambush is gated on
   * `mainHand?.weaponType === 'dagger'`, so a mace main hand switches it off
   * SILENTLY: the entry stays in the list, fires zero times, and the profile
   * produces an ordinary-looking figure. That is the failure mode this project
   * documents hardest, and it is why the weapon column loses to the build.
   */
  { presetId: 'rogue_hemo', characterClass: 'rogue', label: 'Hemo', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' }, statStick: ROGUE_STICK },
  { presetId: 'druid_moonkin', characterClass: 'druid', label: 'Moonkin', hit: 110, expertise: 0, preferred: CASTER, armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'druid_cat', characterClass: 'druid', label: 'Cat', hit: 30, expertise: 10, preferred: ['Strength', 'Agility', 'Crit', 'Stamina', 'Attack Power'], armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'druid_bear', characterClass: 'druid', label: 'Bear', hit: 30, expertise: 20, preferred: ['Stamina', 'Bonus Armor', 'Agility', 'Strength', 'Dodge', 'Defense'], armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Mace' }, trinkets: TANK_TRINKETS },
  { presetId: 'shaman_elemental', characterClass: 'shaman', label: 'Ele Shaman', hit: 110, expertise: 0, preferred: CASTER, armour: 'Mail', weapons: { kind: 'oneHandShield', subclass: 'Mace', caster: true } },
  { presetId: 'shaman_enhancement', characterClass: 'shaman', label: 'Enh Shaman', hit: 70, expertise: 10, preferred: ['Crit', 'Strength', 'Intellect', 'Agility', 'Stamina', 'Attack Power'], armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'mage_frostfire', characterClass: 'mage', label: 'Frostfire', characterName: 'Frostfire Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
  { presetId: 'mage_arcane', characterClass: 'mage', label: 'Arcane', characterName: 'Arcane Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
  { presetId: 'mage_fire', characterClass: 'mage', label: 'Fire', characterName: 'Fire Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
  { presetId: 'pally_ret', characterClass: 'paladin', label: 'Seal Twist Ret', hit: 80, expertise: 10, preferred: ['Crit', 'Strength', 'Spell Power', 'Agility', 'Intellect', 'Stamina', 'Attack Power'], armour: 'Plate', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  /*
   * A ONE-HANDER AND A SHIELD, NOT THE SPREADSHEET'S "Fast 2H Mace", and the
   * owner already ruled on this conflict from the other side.
   *
   * `presets.ts` says so in its own words: "The owner's Shockadin set is
   * Azuresong Mageblade and Earth and Fire: a one-hander and a caster shield. A
   * two-hand style deletes the main hand and both off-hand slots, so that set
   * under that style is a Paladin holding nothing." The preset's style was
   * changed FROM `two_hander` for exactly that reason -- and a `twoHand`
   * template then made the same mistake in reverse: `liveEquipment` dropped the
   * two-hander and the Shockadin fought with the PLACEHOLDER weapon, which is
   * the Hemo/Ambush shape again and just as silent.
   *
   * AND THE OWNER HAS RULED ON IT: "We'll leave shockadin as a 1H + Shield
   * build for now." So this is a decision rather than a reading, and the
   * spreadsheet's "2H" column is the part that gave way.
   *
   * THE 2.0 SPEED IS KEPT, because that is the part of the spreadsheet row that
   * is about the build rather than about the slot: a fast weapon is what a
   * Shockadin wants, for the seal that fires per swing. **The question that was
   * open here was whether the owner meant a two-handed STYLE** --
   * Seal of Righteousness is 20% of spell power one-handed against 22%
   * two-handed, so the two readings were not worth the same -- which is why it
   * was raised rather than guessed at. Settled now, and the one-handed 20% is
   * what the Shockadin's seal reads.
   */
  { presetId: 'pally_shockadin', characterClass: 'paladin', label: 'Shockadin', hit: 80, expertise: 0, preferred: ['Crit', 'Spell Power', 'Intellect', 'Strength', 'Stamina', 'Attack Power'], armour: 'Plate', weapons: { kind: 'oneHandShield', subclass: 'Mace', speed: 2.0, caster: true } },
  { presetId: 'prot_pally', characterClass: 'paladin', label: 'Prot Pally', hit: 50, expertise: 20, preferred: PROT_PALLY, armour: 'Plate', weapons: { kind: 'oneHandShield', subclass: 'Mace', caster: true }, trinkets: PROT_PALLY_TRINKETS },
  { presetId: 'bm_hunter', characterClass: 'hunter', label: 'BM Hunter', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Axe', ranged: true } },
  { presetId: 'lw_ranged', characterClass: 'hunter', label: 'LW Ranged', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Axe', ranged: true } },
  { presetId: 'lw_melee', characterClass: 'hunter', label: 'LW Melee', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe', ranged: true } },
  { presetId: 'hawk_melee', characterClass: 'hunter', label: 'Hawk Melee', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe', ranged: true } },
  { presetId: 'warlock_smds', characterClass: 'warlock', label: 'SM/DS', hit: 120, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
  { presetId: 'warlock_firelock', characterClass: 'warlock', label: 'Firelock', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
  { presetId: 'shadow_priest', characterClass: 'priest', label: 'Shadow', characterName: 'Shadow Priest', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true }, statStick: WAND_STICK },
];

export const BENCHMARK_TEMPLATES_BY_PRESET: ReadonlyMap<string, BenchmarkTemplate> = new Map(
  BENCHMARK_TEMPLATES.map((t) => [t.presetId, t] as const),
);

/* -------------------------------------------------------------------------- */
/* Generating a set                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Where the ids live.
 *
 * Two orders of magnitude clear of the highest real item on file (285,281), so
 * a benchmark id is recognisable on sight and can never collide with a capture.
 */
export const BENCHMARK_ID_BASE = 9_500_000;

export { BENCHMARK_SETS };
export type { BenchmarkSet, BenchmarkSetId } from './benchmarkGear';

const toLines = (
  fixed: ReadonlyMap<BenchStat, number>,
  shares: readonly BenchStat[],
  budget: number,
  /**
   * Divide the budget EVENLY rather than by `SHARES`.
   *
   * A trinket carries one line or two and has no "first preference" to
   * express, so the owner's "half item budget on stamina / half on crit" is a
   * 50/50 split -- where the positional table would give 65/35 and
   * `SHARE_WEIGHT` would then halve the crit again.
   */
  even = false,
) => {
  const total = budget ** BUDGET_EXPONENT;
  const amounts = new Map<BenchStat, number>();
  let used = 0;
  for (const [stat, value] of fixed) {
    amounts.set(stat, value);
    used += (value * COST[stat]) ** BUDGET_EXPONENT;
  }

  // WEIGHTED, not the bare positional table: `SHARE_WEIGHT` is what pulls crit
  // back and pushes spell power up, measured against Forever's own items.
  const weights = even ? shares.map(() => 1 / shares.length) : weightedShares(shares);
  const portions = weights.map((weight) => weight * total);

  /*
   * ============================================================================
   * A HIT OR EXPERTISE RATING IS PAID FOR OUT OF CRIT, NOT OUT OF EVERYTHING.
   *
   * THE OWNER'S RULING, and it came from reading the items: "The spell power
   * has been reduced down to +1 spell power on some B55 items in order to
   * account for +25 hit rating. I think it's pulling from the wrong pull
   * so-to-speak. Instead of pull from spell power to get more hit rating, it
   * should be pull from crit rating to get more hit rating. Therefore it keeps
   * the spell power reasonable. (1 spell power is unrealistically low for an
   * item to have)"
   *
   * ----------------------------------------------------------------------------
   * WHAT IT REPLACED: the rating's cost came off the TOTAL before the shares
   * divided anything, so every stat on the slot shrank together -- and at the
   * 3/2 power a slot that has spent most of its budget has almost nothing left
   * to divide, so each share rounded to 0 or 1. Four slots of a B55 caster set
   * read "+25 Hit Rating, +2 Stamina, +1 Spell Power" and carried no crit at
   * all.
   *
   * NOW THE SHARES ARE COMPUTED FROM THE WHOLE BUDGET and the rating's cost is
   * taken from CRIT's portion first, overflowing proportionally into the rest
   * only when crit's share runs out. On a slot carrying no crit at all --
   * which is every tank slot -- that overflow is the whole of it, so the
   * behaviour there is exactly what it was.
   *
   * THE ORDER IS A LIST SO A SECOND DONOR CAN BE ADDED. Crit is the only one
   * today, and it is the one the owner named.
   * ============================================================================
   */
  let owed = used;
  for (const donor of RATING_DONORS) {
    if (owed <= 0) break;
    const index = shares.indexOf(donor);
    if (index < 0) continue;
    const taken = Math.min(owed, portions[index] * RATING_DONOR_SHARE);
    portions[index] -= taken;
    owed -= taken;
  }
  if (owed > 0) {
    const remaining = portions.reduce((sum, portion) => sum + portion, 0);
    const scale = remaining > 0 ? Math.max(0, 1 - owed / remaining) : 0;
    for (let index = 0; index < portions.length; index += 1) portions[index] *= scale;
  }

  shares.forEach((stat, index) => {
    /*
     * FLOOR, NOT ROUND. Rounding to NEAREST sends an item over its own budget
     * whenever the fractional part is above a half -- a B55 neck came out at
     * 18.8 against a budget of 18.3, which is a 2.7% overspend produced purely
     * by `13.7 -> 14`. Flooring costs under a point per stat and makes "fits
     * the budget" true by construction rather than true within a tolerance.
     */
    const points = portions[index] ** (1 / BUDGET_EXPONENT);
    const value = Math.floor(points / COST[stat]);
    if (value > 0) amounts.set(stat, (amounts.get(stat) ?? 0) + value);
  });

  const effects: { kind: string; text: string }[] = [];
  let spent = 0;
  for (const [stat, value] of amounts) {
    if (value <= 0) continue;
    spent += (value * COST[stat]) ** BUDGET_EXPONENT;
    const text = LINE[stat](value);
    effects.push(
      text.startsWith('Equip: ')
        ? { kind: 'Equip', text: text.slice(7) }
        : { kind: 'Stat', text },
    );
  }
  return { effects, spent: spent === 0 ? 0 : spent ** (1 / BUDGET_EXPONENT) };
};

/**
 * The stamina a generated line list came out with.
 *
 * Read back off the TOOLTIP TEXT rather than tracked alongside it, for the same
 * reason the whole generator writes text and parses it: one source of truth. If
 * `LINE.Stamina` ever changes its wording this returns zero and the floor
 * applies on every piece, which is visible -- where a parallel tally would
 * quietly disagree with what the item says.
 */
function staminaIn(effects: readonly { kind: string; text: string }[]): number {
  for (const effect of effects) {
    const match = effect.text.match(/^\+(\d+) Stamina$/);
    if (match) return Number(match[1]);
  }
  return 0;
}

/**
 * THE ORDER A GENERATED TOOLTIP IS WRITTEN IN, which is the owner's.
 *
 * ==============================================================================
 * "Name | Binds when picked up | [Slot] [Armor Class] | [Armor] | [Base
 * Attributes] | [Requirements] | [Rating Stats] | [Procs]"
 *
 * It was the ALLOCATION order before, which is the order the budget happened to
 * spend in -- so a head came out "+19 Stamina, Equip: +23 Critical Strike
 * Rating, +13 Intellect", with a rating in the middle of the attributes. The
 * allocator has no opinion about reading order and should not have one; this is
 * the one place that does.
 *
 * ------------------------------------------------------------------------------
 * `Classes:` IS WRITTEN OUT, which is also the owner's ask -- "I want them to
 * all be ASSIGNED their respective class for that profile". A real tier piece
 * names its class and a template piece now does the same, which is why
 * `BenchmarkTemplate` gained a `characterClass`.
 *
 * IT IS NOT COSMETIC. `classRestrictionsFrom` parses this line back out of the
 * tooltip, so a generated item is class-restricted by the same rule a captured
 * one is -- the generator writes text and the parser reads it, which is the
 * seam this whole file is built on.
 * ==============================================================================
 */
const ATTRIBUTE_LINE = /^\+\d+ (Strength|Agility|Stamina|Intellect|Spirit|Armor)$/;

/**
 * WHAT A BENCHMARK PIECE IS CALLED: "Seal Twist Ret (E65)", "Cat (E75)".
 *
 * ==============================================================================
 * THE OWNER'S FORMAT, replacing "E65 Head" and "B55 Main-Hand Axe". The name
 * now says which BUILD and which SET the piece belongs to, which is the thing a
 * reader cannot work out from anywhere else on the card -- where the SLOT is
 * already on the line below it ("Head  Plate") and in the row's own position in
 * the character pane.
 *
 * SO EVERY PIECE IN ONE SET SHARES A NAME, which is deliberate and costs
 * nothing here: benchmark items are never offered in a picker -- `itemsForSlot`
 * excludes them -- so the only place two of them ever appear together is the
 * character pane, where each sits in its own labelled slot.
 * ==============================================================================
 */
const benchmarkName = (template: BenchmarkTemplate, set: (typeof BENCHMARK_SETS)[number]) =>
  `${template.label} (${set.id})`;

function makeItem(
  id: number,
  name: string,
  set: (typeof BENCHMARK_SETS)[number],
  inventory: string,
  subclass: string | null,
  armor: number | null,
  weapon: GeneratedItem['weapon'],
  effects: readonly { kind: string; text: string }[],
  budget: number,
  spent: number,
  characterClass: ClassId,
  armourClass: ArmourClass,
): GeneratedItem {
  const lines: string[] = [
    name,
    `Item Level ${set.itemLevel}`,
    'Binds when picked up',
    subclass ? `${inventory}\t${subclass}` : inventory,
  ];

  // The item's own physical line: what it swings for, or what it absorbs.
  if (weapon) {
    lines.push(`${weapon.minDamage} - ${weapon.maxDamage} Damage\tSpeed ${weapon.speed.toFixed(2)}`);
    lines.push(`(${weapon.dps.toFixed(1)} damage per second)`);
  }
  if (armor) lines.push(`${armor} Armor`);

  /*
   * A SHIELD'S BLOCK VALUE GOES UNDER ITS ARMOUR, which is the owner's ask and
   * is where the client puts it: "Shield item cards should have block value
   * located under the base armor on the item, not at the bottom of the item
   * card."
   *
   * IT IS NOT A STAT AND NOT A RATING, which is why it fell to the bottom. A
   * shield's "44 Block" is INHERENT to the slot -- free with the item level
   * the way base armour is -- so it belongs with the armour line and not with
   * the things the budget bought.
   */
  const blockLine = effects.find((effect) => /^\d+ Block$/.test(effect.text));
  if (blockLine) lines.push(blockLine.text);

  /*
   * THE BASE ATTRIBUTES, THEN THE REQUIREMENTS, THEN THE RATINGS. Split by
   * SHAPE rather than by the `kind` the allocator tagged them with: a shield's
   * inherent "44 Block" is tagged `Stat` and is not an attribute, and bonus
   * armour is written "+40 Armor" and belongs with them. The pattern is what
   * says which is which.
   */
  const written = effects
    .filter((effect) => effect !== blockLine)
    .map((e) => (e.kind === 'Equip' ? `Equip: ${e.text}` : e.text));
  const attributes = written.filter((line) => ATTRIBUTE_LINE.test(line));
  const rest = written.filter((line) => !ATTRIBUTE_LINE.test(line));

  lines.push(...attributes);
  lines.push(`Classes: ${className(characterClass)}`);
  lines.push(`Requires Level ${MAX_CHARACTER_LEVEL}`);
  lines.push(...rest);

  return {
    id,
    name,
    quality: set.quality,
    icon: benchmarkIcon(inventory, subclass, armourClass),
    source: `SYNTHETIC benchmark gear generated from the itemization budget -- ${set.description}. Not a Forever item.`,
    itemLevel: set.itemLevel,
    inventoryType: inventory,
    subclass,
    armor,
    weapon,
    stats: {},
    resistances: {},
    effects: [...effects],
    tooltip: lines.join('\n'),
    budget,
    spent,
  };
}

function weaponDamage(
  hand: 'oneHand' | 'twoHand' | 'ranged',
  quality: 3 | 4,
  itemLevel: number,
  speed: number,
  caster: boolean,
) {
  const line = WEAPON_DPS[`${hand}|${quality}`];
  const physical = line[0] * itemLevel + line[1];
  const dps = caster ? physical * (CASTER_DPS_SHARE[hand] ?? 1) : physical;
  /*
   * THE DAMAGE RANGE IS THE ITEM AND THE DPS IS DERIVED FROM IT, not the other
   * way round. Rounding min and max to integers moves the dps a little, and
   * `buildItem` cross-checks `(min + max) / 2 / speed` against the stated dps
   * to a tolerance of 0.05 -- so computing the two independently throws on the
   * rounding. Deriving it is also what a real tooltip does.
   */
  const mid = dps * speed;
  const minDamage = Math.round(mid * 0.8);
  const maxDamage = Math.round(mid * 1.2);
  return {
    minDamage,
    maxDamage,
    speed,
    dps: Number(((minDamage + maxDamage) / 2 / speed).toFixed(2)),
    forgone: physical - dps,
  };
}

/** Default swing speeds, which are a presentation choice and not a budget one. */
const SPEED: Readonly<Record<string, number>> = {
  twoHand: 3.6,
  Staff: 3.0,
  oneHand: 2.4,
  Dagger: 1.8,
  ranged: 2.8,
};

/** Every item in one profile's set at one item level. */
export function benchmarkItemsFor(
  template: BenchmarkTemplate,
  set: (typeof BENCHMARK_SETS)[number],
): readonly GeneratedItem[] {
  const base = qualityBase(set.itemLevel, set.quality);
  /*
   * A SLOT ONLY CARRIES A RATING IT CAN AFFORD.
   *
   * Hit costs budget -- the owner's instruction -- and the smallest slots have
   * the least. A neck at item level 55 has a budget of 18.3, so 20 hit rating
   * does not fit in it at all and the item came out 2% over. Filtering the
   * candidate slots by what the rating would cost keeps the set inside its
   * budget AND is the realistic answer: a small slot carries less.
   */
  /*
   * WHAT EACH SLOT CAN CARRY OF A RATING, which replaces two `affords` filters
   * against hard-coded amounts. See `ratingCapacity`: half the slot's budget,
   * so the rest of the item is still an item.
   */
  const capacityOf = (stat: 'Hit' | 'Expertise') => (slot: EquipmentSlot) => {
    // The ranged slot is not in `ARMOUR_SLOTS`; it is the stat stick's, and it
    // takes the ranged multiplier like the weapon it is.
    const slotClass =
      slot === 'ranged' ? 'ranged' : ARMOUR_SLOTS.find((p) => p.slot === slot)?.slotClass;
    if (slotClass === undefined) return 0;
    return ratingCapacity(base * SLOT_MULTIPLIER[slotClass], COST[stat]);
  };

  /*
   * THE RANGED SLOT JOINS THE HIT SPREAD ONLY WHEN THE STAT STICK ASKS FOR IT.
   *
   * The owner's rogue stick is "agility + hit rating", and the template's hit
   * total is ABSOLUTE -- so hit on the stick has to come OUT of that total
   * rather than on top of it, or every Rogue would quietly exceed the cap the
   * owner set. Adding the slot to the spread is what makes it one number.
   *
   * AND ONLY FOR A STICK THAT NAMES HIT: the warriors' is stamina and crit and
   * the casters' is intellect and spell power, and neither should have hit
   * pushed onto it by a spread looking for somewhere to put it.
   */
  const stickWantsHit = template.statStick?.stats.includes('Hit') === true;
  /*
   * THE STICK'S SHARE IS RESERVED RATHER THAN COMPETED FOR, which adding the
   * slot to the spread did not achieve: `spreadRating` fills the largest
   * headroom first and the ranged slot has the SMALLEST budget in the set, so
   * the armour absorbed every point and the Rogue's bow came out with agility
   * and no hit at all -- which is half of what the owner asked for.
   *
   * TAKEN OFF THE TOTAL, not added to it, so the template's hit figure is
   * still the absolute number the owner set.
   */
  const stickHit = stickWantsHit
    ? Math.min(capacityOf('Hit')('ranged'), template.hit)
    : 0;
  const hit = spreadRating(template.hit - stickHit, RATING_SLOTS, capacityOf('Hit'));
  if (stickHit > 0) hit.set('ranged', stickHit);
  /*
   * EXPERTISE GOES ON FROM THE OTHER END and is told what hit already took --
   * without that the two passes can land on one slot and put it over the cap
   * that exists to stop exactly that.
   */
  const expertise = spreadRating(
    template.expertise,
    [...RATING_SLOTS].reverse(),
    capacityOf('Expertise'),
    hit,
  );

  // A stable id per (template, set, slot) so a set is the same every time.
  const templateIndex = BENCHMARK_TEMPLATES.indexOf(template);
  const setIndex = BENCHMARK_SETS.indexOf(set);
  let seq = 0;
  const nextId = () => BENCHMARK_ID_BASE + templateIndex * 400 + setIndex * 100 + seq++;

  const items: GeneratedItem[] = [];

  /*
   * ============================================================================
   * THE TWO TRINKETS, WHICH ARE THE OWNER'S OWN DESIGN.
   *
   * They were the single worst thing in a set: a trinket is a ONE-stat slot and
   * four of the five preference lists open with Crit, so both trinkets bought
   * crit and the trinket multiplier made them the two largest crit sources in
   * the whole set -- **68 rating, 4.9% crit, from two items**.
   *
   * THE OWNER'S RULING IS A PAIR OF ARCHETYPES: "it's expected to see trinkets
   * that have 28 crit rating + a scaling spell power / attack power value. OR
   * pure spell power trinkets", with "a maximum of 28 crit rating (2%) across
   * both trinkets". So the first trinket is the crit-plus-scaling one and the
   * second is the pure one, and the pair carries 28 between them rather than
   * 28 each.
   *
   * ----------------------------------------------------------------------------
   * AND REAL TRINKETS AT THIS ITEM LEVEL CARRY NO PASSIVE STATS AT ALL, which
   * is worth writing down because it is the opposite of what one would guess.
   * Of the 35 real trinkets on file between item level 58 and 72, **35 carry a
   * proc or an on-use effect and 6 carry any engine stat** (dodge, on tank
   * trinkets). A real trinket's contribution is an effect this engine cannot
   * model.
   *
   * So these two are a STAND-IN for that contribution rather than a copy of a
   * real item, and the owner's archetypes are what they should look like. A
   * trinket left empty instead would make every benchmark set quietly weaker
   * than the real thing in two slots.
   *
   * A BUILD THAT DOES NOT WANT CRIT GETS NEITHER ARCHETYPE. The tanks and the
   * Bear name no Crit and no damage stat, so their trinkets keep the stat their
   * preference list leads with -- which is Stamina, and is right.
   * ============================================================================
   */
  const wantsCrit = template.preferred.includes('Crit');
  const damageStat = template.preferred.find(
    (stat) => stat === 'Spell Power' || stat === 'Attack Power',
  );

  /*
   * THE PAIR, DECLARED OR DEFAULTED. Twenty-two builds want the DPS pair and
   * the three tanks declare their own; a build with neither Crit nor a damage
   * stat falls back to the stat its preference list leads with, which is what
   * kept the tanks' trinkets from being blank before they had a plan.
   */
  const trinketPlans: readonly [TrinketPlan, TrinketPlan] = template.trinkets ?? [
    { cappedCrit: wantsCrit, stats: damageStat ? [damageStat] : [] },
    { stats: damageStat ? [damageStat] : [] },
  ];

  let armourIndex = -1;
  for (const plan of ARMOUR_SLOTS) {
    armourIndex += 1;
    const budget = base * SLOT_MULTIPLIER[plan.slotClass];
    const fixed = new Map<BenchStat, number>();

    if (plan.slot === 'trinket1' || plan.slot === 'trinket2') {
      const trinket = trinketPlans[plan.slot === 'trinket1' ? 0 : 1];
      if (trinket.cappedCrit === true) fixed.set('Crit', trinketCrit(budget));
      /*
       * ALWAYS CARRIED, which a ternary here got wrong and the stat report
       * caught: a build with no Crit and no damage stat was passed an EMPTY
       * share list, so both its trinkets came out blank and the set lost 68
       * stamina. A trinket always carries something; what changes is WHAT.
       */
      const carried =
        trinket.stats.length > 0 ? trinket.stats : statsFor(plan, template.preferred);
      const { effects, spent } = toLines(fixed, carried, budget, trinket.even === true);
      items.push(
        makeItem(
          nextId(),
          benchmarkName(template, set),
          set,
          plan.inventory,
          null,
          null,
          null,
          effects,
          budget,
          spent,
          template.characterClass,
          template.armour,
        ),
      );
      continue;
    }

    const h = hit.get(plan.slot);
    if (h) fixed.set('Hit', h);
    const e = expertise.get(plan.slot);
    if (e) fixed.set('Expertise', e);
    /*
     * EVERY ARMOUR-CLASS PIECE CARRIES STAMINA, AS A FLOOR.
     *
     * ------------------------------------------------------------------------
     * `staminaFloor` is the owner's share of the slot's budget, and it applies
     * to the EIGHT armour slots only -- not the cloak, not the jewellery, not a
     * weapon. The owner named those eight, and 93.3% of Forever's own clean
     * armour pieces carry stamina against a generator that dropped it whenever
     * it fell outside a template's stat count.
     *
     * A FLOOR, SO A TANK IS UNTOUCHED. The Bear and both Protection builds lead
     * with stamina and already buy several times this; the two-pass below only
     * intervenes when the preference allocation would come in under it.
     *
     * AND WHEN IT DOES INTERVENE, STAMINA MOVES OUT OF THE SHARE LIST AND INTO
     * `fixed`. Leaving it in both would pay it twice -- the floor plus its own
     * share -- which is the double-count that `toLines` cannot see, because
     * `fixed` is added before the shares are divided and nothing cross-checks
     * the two.
     * ------------------------------------------------------------------------
     */
    const chosen = statsFor(plan, template.preferred, armourIndex);
    let shares = chosen;
    if (!plan.noArmour && plan.slot !== 'cloak') {
      /*
       * CLAMPED BY WHAT THE RATINGS ALREADY TOOK. Hit and expertise are in
       * `fixed` and cost real budget, so the floor has to be what the slot can
       * still afford -- a B55 medium slot carrying 25 Hit Rating has 3% of its
       * budget left and cannot have six stamina on top of it.
       */
      const committed = [...fixed.entries()].reduce(
        (sum, [stat, value]) => sum + (value * COST[stat]) ** BUDGET_EXPONENT,
        0,
      );
      const floor = staminaFloor(budget, committed);
      const firstPass = toLines(fixed, chosen, budget);
      if (floor > 0 && staminaIn(firstPass.effects) < floor) {
        fixed.set('Stamina', floor);
        shares = chosen.filter((stat) => stat !== 'Stamina');
      }
    }

    const { effects, spent } = toLines(fixed, shares, budget);
    const armour = plan.noArmour ? null : baseArmour(plan.inventory, template.armour, set.itemLevel);
    items.push(
      makeItem(
        nextId(),
        benchmarkName(template, set),
        set,
        plan.inventory,
        plan.noArmour ? null : template.armour,
        armour,
        null,
        effects,
        budget,
        spent,
        template.characterClass,
        template.armour,
      ),
    );
  }

  // ---- weapons ----
  const w = template.weapons;
  const caster = w.caster === true;
  const addWeapon = (
    inventory: string,
    hand: 'oneHand' | 'twoHand' | 'ranged',
    slotClass: 'full' | 'oneHand' | 'ranged' | 'light',
    subclass: string,
    speed: number,
  ) => {
    const damage = weaponDamage(hand, set.quality, set.itemLevel, speed, caster && hand !== 'ranged');
    const budget =
      base * SLOT_MULTIPLIER[slotClass] + (caster && hand !== 'ranged' ? damage.forgone * DPS_TO_BUDGET : 0);
    const { effects, spent } = toLines(new Map(), template.preferred.slice(0, 3), budget);
    items.push(
      makeItem(
        nextId(),
        benchmarkName(template, set),
        set,
        inventory,
        subclass,
        null,
        {
          minDamage: damage.minDamage,
          maxDamage: damage.maxDamage,
          speed: damage.speed,
          dps: damage.dps,
        },
        effects,
        budget,
        spent,
        template.characterClass,
        template.armour,
      ),
    );
  };

  if (w.kind === 'twoHand') {
    const speed = w.speed ?? (w.subclass === 'Staff' ? SPEED.Staff : SPEED.twoHand);
    addWeapon('Two-Hand', 'twoHand', 'full', w.subclass, speed);
  } else if (w.kind === 'dualWield') {
    addWeapon('One-Hand', 'oneHand', 'oneHand', w.subclass, SPEED[w.subclass] ?? SPEED.oneHand);
    addWeapon('One-Hand', 'oneHand', 'oneHand', w.offSubclass!, SPEED[w.offSubclass!] ?? SPEED.oneHand);
  } else {
    /*
     * `w.speed` IS HONOURED HERE TOO, and it was not. The field exists for the
     * Shockadin's fast mace and only the two-hand branch read it, so moving
     * that template to a shield build would have silently given it the default
     * 2.4 -- a different weapon from the one the owner specified, in a row
     * whose whole point is the speed.
     */
    addWeapon(
      'One-Hand',
      'oneHand',
      'oneHand',
      w.subclass,
      w.speed ?? SPEED[w.subclass] ?? SPEED.oneHand,
    );
    /*
     * A SHIELD, AND ITS BLOCK VALUE IS FREE RATHER THAN BOUGHT.
     *
     * ------------------------------------------------------------------------
     * THIS USED TO SPEND THE BUDGET ON `Block` AND GOT SIX POINTS. A real
     * Forever shield at item level 65 carries 44, as a STAT line inherent to
     * the slot -- `shieldBlockValue` is that fit, and it is free with the item
     * level exactly as base armour is. The Immovable Object carries 44
     * inherent AND "Equip: +27 Block Value" bought on top, which is what says
     * the two are different kinds of number.
     *
     * SO THE BUDGET BUYS STAMINA AND THE SLOT GIVES THE BLOCK. Six points of
     * block value against 44 was costing the Protection builds their
     * mitigation and, through Shield Slam, their damage.
     * ------------------------------------------------------------------------
     */
    /*
     * THREE STATS, FROM THE BUILD'S OWN PREFERENCES, by the owner's slot
     * table -- "Wrist, Neck, Rings, Shields have 3 stats".
     *
     * It was a hard-coded single `Stamina` line, which was right for a tank by
     * accident and wrong for the Elemental Shaman and the Shockadin: both hold
     * a shield and neither leads with stamina. The shield is a `light` slot
     * like a wrist, so it reads the preference order exactly as one does.
     */
    const shieldBudget = base * SLOT_MULTIPLIER.light;
    const shieldStats = statsFor(
      { slot: 'shield', inventory: 'Off Hand', slotClass: 'light', stats: SHIELD_STATS },
      template.preferred,
    );
    const { effects, spent } = toLines(new Map(), shieldStats, shieldBudget);
    items.push(
      makeItem(
        nextId(),
        benchmarkName(template, set),
        set,
        'Off Hand',
        'Shield',
        Math.round(baseArmour('Chest', template.armour, set.itemLevel) * 3.3),
        null,
        [
          { kind: 'Stat', text: `${shieldBlockValue(set.quality, set.itemLevel)} Block` },
          ...effects,
        ],
        shieldBudget,
        spent,
        template.characterClass,
        template.armour,
      ),
    );
  }

  if (w.ranged) {
    addWeapon('Ranged', 'ranged', 'ranged', 'Bow', SPEED.ranged);
  }

  /*
   * ============================================================================
   * A WEAPON HELD PURELY FOR ITS STATS, in a slot this build never swings.
   *
   * Thirteen templates carry one on the owner's instruction -- a bow for the
   * three Warriors and the four Rogues, a wand for the six casters whose class
   * has the wand proficiency. Only the `ranged` STYLE fires a ranged weapon,
   * so for every one of these the item contributes its stats and no attacks;
   * the melee Hunters already proved the arrangement.
   *
   * AND NEVER BESIDE A REAL BOW. The four Hunters are the only templates with
   * `w.ranged`, and none of them declares a stat stick -- but the guard is
   * here rather than in the declarations, because two items in one slot is the
   * kind of mistake that shows up as one silently replacing the other.
   * ============================================================================
   */
  const stick = template.statStick;
  if (stick && !w.ranged) {
    const budget = base * SLOT_MULTIPLIER.ranged;
    const fixed = new Map<BenchStat, number>();
    const assigned = hit.get('ranged');
    if (assigned) fixed.set('Hit', assigned);
    const shares = stick.stats.filter((stat) => stat !== 'Hit');
    const { effects, spent } = toLines(fixed, shares, budget);
    /*
     * A WAND IS A RANGED WEAPON WITH DAMAGE AND A BOW IS TOO, so both get
     * one -- weapon damage is free with the item level rather than bought, and
     * an item with a damage line and no damage would read as broken on a card.
     */
    const damage = weaponDamage('ranged', set.quality, set.itemLevel, SPEED.ranged, false);
    items.push(
      makeItem(
        nextId(),
        benchmarkName(template, set),
        set,
        'Ranged',
        stick.subclass,
        null,
        {
          minDamage: damage.minDamage,
          maxDamage: damage.maxDamage,
          speed: damage.speed,
          dps: damage.dps,
        },
        effects,
        budget,
        spent,
        template.characterClass,
        template.armour,
      ),
    );
  }

  return items;
}

/** Every benchmark item, for every template and set. */
export const BENCHMARK_ITEMS: readonly GeneratedItem[] = BENCHMARK_TEMPLATES.flatMap((template) =>
  BENCHMARK_SETS.flatMap((set) => benchmarkItemsFor(template, set)),
);

const BY_KEY = new Map<string, readonly GeneratedItem[]>();
for (const template of BENCHMARK_TEMPLATES) {
  for (const set of BENCHMARK_SETS) {
    BY_KEY.set(`${template.presetId}|${set.id}`, benchmarkItemsFor(template, set));
  }
}

/**
 * The equipment a button installs, or undefined if this profile has no template.
 *
 * SLOT BY SLOT FROM THE GENERATED ITEMS, so the Gear panel shows real rows that
 * can be inspected and swapped out one at a time -- the set is a starting
 * point, not a mode the character is in.
 */
export function benchmarkEquipmentFor(
  presetId: string,
  setId: BenchmarkSetId,
  /**
   * WHAT IS ON THE CHARACTER NOW, so its ENCHANTS survive the swap.
   *
   * --------------------------------------------------------------------------
   * THE BUG THIS FIXES: pressing E65 and then E75 built every slot as
   * `{ itemId }` and nothing else, so an enchant applied to a slot was dropped
   * on the floor. The four buttons exist to compare one build at four item
   * levels, and an enchant worth **+2.4 to +53.7 DPS a profile** vanishing
   * between two presses makes exactly that comparison wrong -- and silently,
   * because the Gear panel simply shows an unenchanted slot and nothing says
   * a choice was discarded.
   *
   * AN ENCHANT BELONGS TO THE SLOT HERE, NOT TO THE ITEM, and that is the one
   * place this disagrees with `GearSlotRow`, which drops the enchant when the
   * ITEM in a slot is changed by hand. The difference is what the action
   * means: changing one item is a new item in a slot, and pressing a benchmark
   * button is re-gearing the whole character at a different item level. The
   * owner asked for the enchants to be retained in so many words.
   *
   * THE ENCHANT IS STILL CHECKED AGAINST THE NEW ITEM'S SLOT by the caller's
   * own data -- `enchantsForSlot` is keyed by SLOT and a benchmark set fills
   * the same slots every time, so an enchant carried across is always legal
   * for the slot it lands in.
   * --------------------------------------------------------------------------
   */
  current: Equipment = {},
): Equipment | undefined {
  const items = BY_KEY.get(`${presetId}|${setId}`);
  if (!items) return undefined;
  const equipment: Record<string, { itemId: number; enchantId?: number }> = {};
  const template = BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!;

  /*
   * ONE PLACE THE ENCHANT IS CARRIED ACROSS, rather than six.
   *
   * Every slot below used to be written as its own `{ itemId: item.id }`
   * literal, which is six chances for the next slot to forget -- the same
   * shape as `validateProfile`'s field-by-field rebuild, which dropped
   * `stance` and then dropped `petFamily` underneath the comment recording
   * that it had dropped `stance`.
   */
  const put = (slot: EquipmentSlot, itemId: number) => {
    const enchantId = current[slot]?.enchantId;
    equipment[slot] = enchantId !== undefined ? { itemId, enchantId } : { itemId };
  };

  let armourIndex = 0;
  for (const item of items) {
    if (armourIndex < ARMOUR_SLOTS.length) {
      put(ARMOUR_SLOTS[armourIndex].slot as EquipmentSlot, item.id);
      armourIndex += 1;
      continue;
    }
    const w = template.weapons;
    if (item.inventoryType === 'Two-Hand') put('twoHand', item.id);
    else if (item.inventoryType === 'Ranged') put('ranged', item.id);
    else if (item.subclass === 'Shield') put('shield', item.id);
    else if (!equipment.mainHand) put('mainHand', item.id);
    else if (w.kind === 'dualWield') put('offHand', item.id);
  }
  return equipment as Equipment;
}

export function hasBenchmarkGear(presetId: string | undefined): boolean {
  return presetId !== undefined && BENCHMARK_TEMPLATES_BY_PRESET.has(presetId);
}

/**
 * Templates by the LABEL the character carries, which is how the UI finds one.
 *
 * ----------------------------------------------------------------------------
 * `game` MAY NOT IMPORT FROM `profiles`, so this layer cannot look a preset up
 * and the panel has only the profile in front of it. Every preset sets
 * `character.name` to its own label -- "2H Arms", "Seal Twist Ret" -- and the
 * templates carry the same labels, so the name is the join.
 *
 * IT IS A JOIN ON A STRING A USER CAN EDIT, which is the honest weakness: rename
 * the character and the buttons stop offering a set. That is a visible failure
 * rather than a wrong one, and `benchmarkTemplates.test.ts` pins that all 25
 * labels still match so a renamed PRESET fails the suite instead of the panel.
 * ----------------------------------------------------------------------------
 */
export const BENCHMARK_TEMPLATES_BY_LABEL: ReadonlyMap<string, BenchmarkTemplate> = new Map(
  BENCHMARK_TEMPLATES.map((t) => [t.characterName ?? t.label, t] as const),
);

/** The equipment for a character by its name, or undefined if none matches. */
export function benchmarkEquipmentForName(
  characterName: string,
  setId: BenchmarkSetId,
  /** Carried through so the swap keeps its enchants. See `benchmarkEquipmentFor`. */
  current: Equipment = {},
): Equipment | undefined {
  const template = BENCHMARK_TEMPLATES_BY_LABEL.get(characterName);
  return template ? benchmarkEquipmentFor(template.presetId, setId, current) : undefined;
}

export type { EquipmentSlot };
