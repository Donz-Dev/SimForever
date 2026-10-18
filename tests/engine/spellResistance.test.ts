import { describe, expect, it } from 'vitest';
import type { AuraDefinition, Combatant, DamageSchool } from '../../src/engine';
import {
  averageResist,
  dealDamage,
  resistBucketProbabilities,
  resistShareFor,
  rollResist,
  seconds,
} from '../../src/engine';
import type { RNG } from '../../src/engine/rng';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ============================================================================
 * SPELL RESISTANCE AND SPELL PIERCING, the rule from wowsims/forever#76 written
 * out by hand rather than read off the implementation:
 *
 *   a = |R| / (|R| + K)
 *   a < 0.1   P = [1 - 7.5a, 5a, 2.5a]           over 0, 10%, 20%
 *   a >= 0.1  P(x) = 0.5 - 2.5 |x - a|           over 0, 10%, 20%, ...
 *
 * K arrives from the ruleset; 540 is the owner's 9 x level at 60.
 * ============================================================================
 */

const K = 540;

/** An RNG that returns one fixed roll and counts how often it was asked. */
function fixedRng(roll: number): RNG & { calls: number } {
  const rng = {
    calls: 0,
    next() {
      rng.calls++;
      return roll;
    },
    nextFloat(min: number, max: number) {
      rng.calls++;
      return min + roll * (max - min);
    },
    nextInt(min: number, max: number) {
      rng.calls++;
      return Math.floor(min + roll * (max - min + 1));
    },
  };
  return rng as unknown as RNG & { calls: number };
}

describe('the bucket distribution', () => {
  it('is the issue\'s small-share form below a = 0.1', () => {
    const p = resistBucketProbabilities(0.04);
    expect(p).toHaveLength(3);
    expect(p[0]).toBeCloseTo(1 - 7.5 * 0.04, 10);
    expect(p[1]).toBeCloseTo(5 * 0.04, 10);
    expect(p[2]).toBeCloseTo(2.5 * 0.04, 10);
  });

  it('is the triangle around a above it, and its mean IS a', () => {
    // a = 0.25: 0.5 - 2.5|x - 0.25| gives 0, 0.125, 0.375, 0.375, 0.125.
    const p = resistBucketProbabilities(0.25);
    expect(p[0]).toBeCloseTo(0, 10);
    expect(p[1]).toBeCloseTo(0.125, 10);
    expect(p[2]).toBeCloseTo(0.375, 10);
    expect(p[3]).toBeCloseTo(0.375, 10);
    expect(p[4]).toBeCloseTo(0.125, 10);
    const mean = p.reduce((sum, q, step) => sum + q * step * 0.1, 0);
    expect(mean).toBeCloseTo(0.25, 10);
  });

  it('has the small-share form\'s mean equal to a as well', () => {
    const a = 0.07;
    const p = resistBucketProbabilities(a);
    expect(p[1] * 0.1 + p[2] * 0.2).toBeCloseTo(a, 10);
  });

  it('never uses Classic\'s 25/50/75 bins: every share is a whole tenth', () => {
    for (let roll = 0; roll < 1; roll += 0.013) {
      const share = resistShareFor(0.33, roll);
      expect(Math.round(share * 10) / 10).toBeCloseTo(share, 10);
    }
  });

  it('averages a = R / (R + K)', () => {
    expect(averageResist(60, K)).toBeCloseTo(0.1, 10);
    expect(averageResist(-60, K)).toBeCloseTo(0.1, 10);
    expect(averageResist(0, K)).toBe(0);
  });
});

describe('rollResist', () => {
  it('DRAWS NO RANDOM NUMBER AT ZERO RESISTANCE, so a fight with none is unchanged', () => {
    const rng = fixedRng(0.99);
    expect(rollResist(0, K, rng)).toBe(0);
    expect(rng.calls).toBe(0);
  });

  it('returns a positive share for resistance and a NEGATIVE one for piercing past it', () => {
    // a = 0.1 at |R| = 60, and a roll of 0.99 lands in the top bucket, 20%.
    expect(rollResist(60, K, fixedRng(0.99))).toBeCloseTo(0.2, 10);
    expect(rollResist(-60, K, fixedRng(0.99))).toBeCloseTo(-0.2, 10);
  });
});

/** One unavoidable hit, flat, with a target and attacker set up as asked. */
function hit(options: {
  school: DamageSchool;
  resistance?: number;
  piercing?: number;
  targetAuras?: readonly AuraDefinition[];
  periodic?: boolean;
  fullResistanceTicks?: boolean;
  noPartialResist?: boolean;
  withK?: boolean;
  seed?: number;
}): number {
  const attacker: Combatant = makeAttacker({
    stats: { attackPower: 0, spellPiercing: options.piercing ?? 0 },
  });
  const target: Combatant = makeTarget({
    resistances: options.resistance ? { [options.school]: options.resistance } : {},
  });
  const simulation = buildSimulation([attacker, target], {
    seed: options.seed ?? 1,
    ...(options.withK === false ? {} : { spellResistanceConstant: (level: number) => 9 * level }),
  });
  for (const aura of options.targetAuras ?? []) simulation.applyAura(target, aura, attacker.id);
  return dealDamage(simulation, {
    source: attacker,
    target,
    abilityId: 'probe',
    abilityName: 'Probe',
    school: options.school,
    baseAmount: 1000,
    periodic: options.periodic ?? false,
    fullResistanceTicks: options.fullResistanceTicks,
    noPartialResist: options.noPartialResist,
    appliesArmor: false,
  }).amount;
}

/** The mean of many hits, each in a fight of its own seed. */
function meanHit(options: Parameters<typeof hit>[0], n = 4000): number {
  let total = 0;
  for (let seed = 1; seed <= n; seed++) total += hit({ ...options, seed });
  return total / n;
}

describe('in the damage pipeline', () => {
  it('a resisted magic hit loses a 10% step, on average R / (R + K)', () => {
    // R = 135 at K = 540 is an average 20% resisted.
    const mean = meanHit({ school: 'fire', resistance: 135 });
    expect(mean).toBeGreaterThan(785);
    expect(mean).toBeLessThan(815);
    const one = hit({ school: 'fire', resistance: 135 });
    expect([1000, 900, 800, 700, 600].some((v) => Math.abs(v - one) < 1e-6)).toBe(true);
  });

  it('PHYSICAL IS NEVER RESISTED, which is armor\'s job', () => {
    expect(hit({ school: 'physical', resistance: 300 })).toBeCloseTo(1000, 6);
  });

  it('nothing is resisted when the ruleset supplies no K', () => {
    expect(hit({ school: 'fire', resistance: 300, withK: false })).toBeCloseTo(1000, 6);
  });

  it('SPELL PIERCING PAST ZERO IS BONUS DAMAGE on the same roll', () => {
    // 135 piercing against 0 resistance: an average 20% MORE.
    const mean = meanHit({ school: 'arcane', piercing: 135 });
    expect(mean).toBeGreaterThan(1185);
    expect(mean).toBeLessThan(1215);
  });

  it('piercing cancels resistance before any of it is bonus', () => {
    expect(hit({ school: 'fire', resistance: 100, piercing: 100 })).toBeCloseTo(1000, 6);
  });

  it('A RESISTANCE DEBUFF IS FLOORED AT ZERO and is never bonus damage', () => {
    const curse: AuraDefinition = {
      id: 'curse',
      name: 'Curse',
      durationMs: seconds(60),
      isDebuff: true,
      resistanceBySchool: { fire: -75 },
    };
    // Against no resistance it does nothing at all.
    expect(hit({ school: 'fire', targetAuras: [curse] })).toBeCloseTo(1000, 6);
    // Against exactly 75 it cancels the whole of it.
    expect(hit({ school: 'fire', resistance: 75, targetAuras: [curse] })).toBeCloseTo(1000, 6);
  });

  it('a DoT tick rolls against a tenth, and a flagged tick against the whole', () => {
    // 1350 piercing: a = 0.714 in full, 0.2 at a tenth.
    const tenth = meanHit({ school: 'nature', piercing: 1350, periodic: true });
    const full = meanHit({ school: 'nature', piercing: 1350, periodic: true, fullResistanceTicks: true });
    expect(tenth).toBeGreaterThan(1185);
    expect(tenth).toBeLessThan(1215);
    expect(full).toBeGreaterThan(1680);
    expect(full).toBeLessThan(1750);
  });

  it('a damage shield is never resisted', () => {
    expect(hit({ school: 'nature', resistance: 300, noPartialResist: true })).toBeCloseTo(1000, 6);
  });
});
