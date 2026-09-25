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
export type { DamageRequest, DamageResolution, WeaponScaling } from './damage';
export {
  DEFAULT_DAMAGE_VARIANCE,
  appliesArmor,
  armorDamageMultiplier,
  armorReduction,
  dealDamage,
  grantGeneratedResource,
  handMultiplier,
  resolveDamage,
  scaleByPower,
  spellPowerFor,
  weaponDamageFor,
} from './damage';
export type { AttackEvent, AbilityCastEvent, CastReaction, Reaction, ReactionTrigger } from './reactions';
export { runReactions, runCastReactions, isWeaponUse, isWeaponUseOf } from './reactions';
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
export type { AbilityModifier, SchoolModifier } from './abilityModifiers';
export {
  ALL_ABILITIES,
  AbilityModifiers,
  AttackTableModifiers,
  SchoolModifiers,
} from './abilityModifiers';

export type { TargetSelection } from './targeting';
export { SINGLE_TARGET, selectTargets, unreachedTargets } from './targeting';
