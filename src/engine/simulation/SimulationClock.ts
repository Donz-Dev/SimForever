import type { Milliseconds } from '../time';

/**
 * Read-only view of simulation time. Almost everything in the engine wants
 * this rather than the mutable clock: abilities and auras ask "what time is
 * it?", and only the simulation loop is allowed to move time forward.
 */
export interface SimulationClock {
  now(): Milliseconds;
}

/**
 * The simulation loop's clock.
 *
 * Time never advances on its own and never moves backwards. It jumps directly
 * to the timestamp of the next event, which is the whole point of an
 * event-driven simulation: a 5-minute fight with 2,000 events costs 2,000
 * steps, not 300,000 one-millisecond ticks.
 */
export class MutableSimulationClock implements SimulationClock {
  private current: Milliseconds = 0;

  now(): Milliseconds {
    return this.current;
  }

  advanceTo(timestamp: Milliseconds): void {
    if (timestamp < this.current) {
      throw new Error(
        `Simulation clock cannot move backwards: now=${this.current}, requested=${timestamp}`,
      );
    }
    this.current = timestamp;
  }

  reset(): void {
    this.current = 0;
  }
}
