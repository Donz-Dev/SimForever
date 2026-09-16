export type { DamageSchool } from './DamageSchool';
export { DAMAGE_SCHOOLS, isPhysical } from './DamageSchool';
export type { DamageRequest, DamageResolution } from './damage';
export {
  applyCriticalMultiplier,
  armorReduction,
  dealDamage,
  resolveDamage,
  rollCritical,
  scaleByPower,
} from './damage';
export type { HealRequest, HealResolution } from './healing';
export { applyHealing, resolveHealing } from './healing';
export {
  ARMOR_CONSTANT,
  CRITICAL_STRIKE_MULTIPLIER,
  MAX_ARMOR_REDUCTION,
  RATING_PER_PERCENT,
  applyHaste,
  critChanceFrom,
  hasteMultiplierFrom,
  spellCritChanceFrom,
  versatilityMultiplierFrom,
} from './ratings';
