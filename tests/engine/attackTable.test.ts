import { describe, expect, it } from 'vitest';
import type { AttackChances, AttackTableKind, RNG } from '../../src/engine';
import {
  NO_CHANCES,
  ROLL_MAX,
  SeededRNG,
  isTwoRoll,
  outcomesFor,
  resolveAttackTable,
  toPercent,
  toRollUnits,
} from '../../src/engine';

/**
 * An RNG that returns a scripted sequence, so a table can be driven to an exact
 * outcome instead of being sampled.
 *
 * Combat tables are the one place where a statistical test is not good enough:
 * an off-by-one at a boundary shifts every damage number in the simulator by a
 * fraction of a percent, which no amount of averaging would catch.
 */
function scriptedRng(...values: number[]): RNG {
  let index = 0;
  return {
    next: () => 0,
    nextInt: () => {
      const value = values[index] ?? values[values.length - 1];
      index++;
      return value;
    },
    nextFloat: () => 0,
    rollChance: () => false,
    nextDuration: () => 0,
    pick: () => undefined,
  };
}

function chances(overrides: Partial<AttackChances>): AttackChances {
  return { ...NO_CHANCES, ...overrides };
}

describe('roll units', () => {
  it('scales 100% to the full roll range', () => {
    expect(toRollUnits(100)).toBe(ROLL_MAX);
    expect(ROLL_MAX).toBe(10000);
  });

  it('truncates rather than rounding', () => {
    // The stated example: 25.7891% crit becomes 2578, not 2579.
    expect(toRollUnits(25.7891)).toBe(2578);
    expect(toRollUnits(8)).toBe(800);
    expect(toRollUnits(6.5)).toBe(650);
    expect(toRollUnits(17)).toBe(1700);
    expect(toRollUnits(0.999)).toBe(99);
  });

  it('floors a negative or zero chance at zero', () => {
    // Class base crit constants can be negative before agility is added.
    expect(toRollUnits(-1.53)).toBe(0);
    expect(toRollUnits(0)).toBe(0);
  });

  it('clamps above 100%', () => {
    expect(toRollUnits(150)).toBe(ROLL_MAX);
  });

  it('round-trips back to a percentage', () => {
    expect(toPercent(2578)).toBe(25.78);
  });
});

describe('table shapes', () => {
  it('uses one roll for auto-attacks and received attacks', () => {
    expect(isTwoRoll('melee-auto')).toBe(false);
    expect(isTwoRoll('ranged-auto')).toBe(false);
    expect(isTwoRoll('melee-received')).toBe(false);
  });

  it('uses two rolls for specials and spells', () => {
    expect(isTwoRoll('melee-special')).toBe(true);
    expect(isTwoRoll('ranged-special')).toBe(true);
    expect(isTwoRoll('spell')).toBe(true);
  });

  it('exposes the outcomes each table can produce', () => {
    expect(outcomesFor('melee-auto')).toEqual([
      'miss',
      'dodge',
      'parry',
      'glance',
      'crit',
      'hit',
    ]);
    expect(outcomesFor('ranged-auto')).toEqual(['miss', 'crit', 'hit']);
    expect(outcomesFor('melee-special')).toEqual(['miss', 'dodge', 'parry', 'crit', 'hit']);
    expect(outcomesFor('ranged-special')).toEqual(['miss', 'crit', 'hit']);
    expect(outcomesFor('spell')).toEqual(['miss', 'crit', 'hit']);
    expect(outcomesFor('melee-received')).toEqual([
      'miss',
      'dodge',
      'parry',
      // Block sits after avoidance and before crush: a blow that was going to
      // be avoided is avoided outright, and everything left can be blocked.
      'block',
      'crush',
      'crit',
      'hit',
    ]);
  });
});

describe('1. melee auto-attack (single roll)', () => {
  // 8% miss, 6.5% dodge, 14% parry, 40% glance, 20% crit.
  // Cumulative: miss 1-800, dodge 801-1450, parry 1451-2850,
  //             glance 2851-6850, crit 6851-8850, hit 8851-10000.
  const table = chances({
    miss: 800,
    dodge: 650,
    parry: 1400,
    glance: 4000,
    crit: 2000,
    glanceMultiplierMin: 0.7,
    glanceMultiplierMax: 0.7,
    critMultiplier: 2,
  });

  const at = (roll: number) => resolveAttackTable('melee-auto', table, scriptedRng(roll));

  it('places every outcome at the right boundary', () => {
    expect(at(1).outcome).toBe('miss');
    expect(at(800).outcome).toBe('miss');
    expect(at(801).outcome).toBe('dodge');
    expect(at(1450).outcome).toBe('dodge');
    expect(at(1451).outcome).toBe('parry');
    expect(at(2850).outcome).toBe('parry');
    expect(at(2851).outcome).toBe('glance');
    expect(at(6850).outcome).toBe('glance');
    expect(at(6851).outcome).toBe('crit');
    expect(at(8850).outcome).toBe('crit');
    expect(at(8851).outcome).toBe('hit');
    expect(at(ROLL_MAX).outcome).toBe('hit');
  });

  it('spends exactly one roll whatever the outcome', () => {
    expect(at(1).rolls).toHaveLength(1);
    expect(at(9000).rolls).toHaveLength(1);
  });

  it('applies the right damage multiplier', () => {
    expect(at(1).damageMultiplier).toBe(0); // miss
    expect(at(900).damageMultiplier).toBe(0); // dodge
    expect(at(2000).damageMultiplier).toBe(0); // parry
    expect(at(3000).damageMultiplier).toBe(0.7); // glance
    expect(at(7000).damageMultiplier).toBe(2); // crit
    expect(at(9000).damageMultiplier).toBe(1); // hit
  });

  it('marks only miss, dodge and parry as avoided', () => {
    expect(at(1).avoided).toBe(true);
    expect(at(900).avoided).toBe(true);
    expect(at(2000).avoided).toBe(true);
    expect(at(3000).avoided).toBe(false);
    expect(at(9000).avoided).toBe(false);
  });

  it('lets a large miss chance crowd crit off the table', () => {
    // The point of a single-roll system: avoidance and crit compete for the
    // same 10000 slots, so more miss really does mean fewer crits.
    const crowded = chances({ miss: 9000, crit: 2000, critMultiplier: 2 });
    expect(resolveAttackTable('melee-auto', crowded, scriptedRng(9500)).outcome).toBe('crit');
    expect(resolveAttackTable('melee-auto', crowded, scriptedRng(9001)).outcome).toBe('crit');
    // Everything past 11000 would have been crit, but the table ends at 10000.
    expect(resolveAttackTable('melee-auto', crowded, scriptedRng(8999)).outcome).toBe('miss');
  });
});

describe('2. ranged auto-attack (single roll)', () => {
  const table = chances({ miss: 800, crit: 2000, critMultiplier: 2 });
  const at = (roll: number) => resolveAttackTable('ranged-auto', table, scriptedRng(roll));

  it('has no dodge, parry or glance', () => {
    expect(at(801).outcome).toBe('crit'); // straight from miss to crit
    expect(at(2800).outcome).toBe('crit');
    expect(at(2801).outcome).toBe('hit');
  });

  it('ignores dodge and parry chances even if supplied', () => {
    const withAvoidance = chances({ miss: 800, dodge: 5000, parry: 5000, crit: 2000 });
    // A roll of 2000 would land squarely in dodge if this table consulted it.
    // Ranged auto-attacks skip straight from miss to crit, so it crits.
    expect(resolveAttackTable('ranged-auto', withAvoidance, scriptedRng(2000)).outcome).toBe(
      'crit',
    );
    expect(resolveAttackTable('ranged-auto', withAvoidance, scriptedRng(9000)).outcome).toBe(
      'hit',
    );
  });

  it('spends one roll', () => {
    expect(at(5000).rolls).toHaveLength(1);
  });
});

describe('3. melee special attack (two roll)', () => {
  // First roll: 8% miss, 6.5% dodge, 14% parry. Second roll: 20% crit.
  const table = chances({ miss: 800, dodge: 650, parry: 1400, crit: 2000, critMultiplier: 2 });

  it('resolves avoidance on the first roll', () => {
    expect(resolveAttackTable('melee-special', table, scriptedRng(500)).outcome).toBe('miss');
    expect(resolveAttackTable('melee-special', table, scriptedRng(1000)).outcome).toBe('dodge');
    expect(resolveAttackTable('melee-special', table, scriptedRng(2000)).outcome).toBe('parry');
  });

  it('does not roll again when the attack was avoided', () => {
    // A missed special never rolls for crit, which keeps the RNG stream
    // aligned with what actually happened.
    const result = resolveAttackTable('melee-special', table, scriptedRng(500, 1));
    expect(result.rolls).toHaveLength(1);
  });

  it('rolls crit separately when the attack landed', () => {
    const crit = resolveAttackTable('melee-special', table, scriptedRng(9000, 1500));
    expect(crit.outcome).toBe('crit');
    expect(crit.rolls).toEqual([9000, 1500]);

    const hit = resolveAttackTable('melee-special', table, scriptedRng(9000, 2001));
    expect(hit.outcome).toBe('hit');
  });

  it('does not let avoidance crowd out crit', () => {
    // Unlike the single-roll table, a 90% miss chance leaves the crit rate on
    // landed hits untouched, because crit gets its own die.
    const crowded = chances({ miss: 9000, crit: 2000, critMultiplier: 2 });
    const result = resolveAttackTable('melee-special', crowded, scriptedRng(9500, 1000));
    expect(result.outcome).toBe('crit');
  });

  it('never glances', () => {
    // Glancing blows are an auto-attack mechanic only.
    const withGlance = chances({ glance: 9000, crit: 0 });
    expect(resolveAttackTable('melee-special', withGlance, scriptedRng(5000, 5000)).outcome).toBe(
      'hit',
    );
  });
});

describe('4. ranged special attack (two roll)', () => {
  const table = chances({ miss: 800, dodge: 5000, parry: 5000, crit: 2000, critMultiplier: 2 });

  it('can only be avoided by a miss', () => {
    expect(resolveAttackTable('ranged-special', table, scriptedRng(500, 9999)).outcome).toBe(
      'miss',
    );
    // Well inside the supplied dodge range, but ranged specials ignore it.
    expect(resolveAttackTable('ranged-special', table, scriptedRng(3000, 9999)).outcome).toBe(
      'hit',
    );
  });

  it('rolls crit on the second die', () => {
    expect(resolveAttackTable('ranged-special', table, scriptedRng(3000, 1)).outcome).toBe('crit');
  });
});

describe('5. spell attack (two roll)', () => {
  // 17% miss, and spells crit for 1.5x rather than 2x.
  const table = chances({ miss: 1700, crit: 2000, critMultiplier: 1.5 });

  it('misses below the spell miss chance', () => {
    expect(resolveAttackTable('spell', table, scriptedRng(1700, 1)).outcome).toBe('miss');
    expect(resolveAttackTable('spell', table, scriptedRng(1701, 1)).outcome).toBe('crit');
  });

  it('crits for 1.5x, not 2x', () => {
    const result = resolveAttackTable('spell', table, scriptedRng(5000, 1));
    expect(result.outcome).toBe('crit');
    expect(result.damageMultiplier).toBe(1.5);
  });

  it('can resolve a landing check with no crit chance at all', () => {
    // How a damage-over-time effect decides whether it was resisted.
    const landing = chances({ miss: 1700 });
    expect(resolveAttackTable('spell', landing, scriptedRng(1000)).avoided).toBe(true);
    expect(resolveAttackTable('spell', landing, scriptedRng(5000, 5000)).avoided).toBe(false);
  });
});

describe('6. melee attacks received by the player (single roll)', () => {
  // 5% boss miss, 10% dodge, 8% parry, 15% crush, 5% boss crit.
  const table = chances({
    miss: 500,
    dodge: 1000,
    parry: 800,
    crush: 1500,
    crit: 500,
    crushMultiplier: 1.5,
    critMultiplier: 2,
  });
  const at = (roll: number) => resolveAttackTable('melee-received', table, scriptedRng(roll));

  it('places every outcome at the right boundary', () => {
    expect(at(500).outcome).toBe('miss');
    expect(at(501).outcome).toBe('dodge');
    expect(at(1500).outcome).toBe('dodge');
    expect(at(1501).outcome).toBe('parry');
    expect(at(2300).outcome).toBe('parry');
    expect(at(2301).outcome).toBe('crush');
    expect(at(3800).outcome).toBe('crush');
    expect(at(3801).outcome).toBe('crit');
    expect(at(4300).outcome).toBe('crit');
    expect(at(4301).outcome).toBe('hit');
  });

  it('crushes for 1.5x and crits for 2x', () => {
    expect(at(3000).damageMultiplier).toBe(1.5);
    expect(at(4000).damageMultiplier).toBe(2);
  });

  it('is the only table with a crushing blow', () => {
    for (const kind of [
      'melee-auto',
      'ranged-auto',
      'melee-special',
      'ranged-special',
      'spell',
    ] as AttackTableKind[]) {
      expect(outcomesFor(kind), kind).not.toContain('crush');
    }
  });
});

describe('statistical behaviour', () => {
  it('produces outcomes at roughly the declared rates', () => {
    const table = chances({ miss: 800, dodge: 650, glance: 4000, crit: 2000 });
    const rng = new SeededRNG(1234);

    const counts: Record<string, number> = {};
    const trials = 200_000;
    for (let i = 0; i < trials; i++) {
      const outcome = resolveAttackTable('melee-auto', table, rng).outcome;
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }

    expect(counts.miss / trials).toBeCloseTo(0.08, 2);
    expect(counts.dodge / trials).toBeCloseTo(0.065, 2);
    expect(counts.glance / trials).toBeCloseTo(0.4, 2);
    expect(counts.crit / trials).toBeCloseTo(0.2, 2);
    expect(counts.hit / trials).toBeCloseTo(0.255, 2);
  });

  it('always hits when nothing can prevent it', () => {
    const rng = new SeededRNG(7);
    for (let i = 0; i < 1000; i++) {
      expect(resolveAttackTable('melee-auto', NO_CHANCES, rng).outcome).toBe('hit');
    }
  });

  it('always misses at a 100% miss chance', () => {
    const certain = chances({ miss: ROLL_MAX });
    const rng = new SeededRNG(7);
    for (let i = 0; i < 100; i++) {
      expect(resolveAttackTable('spell', certain, rng).outcome).toBe('miss');
    }
  });
});
