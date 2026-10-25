import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { EventPriority, Simulation, createEvent, seconds } from '../../src/engine';
import {
  START_AUTO_ATTACK_ABILITIES,
  START_AUTO_ATTACK_IDS,
} from '../../src/game/abilities/autoAttack';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { withStartAutoAttack } from '../../src/profiles/rotation';
import { migrateProfile } from '../../src/profiles/migrateProfile';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * START AUTO-ATTACK (round 65), the owner's action for every character.
 *
 * "When the simulator scans the start auto-attack action, it initiates the
 * swing timer 'countdown.' If the auto-attack has already been initiated then
 * the action is skipped - ensure that the actions are NOT continually
 * restarting the auto-attack swing timer such that an attack never happens."
 *
 * Timings are asserted exactly, on a scripted combatant, because the failure
 * this exists to prevent -- a start that resets the timer on every decision --
 * is a swing that never lands, and a sampled rate would only read it as low.
 * ==============================================================================
 */

const SWING_MS = seconds(2);
const START = new Map(START_AUTO_ATTACK_ABILITIES.map((ability) => [ability.id, ability]));
const MAIN_HAND = START.get(START_AUTO_ATTACK_IDS['main-hand'])!;
const RANGED = START.get(START_AUTO_ATTACK_IDS.ranged)!;

function swinger(): Combatant {
  return makeAttacker({
    autoAttack: 'main-hand',
    autoAttackOnPull: false,
    abilities: [...START_AUTO_ATTACK_ABILITIES],
    weapons: {
      mainHand: { name: 'Test Weapon', swingTimerMs: SWING_MS, baseDamage: 10, damageVariance: 0 },
      ranged: { name: 'Test Bow', swingTimerMs: SWING_MS, baseDamage: 10, damageVariance: 0 },
    },
  });
}

/** Run ten seconds, casting each `[at, ability]`, and report swings and casts. */
function fight(casts: readonly (readonly [number, typeof MAIN_HAND])[]) {
  const attacker = swinger();
  const simulation = buildSimulation([attacker, makeTarget()], { durationMs: seconds(10) });
  const results: boolean[] = [];
  for (const [at, ability] of casts) {
    simulation.events.schedule(
      at,
      createEvent('cast', EventPriority.Decision, (ctx) => {
        results.push(ctx.cast(attacker, ability, undefined).ok);
      }),
    );
  }
  const run = simulation.run();
  const swings = (name: string) =>
    run.telemetry
      .filter((event) => event.type === 'damage' && event.abilityName === name)
      .map((event) => event.timestamp);
  return { results, melee: swings('Main Hand Auto-Attack'), ranged: swings('Ranged Auto-Attack'), attacker };
}

describe('Start Auto-attack', () => {
  it('is what starts a swing: nothing swings without one', () => {
    expect(fight([]).melee).toEqual([]);
  });

  it('starts the countdown when it is cast, mid-fight', () => {
    expect(fight([[1000, MAIN_HAND]]).melee).toEqual([1000, 3000, 5000, 7000, 9000]);
  });

  it('is refused while that kind is running, so asking every half second never restarts the timer', () => {
    const casts = Array.from({ length: 16 }, (_, index) => [1000 + index * 500, MAIN_HAND] as const);
    const { results, melee } = fight(casts);
    expect(results[0]).toBe(true);
    expect(results.slice(1).every((ok) => !ok)).toBe(true);
    expect(melee).toEqual([1000, 3000, 5000, 7000, 9000]);
  });

  it('runs one kind at a time: starting the bow stops the melee weapon', () => {
    const { melee, ranged } = fight([
      [1000, MAIN_HAND],
      [4000, RANGED],
    ]);
    expect(melee).toEqual([1000, 3000]);
    expect(ranged[0]).toBeGreaterThanOrEqual(4000);
    expect(ranged.length).toBeGreaterThan(0);
  });

  it('is off the global cooldown and not blocked by one', () => {
    const attacker = swinger();
    const simulation = buildSimulation([attacker, makeTarget()]);
    simulation.begin();
    attacker.gcdReadyAt = seconds(30);
    expect(simulation.castRejection(attacker, MAIN_HAND, undefined)).toBeUndefined();
    expect(simulation.cast(attacker, MAIN_HAND, undefined).ok).toBe(true);
    expect(attacker.gcdReadyAt).toBe(seconds(30));
  });

  it('refuses a kind whose weapon is not held', () => {
    const attacker = makeAttacker({
      autoAttackOnPull: false,
      abilities: [...START_AUTO_ATTACK_ABILITIES],
      weapons: { mainHand: { name: 'Test Weapon', swingTimerMs: SWING_MS, baseDamage: 10, damageVariance: 0 } },
    });
    const simulation = buildSimulation([attacker, makeTarget()]);
    simulation.begin();
    expect(simulation.cast(attacker, RANGED, undefined).ok).toBe(false);
    expect(simulation.cast(attacker, START.get(START_AUTO_ATTACK_IDS['dual-wield'])!, undefined).ok).toBe(false);
  });
});

describe('a pre-combat Start Auto-attack', () => {
  it('has the weapons swing at T-0, as every character did before the action existed', () => {
    const profile = PRESETS_BY_ID.get('dw_fury')!.build();
    expect(profile.precombat).toContainEqual({ abilityId: START_AUTO_ATTACK_IDS['dual-wield'], secondsBefore: 0 });
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(trainingDummyEncounter(profile, 4242), { emit: (event) => events.push(event) });
    simulation.begin();
    simulation.advanceTo(seconds(1));
    const first = (name: string) =>
      events.find((event) => event.type === 'damage' && (event as { abilityName?: string }).abilityName === name);
    expect(first('Main Hand Auto-Attack')?.timestamp).toBe(0);
    expect(first('Off Hand Auto-Attack')?.timestamp).toBe(0);
  });

  it('is what a hand-built profile gets when its lists name none, and nothing else changes', () => {
    const preset = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const bare = { ...preset, precombat: (preset.precombat ?? []).filter((a) => !a.abilityId.startsWith('start_auto')) };
    const given = withStartAutoAttack(bare);
    expect(given.precombat).toContainEqual({ abilityId: START_AUTO_ATTACK_IDS['main-hand'], secondsBefore: 0 });
    // And a profile that already names one comes back as the same object.
    expect(withStartAutoAttack(given)).toBe(given);
  });

  it('is added by the version 18 migration, so a saved file still swings', () => {
    const preset = PRESETS_BY_ID.get('rogue_rupture')!.build();
    const strip = (list: typeof preset.precombat) => (list ?? []).filter((a) => !a.abilityId.startsWith('start_auto'));
    const old = {
      ...preset,
      version: 18,
      precombat: strip(preset.precombat),
      multiTarget: { ...preset.multiTarget!, precombat: strip(preset.multiTarget!.precombat) },
    };
    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const migrated = result.value as typeof preset;
    const start = { abilityId: START_AUTO_ATTACK_IDS['dual-wield'], secondsBefore: 0 };
    expect(migrated.precombat).toContainEqual(start);
    expect(migrated.multiTarget!.precombat).toContainEqual(start);
  });
});
