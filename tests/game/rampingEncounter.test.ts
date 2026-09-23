import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Combatant, Simulation } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import {
  BOSS_DAMAGE_RAMP,
  BOSS_DAMAGE_RAMP_MAX_STACKS,
  BOSS_SWING_DAMAGE_RAMP,
  PLACEHOLDER_BOSS_SWING_DAMAGE,
} from '../../src/game/encounters/raidBoss';
import {
  EXTERNAL_HEAL_INTERVAL_MS,
  EXTERNAL_HEAL_MAXIMUM,
  EXTERNAL_HEAL_MINIMUM,
} from '../../src/game/encounters/externalHealer';
import { CRUSADER } from '../../src/game/items/itemData';
import {
  CRUSADER_HEAL_MAXIMUM,
  CRUSADER_HEAL_MINIMUM,
} from '../../src/game/items/procs';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { createDefaultProfile } from '../../src/profiles';
import { runProfileBatch, runSimulation } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * A target that gets angrier, a healer who is not there, and a character who
 * can die more than once.
 *
 * Every figure written out by hand from the ruleset owner's words:
 *
 *   - the target opens at 5,000 a swing and each swing is 10% harder than the
 *     one before;
 *   - while the target attacks back, the character is healed for a random
 *     500 to 1,500 every second, up to their maximum hit points;
 *   - at zero hit points the character dies, is restored to full, and the
 *     target's ramp carries on unchanged. It may happen several times in one
 *     fight, and the deaths are reported.
 */

const tank = () => {
  const base = createDefaultProfile();
  return {
    ...base,
    character: {
      ...base.character,
      race: 'tauren' as const,
      combatStyle: 'one_hand_shield' as const,
      stance: 'defensive' as const,
    },
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    encounter: { ...base.encounter, targetAttacks: true },
    simulation: { ...base.simulation, iterations: 1, seed: 7 },
  };
};

const timelineOf = (seed: number, durationSeconds = 60): readonly TelemetryEvent[] => {
  const profile = tank();
  return runSimulation(
    trainingDummyEncounter({
      ...profile,
      simulation: { ...profile.simulation, seed, durationSeconds },
    } as never),
  ).timeline;
};

/**
 * The target swinging at a post with no armor, no rotation and nothing to say.
 *
 * For measuring what the TARGET swings for, with nothing on the defending side
 * able to move the number.
 */
const bareSwings = (seed: number) => {
  const post = new Combatant({
    id: 'post_1',
    name: 'Post',
    kind: 'player',
    faction: 'friendly',
    level: 60,
    maxHealth: 1_000_000,
    // No armor at all, so what lands IS what was swung for.
    stats: { armor: 0 },
    survivesLethalDamage: true,
  });

  const run = runSimulation({
    durationMs: 20_000,
    seed,
    createCombatants: () => [post, createTrainingDummy({ attacks: true })],
  });

  return bossSwings(run.timeline);
};

const bossSwings = (timeline: readonly TelemetryEvent[]) =>
  timeline.filter(
    (event): event is Extract<TelemetryEvent, { type: 'damage' }> =>
      event.type === 'damage' && event.sourceId === 'dummy_1' && !event.periodic,
  );

// ---------------------------------------------------------------------------
// The ramp
// ---------------------------------------------------------------------------

describe('the target opens harder', () => {
  it('swings for five thousand, not four', () => {
    /*
     * Written out rather than read from the constant. The old figure was
     * 4,000, and the only thing that says it should now be 5,000 is the
     * ruleset owner.
     */
    expect(PLACEHOLDER_BOSS_SWING_DAMAGE).toBe(5000);
    expect(createTrainingDummy({ attacks: true }).weapons.mainHand?.baseDamage).toBe(5000);
    expect(createDefaultProfile().encounter.targetSwingDamage).toBe(5000);
  });
});

describe('the damage ramp', () => {
  it('is ten percent, compounding', () => {
    expect(BOSS_SWING_DAMAGE_RAMP).toBe(0.1);
    expect(BOSS_DAMAGE_RAMP.damageDoneMultiplier).toBe(1.1);
    /*
     * COMPOUNDING is this flag. Without it the aura would be worth 1.1 at any
     * stack count and the whole ramp would be one ten percent step -- which
     * looks like a working mechanic in a log and is not one.
     */
    expect(BOSS_DAMAGE_RAMP.modifiersScaleWithStacks).toBe(true);
    expect(BOSS_DAMAGE_RAMP.durationMs).toBe(0);
  });

  it('raises the multiplier to the power of the swing count', () => {
    const boss = createTrainingDummy({ attacks: true });
    const simulation = new Simulation({
      durationMs: 1000,
      seed: 1,
      createCombatants: () => [boss],
    });

    // Hand-computed: five swings in, the sixth lands for 1.1^5 = 1.61051.
    for (let stacks = 1; stacks <= 5; stacks++) {
      simulation.applyAura(boss, BOSS_DAMAGE_RAMP, boss.id);
      expect(boss.damageDoneMultiplier).toBeCloseTo(1.1 ** stacks, 10);
    }
    expect(boss.damageDoneMultiplier).toBeCloseTo(1.61051, 10);
  });

  it('adds exactly one stack per swing, avoided swings included', () => {
    /*
     * "Every time the target swings" counts a swing the tank dodged. Keying it
     * on damage LANDING would let a tank freeze the ramp by avoiding well,
     * which is the opposite of what the mechanic is for -- and would make an
     * avoidance talent read as a damage reduction several times its real size.
     */
    const timeline = timelineOf(11);
    const swings = bossSwings(timeline);
    const avoided = swings.filter((event) => event.amount === 0);
    expect(avoided.length).toBeGreaterThan(0);

    const stacked = timeline.filter(
      (event) => event.type === 'aura_stacks_changed' && event.auraId === 'boss_damage_ramp',
    );
    const applied = timeline.filter(
      (event) => event.type === 'aura_applied' && event.auraId === 'boss_damage_ramp',
    );
    // One application, then one stack event for every swing after it.
    expect(applied).toHaveLength(1);
    expect(stacked.length + applied.length).toBe(swings.length);
  });

  it('leaves the FIRST swing unramped', () => {
    /*
     * Asserted on the ORDER of the events rather than on the damage, because
     * the damage cannot answer it: a swing passes through armor, Defensive
     * Stance and possibly a block on its way to the log, and no arithmetic on
     * the far side of all three separates "not ramped yet" from "mitigated a
     * bit more than usual".
     *
     * The order does answer it exactly. Reactions run after the damage has
     * landed and been reported, so the first stack cannot exist until the
     * first swing is already resolved.
     */
    const timeline = timelineOf(101, 10);
    const firstSwing = timeline.findIndex(
      (event) => event.type === 'damage' && event.sourceId === 'dummy_1',
    );
    const firstStack = timeline.findIndex(
      (event) => event.type === 'aura_applied' && event.auraId === 'boss_damage_ramp',
    );

    expect(firstSwing).toBeGreaterThanOrEqual(0);
    expect(firstStack).toBeGreaterThan(firstSwing);
    // Same instant, next event: the swing is what applies it.
    expect(timeline[firstStack].timestamp).toBe(timeline[firstSwing].timestamp);
  });

  it('makes each swing ten percent harder than the last', () => {
    /*
     * Measured rather than read off the aura: swing four over swing one is
     * 1.1^3 = 1.331.
     *
     * AGAINST A BARE TARGET, not the tank profile. This ran through a real
     * character once and broke the day the tank list learned to cast Shield
     * Wall: sixty percent off damage taken lands on `amount` and not on
     * `mitigated`, so swing four was measured through a damage reduction
     * swing one never saw, and the ratio read 1.12. Anything the defender
     * does is noise in a measurement of what the ATTACKER swings for.
     *
     * So: no armor, no stance, no rotation, no health worth speaking of, and
     * only plain hits -- a crit or a crush would multiply one sample and not
     * its neighbour.
     */
    const swungFor = (index: number) => {
      const samples: number[] = [];
      for (let seed = 0; seed < 150; seed++) {
        const swing = bareSwings(seed)[index];
        if (swing && swing.outcome === 'hit') samples.push(swing.amount);
      }
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    };

    expect(swungFor(3) / swungFor(0)).toBeCloseTo(1.331, 1);
  });

  it('caps, so a very long fight cannot climb forever', () => {
    // A cap on the MODEL, not a rule. It only binds far past anything anyone
    // survives, and exists so the number stays a number.
    expect(BOSS_DAMAGE_RAMP.maxStacks).toBe(BOSS_DAMAGE_RAMP_MAX_STACKS);
  });

  it('does not ramp a target that stands still', () => {
    expect(createTrainingDummy().reactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The healer
// ---------------------------------------------------------------------------

describe('the assumed healer', () => {
  it('heals once a second', () => {
    expect(EXTERNAL_HEAL_INTERVAL_MS).toBe(1000);

    const heals = timelineOf(21, 30).filter((event) => event.type === 'heal');
    // Thirty seconds of them, give or take the fight-length variance.
    expect(heals.length).toBeGreaterThanOrEqual(28);
    expect(heals.length).toBeLessThanOrEqual(32);
  });

  it('heals between five hundred and fifteen hundred, every time', () => {
    /*
     * FILTERED TO THE HEALER'S OWN ABILITY ID, because it is no longer the
     * only thing healing this character. Crusader's enchant heals 75 to 125 on
     * proc, and the tank's starting set carries it -- so a filter on the event
     * type alone caught a 95 point Crusader tick and failed against a floor of
     * 500. It was right by luck until a change moved the random stream enough
     * for Crusader to proc inside this window.
     */
    const heals = timelineOf(22, 60).filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> =>
        event.type === 'heal' && event.abilityId === 'external_healer',
    );
    expect(heals.length).toBeGreaterThan(50);

    for (const heal of heals) {
      // What the healer CAST, before the character's missing health capped it.
      const raw = heal.amount + heal.overhealing;
      expect(raw).toBeGreaterThanOrEqual(EXTERNAL_HEAL_MINIMUM);
      expect(raw).toBeLessThanOrEqual(EXTERNAL_HEAL_MAXIMUM);
      expect(Number.isInteger(raw)).toBe(true);
    }
  });

  it('never crits, so fifteen hundred means fifteen hundred', () => {
    const heals = timelineOf(23, 60);
    expect(heals.some((event) => event.type === 'heal' && event.critical)).toBe(false);
  });

  it('stops at maximum hit points and calls the rest overhealing', () => {
    const heals = timelineOf(24, 60).filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> => event.type === 'heal',
    );
    expect(heals.some((heal) => heal.overhealing > 0)).toBe(true);
    expect(heals.every((heal) => heal.amount >= 0)).toBe(true);
  });

  it('rides on the character as a permanent aura', () => {
    /*
     * The character is named as the heal's source because telemetry needs one,
     * and `external` on the request is what stops that stand-in scaling the
     * incoming heal by the TANK's healing done and versatility. A warrior has
     * neither today, so that bug would be worth zero until something granted
     * one -- which is the kind that survives for a year.
     */
    const player = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
      externalHealing: true,
    });
    const healer = player.openingAuras.find((aura) => aura.id === 'external_healer');
    expect(healer).toBeDefined();
    expect(healer?.durationMs).toBe(0);
    expect(healer?.periodic?.intervalMs).toBe(EXTERNAL_HEAL_INTERVAL_MS);
  });

  it('is only there when the target attacks back', () => {
    const idle = runSimulation(trainingDummyEncounter(createDefaultProfile()));
    expect(idle.timeline.some((event) => event.type === 'heal')).toBe(false);
  });
});

describe("Crusader's heal, which was unmodelled until there was damage", () => {
  it('heals 75 to 125 on the same proc that grants the strength', () => {
    /*
     * Both figures are the enchant's own tooltip. Its reason for being
     * unmodelled was "Nothing damages the player, so a heal would restore
     * nothing" -- a claim about the engine on the day it was written, and
     * false from the day the target started killing people.
     */
    expect(CRUSADER_HEAL_MINIMUM).toBe(75);
    expect(CRUSADER_HEAL_MAXIMUM).toBe(125);
    expect(CRUSADER.unmodelled).toEqual([]);

    const profile = tank();
    const timeline = runSimulation(
      trainingDummyEncounter({
        ...profile,
        equipment: {
          ...profile.equipment,
          mainHand: { itemId: 228265, enchantId: 20034 },
        },
        simulation: { ...profile.simulation, seed: 41 },
      } as never),
    ).timeline;

    const crusader = timeline.filter(
      (event): event is Extract<TelemetryEvent, { type: 'heal' }> =>
        event.type === 'heal' && event.abilityId === 'crusader',
    );
    expect(crusader.length).toBeGreaterThan(0);

    for (const heal of crusader) {
      const raw = heal.amount + heal.overhealing;
      expect(raw).toBeGreaterThanOrEqual(CRUSADER_HEAL_MINIMUM);
      expect(raw).toBeLessThanOrEqual(CRUSADER_HEAL_MAXIMUM);
    }

    // One heal per proc, and a proc is what applies Holy Strength.
    const procs = timeline.filter(
      (event) => event.type === 'aura_applied' && event.auraId === 'holy_strength_mainHand',
    );
    expect(crusader.length).toBeGreaterThanOrEqual(procs.length);
  });
});

// ---------------------------------------------------------------------------
// Dying
// ---------------------------------------------------------------------------

describe('dying', () => {
  it('restores the character to full and does not end the fight', () => {
    const simulation = new Simulation(trainingDummyEncounter(tank() as never));
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.isPlayerControlled) as Combatant;

    player.health.drain(player.health.maximum);
    expect(player.health.current).toBe(0);

    simulation.killCombatant(player);

    expect(player.health.current).toBe(player.health.maximum);
    expect(player.isAlive).toBe(true);
    /*
     * NOT marked dead, even for an instant. Marking it would make every
     * `isAlive` check between the death and the revive read false, which
     * inside one tick of the event loop cancels the character's own swings and
     * skips the reactions the killing blow was meant to trigger.
     */
    expect(player.isDeathProcessed).toBe(false);
  });

  it('keeps the auras up, the healer included', () => {
    /*
     * A real death drops every buff. This one deliberately does not: survival
     * is what is being measured, not a death-and-rebuff cycle, and dropping
     * them would switch off the healer at the exact moment it is needed.
     */
    const simulation = new Simulation(trainingDummyEncounter(tank() as never));
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.isPlayerControlled) as Combatant;
    expect(player.auras.stacksOf('external_healer')).toBe(1);

    player.health.drain(player.health.maximum);
    simulation.killCombatant(player);

    expect(player.auras.stacksOf('external_healer')).toBe(1);
  });

  it('happens more than once in a fight', () => {
    const deaths = timelineOf(31).filter((event) => event.type === 'death');
    expect(deaths.length).toBeGreaterThan(1);
  });

  it('does not reset the ramp', () => {
    /*
     * The ruleset owner's rule, and the reason a death is not a fresh pull:
     * the target keeps ramping through it. A ramp that reset would hand a
     * character an easier fight for dying.
     *
     * The stack count at the end equals the number of swings, deaths and all.
     */
    const timeline = timelineOf(32);
    expect(timeline.filter((event) => event.type === 'death').length).toBeGreaterThan(1);

    /*
     * `Extract` cannot narrow this one: all four aura events share a single
     * interface whose `type` is a union, so the aura member has no literal to
     * match on. The guard does the narrowing instead.
     */
    const isRampStack = (
      event: TelemetryEvent,
    ): event is TelemetryEvent & { stacks: number } =>
      event.type === 'aura_stacks_changed' &&
      'auraId' in event &&
      event.auraId === 'boss_damage_ramp';

    const stacks = timeline.filter(isRampStack).at(-1)?.stacks;
    expect(stacks).toBe(bossSwings(timeline).length);
  });

  it('is counted in the results, alongside the damage that caused it', () => {
    const profile = tank();
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, iterations: 40, seed: 5 },
    } as never);

    expect(batch.survival.deaths).toBeGreaterThan(1);
    expect(batch.survival.damageTaken).toBeGreaterThan(0);
    expect(batch.survival.healingReceived).toBeGreaterThan(0);
    /*
     * Most of the healer's output lands on a full health bar, because a revive
     * fills it. That is not a bug in the healer -- it is what the late fight
     * looks like once single swings exceed the whole health pool.
     */
    expect(batch.survival.overhealing).toBeGreaterThan(0);
  });

  it('reports nothing when the target stands still', () => {
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      simulation: { ...base.simulation, iterations: 5 },
    });
    expect(batch.survival.deaths).toBe(0);
    expect(batch.survival.damageTaken).toBe(0);
    expect(batch.survival.healingReceived).toBe(0);
  });
});
