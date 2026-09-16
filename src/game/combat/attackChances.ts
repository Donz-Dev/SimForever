import type {
  AttackChanceProvider,
  AttackChances,
  AttackContext,
  AttackTableKind,
  Combatant,
  RollUnits,
  WeaponSlot,
} from '../../engine';
import { NO_CHANCES, toRollUnits } from '../../engine';
import type { CombatStyleId } from '../character';

/**
 * The World of Warcraft: Forever combat table numbers.
 *
 * Most of these are DERIVED from the difference between the attacker's weapon
 * skill and the defender's defense skill, rather than being flat. The constants
 * below are the coefficients in those formulas.
 *
 * Everything is in roll units, where 10000 is 100%. The formulas produce those
 * units directly: `600` means 6%.
 */
export const COMBAT_CONSTANTS = {
  /** Base miss when the skill gap is small (10 points or less). */
  missBaseSmallGap: 500,
  /** Base miss when the skill gap is large (more than 10 points). */
  missBaseLargeGap: 600,
  /** Miss added per point of skill deficit, on a small gap. */
  missPerSkillSmallGap: 10,
  /** Miss added per point of skill deficit, on a large gap. */
  missPerSkillLargeGap: 20,
  /** The skill gap above which the steeper miss formula applies. */
  largeGapThreshold: 10,

  /** Added to BOTH weapons' miss chance while dual-wielding. */
  dualWieldMissPenalty: 1900,

  /** Dodge, which scales with the skill gap. */
  dodgeBase: 500,
  dodgePerSkill: 10,

  /** Glancing blows, which scale with the defender's level rather than skill. */
  glanceBase: 1000,
  glancePerDefenseOver300: 200,

  /** Enemy parry. Not derived from skill; see PARRYABLE_STYLES. */
  enemyParry: 1400,

  /** Spells miss on their own flat chance, unaffected by weapon skill. */
  spellMiss: 1700,

  /**
   * Crit lost against a higher-level target: 180 plus 100 per level of
   * difference. Against a level 63 boss at level 60 that is 480, or 4.8
   * percentage points, which is enough to erase an ungeared character's crit
   * entirely.
   */
  critSuppressionBase: 180,
  critSuppressionPerLevel: 100,

  meleeCritMultiplier: 2,
  rangedCritMultiplier: 2,
  spellCritMultiplier: 1.5,

  /* --- Attacks received by the player --- */
  bossMiss: 500,
  bossCrush: 1500,
  bossCrushMultiplier: 1.5,
  bossCrit: 500,
  bossCritMultiplier: 2,
} as const;

/**
 * Styles that put the character in front of the target, where it can be
 * parried.
 *
 * INTERPRETATION. The source says enemy parry is 14%, "0% if 1H & Shield is not
 * selected". Read as: only a character tanking with a shield stands in front,
 * and everyone else is behind the target where parry cannot happen.
 */
const PARRYABLE_STYLES: ReadonlySet<CombatStyleId> = new Set<CombatStyleId>([
  'one_hand_shield',
]);

/** Looks up the combat style a combatant is fighting in. */
export type CombatStyleLookup = (combatantId: string) => CombatStyleId | undefined;

/**
 * Miss chance from a weapon skill deficit.
 *
 * Two regimes: past a 10-point gap the penalty per point doubles AND the base
 * rises, which is why a level 63 target (315 defense) is so much harder to hit
 * than a level 62 one for a character capped at 300 skill.
 *
 * `hit` is subtracted, and the result floors at zero.
 */
export function missFromSkill(
  skill: number,
  defenseSkill: number,
  hit: RollUnits,
  dualWieldPenalty: RollUnits,
): RollUnits {
  const gap = defenseSkill - skill;
  const large = defenseSkill > skill + COMBAT_CONSTANTS.largeGapThreshold;

  const base = large ? COMBAT_CONSTANTS.missBaseLargeGap : COMBAT_CONSTANTS.missBaseSmallGap;
  const perPoint = large
    ? COMBAT_CONSTANTS.missPerSkillLargeGap
    : COMBAT_CONSTANTS.missPerSkillSmallGap;

  return Math.max(0, base - hit + dualWieldPenalty + gap * perPoint);
}

/** Dodge chance from a weapon skill deficit. */
export function dodgeFromSkill(skill: number, defenseSkill: number): RollUnits {
  return Math.max(
    0,
    COMBAT_CONSTANTS.dodgeBase + (defenseSkill - skill) * COMBAT_CONSTANTS.dodgePerSkill,
  );
}

/**
 * Glancing blow chance.
 *
 * Depends on the defender's level alone, not on the attacker's skill: at
 * defense 315 it is 40%, and a character cannot reduce it by training.
 */
export function glanceChance(defenseSkill: number): RollUnits {
  return Math.max(
    0,
    COMBAT_CONSTANTS.glanceBase +
      (defenseSkill - 300) * COMBAT_CONSTANTS.glancePerDefenseOver300,
  );
}

/**
 * The damage range of a glancing blow, as multipliers.
 *
 * Both ends are floored to whole percentage points and capped, so at a
 * 15-point deficit a glance lands somewhere in 55%..75% of normal damage rather
 * than at a fixed value.
 */
export function glanceMultiplierRange(
  skill: number,
  defenseSkill: number,
): { min: number; max: number } {
  const gap = defenseSkill - skill;

  const min = Math.min(91, Math.floor((1.3 - gap * 0.05) * 100));
  const max = Math.min(99, Math.floor((1.2 - gap * 0.03) * 100));

  // Guard the degenerate case where a large gap pushes min above max.
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(0, Math.max(min, max));
  return { min: low / 100, max: high / 100 };
}

/** Crit lost against a higher-level target. Zero against equal or lower level. */
export function critSuppression(attackerLevel: number, targetLevel: number): RollUnits {
  if (targetLevel <= attackerLevel) return 0;
  return (
    COMBAT_CONSTANTS.critSuppressionBase +
    (targetLevel - attackerLevel) * COMBAT_CONSTANTS.critSuppressionPerLevel
  );
}

/** Build the Forever chance provider. */
export function createForeverAttackChances(
  styleOf: CombatStyleLookup = () => undefined,
): AttackChanceProvider {
  return (kind, source, target, context) =>
    buildChances(kind, source, target, context ?? {}, styleOf);
}

function buildChances(
  kind: AttackTableKind,
  source: Combatant,
  target: Combatant,
  context: AttackContext,
  styleOf: CombatStyleLookup,
): AttackChances {
  const stats = source.stats.effective;
  const defense = target.defenseSkill;
  const hit = toRollUnits(stats.hitChance);

  // Which weapon swung decides both the skill used and the dual-wield penalty.
  const slot: WeaponSlot = context.slot ?? 'mainHand';
  const skill = source.weaponSkill(slot);

  const crit = Math.max(
    0,
    toRollUnits(stats.critChance) - critSuppression(source.level, target.level),
  );
  const spellCrit = Math.max(
    0,
    toRollUnits(stats.spellCritChance) - critSuppression(source.level, target.level),
  );

  switch (kind) {
    case 'melee-auto': {
      // The off-hand always carries the penalty; the main hand only while
      // dual-wielding. Both hands are penalised, not one.
      const dualWield =
        slot === 'offHand' || source.autoAttack === 'dual-wield'
          ? COMBAT_CONSTANTS.dualWieldMissPenalty
          : 0;
      const glance = glanceMultiplierRange(skill, defense);

      return {
        ...NO_CHANCES,
        miss: missFromSkill(skill, defense, hit, dualWield),
        dodge: dodgeFromSkill(skill, defense),
        parry: parryChance(source, styleOf),
        glance: glanceChance(defense),
        crit,
        glanceMultiplierMin: glance.min,
        glanceMultiplierMax: glance.max,
        critMultiplier: COMBAT_CONSTANTS.meleeCritMultiplier,
      };
    }

    case 'melee-special':
      return {
        ...NO_CHANCES,
        // Specials never carry the dual-wield penalty: one strike, not one
        // per hand. They also never glance.
        miss: missFromSkill(skill, defense, hit, 0),
        dodge: dodgeFromSkill(skill, defense),
        parry: parryChance(source, styleOf),
        crit,
        critMultiplier: COMBAT_CONSTANTS.meleeCritMultiplier,
      };

    case 'ranged-auto':
    case 'ranged-special':
      // INTERPRETATION: the source gives no ranged formula, so ranged uses the
      // special-attack shape with the ranged weapon's skill: no dual-wield
      // penalty, no dodge, no parry, no glancing blow.
      return {
        ...NO_CHANCES,
        miss: missFromSkill(source.weaponSkill('ranged'), defense, hit, 0),
        crit,
        critMultiplier: COMBAT_CONSTANTS.rangedCritMultiplier,
      };

    case 'spell':
      return {
        ...NO_CHANCES,
        // Spell miss is flat: weapon skill has nothing to do with it.
        miss: Math.max(0, COMBAT_CONSTANTS.spellMiss - hit),
        crit: spellCrit,
        critMultiplier: COMBAT_CONSTANTS.spellCritMultiplier,
      };

    case 'melee-received':
      return {
        ...NO_CHANCES,
        miss: COMBAT_CONSTANTS.bossMiss,
        // MISSING DATA: the player's dodge and parry against incoming attacks
        // depend on a defense stat and on talents, neither of which exists.
        dodge: toRollUnits(target.stats.get('dodgeChance')),
        parry: 0,
        crush: COMBAT_CONSTANTS.bossCrush,
        crit: COMBAT_CONSTANTS.bossCrit,
        crushMultiplier: COMBAT_CONSTANTS.bossCrushMultiplier,
        critMultiplier: COMBAT_CONSTANTS.bossCritMultiplier,
      };
  }
}

/** Enemy parry, which only applies to a character standing in front of it. */
function parryChance(source: Combatant, styleOf: CombatStyleLookup): RollUnits {
  const style = styleOf(source.id);
  return style !== undefined && PARRYABLE_STYLES.has(style)
    ? COMBAT_CONSTANTS.enemyParry
    : 0;
}
