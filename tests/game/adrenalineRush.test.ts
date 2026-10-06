import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import {
  ADRENALINE_RUSH,
  ADRENALINE_RUSH_DURATION_MS,
  ADRENALINE_RUSH_ENERGY_MULTIPLIER,
} from '../../src/game/auras/rogue';
import {
  ENERGY_PER_SECOND,
  ENERGY_PER_SMOOTH_TICK,
  ENERGY_TICK_INTERVAL_MS,
} from '../../src/game/combat/resourceRules';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * NO ENEMY in any of these, for the reason `resourceGeneration.test.ts` gives at
 * length: the Rogue has a priority list and would SPEND while the test watched
 * the bar fill, measuring the difference between two rates rather than one.
 */
const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });

describe('Adrenaline Rush doubles energy regeneration', () => {
  /*
   * ASSERTING THE MECHANISM, because the DPS was never the problem: the ability
   * was cast, spent its cooldown, applied its aura and reported 24.9% uptime
   * for the whole project while delivering no energy at all. An inert buff with
   * visible uptime is the hardest kind to notice -- the results page shows it
   * working -- so what is pinned here is the ENERGY, in a fight where nothing
   * else could have moved it.
   */
  it('delivers twice the energy over its window', () => {
    /*
     * TWO SIMULATIONS RATHER THAN TWO ACTORS: `createPlayer` numbers ids from a
     * counter per call, so a pair of Rogues in one fight are both `player_1` and
     * the engine refuses them. The comparison is the same either way, because
     * neither fight has anything in it but the bar filling.
     */
    const oneSecondFrom = (rush: boolean) => {
      const player = rogue();
      const energy = player.resources.require('energy');
      energy.spend(100);
      const sim = buildSimulation([player], { durationMs: seconds(60) });
      if (rush) sim.applyAura(player, ADRENALINE_RUSH, player.id);
      sim.advanceTo(seconds(1));
      return energy.current;
    };

    expect(oneSecondFrom(false)).toBe(ENERGY_PER_SECOND);
    expect(oneSecondFrom(true)).toBe(ENERGY_PER_SECOND * ADRENALINE_RUSH_ENERGY_MULTIPLIER);
  });

  it('is the RATE and not the cadence: each tick delivers twice as much', () => {
    /*
     * THE DISTINCTION THAT HAS ALREADY COST THIS PROJECT ONCE. Energy specified
     * as "1 energy 20 times a second" was read as a cadence change and doubled
     * every energy build -- see `ENERGY_PER_SMOOTH_TICK`. So "+100% energy
     * regeneration" is ten more energy a second, not forty ticks a second, and
     * one tick's worth of time is what tells the two readings apart.
     */
    const player = rogue();
    const energy = player.resources.require('energy');
    energy.spend(100);

    const sim = buildSimulation([player], { durationMs: seconds(60) });
    sim.applyAura(player, ADRENALINE_RUSH, player.id);

    sim.advanceTo(ENERGY_TICK_INTERVAL_MS);
    expect(energy.current).toBe(ENERGY_PER_SMOOTH_TICK * ADRENALINE_RUSH_ENERGY_MULTIPLIER);
  });

  it('stops when the aura does, so the window is a window', () => {
    const player = rogue();
    const energy = player.resources.require('energy');
    energy.spend(100);

    const sim = buildSimulation([player], { durationMs: seconds(60) });
    sim.applyAura(player, ADRENALINE_RUSH, player.id);

    // Fifteen seconds at twenty a second caps the pool long before it ends.
    sim.advanceTo(ADRENALINE_RUSH_DURATION_MS);
    expect(player.regenMultiplierFor('energy')).toBe(1);

    energy.spend(energy.current);
    sim.advanceTo(ADRENALINE_RUSH_DURATION_MS + seconds(1));
    expect(energy.current).toBe(ENERGY_PER_SECOND);
  });

  it('multiplies nothing a combatant has no aura for', () => {
    const player = rogue();
    expect(player.regenMultiplierFor('energy')).toBe(1);
    expect(player.regenMultiplierFor('mana')).toBe(1);
  });
});

describe('the reason it used to carry', () => {
  /*
   * A REASON MATCHED BY WORDING IS A TEST, and this one was not merely stale --
   * it was WRONG ABOUT THE ENGINE on the day it was written. It said "the engine
   * has no multiplier on it ... Needs a rate multiplier on ResourceRegen", while
   * `ResourceRegen.amountPerTick` had been `(actor, context) => number` from the
   * start and `createPet` was already multiplying a pet's focus through that
   * exact signature. The hook existed; nothing was pointed at it.
   *
   * So the sentence is banned rather than the id checked: anything else claiming
   * energy regeneration cannot be multiplied is making the same false claim.
   */
  it('is gone, and no Rogue ability makes it again', () => {
    for (const ability of ROGUE_ABILITIES) {
      const reason = ability.unmodelled ?? '';
      expect(reason).not.toMatch(/rate multiplier on ResourceRegen/i);
      expect(reason).not.toMatch(/energy arrives as a fixed batch/i);
    }
  });
});
