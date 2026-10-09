import type { StatWeight } from '../../simulator';
import { Panel } from '../components/Panel';

interface TankStatWeightsPanelProps {
  readonly weights: readonly StatWeight[];
  /** Deaths per fight in the baseline, which every row is differenced against. */
  readonly baselineDeaths: number;
  readonly iterations: number;
}

/**
 * What a point of each stat is worth in DEATHS AVOIDED.
 *
 * ==============================================================================
 * THE SAME RUN, READ FOR A DIFFERENT THING. A damage stat weight asks what a
 * point adds to DPS; this asks what it takes off the death count, which is the
 * question a tank is actually asking. Both come off the SAME fights --
 * `sampleIterations` counts deaths while it sums damage -- so this panel costs
 * no extra iterations at all, and the two tables describe one measurement
 * rather than two that might disagree.
 *
 * IT ONLY EXISTS WHEN THE TARGET SWINGS BACK, which is the Encounter panel's
 * own checkbox. With nothing attacking, the death count is zero on every
 * iteration and every stat would come back a confident "nothing" -- true, and
 * twenty rows of it is noise rather than an answer.
 *
 * "AVOID DEATH" IS TREATED AS A STAT, in the ruleset owner's own framing: 30
 * agility taking deaths from 10.5 to 9.8 is +0.7 avoid death. So the sign is
 * flipped once, in `survivalWeightsFrom`, and MORE IS BETTER here exactly as it
 * is in the damage table -- a reader can sort both the same way without
 * remembering which direction each one runs.
 *
 * DEATHS ARE A COUNT PER FIGHT AND NOT A CHANCE. This encounter ramps the
 * boss's damage ten percent a swing and stands the character back up when they
 * fall, without resetting the ramp -- so a tank dies eight to eleven times in a
 * sixty-second fight and the quantity is rich enough to weight. It is a measure
 * of how far into the ramp a build survives, not a probability of wiping.
 * ==============================================================================
 */
export function TankStatWeightsPanel({
  weights,
  baselineDeaths,
  iterations,
}: TankStatWeightsPanelProps) {
  const ranked = [...weights].sort((a, b) => b.perUnit - a.perUnit);
  /*
   * RELATIVE TO THE LARGEST MEASURED ROW, as the damage table does, and
   * measured ones only: a row whose interval swallows its value shows no bar,
   * so letting one set the scale would shrink every real bar against a number
   * the run cannot stand behind.
   */
  const top = Math.max(
    ...ranked.filter((row) => row.verdict === 'measured').map((row) => Math.abs(row.perUnit)),
    Number.EPSILON,
  );

  return (
    <Panel
      title="Tank stat weights"
      collapsible
      startOpen
      subtitle={[
        `${baselineDeaths.toFixed(2)} deaths a fight`,
        `${iterations.toLocaleString()} iterations each`,
        'higher avoids more',
      ].join(' · ')}
    >
      {ranked.length === 0 ? (
        <p className="muted">
          Nothing selected moved the death count. Tank weights need the target to swing
          back, and a stat the fight cannot read for survival is left out rather than
          listed at zero.
        </p>
      ) : (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Stat</th>
              <th className="numeric">Avoid death / point</th>
              <th className="numeric">Relative</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className="numeric">
                  <strong>{row.perUnit.toFixed(4)}</strong>
                  {row.verdict === 'none' ? null : (
                    <span className="muted"> ± {row.interval.toFixed(4)}</span>
                  )}
                </td>
                <td className="numeric">
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
                        style={{
                          width: `${Math.max(0, Math.min(100, (row.perUnit / top) * 100))}%`,
                        }}
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
    </Panel>
  );
}
