import type { CharacterProfile } from '../../profiles';
import type { CharacterSelection, CombatStyleId } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/exampleAbilities';
import { createPlayer } from '../../game/actors/createPlayer';
import {
  CLASSES,
  FACTIONS,
  MAX_CHARACTER_LEVEL,
  applySelection,
  baseManaFor,
  baseStatsFor,
  classesForRace,
  combatStylesFor,
  getClass,
  getCombatStyle,
  getRace,
  racesForFaction,
  resolveCombatStyle,
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

  const styles = combatStylesFor(selection.characterClass);
  const style = resolveCombatStyle(selection.characterClass, profile.character.combatStyle);
  const styleDefinition = getCombatStyle(style);

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

  const setStyle = (next: CombatStyleId) => {
    onChange({ ...profile, character: { ...profile.character, combatStyle: next } });
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

      <OptionGroup
        label="Combat style"
        options={styles}
        value={style}
        onChange={setStyle}
      />
      {styleDefinition ? (
        <p className="muted">{styleDefinition.summary}</p>
      ) : null}
      <WeaponSlots style={style} />

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

      <h3>Character sheet</h3>
      <CharacterSheet profile={profile} style={style} />

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
 * The character as the simulation will actually see it: base stats, plus gear,
 * with the class conversions applied.
 *
 * Built by calling the same `createPlayer` the simulation uses, rather than
 * recomputing the numbers here. A character sheet that disagreed with the fight
 * would be worse than no character sheet.
 */
function CharacterSheet({
  profile,
  style,
}: {
  readonly profile: CharacterProfile;
  readonly style: CombatStyleId;
}) {
  const base = baseStatsFor(profile.character.race, profile.character.characterClass, style);
  if (!base) return <p className="muted">No base stats for this combination.</p>;

  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: style,
    bonusStats: profile.stats,
  });

  const stats = player.stats.effective;
  const mana = player.resources.get('mana');
  const definition = getClass(profile.character.characterClass);
  const other = definition && definition.primaryResource !== 'mana'
    ? player.resources.get(definition.primaryResource)
    : undefined;

  const rows: { label: string; value: string; from?: string }[] = [
    {
      label: 'Hit Points',
      value: round(player.health.maximum),
      from: `${base.hitPoints} base + ${base.stamina} stamina`,
    },
    ...(mana
      ? [
          {
            label: 'Mana',
            value: round(mana.maximum),
            from: `${baseManaFor(profile.character.race, profile.character.characterClass)} base + ${base.intellect} intellect`,
          },
        ]
      : []),
    ...(other ? [{ label: resourceLabel(other.type), value: round(other.maximum) }] : []),

    { label: 'Strength', value: round(stats.strength) },
    { label: 'Agility', value: round(stats.agility) },
    { label: 'Stamina', value: round(stats.stamina) },
    { label: 'Intellect', value: round(stats.intellect) },
    { label: 'Spirit', value: round(stats.spirit) },

    {
      label: 'Attack Power',
      value: round(stats.attackPower),
      from: `${base.attackPower} base + strength`,
    },
    ...(stats.rangedAttackPower !== 0
      ? [{ label: 'Ranged Attack Power', value: round(stats.rangedAttackPower) }]
      : []),
    { label: 'Armor', value: round(stats.armor), from: 'agility' },
    {
      label: 'Crit Chance',
      value: `${stats.critChance.toFixed(2)}%`,
      from: `${base.critChance}% base + agility`,
    },
    ...(stats.spellCritChance !== 0
      ? [
          {
            label: 'Spell Crit Chance',
            value: `${stats.spellCritChance.toFixed(2)}%`,
            from: `${base.spellCritChance}% base + intellect`,
          },
        ]
      : []),
    { label: 'Dodge Chance', value: `${stats.dodgeChance.toFixed(2)}%`, from: 'agility' },
    ...(stats.manaPer5 !== 0
      ? [
          {
            label: 'Mana per 5 sec',
            value: stats.manaPer5.toFixed(1),
            from: 'spirit (not yet regenerating)',
          },
        ]
      : []),
  ];

  return (
    <table className="base-stats">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="numeric">{row.value}</td>
            <td className="numeric muted">{row.from ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function round(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Which equipment slots the current style uses.
 *
 * Gear does not exist yet, so this describes the rules rather than showing what
 * is equipped. It is the part of the style selector that "prompts the GUI to
 * display the correct information": a two-hander has no off-hand, a ranged
 * style needs a bow, a bear does not swing what it is holding.
 */
function WeaponSlots({ style }: { readonly style: CombatStyleId }) {
  const definition = getCombatStyle(style);
  if (!definition) return null;

  const rows: { slot: string; rule: string }[] = [
    { slot: 'Main hand', rule: describeMainHand(definition.mainHand) },
    { slot: 'Off hand', rule: describeOffHand(definition.offHand) },
    { slot: 'Ranged', rule: describeRanged(definition.rangedSlot) },
  ];

  return (
    <table className="base-stats">
      <tbody>
        {rows.map((row) => (
          <tr key={row.slot}>
            <td>{row.slot}</td>
            <td className="numeric muted">{row.rule}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function describeMainHand(rule: string): string {
  switch (rule) {
    case 'two-hand':
      return 'two-handed weapon, swings';
    case 'one-hand':
      return 'one-handed weapon, swings';
    case 'stat-stick':
      return 'stats only, does not swing';
    default:
      return 'unused';
  }
}

function describeOffHand(rule: string): string {
  switch (rule) {
    case 'weapon':
      return 'second weapon, swings';
    case 'shield':
      return 'shield';
    case 'stat-stick':
      return 'stats only, does not swing';
    default:
      return 'unused';
  }
}

function describeRanged(rule: string): string {
  switch (rule) {
    case 'required':
      return 'required, swings';
    case 'stat-stick':
      return 'stats only';
    default:
      return 'unused';
  }
}
