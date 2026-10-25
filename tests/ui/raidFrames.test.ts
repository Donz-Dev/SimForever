import { describe, expect, it } from 'vitest';
import type { ActorResult } from '../../src/analysis';
import type { TelemetryEvent } from '../../src/engine';
import { raidFrames } from '../../src/ui/charts/raidFrameSnapshots';
import { runHealerBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ROUND 62: raid frames, the raid healer's diagnostic. The replay is pinned on a
 * hand-built stream, then once on a real raid fight.
 */

function actor(id: string, name: string, party: number | undefined, tank = false): ActorResult {
  return {
    id,
    name,
    kind: 'summon',
    faction: 'friendly',
    maxHealth: 1000,
    finalHealth: 1000,
    isAlive: true,
    damageDone: 0,
    dps: 0,
    healingDone: 0,
    ...(party !== undefined ? { party } : {}),
    ...(tank ? { raidRole: 'tank' as const } : {}),
  };
}

const ACTORS = [
  actor('healer', 'Holy Pal', undefined),
  actor('r6', 'Raid 6', 2),
  actor('tank', 'Tank', 1, true),
  actor('r2', 'Raid 2', 1),
];

const event = (e: Record<string, unknown>) => e as unknown as TelemetryEvent;

describe('raid frames', () => {
  it('replays health at each step, in party order with the tank first, and leaves the healer out', () => {
    const timeline = [
      event({ type: 'damage', timestamp: 1000, targetId: 'tank', targetHealth: 400 }),
      event({ type: 'damage', timestamp: 2000, targetId: 'r6', targetHealth: 250 }),
      event({ type: 'heal', timestamp: 3000, targetId: 'tank', targetHealth: 900 }),
    ];
    const frames = raidFrames(ACTORS, timeline, 4000, 2000);
    expect(frames.map((f) => f.timeMs)).toEqual([0, 2000, 4000]);
    expect(frames[0].members.map((m) => [m.label, m.party])).toEqual([
      ['T', 1],
      ['2', 1],
      ['6', 2],
    ]);
    expect(frames[0].members.map((m) => m.health)).toEqual([1, 1, 1]);
    // An event AT the frame's time is in it.
    expect(frames[1].members.map((m) => m.health)).toEqual([0.4, 1, 0.25]);
    expect(frames[2].members.map((m) => m.health)).toEqual([0.9, 1, 0.25]);
  });

  it('marks a death in the frame after it, at full health once revived, and only there', () => {
    const timeline = [
      event({ type: 'damage', timestamp: 500, targetId: 'r2', targetHealth: 0 }),
      event({ type: 'death', timestamp: 500, actorId: 'r2', revived: true }),
    ];
    const frames = raidFrames(ACTORS, timeline, 4000, 2000);
    const r2 = frames.map((f) => f.members.find((m) => m.id === 'r2')!);
    expect(r2.map((m) => m.died)).toEqual([false, true, false]);
    expect(r2[1].health).toBe(1);
  });

  it("lists the healer's own auras on a member while they are up", () => {
    const timeline = [
      event({ type: 'aura_applied', timestamp: 100, sourceId: 'healer', targetId: 'tank', auraId: 'lights_vigil', auraName: "Light's Vigil" }),
      event({ type: 'aura_applied', timestamp: 100, sourceId: 'boss', targetId: 'tank', auraId: 'sunder', auraName: 'Sunder' }),
      event({ type: 'aura_removed', timestamp: 3000, sourceId: 'healer', targetId: 'tank', auraId: 'lights_vigil', auraName: "Light's Vigil" }),
    ];
    const frames = raidFrames(ACTORS, timeline, 4000, 2000, 'healer');
    const tank = frames.map((f) => f.members[0].auras);
    expect(tank).toEqual([[], ["Light's Vigil"], []]);
  });

  it('draws all twenty of a real raid healer fight, five to a party', () => {
    const base = PRESETS_BY_ID.get('holy_pal')!.build();
    const batch = runHealerBatch({ ...base, simulation: { ...base.simulation, iterations: 1 } }, 'raid');
    const fight = batch.representative;
    const frames = raidFrames(fight.actors, fight.timeline, fight.durationMs, 2000, batch.playerId);
    expect(frames.length).toBe(Math.floor(fight.durationMs / 2000) + 1);
    expect(frames[0].members).toHaveLength(20);
    expect(new Set(frames[0].members.map((m) => m.party)).size).toBe(4);
    expect(frames[0].members[0].label).toBe('T');
    // Somebody is hurt after the first raid pulse at 5 seconds (round 70).
    expect(frames[3].members.some((m) => m.health < 1)).toBe(true);
  });
});
