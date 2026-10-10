import { useState } from 'react';
import type { CharacterProfile } from '../../profiles';
import { defaultRotationFor, rotationMatchesBuild, stockListFor } from '../../profiles/rotation';
import type { AplCondition, AplEntry, DescribeNames } from '../../game/rotations/apl';
import { describeCondition } from '../../game/rotations/apl';
import { resolveCombatStyle } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import type { CatalogAura } from '../../game/auras/auraCatalog';
import { aurasForClass } from '../../game/auras/auraCatalog';
import type { Clause, ClauseKind } from './aplEditing';
import {
  addEntry,
  blankClause,
  clausesOf,
  conditionFromClauses,
  moveEntry,
  removeEntry,
  setCondition,
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
        onChange={update}
      />

      <AddEntry abilities={abilities} onAdd={(id) => update(addEntry(list.entries, id))} />
    </Panel>
  );
}

/** What an ability dropdown offers: the built character's own book. */
export function abilityChoicesFor(
  profile: CharacterProfile,
): readonly { readonly id: string; readonly name: string }[] {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  return abilitiesForClass(profile.character.characterClass, style, profile.talents)
    .map((ability) => ({ id: ability.id, name: ability.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
  onChange,
}: {
  readonly list: ShownList;
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
  readonly abilities?: readonly { readonly id: string; readonly name: string }[];
  readonly auras?: readonly CatalogAura[];
  readonly onChange?: (entries: readonly AplEntry[]) => void;
}) {
  return (
    <ol className="apl-list">
      {list.entries.map((entry, index) => (
        <li key={`${entry.abilityId}-${index}`} className="apl-entry">
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
          {entry.interruptsChannel ? (
            <span className="apl-flag" title="May cancel a channel in progress">
              interrupts
            </span>
          ) : null}
          {onChange ? (
            <span className="apl-controls">
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
 * One entry's condition: editable when it decomposes into flat clauses, and a
 * sentence when it does not.
 *
 * THE READ-ONLY CASE IS HONEST RATHER THAN A GAP. A condition built from `any`,
 * `not` or one of the four builtins cannot be drawn with these controls, and an
 * editor that silently simplified it would change what the rotation does with
 * nothing on screen to say so. The entry can still be reordered or removed;
 * only its condition is fixed.
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
  const clauses = clausesOf(condition);

  if (!onChange || clauses === undefined) {
    return (
      <span className="apl-condition">
        {condition ? (
          <>
            if {describeCondition(condition, names)}
            {onChange ? <span className="apl-fixed"> — not editable here</span> : null}
          </>
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

  const replace = (next: readonly Clause[]) => onChange(conditionFromClauses(next));

  return (
    <span className="apl-clauses">
      {clauses.length === 0 ? <span className="apl-condition muted">always</span> : null}
      {clauses.map((clause, index) => (
        <ClauseRow
          key={index}
          clause={clause}
          abilities={abilities}
          auras={auras}
          onChange={(next) => replace(clauses.map((c, at) => (at === index ? next : c)))}
          onRemove={() => replace(clauses.filter((_c, at) => at !== index))}
        />
      ))}
      <select
        className="apl-add-clause"
        value=""
        aria-label="Add a condition"
        onChange={(event) => {
          const kind = event.target.value as ClauseKind | '';
          if (!kind) return;
          replace([...clauses, blankClause(kind)]);
        }}
      >
        <option value="">+ condition</option>
        <option value="buff">Buff / debuff</option>
        <option value="resource">Resource</option>
        <option value="cooldown">Cooldown</option>
        <option value="fight">Fight remaining</option>
      </select>
    </span>
  );
}

/** One clause, as the handful of controls that kind needs. */
function ClauseRow({
  clause,
  abilities,
  auras,
  onChange,
  onRemove,
}: {
  readonly clause: Clause;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly auras: readonly CatalogAura[];
  readonly onChange: (clause: Clause) => void;
  readonly onRemove: () => void;
}) {
  const set = (patch: Partial<Clause>) => onChange({ ...clause, ...patch });
  const numberField = (value: number | undefined) => (
    <input
      type="number"
      className="apl-number"
      value={value ?? 0}
      onChange={(event) => set({ value: Number(event.target.value) })}
    />
  );
  const compareField = (withExactly: boolean) => (
    <select
      value={clause.compare}
      aria-label="Comparison"
      onChange={(event) => set({ compare: event.target.value as Clause['compare'] })}
    >
      <option value="atMost">≤</option>
      <option value="atLeast">≥</option>
      {withExactly ? <option value="exactly">=</option> : null}
    </select>
  );

  return (
    <span className="apl-clause">
      {clause.kind === 'buff' ? (
        <>
          <select
            value={clause.on}
            aria-label="Whose buff"
            onChange={(e) => set({ on: e.target.value as 'self' | 'target' })}
          >
            <option value="self">your</option>
            <option value="target">target&apos;s</option>
          </select>
          {/*
            * A REAL DROPDOWN, WHICH THE FIRST VERSION OF THIS WAS NOT. It was
            * a text box with a datalist of ABILITY ids beside it, on the
            * reasoning that most aura ids are ability ids and there was no
            * registry of the rest. Both halves were true and the conclusion was
            * wrong: choosing a buff condition meant already knowing that Fire
            * Vulnerability is `fire_vulnerability`, which you can only find by
            * reading the source or an external site.
            *
            * AND A HALF-TYPED ID IS WORSE THAN A WRONG ONE: an aura that does
            * not exist is never present, so "is up" is permanently false and
            * "has run out" is permanently true -- an entry silently disabled,
            * or silently ungated, with nothing on screen to say which.
            */}
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
            <option value="expiring">seconds left</option>
            <option value="stacks">stacks</option>
          </select>
          {clause.test === 'expiring' || clause.test === 'stacks' ? (
            <>
              {compareField(clause.test === 'stacks')}
              {numberField(clause.value)}
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
          {numberField(clause.value)}
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
          {numberField(clause.value)}
          <select
            value={clause.asPercent ? 'pct' : 'sec'}
            aria-label="Remaining unit"
            onChange={(e) => set({ asPercent: e.target.value === 'pct' })}
          >
            <option value="pct">% left</option>
            <option value="sec">seconds left</option>
          </select>
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
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const abilities = abilitiesForClass(profile.character.characterClass, style, profile.talents);
  const abilityNames = new Map(abilities.map((ability) => [ability.id, ability.name]));
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
