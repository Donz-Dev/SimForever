import type { ClassId } from '../../game/character';
import type { ClassTalents, Talent, TalentAllocation, TalentTree } from '../../game/talents/Talent';
import { TOTAL_TALENT_POINTS } from '../../game/talents/Talent';
import type { UnmodelledTalent } from '../../game/talents/TalentEffect';
import { talentBuild } from '../../game/talents/talentBuild';
import { accentFor, talentsForClass } from '../../game/talents/talentData';
import {
  canSpend,
  canUnspend,
  distribution,
  pointsInTree,
  pointsRemaining,
  resetTree,
  spend,
  unspend,
} from '../../game/talents/talentRules';

/** Talent icons come from the shared WoW icon CDN, as the source calculator's do. */
const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/medium';

/** The grid is four columns wide in every tree, even where a column is empty. */
const TREE_COLUMNS = 4;

/**
 * Applied to the CURRENT allocation, rather than being handed a finished one.
 *
 * Two clicks landing in the same React batch both read the same `allocation`
 * prop, so passing a computed result loses the first -- four clicks on a
 * three-rank talent left it at one. Passing the transform makes each click
 * apply to whatever the previous one produced.
 */
type TalentUpdate = (previous: TalentAllocation) => TalentAllocation;

interface TalentPanelProps {
  readonly characterClass: ClassId;
  readonly allocation: TalentAllocation;
  readonly onChange: (update: TalentUpdate) => void;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

/**
 * The three talent trees of whichever class is selected.
 *
 * Left click spends a point, right click takes one back -- the binding every
 * talent calculator has used for twenty years, so it needs no instructions.
 *
 * SOME OF THIS AFFECTS A SIMULATION AND SOME DOES NOT. A talent that grants an
 * ability, changes a stat, raises a resource cap or alters an ability's cost or
 * cooldown is real; everything else is listed under "Chosen but not simulated"
 * with the reason it cannot be modelled yet. Said on screen, per talent, rather
 * than left for someone to discover by running two builds and comparing.
 *
 * Collapsible because it is tall: three trees of seven rows push the results
 * off screen on a laptop, and the trees are set once and then watched rarely.
 */
export function TalentPanel({
  characterClass,
  allocation,
  onChange,
  collapsed,
  onToggleCollapsed,
}: TalentPanelProps) {
  const talents = talentsForClass(characterClass);
  if (!talents) return null;

  const remaining = pointsRemaining(allocation);
  // Which of the spent talents are doing nothing, and why. The Gear panel
  // prints the same list for items under "Equipped but not simulated"; a talent
  // that silently did nothing would look exactly like one that worked.
  const { unmodelled } = talentBuild(characterClass, allocation);

  return (
    <section className="panel talent-panel">
      <header className="panel-header">
        <div className="talent-header-left">
          <h2>Talents</h2>
          <span className="talent-distribution">{distribution(talents, allocation)}</span>
        </div>
        <div className="panel-actions">
          <span className={remaining === 0 ? 'talent-remaining spent' : 'talent-remaining'}>
            {remaining} point{remaining === 1 ? '' : 's'} left
          </span>
          <button
            type="button"
            className="talent-toggle"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand talents' : 'Collapse talents'}
          >
            {collapsed ? '▢' : '▁'}
          </button>
        </div>
      </header>

      {collapsed ? null : (
        <div className="panel-body talent-body">
          {unmodelled.length > 0 ? (
            <>
              <p className="muted warn talent-warning">
                Chosen but not simulated. These have points in them and do nothing, so
                the results are lower than the real game by whatever they are worth.
              </p>
              <ul className="issues">
                {unmodelled.map((entry: UnmodelledTalent) => (
                  <li key={entry.talentId}>
                    <strong>
                      {entry.name} ({entry.rank}/{talents.byId.get(entry.talentId)?.ranks ?? entry.rank})
                    </strong>{' '}
                    — {entry.text}
                    <span className="muted"> {entry.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="talent-trees">
            {talents.trees.map((tree, index) => (
              <TalentTreeView
                key={tree.id}
                talents={talents}
                tree={tree}
                accent={accentFor(index)}
                allocation={allocation}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TalentTreeView({
  talents,
  tree,
  accent,
  allocation,
  onChange,
}: {
  readonly talents: ClassTalents;
  readonly tree: TalentTree;
  readonly accent: string;
  readonly allocation: TalentAllocation;
  readonly onChange: (update: TalentUpdate) => void;
}) {
  const spent = pointsInTree(talents, allocation, tree.id);
  // One row past the deepest talent, so the capstone row still has a cell.
  const rows = Math.max(...tree.talents.map((talent) => talent.row)) + 1;

  return (
    <div className="talent-tree" style={{ borderColor: accent }}>
      {/* color-mix rather than an `${accent}33` suffix: the accent is a custom
          property now, and appending alpha digits to `var(--tree-1)` produces
          a string no browser parses. */}
      <header
        className="talent-tree-header"
        style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)` }}
      >
        <span className="talent-tree-name">{tree.name}</span>
        <span className="talent-tree-points">
          {spent} / {TOTAL_TALENT_POINTS}
        </span>
      </header>

      <div
        className="talent-grid"
        style={{
          gridTemplateColumns: `repeat(${TREE_COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        {tree.talents.map((talent) => (
          <TalentCell
            key={talent.id}
            talents={talents}
            talent={talent}
            allocation={allocation}
            onChange={onChange}
          />
        ))}
      </div>

      <button
        type="button"
        className="talent-reset"
        disabled={spent === 0}
        onClick={() => onChange((previous) => resetTree(talents, previous, tree.id))}
      >
        Reset {tree.name}
      </button>
    </div>
  );
}

function TalentCell({
  talents,
  talent,
  allocation,
  onChange,
}: {
  readonly talents: ClassTalents;
  readonly talent: Talent;
  readonly allocation: TalentAllocation;
  readonly onChange: (update: TalentUpdate) => void;
}) {
  const points = allocation[talent.id] ?? 0;
  const addable = canSpend(talents, allocation, talent.id);
  const removable = canUnspend(talents, allocation, talent.id);

  const state =
    points >= talent.ranks ? 'maxed' : points > 0 ? 'partial' : addable ? 'open' : 'locked';

  return (
    <button
      type="button"
      className={`talent ${state}`}
      // Grid positions are one-based; the data is zero-based.
      style={{ gridColumn: talent.col + 1, gridRow: talent.row + 1 }}
      onClick={() => onChange((previous) => spend(talents, previous, talent.id))}
      onContextMenu={(event) => {
        // Right click removes, which means suppressing the browser menu.
        event.preventDefault();
        onChange((previous) => unspend(talents, previous, talent.id));
      }}
      disabled={!addable && !removable}
      title={`${talent.name} (${points}/${talent.ranks})\n\n${talent.description}${
        talent.tier > 0 ? `\n\nRequires ${talent.tier} points in ${talent.tree}` : ''
      }`}
    >
      <img
        className="talent-icon"
        src={`${ICON_BASE}/${talent.icon}.jpg`}
        alt=""
        loading="lazy"
        draggable={false}
      />
      <span className="talent-rank">
        {points}/{talent.ranks}
      </span>
    </button>
  );
}
