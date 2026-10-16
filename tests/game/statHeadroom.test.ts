import { describe, expect, it } from 'vitest';
import type { HeadroomSlice } from '../../src/game/combat/statHeadroom';
import {
  dodgeParryHeadroom,
  hitHeadroom,
  tiersFrom,
} from '../../src/game/combat/statHeadroom';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { characterAtCombatStart } from '../../src/simulator';
import { PROFILE_PRESETS } from '../../src/profiles';
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
  it('takes the spell floor off, so the cap is 16 points and not 17', () => {
    /*
     * THE FIGURE TO CHECK IS THAT THE FLOOR IS SUBTRACTED AT ALL, not what the
     * gear happens to carry. Read `miss` alone and the seventeenth point of hit
     * would be promised to a caster the owner's own cap says cannot use it.
     *
     * THE GEAR'S OWN HIT IS READ RATHER THAN WRITTEN DOWN. This said "the
     * Shadow Priest carries ONE point of spell hit" -- true of its Classic set
     * and not of the benchmark one, whose template targets 120 hit rating. The
     * invariant is the gap between the two: 17 to miss, 16 usable, so a build's
     * headroom is always one point less than its miss.
     */
    const { player, chances } = built(presetNamed('shadow_priest'));
    const spells = hitHeadroom(player, BOSS, chances).find((entry) => entry.table === 'spell');
    const fromGear = player.stats.effective.hitChance;

    expect(spells).toBeDefined();
    expect(fromGear).toBeGreaterThan(0);
    expect(spells!.current).toBeCloseTo(17 - fromGear, 6);
    expect(spells!.headroom).toBeCloseTo(16 - fromGear, 6);
    // And the one point of difference IS the floor.
    expect(spells!.current - spells!.headroom).toBeCloseTo(1, 6);
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
     * IT USED TO READ THE PROT WARRIOR AND NO LONGER CAN, which is the racial
     * patch arriving in a test about the hit ladder. That build carries 70 hit
     * RATING -- seven points -- and reached the eighth from Tauren Endurance,
     * whose hit clause the patch replaced with crit damage. So every Tauren
     * preset is now exactly one point short of its cap, and the fully-capped
     * case has no preset left to demonstrate it. See the test below, which
     * pins that as a FACT rather than leaving it as the reason this one broke.
     *
     * SO THE MECHANISM IS DRIVEN ON A CHARACTER BUILT TO BE CAPPED, which is
     * what this test was always about: a ladder with no rungs when no slice
     * has headroom. Handing the Protection Warrior the one point its gear no
     * longer reaches is the smallest change that restores the case, and it
     * cannot go stale against a racial, a template or a conversion again.
     * ========================================================================
     */
    const profile = presetNamed('prot_warr');
    const capped: CharacterProfile = {
      ...profile,
      // The point Endurance used to supply, as a flat stat rather than a racial.
      stats: { ...profile.stats, hitChance: (profile.stats.hitChance ?? 0) + 1 },
    };
    const { player, chances } = built(capped);
    const slices = hitHeadroom(player, BOSS, chances);

    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice.headroom).toBe(0);
    expect(tiersFrom(slices)).toEqual([]);
  });

  it('leaves every TAUREN preset one point short, which the racial patch did', () => {
    /*
     * ========================================================================
     * A BUILD FACT, PINNED APART FROM THE MECHANISM ABOVE, AND IT IS A QUESTION
     * FOR THE OWNER RATHER THAN A DEFECT.
     *
     * Tauren Endurance was "Total Health increased by 5% and chance to hit
     * increased by 1%" and is now "...and critical damage and healing
     * increased by 2%". The owner's benchmark templates credited that 1%: the
     * two Tauren MELEE rows ask for 70 hit rating where every other melee row
     * asks for 80, the two feral Druids ask for 30 against a 4-point Nature's
     * Reach, and the Moonkin asks for 110 against the same 4. Every one of the
     * five landed exactly on its cap WITH the racial and is one point under it
     * without.
     *
     * WHY THIS IS A TEST AND NOT A FIX. The templates are the owner's own
     * spreadsheet, and raising five of them by 10 rating -- which under their
     * own donor rule would come out of CRIT -- is a change to their numbers on
     * nobody's authority. So the consequence is written down where it will be
     * read, and it fails the moment somebody adjusts a template, which is
     * exactly when this note should be revisited.
     *
     * THE MELEE HALF COSTS REAL DPS and the spell half costs the Moonkin real
     * DPS: melee and ranged have NO miss floor, so the eighth point is the
     * last one that buys anything and the seventh leaves a full point of miss
     * on the table. This is the one place in the project where a racial change
     * reaches a figure through the GEAR rather than through its own effect.
     * ========================================================================
     */
    const tauren = PROFILE_PRESETS.map((preset) => preset.build()).filter(
      (profile) => profile.character.race === 'tauren',
    );
    expect(tauren.length).toBe(5);

    /*
     * ONE SLICE AT EXACTLY ONE POINT, rather than every slice -- which is the
     * assertion this started as and which is false for two of the five.
     *
     * The slice that matters is the one the template was AIMED at, and the
     * other slices of the same build are nowhere near their own caps: the
     * Enhancement Shaman's melee is one short of 8 while its SPELL slice has
     * nine points to go, and the Moonkin is the mirror -- its spell slice is
     * one short of 16 while its melee specials are capped twice over by the
     * 15 points of hit it carries for its spells. So "every slice is one
     * short" is the wrong shape, and "something is exactly one short" is the
     * finding.
     */
    for (const profile of tauren) {
      const { player, chances } = built(profile);
      const slices = hitHeadroom(player, BOSS, chances);
      expect(slices.length, profile.character.name).toBeGreaterThan(0);

      const oneShort = slices.filter((entry) => Math.abs(entry.headroom - 1) < 1e-6);
      expect(oneShort.length, `${profile.character.name}: a slice one point short`).toBeGreaterThan(
        0,
      );
      // And nothing is FRACTIONALLY short, which would mean a different cause.
      for (const entry of slices) {
        const fractional = entry.headroom > 0 && entry.headroom < 1;
        expect(fractional, `${profile.character.name} ${entry.label}`).toBe(false);
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
