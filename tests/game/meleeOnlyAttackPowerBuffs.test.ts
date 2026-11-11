import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/engine';
import { BATTLE_SHOUT_ATTACK_POWER } from '../../src/game/auras/warrior';
import { PRESETS_BY_ID } from '../../src/profiles';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ============================================================================
 * BATTLE SHOUT AND BLESSING OF MIGHT ARE MELEE ATTACK POWER ONLY, the owner's.
 *
 * The `attackPower` STAT is the melee pool. Bare "Attack Power" reaches BOTH
 * pools only because the item rule writes the two stats out explicitly; a
 * buff that names `attackPower` alone reaches melee and nothing else. Asked of
 * a built ranged Hunter at the pull, which is the one place a ranged pool
 * would notice: each buff moves its melee attack power by its own figure and
 * its ranged attack power by nothing.
 * ============================================================================
 */

function poolsAtPull(drop: readonly string[]) {
  const base = PRESETS_BY_ID.get('lw_ranged')!.build();
  const profile = { ...base, raidBuffs: base.raidBuffs.filter((buff) => !drop.includes(buff)) };
  const simulation = new Simulation(trainingDummyEncounter(profile));
  simulation.begin();
  const hunter = simulation.combatants.find((actor) => actor.kind === 'player')!;
  return { melee: hunter.stats.get('attackPower'), ranged: hunter.stats.get('rangedAttackPower') };
}

describe('melee-only attack power buffs', () => {
  it('are both selected on the ranged Hunter, so the comparison means something', () => {
    const buffs = PRESETS_BY_ID.get('lw_ranged')!.build().raidBuffs;
    expect(buffs).toContain('battle_shout');
    expect(buffs).toContain('blessing_of_might');
  });

  it.each([
    ['battle_shout', BATTLE_SHOUT_ATTACK_POWER],
    ['blessing_of_might', 133],
  ] as const)('gives %s to the melee pool and none to the ranged one', (id, amount) => {
    const withBuff = poolsAtPull([]);
    const without = poolsAtPull([id]);
    expect(withBuff.melee - without.melee).toBeCloseTo(amount, 6);
    expect(withBuff.ranged - without.ranged).toBe(0);
  });
});
