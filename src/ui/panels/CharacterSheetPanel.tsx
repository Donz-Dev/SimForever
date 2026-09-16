import type { CharacterProfile } from '../../profiles';
import type { CombatStyleId } from '../../game/character';
import { createPlayer } from '../../game/actors/createPlayer';
import { getClass, resolveCombatStyle, resourceLabel } from '../../game/character';
import { Panel } from '../components/Panel';

interface CharacterSheetPanelProps {
  readonly profile: CharacterProfile;
}

/**
 * Step two: what the character is worth.
 *
 * Split out of the character panel, which now only answers "who is fighting".
 * This one answers "what are they worth".
 *
 * The derivation column that used to sit beside every stat is gone. It
 * explained where each number came from, which is worth reading exactly once
 * and is noise on every later glance; the same information lives in
 * `docs/character-creation.md`, where it can be read deliberately.
 *
 * Read-only. The gear and bonus inputs that used to sit below have gone with
 * gear itself still unimplemented: four number fields that add to a stat are
 * not gear, and until real items exist they only invite tuning against numbers
 * that mean nothing. `profile.stats` still exists and is still applied, so a
 * profile carrying bonuses is honoured; there is simply no longer a box here
 * encouraging anyone to invent some.
 */
export function CharacterSheetPanel({ profile }: CharacterSheetPanelProps) {
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );

  return (
    <Panel title="Character sheet">
      <CharacterSheet profile={profile} style={style} />
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
    equipment: profile.equipment,
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
