import type { Ability } from '../../engine';

/**
 * Hunter pet families, and which abilities each one has.
 *
 * ----------------------------------------------------------------------------
 * A FAMILY IS A CHOICE THE PLAYER MAKES, so it is a profile field rather than
 * something derived -- the ruleset owner's call, and the same reasoning as
 * combat style and the shield: "the selection to equip a shield is a player
 * action on the GUI the engine needs to have".
 *
 * WHICH ABILITIES A FAMILY HAS IS IN THE SPELLBOOK, stated per spell as a
 * "Pet: Bear, Bird of Prey, Cat, ..." line. So this table is the families
 * themselves; the gating is read off the abilities, which keeps one source for
 * it rather than two lists that have to agree.
 * ----------------------------------------------------------------------------
 */

export interface PetFamilyDefinition {
  readonly id: string;
  readonly name: string;
  /**
   * Base swing speed in seconds.
   *
   * A PLACEHOLDER FOR EVERY FAMILY. The Forever Hunter wiki says "pets can
   * have different base attack speeds" and "pet damage is currently not
   * normalized by attack speed" -- which states that the numbers differ
   * without stating any of them. Left undefined here so every family falls
   * back to the one named placeholder in `createPet`, rather than inventing a
   * spread that would look researched.
   */
  readonly swingSeconds?: number;
}

export const PET_FAMILY_IDS = ['cat', 'wolf', 'bear', 'raptor', 'boar'] as const;
export type PetFamilyId = (typeof PET_FAMILY_IDS)[number];

/** The spellbook's own family names, which the "Pet:" lines are written in. */
const SPELLBOOK_NAME: Record<PetFamilyId, string> = {
  cat: 'Cat',
  wolf: 'Wolf',
  bear: 'Bear',
  raptor: 'Raptor',
  boar: 'Boar',
};

export const PET_FAMILIES: Record<PetFamilyId, PetFamilyDefinition> = {
  cat: { id: 'cat', name: 'Cat' },
  wolf: { id: 'wolf', name: 'Wolf' },
  bear: { id: 'bear', name: 'Bear' },
  raptor: { id: 'raptor', name: 'Raptor' },
  boar: { id: 'boar', name: 'Boar' },
};

export function isPetFamilyId(value: unknown): value is PetFamilyId {
  return typeof value === 'string' && (PET_FAMILY_IDS as readonly string[]).includes(value);
}

/**
 * Which of a list of pet abilities a family can use.
 *
 * READ OFF THE ABILITY, from the `families` it declares -- an ability with
 * none is "every family", which is how the spellbook writes Bite and Growl.
 */
export function abilitiesForFamily(
  family: PetFamilyId,
  abilities: readonly Ability[],
): readonly Ability[] {
  const name = SPELLBOOK_NAME[family];
  return abilities.filter((ability) => {
    const families = (ability as { families?: readonly string[] }).families;
    return families === undefined || families.includes(name);
  });
}
