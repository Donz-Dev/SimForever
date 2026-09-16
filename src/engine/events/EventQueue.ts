import type { Milliseconds } from '../time';
import type { CombatEvent } from './CombatEvent';

/**
 * A handle to an event that has been placed on the queue.
 *
 * Callers keep this so they can cancel later: a DoT's next tick when the
 * debuff is removed, a swing timer when the actor dies.
 */
export interface ScheduledEvent {
  readonly id: number;
  readonly timestamp: Milliseconds;
  readonly event: CombatEvent;
  /** True once `EventQueue.cancel` has been called on this handle. */
  readonly cancelled: boolean;
}

interface QueueEntry {
  id: number;
  timestamp: Milliseconds;
  event: CombatEvent;
  cancelled: boolean;
  /** Monotonic insertion counter; the final, always-unique tie-breaker. */
  sequence: number;
}

/**
 * A priority queue of pending combat events, ordered by:
 *
 *   1. timestamp - earlier first
 *   2. priority  - lower number first (see EventPriority)
 *   3. sequence  - insertion order, so equal events stay FIFO
 *
 * Because rule 3 always breaks a tie and comes from a counter rather than
 * anything random, the ordering is fully deterministic: the same events
 * scheduled in the same order always execute in the same order. That, plus the
 * seeded RNG, is what makes a run reproducible.
 *
 * Implemented as a binary min-heap, so push and pop are O(log n) and long
 * fights stay cheap. Cancellation is lazy: the entry is flagged and skipped
 * once it reaches the front, because removing from the middle of a heap costs
 * more than it saves.
 */
export class EventQueue {
  private heap: QueueEntry[] = [];
  private nextId = 1;
  private nextSequence = 0;
  /** Number of live (non-cancelled) entries, so `size` stays meaningful. */
  private liveCount = 0;

  /** Pending, non-cancelled events. */
  get size(): number {
    return this.liveCount;
  }

  isEmpty(): boolean {
    return this.liveCount === 0;
  }

  /** Place an event at an absolute timestamp. */
  schedule(timestamp: Milliseconds, event: CombatEvent): ScheduledEvent {
    if (!Number.isFinite(timestamp)) {
      throw new RangeError(`Cannot schedule "${event.name}" at ${timestamp}`);
    }
    const entry: QueueEntry = {
      id: this.nextId++,
      timestamp: Math.round(timestamp),
      event,
      cancelled: false,
      sequence: this.nextSequence++,
    };
    this.heap.push(entry);
    this.liveCount++;
    this.siftUp(this.heap.length - 1);
    return entry;
  }

  /**
   * Mark an event as cancelled. Safe to call on an already-cancelled or
   * already-executed handle; both are no-ops.
   */
  cancel(handle: ScheduledEvent | undefined | null): void {
    if (!handle) return;
    const entry = handle as QueueEntry;
    if (entry.cancelled) return;
    entry.cancelled = true;
    this.liveCount--;
  }

  /** The next event to execute, without removing it. */
  peek(): ScheduledEvent | undefined {
    this.discardCancelledAtFront();
    return this.heap[0];
  }

  /** Remove and return the next event, or undefined if none remain. */
  pop(): ScheduledEvent | undefined {
    this.discardCancelledAtFront();
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    this.removeRoot();
    this.liveCount--;
    return top;
  }

  clear(): void {
    this.heap = [];
    this.liveCount = 0;
  }

  /** Every pending event in execution order. For tests and debugging only. */
  toSortedArray(): ScheduledEvent[] {
    return this.heap
      .filter((entry) => !entry.cancelled)
      .slice()
      .sort(compareEntries);
  }

  private discardCancelledAtFront(): void {
    while (this.heap.length > 0 && this.heap[0].cancelled) {
      this.removeRoot();
    }
  }

  private removeRoot(): void {
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.siftDown(0);
    }
  }

  private siftUp(index: number): void {
    let child = index;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (compareEntries(this.heap[child], this.heap[parent]) >= 0) break;
      this.swap(child, parent);
      child = parent;
    }
  }

  private siftDown(index: number): void {
    const length = this.heap.length;
    let parent = index;
    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < length && compareEntries(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && compareEntries(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === parent) break;
      this.swap(parent, smallest);
      parent = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const temp = this.heap[a];
    this.heap[a] = this.heap[b];
    this.heap[b] = temp;
  }
}

function compareEntries(a: QueueEntry, b: QueueEntry): number {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  if (a.event.priority !== b.event.priority) return a.event.priority - b.event.priority;
  return a.sequence - b.sequence;
}
