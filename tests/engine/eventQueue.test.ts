import { describe, expect, it } from 'vitest';
import type { CombatEvent, SimulationContext } from '../../src/engine';
import { EventPriority, EventQueue } from '../../src/engine';

/** An event that appends its label to a shared array when it runs. */
function recordingEvent(
  label: string,
  log: string[],
  priority: EventPriority = EventPriority.CastComplete,
): CombatEvent {
  return {
    name: label,
    priority,
    execute: () => {
      log.push(label);
    },
  };
}

/** Drain the queue, executing everything in order. */
function drain(queue: EventQueue, context: SimulationContext = {} as SimulationContext): void {
  for (;;) {
    const scheduled = queue.pop();
    if (!scheduled) break;
    scheduled.event.execute(context);
  }
}

describe('EventQueue', () => {
  it('executes events in chronological order regardless of insertion order', () => {
    const queue = new EventQueue();
    const log: string[] = [];

    queue.schedule(5000, recordingEvent('third', log));
    queue.schedule(1000, recordingEvent('first', log));
    queue.schedule(3000, recordingEvent('second', log));

    drain(queue);

    expect(log).toEqual(['first', 'second', 'third']);
  });

  it('handles fractional and closely spaced timestamps', () => {
    const queue = new EventQueue();
    const log: string[] = [];

    queue.schedule(1501, recordingEvent('b', log));
    queue.schedule(1500, recordingEvent('a', log));
    queue.schedule(1502, recordingEvent('c', log));

    drain(queue);

    expect(log).toEqual(['a', 'b', 'c']);
  });

  describe('events at the same timestamp', () => {
    it('orders by priority, lowest number first', () => {
      const queue = new EventQueue();
      const log: string[] = [];

      // Scheduled in the opposite order to the one they must execute in, so a
      // queue that ignored priority would fail this.
      queue.schedule(1000, recordingEvent('decision', log, EventPriority.Decision));
      queue.schedule(1000, recordingEvent('auto-attack', log, EventPriority.AutoAttack));
      queue.schedule(1000, recordingEvent('expire', log, EventPriority.AuraExpiration));
      queue.schedule(1000, recordingEvent('tick', log, EventPriority.Periodic));

      drain(queue);

      expect(log).toEqual(['tick', 'expire', 'auto-attack', 'decision']);
    });

    it('runs a periodic tick before the aura expiry it shares a timestamp with', () => {
      // The reason Periodic sorts before AuraExpiration: a DoT's final tick is
      // due at the exact moment the debuff falls off, and it must still land.
      expect(EventPriority.Periodic).toBeLessThan(EventPriority.AuraExpiration);
    });

    it('falls back to insertion order for equal priority (FIFO)', () => {
      const queue = new EventQueue();
      const log: string[] = [];

      for (const label of ['a', 'b', 'c', 'd', 'e']) {
        queue.schedule(2000, recordingEvent(label, log));
      }

      drain(queue);

      expect(log).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('is deterministic across repeated identical runs', () => {
      const run = (): string[] => {
        const queue = new EventQueue();
        const log: string[] = [];
        queue.schedule(100, recordingEvent('x', log, EventPriority.AutoAttack));
        queue.schedule(100, recordingEvent('y', log, EventPriority.AutoAttack));
        queue.schedule(100, recordingEvent('z', log, EventPriority.Periodic));
        queue.schedule(50, recordingEvent('w', log, EventPriority.Decision));
        drain(queue);
        return log;
      };

      expect(run()).toEqual(run());
      expect(run()).toEqual(['w', 'z', 'x', 'y']);
    });
  });

  describe('cancellation', () => {
    it('skips cancelled events', () => {
      const queue = new EventQueue();
      const log: string[] = [];

      queue.schedule(1000, recordingEvent('keep', log));
      const doomed = queue.schedule(2000, recordingEvent('cancelled', log));
      queue.schedule(3000, recordingEvent('also-keep', log));

      queue.cancel(doomed);
      drain(queue);

      expect(log).toEqual(['keep', 'also-keep']);
    });

    it('can cancel the next event without disturbing the rest', () => {
      const queue = new EventQueue();
      const log: string[] = [];

      const first = queue.schedule(1000, recordingEvent('first', log));
      queue.schedule(2000, recordingEvent('second', log));

      queue.cancel(first);

      expect(queue.peek()?.timestamp).toBe(2000);
      drain(queue);
      expect(log).toEqual(['second']);
    });

    it('treats a repeated cancel and a null handle as no-ops', () => {
      const queue = new EventQueue();
      const log: string[] = [];
      const handle = queue.schedule(1000, recordingEvent('x', log));

      queue.cancel(handle);
      queue.cancel(handle);
      queue.cancel(null);
      queue.cancel(undefined);

      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  it('reports size excluding cancelled entries', () => {
    const queue = new EventQueue();
    const log: string[] = [];

    queue.schedule(1000, recordingEvent('a', log));
    const b = queue.schedule(2000, recordingEvent('b', log));
    queue.schedule(3000, recordingEvent('c', log));
    expect(queue.size).toBe(3);

    queue.cancel(b);
    expect(queue.size).toBe(2);

    queue.pop();
    expect(queue.size).toBe(1);
  });

  it('stays correct under many out-of-order insertions', () => {
    // A heap with a broken sift is easy to miss on three elements and obvious
    // on a few hundred.
    const queue = new EventQueue();
    const log: string[] = [];
    const timestamps = [...Array(500).keys()].map((index) => (index * 7919) % 500);

    for (const timestamp of timestamps) {
      queue.schedule(timestamp, recordingEvent(String(timestamp), log));
    }
    drain(queue);

    const executed = log.map(Number);
    expect(executed).toEqual([...executed].sort((a, b) => a - b));
    expect(executed).toHaveLength(500);
  });

  it('rejects a non-finite timestamp', () => {
    const queue = new EventQueue();
    const log: string[] = [];
    expect(() => queue.schedule(Number.NaN, recordingEvent('x', log))).toThrow();
  });
});
