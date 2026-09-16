import type { TelemetryEvent, TelemetryEventType } from './TelemetryEvent';

/**
 * Where the engine sends events. Kept as an interface so a Monte Carlo batch
 * can swap in a sink that aggregates on the fly and keeps nothing, rather than
 * retaining ten thousand full event logs in memory.
 */
export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

/** Keeps every event. The default for a single run that will be inspected. */
export class TelemetryRecorder implements TelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  emit(event: TelemetryEvent): void {
    this.events.push(event);
  }

  /** Every recorded event, in emission order. */
  get all(): readonly TelemetryEvent[] {
    return this.events;
  }

  /** Events of one type, narrowed to the matching member of the union. */
  ofType<T extends TelemetryEventType>(
    type: T,
  ): readonly Extract<TelemetryEvent, { type: T }>[] {
    return this.events.filter(
      (event): event is Extract<TelemetryEvent, { type: T }> => event.type === type,
    );
  }

  get count(): number {
    return this.events.length;
  }

  clear(): void {
    this.events.length = 0;
  }
}

/**
 * Discards everything. Used by Monte Carlo iterations whose only output is a
 * summary, where retaining events would dominate both time and memory.
 */
export class NullTelemetrySink implements TelemetrySink {
  emit(): void {
    /* intentionally empty */
  }
}

/** Sends each event to several sinks. */
export class FanOutTelemetrySink implements TelemetrySink {
  constructor(private readonly sinks: readonly TelemetrySink[]) {}

  emit(event: TelemetryEvent): void {
    for (const sink of this.sinks) {
      sink.emit(event);
    }
  }
}
