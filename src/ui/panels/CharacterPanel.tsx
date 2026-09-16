import type { CharacterProfile } from '../../profiles';
import type { CharacterSelection } from '../../game/character';
import {
  CLASSES,
  FACTIONS,
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  applySelection,
  classesForRace,
  getRace,
  racesForFaction,
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

      <NumberField
        label="Level"
        hint={`max ${MAX_CHARACTER_LEVEL}`}
        value={profile.character.level}
        min={MIN_CHARACTER_LEVEL}
        max={MAX_CHARACTER_LEVEL}
        onChange={(level) =>
          onChange({ ...profile, character: { ...profile.character, level } })
        }
      />

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
