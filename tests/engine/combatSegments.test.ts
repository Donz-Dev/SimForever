import { describe, expect, it } from 'vitest';
import type { Ability, CombatSegment, Rotation } from '../../src/engine';
import { seconds } from '../../src/engine';
import { inCombatMsWithin, validateSegments } from '../../src/engine/simulation/CombatSegment';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * ============================================================================
 * A FIGHT IN SEGMENTS (the dungeon route): pulls and the gaps between them.
 * Two enemies; the first pull has both, a gap has neither, the second pull has
 * only the first.
 * ============================================================================
 */

const SEGMENTS: readonly CombatSegment[] = [
  { startMs: 0, endMs: seconds(10), enemyIds: ['a', 'b'] },
  { startMs: seconds(10), endMs: seconds(20), enemyIds: [] },
  { startMs: seconds(20), endMs: seconds(30), enemyIds: ['a'] },
];

const STRIKE: Ability = { id: 'strike', name: 'Strike', triggersGcd: true, onCast: () => {} };
const BIG: Ability = { id: 'big', name: 'Big', cooldownMs: seconds(120), triggersGcd: false, onCast: () => {} };

/** A rotation that casts Strike every global cooldown and records when it was asked. */
function recordingRotation(asked: number[]): Rotation {
  return {
    name: 'test',
    selectAction: (context, actor) => {
      asked.push(context.clock.now());
      const target = context.defaultTargetFor(actor);
      return target && context.canCast(actor, STRIKE, target) ? { ability: STRIKE, target } : null;
    },
  };
}

function fight(asked: number[] = [], overrides = {}) {
  const player = makeAttacker({ abilities: [STRIKE, BIG], rotation: recordingRotation(asked) });
  const a = makeTarget({ id: 'a' });
  const b = makeTarget({ id: 'b' });
  const simulation = buildSimulation([player, a, b], { segments: SEGMENTS, ...overrides });
  return { simulation, player, a, b };
}

describe('a segmented fight', () => {
  it('lasts until the last segment ends, whatever durationMs says', () => {
    const { simulation } = fight();
    expect(simulation.plannedDurationMs).toBe(seconds(30));
    const run = simulation.run();
    expect(run.elapsedMs).toBe(seconds(30));
    expect(run.inCombatMs).toBe(seconds(20));
  });

  it('follows the segment for who is present and whether it is in combat', () => {
    const { simulation, player, a, b } = fight();
    simulation.advanceTo(seconds(5));
    expect(simulation.inCombat).toBe(true);
    expect(simulation.enemiesOf(player)).toEqual([a, b]);

    simulation.advanceTo(seconds(15));
    expect(simulation.inCombat).toBe(false);
    expect(simulation.enemiesOf(player)).toEqual([]);
    expect(simulation.defaultTargetFor(player)).toBeUndefined();

    simulation.advanceTo(seconds(25));
    expect(simulation.inCombat).toBe(true);
    expect(simulation.enemiesOf(player)).toEqual([a]);
    expect(b.present).toBe(false);
  });

  it('gives each pull its own bounds, which is what "the fight remaining" reads', () => {
    const { simulation } = fight();
    simulation.advanceTo(seconds(5));
    expect([simulation.combatStartedAt, simulation.combatEndsAt]).toEqual([0, seconds(10)]);
    simulation.advanceTo(seconds(25));
    expect([simulation.combatStartedAt, simulation.combatEndsAt]).toEqual([seconds(20), seconds(30)]);
  });

  it('asks the rotation nothing out of combat, and starts asking again at the next pull', () => {
    const asked: number[] = [];
    fight(asked).simulation.run();
    expect(asked.some((t) => t >= seconds(10) && t < seconds(20))).toBe(false);
    expect(asked).toContain(seconds(20));
    expect(asked.filter((t) => t === seconds(20))).toHaveLength(1);
  });

  it('removes what the player put on an enemy when it leaves, and keeps its own', () => {
    const { simulation, player, a } = fight();
    simulation.begin();
    simulation.applyAura(a, { id: 'dot', name: 'Dot', durationMs: seconds(60) }, player.id);
    simulation.applyAura(a, { id: 'raid', name: 'Raid debuff', durationMs: seconds(60) }, a.id);
    simulation.advanceTo(seconds(11));
    expect(a.auras.has('dot')).toBe(false);
    expect(a.auras.has('raid')).toBe(true);
  });

  it('refuses a held ability with `held`, and only while the rule says so', () => {
    const { simulation, player } = fight([], {
      holdsAbility: (context: { combatStartedAt: number }, _actor: unknown, ability: Ability) =>
        ability.id === 'big' && context.combatStartedAt === 0,
    });
    simulation.advanceTo(seconds(5));
    expect(simulation.castRejection(player, BIG, simulation.defaultTargetFor(player), { ignoreGcd: true })).toBe('held');
    simulation.advanceTo(seconds(25));
    expect(simulation.castRejection(player, BIG, simulation.defaultTargetFor(player), { ignoreGcd: true })).toBeUndefined();
  });

  it('refuses segments that do not tile the fight or name an unknown enemy', () => {
    const ids = new Set(['a']);
    expect(() => validateSegments([{ startMs: 5, endMs: 10, enemyIds: [] }], ids)).toThrow();
    expect(() => validateSegments([{ startMs: 0, endMs: 0, enemyIds: [] }], ids)).toThrow();
    expect(() => validateSegments([{ startMs: 0, endMs: 10, enemyIds: ['zz'] }], ids)).toThrow();
    expect(inCombatMsWithin(SEGMENTS, seconds(25))).toBe(seconds(15));
  });
});
