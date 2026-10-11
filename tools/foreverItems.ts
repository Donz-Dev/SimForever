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
  Stamina: 0.67,
  Armor: 0.1,
  'Attack Power': 0.5,
  'Ranged Attack Power': 0.4,
  'Spell Power': 0.86,
  'Spell Damage': 0.86,
  Healing: 0.45,
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
