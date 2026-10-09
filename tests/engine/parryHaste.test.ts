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
 * THE DEFENDER PARRIES AND THE ATTACKER'S TIMER MOVES, which is the half that
 * reads backwards and is the whole danger of it for a tank. Every assertion
 * below is on the ATTACKER's pending swing.
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

function swinger(overrides: Partial<Parameters<typeof makeAttacker>[0]> = {}): Combatant {
  return makeAttacker({
    autoAttack: 'main-hand',
    weapons: {
      mainHand: { name: 'Sword', swingTimerMs: SWING_MS, baseDamage: 100 },
    },
    parryHaste: { reductionFraction: 0.4, floorFraction: 0.2 },
    ...overrides,
  });
}

/**
 * Run to `atMs` with nothing being parried, then deal `parries` parried blows,
 * and report when the attacker's next swing is due relative to that moment.
 *
 * ------------------------------------------------------------------------------
 * THE OUTCOME IS SWITCHED PART-WAY ON PURPOSE. A provider that parries
 * everything parries the attacker's OWN auto-attacks on the way to `atMs`, so
 * each of those hurries the next one and the swing under test is nowhere near
 * where the arithmetic says it should be -- the first version of this helper
 * did exactly that and measured a fight it had not set up.
 *
 * Nothing is parried until the clock is parked, so the pending swing is at the
 * plain `atMs + remaining` the assertions are written against.
 * ------------------------------------------------------------------------------
 */
function remainingAfterParry(
  attacker: Combatant,
  atMs: number,
  options: { readonly parries?: number } = {},
): number {
  const target = makeTarget();
  let outcome: 'parry' | 'hit' = 'hit';
  const simulation = buildSimulation([attacker, target], {
    attackChances: () => always(outcome),
  });

  // A `Simulation` IS the `SimulationContext` everything inside a fight is
  // handed, which is what lets a test deal one attack by hand at a chosen
  // moment and read the engine's own state afterwards.
  simulation.advanceTo(atMs);
  outcome = 'parry';

  for (let index = 0; index < (options.parries ?? 1); index++) {
    dealDamage(simulation, {
      source: attacker,
      target,
      abilityName: 'Strike',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      weaponSlot: 'mainHand',
    });
    /*
     * THE HASTE IS SCHEDULED, NOT INSTANT, so the clock has to be nudged for
     * it to land -- which is the whole reason it works at all. See the module
     * comment: applied inline it would be hurrying the swing that is currently
     * firing, which has no time left on it.
     */
    simulation.advanceTo(atMs);
  }

  const pending = attacker.pendingSwing('mainHand');
  expect(pending, 'the attacker should have a swing pending').toBeDefined();
  return pending!.timestamp - simulation.clock.now();
}

describe('parry haste', () => {
  it('takes 40% of a full swing off the remaining timer', () => {
    /*
     * The first swing lands at time 0 and the next is due at 2000. Stopping at
     * 500 leaves 1500 to run, and one parry should leave 700.
     */
    const remaining = remainingAfterParry(swinger(), 500);

    expect(remaining).toBe(SWING_MS - 500 - REDUCTION_MS);
  });

  it('floors at 20% of a full swing rather than at zero', () => {
    /*
     * At 1400 there are 600ms left, and a flat 800ms reduction would put the
     * swing 200ms in the PAST. The floor is what stops it.
     */
    const remaining = remainingAfterParry(swinger(), 1400);

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
    const remaining = remainingAfterParry(swinger(), 100, { parries: 6 });

    expect(remaining).toBe(FLOOR_MS);
  });

  it('does nothing when the swing is already inside the floor', () => {
    // 1700 leaves 300ms, which is already under the 400ms floor. A parry must
    // not push it BACK out to 400.
    const remaining = remainingAfterParry(swinger(), 1700);

    expect(remaining).toBe(SWING_MS - 1700);
  });

  it('does nothing on an outcome that is not a parry', () => {
    const remaining = remainingAfterParry(swinger(), 500, { parries: 0 });

    expect(remaining).toBe(SWING_MS - 500);
  });

  it('does nothing for an attacker the ruleset gave no parry haste', () => {
    /*
     * ABSENT MEANS OFF, which is what keeps every combatant a test builds by
     * hand behaving as it did. Forever supplies the numbers in `game/actors`;
     * the engine supplies the rule and no figures of its own.
     */
    const plain = swinger({ parryHaste: undefined });
    const remaining = remainingAfterParry(plain, 500);

    expect(remaining).toBe(SWING_MS - 500);
  });

  it('delivers more swings over a whole fight, on the live path', () => {
    /*
     * ==========================================================================
     * THE TEST THAT WOULD HAVE CAUGHT IT, AND THE SIX ABOVE DID NOT.
     *
     * The first version applied the haste INLINE from `dealDamage`, and it
     * fired exactly zero times in a real fight. A swing's event handler
     * resolves its blow and only then schedules its successor -- so at the
     * moment the parry is seen, the handle on the combatant is the swing that
     * is CURRENTLY FIRING, with zero time remaining, and the real next swing
     * is scheduled at full speed a moment later.
     *
     * Every assertion above passed throughout, because calling `dealDamage` by
     * hand at a chosen moment DOES leave a real future swing pending -- which
     * is the one case the live path never presents. What found it was
     * measuring the mechanism's own quantity: three tank profiles took 25.5
     * attacks a fight before the change and 25.5 after it.
     *
     * So this one runs a FIGHT and counts what actually landed.
     * ==========================================================================
     */
    const swingsIn = (attacker: Combatant, outcome: 'parry' | 'hit'): number => {
      const target = makeTarget({ maxHealth: 10_000_000 });
      let swings = 0;
      buildSimulation(
        [attacker, target],
        { durationMs: seconds(60), attackChances: () => always(outcome) },
        {
          emit: (event) => {
            if (event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack') {
              swings++;
            }
          },
        },
      ).run();
      return swings;
    };

    // Unhurried: 60 seconds at one swing every two, from time zero.
    expect(swingsIn(swinger(), 'hit')).toBe(30);

    /*
     * Hurried: every swing is parried, so every swing is followed by a 40%
     * reduction on the next one -- 2000ms becomes 1200ms, and 60 seconds holds
     * fifty of those.
     */
    expect(swingsIn(swinger(), 'parry')).toBe(50);
  });

  it('leaves exactly one swing pending, so the timer cannot fork', () => {
    /*
     * ------------------------------------------------------------------------
     * THE INVARIANT `scheduleSwing` EXISTS TO HOLD. Four Hand of Justice procs
     * once turned 115 main-hand swings into 211, because an extra attack
     * scheduled a swing alongside the one already outstanding. Hurrying a
     * swing has exactly the same shape, so it has to cancel what it replaces.
     *
     * Counted by running a whole fight and comparing swings against what the
     * timer can physically deliver -- a forked timer shows up as more swings
     * than the clock allows, which is how the original bug was found.
     * ------------------------------------------------------------------------
     */
    const attacker = swinger();
    const target = makeTarget({ maxHealth: 10_000_000 });
    let swings = 0;
    const simulation = buildSimulation(
      [attacker, target],
      { durationMs: seconds(20), attackChances: () => always('hit') },
      {
        emit: (event) => {
          if (event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack') swings++;
        },
      },
    );
    simulation.run();

    /*
     * Twenty seconds at one swing every two, starting at time zero: 0 through
     * 18000 inclusive is ten, and the one due at 20000 falls on the end of the
     * fight and does not land. A forked timer would report more than the clock
     * can deliver, which is exactly how the original bug was found.
     */
    expect(swings).toBe(10);
  });
});
