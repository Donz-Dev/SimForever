import { useState } from 'react';
import type { SimulationResult } from '../../analysis';
import { Panel } from '../components/Panel';

interface CombatLogPanelProps {
  readonly result: SimulationResult;
}

/** Lines shown before the user asks for the rest. A 5-minute fight has thousands. */
const INITIAL_LINE_LIMIT = 300;

export function CombatLogPanel({ result }: CombatLogPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const lines = showAll ? result.combatLog : result.combatLog.slice(0, INITIAL_LINE_LIMIT);
  const hidden = result.combatLog.length - lines.length;

  return (
    <Panel
      title="Combat Log"
      subtitle={`${result.combatLog.length.toLocaleString()} lines`}
      actions={
        hidden > 0 || showAll ? (
          <button type="button" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show less' : `Show all ${result.combatLog.length.toLocaleString()}`}
          </button>
        ) : null
      }
    >
      <pre className="combat-log">{lines.join('\n')}</pre>
      {hidden > 0 ? (
        <p className="muted">{hidden.toLocaleString()} more lines hidden.</p>
      ) : null}
    </Panel>
  );
}
