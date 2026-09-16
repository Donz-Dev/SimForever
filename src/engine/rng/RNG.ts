import type { Milliseconds } from '../time';

/**
 * Every random decision in the simulation goes through this interface.
 *
 * Nothing in the engine may call `Math.random()` directly. Routing randomness
 * through a seeded generator is what makes a run reproducible: the same
 * config plus the same seed must always produce the same combat log, which is
 * the only practical way to debug a 5-minute fight or compare two builds.
 */
export interface RNG {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  nextInt(min: number, max: number): number;
  /** Uniform float in [min, max). */
  nextFloat(min: number, max: number): number;
  /** True with the given probability, where 1 means always. */
  rollChance(probability: number): boolean;
  /** Uniform duration in [min, max], inclusive, in whole milliseconds. */
  nextDuration(min: Milliseconds, max: Milliseconds): Milliseconds;
  /** A uniformly chosen element, or undefined for an empty array. */
  pick<T>(items: readonly T[]): T | undefined;
}
