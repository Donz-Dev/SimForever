import { describe, expect, it } from 'vitest';
import type { AttackChances, AttackTableKind, Combatant } from '../../src/engine';
import { ALL_ABILITIES, AbilityModifiers, dealDamage } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * RULESET: every damage-over-time effect in Forever can crit, at the crit
 * chance of the kind of event that applied it. A tick does not re-roll the
 * combat table -- whether the effect landed was settled when it was applied --
 * so it rolls once, for crit alone, on the same 1-10000 integer die.
 *
 * Scripted rolls rather than sampling, for the usual reason: an off-by-one at
 * the boundary would shift every damage-over-time number by a fraction of a
 * percent and no amount of averaging would catch it.
 */

/** 20% crit, doubling damage, on whatever table is asked for. */
const chances = (crit: number): ((kind: AttackTableKind) => AttackChances) => () =>
  ({
    miss: 0,
    dodge: 0,
    parry: 0,
    block: 0,
    glance: 0,
    crit,
    crush: 0,
    glanceMultiplierMin: 1,
    glanceMultiplierMax: 1,
    critMultiplier: 2,
    crushMultiplier: 1.5,
  });

function run(
  roll: number,
  options: { critFrom?: AttackTableKind; modifiers?: AbilityModifiers; crit?: number } = {},
) {
  const attacker: Combatant = makeAttacker();
  const target: Combatant = makeTarget();
  if (options.modifiers) {
    (attacker as { abilityModifiers: AbilityModifiers }).abilityModifiers = options.modifiers;
  }
  const simulation = buildSimulation([attacker, target], {
    attackChances: chances(options.crit ?? 2000),
  });
  // One scripted roll, so the boundary is exact.
  let used = false;
  (simulation as unknown as { rng: { nextInt: () => number } }).rng.nextInt = () => {
    used = true;
    return roll;
  };
  const resolution = dealDamage(simulation, {
    source: attacker,
    target,
    abilityId: 'rend',
    abilityName: 'Rend',
    school: 'physical',
    baseAmount: 100,
    periodic: true,
    appliesArmor: false,
    ...(options.critFrom ? { critFrom: options.critFrom } : {}),
  });
  return { resolution, rolled: used };
}

describe('damage-over-time ticks can crit', () => {
  it('crits on a roll inside the crit chance', () => {
    const { resolution } = run(2000, { critFrom: 'melee-special' });
    expect(resolution.critical).toBe(true);
    expect(resolution.amount).toBeCloseTo(200, 5);
  });

  it('does not crit one roll past the boundary', () => {
    const { resolution } = run(2001, { critFrom: 'melee-special' });
    expect(resolution.critical).toBe(false);
    expect(resolution.amount).toBeCloseTo(100, 5);
  });

  it('cannot miss, dodge or glance — only hit or crit', () => {
    // The table says 0% for everything but crit here, but the point is that a
    // periodic tick never consults those entries at all.
    expect(run(9999, { critFrom: 'melee-special' }).resolution.outcome).toBe('hit');
    expect(run(1, { critFrom: 'melee-special' }).resolution.outcome).toBe('crit');
  });

  it('does not roll at all without critFrom, and cannot crit', () => {
    const { resolution, rolled } = run(1);
    expect(resolution.critical).toBe(false);
    // An effect that cannot crit must not consume a random number either, or it
    // would shift every roll after it in a seeded run.
    expect(rolled).toBe(false);
  });

  it('is not reduced by armor even though it is physical', () => {
    // A bleed is physical and ignores armor. The target here has armor.
    const { resolution } = run(9999, { critFrom: 'melee-special' });
    expect(resolution.mitigated).toBe(0);
    expect(resolution.amount).toBeCloseTo(100, 5);
  });
});

describe('per-ability modifiers reach a periodic tick', () => {
  it('raises the crit chance of that effect alone', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add('rend', { critBonus: 10 }); // 20% -> 30%
    // 2500 is past the base 20% but inside the raised 30%.
    expect(run(2500, { critFrom: 'melee-special' }).resolution.critical).toBe(false);
    expect(run(2500, { critFrom: 'melee-special', modifiers }).resolution.critical).toBe(true);
  });

  it('scales its damage', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add('rend', { damageMultiplier: 1.35 });
    const { resolution } = run(9999, { critFrom: 'melee-special', modifiers });
    expect(resolution.amount).toBeCloseTo(135, 5);
  });

  it('raises the crit multiplier through ALL_ABILITIES', () => {
    const modifiers = new AbilityModifiers();
    // Impale at rank 2: +20% of the crit BONUS, so x2 becomes x2.2.
    modifiers.add(ALL_ABILITIES, { critMultiplierBonus: 0.2 });
    const { resolution } = run(1, { critFrom: 'melee-special', modifiers });
    expect(resolution.critical).toBe(true);
    expect(resolution.amount).toBeCloseTo(220, 5);
  });
});
