import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { SeededRNG, Simulation, armorReduction, resolveHealing, seconds } from '../../src/engine';
import { runHealerBatch } from '../../src/simulator';
import {
  HEALER_ID,
  HEALER_TANK_ARMOR_REDUCTION,
  HEALER_TANK_BOSS_SWING_DAMAGE,
  HEALER_TANK_HEALTH,
  HEALER_TANK_TABLE,
  PARTY_SIZE,
  RAID_MEMBER_HEALTH_MAX,
  RAID_MEMBER_HEALTH_MIN,
  RAID_PULSE_FIRST_MS,
  RAID_SIZE,
  RAID_TANK_HIT_FRACTION,
  TANK_ID,
  healerEncounter,
  healerTankArmor,
} from '../../src/simulator/healerEncounter';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { BENCHMARK_TEMPLATES, benchmarkItemsFor } from '../../src/game/items/benchmarkSets';
import { BENCHMARK_SETS, COST, casterWeaponSpellPower } from '../../src/game/items/benchmarkGear';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { MAX_CHARACTER_LEVEL } from '../../src/game/character';
import { PALADIN_HOLY } from '../../src/game/rotations/paladin';
import { healthTimeline } from '../../src/ui/charts/ResourceTimeline';
import { hasteMultiplierFrom } from '../../src/engine/combat/ratings';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * THE HEALER ARCHETYPE (rounds 52 and 53). Each block pins a MECHANISM rather
 * than a figure, because every heal coefficient is a `PLACEHOLDER_` and the
 * figures will move the day the owner states them.
 * ==============================================================================
 */

function fight(fightKind: 'tank' | 'raid', seed = 4242, smartHealing = true) {
  const preset = PRESETS_BY_ID.get('holy_pal')!.build();
  const { smartHealing: _dropped, ...asWritten } = preset.rotation;
  const profile = smartHealing ? preset : { ...preset, rotation: asWritten };
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(healerEncounter(profile, fightKind, seed), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  simulation.advanceTo(seconds(600));
  return { simulation, events };
}

type Damage = Extract<TelemetryEvent, { type: 'damage' }>;

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

describe('the stated tank (round 53)', () => {
  it('faces a boss whose base swing is 2,000, whatever the Encounter panel says (round 54)', () => {
    expect(HEALER_TANK_BOSS_SWING_DAMAGE).toBe(2_000);
    const boss = fight('tank').simulation.combatants.find((actor) => actor.faction === 'hostile')!;
    expect(boss.weapons.mainHand?.baseDamage).toBe(HEALER_TANK_BOSS_SWING_DAMAGE);
    expect(PRESETS_BY_ID.get('holy_pal')!.build().encounter.targetSwingDamage).not.toBe(2_000);
  });

  it('has 8,500 health in both fights', () => {
    for (const kind of ['tank', 'raid'] as const) {
      const tank = fight(kind).simulation.combatants.find((actor) => actor.id === TANK_ID)!;
      expect(tank.health.maximum, kind).toBe(HEALER_TANK_HEALTH);
    }
  });

  it("carries the armor that removes exactly the owner's 65%", () => {
    expect(armorReduction(healerTankArmor(), MAX_CHARACTER_LEVEL)).toBeCloseTo(HEALER_TANK_ARMOR_REDUCTION, 10);
    const { events } = fight('tank');
    const landed = events.find(
      (event): event is Damage => event.type === 'damage' && event.targetId === TANK_ID && event.outcome === 'hit',
    )!;
    expect(landed.mitigated / (landed.mitigated + landed.amount)).toBeCloseTo(HEALER_TANK_ARMOR_REDUCTION, 3);
  });

  it("is hit on the owner's table: 18 dodge, 10 parry, 15 crush, 2 crit, 55 hit", () => {
    const counts: Record<string, number> = {};
    let swings = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const event of fight('tank', seed).events) {
        if (event.type !== 'damage' || event.targetId !== TANK_ID) continue;
        counts[event.outcome] = (counts[event.outcome] ?? 0) + 1;
        swings += 1;
      }
    }
    expect(swings).toBeGreaterThan(800);
    // Nothing the table does not name: no miss, block or glance.
    expect(Object.keys(counts).sort()).toEqual(['crit', 'crush', 'dodge', 'hit', 'parry']);
    // Four standard errors of a binomial, so a correct table cannot fail it.
    for (const [outcome, percent] of Object.entries(HEALER_TANK_TABLE)) {
      const p = percent / 100;
      const tolerance = 4 * Math.sqrt((p * (1 - p)) / swings);
      expect(Math.abs((counts[outcome] ?? 0) / swings - p), outcome).toBeLessThan(tolerance);
    }
  });

  it('is stood back up at full the instant it dies, and the death is recorded', () => {
    const { events } = fight('tank');
    const deaths = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'death' }> =>
        event.type === 'death' && event.actorId === TANK_ID,
    );
    expect(deaths.length).toBeGreaterThan(0);
    expect(deaths.every((event) => event.revived === true)).toBe(true);
    // The health timeline reads full at every death.
    const points = healthTimeline(events, TANK_ID, HEALER_TANK_HEALTH);
    for (const death of deaths) {
      const at = points.filter((point) => point.timeMs === death.timestamp);
      expect(at[at.length - 1].value).toBe(100);
    }
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
      (event): event is Damage => event.type === 'damage' && hostile.has(event.sourceId) && event.amount > 0,
    );
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

  it('rolls the other nineteen a whole health from 4,500 to 6,500, differently each fight', () => {
    const raidHealth = (seed: number) =>
      fight('raid', seed)
        .simulation.combatants.filter((actor) => actor.party !== undefined && actor.raidRole !== 'tank')
        .map((actor) => actor.health.maximum);
    const first = raidHealth(1);
    expect(first).toHaveLength(RAID_SIZE - 1);
    for (const health of first) {
      expect(Number.isInteger(health)).toBe(true);
      expect(health).toBeGreaterThanOrEqual(RAID_MEMBER_HEALTH_MIN);
      expect(health).toBeLessThanOrEqual(RAID_MEMBER_HEALTH_MAX);
    }
    expect(new Set(first).size).toBeGreaterThan(10);
    expect(raidHealth(2)).not.toEqual(first);
    // A seed reproduces its raid.
    expect(raidHealth(1)).toEqual(first);
  });

  it("follows the owner's pattern: the tank every 2s for 30%, everybody every 15s", () => {
    const { simulation, events } = fight('raid');
    const tank = simulation.combatants.find((actor) => actor.raidRole === 'tank')!;
    const damage = events.filter((event): event is Damage => event.type === 'damage');

    const strikes = damage.filter((event) => event.abilityName === 'Boss Strike');
    expect(strikes.every((event) => event.targetId === tank.id)).toBe(true);
    expect(strikes[0].timestamp).toBe(seconds(2));
    expect(strikes[1].timestamp - strikes[0].timestamp).toBe(seconds(2));
    // 30% of the stated 8,500.
    expect(strikes[0].amount).toBeCloseTo(RAID_TANK_HIT_FRACTION * HEALER_TANK_HEALTH, 6);

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

  it('stands every raid member back up at full the instant they die', () => {
    const { simulation, events } = fight('raid');
    const deaths = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'death' }> => event.type === 'death',
    );
    expect(deaths.length).toBeGreaterThan(0);
    expect(deaths.every((event) => event.revived === true)).toBe(true);
    // Nobody heals is ever left dead at the end.
    for (const member of simulation.combatants.filter((actor) => actor.party !== undefined)) {
      expect(member.isAlive, member.id).toBe(true);
    }
  });
});

describe("the Holy Pal's list", () => {
  it("is the owner's four lines and the pre-cast, below the shared free entries", () => {
    const owner = PALADIN_HOLY.entries.filter((entry) =>
      ['holy_light', 'holy_shock', 'flash_of_light'].includes(entry.abilityId),
    );
    expect(owner.map((entry) => [entry.abilityId, entry.target?.kind])).toEqual([
      ['holy_light', 'tank'],
      ['holy_shock', 'tank'],
      ['flash_of_light', 'lowestHealth'],
      ['flash_of_light', 'tank'],
      ['holy_light', 'tank'],
    ]);
    // The pre-cast is last, unconditional, and cancels at 80% above 95%.
    const precast = owner[owner.length - 1];
    expect(precast.condition).toBeUndefined();
    expect(precast.cancel).toEqual({
      atFraction: 0.8,
      condition: { kind: 'health', on: 'target', compare: 'above', fraction: 0.95 },
    });
  });

  it('heals the tank with Holy Light and the raid with Flash of Light, with smart healing off', () => {
    const { events } = fight('raid', 4242, false);
    const heals = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> =>
        event.type === 'heal' && event.sourceId === HEALER_ID,
    );
    expect(heals.length).toBeGreaterThan(10);
    const holyLight = heals.filter((event) => event.abilityId === 'holy_light');
    expect(holyLight.length).toBeGreaterThan(0);
    expect(holyLight.every((event) => event.targetId === TANK_ID)).toBe(true);
    const raidFlashes = heals.filter(
      (event) => event.abilityId === 'flash_of_light' && event.targetId !== TANK_ID,
    );
    expect(raidFlashes.length).toBeGreaterThan(0);
  });

  it('ships with smart healing ON, the owner’s ask (round 54)', () => {
    expect(PALADIN_HOLY.smartHealing).toBe(true);
    expect(PRESETS_BY_ID.get('holy_pal')!.build().rotation.smartHealing).toBe(true);
  });

  it('under smart healing, aims every heal at the lowest health % member, tank included', () => {
    const { simulation, events } = fight('raid');
    const members = simulation.combatants.filter((actor) => actor.party !== undefined);
    const heals = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> =>
        event.type === 'heal' && event.sourceId === HEALER_ID,
    );
    // Holy Light, written for the tank, now reaches the raid too.
    expect(heals.some((event) => event.abilityId === 'holy_light' && event.targetId !== TANK_ID)).toBe(true);
    expect(heals.some((event) => event.abilityId === 'holy_light' && event.targetId === TANK_ID)).toBe(true);
    expect(new Set(heals.map((event) => event.targetId)).size).toBeGreaterThan(3);
    for (const heal of heals) expect(members.some((member) => member.id === heal.targetId)).toBe(true);
  });

  it('under smart healing, the target a cast went to was the lowest health % member when it started', () => {
    const { simulation, events } = fight('raid');
    // Replay health off the stream: every member opens full, and each event
    // carries the target's health after it.
    const maximum = new Map(
      simulation.combatants
        .filter((actor) => actor.party !== undefined)
        .map((actor) => [actor.id, actor.health.maximum] as const),
    );
    const health = new Map(maximum);
    const HEALS = new Set(['holy_light', 'flash_of_light', 'holy_shock']);
    let checked = 0;
    for (const event of events) {
      if (event.type === 'cast' && event.sourceId === HEALER_ID && HEALS.has(event.abilityId) && event.targetId) {
        const fraction = (id: string) => health.get(id)! / maximum.get(id)!;
        const lowest = Math.min(...[...maximum.keys()].map(fraction));
        expect(fraction(event.targetId)).toBeCloseTo(lowest, 6);
        checked += 1;
      }
      if ((event.type === 'damage' || event.type === 'heal') && event.targetHealth !== undefined && maximum.has(event.targetId)) {
        health.set(event.targetId, event.targetHealth);
      } else if (event.type === 'death' && event.revived && maximum.has(event.actorId)) {
        health.set(event.actorId, maximum.get(event.actorId)!);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('makes healing threat, and only the healer’s heals do', () => {
    const { events } = fight('tank');
    const threat = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'threat' }> =>
        event.type === 'threat' && event.cause === 'healing',
    );
    expect(threat.length).toBeGreaterThan(0);
    expect(threat.every((event) => event.sourceId === HEALER_ID)).toBe(true);
  });
});

describe('the pre-cast (round 53)', () => {
  it('cancels a Holy Light at 80% of its cast while the tank is above 95%, and spends no mana on it', () => {
    const { simulation, events } = fight('tank');
    const cancels = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'channel_interrupted' }> =>
        event.type === 'channel_interrupted' && event.sourceId === HEALER_ID,
    );
    expect(cancels.length).toBeGreaterThan(0);
    // The cast a cancel ended is the healer's last cast BEFORE it in the
    // stream -- by order, since the next pre-cast starts in the same instant.
    const castBefore = (cancel: TelemetryEvent) =>
      events
        .slice(0, events.indexOf(cancel))
        .filter((event) => event.type === 'cast' && event.sourceId === HEALER_ID)
        .at(-1)!;
    for (const cancel of cancels) {
      expect(cancel.abilityId).toBe('holy_light');
      // The cast it cancelled started 80% of a cast ago.
      const started = castBefore(cancel);
      expect(started.type === 'cast' && started.abilityId).toBe('holy_light');
      const elapsed = cancel.timestamp - started.timestamp;
      expect(elapsed).toBeGreaterThan(0);
      // The tank was still above 95% when it was asked.
      const health = healthTimeline(
        events.filter((event) => event.timestamp <= cancel.timestamp),
        TANK_ID,
        HEALER_TANK_HEALTH,
      ).at(-1)!;
      expect(health.value).toBeGreaterThan(95);
      // And it cost NOTHING (round 55): a pre-cast pays as it lands, so no
      // Holy Light spend sits anywhere between its start and its cancel, and
      // there is no refund to hand back.
      const between = events.slice(events.indexOf(started), events.indexOf(cancel) + 1);
      expect(
        between.some(
          (event) =>
            event.type === 'resource_spent' && event.actorId === HEALER_ID && event.source === 'holy_light',
        ),
      ).toBe(false);
      expect(
        events.some((event) => event.type === 'resource_gained' && event.source === 'holy_light_refund'),
      ).toBe(false);
      // A cancelled cast lands no heal.
      expect(
        events.some(
          (event) =>
            event.type === 'heal' && event.abilityId === 'holy_light' &&
            event.timestamp > started.timestamp && event.timestamp <= cancel.timestamp + 1,
        ),
      ).toBe(false);
    }
    // Asked at 80% of the hasted cast. Infusion of Light shortens some Holy
    // Lights, so the longest wait is 80% of an unshortened one and none is longer.
    const healer = simulation.combatants.find((actor) => actor.id === HEALER_ID)!;
    const fullCast = 2500 / hasteMultiplierFrom(healer.stats.effective);
    const waits = cancels.map((cancel) => cancel.timestamp - castBefore(cancel).timestamp);
    expect(Math.max(...waits)).toBeCloseTo(0.8 * fullCast, -1);
    for (const wait of waits) expect(wait).toBeLessThanOrEqual(Math.round(0.8 * fullCast) + 1);
  });

  it('charges a pre-cast that completes at the moment it lands, and only then', () => {
    const { events } = fight('tank');
    const landed = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> =>
        event.type === 'heal' && event.sourceId === HEALER_ID && event.abilityId === 'holy_light',
    );
    expect(landed.length).toBeGreaterThan(0);
    // Every Holy Light spend shares its instant with a Holy Light landing: the
    // list's only Holy Light lines are the pre-cast and line 1, and line 1 is
    // not a pre-cast -- so some spends are at the start of a cast and the
    // pre-cast's are at its end. What must never happen is a spend for a
    // cast that was then cancelled, which the test above covers; here, the
    // count of spends equals the count of Holy Lights that landed.
    const spends = events.filter(
      (event) => event.type === 'resource_spent' && event.actorId === HEALER_ID && event.source === 'holy_light',
    );
    expect(spends.length).toBe(landed.length);
  });

  it('lets a pre-cast finish when the tank has dropped by the time it is asked', () => {
    const { events } = fight('tank');
    const completed = events.filter(
      (event) => event.type === 'heal' && event.sourceId === HEALER_ID && event.abilityId === 'holy_light',
    );
    expect(completed.length).toBeGreaterThan(0);
  });
});

describe('a healer batch', () => {
  it('reports HPS, a healing breakdown, tank deaths and the healer’s own figures', () => {
    const base = PRESETS_BY_ID.get('holy_pal')!.build();
    const profile = { ...base, simulation: { ...base.simulation, iterations: 4 } };
    for (const kind of ['tank', 'raid'] as const) {
      const batch = runHealerBatch(profile, kind);
      expect(batch.playerId).toBe(HEALER_ID);
      expect(batch.hps.mean, kind).toBeGreaterThan(0);
      expect(batch.healing.length, kind).toBeGreaterThan(0);
      expect(batch.healing.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 6);
      expect(batch.stats?.healingPower ?? 0).toBeGreaterThan(0);
      expect(batch.tankDeaths, kind).toBeDefined();
      // The tank is one of those healed, so its deaths are inside the total.
      expect(batch.tankDeaths!).toBeLessThanOrEqual(batch.alliedDeaths);
      if (kind === 'tank') expect(batch.tankDeaths).toBe(batch.alliedDeaths);
    }
  }, 60_000);
});

describe('the health timeline', () => {
  it('reads health after each hit and heal, and full at a revive', () => {
    const events = [
      { type: 'damage', timestamp: 1000, targetId: 'x', targetHealth: 600 },
      { type: 'heal', timestamp: 1500, targetId: 'x', targetHealth: 900 },
      { type: 'damage', timestamp: 2000, targetId: 'x', targetHealth: 0 },
      { type: 'death', timestamp: 2000, actorId: 'x', revived: true },
      { type: 'damage', timestamp: 2500, targetId: 'y', targetHealth: 1 },
    ] as unknown as TelemetryEvent[];
    expect(healthTimeline(events, 'x', 1000)).toEqual([
      { timeMs: 0, value: 100 },
      { timeMs: 1000, value: 60 },
      { timeMs: 1500, value: 90 },
      { timeMs: 2000, value: 0 },
      { timeMs: 2000, value: 100 },
    ]);
  });
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

  it.each(['B55', 'E65', 'E75', 'E85'] as const)(
    '%s weapon carries healing power at the spell power figure x 0.86 / 0.45, and no spell power',
    (setId) => {
      const set = BENCHMARK_SETS.find((candidate) => candidate.id === setId)!;
      const weapon = benchmarkItemsFor(template, set).find(
        (item) => item.weapon !== null && item.inventoryType !== 'Ranged',
      )!;
      const stats = ITEMS_BY_ID.get(weapon.id)!.stats as Record<string, number>;
      expect(stats.spellPower ?? 0).toBe(0);
      const rebought = Math.floor(
        (casterWeaponSpellPower(set.quality, set.itemLevel) * COST['Spell Power']) / COST['Healing Power'],
      );
      // At least the re-bought figure; the healing floor may add its own share.
      expect(stats.healingPower).toBeGreaterThanOrEqual(rebought);
      if (setId === 'E65') expect(rebought).toBe(179);
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

describe('smart healing compiles', () => {
  it('replaces a friendly target and leaves an enemy-aimed entry alone', async () => {
    const { compileRotation } = await import('../../src/game/rotations/apl');
    const list = {
      name: 'x',
      smartHealing: true,
      entries: [{ abilityId: 'holy_light', target: { kind: 'tank' } as const }, { abilityId: 'judgement' }],
    };
    // A compiled rotation is opaque, so the check is that it builds and the
    // stored list is not mutated by doing so.
    expect(() => compileRotation(list)).not.toThrow();
    expect(list.entries[0].target).toEqual({ kind: 'tank' });
  });
});

describe('editing a pre-cast', () => {
  it('sets the check, and drops it rather than storing it empty', async () => {
    const { setCancel } = await import('../../src/ui/panels/aplEditing');
    const entries = [{ abilityId: 'holy_light' }];
    const cancel = { atFraction: 0.7, condition: { kind: 'health', on: 'target', compare: 'above', fraction: 0.9 } } as const;
    const set = setCancel(entries, 0, cancel);
    expect(set[0]).toEqual({ abilityId: 'holy_light', cancel });
    expect(setCancel(set, 0, undefined)).toEqual(entries);
  });
});
