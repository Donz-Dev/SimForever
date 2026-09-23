import type { Ability, Combatant as CombatantType } from '../../engine';
import { Combatant, seconds } from '../../engine';
import { regenerationFor } from '../combat/resourceRules';
import { attackPowerCoefficientFor } from '../combat/weaponDamage';
import type { PetFamilyId } from '../character/petFamilies';
import { PET_FAMILIES, abilitiesForFamily } from '../character/petFamilies';
import { PET_ABILITIES } from '../abilities/pet';
import { PET_ROTATION } from '../rotations/pet';

/**
 * A Hunter's pet, built from its owner.
 *
 * ------------------------------------------------------------------------------
 * THE SCALING IS WOW FOREVER'S, and it is not Classic's. From the Forever
 * Hunter wiki, which the ruleset owner named as the source for exactly this:
 *
 *     Stamina        1 player Stamina gives the pet 2 Health
 *     Armor          the pet gains 30% of player Armor
 *     Attack Power   the pet gains 10% of the player's HIGHEST attack power
 *                    source
 *     Crit           the pet gains 100% of the player's crit chance
 *
 * "THE PLAYER'S HIGHEST ATTACK POWER SOURCE" is the phrase that matters and is
 * the reason this reads both: a Hunter's ranged attack power is normally its
 * larger one, but a Lone Wolf melee build has no pet at all and a Beast Mastery
 * hunter in Aspect of the Beast could in principle flip which is bigger. Taking
 * the max is what the wiki says, so taking the max is what this does.
 *
 * ONE HUNDRED PERCENT OF THE PLAYER'S CRIT, which makes a pet far more
 * sensitive to the owner's gear than a Classic pet ever was -- and means every
 * crit talent the Hunter takes is worth something twice.
 *
 * WHAT IS NOT STATED ANYWHERE: the pet's own base weapon damage and swing
 * speed. The wiki says only that "pets can have different base attack speeds"
 * and that "pet damage is currently not normalized by attack speed". So those
 * two are PLACEHOLDERS, named and surfaced, and they are the reason a Beast
 * Mastery figure is rougher than the other two Hunter profiles.
 * ------------------------------------------------------------------------------
 */

/** 1 player stamina is 2 pet health. */
export const PET_HEALTH_PER_OWNER_STAMINA = 2;
/** The pet gains 30% of the owner's armor. */
export const PET_ARMOR_SHARE = 0.3;
/** The pet gains 10% of the owner's highest attack power source. */
export const PET_ATTACK_POWER_SHARE = 0.1;
/** The pet gains 100% of the owner's crit chance. */
export const PET_CRIT_SHARE = 1;

/** A pet's focus pool. The regeneration rate lives in `resourceRules.ts`. */
export const PET_FOCUS_MAXIMUM = 100;

/**
 * A pet's own weapon, and both numbers are PLACEHOLDERS.
 *
 * Nothing in the client data or the wiki states a pet's base damage or its
 * swing speed. The wiki says families differ and that damage is not normalised
 * by speed, which is a statement that the numbers exist and not what they are.
 *
 * A pet that swung for nothing would make Beast Mastery look like Lone Wolf
 * with extra steps, and a pet with invented numbers would make it look
 * authoritative. So: visibly round figures, named as placeholders, printed in
 * the app, and the whole profile carries the caveat.
 */
export const PLACEHOLDER_PET_BASE_DAMAGE = 100;
export const PLACEHOLDER_PET_SWING_SECONDS = 2;

export const PET_UNMODELLED =
  'The pet’s own base weapon damage and swing speed are PLACEHOLDERS. Its ' +
  'stat scaling from the Hunter is real -- 2 health a stamina, 30% of armor, ' +
  '10% of the highest attack power source and 100% of crit, from the Forever ' +
  'Hunter wiki -- but no source states what a pet hits for before that, so ' +
  `${PLACEHOLDER_PET_BASE_DAMAGE} damage on a ${PLACEHOLDER_PET_SWING_SECONDS}-second swing is assumed and unverified.`;

export interface PetOptions {
  readonly owner: CombatantType;
  readonly family: PetFamilyId;
  readonly name?: string;
  /** Talent-driven changes the owner makes to its pet. */
  readonly damageMultiplier?: number;
  readonly critBonus?: number;
  readonly healthMultiplier?: number;
  readonly extraAbilities?: readonly Ability[];
}

/** The owner's larger attack power source, which is what the pet reads. */
export function highestAttackPower(owner: CombatantType): number {
  const stats = owner.stats.effective;
  return Math.max(stats.attackPower, stats.rangedAttackPower);
}

export function createPet(options: PetOptions): CombatantType {
  const { owner, family } = options;
  const stats = owner.stats.effective;
  const definition = PET_FAMILIES[family];

  const attackPower = highestAttackPower(owner) * PET_ATTACK_POWER_SHARE;
  const health =
    stats.stamina * PET_HEALTH_PER_OWNER_STAMINA * (options.healthMultiplier ?? 1);

  const known = abilitiesForFamily(family, PET_ABILITIES);

  return new Combatant({
    id: `${owner.id}_pet`,
    name: options.name ?? definition.name,
    kind: 'pet',
    faction: owner.faction,
    /*
     * THE OWNER LINK. `ownerId` has been on `Combatant` since before any pet
     * existed; this is the first thing to set it. A talent that reaches the
     * pet -- Bestial Wrath, Frenzy -- finds it through this.
     */
    ownerId: owner.id,
    level: owner.level,
    maxHealth: Math.max(1, Math.round(health)),
    autoAttack: 'main-hand',
    weapons: {
      mainHand: {
        name: `${definition.name} claws`,
        baseDamage: PLACEHOLDER_PET_BASE_DAMAGE,
        swingTimerMs: seconds(definition.swingSeconds ?? PLACEHOLDER_PET_SWING_SECONDS),
        /*
         * THE UNIVERSAL FORMULA, speed over fourteen -- the same one every
         * weapon in the project uses. The wiki notes that "pet damage is
         * currently not normalized by attack speed", which may mean Forever
         * does something else here; that is recorded and not acted on,
         * because a sentence saying a rule may differ is not a rule.
         */
        powerCoefficient: attackPowerCoefficientFor(
          seconds(definition.swingSeconds ?? PLACEHOLDER_PET_SWING_SECONDS),
        ),
        // `fist`, which is the nearest thing the engine has to claws and
        // teeth. Nothing keys on it for a pet -- no weapon specialisation
        // reaches one -- so it is a label rather than a rule.
        weaponType: 'fist',
      },
    },
    stats: {
      attackPower,
      armor: stats.armor * PET_ARMOR_SHARE,
      // ONE HUNDRED PERCENT of the owner's, which is the wiki's figure and is
      // what makes a Hunter's crit gear worth double.
      critChance: stats.critChance * PET_CRIT_SHARE,
    },
    resources: [{ type: 'focus', maximum: PET_FOCUS_MAXIMUM }],
    regeneration: regenerationFor(['focus']),
    abilities: [...known, ...(options.extraAbilities ?? [])],
    rotation: PET_ROTATION,
    damageMultiplier: options.damageMultiplier ?? 1,
  });
}
