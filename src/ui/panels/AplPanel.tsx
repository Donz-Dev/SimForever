import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CharacterProfile } from '../../profiles';
import { defaultRotationFor, rotationMatchesBuild, stockListFor } from '../../profiles/rotation';
import type { AplCondition, AplEntry, DescribeNames } from '../../game/rotations/apl';
import { describeCondition } from '../../game/rotations/apl';
import { resolveCombatStyle } from '../../game/character';
import type { Ability } from '../../engine';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import { RACIAL_ABILITIES, racialsFor } from '../../game/racials';
import type { CatalogAura } from '../../game/auras/auraCatalog';
import { aurasForClass } from '../../game/auras/auraCatalog';
import type { Clause, ClauseKind, ConditionNode, GroupNode, NodePath } from './aplEditing';
import {
  addEntry,
  appendTo,
  blankClauseNode,
  blankGroup,
  conditionOf,
  moveEntry,
  nodeAt,
  removeAt,
  removeEntry,
  replaceAt,
  rootOf,
  setCondition,
  setDisabled,
  setGroupOp,
  setInterrupts,
  toggleNegated,
} from './aplEditing';
import { Panel } from '../components/Panel';

interface AplPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/** What a list looks like to this panel: the stored shape, or a stock one. */
interface ShownList {
  readonly name: string;
  readonly entries: readonly AplEntry[];
}

/**
 * The Action Priority List the character runs, and the controls to change it.
 *
 * ============================================================================
 * THE LIST WAS THE ONE PART OF A CHARACTER NOBODY COULD SEE OR CHANGE. Gear,
 * talents, raid buffs and consumables all have a panel; the rotation decided
 * most of the damage and was invisible, so "why is this build worse" had no
 * answer on screen and an entry that never fires looked exactly like one that
 * does.
 *
 * BETWEEN GEAR AND RAID BUFFS, the owner's placement, which reads in the right
 * order: what the character is holding, how it fights, then what the raid
 * gives it.
 *
 * EDITING MARKS THE LIST `custom`, AND THAT IS THE WHOLE SAFETY MECHANISM. A
 * `default` list re-derives when the build changes, the way gear is replaced
 * when class changes; a `custom` one is never silently replaced, and the panel
 * SAYS when it no longer matches the build's stock list rather than quietly
 * running a list meant for another spec. This project has already shipped a
 * Fire Mage that ran the Arcane list and produced a perfectly ordinary number.
 * ============================================================================
 */
export function AplPanel({ profile, onChange }: AplPanelProps) {
  const list = profile.rotation;
  const { names, nameOf } = aplNamesFor(profile);
  const abilities = abilityChoicesFor(profile);
  const auras = aurasForClass(profile.character.characterClass);
  const channels = interruptibleChannelsIn(list.entries, abilityBookFor(profile));
  const matchesBuild = rotationMatchesBuild(profile);

  /** Every edit goes through here, so nothing can change a list and forget. */
  const update = (entries: readonly AplEntry[]) => {
    onChange({
      ...profile,
      rotation: {
        /*
         * ANY EDIT MAKES IT `custom`, including one that happens to restore
         * the stock order. The field answers "may this be replaced without
         * asking", and the answer after somebody has touched it is no --
         * comparing contents instead would silently re-take ownership of a
         * list that had been edited back by hand.
         */
        source: 'custom',
        name: list.name,
        entries,
      },
    });
  };

  const reset = () => onChange({ ...profile, rotation: defaultRotationFor(profile) });

  return (
    <Panel
      title="Priority list"
      /*
       * THE LIST'S OWN NAME AS THE BADGE, which shows while the panel is SHUT.
       * It is the cheapest guard against a build running a list meant for
       * another spec -- a failure that produces an ordinary DPS figure and
       * nothing that looks wrong.
       */
      badge={list.name || 'none'}
      subtitle={
        list.entries.length > 0
          ? `${list.entries.length} entries, highest priority first${
              list.source === 'custom' ? ' · edited' : ''
            }`
          : 'No list: this build fights with auto attacks only'
      }
      actions={
        list.source === 'custom' ? (
          <button type="button" onClick={reset} title="Go back to the stock list for this build">
            Reset
          </button>
        ) : undefined
      }
      collapsible
    >
      {/*
        * THE WARNING THAT A CUSTOM LIST IS FOR A DIFFERENT BUILD. A stored list
        * does not follow the build -- that is what storing it means -- so
        * changing spec after editing leaves a list whose entries the new build
        * may not even know. `PriorityRotation` skips an ability the character
        * does not have IN SILENCE, so the symptom is a rotation that does
        * less, not an error.
        */}
      {!matchesBuild ? (
        <p className="warn apl-warning">
          This list was written for {list.name || 'another build'}; this build&apos;s stock list is{' '}
          {stockListFor(profile)?.name ?? 'none'}. Entries for abilities it does not know are
          skipped.
        </p>
      ) : null}

      <AplEntries
        list={list}
        names={names}
        nameOf={nameOf}
        abilities={abilities}
        auras={auras}
        channels={channels}
        onChange={update}
      />

      <AddEntry abilities={abilities} onAdd={(id) => update(addEntry(list.entries, id))} />
    </Panel>
  );
}

/**
 * The interruptible channels this LIST actually contains, by display name.
 *
 * ============================================================================
 * THE CHECKBOX ONLY APPEARS WHEN THERE IS SOMETHING TO INTERRUPT, which is the
 * owner's rule and is also the only way the control can be honest. Interrupting
 * is half of a pair -- a channel declares `interruptibleChannel` and an entry
 * declares `interruptsChannel`, and nothing is cancelled unless both do -- so
 * an entry ticked in a list with no interruptible channel in it would do
 * exactly nothing, for ever, with a tick in the box saying otherwise.
 *
 * READ OFF THE LIST AND THE ABILITY BOOK rather than from a list of classes.
 * Three classes have an interruptible channel today -- the Mage's Arcane
 * Missiles, the Warlock's Wrack, the Priest's Mind Flay -- and writing those
 * three down here would be a fourth place to remember when a fifth arrives.
 *
 * AND EVOCATION IS NOT AMONG THEM, which is the whole reason a Mage can be
 * offered this safely: it is the other Mage channel and is deliberately not
 * marked interruptible, so a Mage's checkbox can only ever cut Arcane Missiles
 * short. The label says which, so nobody has to take that on trust.
 * ============================================================================
 */
export function interruptibleChannelsIn(
  entries: readonly AplEntry[],
  book: readonly Ability[],
): readonly { readonly id: string; readonly name: string }[] {
  const byId = new Map(book.map((ability) => [ability.id, ability]));
  const found = new Map<string, string>();
  for (const entry of entries) {
    const ability = byId.get(entry.abilityId);
    if (ability?.interruptibleChannel) found.set(ability.id, ability.name);
  }
  return [...found.entries()].map(([id, name]) => ({ id, name }));
}

/** What an ability dropdown offers: the built character's own book. */
export function abilityChoicesFor(
  profile: CharacterProfile,
): readonly { readonly id: string; readonly name: string }[] {
  return abilityBookFor(profile)
    .map((ability) => ({ id: ability.id, name: ability.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The abilities THIS build knows -- style, talents and RACE included.
 *
 * ============================================================================
 * THE RACE IS THE PART THAT IS EASY TO MISS, because `abilitiesForClass` is the
 * obvious source and a racial belongs to no class: a Gnome Warrior and a Gnome
 * Mage learn the same Eureka!. Leaving it out cost two separate things, and the
 * panel showed no error for either.
 *
 * THE NAME. `aplNamesFor` falls back to prettifying the id, which is right for
 * an aura -- "`shadow_trance` reading as Shadow Trance is honest" -- and gets
 * two of the five racials wrong: `elunes_light` reads "Elunes Light" and
 * `eureka` reads "Eureka". Close enough to look deliberate.
 *
 * THE DROPDOWN. Every list names all four free racial cooldowns, so somebody
 * who removed one could not add it back: the "add an entry" dropdown offers
 * this book, and the entry they had just deleted was not in it.
 *
 * `racialBuild` IS NOT USED HERE, deliberately. It needs the equipment to
 * answer a weapon clause and none of the five abilities has one, so the race's
 * granted set is read straight off `RACIALS` -- which also means the panel does
 * not have to resolve gear to name an entry.
 * ============================================================================
 */
export function abilityBookFor(profile: CharacterProfile): readonly Ability[] {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const racials = racialsFor(profile.character.race)
    .flatMap((trait) => trait.effects)
    .flatMap((effect) =>
      effect.kind === 'grantAbility' ? [RACIAL_ABILITIES[effect.abilityId]] : [],
    )
    .filter((ability): ability is Ability => ability !== undefined);
  return [
    ...abilitiesForClass(profile.character.characterClass, style, profile.talents),
    ...racials,
  ];
}

/**
 * The entries themselves, SEPARATE FROM THE PANEL so a test can render them.
 *
 * `Panel` is `useState(!startOpen)` and this one is collapsible, so it starts
 * SHUT and renders no body in a static render -- a test going through
 * `AplPanel` would pass every "contains" check by containing nothing.
 * `gearPanelStone.test.ts` learned that from a failing test.
 */
export function AplEntries({
  list,
  names,
  nameOf,
  abilities,
  auras,
  channels,
  onChange,
}: {
  readonly list: ShownList;
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
  readonly abilities?: readonly { readonly id: string; readonly name: string }[];
  readonly auras?: readonly CatalogAura[];
  /** The interruptible channels in this list, if any. See the helper above. */
  readonly channels?: readonly { readonly id: string; readonly name: string }[];
  readonly onChange?: (entries: readonly AplEntry[]) => void;
}) {
  return (
    <ol className="apl-list">
      {list.entries.map((entry, index) => (
        <li
          key={`${entry.abilityId}-${index}`}
          className={entry.disabled ? 'apl-entry apl-entry-off' : 'apl-entry'}
        >
          <span className="apl-rank">{index + 1}</span>
          <div className="apl-body">
            <span className="apl-ability">{nameOf(entry.abilityId)}</span>
            <EntryCondition
              condition={entry.condition}
              names={names}
              abilities={abilities ?? []}
              auras={auras ?? []}
              onChange={
                onChange
                  ? (condition) => onChange(setCondition(list.entries, index, condition))
                  : undefined
              }
            />
            {entry.note ? <span className="apl-note">{entry.note}</span> : null}
          </div>
          <InterruptToggle
            entry={entry}
            /*
             * NOT OFFERED ON THE CHANNEL'S OWN ENTRY. `selectInterrupt` is only
             * consulted while the actor is channelling, so a tick here would
             * mean "cancel this channel to cast it again" -- which is a loop,
             * not a rotation.
             */
            channels={(channels ?? []).filter((channel) => channel.id !== entry.abilityId)}
            onChange={
              onChange
                ? (interrupts) => onChange(setInterrupts(list.entries, index, interrupts))
                : undefined
            }
          />
          {onChange ? (
            <span className="apl-controls">
              {/*
                * SWITCHED OFF RATHER THAN REMOVED, which is what the owner
                * asked for: "a way I can easily toggle an APL line's
                * visibility so I don't have to remove the line entirely just
                * to re-add it later."
                *
                * FIRST IN THE ROW, left of the two movers and well left of the
                * ✕, because it is the thing somebody reaches for INSTEAD of
                * the ✕ and the two should not be neighbours.
                */}
              <button
                type="button"
                className="apl-toggle"
                aria-pressed={entry.disabled !== true}
                title={entry.disabled ? 'Switch this entry on' : 'Switch this entry off'}
                onClick={() => onChange(setDisabled(list.entries, index, entry.disabled !== true))}
              >
                {entry.disabled ? '🚫' : '👁'}
              </button>
              <button
                type="button"
                title="Move up"
                disabled={index === 0}
                onClick={() => onChange(moveEntry(list.entries, index, -1))}
              >
                ▲
              </button>
              <button
                type="button"
                title="Move down"
                disabled={index === list.entries.length - 1}
                onClick={() => onChange(moveEntry(list.entries, index, 1))}
              >
                ▼
              </button>
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(removeEntry(list.entries, index))}
              >
                ✕
              </button>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * One entry's condition, as an editable TREE.
 *
 * ============================================================================
 * IT USED TO BE A FLAT LIST OF `all` CLAUSES, AND THAT LOCKED 51 OF THE 132
 * CONDITIONS IN THE STOCK LISTS. One `not` anywhere, or one `any`, made the
 * whole condition read-only -- so the Rogue's pooling gates, the Paladin's
 * entire seal twist, the Mage's Scorch and the Priest's hold band could be
 * read and not touched.
 *
 * A LEAF THE PANEL CANNOT DRAW NO LONGER POISONS THE REST. A builtin or a
 * swing-timer read is ONE fixed row inside a tree that is otherwise fully
 * editable, where before it made everything around it read-only too.
 * ============================================================================
 */
function EntryCondition({
  condition,
  names,
  abilities,
  auras,
  onChange,
}: {
  readonly condition: AplCondition | undefined;
  readonly names: DescribeNames;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly auras: readonly CatalogAura[];
  readonly onChange?: (condition: AplCondition | undefined) => void;
}) {
  if (!onChange) {
    return (
      <span className="apl-condition">
        {condition ? (
          <>if {describeCondition(condition, names)}</>
        ) : (
          /*
           * SAID RATHER THAN LEFT BLANK. An unconditional entry is a FLOOR
           * under everything below it -- nothing cheaper and ungated beneath
           * it can ever be the first castable entry -- so it is the single
           * most important thing to read off a list, and an empty cell reads
           * as "no information" instead of as "always".
           */
          <span className="muted">always</span>
        )}
      </span>
    );
  }

  const root = rootOf(condition);
  const update = (next: ConditionNode) =>
    onChange(conditionOf(next as GroupNode));

  return (
    <span className="apl-clauses">
      {root.children.length === 0 ? <span className="apl-condition muted">always</span> : null}
      <GroupEditor
        root={root}
        path={[]}
        names={names}
        abilities={abilities}
        auras={auras}
        onChange={update}
      />
    </span>
  );
}

/**
 * A group of conditions: "all of" or "any of", with its children under it.
 *
 * THE ROOT HIDES ITS OWN OPERATOR WHILE IT HAS FEWER THAN TWO CHILDREN,
 * because "all of" above a single clause is noise -- the overwhelmingly common
 * case is one or two ANDed clauses, and the control appears when it starts to
 * mean something.
 */
function GroupEditor({
  root,
  path,
  names,
  abilities,
  auras,
  onChange,
}: {
  readonly root: ConditionNode;
  readonly path: NodePath;
  readonly names: DescribeNames;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly auras: readonly CatalogAura[];
  readonly onChange: (root: ConditionNode) => void;
}) {
  const group = nodeAt(root, path);
  if (!group || group.kind !== 'group') return null;
  const isRoot = path.length === 0;
  const showOp = group.children.length > 1 || !isRoot;

  return (
    <span className={isRoot ? 'apl-group apl-group-root' : 'apl-group'}>
      {showOp ? (
        <span className="apl-group-head">
          {!isRoot ? (
            <NotToggle
              negated={group.negated}
              onToggle={() => onChange(toggleNegated(root, path))}
            />
          ) : null}
          <select
            value={group.op}
            aria-label="Match all or any"
            onChange={(event) =>
              onChange(setGroupOp(root, path, event.target.value as 'all' | 'any'))
            }
          >
            <option value="all">all of</option>
            <option value="any">any of</option>
          </select>
          {!isRoot ? (
            <button
              type="button"
              className="apl-clause-remove"
              title="Remove this group"
              onClick={() => onChange(removeAt(root, path))}
            >
              ✕
            </button>
          ) : null}
        </span>
      ) : null}

      <span className="apl-group-children">
        {group.children.map((_child, index) => (
          <NodeEditor
            key={index}
            root={root}
            path={[...path, index]}
            names={names}
            abilities={abilities}
            auras={auras}
            onChange={onChange}
          />
        ))}

        <span className="apl-adders">
          <select
            className="apl-add-clause"
            value=""
            aria-label="Add a condition"
            onChange={(event) => {
              const kind = event.target.value as ClauseKind | '';
              if (!kind) return;
              onChange(appendTo(root, path, blankClauseNode(kind)));
            }}
          >
            <option value="">+ condition</option>
            <option value="buff">Buff / debuff</option>
            <option value="resource">Resource</option>
            <option value="cooldown">Cooldown</option>
            <option value="fight">Fight timing</option>
            <option value="health">Health</option>
          </select>
          {/*
            * A NESTED GROUP IS WHAT MAKES "a and (b or c)" SAYABLE, which is
            * the shape the Mage's Scorch and the Paladin's seal twist are
            * written in. It defaults to `any`, because a group matching its
            * parent's operator would do nothing a flat list does not.
            */}
          <button
            type="button"
            className="apl-add-group"
            title="Add a nested group"
            onClick={() => onChange(appendTo(root, path, blankGroup()))}
          >
            + group
          </button>
        </span>
      </span>
    </span>
  );
}

/** One row of a group: a clause, a fixed condition, or a nested group. */
function NodeEditor({
  root,
  path,
  names,
  abilities,
  auras,
  onChange,
}: {
  readonly root: ConditionNode;
  readonly path: NodePath;
  readonly names: DescribeNames;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly auras: readonly CatalogAura[];
  readonly onChange: (root: ConditionNode) => void;
}) {
  const node = nodeAt(root, path);
  if (!node) return null;

  if (node.kind === 'group') {
    return (
      <GroupEditor
        root={root}
        path={path}
        names={names}
        abilities={abilities}
        auras={auras}
        onChange={onChange}
      />
    );
  }

  const notToggle = (
    <NotToggle negated={node.negated} onToggle={() => onChange(toggleNegated(root, path))} />
  );
  const remove = (
    <button
      type="button"
      className="apl-clause-remove"
      title="Remove this condition"
      onClick={() => onChange(removeAt(root, path))}
    >
      ✕
    </button>
  );

  /*
   * A FIXED LEAF IS SHOWN AS ITS SENTENCE AND SAYS SO. It can be negated,
   * moved with its group, or removed; what it cannot be is rewritten, because
   * there are no controls that mean what it means. An editor that silently
   * simplified one would change the rotation with nothing on screen to say so.
   */
  if (node.kind === 'fixed') {
    return (
      <span className="apl-clause apl-clause-fixed">
        {notToggle}
        <span className="apl-condition">{describeCondition(node.condition, names)}</span>
        <span className="apl-fixed">— fixed</span>
        {remove}
      </span>
    );
  }

  return (
    <ClauseRow
      clause={node.clause}
      abilities={abilities}
      auras={auras}
      before={notToggle}
      onChange={(clause) => onChange(replaceAt(root, path, { ...node, clause }))}
      onRemove={() => onChange(removeAt(root, path))}
    />
  );
}

/**
 * Whether this entry is worth cutting a channel short for.
 *
 * IT USED TO BE BAKED IN: three Warlock entries carried the flag and nothing
 * else could, so a real rotation decision was expressible only in TypeScript.
 *
 * THE LABEL NAMES THE CHANNEL, because "interrupt" on its own does not say
 * what -- and for a Mage the answer matters: Arcane Missiles is interruptible
 * and Evocation deliberately is not, so the box can only ever cut the one it
 * names. Shown read-only when the list has no interruptible channel in it,
 * because a tick that could never fire is worse than no control at all.
 */
function InterruptToggle({
  entry,
  channels,
  onChange,
}: {
  readonly entry: AplEntry;
  readonly channels: readonly { readonly id: string; readonly name: string }[];
  readonly onChange?: (interrupts: boolean) => void;
}) {
  const names = channels.map((channel) => channel.name).join(' or ');

  if (!onChange || channels.length === 0) {
    // Still SAID when it is set, so a list that interrupts reads as one --
    // and a flag that somehow survived its channel leaving the list is
    // visible rather than silent.
    return entry.interruptsChannel ? (
      <span className="apl-flag" title="May cancel a channel in progress">
        interrupts
      </span>
    ) : null;
  }

  return (
    <label className="apl-interrupt" title={`Cancel ${names} in progress to cast this`}>
      <input
        type="checkbox"
        checked={entry.interruptsChannel === true}
        onChange={(event) => onChange(event.target.checked)}
      />
      interrupt {names}
    </label>
  );
}

/**
 * The `not` toggle.
 *
 * A BUTTON THAT STAYS LIT rather than a checkbox, because it reads as part of
 * the sentence the row makes -- "not  your Cutthroat is up" -- and because a
 * checkbox at this size is hard to see the state of.
 */
function NotToggle({
  negated,
  onToggle,
}: {
  readonly negated: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={negated ? 'apl-not apl-not-on' : 'apl-not'}
      aria-pressed={negated}
      title={negated ? 'Negated: remove the not' : 'Negate this condition'}
      onClick={onToggle}
    >
      not
    </button>
  );
}

/** One clause, as the handful of controls that kind needs. */
function ClauseRow({
  clause,
  abilities,
  auras,
  before,
  onChange,
  onRemove,
}: {
  readonly clause: Clause;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly auras: readonly CatalogAura[];
  readonly before?: ReactNode;
  readonly onChange: (clause: Clause) => void;
  readonly onRemove: () => void;
}) {
  const set = (patch: Partial<Clause>) => onChange({ ...clause, ...patch });
  const numberField = (value: number | undefined, suffix?: string) => (
    <>
      <input
        type="number"
        className="apl-number"
        value={value ?? 0}
        aria-label="Amount"
        onChange={(event) => set({ value: Number(event.target.value) })}
      />
      {suffix ? <span className="apl-unit">{suffix}</span> : null}
    </>
  );
  /*
   * `below` AND `above` ARE OFFERED, and they are not decoration: the stock
   * lists write "under 5 stacks" and "under 15% mana", and leaving them out
   * was what locked those conditions out of the editor entirely. They are
   * STRICT where the others are not, which matters at exactly the value a
   * stack count or a resource lands on.
   */
  const compareField = (withExactly: boolean) => (
    <select
      value={clause.compare}
      aria-label="Comparison"
      onChange={(event) => set({ compare: event.target.value as Clause['compare'] })}
    >
      <option value="atMost">≤</option>
      <option value="atLeast">≥</option>
      <option value="below">&lt;</option>
      <option value="above">&gt;</option>
      {withExactly ? <option value="exactly">=</option> : null}
    </select>
  );

  return (
    <span className="apl-clause">
      {before}
      {clause.kind === 'buff' ? (
        <>
          <select
            value={clause.on}
            aria-label="Whose buff"
            onChange={(e) => set({ on: e.target.value as Clause['on'] })}
          >
            <option value="self">your</option>
            <option value="target">target&apos;s</option>
            <option value="pet">pet&apos;s</option>
          </select>
          <AuraChoice
            auraId={clause.auraId ?? ''}
            auras={auras}
            preferDebuffs={clause.on === 'target'}
            onChange={(auraId) => set({ auraId })}
          />
          <select
            value={clause.test}
            aria-label="Buff test"
            onChange={(e) => set({ test: e.target.value as Clause['test'] })}
          >
            <option value="down">has run out</option>
            <option value="absent">is not up</option>
            <option value="up">is up</option>
            {/*
              * A PET CAN ONLY BE ASKED WHETHER AN AURA IS THERE -- `auraTime`
              * and `auraStacks` read `self` or `target` and nothing else, so
              * offering the clock for a pet would be a control whose value the
              * data model cannot hold.
              */}
            {clause.on !== 'pet' ? <option value="expiring">seconds left</option> : null}
            {clause.on !== 'pet' ? <option value="stacks">stacks</option> : null}
          </select>
          {clause.test === 'expiring' || clause.test === 'stacks' ? (
            <>
              {compareField(clause.test === 'stacks')}
              {numberField(clause.value, clause.test === 'expiring' ? 's' : undefined)}
            </>
          ) : null}
        </>
      ) : null}

      {clause.kind === 'resource' ? (
        <>
          <select
            value={clause.resource}
            aria-label="Resource"
            onChange={(e) => set({ resource: e.target.value as Clause['resource'] })}
          >
            <option value="rage">rage</option>
            <option value="energy">energy</option>
            <option value="mana">mana</option>
            <option value="focus">focus</option>
            <option value="combo">combo points</option>
          </select>
          {compareField(true)}
          {numberField(clause.value, clause.asPercent ? '%' : undefined)}
          {/* Combo points have no maximum worth comparing against. */}
          {clause.resource !== 'combo' ? (
            <select
              value={clause.asPercent ? 'percent' : 'flat'}
              aria-label="Amount or share"
              onChange={(e) => set({ asPercent: e.target.value === 'percent' })}
            >
              <option value="flat">points</option>
              <option value="percent">% of max</option>
            </select>
          ) : null}
        </>
      ) : null}

      {clause.kind === 'cooldown' ? (
        <>
          <select
            className="apl-aura"
            value={clause.abilityId ?? ''}
            aria-label="Ability"
            onChange={(e) => set({ abilityId: e.target.value })}
          >
            <option value="">(choose)</option>
            {abilities.map((ability) => (
              <option key={ability.id} value={ability.id}>
                {ability.name}
              </option>
            ))}
          </select>
          <select
            value={clause.ready ? 'ready' : 'cd'}
            aria-label="Cooldown state"
            onChange={(e) => set({ ready: e.target.value === 'ready' })}
          >
            <option value="ready">is ready</option>
            <option value="cd">is on cooldown</option>
          </select>
        </>
      ) : null}

      {clause.kind === 'fight' ? (
        <>
          {compareField(false)}
          {numberField(clause.value, clause.unit === 'percentLeft' ? '%' : 's')}
          <select
            value={clause.unit}
            aria-label="Fight timing"
            onChange={(e) => set({ unit: e.target.value as Clause['unit'] })}
          >
            <option value="percentLeft">of the fight left</option>
            <option value="secondsLeft">seconds left</option>
            <option value="secondsElapsed">seconds since the pull</option>
          </select>
        </>
      ) : null}

      {clause.kind === 'health' ? (
        <>
          <span className="apl-unit">your health</span>
          {compareField(false)}
          {numberField(clause.value, '%')}
        </>
      ) : null}

      <button
        type="button"
        className="apl-clause-remove"
        title="Remove this condition"
        onClick={onRemove}
      >
        ✕
      </button>
    </span>
  );
}

/**
 * Choosing a buff or debuff BY NAME, grouped so the likely half comes first.
 *
 * ----------------------------------------------------------------------------
 * BOTH GROUPS ARE ALWAYS OFFERED, with the one matching the clause's subject on
 * top. Filtering to debuffs alone for a target clause would be tidier and
 * wrong: the Druid's Bear list asks whether the TARGET has Demoralizing Shout
 * -- a Warrior debuff -- and a Paladin's echo seals are buffs the character
 * carries. Ordering helps; hiding would send somebody back to finding ids.
 *
 * AN ID THE CATALOG DOES NOT KNOW IS KEPT AS ITS OWN OPTION rather than
 * silently falling back to the first entry. A hand-edited file or a renamed
 * aura would otherwise have its condition quietly rewritten to name something
 * else the moment the panel drew it.
 * ----------------------------------------------------------------------------
 */
function AuraChoice({
  auraId,
  auras,
  preferDebuffs,
  onChange,
}: {
  readonly auraId: string;
  readonly auras: readonly CatalogAura[];
  readonly preferDebuffs: boolean;
  readonly onChange: (auraId: string) => void;
}) {
  const debuffs = auras.filter((aura) => aura.isDebuff);
  const buffs = auras.filter((aura) => !aura.isDebuff);
  const groups = preferDebuffs
    ? [
        { label: 'Debuffs', auras: debuffs },
        { label: 'Buffs', auras: buffs },
      ]
    : [
        { label: 'Buffs', auras: buffs },
        { label: 'Debuffs', auras: debuffs },
      ];
  const unknown = auraId.length > 0 && !auras.some((aura) => aura.id === auraId);

  return (
    <select
      className="apl-aura"
      value={auraId}
      aria-label="Buff or debuff"
      onChange={(event) => onChange(event.target.value)}
    >
      {/*
        * AN EMPTY CHOICE THAT STAYS SELECTABLE, because a newly added clause
        * has no aura yet and the alternative is defaulting to whichever name
        * happens to sort first -- a condition nobody chose, reading as one
        * they did.
        */}
      <option value="">(choose a buff)</option>
      {unknown ? <option value={auraId}>{auraId} (not in this build)</option> : null}
      {groups.map((group) =>
        group.auras.length > 0 ? (
          <optgroup key={group.label} label={group.label}>
            {group.auras.map((aura) => (
              <option key={aura.id} value={aura.id}>
                {aura.name}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );
}

/** The control that puts another ability in the list. */
function AddEntry({
  abilities,
  onAdd,
}: {
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly onAdd: (abilityId: string) => void;
}) {
  const [chosen, setChosen] = useState('');
  return (
    <div className="apl-add">
      <select
        value={chosen}
        aria-label="Ability to add"
        onChange={(event) => setChosen(event.target.value)}
      >
        <option value="">Add an ability...</option>
        {abilities.map((ability) => (
          <option key={ability.id} value={ability.id}>
            {ability.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={chosen === ''}
        onClick={() => {
          onAdd(chosen);
          setChosen('');
        }}
      >
        Add
      </button>
    </div>
  );
}

/**
 * The name lookup the panel builds, exported so a test renders the SAME one.
 *
 * Names come from the built ability book, so an entry reads "Mortal Strike"
 * rather than `mortal_strike` -- and it is the book for THIS build, style and
 * talents included, so a talent-granted ability is named too.
 *
 * AURA IDS FALL BACK TO A PRETTIFIED ID, because there is no registry of every
 * aura's display name and inventing one for a panel would be a second place
 * for a name to live. Most aura ids ARE ability ids, so the book answers for
 * most of them, and `shadow_trance` reading as "Shadow Trance" is honest.
 */
export function aplNamesFor(profile: CharacterProfile): {
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
} {
  /*
   * THROUGH `abilityBookFor` RATHER THAN `abilitiesForClass`, so the names and
   * the dropdown cannot disagree about what the build knows. They did: this
   * read the class book and the race's five abilities were absent, so two of
   * them fell back to a prettified id.
   */
  const abilityNames = new Map(
    abilityBookFor(profile).map((ability) => [ability.id, ability.name]),
  );
  const nameOf = (id: string) => abilityNames.get(id) ?? prettify(id);
  return { names: { ability: nameOf, aura: nameOf }, nameOf };
}

/** `shadow_word_pain` to `Shadow Word Pain`. */
function prettify(id: string): string {
  return id
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}
