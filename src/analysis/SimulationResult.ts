import type {
  ActorSnapshot,
  CombatEndReason,
  Milliseconds,
  SimulationRun,
  TelemetryEvent,
} from '../engine';
import { formatConciseCombatLog } from '../engine';
import type { AnalysisInput } from './Analyzer';
import type { DamageSummary } from './DamageAnalyzer';
import { DamageAnalyzer } from './DamageAnalyzer';
import type { HealingSummary } from './HealingAnalyzer';
import { HealingAnalyzer } from './HealingAnalyzer';

/** Per-actor outcome, combining engine state with analysed output. */
export interface ActorResult {
  readonly id: string;
  readonly name: string;
  readonly kind: ActorSnapshot['kind'];
  readonly faction: ActorSnapshot['faction'];
  readonly maxHealth: number;
  readonly finalHealth: number;
  readonly isAlive: boolean;
  readonly damageDone: number;
  readonly dps: number;
  readonly healingDone: number;
}

/**
 * The finished, self-contained description of one simulation.
 *
 * This is what the UI renders. It never reaches into a Simulation object or
 * touches live combat state, which is what allows the engine to move into a
 * Web Worker or onto a server later: only this structure has to cross the
 * boundary, and it is plain JSON-serialisable data.
 */
export interface SimulationResult {
  readonly seed: number;
  readonly durationMs: Milliseconds;
  readonly endReason: CombatEndReason;
  readonly damage: DamageSummary;
  readonly healing: HealingSummary;
  readonly actors: readonly ActorResult[];
  /** Every telemetry event, in order. The source for any further analysis. */
  readonly timeline: readonly TelemetryEvent[];
  /** Human-readable combat log, derived from the same timeline. */
  readonly combatLog: readonly string[];
  readonly eventsProcessed: number;
}

/**
 * Turn a raw engine run into an analysed result.
 *
 * This is the seam between the engine and the analysis layer: the engine
 * produces events and knows nothing about DPS; this function owns every
 * derived number.
 */
export function buildSimulationResult(run: SimulationRun): SimulationResult {
  const input: AnalysisInput = {
    telemetry: run.telemetry,
    actors: run.actors,
    elapsedMs: run.elapsedMs,
  };

  const damage = new DamageAnalyzer().analyze(input);
  const healing = new HealingAnalyzer().analyze(input);

  const damageByActor = new Map(damage.byActor.map((actor) => [actor.actorId, actor]));
  const healingByActor = new Map(healing.byActor.map((actor) => [actor.actorId, actor]));

  const actors: ActorResult[] = run.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    kind: actor.kind,
    faction: actor.faction,
    maxHealth: actor.maxHealth,
    finalHealth: actor.finalHealth,
    isAlive: actor.isAlive,
    damageDone: damageByActor.get(actor.id)?.total ?? 0,
    dps: damageByActor.get(actor.id)?.dps ?? 0,
    healingDone: healingByActor.get(actor.id)?.total ?? 0,
  }));

  const nameOf = new Map(run.actors.map((actor) => [actor.id, actor.name]));

  return {
    seed: run.seed,
    durationMs: run.elapsedMs,
    endReason: run.endReason,
    damage,
    healing,
    actors,
    timeline: run.telemetry,
    combatLog: formatConciseCombatLog(run.telemetry, (id) => nameOf.get(id) ?? id),
    eventsProcessed: run.eventsProcessed,
  };
}
