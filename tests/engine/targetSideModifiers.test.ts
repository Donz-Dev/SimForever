import { describe, expect, it } from 'vitest';
import type { Ability, AttackChances, AuraDefinition, RNG } from '../../src/engine';
import {
  NO_CHANCES,
  SchoolModifiers,
  castAbility,
  dealDamage,
  resolveAttackTable,
  seconds,
  spellPowerAgainst,
  spellPowerFor,
  toRollUnits,
} from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * THREE THINGS THE DAMAGE PIPELINE COULD NOT SAY, each of which had left a
 * talent or a judgement inert with a reason that turned out to be about the
 * wrong thing.
 *
 *   spellPowerTakenBySchool   spell power on the TARGET, read by whoever hits
 *                             it. Judgement of the Crusader's "+ up to 161 Holy
 *                             damage taken", whose reason said a flat
 *                             per-school bonus had no declaration -- when "up
 *                             to" means it is POWER and scales by coefficient
 *   hitBonus                  hit for one school. Five talents across three
 *                             classes said the table decides hit before a
 *                             per-school modifier is consulted. It does not
 *   damageDoneByTable         an aura changing what one TABLE deals. Seal of the
 *                             Crusader's "deals less damage with each attack",
 *                             which must not reach the spells its haste never
 *                             touched
 *
 * Written against bare combatants rather than through game content, so each
 * fails only when the thing it names is broken.
 * ==============================================================================
 */

const BASE = 100;
const COEFFICIENT = 0.5;

/** A Holy spell with a coefficient, so a power term is visible in the damage. */
const HOLY_SPELL: Ability = {
  id: 'test_holy',
  name: 'Test Holy',
  requiresTarget: true,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'holy',
      baseAmount: BASE,
      powerCoefficient: COEFFICIENT,
      appliesArmor: false,
    });
  },
};

/** "Holy damage taken increased by up to N", the shape of a judgement. */
const holyTaken = (amount: number): AuraDefinition => ({
  id: 'holy_taken',
  name: 'Holy damage taken',
  durationMs: seconds(40),
  isDebuff: true,
  spellPowerTakenBySchool: { holy: amount },
});

function fight(attackerSpellPower: number) {
  const actor = makeAttacker({
    autoAttack: 'none',
    abilities: [HOLY_SPELL],
    stats: { spellPower: attackerSpellPower },
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([actor, target]);

  let at = 0;
  const cast = () => {
    at += seconds(2);
    simulation.advanceTo(at);
    const before = target.health.current;
    expect(castAbility(simulation, actor, actor.abilities.get('test_holy')!, target)).toEqual({
      ok: true,
    });
    return before - target.health.current;
  };

  return { actor, target, simulation, cast };
}

describe('spell power carried by the TARGET', () => {
  it('is added to the attacker’s pool and scaled by the ability’s coefficient', () => {
    const { target, simulation, cast } = fight(200);

    // 100 + 0.5 x 200.
    expect(cast()).toBeCloseTo(BASE + COEFFICIENT * 200, 6);

    simulation.applyAura(target, holyTaken(160), 'attacker');

    /*
     * 100 + 0.5 x (200 + 160) = 280, NOT 100 + 160 = 260 and emphatically not
     * 100 x 2.6. Those are the two readings this field exists to tell apart:
     * a flat bonus per hit, and a multiplier.
     */
    expect(cast()).toBeCloseTo(BASE + COEFFICIENT * 360, 6);
  });

  it('reaches an ability that computes its own damage, through `spellPowerAgainst`', () => {
    /*
     * A Paladin's seals are the case: they work out `base + coefficient x power`
     * in `game` and hand it over as a `baseAmount` with no coefficient at all, so
     * `scaleByPower` never sees one to apply the debuff to. They have to ASK, and
     * this is the function they ask -- the same one the pipeline uses, so the two
     * cannot disagree about what a Holy point is worth.
     */
    const { actor, target, simulation } = fight(200);

    expect(spellPowerFor(actor, 'holy')).toBe(200);
    expect(spellPowerAgainst(actor, target, 'holy')).toBe(200);

    simulation.applyAura(target, holyTaken(161), actor.id);

    expect(spellPowerFor(actor, 'holy')).toBe(200);
    expect(spellPowerAgainst(actor, target, 'holy')).toBe(361);
  });

  it('ADDS across two debuffs rather than multiplying them', () => {
    // Two sources of Holy power are one pool, the rule `SchoolModifier.spellPower`
    // already combines by. Multiplying would be the `damageTakenBySchool` rule,
    // which is the one this field is NOT.
    const { target, simulation } = fight(0);
    simulation.applyAura(target, holyTaken(100), 'attacker');
    simulation.applyAura(
      target,
      { ...holyTaken(50), id: 'holy_taken_two' },
      'attacker',
    );
    expect(target.spellPowerTakenFor('holy')).toBe(150);
  });

  it('is scoped to its school, and says nothing about any other', () => {
    const { target, simulation } = fight(0);
    simulation.applyAura(target, holyTaken(161), 'attacker');
    expect(target.spellPowerTakenFor('holy')).toBe(161);
    expect(target.spellPowerTakenFor('shadow')).toBe(0);
    expect(target.spellPowerTakenFor('physical')).toBe(0);
  });

  it('is nothing at all on a target with no such debuff', () => {
    const { actor, target } = fight(300);
    expect(target.spellPowerTakenFor('holy')).toBe(0);
    expect(spellPowerAgainst(actor, target, 'holy')).toBe(300);
    // And an absent target is not an error: a damage request may have none.
    expect(spellPowerAgainst(actor, undefined, 'holy')).toBe(300);
  });
});

/* -------------------------------------------------------------------------- */

function scriptedRng(...values: number[]): RNG {
  let index = 0;
  return {
    next: () => 0,
    nextInt: () => values[index++] ?? values[values.length - 1],
    nextFloat: () => 0,
    rollChance: () => false,
    nextDuration: () => 0,
    pick: () => undefined,
  };
}

describe('hit scoped to a school', () => {
  /*
   * ASSERTED ON THE TABLE ITSELF, because that is where the claim was. The five
   * inert talents all said the same thing: that hit is settled before a school
   * modifier can be consulted. `rollTable` folds the school's modifier in and
   * hands the result to `resolveAttackTable`, so a reduced miss chance is a
   * reduced miss chance -- and the band it frees goes to `hit`, because `hit` is
   * the remainder rather than a band of its own.
   */
  const TABLE: AttackChances = { ...NO_CHANCES, miss: toRollUnits(17) };

  it('is taken off MISS, so the freed band becomes an ordinary hit', () => {
    // 17% miss: rolls 1-1700 miss. With +12% hit it is 1-500.
    expect(resolveAttackTable('spell', TABLE, scriptedRng(1700)).outcome).toBe('miss');

    const withHit: AttackChances = { ...TABLE, miss: toRollUnits(17 - 12) };
    expect(resolveAttackTable('spell', withHit, scriptedRng(1700)).outcome).toBe('hit');
    expect(resolveAttackTable('spell', withHit, scriptedRng(500)).outcome).toBe('miss');
  });

  it('arrives through the school modifier the roll already consulted', () => {
    const schoolModifiers = new SchoolModifiers();
    schoolModifiers.add('holy', { hitBonus: 12 });
    expect(schoolModifiers.for('holy').hitBonus).toBe(12);
    expect(schoolModifiers.for('shadow').hitBonus ?? 0).toBe(0);
  });

  it('ADDS across sources, like every other chance on a modifier', () => {
    const schoolModifiers = new SchoolModifiers();
    schoolModifiers.add('holy', { hitBonus: 6 });
    schoolModifiers.add('holy', { hitBonus: 6 });
    expect(schoolModifiers.for('holy').hitBonus).toBe(12);
  });
});

/* -------------------------------------------------------------------------- */

describe('an aura changing what one TABLE deals', () => {
  it('reaches the table it names and no other', () => {
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    expect(actor.damageDoneMultiplierForTable('melee-auto')).toBe(1);

    simulation.applyAura(
      actor,
      {
        id: 'slower_swings',
        name: 'Slower swings',
        durationMs: seconds(30),
        damageDoneByTable: { 'melee-auto': 1 / 1.4 },
      },
      actor.id,
    );

    expect(actor.damageDoneMultiplierForTable('melee-auto')).toBeCloseTo(1 / 1.4, 10);
    // The point of keying on the table: a special and a spell are untouched.
    expect(actor.damageDoneMultiplierForTable('melee-special')).toBe(1);
    expect(actor.damageDoneMultiplierForTable('spell')).toBe(1);
    // A damage-over-time tick passes no table at all.
    expect(actor.damageDoneMultiplierForTable(undefined)).toBe(1);
  });
});
