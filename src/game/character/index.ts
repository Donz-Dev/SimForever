/**
 * Character creation: factions, races, classes and the rules binding them.
 *
 * This is the first decision a player makes, in the game and in SimForever:
 * faction, then race, then class. Everything here is World of Warcraft:
 * Forever content, not engine behaviour.
 */
export type { ClassId, FactionId, FormId, RaceId } from './ids';
export {
  CLASS_IDS,
  FACTION_IDS,
  FORM_IDS,
  RACE_IDS,
  isClassId,
  isFactionId,
  isFormId,
  isRaceId,
} from './ids';
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
