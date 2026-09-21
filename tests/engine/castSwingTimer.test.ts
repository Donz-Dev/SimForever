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
 * Timings are asserted exactly rather than sampled. A swing arriving a few
 * hundred milliseconds early or late changes damage over a fight by a few
 * percent, which averaging would hide.
 */

const SWING_MS = seconds(2);
const CAST_MS = seconds(1.5);

function spellWith(swingTimer: 'reset' | 'hold' | undefined): Ability {
  return {
    id: 'test_cast',
    name: 'Test Cast',
    castTimeMs: CAST_MS,
    affectedByHaste: false,
    requiresTarget: false,
    ...(swingTimer ? { swingTimer } : {}),
    onCast: () => {},
  };
}

/** Run a fight, casting once at `castAt`, and report when swings landed. */
function swingTimes(
  swingTimer: 'reset' | 'hold' | undefined,
  castAtMs: number | null,
): number[] {
  const ability = spellWith(swingTimer);
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
});
