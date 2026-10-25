import type { ActorResult } from '../../analysis';
import type { TelemetryEvent } from '../../engine';

/**
 * RAID FRAMES (round 62): every raid member's health at a fixed cadence through
 * one fight, for troubleshooting a raid healer -- the owner's "a snapshot of all
 * 20 players' hit points as the fight progresses", laid out the way a raid UI
 * draws it, one column a party.
 *
 * ============================================================================
 * READ OFF THE EVENTS, the way `healthTimeline` reads one actor: every damage
 * and heal carries its target's health straight after it, a revive stands the
 * member back up at full, and everybody opens full. A frame at time T is the
 * state after every event at or before T.
 *
 * "DIED" MEANS DIED SINCE THE PREVIOUS FRAME. The healer fights revive a member
 * the instant it dies, so a death is never a STATE a snapshot could catch; the
 * frame marks it instead, which is what somebody comparing frames is looking
 * for.
 *
 * THE HEALER'S OWN AURAS ARE LISTED ON EACH MEMBER -- a Riptide, a Light's
 * Vigil -- because "who was the heal aimed at" is most of what a raid healer
 * list decides, and those are where it shows.
 * ============================================================================
 */

export interface RaidFrameMember {
  readonly id: string;
  /** "T" for the tank, the raid number for everybody else. */
  readonly label: string;
  readonly party: number;
  /** Health as a fraction of maximum, 0 to 1. */
  readonly health: number;
  /** Whether the member died since the previous frame. */
  readonly died: boolean;
  /** The healer's own auras on this member at the frame, by name. */
  readonly auras: readonly string[];
}

export interface RaidFrame {
  readonly timeMs: number;
  readonly members: readonly RaidFrameMember[];
}

/** The raid members of a fight, in party order, tank first. */
function raidOf(actors: readonly ActorResult[]): readonly ActorResult[] {
  return actors
    .map((actor, order) => ({ actor, order }))
    .filter(({ actor }) => actor.party !== undefined)
    .sort((a, b) => a.actor.party! - b.actor.party! || a.order - b.order)
    .map(({ actor }) => actor);
}

function labelOf(actor: ActorResult): string {
  if (actor.raidRole === 'tank') return 'T';
  const number = /(\d+)\s*$/.exec(actor.name);
  return number ? number[1] : actor.name;
}

export function raidFrames(
  actors: readonly ActorResult[],
  timeline: readonly TelemetryEvent[],
  durationMs: number,
  stepMs: number,
  healerId?: string,
): readonly RaidFrame[] {
  const raid = raidOf(actors);
  if (raid.length === 0 || stepMs <= 0) return [];

  const maximum = new Map(raid.map((actor) => [actor.id, actor.maxHealth]));
  const health = new Map(raid.map((actor) => [actor.id, actor.maxHealth]));
  const auras = new Map(raid.map((actor) => [actor.id, new Map<string, string>()]));
  let died = new Set<string>();

  const frames: RaidFrame[] = [];
  const snapshot = (timeMs: number) => {
    frames.push({
      timeMs,
      members: raid.map((actor) => ({
        id: actor.id,
        label: labelOf(actor),
        party: actor.party!,
        health: Math.max(0, Math.min(1, health.get(actor.id)! / Math.max(1, maximum.get(actor.id)!))),
        died: died.has(actor.id),
        auras: [...auras.get(actor.id)!.values()],
      })),
    });
    died = new Set();
  };

  let next = 0;
  for (const event of timeline) {
    while (event.timestamp > next && next <= durationMs) {
      snapshot(next);
      next += stepMs;
    }
    if ((event.type === 'damage' || event.type === 'heal') && health.has(event.targetId)) {
      if (event.targetHealth !== undefined) health.set(event.targetId, event.targetHealth);
    } else if (event.type === 'death' && health.has(event.actorId)) {
      died.add(event.actorId);
      if (event.revived) health.set(event.actorId, maximum.get(event.actorId)!);
    } else if (
      (event.type === 'aura_applied' || event.type === 'aura_refreshed') &&
      auras.has(event.targetId) &&
      healerId !== undefined &&
      event.sourceId === healerId
    ) {
      auras.get(event.targetId)!.set(event.auraId, event.auraName);
    } else if (event.type === 'aura_removed' && auras.has(event.targetId)) {
      auras.get(event.targetId)!.delete(event.auraId);
    }
  }
  while (next <= durationMs) {
    snapshot(next);
    next += stepMs;
  }
  return frames;
}
