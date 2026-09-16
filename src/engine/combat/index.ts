export type { DamageSchool } from './DamageSchool';
export { DAMAGE_SCHOOLS, isPhysical } from './DamageSchool';
export type {
  AttackChanceProvider,
  AttackChances,
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
  armorReduction,
  dealDamage,
  grantGeneratedResource,
  resolveDamage,
  scaleByPower,
} from './damage';
export type { HealRequest, HealResolution } from './healing';
export { applyHealing, resolveHealing } from './healing';
export {
  ARMOR_CONSTANT,
  MAX_ARMOR_REDUCTION,
  RATING_PER_PERCENT,
  applyHaste,
  critChanceFrom,
  hasteMultiplierFrom,
  spellCritChanceFrom,
  versatilityMultiplierFrom,
} from './ratings';
