import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/game/character';
import type { ClassTalents } from '../../src/game/talents/Talent';
import { TOTAL_TALENT_POINTS } from '../../src/game/talents/Talent';
import { classesWithTalents, talentsForClass } from '../../src/game/talents/talentData';
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

/*
 * Every class's tree NAMES, SIZES and CAPSTONE are transcribed by hand below,
 * from talentsforever.com's rendered trees, rather than read back out of the
 * data.
 * A test that asked the data what the data said would pass whatever the data
 * said -- the same reason the base stats and the ability sheet are each written
 * out twice.
 *
 * The 466 individual talents are not transcribed; what is checked instead is
 * every structural invariant that must hold for all of them at once.
 *
 * ----------------------------------------------------------------------------
 * THE COUNT WENT 468 TO 466 AT CLIENT BUILD 1.60.1.70170, and the arithmetic is
 * worth writing out because SIX talents moved to get there and the patch notes
 * name three of them:
 *
 *   druid/feral_combat   19 -> 20   -King of the Jungle, +Shifting Power,
 *                                   +Improved Shifting Power
 *   paladin/holy         18 -> 17   -Improved Holy Strike      (not in the notes)
 *   paladin/retribution  18 -> 17   -Crusade                   (not in the notes)
 *   warrior/fury         18 -> 17   -Improved Cleave, -Boundless Rage,
 *                                   -Precision (not in the notes), -Iron Will
 *                                   (moved to Protection), +Lingering Rage,
 *                                   +Furious Precision, +Gore Drinker
 *   warrior/protection   18 -> 18   -Toughness, +Iron Will
 *
 * SO FOUR OF THE REMOVALS WERE SILENT. Improved Holy Strike, Crusade and
 * Precision are in no patch note at all, and all three were being spent on: the
 * two Paladin ones by all three Paladin builds. That is what this test is for --
 * a count is the cheapest thing that notices a tree has changed shape, and a
 * tree of the wrong length decodes every build URL after it into the wrong
 * talents.
 * ----------------------------------------------------------------------------
 *
 * ----------------------------------------------------------------------------
 * THIS TEST EARNED ITS KEEP ON 2026-09-23, and it is worth saying how.
 *
 * The talent data moved from a Wowhead scrape to the beta client's own files.
 * Counting talents per class found ONE difference, in Druid. This test found
 * two more that a count could not, because the counts matched:
 *
 *   rogue/combat        "Restless Blades" -> "Flawless Execution"
 *   warlock/affliction  "Drain Hope"      -> "Wrack"
 *   druid/balance       "Balance of Nature" is not in the client at all
 *
 * Three wrong talents in 469. That is a 99.4% accurate scrape and it would
 * still have been fatal, because talentsforever.com encodes a build as one
 * digit per talent IN TREE ORDER -- so a tree that is the wrong length or in
 * the wrong order decodes every profile after it into different talents, and
 * every profile in this project is specified by one of those URLs.
 * ----------------------------------------------------------------------------
 */
interface ClassSpec {
  readonly trees: readonly (readonly [id: string, count: number, capstone: string])[];
}

const SPEC: Readonly<Record<string, ClassSpec>> = {
  druid: {
    trees: [
      ['balance', 16, 'Moonkin Form'],
      // 20: King of the Jungle out, Shifting Power and Improved Shifting
      // Power in, at client build 1.60.1.70170.
      ['feral_combat', 20, 'Berserk'],
      ['restoration', 16, 'Wild Growth'],
    ],
  },
  hunter: {
    trees: [
      ['beast_mastery', 16, 'Bestial Wrath'],
      ['marksmanship', 16, 'Sniper Shot'],
      ['survival', 18, 'Lacerating Strikes'],
    ],
  },
  mage: {
    trees: [
      ['arcane', 18, 'Arcane Power'],
      ['fire', 17, 'Combustion'],
      ['frost', 19, 'Ice Barrier'],
    ],
  },
  paladin: {
    trees: [
      // 17 and 17: Improved Holy Strike and Crusade were both removed at
      // client build 1.60.1.70170, neither of them mentioned in the patch
      // notes, and all three Paladin builds had points in the first.
      ['holy', 17, "Light's Vigil"],
      ['protection', 16, 'Holy Shield'],
      ['retribution', 17, 'Twist of Light'],
    ],
  },
  priest: {
    trees: [
      ['discipline', 18, 'Power Infusion'],
      ['holy', 17, 'Prayer of Mending'],
      ['shadow', 18, 'Shadowform'],
    ],
  },
  rogue: {
    trees: [
      ['assassination', 17, 'Venom'],
      ['combat', 17, 'Adrenaline Rush'],
      ['subtlety', 19, 'Thousand Cuts'],
    ],
  },
  shaman: {
    trees: [
      ['elemental', 16, 'Lava Burst'],
      ['enhancement', 18, 'Rage of the Farseer'],
      ['restoration', 16, 'Riptide'],
    ],
  },
  warlock: {
    trees: [
      ['affliction', 17, 'Wrack'],
      ['demonology', 19, 'Demonic Pact'],
      ['destruction', 16, 'Incinerate'],
    ],
  },
  warrior: {
    trees: [
      ['arms', 17, 'Mortal Strike'],
      /*
       * 17: the largest reshuffle in the 1.60.1.70170 patch. Improved Cleave,
       * Boundless Rage and Precision removed -- only the first two are in the
       * notes -- Iron Will moved out to Protection, and Lingering Rage, Furious
       * Precision and Gore Drinker added. Four out, three in.
       */
      ['fury', 17, 'Bloodthirst'],
      /*
       * 18, and it stayed 18 through a patch that moved six of its rows:
       * Toughness out, Iron Will in from Fury.
       *
       * THE COMMENT HERE USED TO SAY "18, not 19: Forever REMOVED Bastion from
       * this tree, and Focused Rage moved into the slot it vacated", and it was
       * stale before this patch touched it -- Bastion is in the client's tree,
       * at row 5 where Focused Rage was said to be, and was in the data this
       * comment sat beside. A note about why a count is what it is outlives the
       * thing it was explaining, which is why the count is the assertion and the
       * note is only a note.
       */
      ['protection', 18, 'Shield Slam'],
    ],
  },
};

const CLASS_IDS = Object.keys(SPEC);

/** The 466 above, summed, so the total is asserted rather than assumed. */
const TOTAL_TALENTS = Object.values(SPEC)
  .flatMap((spec) => spec.trees)
  .reduce((sum, [, count]) => sum + count, 0);

function talentsOf(classId: string): ClassTalents {
  const talents = talentsForClass(classId as ClassId);
  if (!talents) throw new Error(`no talents for ${classId}`);
  return talents;
}

/** Spend n points into a talent, one at a time, as a user would. */
function spendMany(talents: ClassTalents, allocation: Record<string, number>, id: string, n: number) {
  let next: Record<string, number> = { ...allocation };
  for (let i = 0; i < n; i++) next = { ...spend(talents, next, id) };
  return next;
}

describe('every class has its trees', () => {
  it('loads all nine classes and nothing else', () => {
    expect(classesWithTalents()).toEqual([...CLASS_IDS].sort());
  });

  it('adds up to 466 talents', () => {
    expect(TOTAL_TALENTS).toBe(466);
    const loaded = CLASS_IDS.reduce(
      (sum, id) => sum + talentsOf(id).trees.reduce((n, tree) => n + tree.talents.length, 0),
      0,
    );
    expect(loaded).toBe(TOTAL_TALENTS);
  });

  it.each(CLASS_IDS)('%s has the stated trees, sizes and capstone', (classId) => {
    const talents = talentsOf(classId);
    const spec = SPEC[classId];

    expect(talents.trees.map((tree) => tree.id)).toEqual(spec.trees.map(([id]) => id));

    for (const [treeId, count, capstone] of spec.trees) {
      const tree = talents.trees.find((candidate) => candidate.id === treeId);
      expect(tree, `${classId}/${treeId}`).toBeDefined();
      if (!tree) continue;

      expect(tree.talents.length, `${classId}/${treeId} size`).toBe(count);

      const deepest = [...tree.talents].sort((a, b) => b.row - a.row)[0];
      expect(deepest.name, `${classId}/${treeId} capstone`).toBe(capstone);
      // A 31-point capstone: six rows down, one rank.
      expect(deepest.row).toBe(6);
      expect(deepest.tier).toBe(30);
      expect(deepest.ranks).toBe(1);
    }
  });

  it('records where each class came from', () => {
    for (const classId of CLASS_IDS) {
      /*
       * ONE SOURCE FOR EVERY CLASS NOW, and a static file rather than a page:
       * `tools/import_forever_talents.mjs` fetches it with plain `fetch`, with
       * no browser, no DOM walk and no clipboard.
       */
      expect(talentsOf(classId).source).toBe('https://talentsforever.com/talents.js');
    }
  });
});

describe('invariants that must hold for all 470 talents', () => {
  it.each(CLASS_IDS)('%s: every tier is five times the row', (classId) => {
    for (const tree of talentsOf(classId).trees) {
      for (const talent of tree.talents) {
        expect(talent.tier, `${classId}/${talent.name}`).toBe(talent.row * 5);
      }
    }
  });

  it.each(CLASS_IDS)('%s: every talent sits in one of four columns', (classId) => {
    for (const tree of talentsOf(classId).trees) {
      for (const talent of tree.talents) {
        expect(talent.col, `${classId}/${talent.name}`).toBeGreaterThanOrEqual(0);
        expect(talent.col, `${classId}/${talent.name}`).toBeLessThanOrEqual(3);
        expect(talent.ranks).toBeGreaterThanOrEqual(1);
        expect(talent.icon).toBeTruthy();
        expect(talent.description).toBeTruthy();
      }
    }
  });

  it.each(CLASS_IDS)('%s: no two talents share a grid cell within a tree', (classId) => {
    for (const tree of talentsOf(classId).trees) {
      const cells = tree.talents.map((talent) => `${talent.row},${talent.col}`);
      expect(new Set(cells).size, `${classId}/${tree.id}`).toBe(cells.length);
    }
  });

  it.each(CLASS_IDS)('%s: every prerequisite resolves, never from below', (classId) => {
    const talents = talentsOf(classId);
    for (const tree of talentsOf(classId).trees) {
      for (const talent of tree.talents) {
        if (!talent.requires) continue;
        const prereq = talents.byId.get(talent.requires);
        expect(prereq, `${classId}/${talent.name} requires ${talent.requires}`).toBeDefined();
        if (!prereq) continue;

        expect(prereq.tree, `${classId}/${talent.name}`).toBe(talent.tree);
        // Usually above; the Paladin and Priest each have one pointing sideways
        // at a neighbour on the same row.
        expect(prereq.row, `${classId}/${talent.name}`).toBeLessThanOrEqual(talent.row);
        expect(talent.requiresRanks, `${classId}/${talent.name}`).toBe(prereq.ranks);
      }
    }
  });

  it.each(CLASS_IDS)('%s: cannot reach two capstones with 51 points', (classId) => {
    // 31 points to a capstone, twice, is 62. This is what makes the Warrior's
    // Mortal Strike, Bloodthirst and Shield Slam mutually exclusive, and the
    // same holds for every class.
    expect(TOTAL_TALENT_POINTS).toBe(51);
    expect(talentsOf(classId).trees).toHaveLength(3);
    expect(31 * 2).toBeGreaterThan(TOTAL_TALENT_POINTS);
  });
});

describe('talent ids are scoped to a class', () => {
  it('has at least one id belonging to more than one class', () => {
    // Deflection is a Hunter, Paladin, Rogue and Warrior talent. This is why
    // the rules take a class rather than consulting a global index -- the guard
    // is here so that nobody "simplifies" it back into one map.
    const owners = CLASS_IDS.filter((id) => talentsOf(id).byId.has('deflection'));
    expect(owners.length).toBeGreaterThan(1);
  });

  it('resolves a shared id to the right class', () => {
    const warrior = talentsOf('warrior').byId.get('deflection');
    const rogue = talentsOf('rogue').byId.get('deflection');

    expect(warrior?.tree).toBe('arms');
    expect(rogue?.tree).toBe('combat');
  });
});

describe('spending points', () => {
  const warrior = talentsOf('warrior');

  it('starts with every point available', () => {
    expect(pointsRemaining({})).toBe(51);
    expect(pointsSpent({})).toBe(0);
    expect(distribution(warrior, {})).toBe('0/0/0');
  });

  it('spends into an open talent', () => {
    const after = spend(warrior, {}, 'improved_heroic_strike');
    expect(after.improved_heroic_strike).toBe(1);
    expect(pointsRemaining(after)).toBe(50);
  });

  it('stops at a talent maximum', () => {
    const after = spendMany(warrior, {}, 'improved_heroic_strike', 5);
    expect(after.improved_heroic_strike).toBe(3);
    expect(canSpend(warrior, after, 'improved_heroic_strike')).toBe(false);
  });

  it('refuses a talent whose row has not opened', () => {
    expect(canSpend(warrior, {}, 'improved_charge')).toBe(false);

    const five = spendMany(
      warrior,
      spendMany(warrior, {}, 'improved_heroic_strike', 3),
      'deflection',
      2,
    );
    expect(pointsInTree(warrior, five, 'arms')).toBe(5);
    expect(canSpend(warrior, five, 'improved_charge')).toBe(true);
  });

  it('counts only its own tree towards a tier', () => {
    const fury = spendMany(warrior, {}, 'cruelty', 5);
    expect(pointsInTree(warrior, fury, 'fury')).toBe(5);
    expect(pointsInTree(warrior, fury, 'arms')).toBe(0);
    expect(canSpend(warrior, fury, 'improved_charge')).toBe(false);
  });

  it('refuses a talent whose prerequisite is not maxed', () => {
    let alloc = spendMany(warrior, {}, 'improved_heroic_strike', 3);
    alloc = spendMany(warrior, alloc, 'deflection', 5);
    alloc = spendMany(warrior, alloc, 'improved_tactical_mastery', 4);

    expect(canSpend(warrior, alloc, 'anger_management')).toBe(false);

    alloc = spendMany(warrior, alloc, 'improved_tactical_mastery', 1);
    expect(alloc.improved_tactical_mastery).toBe(5);
    expect(canSpend(warrior, alloc, 'anger_management')).toBe(true);
  });

  it('honours a sideways prerequisite', () => {
    // The Priest's Improved Mind Flay needs Mind Flay, which sits BESIDE it on
    // the same row rather than above.
    const priest = talentsOf('priest');
    const improved = priest.byId.get('improved_mind_flay');
    const base = priest.byId.get('mind_flay');

    expect(improved?.requires).toBe('mind_flay');
    expect(improved?.row).toBe(base?.row);

    let alloc: Record<string, number> = {};
    for (const tree of priest.trees) {
      if (tree.id !== 'shadow') continue;
      for (const talent of tree.talents.filter((t) => t.row === 0)) {
        alloc = spendMany(priest, alloc, talent.id, talent.ranks);
      }
    }
    for (const tree of priest.trees) {
      if (tree.id !== 'shadow') continue;
      for (const talent of tree.talents.filter((t) => t.row === 1)) {
        alloc = spendMany(priest, alloc, talent.id, talent.ranks);
      }
    }

    expect(pointsInTree(priest, alloc, 'shadow')).toBeGreaterThanOrEqual(10);
    expect(canSpend(priest, alloc, 'improved_mind_flay')).toBe(false);

    alloc = spendMany(priest, alloc, 'mind_flay', 1);
    expect(canSpend(priest, alloc, 'improved_mind_flay')).toBe(true);
  });

  /*
   * FIFTY-ONE POINTS, SPREAD OVER ELEVEN TALENTS, and the list had to be rebuilt
   * at client build 1.60.1.70170 because TOUGHNESS was removed from the Warrior.
   * Its five points now go to Improved Revenge and Improved Bloodrage.
   *
   * IRON WILL IS STILL HERE AND IS IN A DIFFERENT TREE. It moved from Fury row 1
   * to Protection row 0, which is why it is now one of the three talents paying
   * for Anticipation's tier rather than one of the two paying for Unbridled
   * Wrath's. The arithmetic a reader should be able to follow:
   *
   *   arms  11   improved_heroic_strike 3, deflection 5, improved_rend 3,
   *              and improved_tactical_mastery 5 on top of them (tier 5)
   *   fury  10   cruelty 5, booming_voice 5, with unbridled_wrath 5 at tier 5
   *   prot  10   iron_will 5, shield_specialization 5 at tier 0, then
   *              anticipation 5, improved_revenge 3 and improved_bloodrage 2
   */
  it('refuses to spend past the total budget', () => {
    let alloc: Record<string, number> = {};
    for (const id of ['cruelty', 'booming_voice', 'iron_will', 'unbridled_wrath']) {
      alloc = spendMany(warrior, alloc, id, 5);
    }
    alloc = spendMany(warrior, alloc, 'improved_heroic_strike', 3);
    alloc = spendMany(warrior, alloc, 'deflection', 5);
    alloc = spendMany(warrior, alloc, 'improved_rend', 3);
    alloc = spendMany(warrior, alloc, 'shield_specialization', 5);
    alloc = spendMany(warrior, alloc, 'anticipation', 5);
    alloc = spendMany(warrior, alloc, 'improved_tactical_mastery', 5);
    alloc = spendMany(warrior, alloc, 'improved_revenge', 3);
    alloc = spendMany(warrior, alloc, 'improved_bloodrage', 2);

    expect(pointsSpent(alloc)).toBe(51);
    expect(pointsRemaining(alloc)).toBe(0);
    expect(canSpend(warrior, alloc, 'improved_thunder_clap')).toBe(false);
    expect(spend(warrior, alloc, 'improved_thunder_clap')).toBe(alloc);
  });
});

describe('taking points back', () => {
  const warrior = talentsOf('warrior');

  it('removes a point from a talent that has one', () => {
    const alloc = spendMany(warrior, {}, 'deflection', 3);
    expect(unspend(warrior, alloc, 'deflection').deflection).toBe(2);
  });

  it('drops a talent out of the allocation at zero', () => {
    const after = unspend(warrior, spend(warrior, {}, 'deflection'), 'deflection');
    expect(after.deflection).toBeUndefined();
    expect(pointsSpent(after)).toBe(0);
  });

  it('refuses a removal that would strand a talent below it', () => {
    let alloc = spendMany(warrior, {}, 'improved_heroic_strike', 3);
    alloc = spendMany(warrior, alloc, 'deflection', 2);
    alloc = spendMany(warrior, alloc, 'improved_charge', 1);

    expect(pointsInTree(warrior, alloc, 'arms')).toBe(6);
    expect(canUnspend(warrior, alloc, 'deflection')).toBe(true);

    const atFive = unspend(warrior, alloc, 'deflection');
    expect(pointsInTree(warrior, atFive, 'arms')).toBe(5);
    // Now exactly at the tier, so any further removal strands Improved Charge.
    expect(canUnspend(warrior, atFive, 'deflection')).toBe(false);
    expect(canUnspend(warrior, atFive, 'improved_heroic_strike')).toBe(false);
    expect(unspend(warrior, atFive, 'deflection')).toBe(atFive);

    // The talent resting on the tier can always come out itself.
    expect(canUnspend(warrior, atFive, 'improved_charge')).toBe(true);
  });

  it('refuses a removal that would strand a prerequisite', () => {
    let alloc = spendMany(warrior, {}, 'improved_heroic_strike', 3);
    alloc = spendMany(warrior, alloc, 'deflection', 5);
    alloc = spendMany(warrior, alloc, 'improved_tactical_mastery', 5);
    alloc = spendMany(warrior, alloc, 'anger_management', 1);

    expect(canUnspend(warrior, alloc, 'improved_tactical_mastery')).toBe(false);

    const without = unspend(warrior, alloc, 'anger_management');
    expect(canUnspend(warrior, without, 'improved_tactical_mastery')).toBe(true);
  });

  it('refuses to remove from a talent with nothing in it', () => {
    expect(canUnspend(warrior, {}, 'deflection')).toBe(false);
    expect(unspend(warrior, {}, 'deflection')).toEqual({});
  });
});

describe('resetting', () => {
  const warrior = talentsOf('warrior');

  /*
   * SHIELD SPECIALIZATION RATHER THAN ANTICIPATION, because Anticipation moved
   * from Protection row 0 to row 1 at client build 1.60.1.70170 and four points
   * in it now needs five below it first -- which would have made the
   * distribution 3/5/9 and tested nothing about resetting.
   *
   * The talent here only has to be a row-0 five-ranker in Protection, which is
   * what a reader should check if this needs moving again.
   */
  it('clears one tree and leaves the others', () => {
    let alloc = spendMany(warrior, {}, 'improved_heroic_strike', 3);
    alloc = spendMany(warrior, alloc, 'cruelty', 5);
    alloc = spendMany(warrior, alloc, 'shield_specialization', 4);
    expect(distribution(warrior, alloc)).toBe('3/5/4');

    const after = resetTree(warrior, alloc, 'fury');
    expect(distribution(warrior, after)).toBe('3/0/4');
    expect(pointsRemaining(after)).toBe(51 - 7);
  });
});

describe('legality', () => {
  const warrior = talentsOf('warrior');

  it('accepts an empty allocation', () => {
    expect(isLegal(warrior, {})).toBe(true);
  });

  it('rejects a talent past its rank cap', () => {
    expect(isLegal(warrior, { improved_heroic_strike: 4 })).toBe(false);
  });

  it('rejects a talent standing on an unmet tier', () => {
    expect(isLegal(warrior, { improved_charge: 1 })).toBe(false);
  });

  it('rejects an unknown talent id', () => {
    expect(isLegal(warrior, { not_a_talent: 1 })).toBe(false);
  });

  it("rejects another class's talent id", () => {
    // `focused_fire` is a Hunter talent; it must not validate against a
    // Warrior, even though both classes have a talent called Deflection.
    expect(talentsOf('hunter').byId.has('focused_fire')).toBe(true);
    expect(warrior.byId.has('focused_fire')).toBe(false);
    expect(isLegal(warrior, { focused_fire: 1 })).toBe(false);
  });
});
