import type { PartialStats, StatName } from '../../engine';
import { RATING_PER_PERCENT } from '../../engine';
import type { CombatStyleId } from '../character/ids';
import type { Enchant, Item } from './Item';

/**
 * WHAT A POINT OF EACH STAT IS WORTH TO THIS CHARACTER.
 *
 * ==============================================================================
 * A SORTING WEIGHT, NOT A SIMULATED NUMBER, and the distinction is the whole
 * reason this file is allowed to exist at all. Nothing here reaches a fight:
 * it decides what order a slot's items appear in and what figure sits beside
 * each one. A wrong weight sorts a list badly; it cannot move a DPS figure.
 *
 * ------------------------------------------------------------------------------
 * THE UNIT IS THE STAT-WEIGHT RUN'S UNIT, WHICH IS THE POINT OF THE FILE.
 *
 * A `StatWeight` row off a real run is "DPS per displayed unit", where the two
 * RATINGS are displayed in PERCENTAGE POINTS and everything else in its own
 * points. This record uses exactly that, so pressing "Use these weights" after
 * a Stat Weights sim is a COPY rather than a conversion -- and a conversion is
 * precisely where two tables drift.
 *
 * IT ALSO MATTERS WITHOUT A RUN, because the item parser is inconsistent about
 * ratings ON PURPOSE: `+14 Hit Rating` becomes `hitChance: 1.4` at parse time
 * and `+14 Critical Strike Rating` stays `critRating: 14`, because one has a
 * reader for the rating and the other does not. Scoring the engine stats raw
 * would make a point of crit worth ten times a point of hit for no reason
 * anybody chose. `unitsOf` is the one place that is undone.
 * ==============================================================================
 */
export type StatValuation = Readonly<Partial<Record<StatName, number>>>;

/**
 * Engine-stat amount per DISPLAYED unit.
 *
 * One for everything except the two ratings, which are priced per percentage
 * point. `itemValue.test.ts` asserts this agrees with `WeightableStat.statPerUnit`
 * for every stat both tables name -- two places that must not drift, with the
 * test rather than an import holding them together, because `simulator` is a
 * layer above this one and may not be imported from `game`.
 */
export function unitsOf(stat: StatName, amount: number): number {
  switch (stat) {
    case 'critRating':
      return amount / RATING_PER_PERCENT.crit;
    case 'hasteRating':
      return amount / RATING_PER_PERCENT.haste;
    default:
      return amount;
  }
}

/**
 * Everything an equipped item would contribute, as engine stats.
 *
 * School-scoped spell power is folded into `spellPower`, because a valuation
 * is keyed by `StatName` and there is no keyed entry for it -- and because a
 * build that reads one school is the build that would be looking. The fold is
 * a SUM over the schools rather than a maximum: an item naming two schools
 * genuinely grants both pools, and nothing here knows which the build casts.
 */
export function valuationStatsFor(item: Item, style: CombatStyleId): PartialStats {
  const total: Record<string, number> = { ...item.stats };

  const scoped = item.styleStats[style];
  if (scoped) {
    for (const [name, value] of Object.entries(scoped)) {
      if (typeof value === 'number') total[name] = (total[name] ?? 0) + value;
    }
  }

  for (const value of Object.values(item.schoolPower)) {
    if (typeof value === 'number') total.spellPower = (total.spellPower ?? 0) + value;
  }

  return total as PartialStats;
}

/** The same for an enchant, which has no style-scoped or school-scoped half. */
export function enchantValuationStats(enchant: Enchant): PartialStats {
  return enchant.stats;
}

/**
 * What a set of stats is worth under a valuation.
 *
 * ------------------------------------------------------------------------------
 * THE TWO ATTACK POWER POOLS ARE ONE PURCHASE AND ARE PRICED ONCE.
 *
 * The owner's ruling is that a bare "+40 Attack Power" line reaches BOTH melee
 * and ranged attack power, so 164 item lines set the two fields to the same
 * number. Pricing them independently would double every such line -- a bigger
 * number and no error, which is this project's commonest shape of wrong.
 *
 * So the pair contributes the larger AMOUNT times the larger weight **of the
 * pools the item actually grants**. That last clause is the whole rule and it
 * is easy to leave out: taking the larger of the two weights unconditionally
 * pays a Warrior for a line that says "+36 Ranged Attack Power", which is the
 * owner's "Melee Attack Power NEVER reaches Ranged Attack Power" read
 * backwards. It got all the way to a test.
 *
 *   a melee build, bare AP line     both pools, weights {ap:1, rap:0}  -> 1x
 *   a Hunter, bare AP line          both pools, weights {ap:0, rap:1}  -> 1x
 *   a Hunter, "+36 Ranged AP"       ranged pool only, rap weight 1     -> priced
 *   a melee build, "+36 Ranged AP"  ranged pool only, rap weight 0     -> zero
 *   a Hunter, a melee-only AP line  melee pool only, ap weight 0       -> zero
 * ------------------------------------------------------------------------------
 */
export function scoreStats(stats: PartialStats, valuation: StatValuation): number {
  let total = 0;

  for (const [name, amount] of Object.entries(stats)) {
    if (typeof amount !== 'number' || amount === 0) continue;
    if (name === 'attackPower' || name === 'rangedAttackPower') continue;
    const weight = valuation[name as StatName];
    if (weight === undefined || weight === 0) continue;
    total += unitsOf(name as StatName, amount) * weight;
  }

  const melee = stats.attackPower ?? 0;
  const ranged = stats.rangedAttackPower ?? 0;
  if (melee !== 0 || ranged !== 0) {
    // Only the pools the item GRANTS contribute a candidate weight.
    const weights = [
      ...(melee !== 0 ? [valuation.attackPower ?? 0] : []),
      ...(ranged !== 0 ? [valuation.rangedAttackPower ?? 0] : []),
    ];
    total += Math.max(melee, ranged) * Math.max(...weights);
  }

  return total;
}

/** What an item is worth to a character in this style, under this valuation. */
export function scoreItem(item: Item, style: CombatStyleId, valuation: StatValuation): number {
  return scoreStats(valuationStatsFor(item, style), valuation);
}

export function scoreEnchant(enchant: Enchant, valuation: StatValuation): number {
  return scoreStats(enchantValuationStats(enchant), valuation);
}
