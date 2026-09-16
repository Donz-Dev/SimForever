import type { ActorSnapshot, Milliseconds, TelemetryEvent } from '../engine';

/**
 * What every analyzer is given: the telemetry stream plus the small amount of
 * context needed to interpret it.
 */
export interface AnalysisInput {
  readonly telemetry: readonly TelemetryEvent[];
  readonly actors: readonly ActorSnapshot[];
  /** Fight length, used for any per-second figure. */
  readonly elapsedMs: Milliseconds;
}

/**
 * Turns a telemetry stream into one statistic.
 *
 * Every analyzer reads the same stream and nothing else. The engine keeps no
 * running totals of its own, so there is no way for "total damage" and the
 * per-ability breakdown to disagree: they are two views of the same events.
 *
 * Adding a new statistic means adding an analyzer, never touching the engine.
 */
export interface Analyzer<T> {
  readonly name: string;
  analyze(input: AnalysisInput): T;
}
