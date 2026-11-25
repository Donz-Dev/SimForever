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

/**
 * Whether two valuations price every stat the same.
 *
 * ==============================================================================
 * WHAT DECIDES WHETHER "Use for gear" IS ALREADY DONE. The button used to read
 * "is ANY valuation applied" -- `statValuation !== undefined` -- so the first
 * click disabled it for good, and a later run with different weights could
 * never overwrite the first. The owner: "it works but I can't do it again and
 * overwrite." It is applied only when the gear is sorted by THIS run's weights.
 *
 * Keyed comparison, not `JSON.stringify`: two valuations built in a different
 * order are the same valuation. An absent entry and a zero are the same thing
 * to `scoreStats`, so they compare equal here too.
 * ==============================================================================
 */
export function sameValuation(a: StatValuation | undefined, b: StatValuation | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<StatName>;
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
  }
  return true;
}
