import type { CharacterProfile } from '../../profiles';
import type { CombatStyleId } from '../../game/character';
import { createPlayer } from '../../game/actors/createPlayer';
import { getClass, resolveCombatStyle, resourceLabel } from '../../game/character';
import { NumberField } from '../components/Field';
import { Panel } from '../components/Panel';

interface CharacterSheetPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * Step two: what the character is worth.
 *
 * Split out of the character panel, which now only answers "who is fighting".
 * This is the part that changes as gear does, so it sits next to the gear
 * inputs that drive it.
 *
 * The derivation column that used to sit beside every stat is gone. It
 * explained where each number came from, which is worth reading exactly once
 * and is noise on every later glance; the same information lives in
 * `docs/character-creation.md`, where it can be read deliberately.
 */
export function CharacterSheetPanel({ profile, onChange }: CharacterSheetPanelProps) {
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );

  return (
    <Panel title="Character sheet">
      <CharacterSheet profile={profile} style={style} />

      <h3>Gear and other bonuses</h3>
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
      <NumberField
        label="Hit %"
        hint="reduces miss chance"
        value={profile.stats.hitChance ?? 0}
        min={0}
        max={100}
        step={0.5}
        onChange={(value) =>
          onChange({ ...profile, stats: { ...profile.stats, hitChance: value } })
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
  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: style,
    bonusStats: profile.stats,
  });

  const stats = player.stats.effective;
  const mana = player.resources.get('mana');
  const definition = getClass(profile.character.characterClass);
  const other =
    definition && definition.primaryResource !== 'mana'
      ? player.resources.get(definition.primaryResource)
      : undefined;

  const rows: { label: string; value: string }[] = [
    { label: 'Hit Points', value: round(player.health.maximum) },
    ...(mana ? [{ label: 'Mana', value: round(mana.maximum) }] : []),
    ...(other ? [{ label: resourceLabel(other.type), value: round(other.maximum) }] : []),

    { label: 'Strength', value: round(stats.strength) },
    { label: 'Agility', value: round(stats.agility) },
    { label: 'Stamina', value: round(stats.stamina) },
    { label: 'Intellect', value: round(stats.intellect) },
    { label: 'Spirit', value: round(stats.spirit) },

    { label: 'Attack Power', value: round(stats.attackPower) },
    ...(stats.rangedAttackPower !== 0
      ? [{ label: 'Ranged Attack Power', value: round(stats.rangedAttackPower) }]
      : []),
    { label: 'Armor', value: round(stats.armor) },
    { label: 'Crit Chance', value: `${stats.critChance.toFixed(2)}%` },
    ...(stats.spellCritChance !== 0
      ? [{ label: 'Spell Crit Chance', value: `${stats.spellCritChance.toFixed(2)}%` }]
      : []),
    { label: 'Dodge Chance', value: `${stats.dodgeChance.toFixed(2)}%` },
    ...(stats.manaPer5 !== 0 ? [{ label: 'Mana per 5 sec', value: stats.manaPer5.toFixed(1) }] : []),
  ];

  return (
    <table className="base-stats">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="numeric">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function round(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
