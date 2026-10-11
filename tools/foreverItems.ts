/**
 * The Forever items, read back out of the project's OWN data file.
 *
 * ----------------------------------------------------------------------------
 * ONE SOURCE, WHICH IS THE WHOLE POINT OF THIS FILE EXISTING. The Premier PvP
 * cloth and the 41 epic weapons were each hand-transcribed into a module of
 * their own while the items were outside the project; they are inside it now,
 * in `src/data/items/forever-new-epics.json`, so those two modules are gone and
 * this reads the real file. **A second copy of a number is a copy that drifts**,
 * and the hand transcription had already proved it: 63 of the 64 cloth pieces
 * matched the client exactly and one did not.
 *
 * It reads the RAW file rather than the resolved `Item`, because the budget
 * needs the stat VALUES as the tooltip states them -- a rating is converted on
 * its way into an `Item` and the budget wants the rating.
 * ----------------------------------------------------------------------------
 */
import data from '../src/data/items/forever-new-epics.json';
import changed from '../src/data/items/forever-changed-epics.json';

export interface ForeverRawItem {
  readonly id: number;
  readonly name: string;
  readonly itemLevel: number;
  readonly inventoryType: string;
  readonly subclass: string | null;
  readonly armor: number | null;
  readonly weapon: {
    readonly minDamage: number;
    readonly maxDamage: number;
    readonly speed: number;
    readonly dps: number;
  } | null;
  readonly stats: Readonly<Record<string, number>>;
  readonly effects: readonly { readonly kind: string; readonly text: string }[];
}

export const FOREVER_BUILD = data.foreverBuild as string;
export const FOREVER_CAPTURED_ON = data.capturedOn as string;

/**
 * Items that exist only in Forever.
 *
 * `unknown` first: the JSON import infers a union of every literal record
 * shape in the file, so an optional key will not narrow directly.
 */
export const FOREVER_NEW_ITEMS = data.items as unknown as readonly ForeverRawItem[];

/**
 * CLASSIC items Forever changed, which are the control group.
 *
 * ----------------------------------------------------------------------------
 * THESE ARE WHAT ANSWERS "IS FOREVER'S BUDGET LOWER". Most of them differ from
 * Classic only in WORDING -- 487 of 653 carry stat for stat what Classic
 * carries -- so pricing them is pricing CLASSIC'S OWN ITEMIZATION through the
 * same model, on the same slots, at the same item levels. Any shortfall they
 * show is the MODEL's, not the ruleset's.
 *
 * Without them the only available baseline was 100%, and 100% is not something
 * the model achieves even on Classic.
 * ----------------------------------------------------------------------------
 */
export const FOREVER_CHANGED_ITEMS = changed.items as unknown as readonly ForeverRawItem[];

/** Everything on file, both files. */
export const FOREVER_ITEMS: readonly ForeverRawItem[] = [
  ...FOREVER_NEW_ITEMS,
  ...FOREVER_CHANGED_ITEMS,
];

/**
 * An item Forever changed only in wording, so its stats ARE Classic's.
 *
 * The capture carries the flag; it is recomputed here from nothing and simply
 * read, because the comparison rests on it.
 */
export const FOREVER_WORDING_ONLY_IDS: ReadonlySet<number> = new Set(
  (changed.items as unknown as { id: number; wordingOnly?: boolean }[])
    .filter((item) => item.wordingOnly)
    .map((item) => item.id),
);

/**
 * What a tooltip line calls a stat, and what a point of it costs.
 *
 * A RATING costs 1 per point by the budget source's own blanket line, which was
 * dead weight in Classic -- it has no ratings at all -- and which Forever is
 * the first thing here to exercise.
 */
export const FOREVER_STAT_COST: Readonly<Record<string, number>> = {
  Strength: 1,
  Agility: 1,
  Intellect: 1,
  Spirit: 1,
  /**
   * STAMINA, AND IT IS THE ONE COST THE SOURCE ITSELF FOOTNOTES.
   *
   * --------------------------------------------------------------------------
   * The table says 0.67 and footnotes it: "This value was changed with Burning
   * Crusade, and was originally 1 as well." Everything in this project is
   * PRE-Burning Crusade, so 1.0 is the era-correct figure and 0.67 is the one
   * belonging to a later expansion -- which makes 1.0 the SOURCED value here
   * and the default.
   *
   * IT IS ALSO THE PARAMETER EVERY CONCLUSION IN `docs/itemization.md` TURNED
   * OUT TO REST ON, because the populations differ enormously in how much
   * stamina they buy: the Premier PvP sets spend **40.8%** of their budget on
   * it against **14.0%** for Classic's own epics. Raising its price therefore
   * moves PvP gear about three times as far as anything else, and the "PvP
   * discount" that two rounds of analysis converged on simply inverts:
   *
   *     stamina 0.67 -> PvP  89.0%, non-PvP  95.2%   gap -6.2
   *     stamina 0.86 -> PvP  99.4%, non-PvP  99.8%   gap -0.4
   *     stamina 1.00 -> PvP 107.5%, non-PvP 103.4%   gap +4.0
   *
   * `STAMINA=0.67 FOREVER=1 npx vite-node tools/item_budget.ts` re-runs any of
   * it, because a conclusion that moves this much with one parameter needs to
   * be re-checkable in one command rather than argued about.
   * --------------------------------------------------------------------------
   */
  Stamina: Number(process.env.STAMINA ?? 1.0),
  Armor: 0.1,
  'Attack Power': 0.5,
  'Ranged Attack Power': 0.4,
  /**
   * THE SPELL POWER FAMILY, SCALED TOGETHER BY `SPELLPOWER=`.
   *
   * --------------------------------------------------------------------------
   * 0.86 school-blind, 0.70 for one school, 0.45 for healing -- all three
   * transcribed, and all three apparently a little HIGH for this era. An item
   * carrying spell power runs over budget relative to one that does not, and
   * **it does so in CLASSIC's own gear too**: +2.5 +/- 2.0 points for the
   * control against +4.4 +/- 2.4 for Forever's non-PvP items.
   *
   * Best fit against the control is **0.783** school-blind, about 9% under the
   * transcribed figure.
   *
   * WHETHER FOREVER DEVALUED IT FURTHER IS NOT SUPPORTED BY THE NON-PvP DATA:
   * the premium over Classic is **+1.9 +/- 3.1, which is 0.6 sigma**. The PvP
   * sets show +6.4 +/- 3.1 (2.1 sigma) and are the population most sensitive to
   * the stamina cost, so that one is suggestive and confounded rather than a
   * finding.
   *
   * SCALED AS A FAMILY and not individually, because fitting three costs to one
   * residual would be three free parameters chasing one number -- which is the
   * trap `STAMINA` already documents one level up.
   * --------------------------------------------------------------------------
   */
  'Spell Power': 0.86 * Number(process.env.SPELLPOWER ?? 1),
  'Spell Damage': 0.86 * Number(process.env.SPELLPOWER ?? 1),
  Healing: 0.45 * Number(process.env.SPELLPOWER ?? 1),
  'Mana Regeneration': 2.5,
  'Critical Strike Rating': 1,
  'Hit Rating': 1,
  'Dodge Rating': 1,
  'Defense Rating': 1,
  'Expertise Rating': 1,
  'Haste Rating': 1,
  'Parry Rating': 1,
  'Block Rating': 1,
  /** The budget source's "Magic Penetration". */
  'Spell Penetration': 0.9,
  'Block Value': 0.65,
};

const STAT_NAMES: Readonly<Record<string, string>> = {
  stamina: 'Stamina',
  strength: 'Strength',
  agility: 'Agility',
  intellect: 'Intellect',
  spirit: 'Spirit',
};

const EFFECT_STAT = /^\+?(\d+) (.+?)\.?$/;

export interface PricedStats {
  /** Stat name as the tooltip writes it, to the value it grants. */
  readonly stats: Readonly<Record<string, number>>;
  /** Effect lines carrying no number this can price. */
  readonly unpriced: readonly string[];
  /** Set bonuses, which the budget does not price at all. */
  readonly setBonuses: number;
}

/**
 * Pull the priceable stats off an item, by the tooltip's own names.
 *
 * ARMOUR IS DELIBERATELY NOT INCLUDED. The `armor` field is the TOTAL -- base
 * plus any "+40 Armor" line, summed by the importer to match how Classic and
 * Season of Discovery write it -- and base armour is free. Separating them
 * needs the baseline, which `bonusArmorOf` in `item_budget.ts` derives from the
 * items on file, so that is where it is done and not here.
 */
export function priceableStats(item: ForeverRawItem): PricedStats {
  const stats: Record<string, number> = {};
  const unpriced: string[] = [];
  let setBonuses = 0;

  for (const [name, value] of Object.entries(item.stats)) {
    const label = STAT_NAMES[name] ?? name;
    stats[label] = (stats[label] ?? 0) + value;
  }

  for (const effect of item.effects) {
    if (effect.kind === 'Set') {
      setBonuses += 1;
      continue;
    }
    const match = EFFECT_STAT.exec(effect.text);
    if (match && FOREVER_STAT_COST[match[2]] !== undefined) {
      stats[match[2]] = (stats[match[2]] ?? 0) + Number(match[1]);
      continue;
    }
    // "44 Block" is a shield's inherent block VALUE, which the project's own
    // parser already reads that way.
    const block = /^(\d+) Block$/.exec(effect.text);
    if (block) {
      stats['Block Value'] = (stats['Block Value'] ?? 0) + Number(block[1]);
      continue;
    }
    unpriced.push(`${effect.kind}: ${effect.text}`);
  }

  /*
   * THE HEALER PAIR IS ARGUABLY ONE PURCHASE, AND `HEALRIDER=1` PRICES IT AS
   * ONE.
   *
   * --------------------------------------------------------------------------
   * Forever writes a healer item as TWO lines -- "+33 Healing" and "+11 Spell
   * Damage" -- at a ratio of 3.0 across every pair in the data (2.86 to 3.14,
   * with one 20/20 outlier). Charging both treats a single design decision as
   * two purchases, and the healing items are exactly the ones that run over
   * budget: 107.4% for Classic's own, 112.1% for Forever's non-PvP.
   *
   * Dropping the paired spell damage takes Forever's non-PvP healing items
   * from **112.1% to 102.8%** and Classic's from 107.4% to 104.1%.
   *
   * NOT THE DEFAULT, because it is a third fitted reading of the same residual
   * and the source says nothing about it. It is here so the question can be
   * re-asked in one command instead of argued about.
   * --------------------------------------------------------------------------
   */
  if (process.env.HEALRIDER && stats.Healing && stats['Spell Damage']) {
    delete stats['Spell Damage'];
  }

  return { stats, unpriced, setBonuses };
}

/** The Premier PvP cloth, which is what the owner supplied as screenshots. */
export const FOREVER_PVP_CLOTH = FOREVER_NEW_ITEMS.filter(
  (item) => item.subclass === 'Cloth' && item.name.startsWith('Premier '),
);

/**
 * Classic's own epics, priced through this model -- the control.
 *
 * Only the wording-only ones, because those are the items whose stats Forever
 * did not touch.
 */
export const CLASSIC_CONTROL_ITEMS = FOREVER_CHANGED_ITEMS.filter((item) =>
  FOREVER_WORDING_ONLY_IDS.has(item.id),
);

/** Every weapon in the NEW capture. */
export const FOREVER_WEAPONS = FOREVER_NEW_ITEMS.filter((item) => item.weapon !== null);

/**
 * The physical DPS each hand carries at item level 65, READ OFF THE DATA.
 *
 * ----------------------------------------------------------------------------
 * Not fitted: every physical weapon of a hand at this item level carries the
 * same dps whatever its speed, so the figure is observed. One-handers run
 * **47.22 to 47.39** across speeds 1.80, 2.00, 2.30, 2.40 and 2.90 -- a 61%
 * spread in speed and 0.17 dps of spread in the result.
 *
 * THESE ARE THE DERIVED FIGURES, NOT THE TOOLTIP'S. The importer computes
 * `(min + max) / 2 / speed` and keeps the printed dps as a check on it, because
 * the source rounds for display -- it prints 47.2 where the damage range gives
 * 47.24. Reading the rounded figure made the line look 0.2 wide when it is
 * 0.17, so the derived value is both more accurate and kinder to the claim.
 * ----------------------------------------------------------------------------
 */
export const FOREVER_PHYSICAL_DPS_ILVL65: Readonly<Record<string, number>> = {
  'One-Hand': 47.24,
  'Main Hand': 47.24,
  'Off Hand': 47.24,
  'Two-Hand': 61.58,
  Ranged: 36.94,
};

/** What the lines fitted from CLASSIC weapons predict at item level 65. */
export const CLASSIC_FITTED_DPS_ILVL65: Readonly<Record<string, number>> = {
  'One-Hand': 0.9645 * 65 - 15.88,
  'Main Hand': 0.9645 * 65 - 15.88,
  'Off Hand': 0.9645 * 65 - 15.88,
  'Two-Hand': 1.2686 * 65 - 21.507,
  Ranged: 0.7475 * 65 - 11.983,
};
