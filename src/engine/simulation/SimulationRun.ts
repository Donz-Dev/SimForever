import type { CombatantKind, Faction } from '../actors/Combatant';
import type { CombatEndReason, TelemetryEvent } from '../logging';
import type { Milliseconds } from '../time';

/** What one combatant looked like when the fight ended. */
export interface ActorSnapshot {
  readonly id: string;
  readonly name: string;
  readonly kind: CombatantKind;
  readonly faction: Faction;
  readonly maxHealth: number;
  readonly finalHealth: number;
  readonly isAlive: boolean;
  /**
   * The name of the priority list this actor ran, if it had one.
   *
   * Recorded because which list ran is NOT derivable from the character: a
   * Warrior's depends on combat style and stance together, so two builds that
   * look identical in every visible field can run different rotations.
   */
  readonly rotation?: string;
}

/**
 * The raw output of one simulation: what happened, with nothing interpreted.
 *
 * Deliberately not a `SimulationResult`. The engine's job ends at producing a
 * correct event stream; turning that into DPS numbers and breakdowns is the
 * analysis layer's job, so the engine has no dependency on it. `src/simulator`
 * composes the two into the result the UI consumes.
 */
export interface SimulationRun {
  readonly seed: number;
  /** The fight length this run was set up with, after duration variance. */
  readonly plannedDurationMs: Milliseconds;
  /** When combat actually ended. May be earlier if everything died. */
  readonly elapsedMs: Milliseconds;
  readonly endReason: CombatEndReason;
  readonly actors: readonly ActorSnapshot[];
  readonly telemetry: readonly TelemetryEvent[];
  /** Events the loop processed. Useful for spotting a runaway rotation. */
  readonly eventsProcessed: number;
}
