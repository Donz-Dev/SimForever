import type { CharacterProfile } from '../../profiles';
import type { ClassId, CombatStyleId } from '../../game/character';
import { createPlayer } from '../../game/actors/createPlayer';
import { characterAtCombatStart } from '../../simulator';
import { getStance, isTankBuild, resolveStance } from '../../game/character';
import { createTrainingDummy } from '../../game/actors/createTrainingDummy';
import { createForeverAttackChances } from '../../game/combat/attackChances';
import { getClass, resolveCombatStyle, resourceLabel } from '../../game/character';
import { armorReduction, hasteMultiplierFrom, toPercent } from '../../engine';
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
 * Build the character the simulation will build, AT THE MOMENT IT BEGINS.
 *
 * Not `createPlayer` alone, which was the bug this replaces. A stance is an
 * aura, and an aura's stat modifiers are applied when combat starts --
 * `createPlayer` only records which auras to open with. So the sheet was
 * showing a Warrior standing in no stance, and a Berserker dual-wielder's
 * crit chance read three percentage points below what the fight would roll.
 *
 * Adding three in this file would have fixed the number and created the real
 * problem: two places that know what Berserker Stance is worth. This asks the
 * simulator instead, so the sheet cannot disagree with the fight.
 */
function buildPlayer(profile: CharacterProfile, style: CombatStyleId) {
  return (
    characterAtCombatStart(profile) ??
    createPlayer({
      race: profile.character.race,
      characterClass: profile.character.characterClass,
      combatStyle: style,
      bonusStats: profile.stats,
      equipment: profile.equipment,
      talents: profile.talents,
    })
  );
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
  const forSlot = (slot: 'mainHand' | 'offHand') =>
    chances('melee-auto', player, target, { slot });

  /**
   * A combat table number, per hand when there are two.
   *
   * Miss and enemy dodge BOTH derive from the wielding weapon's skill, so a
   * sword in one hand and a mace in the other give two different answers the
   * moment anything grants skill with one and not the other. Showing a single
   * figure would average away a difference the fight does not average away.
   *
   * The dual-wield penalty applies to both hands, so it is not what separates
   * them -- weapon skill is.
   */
  const perHand = (pick: (chances: ReturnType<typeof forSlot>) => number) =>
    style === 'dual_wield'
      ? `MH: ${percent(pick(forSlot('mainHand')))} | OH: ${percent(pick(forSlot('offHand')))}`
      : percent(pick(forSlot('mainHand')));

  const rows: SheetRow[] = [
    /*
     * The stance leads, because it changes almost everything under it: crit,
     * damage done, damage taken, and which abilities are even castable. It
     * was visible only in the one-line summary above the sheet, which is the
     * wrong place for something this load-bearing.
     */
    {
      label: 'Stance',
      value:
        getStance(resolveStance(style, profile.character.stance))?.name ?? 'None',
    },
    { label: 'Hit Points', value: round(player.health.maximum) },
    { label: 'Armor', value: round(stats.armor) },
    { label: 'Strength', value: round(stats.strength) },
    { label: 'Agility', value: round(stats.agility) },
    { label: 'Attack Power', value: round(stats.attackPower) },
  ];

  rows.push({ label: 'Chance to Miss', value: perHand((c) => c.miss) });

  /*
   * OFF-HAND HIT, its own row when a talent grants any.
   *
   * The miss row above already moves -- ten points of hit is ten points less
   * miss -- but a number that is simply lower than it was does not say WHY,
   * and Dual Wield Specialization's third clause is the one that looks like
   * nothing happened. This names it.
   *
   * Hidden at zero rather than shown as "0.00%", which would suggest a stat
   * that exists and is worth nothing.
   */
  const offHandHit = player.hitBonusFor('offHand');
  if (offHandHit > 0) {
    rows.push({ label: 'Off-Hand Hit', value: `+${offHandHit.toFixed(2)}%` });
  }
  rows.push({ label: 'Enemy Dodge', value: perHand((c) => c.dodge) });

  // Enemy parry applies only to a character standing in front of the target,
  // which the ruleset reads as one holding a shield -- so there is only ever
  // one hand to report it for. It does not derive from weapon skill either. A
  // zero for everyone else would suggest the number was computed and came out
  // at nil.
  if (style === 'one_hand_shield') {
    rows.push({ label: 'Enemy Parry', value: percent(forSlot('mainHand').parry) });
  }

  /*
   * THE CHARACTER SHEET FIGURE, which is what the in-game one shows.
   *
   * Crit suppression against a higher-level target -- 4.8 points against a
   * level 63 boss -- is deliberately NOT subtracted here. It is not a
   * property of the character; it is applied by the combat table when the
   * roll happens, the same way it is hidden in game. `critSuppression` in
   * `game/combat/attackChances.ts` is the one place it lives, and the crit
   * rates in the results breakdown are what it looks like once applied.
   *
   * Showing the suppressed number here would make the sheet disagree with
   * every other tool and with the game, and would also be wrong the moment
   * the encounter's target level changed.
   */
  /*
   * DEFENSIVE ROWS, for a build that is actually tanking.
   *
   * Shown only for a shield in Defensive Stance, because for anyone else they
   * are five rows of zero and noise -- a dual-wielder has no block chance and
   * no reason to care about its parry. The same rule decides whether the
   * encounter's target swings back.
   *
   * These are the numbers the attacks-received table actually rolls against,
   * read from the same character the fight builds.
   */
  if (isTankBuild(style, profile.character.stance)) {
    const received = chances('melee-received', target, player, {});

    rows.push({
      label: 'Defense Skill',
      // Total, not the surplus. 300 of it is free at level 60 and the
      // character sheet in game shows the whole number.
      value: round(player.defenseSkill),
    });
    rows.push({ label: 'Dodge', value: percent(received.dodge) });
    rows.push({ label: 'Parry', value: percent(received.parry) });
    rows.push({ label: 'Block', value: percent(received.block) });
    rows.push({ label: 'Block Value', value: round(stats.blockValue) });
    /*
     * The boss's side of the same table. Its miss and crit are what defense
     * skill moves, and a tank has no other way to see that the talent did
     * anything -- the character's own dodge going up is only three of the five
     * things a point of defense buys.
     */
    rows.push({ label: 'Target Miss', value: percent(received.miss) });
    rows.push({ label: 'Target Crit', value: percent(received.crit) });
    rows.push({ label: 'Target Crush', value: percent(received.crush) });
    rows.push({
      label: 'Armor Reduction',
      value: `${(armorReduction(stats.armor, profile.encounter.targetLevel) * 100).toFixed(2)}%`,
    });
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
