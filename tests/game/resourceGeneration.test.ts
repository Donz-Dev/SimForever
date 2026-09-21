import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { TelemetryRecorder } from '../../src/engine/logging';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  ENERGY_PER_TICK,
  ENERGY_TICK_INTERVAL_MS,
  MANA_REGEN_LOCKOUT_MS,
  MANA_TICK_FRACTION,
  MANA_TICK_INTERVAL_MS,
  RAGE_CONVERSION_FACTOR,
  RAGE_PER_DAMAGE_DEALT,
  RAGE_PER_DAMAGE_TAKEN,
  manaPerTick,
} from '../../src/game/combat/resourceRules';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';

const warrior = () =>
  createPlayer({ race: 'orc', characterClass: 'warrior', combatStyle: 'two_hander' });
const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });
const mage = () => createPlayer({ race: 'gnome', characterClass: 'mage' });

describe('every resource has a current and a maximum', () => {
  it('reports both for rage, energy and mana', () => {
    const rage = warrior().resources.require('rage');
    expect(rage.current).toBeDefined();
    expect(rage.maximum).toBe(100);

    const energy = rogue().resources.require('energy');
    expect(energy.current).toBe(100);
    expect(energy.maximum).toBe(100);

    const mana = mage().resources.require('mana');
    expect(mana.maximum).toBeGreaterThan(0);
    expect(mana.current).toBe(mana.maximum);
  });

  it('gives a druid all three, each with its own pair', () => {
    const druid = createPlayer({ race: 'tauren', characterClass: 'druid' });
    for (const type of ['rage', 'energy', 'mana'] as const) {
      const pool = druid.resources.require(type);
      expect(pool.maximum, type).toBeGreaterThan(0);
      expect(pool.current, type).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('starting values', () => {
  it('starts rage at zero', () => {
    expect(warrior().resources.require('rage').current).toBe(0);
  });

  it('starts energy at maximum', () => {
    const energy = rogue().resources.require('energy');
    expect(energy.current).toBe(energy.maximum);
  });

  it('starts mana at maximum', () => {
    const mana = mage().resources.require('mana');
    expect(mana.current).toBe(mana.maximum);
  });
});

describe('rage', () => {
  it('uses the stated conversion factor', () => {
    expect(RAGE_CONVERSION_FACTOR).toBe(230.6);
    expect(RAGE_PER_DAMAGE_DEALT).toBeCloseTo(7.5 / 230.6, 10);
    expect(RAGE_PER_DAMAGE_TAKEN).toBeCloseTo(2.5 / 230.6, 10);
  });

  it('is worth three times as much to deal damage as to take it', () => {
    expect(RAGE_PER_DAMAGE_DEALT / RAGE_PER_DAMAGE_TAKEN).toBeCloseTo(3, 10);
  });

  it('generates in proportion to auto-attack damage only', () => {
    const player = warrior();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(60), seed: 5 });

    sim.advanceTo(seconds(30));

    // Only auto-attacks generate rage. Strike, Heroic Blow and Rending Wound
    // all deal damage and grant nothing.
    const autoNames = new Set(['Main Hand Auto-Attack', 'Off Hand Auto-Attack']);
    const autoDamage = sim.recordedTelemetry.reduce(
      (sum, event) =>
        event.type === 'damage' && event.sourceId === player.id && autoNames.has(event.abilityName)
          ? sum + event.amount
          : sum,
      0,
    );

    // Everything the pool was offered, including what the cap threw away.
    const offered = sim.recordedTelemetry.reduce(
      (sum, event) =>
        event.type === 'resource_gained' && event.resource === 'rage'
          ? sum + event.amount + event.wasted
          : sum,
      0,
    );

    expect(autoDamage).toBeGreaterThan(0);
    expect(offered).toBeCloseTo(autoDamage * RAGE_PER_DAMAGE_DEALT, 4);
  });

  it('balances as a ledger: gained minus spent is what is left', () => {
    const player = warrior();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(60), seed: 7 });

    sim.advanceTo(seconds(45));

    let gained = 0;
    let spent = 0;
    for (const event of sim.recordedTelemetry) {
      if (event.type === 'resource_gained' && event.resource === 'rage') gained += event.amount;
      if (event.type === 'resource_spent' && event.resource === 'rage') spent += event.amount;
    }

    expect(gained).toBeGreaterThan(0);
    expect(spent).toBeGreaterThan(0);
    expect(player.resources.require('rage').current).toBeCloseTo(gained - spent, 6);
  });

  it('generates nothing from ability damage', () => {
    const player = warrior();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(60), seed: 9 });
    sim.advanceTo(seconds(30));

    // Every rage gain sits immediately after an auto-attack in the stream.
    const stream = sim.recordedTelemetry;
    const autoNames = new Set(['Main Hand Auto-Attack', 'Off Hand Auto-Attack']);

    for (let i = 0; i < stream.length; i++) {
      const event = stream[i];
      if (event.type !== 'resource_gained' || event.resource !== 'rage') continue;

      const previous = stream[i - 1];
      expect(previous?.type).toBe('damage');
      if (previous?.type === 'damage') {
        expect(autoNames.has(previous.abilityName), previous.abilityName).toBe(true);
      }
    }
  });

  it('generates nothing from a swing that was avoided', () => {
    // Proportional generation with no flat component: a miss is worth zero.
    const player = warrior();
    const target = makeTarget({ maxHealth: 1_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(60) });
    sim.advanceTo(seconds(20));

    const avoided = sim.recordedTelemetry.filter(
      (event) =>
        event.type === 'damage' &&
        event.sourceId === player.id &&
        (event.outcome === 'miss' || event.outcome === 'dodge'),
    );
    const gains = sim.recordedTelemetry.filter(
      (event) => event.type === 'resource_gained' && event.resource === 'rage',
    );

    // Every rage gain corresponds to a landed hit, so there are strictly fewer
    // gains than damage events once anything was avoided.
    if (avoided.length > 0) {
      const damageEvents = sim.recordedTelemetry.filter(
        (event) => event.type === 'damage' && event.sourceId === player.id,
      );
      expect(gains.length).toBeLessThan(damageEvents.length);
    }
  });

  it('is stored as a decimal even though it displays as an integer', () => {
    /*
     * Asserted on the GAINS, not on the balance at an arbitrary moment.
     *
     * This used to read `current` six seconds in and require it to be non-zero
     * and fractional. Both were incidental: the balance is whatever the
     * rotation has not spent yet, so widening the Overpower window from five
     * seconds to six -- one more cast, five more rage spent -- took it to
     * exactly zero and failed a test about how rage is STORED.
     *
     * A gain is the thing that is fractional. Damage divided by 230.6
     * essentially never lands on a whole number, and that is true of every
     * gain regardless of what is spent afterwards.
     */
    const player = warrior();
    const target = makeTarget({ maxHealth: 1_000_000 });
    const recorder = new TelemetryRecorder();
    const sim = buildSimulation([player, target], {
      durationMs: seconds(60),
      seed: 11,
    }, recorder);
    sim.advanceTo(seconds(6));

    const gains = recorder.all.flatMap((event) =>
      event.type === 'resource_gained' && event.resource === 'rage' ? [event.amount] : [],
    );
    expect(gains.length).toBeGreaterThan(0);
    expect(gains.some((amount) => !Number.isInteger(amount))).toBe(true);
  });

  it('caps at the maximum', () => {
    const player = warrior();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(600), seed: 3 });
    sim.advanceTo(seconds(600));

    const rage = player.resources.require('rage');
    expect(rage.current).toBeLessThanOrEqual(rage.maximum);
  });

  it('does not regenerate on a timer', () => {
    // Rage is earned by fighting, never granted by the clock.
    expect(warrior().regeneration.map((regen) => regen.resource)).not.toContain('rage');
  });

  it('is generated by taking damage', () => {
    const player = warrior();
    expect(player.resourceOnDamageTaken).toMatchObject({
      resource: 'rage',
      perDamage: RAGE_PER_DAMAGE_TAKEN,
    });
  });

  it('gives no damage-taken rage to classes without a rage pool', () => {
    expect(mage().resourceOnDamageTaken).toBeUndefined();
    expect(rogue().resourceOnDamageTaken).toBeUndefined();
  });
});

describe('energy', () => {
  it('regenerates 20 every 2 seconds', () => {
    expect(ENERGY_PER_TICK).toBe(20);
    expect(ENERGY_TICK_INTERVAL_MS).toBe(seconds(2));
  });

  it('ticks on schedule', () => {
    const player = rogue();
    const energy = player.resources.require('energy');
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });

    // Drain it so the ticks have somewhere to land.
    energy.spend(100);
    expect(energy.current).toBe(0);

    sim.advanceTo(seconds(1));
    expect(energy.current).toBe(0); // no tick yet

    sim.advanceTo(seconds(2));
    expect(energy.current).toBe(20);

    sim.advanceTo(seconds(6));
    expect(energy.current).toBe(60);

    sim.advanceTo(seconds(10));
    expect(energy.current).toBe(100);
  });

  it('stops at the cap rather than overflowing', () => {
    const player = rogue();
    const energy = player.resources.require('energy');
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });

    sim.advanceTo(seconds(30));
    expect(energy.current).toBe(energy.maximum);
  });

  it('is not affected by spending, unlike mana', () => {
    // There is no five second rule for energy.
    const player = rogue();
    const energy = player.resources.require('energy');
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });

    energy.spend(100);
    player.recordResourceSpend('energy', 0);

    sim.advanceTo(seconds(2));
    expect(energy.current).toBe(20);
  });
});

describe('mana', () => {
  it('ticks 40% of the five-second value every two seconds', () => {
    expect(MANA_TICK_INTERVAL_MS).toBe(seconds(2));
    // 0.4 is exactly 2/5: the tick is MP5 prorated to its interval.
    expect(MANA_TICK_FRACTION).toBeCloseTo(0.4, 10);
  });

  it('regenerates exactly the stated MP5 over five quiet seconds', () => {
    const player = mage();
    const mp5 = player.stats.get('manaPer5');
    expect(mp5).toBeGreaterThan(0);

    // Two and a half ticks per five seconds, so check over ten seconds.
    expect(manaPerTick(player, seconds(100)) * 5).toBeCloseTo(mp5 * 2, 6);
  });

  it('regenerates while it has not spent', () => {
    const player = mage();
    const mana = player.resources.require('mana');
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });

    mana.spend(1000);
    const before = mana.current;

    sim.advanceTo(seconds(2));
    expect(mana.current).toBeCloseTo(before + player.stats.get('manaPer5') * 0.4, 6);
  });

  describe('the five second rule', () => {
    it('grants nothing within five seconds of spending', () => {
      const player = mage();
      expect(manaPerTick(player, 0)).toBeGreaterThan(0);

      player.recordResourceSpend('mana', seconds(10));
      expect(manaPerTick(player, seconds(10))).toBe(0);
      expect(manaPerTick(player, seconds(12))).toBe(0);
      expect(manaPerTick(player, seconds(14.9))).toBe(0);
    });

    it('resumes exactly five seconds after the last spend', () => {
      const player = mage();
      player.recordResourceSpend('mana', seconds(10));

      expect(manaPerTick(player, seconds(15))).toBeCloseTo(
        player.stats.get('manaPer5') * MANA_TICK_FRACTION,
        6,
      );
    });

    it('uses a five second window', () => {
      expect(MANA_REGEN_LOCKOUT_MS).toBe(seconds(5));
    });

    it('does not suppress regeneration when a different resource was spent', () => {
      const druid = createPlayer({ race: 'tauren', characterClass: 'druid' });
      druid.recordResourceSpend('rage', seconds(10));
      // Spending rage says nothing about whether mana should be regenerating.
      expect(manaPerTick(druid, seconds(10))).toBeGreaterThan(0);
    });
  });

  describe('mana regen bypass', () => {
    it('grants nothing while casting with no bypass stat', () => {
      const player = mage();
      expect(player.stats.get('manaRegenBypass')).toBe(0);
      player.recordResourceSpend('mana', seconds(10));
      expect(manaPerTick(player, seconds(11))).toBe(0);
    });

    it('grants a proportional chunk with the stat', () => {
      const player = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        bonusStats: { manaRegenBypass: 30 },
      });
      player.recordResourceSpend('mana', seconds(10));

      const full = player.stats.get('manaPer5') * MANA_TICK_FRACTION;
      expect(manaPerTick(player, seconds(11))).toBeCloseTo(full * 0.3, 6);
    });

    it('grants the full amount at 100% bypass', () => {
      const player = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        bonusStats: { manaRegenBypass: 100 },
      });
      player.recordResourceSpend('mana', seconds(10));

      const full = player.stats.get('manaPer5') * MANA_TICK_FRACTION;
      expect(manaPerTick(player, seconds(11))).toBeCloseTo(full, 6);
    });

    it('does not exceed the full amount above 100%', () => {
      const player = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        bonusStats: { manaRegenBypass: 250 },
      });
      player.recordResourceSpend('mana', seconds(10));

      const full = player.stats.get('manaPer5') * MANA_TICK_FRACTION;
      expect(manaPerTick(player, seconds(11))).toBeCloseTo(full, 6);
    });
  });

  it('caps at maximum', () => {
    const player = mage();
    const mana = player.resources.require('mana');
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(120) });

    sim.advanceTo(seconds(100));
    expect(mana.current).toBe(mana.maximum);
  });

  it('gives no mana regeneration to a class without spirit-based MP5', () => {
    // A warrior has no mana pool at all, so no mana timer either.
    expect(warrior().regeneration.map((regen) => regen.resource)).not.toContain('mana');
  });
});

describe('caps can be raised by talents', () => {
  it('raises the rage cap', () => {
    const player = createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      resourceMaximums: { rage: 130 },
    });
    expect(player.resources.require('rage').maximum).toBe(130);
    // Still starts empty.
    expect(player.resources.require('rage').current).toBe(0);
  });

  it('raises the energy cap and still starts full at the new value', () => {
    const player = createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      resourceMaximums: { energy: 120 },
    });
    const energy = player.resources.require('energy');
    expect(energy.maximum).toBe(120);
    expect(energy.current).toBe(120);
  });

  it('leaves untouched resources at their default', () => {
    const druid = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      resourceMaximums: { rage: 130 },
    });
    expect(druid.resources.require('rage').maximum).toBe(130);
    expect(druid.resources.require('energy').maximum).toBe(100);
  });
});

describe('regeneration timers by class', () => {
  it('gives a rogue energy only', () => {
    expect(rogue().regeneration.map((regen) => regen.resource)).toEqual(['energy']);
  });

  it('gives a mage mana only', () => {
    expect(mage().regeneration.map((regen) => regen.resource)).toEqual(['mana']);
  });

  it('gives a warrior none at all', () => {
    expect(warrior().regeneration).toHaveLength(0);
  });

  it('gives a druid both energy and mana, but never rage', () => {
    const resources = createPlayer({ race: 'tauren', characterClass: 'druid' }).regeneration.map(
      (regen) => regen.resource,
    );
    expect(resources).toContain('energy');
    expect(resources).toContain('mana');
    expect(resources).not.toContain('rage');
  });

  it('runs each timer independently', () => {
    // A druid's energy and mana do not share a clock.
    const druid = createPlayer({ race: 'tauren', characterClass: 'druid' });
    const energy = druid.resources.require('energy');
    const mana = druid.resources.require('mana');
    const sim = buildSimulation([druid, makeTarget()], { durationMs: seconds(60) });

    energy.spend(100);
    mana.spend(1000);
    druid.recordResourceSpend('mana', 0);

    sim.advanceTo(seconds(2));

    // Energy ticked; mana is inside its lockout and did not.
    expect(energy.current).toBe(20);
    expect(mana.current).toBe(mana.maximum - 1000);
  });
});
