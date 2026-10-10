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
import { DEFAULT_POISON_LOADOUT } from '../game/reactions/poisons';
import {
  DEFAULT_WARLOCK_STONE,
  isWarlockStoneId,
  type WarlockStoneId,
} from '../game/buffs/warlockStones';
import {
  CATEGORY_BY_CONSUMABLE_ID,
  type ConsumableSelection,
} from '../game/buffs/consumables';

/** Every slot a profile may name. */
const EQUIPMENT_SLOT_SET: ReadonlySet<string> = new Set<EquipmentSlot>([
  'head', 'neck', 'shoulders', 'cloak', 'chest', 'wrists', 'gloves', 'waist',
  'legs', 'feet', 'ring1', 'ring2', 'trinket1', 'trinket2',
  'mainHand', 'offHand', 'twoHand', 'shield', 'ranged',
  'relic',
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

    /*
     * A STRING CHECK AND NOTHING MORE, which is deliberate -- see the note
     * beside `petFamily` in the rebuild below for why the id itself is not
     * checked against the known families. This exists so the field's declared
     * type is not a lie: everything here arrives from a file a person can
     * hand-edit, and `petFamily: 42` would otherwise ride through typed as a
     * string.
     */
    if (character.petFamily !== undefined && typeof character.petFamily !== 'string') {
      issues.push({ path: 'character.petFamily', message: 'Pet family must be an id string.' });
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

  /*
   * A LIST OF STRINGS, and unknown ids are not an error here.
   *
   * Which ids exist is `game/buffs/raidBuffs.ts`'s business, and a profile
   * saved when an entry existed should still load after it is renamed.
   * `selectedRaidBuffs` drops what it does not recognise, so the failure mode
   * is one missing buff rather than a character that will not load.
   */
  const raidBuffs = value.raidBuffs;
  if (!Array.isArray(raidBuffs) || raidBuffs.some((id) => typeof id !== 'string')) {
    issues.push({ path: 'raidBuffs', message: 'Must be a list of buff ids.' });
  }

  /*
   * A MAP OF CATEGORY ID TO CONSUMABLE ID, and the shape is checked here while
   * the ids are not.
   *
   * Which ids exist is `game/buffs/consumables.ts`'s business and a profile
   * saved when one existed should still load after it is renamed --
   * `selectedConsumables` drops what it does not recognise, so the failure mode
   * is one missing consumable rather than a character that will not load. That
   * is the `raidBuffs` rule above, applied to the same kind of field.
   *
   * WHAT *IS* AN ERROR IS A CONSUMABLE FILED UNDER THE WRONG CATEGORY, because
   * that is the one thing the map's shape cannot make impossible: it stops two
   * flasks and does not stop a flask stored under `food`, which would let a
   * hand-edited profile hold the same consumable twice. `selectedConsumables`
   * refuses it as well, so a profile that reaches the engine anyway is merely
   * short of one consumable rather than double-counting it.
   */
  const consumables = value.consumables;
  if (!isRecord(consumables)) {
    issues.push({ path: 'consumables', message: 'Must be a map of category to consumable id.' });
  } else {
    for (const [category, id] of Object.entries(consumables)) {
      if (typeof id !== 'string') {
        issues.push({ path: `consumables.${category}`, message: 'Must be a consumable id.' });
        continue;
      }
      const owner = CATEGORY_BY_CONSUMABLE_ID.get(id);
      if (owner !== undefined && owner !== category) {
        issues.push({
          path: `consumables.${category}`,
          message: `"${id}" belongs to the "${owner}" category.`,
        });
      }
    }
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
      /*
       * REBUILT WITH A FALLBACK, because validation runs on anything a user
       * can paste. A profile that reached here without the field -- hand-
       * edited JSON, or a migration that has not run -- gets the default
       * loadout rather than an undefined one that would crash the reaction
       * builder.
       */
      poisons: { ...DEFAULT_POISON_LOADOUT, ...(validated.poisons ?? {}) },
      /*
       * THE ID IS CHECKED, WHICH THE POISON LINE ABOVE DOES NOT DO.
       *
       * Validation runs on anything a user can paste, and `poisons` takes
       * whatever it is given -- `{ mainHand: 'banana' }` reaches the reaction
       * builder untouched. That is a real gap and it is not this field's to
       * fix, but it is not a precedent to copy either: an unrecognised stone
       * would reach `warlockStoneEffect`, fall through to `none`, and grant
       * nothing while the panel displayed the nonsense id back.
       *
       * So an unknown value becomes the default AND pushes an issue, which is
       * what every other closed set here does -- equipment slots, stat names
       * and talent ids all validate rather than trust.
       */
      warlockStone: ((): WarlockStoneId => {
        const stone = (validated as { warlockStone?: unknown }).warlockStone;
        if (stone === undefined) return DEFAULT_WARLOCK_STONE;
        if (isWarlockStoneId(stone)) return stone;
        issues.push({
          path: 'warlockStone',
          message: `Unknown stone "${String(stone)}"; using none.`,
        });
        return DEFAULT_WARLOCK_STONE;
      })(),
      character: {
        name: validated.character.name,
        race: validated.character.race,
        characterClass: validated.character.characterClass,
        level: validated.character.level,
        ...(validated.character.combatStyle !== undefined
          ? { combatStyle: validated.character.combatStyle }
          : {}),
        /*
         * THE STANCE WAS BEING DROPPED HERE. This function rebuilds the
         * profile field by field so unknown keys cannot ride along, and
         * `stance` was never added -- so a warrior saved in Berserker loaded
         * back in their style's default. Silent, and only visible to someone
         * who chose a non-default stance and then reloaded.
         */
        ...(validated.character.stance !== undefined
          ? { stance: validated.character.stance }
          : {}),
        /*
         * AND SO WAS `petFamily`, FOR THE SAME REASON AND AT A HIGHER PRICE.
         *
         * The comment above was written when `stance` was found missing from
         * this rebuild; `petFamily` arrived later and was never added either,
         * so the lesson was recorded and the next field repeated it. The
         * failure is identical in shape and quieter in effect: a profile
         * carrying a pet family loaded back without one, and NOTHING
         * complained, because every consumer has a fallback.
         *
         *   - a Hunter's `petFor` falls back to 'cat', so a Wolf or a Boar
         *     silently became a Cat -- a damage modifier of 1.0 or 0.9 read
         *     back as 1.1.
         *   - a Warlock's `sacrificedDemon` returns UNDEFINED rather than
         *     falling back, so Demonic Sacrifice applied no aura at all. Both
         *     Warlock presets lost 15% of a school's damage by being saved
         *     and loaded, with no issue raised and no field visibly missing.
         *
         * NOT VALIDATED AGAINST `isPetFamilyId`, which is the one difference
         * from `warlockStone` below. The field is typed `string` on purpose --
         * the families are content and a profile naming one this build does
         * not carry should still load -- and both consumers already handle an
         * unrecognised value. That is the `raidBuffs` rule rather than the
         * `warlockStone` one, and it is chosen here because a Hunter whose pet
         * family was renamed should open as a Cat, not refuse to load.
         */
        ...(validated.character.petFamily !== undefined
          ? { petFamily: validated.character.petFamily }
          : {}),
      },
      stats: cleanStats,
      equipment: cleanEquipment(validated.equipment),
      talents: cleanTalents(validated.talents),
      simulation: {
        durationSeconds: validated.simulation.durationSeconds,
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
      raidBuffs: [...validated.raidBuffs],
      // Rebuilt with a fallback for the same reason `poisons` is: validation
      // runs on anything a person can paste, and a hand-edited file missing the
      // field should load as a character with no consumables rather than
      // reaching the engine as `undefined`.
      consumables: cleanConsumables(validated.consumables),
    },
  };
}

/** Rebuild the selection, dropping anything that is not a category entry. */
function cleanConsumables(selection: ConsumableSelection | undefined): ConsumableSelection {
  const clean: Record<string, string> = {};
  for (const [category, id] of Object.entries(selection ?? {})) {
    if (typeof id === 'string' && id.length > 0) clean[category] = id;
  }
  return clean;
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
