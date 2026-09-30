import { describe, expect, it } from 'vitest';
import type { AttackChances, DamageSchool, RNG } from '../../src/engine';
import { ROLL_MAX, dealDamage } from '../../src/engine';
import { COMBAT_CONSTANTS } from '../../src/game/combat/attackChances';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { talentNumber } from '../../src/game/talents/talentValues';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ============================================================================
 * SPELL HIT PER SCHOOL: five talents, three classes, one field.
 *
 * Every one of them read "improves your chance to hit with <school> spells by
 * N%" and every one of them was `unmodelled`, with a reason saying the attack
 * table settles hit before any per-school modifier is consulted. That was true
 * of the FIELDS and false of the ROUTE -- `combineModifiers` has folded the
 * school's modifier into the chances before the roll all along, and it had
 * nothing to carry hit along it.
 *
 * WHAT IS WRITTEN OUT BY HAND HERE is the spell miss (17%) and each talent's
 * per-rank value, rather than being read back out of the source. A test that
 * reads the values file passes whatever the values file says.
 * ============================================================================
 */

/** Written out by hand. The ruleset's flat spell miss, in roll units. */
const SPELL_MISS = 1700;

describe('the constant the whole thing is measured against', () => {
  it('misses 17% of spells against a raid boss before any hit at all', () => {
    expect(COMBAT_CONSTANTS.spellMiss).toBe(SPELL_MISS);
  });
});

/*
 * The five, written out from the captures rather than from the values file:
 *
 *   Arcane Focus        Mage    5 ranks, 5% at 5/5,  arcane
 *   Elemental Precision Mage    5 ranks, 5% at 5/5,  frost AND fire
 *   Shadow Focus        Priest  5 ranks, 5% at 5/5,  shadow
 *   Holy Precision      Priest  3 ranks, 18% at 3/3, holy
 *   Divine Precision    Paladin 3 ranks, 18% at 3/3, holy
 *
 * THE TWO HOLY ONES READ 18 AND THE OTHER THREE READ 5, which looks like a
 * transcription error and is not: two independent class captures say 18 at
 * three ranks for the same school, which is the only corroboration available
 * anywhere in this project for a talent VALUE.
 */
const EXPECTED: ReadonlyArray<
  readonly [cls: 'mage' | 'priest' | 'paladin', id: string, rank: number, points: number, schools: readonly DamageSchool[]]
> = [
  ['mage', 'arcane_focus', 5, 5, ['arcane']],
  ['mage', 'elemental_precision', 5, 5, ['frost', 'fire']],
  ['priest', 'shadow_focus', 5, 5, ['shadow']],
  ['priest', 'holy_precision', 3, 18, ['holy']],
  ['paladin', 'divine_precision', 3, 18, ['holy']],
];

describe('the five talents', () => {
  it.each(EXPECTED)('%s %s grants its stated hit at max rank', (cls, id, rank, points, schools) => {
    const build = talentBuild(cls, { [id]: rank });
    for (const school of schools) {
      expect(build.schoolModifiers.for(school).hitBonus).toBe(points);
    }
  });

  it.each(EXPECTED)('%s %s has no unmodelled clause left', (cls, id) => {
    const table = { mage: MAGE_TALENT_EFFECTS, priest: PRIEST_TALENT_EFFECTS, paladin: PALADIN_TALENT_EFFECTS }[cls];
    expect(table[id].some((effect) => effect.kind === 'unmodelled')).toBe(false);
  });

  /*
   * THE VALUES FILE AGREES WITH THE HAND-WRITTEN FIGURES ABOVE. The second of
   * the two independent checks this project asks for on a captured number: a
   * typo in the expectation fails the first, and upstream drift fails this.
   */
  it.each(EXPECTED)('%s %s reads that value out of the capture too', (cls, id, rank, points) => {
    expect(talentNumber(cls, id, rank)).toBe(points);
  });

  it('scales with rank rather than being all-or-nothing', () => {
    expect(talentBuild('priest', { shadow_focus: 1 }).schoolModifiers.for('shadow').hitBonus).toBe(1);
    expect(talentBuild('priest', { shadow_focus: 3 }).schoolModifiers.for('shadow').hitBonus).toBe(3);
  });
});

describe('what it does NOT reach', () => {
  it('leaves every other school alone', () => {
    const build = talentBuild('priest', { shadow_focus: 5 });
    for (const school of ['arcane', 'fire', 'frost', 'holy', 'nature', 'physical'] as const) {
      expect(build.schoolModifiers.for(school).hitBonus ?? 0).toBe(0);
    }
  });

  it('gives Elemental Precision both of its schools and neither of the others', () => {
    const build = talentBuild('mage', { elemental_precision: 5 });
    expect(build.schoolModifiers.for('frost').hitBonus).toBe(5);
    expect(build.schoolModifiers.for('fire').hitBonus).toBe(5);
    expect(build.schoolModifiers.for('arcane').hitBonus ?? 0).toBe(0);
  });
});

/*
 * ----------------------------------------------------------------------------
 * AND THAT IT REACHES THE ROLL, which is the half a build-time assertion
 * cannot show. Scripted rolls rather than sampling: the whole question is
 * where one boundary sits, and an off-by-one there is a fraction of a percent
 * on every spell the character casts.
 * ----------------------------------------------------------------------------
 */
describe('the boundary it moves', () => {
  const SPELL_TABLE: AttackChances = {
    miss: SPELL_MISS,
    dodge: 0,
    parry: 0,
    block: 0,
    glance: 0,
    crush: 0,
    crit: 0,
    glanceMultiplierMin: 1,
    glanceMultiplierMax: 1,
    critMultiplier: 1.5,
    crushMultiplier: 1.5,
  };

  /** One cast at a scripted roll, returning whether it landed. */
  const castAt = (roll: number, hitBonus: number): boolean => {
    const caster = makeAttacker({ stats: { spellPower: 0 } });
    if (hitBonus > 0) caster.schoolModifiers.add('shadow', { hitBonus });
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], {
      attackChances: () => SPELL_TABLE,
    });
    /*
     * SCRIPTED, NOT SEEDED. `Simulation` builds its own `SeededRNG` from the
     * config's seed, so the only way to put a chosen number on the die is to
     * replace it afterwards -- and a seed that happens to roll 1200 today is
     * not a test of where the boundary is.
     */
    (simulation as { rng: RNG }).rng = {
      next: () => 0,
      nextInt: () => roll,
      nextFloat: () => 0,
      nextDuration: () => 0,
      rollChance: () => false,
      pick: (items) => items[0],
    };
    const resolution = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'mind_blast',
      abilityName: 'Mind Blast',
      school: 'shadow',
      baseAmount: 100,
      attackTable: 'spell',
    });
    return !resolution.avoided;
  };

  it('misses at the last roll inside the untalented band', () => {
    expect(castAt(SPELL_MISS, 0)).toBe(false);
  });

  it('lands at that same roll with five points of Shadow Focus', () => {
    // 1700 - 500 = 1200, so 1700 is now past the miss band.
    expect(castAt(SPELL_MISS, 5)).toBe(true);
  });

  it('still misses one roll inside the NARROWED band', () => {
    expect(castAt(SPELL_MISS - 500, 5)).toBe(false);
    expect(castAt(SPELL_MISS - 500 + 1, 5)).toBe(true);
  });

  it('floors at zero rather than making the band negative', () => {
    // 20 points against a 17% miss. The first roll on the die must land.
    expect(castAt(1, 20)).toBe(true);
    expect(castAt(ROLL_MAX, 20)).toBe(true);
  });
});
