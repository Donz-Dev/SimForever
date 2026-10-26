import type { AplSection } from '../../profiles/aplSections';
import { setSection, withSection } from '../../profiles/aplSections';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CharacterProfile } from '../../profiles';
import { defaultRotationFor, rotationMatchesBuild, stockListFor } from '../../profiles/rotation';
import type { AplCondition, AplEntry, DescribeNames } from '../../game/rotations/apl';
import { describeCondition } from '../../game/rotations/apl';
import { resolveCombatStyle } from '../../game/character';
import type { Ability, PrecombatAction } from '../../engine';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import { precombatStateFor } from '../../game/abilities/precombatStates';
import { appliesDot } from '../../game/abilities/dots';
import {
  START_AUTO_ATTACK_ABILITIES,
  START_AUTO_ATTACK_IDS,
  START_AUTO_ATTACK_LABELS,
  defaultStartAutoAttackMode,
  isStartAutoAttack,
  startAutoAttackModeOf,
} from '../../game/abilities/autoAttack';
import {
  DEFAULT_MELEE_WEAVE_ACTIONS,
  MELEE_WEAVE_ID,
  MELEE_WEAVE_RAPTOR_STRIKE,
  meleeWeaveAbility,
  meleeWeaveRunMs,
} from '../../game/abilities/meleeWeave';
import { RACIAL_ABILITIES, racialsFor } from '../../game/racials';
import { consumableAbilities } from '../../game/buffs/consumables';
import type { CatalogAura } from '../../game/auras/auraCatalog';
import { aurasForClass } from '../../game/auras/auraCatalog';
import type { Clause, ClauseKind, ConditionNode, GroupNode, NodePath } from './aplEditing';
import {
  addEntry,
  appendTo,
  blankClauseNode,
  blankGroup,
  conditionOf,
  duplicateEntry,
  moveEntry,
  nodeAt,
  removeAt,
  removeEntry,
  replaceAt,
  rootOf,
  setAbility,
  setSequence,
  setCondition,
  setDisabled,
  setGroupOp,
  setInterrupts,
  setMultiDot,
  setCancel,
  setTarget,
  toggleNegated,
} from './aplEditing';
import { Panel } from '../components/Panel';
import { AbilityCardContext, AbilityHover } from '../components/AbilityCard';

interface AplPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
  /** Which of the two lists this panel edits (round 64). See `aplSections`. */
  readonly section: AplSection;
}

/**
 * Each section's title. Single Target runs DPS and tank fights at one target
 * and the tank healer; Multi Target runs them at 2+ targets and the raid healer.
 */
const SECTION_TITLE: Record<AplSection, string> = {
  single: 'APL: Single Target',
  multi: 'APL: Multi Target',
};

/** What a list looks like to this panel: the stored shape, or a stock one. */
interface ShownList {
  readonly name: string;
  readonly entries: readonly AplEntry[];
  readonly smartHealing?: boolean;
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
export function AplPanel({ profile: whole, onChange: change, section }: AplPanelProps) {
  /*
   * ONE SECTION AT A TIME (round 64): the section's lists are swapped into the
   * profile's root, everything below edits the root as it always did, and each
   * edit is written back to that section. The Single Target lists ARE the root.
   */
  const profile = withSection(whole, section);
  const onChange = (next: CharacterProfile) => change(setSection(whole, section, next));
  const multi = section === 'multi';
  const list = profile.rotation;
  const { names, nameOf } = aplNamesFor(profile);
  const abilities = abilityChoicesFor(profile);
  const auras = aurasForClass(profile.character.characterClass);
  const book = abilityBookFor(profile);
  const channels = interruptibleChannelsIn(list.entries, book);
  const heals = healsIn(book);
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
        ...(list.smartHealing ? { smartHealing: true } : {}),
      },
    });
  };

  /*
   * PRE-COMBAT EDITS DO NOT MARK THE LIST `custom`, which is the one thing
   * worth getting right here: the two are stored apart precisely because the
   * priority list follows the build and this does not. Adding a pre-pull
   * Stealth must not stop a `default` list re-deriving when the build changes.
   *
   * AN EMPTY LIST IS DROPPED rather than stored as `[]`, the rule `disabled`
   * already follows: absent and empty are different FILES.
   */
  const updatePrecombat = (actions: readonly PrecombatAction[]) => {
    const { precombat: _dropped, ...rest } = profile;
    onChange(actions.length > 0 ? { ...rest, precombat: actions } : rest);
  };

  const reset = () => onChange({ ...profile, rotation: defaultRotationFor(profile) });
  // Every ability named below shows its hover card from this.
  const cardSource = {
    characterClass: profile.character.characterClass,
    book: new Map(book.map((ability) => [ability.id, ability])),
  };

  return (
    <AbilityCardContext.Provider value={cardSource}>
    <Panel
      title={SECTION_TITLE[section]}
      // The list's name, which fights run it and its entry count are gone from
      // the header (round 66, the owner's declutter).
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

      {/*
        * ABOVE THE LIST, which is where the owner asked for it and is the
        * order the fight happens in.
        */}
      <PrecombatSection
        profile={profile}
        actions={profile.precombat ?? []}
        abilities={abilities}
        nameOf={nameOf}
        onChange={updatePrecombat}
      />

      {/*
        * SMART HEALING, LIST-WIDE (round 54). Offered only on a list that heals
        * somebody -- an entry with a friendly target -- because it changes
        * nothing anywhere else. Toggling it is an edit, so the list goes
        * `custom` like any other.
        */}
      {list.entries.some((entry) => entry.target !== undefined) ? (
        <label
          className="apl-smart-healing"
          title="Every heal goes to whoever has the lowest health percentage, the tank included"
        >
          <input
            type="checkbox"
            checked={list.smartHealing === true}
            onChange={(event) => {
              const { smartHealing: _dropped, ...rest } = list;
              onChange({
                ...profile,
                rotation: {
                  ...rest,
                  source: 'custom',
                  ...(event.target.checked ? { smartHealing: true } : {}),
                },
              });
            }}
          />
          Smart healing: each heal goes to the lowest health % target
        </label>
      ) : null}

      <AplEntries
        list={list}
        names={names}
        nameOf={nameOf}
        abilities={abilities}
        auras={auras}
        channels={channels}
        heals={heals}
        // Round 64: the target controller and Multi-DoT are the MULTI TARGET
        // list's, and the Single Target list shows neither.
        multiTarget={multi}
        targets={multi}
        onChange={update}
      />

      <AddEntry abilities={abilities} onAdd={(id) => update(addEntry(list.entries, id))} />
    </Panel>
    </AbilityCardContext.Provider>
  );
}

/**
 * What the character did before the pull.
 *
 * ==============================================================================
 * "A SMALL SECTION ABOVE THE MAIN APL CONTROLLER - BUT WITHIN THE SAME PANEL",
 * the owner's own placement, and it reads in the order the fight happens:
 * what was done before the pull, then what is done during it.
 *
 * IT IS STORED ON THE PROFILE ROOT RATHER THAN ON `rotation`, which is the one
 * place where where-it-is-edited and where-it-is-stored differ.
 * `syncDefaultRotation` REPLACES a `default` rotation object whenever the
 * build changes -- a talent, a stance, a class, even a consumable selection --
 * and a pre-combat list kept inside it would be wiped by any of them with
 * nothing on screen to say so.
 *
 * THE LEAD TIME IS REAL, on the owner's ruling: a buff used two seconds early
 * has two seconds less left at the pull, and a cooldown comes back two seconds
 * sooner. The hint under the controls says so, because a number that LOOKS
 * like documentation and is actually simulated is worth stating.
 * ==============================================================================
 */
function PrecombatSection({
  profile,
  actions,
  abilities,
  nameOf,
  onChange,
}: {
  /*
   * THE WHOLE PROFILE, FOR ONE QUESTION: is a declared action already in
   * effect? `PRECOMBAT_STATES` answers it per CHARACTER rather than per id --
   * `cat_form` is true for a Druid in Cat Form and false for a Moonkin -- so a
   * list of ids would not have been enough.
   */
  readonly profile: CharacterProfile;
  readonly actions: readonly PrecombatAction[];
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly nameOf: (abilityId: string) => string;
  readonly onChange: (actions: readonly PrecombatAction[]) => void;
}) {
  const replace = (index: number, action: PrecombatAction) =>
    onChange(actions.map((current, at) => (at === index ? action : current)));

  return (
    <section className="apl-precombat">
      <h4 className="apl-precombat-title">Before the pull</h4>

      {actions.length === 0 ? (
        <p className="field-hint">None.</p>
      ) : (
        <ol className="apl-precombat-list">
          {actions.map((action, index) => (
            <li key={`${action.abilityId}-${index}`} className="apl-precombat-row">
              <AbilityHover abilityId={action.abilityId}>
              <select
                className="apl-ability apl-ability-choice"
                value={choiceValue(action.abilityId, abilities)}
                aria-label="Pre-combat ability"
                onChange={(event) =>
                  replace(index, { ...action, abilityId: chosenId(action.abilityId, event.target.value) })
                }
              >
                {/* Kept so a loaded profile naming an ability this build does
                    not have SAYS so rather than silently showing another.

                    AND "ALREADY IN EFFECT" IS A THIRD ANSWER, not a kinder
                    wording of the second. Seven of the owner's opener lines
                    name a STATE -- the three Druid forms and a Rogue's Stealth
                    -- which no ability provides, so this read "Cat Form (not in
                    this build)" on a Druid that is in Cat Form. Exactly
                    backwards, and on the one row a reader is checking to see
                    that it IS. See `PRECOMBAT_STATES`. */}
                {abilities.some((ability) => ability.id === choiceValue(action.abilityId, abilities)) ? null : (
                  <option value={action.abilityId}>
                    {precombatStateFor(profile, action.abilityId)
                      ? `${precombatStateFor(profile, action.abilityId)!.name} (already in effect)`
                      : `${nameOf(action.abilityId)} (not in this build)`}
                  </option>
                )}
                {abilities.map((ability) => (
                  <option key={ability.id} value={ability.id}>
                    {ability.name}
                  </option>
                ))}
              </select>
              </AbilityHover>

              <StartKind
                abilityId={action.abilityId}
                onChange={(abilityId) => replace(index, { ...action, abilityId })}
              />

              <span className="apl-precombat-at">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={action.secondsBefore}
                  aria-label="Seconds before combat"
                  onChange={(event) =>
                    replace(index, {
                      ...action,
                      secondsBefore: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
                <span className="apl-precombat-unit">sec before combat</span>
              </span>

              <button
                type="button"
                title="Remove this pre-combat action"
                onClick={() => onChange(actions.filter((_, at) => at !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <select
        className="apl-sequence-add"
        value=""
        aria-label="Add a pre-combat action"
        onChange={(event) => {
          if (!event.target.value) return;
          /*
           * A NEW ACTION GOES AT THE BOTTOM AND DEFAULTS TO ONE SECOND, which
           * is a figure rather than zero on purpose: zero means "at the pull",
           * which is what an ordinary priority entry already does, so a
           * pre-combat row that defaulted to it would do nothing different
           * and read as broken.
           */
          onChange([...actions, { abilityId: event.target.value, secondsBefore: 1 }]);
        }}
      >
        <option value="">+ before the pull…</option>
        {abilities.map((ability) => (
          <option key={ability.id} value={ability.id}>
            {ability.name}
          </option>
        ))}
      </select>

    </section>
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
  /*
   * START AUTO-ATTACK IS ONE ACTION WITH A KIND (round 65): the three abilities
   * collapse into one choice, standing in as the build's own kind -- the owner's
   * "by default the appropriate one should be identified and pre-populated" --
   * and a second dropdown beside the entry picks the kind.
   */
  const startDefault = startDefaultFor(profile);
  return [
    ...abilityBookFor(profile)
      .filter((ability) => !isStartAutoAttack(ability.id))
      .map((ability) => ({ id: ability.id, name: ability.name })),
    { id: startDefault, name: 'Start Auto-attack' },
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** The Start Auto-attack kind a build gets by default, as an ability id. */
export function startDefaultFor(profile: CharacterProfile): string {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  return START_AUTO_ATTACK_IDS[defaultStartAutoAttackMode(style)];
}

/**
 * THE KIND OF A START AUTO-ATTACK, beside it (round 65): Main Hand Melee
 * Weapon, Dual Wield or Ranged.
 */
function StartKind({
  abilityId,
  onChange,
}: {
  readonly abilityId: string;
  readonly onChange?: (abilityId: string) => void;
}) {
  const mode = startAutoAttackModeOf(abilityId);
  if (!mode) return null;
  if (!onChange) return <span className="apl-start-kind">{START_AUTO_ATTACK_LABELS[mode]}</span>;
  return (
    <select
      className="apl-start-kind"
      value={abilityId}
      aria-label="Auto-attack kind"
      onChange={(event) => onChange(event.target.value)}
    >
      {(Object.keys(START_AUTO_ATTACK_IDS) as (keyof typeof START_AUTO_ATTACK_IDS)[]).map((kind) => (
        <option key={kind} value={START_AUTO_ATTACK_IDS[kind]}>
          {START_AUTO_ATTACK_LABELS[kind]}
        </option>
      ))}
    </select>
  );
}

/** The value an ability dropdown shows for an id: a start shows as the one action. */
function choiceValue(abilityId: string, abilities: readonly { readonly id: string }[]): string {
  if (!isStartAutoAttack(abilityId)) return abilityId;
  return abilities.find((ability) => isStartAutoAttack(ability.id))?.id ?? abilityId;
}

/** A chosen dropdown value, keeping the kind of a start that was already there. */
function chosenId(previous: string, chosen: string): string {
  return isStartAutoAttack(previous) && isStartAutoAttack(chosen) ? previous : chosen;
}

/**
 * A MELEE WEAVE'S OPTIONS (round 68): the global-cooldown abilities it may
 * cast in melee, the first ready one used -- and the weave's gate, since it
 * begins when any one can be cast. Raptor Strike comes if ready either way.
 */
function EntryWeave({
  actions,
  nameOf,
  abilities,
  onChange,
}: {
  readonly actions: readonly string[] | undefined;
  readonly nameOf: (abilityId: string) => string;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly onChange?: (actions: readonly string[] | undefined) => void;
}) {
  const shown = actions ?? DEFAULT_MELEE_WEAVE_ACTIONS;
  const offered = abilities.filter(
    (ability) =>
      ability.id !== MELEE_WEAVE_ID &&
      ability.id !== MELEE_WEAVE_RAPTOR_STRIKE &&
      !isStartAutoAttack(ability.id) &&
      !shown.includes(ability.id),
  );
  // Back to the default is DROPPED rather than stored, so the entry compares equal.
  const store = (next: readonly string[]) =>
    onChange?.(next.join('|') === DEFAULT_MELEE_WEAVE_ACTIONS.join('|') ? undefined : next);
  return (
    <span className="apl-weave">
      <span className="apl-unit">in melee, one of:</span>
      {shown.map((abilityId, at) => (
        <span key={`${abilityId}-${at}`} className="apl-weave-step">
          <AbilityHover abilityId={abilityId}>{nameOf(abilityId)}</AbilityHover>
          {onChange ? (
            <button
              type="button"
              className="apl-weave-remove"
              title="Take this action out of the weave"
              onClick={() => store(shown.filter((_, index) => index !== at))}
            >
              x
            </button>
          ) : null}
        </span>
      ))}
      {onChange ? (
        <select
          className="apl-sequence-add"
          value=""
          aria-label="Add a melee action"
          onChange={(event) => {
            if (event.target.value) store([...shown, event.target.value]);
          }}
        >
          <option value="">+ action</option>
          {offered.map((ability) => (
            <option key={ability.id} value={ability.id}>
              {ability.name}
            </option>
          ))}
        </select>
      ) : null}
      <span className="apl-unit">+ Raptor Strike if ready, then back to range</span>
    </span>
  );
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
    /*
     * AND WHAT IT DRANK, which is the third source and the only one that can
     * change without the build changing. Selecting a Major Mana Potion in the
     * Consumables panel is what puts it in this dropdown -- the owner's ask,
     * "when a potion is selected it will then become visible on the APL".
     *
     * THE SAME FUNCTION THE FIGHT CALLS, deliberately. `createPlayer` appends
     * `consumableAbilities(class, consumables)` to its own book, and these two
     * compositions are the thing that must not drift: a potion in this dropdown
     * and not in the fight is an entry that silently never fires, and one in
     * the fight and not here is an entry nobody can add back after deleting it.
     * `consumableAbilities.test.ts` asserts the two agree.
     */
    ...consumableAbilities(profile.character.characterClass, profile.consumables),
    // Start Auto-attack, every kind, and the Hunter's Melee Weave (round 65),
    // as `createPlayer` adds them. The run time is only shown, never used here.
    ...START_AUTO_ATTACK_ABILITIES,
    ...(profile.character.characterClass === 'hunter' ? [meleeWeaveAbility(meleeWeaveRunMs(false))] : []),
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
  heals,
  multiTarget,
  targets = true,
  onChange,
}: {
  readonly list: ShownList;
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
  readonly abilities?: readonly { readonly id: string; readonly name: string }[];
  readonly auras?: readonly CatalogAura[];
  /** The interruptible channels in this list, if any. See the helper above. */
  readonly channels?: readonly { readonly id: string; readonly name: string }[];
  /** The heals in the book, and whether each has a cast bar. See `healsIn`. */
  readonly heals?: ReadonlyMap<string, { readonly castBar: boolean }>;
  /** Whether Multi-DoT is offered: the Multi Target list's (round 64). */
  readonly multiTarget?: boolean;
  /** Whether the target controller is shown: the Multi Target list's (round 64). */
  readonly targets?: boolean;
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
            <EntryAbility
              abilityId={entry.abilityId}
              name={nameOf(entry.abilityId)}
              abilities={abilities ?? []}
              onChange={
                onChange
                  ? (abilityId) => onChange(setAbility(list.entries, index, chosenId(entry.abilityId, abilityId)))
                  : undefined
              }
            />
            <StartKind
              abilityId={entry.abilityId}
              onChange={onChange ? (abilityId) => onChange(setAbility(list.entries, index, abilityId)) : undefined}
            />
            {entry.abilityId === MELEE_WEAVE_ID ? (
              <EntryWeave
                actions={entry.weave}
                nameOf={nameOf}
                abilities={abilities ?? []}
                onChange={
                  onChange
                    ? (weave) =>
                        onChange(
                          list.entries.map((current, at) => {
                            if (at !== index) return current;
                            const { weave: _dropped, ...rest } = current;
                            void _dropped;
                            return weave ? { ...rest, weave } : rest;
                          }),
                        )
                    : undefined
                }
              />
            ) : null}
            {/*
              * BESIDE THE ABILITY AND BEFORE THE CONDITION, because the chain
              * is part of WHAT this entry does and the condition is WHEN. An
              * entry reading "Cold Blood then Eviscerate / if 5 combo points"
              * is the sentence the owner wrote.
              */}
            {/* A weave is its own sequence, so it offers no "then". */}
            {entry.abilityId === MELEE_WEAVE_ID ? null : <EntrySequence
              sequence={entry.sequence}
              nameOf={nameOf}
              abilities={abilities ?? []}
              onChange={
                onChange
                  ? (sequence) => onChange(setSequence(list.entries, index, sequence))
                  : undefined
              }
            />}
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
            {/*
              * WHO A HEAL GOES TO (round 55), offered on a heal or on an entry
              * that already names a target -- the last so a target can always
              * be seen and taken off again.
              */}
            {targets && (heals?.has(entry.abilityId) || entry.target) ? (
              <EntryTarget
                target={entry.target}
                onChange={
                  onChange
                    ? (target) => onChange(setTarget(list.entries, index, target))
                    : undefined
                }
              />
            ) : null}
            <EntryCancel
              cancel={entry.cancel}
              names={names}
              // A pre-cast is offered on a HEAL WITH A CAST BAR and nothing else.
              offered={heals?.get(entry.abilityId)?.castBar === true}
              onChange={
                onChange
                  ? (cancel) => onChange(setCancel(list.entries, index, cancel))
                  : undefined
              }
            />
            {/*
              * MULTI-DOT (round 57): offered on an enemy entry once the fight
              * has adds, and always shown where it is already set, so a stored
              * count can be seen and cleared at one target.
              */}
            {/*
              * AND ONLY ON AN ABILITY THAT HAS A DoT (round 67, the owner's),
              * still shown where a count is already stored so it can be cleared.
              */}
            {multiTarget && !entry.target && (appliesDot(entry.abilityId) || entry.multiDot !== undefined) ? (
              <EntryMultiDot
                multiDot={entry.multiDot}
                onChange={
                  onChange
                    ? (targets) => onChange(setMultiDot(list.entries, index, targets))
                    : undefined
                }
              />
            ) : null}
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
              {/*
                * DUPLICATE, and the copy lands DIRECTLY BELOW this line.
                *
                * The owner's ask, and the reason is the one the eye button
                * answers from the other side: the expensive part of an entry
                * is its condition. "The same rule one stack lower" was a
                * whole line to rebuild and is now one press and one number.
                *
                * BESIDE THE EYE AND LEFT OF THE MOVERS, so the three controls
                * that do not destroy anything sit together and the ✕ keeps
                * its own end of the row. See `duplicateEntry` for why a copy
                * below its own original cannot change what the list does.
                */}
              <button
                type="button"
                className="apl-duplicate"
                title="Duplicate this entry below"
                onClick={() => onChange(duplicateEntry(list.entries, index))}
              >
                ⧉
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
 * WHICH ABILITY THIS LINE CASTS -- a dropdown when the list can be edited.
 *
 * ============================================================================
 * IT WAS FIXED FOR THE LIFE OF THE PANEL, which made every other control on
 * the row half a feature: an entry's condition, note, interrupt flag and
 * position were all editable and the thing they were about was not. Changing
 * which ability a rule applies to meant deleting the line, adding a new one at
 * the bottom, rebuilding the condition from the dropdowns and walking it back
 * up to where it was.
 *
 * THE CONDITION TRAVELS WITH IT, which is the decision -- see `setAbility`.
 *
 * AN ABILITY THE BUILD DOES NOT KNOW KEEPS ITS OWN OPTION, which is
 * `AuraChoice`'s rule and matters for the same reason: every stock list names
 * all four free racial cooldowns, so three or four entries in any list name an
 * ability this character cannot cast. Falling back to whichever name sorts
 * first would silently rewrite them the moment the panel drew them.
 * ============================================================================
 */
function EntryAbility({
  abilityId,
  name,
  abilities,
  onChange,
}: {
  readonly abilityId: string;
  readonly name: string;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly onChange?: (abilityId: string) => void;
}) {
  if (!onChange || abilities.length === 0) {
    return (
      <AbilityHover abilityId={abilityId}>
        <span className="apl-ability">{name}</span>
      </AbilityHover>
    );
  }
  const value = choiceValue(abilityId, abilities);
  const unknown = !abilities.some((ability) => ability.id === value);
  return (
    <AbilityHover abilityId={abilityId}>
    <select
      className="apl-ability apl-ability-choice"
      value={value}
      aria-label="Ability"
      onChange={(event) => onChange(event.target.value)}
    >
      {unknown ? <option value={abilityId}>{name} (not in this build)</option> : null}
      {abilities.map((ability) => (
        <option key={ability.id} value={ability.id}>
          {ability.name}
        </option>
      ))}
    </select>
    </AbilityHover>
  );
}

/**
 * The abilities an entry casts AFTER its own, as one action.
 *
 * ============================================================================
 * THE OWNER'S "combine abilities into one action", drawn as a chain hanging
 * off the entry rather than as separate rows -- because that is what it IS.
 * The entry's condition gates the whole thing, and nothing may be cast between
 * the steps, which is exactly the part two ordinary entries cannot express.
 *
 * READ-ONLY MODE SHOWS THE CHAIN AS TEXT, which matters more here than for
 * most controls: an entry reading "Cold Blood" with a hidden Eviscerate behind
 * it would be a rotation doing something the panel does not say.
 *
 * THE "then..." PICKER IS ALWAYS LAST, so adding a step is one click and
 * removing one is choosing the blank. `setSequence` drops the blanks, so a
 * half-made chain is never stored.
 * ============================================================================
 */
function EntrySequence({
  sequence,
  nameOf,
  abilities,
  onChange,
}: {
  readonly sequence: readonly string[] | undefined;
  readonly nameOf: (abilityId: string) => string;
  readonly abilities: readonly { readonly id: string; readonly name: string }[];
  readonly onChange?: (sequence: readonly string[]) => void;
}) {
  const steps = sequence ?? [];

  if (!onChange || abilities.length === 0) {
    if (steps.length === 0) return null;
    return (
      <span className="apl-sequence">
        {steps.map((abilityId, at) => (
          <span key={`${abilityId}-${at}`} className="apl-sequence-step">
            {' then '}
            <AbilityHover abilityId={abilityId}>{nameOf(abilityId)}</AbilityHover>
          </span>
        ))}
      </span>
    );
  }

  const replace = (at: number, abilityId: string) =>
    onChange(steps.map((current, index) => (index === at ? abilityId : current)));

  return (
    <span className="apl-sequence">
      {steps.map((abilityId, at) => (
        <span key={`${abilityId}-${at}`} className="apl-sequence-step">
          <span className="apl-sequence-label">then</span>
          <AbilityHover abilityId={abilityId}>
          <select
            className="apl-ability apl-ability-choice"
            value={abilityId}
            aria-label={`Then cast (step ${at + 1})`}
            onChange={(event) => replace(at, event.target.value)}
          >
            {/* The blank is how a step is REMOVED; `setSequence` filters it. */}
            <option value="">(remove)</option>
            {abilities.map((ability) => (
              <option key={ability.id} value={ability.id}>
                {ability.name}
              </option>
            ))}
          </select>
          </AbilityHover>
        </span>
      ))}
      <select
        className="apl-sequence-add"
        value=""
        aria-label="Add an ability to this action"
        onChange={(event) => {
          if (event.target.value) onChange([...steps, event.target.value]);
        }}
      >
        <option value="">+ then…</option>
        {abilities.map((ability) => (
          <option key={ability.id} value={ability.id}>
            {ability.name}
          </option>
        ))}
      </select>
    </span>
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
            <option value="swing">Swing timer</option>
            <option value="targets">Number of targets</option>
            <option value="injured">Members needing healing</option>
            <option value="raidSize">Raid members to heal</option>
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
 * Multi-DoT: "spread this across the first X targets" (round 57). Empty is
 * off, and so is one, which is the plain single target.
 */
function EntryMultiDot({
  multiDot,
  onChange,
}: {
  readonly multiDot: number | undefined;
  readonly onChange?: (targets: number | undefined) => void;
}) {
  if (!onChange) {
    return multiDot !== undefined ? (
      <span className="apl-flag" title="Cast at the first of these targets whose condition holds">
        multi-DoT {multiDot}
      </span>
    ) : null;
  }
  return (
    <label
      className="apl-interrupt"
      title="Cast at the first of the first X targets, boss first, whose condition holds"
    >
      Multi-DoT:
      <input
        type="number"
        min="1"
        max="8"
        step="1"
        className="apl-number"
        value={multiDot ?? ''}
        placeholder="–"
        aria-label="Multi-DoT targets"
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Math.round(Number(event.target.value)))
        }
      />
      targets
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
            {/* Round 61: YOUR aura on anybody in the raid -- up or not, nothing else. */}
            <option value="raid">raid member with your</option>
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
            {clause.on !== 'pet' && clause.on !== 'raid' ? (
              <option value="expiring">seconds left</option>
            ) : null}
            {clause.on !== 'pet' && clause.on !== 'raid' ? <option value="stacks">stacks</option> : null}
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
            value={clause.cooldownTest ?? 'ready'}
            aria-label="Cooldown state"
            onChange={(e) =>
              /*
               * THE COMPARE AND THE VALUE ARE SEEDED WHEN "seconds left" IS
               * PICKED, because `emitClause` reads them and a clause switched
               * over with neither would emit `atLeast 0 seconds` -- which is
               * permanently TRUE and would silently ungate the entry. That is
               * the half-typed-aura-id failure from the other direction: a
               * condition that is always true is as invisible as one that is
               * always false.
               */
              set(
                e.target.value === 'secondsLeft'
                  ? {
                      cooldownTest: 'secondsLeft',
                      compare: clause.compare ?? 'atMost',
                      value: clause.value ?? 0,
                    }
                  : { cooldownTest: e.target.value as Clause['cooldownTest'] },
              )
            }
          >
            <option value="ready">is ready</option>
            <option value="onCooldown">is on cooldown</option>
            <option value="secondsLeft">has cooldown left</option>
          </select>
          {clause.cooldownTest === 'secondsLeft' ? (
            <>
              {compareField(false)}
              {numberField(clause.value, 's')}
            </>
          ) : null}
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
          {/*
            * WHOSE HEALTH (round 55): yours, the entry's target, the tank, or
            * the mean of your party or the raid -- the last three are what a
            * healer's list reads, and were fixed sentences before.
            */}
          <select
            value={clause.who ?? 'self'}
            aria-label="Whose health"
            onChange={(e) => set({ who: e.target.value as Clause['who'] })}
          >
            <option value="self">your health</option>
            <option value="target">the target&apos;s health</option>
            <option value="tank">the tank&apos;s health</option>
            {/* The TARGET's party, which is what it always read (relabelled round 61). */}
            <option value="party">the target&apos;s party&apos;s average health</option>
            <option value="raid">the raid&apos;s average health</option>
            <option value="lowestParty">the lowest party&apos;s average health</option>
          </select>
          {compareField(false)}
          {numberField(clause.value, '%')}
        </>
      ) : null}

      {/*
        * THE SWING TIMER: seconds until the named weapon swings again, and zero
        * while that slot is idle -- so "<= 0.3s" is also true of a hand that is
        * not swinging at all. The compiler reads the PENDING swing, so haste,
        * a parry and a cast that reset the timer all move it.
        */}
      {clause.kind === 'swing' ? (
        <>
          <select
            value={clause.slot ?? 'mainHand'}
            aria-label="Which swing timer"
            onChange={(e) => set({ slot: e.target.value as Clause['slot'] })}
          >
            <option value="mainHand">main-hand swing in</option>
            <option value="offHand">off-hand swing in</option>
            <option value="ranged">ranged swing in</option>
          </select>
          {compareField(false)}
          <input
            type="number"
            step="0.1"
            min="0"
            className="apl-number"
            value={clause.value ?? 0}
            aria-label="Seconds"
            onChange={(event) => set({ value: Number(event.target.value) })}
          />
          <span className="apl-unit">s</span>
        </>
      ) : null}

      {/*
        * NUMBER OF TARGETS (round 57): how many enemies the fight holds, which
        * is the Encounter panel's Number of Targets. "At least 3" is an AoE
        * entry that a single-target fight never reaches.
        */}
      {clause.kind === 'injured' ? (
        <>
          {/*
            * HOW MANY NEED HEALING (round 60): "at least 2 in the target's party
            * are under 90% health" -- every number editable.
            */}
          {compareField(false)}
          <input
            type="number"
            step="1"
            min="0"
            max="20"
            className="apl-number"
            value={clause.value ?? 2}
            aria-label="How many members"
            onChange={(event) => set({ value: Math.round(Number(event.target.value)) })}
          />
          <select
            value={clause.injuredOf ?? 'targetParty'}
            aria-label="Whose group"
            onChange={(e) => set({ injuredOf: e.target.value as Clause['injuredOf'] })}
          >
            <option value="targetParty">in the target&apos;s party</option>
            <option value="raid">in the raid</option>
          </select>
          <span className="apl-unit">under</span>
          <input
            type="number"
            step="5"
            min="0"
            max="100"
            className="apl-number"
            value={clause.belowPercent ?? 90}
            aria-label="Health percent"
            onChange={(event) => set({ belowPercent: Number(event.target.value) })}
          />
          <span className="apl-unit">% health</span>
        </>
      ) : null}

      {clause.kind === 'raidSize' ? (
        <>
          {/*
            * RAID MEMBERS TO HEAL (round 61): one in the tank healer fight,
            * twenty in the raid healer fight, none in a damage fight.
            */}
          <span className="apl-unit">raid members</span>
          {compareField(false)}
          <input
            type="number"
            step="1"
            min="0"
            max="40"
            className="apl-number"
            value={clause.value ?? 6}
            aria-label="Raid members"
            onChange={(event) => set({ value: Math.round(Number(event.target.value)) })}
          />
        </>
      ) : null}

      {clause.kind === 'targets' ? (
        <>
          {/* One word, so the clause reads "targets >= 3" on one line. */}
          <span className="apl-unit">targets</span>
          {compareField(false)}
          <input
            type="number"
            step="1"
            min="1"
            max="8"
            className="apl-number"
            value={clause.value ?? 1}
            aria-label="Number of targets"
            onChange={(event) => set({ value: Math.round(Number(event.target.value)) })}
          />
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

/**
 * An entry's PRE-CAST check (round 53): how far through the cast it is asked,
 * and -- when the question is the usual "is the target still above N%" --
 * that threshold, both editable. The owner asked for both to be customisable.
 *
 * A QUESTION THE TWO FIELDS CANNOT HOLD IS SHOWN AS ITS SENTENCE, the
 * arrangement a `fixed` condition node already uses: an editor that cannot
 * express something says so rather than redrawing it as something it can.
 */
function EntryCancel({
  cancel,
  names,
  offered,
  onChange,
}: {
  readonly cancel: AplEntry['cancel'];
  readonly names: DescribeNames;
  /** A heal with a cast bar, which is the only kind a pre-cast is for (round 55). */
  readonly offered: boolean;
  readonly onChange?: (cancel: AplEntry['cancel']) => void;
}) {
  /*
   * THE TOGGLE IS ONLY ON A CAST-BAR HEAL. An instant has no "part way", and a
   * damage spell has no one to top up -- so the checkbox is not drawn for
   * either. A check that somehow sits on another entry is still SHOWN, so it
   * cannot be silently present.
   */
  if (!cancel) {
    if (!offered || !onChange) return null;
    return (
      <label className="apl-cancel" title="Start this heal early and cancel it if it is not needed">
        <input
          type="checkbox"
          checked={false}
          onChange={() =>
            onChange({
              atFraction: DEFAULT_PRECAST_AT,
              condition: { kind: 'health', on: 'target', compare: 'above', fraction: DEFAULT_PRECAST_ABOVE },
            })
          }
        />
        pre-cast
      </label>
    );
  }
  const condition = cancel.condition;
  const threshold =
    condition.kind === 'health' && condition.on === 'target' && condition.compare === 'above'
      ? condition
      : undefined;
  const percent = (fraction: number) => Math.round(fraction * 1000) / 10;

  return (
    <span className="apl-cancel">
      {onChange ? (
        <input
          type="checkbox"
          checked
          aria-label="Pre-cast"
          title="Stop pre-casting this heal"
          onChange={() => onChange(undefined)}
        />
      ) : null}
      <span className="apl-flag">pre-cast</span> cancel at{' '}
      {onChange ? (
        <input
          type="number"
          className="apl-number"
          min={1}
          max={99}
          step={5}
          value={percent(cancel.atFraction)}
          aria-label="Percent of the cast"
          onChange={(event) =>
            onChange({
              ...cancel,
              atFraction: Math.min(0.99, Math.max(0.01, Number(event.target.value) / 100 || 0)),
            })
          }
        />
      ) : (
        percent(cancel.atFraction)
      )}
      <span className="apl-unit">%</span> of the cast if{' '}
      {threshold ? (
        <>
          the target is above{' '}
          {onChange ? (
            <input
              type="number"
              className="apl-number"
              min={0}
              max={100}
              step={1}
              value={percent(threshold.fraction)}
              aria-label="Target health percent"
              onChange={(event) =>
                onChange({
                  ...cancel,
                  condition: {
                    ...threshold,
                    fraction: Math.min(1, Math.max(0, Number(event.target.value) / 100 || 0)),
                  },
                })
              }
            />
          ) : (
            percent(threshold.fraction)
          )}
          <span className="apl-unit">% health</span>
        </>
      ) : (
        describeCondition(condition, names)
      )}
    </span>
  );
}

/** A new pre-cast's defaults, the owner's: cancel at 80% if above 95%. */
const DEFAULT_PRECAST_AT = 0.8;
const DEFAULT_PRECAST_ABOVE = 0.95;

/**
 * The heals in an ability book, and whether each has a CAST BAR -- a cast time
 * and not a channel -- which is what a pre-cast needs (round 55).
 */
export function healsIn(book: readonly Ability[]): ReadonlyMap<string, { readonly castBar: boolean }> {
  return new Map(
    book
      .filter((ability) => ability.heals === true)
      .map((ability) => [
        ability.id,
        { castBar: (ability.castTimeMs ?? 0) > 0 && (ability.channelTicks ?? 1) <= 1 },
      ]),
  );
}

/**
 * Who an entry is cast at (round 55): the enemy by default, or the tank, or
 * the raid member with the least health -- with or without the tank.
 */
function EntryTarget({
  target,
  onChange,
}: {
  readonly target: AplEntry['target'];
  readonly onChange?: (target: AplEntry['target']) => void;
}) {
  const value =
    target === undefined
      ? 'default'
      : target.kind === 'tank'
        ? 'tank'
        : target.kind === 'withAura'
          ? `withAura:${target.auraId}`
          : target.kind === 'lowestParty'
            ? target.withoutAura === undefined
              ? 'lowestParty'
              : `lowestPartyWithout:${target.withoutAura}`
            : target.withoutAura !== undefined
              ? `lowestWithout:${target.withoutAura}`
              : target.excludeTank
                ? 'lowestNotTank'
                : 'lowest';
  const label: Record<string, string> = {
    default: 'at the default target',
    tank: 'on the tank',
    lowest: 'on the lowest health member',
    lowestNotTank: 'on the lowest health member, not the tank',
    // Round 71: the lowest member not already carrying one of your auras.
    ...Object.fromEntries(
      FRIENDLY_TARGET_AURAS.map((aura) => [
        `lowestWithout:${aura.auraId}`,
        `on the lowest health member without your ${aura.name}`,
      ]),
    ),
    // Round 61: the lowest member of the party with the lowest average health.
    lowestParty: 'in the lowest party',
    ...Object.fromEntries(
      FRIENDLY_TARGET_AURAS.map((aura) => [
        `lowestPartyWithout:${aura.auraId}`,
        `in the lowest party without your ${aura.name}`,
      ]),
    ),
    // Round 60: the member carrying one of your auras -- Riptide is the one.
    ...Object.fromEntries(
      FRIENDLY_TARGET_AURAS.map((aura) => [`withAura:${aura.auraId}`, `on whoever has your ${aura.name}`]),
    ),
  };
  /*
   * AN AURA NOBODY LISTED STILL GETS AN OPTION, named by its id -- but only when
   * it is missing (round 61). Spread after the named ones, it overwrote "your
   * Light's Vigil" with "your lights_vigil" on the very entry it was naming.
   */
  if (!(value in label)) {
    if (target?.kind === 'withAura') label[value] = `on whoever has your ${target.auraId}`;
    if (target?.kind === 'lowestParty') label[value] = `in the lowest party without your ${target.withoutAura}`;
    if (target?.kind === 'lowestHealth' && target.withoutAura !== undefined) {
      label[value] = `on the lowest health member without your ${target.withoutAura}`;
    }
  }
  if (!onChange) return <span className="apl-target">{label[value]}</span>;
  return (
    <select
      className="apl-target"
      value={value}
      aria-label="Who it is cast at"
      onChange={(event) => {
        const next = event.target.value;
        onChange(
          next === 'default'
            ? undefined
            : next === 'tank'
              ? { kind: 'tank' }
              : next.startsWith('withAura:')
                ? { kind: 'withAura', auraId: next.slice('withAura:'.length) }
                : next === 'lowestParty'
                  ? { kind: 'lowestParty' }
                  : next.startsWith('lowestPartyWithout:')
                    ? { kind: 'lowestParty', withoutAura: next.slice('lowestPartyWithout:'.length) }
                    : next.startsWith('lowestWithout:')
                      ? { kind: 'lowestHealth', withoutAura: next.slice('lowestWithout:'.length) }
                      : next === 'lowest'
                        ? { kind: 'lowestHealth' }
                        : { kind: 'lowestHealth', excludeTank: true },
        );
      }}
    >
      {Object.keys(label).map((key) => (
        <option key={key} value={key}>
          {label[key]}
        </option>
      ))}
    </select>
  );
}

/** The auras an entry can be aimed by, "whoever has your X" (round 60). */
const FRIENDLY_TARGET_AURAS: readonly { readonly auraId: string; readonly name: string }[] = [
  { auraId: 'riptide', name: 'Riptide' },
  { auraId: 'lights_vigil', name: "Light's Vigil" },
  // The Resto Drood's (round 71).
  { auraId: 'rejuvenation', name: 'Rejuvenation' },
  { auraId: 'regrowth', name: 'Regrowth' },
  { auraId: 'wild_growth', name: 'Wild Growth' },
];
