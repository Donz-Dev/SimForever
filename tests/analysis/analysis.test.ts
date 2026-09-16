import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../src/analysis';
import { DamageAnalyzer, percentile, summarize } from '../../src/analysis';
import type { ActorSnapshot, TelemetryEvent } from '../../src/engine';
import { seconds } from '../../src/engine';

const ACTORS: ActorSnapshot[] = [
  {
    id: 'player_1',
    name: 'Player',
    kind: 'player',
    faction: 'friendly',
    maxHealth: 1000,
    finalHealth: 1000,
    isAlive: true,
  },
  {
    id: 'boss_1',
    name: 'Boss',
    kind: 'enemy',
    faction: 'hostile',
    maxHealth: 100_000,
    finalHealth: 90_000,
    isAlive: true,
  },
];

function damage(
  sourceId: string,
  abilityName: string,
  amount: number,
  options: { critical?: boolean; overkill?: number } = {},
): TelemetryEvent {
  return {
    type: 'damage',
    timestamp: 0,
    sourceId,
    targetId: 'boss_1',
    abilityName,
    school: 'physical',
    amount,
    outcome: options.critical ? 'crit' : 'hit',
    critical: options.critical ?? false,
    mitigated: 0,
    absorbed: 0,
    overkill: options.overkill ?? 0,
    periodic: false,
  };
}

function input(telemetry: TelemetryEvent[], elapsedMs = seconds(10)): AnalysisInput {
  return { telemetry, actors: ACTORS, elapsedMs };
}

describe('DamageAnalyzer', () => {
  it('returns zeros for an empty stream', () => {
    const result = new DamageAnalyzer().analyze(input([]));
    expect(result.total).toBe(0);
    expect(result.dps).toBe(0);
    expect(result.byActor).toHaveLength(0);
  });

  it('totals damage and derives DPS from the elapsed time', () => {
    const result = new DamageAnalyzer().analyze(
      input([damage('player_1', 'Strike', 500), damage('player_1', 'Strike', 500)]),
    );

    expect(result.total).toBe(1000);
    expect(result.dps).toBe(100); // 1000 over 10 seconds
  });

  it('ignores damage dealt by hostile actors', () => {
    // A DPS sim measures player output; boss melee is a different question.
    const result = new DamageAnalyzer().analyze(
      input([damage('player_1', 'Strike', 500), damage('boss_1', 'Cleave', 9999)]),
    );

    expect(result.total).toBe(500);
    expect(result.byActor).toHaveLength(1);
  });

  it('breaks damage down per ability, largest first', () => {
    const result = new DamageAnalyzer().analyze(
      input([
        damage('player_1', 'Melee', 100),
        damage('player_1', 'Strike', 700),
        damage('player_1', 'Melee', 200),
      ]),
    );

    const abilities = result.byActor[0].abilities;
    expect(abilities.map((entry) => entry.abilityName)).toEqual(['Strike', 'Melee']);
    expect(abilities[0]).toMatchObject({ hits: 1, total: 700, average: 700, share: 0.7 });
    expect(abilities[1]).toMatchObject({ hits: 2, total: 300, average: 150, share: 0.3 });
  });

  it('computes the crit rate per ability', () => {
    const result = new DamageAnalyzer().analyze(
      input([
        damage('player_1', 'Strike', 100, { critical: true }),
        damage('player_1', 'Strike', 100, { critical: false }),
        damage('player_1', 'Strike', 100, { critical: false }),
        damage('player_1', 'Strike', 100, { critical: true }),
      ]),
    );

    expect(result.byActor[0].abilities[0].critRate).toBe(0.5);
  });

  it('accumulates overkill without counting it twice in the total', () => {
    const result = new DamageAnalyzer().analyze(
      input([damage('player_1', 'Strike', 500, { overkill: 200 })]),
    );

    expect(result.byActor[0].abilities[0].overkill).toBe(200);
    expect(result.total).toBe(500);
  });

  it('sorts actors by damage done', () => {
    const actors: ActorSnapshot[] = [
      ...ACTORS,
      { ...ACTORS[0], id: 'player_2', name: 'Second' },
    ];
    const result = new DamageAnalyzer().analyze({
      telemetry: [damage('player_1', 'Strike', 100), damage('player_2', 'Strike', 900)],
      actors,
      elapsedMs: seconds(10),
    });

    expect(result.byActor.map((actor) => actor.actorId)).toEqual(['player_2', 'player_1']);
  });
});

describe('summarize', () => {
  it('handles an empty sample set', () => {
    expect(summarize([])).toMatchObject({ count: 0, mean: 0, median: 0 });
  });

  it('computes mean, median, min and max', () => {
    const result = summarize([10, 20, 30, 40, 50]);
    expect(result).toMatchObject({ count: 5, mean: 30, median: 30, min: 10, max: 50 });
  });

  it('computes the standard deviation', () => {
    // Population sigma of [2, 4, 4, 4, 5, 5, 7, 9] is exactly 2.
    expect(summarize([2, 4, 4, 4, 5, 5, 7, 9]).standardDeviation).toBeCloseTo(2, 10);
  });

  it('reports zero deviation for identical samples', () => {
    const result = summarize([100, 100, 100]);
    expect(result.standardDeviation).toBe(0);
    expect(result.relativeError).toBe(0);
  });

  it('expresses relative error as a fraction of the mean', () => {
    const result = summarize([90, 110]);
    expect(result.mean).toBe(100);
    expect(result.relativeError).toBeCloseTo(0.1, 10);
  });

  it('reports percentiles', () => {
    const result = summarize(Array.from({ length: 101 }, (_unused, index) => index));
    expect(result.percentiles.p5).toBeCloseTo(5, 6);
    expect(result.percentiles.p95).toBeCloseTo(95, 6);
    expect(result.median).toBeCloseTo(50, 6);
  });
});

describe('percentile', () => {
  it('interpolates between samples', () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 10, 20], 0.25)).toBe(5);
  });

  it('handles trivial inputs', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
  });

  it('clamps out-of-range fractions', () => {
    expect(percentile([1, 2, 3], -1)).toBe(1);
    expect(percentile([1, 2, 3], 2)).toBe(3);
  });
});
