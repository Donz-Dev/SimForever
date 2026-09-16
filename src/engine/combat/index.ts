export type { DamageSchool } from './DamageSchool';
export { DAMAGE_SCHOOLS, isPhysical } from './DamageSchool';
export type {
  AttackChanceProvider,
  AttackChances,
  AttackContext,
  AttackOutcome,
  AttackResolution,
  AttackTableKind,
  RollUnits,
} from './attackTable';
export {
  AVOIDED_OUTCOMES,
  NO_CHANCES,
  ROLL_MAX,
  defaultAttackChances,
  isTwoRoll,
  outcomesFor,
  resolveAttackTable,
  toPercent,
  toRollUnits,
} from './attackTable';
export type { DamageRequest, DamageResolution } from './damage';
export {
  appliesArmor,
  armorDamageMultiplier,
  armorReduction,
  dealDamage,
  grantGeneratedResource,
  resolveDamage,
  scaleByPower,
} from './damage';
export type { HealRequest, HealResolution } from './healing';
export { applyHealing, resolveHealing } from './healing';
export {
  RATING_PER_PERCENT,
  applyHaste,
  armorConstantForLevel,
  critChanceFrom,
  hasteMultiplierFrom,
  spellCritChanceFrom,
  versatilityMultiplierFrom,
} from './ratings';
