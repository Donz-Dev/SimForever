import { describe, expect, it } from 'vitest';
import { armorDamageMultiplier, armorReduction } from '../../src/engine/combat/damage';
import {
  MAXIMUM_ARMOR_REDUCTION,
  armorConstantForLevel,
} from '../../src/engine/combat/ratings';

describe('the 75% hard cap on physical reduction from armor', () => {
  /*
   * ==========================================================================
   * THE OWNER'S RULING: "armor has a hard cap of 75% physical damage
   * reduction."
   *
   * THE CURVE CANNOT REACH IT ON ITS OWN, which is why this had to be stated
   * rather than derived and why nothing noticed it missing.
   * `armor / (K + armor)` is an asymptote -- it approaches 1 and arrives at
   * nothing -- so there was no flat ceiling anywhere to be wrong about, and no
   * zero, no caveat and no unmodelled entry to re-read.
   *
   * AND IT WAS UNREACHABLE UNTIL ONE COMMIT AGO. The highest armor in the
   * project was the Prot Warrior's 7,864, which is 57.74% -- seventeen points
   * clear. Dire Bear Form's multiplier took the Bear to 16,753 in a single
   * change, about 500 armor short of the cap, so this went from academic to
   * one gear upgrade away without the cap itself changing.
   * ==========================================================================
   */
  it('is 75%, and no amount of armor exceeds it', () => {
    expect(MAXIMUM_ARMOR_REDUCTION).toBe(0.75);
    for (const armor of [20_000, 50_000, 1_000_000]) {
      expect(armorReduction(armor, 63), `${armor} armor`).toBeCloseTo(0.75, 10);
      // The multiplier is the complement, so a quarter of every blow lands.
      expect(armorDamageMultiplier(armor, 63)).toBeCloseTo(0.25, 10);
    }
  });

  it('binds where the formula says it does, and not before', () => {
    /*
     * DERIVED FROM K RATHER THAN HARD-CODED, so the boundary follows the level
     * constant instead of being a second place for 17,265 to drift.
     */
    const k = armorConstantForLevel(63);
    const bindsAt = (MAXIMUM_ARMOR_REDUCTION * k) / (1 - MAXIMUM_ARMOR_REDUCTION);
    expect(Math.round(bindsAt)).toBe(17_265);

    // One point under is the curve; one point over is the cap.
    expect(armorReduction(Math.floor(bindsAt) - 1, 63)).toBeLessThan(0.75);
    expect(armorReduction(Math.ceil(bindsAt) + 1, 63)).toBeCloseTo(0.75, 10);
  });

  it('leaves everything below it exactly as it was', () => {
    /*
     * THE CONTAINMENT CHECK FOR A CLAMP: the figures this project already
     * publishes must not move. A raid boss at 3,731 armor is the familiar
     * "just under 40%", and the three tanks are all well clear.
     */
    expect(armorReduction(3731, 63)).toBeCloseTo(0.3933, 4);
    expect(armorReduction(16_753, 63)).toBeCloseTo(0.7443, 4); // the Bear
    expect(armorReduction(7864, 63)).toBeCloseTo(0.5774, 4); // Prot Warr
    for (const armor of [3731, 7864, 16_753]) {
      expect(armorReduction(armor, 63), `${armor} armor`).toBeLessThan(0.75);
    }
  });

  it('is applied AFTER armor penetration, not before', () => {
    /*
     * WHICH ORDER MATTERS AND FALLS OUT OF WHERE THE CLAMP LIVES. Penetration
     * reduces the armor and the cap clamps the reduction THAT produces, so an
     * attacker with penetration against a hugely-armored defender gets less
     * than 75% rather than the cap. Clamping first would hand them the full
     * cap and make penetration worthless against anything over it.
     */
    const huge = 40_000;
    expect(armorReduction(huge, 63)).toBeCloseTo(0.75, 10);
    // Half that armor is still past the cap; a tenth is not.
    expect(armorReduction(huge * 0.5, 63)).toBeCloseTo(0.75, 10);
    expect(armorReduction(huge * 0.1, 63)).toBeLessThan(0.75);
  });
});
