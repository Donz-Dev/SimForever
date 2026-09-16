import type { CharacterProfile } from '../../profiles';
import { NumberField } from '../components/Field';
import { Panel } from '../components/Panel';

interface SimulationPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
  readonly onRun: () => void;
  readonly isRunning: boolean;
  readonly progress: number;
}

export function SimulationPanel({
  profile,
  onChange,
  onRun,
  isRunning,
  progress,
}: SimulationPanelProps) {
  const setSimulation = (changes: Partial<CharacterProfile['simulation']>) => {
    onChange({ ...profile, simulation: { ...profile.simulation, ...changes } });
  };

  return (
    <Panel title="Simulation">
      <NumberField
        label="Duration (seconds)"
        value={profile.simulation.durationSeconds}
        min={1}
        max={3600}
        onChange={(durationSeconds) => setSimulation({ durationSeconds })}
      />
      <NumberField
        label="Duration variance"
        value={profile.simulation.durationVariance}
        min={0}
        max={1}
        step={0.05}
        onChange={(durationVariance) => setSimulation({ durationVariance })}
      />
      <NumberField
        label="Iterations"
        value={profile.simulation.iterations}
        min={1}
        max={50_000}
        onChange={(iterations) => setSimulation({ iterations: Math.round(iterations) })}
      />

      <button type="button" className="run-button" onClick={onRun} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run Simulation'}
      </button>

      {isRunning && profile.simulation.iterations > 1 ? (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
    </Panel>
  );
}
