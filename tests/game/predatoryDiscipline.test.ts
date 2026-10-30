import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Simulation, castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { FEROCIOUS_BITE_DAMAGE_PER_ENERGY } from '../../src/game/abilities/druid';
import { PREDATORY_DISCIPLINE_AURA, PREDATORY_DISCIPLINE_AURA_ID } from '../../src/game/auras/druid';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * PREDATORY DISCIPLINE (client build 1.60.1.70707): "Your Ferocious Bite
 * ability no longer converts extra Energy into damage, but still deals extra
 * damage based on your excess Energy."
 *
 * TWO HALVES AND BOTH ARE ASSERTED: the bite KEEPS the energy above its cost,
 * and deals the SAME damage it did when it spent it. The second is what makes
 * the talent worth pooling for, and a version that kept the energy and dropped
 * the bonus would pass a test of the first half alone.
 *
 * THE SAME CHARACTER CASTS BOTH BITES, with the marker aura applied and then
 * removed, so every other multiplier on the damage is identical and the
 * comparison is exact rather than a ratio somebody has to derive.
 * ==============================================================================
 */

const ALWAYS_HITS = { ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 };
const BITE_COST = 35;

function fight(build: () => Combatant) {
  const player = build();
  const target = createTrainingDummy({ name: 'Dummy', health: 1e9, armor: 0, level: 63 });
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    {
      durationMs: seconds(60),
      seed: 1,
      createCombatants: () => [player, target],
      attackChances: () => ALWAYS_HITS,
    },
    { emit: (event) => events.push(event) },
  );
  simulation.advanceTo(1);
  return { player, target, simulation, events };
}

function cat(talents: Record<string, number>): Combatant {
  return createPlayer({
    race: 'tauren',
    characterClass: 'druid',
    combatStyle: 'cat',
    talents: legalise(talents, 'druid'),
  });
}

/** One five-point bite at a full bar; returns its damage and what is left. */
function biteAtFullBar(
  setup: ReturnType<typeof fight>,
  at: number,
): { damage: number; energyLeft: number } {
  const { player, target, simulation, events } = setup;
  simulation.advanceTo(at);
  // Points banked by writing the pool have to name the target too, or the
  // finisher refuses to spend them.
  player.resources.require('comboPoints').set(5);
  player.comboPointTargetId = target.id;
  const energy = player.resources.require('energy');
  energy.set(energy.maximum);
  player.gcdReadyAt = 0;

  const from = events.length;
  const result = castAbility(simulation, player, player.abilities.get('ferocious_bite')!, target);
  expect(result, JSON.stringify(result)).toEqual({ ok: true });
  const damage = events
    .slice(from)
    .filter((e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === 'ferocious_bite')
    .reduce((n, e) => n + (e as unknown as { amount: number }).amount, 0);
  return { damage, energyLeft: energy.current };
}

describe('Predatory Discipline', () => {
  it('is a marker aura the talent grants and nothing else', () => {
    expect(DRUID_TALENT_EFFECTS.predatory_discipline).toEqual([
      { kind: 'grantAura', auraId: PREDATORY_DISCIPLINE_AURA_ID },
    ]);
    // No stat, no modifier: Ferocious Bite asks whether it is there.
    expect(PREDATORY_DISCIPLINE_AURA.statModifiers).toBeUndefined();
    expect(PREDATORY_DISCIPLINE_AURA.abilityModifiers).toBeUndefined();

    const { player } = fight(() => cat({ predatory_discipline: 1 }));
    expect(player.auras.has(PREDATORY_DISCIPLINE_AURA_ID)).toBe(true);
    const { player: without } = fight(() => cat({ shredding_attacks: 3 }));
    expect(without.auras.has(PREDATORY_DISCIPLINE_AURA_ID)).toBe(false);
  });

  it('keeps the excess energy and still deals the bonus for it', () => {
    const setup = fight(() => cat({ predatory_discipline: 1 }));
    const kept = biteAtFullBar(setup, seconds(2));

    setup.player.auras.remove(setup.simulation, PREDATORY_DISCIPLINE_AURA_ID);
    const spent = biteAtFullBar(setup, seconds(4));

    // A full bar of 100: the cost is paid either way, and only the talent
    // leaves the other 65 in the bar.
    expect(kept.energyLeft).toBe(100 - BITE_COST);
    expect(spent.energyLeft).toBe(0);
    // And the damage is the same bite: the 2.7 a point is read off the bar
    // whether or not the bar is then emptied.
    expect(kept.damage).toBeGreaterThan(0);
    expect(kept.damage).toBeCloseTo(spent.damage, 6);
  });

  it('pays 2.7 for every point above the cost, so a fuller bar bites harder', () => {
    const setup = fight(() => cat({ predatory_discipline: 1 }));
    const full = biteAtFullBar(setup, seconds(2));

    // The same bite at exactly the cost: no excess, no bonus.
    const { player, target, simulation, events } = setup;
    simulation.advanceTo(seconds(4));
    player.resources.require('comboPoints').set(5);
    player.comboPointTargetId = target.id;
    player.resources.require('energy').set(BITE_COST);
    player.gcdReadyAt = 0;
    const from = events.length;
    castAbility(simulation, player, player.abilities.get('ferocious_bite')!, target);
    const bare = events
      .slice(from)
      .filter((e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === 'ferocious_bite')
      .reduce((n, e) => n + (e as unknown as { amount: number }).amount, 0);

    // 2.7 is written out by hand as well as read, so a change to the constant
    // has to be made twice to pass. The difference carries the character's
    // blanket multipliers (Naturalist from the padding), so it is bounded
    // below by the raw figure rather than equal to it.
    expect(FEROCIOUS_BITE_DAMAGE_PER_ENERGY).toBe(2.7);
    const raw = (100 - BITE_COST) * 2.7;
    expect(full.damage - bare).toBeGreaterThanOrEqual(raw - 1e-6);
    expect(full.damage - bare).toBeLessThan(raw * 1.25);
  });
});
