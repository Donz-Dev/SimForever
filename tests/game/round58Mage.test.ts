import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import {
  FLAMESTRIKE,
  FLAMESTRIKE_CAST_MS,
  FLAMESTRIKE_DAMAGE,
  MAGE_ABILITIES,
} from '../../src/game/abilities/mage';
import {
  FLAMESTRIKE_DOT,
  FLAMESTRIKE_DOT_TOTAL,
  FLAMESTRIKE_TICK_INTERVAL_MS,
} from '../../src/game/auras/mage';
import {
  BLAST_WAVE_SP_COEFFICIENT,
  FLAMESTRIKE_SP_COEFFICIENT,
  FLAMESTRIKE_TICK_SP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { fingersOfFrost, improvedBlizzardMark } from '../../src/game/reactions/mageTalents';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * ROUND 58's Mage changes, each pinned on its MECHANISM.
 * ==============================================================================
 */

describe("the owner's coefficients", () => {
  it('gives Blast Wave 12.9%, and Flamestrike 15.7% on the hit and 12.2% a tick', () => {
    expect(BLAST_WAVE_SP_COEFFICIENT).toBe(0.129);
    expect(FLAMESTRIKE_SP_COEFFICIENT).toBe(0.157);
    expect(FLAMESTRIKE_TICK_SP_COEFFICIENT).toBe(0.122);
  });
});

describe('Flamestrike', () => {
  it("is the capture's rank 6: 990 mana, a 3 second cast, 381 to 465, and 332 over 8s in 83s", () => {
    expect(FLAMESTRIKE.cost).toEqual({ resource: 'mana', amount: 990 });
    expect(FLAMESTRIKE_CAST_MS).toBe(seconds(3));
    expect(FLAMESTRIKE_DAMAGE).toBe((381 + 465) / 2);
    expect(FLAMESTRIKE_DOT.durationMs).toBe(seconds(8));
    expect(FLAMESTRIKE_TICK_INTERVAL_MS).toBe(seconds(2));
    expect(FLAMESTRIKE_DOT_TOTAL / 4).toBe(83);
    expect(MAGE_ABILITIES).toContain(FLAMESTRIKE);
  });

  it('strikes every target and burns each one it lands on', () => {
    const preset = PRESETS_BY_ID.get('mage_fire')!.build();
    const profile = {
      ...preset,
      precombat: undefined,
      encounter: { ...preset.encounter, numberOfTargets: 3 },
      rotation: { source: 'custom' as const, name: 'probe', entries: [{ abilityId: 'flamestrike' }] },
    };
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(trainingDummyEncounter(profile, 5), { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.advanceTo(seconds(600));

    const enemies = simulation.combatants.filter((actor) => actor.faction === 'hostile');
    expect(enemies).toHaveLength(3);
    const hits = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'damage' }> =>
        event.type === 'damage' && event.abilityId === 'flamestrike' && !event.periodic,
    );
    const ticks = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'damage' }> =>
        event.type === 'damage' && event.abilityId === 'flamestrike' && event.periodic,
    );
    // The first cast strikes all three in one instant, each with its own roll.
    expect(hits.length).toBeGreaterThan(0);
    const first = hits.filter((event) => event.timestamp === hits[0].timestamp);
    expect(new Set(first.map((event) => event.targetId))).toEqual(new Set(enemies.map((e) => e.id)));
    // Every target the hit landed on burns.
    for (const target of new Set(first.filter((e) => e.amount > 0).map((e) => e.targetId))) {
      expect(ticks.some((event) => event.targetId === target)).toBe(true);
    }
  });

  it('is reached by Improved Flamestrike, whose crit had nothing to land on before', () => {
    expect(MAGE_TALENT_EFFECTS.improved_flamestrike).toEqual([
      { kind: 'abilityCrit', abilityId: 'flamestrike' },
    ]);
  });
});

describe('Improved Blizzard makes Blizzard a chill for Fingers of Frost', () => {
  const always = { rng: { rollChance: () => true } } as never;
  const tick = { abilityId: 'blizzard' } as never;
  const actorWith = (castSequence: number, improved: boolean) =>
    ({
      castSequence,
      reactions: improved ? [improvedBlizzardMark()] : [],
    }) as never;

  it('rolls once per tick, not once per target the tick strikes', () => {
    const reaction = fingersOfFrost(2);
    // One tick strikes three targets: one castSequence, three damage events.
    expect([0, 1, 2].map(() => reaction.canTrigger!(always, actorWith(10, true), tick))).toEqual([
      true,
      false,
      false,
    ]);
    // The next tick rolls again.
    expect(reaction.canTrigger!(always, actorWith(11, true), tick)).toBe(true);
  });

  it('does not roll on Blizzard without Improved Blizzard', () => {
    const reaction = fingersOfFrost(2);
    expect(reaction.canTrigger!(always, actorWith(10, false), tick)).toBe(false);
  });

  it('keeps the movement slow ruled out as a snare', () => {
    const effects = MAGE_TALENT_EFFECTS.improved_blizzard;
    expect(effects.some((effect) => effect.kind === 'reaction')).toBe(true);
    expect(effects.find((effect) => effect.kind === 'unmodelled')).toMatchObject({ scope: 'crowdControl' });
  });

  it('marks the character and does nothing else', () => {
    const mark = improvedBlizzardMark();
    expect(mark.id).toBe('improved_blizzard');
    expect(mark.canTrigger!(always, actorWith(1, true), tick)).toBe(false);
  });
});
