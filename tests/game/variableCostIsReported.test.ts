import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Simulation, castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { EXECUTE_BASE_COST } from '../../src/game/abilities/warrior';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * AN ABILITY THAT SPENDS "EVERYTHING LEFT IN THE BAR" MUST SAY SO.
 *
 * Two abilities have a cost `AbilityCost` cannot express -- a fixed amount and
 * then the whole pool -- so they declare the fixed part and spend the rest
 * inside `onCast`. Execute does it with rage, Ferocious Bite with energy.
 *
 * BOTH DID IT WITH `Resource.drain`, WHICH MOVES THE POOL AND EMITS NOTHING.
 * The resource panel is a pure formatter over the event stream, so the variable
 * half of the cost was simply absent from it: Execute reported exactly its
 * declared 15 a cast while emptying a bar that regularly held forty more. The
 * damage was right the whole time, which is why nothing looked wrong.
 *
 * WHAT THIS FILE ASSERTS IS THE TELEMETRY, NOT THE POOL. A test that checked
 * the bar went to zero passed before the fix and after it -- the drain was
 * never the broken half. The emitted `resource_spent` events are the subject,
 * because they are what every report, test and panel downstream reads.
 *
 * It is deliberately not a DPS assertion. Routing a drain through
 * `spendResource` cannot change damage, and if it ever did THAT would be the
 * bug.
 * ==============================================================================
 */

const ALWAYS_HITS = { ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 };

function fight(build: () => Combatant) {
  const player = build();
  const target = createTrainingDummy({ name: 'Dummy', health: 1e9, armor: 0, level: 63 });
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    {
      durationMs: seconds(60),
      seed: 1,
      createCombatants: () => [player, target],
      attackChances: () => ALWAYS_HITS,
    },
    { emit: (event) => events.push(event) },
  );
  // A tick first, so the opening auras land -- a Warrior's stance is one, and
  // casting out of stance is refused and reads exactly like a free cast.
  simulation.advanceTo(1);
  return { player, target, simulation, events };
}

/**
 * Every `resource_spent` event for one pool, with what claimed it.
 *
 * `from` SKIPS EVERYTHING THE FIGHT ALREADY EMITTED, and it is not optional in
 * practice. The Execute cases wind the clock to 55 seconds so the execute phase
 * is open, which means the character's own priority list has been running the
 * whole time -- the first draft of this helper read the entire stream and found
 * Battle Shout's 10 rage sitting at the top of it. Measure the CAST.
 */
function spends(events: readonly TelemetryEvent[], resource: string, from = 0) {
  return events
    .slice(from)
    .filter((e) => e.type === 'resource_spent')
    .filter((e) => (e as { resource: string }).resource === resource)
    .map((e) => e as unknown as { amount: number; source?: string; sourceName?: string });
}

describe('Execute reports the whole bar it spends, not just its declared 15', () => {
  function castExecute(startingRage: number) {
    const { player, target, simulation, events } = fight(() =>
      createPlayer({ race: 'orc', characterClass: 'warrior', combatStyle: 'two_hander' }),
    );
    const rage = player.resources.require('rage');

    // Execute is gated on the last fifth of the fight, so the clock moves
    // rather than the dummy being wounded. The global cooldown is cleared
    // explicitly: fifty-five seconds in, the rotation is very likely mid-GCD,
    // which refuses the cast and reports a spend of zero.
    simulation.advanceTo(seconds(55));
    player.gcdReadyAt = 0;
    rage.set(startingRage);

    // Only what THIS cast emitted; the list has been running for 55 seconds.
    const before = events.length;
    const result = castAbility(simulation, player, player.abilities.get('execute')!, target);
    expect(result, JSON.stringify(result)).toEqual({ ok: true });

    return { rage, events, spent: spends(events, 'rage', before) };
  }

  it('empties the bar, which was never the broken half', () => {
    const { rage } = castExecute(100);
    expect(rage.current).toBe(0);
  });

  it('EMITS the whole 100, not the declared 15', () => {
    const { spent } = castExecute(100);
    const total = spent.reduce((n, e) => n + e.amount, 0);

    /*
     * The number this file exists for. Before the fix this read 15: the engine
     * emitted the declared cost and the bare drain emitted nothing, so 85 rage
     * left the bar with no event behind it.
     */
    expect(total).toBe(100);
    expect(total).toBeGreaterThan(EXECUTE_BASE_COST);
  });

  it('attributes every point of it to Execute', () => {
    /*
     * Both halves name the ability, so the rage breakdown shows one Execute row
     * at its true cost rather than a small one plus an "Unattributed" slice.
     * `BatchTotals` labels a sourceless event rather than dropping it, so a
     * missing source would have been visible but wrong.
     */
    const { spent } = castExecute(100);
    expect(spent.length).toBeGreaterThanOrEqual(2);
    for (const event of spent) {
      expect(event.source).toBe('execute');
      expect(event.sourceName).toBe('Execute');
    }
  });

  it('scales with what was actually in the bar', () => {
    // Not a fixed expectation: the point is that the REMAINDER is reported, so
    // a fuller bar must report more. Both figures are above the declared 15.
    const low = castExecute(40).spent.reduce((n, e) => n + e.amount, 0);
    const high = castExecute(100).spent.reduce((n, e) => n + e.amount, 0);

    expect(low).toBe(40);
    expect(high).toBe(100);
    expect(high).toBeGreaterThan(low);
  });
});

describe('Ferocious Bite does the same with energy', () => {
  /*
   * LATENT RATHER THAN LIVE, and that is the only difference from Execute: no
   * Cat priority list casts Ferocious Bite, so its identical bare drain had
   * never had the chance to lose a number. It is tested here because an
   * untested silent bug in an ability nothing casts becomes a live one the day
   * a list reaches for it.
   */
  it('EMITS the whole bar, attributed to itself', () => {
    const { player, target, simulation, events } = fight(() =>
      createPlayer({
        race: 'tauren',
        characterClass: 'druid',
        combatStyle: 'cat',
        talents: legalise({ ferocious_bite: 1 }),
      }),
    );

    const bite = player.abilities.get('ferocious_bite');
    expect(bite, 'the Cat build knows Ferocious Bite').toBeDefined();

    // A finisher does nothing at zero combo points and returns before it
    // spends any energy, so the points have to be banked -- and banking them
    // by writing the pool means setting the TARGET too, or the finisher
    // refuses to spend.
    const points = player.resources.require('comboPoints');
    points.set(5);
    player.comboPointTargetId = target.id;

    const energy = player.resources.require('energy');
    energy.set(energy.maximum);
    player.gcdReadyAt = 0;

    const before = events.length;
    const result = castAbility(simulation, player, bite!, target);
    expect(result, JSON.stringify(result)).toEqual({ ok: true });

    const spent = spends(events, 'energy', before);
    const total = spent.reduce((n, e) => n + e.amount, 0);

    expect(energy.current).toBe(0);
    expect(total).toBe(energy.maximum);
    for (const event of spent) {
      expect(event.source).toBe('ferocious_bite');
      expect(event.sourceName).toBe('Ferocious Bite');
    }
  });
});

describe('nothing outside the engine drains a pool silently', () => {
  /*
   * THE STRUCTURAL HALF, and the reason it is here rather than being left to
   * the two cases above: this bug is a SHAPE, and the next ability with a
   * variable cost will reach for `Resource.drain` exactly as these two did
   * unless something refuses it.
   *
   * `Resource.drain` mutates the pool and emits nothing; `spendResource` does
   * both. Content may not call the first. The one exception is
   * `spendComboPoints`, whose no-context branch exists for callers that have no
   * simulation to emit into -- it is an `else`, and every real finisher takes
   * the other arm.
   */
  it('has no `.drain(` call in src/game outside the combo-point fallback', async () => {
    const { readFile, readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    async function walk(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(path)));
        else if (entry.name.endsWith('.ts')) out.push(path);
      }
      return out;
    }

    const offenders: string[] = [];
    for (const path of await walk('src/game')) {
      const text = await readFile(path, 'utf8');
      text.split('\n').forEach((line, i) => {
        if (!/\.drain\(/.test(line)) return;
        // The documented fallback, and nothing else.
        if (path.replace(/\\/g, '/').endsWith('src/game/combat/comboPoints.ts')) return;
        offenders.push(`${path}:${i + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
