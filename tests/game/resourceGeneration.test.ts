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
  RAGE_PER_MAXIMUM_HEALTH_TAKEN,
  RAGE_PER_SECOND_ONE_HAND,
  RAGE_PER_SECOND_TWO_HAND,
  manaPerTick,
  rageFromDamageTaken,
  rageFromSwing,
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
  /*
   * --------------------------------------------------------------------------
   * FOREVER'S FORMULAS, written out by hand from the ruleset owner's words:
   *
   *     dealing   rage = R x S     R = 3.46 one-hand, 4.5 two-hand
   *                                S = base weapon speed, before modifiers
   *     taking    rage = D x 10 / H   D = pre-armor damage, H = max health
   *
   * The old pair -- damage / 230.6 x 7.5 and x 2.5 -- are commented out in
   * `resourceRules.ts` rather than deleted, in case Forever changes back.
   * --------------------------------------------------------------------------
   */
  it('pays a flat amount per swing, from handedness and BASE speed', () => {
    expect(RAGE_PER_SECOND_ONE_HAND).toBe(3.46);
    expect(RAGE_PER_SECOND_TWO_HAND).toBe(4.5);

    // A 2.6 second one-hander and a 3.4 second two-hander, by hand.
    expect(rageFromSwing(2.6, false).flat).toBeCloseTo(8.996, 10);
    expect(rageFromSwing(3.4, true).flat).toBeCloseTo(15.3, 10);

    // Nothing about it scales with the damage the swing did.
    expect(rageFromSwing(2.6, false).perDamage).toBeUndefined();
  });

  it('earns nothing from a swing that missed', () => {
    /*
     * The rule is rage from damage DEALT. A flat award would otherwise pay out
     * on a miss, which is the one way a flat-per-swing rule differs from the
     * proportional one it replaced -- and the behaviour that makes a high-miss
     * build rage-starved as well as low-damage.
     */
    expect(rageFromSwing(2.6, false).requiresDamage).toBe(true);
  });

  it('is a RATE: speed cancels, so a fast weapon earns no more', () => {
    /*
     * R x S rage every S seconds is R rage per second whatever S is. Worth
     * asserting because it is the least obvious consequence of the change and
     * the one most likely to be "corrected" by someone who expects a fast
     * weapon to build rage faster.
     */
    for (const speed of [1.5, 2.6, 3.8]) {
      const perSwing = rageFromSwing(speed, false).flat!;
      expect(perSwing / speed).toBeCloseTo(RAGE_PER_SECOND_ONE_HAND, 10);
    }
  });

  it('pays TEN rage for a whole health bar taken, whatever the character', () => {
    /*
     * `D x 10 / H`, so D = H gives exactly 10 -- taking your entire maximum
     * health, in one blow or over a fight, is worth ten rage. A tenth of it is
     * worth one.
     *
     * THE SCALE IS EASY TO MISREAD, which is why it is asserted at both ends:
     * ten sounds like a lot until you notice what has to happen to earn it.
     * A tank still earns hundreds over a fight, because a ramping boss deals
     * many times their health bar.
     *
     * The same fraction whatever the character, which is the real change: the
     * old rule paid per point of damage, so stamina quietly cost rage.
     */
    expect(RAGE_PER_MAXIMUM_HEALTH_TAKEN).toBe(10);

    for (const maxHealth of [3000, 5106, 20_000]) {
      const perDamage = rageFromDamageTaken(maxHealth)!.perDamage!;
      expect(perDamage * maxHealth).toBeCloseTo(10, 10);
      expect(perDamage * (maxHealth / 10)).toBeCloseTo(1, 10);
    }

    // A character with no health pool has no rule to apply.
    expect(rageFromDamageTaken(0)).toBeUndefined();
  });

  it('pays the same rage per swing however hard the swing hit', () => {
    /*
     * --------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT THE OPPOSITE, and it was the clearest statement
     * of the old rule: total rage offered equalled total auto-attack damage
     * times a constant.
     *
     * Forever's rule has no damage term at all. What is checked instead is
     * that every main-hand award is the SAME number -- the weapon's `R x S` --
     * and that the swings it came from varied in damage, so the constancy is a
     * real property rather than an artifact of every swing hitting alike.
     * --------------------------------------------------------------------------
     */
    const player = warrior();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const sim = buildSimulation([player, target], { durationMs: seconds(60), seed: 5 });

    sim.advanceTo(seconds(30));

    const awards = sim.recordedTelemetry.filter(
      (event) =>
        event.type === 'resource_gained' &&
        event.resource === 'rage' &&
        event.source === 'auto_attack_main_hand',
    );
    expect(awards.length).toBeGreaterThan(3);

    // The placeholder two-hander is 3.4 seconds: 4.5 x 3.4 = 15.3.
    const expected = rageFromSwing(3.4, true).flat!;
    for (const award of awards) {
      if (award.type !== 'resource_gained') continue;
      expect(award.amount + award.wasted).toBeCloseTo(expected, 6);
    }

    // And the swings really did differ in damage, so the above means something.
    const autoDamage = sim.recordedTelemetry
      .filter(
        (event) =>
          event.type === 'damage' &&
          event.sourceId === player.id &&
          event.abilityName === 'Main Hand Auto-Attack' &&
          event.amount > 0,
      )
      .map((event) => (event.type === 'damage' ? event.amount : 0));
    expect(new Set(autoDamage).size).toBeGreaterThan(1);
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
      // Charge grants a flat 15 on cast, which is not damage converting to
      // rage and does not sit behind an auto-attack. See the note above.
      if (event.source === 'charge') continue;

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

  it('is generated by taking damage, at a rate set by THIS character health', () => {
    /*
     * Built per character now, because H is that character's maximum health.
     * Two warriors of different size earn different rage from the same blow,
     * and the same FRACTION of their health bar from it.
     */
    const player = warrior();
    expect(player.resourceOnDamageTaken?.resource).toBe('rage');
    expect(player.resourceOnDamageTaken?.perDamage).toBeCloseTo(
      RAGE_PER_MAXIMUM_HEALTH_TAKEN / player.health.maximum,
      12,
    );
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

describe('extra attacks pay a full swing of rage', () => {
  it('is what stops R x S being a clean rate, and favours a slow weapon', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ONE PLACE THE SPEED DOES NOT CANCEL, and it is easy to miss.
     *
     * `R x S` every `S` seconds is `R` per second -- but only for swings the
     * TIMER produced. A Windfury, Hand of Justice or Weaponmaster proc pays a
     * full `R x S` for a swing that consumed no time at all, because there is
     * no timer for the speed to cancel against.
     *
     * So the slower the weapon, the more each proc is worth. That is backwards
     * from the old rule, where a slow weapon was good for rage because it hit
     * hard; it is now good for rage because a proc is worth a whole slow swing.
     *
     * Caught while checking the 2H Arms preset in the browser: it draws about
     * 370 rage a minute from main-hand swings -- 6.2 a second against a 4.5
     * "floor" -- because roughly six of its twenty-three swings are procs.
     * ------------------------------------------------------------------------
     */
    // Obsidian Edged Blade is 3.6 seconds; Vis'kag is 2.6.
    const twoHandProc = rageFromSwing(3.6, true).flat!;
    const dualWieldProc = rageFromSwing(2.6, false).flat!;

    expect(twoHandProc).toBeCloseTo(16.2, 10);
    expect(dualWieldProc).toBeCloseTo(8.996, 10);
    expect(twoHandProc).toBeGreaterThan(dualWieldProc * 1.5);
  });
});
