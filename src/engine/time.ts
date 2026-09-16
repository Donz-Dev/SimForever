/**
 * Time in SimForever.
 *
 * THE RULE: every timestamp and duration inside the engine is an integer
 * number of **milliseconds**. There are no seconds anywhere below the UI
 * layer. Seconds only appear when formatting output for a human.
 *
 * This single convention removes an entire category of bug (mixing 1.5 the
 * second with 1500 the millisecond) and lets the event queue compare times
 * with exact integer arithmetic instead of floating point.
 */

/** An absolute point in simulation time, in milliseconds since combat start. */
export type Milliseconds = number;

/** Convert seconds to engine time. Use this at the boundary, never inside. */
export function seconds(value: number): Milliseconds {
  return Math.round(value * 1000);
}

/** Convert engine time back to seconds. Use this for display and analysis. */
export function toSeconds(ms: Milliseconds): number {
  return ms / 1000;
}

/** Format engine time as `MM:SS.mmm`, the combat-log timestamp format. */
export function formatTimestamp(ms: Milliseconds): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}
