import { describe, expect, it } from 'vitest';
import { dealDamage } from '../../src/engine';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * AFTERMATH RAISES IMMOLATE'S HIT AND NOT ITS BURN -- the owner, round 51:
 * "ONLY the initial damage from immolate is increased by 50% (at rank 5), not
 * the DoT effect."
 *
 * Both halves carry the `immolate` id, so a declaration-only test cannot tell
 * the two readings apart. This resolves real damage, through the BUILT talent's
 * modifiers, once as a direct hit and once as a tick, and compares each against
 * the same character without the talent.
 * ==============================================================================
 */

function immolateDamage(talents: Record<string, number>, periodic: boolean): number {
  const actor = makeAttacker({
    autoAttack: 'none',
    abilityModifiers: talentBuild('warlock', talents).abilityModifiers,
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([actor, target]);
  simulation.advanceTo(0);
  const before = target.health.current;
  dealDamage(simulation, {
    source: actor,
    target,
    abilityId: 'immolate',
    abilityName: 'Immolate',
    school: 'fire',
    baseAmount: 1000,
    ...(periodic ? { periodic: true } : {}),
  });
  return before - target.health.current;
}

describe('Aftermath', () => {
  const withIt = legalise({ aftermath: 5 }, 'warlock');
  const without = legalise({}, 'warlock');

  it('raises the initial hit by 50% at 5/5', () => {
    expect(immolateDamage(withIt, false) / immolateDamage(without, false)).toBeCloseTo(1.5, 6);
  });

  it('leaves the burn alone', () => {
    expect(immolateDamage(withIt, true)).toBeCloseTo(immolateDamage(without, true), 6);
  });
});
