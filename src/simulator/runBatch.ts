import type { DistributionSummary, SimulationResult } from '../analysis';
import { StreamingDamageTotals, summarize } from '../analysis';
import type { SimulationConfig } from '../engine';
import { Simulation, deriveSeed, toSeconds } from '../engine';
import { trainingDummyEncounter } from './trainingDummyEncounter';
import type { CharacterProfile } from '../profiles';
import { runSimulation } from './runSimulation';

export interface BatchOptions {
  readonly iterations: number;
  /** Seeds for individual iterations are derived from this. */
  readonly baseSeed: number;
  /** Called with a 0-to-1 fraction, for a progress bar. */
  readonly onProgress?: (fraction: number) => void;
}

export interface BatchResult {
  readonly iterations: number;
  readonly baseSeed: number;
  /** DPS across every iteration. */
  readonly dps: DistributionSummary;
  /**
   * A full result for the iteration whose DPS landed closest to the median, so
   * the combat log shown alongside a batch is a typical fight rather than an
   * outlier.
   */
  readonly representative: SimulationResult;
  /** Wall-clock time the batch took, in milliseconds. */
  readonly elapsedRealMs: number;
}

/**
 * Monte Carlo: run the same fight many times and summarise the spread.
 *
 * One fight tells you very little, because crit rolls and fight length move the
 * result several percent either way. The distribution is the actual answer, and
 * its relative error says whether two builds are really different or just
 * noisy.
 *
 * Kept out of the Simulation class deliberately: a Simulation runs one fight
 * and knows nothing about batches, which is what lets this runner later hand
 * iterations to Web Workers without the engine noticing.
 */
export function runBatch(config: SimulationConfig, options: BatchOptions): BatchResult {
  const iterations = Math.max(1, Math.floor(options.iterations));
  const startedAt = Date.now();

  const dpsSamples: number[] = new Array(iterations);
  const seeds: number[] = new Array(iterations);

  for (let index = 0; index < iterations; index++) {
    const seed = deriveSeed(options.baseSeed, index);
    seeds[index] = seed;

    // Aggregate as we go; the event stream for this iteration is discarded.
    const totals = new StreamingDamageTotals();
    const simulation = new Simulation({ ...config, seed }, totals);
    const run = simulation.run();

    const friendlyIds = run.actors
      .filter((actor) => actor.faction === 'friendly')
      .map((actor) => actor.id);

    const elapsedSeconds = Math.max(toSeconds(run.elapsedMs), 0.001);
    dpsSamples[index] = totals.totalForAny(friendlyIds) / elapsedSeconds;

    options.onProgress?.((index + 1) / iterations);
  }

  const dps = summarize(dpsSamples);

  // Re-run the most typical iteration, this time recording everything. One
  // extra fight is a rounding error next to the batch, and it means the log the
  // user reads actually matches the headline number.
  const representativeIndex = indexClosestTo(dpsSamples, dps.median);
  const representative = runSimulation({ ...config, seed: seeds[representativeIndex] });

  return {
    iterations,
    baseSeed: options.baseSeed,
    dps,
    representative,
    elapsedRealMs: Date.now() - startedAt,
  };
}

/** Run a batch described by a character profile. */
export function runProfileBatch(
  profile: CharacterProfile,
  onProgress?: (fraction: number) => void,
): BatchResult {
  return runBatch(trainingDummyEncounter(profile), {
    iterations: profile.simulation.iterations,
    baseSeed: profile.simulation.seed,
    onProgress,
  });
}

function indexClosestTo(values: readonly number[], target: number): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < values.length; index++) {
    const distance = Math.abs(values[index] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}
