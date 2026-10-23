import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { SeededRNG, Simulation, resolveHealing, seconds } from '../../src/engine';
import { runHealerBatch } from '../../src/simulator';
import {
  HEALER_ID,
  PARTY_SIZE,
  RAID_PULSE_FIRST_MS,
  RAID_SIZE,
  RAID_TANK_HIT_FRACTION,
  TANK_ID,
  healerEncounter,
} from '../../src/simulator/healerEncounter';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { BENCHMARK_TEMPLATES, benchmarkItemsFor } from '../../src/game/items/benchmarkSets';
import { BENCHMARK_SETS } from '../../src/game/items/benchmarkGear';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { PALADIN_HOLY } from '../../src/game/rotations/paladin';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * THE HEALER ARCHETYPE (round 52). Each block pins a MECHANISM rather than a
 * figure, because every heal coefficient is a `PLACEHOLDER_` and the figures
 * will move the day the owner states them.
 * ==============================================================================
 */

function fight(fightKind: 'tank' | 'raid', seed = 4242) {
  const profile = PRESETS_BY_ID.get('holy_pal')!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(healerEncounter(profile, fightKind, seed), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  simulation.advanceTo(seconds(600));
  return { simulation, events };
}

describe('a heal', () => {
  it('scales with HEALING power, and never with spell power', () => {
    const actor = makeAttacker({ autoAttack: 'none', stats: { spellPower: 500, healingPower: 100 } });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const healed = resolveHealing(
      { source: actor, target, abilityName: 'Test Heal', baseAmount: 1000, powerCoefficient: 0.5, canCrit: false },
      new SeededRNG(1),
    );
    expect(healed.raw).toBeCloseTo(1050, 6);
  });
});

describe('the healer encounters', () => {
  it('puts the tank first in the tank fight, so the boss swings at it', () => {
    const { simulation } = fight('tank');
    const friendlies = simulation.combatants.filter((actor) => actor.faction === 'friendly');
    expect(friendlies[0].id).toBe(TANK_ID);
    expect(friendlies[0].raidRole).toBe('tank');
    expect(friendlies.some((actor) => actor.id === HEALER_ID)).toBe(true);
  });

  it('hits the tank and nobody else in the tank fight', () => {
    const { simulation, events } = fight('tank');
    const hostile = new Set(
      simulation.combatants.filter((actor) => actor.faction === 'hostile').map((actor) => actor.id),
    );
    const hostileHits = events.filter(
      (event) => event.type === 'damage' && hostile.has(event.sourceId) && event.amount > 0,
    ) as Extract<TelemetryEvent, { type: 'damage' }>[];
    expect(hostileHits.length).toBeGreaterThan(10);
    expect(new Set(hostileHits.map((event) => event.targetId))).toEqual(new Set([TANK_ID]));
  });

  it('builds twenty to heal in five parties of five, the tank in party one', () => {
    const { simulation } = fight('raid');
    const members = simulation.combatants.filter((actor) => actor.party !== undefined);
    expect(members).toHaveLength(RAID_SIZE);
    for (let party = 1; party <= RAID_SIZE / PARTY_SIZE; party++) {
      expect(members.filter((member) => member.party === party)).toHaveLength(PARTY_SIZE);
    }
    const tank = members.find((member) => member.raidRole === 'tank')!;
    expect(tank.party).toBe(1);
    // The healer is not a member: nothing hits it and nothing aims at it.
    expect(members.some((member) => member.id === HEALER_ID)).toBe(false);
  });

  it("follows the owner's pattern: the tank every 2s for 30%, everybody every 15s", () => {
    const { simulation, events } = fight('raid');
    const tank = simulation.combatants.find((actor) => actor.raidRole === 'tank')!;
    const damage = events.filter((event) => event.type === 'damage') as Extract<
      TelemetryEvent,
      { type: 'damage' }
    >[];

    const strikes = damage.filter((event) => event.abilityName === 'Boss Strike');
    expect(strikes.every((event) => event.targetId === tank.id)).toBe(true);
    expect(strikes[0].timestamp).toBe(seconds(2));
    expect(strikes[1].timestamp - strikes[0].timestamp).toBe(seconds(2));
    // A strike while the tank is alive is 30% of its pool, before anything else.
    expect(strikes[0].amount).toBeCloseTo(RAID_TANK_HIT_FRACTION * tank.health.maximum, 0);

    const pulses = damage.filter((event) => event.abilityName === 'Raid Pulse');
    expect(pulses[0].timestamp).toBe(RAID_PULSE_FIRST_MS);
    expect(pulses.filter((event) => event.timestamp === RAID_PULSE_FIRST_MS)).toHaveLength(RAID_SIZE);
    // Four ticks after each opening hit: at 2, 4, 6 and 8 seconds.
    const ticks = damage.filter(
      (event) =>
        event.abilityName === 'Raid Pulse (tick)' &&
        event.timestamp > RAID_PULSE_FIRST_MS &&
        event.timestamp <= RAID_PULSE_FIRST_MS + seconds(8),
    );
    expect(new Set(ticks.map((event) => event.timestamp - RAID_PULSE_FIRST_MS))).toEqual(
      new Set([seconds(2), seconds(4), seconds(6), seconds(8)]),
    );
  });
});

describe("the Holy Pal's list", () => {
  it("is the owner's four lines, below the shared free entries", () => {
    const owner = PALADIN_HOLY.entries.filter((entry) =>
      ['holy_light', 'holy_shock', 'flash_of_light'].includes(entry.abilityId),
    );
    expect(owner.map((entry) => [entry.abilityId, entry.target?.kind])).toEqual([
      ['holy_light', 'tank'],
      ['holy_shock', 'tank'],
      ['flash_of_light', 'lowestHealth'],
      ['flash_of_light', 'tank'],
    ]);
  });

  it('heals the tank with Holy Light and the raid with Flash of Light', () => {
    const { events } = fight('raid');
    const heals = events.filter(
      (event) => event.type === 'heal' && event.sourceId === HEALER_ID,
    ) as Extract<TelemetryEvent, { type: 'heal' }>[];
    expect(heals.length).toBeGreaterThan(10);
    const holyLight = heals.filter((event) => event.abilityId === 'holy_light');
    expect(holyLight.length).toBeGreaterThan(0);
    expect(holyLight.every((event) => event.targetId === TANK_ID)).toBe(true);
    const raidFlashes = heals.filter(
      (event) => event.abilityId === 'flash_of_light' && event.targetId !== TANK_ID,
    );
    expect(raidFlashes.length).toBeGreaterThan(0);
  });

  it('makes healing threat, and only the healer’s heals do', () => {
    const { events } = fight('tank');
    const threat = events.filter(
      (event) => event.type === 'threat' && event.cause === 'healing',
    ) as Extract<TelemetryEvent, { type: 'threat' }>[];
    expect(threat.length).toBeGreaterThan(0);
    expect(threat.every((event) => event.sourceId === HEALER_ID)).toBe(true);
  });
});

describe('a healer batch', () => {
  it('reports HPS, a healing breakdown and the healer’s own figures', () => {
    const base = PRESETS_BY_ID.get('holy_pal')!.build();
    const profile = { ...base, simulation: { ...base.simulation, iterations: 4 } };
    for (const kind of ['tank', 'raid'] as const) {
      const batch = runHealerBatch(profile, kind);
      expect(batch.playerId).toBe(HEALER_ID);
      expect(batch.hps.mean, kind).toBeGreaterThan(0);
      expect(batch.healing.length, kind).toBeGreaterThan(0);
      expect(batch.healing.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 6);
      expect(batch.stats?.healingPower ?? 0).toBeGreaterThan(0);
    }
  }, 60_000);
});

describe("the Holy Pal's gear", () => {
  const template = BENCHMARK_TEMPLATES.find((candidate) => candidate.presetId === 'holy_pal')!;

  it.each(['B55', 'E65', 'E75', 'E85'] as const)(
    '%s floors healing power on every slot but a trinket, and stamina on the eight armour slots',
    (setId) => {
      const set = BENCHMARK_SETS.find((candidate) => candidate.id === setId)!;
      const items = benchmarkItemsFor(template, set);
      // A trinket is a one-stat slot by the existing rule, so it is left to compete.
      for (const item of items.filter((candidate) => candidate.inventoryType !== 'Trinket')) {
        const stats = ITEMS_BY_ID.get(item.id)!.stats as Record<string, number>;
        expect(stats.healingPower ?? 0, item.name).toBeGreaterThan(0);
      }
      const ARMOUR = ['Head', 'Shoulder', 'Chest', 'Wrist', 'Hands', 'Waist', 'Legs', 'Feet'];
      const armour = items.filter((item) => ARMOUR.includes(item.inventoryType));
      expect(armour).toHaveLength(8);
      for (const item of armour) {
        const stats = ITEMS_BY_ID.get(item.id)!.stats as Record<string, number>;
        expect(stats.stamina ?? 0, item.name).toBeGreaterThan(0);
      }
    },
  );

  it('lets intellect, spirit and crit compete rather than carrying all five everywhere', () => {
    const e65 = BENCHMARK_SETS.find((candidate) => candidate.id === 'E65')!;
    const items = benchmarkItemsFor(template, e65).map(
      (item) => ITEMS_BY_ID.get(item.id)!.stats as Record<string, number>,
    );
    const counts = items.map(
      (stats) =>
        ['stamina', 'intellect', 'spirit', 'critRating', 'healingPower'].filter(
          (stat) => (stats[stat] ?? 0) > 0,
        ).length,
    );
    expect(counts.some((count) => count < 5)).toBe(true);
    for (const stat of ['intellect', 'spirit', 'critRating']) {
      expect(items.some((stats) => (stats[stat] ?? 0) > 0), stat).toBe(true);
    }
  });
});
