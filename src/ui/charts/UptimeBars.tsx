import type { BatchAuraUptime } from '../../simulator';

interface UptimeBarsProps {
  readonly title: string;
  readonly rows: readonly BatchAuraUptime[];
  /** Shown instead of the bars when nothing was up. */
  readonly empty: string;
}

/**
 * Horizontal bars, always scaled 0 to 100%.
 *
 * ----------------------------------------------------------------------------
 * THE AXIS IS FIXED, AND THAT IS THE WHOLE POINT.
 *
 * A bar chart that scales to its largest value would draw a 4% uptime as a
 * full-width bar, which is exactly backwards: the question being asked is
 * "how much of the fight was this up", and the answer is only meaningful
 * against the fight. A 12% Flurry and a 97% Battle Shout have to LOOK that
 * different.
 *
 * No chart library, for the same reason the donuts have none: this is a div
 * with a width.
 * ----------------------------------------------------------------------------
 */
export function UptimeBars({ title, rows, empty }: UptimeBarsProps) {
  return (
    <>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="uptime-list">
          {rows.map((row) => (
            <li key={row.auraId} className="uptime-row">
              <span className="uptime-name">{row.auraName}</span>
              <span className="uptime-track">
                <span
                  className="uptime-fill"
                  style={{ width: `${(row.uptime * 100).toFixed(2)}%` }}
                />
              </span>
              <span className="uptime-value numeric">{(row.uptime * 100).toFixed(2)}%</span>
              {/*
                Applications sit beside the bar rather than in a second chart.
                Uptime alone cannot tell a buff that was applied once and lasted
                from one that was reapplied forty times -- and for Flurry, which
                is consumed by swings rather than expiring, the second number is
                most of the story.
              */}
              <span className="uptime-count muted">
                {row.applications.toFixed(2)} {row.applications === 1 ? 'application' : 'applications'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
