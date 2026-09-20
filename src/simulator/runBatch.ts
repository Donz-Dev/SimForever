import type {
  BatchAbilityTotals,
  BatchDamageTaken,
  BatchResourceFlow,
  DistributionSummary,
  SimulationResult,
} from '../analysis';
import { BatchTotals, summarize } from '../analysis';
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
   * A full result for the iteration whose DPS landed closest to the median.
   *
   * FOR THE COMBAT LOG ONLY. A log has to be a single fight to make any sense,
   * and this is a typical one. Every NUMBER a reader sees comes from the
   * aggregate below instead -- see `BatchTotals` for why reading a breakdown
   * off one iteration made a 2500-iteration batch report forty swings.
   */
  readonly representative: SimulationResult;
  /**
   * The priority list the player actually ran.
   *
   * Shown because it is not derivable from the character sheet: a Warrior's
   * list depends on combat style AND stance, and two builds that look
   * identical in every visible field can run different rotations. Someone
   * reading a result asked why Rend was being cast, and nothing on screen
   * could tell them which of three lists had produced it.
   */
  readonly rotationName: string | undefined;
  /** Mean damage dealt by the player per iteration. */
  readonly meanDamage: number;
  /** Mean fight length in milliseconds. */
  readonly meanDurationMs: number;
  /** The player's damage breakdown, pooled across every iteration. */
  readonly abilities: readonly BatchAbilityTotals[];
  /** What hit the player, pooled across every iteration. */
  readonly damageTaken: readonly BatchDamageTaken[];
  /** Where the player's rage came from and went, across every iteration. */
  readonly rage: BatchResourceFlow;
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
  const durations: number[] = new Array(iterations);

  /*
   * ONE accumulator for the whole batch, not one per iteration. It holds
   * running sums and no events, so 2500 iterations cost the same memory as one.
   */
  const totals = new BatchTotals();
  let playerId = '';
  let rotationName: string | undefined;
  let damageSoFar = 0;

  for (let index = 0; index < iterations; index++) {
    const seed = deriveSeed(options.baseSeed, index);
    seeds[index] = seed;

    // Aggregate as we go; the event stream for this iteration is discarded.
    const simulation = new Simulation({ ...config, seed }, totals);
    const run = simulation.run();

    const friendlyIds = run.actors
      .filter((actor) => actor.faction === 'friendly')
      .map((actor) => actor.id);

    const elapsedSeconds = Math.max(toSeconds(run.elapsedMs), 0.001);
    durations[index] = run.elapsedMs;
    if (!playerId) {
      playerId = friendlyIds[0] ?? '';
      rotationName = run.actors.find((actor) => actor.id === playerId)?.rotation;
    }

    /*
     * DPS FOR THIS ITERATION ALONE. `totals` now runs for the whole batch, so
     * its total is cumulative and the per-iteration figure is the difference
     * since the last one. Reading the cumulative total here was the first
     * version of this and made iteration 2500 look 2500 times as good.
     */
    const cumulative = totals.totalForAny(friendlyIds);
    dpsSamples[index] = (cumulative - damageSoFar) / elapsedSeconds;
    damageSoFar = cumulative;
    totals.finishIteration();

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
    rotationName,
    meanDamage: totals.meanDamageFor(playerId),
    meanDurationMs: durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length),
    abilities: totals.abilityBreakdown(playerId),
    damageTaken: totals.damageTaken(playerId),
    rage: totals.resourceFlow(playerId, 'rage'),
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
