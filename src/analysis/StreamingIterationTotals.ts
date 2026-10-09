import type { TelemetryEvent, TelemetrySink } from '../engine';

/**
 * A telemetry sink that keeps the two per-iteration totals a stat-weight run
 * needs, and discards the events.
 *
 * ------------------------------------------------------------------------------
 * TWO NUMBERS PER ACTOR: damage dealt, and times died. Retaining the full event
 * stream for tens of thousands of iterations would cost gigabytes for figures
 * that get summed once and thrown away, so this aggregates as it goes.
 *
 * DEATHS JOINED DAMAGE WHEN TANK WEIGHTS DID. A defensive stat weight optimises
 * for the fewest DEATHS rather than the most damage, and the two are read off
 * the SAME fights -- so a run that was already measuring DPS gets the survival
 * answer for nothing. Counting them in two passes would double every
 * tank-weight run for no new information.
 *
 * It keys by actor id rather than filtering to a faction, because a sink sees
 * events and not factions. The caller applies that filter afterwards.
 * ------------------------------------------------------------------------------
 */
export class StreamingIterationTotals implements TelemetrySink {
  private readonly totals = new Map<string, number>();
  private readonly deaths = new Map<string, number>();

  emit(event: TelemetryEvent): void {
    if (event.type === 'death') {
      this.deaths.set(event.actorId, (this.deaths.get(event.actorId) ?? 0) + 1);
      return;
    }
    if (event.type !== 'damage') return;
    this.totals.set(event.sourceId, (this.totals.get(event.sourceId) ?? 0) + event.amount);
  }

  /**
   * How many times an actor died.
   *
   * A COUNT AND NOT A FLAG, because a character in this encounter dies several
   * times a fight: an assumed healer keeps them up, the boss's damage ramps
   * ten percent a swing, and a revive puts them back at full without resetting
   * that ramp. Eight to eleven deaths a fight is the normal range for a tank
   * profile, which is what makes the number worth weighting at all.
   */
  deathsFor(actorId: string): number {
    return this.deaths.get(actorId) ?? 0;
  }

  totalFor(sourceId: string): number {
    return this.totals.get(sourceId) ?? 0;
  }

  /** Total damage dealt by any of the given actors. */
  totalForAny(sourceIds: Iterable<string>): number {
    let sum = 0;
    for (const id of sourceIds) {
      sum += this.totals.get(id) ?? 0;
    }
    return sum;
  }
}
