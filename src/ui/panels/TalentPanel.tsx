import type { ClassId } from '../../game/character';
import type { ClassTalents, Talent, TalentAllocation, TalentTree } from '../../game/talents/Talent';
import { TOTAL_TALENT_POINTS } from '../../game/talents/Talent';
import { accentFor, talentsForClass } from '../../game/talents/talentData';
import { Panel } from '../components/Panel';
import { OptionGroup } from '../components/OptionGroup';
import type {
  DemonFamilyId,
  PetFamilyId,
  SummonableDemon,
} from '../../game/character/petFamilies';
import { isDemonFamilyId, isSummonableDemon } from '../../game/character/petFamilies';
import { sacrificedDemon } from '../../game/rotations/warlock';
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
  /**
   * The companion on the profile, and the setter for it.
   *
   * --------------------------------------------------------------------------
   * TWO NARROW PROPS RATHER THAN THE WHOLE PROFILE, which is deliberate: this
   * panel deliberately takes no `equipment` and no profile, and the commit that
   * removed the unmodelled list recorded why. What it needs here is one field.
   *
   * OPTIONAL, so every existing caller and test is unchanged -- without them
   * the chooser below simply does not render.
   * --------------------------------------------------------------------------
   */
  readonly petFamily?: string;
  readonly onPetFamilyChange?: (family: PetFamilyId) => void;
  /**
   * A Warlock's SUMMONED demon, and its setter -- `undefined` is none out.
   * Separate from `petFamily`, which for a Warlock is the sacrificed demon.
   */
  readonly summonedDemon?: string;
  readonly onSummonedDemonChange?: (demon: SummonableDemon | undefined) => void;
}

/**
 * Whether this build sacrifices a demon, which is what puts the chooser on
 * screen.
 *
 * ============================================================================
 * IT ASKS THE TALENT AND THE CLASS, which is the owner's own condition --
 * "a checkbox for which pet demon is sacrificed IF THEY TAKE THE DEMONIC
 * SACRIFICE TALENT". A Warlock without the talent keeps its demon and the
 * field means something else entirely; a Hunter's companion is a different
 * question with a different list.
 *
 * IT IS NOT `bringsPet` INVERTED. `bringsPet` is false for a Lone Wolf Hunter
 * too, and that build has no demon to choose.
 * ============================================================================
 */
/**
 * Whether the chosen sacrifice is cancelled by the chosen summon -- the rule
 * `sacrificedDemon` applies in the fight, asked here so the panel can say so.
 */
export function sacrificeCancelled(
  allocation: TalentAllocation,
  petFamily: string | undefined,
  summonedDemon: string | undefined,
): boolean {
  if ((allocation.demonic_sacrifice ?? 0) === 0 || petFamily === undefined) return false;
  if (!isSummonableDemon(summonedDemon)) return false;
  return sacrificedDemon(allocation, petFamily, summonedDemon) === undefined;
}

export function sacrificesADemon(
  characterClass: ClassId,
  allocation: TalentAllocation,
): boolean {
  return characterClass === 'warlock' && (allocation.demonic_sacrifice ?? 0) > 0;
}

/**
 * The three talent trees of whichever class is selected.
 *
 * Left click spends a point, right click takes one back -- the binding every
 * talent calculator has used for twenty years, so it needs no instructions.
 *
 * SOME OF THIS AFFECTS A SIMULATION AND SOME DOES NOT, and this panel NO
 * LONGER SAYS WHICH. It used to list every unmodelled talent with the reason
 * off its effect -- see the note on `talentBuild` in the commit that removed
 * it. The owner's call: that reporting is for this repository, not for a
 * person running a sim, and `tools/class_audit.ts` is where it lives now.
 *
 * It is why the panel takes no `equipment` any more. The only reason it ever
 * knew what the character was holding was to judge conditional talents for
 * that list.
 *
 * Collapsible because it is tall: three trees of seven rows push the results
 * off screen on a laptop, and the trees are set once and then watched rarely.
 */
export function TalentPanel({
  characterClass,
  allocation,
  onChange,
  petFamily,
  onPetFamilyChange,
  summonedDemon,
  onSummonedDemonChange,
}: TalentPanelProps) {
  const talents = talentsForClass(characterClass);
  if (!talents) return null;

  const remaining = pointsRemaining(allocation);
  return (
    <Panel
      title="Talents"
      className="talent-panel"
      bodyClassName="talent-body"
      collapsible
      badge={distribution(talents, allocation)}
      actions={
        <span className={remaining === 0 ? 'talent-remaining spent' : 'talent-remaining'}>
          {remaining} point{remaining === 1 ? '' : 's'} left
        </span>
      }
    >
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
      {/*
        UNDER THE TREES AND ABOVE THE SACRIFICE CHOOSER, the owner's placement:
        which demon is OUT, then which one was sacrificed. Every Warlock gets
        the first; only Demonic Sacrifice brings the second.
      */}
      {characterClass === 'warlock' && onSummonedDemonChange !== undefined ? (
        <SummonChoice value={summonedDemon} onChange={onSummonedDemonChange} />
      ) : null}
      {sacrificesADemon(characterClass, allocation) && onPetFamilyChange !== undefined ? (
        <DemonChoice value={petFamily} onChange={onPetFamilyChange} />
      ) : null}
      {sacrificeCancelled(allocation, petFamily, summonedDemon) ? (
        <p className="field-hint warn">The summoned demon cancels the sacrifice.</p>
      ) : null}
    </Panel>
  );
}

/**
 * Which demon Demonic Sacrifice killed.
 *
 * ============================================================================
 * MUTUALLY EXCLUSIVE, WHICH IS WHY IT IS A RADIO GROUP AND NOT FOUR
 * CHECKBOXES. The owner asked for "a checkbox for which pet demon is
 * sacrificed", and the field it writes is ONE id -- a Warlock summons one
 * demon and sacrifices it. Four independent checkboxes would let somebody tick
 * two and the profile could not hold the answer, which is the same structural
 * argument the consumable selection makes about one choice per category.
 *
 * `OptionGroup` is the control this app already uses for exactly that shape.
 *
 * ============================================================================
 * TWO OF THE FOUR ARE WORTH A DAMAGE FIGURE AND TWO ARE NOT, and the labels
 * say so rather than offering four options that look interchangeable. The Imp
 * is +15% Shadow and the Succubus +15% Fire -- both applied, both measured at
 * exactly x1.1500 on the school they name and x1.0000 on every other -- where
 * the Voidwalker's mana and the Felhunter's health move nothing for a profile
 * that is never attacked and never runs dry. See `DEMONIC_SACRIFICE_UNMODELLED`.
 * ============================================================================
 */
/**
 * Which demon a Warlock has OUT in the fight.
 *
 * ============================================================================
 * THREE OPTIONS, AND "NONE" IS ONE OF THEM rather than an unset radio group,
 * because no demon is a real choice -- it is what both Warlock presets make,
 * so that Demonic Sacrifice's buff stands. The tooltip cancels the sacrifice
 * if ANY demon is summoned; Demonic Pact narrows that to the sacrificed one.
 * A note under the sacrifice chooser says when the pair cancels, because a
 * sacrifice buff that silently vanished on picking a demon would read as a
 * bug.
 * ============================================================================
 */
const SUMMON_OPTIONS: readonly { readonly id: 'none' | SummonableDemon; readonly name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'imp', name: 'Imp · Firebolt' },
  { id: 'succubus', name: 'Succubus · melee, Lash of Pain' },
];

function SummonChoice({
  value,
  onChange,
}: {
  readonly value: string | undefined;
  readonly onChange: (demon: SummonableDemon | undefined) => void;
}) {
  return (
    <OptionGroup<'none' | SummonableDemon>
      label="Demon summoned"
      options={SUMMON_OPTIONS}
      value={isSummonableDemon(value) ? value : 'none'}
      onChange={(choice) => onChange(choice === 'none' ? undefined : choice)}
    />
  );
}

const DEMON_OPTIONS: readonly { readonly id: DemonFamilyId; readonly name: string }[] = [
  { id: 'imp', name: 'Imp · +15% Shadow' },
  { id: 'succubus', name: 'Succubus · +15% Fire' },
  { id: 'voidwalker', name: 'Voidwalker · mana' },
  { id: 'felhunter', name: 'Felhunter · health' },
];

function DemonChoice({
  value,
  onChange,
}: {
  readonly value: string | undefined;
  readonly onChange: (family: PetFamilyId) => void;
}) {
  /*
   * AN UNSET FIELD SHOWS NOTHING SELECTED RATHER THAN DEFAULTING TO THE IMP.
   * `sacrificedDemon` returns `undefined` when the field is absent and the
   * buff is then simply not applied -- so a profile that has not chosen gets
   * no bonus, and a chooser that pre-selected one would claim a choice the
   * file does not contain. `validateProfile` already records that asymmetry.
   */
  return (
    <OptionGroup<DemonFamilyId>
      label="Demon sacrificed"
      options={DEMON_OPTIONS}
      value={(isDemonFamilyId(value) ? value : '') as DemonFamilyId}
      onChange={onChange}
    />
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
