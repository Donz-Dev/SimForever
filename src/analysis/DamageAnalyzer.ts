import { toSeconds } from '../engine';
import type { AnalysisInput, Analyzer } from './Analyzer';

/** How one ability performed for one actor. */
export interface AbilityDamageBreakdown {
  readonly abilityName: string;
  readonly hits: number;
  readonly crits: number;
  /** Fraction of hits that crit, in [0, 1]. */
  readonly critRate: number;
  readonly total: number;
  readonly average: number;
  readonly overkill: number;
  /** Fraction of this actor's total damage, in [0, 1]. */
  readonly share: number;
}

/** One actor's damage output. */
export interface ActorDamage {
  readonly actorId: string;
  readonly actorName: string;
  readonly total: number;
  readonly dps: number;
  /** Per-ability breakdown, largest contributor first. */
  readonly abilities: readonly AbilityDamageBreakdown[];
}

export interface DamageSummary {
  readonly total: number;
  readonly dps: number;
  /** Per-actor totals, largest contributor first. */
  readonly byActor: readonly ActorDamage[];
}

/**
 * Damage done, broken down by actor and by ability.
 *
 * Only counts damage dealt *by* friendly actors, since that is what a DPS sim
 * is measuring. Damage taken is a separate question and deserves its own
 * analyzer rather than a flag on this one.
 */
export class DamageAnalyzer implements Analyzer<DamageSummary> {
  readonly name = 'damage';

  analyze(input: AnalysisInput): DamageSummary {
    const friendlyIds = new Set(
      input.actors.filter((actor) => actor.faction === 'friendly').map((actor) => actor.id),
    );
    const nameOf = new Map(input.actors.map((actor) => [actor.id, actor.name]));

    // actorId -> abilityName -> running totals
    const perActor = new Map<string, Map<string, MutableBreakdown>>();

    for (const event of input.telemetry) {
      if (event.type !== 'damage') continue;
      if (!friendlyIds.has(event.sourceId)) continue;

      let abilities = perActor.get(event.sourceId);
      if (!abilities) {
        abilities = new Map();
        perActor.set(event.sourceId, abilities);
      }

      let entry = abilities.get(event.abilityName);
      if (!entry) {
        entry = { hits: 0, crits: 0, total: 0, overkill: 0 };
        abilities.set(event.abilityName, entry);
      }

      entry.hits++;
      if (event.critical) entry.crits++;
      entry.total += event.amount;
      entry.overkill += event.overkill;
    }

    const elapsedSeconds = Math.max(toSeconds(input.elapsedMs), 0.001);

    const byActor: ActorDamage[] = [...perActor.entries()]
      .map(([actorId, abilities]) => {
        const total = [...abilities.values()].reduce((sum, entry) => sum + entry.total, 0);

        const breakdowns: AbilityDamageBreakdown[] = [...abilities.entries()]
          .map(([abilityName, entry]) => ({
            abilityName,
            hits: entry.hits,
            crits: entry.crits,
            critRate: entry.hits === 0 ? 0 : entry.crits / entry.hits,
            total: entry.total,
            average: entry.hits === 0 ? 0 : entry.total / entry.hits,
            overkill: entry.overkill,
            share: total === 0 ? 0 : entry.total / total,
          }))
          .sort((a, b) => b.total - a.total);

        return {
          actorId,
          actorName: nameOf.get(actorId) ?? actorId,
          total,
          dps: total / elapsedSeconds,
          abilities: breakdowns,
        };
      })
      .sort((a, b) => b.total - a.total);

    const total = byActor.reduce((sum, actor) => sum + actor.total, 0);

    return {
      total,
      dps: total / elapsedSeconds,
      byActor,
    };
  }
}

interface MutableBreakdown {
  hits: number;
  crits: number;
  total: number;
  overkill: number;
}
