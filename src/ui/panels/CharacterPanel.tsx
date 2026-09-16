import type { CharacterProfile } from '../../profiles';
import type { CharacterSelection, ClassId } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/exampleAbilities';
import {
  CLASSES,
  FACTIONS,
  MAX_CHARACTER_LEVEL,
  applySelection,
  classesForRace,
  formsFor,
  getClass,
  getRace,
  racesForFaction,
  resourceLabel,
} from '../../game/character';
import { NumberField, TextField } from '../components/Field';
import { OptionGroup } from '../components/OptionGroup';
import { Panel } from '../components/Panel';

interface CharacterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * Character creation, in the order the game asks for it: faction, race, class.
 *
 * The component holds no rules of its own. Which races belong to a faction,
 * which classes a race may play, and what happens to the current class when the
 * race changes are all answered by `game/character`, so the same logic is
 * tested without rendering anything and reused by any future CLI.
 *
 * Faction is derived from the race rather than stored on the profile, which is
 * why there is no faction field to read back: an Alliance Orc cannot be
 * represented, so it cannot be chosen by accident.
 */
export function CharacterPanel({ profile, onChange }: CharacterPanelProps) {
  const race = getRace(profile.character.race);
  const selection: CharacterSelection = {
    faction: race?.faction ?? 'alliance',
    race: profile.character.race,
    characterClass: profile.character.characterClass,
  };

  const applyChange = (change: Partial<CharacterSelection>) => {
    const next = applySelection(change, selection);
    onChange({
      ...profile,
      character: {
        ...profile.character,
        race: next.race,
        characterClass: next.characterClass,
      },
    });
  };

  const availableClasses = classesForRace(selection.race);
  const unavailable = CLASSES.filter(
    (entry) => !availableClasses.some((available) => available.id === entry.id),
  );

  const classDefinition = getClass(selection.characterClass);
  const abilityCount = abilitiesForClass(selection.characterClass).length;

  return (
    <Panel title="Character" subtitle="World of Warcraft: Forever">
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
        options={availableClasses}
        value={selection.characterClass}
        onChange={(characterClass) => applyChange({ characterClass })}
      />

      {unavailable.length > 0 ? (
        <p className="muted">
          Not available to {race?.name ?? 'this race'}:{' '}
          {unavailable.map((entry) => entry.name).join(', ')}
        </p>
      ) : null}

      <div className="field">
        <span className="field-label">
          Level
          <span className="field-hint">fixed for now</span>
        </span>
        <div className="readonly-value">{MAX_CHARACTER_LEVEL}</div>
      </div>

      <h3>Resources</h3>
      <ResourceSummary characterClass={selection.characterClass} />

      {abilityCount === 0 ? (
        <p className="muted">
          No abilities are implemented for {classDefinition?.name ?? 'this class'} yet, so
          it will fight with auto attacks only.
        </p>
      ) : null}

      <h3>Stats</h3>

      <NumberField
        label="Attack Power"
        value={profile.stats.attackPower ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, attackPower: value } })
        }
      />
      <NumberField
        label="Crit Rating"
        hint="180 rating = 1%"
        value={profile.stats.critRating ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, critRating: value } })
        }
      />
      <NumberField
        label="Haste Rating"
        hint="170 rating = 1%"
        value={profile.stats.hasteRating ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, hasteRating: value } })
        }
      />
    </Panel>
  );
}

/**
 * Which resource a class runs on.
 *
 * Every class also has Health; it is shown here because it is about to matter,
 * and because "Mana" alone would read as the complete answer when it is not.
 * The Druid is the one class where the answer depends on form.
 */
function ResourceSummary({ characterClass }: { readonly characterClass: ClassId }) {
  const forms = formsFor(characterClass);
  const definition = getClass(characterClass);
  if (!definition) return null;

  if (forms.length === 0) {
    return (
      <ul className="resource-list">
        <li>
          <span>Health</span>
          <span className="muted">all classes</span>
        </li>
        <li>
          <span>{resourceLabel(definition.primaryResource)}</span>
          <span className="muted">primary</span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="resource-list">
      <li>
        <span>Health</span>
        <span className="muted">all classes</span>
      </li>
      {forms.map((form) => (
        <li key={form.id}>
          <span>{resourceLabel(form.resource)}</span>
          <span className="muted">{form.name}</span>
        </li>
      ))}
    </ul>
  );
}
