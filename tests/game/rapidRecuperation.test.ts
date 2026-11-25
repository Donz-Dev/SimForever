import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import { NO_CHANCES, castAbility, seconds } from '../../src/engine';
import {
  RAPID_RECUPERATION_BYPASS,
  RAPID_RECUPERATION_SECONDS,
  SERPENT_STING_ABILITY,
} from '../../src/game/abilities/hunter';
import { RAPID_RECUPERATION_AURA_ID } from '../../src/game/auras/hunter';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * RAPID RECUPERATION, ASKED BY THE OWNER WHETHER IT WORKS: "If I apply Serpent
 * Sting every 15 seconds I should always be regenerating 50% of my
 * out-of-combat mana regeneration."
 *
 * IT PAID, BUT UNCONDITIONALLY. It was a flat `manaRegenBypass` stat from the
 * pull, so the 50% was there whether or not a sting ever landed. It is a
 * window now: "Afflicting a target with Serpent Sting allows {0}% ... for {1}
 * sec". Asserted on the STAT, which is what `manaPerTick` reads.
 * ==============================================================================
 */

const sting = (bonuses?: Record<string, number>): Ability => ({
  ...SERPENT_STING_ABILITY,
  ...(bonuses ? { bonuses } : {}),
});

function fight(ability: Ability, landed = true) {
  const caster = makeAttacker({ resources: [{ type: 'mana', maximum: 10_000 }], abilities: [ability] });
  const target = makeTarget();
  const simulation = buildSimulation([caster, target], {
    // Everything lands, or everything misses, so the window's condition is the test.
    attackChances: () => (landed ? NO_CHANCES : { ...NO_CHANCES, miss: 1_000_000 }),
  });
  simulation.begin();
  return { caster, target, simulation };
}

describe('Rapid Recuperation', () => {
  it('reads 50% for 15 seconds at rank 2, off the talent row', () => {
    const bonuses = talentBuild('hunter', { rapid_recuperation: 2 } as never).abilityBonuses.get('serpent_sting');
    expect(bonuses?.[RAPID_RECUPERATION_BYPASS]).toBe(50);
    expect(bonuses?.[RAPID_RECUPERATION_SECONDS]).toBe(15);
    // And it no longer grants a standing stat.
    expect(talentBuild('hunter', { rapid_recuperation: 2 } as never).stats.manaRegenBypass ?? 0).toBe(0);
  });

  it('gives nothing before a sting, 50% once one lands, and drops off 15 seconds later', () => {
    const ability = sting({ [RAPID_RECUPERATION_BYPASS]: 50, [RAPID_RECUPERATION_SECONDS]: 15 });
    const { caster, target, simulation } = fight(ability);
    expect(caster.stats.get('manaRegenBypass')).toBe(0);

    castAbility(simulation, caster, caster.abilities.get('serpent_sting')!, target);
    expect(caster.auras.has(RAPID_RECUPERATION_AURA_ID)).toBe(true);
    expect(caster.stats.get('manaRegenBypass')).toBe(50);

    simulation.advanceTo(seconds(15) - 1);
    expect(caster.stats.get('manaRegenBypass')).toBe(50);
    simulation.advanceTo(seconds(15) + 1);
    expect(caster.stats.get('manaRegenBypass')).toBe(0);
  });

  it('holds the whole time when the sting is re-applied every 15 seconds', () => {
    const ability = sting({ [RAPID_RECUPERATION_BYPASS]: 50, [RAPID_RECUPERATION_SECONDS]: 15 });
    const { caster, target, simulation } = fight(ability);
    for (let t = 0; t < 60; t += 15) {
      simulation.advanceTo(seconds(t));
      castAbility(simulation, caster, caster.abilities.get('serpent_sting')!, target);
      simulation.advanceTo(seconds(t + 15) - 1);
      expect(caster.stats.get('manaRegenBypass'), `at ${t + 15}s`).toBe(50);
    }
  });

  it('opens nothing when the sting misses, or without the talent', () => {
    const talented = sting({ [RAPID_RECUPERATION_BYPASS]: 50, [RAPID_RECUPERATION_SECONDS]: 15 });
    const missed = fight(talented, false);
    castAbility(missed.simulation, missed.caster, missed.caster.abilities.get('serpent_sting')!, missed.target);
    expect(missed.caster.auras.has(RAPID_RECUPERATION_AURA_ID)).toBe(false);

    const plain = fight(sting());
    castAbility(plain.simulation, plain.caster, plain.caster.abilities.get('serpent_sting')!, plain.target);
    expect(plain.caster.auras.has(RAPID_RECUPERATION_AURA_ID)).toBe(false);
  });

  it('is taken by the LW Ranged preset at 2/2', () => {
    expect(PRESETS_BY_ID.get('lw_ranged')!.build().talents.rapid_recuperation).toBe(2);
  });
});
