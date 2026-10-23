import { describe, expect, it } from 'vitest';
import type { AuraDefinition } from '../../src/engine';
import { dealDamage, seconds } from '../../src/engine';
import { FROSTFIRE_ALSO_COUNTS_AS, MAGE_FIRE_POWER_EFFECTS } from '../../src/game/auras/mage';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * FROSTFIRE BOLT AGAINST FIRE POWER -- the owner's round 51 check: "the
 * Frostfire bolt's DoT effect does not contribute to the Fire Power talent. But
 * Frostfire bolt's Direct damage is still boosted by Fire Power's 3% per Fire
 * effect on the target, up to 12%."
 *
 * Both halves of the tooltip's "effects which mix multiple schools of magic do
 * not qualify", read literally: the burn is a mixed-school effect and is not
 * COUNTED, and the bolt is a Fire spell and is RAISED. Resolved through real
 * `dealDamage` on a Fire Power 3/3 character, so the join is what is asserted.
 * The effects on the target are stand-ins carrying the real ids -- the count
 * reads ids and nothing else.
 * ==============================================================================
 */

const marker = (id: string): AuraDefinition => ({ id, name: id, durationMs: seconds(30), isDebuff: true });

function frostfireBoltHit(onTarget: readonly string[]): number {
  const actor = makeAttacker({
    autoAttack: 'none',
    schoolDamagePerTargetEffect: talentBuild('mage', legalise({ fire_power: 3 }, 'mage'))
      .schoolDamagePerTargetEffect,
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([actor, target]);
  simulation.advanceTo(0);
  for (const id of onTarget) simulation.applyAura(target, marker(id), actor.id);
  const before = target.health.current;
  dealDamage(simulation, {
    source: actor,
    target,
    abilityId: 'frostfire_bolt',
    abilityName: 'Frostfire Bolt',
    school: 'fire',
    countsAsSchools: FROSTFIRE_ALSO_COUNTS_AS,
    baseAmount: 1000,
  });
  return before - target.health.current;
}

describe('Frostfire Bolt and Fire Power', () => {
  const bare = frostfireBoltHit([]);

  it('does not count its own burn as a Fire effect', () => {
    expect(MAGE_FIRE_POWER_EFFECTS).not.toContain('frostfire_bolt');
    expect(frostfireBoltHit(['frostfire_bolt']) / bare).toBeCloseTo(1, 10);
  });

  it('is raised 3% per real Fire effect, up to 12%', () => {
    const fire = ['fireball', 'pyroblast', 'ignite', 'fire_vulnerability'];
    for (let n = 1; n <= fire.length; n += 1) {
      const onTarget = [...fire.slice(0, n), 'frostfire_bolt'];
      expect(frostfireBoltHit(onTarget) / bare, `${n} effects`).toBeCloseTo(1 + Math.min(3 * n, 12) / 100, 10);
    }
  });
});
