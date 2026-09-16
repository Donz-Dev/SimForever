import type {
  AttackChanceProvider,
  AttackChances,
  AttackTableKind,
  Combatant,
} from '../../engine';
import { NO_CHANCES, toRollUnits } from '../../engine';
import type { CombatStyleId } from '../character';

/**
 * The World of Warcraft: Forever combat table numbers.
 *
 * Every value here is a base chance before any stat, talent or gear changes it.
 * They are percentages; `toRollUnits` converts them to the 1-10000 integer
 * space the tables actually roll in.
 */
export const BASE_CHANCES = {
  /** Melee and ranged miss, before hit rating. */
  meleeMiss: 8,
  rangedMiss: 8,
  /** Spells miss more than weapons do. A missed spell is a full resist. */
  spellMiss: 17,

  /**
   * Added to BOTH weapons' miss chance while dual-wielding. Not halved, not
   * applied to one hand: each swing carries the full penalty.
   */
  dualWieldMissPenalty: 19,

  /** The target's chance to avoid an incoming attack. */
  enemyDodge: 6.5,
  enemyParry: 14,

  /** Glancing blows, which only happen on melee auto-attacks. */
  glance: 40,
  /** A glance deals 70% damage: the stated 30% penalty. */
  glanceMultiplier: 0.7,

  /** Damage multipliers when the corresponding outcome comes up. */
  meleeCritMultiplier: 2,
  rangedCritMultiplier: 2,
  spellCritMultiplier: 1.5,

  /* --- Attacks received by the player --- */
  bossMiss: 5,
  bossCrush: 15,
  bossCrushMultiplier: 1.5,
  bossCrit: 5,
  bossCritMultiplier: 2,
} as const;

/**
 * Styles that put the character in front of the target, where it can be
 * parried.
 *
 * INTERPRETATION. The source says enemy parry is 14%, "0% if 1H & Shield is not
 * selected". Read as: only a character tanking with a shield stands in front,
 * and everyone else is behind the target, where parry cannot happen. If parry
 * should instead depend on facing or threat directly, this is the one place to
 * change.
 */
const PARRYABLE_STYLES: ReadonlySet<CombatStyleId> = new Set<CombatStyleId>([
  'one_hand_shield',
]);

/** Looks up the combat style a combatant is fighting in. */
export type CombatStyleLookup = (combatantId: string) => CombatStyleId | undefined;

/**
 * Build the Forever chance provider.
 *
 * Takes a style lookup rather than reading the style off the combatant, because
 * combat style is game content and the engine's `Combatant` deliberately does
 * not know about it.
 */
export function createForeverAttackChances(
  styleOf: CombatStyleLookup = () => undefined,
): AttackChanceProvider {
  return (kind, source, target) => buildChances(kind, source, target, styleOf);
}

function buildChances(
  kind: AttackTableKind,
  source: Combatant,
  target: Combatant,
  styleOf: CombatStyleLookup,
): AttackChances {
  const stats = source.stats.effective;

  switch (kind) {
    case 'melee-auto':
      return {
        ...NO_CHANCES,
        miss: toRollUnits(meleeMissPercent(source)),
        dodge: toRollUnits(BASE_CHANCES.enemyDodge),
        parry: toRollUnits(parryPercent(source, styleOf)),
        glance: toRollUnits(BASE_CHANCES.glance),
        crit: toRollUnits(stats.critChance),
        glanceMultiplier: BASE_CHANCES.glanceMultiplier,
        critMultiplier: BASE_CHANCES.meleeCritMultiplier,
      };

    case 'ranged-auto':
      return {
        ...NO_CHANCES,
        miss: toRollUnits(BASE_CHANCES.rangedMiss),
        crit: toRollUnits(stats.critChance),
        critMultiplier: BASE_CHANCES.rangedCritMultiplier,
      };

    case 'melee-special':
      return {
        ...NO_CHANCES,
        // Special attacks never carry the dual-wield penalty: they are one
        // strike, not one per hand.
        miss: toRollUnits(BASE_CHANCES.meleeMiss),
        dodge: toRollUnits(BASE_CHANCES.enemyDodge),
        parry: toRollUnits(parryPercent(source, styleOf)),
        crit: toRollUnits(stats.critChance),
        critMultiplier: BASE_CHANCES.meleeCritMultiplier,
      };

    case 'ranged-special':
      return {
        ...NO_CHANCES,
        miss: toRollUnits(BASE_CHANCES.rangedMiss),
        crit: toRollUnits(stats.critChance),
        critMultiplier: BASE_CHANCES.rangedCritMultiplier,
      };

    case 'spell':
      return {
        ...NO_CHANCES,
        miss: toRollUnits(BASE_CHANCES.spellMiss),
        crit: toRollUnits(stats.spellCritChance),
        critMultiplier: BASE_CHANCES.spellCritMultiplier,
      };

    case 'melee-received':
      return {
        ...NO_CHANCES,
        miss: toRollUnits(BASE_CHANCES.bossMiss),
        // MISSING DATA: the player's dodge and parry against incoming attacks
        // depend on a defense stat and on talents, neither of which exists.
        // The target's computed dodge chance is used for dodge; parry is zero
        // rather than guessed.
        dodge: toRollUnits(target.stats.get('dodgeChance')),
        parry: 0,
        crush: toRollUnits(BASE_CHANCES.bossCrush),
        crit: toRollUnits(BASE_CHANCES.bossCrit),
        crushMultiplier: BASE_CHANCES.bossCrushMultiplier,
        critMultiplier: BASE_CHANCES.bossCritMultiplier,
      };
  }
}

/** Melee auto-attack miss, including the dual-wield penalty on both hands. */
function meleeMissPercent(source: Combatant): number {
  const penalty =
    source.autoAttack === 'dual-wield' ? BASE_CHANCES.dualWieldMissPenalty : 0;
  return BASE_CHANCES.meleeMiss + penalty;
}

/** Enemy parry, which only applies to a character standing in front of it. */
function parryPercent(source: Combatant, styleOf: CombatStyleLookup): number {
  const style = styleOf(source.id);
  return style !== undefined && PARRYABLE_STYLES.has(style) ? BASE_CHANCES.enemyParry : 0;
}
