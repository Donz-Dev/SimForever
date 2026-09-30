import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { Simulation } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import {
  COST_REFUND_FRACTION,
  COST_REFUND_ON_MISS,
  COST_REFUND_RESOURCES,
} from '../../src/game/combat/resourceRules';

/*
 * ==============================================================================
 * AN ABILITY THAT DOES NOT CONNECT HANDS 80% OF ITS COST BACK.
 *
 * The ruleset owner's rule, for RAGE AND ENERGY only, with exactly two
 * exceptions -- Ferocious Bite and Execute always deplete the pool.
 *
 * Written out by hand rather than read off the constants where it matters, and
 * measured through a real cast rather than by inspecting a declaration: the
 * refund is armed in `castAbility` and paid in `dealDamage`, so a test that
 * checked either half alone would pass with the two disconnected.
 * ==============================================================================
 */

const ALWAYS_MISSES = { ...NO_CHANCES, miss: 10_000 };
const ALWAYS_HITS = { ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 };

function fight(chances: typeof NO_CHANCES, build: () => Combatant) {
  const player = build();
  const target = createTrainingDummy({ name: 'Dummy', health: 1e9, armor: 0, level: 63 });
  const simulation = new Simulation({
    durationMs: seconds(60),
    seed: 1,
    createCombatants: () => [player, target],
    attackChances: () => chances,
  });
  /*
   * A TICK FIRST, so the OPENING AURAS land. A Warrior's stance is one of
   * them, and casting before the clock has moved means casting out of stance
   * -- which is refused, costs nothing, and reads exactly like a refund.
   */
  simulation.advanceTo(1);
  return { player, target, simulation };
}

const warrior = () =>
  createPlayer({ race: 'orc', characterClass: 'warrior', combatStyle: 'two_hander' });

describe('the rule', () => {
  it('is 80%, and covers rage and energy only', () => {
    expect(COST_REFUND_FRACTION).toBe(0.8);
    expect([...COST_REFUND_RESOURCES]).toEqual(['rage', 'energy']);
    expect(COST_REFUND_ON_MISS.fraction).toBe(0.8);

    // Mana explicitly does NOT refund: a resisted spell keeps its cost.
    expect(COST_REFUND_RESOURCES).not.toContain('mana');
  });

  it('reaches every player, rather than being declared per ability', () => {
    // Derived, like the global cooldown: an ability opts OUT and never in.
    expect(warrior().costRefundOnMiss).toEqual(COST_REFUND_ON_MISS);
  });
});

describe('what a miss gives back', () => {
  /** Cast one ability from a full pool and report what it ended up costing. */
  function netCost(chances: typeof NO_CHANCES, abilityId: string): number {
    const { player, target, simulation } = fight(chances, warrior);
    const rage = player.resources.require('rage');
    rage.set(rage.maximum);

    const before = rage.current;
    const ability = player.abilities.get(abilityId)!;
    castAbility(simulation, player, ability, target);
    return before - rage.current;
  }

  it('costs the full amount when the attack lands', () => {
    const paid = netCost(ALWAYS_HITS, 'hamstring');
    expect(paid).toBeGreaterThan(0);
  });

  it('costs a FIFTH as much when it misses', () => {
    /*
     * 80% back means a fifth kept. Compared against the landing cost rather
     * than a literal, so a cost-reduction talent cannot break this test by
     * changing what Mortal Strike costs.
     */
    const landed = netCost(ALWAYS_HITS, 'hamstring');
    const missed = netCost(ALWAYS_MISSES, 'hamstring');

    expect(missed).toBeCloseTo(landed * (1 - COST_REFUND_FRACTION), 6);
    expect(missed).toBeLessThan(landed);
  });

  it('EXECUTE KEEPS ITS COST, being one of the two exceptions', () => {
    /*
     * Execute is gated on the last fifth of the fight, so the clock is wound
     * forward rather than the dummy being wounded -- the same arrangement the
     * coefficient probe uses.
     */
    const cast = (chances: typeof NO_CHANCES) => {
      const { player, target, simulation } = fight(chances, warrior);
      const rage = player.resources.require('rage');
      simulation.advanceTo(seconds(55));
      rage.set(rage.maximum);
      const before = rage.current;
      castAbility(simulation, player, player.abilities.get('execute')!, target);
      return before - rage.current;
    };

    const landed = cast(ALWAYS_HITS);
    const missed = cast(ALWAYS_MISSES);
    expect(landed).toBeGreaterThan(0);
    // No refund: a missed Execute costs exactly what a landed one costs.
    expect(missed).toBeCloseTo(landed, 6);
  });

  it('declares the exception on the ability rather than in a list', () => {
    /*
     * `refundsCostOnMiss: false` sits on Execute and on Ferocious Bite. A
     * central list of exempt ids would be a second place for the same fact and
     * would eventually disagree with the abilities themselves.
     */
    expect(warrior().abilities.get('execute')?.refundsCostOnMiss).toBe(false);

    const druid = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });
    expect(druid.abilities.get('ferocious_bite')?.refundsCostOnMiss).toBe(false);

    // And an ordinary ability says nothing at all, taking the default.
    expect(warrior().abilities.get('hamstring')?.refundsCostOnMiss).toBeUndefined();
  });
});
