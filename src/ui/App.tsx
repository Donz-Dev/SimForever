import { useState } from 'react';
import type { TalentAllocation } from '../game/talents/Talent';

/** How TalentPanel asks for a change: applied to whatever is current. */
type TalentUpdate = (previous: TalentAllocation) => TalentAllocation;
import type { CharacterProfile } from '../profiles';
import type { ProfilePreset } from '../profiles';
import { createDefaultProfile } from '../profiles';
import { resolveCombatStyle } from '../game/character';
import { startingEquipmentFor } from '../game/items/startingSets';
import { Logo } from './components/Logo';
import { useSimulation } from './hooks/useSimulation';
import { useStatWeights } from './hooks/useStatWeights';
import { CharacterPanel } from './panels/CharacterPanel';
import { CharacterSheetPanel } from './panels/CharacterSheetPanel';
import { CombatLogPanel } from './panels/CombatLogPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { GearPanel } from './panels/GearPanel';
import { ConsumablesPanel } from './panels/ConsumablesPanel';
import { RaidBuffsPanel } from './panels/RaidBuffsPanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { ProfileRail } from './panels/ProfileRail';
import type { StatWeightSelection } from './panels/SimulationPanel';
import { NO_STAT_WEIGHTS, SimulationPanel } from './panels/SimulationPanel';
import { StatWeightsPanel } from './panels/StatWeightsPanel';
import { TankStatWeightsPanel } from './panels/TankStatWeightsPanel';
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
  const setTalents = (update: TalentUpdate) => {
    setActivePresetId(undefined);
    setProfile((previous) => ({ ...previous, talents: update(previous.talents) }));
  };
  /*
   * WHICH PRESET IS ON SCREEN, for the rail's selected pill -- and cleared by
   * the first edit, because a character that has been changed is no longer the
   * preset it started as. Not derived from the profile: two presets can differ
   * only in talents, and comparing whole profiles to find out which pill to
   * light would be both slow and wrong the moment someone edits one.
   */
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);

  const { state, progress, run, reset } = useSimulation();

  /*
   * ----------------------------------------------------------------------------
   * A SECOND HOOK RATHER THAN A FLAG ON THE FIRST. A stat-weight run has its
   * own shape -- a plan, a pool of workers, two phases and a progress bar
   * counted in fights -- and folding it into `useSimulation` would make the
   * ordinary path carry all of it for the ninety-nine runs out of a hundred
   * that do not want it.
   *
   * THEY ARE MUTUALLY EXCLUSIVE AT THE BUTTON, which is what keeps the page
   * honest: the stat-weight run's baseline IS an ordinary batch, so its results
   * and its combat log are shown from that one batch and no fight is run twice.
   * Running both would mean two baselines and two different DPS figures on one
   * page.
   * ----------------------------------------------------------------------------
   */
  const [statWeights, setStatWeights] = useState<StatWeightSelection>(NO_STAT_WEIGHTS);
  const weightRun = useStatWeights();

  /** Both runs draw a fresh seed, for the reason `useSimulation` gives. */
  const runEither = () => {
    if (statWeights.enabled && statWeights.stats.length > 0) {
      reset();
      void weightRun.run(profile, statWeights.stats, Math.floor(Math.random() * 2 ** 31));
      return;
    }
    weightRun.reset();
    run(profile);
  };

  /*
   * WHICHEVER RUN PRODUCED THE RESULTS ON SCREEN. A stat-weight run's baseline
   * is a full batch, so the Results panel and the combat log read it exactly as
   * they read an ordinary one -- there is no second code path for them.
   */
  const batch =
    weightRun.state.status === 'done'
      ? weightRun.state.baseline
      : state.status === 'done'
        ? state.batch
        : undefined;
  const busy = state.status === 'running' || weightRun.state.status === 'running';
  const failure =
    state.status === 'error'
      ? state.message
      : weightRun.state.status === 'error'
        ? weightRun.state.message
        : undefined;

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
  /**
   * Take a ready-made character, and confirm it in the same step.
   *
   * CONFIRMED IMMEDIATELY, because a preset is already a settled character --
   * every field it sets is set deliberately, so leaving someone on the
   * creation screen to press Confirm on a build they did not assemble is a
   * step that can only go wrong. `confirmCharacter` would also dress it from
   * the starting set, which would quietly overwrite the gear the preset
   * chose.
   *
   * The talents are on the profile, so they come with it; nothing else has to
   * be told.
   */
  const applyPreset = (preset: ProfilePreset) => {
    setProfile(preset.build());
    setActivePresetId(preset.id);
    setConfirmed(true);
    reset();
    weightRun.reset();
  };

  /**
   * Take a profile read from a file, and confirm it in the same step.
   *
   * THE SAME FOUR THINGS `applyPreset` DOES, and for the same reasons. A
   * loaded profile is a settled character -- it was saved from one -- so
   * leaving somebody on the creation screen to press Confirm on a build they
   * did not assemble is a step that can only go wrong, and `confirmCharacter`
   * would also dress an empty profile from the starting set.
   *
   * NO PRESET PILL, because a file is not a preset even when it was saved from
   * one: it may have been edited since, and lighting a pill would claim the
   * rail's build is on screen when something else is.
   *
   * THE RESULTS GO, because they belong to the character that produced them.
   * Leaving a DPS figure on screen beside a character that has just been
   * replaced wholesale invites reading one as the other.
   */
  const loadProfile = (loaded: CharacterProfile) => {
    setProfile(loaded);
    setActivePresetId(undefined);
    setConfirmed(true);
    reset();
    weightRun.reset();
  };

  const confirmCharacter = () => {
    setProfile((previous) =>
      Object.keys(previous.equipment).length > 0
        ? previous
        : {
            ...previous,
            equipment: startingEquipmentFor(
              previous.character.characterClass,
              resolveCombatStyle(previous.character.characterClass, previous.character.combatStyle),
              // Which of two Paladin shield builds is meant. See StartingSetOptions.
              { targetAttacks: previous.encounter.targetAttacks },
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
    weightRun.reset();
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
            /* Still nothing. Import is the paste-a-profile half of this pair
               and is deliberately not built yet; `panels/ProfilePanel.tsx`
               holds the round-trip it wants. See docs/handoff/gui.md. */
            onImport={() => undefined}
            onLoad={loadProfile}
          />

          {confirmed ? (
            <>
              <CharacterSheetPanel profile={profile} />
              <EncounterPanel profile={profile} onChange={setProfile} />
              <SimulationPanel
                profile={profile}
                onChange={setProfile}
                onRun={runEither}
                isRunning={busy}
                progress={weightRun.state.status === 'idle' ? progress : weightRun.progress}
                statWeights={statWeights}
                onStatWeightsChange={setStatWeights}
              />
            </>
          ) : null}
        </div>

        {confirmed ? (
          <div className="column column-results">
            <TalentPanel
              characterClass={profile.character.characterClass}
              allocation={talents}
              onChange={setTalents}
            />
            <GearPanel profile={profile} onChange={setProfile} />
            {/* After the gear, because it is the same kind of decision: what
                the character walks in carrying. Set once and rarely touched. */}
            <RaidBuffsPanel profile={profile} onChange={setProfile} />
            {/* And after those, for the same reason again: what the character
                walks in carrying, chosen once. One dropdown per category,
                because at most one consumable per category may be drunk. */}
            <ConsumablesPanel profile={profile} onChange={setProfile} />

            {busy ? (
              <div className="placeholder">
                <p>
                  {weightRun.state.status === 'running'
                    ? `${weightRun.state.phase}...`
                    : 'Running...'}
                </p>
              </div>
            ) : null}

            {failure ? (
              <div className="placeholder error">
                <p>The simulation failed: {failure}</p>
              </div>
            ) : null}

            {/* The weights go ABOVE the ordinary results, because when both are
                on screen the weights are what the run was for. */}
            {weightRun.state.status === 'done' ? (
              <StatWeightsPanel
                plan={weightRun.state.plan}
                weights={weightRun.state.weights}
                baselineDps={weightRun.state.baseline.dps.mean}
                iterations={weightRun.state.baseline.iterations}
                fights={weightRun.state.fights}
                workers={weightRun.state.workers}
              />
            ) : null}

            {/*
                THE TANK TABLE ONLY WHEN SOMETHING CAN KILL YOU, which is the
                Encounter panel's own "target attacks back". The hook returns
                an empty list otherwise rather than the UI deciding, so the
                panel and the measurement agree about when it applies.
            */}
            {weightRun.state.status === 'done' && weightRun.state.survival.length > 0 ? (
              <TankStatWeightsPanel
                weights={weightRun.state.survival}
                baselineDeaths={weightRun.state.baseline.survival.deaths}
                iterations={weightRun.state.baseline.iterations}
              />
            ) : null}

            {batch ? (
              <>
                <ResultsPanel batch={batch} />
                <CombatLogPanel result={batch.representative} />
              </>
            ) : null}
          </div>
        ) : null}

        <div className="column column-rail">
          <ProfileRail onPreset={applyPreset} activeId={activePresetId} />
        </div>
      </main>
    </div>
  );
}
