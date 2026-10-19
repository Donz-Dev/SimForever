import { useState } from 'react';
import type { SimHistoryEntry } from '../simHistory';
import { SIM_HISTORY_LIMIT } from '../simHistory';
import { Panel } from '../components/Panel';

interface SimHistoryPanelProps {
  readonly history: readonly SimHistoryEntry[];
  /** Double-click: put that run's character, settings and result back. */
  readonly onRestore: (entry: SimHistoryEntry) => void;
}

/**
 * The last ten runs, newest first (round 48).
 *
 * ONE CLICK SELECTS, TWO RESTORE, the owner's spec. Selecting only highlights,
 * so a stray click changes nothing on screen; restoring replaces the character
 * being edited, so it takes the deliberate gesture. Enter on a focused row
 * restores too, so it is reachable without a mouse.
 */
export function SimHistoryPanel({ history, onRestore }: SimHistoryPanelProps) {
  const [selected, setSelected] = useState<number | undefined>(undefined);

  return (
    <Panel
      title="Sim history"
      badge={<span className="panel-badge">{`${history.length} of ${SIM_HISTORY_LIMIT}`}</span>}
    >
      {history.length === 0 ? (
        <p className="muted sim-history-empty">No runs yet.</p>
      ) : (
        <ul className="sim-history" role="listbox" aria-label="Recent runs">
          {history.map((entry) => {
            const { profile, batch } = entry;
            const time = new Date(entry.finishedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            return (
              <li
                key={entry.id}
                role="option"
                tabIndex={0}
                aria-selected={selected === entry.id}
                className={selected === entry.id ? 'sim-history-row selected' : 'sim-history-row'}
                title="Double-click to restore this run"
                onClick={() => setSelected(entry.id)}
                onDoubleClick={() => {
                  setSelected(entry.id);
                  onRestore(entry);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onRestore(entry);
                }}
              >
                <span className="sim-history-name">{profile.character.name || 'Unnamed'}</span>
                <span className="sim-history-dps">{batch.dps.mean.toFixed(1)}</span>
                <span className="sim-history-meta">
                  {`${time} · ${profile.simulation.durationSeconds}s · ${batch.iterations} runs`}
                </span>
                <span className="sim-history-tps">{`${batch.tps.mean.toFixed(1)} TPS`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
