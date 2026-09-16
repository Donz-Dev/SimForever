import type { CharacterProfile } from '../../profiles';
import type { CharacterSelection, ClassId, FormId, RaceId } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/exampleAbilities';
import {
  CLASSES,
  FACTIONS,
  MAX_CHARACTER_LEVEL,
  applySelection,
  baseManaFor,
  baseStatsFor,
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
 * which classes a race may play, what happens to the current class when the
 * race changes, and what a level 60 character of that race and class starts
 * with are all answered by `game/character`.
 */
export function CharacterPanel({ profile, onChange }: CharacterPanelProps) {
  const race = getRace(profile.character.race);
  const selection: CharacterSelection = {
    faction: race?.faction ?? 'alliance',
    race: profile.character.race,
    characterClass: profile.character.characterClass,
  };

  const forms = formsFor(selection.characterClass);
  const form: FormId | undefined =
    forms.length > 0 ? (profile.character.form ?? forms[0].id) : undefined;

  const applyChange = (change: Partial<CharacterSelection>) => {
    const next = applySelection(change, selection);
    const nextForms = formsFor(next.characterClass);

    onChange({
      ...profile,
      character: {
        ...profile.character,
        race: next.race,
        characterClass: next.characterClass,
        // Drop the form when the new class has none, so a Warrior profile does
        // not quietly carry "bear" around.
        ...(nextForms.length > 0 ? { form: nextForms[0].id } : { form: undefined }),
      },
    });
  };

  const setForm = (next: FormId) => {
    onChange({ ...profile, character: { ...profile.character, form: next } });
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

      {forms.length > 0 && form ? (
        <OptionGroup label="Form" options={forms} value={form} onChange={setForm} />
      ) : null}

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

      <h3>Base stats</h3>
      <BaseStatTable
        race={selection.race}
        characterClass={selection.characterClass}
        form={form}
      />

      {abilityCount === 0 ? (
        <p className="muted">
          No abilities are implemented for {classDefinition?.name ?? 'this class'} yet, so
          it will fight with auto attacks only.
        </p>
      ) : null}

      <h3>Gear and other bonuses</h3>
      <p className="muted">Added on top of the base stats above.</p>
      <NumberField
        label="Attack Power"
        value={profile.stats.attackPower ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, attackPower: value } })
        }
      />
      <NumberField
        label="Strength"
        value={profile.stats.strength ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, strength: value } })
        }
      />
      <NumberField
        label="Agility"
        value={profile.stats.agility ?? 0}
        min={0}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, agility: value } })
        }
      />
    </Panel>
  );
}

/**
 * What a level 60 character of this race, class and form starts with, before
 * any gear.
 *
 * Crit chance is shown but marked, because those numbers are class constants
 * that other contributions add to rather than a character's actual crit.
 */
function BaseStatTable({
  race,
  characterClass,
  form,
}: {
  readonly race: RaceId;
  readonly characterClass: ClassId;
  readonly form: FormId | undefined;
}) {
  const stats = baseStatsFor(race, characterClass, form);
  if (!stats) return <p className="muted">No base stats for this combination.</p>;

  const mana = baseManaFor(race, characterClass);
  const definition = getClass(characterClass);

  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'Hit Points', value: stats.hitPoints.toLocaleString('en-US') },
    ...(mana > 0
      ? [{ label: resourceLabel('mana'), value: mana.toLocaleString('en-US') }]
      : []),
    ...(definition && definition.primaryResource !== 'mana'
      ? [{ label: resourceLabel(definition.primaryResource), value: '100' }]
      : []),
    { label: 'Strength', value: String(stats.strength) },
    { label: 'Agility', value: String(stats.agility) },
    { label: 'Stamina', value: String(stats.stamina) },
    { label: 'Intellect', value: String(stats.intellect) },
    { label: 'Spirit', value: String(stats.spirit) },
    { label: 'Attack Power', value: String(stats.attackPower) },
    ...(stats.rangedAttackPower !== 0
      ? [{ label: 'Ranged Attack Power', value: String(stats.rangedAttackPower) }]
      : []),
    { label: 'Crit Chance', value: `${stats.critChance}%`, note: 'base constant' },
    {
      label: 'Spell Crit Chance',
      value: `${stats.spellCritChance}%`,
      note: 'base constant',
    },
  ];

  return (
    <>
      <table className="base-stats">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="numeric">{row.value}</td>
              <td className="numeric muted">{row.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Crit values are class constants that other contributions add to, not a
        character&apos;s actual crit chance, and are not yet used in combat.
      </p>
    </>
  );
}
