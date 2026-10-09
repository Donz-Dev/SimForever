import type { HeadroomReport, StatWeight, StatWeightPlan } from '../../simulator';
import { Panel } from '../components/Panel';

interface StatWeightsPanelProps {
  readonly plan: StatWeightPlan;
  readonly weights: readonly StatWeight[];
  /** The run every weight was differenced against. */
  readonly baselineDps: number;
  /** The count the baseline and every variant alike ran. */
  readonly iterations: number;
  readonly fights: number;
  readonly workers: number;
}

/**
 * What a point of each stat was worth.
 *
 * ==============================================================================
 * ONE SUMMARY LIST: stat, what a point is worth, and what that is relative to
 * the best. Everything else a run knows -- the DPS delta, the amount added, the
 * iteration count -- either belongs in the row's NAME or is now the same on
 * every row, so a column for it would be a column of one repeated fact.
 *
 * THE AMOUNT ADDED IS IN THE NAME FOR A CAPPED STAT, and it has to be: "+9.00%
 * more to cap off-hand swings" is the figure somebody asked for, where a column
 * headed "Added" showing 9% reads as nine points of hit added on top of an 8%
 * cap. Same number, opposite meaning.
 *
 * EVERY ROW RAN THE SAME ITERATIONS, on the ruleset owner's instruction. What
 * still differs row to row is the INTERVAL, because precision is a property of
 * the stat: one that cannot change a roll is settled in a few hundred fights
 * and hit is not settled in thousands, since a single flipped miss reorders the
 * whole random stream. So the interval stays beside each weight -- it is the
 * only thing that says which rows to act on.
 *
 * A ZERO IS A REAL ANSWER HERE, which it usually is not. Spell power on a
 * Warrior comes out at exactly 0.0000 -- shared seeds make the variant run
 * bit-identical fights -- and this project's own rule is that two figures
 * agreeing to the decimal mean the same thing was measured twice. What makes
 * this one trustworthy is that the planner BUILT the character with the stat
 * added and checked it arrived before spending a single fight, so a stat that
 * failed to apply is in the skipped list and never reaches this table.
 * ==============================================================================
 */
export function StatWeightsPanel({
  plan,
  weights,
  baselineDps,
  iterations,
  fights,
  workers,
}: StatWeightsPanelProps) {
  const ranked = [...weights].sort((a, b) => b.perUnit - a.perUnit);
  /*
   * RELATIVE TO THE LARGEST MEASURED WEIGHT, which is how a weight list is
   * actually read: the absolute DPS depends on the step and on the build, and
   * what decides between two items is the ratio.
   *
   * MEASURED ONES ONLY. A row whose interval swallows its value shows no bar,
   * so letting one set the scale would shrink every real bar against a number
   * the run could not stand behind. `EPSILON` guards a selection where nothing
   * was measured at all.
   */
  const top = Math.max(
    ...ranked.filter((row) => row.verdict === 'measured').map((row) => Math.abs(row.perUnit)),
    Number.EPSILON,
  );

  return (
    <Panel
      title="Stat weights"
      collapsible
      // Open, because it is the thing the run was for. See `startOpen`.
      startOpen
      subtitle={[
        `Baseline ${baselineDps.toFixed(1)} DPS`,
        `${iterations.toLocaleString()} iterations each`,
        `${fights.toLocaleString()} fights`,
        `${workers} ${workers === 1 ? 'worker' : 'workers'}`,
      ].join(' · ')}
    >
      {ranked.length === 0 ? (
        <p className="muted">Nothing was measured. Every stat selected is in the list below.</p>
      ) : (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Stat</th>
              <th className="numeric">Per point</th>
              <th className="numeric">Relative</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className="numeric">
                  <strong>{row.perUnit.toFixed(4)}</strong>
                  {/* An exact zero needs no interval beside it: the two runs
                      were the same fights, so there is no spread to report. */}
                  {row.verdict === 'none' ? null : (
                    <span className="muted"> ± {row.interval.toFixed(4)}</span>
                  )}
                </td>
                <td className="numeric">
                  {/*
                    THE THREE VERDICTS READ DIFFERENTLY ON PURPOSE. "Nothing"
                    is a confident answer -- the variant ran bit-identical
                    fights and the planner already checked the stat reached the
                    character -- and "not measured" is the absence of one.
                    Printing both as a bar at zero would hide which is which.
                  */}
                  {row.verdict === 'none' ? (
                    <span
                      className="muted"
                      title="The variant ran identical fights, so this build cannot read the stat at all."
                    >
                      nothing
                    </span>
                  ) : row.verdict === 'inconclusive' ? (
                    <span
                      className="muted"
                      title="The interval is wider than the value. Raise the iteration count."
                    >
                      not measured
                    </span>
                  ) : (
                    <div className="share">
                      <div
                        className="share-bar"
                        style={{ width: `${Math.max(0, Math.min(100, (row.perUnit / top) * 100))}%` }}
                      />
                      <span className="share-text">{(row.perUnit / top).toFixed(3)}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {plan.headroom.map((report) => (
        <HeadroomSection key={report.statId} report={report} />
      ))}

      {plan.skipped.length > 0 ? (
        <>
          <h3>Not measured</h3>
          <table className="breakdown">
            <tbody>
              {plan.skipped.map((entry) => (
                <tr key={entry.statId}>
                  <td>{entry.name}</td>
                  <td className="muted">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * Where a capped stat stands, slice by slice.
 *
 * ------------------------------------------------------------------------------
 * THIS IS THE PRE-CALCULATION the feature was asked for, and it is shown rather
 * than summarised because a summary is the thing that cannot be checked. "Nine
 * more points caps the off hand" is a claim about this character against this
 * target, and the only way to agree with it is to see the slices it was read
 * off.
 *
 * SLICES THAT AGREE ARE ONE ROW. Enemy dodge is the same 6.50% on every melee
 * table a build rolls on, so it prints once as "Dodge" rather than three times
 * with a table name in front of it -- `fold` in `statHeadroom.ts` does that,
 * and splits them again the moment they disagree. Hit genuinely differs per
 * table, so hit genuinely gets several rows.
 * ------------------------------------------------------------------------------
 */
function HeadroomSection({ report }: { readonly report: HeadroomReport }) {
  return (
    <>
      <h3>{report.name}</h3>
      {report.slices.length === 0 ? (
        <p className="muted">
          This build rolls on no table the stat can reach, so there is nothing to cap.
        </p>
      ) : (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Slice</th>
              <th className="numeric">Now</th>
              <th className="numeric">To cap</th>
            </tr>
          </thead>
          <tbody>
            {report.slices.map((slice) => (
              <tr key={slice.label}>
                <td>{slice.label}</td>
                <td className="numeric">{slice.current.toFixed(2)}%</td>
                <td className="numeric">
                  {slice.headroom === 0 ? (
                    <span className="muted">capped</span>
                  ) : (
                    `+${slice.headroom.toFixed(2)}%`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {report.tiers.length === 0 ? <p className="muted">Already capped. No stat weight.</p> : null}
    </>
  );
}
