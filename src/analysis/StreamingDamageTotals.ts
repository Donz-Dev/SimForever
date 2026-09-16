import type { TelemetryEvent, TelemetrySink } from '../engine';

/**
 * A telemetry sink that keeps running damage totals and discards the events.
 *
 * Used by Monte Carlo batches. Retaining the full event stream for ten thousand
 * iterations would cost gigabytes for numbers that get thrown away after being
 * summed once, so batches aggregate as they go and only one representative
 * iteration is recorded in full.
 *
 * It sums by source id rather than filtering to friendly actors, because a sink
 * sees events, not factions. The caller applies that filter afterwards.
 */
export class StreamingDamageTotals implements TelemetrySink {
  private readonly totals = new Map<string, number>();

  emit(event: TelemetryEvent): void {
    if (event.type !== 'damage') return;
    this.totals.set(event.sourceId, (this.totals.get(event.sourceId) ?? 0) + event.amount);
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
