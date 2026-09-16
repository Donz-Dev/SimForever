import { useState } from 'react';
import type { CharacterProfile } from '../profiles';
import { createDefaultProfile } from '../profiles';
import { useSimulation } from './hooks/useSimulation';
import { CharacterPanel } from './panels/CharacterPanel';
import { CombatLogPanel } from './panels/CombatLogPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { ProfilePanel } from './panels/ProfilePanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { SimulationPanel } from './panels/SimulationPanel';

/**
 * The application shell.
 *
 * It holds the profile, passes it to the configuration panels, and hands it to
 * the simulation hook when the user clicks Run. There is no combat logic here
 * and there never should be: the engine is the only thing that knows how a
 * fight works, and this component only knows how to ask it.
 */
export function App() {
  const [profile, setProfile] = useState<CharacterProfile>(createDefaultProfile);
  const { state, progress, run } = useSimulation();

  return (
    <div className="app">
      <header className="app-header">
        <h1>SimForever</h1>
        <p>A World of Warcraft combat simulator</p>
      </header>

      <main className="app-layout">
        <div className="column column-config">
          <CharacterPanel profile={profile} onChange={setProfile} />
          <EncounterPanel profile={profile} onChange={setProfile} />
          <SimulationPanel
            profile={profile}
            onChange={setProfile}
            onRun={() => run(profile)}
            isRunning={state.status === 'running'}
            progress={progress}
          />
          <ProfilePanel profile={profile} onChange={setProfile} />
        </div>

        <div className="column column-results">
          {state.status === 'idle' ? (
            <div className="placeholder">
              <p>Configure the character and encounter, then run a simulation.</p>
            </div>
          ) : null}

          {state.status === 'running' ? (
            <div className="placeholder">
              <p>Running...</p>
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="placeholder error">
              <p>The simulation failed: {state.message}</p>
            </div>
          ) : null}

          {state.status === 'done' ? (
            <>
              <ResultsPanel batch={state.batch} />
              <CombatLogPanel result={state.batch.representative} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
