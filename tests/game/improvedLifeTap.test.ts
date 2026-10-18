import { describe, expect, it } from 'vitest';
import { castAbility, seconds } from '../../src/engine';
import { lifeTapHealth, lifeTapMana } from '../../src/game/abilities/warlock';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * IMPROVED LIFE TAP: "Increases the amount of Mana awarded by your Life Tap
 * spell by 20%." It wrote a bonus onto the ability and nothing read it, so this
 * drives the BUILT ability through a real cast rather than asserting the
 * declaration -- the join is what was missing.
 */
const builtLifeTap = (rank: number) => {
  const talents: Record<string, number> = rank > 0 ? { improved_life_tap: rank } : {};
  const book = abilitiesForClass('warlock', 'caster', talents);
  const tap = book.find((ability) => ability.id === 'life_tap');
  if (!tap) throw new Error('no Life Tap in the book');
  return tap;
};

const manaFromOneTap = (rank: number) => {
  const tap = builtLifeTap(rank);
  const actor = makeAttacker({
    autoAttack: 'none',
    abilities: [tap],
    maxHealth: 10_000,
    resources: [{ type: 'mana', maximum: 10_000 }],
  });
  const target = makeTarget();
  const simulation = buildSimulation([actor, target], { durationMs: seconds(30) });
  simulation.begin();
  actor.resources.get('mana')!.spend(9_000);
  const health = actor.health.current;
  const before = actor.resources.get('mana')!.current;
  castAbility(simulation, actor, actor.abilities.get('life_tap')!, target);
  return {
    mana: actor.resources.get('mana')!.current - before,
    health: health - actor.health.current,
    base: 430 + actor.stats.effective.spirit,
    actor,
    tap,
  };
};

describe('Improved Life Tap', () => {
  it('awards 10% and 20% more mana at ranks 1 and 2, and no more health is paid', () => {
    for (const [rank, factor] of [[0, 1], [1, 1.1], [2, 1.2]] as const) {
      const { mana, health, base } = manaFromOneTap(rank);
      expect(health, `rank ${rank} health`).toBeCloseTo(base, 10);
      expect(mana, `rank ${rank} mana`).toBeCloseTo(base * factor, 10);
    }
  });

  it('is read through one function, so the pool-room check and the grant agree', () => {
    const { actor } = manaFromOneTap(0);
    expect(lifeTapMana(actor, builtLifeTap(2))).toBeCloseTo(lifeTapHealth(actor) * 1.2, 10);
    expect(lifeTapMana(actor, builtLifeTap(0))).toBeCloseTo(lifeTapHealth(actor), 10);
  });
});
