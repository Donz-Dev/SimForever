import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/game/character';
import type { TalentEffects } from '../../src/game/talents/TalentEffect';
import { talentNumber } from '../../src/game/talents/talentValues';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import druidValues from '../../src/data/talents/values/druid.json';
import paladinValues from '../../src/data/talents/values/paladin.json';

/*
 * ============================================================================
 * WHICH NUMBER A BLANKET MULTIPLIER READS, WHEN THE ROW HOLDS SEVERAL.
 *
 * NATURALIST IS WHY THIS FILE EXISTS, and it was wrong by a factor of ten for
 * the whole life of the talent. "Reduces the cast time of your Healing Touch
 * spell by 0.5 sec and increases all damage you deal by 5%" is one row of two
 * numbers -- `[0.5, 5]` -- and `conditionalDamage` had no `valueIndex`, so it
 * read index 0. A rank-5 Moonkin carried x1.005 instead of x1.05, and the
 * figure it was reading was a number of SECONDS.
 *
 * WHY NOTHING CAUGHT IT, which is the part worth keeping. Half a percent is a
 * perfectly plausible blanket multiplier. The talent reported itself FULLY
 * MODELLED rather than unmodelled, so the census counted it in the `Fully`
 * column and no audit looks at a working talent's magnitude. And the only
 * published check on it was a profile DPS figure that had been measured with
 * the bug already in -- so every Moonkin and Cat number in the repository was
 * 4.5% and 1.8% light, and perfectly self-consistent.
 *
 * SCOPED TO `conditionalDamage` AND `conditionalCrit` DELIBERATELY. The wider
 * invariant -- "any effect reading a value off a multi-value row must say which
 * number it wants" -- catches about forty-five effects across all nine classes,
 * and almost all of them correctly want index 0. Transcribing that census by
 * hand is a real audit and it is not this fix; it is recorded as its own task.
 * These two kinds are Naturalist's own family, there are eleven of them across
 * seven classes, and a blanket multiplier is the worst place for this bug
 * because it touches every point of damage a character deals INCLUDING the
 * auto-attacks -- `damageMultiplier` is the one scope that reaches a swing.
 * ============================================================================
 */

const TABLES: readonly [ClassId, Readonly<Record<string, TalentEffects>>][] = [
  ['warrior', WARRIOR_TALENT_EFFECTS],
  ['rogue', ROGUE_TALENT_EFFECTS],
  ['druid', DRUID_TALENT_EFFECTS],
  ['shaman', SHAMAN_TALENT_EFFECTS],
  ['mage', MAGE_TALENT_EFFECTS],
  ['paladin', PALADIN_TALENT_EFFECTS],
  ['hunter', HUNTER_TALENT_EFFECTS],
  ['warlock', WARLOCK_TALENT_EFFECTS],
  ['priest', PRIEST_TALENT_EFFECTS],
];

const BLANKET = ['conditionalDamage', 'conditionalCrit'];

/**
 * Every blanket multiplier in the project, and which number it reads.
 *
 * Written out BY HAND from each tooltip, and `wants` says what that number
 * MEANS -- so a reader can see the effect is asking for the right thing without
 * opening the data file. A test that read the index back off the effect would
 * pass whatever the effect said.
 */
const BLANKET_MULTIPLIERS: readonly {
  readonly cls: ClassId;
  readonly talentId: string;
  /** The index the effect must read. */
  readonly index: number;
  /** What that index holds at rank 1, from the tooltip. */
  readonly atRankOne: number;
  readonly wants: string;
}[] = [
  /*
   * THE ONE THAT WAS WRONG, and the only one in the project that is not index
   * 0: "...by 0.1 sec and increases all damage you deal by 1%". Index 0 is the
   * Healing Touch cast time, in SECONDS.
   */
  { cls: 'druid', talentId: 'naturalist', index: 1, atRankOne: 1, wants: 'all damage you deal' },

  /*
   * TWO MORE SIT ON MULTI-VALUE ROWS AND WANT INDEX 0 ANYWAY, which is why the
   * default is the default. Both were right, and neither said so.
   */
  {
    cls: 'mage',
    talentId: 'arcane_instability',
    index: 0,
    atRankOne: 1,
    // "...your spells by 1% AND your critical strike chance by 1%". The two
    // numbers are equal at every rank, so index 0 was also right by luck --
    // and the crit half reads index 1 through its own `stat` effect.
    wants: 'damage done by your spells',
  },
  {
    cls: 'paladin',
    talentId: 'crusade',
    index: 0,
    atRankOne: 1,
    // "Increases all damage dealt by 1%. Increased by an additional 1% against
    // Demon and Undead targets." Index 0 is the unconditional half; index 1 is
    // a target property and carries its own `unmodelled` reason.
    wants: 'all damage dealt, unconditionally',
  },
  {
    cls: 'warrior',
    talentId: 'weaponmaster',
    index: 0,
    atRankOne: 1,
    // The row is [crit, armor ignored, extra attack chance] and this effect is
    // gated on an axe or a polearm, which is the clause index 0 belongs to.
    wants: 'the axe and polearm crit clause',
  },

  /*
   * AND THE REMAINING SEVEN ARE SINGLE-VALUE ROWS, so index 0 is the only
   * number there is. They are listed anyway: a re-import that gave one of them
   * a second clause would otherwise start reading index 0 of a row that had
   * changed shape, silently, which is the whole failure this file is about.
   */
  {
    cls: 'hunter',
    talentId: 'focused_fire',
    index: 0,
    atRankOne: 1,
    wants: 'all damage you and your pet deal',
  },
  {
    cls: 'hunter',
    talentId: 'improved_tracking',
    index: 0,
    atRankOne: 1,
    wants: 'damage against tracked creature types',
  },
  {
    cls: 'paladin',
    talentId: 'one_handed_weapon_specialization',
    index: 0,
    atRankOne: 3,
    wants: 'damage with one-handed melee weapons',
  },
  {
    cls: 'paladin',
    talentId: 'two_handed_weapon_specialization',
    index: 0,
    atRankOne: 3,
    wants: 'damage with two-handed melee weapons',
  },
  {
    cls: 'rogue',
    talentId: 'murder',
    index: 0,
    atRankOne: 2,
    wants: 'damage against Humanoid and Giant targets',
  },
  {
    cls: 'warrior',
    talentId: 'two_handed_weapon_specialization',
    index: 0,
    atRankOne: 1,
    wants: 'damage with two-handed melee weapons',
  },
  {
    cls: 'warrior',
    talentId: 'bastion',
    index: 0,
    atRankOne: 2,
    wants: 'all damage you deal while a shield is equipped',
  },
];

describe('every blanket damage or crit multiplier reads a number somebody checked', () => {
  it('has exactly these eleven, so a twelfth has to be recorded', () => {
    /*
     * EQUAL SETS, not "every one found is recorded". A stale row and an
     * unrecorded effect are both worth failing on, and the second is the
     * Naturalist shape -- a multiplier reading a number nobody looked at.
     */
    const found = TABLES.flatMap(([cls, table]) =>
      Object.entries(table)
        .filter(([, effects]) => effects.some((effect) => BLANKET.includes(effect.kind)))
        .map(([talentId]) => `${cls}/${talentId}`),
    );
    const recorded = BLANKET_MULTIPLIERS.map(({ cls, talentId }) => `${cls}/${talentId}`);
    expect(found.sort()).toEqual(recorded.sort());
  });

  it('reads the index the tooltip puts that clause at', () => {
    for (const { cls, talentId, index, atRankOne, wants } of BLANKET_MULTIPLIERS) {
      const table = TABLES.find(([c]) => c === cls)![1];
      const effect = table[talentId].find((entry) => BLANKET.includes(entry.kind))!;
      const declared = 'valueIndex' in effect ? (effect.valueIndex ?? 0) : 0;
      expect(declared, `${cls}/${talentId} should read ${wants}`).toBe(index);
      expect(talentNumber(cls, talentId, 1, index), `${cls}/${talentId}: ${wants}`).toBeCloseTo(
        atRankOne,
        6,
      );
    }
  });
});

describe('Naturalist is five percent, not half of one', () => {
  it('names index 1, because index 0 is a number of seconds', () => {
    // The tooltip, from the values file rather than from this test, so a
    // re-import that reordered the clauses fails here rather than silently.
    expect(druidValues.talents.naturalist.text).toBe(
      'Reduces the cast time of your Healing Touch spell by {0} sec and increases all damage you deal by {1}%.',
    );
    expect(talentNumber('druid', 'naturalist', 5, 0)).toBeCloseTo(0.5, 6);
    expect(talentNumber('druid', 'naturalist', 5, 1)).toBe(5);

    expect(
      DRUID_TALENT_EFFECTS.naturalist.find((entry) => entry.kind === 'conditionalDamage'),
    ).toMatchObject({ valueIndex: 1 });
  });

  it('is one percent a rank, so any Druid profile that takes it gets rank x 1%', () => {
    /*
     * ASSERTED ON THE VALUES rather than on a built character, so it holds for
     * every profile -- the talent has no requirement, which makes it the one
     * genuinely blanket multiplier in the Druid's trees and the reason it
     * reaches the paw swings as well as the spells.
     */
    for (const rank of [1, 2, 3, 4, 5]) {
      expect(talentNumber('druid', 'naturalist', rank, 1), `rank ${rank}`).toBe(rank);
    }
  });
});

describe('Thick Hide is NOT a percentage of item armor, and is modelled as one', () => {
  it('states armor per LEVEL and per DEFENSE SKILL, which itemArmorPercent cannot express', () => {
    /*
     * ----------------------------------------------------------------------
     * FOUND BY THE SWEEP THE NATURALIST FIX MOTIVATED, and it is a DIFFERENT
     * KIND OF WRONG: not the wrong index but the wrong rule.
     *
     * Forever's Thick Hide is "you gain 3 additional base Armor per level and
     * another 2 base Armor for each point of defense skill beyond five times
     * your level" -- a flat term times the level, plus a term per surplus
     * defense point. `itemArmorPercent` computes `itemArmor x value / 100`,
     * which is exactly right for Toughness ("increases your armor value FROM
     * ITEMS by 10%") and expresses neither of Thick Hide's clauses.
     *
     * At rank 3 the first clause alone is 180 armor; the Bear currently gets
     * 3% of its item armor, about 33.
     *
     * RECORDED HERE RATHER THAN FIXED, because it needs a new effect kind and
     * it moves the Bear's RAGE economy in the counter-intuitive direction --
     * more armor means less damage taken means LESS rage -- so it wants its own
     * PR and a re-measured baseline. This test pins the evidence and the
     * current behaviour so the finding cannot be lost and the fix has a before.
     * ----------------------------------------------------------------------
     */
    expect(druidValues.talents.thick_hide.text).toContain('additional base Armor per level');
    expect(druidValues.talents.thick_hide.text).toContain('for each point of defense skill');
    expect(druidValues.talents.thick_hide.text).not.toContain('from items');

    // Toughness, the same effect's correct caller, says the opposite.
    expect(paladinValues.talents.toughness.text).toContain('armor value from items');

    // What it is modelled as TODAY. Change this when the effect kind arrives.
    expect(DRUID_TALENT_EFFECTS.thick_hide).toEqual([{ kind: 'itemArmorPercent' }]);
  });
});
