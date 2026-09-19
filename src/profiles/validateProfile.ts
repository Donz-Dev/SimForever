import { STAT_NAMES } from '../engine';
import type { StatName } from '../engine';
import {
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  classHasCombatStyle,
  className,
  isClassId,
  isCombatStyleId,
  isRaceId,
  isValidCombination,
  raceName,
} from '../game/character';
import type { Equipment, EquipmentSlot } from '../game/items/Item';
import { ENCHANTS_BY_ID, ITEMS_BY_ID } from '../game/items/itemData';
import type { TalentAllocation } from '../game/talents/Talent';
import { talentsForClass } from '../game/talents/talentData';
import { isLegal } from '../game/talents/talentRules';
import type { CharacterProfile } from './CharacterProfile';

/** Every slot a profile may name. */
const EQUIPMENT_SLOT_SET: ReadonlySet<string> = new Set<EquipmentSlot>([
  'head', 'neck', 'shoulders', 'cloak', 'chest', 'wrists', 'gloves', 'waist',
  'legs', 'feet', 'ring1', 'ring2', 'trinket1', 'trinket2',
  'mainHand', 'offHand', 'twoHand', 'shield', 'ranged',
]);

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
    requireIntegerInRange(
      character.level,
      'character.level',
      MIN_CHARACTER_LEVEL,
      MAX_CHARACTER_LEVEL,
      issues,
    );

    // Narrowed through the guard into a local, because TypeScript cannot carry
    // a type guard's result across a stored boolean.
    const race = isRaceId(character.race) ? character.race : null;
    const characterClass = isClassId(character.characterClass)
      ? character.characterClass
      : null;

    if (race === null) {
      issues.push({
        path: 'character.race',
        message: `Unknown race ${JSON.stringify(character.race)}.`,
      });
    }
    if (characterClass === null) {
      issues.push({
        path: 'character.characterClass',
        message: `Unknown class ${JSON.stringify(character.characterClass)}.`,
      });
    }

    // Only worth checking once both ids are real. Reporting "Orc cannot be a
    // Frobnicator" on top of "unknown class Frobnicator" is noise.
    if (race !== null && characterClass !== null && !isValidCombination(race, characterClass)) {
      issues.push({
        path: 'character.characterClass',
        message:
          `${raceName(race)} cannot be a ${className(characterClass)} ` +
          'in World of Warcraft: Forever.',
      });
    }

    // Combat style is optional; omitting it means "use the class default".
    if (character.combatStyle !== undefined) {
      if (!isCombatStyleId(character.combatStyle)) {
        issues.push({
          path: 'character.combatStyle',
          message: `Unknown combat style ${JSON.stringify(character.combatStyle)}.`,
        });
      } else if (
        characterClass !== null &&
        !classHasCombatStyle(characterClass, character.combatStyle)
      ) {
        issues.push({
          path: 'character.combatStyle',
          message: `${className(characterClass)} cannot use the ${character.combatStyle} style.`,
        });
      }
    }
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

  const equipment = value.equipment;
  if (!isRecord(equipment)) {
    issues.push({ path: 'equipment', message: 'Missing equipment section.' });
  } else {
    for (const [slot, equipped] of Object.entries(equipment)) {
      if (!EQUIPMENT_SLOT_SET.has(slot)) {
        issues.push({ path: `equipment.${slot}`, message: `Unknown equipment slot "${slot}".` });
        continue;
      }
      if (!isRecord(equipped)) {
        issues.push({ path: `equipment.${slot}`, message: 'Must be an object.' });
        continue;
      }
      // An unknown id is rejected rather than ignored. A profile naming an item
      // this build does not have is not a profile this build can reproduce, and
      // silently dropping it would change the character without saying so.
      if (typeof equipped.itemId !== 'number' || !ITEMS_BY_ID.has(equipped.itemId)) {
        issues.push({ path: `equipment.${slot}.itemId`, message: 'Unknown item id.' });
        continue;
      }
      const item = ITEMS_BY_ID.get(equipped.itemId);
      if (item && !item.slots.includes(slot as EquipmentSlot)) {
        issues.push({
          path: `equipment.${slot}`,
          message: `${item.name} cannot be equipped in ${slot}.`,
        });
      }
      if (equipped.enchantId !== undefined) {
        if (typeof equipped.enchantId !== 'number' || !ENCHANTS_BY_ID.has(equipped.enchantId)) {
          issues.push({ path: `equipment.${slot}.enchantId`, message: 'Unknown enchant id.' });
        }
      }
    }
  }

  const talents = value.talents;
  if (!isRecord(talents)) {
    issues.push({ path: 'talents', message: 'Missing talents section.' });
  } else {
    // Talent ids only mean anything for a particular class, so a profile whose
    // class is already invalid cannot have its talents checked. The class issue
    // is the one worth reporting; a pile of "unknown talent" errors underneath
    // it would just be noise.
    const classId = isRecord(character) && isClassId(character.characterClass)
      ? character.characterClass
      : undefined;
    const classTalents = classId ? talentsForClass(classId) : undefined;

    for (const [id, points] of Object.entries(talents)) {
      if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) {
        issues.push({ path: `talents.${id}`, message: 'Points must be a non-negative integer.' });
        continue;
      }
      if (!classTalents) continue;
      const talent = classTalents.byId.get(id);
      // Rejected rather than ignored, for the same reason an unknown item id is:
      // a profile naming a talent this build does not have is not a profile this
      // build can reproduce, and dropping it would change the character silently.
      if (!talent) {
        issues.push({
          path: `talents.${id}`,
          message: `Unknown talent "${id}" for ${className(classId!)}.`,
        });
        continue;
      }
      if (points > talent.ranks) {
        issues.push({
          path: `talents.${id}`,
          message: `${talent.name} has ${talent.ranks} rank(s); got ${points}.`,
        });
      }
    }

    // Per-talent checks above cannot catch an allocation that is individually
    // fine and collectively impossible -- 51 points spread so that a capstone's
    // tier requirement is unmet, or more than 51 points in total.
    if (classTalents && issues.every((issue) => !issue.path.startsWith('talents'))) {
      if (!isLegal(classTalents, talents as TalentAllocation)) {
        issues.push({
          path: 'talents',
          message:
            'Allocation is not reachable: check the total spent, the tier ' +
            'requirements in each tree, and any talent prerequisites.',
        });
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
    requirePositiveInteger(encounter.targetLevel, 'encounter.targetLevel', issues);
    if (typeof encounter.targetAttacks !== 'boolean') {
      issues.push({ path: 'encounter.targetAttacks', message: 'Must be true or false.' });
    }
    requireNonNegativeNumber(encounter.targetSwingDamage, 'encounter.targetSwingDamage', issues);
    requirePositiveNumber(encounter.targetSwingSeconds, 'encounter.targetSwingSeconds', issues);
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
        ...(validated.character.combatStyle !== undefined
          ? { combatStyle: validated.character.combatStyle }
          : {}),
      },
      stats: cleanStats,
      equipment: cleanEquipment(validated.equipment),
      talents: cleanTalents(validated.talents),
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
        targetLevel: validated.encounter.targetLevel,
        targetAttacks: validated.encounter.targetAttacks,
        targetSwingDamage: validated.encounter.targetSwingDamage,
        targetSwingSeconds: validated.encounter.targetSwingSeconds,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Rebuild the allocation, dropping zeroes.
 *
 * A talent at zero points is the same as one that was never mentioned, and
 * keeping both representations would mean every comparison had to normalise
 * first.
 */
function cleanTalents(talents: TalentAllocation): TalentAllocation {
  const clean: Record<string, number> = {};
  for (const [id, points] of Object.entries(talents)) {
    if (points > 0) clean[id] = points;
  }
  return clean;
}

/** Rebuild the equipment, dropping anything not asked for. */
function cleanEquipment(equipment: Equipment): Equipment {
  const clean: Record<string, { itemId: number; enchantId?: number }> = {};
  for (const [slot, equipped] of Object.entries(equipment)) {
    if (!equipped) continue;
    clean[slot] = {
      itemId: equipped.itemId,
      ...(equipped.enchantId !== undefined ? { enchantId: equipped.enchantId } : {}),
    };
  }
  return clean as Equipment;
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

function requireIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: ValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    issues.push({ path, message: `Must be a whole number between ${min} and ${max}.` });
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
