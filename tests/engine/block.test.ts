import { describe, expect, it } from 'vitest';
import type { AttackChances, AttackResolution, RNG } from '../../src/engine';
import { NO_CHANCES, outcomesFor, resolveAttackTable, resolveDamage } from '../../src/engine';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * A BLOCK is the odd outcome out: it LANDS, unlike a dodge or a parry, and it
 * is reduced by a FLAT amount rather than by a multiplier, unlike a glance or a
 * crit. Both halves of that are easy to get wrong in a way that looks fine.
 *
 * Scripted rolls, not sampling: an off-by-one at the band boundary would shift
 * every blocked hit and no average would show it.
 */
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

/* 5% miss, 5% dodge, 5% parry, 30% block. Bands: 1-500, 501-1000, 1001-1500,
 * 1501-4500. */
const TABLE: AttackChances = {
  ...NO_CHANCES,
  miss: 500,
  dodge: 500,
  parry: 500,
  block: 3000,
};

const at = (roll: number) => resolveAttackTable('melee-received', TABLE, scriptedRng(roll));

describe('the block outcome', () => {
  it('is one of the outcomes attacks received can produce', () => {
    expect(outcomesFor('melee-received')).toContain('block');
  });

  it('is not produced by any table the player attacks WITH', () => {
    // A warrior blocking its own Mortal Strike would be nonsense.
    for (const kind of ['melee-auto', 'melee-special', 'ranged-auto', 'ranged-special', 'spell'] as const) {
      expect(outcomesFor(kind)).not.toContain('block');
    }
  });

  it('sits after avoidance, so an avoided blow is avoided outright', () => {
    expect(at(500).outcome).toBe('miss');
    expect(at(1000).outcome).toBe('dodge');
    expect(at(1500).outcome).toBe('parry');
  });

  it('claims the band immediately after parry', () => {
    expect(at(1501).outcome).toBe('block');
    expect(at(4500).outcome).toBe('block');
  });

  it('gives way to an ordinary hit one roll past its band', () => {
    expect(at(4501).outcome).toBe('hit');
  });

  it('LANDS — it is not an avoided outcome', () => {
    const blocked = at(2000);
    expect(blocked.outcome).toBe('block');
    expect(blocked.avoided).toBe(false);
    // And carries no multiplier of its own; the reduction is flat, below.
    expect(blocked.damageMultiplier).toBe(1);
  });
});

describe('block value', () => {
  const BLOCKED: AttackResolution = {
    outcome: 'block',
    avoided: false,
    damageMultiplier: 1,
    rolls: [],
  };
  const HIT: AttackResolution = { outcome: 'hit', avoided: false, damageMultiplier: 1, rolls: [] };

  const damage = (attack: AttackResolution, blockValue: number) => {
    const target = makeTarget({ stats: { armor: 0, blockValue } });
    return resolveDamage(
      {
        source: makeAttacker(),
        target,
        abilityName: 'Swing',
        school: 'physical',
        baseAmount: 100,
      },
      attack,
    );
  };

  it('removes a flat amount, not a fraction', () => {
    expect(damage(BLOCKED, 30).amount).toBeCloseTo(70, 5);
    // The same block value against a bigger hit removes the same 30.
    expect(damage(BLOCKED, 30).mitigated).toBeCloseTo(30, 5);
  });

  it('does nothing to an ordinary hit', () => {
    expect(damage(HIT, 30).amount).toBeCloseTo(100, 5);
  });

  it('is reported SEPARATELY from armor, which rage depends on', () => {
    /*
     * ------------------------------------------------------------------------
     * ARMOR AND A BLOCK ARE ONE STEP IN THE PIPELINE AND TWO THINGS TO THE
     * RAGE RULE, which is why `blocked` exists beside `mitigated`.
     *
     *   "D = pre-armor damage to be dealt"                 armor does not
     *                                                      reduce the rage
     *   "Blocked hits give the rage of the unblocked       a block does
     *    amount"
     *
     * Both the ruleset owner's. `mitigated` is their sum, so reading it would
     * take armor off as well and leave a tank earning a fraction of what it
     * should; reading `raw` alone would ignore the block.
     * ------------------------------------------------------------------------
     */
    const withArmour = resolveDamage(
      {
        source: makeAttacker(),
        target: makeTarget({ stats: { armor: 3731, blockValue: 30 } }),
        abilityName: 'Swing',
        school: 'physical',
        baseAmount: 100,
      },
      BLOCKED,
    );

    // The block's share is its own, whatever armor did.
    expect(withArmour.blocked).toBeCloseTo(30, 5);
    // And `mitigated` is still the total, armor included.
    expect(withArmour.mitigated).toBeGreaterThan(withArmour.blocked);

    // An unblocked hit blocks nothing, however much armor removed.
    const unblocked = resolveDamage(
      {
        source: makeAttacker(),
        target: makeTarget({ stats: { armor: 3731, blockValue: 30 } }),
        abilityName: 'Swing',
        school: 'physical',
        baseAmount: 100,
      },
      HIT,
    );
    expect(unblocked.blocked).toBe(0);
    expect(unblocked.mitigated).toBeGreaterThan(0);
  });

  it('cannot take damage below zero', () => {
    // A block value larger than the hit absorbs it entirely and no further.
    expect(damage(BLOCKED, 500).amount).toBe(0);
  });

  it('is worth proportionally more against a small hit', () => {
    /*
     * The behaviour that makes block value good against fast attackers and poor
     * against big ones, and the reason it is subtracted rather than scaled.
     */
    const target = makeTarget({ stats: { armor: 0, blockValue: 30 } });
    const of = (baseAmount: number) =>
      resolveDamage(
        { source: makeAttacker(), target, abilityName: 'Swing', school: 'physical', baseAmount },
        BLOCKED,
      ).amount;
    expect(1 - of(60) / 60).toBeCloseTo(0.5, 5);
    expect(1 - of(300) / 300).toBeCloseTo(0.1, 5);
  });
});
