/**
 * Character creation: factions, races, classes and the rules binding them.
 *
 * This is the first decision a player makes, in the game and in SimForever:
 * faction, then race, then class. Everything here is World of Warcraft:
 * Forever content, not engine behaviour.
 */
export type { ClassId, CombatStyleId, FactionId, RaceId } from './ids';
export {
  CLASS_IDS,
  COMBAT_STYLE_IDS,
  FACTION_IDS,
  RACE_IDS,
  isClassId,
  isCombatStyleId,
  isFactionId,
  isRaceId,
} from './ids';
export type {
  CombatStyleDefinition,
  MainHandRule,
  OffHandRule,
  RangedRule,
} from './combatStyles';
export {
  COMBAT_STYLES,
  classHasCombatStyle,
  combatStylesFor,
  defaultCombatStyleFor,
  getCombatStyle,
  resolveCombatStyle,
} from './combatStyles';
export type {
  ClassDefinition,
  FactionDefinition,
  FormDefinition,
  RaceDefinition,
} from './definitions';
export type { BaseStatBlock, BaseStatVariant } from './baseStatTypes';
export { BASE_STATS } from './baseStats';
export {
  allBaseStatEntries,
  baseHitPointsFor,
  baseManaFor,
  baseStatsFor,
  baseStatsToEngineStats,
} from './baseStatLookup';
export type { StatConversions } from './conversions';
export {
  conversionsFor,
  deriveFromPrimaries,
  statDerivationFor,
} from './conversions';
export type { ResourceMaximumOverrides } from './resources';
export {
  FIXED_RESOURCE_MAXIMUMS,
  activeResourceFor,
  classUsesResource,
  fixedMaximumFor,
  formsFor,
  resourceLabel,
  resourceSpecsFor,
} from './resources';
export {
  CLASSES,
  FACTIONS,
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  RACES,
} from './definitions';
export type { CharacterSelection } from './selection';
export {
  applySelection,
  className,
  classesForFaction,
  classesForRace,
  defaultSelection,
  factionName,
  getClass,
  getFaction,
  getRace,
  isValidCombination,
  isValidSelection,
  raceName,
  racesForClass,
  racesForFaction,
} from './selection';
