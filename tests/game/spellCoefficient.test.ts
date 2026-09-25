import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import {
  INSTANT_CAST_SECONDS,
  PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS,
  PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR,
  SPELL_COEFFICIENT_CAST_DIVISOR,
  channelTickCoefficient,
  directSpellCoefficient,
  hybridSpellCoefficients,
  periodicTickCoefficient,
} from '../../src/game/combat/spellCoefficient';

/*
 * ------------------------------------------------------------------------------
 * THE SPELL COEFFICIENT RULE, written out here by hand from the ruleset
 * owner's statement rather than read back out of the module under test.
 *
 *     damage = castTime / 3.5 x (spellPower + schoolSpellPower) + baseDamage
 *
 * Four rules, one supplied and three ruled on as Classic's. The three borrowed
 * ones are pinned against Classic's own PUBLISHED coefficients where those
 * exist, which is the only check that distinguishes the right transcription of
 * a rule from a plausible one.
 * ------------------------------------------------------------------------------
 */

describe("the ruleset owner's worked example", () => {
  it('reproduces 328.57 exactly', () => {
    /*
     * "A spell has a 2.5 second cast time and has 'deals 150 to 250 lightning
     * damage'. The character has +100 spell damage and +80 nature damage."
     *
     *   2.5 / 3.5 x (100 + 80) + 200 = 328.57
     *
     * This is the number the whole feature is built to produce, so it is
     * asserted on its own and to two decimal places.
     */
    const coefficient = directSpellCoefficient(seconds(2.5));
    const spellPower = 100 + 80;
    const rolled = 200; // the midpoint of 150 to 250

    expect(coefficient * spellPower + rolled).toBeCloseTo(328.57, 2);
  });

  it('is the ratio the owner stated, not one that merely lands there', () => {
    // 2.5 / 3.5, and nothing else that happens to give 0.714.
    expect(directSpellCoefficient(seconds(2.5))).toBeCloseTo(2.5 / 3.5, 10);
    expect(SPELL_COEFFICIENT_CAST_DIVISOR).toBe(3.5);
  });
});

describe('a direct cast', () => {
  it('is cast time over 3.5', () => {
    expect(directSpellCoefficient(seconds(2))).toBeCloseTo(2 / 3.5, 10);
    expect(directSpellCoefficient(seconds(3))).toBeCloseTo(3 / 3.5, 10);
  });

  it('treats an instant as 1.5 seconds, which the owner supplied', () => {
    expect(INSTANT_CAST_SECONDS).toBe(1.5);
    expect(directSpellCoefficient(0)).toBeCloseTo(1.5 / 3.5, 10);
    expect(directSpellCoefficient(undefined)).toBeCloseTo(1.5 / 3.5, 10);
    // And a cast SHORTER than the global cooldown cannot be worth less than
    // one. Nothing in the project is, but the clamp is the rule, not a
    // property of the current spell list.
    expect(directSpellCoefficient(seconds(1))).toBeCloseTo(1.5 / 3.5, 10);
  });

  it('CLAMPS AT 3.5 SECONDS, which is the borrowed half of the rule', () => {
    /*
     * Classic's cap, ruled on by the owner. Exactly one spell reaches it --
     * Pyroblast at six seconds -- and it is the difference between 1.0 and
     * 1.714, which on a Fire Mage's 452 spell power is ~323 damage a cast.
     */
    expect(PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS).toBe(3.5);
    expect(directSpellCoefficient(seconds(6))).toBeCloseTo(1, 10);
    expect(directSpellCoefficient(seconds(3.5))).toBeCloseTo(1, 10);
    // Just under the cap is NOT capped, which is what makes it a clamp rather
    // than a flat 1.0 for anything slow.
    expect(directSpellCoefficient(seconds(3.4))).toBeCloseTo(3.4 / 3.5, 10);
  });
});

describe('a channel', () => {
  it('is the WHOLE channel over 3.5, split evenly across its ticks', () => {
    // Arcane Missiles: 5 seconds, 5 ticks.
    expect(channelTickCoefficient(seconds(5), 5) * 5).toBeCloseTo(5 / 3.5, 10);
    expect(channelTickCoefficient(seconds(5), 5)).toBeCloseTo(5 / 3.5 / 5, 10);

    // Mind Flay: 3 seconds, 3 ticks.
    expect(channelTickCoefficient(seconds(3), 3) * 3).toBeCloseTo(3 / 3.5, 10);
  });

  it('is NOT clamped, unlike a direct cast', () => {
    /*
     * Classic is self-consistent here and it is worth pinning, because the
     * two rules were answered separately and could easily have been made to
     * agree by mistake. A channel already pays for its coefficient in TIME --
     * five seconds of it -- which is exactly what the direct clamp exists to
     * stop a single cast from doing.
     */
    expect(channelTickCoefficient(seconds(5), 5) * 5).toBeGreaterThan(1);
    expect(directSpellCoefficient(seconds(5))).toBeCloseTo(1, 10);
  });

  it('gives a one-tick channel the same answer as its own duration', () => {
    // A one-tick channel and a plain cast of the same length are the same
    // thing, which is the check that the two paths have not drifted -- the
    // same check `channelTicks` itself carries in the engine.
    expect(channelTickCoefficient(seconds(3), 1)).toBeCloseTo(3 / 3.5, 10);
  });
});

describe('a damage-over-time effect', () => {
  it('is duration over 15, split evenly across its ticks', () => {
    expect(PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR).toBe(15);

    // Shadow Word: Pain, 18 seconds in six three-second ticks.
    expect(periodicTickCoefficient(seconds(18), 6) * 6).toBeCloseTo(18 / 15, 10);
    expect(periodicTickCoefficient(seconds(18), 6)).toBeCloseTo(0.2, 10);
  });

  it('is NOT clamped either, so a long DoT really is worth more', () => {
    // Bane of Agony, 24 seconds: 1.6 in total.
    expect(periodicTickCoefficient(seconds(24), 12) * 12).toBeCloseTo(1.6, 10);
  });

  it('COMES TO THE TICK INTERVAL OVER 15, which settles a question', () => {
    /*
     * ------------------------------------------------------------------------
     * `duration / 15 / ticks` IS `tickInterval / 15`, because the duration is
     * the ticks times the interval. So the per-tick coefficient depends on the
     * INTERVAL alone and not on how long the effect runs.
     *
     * That makes the question this test was written to answer disappear.
     * Improved Shadow Word: Pain lengthens 18 seconds to 24, and "derive from
     * the base duration" and "derive from the talented duration" give the SAME
     * per-tick answer -- 0.2 either way -- as long as the talent adds ticks at
     * the same cadence rather than re-spacing them.
     *
     * Worth pinning rather than deleting: it is only true while the interval
     * is unchanged, and a talent that re-spaced a DoT would make the two
     * readings diverge silently. `periodicTickCoefficient` takes the BASE
     * duration and base tick count for that reason.
     * ------------------------------------------------------------------------
     */
    const base = periodicTickCoefficient(seconds(18), 6);
    const talented = periodicTickCoefficient(seconds(24), 8);

    expect(base).toBeCloseTo(3 / 15, 10);
    expect(talented).toBeCloseTo(base, 10);

    // And the talent is still worth real damage: two more ticks at the same
    // coefficient, so 1.6 in total against the base 1.2.
    expect(base * 6).toBeCloseTo(1.2, 10);
    expect(base * 8).toBeCloseTo(1.6, 10);
  });
});

describe('a hybrid: a spell that hits AND leaves a DoT', () => {
  /*
   * ----------------------------------------------------------------------------
   * PINNED AGAINST A CLASSIC PUBLISHED PAIR, which is the whole reason to
   * trust this normalisation rather than one of the several that produce
   * plausible-looking numbers -- most of them land NEAR the right answer.
   *
   *   Moonfire   instant + 12s   ->  0.15 direct, 0.52 DoT
   *
   * Moonfire is the cross-check because Classic states it cleanly and it
   * carries no spell-specific adjustment. Immolate below is checked against
   * the arithmetic written out longhand instead, for the opposite reason.
   *
   * If this test ever starts failing, the normalisation has been swapped for
   * a different one -- and both halves would still look entirely reasonable.
   * ----------------------------------------------------------------------------
   */

  it("reproduces Classic's Moonfire pair", () => {
    const { direct, perTick } = hybridSpellCoefficients(0, seconds(12), 4);
    expect(direct).toBeCloseTo(0.15, 2);
    expect(perTick * 4).toBeCloseTo(0.52, 2);
  });

  it('agrees with the share formula worked longhand', () => {
    /*
     * Immolate: a 2-second cast leaving a 15-second effect in five ticks. The
     * arithmetic is written out here in full rather than quoted, so this
     * checks the IMPLEMENTATION against the RULE and not against itself.
     *
     * Classic is commonly quoted as 0.20 / 0.65 for this spell; the rule gives
     * 0.208 / 0.636. The quoted pair is rounded and Immolate also carries a
     * spell-specific adjustment in Classic, so the LONGHAND is the check here
     * and Moonfire above is the one pinned against a published figure.
     */
    const directRaw = 2 / 3.5;
    const dotRaw = 15 / 15;
    const sum = directRaw + dotRaw;
    const expectedDirect = directRaw * (directRaw / sum);
    const expectedDot = dotRaw * (dotRaw / sum);

    const { direct, perTick } = hybridSpellCoefficients(seconds(2), seconds(15), 5);
    expect(direct).toBeCloseTo(expectedDirect, 10);
    expect(perTick * 5).toBeCloseTo(expectedDot, 10);

    // And to two decimals, so a reader can see the size of them.
    expect(direct).toBeCloseTo(0.21, 2);
    expect(perTick * 5).toBeCloseTo(0.64, 2);
  });

  it('gives each half LESS than it would get alone', () => {
    // The point of the normalisation: one cast, one coefficient's worth,
    // shared. Neither half may keep its full value.
    const castMs = seconds(2);
    const { direct, perTick } = hybridSpellCoefficients(castMs, seconds(15), 5);

    expect(direct).toBeLessThan(directSpellCoefficient(castMs));
    expect(perTick).toBeLessThan(periodicTickCoefficient(seconds(15), 5));
  });

  it('does NOT simply make the two sum to one', () => {
    /*
     * The obvious normalisation, and not the rule. Weighting each half by its
     * own share leaves the BIGGER half with more of what it had, so a long DoT
     * with a short cast stays a DoT spell -- Immolate's halves sum to 0.86,
     * and forcing them to 1.0 would quietly move both.
     */
    const { direct, perTick } = hybridSpellCoefficients(seconds(2), seconds(15), 5);
    expect(direct + perTick * 5).toBeCloseTo(0.84, 2);
    expect(direct + perTick * 5).not.toBeCloseTo(1, 2);
  });

  it('keeps the halves in proportion to their own sizes', () => {
    // A long DoT on a short cast leans to the DoT; the reverse leans to the
    // hit. Stated as an inequality because it is the SHAPE of the rule.
    const dotHeavy = hybridSpellCoefficients(0, seconds(18), 6);
    const castHeavy = hybridSpellCoefficients(seconds(3.5), seconds(6), 2);

    expect(dotHeavy.perTick * 6).toBeGreaterThan(dotHeavy.direct);
    expect(castHeavy.direct).toBeGreaterThan(castHeavy.perTick * 2);
  });
});
