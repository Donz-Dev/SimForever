import { describe, expect, it } from 'vitest';
import type { Ability, Combatant } from '../../src/engine';
import {
  ALL_ABILITIES,
  AbilityModifiers,
  SchoolModifiers,
  SeededRNG,
  castAbility,
  dealDamage,
  resolveHealing,
  seconds,
  spellPowerFor,
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

/*
 * ------------------------------------------------------------------------------
 * RULESET: SPELL POWER CAN BE SCOPED TO A SCHOOL TOO, and that is the fourth
 * field on `SchoolModifier` -- the one the other two scopes do not have.
 *
 * "Increases damage done by Shadow spells and effects by up to 39" is most of a
 * Shadow Priest's spell power and every word of it names a school. One number
 * on the stat block cannot hold that: adding it there would make the same
 * character's Holy and Arcane spells hit harder, which is the item saying
 * something it does not say. `STAT_NAMES` is a deliberately closed flat set and
 * has no room for a keyed stat, so it joins the crit and damage already keyed
 * the same way.
 *
 * GEAR IS THE FIRST CALLER, which is new. Talents built every other entry in
 * this class; `createPlayer` folds the equipped set's in beside them.
 * ------------------------------------------------------------------------------
 */

const COEFFICIENT = 0.5;

/** A spell that actually SCALES, so the power term is visible in the damage. */
const scalingSpellOf = (school: 'fire' | 'shadow'): Ability => ({
  id: `scaling_${school}`,
  name: `Scaling ${school}`,
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
      powerCoefficient: COEFFICIENT,
      appliesArmor: false,
    });
  },
});

function scalingFight(schoolModifiers: SchoolModifiers, spellPower: number) {
  const actor: Combatant = makeAttacker({
    autoAttack: 'none',
    abilities: [scalingSpellOf('fire'), scalingSpellOf('shadow')],
    stats: { spellPower },
    schoolModifiers,
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([actor, target]);

  let at = 0;
  const damage = (school: 'fire' | 'shadow') => {
    at += seconds(2);
    simulation.advanceTo(at);
    const before = target.health.current;
    const result = castAbility(
      simulation,
      actor,
      actor.abilities.get(`scaling_${school}`)!,
      target,
    );
    expect(result, school).toEqual({ ok: true });
    return before - target.health.current;
  };

  return { damage, actor };
}

describe('per-school spell power', () => {
  it('adds to the school-blind pool for the school it names, and only that one', () => {
    const schools = new SchoolModifiers();
    schools.add('shadow', { spellPower: 300 });
    const { damage, actor } = scalingFight(schools, 200);

    expect(spellPowerFor(actor, 'shadow')).toBe(500);
    expect(spellPowerFor(actor, 'fire')).toBe(200);

    // And the damage follows, because `scaleByPower` reads the same function.
    expect(damage('shadow')).toBeCloseTo(BASE + COEFFICIENT * 500, 6);
    expect(damage('fire')).toBeCloseTo(BASE + COEFFICIENT * 200, 6);
  });

  it('ADDS two sources for one school rather than multiplying them', () => {
    /*
     * Eight pieces of Lawbringer each saying "up to N Holy" are one pool of
     * Holy power, exactly as eight pieces each saying "+N Strength" are one
     * pool of strength. A flat power term has no other reading -- and
     * `combine` multiplies the damage multiplier on the same object, so the
     * two rules live one line apart and could easily have been swapped.
     */
    const schools = new SchoolModifiers();
    schools.add('shadow', { spellPower: 100 });
    schools.add('shadow', { spellPower: 39 });
    const { actor } = scalingFight(schools, 0);

    expect(spellPowerFor(actor, 'shadow')).toBe(139);
  });

  it('FOLLOWS A BUFF, because it is read at the point of use', () => {
    /*
     * The scoped half is fixed when the character is built; the school-blind
     * half is a stat and moves. `spellPowerFor` re-reads `stats.effective`
     * every call, so a buff that grants spell power raises the scoped school
     * too -- resolving the sum once at build time would freeze it at the
     * unbuffed figure while still reading as a perfectly plausible number.
     */
    const schools = new SchoolModifiers();
    schools.add('shadow', { spellPower: 300 });
    const { actor } = scalingFight(schools, 200);

    actor.stats.addModifier({
      sourceId: 'test_buff',
      stat: 'spellPower',
      operation: 'flat',
      value: 50,
    });
    expect(spellPowerFor(actor, 'shadow')).toBe(550);
    expect(spellPowerFor(actor, 'fire')).toBe(250);
  });

  it('merges two SETS of modifiers without mutating either', () => {
    /*
     * `createPlayer` has two sources -- the talent build and the equipped gear
     * -- and a `TalentBuild` is a VALUE a caller may hold across several
     * characters. Adding the gear to it directly would work exactly once and
     * then hand the second character the first one's gear as well.
     */
    const fromTalents = new SchoolModifiers();
    fromTalents.add('shadow', { damageMultiplier: 1.1 });

    const combined = new SchoolModifiers();
    combined.merge(fromTalents);
    combined.add('shadow', { spellPower: 293 });

    expect(combined.for('shadow').spellPower).toBe(293);
    expect(combined.for('shadow').damageMultiplier).toBeCloseTo(1.1, 6);

    // The source is untouched: no spell power leaked back into it.
    expect(fromTalents.for('shadow').spellPower ?? 0).toBe(0);
  });

  it('is DAMAGE only, so a heal reads the school-blind pool alone', () => {
    /*
     * The gear wording draws this line itself: the school-blind line is
     * "increases damage AND HEALING done by magical spells", the scoped one is
     * "increases DAMAGE done by Shadow spells". So `resolveHealing` reads the
     * stat and never `spellPowerFor` -- a Holy-scoped 161 on a Paladin raises
     * its seal and not its Holy Light.
     */
    const schools = new SchoolModifiers();
    schools.add('holy', { spellPower: 161 });
    const actor = makeAttacker({
      autoAttack: 'none',
      stats: { spellPower: 100 },
      schoolModifiers: schools,
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const rng = new SeededRNG(1);

    const healed = resolveHealing(
      { source: actor, target, abilityName: 'Test Heal', baseAmount: 500, powerCoefficient: 1, canCrit: false },
      rng,
    );
    expect(healed.raw).toBeCloseTo(600, 6);
  });
});
