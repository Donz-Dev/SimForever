import { useState } from 'react';
import type { TalentAllocation } from '../game/talents/Talent';
import type { CharacterProfile } from '../profiles';
import { createDefaultProfile } from '../profiles';
import { Logo } from './components/Logo';
import { useSimulation } from './hooks/useSimulation';
import { CharacterPanel } from './panels/CharacterPanel';
import { CharacterSheetPanel } from './panels/CharacterSheetPanel';
import { CombatLogPanel } from './panels/CombatLogPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { GearPanel } from './panels/GearPanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { SimulationPanel } from './panels/SimulationPanel';
import { TalentPanel } from './panels/TalentPanel';

/**
 * The application shell.
 *
 * It holds the profile, passes it to the configuration panels, and hands it to
 * the simulation hook when the user clicks Run. There is no combat logic here
 * and there never should be: the engine is the only thing that knows how a
 * fight works, and this component only knows how to ask it.
 *
 * The one piece of state that is not the profile is `confirmed`: whether the
 * character has been settled. Everything past character creation is a decision
 * about a character, so none of it appears until there is one.
 */
export function App() {
  // The default profile is named, because `requireNonEmptyString` makes a name
  // part of what a valid profile IS. The UI starts blank anyway and refuses to
  // confirm until one is typed, so the field enforces the format's own rule
  // rather than inventing a new one.
  const [profile, setProfile] = useState<CharacterProfile>(() => {
    const base = createDefaultProfile();
    return { ...base, character: { ...base.character, name: '' } };
  });
  const [confirmed, setConfirmed] = useState(false);
  // Talents live in UI state, not on the profile. They have no effect on a
  // simulation yet, and putting them in the profile would mean a format version
  // and a migration for data nothing reads. That comes with the effects.
  const [talents, setTalents] = useState<TalentAllocation>({});
  const [talentsCollapsed, setTalentsCollapsed] = useState(false);
  const { state, progress, run, reset } = useSimulation();

  const editCharacter = () => {
    setConfirmed(false);
    // Results belong to the character that produced them. Leaving them on
    // screen beside a character being rebuilt invites reading one as the other.
    reset();
  };

  return (
    <div className="app">
      <header className="app-header">
        <Logo />
      </header>

      <main className={confirmed ? 'app-layout' : 'app-layout single'}>
        <div className="column column-config">
          <CharacterPanel
            profile={profile}
            onChange={setProfile}
            confirmed={confirmed}
            onConfirm={() => setConfirmed(true)}
            onEdit={editCharacter}
            onImport={() => undefined}
            onLoad={() => undefined}
          />

          {confirmed ? (
            <>
              <CharacterSheetPanel profile={profile} />
              <EncounterPanel profile={profile} onChange={setProfile} />
              <SimulationPanel
                profile={profile}
                onChange={setProfile}
                onRun={() => run(profile)}
                isRunning={state.status === 'running'}
                progress={progress}
              />
            </>
          ) : null}
        </div>

        {confirmed ? (
          <div className="column column-results">
            <TalentPanel
              allocation={talents}
              onChange={setTalents}
              collapsed={talentsCollapsed}
              onToggleCollapsed={() => setTalentsCollapsed((was) => !was)}
            />
            <GearPanel />

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
        ) : null}
      </main>
    </div>
  );
}
