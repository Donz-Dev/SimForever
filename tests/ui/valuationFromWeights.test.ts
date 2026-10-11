import { describe, expect, it } from 'vitest';
import type { StatWeight } from '../../src/simulator';
import {
  hasMeasuredWeights,
  valuationFromWeights,
} from '../../src/ui/panels/gear/valuationFromWeights';

/*
 * ==============================================================================
 * "OVERWRITE THE DEFAULT NUMBERS" -- the owner's third requirement, which is
 * one function and three decisions.
 *
 * It is a COPY rather than a conversion, because a `StatWeight.perUnit` and a
 * `StatValuation` entry are already the same unit. `itemValue.test.ts` is what
 * pins that; this file covers which ROWS are taken.
 * ==============================================================================
 */
const row = (over: Partial<StatWeight>): StatWeight => ({
  key: over.key ?? 'k',
  statId: 'strength',
  name: 'Strength',
  units: 30,
  unitLabel: '',
  delta: 30,
  perUnit: 1,
  interval: 0.1,
  iterations: 500,
  spread: 1,
  verdict: 'measured',
  ...over,
});

describe('only a measured row becomes a weight', () => {
  it('takes a measured row at its per-unit value', () => {
    expect(valuationFromWeights([row({ statId: 'strength', perUnit: 0.58 })])).toEqual({
      strength: 0.58,
    });
  });

  /*
   * `none` MEANS ZERO AND IS STILL DROPPED. An absent entry and a zero entry
   * score identically, and the absent one is the one that re-derives if the
   * build changes -- so writing the zero in would freeze a fact about today's
   * build into the profile for no gain.
   */
  it('drops a row the run proved is worth nothing', () => {
    expect(valuationFromWeights([row({ statId: 'spellPower', perUnit: 0, verdict: 'none' })])).toEqual(
      {},
    );
  });

  /*
   * `inconclusive` IS NOT ZERO, which is the distinction the results panel
   * already draws in words: "nothing" is a confident answer and "not measured"
   * is the absence of one. Writing its unresolved figure into a valuation
   * would publish a number the run itself refused to stand behind, with none
   * of the interval beside it.
   */
  it('drops a row the run could not resolve', () => {
    expect(
      valuationFromWeights([row({ statId: 'hitChance', perUnit: 5.9, verdict: 'inconclusive' })]),
    ).toEqual({});
  });
});

describe('a capped stat is a ladder, and the rungs add', () => {
  /*
   * Hit is measured as one row per interval between the caps. Taking the LAST
   * would price hit at whatever the narrowest remaining tier is worth and
   * taking the FIRST at whatever the widest is; for sorting, the stat is worth
   * what the whole ladder says.
   */
  it('sums every tier of one stat onto that stat', () => {
    const valuation = valuationFromWeights([
      row({ key: 'hit-1', statId: 'hitChance', perUnit: 5.8971 }),
      row({ key: 'hit-2', statId: 'hitChance', perUnit: 2.6146 }),
    ]);
    expect(valuation.hitChance).toBeCloseTo(8.5117, 4);
  });

  it('does not let an unresolved tier contribute to the sum', () => {
    const valuation = valuationFromWeights([
      row({ key: 'hit-1', statId: 'hitChance', perUnit: 5 }),
      row({ key: 'hit-2', statId: 'hitChance', perUnit: 99, verdict: 'inconclusive' }),
    ]);
    expect(valuation.hitChance).toBe(5);
  });
});

describe('a run that resolved nothing says so', () => {
  it('reports no measured weights, which is what disables the button', () => {
    expect(hasMeasuredWeights([])).toBe(false);
    expect(hasMeasuredWeights([row({ verdict: 'none' }), row({ verdict: 'inconclusive' })])).toBe(
      false,
    );
    expect(hasMeasuredWeights([row({ verdict: 'none' }), row({})])).toBe(true);
  });

  it('produces an empty valuation, which the Gear panel reads as no sorting', () => {
    expect(valuationFromWeights([row({ verdict: 'none' })])).toEqual({});
  });
});
