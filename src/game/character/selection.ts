import type { ClassDefinition, FactionDefinition, RaceDefinition } from './definitions';
import { CLASSES, FACTIONS, RACES } from './definitions';
import type { ClassId, FactionId, RaceId } from './ids';

/*
 * Lookup tables, built once. Character creation queries run on every keystroke
 * in the UI, and scanning the arrays each time would be wasteful for data that
 * never changes.
 */
const RACE_BY_ID = new Map<RaceId, RaceDefinition>(RACES.map((race) => [race.id, race]));
const CLASS_BY_ID = new Map<ClassId, ClassDefinition>(
  CLASSES.map((characterClass) => [characterClass.id, characterClass]),
);
const FACTION_BY_ID = new Map<FactionId, FactionDefinition>(
  FACTIONS.map((faction) => [faction.id, faction]),
);

export function getFaction(id: FactionId): FactionDefinition | undefined {
  return FACTION_BY_ID.get(id);
}

export function getRace(id: RaceId): RaceDefinition | undefined {
  return RACE_BY_ID.get(id);
}

export function getClass(id: ClassId): ClassDefinition | undefined {
  return CLASS_BY_ID.get(id);
}

/** Display name for a race, falling back to the raw id if unknown. */
export function raceName(id: RaceId): string {
  return RACE_BY_ID.get(id)?.name ?? id;
}

/** Display name for a class, falling back to the raw id if unknown. */
export function className(id: ClassId): string {
  return CLASS_BY_ID.get(id)?.name ?? id;
}

export function factionName(id: FactionId): string {
  return FACTION_BY_ID.get(id)?.name ?? id;
}

/** Races belonging to a faction, in display order. */
export function racesForFaction(faction: FactionId): readonly RaceDefinition[] {
  return RACES.filter((race) => race.faction === faction);
}

/** Classes a race may choose, in display order. */
export function classesForRace(race: RaceId): readonly ClassDefinition[] {
  const definition = RACE_BY_ID.get(race);
  if (!definition) return [];
  return definition.classes
    .map((id) => CLASS_BY_ID.get(id))
    .filter((entry): entry is ClassDefinition => entry !== undefined);
}

/**
 * Races that can play a class. The reverse lookup, for the player who decides
 * "I want to be a Paladin" before deciding anything else.
 */
export function racesForClass(
  characterClass: ClassId,
  faction?: FactionId,
): readonly RaceDefinition[] {
  return RACES.filter(
    (race) =>
      race.classes.includes(characterClass) &&
      (faction === undefined || race.faction === faction),
  );
}

/** Classes available anywhere in a faction. */
export function classesForFaction(faction: FactionId): readonly ClassDefinition[] {
  const available = new Set<ClassId>();
  for (const race of RACES) {
    if (race.faction !== faction) continue;
    for (const id of race.classes) available.add(id);
  }
  return CLASSES.filter((entry) => available.has(entry.id));
}

/** Whether this race may play this class. */
export function isValidCombination(race: RaceId, characterClass: ClassId): boolean {
  return RACE_BY_ID.get(race)?.classes.includes(characterClass) ?? false;
}

/** A complete character-creation choice. */
export interface CharacterSelection {
  readonly faction: FactionId;
  readonly race: RaceId;
  readonly characterClass: ClassId;
}

/** Whether every part of a selection agrees with the others. */
export function isValidSelection(selection: CharacterSelection): boolean {
  const race = RACE_BY_ID.get(selection.race);
  if (!race) return false;
  if (race.faction !== selection.faction) return false;
  return race.classes.includes(selection.characterClass);
}

/** The first legal selection, used as the starting point for a new character. */
export function defaultSelection(): CharacterSelection {
  const race = RACES[0];
  return {
    faction: race.faction,
    race: race.id,
    characterClass: race.classes[0],
  };
}

/**
 * Apply a change to a selection, cascading so the result is always legal.
 *
 * This is the actual character-creation decision flow, and it lives here rather
 * than in the React component so it can be tested without rendering anything.
 *
 * The rules, in order:
 *
 *   1. Changing faction keeps the current race if it belongs to that faction,
 *      otherwise moves to the faction's first race.
 *   2. Changing race keeps the current class if the new race can play it. A
 *      player switching from Orc Warrior to Tauren stays a Warrior rather than
 *      being silently reset to Druid.
 *   3. A class the resulting race cannot play falls back to that race's first
 *      class.
 *
 * Rule 2 is the one that matters for feel: the alternative resets the player's
 * real decision every time they browse races.
 */
export function applySelection(
  change: Partial<CharacterSelection>,
  current: CharacterSelection,
): CharacterSelection {
  const faction = change.faction ?? current.faction;

  let race = change.race ?? current.race;
  let raceDefinition = RACE_BY_ID.get(race);

  // The race must exist and belong to the chosen faction.
  if (!raceDefinition || raceDefinition.faction !== faction) {
    const candidates = racesForFaction(faction);
    raceDefinition = candidates[0];
    race = raceDefinition.id;
  }

  // Prefer the explicitly requested class, then the one already chosen, then
  // the race's first available class.
  const preferred = change.characterClass ?? current.characterClass;
  const characterClass = raceDefinition.classes.includes(preferred)
    ? preferred
    : raceDefinition.classes[0];

  return { faction, race, characterClass };
}
