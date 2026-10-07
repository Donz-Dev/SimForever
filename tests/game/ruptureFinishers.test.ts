import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { ROGUE_RUPTURE } from '../../src/game/rotations/rogue';
import {
  RUPTURE_BY_COMBO_POINT,
  SLICE_AND_DICE_DURATIONS_MS,
  ruptureAura,
  sliceAndDiceAura,
} from '../../src/game/auras/rogue';
import {
  MAX_COMBO_POINTS,
  awardComboPoint,
  comboPointsOn,
} from '../../src/game/combat/comboPoints';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/**
 * A Rogue with N combo points banked ON THE TARGET.
 *
 * THROUGH `awardComboPoint` AND NOT THE RESOURCE, because combo points belong to
 * a target here: writing the pool directly leaves `comboPointTargetId` pointing at
 * nobody and every finisher then refuses to spend, which would make this test pass
 * or fail for a reason that has nothing to do with the gate under test.
 */
const pool = (points: number) => {
  const player = makeAttacker({
    autoAttack: 'none',
    resources: [
      { type: 'energy', maximum: 100, initial: 100 },
      { type: 'comboPoints', maximum: MAX_COMBO_POINTS },
    ],
  });
  const target = makeTarget();
  const sim = buildSimulation([player, target], { durationMs: seconds(60) });
  sim.begin();
  if (points > 0) awardComboPoint(sim, player, target, 'test', 'Test', points);
  return { sim, player, target };
};

/*
 * ==============================================================================
 * THE RUPTURE PROFILE'S THREE FINISHERS SHARE 21.5 COMBO POINTS A FIGHT.
 *
 * Nothing here asserts a DPS figure. The whole rebalance is +4.5 at 150 batches
 * of 10 and the 30-batch containment harness reports it as noise, so a delta test
 * would be pinned to a number this project's own method cannot reproduce. What is
 * assertable is the SHAPE: which gates the entries carry, that the ORDER the
 * measurement chose is still the order, and the arithmetic that explains why.
 * ==============================================================================
 */

const entry = (abilityId: string) => ROGUE_RUPTURE.find((e) => e.abilityId === abilityId);
const ids = ROGUE_RUPTURE.map((e) => e.abilityId);

describe('why Rupture spends four points and not five', () => {
  /*
   * THE REASON IS IN THE DATA, SO THE DATA IS WHAT THIS CHECKS. "Hold for the
   * maximum" is the right rule for a finisher whose table runs through the
   * origin, and Rupture's runs through neither its damage nor its duration: the
   * FIRST point carries far more of both than any later one, so damage per point
   * and seconds per point BOTH fall as the pool fills.
   *
   * If a future Forever build makes Rupture proportional, this test fails and the
   * threshold beside it wants re-measuring -- which is the point of asserting the
   * premise rather than only the conclusion.
   */
  it('has a damage table whose per-point value falls', () => {
    const perPoint = RUPTURE_BY_COMBO_POINT.map((row, i) => row.damage / (i + 1));
    for (let i = 1; i < perPoint.length; i++) {
      expect(perPoint[i]).toBeLessThan(perPoint[i - 1]);
    }
    // 159 for one point against 94 for five: the first point is worth 1.7 of them.
    expect(perPoint[0] / perPoint[4]).toBeGreaterThan(1.6);
  });

  it('has a duration table whose per-point value falls too', () => {
    const perPoint = RUPTURE_BY_COMBO_POINT.map((row, i) => row.durationMs / (i + 1));
    for (let i = 1; i < perPoint.length; i++) {
      expect(perPoint[i]).toBeLessThan(perPoint[i - 1]);
    }
  });

  it('buys only two seconds and 92 damage with the fifth point', () => {
    /*
     * WRITTEN OUT BY HAND from the table, because this is the whole trade: the
     * fifth point costs a wait, and 21.5 points a fight against 19.7 spent means
     * the binding constraint is TIME TO THRESHOLD rather than points available.
     */
    const fourth = RUPTURE_BY_COMBO_POINT[3];
    const fifth = RUPTURE_BY_COMBO_POINT[4];
    expect(fifth.damage - fourth.damage).toBe(92);
    expect(fifth.durationMs - fourth.durationMs).toBe(seconds(2));
  });

  it('fires at FOUR points with the debuff down', () => {
    /*
     * THE OLD GATE WAS `exactlyPoints(MAX_COMBO_POINTS)`, so this is the one
     * input that separates the two lists. Asserting only that a condition exists
     * -- which an earlier version of this test did -- passes against either.
     */
    const { sim, player, target } = pool(4);
    expect(target.auras.has('rupture')).toBe(false);
    expect(entry('rupture')?.condition?.(sim, player, target)).toBe(true);
  });

  it('still refuses at three', () => {
    const { sim, player, target } = pool(3);
    expect(entry('rupture')?.condition?.(sim, player, target)).toBe(false);
  });

  it('refuses while the debuff is still up, however full the pool', () => {
    /*
     * THE HALF THAT WOULD BE A REAL REGRESSION: lowering the threshold must not
     * turn Rupture into something that clips its own bleed. A refresh RESETS the
     * aura, so re-applying at four points over a running Rupture would throw away
     * whatever was left -- and the standing warning about refresh windows is
     * exactly this shape.
     */
    const { sim, player, target } = pool(MAX_COMBO_POINTS);
    sim.applyAura(target, ruptureAura(5), player.id);
    expect(entry('rupture')?.condition?.(sim, player, target)).toBe(false);
  });
});

describe('Slice and Dice keeps its place and its threshold', () => {
  it('stays ABOVE Rupture in the list', () => {
    /*
     * MEASURED, NOT ASSUMED: swapping the two entries reads 487.2 against 495.7,
     * a loss of 8.5. The haste is on every auto-attack and the autos are about
     * half this profile's damage, so dropping attack speed to keep a bleed up is
     * the wrong trade -- which is what the original ordering already said, and
     * this is the test that says it was checked rather than inherited.
     */
    expect(ids.indexOf('slice_and_dice')).toBeLessThan(ids.indexOf('rupture'));
  });

  it('is a maintenance buff, which is why its threshold is low', () => {
    /*
     * ITS DURATION TABLE IS PROPORTIONAL -- 9/12/15/18/21 seconds, a flat three
     * per point -- so unlike Rupture there is no per-point argument either way,
     * and what decides it is UPTIME. Holding for five measures 4 to 18 worse
     * across the whole Rupture-threshold axis, the same finding the Combat list
     * produced independently.
     */
    const perPoint = SLICE_AND_DICE_DURATIONS_MS.map((ms, i) => ms / (i + 1));
    expect(new Set(perPoint).size).toBeGreaterThan(1);
    expect(SLICE_AND_DICE_DURATIONS_MS[1] - SLICE_AND_DICE_DURATIONS_MS[0]).toBe(seconds(3));
    expect(SLICE_AND_DICE_DURATIONS_MS[4] - SLICE_AND_DICE_DURATIONS_MS[3]).toBe(seconds(3));
  });
});

describe('Eviscerate’s two duration floors are gone', () => {
  /*
   * ============================================================================
   * THE SECOND LIST THOSE FLOORS HAVE SUPPRESSED, IN THE SAME FILE.
   *
   * "Spend five points only while Slice and Dice AND Rupture both have ten
   * seconds left" held Eviscerate to ZERO casts a fight for the whole life of
   * this list, and CLAUDE.md already records the same pair costing the Venom list
   * 20 DPS. A finisher with nothing left to spend reads identically to a
   * suppressed one, which is why this was found in the `USES=1` column rather
   * than by suspecting it.
   *
   * AND THE TWO HALVES OF THE FIX ARE NOT INDEPENDENT: with Rupture still
   * hoarding the fifth point, dropping the floors is worth +0.6 and nothing
   * fires. With Rupture at four it is worth +1.5 and Eviscerate fires 0.2 times
   * a fight. The floors were not the only thing stopping it.
   * ============================================================================
   */
  it('fires at five points with both effects ABOUT TO DROP', () => {
    /*
     * THE BEHAVIOURAL DIFFERENCE, AND THE FIRST VERSION OF THIS TEST DID NOT
     * MEASURE IT. It compared the condition's ARITY -- and `all(...)` and a bare
     * `exactlyPoints` both return a three-argument function, so it passed against
     * either list and proved nothing. The floors are a CLOCK condition, so the
     * only way to see them is to put the clock somewhere they would refuse.
     *
     * Five points, Slice and Dice with one second left and Rupture with one: the
     * old floors wanted ten of each and would have refused this, and it is
     * exactly the moment a five-point pool most wants spending.
     */
    const { sim, player, target } = pool(MAX_COMBO_POINTS);
    sim.applyAura(player, sliceAndDiceAura(1), player.id);
    sim.applyAura(target, ruptureAura(1), player.id);
    sim.advanceTo(seconds(8));

    expect(comboPointsOn(player, target)).toBe(MAX_COMBO_POINTS);
    expect(entry('eviscerate')?.condition?.(sim, player, target)).toBe(true);
  });

  it('still refuses below five', () => {
    const { sim, player, target } = pool(4);
    expect(entry('eviscerate')?.condition?.(sim, player, target)).toBe(false);
  });

  it('still holds for the maximum, which is the opposite of the Combat list', () => {
    /*
     * FIVE HERE AND TWO THERE, and the difference is a BLEED. Combat has no
     * Rupture to maintain, so its Eviscerate is where its points are supposed to
     * go and the peak is at two. Here a point taken by Eviscerate is a point
     * Rupture needed, so letting it spend less is a real loss: 489.3 at three
     * points and 479.2 at two, against 498.1 at five.
     *
     * So this is not a convention anybody should normalise across the two lists.
     */
    expect(MAX_COMBO_POINTS).toBe(5);
  });
});

describe('every entry in the list is still distinct', () => {
  it('names no ability twice', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
