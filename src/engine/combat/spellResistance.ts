import type { RNG } from '../rng/RNG';

/*
 * ==============================================================================
 * SPELL RESISTANCE AND SPELL PIERCING, as Forever's own combat logs measure them
 * (wowsims/forever#76, logged 2026-10-04 to 2026-10-12, adopted by the ruleset
 * owner in round 46).
 *
 * THE RULE IS THE ENGINE'S AND THE NUMBERS ARE THE RULESET'S. What lives here
 * is the shape the logs settle -- partial resists in 10% steps, rolled around
 * an average resisted share -- and the constant K arrives from `game` through
 * `SimulationConfig.spellResistanceConstant`, the way the combat table's
 * chances arrive through `attackChances`.
 *
 *   a = |R| / (|R| + K)          the average share, R the effective resistance
 *
 *   a < 0.1   P(0) = 1 - 7.5a,  P(10%) = 5a,  P(20%) = 2.5a
 *   a >= 0.1  P(x) = 0.5 - 2.5 |x - a|  over x = 0, 10%, 20%, ...
 *
 * NEVER 25/50/75. Classic's bins do not appear once in 1,610 partial resists.
 *
 * NEGATIVE RESISTANCE IS BONUS DAMAGE, on the same roll: Spell Piercing beyond
 * a target's resistance shows in the logs as a NEGATIVE resisted value of 0,
 * -10%, -20% or -30% of the hit, at the rate the same |R| would resist.
 * ==============================================================================
 */

/** The step a partial resist moves in: always a tenth of the hit. */
export const RESIST_STEP = 0.1;

/** The average share of a hit that `resistance` takes off (or adds, if negative). */
export function averageResist(resistance: number, constant: number): number {
  const magnitude = Math.abs(resistance);
  if (magnitude === 0 || constant <= 0) return 0;
  return magnitude / (magnitude + constant);
}

/**
 * The probability of each step, from 0% upward, for an average share `a`.
 *
 * Normalised so the array sums to exactly one: the triangle's four buckets sum
 * to one by construction, and a share near 1 would clip it at the top.
 */
export function resistBucketProbabilities(a: number): readonly number[] {
  if (a <= 0) return [1];
  if (a < 0.1) return [1 - 7.5 * a, 5 * a, 2.5 * a];
  const out: number[] = [];
  for (let step = 0; step <= 10; step++) {
    out.push(Math.max(0, 0.5 - 2.5 * Math.abs(step * RESIST_STEP - a)));
  }
  const total = out.reduce((sum, p) => sum + p, 0);
  return out.map((p) => p / total);
}

/** Which step a uniform roll in [0, 1) lands on, as a share of the hit. */
export function resistShareFor(a: number, roll: number): number {
  const probabilities = resistBucketProbabilities(a);
  let cumulative = 0;
  for (let step = 0; step < probabilities.length; step++) {
    cumulative += probabilities[step];
    if (roll < cumulative) return step * RESIST_STEP;
  }
  return (probabilities.length - 1) * RESIST_STEP;
}

/**
 * Roll a hit's partial resist against an effective resistance.
 *
 * Returns the SIGNED share of the hit removed: 0.2 means 20% resisted, -0.1
 * means 10% more damage. NO RANDOM NUMBER IS DRAWN when the resistance is
 * zero, so a fight with no resistance anywhere runs exactly as it did before
 * this existed.
 */
export function rollResist(resistance: number, constant: number, rng: RNG): number {
  const a = averageResist(resistance, constant);
  if (a === 0) return 0;
  const share = resistShareFor(a, rng.next());
  return resistance > 0 ? share : -share;
}
