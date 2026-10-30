import type { Milliseconds } from '../time';

/**
 * ONE STRETCH OF A FIGHT THAT IS NOT ONE FIGHT -- a dungeon route's pull, or
 * the walk between two of them.
 *
 * ============================================================================
 * A ROUTE IS A SINGLE SIMULATION WITH SEGMENTS, NOT A CHAIN OF SIMULATIONS,
 * because what carries across a gap is the whole point of asking: a cooldown
 * spent on one pull is still cooling on the next, mana drunk back in a gap is
 * mana the next pull starts with, and a buff cast at the first pull is still up
 * at the third. Separate fights would reset every one of those.
 *
 * IN COMBAT IS "SOME ENEMY IS PRESENT", and that is the only thing that decides
 * it. Every hostile combatant the route will ever need exists from time zero --
 * the engine cannot add a combatant mid-fight -- and a segment names which of
 * them are PRESENT. An absent enemy is not dead: it is simply not there, so
 * nothing targets it, nothing it carries ticks against it, and it swings at
 * nobody. An empty list is out of combat.
 *
 * WHAT CHANGES OUT OF COMBAT IS DECIDED HERE AND ONLY HERE, and it is
 * deliberately little: no actor's rotation decides, no auto-attack lands
 * because there is nothing to land on, and a cast in progress when the last
 * enemy goes is abandoned. Everything that runs on its own clock carries on --
 * cooldowns, regeneration, auras falling off -- which is exactly what
 * "the character is still cooling down" means. Anything ruleset-specific about
 * the gap (drinking, rage decaying) belongs to `SimulationConfig.onSegmentStart`.
 * ============================================================================
 */
export interface CombatSegment {
  readonly startMs: Milliseconds;
  readonly endMs: Milliseconds;
  /** The hostile combatants present for this segment. Empty means out of combat. */
  readonly enemyIds: readonly string[];
}

/** Whether a segment is a pull. */
export function isInCombat(segment: CombatSegment): boolean {
  return segment.enemyIds.length > 0;
}

/**
 * Throws unless the segments tile the fight from zero with no gap or overlap,
 * every one has a length, and every enemy id names a hostile combatant.
 */
export function validateSegments(
  segments: readonly CombatSegment[],
  hostileIds: ReadonlySet<string>,
): void {
  if (segments.length === 0) throw new Error('A segmented fight needs at least one segment.');
  let at = 0;
  for (const [index, segment] of segments.entries()) {
    if (segment.startMs !== at) {
      throw new Error(`Segment ${index} starts at ${segment.startMs}ms; expected ${at}ms.`);
    }
    if (segment.endMs <= segment.startMs) {
      throw new Error(`Segment ${index} has no length.`);
    }
    for (const id of segment.enemyIds) {
      if (!hostileIds.has(id)) throw new Error(`Segment ${index} names unknown enemy "${id}".`);
    }
    at = segment.endMs;
  }
}

/** Total in-combat time up to `elapsedMs`. */
export function inCombatMsWithin(
  segments: readonly CombatSegment[],
  elapsedMs: Milliseconds,
): Milliseconds {
  let total = 0;
  for (const segment of segments) {
    if (!isInCombat(segment)) continue;
    total += Math.max(0, Math.min(segment.endMs, elapsedMs) - segment.startMs);
  }
  return total;
}
