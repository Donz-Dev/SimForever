import type { ResourceSpec, ResourceType } from '../../engine';
import { MAX_COMBO_POINTS } from '../combat/comboPoints';
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
/** A Warlock's banked shards at the pull. See below; nothing states it. */
export const PLACEHOLDER_SOUL_SHARDS = 10;

export const FIXED_RESOURCE_MAXIMUMS: Partial<Record<ResourceType, number>> = {
  rage: 100,
  energy: 100,
  /*
   * WITHOUT THIS THE POOL IS BUILT WITH A MAXIMUM OF ZERO, and every combo
   * point awarded is wasted the instant it is granted -- no error, no warning,
   * just a finisher that never has anything to spend. See
   * `game/combat/comboPoints.ts`.
   */
  comboPoints: MAX_COMBO_POINTS,
  /*
   * SOUL SHARDS, AND THE POOL IS A PLACEHOLDER.
   *
   * A Warlock spends them on Shadowburn and Soul Fire and earns them from
   * Drain Soul KILLING something -- which never happens against a target that
   * survives every fight. So there is no income here at all, and what a
   * Warlock actually has is whatever it banked before the pull.
   *
   * Nothing states that number. Ten is a visibly round placeholder and is
   * enough that a sixty-second fight never runs dry, which keeps the absence
   * of income from silently becoming the constraint being measured.
   */
  soulShards: PLACEHOLDER_SOUL_SHARDS,
};

/*
 * There is no placeholder mana constant any more. Base mana is real data now,
 * per race and class, in baseStats.ts. Callers pass it in.
 *
 * THE INTELLECT CONTRIBUTION IS APPLIED TOO, and this comment used to say it
 * was missing. It is `manaPerIntellect` in `conversions.ts` -- 15 a point, the
 * ruleset owner's own figure from WoWForeverStatConversions.txt -- and
 * `createPlayer` adds `derived.mana` to the base before building the pool.
 *
 * Left corrected rather than deleted because the stale version was believed:
 * the engine gap survey recorded "intellect to mana is missing, affects all
 * eight caster profiles" on the strength of it, and the first caster built
 * found the code already doing it.
 */

/**
 * Resources that begin combat full.
 *
 * Rage is the odd one out: a warrior walks in with none and builds it by
 * fighting, which is what makes the opening seconds of a warrior rotation
 * different from everyone else's.
 */
const STARTS_FULL: ReadonlySet<ResourceType> = new Set<ResourceType>([
  'mana',
  'energy',
  // A Warlock arrives with shards banked rather than earning them in the
  // fight -- there is no income here at all. See `PLACEHOLDER_SOUL_SHARDS`.
  'soulShards',
]);

const CLASS_BY_ID = new Map<ClassId, ClassDefinition>(
  CLASSES.map((entry) => [entry.id, entry]),
);

/** Maximum for a resource, or undefined if it must be derived from stats. */
export function fixedMaximumFor(resource: ResourceType): number | undefined {
  return FIXED_RESOURCE_MAXIMUMS[resource];
}

/**
 * Overrides for resource maximums, for talents that raise a cap.
 *
 * Rage and energy are both normally 100 and both can be increased, so neither
 * cap is baked in any deeper than `FIXED_RESOURCE_MAXIMUMS`.
 */
export type ResourceMaximumOverrides = Partial<Record<ResourceType, number>>;

/**
 * Multipliers on resource maximums, for a racial that raises a cap by a
 * percentage.
 *
 * ----------------------------------------------------------------------------
 * A MULTIPLIER AND NOT AN OVERRIDE, because Gnome Expansive Mind -- "Maximum
 * Mana, Rage or Energy increased by 5%, whichever your class uses" -- has no
 * single number to state. Rage and energy are the flat 100 above and mana is
 * base plus fifteen a point of intellect, so the only thing it can be is a
 * factor on whatever the rest of this function settled.
 *
 * APPLIED AFTER AN OVERRIDE, deliberately. A caller pinning a cap for a test is
 * pinning the UNRACIAL cap, and a Gnome with that cap genuinely has five
 * percent more of it -- so the two compose rather than one winning.
 * ----------------------------------------------------------------------------
 */
export type ResourceMaximumMultipliers = Partial<Record<ResourceType, number>>;

/**
 * The resource pools a character of this class starts a fight with.
 *
 * A Druid gets all three, because switching to bear form mid-fight must not
 * have to create a rage pool that did not exist a moment earlier.
 */
export function resourceSpecsFor(
  characterClass: ClassId,
  maxMana: number,
  overrides: ResourceMaximumOverrides = {},
  multipliers: ResourceMaximumMultipliers = {},
): ResourceSpec[] {
  const definition = CLASS_BY_ID.get(characterClass);
  if (!definition) return [];

  return definition.resources.map((resource) => {
    /*
     * ROUNDED, for the reason the health pool is: every term without a
     * multiplier is already a whole number, so this is neutral for everyone
     * except a race that raises a cap -- and a Gnome Mage's 3018 x 1.05 is
     * 3168.9, which is not a number of points of mana.
     */
    const maximum = Math.round(
      (overrides[resource] ??
        fixedMaximumFor(resource) ??
        (resource === 'mana' ? maxMana : 0)) * (multipliers[resource] ?? 1),
    );
    return {
      type: resource,
      maximum,
      /*
       * A POOL THAT STARTS FULL STARTS AT THE RAISED MAXIMUM, which is one
       * number read twice rather than two that could disagree -- so a Gnome
       * Rogue opens the fight on 105 energy rather than on 100 of a possible
       * 105.
       */
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
    case 'soulShards':
      return 'Soul Shards';
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
