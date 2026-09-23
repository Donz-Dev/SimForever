import { describe, expect, it } from 'vitest';
import type { Ability, Combatant } from '../../src/engine';
import {
  ALL_ABILITIES,
  AbilityModifiers,
  SchoolModifiers,
  castAbility,
  dealDamage,
  seconds,
} from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ------------------------------------------------------------------------------
 * RULESET: crit, crit damage and damage can be scoped to a SCHOOL, not only to
 * an ability or to the whole character.
 *
 * The missing middle. Before this a talent reading "your Fire spells" had two
 * bad options: list every fire ability by id, or use the whole-character
 * multiplier and hit everything. BOTH WERE TAKEN, by different classes, and
 * both were written down as wrong at the time -- the Druid's Moonfury was left
 * inert, and the Shaman's Elemental Fury was applied whole-character with a
 * caveat saying it wrongly raised physical crits.
 *
 * The damage figures are asserted exactly. These are multipliers, and a
 * multiplier applied in the wrong place is the kind of error that produces a
 * plausible number forever.
 * ------------------------------------------------------------------------------
 */

const BASE = 1000;

const spellOf = (school: 'fire' | 'frost' | 'arcane'): Ability => ({
  id: `test_${school}`,
  name: `Test ${school}`,
  requiresTarget: true,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school,
      baseAmount: BASE,
      // No table, so nothing is avoided and nothing crits: the damage that
      // comes out is the multipliers and only the multipliers.
      appliesArmor: false,
    });
  },
});

function fight(build: (schools: SchoolModifiers, abilities: AbilityModifiers) => void) {
  const schoolModifiers = new SchoolModifiers();
  const abilityModifiers = new AbilityModifiers();
  build(schoolModifiers, abilityModifiers);

  const actor: Combatant = makeAttacker({
    autoAttack: 'none',
    abilities: [spellOf('fire'), spellOf('frost'), spellOf('arcane')],
    schoolModifiers,
    abilityModifiers,
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([actor, target]);

  /*
   * The clock is advanced past the global cooldown between casts. Without it
   * the second cast in a test is simply REFUSED and reports zero damage --
   * which reads as "the school multiplier did not apply" and is nothing of
   * the kind.
   */
  let at = 0;
  const damage = (school: 'fire' | 'frost' | 'arcane') => {
    at += seconds(2);
    simulation.advanceTo(at);
    const before = target.health.current;
    const result = castAbility(simulation, actor, actor.abilities.get(`test_${school}`)!, target);
    expect(result, school).toEqual({ ok: true });
    return before - target.health.current;
  };

  return { damage, actor };
}

describe('per-school damage', () => {
  it('raises the school it names and leaves the others alone', () => {
    const { damage } = fight((schools) => {
      schools.add('fire', { damageMultiplier: 1.1 });
    });

    expect(damage('fire')).toBeCloseTo(BASE * 1.1, 6);
    expect(damage('frost')).toBeCloseTo(BASE, 6);
    expect(damage('arcane')).toBeCloseTo(BASE, 6);
  });

  it('MULTIPLIES two sources rather than adding them', () => {
    /*
     * Two independent +10% effects are +21%, which is the same rule the stat
     * modifier buckets and `AbilityModifiers` already follow. Adding them
     * would understate by a percentage point that grows with every source.
     */
    const { damage } = fight((schools) => {
      schools.add('fire', { damageMultiplier: 1.1 });
      schools.add('fire', { damageMultiplier: 1.1 });
    });

    expect(damage('fire')).toBeCloseTo(BASE * 1.21, 6);
  });

  it('stacks with a per-ability multiplier, because they are different effects', () => {
    const { damage } = fight((schools, abilities) => {
      schools.add('fire', { damageMultiplier: 1.1 });
      abilities.add('test_fire', { damageMultiplier: 1.2 });
    });

    expect(damage('fire')).toBeCloseTo(BASE * 1.1 * 1.2, 6);
  });

  it('is not applied twice, once as a merge and once on its own line', () => {
    /*
     * `combineModifiers` deliberately does NOT carry the school's damage
     * multiplier: that one is applied on its own line, multiplied rather than
     * added. Merging it as well would square it -- 1.1 becoming 1.21 -- which
     * is a plausible-looking number and would never be noticed.
     */
    const { damage } = fight((schools) => {
      schools.add('fire', { damageMultiplier: 1.5 });
    });

    expect(damage('fire')).toBeCloseTo(BASE * 1.5, 6);
    expect(damage('fire')).not.toBeCloseTo(BASE * 1.5 * 1.5, 6);
  });
});

describe('per-school crit', () => {
  it('reaches the attack table for its school only', () => {
    // A guaranteed crit for fire, and a guaranteed miss of the crit band for
    // frost, proves the bonus is being read per school rather than globally.
    const schools = new SchoolModifiers();
    schools.add('fire', { critBonus: 100 });

    const actor = makeAttacker({ autoAttack: 'none', schoolModifiers: schools });
    expect(actor.schoolModifiers.for('fire').critBonus).toBe(100);
    expect(actor.schoolModifiers.for('frost').critBonus ?? 0).toBe(0);
  });

  it('adds to an ability bonus for the same cast rather than replacing it', () => {
    // Critical Mass (+fire crit) and Incineration (+Fire Blast crit) are
    // different talents and a Mage with both gets both.
    const schools = new SchoolModifiers();
    const abilities = new AbilityModifiers();
    schools.add('fire', { critBonus: 6 });
    abilities.add('test_fire', { critBonus: 6 });

    const actor = makeAttacker({
      autoAttack: 'none',
      schoolModifiers: schools,
      abilityModifiers: abilities,
    });
    expect(
      (actor.schoolModifiers.for('fire').critBonus ?? 0) +
        (actor.abilityModifiers.for('test_fire').critBonus ?? 0),
    ).toBe(12);
  });

  it('does not leak the ALL_ABILITIES key into a school lookup', () => {
    // The two are separate namespaces. A whole-character "+20% crit damage to
    // your abilities" must not also arrive as a fire-school bonus.
    const abilities = new AbilityModifiers();
    abilities.add(ALL_ABILITIES, { critBonus: 20 });
    const actor = makeAttacker({ autoAttack: 'none', abilityModifiers: abilities });

    expect(actor.schoolModifiers.for('fire').critBonus ?? 0).toBe(0);
  });
});

describe('a channel is a cast that ticks', () => {
  const channelled = (ticks: number): Ability => ({
    id: 'test_channel',
    name: 'Test Channel',
    castTimeMs: seconds(5),
    channelTicks: ticks,
    affectedByHaste: false,
    requiresTarget: true,
    onCast: ({ simulation, caster, target, ability }) => {
      if (!target) return;
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: ability.name,
        school: 'arcane',
        baseAmount: BASE,
        appliesArmor: false,
      });
    },
  });

  const run = (ticks: number, until: number) => {
    const ability = channelled(ticks);
    const actor = makeAttacker({ autoAttack: 'none', abilities: [ability] });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);
    castAbility(simulation, actor, ability, target);
    simulation.advanceTo(until);
    return { hits: Math.round((1_000_000 - target.health.current) / BASE), actor };
  };

  it('runs its effect once per tick, evenly spaced', () => {
    // Five ticks over five seconds: one a second, and the last exactly at the
    // end -- which is where an ordinary cast's single effect already lands.
    expect(run(5, seconds(0.9)).hits).toBe(0);
    expect(run(5, seconds(1)).hits).toBe(1);
    expect(run(5, seconds(3)).hits).toBe(3);
    expect(run(5, seconds(5)).hits).toBe(5);
  });

  it('is the SAME THING as an ordinary cast at one tick', () => {
    /*
     * The check that the two paths have not drifted. A one-tick channel
     * resolves once, at the end, which is exactly a plain cast -- so nothing
     * about the ordinary path changed when channelling was added.
     */
    expect(run(1, seconds(4.9)).hits).toBe(0);
    expect(run(1, seconds(5)).hits).toBe(1);
  });

  it('holds the caster for the WHOLE channel, not until the first tick', () => {
    /*
     * A tick that freed the caster would let a rotation act in the middle of
     * its own channel -- casting over it every second and getting one tick's
     * damage for a five-second spell.
     */
    const { actor } = run(5, seconds(3));
    expect(actor.isCasting(seconds(3))).toBe(true);

    const finished = run(5, seconds(5));
    expect(finished.actor.isCasting(seconds(5))).toBe(false);
  });
});
