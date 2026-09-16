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
          onChange({ ...profile, character: { ...profile.character, combatStyle: next } })
        }
      />

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

  return (
    <section className="panel character-summary">
      <div className="character-summary-body">
        <div>
          <strong>{profile.character.name}</strong>
          <span className="muted">
            {race?.name} {classDefinition?.name}
            {styleDefinition ? ` · ${styleDefinition.name}` : ''}
          </span>
        </div>
        <button type="button" onClick={onEdit}>
          Change
        </button>
      </div>
    </section>
  );
}
