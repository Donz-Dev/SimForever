import { describe, expect, it } from 'vitest';
import type { StatName } from '../../src/engine';
import {
  WEIGHTABLE_STATS,
  WEIGHTABLE_STATS_BY_ID,
  sampleIterations,
  pairedDelta,
  profileSamples,
  runProfileBatch,
  runStatWeights,
  statWeightPlan,
  survivalWeightsFrom,
  weightsFrom,
  withStat,
} from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { PROFILE_PRESETS } from '../../src/profiles';
import type { CharacterProfile } from '../../src/profiles';
import { ITEMS } from '../../src/game/items/itemData';
import { FOREVER_ENCHANTS } from '../../src/game/items/foreverEnchants';

function presetNamed(id: string): CharacterProfile {
  const preset = PROFILE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`No preset ${id}`);
  return preset.build();
}

const SEED = 4242;

/* ===========================================================================
 * The arithmetic, written out by hand.
 * ========================================================================= */

describe('pairedDelta', () => {
  it('is the mean of the per-iteration differences, not the difference of means', () => {
    /*
     * The two agree for a complete pair, which is exactly why this is worth
     * pinning: the per-iteration form is the one whose SPREAD can be measured,
     * and the spread is what every interval and every iteration allocation
     * below is built on.
     */
    const base = [100, 110, 90, 120];
    const variant = [105, 118, 93, 128];

    const paired = pairedDelta(base, variant);

    // 5, 8, 3, 8 -> mean 6
    expect(paired.delta).toBeCloseTo(6, 9);
    // sd of [5, 8, 3, 8] with n-1: mean 6, squares 1+4+9+4 = 18, / 3 = 6
    expect(paired.spread).toBeCloseTo(Math.sqrt(6), 9);
    expect(paired.interval).toBeCloseTo((2 * Math.sqrt(6)) / 2, 9);
    expect(paired.iterations).toBe(4);
  });

  it('reports a spread of zero when the two runs are the same fights', () => {
    // The shape a stat worth nothing produces under shared seeds, and the
    // reason the planner checks the stat ARRIVED before trusting it.
    const paired = pairedDelta([100, 110, 90], [100, 110, 90]);

    expect(paired.delta).toBe(0);
    expect(paired.spread).toBe(0);
    expect(paired.interval).toBe(0);
  });

  it('pairs over the shorter of the two, so a ragged pair cannot silently pad', () => {
    expect(pairedDelta([10, 20, 30], [15, 25]).iterations).toBe(2);
  });

  it('is zero for no samples rather than NaN', () => {
    expect(pairedDelta([], [])).toEqual({
      delta: 0,
      interval: 0,
      spread: 0,
      iterations: 0,
    });
  });
});

describe('runStatWeights', () => {
  it('runs the baseline and every variant at the same count', () => {
    /*
     * ------------------------------------------------------------------------
     * THE SAME COUNT FOR EVERY ROW, on the ruleset owner's instruction. It
     * replaced an allocation that read each variant's paired spread and gave a
     * noisy stat more fights than a quiet one -- cheaper, and it made two rows
     * of one table incomparable, because a reader sorting by weight could not
     * see that one figure rested on twelve times the evidence of the one above
     * it.
     *
     * Asserted on the FIGHT COUNT as well as on each row, because the two can
     * disagree: a runner that quietly topped one variant up would still report
     * a uniform `iterations` per row.
     * ------------------------------------------------------------------------
     */
    const iterations = 8;
    const run = runStatWeights(presetNamed('dw_fury'), ['strength', 'critChance'], {
      baseSeed: SEED,
      iterations,
    });

    expect(run.iterations).toBe(iterations);
    expect(run.weights).toHaveLength(2);
    for (const row of run.weights) expect(row.iterations).toBe(iterations);
    // The baseline and both variants, and nothing else.
    expect(run.fights).toBe(iterations * 3);
  });
});

describe('withStat', () => {
  it('adds to whatever the profile already had', () => {
    const profile = presetNamed('dw_fury');
    const before = profile.stats.strength ?? 0;

    expect(withStat(profile, 'strength', 30).stats.strength).toBe(before + 30);
    // The original is untouched: a plan builds several variants from one profile.
    expect(profile.stats.strength ?? 0).toBe(before);
  });
});

/* ===========================================================================
 * The catalogue.
 * ========================================================================= */

describe('the weightable stat catalogue', () => {
  it('prices every stat an item in the data grants', () => {
    /*
     * ------------------------------------------------------------------------
     * DERIVED FROM THE ITEM DATA RATHER THAN FROM A SECOND HAND-WRITTEN LIST,
     * so a new item line that grants a stat nobody thought to add fails here
     * instead of going quietly unpriced. That is the same structural argument
     * `classRegistration.test.ts` makes: the registry has to be reachable from
     * the thing it registers.
     * ------------------------------------------------------------------------
     */
    const granted = new Set<StatName>();
    for (const item of ITEMS) {
      for (const [name, value] of Object.entries(item.stats)) {
        if (value !== 0) granted.add(name as StatName);
      }
      for (const styled of Object.values(item.styleStats)) {
        for (const [name, value] of Object.entries(styled ?? {})) {
          if (value !== 0) granted.add(name as StatName);
        }
      }
    }
    for (const enchant of FOREVER_ENCHANTS) {
      for (const [name, value] of Object.entries(enchant.stats ?? {})) {
        if (value !== 0) granted.add(name as StatName);
      }
    }

    const missing = [...granted].filter((name) => !WEIGHTABLE_STATS_BY_ID.has(name));
    expect(missing).toEqual([]);
  });

  it('carries the two capped stats no gear grants', () => {
    // Both come from talents, both are capped, and the dodge/parry one is the
    // reason the ruleset owner asked for the cap reporting at all.
    expect(WEIGHTABLE_STATS_BY_ID.get('hitChance')?.tiered).toBe('hitChance');
    expect(WEIGHTABLE_STATS_BY_ID.get('dodgeParryReduction')?.tiered).toBe(
      'dodgeParryReduction',
    );
  });

  it('expresses haste in percent, not in the placeholder rating', () => {
    /*
     * `RATING_PER_PERCENT` says of itself that every constant in it is a
     * placeholder. Expressing the step as `percent * RATING_PER_PERCENT.haste`
     * -- the project's one idiom for it -- means the weight is DPS per 1%
     * haste, and stays that if the conversion is ever replaced.
     */
    const haste = WEIGHTABLE_STATS_BY_ID.get('hasteRating');
    expect(haste?.unitLabel).toBe('%');
    expect(haste?.statPerUnit).toBe(170);
  });

  it('does not offer a rating stat that nothing in the data grants', () => {
    for (const name of ['critRating', 'masteryRating', 'versatilityRating'] as StatName[]) {
      expect(WEIGHTABLE_STATS_BY_ID.has(name)).toBe(false);
    }
  });

  it('declares a step for every stat, and a positive one', () => {
    for (const stat of WEIGHTABLE_STATS) {
      expect(stat.step).toBeGreaterThan(0);
      expect(stat.statPerUnit).toBeGreaterThan(0);
    }
  });

  it('does not write block value off when nothing attacks the player', () => {
    /*
     * SHIELD SLAM ADDS THE WIELDER'S BLOCK VALUE TO ITS OWN DAMAGE, so block
     * value is an offensive stat for a shield Warrior in a fight it is never
     * hit in -- and grouping it with dodge and armor because it sounds
     * defensive would skip the one build it matters to.
     */
    expect(WEIGHTABLE_STATS_BY_ID.get('blockValue')?.needsIncomingDamage).toBeUndefined();
    expect(WEIGHTABLE_STATS_BY_ID.get('blockChance')?.needsIncomingDamage).toBe(true);
  });
});

/* ===========================================================================
 * The plan.
 * ========================================================================= */

describe('statWeightPlan', () => {
  it('skips a defensive stat when the target does not swing back', () => {
    const plan = statWeightPlan(presetNamed('dw_fury'), ['armor', 'dodgeChance', 'strength']);

    expect(plan.variants.map((variant) => variant.statId)).toEqual(['strength']);
    expect(plan.skipped.map((entry) => entry.statId).sort()).toEqual(['armor', 'dodgeChance']);
    for (const entry of plan.skipped) {
      expect(entry.reason).toContain('does not swing back');
    }
  });

  it('measures a defensive stat when it does', () => {
    const plan = statWeightPlan(presetNamed('prot_warr'), ['armor', 'dodgeChance']);

    expect(plan.variants.map((variant) => variant.statId).sort()).toEqual([
      'armor',
      'dodgeChance',
    ]);
  });

  it('chains a capped stat into rungs, each differenced against the one below', () => {
    const plan = statWeightPlan(presetNamed('dw_fury'), ['hitChance']);

    expect(plan.variants.length).toBeGreaterThan(1);
    // The first rung is measured from the baseline; every later one from its
    // predecessor, which is what makes each row price its own interval rather
    // than the sum of itself and everything beneath it.
    expect(plan.variants[0].against).toBeUndefined();
    for (let index = 1; index < plan.variants.length; index++) {
      expect(plan.variants[index].against).toBe(plan.variants[index - 1].key);
      expect(plan.variants[index].fromUnits).toBeCloseTo(plan.variants[index - 1].toUnits, 9);
    }
    // And each run adds the CUMULATIVE amount, not the rung's own width.
    for (const variant of plan.variants) {
      expect(variant.added).toBeCloseTo(variant.toUnits, 9);
    }
  });

  it('reports a fully capped stat as capped instead of measuring it', () => {
    /*
     * THE RULESET OWNER'S OWN EXAMPLE, and it became real at the 8% miss fix:
     * a Protection Warrior carries 8 points of hit against an 8% miss on every
     * table it rolls on, so there is nowhere for another point to go.
     */
    const plan = statWeightPlan(presetNamed('prot_warr'), ['hitChance']);

    expect(plan.variants).toEqual([]);
    expect(plan.skipped[0].reason).toContain('Already capped');
  });

  it('tells "capped" apart from "no slice to cap"', () => {
    /*
     * A Mage makes no attack anything can dodge or parry, which is a different
     * statement from "capped" -- one says gear took it there and the other
     * says it was never reachable. Printing the first for the second would
     * tell someone their caster had stacked a stat it has never been able to
     * use.
     */
    const plan = statWeightPlan(presetNamed('mage_frostfire'), ['dodgeParryReduction']);

    expect(plan.variants).toEqual([]);
    expect(plan.skipped[0].reason).toContain('nothing to measure');
    expect(plan.skipped[0].reason).not.toContain('capped');
  });

  it('runs the top rung all the way to its cap', () => {
    /*
     * NOT TRUNCATED. An earlier version stopped the ladder at twelve points
     * because no item grants more, which made the top rung report "+3.00%
     * more" where the honest figure was the ten it takes to cap main-hand
     * swings. The question is how much it would TAKE, so stopping short
     * answers a different one.
     *
     * Written out by hand rather than read back from the headroom: a
     * dual-wielder's main-hand swings miss 27% against a level 63 target and
     * DW Fury carries 8 points of gear hit, so the ladder ends at 19.
     */
    const plan = statWeightPlan(presetNamed('dw_fury'), ['hitChance']);
    const top = plan.variants[plan.variants.length - 1];

    expect(top.toUnits).toBeCloseTo(27 - 8, 6);
  });

  it('orders the rows by the catalogue, not by the selection', () => {
    const forwards = statWeightPlan(presetNamed('dw_fury'), ['spellPower', 'strength']);
    const backwards = statWeightPlan(presetNamed('dw_fury'), ['strength', 'spellPower']);

    expect(forwards.variants.map((variant) => variant.key)).toEqual(
      backwards.variants.map((variant) => variant.key),
    );
    expect(forwards.variants.map((variant) => variant.statId)).toEqual([
      'strength',
      'spellPower',
    ]);
  });

  it('finds every catalogue stat reaching the built character, on every shape of build', () => {
    /*
     * ------------------------------------------------------------------------
     * THE GUARD THE WHOLE FEATURE RESTS ON, ASSERTED FROM THE OTHER SIDE.
     *
     * Shared seeds make a variant that never applied produce a bit-identical
     * fight and a delta of exactly 0.00 -- indistinguishable from a stat that
     * is genuinely worth nothing, and this project's own rule is that two
     * figures agreeing to the decimal mean the same thing was measured twice.
     * So the planner builds the character with the stat added and checks it
     * ARRIVED before spending a fight, and a stat that did not move is skipped
     * with that as its reason rather than reported as worthless.
     *
     * The guard currently fires for NOTHING, which is the thing to pin: it
     * says every stat in the catalogue has a live route from `profile.stats`
     * through `createPlayer` to the effective block a fight reads. A route
     * that broke -- a stat the builder quietly drops, the way `lone_wolf` was
     * dropped from `TALENT_AURAS` -- turns up here as a skip, on whichever
     * build lost it.
     *
     * Several shapes of build, because the routes differ: a Druid's stats go
     * through a form, a Hunter's reach a pet, and a caster converts none of
     * the melee ones.
     * ------------------------------------------------------------------------
     */
    const every = WEIGHTABLE_STATS.map((stat) => stat.id);

    for (const id of ['dw_fury', 'prot_warr', 'mage_frostfire', 'bm_hunter', 'druid_cat']) {
      const plan = statWeightPlan(presetNamed(id), every);
      const dropped = plan.skipped.filter((entry) =>
        entry.reason.includes('does not change the built character'),
      );

      expect(dropped.map((entry) => entry.statId), id).toEqual([]);
    }
  });
});

/* ===========================================================================
 * The two properties the worker pool depends on.
 * ========================================================================= */

describe('sampleIterations', () => {
  it('reproduces runBatch DPS to the decimal', () => {
    /*
     * ------------------------------------------------------------------------
     * THE EQUALITY THAT SAYS THE LEAN PATH IS THE SAME FIGHT. `runBatch`
     * accumulates a whole `BatchTotals` and this keeps one number per source
     * id, which is 1.2x to 1.75x faster -- and a cheaper path that produced
     * slightly different numbers would be a second simulator, not an
     * optimisation.
     * ------------------------------------------------------------------------
     */
    const profile = presetNamed('dw_fury');
    const iterations = 40;

    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, iterations, seed: SEED },
    });
    const samples = profileSamples(profile, SEED, { from: 0, to: iterations }).dps;

    expect(samples).toHaveLength(iterations);
    expect(samples.reduce((a, b) => a + b, 0) / iterations).toBeCloseTo(batch.dps.mean, 9);

    /*
     * ITERATION FOR ITERATION, because the ORDER is what pairing and slicing
     * both rely on -- but to twelve significant digits and NOT bit for bit,
     * and the reason is worth knowing.
     *
     * `runBatch` reads a cumulative total that runs for the whole batch and
     * takes each iteration's damage as the DIFFERENCE since the last one, which
     * is deliberate: reading the cumulative figure directly was the first
     * version of it and made iteration 2500 look 2500 times as good. The lean
     * path sums one iteration from zero. Same fights, same damage, different
     * summation order -- so the last few bits differ, by about one part in
     * 10^13 and growing with the batch.
     *
     * It matters nowhere: a stat weight's interval is measured in hundredths
     * of a DPS. It is pinned at twelve digits rather than waved at, so that a
     * real divergence -- a different fight -- still fails here.
     */
    batch.dpsSamples.forEach((expected, index) => {
      expect(samples[index] / expected).toBeCloseTo(1, 12);
    });
  });

  it('slices without changing a single sample', () => {
    /*
     * ------------------------------------------------------------------------
     * WHAT MAKES THE WORKER POOL SAFE. Iteration `i` derives its seed from the
     * base seed the same way wherever it runs, so [0, 12) on one thread and
     * [12, 30) on another produce exactly what one [0, 30) call would, in the
     * same order. If this ever stopped holding, a parallel run would differ
     * from the tool's single-threaded one and neither would be wrong on its
     * own terms.
     * ------------------------------------------------------------------------
     */
    const config = trainingDummyEncounter(presetNamed('rogue_combat'));
    const whole = sampleIterations(config, SEED, { from: 0, to: 30 }).dps;
    const pieces = [
      ...sampleIterations(config, SEED, { from: 0, to: 12 }).dps,
      ...sampleIterations(config, SEED, { from: 12, to: 25 }).dps,
      ...sampleIterations(config, SEED, { from: 25, to: 30 }).dps,
    ];

    expect(pieces).toEqual(whole);
  });

  it('pairs a variant against the baseline fight for fight', () => {
    /*
     * ------------------------------------------------------------------------
     * COMMON RANDOM NUMBERS, the variance reduction the whole feature is built
     * on: +30 strength on DW Fury measured 17.55 +-0.18 over 500 shared-seed
     * iterations against 16.15 +-12.33 over 500 independent ones.
     *
     * Asserted on the MECHANISM rather than on the variance -- a stat that
     * cannot change a roll leaves every fight's length and every outcome
     * alone, so the per-iteration spread is exactly zero and the delta is the
     * same whatever the seed. A paired run that drifted would show a spread.
     * ------------------------------------------------------------------------
     */
    const profile = presetNamed('dw_fury');
    const base = profileSamples(profile, SEED, { from: 0, to: 40 }).dps;
    const variant = profileSamples(withStat(profile, 'attackPower', 60), SEED, {
      from: 0,
      to: 40,
    }).dps;

    const paired = pairedDelta(base, variant);

    expect(paired.delta).toBeGreaterThan(0);
    // Attack power scales damage and decides nothing, so no roll moves and
    // every fight is the same fight with bigger numbers.
    expect(paired.spread).toBeLessThan(5);
  });
});

/* ===========================================================================
 * Tank weights: the same runs, read for deaths instead of damage.
 * ========================================================================= */

describe('survivalWeightsFrom', () => {
  function plannedArmor() {
    const plan = statWeightPlan(presetNamed('prot_warr'), ['armor']);
    expect(plan.variants).toHaveLength(1);
    return plan;
  }

  it('reports deaths AVOIDED, so more is better as everywhere else', () => {
    /*
     * ------------------------------------------------------------------------
     * THE SIGN IS FLIPPED ONCE, HERE. `pairedDelta` reports `variant -
     * baseline`, which for a death count is NEGATIVE when a stat helps -- and
     * the ruleset owner's framing is the other way up: 30 agility taking
     * deaths from 10.5 to 9.8 is "+0.7 avoid death". Flipping it at the source
     * means every reader downstream sorts and renders a tank row exactly as it
     * does a damage one, instead of each remembering which way its own metric
     * runs.
     * ------------------------------------------------------------------------
     */
    const plan = plannedArmor();
    const baseline = [10, 11, 10, 11];
    const fewer = [9, 10, 10, 10];

    const [row] = survivalWeightsFrom(plan, baseline, new Map([[plan.variants[0].key, fewer]]));

    // Three deaths avoided over four fights is 0.75 a fight, over 500 armor.
    expect(row.delta).toBeCloseTo(0.75, 9);
    expect(row.perUnit).toBeCloseTo(0.75 / row.units, 9);
    expect(row.verdict).toBe('measured');
  });

  it('reports a negative where a stat made things worse', () => {
    // Stamina is the real case: more health means each point of damage taken
    // is worth less rage, which is the formula doing what it says.
    const plan = plannedArmor();
    const baseline = [10, 10, 10, 10];
    const worse = [11, 11, 11, 11];

    const [row] = survivalWeightsFrom(plan, baseline, new Map([[plan.variants[0].key, worse]]));

    expect(row.delta).toBeCloseTo(-1, 9);
  });

  it('leaves out a stat that cannot move the death count at all', () => {
    /*
     * THE OWNER'S WORDING IS "any stat that REDUCES DEATHS", and a `none`
     * verdict is the confident form of not doing so: the variant ran
     * bit-identical fights. Attack power belongs in the damage table and
     * nowhere near this one -- a row of it at zero is a line of nothing.
     *
     * `inconclusive` STAYS, because that is a different statement: the stat
     * changed the fight and the run could not resolve by how much.
     */
    const plan = statWeightPlan(presetNamed('prot_warr'), ['armor', 'strength']);
    const unchanged = [10, 10, 10, 10];
    const noisy = [9, 11, 10, 12];
    // Keyed by stat rather than by index: the plan orders its variants by the
    // CATALOGUE, so primaries come first and `variants[0]` is strength.
    const keyOf = (stat: string) => plan.variants.find((v) => v.statId === stat)!.key;

    const rows = survivalWeightsFrom(
      plan,
      unchanged,
      new Map([
        [keyOf('strength'), unchanged],
        [keyOf('armor'), noisy],
      ]),
    );

    expect(rows.map((row) => row.statId)).toEqual(['armor']);
  });
});

describe('deaths as a measurable quantity', () => {
  it('counts several a fight for a tank, and none for a standing target', () => {
    /*
     * ------------------------------------------------------------------------
     * WHAT MAKES A TANK WEIGHT WORK AT ALL. This encounter ramps the boss's
     * damage ten percent a swing and stands the character back up when they
     * fall, without resetting the ramp -- so a tank dies several times in a
     * sixty-second fight and "deaths" is a rich count rather than a rare
     * event. A quantity that was 0 or 1 could not be weighted.
     *
     * AND IT IS EXACTLY ZERO WHERE NOTHING SWINGS, which is what the empty
     * tank table turns on.
     * ------------------------------------------------------------------------
     */
    const tank = profileSamples(presetNamed('prot_warr'), SEED, { from: 0, to: 20 });
    const mean = tank.deaths.reduce((a, b) => a + b, 0) / tank.deaths.length;
    expect(mean).toBeGreaterThan(1);

    const standing = profileSamples(presetNamed('dw_fury'), SEED, { from: 0, to: 20 });
    expect(standing.deaths.every((count) => count === 0)).toBe(true);
  });

  it('pairs death counts the way it pairs damage', () => {
    // Both metrics come off ONE pass, so the tank answer costs no extra
    // fights -- and iteration `i` of a variant is the same fight as iteration
    // `i` of the baseline for deaths exactly as it is for DPS.
    const profile = presetNamed('prot_warr');
    const slice = { from: 0, to: 30 };
    const base = profileSamples(profile, SEED, slice);
    const tougher = profileSamples(withStat(profile, 'armor', 2000), SEED, slice);

    expect(tougher.deaths).toHaveLength(base.deaths.length);
    const avoided =
      base.deaths.reduce((a, b) => a + b, 0) - tougher.deaths.reduce((a, b) => a + b, 0);
    expect(avoided).toBeGreaterThan(0);
  });
});

/* ===========================================================================
 * The verdict: what the run is able to say.
 * ========================================================================= */

describe('weightsFrom verdicts', () => {
  /** A one-variant plan, so the samples can be written by hand. */
  function plannedStrength() {
    const plan = statWeightPlan(presetNamed('dw_fury'), ['strength']);
    expect(plan.variants).toHaveLength(1);
    return plan;
  }

  it('calls an identical pair "nothing" and prints an exact zero', () => {
    /*
     * ------------------------------------------------------------------------
     * THE DISTINCTION THE WHOLE COLUMN EXISTS FOR, and the reason it cannot be
     * read off the number. Under shared seeds a stat the fight cannot read
     * leaves every roll alone, so the variant runs bit-identical fights -- the
     * CONFIDENT answer that the stat is worth nothing, which the planner has
     * already made trustworthy by checking the stat reached the character.
     *
     * It is zeroed rather than printed because the two paths differ in the
     * last bits -- `runBatch` differences cumulative sums and the lean path
     * does not -- so the residue is about -1e-14, and `(-1.2e-14).toFixed(4)`
     * renders as "-0.0000". A minus sign on a stat worth nothing reads as a
     * measurement rather than as the absence of one.
     * ------------------------------------------------------------------------
     */
    const plan = plannedStrength();
    const base = [880, 910, 870, 895];
    // Not literally equal: a residue the size floating point actually leaves.
    const variant = base.map((value) => value - 1.2e-14);

    const [row] = weightsFrom(plan, base, new Map([[plan.variants[0].key, variant]]));

    expect(row.verdict).toBe('none');
    expect(row.delta).toBe(0);
    expect(row.perUnit).toBe(0);
    expect(row.interval).toBe(0);
    // And no minus sign survives to the panel.
    expect(row.perUnit.toFixed(4)).toBe('0.0000');
  });

  it('calls a value its own interval swallows "inconclusive"', () => {
    const plan = plannedStrength();
    const base = [880, 910, 870, 895];
    // A tiny mean difference on a huge per-iteration spread: the shape a stat
    // that reorders the random stream produces.
    const variant = [980, 815, 965, 800];

    const [row] = weightsFrom(plan, base, new Map([[plan.variants[0].key, variant]]));

    expect(row.verdict).toBe('inconclusive');
    expect(Math.abs(row.perUnit)).toBeLessThanOrEqual(row.interval);
  });

  it('calls a clean difference "measured"', () => {
    const plan = plannedStrength();
    const base = [880, 910, 870, 895];
    const variant = base.map((value) => value + 18);

    const [row] = weightsFrom(plan, base, new Map([[plan.variants[0].key, variant]]));

    expect(row.verdict).toBe('measured');
    expect(row.delta).toBeCloseTo(18, 9);
    expect(row.perUnit).toBeCloseTo(18 / 30, 9);
  });

  it('judges a tier against the tier below it, not against the baseline', () => {
    /*
     * The scale a near-identical pair is judged against has to be the run the
     * row is DIFFERENCED against, which for a rung is its predecessor. Reading
     * the baseline instead would be right by luck here and wrong the moment a
     * ladder moved a build a long way from where it started.
     */
    const plan = statWeightPlan(presetNamed('dw_fury'), ['hitChance']);
    expect(plan.variants.length).toBeGreaterThan(1);

    const base = [880, 910, 870, 895];
    const first = base.map((value) => value + 12);
    const samples = new Map<string, number[]>([
      [plan.variants[0].key, first],
      // The second rung changed nothing at all against the first.
      [plan.variants[1].key, first.map((value) => value + 1e-13)],
    ]);

    const rows = weightsFrom(plan, base, samples);

    expect(rows[0].verdict).toBe('measured');
    expect(rows[1].verdict).toBe('none');
    expect(rows[1].delta).toBe(0);
  });
});

/* ===========================================================================
 * The ladder, end to end.
 * ========================================================================= */

describe('the hit ladder', () => {
  it('sums to a single run at the top of it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE CROSS-CHECK ON THE CHAINING, and the one assertion here that could
     * not be got right by accident. Three rungs measured against each other
     * must add up to what one run with the whole ladder's worth of hit added
     * measures against the baseline -- so an `against` wired to the wrong
     * predecessor, or a rung priced over the cumulative amount rather than its
     * own width, fails here.
     *
     * EXACT RATHER THAN APPROXIMATE, because the top rung's run and the
     * single run are the SAME configuration at the same seeds: both add the
     * whole ladder's worth of hit, so they are bit-identical fights and the
     * telescoping is arithmetic, not statistics. That is what lets this run on
     * twelve iterations.
     * ------------------------------------------------------------------------
     */
    const profile = presetNamed('dw_fury');
    const iterations = 12;
    const plan = statWeightPlan(profile, ['hitChance']);
    // At least two rungs, or there is no chaining for this to cross-check.
    expect(plan.variants.length).toBeGreaterThan(1);

    const slice = { from: 0, to: iterations };
    const baseline = profileSamples(profile, SEED, slice).dps;
    const samples = new Map<string, number[]>(
      plan.variants.map((variant) => [
        variant.key,
        profileSamples(withStat(profile, variant.statId, variant.added), SEED, slice).dps,
      ]),
    );

    const rungs = weightsFrom(plan, baseline, samples);
    const summed = rungs.reduce((total, rung) => total + rung.delta, 0);

    const top = plan.variants[plan.variants.length - 1];
    const whole = pairedDelta(
      baseline,
      profileSamples(withStat(profile, 'hitChance', top.added), SEED, slice).dps,
    );

    expect(summed).toBeCloseTo(whole.delta, 6);
    // And each rung's weight is its own delta over its own width.
    for (const rung of rungs) {
      expect(rung.perUnit).toBeCloseTo(rung.delta / rung.units, 9);
    }
  });
});
