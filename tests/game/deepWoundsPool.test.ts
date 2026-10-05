import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, seconds, toSeconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import {
  DEEP_WOUNDS_DURATION_MS,
  DEEP_WOUNDS_TICK_INTERVAL_MS,
  DEEP_WOUNDS_TICKS,
  deepWoundsAura,
  weaponAverageDamage,
} from '../../src/game/auras/warriorTalents';

/*
 * ==============================================================================
 * DEEP WOUNDS, AGAINST THE RULESET OWNER'S THREE CLAUSES.
 *
 *   1. IT CANNOT CRIT -- an exception to the general Forever rule that every DoT
 *      can, because the bleed is the PRODUCT of a critical strike.
 *   2. A SIXTH OF ITS DAMAGE EVERY TWO SECONDS, so six ticks over twelve.
 *   3. A RE-APPLICATION RESETS THE DURATION AND ROLLS THE UNDELIVERED REMAINDER
 *      INTO THE NEW POOL, which the next sixth then draws from.
 *
 * ALL THREE WERE WRONG AND THE SUITE WAS GREEN, which is why this file exists:
 * it crit at melee crit chance, ticked every three seconds four times, and
 * discarded the remainder on every refresh. Nothing asserted any of it.
 *
 * THE THIRD IS THE ONE WITH TEETH. "Rolls over" is conservation: whatever a
 * refresh interrupts has to come out eventually, so the checks below are on
 * TOTAL DAMAGE DEALT rather than on per-tick figures alone. A per-tick
 * assertion passes happily while the remainder quietly evaporates.
 * ==============================================================================
 */

const ALWAYS_CRIT = { ...NO_CHANCES, crit: 10_000, critMultiplier: 2 };
const PERCENT = 60; // Deep Wounds at 3/3.

function fight() {
  const player = createPlayer({
    race: 'orc',
    characterClass: 'warrior',
    combatStyle: 'two_hander',
    equipment: startingEquipmentFor('warrior', 'two_hander'),
  });
  const dummy = createTrainingDummy({ name: 'D', health: 1e9, armor: 0, level: 63 });
  const events: TelemetryEvent[] = [];
  const sim = new Simulation(
    {
      durationMs: seconds(120),
      seed: 5,
      createCombatants: () => [player, dummy],
      // Everything crits, so a tick that CAN crit certainly will.
      attackChances: () => ALWAYS_CRIT,
    },
    { emit: (e) => events.push(e) },
  );
  sim.begin();
  return { player, dummy, sim, events };
}

/** Every Deep Wounds tick the player dealt. */
function ticks(events: readonly TelemetryEvent[], playerId: string) {
  return events.filter(
    (e) =>
      e.type === 'damage' &&
      (e as { sourceId?: string }).sourceId === playerId &&
      (e as { abilityId?: string }).abilityId === 'deep_wounds',
  ) as unknown as { amount: number; critical: boolean; timestamp: number }[];
}

describe('the cadence is a sixth every two seconds', () => {
  it('derives six ticks from the duration and the interval', () => {
    expect(toSeconds(DEEP_WOUNDS_TICK_INTERVAL_MS)).toBe(2);
    expect(toSeconds(DEEP_WOUNDS_DURATION_MS)).toBe(12);
    // The owner's "1/6th", not declared a third time.
    expect(DEEP_WOUNDS_TICKS).toBe(6);
  });

  it('ticks six times, two seconds apart, and delivers the whole pool', () => {
    const { player, dummy, sim, events } = fight();
    const expected = weaponAverageDamage(player) * (PERCENT / 100);

    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    sim.advanceTo(DEEP_WOUNDS_DURATION_MS + 1);

    const dealt = ticks(events, player.id);
    expect(dealt.length).toBe(DEEP_WOUNDS_TICKS);

    // Two seconds apart.
    for (let i = 1; i < dealt.length; i += 1) {
      expect(dealt[i].timestamp - dealt[i - 1].timestamp).toBe(DEEP_WOUNDS_TICK_INTERVAL_MS);
    }

    // CONSERVATION: six sixths is the whole thing, and each tick is one sixth.
    const total = dealt.reduce((n, d) => n + d.amount, 0);
    expect(total).toBeCloseTo(expected, 4);
    for (const tick of dealt) {
      expect(tick.amount).toBeCloseTo(expected / DEEP_WOUNDS_TICKS, 4);
    }
  });
});

describe('it cannot crit', () => {
  it('never crits, even with a table that crits everything', () => {
    /*
     * THE EXCEPTION TO A DOCUMENTED UNIVERSAL RULE. CLAUDE.md states that every
     * DoT in Forever can crit; the owner has ruled Deep Wounds out of it,
     * because the bleed is already the product of a critical strike.
     *
     * Asserted behaviourally rather than by reading the declaration: the point
     * is that no tick comes back critical, not that one field is absent.
     */
    const { player, dummy, sim, events } = fight();
    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    sim.advanceTo(DEEP_WOUNDS_DURATION_MS + 1);

    const dealt = ticks(events, player.id);
    expect(dealt.length).toBeGreaterThan(0);
    expect(dealt.every((d) => d.critical === false)).toBe(true);
  });
});

describe('a re-application rolls the remainder into the new pool', () => {
  it('adds what is left to the new total, and re-splits it six ways', () => {
    const { player, dummy, sim } = fight();
    const one = weaponAverageDamage(player) * (PERCENT / 100);

    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    const aura = dummy.auras.get('deep_wounds')!;
    expect(aura.poolRemaining).toBeCloseTo(one, 4);
    expect(aura.poolPerTick).toBeCloseTo(one / 6, 4);

    // Two ticks in: a third delivered, two thirds left.
    sim.advanceTo(DEEP_WOUNDS_TICK_INTERVAL_MS * 2 + 1);
    expect(aura.poolRemaining).toBeCloseTo(one * (4 / 6), 4);

    /*
     * THE SECOND APPLICATION'S POOL IS EVALUATED AT ITS OWN MOMENT, which is
     * the point of `periodic.pool` and the reason this is read live rather than
     * reusing `one`. The rotation has been running for four seconds and has cast
     * Battle Shout, so attack power -- and therefore the weapon's average damage
     * -- is higher than it was at the pull. Reusing `one` here failed by exactly
     * that difference, which is the mechanic working rather than a fault.
     */
    const left = aura.poolRemaining;
    const second = weaponAverageDamage(player) * (PERCENT / 100);
    expect(second).toBeGreaterThan(one);

    // The crit that re-applies it.
    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    const rolled = dummy.auras.get('deep_wounds')!;

    // ROLLED, not replaced: what was left PLUS a whole new pool.
    expect(rolled.poolRemaining).toBeCloseTo(left + second, 4);
    // And the next sixth draws from that new total.
    expect(rolled.poolPerTick).toBeCloseTo((left + second) / 6, 4);
    // The duration restarts, which the owner states in the same sentence.
    expect(rolled.remainingMs(sim.clock.now())).toBe(DEEP_WOUNDS_DURATION_MS);
  });

  it('loses nothing: two applications deliver both pools in full', () => {
    /*
     * THE REGRESSION THAT MATTERS. Before this, a refresh reset the clock and
     * dropped the undelivered damage -- so a bleed re-applied at one tick in
     * delivered five sixths of one pool instead of one pool plus five sixths.
     * Measured on the TOTAL, because that is the quantity "rolls over" is a
     * claim about.
     */
    const { player, dummy, sim, events } = fight();
    const one = weaponAverageDamage(player) * (PERCENT / 100);

    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    sim.advanceTo(DEEP_WOUNDS_TICK_INTERVAL_MS * 2 + 1);
    // Read live: the rotation has buffed attack power since the first one.
    const second = weaponAverageDamage(player) * (PERCENT / 100);
    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    // Long enough for the rolled pool to drain completely.
    sim.advanceTo(DEEP_WOUNDS_TICK_INTERVAL_MS * 2 + 1 + DEEP_WOUNDS_DURATION_MS + 1);

    const total = ticks(events, player.id).reduce((n, d) => n + d.amount, 0);
    expect(total).toBeCloseTo(one + second, 3);
    expect(dummy.auras.get('deep_wounds')?.poolRemaining ?? 0).toBeCloseTo(0, 6);
  });

  it('delivers one pool only, when it is never re-applied', () => {
    // The control for the test above: the conservation check must not pass by
    // simply dealing everything twice.
    const { player, dummy, sim, events } = fight();
    const one = weaponAverageDamage(player) * (PERCENT / 100);

    sim.applyAura(dummy, deepWoundsAura(PERCENT), player.id);
    sim.advanceTo(DEEP_WOUNDS_DURATION_MS * 2);

    const total = ticks(events, player.id).reduce((n, d) => n + d.amount, 0);
    expect(total).toBeCloseTo(one, 3);
  });
});
