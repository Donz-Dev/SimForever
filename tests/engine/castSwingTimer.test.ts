import { describe, expect, it } from 'vitest';
import type { Ability, Combatant } from '../../src/engine';
import { EventPriority, createEvent, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * RULESET: casting anything with a cast time interrupts the swing in progress
 * and RESETS the swing timer. An ability marked `swingTimer: 'hold'` is the
 * exception -- the timer runs on behind the cast, and a swing that comes due
 * during it waits for the cast to finish rather than being lost.
 *
 * The Warrior's Improved Slam is that exception, and the difference is the
 * whole value of the talent: without it a Slam costs a swing.
 *
 * AND `continue` IS A THIRD MODE, the ruleset owner's ruling for the Hunter's
 * three cast shots: the auto attack is not paused, not reset and not DELAYED,
 * so a swing that comes due inside the cast LANDS inside the cast.
 *
 * Timings are asserted exactly rather than sampled. A swing arriving a few
 * hundred milliseconds early or late changes damage over a fight by a few
 * percent, which averaging would hide.
 */

const SWING_MS = seconds(2);
const CAST_MS = seconds(1.5);

type SwingTimerMode = 'reset' | 'hold' | 'continue' | undefined;

function spellWith(swingTimer: SwingTimerMode, castMs: number): Ability {
  return {
    id: 'test_cast',
    name: 'Test Cast',
    castTimeMs: castMs,
    affectedByHaste: false,
    requiresTarget: false,
    ...(swingTimer ? { swingTimer } : {}),
    onCast: () => {},
  };
}

/** Run a fight, casting once at `castAt`, and report when swings landed. */
function swingTimes(
  swingTimer: SwingTimerMode,
  castAtMs: number | null,
  castMs: number = CAST_MS,
): number[] {
  const ability = spellWith(swingTimer, castMs);
  const attacker: Combatant = makeAttacker({
    autoAttack: 'main-hand',
    abilities: [ability],
    weapons: {
      mainHand: {
        name: 'Test Weapon',
        swingTimerMs: SWING_MS,
        baseDamage: 10,
        damageVariance: 0,
      },
    },
  });
  const target: Combatant = makeTarget();

  const simulation = buildSimulation([attacker, target], { durationMs: seconds(10) });

  if (castAtMs !== null) {
    simulation.events.schedule(
      castAtMs,
      createEvent('cast', EventPriority.Decision, (ctx) => {
        ctx.cast(attacker, ability, undefined);
      }),
    );
  }

  const run = simulation.run();
  return run.telemetry
    .filter((event) => event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack')
    .map((event) => event.timestamp);
}

describe('a cast and the melee swing timer', () => {
  /*
   * Swings land at 0, 2000, 4000 ... with no cast. Every case below casts at
   * 1000 or 3000 and asks what happened to the swing that was coming next.
   */
  it('lands swings on the plain timer when nothing casts', () => {
    expect(swingTimes(undefined, null)).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it('resets the timer by default, losing the swing in progress', () => {
    // Cast at 1000. The swing due at 2000 never happens; the timer restarts
    // and the next swing is a full 2000 later, at 3000.
    expect(swingTimes('reset', 1000)).toEqual([0, 3000, 5000, 7000, 9000]);
  });

  it('holds a swing that comes due mid-cast until the cast finishes', () => {
    // Cast at 1000 runs to 2500. The swing due at 2000 is inside that window,
    // so it WAITS and lands the moment the cast ends -- it is not lost.
    expect(swingTimes('hold', 1000)).toEqual([0, 2500, 4500, 6500, 8500]);
  });

  it('holding beats resetting over the same fight', () => {
    const reset = swingTimes('reset', 1000);
    const hold = swingTimes('hold', 1000);
    // Same number of swings, but every one of them lands sooner.
    expect(hold.length).toBe(reset.length);
    expect(hold[1]).toBeLessThan(reset[1]);
  });

  it('does not touch a swing that already landed before the cast', () => {
    // Cast at 3000: the swing at 2000 is long gone, and the one due at 4000 is
    // held to the cast end at 4500.
    expect(swingTimes('hold', 3000)).toEqual([0, 2000, 4500, 6500, 8500]);
  });

  /*
   * ==========================================================================
   * `continue`: THE CAST IS INVISIBLE TO THE SWING TIMER.
   *
   * The owner's ruling for the Hunter's three cast shots -- "the ranged
   * auto-attack is not paused or suspended. It will trigger DURING the cast".
   * Asserted against the NO-CAST row rather than against a computed list,
   * because "identical to never having cast" is the whole claim.
   * ==========================================================================
   */
  it('lets a swing land DURING the cast, leaving the rhythm untouched', () => {
    expect(swingTimes('continue', 1000)).toEqual(swingTimes(undefined, null));
  });

  /*
   * THE CASE THAT SEPARATES IT FROM `hold`, and the reason `hold` could not
   * have carried the ruling. A cast LONGER than the swing cycle is where the
   * deferral bites: Sniper Shot is four seconds against a 2.8-second hasted
   * bow, so a shot comes due inside it every time.
   *
   * At a 3-second cast started at 1000, `hold` pushes the 2000 swing out to
   * 4000 and every later one with it; `continue` lands it on time.
   */
  it('differs from hold whenever the cast outlasts a swing cycle', () => {
    const LONG_CAST = seconds(3);
    expect(swingTimes('hold', 1000, LONG_CAST)).toEqual([0, 4000, 6000, 8000]);
    expect(swingTimes('continue', 1000, LONG_CAST)).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  /*
   * THE FLAG IS PAIRED WITH `castEndsAt` AND CANNOT OUTLIVE ITS CAST, which is
   * the one way a single boolean on the combatant could go wrong: a `continue`
   * cast followed by an ordinary one must suspend the swing again.
   */
  it('stops allowing swings as soon as an ordinary cast follows', () => {
    const free = spellWith('continue', CAST_MS);
    const ordinary = spellWith(undefined, CAST_MS);
    const attacker: Combatant = makeAttacker({
      autoAttack: 'main-hand',
      abilities: [free, { ...ordinary, id: 'ordinary_cast', name: 'Ordinary Cast' }],
      weapons: {
        mainHand: {
          name: 'Test Weapon',
          swingTimerMs: SWING_MS,
          baseDamage: 10,
          damageVariance: 0,
        },
      },
    });
    const simulation = buildSimulation([attacker, makeTarget()], { durationMs: seconds(10) });

    /*
     * COLLECTED AND ASSERTED AFTERWARDS rather than checked inside the event,
     * because an expectation that never runs is an expectation that passes: a
     * cast refused for any reason would leave a `toBe` inside the handler
     * unexecuted and the test green.
     */
    const observed: boolean[] = [];
    simulation.events.schedule(
      0,
      createEvent('free', EventPriority.Decision, (ctx) => {
        ctx.cast(attacker, free, undefined);
        observed.push(attacker.castAllowsSwings);
      }),
    );
    simulation.events.schedule(
      seconds(5),
      createEvent('ordinary', EventPriority.Decision, (ctx) => {
        ctx.cast(attacker, attacker.abilities.get('ordinary_cast')!, undefined);
        observed.push(attacker.castAllowsSwings);
      }),
    );

    simulation.run();
    expect(observed).toEqual([true, false]);
  });
});
