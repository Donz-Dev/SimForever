import { useState } from 'react';
import type { TalentAllocation } from '../game/talents/Talent';

/** How TalentPanel asks for a change: applied to whatever is current. */
type TalentUpdate = (previous: TalentAllocation) => TalentAllocation;
import type { CharacterProfile } from '../profiles';
import { createDefaultProfile } from '../profiles';
import { resolveCombatStyle } from '../game/character';
import { startingEquipmentFor } from '../game/items/startingSets';
import { Logo } from './components/Logo';
import { useSimulation } from './hooks/useSimulation';
import { CharacterPanel } from './panels/CharacterPanel';
import { CharacterSheetPanel } from './panels/CharacterSheetPanel';
import { CombatLogPanel } from './panels/CombatLogPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { GearPanel } from './panels/GearPanel';
import { RaidBuffsPanel } from './panels/RaidBuffsPanel';
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
  // Talents live ON THE PROFILE, because they now decide which abilities a
  // character knows and so change what a simulation produces. They were UI
  // state for as long as they changed nothing; format version 5 is where that
  // stopped being true.
  const talents = profile.talents;
  const setTalents = (update: TalentUpdate) =>
    setProfile((previous) => ({ ...previous, talents: update(previous.talents) }));
  const [talentsCollapsed, setTalentsCollapsed] = useState(false);

  const { state, progress, run, reset } = useSimulation();

  /**
   * Settle the character, and dress it if it is still naked.
   *
   * A character created with nineteen empty slots fights with placeholder
   * weapons and no stats, and still produces a confident-looking DPS figure --
   * meaningless, but not OBVIOUSLY meaningless. Starting from a real set means
   * the first number a person sees is one worth reading.
   *
   * Only when the equipment is EMPTY. A profile that already has gear, whether
   * chosen here or loaded from a file, is never overwritten by confirming the
   * character again.
   */
  const confirmCharacter = () => {
    setProfile((previous) =>
      Object.keys(previous.equipment).length > 0
        ? previous
        : {
            ...previous,
            equipment: startingEquipmentFor(
              previous.character.characterClass,
              resolveCombatStyle(previous.character.characterClass, previous.character.combatStyle),
            ),
          },
    );
    setConfirmed(true);
  };

  const editCharacter = () => {
    setConfirmed(false);
    // Talent ids are unique WITHIN a class, not across them, so an allocation
    // means nothing once the class changes. Cleared on every edit rather than
    // only on a class change, because a half-kept tree is more confusing than
    // an empty one.
    setTalents(() => ({}));
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
            onConfirm={confirmCharacter}
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
              characterClass={profile.character.characterClass}
              equipment={profile.equipment}
              combatStyle={resolveCombatStyle(
                profile.character.characterClass,
                profile.character.combatStyle,
              )}
              allocation={talents}
              onChange={setTalents}
              collapsed={talentsCollapsed}
              onToggleCollapsed={() => setTalentsCollapsed((was) => !was)}
            />
            <GearPanel profile={profile} onChange={setProfile} />
            {/* After the gear, because it is the same kind of decision: what
                the character walks in carrying. Set once and rarely touched. */}
            <RaidBuffsPanel profile={profile} onChange={setProfile} />

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
