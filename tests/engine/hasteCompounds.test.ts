import { describe, expect, it } from 'vitest';
import type { Ability, AuraDefinition, TelemetryEvent } from '../../src/engine';
import {
  RATING_PER_PERCENT,
  Simulation,
  StatBlock,
  applyHaste,
  castAbility,
  hasteMultiplierFrom,
  seconds,
} from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { foreverEnchantId } from '../../src/game/items/foreverEnchants';
import { flurryAura } from '../../src/game/auras/warriorTalents';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 63: every haste source multiplies. The owner's ruling -- "All Haste
 * effects are treated as individual sources and are multiplied together" -- and
 * their own worked example, a Windshaper Skyborne Fury Warrior with three haste
 * enchants, in Flurry:
 *
 *     1.03 x 1.01 x 1.01 x 1.01 x 1.25 = 1.3265, not an additive 1.31
 * ==============================================================================
 */

const rating = (percent: number) => percent * RATING_PER_PERCENT.haste;
const OWNER_EXAMPLE = 1.03 * 1.01 * 1.01 * 1.01 * 1.25;

describe('the stat block', () => {
  it('multiplies each haste modifier rather than adding them', () => {
    const block = new StatBlock();
    block.addModifiers(
      [3, 1, 1, 1, 25].map((percent, index) => ({
        sourceId: `s${index}`,
        stat: 'hasteRating' as const,
        operation: 'flat' as const,
        value: rating(percent),
      })),
    );
    expect(hasteMultiplierFrom(block.effective)).toBeCloseTo(OWNER_EXAMPLE, 10);
    expect(hasteMultiplierFrom(block.effective)).not.toBeCloseTo(1.31, 3);
  });

  it('counts the base as one source, and a slow multiplies too', () => {
    const block = new StatBlock({ hasteRating: rating(20) });
    block.addModifiers([{ sourceId: 'slow', stat: 'hasteRating', operation: 'flat', value: rating(-10) }]);
    expect(hasteMultiplierFrom(block.effective)).toBeCloseTo(1.2 * 0.9, 10);
  });

  it('gives a source back exactly when it comes off', () => {
    const block = new StatBlock();
    block.addModifiers([{ sourceId: 'a', stat: 'hasteRating', operation: 'flat', value: rating(10) }]);
    block.addModifiers([{ sourceId: 'b', stat: 'hasteRating', operation: 'flat', value: rating(40) }]);
    block.removeModifiersFrom('b');
    expect(hasteMultiplierFrom(block.effective)).toBeCloseTo(1.1, 10);
  });

  it('leaves every other stat adding up as before', () => {
    const block = new StatBlock({ strength: 100 });
    block.addModifiers([
      { sourceId: 'a', stat: 'strength', operation: 'flat', value: 10 },
      { sourceId: 'b', stat: 'strength', operation: 'flat', value: 10 },
    ]);
    expect(block.effective.strength).toBe(120);
  });
});

/** The owner's character: Windshaper Skyborne DW Fury, "+1% Haste" on head, gloves and legs. */
function ownerExample(options: { readonly talents?: boolean } = {}) {
  const base = PRESETS_BY_ID.get('dw_fury')!.build();
  const haste = foreverEnchantId('+1% Haste');
  const equipment = { ...base.equipment };
  for (const slot of ['head', 'gloves', 'legs'] as const) {
    equipment[slot] = { ...equipment[slot]!, enchantId: haste };
  }
  return {
    ...base,
    character: { ...base.character, race: 'windshaper_skyborne' as const },
    equipment,
    ...(options.talents === false ? { talents: {} } : {}),
    precombat: [],
  };
}

describe("the owner's example, built", () => {
  it('reads 1.03 x 1.01^3 out of Flurry and 1.3265 in it', () => {
    const simulation = new Simulation(trainingDummyEncounter(ownerExample(), 1));
    const player = simulation.combatants.find((actor) => actor.kind === 'player')!;
    expect(hasteMultiplierFrom(player.stats.effective)).toBeCloseTo(1.03 * 1.01 * 1.01 * 1.01, 10);
    simulation.begin();
    simulation.applyAura(player, flurryAura(25), player.id);
    expect(hasteMultiplierFrom(player.stats.effective)).toBeCloseTo(OWNER_EXAMPLE, 10);
  });

  it('swings at the compounded speed', () => {
    // No talents, so Flurry cannot come and go; a lasting 25% stands in for it.
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(trainingDummyEncounter(ownerExample({ talents: false }), 1), {
      emit: (event) => events.push(event),
    });
    const player = simulation.combatants.find((actor) => actor.kind === 'player')!;
    const steadyHaste: AuraDefinition = {
      id: 'steady_haste',
      name: 'Steady Haste',
      durationMs: seconds(600),
      statModifiers: [{ stat: 'hasteRating', operation: 'flat', value: rating(25) }],
    };
    simulation.begin();
    simulation.applyAura(player, steadyHaste, player.id);
    simulation.advanceTo(seconds(30));
    const swings = events
      .filter(
        (event): event is Extract<TelemetryEvent, { type: 'damage' }> =>
          // The OFF hand: Heroic Strike replaces main-hand swings, never these.
          event.type === 'damage' && event.sourceId === player.id && event.abilityName === 'Off Hand Auto-Attack',
      )
      .map((event) => event.timestamp);
    const timer = player.weapons.offHand!.swingTimerMs;
    const expected = applyHaste(timer, OWNER_EXAMPLE);
    // From the third swing on, every one was scheduled under the aura.
    const gaps = swings.slice(2).map((at, index) => at - swings[index + 1]);
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) expect(gap).toBe(expected);
  });
});

describe('a cast', () => {
  it('shortens by the compounded multiplier', () => {
    const spell: Ability = {
      id: 'slow_spell',
      name: 'Slow Spell',
      castTimeMs: 3000,
      attackTable: 'spell',
      onCast: () => {},
    };
    const caster = makeAttacker({ autoAttack: 'none', abilities: [spell], stats: { hasteRating: rating(10) } });
    caster.stats.addModifiers([
      { sourceId: 'a', stat: 'hasteRating', operation: 'flat', value: rating(20) },
      { sourceId: 'b', stat: 'hasteRating', operation: 'flat', value: rating(5) },
    ]);
    const target = makeTarget();
    const simulation = buildSimulation([caster, target]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('slow_spell')!, target);
    expect(caster.castEndsAt).toBe(applyHaste(3000, 1.1 * 1.2 * 1.05));
  });
});
