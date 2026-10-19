import type { CharacterProfile } from '../profiles';
import type { BatchResult } from '../simulator';

/*
 * ==============================================================================
 * SIM HISTORY (round 48): the last ten runs, each with what it takes to put the
 * run back on screen exactly -- the profile AS IT RAN, seed included, and the
 * result it produced.
 *
 * THE SEED IS WHY THE PROFILE IS STORED RATHER THAN RE-READ. Every run draws a
 * fresh seed (`useSimulation`), so the profile on screen reproduces none of
 * them. With the seed, re-running the stored profile gives the same fights;
 * restoring also shows the stored result, so the number on the list is the
 * number that comes back without waiting for a re-run.
 *
 * IN MEMORY ONLY. Nothing in this app writes to `localStorage` yet, and a
 * history that survives a reload is a separate decision -- ten full results
 * carry ten combat logs.
 * ==============================================================================
 */

export const SIM_HISTORY_LIMIT = 10;

export interface SimHistoryEntry {
  /** Unique within a session; the list's key. */
  readonly id: number;
  /** Wall-clock time the run finished, for the label. */
  readonly finishedAt: number;
  /** The preset pill the run came from, if any, so restoring re-lights it. */
  readonly presetId?: string;
  /** The profile exactly as it ran, seed included. */
  readonly profile: CharacterProfile;
  readonly batch: BatchResult;
}

/** The newest first, at most `SIM_HISTORY_LIMIT` long. */
export function withRun(
  history: readonly SimHistoryEntry[],
  entry: SimHistoryEntry,
): readonly SimHistoryEntry[] {
  return [entry, ...history].slice(0, SIM_HISTORY_LIMIT);
}
