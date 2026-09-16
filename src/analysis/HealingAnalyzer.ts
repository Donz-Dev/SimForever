import { toSeconds } from '../engine';
import type { AnalysisInput, Analyzer } from './Analyzer';

export interface ActorHealing {
  readonly actorId: string;
  readonly actorName: string;
  readonly total: number;
  readonly overhealing: number;
  readonly hps: number;
}

export interface HealingSummary {
  readonly total: number;
  readonly overhealing: number;
  readonly hps: number;
  readonly byActor: readonly ActorHealing[];
}

/**
 * Healing done, per actor.
 *
 * Kept deliberately thin. No content heals yet, so this exists to prove the
 * analyzer interface generalises past damage and to give healing somewhere to
 * report to the moment it does.
 */
export class HealingAnalyzer implements Analyzer<HealingSummary> {
  readonly name = 'healing';

  analyze(input: AnalysisInput): HealingSummary {
    const nameOf = new Map(input.actors.map((actor) => [actor.id, actor.name]));
    const totals = new Map<string, { total: number; overhealing: number }>();

    for (const event of input.telemetry) {
      if (event.type !== 'heal') continue;

      let entry = totals.get(event.sourceId);
      if (!entry) {
        entry = { total: 0, overhealing: 0 };
        totals.set(event.sourceId, entry);
      }
      entry.total += event.amount;
      entry.overhealing += event.overhealing;
    }

    const elapsedSeconds = Math.max(toSeconds(input.elapsedMs), 0.001);

    const byActor: ActorHealing[] = [...totals.entries()]
      .map(([actorId, entry]) => ({
        actorId,
        actorName: nameOf.get(actorId) ?? actorId,
        total: entry.total,
        overhealing: entry.overhealing,
        hps: entry.total / elapsedSeconds,
      }))
      .sort((a, b) => b.total - a.total);

    const total = byActor.reduce((sum, actor) => sum + actor.total, 0);
    const overhealing = byActor.reduce((sum, actor) => sum + actor.overhealing, 0);

    return {
      total,
      overhealing,
      hps: total / elapsedSeconds,
      byActor,
    };
  }
}
