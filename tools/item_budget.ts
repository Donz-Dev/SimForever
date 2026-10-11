/**
 * What an item COST to make, under the community itemization-budget model.
 *
 * ----------------------------------------------------------------------------
 * THIS IS AN AUDIT TOOL AND NOTHING READS IT. It prices an item that already
 * exists; it must never be used the other way round, to generate stats for an
 * item the sources do not state. That would be inventing game data with extra
 * arithmetic in front of it -- the budget model is a community
 * RECONSTRUCTION, it is not Forever's, it is not even Blizzard's, and the
 * figures below reproduce real Classic items to about +/-5% rather than
 * exactly. See `docs/itemization.md`.
 *
 * The model, from <https://wow.allakhazam.com/wiki/Itemization_Formulas_(wow)>:
 *
 *     budget   = qualityBase(itemLevel) * slotMultiplier
 *     budget^1.5 = sum over stats of (value * statCost)^1.5
 *
 * The 3/2 power is what makes a single large stat cost more than the same
 * total spread over several -- which is why a +40 spell damage ring is a ring
 * with nothing else on it.
 * ----------------------------------------------------------------------------
 *
 *     npx vite-node tools/item_budget.ts              # the ten reference items, then all 151 on file
 *     ITEM=226562 npx vite-node tools/item_budget.ts  # one item on file, itemised
 *     REFERENCE=1 npx vite-node tools/item_budget.ts  # the reference items alone, itemised
 *     FOREVER=1 npx vite-node tools/item_budget.ts    # the 64 Premier PvP cloth pieces, Forever's own data
 *     WEAPONS=1 npx vite-node tools/item_budget.ts    # the 41 new Forever epic weapons
 */
import { ITEMS, ITEMS_BY_ID } from '../src/game/items/itemData';
import type { Item } from '../src/game/items/Item';
import type { StatName } from '../src/engine';
import {
  CLASSIC_FITTED_DPS_ILVL65,
  FOREVER_BUILD,
  FOREVER_CAPTURED_ON,
  CLASSIC_CONTROL_ITEMS,
  FOREVER_ITEMS,
  FOREVER_NEW_ITEMS,
  FOREVER_PHYSICAL_DPS_ILVL65,
  FOREVER_PVP_CLOTH,
  FOREVER_STAT_COST,
  FOREVER_WEAPONS,
  priceableStats,
  type ForeverRawItem,
} from './foreverItems';

/* -------------------------------------------------------------------------- */
/* The model                                                                  */
/* -------------------------------------------------------------------------- */

/** The exponent every cost is raised to before being summed. */
const BUDGET_EXPONENT = 1.5;

/**
 * Budget before the slot multiplier, by quality.
 *
 * Quality 2 is green, 3 blue, 4 epic. Nothing on file is quality 5.
 */
function qualityBase(itemLevel: number, quality: number): number | undefined {
  switch (quality) {
    case 2:
      return 0.5 * itemLevel - 2;
    case 3:
      return 0.625 * itemLevel - 1.15;
    case 4:
    case 5:
      return 0.77 * itemLevel - 1;
    default:
      return undefined;
  }
}

/**
 * The slot's share of a full budget.
 *
 * Keyed by the page's own categories rather than by `EquipmentSlot`, because a
 * weapon's multiplier follows the HAND it needs and not the slot it is stored
 * in: a one-hander is 0.42 whichever hand holds it, and `twoHand` is a slot in
 * this model only because the combat style decides between the two.
 */
const SLOT_MULTIPLIER = {
  full: 1.0, // head, chest, legs, two-hander
  medium: 0.77, // shoulders, gloves, feet, waist
  trinket: 0.7,
  light: 0.55, // wrists, neck, rings, cloak, shield, held-in-off-hand
  oneHand: 0.42,
  ranged: 0.3,
} as const;

type SlotClass = keyof typeof SLOT_MULTIPLIER;

function slotClassOf(item: Item): SlotClass | undefined {
  const slot = item.slots[0];
  // A weapon is priced by the hand it needs, so this is asked first.
  if (item.weapon) {
    if (slot === 'ranged') return 'ranged';
    if (slot === 'twoHand') return 'full';
    return 'oneHand';
  }
  switch (slot) {
    case 'head':
    case 'chest':
    case 'legs':
    case 'twoHand':
      return 'full';
    case 'shoulders':
    case 'gloves':
    case 'feet':
    case 'waist':
      return 'medium';
    case 'trinket1':
    case 'trinket2':
      return 'trinket';
    case 'wrists':
    case 'neck':
    case 'ring1':
    case 'ring2':
    case 'cloak':
    case 'shield':
    case 'offHand':
      return 'light';
    // A relic has no entry in the source and nothing here guesses one.
    default:
      return undefined;
  }
}

/**
 * Budget points per point of a stat, AS THE SOURCE STATES THEM.
 *
 * Everything in here is transcribed. Anything the source does not price is in
 * `CALIBRATED_COST` below, apart, so a reader can tell the two kinds of number
 * apart without going to the docs.
 */
const SOURCED_COST: Partial<Record<StatName, number>> = {
  strength: 1,
  agility: 1,
  intellect: 1,
  spirit: 1,
  stamina: 0.67,
  attackPower: 0.5,
  rangedAttackPower: 0.4,
  /** School-blind "+N damage and healing done by magical spells". */
  spellPower: 0.86,
  manaPer5: 2.5,
  blockValue: 0.65,
  /** ARMOR ABOVE THE SLOT'S BASELINE ONLY -- see `bonusArmorOf`. */
  armor: 0.1,
};

/** "Increases damage done by Shadow spells", which is cheaper than school-blind. */
const SCHOOL_POWER_COST = 0.7;

/** One school of resistance. The source gives 2.5 for all schools at once. */
const RESISTANCE_COST = 1;


/**
 * Budget points per point of a stat the source does NOT price, FITTED HERE.
 *
 * ----------------------------------------------------------------------------
 * NOT TRANSCRIBED AND NOT INVENTED: each of these is solved out of real items
 * whose every OTHER stat the source prices, by taking the budget the item has
 * left over. The evidence and the spread are recorded per entry, because a
 * figure fitted from four items is a different kind of claim from one fitted
 * from one, and the docs say which rows of this tool's output can be leaned on.
 *
 * Vanilla has no ratings, so "+1% crit" is a flat percentage and the source's
 * blanket "any rating costs 1" cannot be what it means.
 * ----------------------------------------------------------------------------
 */
const CALIBRATED_COST: Partial<Record<StatName, number>> = {
  /**
   * 16 per 1%. Quick Strike Ring solves 16.11 on its own (its only other
   * stats are strength, stamina and attack power); the Season of Discovery
   * Arcanist Crown solves 15.0; a two-parameter least squares over the four
   * reference items carrying crit or hit lands on 16.75.
   */
  critChance: 16,
  /**
   * 10 per 1%, AND THIS IS THE LOOSEST FIGURE HERE. The two reference items
   * where hit is the only unknown disagree -- Wristguards of True Flight
   * solves 12.28 and Striker's Mark 8.66 -- so the band is 8.7 to 12.3 and 10
   * is the middle of it, not a reproduction of anything.
   */
  hitChance: 10,
  /**
   * 16 per 1%, ASSUMED EQUAL TO MELEE CRIT AND NOT MEASURED. No reference item
   * carries spell crit as its only unknown: the two that carry it at all are
   * caster weapons, where the DPS trade swamps everything (see
   * `docs/itemization.md`).
   */
  spellCritChance: 16,
  /**
   * 2.5 per point of defense skill, and the firmest of the fitted figures:
   * the five Cenarion tank pieces solve 2.34, 2.55, 2.59, 2.59 and 2.63, each
   * from an item whose other five stats are all sourced.
   */
  defenseSkill: 2.5,
  /**
   * 6 per 1% block CHANCE, from Breastplate of Might alone, and it rests on
   * defense skill being 2.5 -- the two unknowns sit on the same item.
   */
  blockChance: 6,
};

/* -------------------------------------------------------------------------- */
/* Weapon DPS: a line, not a budget line                                      */
/* -------------------------------------------------------------------------- */

/**
 * The damage per second an epic weapon of this hand carries at an item level.
 *
 * ----------------------------------------------------------------------------
 * FITTED HERE, from the real weapons -- and the fit is tight enough that it is
 * not really a fit: ten epic one-handers between item level 66 and 77 sit on
 * one straight line with a WORST residual of 0.31 dps, eight two-handers
 * within 0.61, and four ranged weapons within 0.02. So weapon DPS is not
 * bought out of the item's budget at all; it comes with the item level and the
 * hand, the way base armor comes with the slot.
 *
 * WHAT IS BUDGETED IS GIVING IT UP. A caster one-hander sits BELOW its line
 * and spends the difference on stats, which is the whole reason Azuresong
 * Mageblade prices at twice a one-hander's budget while Zin'rokh -- exactly on
 * its line -- prices under one. Two Classic caster one-handers put the
 * exchange at about 2.5 budget points per dps forgone (Azuresong 2.33,
 * Lok'amir il Romathis 2.71), and TWO ITEMS IS NOT A CALIBRATION: the tool
 * prints the shortfall and the implied rate rather than correcting the budget
 * by it, because correcting would hide the one number this model does not
 * have.
 *
 * STAVES ARE NOT ON THE TWO-HAND LINE AND CANNOT BE CHECKED. Every staff in
 * this data -- Benediction, Anathema, Staff of Dominance -- is a caster staff,
 * so there is no physical staff to establish the line they fall short of, and
 * a staff's shortfall is measured against a line fitted from axes, maces,
 * swords and a polearm. Treated as indicative, not as a figure.
 * ----------------------------------------------------------------------------
 */
const DPS_BASELINE: Readonly<Record<'oneHand' | 'full' | 'ranged', { slope: number; intercept: number }>> = {
  // 10 weapons, worst residual 0.31 dps.
  oneHand: { slope: 0.9645, intercept: -15.88 },
  // 8 weapons, worst residual 0.61 dps. Axes, maces, swords and a polearm.
  full: { slope: 1.2686, intercept: -21.507 },
  // 4 weapons, worst residual 0.02 dps.
  ranged: { slope: 0.7475, intercept: -11.983 },
};

function dpsBaseline(slotClass: SlotClass | undefined, itemLevel: number): number | undefined {
  if (slotClass !== 'oneHand' && slotClass !== 'full' && slotClass !== 'ranged') return undefined;
  const line = DPS_BASELINE[slotClass];
  return line.slope * itemLevel + line.intercept;
}

/* -------------------------------------------------------------------------- */
/* Armor: the baseline is free and only the excess is budgeted                */
/* -------------------------------------------------------------------------- */

/**
 * The armor an item of this slot, armor type and item level carries for free.
 *
 * ----------------------------------------------------------------------------
 * DERIVED FROM THE ITEMS ON FILE, not from a source, and it is derived rather
 * than transcribed on purpose: the data settles it. Every ilvl-66 plate chest
 * on file is 749 armor and every ilvl-66 cloth head is 83, so base armor is a
 * function of (slot, type, item level) and no item pays for it.
 *
 * It also cannot be paid for. Breastplate of Might's 749 armor at the sourced
 * cost of 0.1 is 74.9 points, and 74.9^1.5 is 648 against a whole chest budget
 * of 352 -- so base armor being budgeted is arithmetically impossible, which
 * is a stronger argument than the pattern.
 *
 * What IS budgeted is the excess, and five Cenarion pieces show it plainly:
 * the standard ilvl-66 leather shoulder is 150 and Cenarion Pauldrons carry
 * 270, the extra 120 arriving beside "Increased Defense +7".
 *
 * The minimum in each (slot, type, item level) group is taken as the baseline.
 * A group of one cannot be separated, so its item is reported as all-base and
 * FLAGGED -- which is the honest answer rather than a guess in either
 * direction.
 * ----------------------------------------------------------------------------
 */
const armorGroupKey = (item: Item) =>
  `${item.slots[0]}|${item.weapon?.subclass ?? armorTypeOf(item)}|${item.itemLevel}`;

/** An armor item's type, read off the tooltip's own `Head Cloth` line. */
function armorTypeOf(item: Item): string {
  const match = /\n(?:Head|Shoulder|Chest|Wrist|Hands|Waist|Legs|Feet|Back|Off Hand) (Cloth|Leather|Mail|Plate|Shield)/.exec(
    item.tooltip,
  );
  return match?.[1] ?? '-';
}

const ARMOR_BASELINE = new Map<string, { base: number; samples: number }>();
for (const item of ITEMS) {
  const armor = item.stats.armor ?? 0;
  if (armor <= 0) continue;
  const key = armorGroupKey(item);
  const seen = ARMOR_BASELINE.get(key);
  if (!seen) ARMOR_BASELINE.set(key, { base: armor, samples: 1 });
  else ARMOR_BASELINE.set(key, { base: Math.min(seen.base, armor), samples: seen.samples + 1 });
}

interface ArmorSplit {
  readonly base: number;
  readonly bonus: number;
  /** True when the group had one member, so the split is an assumption. */
  readonly unseparable: boolean;
}

function bonusArmorOf(item: Item): ArmorSplit {
  const armor = item.stats.armor ?? 0;
  if (armor <= 0) return { base: 0, bonus: 0, unseparable: false };
  const group = ARMOR_BASELINE.get(armorGroupKey(item));
  if (!group) return { base: armor, bonus: 0, unseparable: true };
  return { base: group.base, bonus: armor - group.base, unseparable: group.samples < 2 };
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

interface Line {
  readonly label: string;
  readonly value: number;
  readonly cost: number;
  readonly points: number;
  /** `sourced`, `fitted`, or `free` for something the budget does not pay for. */
  readonly kind: 'sourced' | 'fitted' | 'free';
}

interface Pricing {
  readonly name: string;
  readonly itemLevel: number;
  readonly slotClass: SlotClass | undefined;
  readonly budget: number | undefined;
  readonly lines: readonly Line[];
  /** Stats with no cost either source gives. */
  readonly unpriced: readonly string[];
  /** Effects the item carries that no budget here can price. */
  readonly notes: readonly string[];
}

/**
 * What to say about a weapon, which the stat budget alone cannot explain.
 *
 * A weapon on its DPS line has only its stats to account for; one below the
 * line has bought stats with the difference, and the rate it got is the one
 * number this model is missing.
 */
function weaponNote(
  dps: number,
  slotClass: SlotClass | undefined,
  itemLevel: number,
  lines: readonly Line[],
  budget: number | undefined,
): string {
  const baseline = dpsBaseline(slotClass, itemLevel);
  if (baseline === undefined) return `weapon ${dps.toFixed(2)} dps -- no baseline for this hand`;
  const shortfall = baseline - dps;
  const head = `weapon ${dps.toFixed(2)} dps against a baseline ${baseline.toFixed(2)} (${
    shortfall >= 0 ? `${shortfall.toFixed(2)} short` : `${(-shortfall).toFixed(2)} over`
  })`;
  if (budget === undefined || shortfall <= 0.5) return head;
  const over = spend(lines).implied - budget;
  if (over <= 0) return `${head} -- and still inside its stat budget`;
  return `${head} -- the ${over.toFixed(2)} budget it is over by is ${(over / shortfall).toFixed(
    2,
  )} points per dps forgone`;
}

/**
 * ONE TOOLTIP LINE IS ONE BUDGET LINE, even when the engine splits it in two.
 *
 * ----------------------------------------------------------------------------
 * "Improves your chance to get a critical strike with all spells and attacks
 * by 1%" is a single thing the item sells, and `itemData` correctly turns it
 * into BOTH `critChance` and `spellCritChance`, because two different tables
 * read them. Pricing the resolved stats naively therefore charges that line
 * twice -- which took the Season of Discovery Arcanist Crown from 101% of its
 * budget to 113%, and that wording is on sixty-two lines in this data, so the
 * whole on-file table was reading high for a reason that has nothing to do
 * with itemization.
 *
 * The overlap is removed rather than either half, because which stat is "the
 * real one" is not a question the budget asks.
 * ----------------------------------------------------------------------------
 */
const COMBINED_CRIT =
  /Improves your chance to get a critical strike with all spells and attacks by (\d+)%/;

function combinedCritOf(item: Item): number {
  const match = COMBINED_CRIT.exec(item.tooltip);
  if (!match) return 0;
  const value = Number(match[1]);
  return Math.min(value, item.stats.critChance ?? 0, item.stats.spellCritChance ?? 0);
}

function price(item: Item): Pricing {
  const slotClass = slotClassOf(item);
  const base = qualityBase(item.itemLevel, item.quality);
  const budget =
    slotClass !== undefined && base !== undefined ? base * SLOT_MULTIPLIER[slotClass] : undefined;

  const lines: Line[] = [];
  const unpriced: string[] = [];
  const notes: string[] = [];

  const combinedCrit = combinedCritOf(item);
  if (combinedCrit > 0) {
    notes.push(
      `"critical strike with all spells and attacks by ${combinedCrit}%" priced once, not twice`,
    );
  }

  for (const [name, rawValue] of Object.entries(item.stats) as [StatName, number][]) {
    // The spell half of a combined crit line is the same purchase as the
    // melee half, so it is removed before pricing rather than charged again.
    const value = name === 'spellCritChance' ? rawValue - combinedCrit : rawValue;
    if (!value) continue;
    if (name === 'armor') {
      const split = bonusArmorOf(item);
      if (split.base > 0) {
        lines.push({ label: 'armor (base)', value: split.base, cost: 0, points: 0, kind: 'free' });
      }
      if (split.bonus > 0) {
        const cost = SOURCED_COST.armor!;
        lines.push({
          label: 'armor (bonus)',
          value: split.bonus,
          cost,
          points: split.bonus * cost,
          kind: 'sourced',
        });
      }
      if (split.unseparable) {
        notes.push('only item of its slot/type/level on file -- armor taken as all base');
      }
      continue;
    }
    const sourced = SOURCED_COST[name];
    const fitted = CALIBRATED_COST[name];
    const cost = sourced ?? fitted;
    if (cost === undefined) {
      unpriced.push(`${name} ${value}`);
      continue;
    }
    lines.push({
      label: name,
      value,
      cost,
      points: value * cost,
      kind: sourced !== undefined ? 'sourced' : 'fitted',
    });
  }

  for (const [school, power] of Object.entries(item.schoolPower)) {
    if (!power) continue;
    lines.push({
      label: `${school} spell power`,
      value: power,
      cost: SCHOOL_POWER_COST,
      points: power * SCHOOL_POWER_COST,
      kind: 'sourced',
    });
  }

  for (const [school, amount] of Object.entries(item.resistances)) {
    if (!amount) continue;
    lines.push({
      label: `${school} resistance`,
      value: amount,
      cost: RESISTANCE_COST,
      points: amount * RESISTANCE_COST,
      kind: 'sourced',
    });
  }

  if (item.weapon) {
    notes.push(weaponNote(item.weapon.dps, slotClass, item.itemLevel, lines, budget));
  }
  for (const effect of item.unmodelled) {
    notes.push(`unpriced: ${effect.kind}: ${effect.text}`);
  }
  for (const [style, stats] of Object.entries(item.styleStats)) {
    notes.push(`unpriced: ${style}-only ${JSON.stringify(stats)}`);
  }

  return { name: item.name, itemLevel: item.itemLevel, slotClass, budget, lines, unpriced, notes };
}

/** The 3/2-power sum, and the budget it implies. */
function spend(lines: readonly Line[]): { sum: number; implied: number } {
  const sum = lines.reduce(
    (total, line) => total + (line.points > 0 ? line.points ** BUDGET_EXPONENT : 0),
    0,
  );
  return { sum, implied: sum === 0 ? 0 : sum ** (1 / BUDGET_EXPONENT) };
}

/* -------------------------------------------------------------------------- */
/* The ten reference items                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Original-Classic items, transcribed from their Wowhead tooltips.
 *
 * ----------------------------------------------------------------------------
 * THE VERIFICATION SET, and they are here rather than in `src/data/items/`
 * because nothing simulates them -- the project's own files hold the Season of
 * Discovery re-itemizations of several of these names, at the same item level
 * and with DIFFERENT stats, which is itself worth knowing. Arcanist Crown is
 * 16 stamina / 27 intellect / 10 spirit / 20 spell power in Classic and
 * 11 stamina / 18 intellect / 35 spell power in Season of Discovery.
 *
 * Each row is a `PartialStats`-shaped literal so it prices through exactly the
 * same code as a real item, and each carries its source URL.
 * ----------------------------------------------------------------------------
 */
interface Reference {
  readonly id: number;
  readonly name: string;
  readonly itemLevel: number;
  readonly slotClass: SlotClass;
  readonly stats: Partial<Record<StatName, number>>;
  readonly schoolPower?: Readonly<Record<string, number>>;
  readonly resistances?: Readonly<Record<string, number>>;
  /** Armor the slot gives for free, so it is excluded rather than forgotten. */
  readonly baseArmor?: number;
  readonly dps?: number;
  readonly notes?: readonly string[];
}

const REFERENCE_ITEMS: readonly Reference[] = [
  {
    id: 19854,
    name: "Zin'rokh, Destroyer of Worlds",
    itemLevel: 68,
    slotClass: 'full',
    stats: { stamina: 28, attackPower: 72 },
    dps: 64.61,
  },
  {
    id: 17103,
    name: 'Azuresong Mageblade',
    itemLevel: 71,
    slotClass: 'oneHand',
    stats: { stamina: 7, intellect: 12, spellPower: 40, spellCritChance: 1 },
    dps: 42.5,
  },
  {
    id: 16795,
    name: 'Arcanist Crown',
    itemLevel: 66,
    slotClass: 'full',
    stats: { stamina: 16, intellect: 27, spirit: 10, spellPower: 20, hitChance: 1 },
    resistances: { fire: 10 },
    baseArmor: 83,
    notes: ['its 1% hit is SPELL hit; priced at the melee figure for want of another'],
  },
  {
    id: 16865,
    name: 'Breastplate of Might',
    itemLevel: 66,
    slotClass: 'full',
    stats: { strength: 20, stamina: 28, blockChance: 3, defenseSkill: 7 },
    resistances: { fire: 10 },
    baseArmor: 749,
  },
  {
    id: 19325,
    name: "Don Julio's Band",
    itemLevel: 65,
    slotClass: 'light',
    stats: { stamina: 11, attackPower: 16, critChance: 1, hitChance: 1 },
  },
  {
    id: 18821,
    name: 'Quick Strike Ring',
    itemLevel: 67,
    slotClass: 'light',
    stats: { strength: 5, stamina: 8, attackPower: 30, critChance: 1 },
  },
  {
    id: 19147,
    name: 'Ring of Spell Power',
    itemLevel: 66,
    slotClass: 'light',
    stats: { spellPower: 33 },
  },
  {
    id: 17069,
    name: "Striker's Mark",
    itemLevel: 69,
    slotClass: 'ranged',
    // "+22 Attack Power", not ranged attack power -- the item says melee.
    stats: { attackPower: 22, hitChance: 1 },
    dps: 39.6,
  },
  {
    id: 18812,
    name: 'Wristguards of True Flight',
    itemLevel: 71,
    slotClass: 'light',
    stats: { agility: 19, stamina: 11, intellect: 6, hitChance: 1 },
    baseArmor: 198,
  },
  {
    id: 23219,
    name: 'Girdle of the Mentor',
    itemLevel: 85,
    slotClass: 'medium',
    stats: { strength: 21, agility: 20, stamina: 21, critChance: 1, hitChance: 1 },
    baseArmor: 536,
  },
];

function priceReference(ref: Reference): Pricing {
  const lines: Line[] = [];
  const unpriced: string[] = [];
  const notes: string[] = [...(ref.notes ?? [])];

  if (ref.baseArmor) {
    lines.push({ label: 'armor (base)', value: ref.baseArmor, cost: 0, points: 0, kind: 'free' });
  }
  for (const [name, value] of Object.entries(ref.stats) as [StatName, number][]) {
    if (!value) continue;
    const sourced = SOURCED_COST[name];
    const fitted = CALIBRATED_COST[name];
    const cost = sourced ?? fitted;
    if (cost === undefined) {
      unpriced.push(`${name} ${value}`);
      continue;
    }
    lines.push({
      label: name,
      value,
      cost,
      points: value * cost,
      kind: sourced !== undefined ? 'sourced' : 'fitted',
    });
  }
  for (const [school, power] of Object.entries(ref.schoolPower ?? {})) {
    lines.push({
      label: `${school} spell power`,
      value: power,
      cost: SCHOOL_POWER_COST,
      points: power * SCHOOL_POWER_COST,
      kind: 'sourced',
    });
  }
  for (const [school, amount] of Object.entries(ref.resistances ?? {})) {
    lines.push({
      label: `${school} resistance`,
      value: amount,
      cost: RESISTANCE_COST,
      points: amount * RESISTANCE_COST,
      kind: 'sourced',
    });
  }
  if (ref.dps !== undefined) {
    notes.push(
      weaponNote(
        ref.dps,
        ref.slotClass,
        ref.itemLevel,
        lines,
        qualityBase(ref.itemLevel, 4)! * SLOT_MULTIPLIER[ref.slotClass],
      ),
    );
  }
  return {
    name: ref.name,
    itemLevel: ref.itemLevel,
    slotClass: ref.slotClass,
    budget: qualityBase(ref.itemLevel, 4)! * SLOT_MULTIPLIER[ref.slotClass],
    lines,
    unpriced,
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Output                                                                     */
/* -------------------------------------------------------------------------- */

const pad = (text: string, width: number) => text.padEnd(width);
const num = (value: number, width: number, places = 1) =>
  value.toFixed(places).padStart(width);

function row(pricing: Pricing): string {
  const { sum, implied } = spend(pricing.lines);
  if (pricing.budget === undefined) {
    return `${pad(pricing.name, 34)}${num(pricing.itemLevel, 5, 0)}  ${pad(
      pricing.slotClass ?? 'unknown slot',
      9,
    )}  -- no budget for this slot --`;
  }
  const used = (implied / pricing.budget) * 100;
  const flags = [
    pricing.unpriced.length > 0 ? `unpriced:${pricing.unpriced.length}` : '',
    pricing.notes.some((note) => note.includes('dps')) ? 'weapon' : '',
    pricing.notes.some((note) => note.startsWith('unpriced:')) ? 'effects' : '',
  ].filter(Boolean);
  return (
    pad(pricing.name, 34) +
    num(pricing.itemLevel, 5, 0) +
    '  ' +
    pad(pricing.slotClass ?? '?', 9) +
    num(pricing.budget, 8, 2) +
    num(implied, 9, 2) +
    num(used, 8, 1) +
    '%  ' +
    flags.join(' ') +
    (sum === 0 ? '  (nothing priced)' : '')
  );
}

const HEADER =
  pad('item', 34) + pad('ilvl', 5) + '  ' + pad('slot', 9) + pad('budget', 8) + pad('   spent', 9) + '    used';

function itemise(pricing: Pricing): void {
  const { implied } = spend(pricing.lines);
  console.log(`\n${pricing.name} -- item level ${pricing.itemLevel}, ${pricing.slotClass} slot`);
  if (pricing.budget !== undefined) {
    console.log(
      `  budget ${pricing.budget.toFixed(2)}  ->  ${(pricing.budget ** BUDGET_EXPONENT).toFixed(1)} at the 3/2 power`,
    );
  }
  for (const line of pricing.lines) {
    const contribution = line.points > 0 ? line.points ** BUDGET_EXPONENT : 0;
    console.log(
      `    ${pad(line.label, 24)}${num(line.value, 6, 0)} x ${line.cost.toFixed(2)} = ${num(
        line.points,
        7,
        2,
      )} pts -> ${num(contribution, 8, 1)}   ${line.kind}`,
    );
  }
  if (pricing.budget !== undefined) {
    console.log(
      `  spent ${implied.toFixed(2)} of ${pricing.budget.toFixed(2)} = ${(
        (implied / pricing.budget) *
        100
      ).toFixed(1)}%`,
    );
  }
  for (const note of pricing.notes) console.log(`  ! ${note}`);
  for (const stat of pricing.unpriced) console.log(`  ! no cost for ${stat}`);
}

function summarise(rows: readonly Pricing[], label: string): void {
  const clean = rows.filter(
    (pricing) =>
      pricing.budget !== undefined &&
      pricing.unpriced.length === 0 &&
      pricing.notes.length === 0 &&
      spend(pricing.lines).sum > 0,
  );
  if (clean.length === 0) return;
  const used = clean
    .map((pricing) => (spend(pricing.lines).implied / pricing.budget!) * 100)
    .sort((a, b) => a - b);
  const mean = used.reduce((total, value) => total + value, 0) / used.length;
  console.log(
    `\n${label}: ${clean.length} items with every stat priced and nothing else on them -- ` +
      `mean ${mean.toFixed(1)}%, median ${used[Math.floor(used.length / 2)].toFixed(1)}%, ` +
      `range ${used[0].toFixed(1)}% to ${used[used.length - 1].toFixed(1)}%`,
  );
}

/* -------------------------------------------------------------------------- */
/* Forever's own data, read from src/data/items/forever-new-epics.json        */
/* -------------------------------------------------------------------------- */

const FOREVER_SLOT_CLASS: Readonly<Record<string, SlotClass>> = {
  Head: 'full',
  Chest: 'full',
  Legs: 'full',
  'Two-Hand': 'full',
  Shoulder: 'medium',
  Hands: 'medium',
  Waist: 'medium',
  Feet: 'medium',
  Wrist: 'light',
  Back: 'light',
  Neck: 'light',
  Finger: 'light',
  Shield: 'light',
  'Held In Off-hand': 'light',
  Trinket: 'trinket',
  'One-Hand': 'oneHand',
  'Main Hand': 'oneHand',
  'Off Hand': 'oneHand',
  Ranged: 'ranged',
};

/** The four weapons the PvP-against-not table shows, one per comparison. */
const SHOWN_PVP_WEAPONS = new Set([
  "Premier High Warlord's Blade",
  "Premier High Warlord's Battle Axe",
  "Premier High Warlord's Recurve",
  "Premier High Warlord's Destroyer",
]);

/**
 * Price a Forever item on the CLASSIC costs, deliberately unadjusted.
 *
 * The question these items answer is whether Forever itemizes to Classic's
 * budget, so pricing them with anything fitted TO them would assume the answer.
 */
function priceForeverItem(item: ForeverRawItem): Pricing {
  const key = item.subclass === 'Shield' ? 'Shield' : item.inventoryType;
  const slotClass = FOREVER_SLOT_CLASS[key];
  const budget =
    slotClass === undefined
      ? undefined
      : qualityBase(item.itemLevel, 4)! * SLOT_MULTIPLIER[slotClass];
  const { stats, unpriced, setBonuses } = priceableStats(item);

  const lines: Line[] = [];
  const notes: string[] = [];
  if (item.armor) {
    lines.push({
      label: 'armor (total; base is free)',
      value: item.armor,
      cost: 0,
      points: 0,
      kind: 'free',
    });
  }
  for (const [name, value] of Object.entries(stats)) {
    const cost = FOREVER_STAT_COST[name];
    if (cost === undefined) continue;
    lines.push({ label: name, value, cost, points: value * cost, kind: 'sourced' });
  }
  if (item.weapon) {
    const physical = FOREVER_PHYSICAL_DPS_ILVL65[item.inventoryType];
    if (physical !== undefined) {
      const short = physical - item.weapon.dps;
      notes.push(
        short > 0.5
          ? `weapon ${item.weapon.dps.toFixed(1)} dps, ${short.toFixed(1)} below the ${physical.toFixed(1)} this hand carries`
          : `weapon ${item.weapon.dps.toFixed(1)} dps, on the line`,
      );
    }
  }
  if (setBonuses > 0) notes.push(`${setBonuses} set bonuses, which the budget does not price`);
  for (const line of unpriced) notes.push(`unpriced: ${line}`);

  return {
    name: item.name,
    itemLevel: item.itemLevel,
    slotClass,
    budget,
    lines,
    unpriced: [],
    notes,
  };
}

/**
 * An item the budget can see ENTIRELY.
 *
 * A proc, an on-use or a set bonus costs budget the model cannot price, so the
 * item reads LOW through no fault of the ruleset -- and Classic epics are full
 * of them. Mixing them into a mean is what made the first comparison of
 * Forever against Classic meaningless.
 */
function isClean(item: ForeverRawItem): boolean {
  const { unpriced, setBonuses } = priceableStats(item);
  return unpriced.length === 0 && setBonuses === 0;
}

/** Mean, spread and count for a group, which is how every row below reads. */
function foreverSummary(label: string, items: readonly ForeverRawItem[]): void {
  const priced = items
    .map(priceForeverItem)
    .filter((p): p is Pricing & { budget: number } => p.budget !== undefined)
    .filter((p) => spend(p.lines).sum > 0);
  if (priced.length === 0) return;
  const used = priced.map((p) => (spend(p.lines).implied / p.budget) * 100);
  const mean = used.reduce((a, b) => a + b, 0) / used.length;
  const sd = Math.sqrt(used.reduce((a, b) => a + (b - mean) ** 2, 0) / used.length);
  console.log(
    `${pad(label, 32)} n=${String(priced.length).padStart(3)}  mean ${num(mean, 6, 1)}%  ` +
      `sd ${num(sd, 5, 1)}  range ${num(Math.min(...used), 6, 1)}% to ${num(Math.max(...used), 6, 1)}%`,
  );
}

function foreverReport(): void {
  console.log(
    `FOREVER ITEMS ON FILE -- beta build ${FOREVER_BUILD}, captured ${FOREVER_CAPTURED_ON}`,
  );
  console.log(`${FOREVER_ITEMS.length} items, priced on CLASSIC costs`);
  console.log('');

  console.log("THE CONTROL FIRST. These are CLASSIC's own epics, which Forever changed only");
  console.log("in wording -- so their stats ARE Classic's, priced through the same model.");
  console.log('Any shortfall here is the MODEL, not the ruleset.\n');
  foreverSummary("CLASSIC's own epics (the control)", CLASSIC_CONTROL_ITEMS);
  foreverSummary('  clean: nothing the budget cannot price', CLASSIC_CONTROL_ITEMS.filter(isClean));
  console.log('');

  foreverSummary('all Forever items', FOREVER_ITEMS);
  foreverSummary('  the Premier PvP cloth', FOREVER_PVP_CLOTH);
  foreverSummary('  weapons', FOREVER_WEAPONS);
  foreverSummary(
    '  armour, PvP',
    FOREVER_ITEMS.filter((i) => !i.weapon && i.name.startsWith('Premier ')),
  );
  foreverSummary(
    '  armour, not PvP',
    FOREVER_ITEMS.filter((i) => !i.weapon && !i.name.startsWith('Premier ')),
  );

  console.log('');
  console.log('APPLES TO APPLES -- clean armour only, item level 65, nothing unpriceable\n');
  const at65 = (rows: readonly ForeverRawItem[]) =>
    rows.filter((i) => !i.weapon && i.itemLevel === 65 && isClean(i));
  foreverSummary("  CLASSIC's own epics", at65(CLASSIC_CONTROL_ITEMS));
  foreverSummary('  FOREVER new, not PvP', at65(FOREVER_NEW_ITEMS).filter((i) => !i.name.startsWith('Premier ')));
  foreverSummary('  FOREVER new, PvP', at65(FOREVER_NEW_ITEMS).filter((i) => i.name.startsWith('Premier ')));

  console.log('');
  console.log('by item level');
  const levels = [...new Set(FOREVER_ITEMS.map((i) => i.itemLevel))].sort((a, b) => a - b);
  for (const ilvl of levels) {
    foreverSummary(`  item level ${ilvl}`, FOREVER_ITEMS.filter((i) => i.itemLevel === ilvl));
  }

  console.log('');
  console.log('by slot');
  for (const slot of [...new Set(FOREVER_ITEMS.map((i) => i.inventoryType))].sort()) {
    foreverSummary(`  ${slot}`, FOREVER_ITEMS.filter((i) => i.inventoryType === slot));
  }
}

function foreverWeaponReport(): void {
  console.log(`${FOREVER_WEAPONS.length} FOREVER EPIC WEAPONS -- beta build ${FOREVER_BUILD}`);
  console.log('');
  console.log('1. DPS IS A LINE. Same hand, same item level, speed varies, dps does not.');
  console.log('');
  for (const hand of ['One-Hand', 'Two-Hand', 'Ranged']) {
    const physical = FOREVER_WEAPONS.filter(
      (w) => w.inventoryType === hand && w.weapon!.dps >= FOREVER_PHYSICAL_DPS_ILVL65[hand] - 1,
    );
    if (physical.length === 0) continue;
    const seen = [
      ...new Set(physical.map((w) => `${w.weapon!.speed.toFixed(2)}s:${w.weapon!.dps.toFixed(1)}`)),
    ];
    const predicted = CLASSIC_FITTED_DPS_ILVL65[hand];
    const observed = FOREVER_PHYSICAL_DPS_ILVL65[hand];
    console.log(
      `   ${pad(hand, 10)} observed ${observed.toFixed(1)}   ` +
        `Classic-fitted line predicts ${predicted.toFixed(2)}   ` +
        `off by ${(observed - predicted).toFixed(2)} dps`,
    );
    console.log(`              ${seen.join('   ')}`);
  }

  console.log('');
  console.log('2. PvP AGAINST NOT. The two-hand multiplier is 1.00 and is the only one the');
  console.log('   source states with confidence, so that row is the one to read.');
  console.log('');
  console.log(
    `   ${pad('item', 40)}${pad('slot', 11)}${pad('dps', 7)}${pad('budget', 8)}   used  pvp`,
  );
  for (const hand of ['Two-Hand', 'One-Hand', 'Ranged']) {
    for (const w of FOREVER_WEAPONS.filter((x) => x.inventoryType === hand)) {
      if (w.weapon!.dps < FOREVER_PHYSICAL_DPS_ILVL65[hand] - 1) continue;
      const pvp = w.name.startsWith('Premier ');
      if (pvp && !SHOWN_PVP_WEAPONS.has(w.name)) continue;
      const priced = priceForeverItem(w);
      console.log(
        `   ${pad(w.name, 40)}${pad(w.inventoryType, 11)}${num(w.weapon!.dps, 6, 1)} ` +
          `${num(priced.budget!, 7, 2)} ` +
          `${num((spend(priced.lines).implied / priced.budget!) * 100, 6, 1)}%  ${pvp ? 'yes' : 'no'}`,
      );
    }
  }

  console.log('');
  console.log("3. WHAT A CASTER WEAPON GAVE UP, against Forever's own physical dps");
  console.log('');
  for (const w of FOREVER_WEAPONS) {
    const physical = FOREVER_PHYSICAL_DPS_ILVL65[w.inventoryType];
    if (physical === undefined || w.subclass === 'Wand') continue;
    if (w.weapon!.dps >= physical - 1) continue;
    const priced = priceForeverItem(w);
    const short = physical - w.weapon!.dps;
    const over = spend(priced.lines).implied - priced.budget!;
    console.log(
      `   ${pad(w.name, 40)}${num(w.weapon!.dps, 6, 1)} against ${physical.toFixed(1)} -> ` +
        `${short.toFixed(1)} short` +
        (over > 0 ? `, ${(over / short).toFixed(2)} budget points per dps` : ''),
    );
  }
}


const only = process.env.ITEM;
const referenceOnly = process.env.REFERENCE;

if (only) {
  const item = ITEMS_BY_ID.get(Number(only));
  if (!item) throw new Error(`no item ${only} on file`);
  itemise(price(item));
} else if (process.env.WEAPONS) {
  foreverWeaponReport();
} else if (process.env.FOREVER) {
  foreverReport();
} else if (referenceOnly) {
  for (const ref of REFERENCE_ITEMS) itemise(priceReference(ref));
} else {
  console.log('THE TEN REFERENCE ITEMS -- original Classic, transcribed from Wowhead\n');
  console.log(HEADER);
  const references = REFERENCE_ITEMS.map(priceReference);
  for (const pricing of references) console.log(row(pricing));
  summarise(references, 'reference items');

  const onFile = ITEMS.map(price);
  console.log('\n\nEVERY ITEM ON FILE\n');
  console.log(HEADER);
  for (const pricing of onFile.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(row(pricing));
  }
  summarise(onFile, 'items on file');
}
