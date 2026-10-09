/**
 * The facade the rest of the application uses.
 *
 * The engine produces events and the analysis layer interprets them; neither
 * knows about the other. This module is the only place the two are wired
 * together, which is why the UI imports from here and never from `src/engine`
 * directly.
 *
 * It is also the seam where the implementation can change without anything
 * above noticing: running iterations in Web Workers, or posting them to a
 * server, replaces the inside of these functions and nothing else.
 */
export type { BatchOptions, BatchResult } from './runBatch';
export type { BatchAuraUptime, BatchStatAverages } from '../analysis';
export { runBatch, runProfileBatch, resourceFlowOf } from './runBatch';
export { runProfile, runSimulation } from './runSimulation';
export { FIGHT_DURATION_VARIANCE } from './trainingDummyEncounter';
export { characterAtCombatStart } from './characterAtCombatStart';

/*
 * STAT WEIGHTS. The arithmetic is one baseline run against one run per stat,
 * and the reason it is a module rather than a loop is in `statWeights.ts`:
 * shared seeds, a per-variant interval, and a capped stat measured as a ladder.
 *
 * `sampleIterations` is exported alongside it because the UI's worker pool is a
 * second driver over the same pieces -- it slices the iterations across cores
 * and then calls `allocate`, `pairedDelta` and `weightsFrom` here, so there is
 * one implementation of the statistics and not one per thread.
 */
export type { IterationSamples, SampleSlice } from './iterationSamples';
export { profileSamples, sampleIterations } from './iterationSamples';
export type {
  HeadroomReport,
  HeadroomSlice,
  PairedDelta,
  SkippedStat,
  StatTier,
  StatWeight,
  StatWeightOptions,
  StatWeightPlan,
  StatWeightRun,
  StatWeightVariant,
  TieredStat,
  WeightableStat,
  WeightVerdict,
} from './statWeights';
export {
  WEIGHTABLE_STATS,
  WEIGHTABLE_STATS_BY_ID,
  pairedDelta,
  runStatWeights,
  statWeightPlan,
  survivalWeightsFrom,
  weightsFrom,
  withStat,
} from './statWeights';
