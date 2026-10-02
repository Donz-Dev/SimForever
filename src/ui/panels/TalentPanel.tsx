import type { ClassId, CombatStyleId } from '../../game/character';
import { MAX_CHARACTER_LEVEL } from '../../game/character';
import type { ClassTalents, Talent, TalentAllocation, TalentTree } from '../../game/talents/Talent';
import { TOTAL_TALENT_POINTS } from '../../game/talents/Talent';
import type { UnmodelledTalent } from '../../game/talents/TalentEffect';
import { talentBuild, talentContextFor } from '../../game/talents/talentBuild';
import { weaponsFor } from '../../game/actors/createPlayer';
import type { Equipment } from '../../game/items/Item';
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

/**
 * One row per talent, not one per unmodelled CLAUSE.
 *
 * ----------------------------------------------------------------------------
 * A talent can carry several `unmodelled` entries -- Weaponmaster has three,
 * one for each weapon clause it cannot express. They share a `talentId`, and
 * they used to be told apart on screen only by the per-entry REASON, which this
 * panel no longer prints. Without that, the three rendered as the same sentence
 * three times over, with no visible cause.
 *
 * It was also a duplicate React key the whole time -- `key={entry.talentId}` on
 * three siblings -- which React logs and which it is allowed to resolve by
 * dropping rows. The reason text hid both problems rather than preventing them.
 *
 * Deduplicating HERE and not in `talentBuild` is deliberate: the clauses are
 * genuinely separate to `class_audit.ts`, which counts them, and collapsing them
 * at the source would change the census. This is a presentation choice.
 * ----------------------------------------------------------------------------
 */
function oncePerTalent(entries: readonly UnmodelledTalent[]): UnmodelledTalent[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.talentId)) return false;
    seen.add(entry.talentId);
    return true;
  });
}

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
  /** What the character is holding, so conditional talents can be judged. */
  readonly equipment: Equipment;
  readonly combatStyle: CombatStyleId;
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
 * cooldown is real; anything with a gap is NAMED in one of the two lists below.
 * The per-talent REASON used to print beside each name and no longer does -- it
 * was written for this repository, not for a reader, and the owner cut it. The
 * reasons still exist on the effects and `class_audit.ts` still prints them.
 *
 * THE LIST IS NOT ONLY DEAD TALENTS, which is why it no longer says they "do
 * nothing". A talent can be mostly modelled and carry one caveat -- Blood
 * Craze regenerates exactly what it says and borrows only its tick cadence,
 * and Weaponmaster does the clause it can express and flags the two it
 * cannot. Calling those inert would be as wrong as saying nothing.
 *
 * Collapsible because it is tall: three trees of seven rows push the results
 * off screen on a laptop, and the trees are set once and then watched rarely.
 */
export function TalentPanel({
  characterClass,
  equipment,
  combatStyle,
  allocation,
  onChange,
  collapsed,
  onToggleCollapsed,
}: TalentPanelProps) {
  const talents = talentsForClass(characterClass);
  if (!talents) return null;

  const remaining = pointsRemaining(allocation);
  // Which of the spent talents are doing nothing. The Gear panel prints the
  // same list for items under "Equipped but not simulated"; a talent that
  // silently did nothing would look exactly like one that worked.
  /*
   * BUILT AGAINST THE GEAR, which it was not before.
   *
   * This called `talentBuild` with no context, so every conditional talent
   * reported "this character is not holding one" however the character was
   * geared -- Toughness read "no armor from items" on a warrior in a full
   * set. `talentContextFor` is the same function `createPlayer` uses, so the
   * panel and the fight cannot disagree about what is equipped.
   */
  const { unmodelled } = talentBuild(
    characterClass,
    allocation,
    // The class and allocation too, so a pet-gated talent reports the same
    // thing here that the fight applies -- the panel and the fight cannot
    // disagree, which is the whole point of sharing this function.
    talentContextFor(equipment, combatStyle, weaponsFor(equipment, combatStyle), {
      characterClass,
      talents: allocation,
      // The level the FIGHT builds at, not one off the profile: `createPlayer`
      // makes every character 60, and a panel that described a build at any
      // other level would be describing a character nobody can run.
      level: MAX_CHARACTER_LEVEL,
    }),
  );

  /*
   * Split by PERMANENCE. A `scope` means the owner ruled the effect out, so it
   * is a decision rather than work outstanding -- see `OutOfScope`.
   */
  const gaps = oncePerTalent(unmodelled.filter((entry) => entry.scope === undefined));
  const ruled = oncePerTalent(unmodelled.filter((entry) => entry.scope !== undefined));

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
          {gaps.length > 0 ? (
            <>
              <h3>Chosen but not fully simulated</h3>
              <ul className="issues">
                {gaps.map((entry: UnmodelledTalent) => (
                  <li key={entry.talentId}>
                    <strong>
                      {entry.name} ({entry.rank}/{talents.byId.get(entry.talentId)?.ranks ?? entry.rank})
                    </strong>{' '}
                    — {entry.text}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {/*
           * A RULING IS NOT A GAP, and showing the two in one list told someone
           * their build was missing features when the simulator had simply been
           * told not to model them. They do not expire and no amount of work will
           * clear them. The two headings are the whole of that distinction now --
           * the explanatory captions were cut on the owner's instruction.
           */}
          {ruled.length > 0 ? (
            <>
              <h3>Out of scope by ruling</h3>
              <ul className="issues">
                {ruled.map((entry: UnmodelledTalent) => (
                  <li key={entry.talentId}>
                    <strong>
                      {entry.name} ({entry.rank}/{talents.byId.get(entry.talentId)?.ranks ?? entry.rank})
                    </strong>{' '}
                    — {entry.text}
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
