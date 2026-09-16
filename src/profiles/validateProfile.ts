import { STAT_NAMES } from '../engine';
import type { StatName } from '../engine';
import type { CharacterProfile } from './CharacterProfile';

/** A validation failure, with enough detail to show next to the right field. */
export interface ValidationIssue {
  /** Dotted path, e.g. `simulation.durationSeconds`. */
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly profile: CharacterProfile }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

const STAT_NAME_SET = new Set<string>(STAT_NAMES);

/**
 * Check that an arbitrary parsed JSON value really is a profile.
 *
 * Anything coming from a file, a paste box or localStorage is untrusted, and
 * TypeScript's types are gone by the time it arrives. This is the boundary
 * where an unknown value becomes a `CharacterProfile`, and every path into the
 * app goes through it.
 *
 * Collects every problem rather than stopping at the first, so a user fixing a
 * hand-edited file sees the whole list at once.
 */
export function validateProfile(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: '', message: 'Profile must be an object.' }] };
  }

  requirePositiveInteger(value.version, 'version', issues);

  const character = value.character;
  if (!isRecord(character)) {
    issues.push({ path: 'character', message: 'Missing character section.' });
  } else {
    requireNonEmptyString(character.name, 'character.name', issues);
    requireNonEmptyString(character.race, 'character.race', issues);
    requireNonEmptyString(character.characterClass, 'character.characterClass', issues);
    requirePositiveInteger(character.level, 'character.level', issues);
  }

  const stats = value.stats;
  if (!isRecord(stats)) {
    issues.push({ path: 'stats', message: 'Missing stats section.' });
  } else {
    for (const [key, statValue] of Object.entries(stats)) {
      if (!STAT_NAME_SET.has(key)) {
        issues.push({ path: `stats.${key}`, message: `Unknown stat "${key}".` });
        continue;
      }
      if (typeof statValue !== 'number' || !Number.isFinite(statValue)) {
        issues.push({ path: `stats.${key}`, message: 'Stat must be a finite number.' });
      }
    }
  }

  const simulation = value.simulation;
  if (!isRecord(simulation)) {
    issues.push({ path: 'simulation', message: 'Missing simulation section.' });
  } else {
    requirePositiveNumber(simulation.durationSeconds, 'simulation.durationSeconds', issues);
    requireFraction(simulation.durationVariance, 'simulation.durationVariance', issues);
    requirePositiveInteger(simulation.iterations, 'simulation.iterations', issues);
    requireInteger(simulation.seed, 'simulation.seed', issues);
  }

  const encounter = value.encounter;
  if (!isRecord(encounter)) {
    issues.push({ path: 'encounter', message: 'Missing encounter section.' });
  } else {
    requireNonEmptyString(encounter.targetName, 'encounter.targetName', issues);
    requirePositiveNumber(encounter.targetHealth, 'encounter.targetHealth', issues);
    requireNonNegativeNumber(encounter.targetArmor, 'encounter.targetArmor', issues);
  }

  if (issues.length > 0) return { ok: false, issues };

  // Rebuild rather than casting, so unknown extra keys are dropped instead of
  // silently riding along into the rest of the app.
  const validated = value as unknown as CharacterProfile;
  const cleanStats: Partial<Record<StatName, number>> = {};
  for (const [key, statValue] of Object.entries(validated.stats)) {
    cleanStats[key as StatName] = statValue as number;
  }

  return {
    ok: true,
    profile: {
      version: validated.version,
      character: {
        name: validated.character.name,
        race: validated.character.race,
        characterClass: validated.character.characterClass,
        level: validated.character.level,
      },
      stats: cleanStats,
      simulation: {
        durationSeconds: validated.simulation.durationSeconds,
        durationVariance: validated.simulation.durationVariance,
        iterations: validated.simulation.iterations,
        seed: validated.simulation.seed,
      },
      encounter: {
        targetName: validated.encounter.targetName,
        targetHealth: validated.encounter.targetHealth,
        targetArmor: validated.encounter.targetArmor,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path, message: 'Must be a non-empty string.' });
  }
}

function requireInteger(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push({ path, message: 'Must be an integer.' });
  }
}

function requirePositiveInteger(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    issues.push({ path, message: 'Must be a positive integer.' });
  }
}

function requirePositiveNumber(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    issues.push({ path, message: 'Must be a positive number.' });
  }
}

function requireNonNegativeNumber(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    issues.push({ path, message: 'Must be zero or greater.' });
  }
}

function requireFraction(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    issues.push({ path, message: 'Must be between 0 and 1.' });
  }
}
