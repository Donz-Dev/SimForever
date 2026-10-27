import { describe, expect, it } from 'vitest';
import type { AttackTableKind } from '../../src/engine';
import type { HeadroomSlice } from '../../src/game/combat/statHeadroom';
import {
  dodgeParryHeadroom,
  hitHeadroom,
  tiersFrom,
} from '../../src/game/combat/statHeadroom';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { characterAtCombatStart } from '../../src/simulator';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles';
import type { CharacterProfile } from '../../src/profiles';

/*
 * ==============================================================================
 * THE CAP LADDER: "chance to miss" is up to five numbers, and a build can be
 * capped on one and not another.
 *
 * THE EXPECTED FIGURES ARE WRITTEN OUT BY HAND FROM THE RULESET CONSTANTS, not
 * read from `COMBAT_CONSTANTS` -- a test that reads the source data passes
 * whatever the source data says. For a level 60 character at 300 weapon skill
 * against a level 63 target (315 defense skill, a 15-point gap, so the steeper
 * per-point rate):
 *
 *   melee special miss   500 base + 15 x 20 per point            = 800  ->  8.00%
 *   melee auto, 1H       the same                                = 800  ->  8.00%
 *   melee auto, DW       the same + 1900 dual-wield penalty      = 2700 -> 27.00%
 *   spell miss           1700 flat, floored at 100               = 17.00%, cap 16.00
 *   enemy dodge          500 base + 15 x 10 per point            = 650  ->  6.50%
 *   enemy parry          1400 for a shield build, 0 for anyone else
 *
 * Gear hit comes off every one of those, which is what makes the headroom a
 * property of the CHARACTER rather than of the ruleset.
 * ==============================================================================
 */

const BOSS = createTrainingDummy({ armor: 3731, level: 63 });

function slice(label: string, headroom: number): HeadroomSlice {
  return { table: 'melee-special', label, current: headroom, headroom };
}

function presetNamed(id: string): CharacterProfile {
  const preset = PROFILE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`No preset ${id}`);
  return preset.build();
}

/** The player and the chance provider the fight itself would use. */
function built(profile: CharacterProfile) {
  const player = characterAtCombatStart(profile);
  if (!player) throw new Error('no player');
  return {
    player,
    // Enemy parry depends on whether the target swings back, not on the style.
    chances: createForeverAttackChances({
      targetAttacks: profile.encounter.targetAttacks,
    }),
  };
}

describe('tiersFrom', () => {
  it('makes one tier per distinct cap, in ascending order', () => {
    const tiers = tiersFrom([slice('specials', 1), slice('autos', 20), slice('spells', 9)]);

    expect(tiers.map((tier) => [tier.from, tier.to])).toEqual([
      [0, 1],
      [1, 9],
      [9, 20],
    ]);
  });

  it('names only the slices still gaining inside each tier, so the set shrinks', () => {
    const tiers = tiersFrom([slice('specials', 1), slice('autos', 20), slice('spells', 9)]);

    expect(tiers[0].benefits).toEqual(['specials', 'autos', 'spells']);
    expect(tiers[1].benefits).toEqual(['autos', 'spells']);
    expect(tiers[2].benefits).toEqual(['autos']);

    /*
     * MONOTONE BY CONSTRUCTION, and worth asserting as the invariant rather
     * than as three lists: a boundary is a cap, so crossing one can only ever
     * take a slice out of the set. A tier that gained one back would mean the
     * boundaries were not caps at all.
     */
    for (let index = 1; index < tiers.length; index++) {
      expect(tiers[index].benefits.length).toBeLessThan(tiers[index - 1].benefits.length);
    }
  });

  it('collapses slices that share a cap into one tier', () => {
    // Both hands of a dual-wielder at base skill have the same miss, so there
    // is one rung and not two identical ones.
    const tiers = tiersFrom([slice('main hand', 12), slice('off hand', 12)]);

    expect(tiers).toHaveLength(1);
    expect(tiers[0].benefits).toEqual(['main hand', 'off hand']);
  });

  it('returns nothing when every slice is already capped', () => {
    expect(tiersFrom([slice('specials', 0), slice('spells', 0)])).toEqual([]);
  });

  it('returns nothing when there are no slices to cap', () => {
    // A caster has no melee table, so `dodgeParryReduction` has no slice at
    // all. That is a different statement from "capped" and the planner says so.
    expect(tiersFrom([])).toEqual([]);
  });

  it('names each rung after what runs out at the top of it', () => {
    /*
     * THE RUNG IS NAMED BY WHAT IT CAPS, not by its width, because the width
     * alone reads as a cap figure. "+9.00% to cap off-hand swings" is the
     * question somebody asked; "the first 9.00%" sounds like a 9% cap and is
     * not one.
     */
    const tiers = tiersFrom([slice('specials', 1), slice('autos', 20), slice('spells', 9)]);

    expect(tiers.map((tier) => tier.caps)).toEqual([['specials'], ['spells'], ['autos']]);
    // And every rung caps something: a boundary IS a headroom value.
    for (const tier of tiers) expect(tier.caps.length).toBeGreaterThan(0);
  });

  it('runs all the way to each cap rather than stopping short', () => {
    /*
     * AN EARLIER VERSION TRUNCATED THE LADDER at twelve points, on the
     * reasoning that no item grants more -- and the top rung then said
     * "+3.00% more" where the honest figure was "+10.00% more to cap main-hand
     * swings". The question is how much it would TAKE, so a rung that stops
     * short answers a different one.
     */
    const tiers = tiersFrom([slice('specials', 1), slice('autos', 20)]);

    expect(tiers.map((tier) => [tier.from, tier.to])).toEqual([
      [0, 1],
      [1, 20],
    ]);
  });
});

describe('hit headroom', () => {
  it('has no spell floor to take off, so the cap is 17 points', () => {
    /*
     * THE OWNER REMOVED THE 1% FLOOR: "spells need 17% chance to hit in order
     * to cap." This test used to assert the headroom was one point LESS than
     * the miss, the one point being the floor; with no floor the two are the
     * same number. `hitHeadroom` still subtracts `missFloor` -- it is zero.
     *
     * THE GEAR'S OWN HIT IS READ RATHER THAN WRITTEN DOWN, so the invariant is
     * the relationship and not the figure.
     */
    const { player, chances } = built(presetNamed('shadow_priest'));
    const spells = hitHeadroom(player, BOSS, chances).find((entry) => entry.table === 'spell');
    const fromGear = player.stats.effective.hitChance;

    expect(spells).toBeDefined();
    expect(fromGear).toBeGreaterThan(0);
    expect(spells!.current).toBeCloseTo(17 - fromGear, 6);
    expect(spells!.headroom).toBeCloseTo(17 - fromGear, 6);
    expect(spells!.current - spells!.headroom).toBeCloseTo(0, 6);
  });

  it('reports a capped slice beside an uncapped one on the same character', () => {
    /*
     * THE CASE THE WHOLE LADDER EXISTS FOR, and the ruleset owner's own
     * example. A Combat Rogue carries more hit than its SPECIALS can use -- 8%
     * of special miss is gone twice over -- and its auto-attacks still carry
     * the 19-point dual-wield penalty, so they miss 27% less whatever hit it
     * has and still have headroom.
     *
     * THE HIT IS READ OFF THE CHARACTER. It used to be written as 16, the
     * Rogue's Classic set; its benchmark template targets 120 rating, which is
     * 12 points. The SHAPE is the invariant: one slice capped at zero, the
     * other two still paying, off one character.
     */
    const { player, chances } = built(presetNamed('rogue_combat'));
    const slices = hitHeadroom(player, BOSS, chances);
    const hit = player.stats.effective.hitChance;

    const specials = slices.find((entry) => entry.label === 'Specials');
    const autos = slices.filter((entry) => entry.table === 'melee-auto');

    expect(hit).toBeGreaterThan(8);
    expect(specials!.headroom).toBe(0);
    expect(autos).toHaveLength(2);
    for (const auto of autos) expect(auto.headroom).toBeCloseTo(27 - hit, 6);

    // So hit is NOT written off for this build: one rung remains, bought by
    // the swings alone.
    const tiers = tiersFrom(slices);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].caps.every((label) => label.includes('swings'))).toBe(true);
  });

  it('gives a caster a spell slice and no melee one', () => {
    const { player, chances } = built(presetNamed('mage_frostfire'));
    const slices = hitHeadroom(player, BOSS, chances);

    expect(slices.map((entry) => entry.table)).toEqual(['spell']);
  });
  it('folds the slices that agree into one row for each outcome', () => {
    /*
     * ------------------------------------------------------------------------
     * ENEMY DODGE IS THE SAME 6.50% ON EVERY MELEE TABLE a build rolls on, so
     * three rows -- main-hand swings, off-hand swings, melee specials -- are
     * three rows of one fact. One row called "Dodge" is the honest rendering,
     * and `fold` splits them again the moment they disagree, which they would
     * the day anything grants weapon skill with one hand and not the other.
     *
     * HIT IS THE OPPOSITE CASE and is deliberately NOT folded away: its slices
     * genuinely differ, so it genuinely gets several rows.
     * ------------------------------------------------------------------------
     */
    const { player, chances } = built(presetNamed('dw_fury'));
    const slices = dodgeParryHeadroom(player, BOSS, chances);

    /*
     * AND THE GEAR HAS ALREADY SPENT SOME OF IT. The benchmark templates buy
     * Expertise -- DW Fury's row asks for 10 rating, which is one percentage
     * point of reduced dodge and parry -- where the Classic sets carried none.
     * So the headroom is 6.5 LESS whatever the character already has, and the
     * folding is what this test is about.
     */
    const spent = player.stats.effective.dodgeParryReduction;
    expect(slices.map((slice) => slice.label).sort()).toEqual(['Dodge', 'Parry']);
    expect(slices.find((slice) => slice.label === 'Dodge')!.headroom).toBeCloseTo(6.5 - spent, 6);
    expect(slices.find((slice) => slice.label === 'Parry')!.headroom).toBe(0);
  });

  it('gives a shield build a second rung for parry', () => {
    /*
     * Enemy parry is 14% for a character standing in front of the target,
     * which the ruleset reads as one holding a shield, and dodge is 6.5%. So
     * the first 6.5 points buy both and the rest buy parry alone -- which is
     * the same ladder shape hit has, from a single table.
     */
    const { player, chances } = built(presetNamed('prot_warr'));
    const tiers = tiersFrom(dodgeParryHeadroom(player, BOSS, chances));

    /*
     * THE RUNGS ARE WHERE THE CAPS ARE, LESS WHAT THE GEAR ALREADY BOUGHT. The
     * Protection template asks for 20 Expertise Rating, which is two points of
     * reduced dodge and parry, so the first rung runs to 6.5 - 2 and the second
     * to 14 - 2. The SHAPE -- two rungs, dodge capping first -- is the claim.
     */
    const spent = player.stats.effective.dodgeParryReduction;
    expect(tiers).toHaveLength(2);
    expect(tiers[0].to).toBeCloseTo(6.5 - spent, 6);
    expect(tiers[0].caps).toEqual(['Dodge']);
    expect([...tiers[0].benefits].sort()).toEqual(['Dodge', 'Parry']);
    // Past the dodge cap, only parry is still paying -- all the way to 14%.
    expect(tiers[1].to).toBeCloseTo(14 - spent, 6);
    expect(tiers[1].caps).toEqual(['Parry']);
    expect(tiers[1].benefits).toEqual(['Parry']);
  });

  it('leaves no rung at all when every slice is already capped', () => {
    /*
     * ========================================================================
     * THE OTHER HALF OF THE OWNER'S EXAMPLE: "Already capped. No stat weight."
     *
     * IT READS THE PROTECTION WARRIOR AGAIN, which it could not for one
     * release. Tauren Endurance's hit clause became crit damage, and the
     * owner's template had been crediting that 1% -- so this build sat one
     * point short of every cap and the fully-capped case had no preset left to
     * demonstrate it. The owner has since raised the five Tauren templates by
     * 10 hit rating each, which restores it: 80 rating is 8 points against an
     * 8% special miss and a 6.5% dodge, with nothing left anywhere.
     *
     * SO THE WORKAROUND IS GONE. It handed this profile the missing point as a
     * flat `hitChance` stat, which made the mechanism demonstrable and made
     * the test stop describing a real build. A preset that is genuinely capped
     * is the stronger fixture, and the test below is what notices if one stops
     * being.
     * ========================================================================
     */
    const { player, chances } = built(presetNamed('prot_warr'));
    const slices = hitHeadroom(player, BOSS, chances);

    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice.headroom).toBe(0);
    expect(tiersFrom(slices)).toEqual([]);
  });

  it('puts every TAUREN preset back on the cap its template aims at', () => {
    /*
     * ========================================================================
     * THIS TEST ASSERTED THE OPPOSITE AND THE OWNER ANSWERED THE QUESTION IT
     * WAS WRITTEN TO ASK.
     *
     * It read "leaves every TAUREN preset one point short, which the racial
     * patch did", and it was a FINDING pinned where somebody would read it
     * rather than a defect: Tauren Endurance was "Total Health increased by 5%
     * and chance to hit increased by 1%" and the patch made the second clause
     * crit damage, while the owner's benchmark templates had been crediting
     * that 1%. The two Tauren MELEE rows asked for 70 hit rating where every
     * other melee row asked 80, the two feral Druids asked 30 against a
     * 4-point Nature's Reach, and the Moonkin asked 110 against the same 4.
     * Five builds, each exactly one point under its own cap.
     *
     * THE RULING: "+10 hit rating, which should be subtracted from elsewhere
     * on the template set without violating the item budget." So the five rows
     * are 80/80/40/40/120 now, and `spreadRating` pays for the extra out of
     * CRIT where the preference list has any and out of the base attributes
     * where it does not -- which is the owner's own donor rule, unchanged.
     *
     * WHY THE AIMED SLICE RATHER THAN EVERY SLICE. A build can be capped on one
     * table and nowhere near its cap on another, and two of these five are:
     * the Enhancement Shaman's melee is on 8 while its SPELL slice has nine
     * points to go, and the Moonkin is the mirror -- its spell slice is on 16
     * while its melee specials are capped twice over by the hit it carries for
     * its spells. So the claim is about the table the template was aimed at,
     * which is named here per build rather than inferred.
     * ========================================================================
     */
    const AIMED: Readonly<Record<string, AttackTableKind>> = {
      // Prot Warr and Fury Prot left this table in round 80 by becoming Undead;
      // they are asserted on the melee cap below, as the Enh Shaman is.
      'druid_cat': 'melee-special',
      'druid_bear': 'melee-special',
      // The Moonkin left this table in round 78, when it became High Order
      // Skyborne; its template still aims at the spell cap through Nature's Reach.
    };

    /*
     * ========================================================================
     * AND THE MOONKIN IS ONE POINT SHORT AGAIN, FOR A DIFFERENT REASON, AND IT
     * IS PINNED RATHER THAN FIXED. The owner removed the 1% spell miss floor,
     * so the spell cap is 17 and every caster template -- aimed at 16 -- now
     * sits a point under it. Raising the template rows is a change to the
     * owner's spreadsheet, which the Tauren case above shows they rule on
     * themselves, so it is a QUESTION and this is where it is findable.
     * ========================================================================
     */
    /*
     * AND THE OWNER ANSWERED IT IN ROUND 51: every caster template gained the
     * 10 hit rating it was short, so the Moonkin is back on the cap and this
     * table is empty. It stays as the place a future shortfall would be pinned.
     */
    const SHORT_SINCE_THE_FLOOR_WENT: Readonly<Record<string, number>> = {};

    /*
     * THE ENHANCEMENT SHAMAN LEFT THIS TABLE IN ROUND 78 BY BECOMING AN ORC
     * (+4.5 at 1 target, +13.3 at 5). Its template row is the same 80 hit
     * rating every melee row asks for since the ruling above, so it must still
     * sit on the melee cap without the racial -- asserted here, so the move
     * cannot quietly leave it a point short.
     */
    {
      const enh = PRESETS_BY_ID.get('shaman_enhancement')!.build();
      expect(enh.character.race).toBe('orc');
      const { player, chances } = built(enh);
      const special = hitHeadroom(player, BOSS, chances).filter((entry) => entry.table === 'melee-special');
      expect(special.length).toBeGreaterThan(0);
      for (const entry of special) expect(entry.headroom, `Enh Shaman ${entry.label}`).toBe(0);
    }

    /*
     * THE TWO WARRIOR TANKS LEFT THIS TABLE IN ROUND 80 BY BECOMING UNDEAD
     * (+18.1 weighted TPS on Prot Warr). Their template row asks the same 80
     * hit rating, so they must still sit on the melee cap without a racial.
     */
    for (const id of ['prot_warr', 'fury_prot']) {
      const tank = PRESETS_BY_ID.get(id)!.build();
      expect(tank.character.race).toBe('undead');
      const { player, chances } = built(tank);
      const special = hitHeadroom(player, BOSS, chances).filter((entry) => entry.table === 'melee-special');
      expect(special.length).toBeGreaterThan(0);
      for (const entry of special) expect(entry.headroom, `${id} ${entry.label}`).toBe(0);
    }

    const tauren = PROFILE_PRESETS.filter(
      (preset) => preset.build().character.race === 'tauren',
    );
    expect(tauren.map((preset) => preset.id).sort()).toEqual(Object.keys(AIMED).sort());

    for (const preset of tauren) {
      const profile = preset.build();
      const { player, chances } = built(profile);
      const slices = hitHeadroom(player, BOSS, chances);
      const name = profile.character.name;
      expect(slices.length, name).toBeGreaterThan(0);

      const aimed = slices.filter((entry) => entry.table === AIMED[preset.id]);
      expect(aimed.length, `${name}: a slice on ${AIMED[preset.id]}`).toBeGreaterThan(0);
      for (const entry of aimed) {
        expect(entry.headroom, `${name} ${entry.label} is capped`).toBe(
          SHORT_SINCE_THE_FLOOR_WENT[preset.id] ?? 0,
        );
      }

      /*
       * AND NOTHING IS ONE POINT SHORT ANYWHERE, which is the exact symptom
       * the racial patch produced and the inverse of what this test used to
       * assert. A whole point left on a melee table is the expensive case,
       * because melee and ranged have NO miss floor -- the eighth point is the
       * last one that buys anything and the seventh leaves a full point of
       * miss unspent.
       */
      for (const entry of slices) {
        if (entry.table === 'spell' && SHORT_SINCE_THE_FLOOR_WENT[preset.id]) continue;
        const oneShort = Math.abs(entry.headroom - 1) < 1e-6;
        expect(oneShort, `${name} ${entry.label} is one point short`).toBe(false);
      }
    }
  });
});

describe('dodge/parry headroom', () => {
  it('gives a build with no shield one rung, because enemy parry is zero', () => {
    const { player, chances } = built(presetNamed('dw_fury'));
    const slices = dodgeParryHeadroom(player, BOSS, chances);

    expect(slices.find((entry) => entry.label === 'Parry')!.headroom).toBe(0);
    expect(tiersFrom(slices)).toHaveLength(1);
  });

  it('gives a caster no slice at all', () => {
    // Not "capped": a Mage makes no attack anything can dodge or parry, so
    // there is nothing for the stat to eat into. The two read differently in
    // the plan on purpose.
    const { player, chances } = built(presetNamed('mage_frostfire'));

    expect(dodgeParryHeadroom(player, BOSS, chances)).toEqual([]);
  });
});
