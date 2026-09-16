import type { BatchResult } from '../../simulator';
import { toSeconds } from '../../engine';
import { Panel } from '../components/Panel';

interface ResultsPanelProps {
  readonly batch: BatchResult;
}

export function ResultsPanel({ batch }: ResultsPanelProps) {
  const result = batch.representative;
  const player = result.damage.byActor[0];
  const isBatch = batch.iterations > 1;

  return (
    <Panel
      title="Results"
      subtitle={
        isBatch
          ? `${batch.iterations.toLocaleString()} iterations in ${(batch.elapsedRealMs / 1000).toFixed(2)}s, seed ${batch.baseSeed}`
          : `Seed ${batch.baseSeed}`
      }
    >
      <div className="stat-grid">
        <Stat label="DPS" value={formatNumber(isBatch ? batch.dps.mean : result.damage.dps, 2)} />
        <Stat label="Total Damage" value={formatNumber(result.damage.total)} />
        <Stat label="Duration" value={`${toSeconds(result.durationMs).toFixed(1)} sec`} />
        <Stat label="Events" value={formatNumber(result.eventsProcessed)} />
      </div>

      {isBatch ? (
        <>
          <h3>Distribution</h3>
          <div className="stat-grid">
            <Stat label="Mean" value={formatNumber(batch.dps.mean, 2)} />
            <Stat label="Median" value={formatNumber(batch.dps.median, 2)} />
            <Stat label="Min" value={formatNumber(batch.dps.min, 2)} />
            <Stat label="Max" value={formatNumber(batch.dps.max, 2)} />
            <Stat label="Std Dev" value={formatNumber(batch.dps.standardDeviation, 2)} />
            <Stat
              label="Error"
              value={`${(batch.dps.relativeError * 100).toFixed(2)}%`}
            />
            <Stat label="5th pct" value={formatNumber(batch.dps.percentiles.p5, 2)} />
            <Stat label="95th pct" value={formatNumber(batch.dps.percentiles.p95, 2)} />
          </div>
        </>
      ) : null}

      <h3>Damage Breakdown</h3>
      {player ? (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Ability</th>
              <th className="numeric">Damage</th>
              <th className="numeric">Share</th>
              <th className="numeric">Hits</th>
              <th className="numeric">Average</th>
              <th className="numeric">Crit</th>
              <th className="numeric">Glance</th>
              <th className="numeric">Avoided</th>
            </tr>
          </thead>
          <tbody>
            {player.abilities.map((ability) => (
              <tr key={ability.abilityName}>
                <td>{ability.abilityName}</td>
                <td className="numeric">{formatNumber(ability.total)}</td>
                <td className="numeric">
                  <span className="share">
                    <span
                      className="share-bar"
                      style={{ width: `${Math.round(ability.share * 100)}%` }}
                    />
                    <span className="share-text">{(ability.share * 100).toFixed(1)}%</span>
                  </span>
                </td>
                <td className="numeric">
                  {ability.hits}
                  {ability.attempts !== ability.hits ? (
                    <span className="muted"> / {ability.attempts}</span>
                  ) : null}
                </td>
                <td className="numeric">{formatNumber(ability.average)}</td>
                <td className="numeric">{(ability.critRate * 100).toFixed(1)}%</td>
                <td className="numeric">
                  {ability.glances > 0 ? `${(ability.glanceRate * 100).toFixed(1)}%` : '-'}
                </td>
                <td className="numeric">
                  {ability.attempts > ability.hits
                    ? `${(ability.avoidRate * 100).toFixed(1)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No damage was dealt.</p>
      )}

      <p className="muted end-reason">
        Fight ended: {describeEndReason(result.endReason)}
        {isBatch ? ' (breakdown and log are from the median iteration)' : null}
      </p>
    </Panel>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function describeEndReason(reason: string): string {
  switch (reason) {
    case 'duration_expired':
      return 'time limit reached';
    case 'all_enemies_dead':
      return 'target defeated';
    case 'all_players_dead':
      return 'player died';
    default:
      return reason;
  }
}
