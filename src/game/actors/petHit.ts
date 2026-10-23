import { AttackTableModifiers } from '../../engine';

/**
 * How a pet inherits its owner's hit, the owner's rule in round 51:
 *
 *   "Hunter's give their pets melee hit equal to their ranged hit, and Hunter's
 *   give their pets spell hit equal to 17/8ths of their ranged hit. Warlocks
 *   give their pets spell hit equal to their spell hit, and Warlocks give melee
 *   hit equal to 8/17ths of their spell hit."
 *
 * ============================================================================
 * 17 AND 8 ARE THE TWO CAPS -- spells miss on a flat 17% and melee on 8% against
 * a level 63 target -- so the rule SCALES THE OWNER'S PROGRESS TOWARD ITS OWN
 * CAP onto the pet's other table: a Hunter at its 8-point ranged cap hands its
 * pet a full 17 points of spell hit, and a Warlock at 17 hands its demon 8 of
 * melee. Named by the ruleset's numbers rather than folded into one ratio, so a
 * reader sees where 2.125 comes from.
 *
 * TWO NUMBERS FOR ONE PET, AND A PET HAS ONE `hitChance`. So the MELEE figure is
 * the stat -- the melee and ranged tables read it -- and the spell figure's
 * difference from it rides on the pet's `spell` table as a `hitBonus`, which
 * `combineModifiers` adds to every spell roll and to `rollApplication`. Before
 * this a Hunter's pet inherited NO hit at all, and a demon carried its owner's
 * spell hit on both tables.
 * ============================================================================
 */
export const SPELL_HIT_CAP_POINTS = 17;
export const MELEE_HIT_CAP_POINTS = 8;

export interface PetHit {
  /** The pet's `hitChance` stat: what its melee table reads. */
  readonly hitChance: number;
  /** Its `spell` table modifier, carrying the rest of its spell hit. */
  readonly attackTableModifiers: AttackTableModifiers;
}

function petHit(melee: number, spell: number): PetHit {
  const attackTableModifiers = new AttackTableModifiers();
  if (spell !== melee) attackTableModifiers.add('spell', { hitBonus: spell - melee });
  return { hitChance: melee, attackTableModifiers };
}

/** A Hunter's pet: melee at the owner's ranged hit, spell at 17/8 of it. */
export function hunterPetHit(ownerRangedHit: number): PetHit {
  return petHit(ownerRangedHit, (ownerRangedHit * SPELL_HIT_CAP_POINTS) / MELEE_HIT_CAP_POINTS);
}

/** A Warlock's demon: spell at the owner's spell hit, melee at 8/17 of it. */
export function warlockDemonHit(ownerSpellHit: number): PetHit {
  return petHit((ownerSpellHit * MELEE_HIT_CAP_POINTS) / SPELL_HIT_CAP_POINTS, ownerSpellHit);
}
