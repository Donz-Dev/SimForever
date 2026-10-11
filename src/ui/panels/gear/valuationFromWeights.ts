import type { StatName } from '../../../engine';
import type { StatWeight } from '../../../simulator';
import type { StatValuation } from '../../../game/items/itemValue';

/**
 * A measured stat-weight run, turned into a gear-sorting valuation.
 *
 * ==============================================================================
 * IT IS A COPY, NOT A CONVERSION, AND THAT IS BY DESIGN. `StatWeight.perUnit`
 * is "DPS per displayed unit" and a `StatValuation` is keyed by the same stat
 * in the same unit -- the two ratings in percentage points, everything else in
 * its own points. `itemValue.test.ts` pins the two unit tables against each
 * other for exactly this moment, because they live in layers that cannot
 * import one another and nothing in the type system holds them together.
 *
 * ------------------------------------------------------------------------------
 * ONLY A `measured` ROW IS TAKEN, which is the whole judgement in this file.
 *
 * A run reports three verdicts and only one of them is an answer:
 *
 *   measured       a real figure with an interval the run can stand behind
 *   none           the variant ran bit-identical fights: the build cannot
 *                  read the stat at all
 *   inconclusive   the interval is wider than the value -- the run could NOT
 *                  resolve it, which is a different statement from "zero"
 *
 * `none` IS DROPPED RATHER THAN WRITTEN AS ZERO, although zero is what it
 * means, because an absent entry and a zero entry are the same thing to
 * `scoreStats` and an absent one is the one that re-derives if the build
 * changes. `inconclusive` is dropped because writing its unresolved figure in
 * would publish a number the run itself refused to stand behind -- and a
 * valuation is read at a glance, with none of the interval beside it.
 *
 * A TIER IS SUMMED ONTO ITS STAT. Hit is measured as a LADDER -- one row per
 * interval between the caps -- so three rows can carry the same `statId`.
 * Taking the last would price hit at whatever the narrowest remaining tier is
 * worth, and taking the first at whatever the widest is; the stat's weight for
 * sorting purposes is what the whole ladder says, so they add.
 * ==============================================================================
 */
export function valuationFromWeights(weights: readonly StatWeight[]): StatValuation {
  const valuation: Partial<Record<StatName, number>> = {};

  for (const weight of weights) {
    if (weight.verdict !== 'measured') continue;
    valuation[weight.statId] = (valuation[weight.statId] ?? 0) + weight.perUnit;
  }

  return valuation;
}

/**
 * Whether a run produced anything worth writing down.
 *
 * The button is DISABLED rather than hidden when it did not, because a run
 * that resolved nothing is a fact about the run -- a tooltip can say so, and a
 * button that vanishes cannot.
 */
export function hasMeasuredWeights(weights: readonly StatWeight[]): boolean {
  return weights.some((weight) => weight.verdict === 'measured');
}
