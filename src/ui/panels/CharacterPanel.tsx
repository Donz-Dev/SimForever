import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { CharacterProfile, ValidationIssue } from '../../profiles';
import { downloadProfile, readProfileFile } from '../profileFile';
import type { CharacterSelection, CombatStyleId } from '../../game/character';
import { startingEquipmentFor } from '../../game/items/startingSets';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import {
  FACTIONS,
  applySelection,
  classesForRace,
  combatStylesFor,
  getClass,
  getCombatStyle,
  getRace,
  racesForFaction,
  resolveCombatStyle,
  STANCES,
  defaultStanceFor,
  getStance,
  isTankBuild,
  resolveStance,
} from '../../game/character';
import { TextField } from '../components/Field';
import { OptionGroup } from '../components/OptionGroup';
import { Panel } from '../components/Panel';

interface CharacterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
  /** True once the character has been confirmed and the rest is in play. */
  readonly confirmed: boolean;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
  readonly onImport: () => void;
  /**
   * A profile read from a file, already parsed, migrated and validated.
   *
   * THE PANEL PARSES AND THE APP DECIDES WHAT THAT MEANS. Picking the file and
   * saying what was wrong with it are this panel's job -- it owns the input and
   * it has the one place to show issues. Confirming the character, clearing the
   * preset pill and throwing away results that belong to the old character are
   * the app's, and they are the same three things `applyPreset` does.
   */
  readonly onLoad: (profile: CharacterProfile) => void;
}

/**
 * Step one: who is fighting.
 *
 * Character creation, in the order the game asks for it: faction, race, class,
 * style. Nothing else appears until it is confirmed, because everything else —
 * gear, the encounter, the run — is a decision about a character that does not
 * exist yet.
 *
 * The component holds no rules of its own. Which races belong to a faction,
 * which classes a race may play, and what happens to the current class when the
 * race changes are all answered by `game/character`.
 */
/**
 * Turn the target's swings ON when a build BECOMES a tank.
 *
 * A shield warrior in Defensive Stance is not being simulated at all with a
 * target that stands still: the attacks-received table, rage from damage
 * taken, Revenge, Shield Block and six talents are all waiting on something
 * swinging back. Making the person find a checkbox in another panel before
 * any of that exists is a trap, and the numbers they read in the meantime are
 * confidently wrong rather than obviously wrong.
 *
 * ON THE TRANSITION ONLY, which is what keeps it from fighting the person. It
 * fires when the build was not a tank and now is; picking Defensive and then
 * deliberately switching the target's swings back off leaves them off, because
 * nothing about the build changed afterwards.
 *
 * And it never switches them off. Leaving the tank configuration is not a
 * statement about what the encounter should be, and someone measuring a damage
 * build against a boss that hits back is doing something reasonable.
 */
function withTankEncounter(
  previous: CharacterProfile,
  next: CharacterProfile,
): CharacterProfile {
  const was = isTankBuild(previous.character.combatStyle, previous.character.stance);
  const now = isTankBuild(next.character.combatStyle, next.character.stance);
  if (was || !now || next.encounter.targetAttacks) return next;
  return { ...next, encounter: { ...next.encounter, targetAttacks: true } };
}

export function CharacterPanel({
  profile,
  onChange,
  confirmed,
  onConfirm,
  onEdit,
  onImport,
  onLoad,
}: CharacterPanelProps) {
  /*
   * THE FILE INPUT IS HIDDEN AND CLICKED, which is the whole of "Load opens
   * the file search". A bare `<input type="file">` cannot be styled to match
   * anything here and would sit on the panel saying "No file chosen"; every
   * browser gives a programmatic `.click()` on one the same dialog.
   */
  const fileInput = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    /*
     * CLEARED IMMEDIATELY, AND THIS IS NOT TIDYING UP. An input fires `change`
     * only when its value CHANGES, so choosing the same file twice is silent
     * the second time -- which is exactly what someone does after editing a
     * build on disk and loading it again. Clearing it before the await means
     * the next pick is always a change, whatever happens below.
     */
    event.target.value = '';
    if (!file) return;

    const result = await readProfileFile(file);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    setIssues([]);
    onLoad(result.profile);
  };

  const race = getRace(profile.character.race);
  const selection: CharacterSelection = {
    faction: race?.faction ?? 'alliance',
    race: profile.character.race,
    characterClass: profile.character.characterClass,
  };

  const styles = combatStylesFor(selection.characterClass);
  const style = resolveCombatStyle(selection.characterClass, profile.character.combatStyle);
  /*
   * Only the Warrior has stances, so only the Warrior is asked. Resolved
   * rather than read straight off the profile, so a profile written before
   * stances existed opens in its style's default instead of nowhere -- a
   * warrior in no stance cannot cast Overpower, Rend, Execute, Thunder Clap,
   * Hamstring or Charge.
   */
  const isWarrior = selection.characterClass === 'warrior';
  const stance = resolveStance(style, profile.character.stance);

  const applyChange = (change: Partial<CharacterSelection>) => {
    const next = applySelection(change, selection);
    const classChanged = next.characterClass !== selection.characterClass;

    onChange({
      ...profile,
      /*
       * GEAR BELONGS TO A CLASS, so changing class replaces it.
       *
       * The same rule the stance below already follows, and for the same reason:
       * a Mage should not quietly carry "defensive" around, and a Paladin should
       * not quietly carry ARCANIST CLOTH. Every class has a starting set now, so
       * there is something to put there -- until there was, leaving the old gear
       * on was the least bad of two bad answers.
       *
       * A RACE change keeps it. Gear is not a race's, and re-rolling someone's
       * slots because they switched Orc to Troll would be the annoying kind of
       * helpful.
       */
      ...(classChanged
        ? {
            equipment: startingEquipmentFor(
              next.characterClass,
              resolveCombatStyle(next.characterClass, profile.character.combatStyle),
              // Which of two Paladin shield builds is meant. See StartingSetOptions.
              { targetAttacks: profile.encounter.targetAttacks },
            ),
          }
        : {}),
      character: {
        ...profile.character,
        race: next.race,
        characterClass: next.characterClass,
        // Re-resolve against the new class, so a profile does not quietly carry
        // "bear" around after switching away from Druid.
        combatStyle: resolveCombatStyle(next.characterClass, profile.character.combatStyle),
        /*
         * A stance belongs to a Warrior and to nobody else, so changing class
         * away from Warrior drops it rather than leaving a Mage carrying
         * "defensive" around. Changing TO Warrior takes the style's default.
         */
        stance:
          next.characterClass === 'warrior'
            ? defaultStanceFor(
                resolveCombatStyle(next.characterClass, profile.character.combatStyle),
              )
            : undefined,
      },
    });
  };

  /*
   * ONE CHOOSER AND ONE ISSUE LIST, BUILT HERE AND USED BY BOTH SCREENS.
   *
   * Load is on the creation panel AND on the confirmed summary, so the pieces
   * behind it are needed twice -- and only ONE of the two screens is ever
   * mounted, so this is a single element reaching whichever is. Writing the
   * input out in both branches would be two things to keep in step, and the
   * half that drifted would be the one nobody pressed.
   *
   * ACCEPTS JSON AND ALSO ANYTHING ELSE, because `accept` is a FILTER on the
   * dialog rather than a rule -- every browser offers "All files" beside it,
   * and a profile renamed `.txt` is still a profile. What decides whether a
   * file loads is `parseProfile`, which is the same answer a paste would get.
   */
  const fileChooser = (
    <input
      ref={fileInput}
      type="file"
      accept="application/json,.json"
      className="visually-hidden"
      onChange={(event) => void handleFile(event)}
    />
  );

  /*
   * WHY A FILE DID NOT LOAD, IN FULL. `validateProfile` collects every problem
   * rather than stopping at the first, precisely so somebody repairing a
   * hand-edited build sees the whole list at once -- showing one at a time
   * would waste that.
   */
  const issueList =
    issues.length > 0 ? (
      <ul className="issues">
        {issues.map((issue) => (
          <li key={`${issue.path}:${issue.message}`}>
            {issue.path ? `${issue.path}: ${issue.message}` : issue.message}
          </li>
        ))}
      </ul>
    ) : null;

  /*
   * A FAILED LOAD IS NEWS ABOUT A FILE, AND IT STOPS BEING NEWS WHEN THE SCREEN
   * CHANGES. This panel stays mounted across the confirm/edit boundary, so an
   * error raised on the creation screen would otherwise still be sitting under
   * the summary line after confirming a character that has nothing to do with
   * it -- an error message about a character you are no longer looking at.
   */
  const clearingIssues = (then: () => void) => () => {
    setIssues([]);
    then();
  };

  // Once confirmed the whole block collapses to a single line. Editing is an
  // explicit action, so a stray click cannot silently rebuild the character
  // underneath results that were run against the old one.
  if (confirmed) {
    return (
      <ConfirmedCharacter
        profile={profile}
        style={style}
        onEdit={clearingIssues(onEdit)}
        onSave={() => downloadProfile(profile)}
        onLoad={() => fileInput.current?.click()}
        fileChooser={fileChooser}
        issues={issueList}
      />
    );
  }

  const classDefinition = getClass(selection.characterClass);
  const abilityCount = abilitiesForClass(selection.characterClass, style).length;
  // A profile is not valid without a name, so there is nothing to confirm until
  // there is one. Trimmed, because a name of spaces fails the same check.
  const named = profile.character.name.trim().length > 0;

  return (
    <Panel
      title="Character"
      actions={
        <>
          <button type="button" onClick={onImport}>
            Import
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Load
          </button>
        </>
      }
    >
      {fileChooser}
      {/*
        * FIRST, above the name, because it is the fastest way past all of it.
        * Someone who wants a Protection warrior wants five fields, a tree and
        * nineteen gear slots, and every one of those is a chance to end up
        * with a character nobody meant -- a shield without Defensive Stance,
        * or a tank against a target that never swings.
        */}

      <TextField
        label="Name"
        value={profile.character.name}
        onChange={(name) => onChange({ ...profile, character: { ...profile.character, name } })}
      />

      <OptionGroup
        label="Faction"
        options={FACTIONS}
        value={selection.faction}
        onChange={(faction) => applyChange({ faction })}
        columns={2}
      />

      <OptionGroup
        label="Race"
        options={racesForFaction(selection.faction)}
        value={selection.race}
        onChange={(next) => applyChange({ race: next })}
      />

      <OptionGroup
        label="Class"
        options={classesForRace(selection.race)}
        value={selection.characterClass}
        onChange={(characterClass) => applyChange({ characterClass })}
      />

      <OptionGroup
        label="Combat style"
        options={styles}
        value={style}
        onChange={(next) =>
          onChange(
            withTankEncounter(profile, {
              ...profile,
              character: {
                ...profile.character,
                combatStyle: next,
                /*
                 * Changing style RESETS the stance to that style's default.
                 *
                 * Each default is the stance the build actually wants, and
                 * carrying the old one across is how a shield warrior ends up
                 * in Berserker without having chosen it. Overriding afterwards
                 * is one click; noticing a stance you did not pick is not.
                 */
                stance:
                  next && selection.characterClass === 'warrior'
                    ? defaultStanceFor(next)
                    : profile.character.stance,
              },
            }),
          )
        }
      />

      {isWarrior ? (
        <OptionGroup
          label="Stance"
          options={STANCES}
          value={stance}
          onChange={(next) =>
            onChange(
              withTankEncounter(profile, {
                ...profile,
                character: { ...profile.character, stance: next },
              }),
            )
          }
        />
      ) : null}

      {/*
        * ABOVE THE CONFIRM BUTTON AND BELOW THE FIELDS, because a failed load
        * leaves the character exactly as it was: the panel is still usable,
        * and this is a message about the file rather than about the character.
        */}
      {issueList}

      {abilityCount === 0 ? (
        <p className="muted warn">
          No abilities are implemented for {classDefinition?.name ?? 'this class'} yet, so it
          will fight with auto attacks only.
        </p>
      ) : null}

      <button
        type="button"
        className="confirm"
        onClick={clearingIssues(onConfirm)}
        disabled={!named}
      >
        {named ? 'Confirm character' : 'Name your character'}
      </button>
    </Panel>
  );
}

/**
 * The confirmed character, as one line.
 *
 * Everything the choices above produced, in the order they were made, so the
 * summary reads back as a sentence rather than as a list of fields.
 */
function ConfirmedCharacter({
  profile,
  style,
  onEdit,
  onSave,
  onLoad,
  fileChooser,
  issues,
}: {
  readonly profile: CharacterProfile;
  readonly style: CombatStyleId;
  readonly onEdit: () => void;
  readonly onSave: () => void;
  readonly onLoad: () => void;
  /** The one hidden file input, built by the panel. See `fileChooser` there. */
  readonly fileChooser: ReactNode;
  /** Why a file did not load, when one did not. Built by the panel too. */
  readonly issues: ReactNode;
}) {
  const race = getRace(profile.character.race);
  const classDefinition = getClass(profile.character.characterClass);
  const styleDefinition = getCombatStyle(style);
  /*
   * The stance is on the summary line because it changes what the character
   * can cast. A collapsed summary that omitted it would leave someone
   * comparing two runs with no way to see that the stance differed.
   */
  const stanceDefinition =
    profile.character.characterClass === 'warrior'
      ? getStance(resolveStance(style, profile.character.stance))
      : undefined;

  return (
    <section className="panel character-summary">
      <div className="character-summary-body">
        <div>
          <strong>{profile.character.name}</strong>
          <span className="muted">
            {race?.name} {classDefinition?.name}
            {styleDefinition ? ` · ${styleDefinition.name}` : ''}
            {stanceDefinition ? ` · ${stanceDefinition.name}` : ''}
          </span>
        </div>
        {/*
          * SAVE IS HERE AND NOT ON THE CREATION SCREEN, because this is the
          * only place there is a whole character to save. The creation screen
          * has five fields; the talents, the gear, the raid buffs, the
          * consumables and the encounter are all chosen after it, and every
          * one of them is in the file.
          *
          * LOAD IS HERE *AS WELL AS* ON THE CREATION SCREEN, which is a change
          * of mind and worth saying so. It was creation-screen-only first,
          * which made `Change` the only route to it -- and Change CLEARS THE
          * TALENT ALLOCATION. That is harmless when a file is then loaded,
          * because a load replaces the whole profile, and it costs somebody
          * their build the moment they cancel the file dialog instead. A
          * second entry point is cheaper than a trap.
          *
          * SAVE, LOAD, THEN CHANGE, in that order, because Change is the
          * destructive one. Putting the button that discards a build to the
          * right of the two that preserve it is the cheapest thing that makes
          * the row read correctly.
          */}
        <div className="character-summary-actions">
          <button type="button" onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onLoad}>
            Load
          </button>
          <button type="button" onClick={onEdit}>
            Change
          </button>
        </div>
      </div>
      {/*
        * INSIDE THE SECTION AND BELOW THE ROW, so a file that would not load
        * says why against the character it failed to replace. The summary is
        * one line and stays one line; this appears only when there is
        * something to say.
        */}
      {issues}
      {fileChooser}
    </section>
  );
}

