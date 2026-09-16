import { describe, expect, it } from 'vitest';
import { TOTAL_TALENT_POINTS } from '../../src/game/talents/Talent';
import {
  canSpend,
  canUnspend,
  distribution,
  isLegal,
  pointsInTree,
  pointsRemaining,
  pointsSpent,
  resetTree,
  spend,
  unspend,
} from '../../src/game/talents/talentRules';
import { WARRIOR_TALENTS_BY_ID, WARRIOR_TREES } from '../../src/game/talents/warriorTalents';

/*
 * The tree's SHAPE is transcribed by hand below, from the Forever talent
 * calculator, rather than read back out of the data file. A test that asked the
 * data what the data said would pass whatever the data said -- the same reason
 * the base stats and the ability sheet are each written out twice.
 */
const EXPECTED = {
  arms: { count: 17, capstone: 'Mortal Strike', tier0: ['Improved Heroic Strike', 'Deflection', 'Improved Rend'] },
  fury: { count: 18, capstone: 'Bloodthirst', tier0: ['Booming Voice', 'Cruelty'] },
  protection: { count: 19, capstone: 'Shield Slam', tier0: ['Shield Specialization', 'Anticipation'] },
} as const;

/** Spend n points into a talent, one at a time, as a user would. */
function spendMany(allocation: Record<string, number>, id: string, n: number) {
  let next: Record<string, number> = { ...allocation };
  for (let i = 0; i < n; i++) next = { ...spend(next, id) };
  return next;
}

describe('the warrior trees match the source calculator', () => {
  it('has three trees of the stated sizes', () => {
    expect(WARRIOR_TREES.map((tree) => tree.id)).toEqual(['arms', 'fury', 'protection']);
    for (const tree of WARRIOR_TREES) {
      expect(tree.talents.length, tree.id).toBe(EXPECTED[tree.id].count);
    }
  });

  it('puts the right talent at the bottom of each tree', () => {
    for (const tree of WARRIOR_TREES) {
      const deepest = [...tree.talents].sort((a, b) => b.row - a.row)[0];
      expect(deepest.name, tree.id).toBe(EXPECTED[tree.id].capstone);
      // A 31-point capstone: six rows down, so 30 points below it.
      expect(deepest.tier, tree.id).toBe(30);
      expect(deepest.ranks, tree.id).toBe(1);
    }
  });

  it('opens each tree with the stated talents', () => {
    for (const tree of WARRIOR_TREES) {
      const names = tree.talents.filter((t) => t.row === 0).map((t) => t.name);
      expect(names.sort(), tree.id).toEqual([...EXPECTED[tree.id].tier0].sort());
    }
  });

  it('gives every talent a tier of five times its row', () => {
    for (const tree of WARRIOR_TREES) {
      for (const talent of tree.talents) {
        expect(talent.tier, `${tree.id}/${talent.name}`).toBe(talent.row * 5);
      }
    }
  });

  it('points every prerequisite at a talent that exists, higher up the same tree', () => {
    for (const tree of WARRIOR_TREES) {
      for (const talent of tree.talents) {
        if (!talent.requires) continue;
        const prereq = WARRIOR_TALENTS_BY_ID.get(talent.requires);
        expect(prereq, `${talent.name} requires ${talent.requires}`).toBeDefined();
        if (!prereq) continue;
        expect(prereq.tree).toBe(talent.tree);
        expect(prereq.row).toBeLessThan(talent.row);
        expect(talent.requiresRanks).toBe(prereq.ranks);
      }
    }
  });

  it('cannot reach two capstones with the points available', () => {
    // 31 points to a capstone, twice, is 62 against a budget of 51. This is
    // what makes Mortal Strike, Bloodthirst and Shield Slam mutually exclusive,
    // which the ability spreadsheet does not say anywhere.
    expect(TOTAL_TALENT_POINTS).toBe(51);
    expect(31 * 2).toBeGreaterThan(TOTAL_TALENT_POINTS);
  });
});

describe('spending points', () => {
  it('starts with every point available', () => {
    expect(pointsRemaining({})).toBe(51);
    expect(pointsSpent({})).toBe(0);
    expect(distribution({})).toBe('0/0/0');
  });

  it('spends into an open talent', () => {
    const after = spend({}, 'improved_heroic_strike');
    expect(after.improved_heroic_strike).toBe(1);
    expect(pointsRemaining(after)).toBe(50);
  });

  it('stops at a talent maximum', () => {
    // Improved Heroic Strike has three ranks; a fourth must not go in.
    const after = spendMany({}, 'improved_heroic_strike', 5);
    expect(after.improved_heroic_strike).toBe(3);
    expect(canSpend(after, 'improved_heroic_strike')).toBe(false);
  });

  it('refuses a talent whose row has not opened', () => {
    // Improved Charge sits on row 1, which needs five points in Arms.
    expect(canSpend({}, 'improved_charge')).toBe(false);

    const five = spendMany(spendMany({}, 'improved_heroic_strike', 3), 'deflection', 2);
    expect(pointsInTree(five, 'arms')).toBe(5);
    expect(canSpend(five, 'improved_charge')).toBe(true);
  });

  it('counts only its own tree towards a tier', () => {
    // Five points in Fury must not open row 1 of Arms.
    const fury = spendMany({}, 'cruelty', 5);
    expect(pointsInTree(fury, 'fury')).toBe(5);
    expect(pointsInTree(fury, 'arms')).toBe(0);
    expect(canSpend(fury, 'improved_charge')).toBe(false);
  });

  it('refuses a talent whose prerequisite is not maxed', () => {
    // Anger Management needs all five points of Improved Tactical Mastery.
    let alloc = spendMany({}, 'improved_heroic_strike', 3);
    alloc = spendMany(alloc, 'deflection', 5);
    alloc = spendMany(alloc, 'improved_tactical_mastery', 4);

    expect(pointsInTree(alloc, 'arms')).toBeGreaterThanOrEqual(10);
    expect(canSpend(alloc, 'anger_management')).toBe(false);

    alloc = spendMany(alloc, 'improved_tactical_mastery', 1);
    expect(alloc.improved_tactical_mastery).toBe(5);
    expect(canSpend(alloc, 'anger_management')).toBe(true);
  });

  it('refuses to spend past the total budget', () => {
    // Fill Fury's first two rows and then some, up to the cap.
    let alloc: Record<string, number> = {};
    for (const id of ['cruelty', 'booming_voice', 'iron_will', 'unbridled_wrath']) {
      alloc = spendMany(alloc, id, 5);
    }
    expect(pointsSpent(alloc)).toBe(20);

    // Drain the rest into Protection's deep rows is impossible, so use Arms
    // row 0, which is 11 ranks across three talents.
    alloc = spendMany(alloc, 'improved_heroic_strike', 3);
    alloc = spendMany(alloc, 'deflection', 5);
    alloc = spendMany(alloc, 'improved_rend', 3);
    alloc = spendMany(alloc, 'shield_specialization', 5);
    alloc = spendMany(alloc, 'anticipation', 5);
    alloc = spendMany(alloc, 'improved_tactical_mastery', 5);
    alloc = spendMany(alloc, 'toughness', 5);

    expect(pointsSpent(alloc)).toBe(51);
    expect(pointsRemaining(alloc)).toBe(0);
    expect(canSpend(alloc, 'improved_thunder_clap')).toBe(false);
    expect(spend(alloc, 'improved_thunder_clap')).toBe(alloc);
  });
});

describe('taking points back', () => {
  it('removes a point from a talent that has one', () => {
    const alloc = spendMany({}, 'deflection', 3);
    const after = unspend(alloc, 'deflection');
    expect(after.deflection).toBe(2);
  });

  it('drops a talent out of the allocation at zero', () => {
    const after = unspend(spend({}, 'deflection'), 'deflection');
    expect(after.deflection).toBeUndefined();
    expect(pointsSpent(after)).toBe(0);
  });

  it('refuses a removal that would strand a talent below it', () => {
    // Exactly five in Arms row 0, with a point in a row 1 talent resting on it.
    let alloc = spendMany({}, 'improved_heroic_strike', 3);
    alloc = spendMany(alloc, 'deflection', 2);
    alloc = spendMany(alloc, 'improved_charge', 1);

    expect(pointsInTree(alloc, 'arms')).toBe(6);
    // Taking a row 0 point back drops the tree to five, which still supports
    // Improved Charge, so this one is allowed.
    expect(canUnspend(alloc, 'deflection')).toBe(true);

    const atFive = unspend(alloc, 'deflection');
    expect(pointsInTree(atFive, 'arms')).toBe(5);
    // Now the tree is exactly at the tier, and any further removal strands it.
    expect(canUnspend(atFive, 'deflection')).toBe(false);
    expect(canUnspend(atFive, 'improved_heroic_strike')).toBe(false);
    expect(unspend(atFive, 'deflection')).toBe(atFive);

    // The talent resting on the tier can always come out itself.
    expect(canUnspend(atFive, 'improved_charge')).toBe(true);
  });

  it('refuses a removal that would strand a prerequisite', () => {
    let alloc = spendMany({}, 'improved_heroic_strike', 3);
    alloc = spendMany(alloc, 'deflection', 5);
    alloc = spendMany(alloc, 'improved_tactical_mastery', 5);
    alloc = spendMany(alloc, 'anger_management', 1);

    expect(alloc.anger_management).toBe(1);
    // Improved Tactical Mastery is Anger Management's prerequisite at 5/5.
    expect(canUnspend(alloc, 'improved_tactical_mastery')).toBe(false);

    const without = unspend(alloc, 'anger_management');
    expect(canUnspend(without, 'improved_tactical_mastery')).toBe(true);
  });

  it('refuses to remove from a talent with nothing in it', () => {
    expect(canUnspend({}, 'deflection')).toBe(false);
    expect(unspend({}, 'deflection')).toEqual({});
  });
});

describe('resetting', () => {
  it('clears one tree and leaves the others', () => {
    let alloc = spendMany({}, 'improved_heroic_strike', 3);
    alloc = spendMany(alloc, 'cruelty', 5);
    alloc = spendMany(alloc, 'anticipation', 4);
    expect(distribution(alloc)).toBe('3/5/4');

    const after = resetTree(alloc, 'fury');
    expect(distribution(after)).toBe('3/0/4');
    expect(pointsRemaining(after)).toBe(51 - 7);
  });
});

describe('legality', () => {
  it('accepts an empty allocation', () => {
    expect(isLegal({})).toBe(true);
  });

  it('rejects more points than exist', () => {
    expect(isLegal({ deflection: 5, cruelty: 5, anticipation: 5, toughness: 5, iron_will: 5,
                     unbridled_wrath: 5, booming_voice: 5, improved_rend: 3, improved_heroic_strike: 3,
                     shield_specialization: 5, improved_tactical_mastery: 5, enrage: 5 })).toBe(false);
  });

  it('rejects a talent past its rank cap', () => {
    expect(isLegal({ improved_heroic_strike: 4 })).toBe(false);
  });

  it('rejects a talent standing on an unmet tier', () => {
    expect(isLegal({ improved_charge: 1 })).toBe(false);
  });

  it('rejects an unknown talent id', () => {
    expect(isLegal({ not_a_talent: 1 })).toBe(false);
  });
});
