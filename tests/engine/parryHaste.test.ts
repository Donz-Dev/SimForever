import { describe, expect, it } from 'vitest';
import type { AttackChances, Combatant } from '../../src/engine';
import { NO_CHANCES, ROLL_MAX, dealDamage, seconds } from '../../src/engine';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * ==============================================================================
 * PARRY HASTE. The ruleset owner: "successfully parrying an attack reduces the
 * attacker's remaining swing timer by 40% of their max swing time, provided the
 * reduction does not lower the timer below 20% of its original duration", and
 * "this mechanic applies to both players and mobs, including raid bosses".
 *
 * THE UNIT THAT PARRIES IS THE UNIT THAT SPEEDS UP, which the sentence above
 * does NOT make obvious -- "the attacker" reads as the one whose blow was
 * turned aside. The owner's clarification settles it: "if I parry an attack MY
 * NEXT ATTACK COMES SOONER. If a boss parries an attack THEIR NEXT ATTACK COMES
 * SOONER." Every assertion below is therefore on the PARRIER's pending swing,
 * and the first version of this file asserted the other combatant's.
 *
 * THE NUMBERS ARE WRITTEN OUT BY HAND rather than read from `COMBAT_CONSTANTS`:
 * a 2000ms swing, 40% of it is 800ms, and the floor is 400ms. A test that reads
 * the source data passes whatever the source data says.
 * ==============================================================================
 */

const SWING_MS = 2000;
const REDUCTION_MS = 800; // 40% of 2000
const FLOOR_MS = 400; // 20% of 2000

/** A table that produces one outcome and nothing else. */
function always(outcome: 'parry' | 'hit'): AttackChances {
  return outcome === 'parry'
    ? { ...NO_CHANCES, parry: ROLL_MAX }
    : { ...NO_CHANCES, critMultiplier: 2 };
}

const WEAPON = { name: 'Sword', swingTimerMs: SWING_MS, baseDamage: 100 };
const HASTE = { reductionFraction: 0.4, floorFraction: 0.2 };

/**
 * The combatant under test: it swings on its own timer AND parries what comes
 * at it, so the mechanic has something to hurry.
 */
function parrier(overrides: Partial<Parameters<typeof makeAttacker>[0]> = {}): Combatant {
  return makeAttacker({
    autoAttack: 'main-hand',
    weapons: { mainHand: WEAPON },
    parryHaste: HASTE,
    /*
     * UNKILLABLE, because the thing under test is a SWING TIMER and a corpse
     * stops swinging. `makeAttacker` defaults to 1000 health, which the
     * whole-fight case below chewed through in twenty seconds -- it reported
     * ten swings where the timer allows thirty, which reads exactly like a
     * forked or stalled timer and was neither.
     */
    maxHealth: 10_000_000,
    ...overrides,
  });
}

/**
 * Run to `atMs` with nothing being parried, then have `parries` blows land on
 * the parrier, and report when ITS next swing is due relative to that moment.
 *
 * ------------------------------------------------------------------------------
 * THE OUTCOME IS SWITCHED PART-WAY ON PURPOSE. A provider that parries
 * everything parries the auto-attacks on the way to `atMs` too, so each of
 * those hurries the next one and the swing under test is nowhere near where the
 * arithmetic says it should be -- the first version of this helper did exactly
 * that and measured a fight it had not set up.
 * ------------------------------------------------------------------------------
 */
function remainingAfterParry(
  defender: Combatant,
  atMs: number,
  options: { readonly parries?: number } = {},
): number {
  // The one swinging AT the parrier. Its own timer must not be what moves.
  const aggressor = makeTarget({ maxHealth: 10_000_000 });
  let outcome: 'parry' | 'hit' = 'hit';
  const simulation = buildSimulation([defender, aggressor], {
    attackChances: () => always(outcome),
  });

  // A `Simulation` IS the `SimulationContext` everything inside a fight is
  // handed, which is what lets a test deal one attack by hand at a chosen
  // moment and read the engine's own state afterwards.
  simulation.advanceTo(atMs);
  outcome = 'parry';

  for (let index = 0; index < (options.parries ?? 1); index++) {
    dealDamage(simulation, {
      source: aggressor,
      target: defender,
      abilityName: 'Strike',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      weaponSlot: 'mainHand',
    });
    /*
     * THE HASTE IS SCHEDULED, NOT INSTANT, so the clock has to be nudged for it
     * to land. See the module comment for why it stayed scheduled after the
     * direction was corrected.
     */
    simulation.advanceTo(atMs);
  }

  const pending = defender.pendingSwing('mainHand');
  expect(pending, 'the parrier should have a swing pending').toBeDefined();
  return pending!.timestamp - simulation.clock.now();
}

describe('parry haste', () => {
  it('hurries the PARRIER, not the one whose blow was parried', () => {
    /*
     * ==========================================================================
     * THE DIRECTION, AND IT WAS BUILT BACKWARDS FIRST. The owner's original
     * wording -- "reduces the attacker's remaining swing timer" -- reads as the
     * unit whose blow was turned aside, and that is how it shipped. The
     * clarification is unambiguous: "if I parry an attack MY NEXT ATTACK COMES
     * SOONER."
     *
     * Both combatants swing here, so the test can say which one moved rather
     * than only that something did.
     * ==========================================================================
     */
    const defender = parrier();
    const aggressor = makeTarget({
      maxHealth: 10_000_000,
      autoAttack: 'main-hand',
      weapons: { mainHand: WEAPON },
      parryHaste: HASTE,
    });

    let outcome: 'parry' | 'hit' = 'hit';
    const simulation = buildSimulation([defender, aggressor], {
      attackChances: () => always(outcome),
    });
    simulation.advanceTo(500);
    outcome = 'parry';

    const before = {
      defender: defender.pendingSwing('mainHand')!.timestamp,
      aggressor: aggressor.pendingSwing('mainHand')!.timestamp,
    };

    // The aggressor swings; the defender parries it.
    dealDamage(simulation, {
      source: aggressor,
      target: defender,
      abilityName: 'Strike',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      weaponSlot: 'mainHand',
    });
    simulation.advanceTo(500);

    expect(defender.pendingSwing('mainHand')!.timestamp).toBe(before.defender - REDUCTION_MS);
    expect(aggressor.pendingSwing('mainHand')!.timestamp).toBe(before.aggressor);
  });

  it('takes 40% of a full swing off the remaining timer', () => {
    /*
     * The first swing lands at time 0 and the next is due at 2000. Stopping at
     * 500 leaves 1500 to run, and one parry should leave 700.
     */
    const remaining = remainingAfterParry(parrier(), 500);

    expect(remaining).toBe(SWING_MS - 500 - REDUCTION_MS);
  });

  it('floors at 20% of a full swing rather than at zero', () => {
    /*
     * At 1400 there are 600ms left, and a flat 800ms reduction would put the
     * swing 200ms in the PAST. The floor is what stops it.
     */
    const remaining = remainingAfterParry(parrier(), 1400);

    expect(SWING_MS - 1400).toBeLessThan(REDUCTION_MS); // the case is the right one
    expect(remaining).toBe(FLOOR_MS);
  });

  it('cannot be driven below the floor by repeated parries', () => {
    /*
     * ------------------------------------------------------------------------
     * THE REASON BOTH FRACTIONS ARE OF A FULL SWING AND NOT OF WHAT IS LEFT.
     * Read the floor as 20% of the REMAINING time and each parry would take
     * another 80% off whatever survived the last one, which converges on zero
     * and is a far more dangerous mechanic than the one stated.
     * ------------------------------------------------------------------------
     */
    const remaining = remainingAfterParry(parrier(), 100, { parries: 6 });

    expect(remaining).toBe(FLOOR_MS);
  });

  it('does nothing when the swing is already inside the floor', () => {
    // 1700 leaves 300ms, which is already under the 400ms floor. A parry must
    // not push it BACK out to 400.
    const remaining = remainingAfterParry(parrier(), 1700);

    expect(remaining).toBe(SWING_MS - 1700);
  });

  it('does nothing on an outcome that is not a parry', () => {
    const remaining = remainingAfterParry(parrier(), 500, { parries: 0 });

    expect(remaining).toBe(SWING_MS - 500);
  });

  it('does nothing for a parrier the ruleset gave no parry haste', () => {
    /*
     * ABSENT MEANS OFF, which is what keeps every combatant a test builds by
     * hand behaving as it did. Forever supplies the numbers in `game/actors`;
     * the engine supplies the rule and no figures of its own.
     */
    const plain = parrier({ parryHaste: undefined });
    const remaining = remainingAfterParry(plain, 500);

    expect(remaining).toBe(SWING_MS - 500);
  });

  it('delivers more swings over a whole fight, on the live path', () => {
    /*
     * ==========================================================================
     * THE TEST THAT CAUGHT THE INLINE VERSION, AND THE UNIT ONES DID NOT.
     *
     * The first implementation applied the haste inline from `dealDamage` and
     * fired exactly zero times in a real fight: a swing's handler resolves its
     * blow and only then schedules its successor, so at that moment the handle
     * on the combatant is the swing that is CURRENTLY FIRING, with no time
     * left on it.
     *
     * Every unit assertion above passed throughout, because calling
     * `dealDamage` by hand at a chosen moment DOES leave a real future swing
     * pending. So this one runs a FIGHT and counts what actually landed.
     * ==========================================================================
     */
    const swingsIn = (defender: Combatant, outcome: 'parry' | 'hit'): number => {
      const aggressor = makeTarget({
        maxHealth: 10_000_000,
        autoAttack: 'main-hand',
        weapons: { mainHand: WEAPON },
      });
      let swings = 0;
      buildSimulation(
        [defender, aggressor],
        { durationMs: seconds(60), attackChances: () => always(outcome) },
        {
          emit: (event) => {
            if (
              event.type === 'damage' &&
              event.sourceId === defender.id &&
              event.abilityName === 'Main Hand Auto-Attack'
            ) {
              swings++;
            }
          },
        },
      ).run();
      return swings;
    };

    // Unhurried: 60 seconds at one swing every two, from time zero.
    expect(swingsIn(parrier(), 'hit')).toBe(30);

    /*
     * Hurried: everything is parried, so each blow the aggressor lands on the
     * parrier takes 800ms off the parrier's next swing. It swings far more
     * often as a result.
     */
    expect(swingsIn(parrier(), 'parry')).toBeGreaterThan(30);
  });
});
