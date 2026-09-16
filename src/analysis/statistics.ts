/**
 * Summary statistics over a set of samples.
 *
 * Used by the Monte Carlo runner, where a single DPS number is meaningless
 * without knowing how much it varies between iterations.
 */
export interface DistributionSummary {
  readonly count: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  /** Population standard deviation. */
  readonly standardDeviation: number;
  /** Standard deviation as a fraction of the mean. */
  readonly relativeError: number;
  readonly percentiles: {
    readonly p5: number;
    readonly p25: number;
    readonly p75: number;
    readonly p95: number;
  };
}

export function summarize(samples: readonly number[]): DistributionSummary {
  if (samples.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
      relativeError: 0,
      percentiles: { p5: 0, p25: 0, p75: 0, p95: 0 },
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;

  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    count: samples.length,
    mean,
    median: percentile(sorted, 0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    standardDeviation,
    relativeError: mean === 0 ? 0 : standardDeviation / mean,
    percentiles: {
      p5: percentile(sorted, 0.05),
      p25: percentile(sorted, 0.25),
      p75: percentile(sorted, 0.75),
      p95: percentile(sorted, 0.95),
    },
  };
}

/**
 * Linear-interpolated percentile of an already-sorted array.
 *
 * Interpolating rather than picking the nearest sample keeps the median stable
 * as the iteration count changes, which matters when comparing two batches.
 */
export function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * Math.min(1, Math.max(0, fraction));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];

  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
