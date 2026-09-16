import type { Milliseconds } from '../time';
import type { RNG } from './RNG';

/**
 * A small, fast, deterministic pseudo-random number generator.
 *
 * The algorithm is `sfc32` ("Small Fast Counter"), seeded through `splitmix32`.
 * Two properties matter here:
 *
 *  1. It has 128 bits of state, so a single simulation will never exhaust its
 *     period no matter how long the fight runs.
 *  2. Nearby seeds (1, 2, 3, ...) produce completely unrelated streams, because
 *     splitmix32 scrambles the seed before it becomes state. That matters for
 *     Monte Carlo runs, where iteration N is seeded from the base seed plus N.
 *
 * Neither property holds for the usual one-liner generators, which is why this
 * is 30 lines instead of 3.
 */
export class SeededRNG implements RNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(public readonly seed: number) {
    // splitmix32: expand a single seed into four well-mixed 32-bit words.
    let state = seed >>> 0;
    const nextState = (): number => {
      state = (state + 0x9e3779b9) >>> 0;
      let z = state;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };

    this.a = nextState();
    this.b = nextState();
    this.c = nextState();
    this.d = nextState();
  }

  next(): number {
    // sfc32
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    // Divide by 2^32 to land in [0, 1).
    return t / 4294967296;
  }

  nextInt(min: number, max: number): number {
    if (max < min) throw new RangeError(`nextInt: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  rollChance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  nextDuration(min: Milliseconds, max: Milliseconds): Milliseconds {
    return this.nextInt(Math.round(min), Math.round(max));
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.nextInt(0, items.length - 1)];
  }
}

/**
 * Derive the seed for iteration `index` of a Monte Carlo batch.
 *
 * Exposed separately so that a batch is reproducible as a whole *and* any
 * single iteration inside it can be re-run on its own for debugging.
 */
export function deriveSeed(baseSeed: number, index: number): number {
  let z = (baseSeed + Math.imul(index, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}
