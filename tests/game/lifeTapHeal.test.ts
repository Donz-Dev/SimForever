import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import {
  LIFE_TAP,
  LIFE_TAP_AMOUNT,
  LIFE_TAP_HEAL_DELAY_MS,
  LIFE_TAP_HEAL_NAME,
} from '../../src/game/abilities/warlock';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * THE OWNER'S RULING: "after damage is taken from a life tap, the same amount
 * is restored 1 second later" -- a group player heals it off.
 */
function tapper() {
  const events: TelemetryEvent[] = [];
  const actor = makeAttacker({
    autoAttack: 'none',
    abilities: [LIFE_TAP],
    maxHealth: 10_000,
    resources: [{ type: 'mana', maximum: 10_000 }],
  });
  const target = makeTarget();
  const simulation = buildSimulation([actor, target], { durationMs: seconds(30) }, {
    emit: (e: TelemetryEvent) => events.push(e),
  });
  simulation.begin();
  actor.resources.get('mana')!.spend(9_000);
  return { actor, target, simulation, events };
}

describe('Life Tap is healed back by the group', () => {
  it('pays the health at the cast and gets it back exactly one second later', () => {
    // Written out by hand as well as from the constant.
    expect(LIFE_TAP_HEAL_DELAY_MS).toBe(1000);
    const { actor, target, simulation, events } = tapper();
    const full = actor.health.current;

    castAbility(simulation, actor, actor.abilities.get('life_tap')!, target);
    expect(full - actor.health.current).toBe(LIFE_TAP_AMOUNT);

    simulation.advanceTo(999);
    expect(full - actor.health.current).toBe(LIFE_TAP_AMOUNT);

    simulation.advanceTo(1000);
    expect(actor.health.current).toBe(full);

    const heals = events.filter((e) => e.type === 'heal');
    expect(heals).toHaveLength(1);
    expect(heals[0]).toMatchObject({
      timestamp: 1000,
      abilityName: LIFE_TAP_HEAL_NAME,
      amount: LIFE_TAP_AMOUNT,
      overhealing: 0,
    });
  });

  it('still charges the second tap of a pair inside the second, from health not yet returned', () => {
    const { actor, target, simulation } = tapper();
    const full = actor.health.current;
    const tap = actor.abilities.get('life_tap')!;

    castAbility(simulation, actor, tap, target);
    simulation.advanceTo(500);
    actor.resources.get('mana')!.spend(actor.resources.get('mana')!.current);
    // Past the global cooldown is not needed for the arithmetic: spend directly.
    tap.onCast!({ simulation, caster: actor, target, ability: tap } as never);
    expect(full - actor.health.current).toBe(2 * LIFE_TAP_AMOUNT);

    simulation.advanceTo(1000);
    expect(full - actor.health.current).toBe(LIFE_TAP_AMOUNT);
    simulation.advanceTo(1500);
    expect(actor.health.current).toBe(full);
  });

  it('leaves the Firelock at full health at the end of a long fight', () => {
    // Before the ruling the pool drained with every tap; now each tap is
    // returned a second later, so a fight that has not just tapped ends full.
    const profile = PRESETS_BY_ID.get('warlock_firelock')!.build();
    const long = { ...profile, simulation: { ...profile.simulation, durationSeconds: 180 } };
    const events: TelemetryEvent[] = [];
    const sim = new Simulation(trainingDummyEncounter(long, 7), { emit: (e) => events.push(e) });
    sim.run();
    const taps = events.filter((e) => e.type === 'cast' && (e as { abilityId: string }).abilityId === 'life_tap');
    const heals = events.filter((e) => e.type === 'heal' && (e as { abilityName: string }).abilityName === LIFE_TAP_HEAL_NAME);
    expect(taps.length).toBeGreaterThan(0);
    // Every tap is returned unless it landed in the fight's last second.
    const end = sim.clock.now();
    const returnable = taps.filter((t) => t.timestamp + LIFE_TAP_HEAL_DELAY_MS <= end);
    expect(heals.length).toBe(returnable.length);
  });
});
