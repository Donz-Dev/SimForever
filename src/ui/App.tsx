import { useEffect, useRef, useState } from 'react';
import type { TalentAllocation } from '../game/talents/Talent';

/** How TalentPanel asks for a change: applied to whatever is current. */
type TalentUpdate = (previous: TalentAllocation) => TalentAllocation;
import type { CharacterProfile } from '../profiles';
import type { ProfilePreset } from '../profiles';
import { createDefaultProfile } from '../profiles';
import { syncDefaultRotation } from '../profiles/rotation';
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
import { AplPanel } from './panels/AplPanel';
import { ConsumablesPanel } from './panels/ConsumablesPanel';
import { RaidBuffsPanel } from './panels/RaidBuffsPanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { ProfileRail } from './panels/ProfileRail';
import type { RunKind, StatWeightSelection } from './panels/SimulationPanel';
import { withSalvationFor } from '../game/buffs/raidBuffs';
import { NO_STAT_WEIGHTS, SimulationPanel } from './panels/SimulationPanel';
import { StatWeightsPanel } from './panels/StatWeightsPanel';
import { TankStatWeightsPanel } from './panels/TankStatWeightsPanel';
import { TalentPanel } from './panels/TalentPanel';
import { SimHistoryPanel } from './panels/SimHistoryPanel';
import type { SimHistoryEntry } from './simHistory';
import { withRun } from './simHistory';

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
    /*
     * SYNCED AT BIRTH, because `createDefaultProfile` cannot derive the stock
     * list itself -- `profiles/rotation.ts` imports it, so doing it there
     * would be a cycle. Without this the opening character would carry an
     * EMPTY list and cast nothing.
     */
    return syncDefaultRotation({ ...base, character: { ...base.character, name: '' } });
  });
  const [confirmed, setConfirmed] = useState(false);
  // Talents live ON THE PROFILE, because they now decide which abilities a
  // character knows and so change what a simulation produces. They were UI
  // state for as long as they changed nothing; format version 5 is where that
  // stopped being true.
  const talents = profile.talents;
  const setTalents = (update: TalentUpdate) => {
    setActivePresetId(undefined);
    setProfile((previous) =>
      syncDefaultRotation({ ...previous, talents: update(previous.talents) }),
    );
  };

  /**
   * Every edit a PANEL makes, with the stock priority list kept in step.
   *
   * ----------------------------------------------------------------------------
   * WHY THIS IS NOT JUST `setProfile`. A stored list is frozen -- that is what
   * storing it means -- so it stops following the build, and the build is
   * editable. Change a Rogue's capstone and the stock list for the new spec is
   * a different one; change class and the stored list names another class's
   * abilities, every one of which `PriorityRotation` skips IN SILENCE.
   *
   * `syncDefaultRotation` RE-DERIVES ONLY A `default` LIST and never touches a
   * `custom` one, so somebody's own list is never silently replaced -- the
   * panel warns instead.
   *
   * APPLIED TO EVERY CHANGE rather than to the four that can matter, because it
   * is idempotent and because the alternative is a list of "edits that change
   * which stock list applies" that is correct until somebody adds a fifth.
   *
   * AND NOT APPLIED ON LOAD. `loadProfile` sets the profile directly: a loaded
   * file runs exactly the list it carries, which is the freezing the owner
   * asked for.
   * ----------------------------------------------------------------------------
   */
  const editProfile = (next: CharacterProfile) => setProfile(syncDefaultRotation(next));
  /*
   * WHICH PRESET IS ON SCREEN, for the rail's selected pill -- and cleared by
   * the first edit, because a character that has been changed is no longer the
   * preset it started as. Not derived from the profile: two presets can differ
   * only in talents, and comparing whole profiles to find out which pill to
   * light would be both slow and wrong the moment someone edits one.
   */
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);

  const { state, progress, run, runHealer, restore, reset } = useSimulation();

  /*
   * SIM HISTORY (round 48): every finished ordinary run is recorded once, with
   * the profile it RAN with -- seed included -- and its result. A stat-weight
   * run is not recorded: its baseline is one part of a larger measurement.
   *
   * RECORDED OFF THE STATE rather than inside `run`, because the result arrives
   * later than the call; the ref stops a re-render, or a restore putting an old
   * result back on screen, from recording it a second time.
   */
  const [history, setHistory] = useState<readonly SimHistoryEntry[]>([]);
  const recorded = useRef(new WeakSet<object>());
  const nextHistoryId = useRef(1);
  useEffect(() => {
    if (state.status !== 'done' || recorded.current.has(state.batch)) return;
    recorded.current.add(state.batch);
    setHistory((previous) =>
      withRun(previous, {
        id: nextHistoryId.current++,
        finishedAt: Date.now(),
        presetId: activePresetId,
        profile: state.profile,
        batch: state.batch,
        ...(state.healer ? { healer: state.healer } : {}),
      }),
    );
  }, [state]);

  /** Double-click on a history row: that run's character, settings and result. */
  const restoreRun = (entry: SimHistoryEntry) => {
    setProfile(entry.profile);
    setActivePresetId(entry.presetId);
    setConfirmed(true);
    weightRun.reset();
    restore(entry.batch, entry.profile, entry.healer);
  };

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

  /**
   * THE THREE RUN BUTTONS (round 52). Every run draws a fresh seed, for the
   * reason `useSimulation` gives.
   *
   * DPS AND TANK ARE THE OLD CHECKBOX, MOVED ONTO THE BUTTON. "Target attacks
   * back" is still what the engine reads -- the attacks-received table, the
   * ramp, the assumed healer, Salvation -- so the button SETS it on the profile
   * and then runs, which also keeps the character sheet and Sim History saying
   * which kind of fight the result came from. Salvation follows it exactly as
   * the checkbox did, so a tank never carries -30% threat.
   *
   * HEALER RUNS THE TWO HEALER FIGHTS, and stat weights do not apply to it:
   * they price a stat in DPS or in deaths, and a healer run is neither.
   */
  const runEither = (kind: RunKind = 'dps') => {
    if (kind === 'healer') {
      weightRun.reset();
      runHealer(profile);
      return;
    }
    const attacks = kind === 'tank';
    const next: CharacterProfile =
      profile.encounter.targetAttacks === attacks
        ? profile
        : {
            ...profile,
            encounter: { ...profile.encounter, targetAttacks: attacks },
            raidBuffs: [...withSalvationFor(profile.raidBuffs, attacks)],
          };
    if (next !== profile) editProfile(next);
    if (statWeights.enabled && statWeights.stats.length > 0) {
      reset();
      void weightRun.run(next, statWeights.stats, Math.floor(Math.random() * 2 ** 31));
      return;
    }
    weightRun.reset();
    run(next);
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
        {/* The published full report, served beside the app from `public/reports/`
            so it can be shared with anyone who has the sim's link. RELATIVE, so it
            resolves under /SimForever/ on Pages and under / on the dev server. */}
        <a
          className="header-report-link"
          href="reports/102726-full-report.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          102726 Full Report
        </a>
      </header>

      <main className={confirmed ? 'app-layout' : 'app-layout single'}>
        <div className="column column-config">
          <CharacterPanel
            profile={profile}
            onChange={editProfile}
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
              <EncounterPanel profile={profile} onChange={editProfile} />
              <SimulationPanel
                profile={profile}
                onChange={editProfile}
                onRun={runEither}
                isRunning={busy}
                progress={weightRun.state.status === 'idle' ? progress : weightRun.progress}
                statWeights={statWeights}
                onStatWeightsChange={setStatWeights}
              />
              {/* UNDER THE RUN BUTTON, the owner's placement. */}
              <SimHistoryPanel history={history} onRestore={restoreRun} />
            </>
          ) : null}
        </div>

        {confirmed ? (
          <div className="column column-results">
            {/*
                GEAR ABOVE TALENTS, the owner's placement. Both stay
                collapsible, and both still start shut -- `Panel`'s own
                default, which is what keeps the column a list of titles until
                somebody opens one.
            */}
            <GearPanel profile={profile} onChange={editProfile} />
            <TalentPanel
              characterClass={profile.character.characterClass}
              allocation={talents}
              onChange={setTalents}
              /*
               * THE DEMON CHOOSER'S TWO PROPS, and it renders only when a
               * Warlock has taken Demonic Sacrifice -- the panel decides that,
               * because the talent allocation is the thing it already holds.
               *
               * IT GOES THROUGH `editProfile` LIKE EVERY OTHER PANEL EDIT,
               * which is what makes the stock rotation re-derive: `editProfile`
               * runs `syncDefaultRotation` on every change, applied to all of
               * them rather than to the four that can matter. Nothing in a
               * Warlock list reads the demon today, and that is exactly the
               * comment's own argument for not enumerating which edits count.
               */
              petFamily={profile.character.petFamily}
              onPetFamilyChange={(petFamily) =>
                editProfile({
                  ...profile,
                  character: { ...profile.character, petFamily },
                })
              }
              summonedDemon={profile.character.summonedDemon}
              onSummonedDemonChange={(demon) => {
                // REMOVED rather than stored as undefined, so "none out" is the
                // same file a profile saved before the field existed is.
                const { summonedDemon: _drop, ...character } = profile.character;
                editProfile({
                  ...profile,
                  character: demon ? { ...character, summonedDemon: demon } : character,
                });
              }}
            />
            {/* BETWEEN THE GEAR AND THE RAID BUFFS, the owner's placement, and
                it reads in the right order: what the character is holding, how
                it fights, then what the raid gives it. */}
            {/* Two lists, each collapsible (round 64): Single Target and Multi
                Target, each with its own pre-combat and combat list. */}
            <AplPanel profile={profile} section="single" onChange={editProfile} />
            <AplPanel profile={profile} section="multi" onChange={editProfile} />
            {/* After the gear, because it is the same kind of decision: what
                the character walks in carrying. Set once and rarely touched. */}
            <RaidBuffsPanel profile={profile} onChange={editProfile} />
            {/* And after those, for the same reason again: what the character
                walks in carrying, chosen once. One dropdown per category,
                because at most one consumable per category may be drunk. */}
            <ConsumablesPanel profile={profile} onChange={editProfile} />

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
                /*
                  THE OWNER'S "overwrite the default numbers", AS A BUTTON. The
                  run does not do it by itself: a finished run that silently
                  rewrote the Gear panel's sort order would change what the
                  panel says about every item with nothing on screen to say a
                  decision had been made.

                  `editProfile` RATHER THAN `setProfile`, like every other
                  panel edit, so the stored priority list stays in step -- the
                  sync is idempotent and applying it to every change is what
                  stops the list of "edits that can matter" going stale.
                */
                onUseForGear={(statValuation) => editProfile({ ...profile, statValuation })}
                usedForGear={profile.statValuation !== undefined}
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

            {/*
                A HEALER RUN'S TWO REPORTS (round 52), each its own collapsible
                panel with its own timeline and log, so the two fights can be
                swapped between by shutting one. The report is the healer's;
                the tank and the raid are who it was healing.
            */}
            {state.status === 'done' && state.healer && weightRun.state.status !== 'done' ? (
              <>
                {(
                  [
                    ['Tank Healer', state.healer.tank],
                    ['Raid Healer', state.healer.raid],
                  ] as const
                ).map(([label, report]) => (
                  <div key={label} className="healer-report">
                    <ResultsPanel batch={report} mode="healing" title={label} />
                    <TimelinePanel
                      result={report.representative}
                      hiddenAuraIds={report.forcedAuraIds}
                      playerId={report.playerId}
                      title={`${label} timeline`}
                    />
                    <CombatLogPanel result={report.representative} title={`${label} combat log`} />
                  </div>
                ))}
              </>
            ) : batch ? (
              <>
                <ResultsPanel batch={batch} />
                {/*
                  * BETWEEN THE RESULTS AND THE LOG, which is the order the
                  * three are read in: what the fight produced, how it was
                  * SHAPED, and then the lines themselves. Both this and the
                  * log read the representative iteration, so the two are
                  * describing the same fight.
                  */}
                <TimelinePanel
                  result={batch.representative}
                  hiddenAuraIds={batch.forcedAuraIds}
                />
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
