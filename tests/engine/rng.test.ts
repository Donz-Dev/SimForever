import { describe, expect, it } from 'vitest';
import { SeededRNG, deriveSeed } from '../../src/engine';

describe('SeededRNG', () => {
  it('produces an identical sequence for an identical seed', () => {
    const a = new SeededRNG(12345);
    const b = new SeededRNG(12345);

    const fromA = Array.from({ length: 1000 }, () => a.next());
    const fromB = Array.from({ length: 1000 }, () => b.next());

    expect(fromA).toEqual(fromB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);

    const fromA = Array.from({ length: 100 }, () => a.next());
    const fromB = Array.from({ length: 100 }, () => b.next());

    expect(fromA).not.toEqual(fromB);
  });

  it('gives adjacent seeds unrelated streams', () => {
    // Weak generators seeded naively produce near-identical streams for seeds
    // 1, 2, 3..., which would quietly correlate Monte Carlo iterations.
    const first = Array.from({ length: 50 }, (_unused, index) =>
      new SeededRNG(index + 1).next(),
    );

    const mean = first.reduce((sum, value) => sum + value, 0) / first.length;
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.65);

    const sorted = [...first].sort((a, b) => a - b);
    const largestGap = sorted
      .slice(1)
      .reduce((max, value, index) => Math.max(max, value - sorted[index]), 0);
    expect(largestGap).toBeLessThan(0.25);
  });

  it('stays within [0, 1)', () => {
    const rng = new SeededRNG(99);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  describe('nextInt', () => {
    it('stays within the inclusive bounds', () => {
      const rng = new SeededRNG(7);
      for (let i = 0; i < 5000; i++) {
        const value = rng.nextInt(3, 8);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(3);
        expect(value).toBeLessThanOrEqual(8);
      }
    });

    it('reaches both endpoints', () => {
      const rng = new SeededRNG(7);
      const seen = new Set<number>();
      for (let i = 0; i < 2000; i++) seen.add(rng.nextInt(1, 6));
      expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('rejects an inverted range', () => {
      const rng = new SeededRNG(1);
      expect(() => rng.nextInt(10, 5)).toThrow();
    });
  });

  describe('rollChance', () => {
    it('treats 0 and 1 as never and always, without consuming randomness', () => {
      const rng = new SeededRNG(5);
      const reference = new SeededRNG(5);

      expect(rng.rollChance(0)).toBe(false);
      expect(rng.rollChance(1)).toBe(true);

      // The short-circuit paths must not advance the stream, or adding a
      // guaranteed-crit effect would change every later roll in the fight.
      expect(rng.next()).toBe(reference.next());
    });

    it('lands near the requested probability over many rolls', () => {
      const rng = new SeededRNG(4242);
      let hits = 0;
      const trials = 100_000;
      for (let i = 0; i < trials; i++) {
        if (rng.rollChance(0.25)) hits++;
      }
      expect(hits / trials).toBeGreaterThan(0.24);
      expect(hits / trials).toBeLessThan(0.26);
    });
  });

  it('picks from an array and handles the empty case', () => {
    const rng = new SeededRNG(3);
    expect(rng.pick([])).toBeUndefined();
    expect(rng.pick(['only'])).toBe('only');

    const options = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(options).toContain(rng.pick(options));
    }
  });

  it('exposes its seed', () => {
    expect(new SeededRNG(8675309).seed).toBe(8675309);
  });
});

describe('deriveSeed', () => {
  it('is deterministic', () => {
    expect(deriveSeed(1000, 5)).toBe(deriveSeed(1000, 5));
  });

  it('gives each iteration of a batch a distinct seed', () => {
    const seeds = new Set(Array.from({ length: 10_000 }, (_unused, i) => deriveSeed(42, i)));
    // Collisions are possible in a 32-bit space but should be vanishingly rare.
    expect(seeds.size).toBeGreaterThan(9990);
  });

  it('separates batches with different base seeds', () => {
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(2, 0));
  });
});
