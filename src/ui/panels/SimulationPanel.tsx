import type { StatName } from '../../engine';
import type { CharacterProfile } from '../../profiles';
import { WEIGHTABLE_STATS } from '../../simulator';
import { NumberField } from '../components/Field';
import { Panel } from '../components/Panel';

/**
 * Which stats a stat-weight run should price, and whether to run one at all.
 *
 * ------------------------------------------------------------------------------
 * UI STATE RATHER THAN A PROFILE FIELD, which is the opposite of the choice
 * `poisons`, `raidBuffs` and `consumables` all made. The rule those followed is
 * that a player's choice which CHANGES WHAT A FIGHT PRODUCES belongs on the
 * profile -- talents moved there the day they gated abilities. This one changes
 * no fight: the baseline is the ordinary run, bit for bit, and the variants are
 * extra runs that leave it alone.
 *
 * So putting it on the profile would mean a format version, a migration, a line
 * in each of the 25 presets and a field `measure_profiles.ts` has to ignore --
 * and this project has already paid for a version bump taken twice from one
 * base, where git merged two migration tables with the same key and the first
 * migration silently never ran. None of that buys anything a run needs.
 * ------------------------------------------------------------------------------
 */
export interface StatWeightSelection {
  readonly enabled: boolean;
  readonly stats: readonly StatName[];
}

/**
 * Off, with nothing selected.
 *
 * NOTHING IS TICKED BY DEFAULT, the same answer the raid buffs give and for a
 * related reason: a selection decides what the run COSTS, and eighteen variants
 * is tens of thousands of fights. "All" is one click away for someone who wants
 * them.
 */
export const NO_STAT_WEIGHTS: StatWeightSelection = { enabled: false, stats: [] };

interface SimulationPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
  readonly onRun: () => void;
  readonly isRunning: boolean;
  readonly progress: number;
  readonly statWeights: StatWeightSelection;
  readonly onStatWeightsChange: (selection: StatWeightSelection) => void;
}

export function SimulationPanel({
  profile,
  onChange,
  onRun,
  isRunning,
  progress,
  statWeights,
  onStatWeightsChange,
}: SimulationPanelProps) {
  const setSimulation = (changes: Partial<CharacterProfile['simulation']>) => {
    onChange({ ...profile, simulation: { ...profile.simulation, ...changes } });
  };

  const chosen = new Set(statWeights.stats);
  const toggle = (id: StatName) => {
    onStatWeightsChange({
      ...statWeights,
      /*
       * REBUILT FROM THE CATALOGUE rather than appended to, so the saved order
       * is the catalogue's and not the order the boxes were clicked in. The
       * plan reads the same way twice for the same selection, which is what
       * makes two runs comparable row for row.
       */
      stats: WEIGHTABLE_STATS.filter((stat) =>
        stat.id === id ? !chosen.has(id) : chosen.has(stat.id),
      ).map((stat) => stat.id),
    });
  };

  return (
    <Panel title="Simulation">
      {/*
        No variance field. Fight length varies by a fixed fraction the
        simulator applies to every run -- see FIGHT_DURATION_VARIANCE. It was
        a box defaulting to zero, which is the setting that makes every
        iteration identical in length, and that is not a choice worth
        offering.
      */}
      <NumberField
        label="Duration (seconds)"
        value={profile.simulation.durationSeconds}
        min={1}
        max={3600}
        onChange={(durationSeconds) => setSimulation({ durationSeconds })}
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

      {/*
        ----------------------------------------------------------------------
        UNDER THE BUTTON, because it changes what the button does rather than
        what the character is. Everything else in this column describes the
        fight; this describes how many of them to run.

        THE STAT LIST APPEARS ONLY WHEN THE RUN IS ASKED FOR. Eighteen rows is
        the whole column on a laptop, and a person who has not ticked the box
        has said they do not want them.
        ----------------------------------------------------------------------
      */}
      <label className="buff-row stat-weight-toggle">
        <input
          type="checkbox"
          checked={statWeights.enabled}
          disabled={isRunning}
          onChange={() => onStatWeightsChange({ ...statWeights, enabled: !statWeights.enabled })}
        />
        <span className="buff-name">Run a stat weights sim</span>
      </label>

      {statWeights.enabled ? (
        <div className="stat-weight-picker">
          <p className="field-hint">
            One baseline run, then one more run per stat, each at the iteration count
            above. A capped stat is measured in rungs: the points it takes to reach
            each cap it has left.
          </p>

          <div className="stat-weight-actions">
            <span className="muted">
              {statWeights.stats.length} of {WEIGHTABLE_STATS.length} selected
            </span>
            <button
              type="button"
              className="ghost"
              disabled={isRunning}
              onClick={() =>
                onStatWeightsChange({
                  ...statWeights,
                  stats: WEIGHTABLE_STATS.map((stat) => stat.id),
                })
              }
            >
              All
            </button>
            <button
              type="button"
              className="ghost"
              disabled={isRunning}
              onClick={() => onStatWeightsChange({ ...statWeights, stats: [] })}
            >
              None
            </button>
          </div>

          {/*
            A BOX AND A NAME AND NOTHING ELSE. Each row used to carry its step
            and a line on what the stat does, which is twenty-one paragraphs to
            scroll past in a column that is mostly the character. The step is
            still published -- it is declared in `WEIGHTABLE_STATS` and printed
            beside every weight the run produces -- so nothing is hidden, it is
            just not here.
          */}
          <ul className="buff-list stat-weight-list">
            {WEIGHTABLE_STATS.map((stat) => (
              <li key={stat.id}>
                <label className="buff-row stat-weight-row">
                  <input
                    type="checkbox"
                    checked={chosen.has(stat.id)}
                    disabled={isRunning}
                    onChange={() => toggle(stat.id)}
                  />
                  <span className="buff-name">{stat.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
