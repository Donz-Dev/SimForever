import type { TelemetryEvent } from '../../engine';

export interface TimelinePoint {
  readonly timeMs: number;
  readonly value: number;
}

interface ResourceTimelineProps {
  readonly title: string;
  readonly points: readonly TimelinePoint[];
  readonly maximum: number;
  readonly durationMs: number;
}

/*
 * ============================================================================
 * HOW MUCH OF A POOL WAS AVAILABLE, ACROSS ONE FIGHT.
 *
 * Inline SVG and no chart library, for the same reason `DonutChart` is: the
 * whole page depends on nothing heavier than React, and this is one path.
 *
 * ----------------------------------------------------------------------------
 * IT READS ONE ITERATION AND SAYS SO. Every other number on the results page
 * is pooled across the batch, because reading a breakdown off a single fight
 * once made a 2,500-iteration batch report forty swings. A TIMELINE cannot be
 * pooled -- averaging "rage at t=12s" across iterations of different lengths
 * that cast different abilities produces a smooth curve belonging to no fight
 * anybody ran. So this is the REPRESENTATIVE iteration, the same one the
 * combat log shows, and the heading says which.
 *
 * WHAT IT IS FOR is the shape rather than the value: a rogue flat at zero
 * energy is starved, a warrior flat at 100 rage is capping and wasting income,
 * and a caster whose mana falls and never recovers has hit the five second
 * rule harder than it can regenerate. None of those is visible in a total.
 * ----------------------------------------------------------------------------
 */
export function ResourceTimeline({ title, points, maximum, durationMs }: ResourceTimelineProps) {
  if (points.length === 0 || durationMs <= 0 || maximum <= 0) return null;

  const width = 520;
  const height = 120;
  const padding = { left: 34, right: 8, top: 8, bottom: 18 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const x = (timeMs: number) => padding.left + (timeMs / durationMs) * plotWidth;
  const y = (value: number) => padding.top + plotHeight - (value / maximum) * plotHeight;

  /*
   * A STEP LINE, NOT A SLOPE. A resource does not drift between events: it
   * sits where it is until something spends or grants it. Joining the points
   * diagonally would draw a Rogue smoothly gliding to zero over the two
   * seconds it actually spent full and then paid all at once.
   *
   * Smooth regeneration makes the steps small rather than making the shape
   * wrong -- twenty ticks a second is finer than this is wide in pixels.
   */
  const path = points
    .map((point, index) => {
      const px = x(point.timeMs).toFixed(1);
      const py = y(point.value).toFixed(1);
      if (index === 0) return `M ${px} ${py}`;
      const previous = points[index - 1];
      return `L ${px} ${y(previous.value).toFixed(1)} L ${px} ${py}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  const endPath = `${path} L ${x(durationMs).toFixed(1)} ${y(last.value).toFixed(1)}`;

  const seconds = Math.round(durationMs / 1000);

  return (
    <figure className="timeline">
      <figcaption>{title}</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${points.length} changes over ${seconds} seconds`}
        preserveAspectRatio="none"
      >
        {/* The cap and the floor, so a flat line at either is readable as one. */}
        <line
          x1={padding.left}
          y1={y(maximum)}
          x2={width - padding.right}
          y2={y(maximum)}
          className="timeline-limit"
        />
        <line
          x1={padding.left}
          y1={y(0)}
          x2={width - padding.right}
          y2={y(0)}
          className="timeline-axis"
        />
        <path d={endPath} className="timeline-line" fill="none" />
        <text x={2} y={y(maximum) + 4} className="timeline-label">
          {Math.round(maximum)}
        </text>
        <text x={2} y={y(0) + 4} className="timeline-label">
          0
        </text>
        <text x={padding.left} y={height - 4} className="timeline-label">
          0s
        </text>
        <text x={width - padding.right} y={height - 4} className="timeline-label timeline-end">
          {seconds}s
        </text>
      </svg>
    </figure>
  );
}

/**
 * Rebuild one pool's level over a fight from the event stream.
 *
 * EVERY RESOURCE EVENT ALREADY CARRIES `current`, which is the pool's value
 * immediately after the change -- so this reads the level that actually
 * happened rather than re-deriving it by adding gains and subtracting costs.
 * Re-deriving would drift the moment anything moved a pool without emitting an
 * event, and would hide exactly that bug.
 */
export function resourceTimeline(
  timeline: readonly TelemetryEvent[],
  actorId: string,
  resource: string,
): readonly TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (const event of timeline) {
    if (event.type !== 'resource_gained' && event.type !== 'resource_spent') continue;
    if (event.actorId !== actorId || event.resource !== resource) continue;
    points.push({ timeMs: event.timestamp, value: event.current });
  }
  return points;
}
