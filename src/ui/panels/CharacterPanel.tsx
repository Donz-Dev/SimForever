import type { CharacterProfile } from '../../profiles';
import type { CharacterSelection, CombatStyleId } from '../../game/character';
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
  readonly onLoad: () => void;
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
export function CharacterPanel({
  profile,
  onChange,
  confirmed,
  onConfirm,
  onEdit,
  onImport,
  onLoad,
}: CharacterPanelProps) {
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

    onChange({
      ...profile,
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

  // Once confirmed the whole block collapses to a single line. Editing is an
  // explicit action, so a stray click cannot silently rebuild the character
  // underneath results that were run against the old one.
  if (confirmed) {
    return <ConfirmedCharacter profile={profile} style={style} onEdit={onEdit} />;
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
          <button type="button" onClick={onLoad}>
            Load
          </button>
        </>
      }
    >
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
          onChange({
            ...profile,
            character: {
              ...profile.character,
              combatStyle: next,
              /*
               * Changing style RESETS the stance to that style's default.
               *
               * Each default is the stance the build actually wants, and
               * carrying the old one across is how a shield warrior ends up in
               * Berserker without having chosen it. Overriding afterwards is
               * one click; noticing a stance you did not pick is not.
               */
              stance: next && selection.characterClass === 'warrior'
                ? defaultStanceFor(next)
                : profile.character.stance,
            },
          })
        }
      />

      {isWarrior ? (
        <>
          <OptionGroup
            label="Stance"
            options={STANCES}
            value={stance}
            onChange={(next) =>
              onChange({ ...profile, character: { ...profile.character, stance: next } })
            }
          />
          <p className="muted stance-note">{getStance(stance)?.effect}</p>
        </>
      ) : null}

      {abilityCount === 0 ? (
        <p className="muted warn">
          No abilities are implemented for {classDefinition?.name ?? 'this class'} yet, so it
          will fight with auto attacks only.
        </p>
      ) : null}

      <button type="button" className="confirm" onClick={onConfirm} disabled={!named}>
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
}: {
  readonly profile: CharacterProfile;
  readonly style: CombatStyleId;
  readonly onEdit: () => void;
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
        <button type="button" onClick={onEdit}>
          Change
        </button>
      </div>
    </section>
  );
}
