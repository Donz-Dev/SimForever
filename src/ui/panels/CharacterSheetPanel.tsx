import type { CharacterProfile } from '../../profiles';
import type { ClassId, CombatStyleId } from '../../game/character';
import { createPlayer } from '../../game/actors/createPlayer';
import { createTrainingDummy } from '../../game/actors/createTrainingDummy';
import { createForeverAttackChances } from '../../game/combat/attackChances';
import { getClass, resolveCombatStyle, resourceLabel } from '../../game/character';
import { hasteMultiplierFrom, toPercent } from '../../engine';
import { Panel } from '../components/Panel';

interface CharacterSheetPanelProps {
  readonly profile: CharacterProfile;
}

/** One line of the sheet. */
interface SheetRow {
  readonly label: string;
  readonly value: string;
}

/** Which classes have a considered sheet. Everything else gets the generic one. */
const TAILORED: ReadonlySet<ClassId> = new Set<ClassId>(['warrior']);

/**
 * Step two: what the character is worth.
 *
 * The rows are chosen PER CLASS, because the stats that decide a fight are not
 * the same for everyone: a warrior lives on attack power, chance to miss and
 * crit, and a mage on none of the three. Only the Warrior has a considered list
 * so far; the rest fall back to a generic dump, which is at least honest about
 * being generic rather than confidently showing a Mage its attack power.
 *
 * Several rows are not stats at all but combat table numbers -- chance to miss,
 * enemy dodge, enemy parry. Those depend on the TARGET as much as on the
 * character, so they are computed against the encounter's own target rather
 * than against an assumed raid boss.
 */
export function CharacterSheetPanel({ profile }: CharacterSheetPanelProps) {
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );

  const rows = TAILORED.has(profile.character.characterClass)
    ? warriorRows(profile, style)
    : genericRows(profile, style);

  return (
    <Panel title="Character sheet">
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
    </Panel>
  );
}

/**
 * Build the character the simulation will build.
 *
 * The same `createPlayer` the fight uses, rather than recomputing anything
 * here. A character sheet that disagreed with the fight would be worse than no
 * character sheet.
 */
function buildPlayer(profile: CharacterProfile, style: CombatStyleId) {
  return createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: style,
    bonusStats: profile.stats,
    equipment: profile.equipment,
  });
}

const round = (value: number) => Math.round(value).toLocaleString('en-US');

function warriorRows(profile: CharacterProfile, style: CombatStyleId): readonly SheetRow[] {
  const player = buildPlayer(profile, style);
  const target = createTrainingDummy({
    health: profile.encounter.targetHealth,
    armor: profile.encounter.targetArmor,
    level: profile.encounter.targetLevel,
  });

  // The same provider the fight uses, so the percentages shown are the ones
  // that will actually be rolled against.
  const chances = createForeverAttackChances(() => style);
  const stats = player.stats.effective;

  const percent = (units: number) => `${toPercent(units).toFixed(2)}%`;
  const missFor = (slot: 'mainHand' | 'offHand') =>
    chances('melee-auto', player, target, { slot }).miss;

  const rows: SheetRow[] = [
    { label: 'Hit Points', value: round(player.health.maximum) },
    { label: 'Armor', value: round(stats.armor) },
    { label: 'Strength', value: round(stats.strength) },
    { label: 'Agility', value: round(stats.agility) },
    { label: 'Attack Power', value: round(stats.attackPower) },
  ];

  // Chance to miss is per hand, and only a dual-wielder has two of them. One
  // number for a dual-wielder would hide the penalty that makes the off-hand
  // miss far more often than the main.
  rows.push({
    label: 'Chance to Miss',
    value:
      style === 'dual_wield'
        ? `MH: ${percent(missFor('mainHand'))} | OH: ${percent(missFor('offHand'))}`
        : percent(missFor('mainHand')),
  });

  const auto = chances('melee-auto', player, target, { slot: 'mainHand' });
  rows.push({ label: 'Enemy Dodge', value: percent(auto.dodge) });

  // Enemy parry applies only to a character standing in front of the target,
  // which the ruleset reads as one holding a shield. A zero for everyone else
  // would suggest the number was computed and came out at nil.
  if (style === 'one_hand_shield') {
    rows.push({ label: 'Enemy Parry', value: percent(auto.parry) });
  }

  rows.push({ label: 'Crit Chance', value: `${stats.critChance.toFixed(2)}%` });
  rows.push({
    label: 'Haste',
    value: `${((hasteMultiplierFrom(stats) - 1) * 100).toFixed(2)}%`,
  });

  return rows;
}

/** The fallback, for the eight classes with no considered list yet. */
function genericRows(profile: CharacterProfile, style: CombatStyleId): readonly SheetRow[] {
  const player = buildPlayer(profile, style);
  const stats = player.stats.effective;
  const mana = player.resources.get('mana');
  const definition = getClass(profile.character.characterClass);
  const other =
    definition && definition.primaryResource !== 'mana'
      ? player.resources.get(definition.primaryResource)
      : undefined;

  return [
    { label: 'Hit Points', value: round(player.health.maximum) },
    ...(mana ? [{ label: 'Mana', value: round(mana.maximum) }] : []),
    ...(other ? [{ label: resourceLabel(other.type), value: round(other.maximum) }] : []),
    { label: 'Strength', value: round(stats.strength) },
    { label: 'Agility', value: round(stats.agility) },
    { label: 'Stamina', value: round(stats.stamina) },
    { label: 'Intellect', value: round(stats.intellect) },
    { label: 'Spirit', value: round(stats.spirit) },
    { label: 'Attack Power', value: round(stats.attackPower) },
    { label: 'Armor', value: round(stats.armor) },
    { label: 'Crit Chance', value: `${stats.critChance.toFixed(2)}%` },
    ...(stats.spellCritChance !== 0
      ? [{ label: 'Spell Crit Chance', value: `${stats.spellCritChance.toFixed(2)}%` }]
      : []),
  ];
}
