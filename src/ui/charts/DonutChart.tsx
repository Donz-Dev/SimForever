export interface DonutSlice {
  readonly label: string;
  readonly value: number;
}

interface DonutChartProps {
  readonly title: string;
  readonly slices: readonly DonutSlice[];
  /** Printed in the hole, under the total. */
  readonly unit?: string;
}

/*
 * Inline SVG, no chart library.
 *
 * The whole page has no dependency heavier than React and this is a dozen arcs;
 * pulling in a charting package to draw them would be the largest thing in the
 * bundle by some distance.
 *
 * A donut rather than a pie because the hole is where the total goes, and the
 * total is the number a reader checks the slices against.
 */

const SIZE = 168;
const RADIUS = 66;
const THICKNESS = 26;
const CENTRE = SIZE / 2;

/*
 * Distinguishable at a glance AND in order, so the biggest slice is always the
 * same colour as the first row of the legend beside it. Deliberately not a
 * gradient: adjacent slices have to be told apart, not ranked by eye.
 */
const COLOURS = [
  '#c2703d',
  '#4f8ab5',
  '#7ba05b',
  '#a8557d',
  '#c9a227',
  '#5f7d8c',
  '#9b6bbf',
  '#b5563f',
];

export function DonutChart({ title, slices, unit }: DonutChartProps) {
  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return (
      <div className="donut">
        <h4>{title}</h4>
        <p className="muted">Nothing recorded.</p>
      </div>
    );
  }

  /*
   * ONE full-circle slice cannot be drawn as an arc: the start and end points
   * coincide and the path collapses to nothing. A warrior with only auto
   * attacks generating rage is the common case, not an edge case, so it gets a
   * plain ring instead.
   */
  const single = positive.length === 1;

  let angle = -Math.PI / 2; // start at twelve o'clock
  const arcs = positive.map((slice, index) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const path = arcPath(angle, angle + sweep);
    angle += sweep;
    return { ...slice, path, colour: COLOURS[index % COLOURS.length] };
  });

  return (
    <div className="donut">
      <h4>{title}</h4>
      <div className="donut-body">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img"
          aria-label={`${title}: ${arcs.map((a) => `${a.label} ${percent(a.value / total)}`).join(', ')}`}
        >
          {single ? (
            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={RADIUS - THICKNESS / 2}
              fill="none"
              stroke={arcs[0].colour}
              strokeWidth={THICKNESS}
            />
          ) : (
            arcs.map((arc) => (
              <path
                key={arc.label}
                d={arc.path}
                fill="none"
                stroke={arc.colour}
                strokeWidth={THICKNESS}
              />
            ))
          )}
          <text x={CENTRE} y={CENTRE - 2} className="donut-total">
            {format(total)}
          </text>
          {unit ? (
            <text x={CENTRE} y={CENTRE + 14} className="donut-unit">
              {unit}
            </text>
          ) : null}
        </svg>
        <ul className="donut-legend">
          {arcs.map((arc) => (
            <li key={arc.label}>
              <span className="donut-swatch" style={{ background: arc.colour }} />
              <span className="donut-label">{arc.label}</span>
              <span className="donut-value">
                {format(arc.value)}
                <span className="muted"> · {percent(arc.value / total)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A stroked arc between two angles, on the donut's mid-radius. */
function arcPath(from: number, to: number): string {
  const r = RADIUS - THICKNESS / 2;
  const x1 = CENTRE + r * Math.cos(from);
  const y1 = CENTRE + r * Math.sin(from);
  const x2 = CENTRE + r * Math.cos(to);
  const y2 = CENTRE + r * Math.sin(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

function format(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
