import type { PartialStats } from '../engine';
import type { ClassId, RaceId } from '../game/character';

/**
 * The profile format version.
 *
 * Bump this whenever the shape changes in a way that older files do not match,
 * and add a step to `migrations` in `migrateProfile.ts`. Every saved profile
 * carries its version, so a file written today keeps loading after the format
 * moves on. Getting this in before anyone has saved anything is much cheaper
 * than retrofitting it later.
 */
export const CURRENT_PROFILE_VERSION = 1;

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
  readonly stats: PartialStats;
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
    stats: {
      strength: 100,
      attackPower: 100,
      critRating: 0,
      hasteRating: 0,
    },
    simulation: {
      durationSeconds: 100,
      durationVariance: 0,
      iterations: 1,
      seed: 12345,
    },
    encounter: {
      targetName: 'Training Dummy',
      targetHealth: 100_000,
      targetArmor: 0,
    },
  };
}

/** A deep copy, so callers can edit without touching the original. */
export function cloneProfile(profile: CharacterProfile): CharacterProfile {
  return {
    version: profile.version,
    character: { ...profile.character },
    stats: { ...profile.stats },
    simulation: { ...profile.simulation },
    encounter: { ...profile.encounter },
  };
}
