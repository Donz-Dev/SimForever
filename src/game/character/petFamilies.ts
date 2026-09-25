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
   * STILL UNSET FOR EVERY FAMILY, and it no longer matters to the damage.
   * Attack speed is a property of the INDIVIDUAL PET rather than the family
   * -- Petopia lists Cats from 1.0 to 1.6 seconds and Bears from 2.0 to 2.5
   * -- so there is no family figure to state. What changed is that it is now
   * damage-NEUTRAL: `createPet` multiplies a base DPS by the swing, so a
   * faster pet takes proportionally smaller bites of the same total. Both
   * sources say so in as many words. See `PLACEHOLDER_PET_SWING_SECONDS`.
   */
  readonly swingSeconds?: number;
  /**
   * The family's damage, health and armor modifiers.
   *
   * --------------------------------------------------------------------------
   * REAL NUMBERS, and the first pet figures in this project that are. From
   * Petopia Classic, which the Forever Hunter wiki names as the source for
   * per-family detail -- and the Cat row CROSS-CHECKS EXACTLY against the
   * wiki's own "Notable Family Modifiers" table (1.10 / 0.98 / 1.00), which
   * is what makes the other four trustworthy from the same table.
   *
   * CLASSIC VALUES THAT ARE FOREVER'S VALUES. The wiki's Forever-changes page
   * lists what Forever does to pets -- six new abilities and one item -- and
   * pet base damage, scaling and attack speed are not on it. That is the same
   * derivation this project already used for Claw and Bite, whose numbers the
   * wiki confirms are unchanged.
   * --------------------------------------------------------------------------
   */
  readonly damageModifier: number;
  readonly healthModifier: number;
  readonly armorModifier: number;
}

/**
 * A family nobody has figures for: neutral on all three.
 *
 * The four WARLOCK families. Petopia covers Hunter pets and the Forever
 * Hunter wiki covers Hunter pets, so a demon has no row in either -- and
 * both Warlock profiles take Demonic Sacrifice, which kills the demon before
 * the pull, so no Warlock pet is ever built. Neutral and said to be, rather
 * than a Hunter's numbers borrowed sideways.
 */
const UNMODIFIED = { damageModifier: 1, healthModifier: 1, armorModifier: 1 } as const;

/**
 * Pet families, HUNTER AND WARLOCK BOTH.
 *
 * One list rather than two, because the profile field is one field: "which
 * companion did you choose". A Warlock's is then sacrificed by Demonic
 * Sacrifice and a Hunter's fights, which is a difference in what the class
 * does with it rather than in what was chosen.
 */
export const PET_FAMILY_IDS = [
  'cat',
  'wolf',
  'bear',
  'raptor',
  'boar',
  'imp',
  'voidwalker',
  'succubus',
  'felhunter',
] as const;
export type PetFamilyId = (typeof PET_FAMILY_IDS)[number];

/** The spellbook's own family names, which the "Pet:" lines are written in. */
const SPELLBOOK_NAME: Record<PetFamilyId, string> = {
  cat: 'Cat',
  wolf: 'Wolf',
  bear: 'Bear',
  raptor: 'Raptor',
  boar: 'Boar',
  imp: 'Imp',
  voidwalker: 'Voidwalker',
  succubus: 'Succubus',
  felhunter: 'Felhunter',
};

export const PET_FAMILIES: Record<PetFamilyId, PetFamilyDefinition> = {
  // Damage / health / armor, per Petopia Classic. Cat is the one the Beast
  // Mastery preset brings, and the one both sources state.
  cat: { id: 'cat', name: 'Cat', damageModifier: 1.1, healthModifier: 0.98, armorModifier: 1.0 },
  wolf: { id: 'wolf', name: 'Wolf', damageModifier: 1.0, healthModifier: 1.0, armorModifier: 1.05 },
  bear: { id: 'bear', name: 'Bear', damageModifier: 0.91, healthModifier: 1.08, armorModifier: 1.05 },
  raptor: {
    id: 'raptor',
    name: 'Raptor',
    damageModifier: 1.1,
    healthModifier: 0.95,
    armorModifier: 1.03,
  },
  boar: { id: 'boar', name: 'Boar', damageModifier: 0.9, healthModifier: 1.04, armorModifier: 1.09 },
  imp: { id: 'imp', name: 'Imp', ...UNMODIFIED },
  voidwalker: { id: 'voidwalker', name: 'Voidwalker', ...UNMODIFIED },
  succubus: { id: 'succubus', name: 'Succubus', ...UNMODIFIED },
  felhunter: { id: 'felhunter', name: 'Felhunter', ...UNMODIFIED },
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
