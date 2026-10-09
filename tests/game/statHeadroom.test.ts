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
     * The Shadow Priest carries ONE point of spell hit from its gear, so its
     * miss is 17 - 1 and its headroom is 16 - 1: the figure to check is that
     * the floor is subtracted at all. Read `miss` alone and the seventeenth
     * point of hit would be promised to a caster the owner's own cap says
     * cannot use it.
     */
    const { player, chances } = built(presetNamed('shadow_priest'));
    const spells = hitHeadroom(player, BOSS, chances).find((entry) => entry.table === 'spell');

    expect(spells).toBeDefined();
    expect(spells!.current).toBeCloseTo(17 - 1, 6);
    expect(spells!.headroom).toBeCloseTo(16 - 1, 6);
  });

  it('reports a capped slice beside an uncapped one on the same character', () => {
    /*
     * THE CASE THE WHOLE LADDER EXISTS FOR, and the ruleset owner's own
     * example. A Combat Rogue sits on 16 points of hit: 8% of special miss is
     * gone twice over, and its auto-attacks still carry the 19-point
     * dual-wield penalty and miss 27 - 16 = 11% of the time.
     */
    const { player, chances } = built(presetNamed('rogue_combat'));
    const slices = hitHeadroom(player, BOSS, chances);

    const specials = slices.find((entry) => entry.label === 'Specials');
    const autos = slices.filter((entry) => entry.table === 'melee-auto');

    expect(specials!.headroom).toBe(0);
    expect(autos).toHaveLength(2);
    for (const auto of autos) expect(auto.headroom).toBeCloseTo(27 - 16, 6);

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

    expect(slices.map((slice) => slice.label).sort()).toEqual(['Dodge', 'Parry']);
    expect(slices.find((slice) => slice.label === 'Dodge')!.headroom).toBeCloseTo(6.5, 6);
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

    expect(tiers).toHaveLength(2);
    expect(tiers[0].to).toBeCloseTo(6.5, 6);
    expect(tiers[0].caps).toEqual(['Dodge']);
    expect([...tiers[0].benefits].sort()).toEqual(['Dodge', 'Parry']);
    // Past the dodge cap, only parry is still paying -- all the way to 14%.
    expect(tiers[1].to).toBeCloseTo(14, 6);
    expect(tiers[1].caps).toEqual(['Parry']);
    expect(tiers[1].benefits).toEqual(['Parry']);
  });

  it('leaves no rung at all when every slice is already capped', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OTHER HALF OF THE OWNER'S EXAMPLE, and it became real at the 8%
     * miss fix: a Protection Warrior carries 8 points of hit against an 8%
     * special miss and a 8% one-handed swing miss, so every slice it rolls on
     * is at zero and the ladder is EMPTY. "Already capped. No stat weight."
     * ------------------------------------------------------------------------
     */
    const { player, chances } = built(presetNamed('prot_warr'));
    const slices = hitHeadroom(player, BOSS, chances);

    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice.headroom).toBe(0);
    expect(tiersFrom(slices)).toEqual([]);
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
