import type { SimulationContext } from '../simulation/SimulationContext';
import type { EventPriority } from './EventPriority';

/**
 * Something that happens at a specific moment in combat.
 *
 * An event owns what it does, not when it happens: the timestamp lives on the
 * queue handle instead. The same event object can therefore be rescheduled
 * without two copies of "when" drifting apart.
 */
export interface CombatEvent {
  /** Short label used in debugging and queue inspection. */
  readonly name: string;
  /** Tie-breaker when several events share a timestamp. */
  readonly priority: EventPriority;
  /** Do the thing. May schedule further events through the context. */
  execute(context: SimulationContext): void;
}

/** Convenience wrapper so simple one-off events do not each need a class. */
export function createEvent(
  name: string,
  priority: EventPriority,
  execute: (context: SimulationContext) => void,
): CombatEvent {
  return { name, priority, execute };
}
