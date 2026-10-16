import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Simulation, castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import {
  ICE_LANCE,
  ICE_LANCE_COEFFICIENT,
  ICE_LANCE_DAMAGE,
  ICE_LANCE_FROZEN_MULTIPLIER,
} from '../../src/game/abilities/mage';
import { ICE_LANCE_SP_COEFFICIENT } from '../../src/game/combat/coefficients';
import { FINGERS_OF_FROST, fingersOfFrostAura } from '../../src/game/auras/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * ICE LANCE'S COEFFICIENT, AND THE FROZEN MULTIPLIER BESIDE IT.
 *
 * The ruleset owner gave it as an expression, twice: "Ice lance now has a
 * 1.5/3.5/4 spell power coefficient instead of 1.5/3.5", and then **"Ice Lance
 * was changed to use 1.5/3.5/3."**
 *
 * ------------------------------------------------------------------------------
 * `ICE_LANCE_FROZEN_MULTIPLIER` IS APPLIED SEPARATELY AND IS ALSO THREE, where
 * both were four: "Ice Lance damage against Frozen targets changed to a 200%
 * increase (Was 300%)." The READING of that is unchanged and is the owner's --
 * an increase BY 200% is base plus twice itself.
 *
 * SO THE COINCIDENCE IS BACK, AND IT IS THE RULESET. A frozen Ice Lance carries
 * `1.5 / 3.5 / 3 * 3` = `1.5 / 3.5` = 0.4286, exactly the coefficient the spell
 * had UNFROZEN before any of this -- the same product the pair had at 4 and 4,
 * which the owner ratified then ("This is intended stop asking") and has now
 * confirmed by moving the divisor with the multiplier.
 *
 * ------------------------------------------------------------------------------
 * THIS FILE CARRIED THE QUESTION THAT GOT THAT ANSWER, AND HAD IMPLEMENTED THE
 * OTHER READING.
 *
 * When the patch moved the frozen bonus to three and said nothing about the
 * coefficient, two readings were a THIRD apart: the `/4` is a separate settled
 * fact (frozen 0.3214) or "intended" meant the PRODUCT and the divisor follows
 * (0.4286). The first was implemented, on this project's rule that a statement
 * of a VALUE does not overturn a separate ruling about which terms a multiplier
 * reaches -- and it was labelled as a reading, with the alternative written out
 * and pinned as a NEGATIVE assertion so that restoring 0.4286 meant arguing
 * with a line.
 *
 * **THE LABEL IS WHAT FIXED IT IN ONE MESSAGE.** The argument was sound, the
 * default was right, and the answer was the other one. Third ruling on this one
 * constant, and the second time the thing that got it ruled on was writing the
 * reading down as a reading.
 * ------------------------------------------------------------------------------
 *
 * THE TWO WRONG READINGS OF THE PAIR ARE STILL A LARGE FACTOR APART. Treating
 * the owner's `/3` as having already done the frozen division makes a frozen Ice
 * Lance a THIRD of its coefficient; applying the multiplier twice makes it three
 * times. Nine between them, and both produce a perfectly plausible number.
 *
 * SO EVERY TEST HERE MEASURES DAMAGE THAT LANDED AND DIVIDES, rather than
 * asserting either constant. That is the argument the pet's 1.375 damage
 * multiplier already makes in this project: a constant check cannot see a double
 * application, and an end-to-end swing can.
 *
 * IT ALSO CLOSES A REAL HOLE. The coefficient change moved Frostfire by about
 * 180 DPS and the whole suite passed untouched -- nothing anywhere pinned this
 * spell's scaling. "When a fix moves nothing in the suite, that is a statement
 * about the suite."
 * ==============================================================================
 */

const HORIZON = seconds(60);

/** A Frostfire mage with a known, round spell power and nothing else. */
function mageWithSpellPower(spellPower: number): Combatant {
  const profile = PRESETS_BY_ID.get('mage_frostfire')!.build();

  // The gear's own spell power is subtracted rather than the items stripped,
  // which is the idiom `ownerCoefficients.test.ts` uses and for the same
  // reason: removing the items would remove other things too.
  const reference = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    bonusStats: profile.stats,
    equipment: profile.equipment,
    talents: profile.talents,
  });

  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    bonusStats: {
      ...profile.stats,
      spellPower:
        (profile.stats.spellPower ?? 0) - reference.stats.effective.spellPower + spellPower,
    },
    equipment: profile.equipment,
    talents: profile.talents,
  });
  (player as { rotation?: unknown }).rotation = undefined;
  return player;
}

/**
 * One Ice Lance, on a clean hit with no crit, against an unarmoured target.
 *
 * `crit: -1_000_000` and `critMultiplier: 1` between them make the roll a plain
 * hit -- the Frostfire build carries Shatter and Ice Shards, and a crit here
 * would fold a talent's multiplier into the figure being divided.
 */
function iceLanceDamage(spellPower: number, frozen: boolean): number {
  const player = mageWithSpellPower(spellPower);
  const target = createTrainingDummy({
    name: 'Lance',
    health: 1_000_000_000,
    armor: 0,
    level: 63,
    attacks: false,
  });
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    {
      durationMs: HORIZON,
      seed: 1,
      createCombatants: () => [player, target],
      attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
    },
    { emit: (event) => events.push(event) },
  );
  simulation.begin();

  const mana = player.resources.require('mana');
  mana.fill();
  if (frozen) simulation.applyAura(player, fingersOfFrostAura(15), player.id);

  const before = events.length;
  castAbility(simulation, player, player.abilities.get('ice_lance')!, target);

  return events
    .slice(before)
    .filter((event) => event.type === 'damage' && 'abilityId' in event && event.abilityId === 'ice_lance')
    .reduce((sum, event) => sum + (event as never as { amount: number }).amount, 0);
}

/**
 * The coefficient the ability ACTUALLY applies, derived from two spell powers.
 *
 * Two points rather than one, so the flat half cancels: `(d2 - d1) / (p2 - p1)`
 * is the slope whatever the base damage is. Ice Lance rolls 133-157, so a single
 * reading could not be divided at all.
 *
 * ----------------------------------------------------------------------------
 * AND THE BUILD'S OWN FROST MULTIPLIER IS DIVIDED BACK OUT, which the first
 * draft of this file did not do: the slope came back 0.1136 against a declared
 * 0.1428, a clean 1.06x, and that 6% is PIERCING ICE at 3/3 on the Frostfire
 * build. Reading it as a coefficient error would have been the obvious move and
 * wrong.
 *
 * SO THE SLOPE IS NOT THE COEFFICIENT -- it is the coefficient times everything
 * between it and the damage event. Dividing by `schoolModifiers.for('frost')`
 * rather than loosening the assertion keeps the test about the coefficient AND
 * documents the one multiplier in the way, which a tolerance would have hidden.
 * The ratio test below needs none of this, because the multiplier cancels.
 * ----------------------------------------------------------------------------
 */
function measuredCoefficient(frozen: boolean): number {
  const low = iceLanceDamage(0, frozen);
  const high = iceLanceDamage(1000, frozen);
  const frost = mageWithSpellPower(0).schoolModifiers.for('frost').damageMultiplier ?? 1;
  return (high - low) / 1000 / frost;
}

describe("the owner's expression, and what it is not", () => {
  it('is 1.5/3.5/3 exactly, not a rounded decimal', () => {
    /*
     * ASSERTED AS THE EXPRESSION, because `1.5 / 3.5` does not terminate: the
     * original 0.43 was already a rounding of 0.428571..., and rounding a
     * second division would compound it. 0.143 is 0.1% low.
     */
    expect(ICE_LANCE_SP_COEFFICIENT).toBeCloseTo(1.5 / 3.5 / 3, 12);
    expect(ICE_LANCE_SP_COEFFICIENT).toBeCloseTo(0.1428571428, 9);
    // A THIRD of what the spell shipped with, which is the whole change.
    expect(ICE_LANCE_SP_COEFFICIENT * 3).toBeCloseTo(1.5 / 3.5, 12);
  });

  it('is a different number from the frozen multiplier, which is also three', () => {
    /*
     * ========================================================================
     * PINNED BY IDENTITY WHILE THEY AGREE, WHICH IS THE WHOLE POINT OF THE
     * TEST AND IS WHY IT SURVIVED THEM DISAGREEING.
     *
     * It read "which is NOW three" and asserted the divisor at four, on the
     * argument that a patch moving one and not the other was the clearest
     * possible demonstration they were never the same number. The owner has
     * since moved the divisor to match -- so the demonstration is gone and the
     * claim is not: they are two separate owner statements that happen to
     * agree, and `critRageMultiplierFor` is the precedent for keeping such a
     * pair apart rather than folding it.
     *
     * **AN EQUALITY TEST WOULD TURN THE NEXT DIVERGENCE INTO A FAILURE IN THE
     * CONSTANT THAT DID NOT MOVE**, which is exactly what happened the last
     * time the frozen bonus changed. So each is asserted against its own
     * stated value and neither is asserted against the other.
     * ========================================================================
     */
    expect(ICE_LANCE_FROZEN_MULTIPLIER).toBe(3);
    expect(ICE_LANCE_SP_COEFFICIENT).toBeCloseTo(1.5 / 3.5 / 3, 12);
    expect(ICE_LANCE_COEFFICIENT).toBe(ICE_LANCE_SP_COEFFICIENT);
  });
});

describe('what the spell actually applies, measured from damage', () => {
  it('scales at the base coefficient when the target is not frozen', () => {
    expect(measuredCoefficient(false)).toBeCloseTo(1.5 / 3.5 / 3, 6);
  });

  it('is 1.06x that before the build\'s own Piercing Ice is divided out', () => {
    /*
     * THE RAW SLOPE, asserted so the correction above is visible rather than
     * buried in a helper. 6% is Piercing Ice at 3/3, and it is the reason a
     * measured coefficient must name what it divided by -- the first draft of
     * this file read 0.1136 and the obvious conclusion was that the owner's
     * figure had been transcribed wrongly.
     */
    const frost = mageWithSpellPower(0).schoolModifiers.for('frost').damageMultiplier ?? 1;
    expect(frost).toBeCloseTo(1.06, 10);

    const rawSlope = (iceLanceDamage(1000, false) - iceLanceDamage(0, false)) / 1000;
    expect(rawSlope).toBeCloseTo((1.5 / 3.5 / 3) * 1.06, 6);
  });

  it('scales at THREE TIMES it when Fingers of Frost is up', () => {
    /*
     * THE MULTIPLIER REACHES THE COEFFICIENT AND NOT ONLY THE BASE, which is a
     * separate owner ruling -- "increased damage" is all of the damage.
     * Applying it to the flat half alone would leave a spell-power-heavy
     * Mage's Ice Lance barely improved and look reasonable.
     */
    expect(measuredCoefficient(true)).toBeCloseTo((1.5 / 3.5 / 3) * 3, 6);
  });

  it('lands the frozen case on exactly 1.5/3.5, which is the ruleset', () => {
    /*
     * ========================================================================
     * THIS TEST HAS NOW ASSERTED THE COINCIDENCE, ITS ABSENCE, AND THE
     * COINCIDENCE AGAIN -- AND THE NEGATIVE PHASE IS WHAT GOT IT SETTLED.
     *
     * The product is `1.5 / 3.5 / 3 * 3` = `1.5 / 3.5` = 0.4286, exactly the
     * coefficient the spell had UNFROZEN before any of this. It was the same
     * product when both numbers were four, and the owner ratified it then --
     * "This is intended stop asking" -- so this test existed to tell a reader
     * who noticed it that it was expected rather than a cancelled four.
     *
     * A PATCH MOVED THE FROZEN BONUS AND NOT THE DIVISOR, so this read as a
     * NEGATIVE for one release: 0.3214, with the note saying that the other
     * reading was that the divisor should follow, and that whoever did that
     * would have to change this line. **The owner then did exactly that**, in
     * one sentence -- "Ice Lance was changed to use 1.5/3.5/3."
     *
     * SO WHAT THE NEGATIVE PHASE BOUGHT IS THE REASON TO KEEP WRITING THEM:
     * the question was recorded where somebody would read it, with both
     * figures and what each would cost, and the answer arrived unprompted.
     * The ratification now covers the PRODUCT rather than the two factors,
     * which is the thing the original "stop asking" left ambiguous.
     * ========================================================================
     */
    expect(measuredCoefficient(true)).toBeCloseTo(1.5 / 3.5, 6);
    /*
     * THE RATIO NEEDS NO CORRECTION AT ALL, which is why it is the assertion to
     * trust most here: the school multiplier, the base damage and every other
     * term between the coefficient and the damage event appear on both sides and
     * cancel. Three is three whatever else is in the way.
     */
    expect(measuredCoefficient(true) / measuredCoefficient(false)).toBeCloseTo(3, 6);
  });

  it('keeps its flat damage, which a coefficient edit is what deletes', () => {
    /*
     * At zero spell power every coefficient contributes nothing and what is left
     * IS the flat damage -- the check `ownerCoefficients.test.ts` makes for every
     * ability, repeated here because this file EDITS a coefficient and that is
     * precisely the edit that overwrites a `baseAmount`.
     *
     * The roll is 133-157, so the band is asserted rather than the midpoint.
     */
    const flat = iceLanceDamage(0, false);
    expect(flat).toBeGreaterThanOrEqual(133);
    expect(flat).toBeLessThanOrEqual(157);
    expect(ICE_LANCE_DAMAGE).toBe(145);

    // And the frozen case multiplies the flat half too.
    const frozenFlat = iceLanceDamage(0, true);
    expect(frozenFlat).toBeGreaterThanOrEqual(133 * ICE_LANCE_FROZEN_MULTIPLIER);
    expect(frozenFlat).toBeLessThanOrEqual(157 * ICE_LANCE_FROZEN_MULTIPLIER);
  });
});

describe('what it is worth to the one profile that casts it', () => {
  it('is only reachable through Fingers of Frost, which the ability says', () => {
    /*
     * Nothing freezes a raid boss, so the 300% clause is the TALENT's window and
     * not the target's state -- which is why the Frostfire build is the only one
     * that sees it, and why the ability carries that as an `unmodelled` reason
     * rather than as a silent assumption.
     */
    expect(ICE_LANCE.unmodelled).toContain('Fingers of Frost');
    expect(FINGERS_OF_FROST.id).toBe('fingers_of_frost');

    const frostfire = PRESETS_BY_ID.get('mage_frostfire')!.build();
    expect(frostfire.talents.fingers_of_frost).toBeGreaterThan(0);
    expect(frostfire.talents.ice_lance).toBeGreaterThan(0);

    // And neither other Mage build takes the talent that grants the spell.
    for (const id of ['mage_fire', 'mage_arcane']) {
      expect(PRESETS_BY_ID.get(id)!.build().talents.ice_lance, id).toBeUndefined();
    }
  });
});
