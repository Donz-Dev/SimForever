import type { ResourceSpec, ResourceType } from '../../engine';
import type { ClassDefinition, FormDefinition } from './definitions';
import { CLASSES } from './definitions';
import type { ClassId, CombatStyleId } from './ids';

/**
 * Resource caps that are fixed by the ruleset rather than derived from a
 * character's stats.
 *
 * Rage and energy are the same 0-100 for everyone, at every level, forever.
 * Mana is absent because it is not: it scales with intellect and level, and
 * inventing a number here would produce plausible-looking wrong results.
 */
export const FIXED_RESOURCE_MAXIMUMS: Partial<Record<ResourceType, number>> = {
  rage: 100,
  energy: 100,
};

/*
 * There is no placeholder mana constant any more. Base mana is real data now,
 * per race and class, in baseStats.ts. Callers pass it in.
 *
 * What is still missing is the intellect-to-mana contribution on top of the
 * base, so a geared caster's pool is understated rather than invented.
 */

/**
 * Resources that begin combat full.
 *
 * Rage is the odd one out: a warrior walks in with none and builds it by
 * fighting, which is what makes the opening seconds of a warrior rotation
 * different from everyone else's.
 */
const STARTS_FULL: ReadonlySet<ResourceType> = new Set<ResourceType>(['mana', 'energy']);

const CLASS_BY_ID = new Map<ClassId, ClassDefinition>(
  CLASSES.map((entry) => [entry.id, entry]),
);

/** Maximum for a resource, or undefined if it must be derived from stats. */
export function fixedMaximumFor(resource: ResourceType): number | undefined {
  return FIXED_RESOURCE_MAXIMUMS[resource];
}

/**
 * The resource pools a character of this class starts a fight with.
 *
 * A Druid gets all three, because switching to bear form mid-fight must not
 * have to create a rage pool that did not exist a moment earlier.
 */
export function resourceSpecsFor(characterClass: ClassId, maxMana: number): ResourceSpec[] {
  const definition = CLASS_BY_ID.get(characterClass);
  if (!definition) return [];

  return definition.resources.map((resource) => {
    const maximum = fixedMaximumFor(resource) ?? (resource === 'mana' ? maxMana : 0);
    return {
      type: resource,
      maximum,
      initial: STARTS_FULL.has(resource) ? maximum : 0,
    };
  });
}

/** The forms a class can take. Empty for every class but Druid. */
export function formsFor(characterClass: ClassId): readonly FormDefinition[] {
  return CLASS_BY_ID.get(characterClass)?.forms ?? [];
}

/**
 * The resource that drives play for a class, optionally in a specific form.
 *
 * Without a form, or with one the class does not have, this is the class's
 * primary resource.
 */
export function activeResourceFor(
  characterClass: ClassId,
  form?: CombatStyleId,
): ResourceType | undefined {
  const definition = CLASS_BY_ID.get(characterClass);
  if (!definition) return undefined;
  if (form === undefined) return definition.primaryResource;

  const match = definition.forms.find((entry) => entry.id === form);
  return match?.resource ?? definition.primaryResource;
}

/** Whether a class owns a pool of this resource at all. */
export function classUsesResource(
  characterClass: ClassId,
  resource: ResourceType,
): boolean {
  return CLASS_BY_ID.get(characterClass)?.resources.includes(resource) ?? false;
}

/** Human-readable resource name, for the UI. */
export function resourceLabel(resource: ResourceType): string {
  switch (resource) {
    case 'health':
      return 'Health';
    case 'mana':
      return 'Mana';
    case 'rage':
      return 'Rage';
    case 'energy':
      return 'Energy';
    case 'focus':
      return 'Focus';
    case 'runicPower':
      return 'Runic Power';
    case 'holyPower':
      return 'Holy Power';
    case 'comboPoints':
      return 'Combo Points';
  }
}
