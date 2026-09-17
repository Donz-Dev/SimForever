import type { PartialStats } from '../engine';
import type { ClassId, CombatStyleId, RaceId } from '../game/character';
import type { Equipment } from '../game/items/Item';
import type { TalentAllocation } from '../game/talents/Talent';

/**
 * The profile format version.
 *
 * Bump this whenever the shape changes in a way that older files do not match,
 * and add a step to `migrations` in `migrateProfile.ts`. Every saved profile
 * carries its version, so a file written today keeps loading after the format
 * moves on. Getting this in before anyone has saved anything is much cheaper
 * than retrofitting it later.
 */
export const CURRENT_PROFILE_VERSION = 5;

export interface CharacterSection {
  readonly name: string;
  /**
   * Race and class are stored as ids (`night_elf`, not `Night Elf`), so that
   * display names can be reworded without invalidating saved profiles.
   *
   * Faction is deliberately NOT stored. It is determined by the race, so
   * storing it would allow a profile to claim an Alliance Orc. Derive it with
   * `getRace(profile.character.race).faction`. If Forever ever introduces a
   * race playable by both factions, this becomes a real field.
   */
  readonly race: RaceId;
  readonly characterClass: ClassId;
  readonly level: number;
  /**
   * How the character fights: which weapons auto-attack, and which action
   * priority list applies.
   *
   * For a Druid this is also its form, and so determines hit points, attack
   * power and the active resource. Omitted means "use the class default".
   */
  readonly combatStyle?: CombatStyleId;
}

export interface SimulationSection {
  /**
   * Fight length in SECONDS.
   *
   * Profiles are written and read by people, so they use seconds; the engine
   * works exclusively in milliseconds. `toSimulationConfig` is the one place
   * that converts, which is how the two conventions never get mixed up.
   */
  readonly durationSeconds: number;
  /** Fraction of random variation in fight length. 0.1 means +/-10%. */
  readonly durationVariance: number;
  /** Monte Carlo iteration count. 1 runs a single fight. */
  readonly iterations: number;
  /** Base RNG seed. The same seed reproduces the run exactly. */
  readonly seed: number;
}

export interface EncounterSection {
  readonly targetName: string;
  readonly targetHealth: number;
  readonly targetArmor: number;
  /**
   * Target level. Sets defense skill (5 x level), the armor constant and
   * crit suppression, so it shapes the entire combat table.
   */
  readonly targetLevel: number;
}

/**
 * Everything needed to reproduce a simulation, as plain JSON-safe data.
 *
 * Deliberately free of engine objects: a profile can be saved to a file,
 * pasted into a text box, or sent to a server. Gear, talents and professions
 * will become further sections here as they are implemented.
 */
export interface CharacterProfile {
  readonly version: number;
  readonly character: CharacterSection;
  /**
   * Stats from gear, buffs and anything else, ADDED to the race and class base
   * from the base stats table. A profile describes what a character has beyond
   * being a level 60 Tauren Druid, not their stats from scratch.
   */
  readonly stats: PartialStats;
  /**
   * What is equipped, by slot, as item ids with an optional enchant.
   *
   * Ids rather than copies of the items: an item's numbers belong to the item
   * data, and a profile that carried its own would drift the moment that data
   * was corrected. Added in format version 4; older profiles have none, which
   * reads as an empty set.
   */
  readonly equipment: Equipment;
  /**
   * Points spent per talent, by talent id.
   *
   * Talent ids are unique WITHIN a class, not across classes, so this map only
   * means anything alongside `character.characterClass`. A profile that changed
   * class would be carrying another class's talents, which is why the UI clears
   * them when the class changes rather than trying to translate them.
   *
   * Added in format version 5, when talents first affected a simulation by
   * gating which abilities a character knows. Older profiles have none, which
   * reads as an empty allocation: no talents, and therefore no talent-granted
   * abilities.
   */
  readonly talents: TalentAllocation;
  readonly simulation: SimulationSection;
  readonly encounter: EncounterSection;
}

/** A sensible starting profile, matching the first-milestone prototype. */
export function createDefaultProfile(): CharacterProfile {
  return {
    version: CURRENT_PROFILE_VERSION,
    character: {
      name: 'Example',
      race: 'human',
      characterClass: 'warrior',
      level: 60,
    },
    // Stats from gear and other sources, ADDED to the race/class base. A brand
    // new character has none, which is why these are all zero.
    stats: {
      attackPower: 0,
      critRating: 0,
      hasteRating: 0,
    },
    // Nothing equipped. Gear is chosen in the Gear panel.
    equipment: {},
    // No talents spent. A warrior with an empty tree knows no Mortal Strike,
    // no Bloodthirst and no Shield Slam, which is what the trees say.
    talents: {},
    simulation: {
      durationSeconds: 100,
      durationVariance: 0,
      iterations: 1,
      seed: 12345,
    },
    encounter: {
      targetName: 'Training Dummy',
      targetHealth: 100_000,
      targetArmor: 3731,
      targetLevel: 63,
    },
  };
}

/** A deep copy, so callers can edit without touching the original. */
export function cloneProfile(profile: CharacterProfile): CharacterProfile {
  return {
    version: profile.version,
    character: { ...profile.character },
    stats: { ...profile.stats },
    // One level deeper than a spread: each slot is its own object, so copying
    // only the map would leave both profiles sharing the same slot entries.
    equipment: Object.fromEntries(
      Object.entries(profile.equipment).map(([slot, equipped]) => [slot, { ...equipped }]),
    ),
    talents: { ...profile.talents },
    simulation: { ...profile.simulation },
    encounter: { ...profile.encounter },
  };
}
