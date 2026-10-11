import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { ROGUE_COMBAT, ROGUE_RUPTURE } from '../../src/game/rotations/rogue';
import {
  HEMORRHAGE_DEBUFF,
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
import type { AplCondition } from '../../src/game/rotations/apl';
import { compileCondition } from '../../src/game/rotations/apl';

/*
 * A condition is DATA now. `compileCondition` turns one back into the closure
 * the engine runs, which is what these assertions have always been calling --
 * the step used to be implicit because the list held closures directly.
 */
const compiled = (condition: AplCondition | undefined) =>
  condition ? compileCondition(condition) : undefined;

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

const entry = (abilityId: string) => ROGUE_RUPTURE.entries.find((e) => e.abilityId === abilityId);
const ids = ROGUE_RUPTURE.entries.map((e) => e.abilityId);

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

  it('fires at FOUR points with the debuff down AND Hemorrhage up', () => {
    /*
     * FOUR POINTS SURVIVED THE RESPECIFICATION and is now the owner's figure as
     * well as a measured one, which is the rare case of the two agreeing.
     *
     * WHAT IS NEW IS THE THIRD CLAUSE: the owner's Rupture waits for Hemorrhage
     * to be on the target. That is why this test applies it -- without it the
     * entry refuses at four points, and a reader would take that for the point
     * gate having moved.
     */
    const { sim, player, target } = pool(4);
    expect(target.auras.has('rupture')).toBe(false);
    sim.applyAura(target, HEMORRHAGE_DEBUFF, player.id);
    expect(compiled(entry('rupture')?.condition)?.(sim, player, target)).toBe(true);
  });

  it('refuses at four points with Hemorrhage absent', () => {
    /*
     * ==========================================================================
     * THE CLAUSE AND THE ORDER ARE ONE CHANGE. Hemorrhage moved above Rupture
     * AND Rupture now requires it, and the second is what makes the first mean
     * anything: Hemorrhage is gated on its own debuff running out, so it yields
     * the moment the debuff is up -- and Rupture directly beneath it would
     * otherwise fire on a target that had never had it, once, at the pull.
     * ==========================================================================
     */
    const { sim, player, target } = pool(4);
    expect(target.auras.has('hemorrhage')).toBe(false);
    expect(compiled(entry('rupture')?.condition)?.(sim, player, target)).toBe(false);
  });

  it('still refuses at three', () => {
    const { sim, player, target } = pool(3);
    sim.applyAura(target, HEMORRHAGE_DEBUFF, player.id);
    expect(compiled(entry('rupture')?.condition)?.(sim, player, target)).toBe(false);
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
    expect(compiled(entry('rupture')?.condition)?.(sim, player, target)).toBe(false);
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

describe('Eviscerate’s duration floors came BACK, at six seconds', () => {
  /*
   * ============================================================================
   * THIS BLOCK USED TO BE CALLED "Eviscerate’s two duration floors are gone",
   * AND THE OWNER HAS PUT THEM BACK. The history is why it is rewritten rather
   * than deleted.
   *
   * THE FLOORS WERE REMOVED FOR A GOOD REASON. "Spend five points only while
   * Slice and Dice AND Rupture both have TEN seconds left" held Eviscerate to
   * ZERO casts a fight for the whole life of this list -- a suppressed finisher
   * reads identically to one with nothing to spend, which is why it was found
   * in the `USES=1` column rather than by suspecting it.
   *
   * THE OWNER'S FLOORS ARE THE SAME SHAPE WITH EVERY NUMBER LOOSENED: SIX
   * seconds rather than ten, and the point gate dropped from five to FOUR. So
   * this is the Venom list's lesson applied here -- the gate was what could not
   * fire, and a gate is a number -- rather than a return to the thing that was
   * broken.
   *
   * WHICH MEANS THE ONE THING TO CHECK IS THAT IT STILL FIRES. That is asserted
   * on the PROFILE in `ruptureRotation.test.ts`, not here: this block is about
   * what the condition SAYS, and a condition that says the right thing can
   * still never be true.
   * ============================================================================
   */
  it('refuses with both effects about to drop', () => {
    /*
     * THE BEHAVIOURAL DIFFERENCE, AND THE OLD VERSION OF THIS TEST ASSERTED THE
     * OPPOSITE. Five points with Slice and Dice and Rupture each on one second
     * is exactly the moment a floor exists to refuse -- the previous list
     * fired here and the owner's does not.
     *
     * A FLOOR IS A CLOCK CONDITION, so the only way to see one is to put the
     * clock somewhere it would refuse. Comparing the condition's ARITY proves
     * nothing: `all(...)` and a bare point gate both return a three-argument
     * function, which is how an earlier version of this test passed against
     * either list.
     */
    const { sim, player, target } = pool(MAX_COMBO_POINTS);
    sim.applyAura(player, sliceAndDiceAura(1), player.id);
    sim.applyAura(target, ruptureAura(1), player.id);
    sim.advanceTo(seconds(8));

    expect(comboPointsOn(player, target)).toBe(MAX_COMBO_POINTS);
    expect(compiled(entry('eviscerate')?.condition)?.(sim, player, target)).toBe(false);
  });

  it('fires at FOUR points with both effects comfortably up', () => {
    /*
     * FOUR, NOT FIVE, which is the other half of the respecification -- and it
     * is the input that separates the owner's gate from the old one in the
     * direction a reader would not guess: the floors got tighter and the point
     * gate got looser.
     */
    const { sim, player, target } = pool(4);
    sim.applyAura(player, sliceAndDiceAura(seconds(20)), player.id);
    sim.applyAura(target, ruptureAura(seconds(20)), player.id);

    expect(compiled(entry('eviscerate')?.condition)?.(sim, player, target)).toBe(true);
  });

  it('still refuses below four', () => {
    const { sim, player, target } = pool(3);
    sim.applyAura(player, sliceAndDiceAura(seconds(20)), player.id);
    sim.applyAura(target, ruptureAura(seconds(20)), player.id);
    expect(compiled(entry('eviscerate')?.condition)?.(sim, player, target)).toBe(false);
  });

  it('spends FEWER points than the Combat list, which is the opposite of before', () => {
    /*
     * ==========================================================================
     * THE TWO LISTS SWAPPED SIDES, AND THE OLD COMMENT HERE ARGUED FOR THE
     * ARRANGEMENT THEY HAVE JUST LEFT.
     *
     * It read: "FIVE HERE AND TWO THERE, and the difference is a BLEED. Combat
     * has no Rupture to maintain, so its Eviscerate is where its points are
     * supposed to go and the peak is at two. Here a point taken by Eviscerate
     * is a point Rupture needed, so letting it spend less is a real loss: 489.3
     * at three points and 479.2 at two, against 498.1 at five." Every figure in
     * that was measured.
     *
     * THE OWNER HAS IT AT FOUR HERE AND FIVE ON COMBAT. The reasoning the old
     * comment gave is not refuted by the swap -- a point taken by Eviscerate is
     * still a point Rupture needed -- but this list now holds Eviscerate behind
     * SIX SECONDS of Rupture as well, which protects the bleed by a different
     * route than hoarding the fifth point did.
     *
     * SO THE RULE THE OLD COMMENT ENDED ON SURVIVES AND POINTS THE OTHER WAY:
     * "this is not a convention anybody should normalise across the two lists."
     * It was true when the numbers were 5 and 2, and it is true now they are 4
     * and 5.
     * ==========================================================================
     */
    expect(JSON.stringify(entry('eviscerate')?.condition)).toContain('"points":4');
    expect(JSON.stringify(ROGUE_COMBAT.entries.find((e) => e.abilityId === 'eviscerate')?.condition))
      .toContain(`"points":${MAX_COMBO_POINTS}`);
  });
});

describe('every entry in the list is still distinct', () => {
  it('names no ability twice', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
