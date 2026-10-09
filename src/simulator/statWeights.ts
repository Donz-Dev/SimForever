import type { Combatant, StatName } from '../engine';
import { RATING_PER_PERCENT } from '../engine';
import { createForeverAttackChances } from '../game/combat/attackChances';
import type { HeadroomSlice, StatTier, TieredStat } from '../game/combat/statHeadroom';
import { headroomFor, tiersFrom } from '../game/combat/statHeadroom';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';
import type { CharacterProfile } from '../profiles';
import { characterAtCombatStart } from './characterAtCombatStart';
import { sampleIterations } from './iterationSamples';
import { trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * STAT WEIGHTS: what one more point of a stat is worth, in DPS.
 *
 * ==============================================================================
 * THE SHAPE OF IT. One baseline run, then one run per variant with a stat
 * temporarily added, and the weight is the DPS difference divided by how much
 * was added. That is all the arithmetic. Everything else in this file is there
 * because of three facts that measurement turned up, and each one changes the
 * answer rather than merely the speed of getting it.
 *
 * ------------------------------------------------------------------------------
 * ONE. THE BASELINE AND THE VARIANT MUST SHARE THEIR SEEDS, AND IT IS WORTH
 * FOUR ORDERS OF MAGNITUDE.
 *
 * `deriveSeed(baseSeed, i)` fixes iteration `i`'s fight, and a Simulation rolls
 * its duration BEFORE anything else happens -- so the same base seed gives the
 * baseline and the variant bit-identical fight lengths, measured and confirmed.
 * The weight is then a PAIRED difference: iteration `i` against iteration `i`,
 * the same fight with one stat changed, rather than two independent samples
 * whose own spread swamps the thing being measured.
 *
 *   +30 strength on DW Fury, 500 iterations, over 20 repeats
 *     shared seeds        17.55 +-0.18
 *     independent seeds   16.15 +-12.33   (a ~5,000x variance reduction)
 *
 * It costs nothing and it biases nothing: each run is still a valid sample of
 * its own configuration, and pairing only correlates the two.
 *
 * ------------------------------------------------------------------------------
 * TWO. IT DOES NOT WORK FOR EVERY STAT, AND THE RUN HAS TO SAY WHICH.
 *
 * The engine draws from ONE random stream. Flip a single miss roll and every
 * later draw is consumed in a different order, so the two fights decorrelate
 * completely -- and a 60-second fight rolls enough attacks that adding 1% hit
 * flips at least one in about seven cases out of eight. Measured:
 *
 *   DW Fury, 3000 iterations    per-iteration spread of the paired difference
 *     +30 strength                      1.8 DPS  (same fights, bigger numbers)
 *     +9% hit                         124.7 DPS  (effectively two fights)
 *
 * So +30 strength is settled in 250 iterations -- 0.5809 +-0.0074 -- and hit is
 * not settled in 3000, at 5.8971 +-0.5058. THAT IS A PROPERTY OF THE STAT, NOT A FLAW TO HIDE: every weight below
 * carries the 95% interval computed from its own paired spread, and the
 * iterations are allocated from that spread rather than spread evenly. A stat
 * that needs more gets more, up to the cap the caller sets, and a stat that
 * could not reach the target says so instead of reading as precise.
 *
 * THE ALLOCATION CANNOT SELECT ON THE ANSWER, deliberately. The iterations a
 * variant gets are computed from its SPREAD, its step and the target width --
 * all three independent of the measured delta -- so this is not "run until it
 * looks significant", which would bias every weight towards whatever the first
 * block happened to show.
 *
 * ------------------------------------------------------------------------------
 * THREE. A CAPPED STAT IS SEVERAL STATS, AND THE RULESET OWNER'S CALL ON IT IS
 * WHAT MAKES A BIG STEP SAFE.
 *
 * "Chance to miss" is up to five numbers and a build can be capped on one and
 * not another -- a Rogue on 16 points of hit has nothing left on its specials
 * or its spells and eleven points left on its swings. So hit is measured as a
 * LADDER, one weight per interval between the caps: run to the first cap and
 * difference against the baseline, run to the second and difference against the
 * first. The owner's own words for it were "these can be treated as multiple
 * stats in effect".
 *
 * AND A TIER IS LINEAR BY CONSTRUCTION, which is what makes it measurable. The
 * boundaries sit exactly where a table stops paying, so nothing changes
 * behaviour inside one -- the whole tier can be added at once for the best
 * signal-to-noise available, and the per-point figure is still a true one. A
 * single large step ACROSS a cap would average the first point together with
 * the last and understate both:
 *
 *   dw_fury hit, measured over 3000 iterations
 *     the ladder   first 9%  5.8971 DPS/point   (both hands' swings gain)
 *                  next  3%  2.5912 DPS/point   (the off hand has capped)
 *     one 12-point step      5.0700 DPS/point   -- understates the first nine
 *                                                  and overstates the last three
 *
 * `game/combat/statHeadroom.ts` builds the ladder; this file measures it.
 * ==============================================================================
 */

/** How much of a stat is added, and what a displayed unit of it means. */
export interface WeightableStat {
  readonly id: StatName;
  readonly name: string;
  /**
   * Engine-stat amount per DISPLAYED unit.
   *
   * One everywhere except haste, where the engine's only route is
   * `hasteRating` and the unit anyone cares about is a percent. The project's
   * one idiom for that is `percent * RATING_PER_PERCENT.haste`, shared with
   * Seal of the Crusader, Nature's Grace, Flurry and the gloves enchant -- so a
   * weight of "DPS per 1% haste" is independent of a placeholder conversion
   * that may yet move.
   */
  readonly statPerUnit: number;
  /** Suffix on the displayed unit: a percentage point, or nothing. */
  readonly unitLabel: string;
  /**
   * How many displayed units to add, where the stat is not tiered.
   *
   * A MODELLING CHOICE AND NOT RULESET DATA, so it is declared here in one
   * place rather than derived from something that looks like authority. Each is
   * about one gear line's worth -- the range an item or an enchant in this
   * project's data actually grants -- chosen so the step is small enough to
   * read as marginal and large enough to clear the noise floor. Changing one
   * changes what the number MEANS, not just its precision, so they are a
   * published part of the feature: `StatWeight.units` carries whichever was
   * used.
   */
  readonly step: number;
  /** Set where the step comes from the cap ladder instead. */
  readonly tiered?: TieredStat;
  /** One line, for the panel. */
  readonly detail: string;
  /**
   * True for a stat nothing in a fight can read unless the target swings back.
   *
   * A structural zero rather than a cap, and reported the same way: there is no
   * point spending 3000 fights discovering that dodge is worth nothing to a
   * character nothing attacks. `blockValue` is deliberately NOT one of these --
   * Shield Slam adds the wielder's block value to its own damage, so it is an
   * offensive stat for a shield Warrior in a fight it is never hit in.
   */
  readonly needsIncomingDamage?: boolean;
}

/**
 * Every stat a stat-weight run can price.
 *
 * ------------------------------------------------------------------------------
 * THE STATS GEAR GRANTS, plus the two capped attacker-side ones.
 *
 * The first group is derived from what this project's item and enchant data
 * actually says -- `EFFECT_RULES` in `itemData.ts` and the owner's enchant
 * table -- and `statWeights.test.ts` asserts that nothing an item or an enchant
 * grants is missing from here, so a new item line fails the suite rather than
 * going quietly unpriced.
 *
 * `armorPenetration` and `dodgeParryReduction` are on the list although no gear
 * in the data grants either: both are granted by talents, both are capped, and
 * the ruleset owner asked for the dodge/parry one by name. They are also the
 * two that make the cap reporting worth having at all.
 *
 * `critRating`, `hasteRating`'s siblings and the other rating stats are NOT
 * here. `RATING_PER_PERCENT` says of itself that every constant in it is a
 * placeholder, and no gear in this project grants rating -- an item line that
 * says "+2% crit" becomes `critChance`, the percentage points, which is what
 * the combat table reads. Haste is the one exception and it is expressed in
 * percent for exactly that reason.
 * ------------------------------------------------------------------------------
 */
export const WEIGHTABLE_STATS: readonly WeightableStat[] = [
  // ---- Primaries. The conversions are what make these interesting: 30
  // strength is 60 attack power on a Warrior and 30 on a Rogue, and a stat
  // weight is the only honest way to compare them.
  prim('strength', 'Strength'),
  prim('agility', 'Agility'),
  prim('stamina', 'Stamina'),
  prim('intellect', 'Intellect'),
  prim('spirit', 'Spirit'),

  // ---- Offensive power.
  {
    id: 'attackPower',
    name: 'Attack power',
    statPerUnit: 1,
    unitLabel: '',
    // Sixty, so it is directly comparable with 30 strength on a class that
    // converts at two to one. Items in this data grant 20 to 65 of it.
    step: 60,
    detail: 'Melee attack power. Weapon damage is base + baseSpeed / 14 x this.',
  },
  {
    id: 'rangedAttackPower',
    name: 'Ranged attack power',
    statPerUnit: 1,
    unitLabel: '',
    step: 60,
    detail: 'A separate pool, and the only one a bow reads.',
  },
  {
    id: 'spellPower',
    name: 'Spell power',
    statPerUnit: 1,
    unitLabel: '',
    step: 30,
    detail: 'School-blind. Each spell scales it by its own coefficient.',
  },
  {
    id: 'critChance',
    name: 'Crit chance',
    statPerUnit: 1,
    unitLabel: '%',
    step: 2,
    detail: 'Percentage points, read by the melee and ranged tables.',
  },
  {
    id: 'spellCritChance',
    name: 'Spell crit chance',
    statPerUnit: 1,
    unitLabel: '%',
    step: 2,
    detail: 'A separate stat from melee crit; only the spell table reads it.',
  },
  {
    id: 'hitChance',
    name: 'Hit chance',
    statPerUnit: 1,
    unitLabel: '%',
    // Unused: the ladder decides the step. Kept at one point so a reader who
    // misses `tiered` still sees a sane number rather than a zero.
    step: 1,
    tiered: 'hitChance',
    detail: 'Taken off miss, and every table caps at a different point.',
  },
  {
    id: 'hasteRating',
    name: 'Haste',
    statPerUnit: RATING_PER_PERCENT.haste,
    unitLabel: '%',
    step: 2,
    detail: 'Cast speed, melee swing speed and ranged swing speed, all three.',
  },
  {
    id: 'armorPenetration',
    name: 'Armor penetration',
    statPerUnit: 1,
    unitLabel: '%',
    step: 10,
    detail: "Percentage points of the TARGET's armor ignored, not of the reduction.",
  },
  {
    id: 'dodgeParryReduction',
    name: 'Reduced dodge/parry',
    statPerUnit: 1,
    unitLabel: '%',
    step: 1,
    tiered: 'dodgeParryReduction',
    detail: "Taken off the defender's dodge AND parry, which cap separately.",
  },
  {
    id: 'blockValue',
    name: 'Block value',
    statPerUnit: 1,
    unitLabel: '',
    step: 50,
    // No `needsIncomingDamage`: Shield Slam reads it to raise its own damage,
    // so it is offensive for a shield Warrior in a fight nothing hits back in.
    detail: 'Flat damage a block removes, and damage Shield Slam adds.',
  },

  // ---- Mana.
  {
    id: 'manaPer5',
    name: 'Mana per 5',
    statPerUnit: 1,
    unitLabel: '',
    step: 25,
    detail: 'Worth nothing to a build that never runs dry.',
  },

  // ---- Defensive. Nothing in a fight reads any of these unless the target
  // swings back, which is off by default.
  {
    id: 'armor',
    name: 'Armor',
    statPerUnit: 1,
    unitLabel: '',
    step: 500,
    detail: 'Physical damage taken. Does NOT reduce rage, which is pre-armor.',
    needsIncomingDamage: true,
  },
  {
    id: 'defenseSkill',
    name: 'Defense skill',
    statPerUnit: 1,
    unitLabel: '',
    step: 10,
    detail: "Five numbers at once: the attacker's miss and crit, and your dodge, parry and block.",
    needsIncomingDamage: true,
  },
  {
    id: 'dodgeChance',
    name: 'Dodge chance',
    statPerUnit: 1,
    unitLabel: '%',
    step: 2,
    detail: 'Avoided attacks, on the attacks-received table.',
    needsIncomingDamage: true,
  },
  {
    id: 'parryChance',
    name: 'Parry chance',
    statPerUnit: 1,
    unitLabel: '%',
    step: 2,
    detail: 'The mirror of dodge, read the same way.',
    needsIncomingDamage: true,
  },
  {
    id: 'blockChance',
    name: 'Block chance',
    statPerUnit: 1,
    unitLabel: '%',
    step: 2,
    detail: 'Needs a shield: defense skill does not conjure one.',
    needsIncomingDamage: true,
  },
];

function prim(id: StatName, name: string): WeightableStat {
  return {
    id,
    name,
    statPerUnit: 1,
    unitLabel: '',
    // Thirty, which is a trinket and an enchant, and the figure the ruleset
    // owner used when describing the feature.
    step: 30,
    detail: 'Reaches the class conversion table, so it moves whatever that derives.',
  };
}

export const WEIGHTABLE_STATS_BY_ID: ReadonlyMap<StatName, WeightableStat> = new Map(
  WEIGHTABLE_STATS.map((stat) => [stat.id, stat]),
);

/* ---------------------------------------------------------------------------
 * The plan: what will be run, and what will not be, and why.
 * ------------------------------------------------------------------------- */

/** One run with a stat added, and the run its DPS is differenced against. */
export interface StatWeightVariant {
  readonly key: string;
  readonly statId: StatName;
  /** What the row is called -- the stat, plus the tier where there is one. */
  readonly name: string;
  /** Engine-stat amount to add to the profile for this run. */
  readonly added: number;
  /** The variant this one is differenced against. Absent means the baseline. */
  readonly against?: string;
  /** Displayed units at the bottom and the top of this step. */
  readonly fromUnits: number;
  readonly toUnits: number;
  readonly unitLabel: string;
  /** Which slices the step still buys, where that is the point of the row. */
  readonly buys?: readonly string[];
}

/** A stat that will not be run, and the reason in words. */
export interface SkippedStat {
  readonly statId: StatName;
  readonly name: string;
  readonly reason: string;
}

/** The cap ladder for one tiered stat, so the panel can print the arithmetic. */
export interface HeadroomReport {
  readonly statId: StatName;
  readonly name: string;
  readonly slices: readonly HeadroomSlice[];
  readonly tiers: readonly StatTier[];
}

export interface StatWeightPlan {
  readonly variants: readonly StatWeightVariant[];
  readonly skipped: readonly SkippedStat[];
  readonly headroom: readonly HeadroomReport[];
}

/**
 * Build the plan for a profile and a chosen set of stats.
 *
 * ------------------------------------------------------------------------------
 * EVERY VARIANT IS CHECKED TO HAVE ARRIVED BEFORE IT IS RUN, which is the one
 * guard this feature cannot do without. A stat weight of exactly 0.00 has two
 * causes that look identical: the stat is genuinely worth nothing to this build
 * -- spell power on a Warrior -- or the variant never reached the character at
 * all. Shared seeds make the second case produce a bit-identical fight and a
 * delta of 0.00 to the decimal, which is precisely the shape this project has
 * been caught by before: "two variants that agree exactly are a patch that did
 * not apply". So the character is built twice and the effective stat is
 * compared, and a stat that did not move is SKIPPED with that as its reason
 * rather than measured and reported as worthless.
 *
 * It costs one `createPlayer` per variant and no fights.
 * ------------------------------------------------------------------------------
 */
export function statWeightPlan(
  profile: CharacterProfile,
  selected: readonly StatName[],
): StatWeightPlan {
  const player = characterAtCombatStart(profile);
  if (!player) {
    return {
      variants: [],
      skipped: selected.map((id) => ({
        statId: id,
        name: WEIGHTABLE_STATS_BY_ID.get(id)?.name ?? id,
        reason: 'The profile does not build a player.',
      })),
      headroom: [],
    };
  }

  const chances = createForeverAttackChances({
    targetAttacks: profile.encounter.targetAttacks,
  });
  const target = createTrainingDummy({
    name: profile.encounter.targetName,
    health: profile.encounter.targetHealth,
    armor: profile.encounter.targetArmor,
    level: profile.encounter.targetLevel,
  });

  const variants: StatWeightVariant[] = [];
  const skipped: SkippedStat[] = [];
  const headroom: HeadroomReport[] = [];

  // The catalogue decides the order, so two runs with the same selection
  // produce the same rows rather than the order the boxes were ticked in.
  for (const stat of WEIGHTABLE_STATS) {
    if (!selected.includes(stat.id)) continue;

    if (stat.needsIncomingDamage && !profile.encounter.targetAttacks) {
      skipped.push({
        statId: stat.id,
        name: stat.name,
        reason: 'The target does not swing back, so nothing in the fight reads it.',
      });
      continue;
    }

    if (!statArrives(profile, stat, player)) {
      skipped.push({
        statId: stat.id,
        name: stat.name,
        reason: 'Adding it does not change the built character, so there is nothing to measure.',
      });
      continue;
    }

    if (stat.tiered) {
      const slices = headroomFor(stat.tiered, player, target, chances);
      const tiers = tiersFrom(slices);
      headroom.push({ statId: stat.id, name: stat.name, slices, tiers });

      if (tiers.length === 0) {
        skipped.push({
          statId: stat.id,
          name: stat.name,
          reason: cappedReason(slices),
        });
        continue;
      }

      let previous: string | undefined;
      tiers.forEach((tier, index) => {
        const key = `${stat.id}:${index}`;
        variants.push({
          key,
          statId: stat.id,
          name: tierName(stat, tier, index),
          added: tier.to * stat.statPerUnit,
          ...(previous ? { against: previous } : {}),
          fromUnits: tier.from,
          toUnits: tier.to,
          unitLabel: stat.unitLabel,
          buys: tier.benefits,
        });
        previous = key;
      });
      continue;
    }

    variants.push({
      key: stat.id,
      statId: stat.id,
      name: stat.name,
      added: stat.step * stat.statPerUnit,
      fromUnits: 0,
      toUnits: stat.step,
      unitLabel: stat.unitLabel,
    });
  }

  return { variants, skipped, headroom };
}

/**
 * Whether adding the step actually moves the built character's stat.
 *
 * Built at the step the run will use rather than at one point, because a stat
 * granted in whole numbers could round a single point away. The comparison is
 * on the EFFECTIVE block, after conversions and opening auras, which is what a
 * fight reads.
 */
function statArrives(
  profile: CharacterProfile,
  stat: WeightableStat,
  baseline: Combatant,
): boolean {
  const amount = (stat.tiered ? 1 : stat.step) * stat.statPerUnit;
  const probe = characterAtCombatStart(withStat(profile, stat.id, amount));
  if (!probe) return false;
  return probe.stats.effective[stat.id] > baseline.stats.effective[stat.id];
}

/**
 * The reason a tiered stat has nowhere left to go, in the slices' own words.
 *
 * TWO DIFFERENT REASONS AND THEY ARE NOT THE SAME NEWS. A Rogue's melee hit is
 * capped: it had somewhere to go and gear took it there, and losing a point
 * would start costing damage again. A Mage's `dodgeParryReduction` is not
 * capped at all -- it makes no attack anything can dodge, so there is no slice
 * to cap. Printing "already capped" for the second would tell someone their
 * caster had stacked a stat it has never been able to use.
 */
function cappedReason(slices: readonly HeadroomSlice[]): string {
  if (slices.length === 0) {
    return 'This build rolls on no table the stat can reach, so there is nothing to measure.';
  }
  const words = slices
    .map((slice) => `${slice.label.toLowerCase()} ${slice.current.toFixed(2)}%`)
    .join(', ');
  return `Already capped. No stat weight. (${words})`;
}

/**
 * What a rung is called.
 *
 * ------------------------------------------------------------------------------
 * IT NAMES THE AMOUNT AND WHAT THE AMOUNT REACHES, which is the figure that was
 * asked for: "how much more hit would it take to stop my off hand missing".
 *
 * AN EARLIER VERSION CALLED IT "first 9.00%" AND THAT READ AS A CAP. It is not
 * one -- 9.00 is what this character has LEFT on its off hand after 8 points of
 * gear hit and 10 from Dual Wield Specialization have come off a 27% miss -- and
 * a reader who knows the melee cap is 8% sees "9%" and concludes the tool is
 * adding more than the cap allows. The amount is the same either way; only the
 * sentence changed.
 * ------------------------------------------------------------------------------
 */
function tierName(stat: WeightableStat, tier: StatTier, index: number): string {
  const width = `${(tier.to - tier.from).toFixed(2)}${stat.unitLabel}`;
  const more = index === 0 ? '' : ' more';
  return `${stat.name} +${width}${more} → caps ${tier.caps.join(', ')}`;
}

/** A profile with one stat raised. The only mutation this feature makes. */
export function withStat(
  profile: CharacterProfile,
  stat: StatName,
  amount: number,
): CharacterProfile {
  return {
    ...profile,
    stats: { ...profile.stats, [stat]: (profile.stats[stat] ?? 0) + amount },
  };
}

/* ---------------------------------------------------------------------------
 * The arithmetic: a paired difference and its interval.
 * ------------------------------------------------------------------------- */

export interface PairedDelta {
  /** Mean DPS difference, over the iterations both runs share. */
  readonly delta: number;
  /** 95% half-width on `delta`: two standard errors of the paired mean. */
  readonly interval: number;
  /**
   * Standard deviation of the PER-ITERATION difference.
   *
   * The diagnostic this whole file turns on. Near zero means the two runs are
   * the same fights with bigger numbers and the weight is already settled;
   * tens of DPS means one flipped roll reordered the random stream and the two
   * runs are effectively independent fights, which is what the iteration
   * allocation below reads.
   */
  readonly spread: number;
  readonly iterations: number;
}

export function pairedDelta(
  base: readonly number[],
  variant: readonly number[],
): PairedDelta {
  const count = Math.min(base.length, variant.length);
  if (count === 0) return { delta: 0, interval: 0, spread: 0, iterations: 0 };

  let sum = 0;
  for (let index = 0; index < count; index++) sum += variant[index] - base[index];
  const delta = sum / count;

  if (count < 2) return { delta, interval: 0, spread: 0, iterations: count };

  let squares = 0;
  for (let index = 0; index < count; index++) {
    squares += (variant[index] - base[index] - delta) ** 2;
  }
  // Sample standard deviation: n-1, because the mean was estimated from the
  // same samples.
  const spread = Math.sqrt(squares / (count - 1));

  return { delta, interval: (2 * spread) / Math.sqrt(count), spread, iterations: count };
}

/**
 * What the run is able to say about a weight.
 *
 * ------------------------------------------------------------------------------
 * THREE ANSWERS, AND TWO OF THEM LOOK IDENTICAL IN THE NUMBERS. A weight of
 * 0.0000 with an interval of 0.0000 can mean the stat is worth nothing, and a
 * weight of 0.08 with an interval of 0.9 means nothing was learned -- and
 * rendering both as "0.0" would put the first, which is a CONFIDENT answer,
 * under the same heading as the second, which is an absence of one.
 *
 * `none` IS THE STRONGER CLAIM, not the weaker one. Under shared seeds a stat
 * the fight cannot read leaves every roll alone, so the variant runs
 * bit-identical fights and the paired spread is zero -- and the planner has
 * already built the character and checked the stat ARRIVED, which is what rules
 * out the other reading of two identical runs. Spell power on a Warrior is
 * worth nothing, and this says so rather than shrugging.
 * ------------------------------------------------------------------------------
 */
export type WeightVerdict =
  /** The interval is narrower than the value. A number to act on. */
  | 'measured'
  /** The variant ran the same fights. Worth exactly nothing to this build. */
  | 'none'
  /** The interval swallows the value. Not a measurement yet -- run more. */
  | 'inconclusive';

/**
 * How small a paired spread has to be, against the baseline's own DPS, to mean
 * the two runs were the same fights.
 *
 * ------------------------------------------------------------------------------
 * THERE ARE THIRTEEN ORDERS OF MAGNITUDE OF DAYLIGHT HERE, which is what makes
 * a threshold safe rather than a fudge. Two runs that never diverged differ
 * only by floating-point summation order -- `runBatch` takes each iteration's
 * damage as a difference of cumulative sums and the lean path sums one
 * iteration from zero -- which is about one part in 10^13. Two runs that DID
 * diverge differ by whole fights: the smallest paired spread this project has
 * measured on a stat that changes a roll is about 1 DPS against a baseline of
 * 880, one part in 10^3.
 *
 * Anything between those is the same answer, so 10^-9 is not a tuned number.
 * ------------------------------------------------------------------------------
 */
const IDENTICAL_FIGHT_FRACTION = 1e-9;

/** One finished row. */
export interface StatWeight {
  readonly key: string;
  readonly statId: StatName;
  readonly name: string;
  /** How much was added, in displayed units, and what a unit is called. */
  readonly units: number;
  readonly unitLabel: string;
  /** The DPS difference the addition bought. */
  readonly delta: number;
  /** `delta / units`: the weight. */
  readonly perUnit: number;
  /** 95% half-width on `perUnit`. */
  readonly interval: number;
  readonly iterations: number;
  readonly spread: number;
  readonly verdict: WeightVerdict;
  readonly buys?: readonly string[];
}

/**
 * Turn the collected samples into rows.
 *
 * A tier is differenced against the run below it rather than against the
 * baseline, which is what makes the ladder add up: the first tier is measured
 * from zero and the second from the first tier's top, so each row prices its
 * own interval and not the sum of itself and everything beneath it.
 */
export function weightsFrom(
  plan: StatWeightPlan,
  baseline: readonly number[],
  samples: ReadonlyMap<string, readonly number[]>,
): readonly StatWeight[] {
  const rows: StatWeight[] = [];

  for (const variant of plan.variants) {
    const mine = samples.get(variant.key);
    const against = variant.against ? samples.get(variant.against) : baseline;
    if (!mine || !against) continue;

    const paired = pairedDelta(against, mine);
    const units = variant.toUnits - variant.fromUnits;

    /*
     * THE SCALE IS THE RUN THIS ONE IS DIFFERENCED AGAINST, not the baseline:
     * a tier is paired against the tier below it, and a relative threshold has
     * to be relative to the thing it is relative to.
     */
    const scale =
      Math.abs(against.reduce((sum, value) => sum + value, 0)) / Math.max(1, against.length);
    const floor = scale * IDENTICAL_FIGHT_FRACTION;
    /*
     * BOTH HALVES, and the spread alone is not enough. A paired difference
     * that is the SAME on every iteration has a spread of zero and a mean of
     * whatever the stat was worth -- which is not "the same fights", it is a
     * perfectly measured effect. Reading the spread by itself called a clean
     * +18 DPS "nothing".
     */
    const identical = Math.abs(paired.delta) <= floor && paired.spread <= floor;

    /*
     * ZEROED RATHER THAN PRINTED. An identical pair leaves a residue of about
     * 1e-14 DPS, and `(-1.2e-14).toFixed(4)` renders as "-0.0000" -- a minus
     * sign on a stat that is worth nothing, which reads as a measurement
     * rather than as the absence of one.
     */
    const delta = identical ? 0 : paired.delta;
    const perUnit = units === 0 ? 0 : delta / units;
    const interval = identical || units === 0 ? 0 : paired.interval / units;

    rows.push({
      key: variant.key,
      statId: variant.statId,
      name: variant.name,
      units,
      unitLabel: variant.unitLabel,
      delta,
      perUnit,
      interval,
      iterations: paired.iterations,
      spread: identical ? 0 : paired.spread,
      verdict: identical
        ? 'none'
        : Math.abs(perUnit) <= interval
          ? 'inconclusive'
          : 'measured',
      ...(variant.buys ? { buys: variant.buys } : {}),
    });
  }

  return rows;
}

/**
 * The same rows, measured in DEATHS AVOIDED instead of DPS.
 *
 * ==============================================================================
 * A TANK STAT WEIGHT IS THE SAME ARITHMETIC ON A DIFFERENT QUANTITY. Nothing
 * about the pairing, the interval or the cap ladder changes: what changes is
 * that the number being differenced is how often the character died rather
 * than how much damage it dealt. So this negates and calls `weightsFrom`,
 * rather than being a second implementation of the statistics.
 *
 * NEGATED, BECAUSE MORE IS BETTER EVERYWHERE ELSE. `pairedDelta` reports
 * `variant - baseline`, which for deaths is NEGATIVE when a stat helps. The
 * ruleset owner put the quantity as "avoid death": 30 agility taking deaths
 * from 10.5 to 9.8 is **+0.7 avoid death**, so the sign is flipped once, here,
 * and every reader downstream sorts and renders it exactly as it does a DPS
 * weight.
 *
 * FROM THE SAME FIGHTS AS THE DPS WEIGHTS, which is why a tank run costs
 * nothing extra: `sampleIterations` returns both metrics off one pass, so the
 * deaths were counted while the damage was being summed.
 * ==============================================================================
 */
export function survivalWeightsFrom(
  plan: StatWeightPlan,
  baselineDeaths: readonly number[],
  deaths: ReadonlyMap<string, readonly number[]>,
): readonly StatWeight[] {
  const avoided = (counts: readonly number[]) => counts.map((count) => -count);
  return weightsFrom(
    plan,
    avoided(baselineDeaths),
    new Map([...deaths].map(([key, counts]) => [key, avoided(counts)])),
  ).filter(
    /*
     * A STAT THAT CANNOT REDUCE DEATHS IS NOT A TANK STAT, and the owner's
     * wording is "any stat that REDUCES DEATHS should be populated here". A
     * `none` verdict is the confident form of that: the variant ran
     * bit-identical fights, so attack power and spell power did not move the
     * death count by so much as a rounding error and a row for each of them is
     * nine lines of nothing.
     *
     * `inconclusive` STAYS, because it is a different statement -- the stat
     * changed the fight and the run could not resolve by how much. Dropping
     * those would hide the stats that need more iterations behind the ones
     * that need none.
     */
    (row) => row.verdict !== 'none',
  );
}

/* ---------------------------------------------------------------------------
 * The synchronous runner.
 * ------------------------------------------------------------------------- */

export interface StatWeightRun {
  readonly plan: StatWeightPlan;
  /** Mean DPS of the baseline. */
  readonly baselineDps: number;
  /** Mean deaths per fight in the baseline. Zero unless the target swings. */
  readonly baselineDeaths: number;
  /** The count the baseline AND every variant ran. */
  readonly iterations: number;
  readonly weights: readonly StatWeight[];
  /**
   * The same stats again, measured in DEATHS AVOIDED.
   *
   * Empty when the target does not swing back, because nothing can then
   * reduce a death count that is already zero.
   */
  readonly survival: readonly StatWeight[];
  /** Fights run, baseline included. The honest cost of the answer. */
  readonly fights: number;
  readonly elapsedRealMs: number;
}

export interface StatWeightOptions {
  /**
   * The iteration count, for the baseline and for EVERY variant alike.
   *
   * ----------------------------------------------------------------------------
   * THE SAME COUNT FOR EVERY ROW, on the ruleset owner's instruction, and it
   * replaces an allocation that gave a noisy stat more fights than a quiet one.
   * That allocation was cheaper -- a stat worth nothing settled in 250 fights
   * and hit took 3000 -- and it made two rows of one table incomparable: a
   * reader sorting by weight had no way to see that one figure rested on twelve
   * times the evidence of the one above it.
   *
   * What is NOT lost is knowing which rows are solid. The interval is still
   * computed per row from its own paired spread, so a stat that needs more
   * fights than this says so by carrying a wider one.
   * ----------------------------------------------------------------------------
   */
  readonly iterations: number;
  /** Shared by the baseline and every variant. That sharing is the point. */
  readonly baseSeed: number;
  readonly onProgress?: (fraction: number) => void;
}

/**
 * Run a whole stat-weight measurement on this thread.
 *
 * THE TESTABLE CORE, and the one a `tools/` harness calls. The UI drives the
 * same pieces across a pool of workers instead -- `pairedDelta` and
 * `weightsFrom` are exported so that driver computes nothing of its own.
 */
export function runStatWeights(
  profile: CharacterProfile,
  selected: readonly StatName[],
  options: StatWeightOptions,
): StatWeightRun {
  const startedAt = Date.now();
  const iterations = Math.max(1, Math.floor(options.iterations));
  const plan = statWeightPlan(profile, selected);
  const slice = { from: 0, to: iterations };

  const baseline = sampleIterations(trainingDummyEncounter(profile), options.baseSeed, slice);
  options.onProgress?.(1 / (plan.variants.length + 1));

  const dps = new Map<string, number[]>();
  const deaths = new Map<string, number[]>();
  plan.variants.forEach((variant, index) => {
    const taken = sampleIterations(
      trainingDummyEncounter(withStat(profile, variant.statId, variant.added)),
      options.baseSeed,
      slice,
    );
    dps.set(variant.key, taken.dps);
    deaths.set(variant.key, taken.deaths);
    options.onProgress?.((index + 2) / (plan.variants.length + 1));
  });

  const mean = (values: readonly number[]) =>
    values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const baselineDeaths = mean(baseline.deaths);

  return {
    plan,
    baselineDps: mean(baseline.dps),
    baselineDeaths,
    iterations,
    weights: weightsFrom(plan, baseline.dps, dps),
    /*
     * ONLY WHERE SOMETHING CAN DIE. A fight the target does not swing in has a
     * death count of zero on every iteration, so every weight would come back
     * as a confident "nothing" -- true, and twenty rows of it is noise rather
     * than an answer.
     */
    survival: baselineDeaths > 0 ? survivalWeightsFrom(plan, baseline.deaths, deaths) : [],
    fights: iterations * (plan.variants.length + 1),
    elapsedRealMs: Date.now() - startedAt,
  };
}

/** Re-exported so a caller needs one import for the whole feature. */
export type { HeadroomSlice, StatTier, TieredStat };
