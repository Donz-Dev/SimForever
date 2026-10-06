import { describe, expect, it } from 'vitest';
import { BatchTotals } from '../../src/analysis';
import type { TelemetryEvent } from '../../src/engine';
import { runProfile } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * THE BOOKS HAVE TO BALANCE: gained = spent + what is left in the pool.
 *
 * `grantResource` emits `amount: gained` -- what the pool ACTUALLY TOOK -- and
 * `wasted` beside it as a SEPARATE quantity for what the cap refused. The two do
 * not overlap, so `gained - wasted` subtracts the overflow twice.
 *
 * THE RESULTS PANEL DID EXACTLY THAT and printed the result as "Unspent", where
 * a `Math.max(0, ...)` clamped the negative away. A Venom Rogue read 28.50
 * gained, 7.21 wasted and 25.89 spent: the panel showed 0 where the honest
 * figure is 2.61, and the clamp is the reason nobody noticed the sum was 4.6
 * short. CLAUDE.md records the same shape happening to energy -- "if the books
 * do not balance, the missing side is usually something real that nothing
 * reports" -- and here the missing side was an arithmetic error in the reader.
 *
 * SO THE IDENTITY IS ASSERTED RATHER THAN THE FORMULA. A test that recomputed
 * `gained - spent` would pass against any definition of `gained`; this one
 * replays a real fight's event stream and checks the totals against the pool the
 * character is actually left holding.
 * ==============================================================================
 */

const isPoolEvent = (
  event: TelemetryEvent,
): event is Extract<TelemetryEvent, { type: 'resource_gained' | 'resource_spent' }> =>
  event.type === 'resource_gained' || event.type === 'resource_spent';

describe('a resource flow adds up', () => {
  it('reports a gain NET of the cap, with the overflow as a separate figure', () => {
    /*
     * Hand-built: a pool of five taking three then three. The second grant can
     * only fit two, so it reports two gained and one wasted -- NOT three and
     * one. Written out rather than read back, because the whole bug was a
     * reader assuming the other convention.
     */
    const totals = new BatchTotals();
    const gain = (amount: number, wasted: number, current: number): TelemetryEvent =>
      ({
        type: 'resource_gained',
        timestamp: 0,
        actorId: 'player',
        resource: 'comboPoints',
        amount,
        wasted,
        current,
        source: 'probe',
        sourceName: 'Probe',
      }) as TelemetryEvent;

    totals.emit(gain(3, 0, 3));
    totals.emit(gain(2, 1, 5));
    totals.finishIteration(60_000);

    const flow = totals.resourceFlow('player', 'comboPoints');
    expect(flow.totalGained).toBe(5); // what landed
    expect(flow.totalWasted).toBe(1); // what the cap refused, SEPARATELY
    // The old reading would have made this 4, which is a pool that never existed.
    expect(flow.totalGained - flow.totalWasted).not.toBe(5);
  });

  it('balances against the pool a real fight actually leaves behind', () => {
    const built = PRESETS_BY_ID.get('rogue_venom')!.build();
    const run = runProfile({
      ...built,
      simulation: { ...built.simulation, iterations: 1, seed: 4242 },
    } as never);

    const player = run.actors.find((actor) => actor.kind === 'player')!;

    let gained = 0;
    let spent = 0;
    for (const event of run.timeline) {
      if (!isPoolEvent(event)) continue;
      if (event.actorId !== player.id || event.resource !== 'comboPoints') continue;
      if (event.type === 'resource_gained') gained += event.amount;
      else spent += event.amount;
    }

    /*
     * The pool the fight ended holding, read from the last event's own
     * `current` rather than recomputed -- so this checks the engine against
     * itself rather than against a second copy of the clamping rule.
     */
    const last = [...run.timeline]
      .reverse()
      .find(
        (event): event is Extract<TelemetryEvent, { type: 'resource_gained' | 'resource_spent' }> =>
          isPoolEvent(event) &&
          event.actorId === player.id &&
          event.resource === 'comboPoints',
      );
    const leftInPool = last?.current ?? 0;

    expect(gained).toBeGreaterThan(0);
    expect(spent).toBeGreaterThan(0);
    // THE IDENTITY. Subtracting `wasted` as well would break this by exactly
    // the amount that overflowed.
    expect(gained).toBeCloseTo(spent + leftInPool, 6);
  });

  it('never leaves a NEGATIVE unspent for any pool of any profile', () => {
    /*
     * The clamp is what hid the bug, so this asserts the figure BEFORE any
     * clamp. A negative here means the reader and the emitter disagree about
     * whether `gained` is net -- which is the only way this can go wrong.
     */
    for (const id of ['rogue_venom', 'two_hand_arms', 'mage_fire', 'bm_hunter']) {
      const built = PRESETS_BY_ID.get(id)!.build();
      const run = runProfile({
        ...built,
        simulation: { ...built.simulation, iterations: 1, seed: 7 },
      } as never);
      const player = run.actors.find((actor) => actor.kind === 'player')!;

      const byPool = new Map<string, { gained: number; spent: number }>();
      for (const event of run.timeline) {
        if (!isPoolEvent(event) || event.actorId !== player.id) continue;
        const entry = byPool.get(event.resource) ?? { gained: 0, spent: 0 };
        if (event.type === 'resource_gained') entry.gained += event.amount;
        else entry.spent += event.amount;
        byPool.set(event.resource, entry);
      }

      for (const [resource, entry] of byPool) {
        expect(entry.gained - entry.spent, `${id} ${resource}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
});
