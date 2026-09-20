import { formatTimestamp } from '../time';
import type { TelemetryEvent } from './TelemetryEvent';

/** Resolves an actor id to a display name for the log. */
export type NameResolver = (id: string) => string;

/**
 * Renders telemetry as human-readable combat log lines.
 *
 * This is a pure formatter over the telemetry stream, not a second logging
 * path. The combat log and the analysis layer therefore always describe the
 * same fight: if a number looks wrong in one, it is wrong in both, and there is
 * exactly one place to look.
 */
export function formatCombatLogLine(event: TelemetryEvent, nameOf: NameResolver): string {
  const time = formatTimestamp(event.timestamp);

  switch (event.type) {
    case 'combat_start':
      /*
       * THE SEED IS DELIBERATELY NOT PRINTED. A reader comparing two builds
       * should be reading a distribution, and a seed on screen invites reading
       * one fight as the answer -- which is the habit this whole batch
       * aggregate exists to break.
       *
       * It is still on the telemetry event and on the result, so a tool can
       * reproduce a fight; it simply is not shown to a person.
       */
      return `${time}  Combat begins`;

    case 'combat_end':
      return `${time}  Combat ends (${describeEndReason(event.reason)})`;

    case 'cast': {
      const target = event.targetId ? ` at ${nameOf(event.targetId)}` : '';
      return `${time}  ${nameOf(event.sourceId)} casts ${event.abilityName}${target}`;
    }

    case 'damage': {
      // An avoided attack has no damage to report, so it reads as what
      // happened instead of "for 0".
      if (event.outcome === 'miss' || event.outcome === 'dodge' || event.outcome === 'parry') {
        return (
          `${time}  ${nameOf(event.sourceId)} ${event.abilityName} ` +
          `${describeAvoidance(event.outcome)} ${nameOf(event.targetId)}`
        );
      }

      const verb = event.periodic ? 'ticks on' : describeHitVerb(event.outcome);
      const qualifier = describeOutcome(event.outcome);
      const extra = describeDamageExtras(event.mitigated, event.absorbed, event.overkill);
      return (
        `${time}  ${nameOf(event.sourceId)} ${event.abilityName} ${verb} ` +
        `${nameOf(event.targetId)} for ${formatAmount(event.amount)}${qualifier}${extra}`
      );
    }

    case 'heal': {
      const crit = event.critical ? ' (critical)' : '';
      const overheal =
        event.overhealing > 0 ? ` (${formatAmount(event.overhealing)} overhealing)` : '';
      return (
        `${time}  ${nameOf(event.sourceId)} ${event.abilityName} heals ` +
        `${nameOf(event.targetId)} for ${formatAmount(event.amount)}${crit}${overheal}`
      );
    }

    case 'aura_applied': {
      const stacks = event.stacks > 1 ? ` (${event.stacks})` : '';
      return event.isDebuff
        ? `${time}  ${nameOf(event.targetId)} is afflicted by ${event.auraName}${stacks}`
        : `${time}  ${nameOf(event.targetId)} gains ${event.auraName}${stacks}`;
    }

    case 'aura_refreshed':
      return `${time}  ${nameOf(event.targetId)} refreshes ${event.auraName}`;

    case 'aura_stacks_changed':
      return `${time}  ${nameOf(event.targetId)} ${event.auraName} is now at ${event.stacks} stacks`;

    case 'aura_removed':
      return `${time}  ${event.auraName} fades from ${nameOf(event.targetId)}`;

    case 'resource_gained': {
      const wasted = event.wasted > 0 ? ` (${formatAmount(event.wasted)} wasted)` : '';
      return (
        `${time}  ${nameOf(event.actorId)} gains ${formatAmount(event.amount)} ` +
        `${event.resource}${wasted}`
      );
    }

    case 'resource_spent':
      return (
        `${time}  ${nameOf(event.actorId)} spends ${formatAmount(event.amount)} ${event.resource}`
      );

    case 'death': {
      const killer = event.killerId ? ` (killed by ${nameOf(event.killerId)})` : '';
      return `${time}  ${nameOf(event.actorId)} dies${killer}`;
    }
  }
}

/** Render a whole telemetry stream as combat log lines. */
export function formatCombatLog(
  events: readonly TelemetryEvent[],
  nameOf: NameResolver,
): string[] {
  return events.map((event) => formatCombatLogLine(event, nameOf));
}

/**
 * Event types that are usually noise in a human-readable log. Resource events
 * in particular can outnumber everything else several times over.
 */
const VERBOSE_EVENT_TYPES = new Set<TelemetryEvent['type']>([
  'resource_gained',
  'resource_spent',
]);

/** Combat log lines with the high-volume bookkeeping events left out. */
export function formatConciseCombatLog(
  events: readonly TelemetryEvent[],
  nameOf: NameResolver,
): string[] {
  return events
    .filter((event) => !VERBOSE_EVENT_TYPES.has(event.type))
    .map((event) => formatCombatLogLine(event, nameOf));
}

/** How an avoided attack reads: "misses", "is dodged by", "is parried by". */
function describeAvoidance(outcome: string): string {
  switch (outcome) {
    case 'miss':
      return 'misses';
    case 'dodge':
      return 'is dodged by';
    case 'parry':
      return 'is parried by';
    default:
      return 'fails against';
  }
}

function describeHitVerb(outcome: string): string {
  return outcome === 'glance' ? 'glances' : 'hits';
}

function describeOutcome(outcome: string): string {
  switch (outcome) {
    case 'crit':
      return ' (critical)';
    case 'crush':
      return ' (crushing)';
    /*
     * A block LANDS, so it reads as a hit with a qualifier rather than as an
     * avoidance. Without this a blocked blow was indistinguishable from an
     * ordinary one in the log, and 44% of a shield warrior's incoming attacks
     * looked like plain hits.
     */
    case 'block':
      return ' (blocked)';
    // No qualifier for a glance: the verb is already "glances".
    default:
      return '';
  }
}

function describeEndReason(reason: string): string {
  switch (reason) {
    case 'duration_expired':
      return 'time limit reached';
    case 'all_enemies_dead':
      return 'all enemies defeated';
    case 'all_players_dead':
      return 'raid wiped';
    default:
      return reason;
  }
}

function describeDamageExtras(mitigated: number, absorbed: number, overkill: number): string {
  const parts: string[] = [];
  if (mitigated > 0) parts.push(`${formatAmount(mitigated)} mitigated`);
  if (absorbed > 0) parts.push(`${formatAmount(absorbed)} absorbed`);
  if (overkill > 0) parts.push(`${formatAmount(overkill)} overkill`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
