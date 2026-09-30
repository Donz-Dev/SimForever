import type { AutoAttackMode, WeaponProfile, WeaponSlot } from '../../engine';
import type { CombatStyleId } from '../character';
import { getCombatStyle } from '../character';
import { RAGE_FROM_BEAR_PAW, rageFromSwing } from '../combat/resourceRules';
import {
  ATTACK_POWER_SECONDS_DIVISOR,
  attackPowerCoefficientFor,
} from '../combat/weaponDamage';

/*
 * PLACEHOLDER WEAPONS.
 *
 * Gear does not exist yet, so every character swings the same imaginary weapon
 * and only the swing timers and damage sources differ. These exist to make the
 * auto-attack modes observable and are replaced the moment real item data
 * arrives.
 *
 * The base damage figures and swing speeds below are STILL INVENTED, and they
 * now distort more than they used to: Forever's weapon damage formula makes
 * every weapon-damage ability scale off both of them, so a placeholder weapon
 * puts placeholder numbers into Mortal Strike as well as into auto-attacks.
 *
 * The attack power coefficients are NOT invented. Each is derived from its
 * weapon's speed by the ruleset's own formula, so they stay correct when the
 * real speeds arrive. See `game/combat/weaponDamage.ts`.
 *
 * The paw damage and the off-hand penalty below are the other exception: those
 * are stated values rather than invented ones. See the notes on each.
 */

/*
 * Rage is proportional to damage actually dealt, not a flat award per swing.
 * A missed or dodged swing therefore generates nothing.
 */
/**
 * Weapon skill for a level 60 character with the skill maxed.
 *
 * Compared against the target's defense skill (5 x level) to derive miss,
 * dodge and glancing chances. A level 63 target has 315 defense, so a maxed
 * character still fights at a 15-point deficit.
 */
export const MAX_WEAPON_SKILL_AT_60 = 300;

/*
 * Rage is per swing now, from handedness and BASE speed, so these placeholders
 * cannot share one constant any more: a two-hander earns half again what a
 * one-hander does. Each profile below derives its own from its own speed.
 *
 * `swingTimerMs` IS the base speed for a placeholder -- nothing has hasted it
 * at the point of definition -- which is the one place the two are safely the
 * same number.
 */
const RAGE_ON_HIT_ONE_HAND = rageFromSwing(2.6, false);
const RAGE_ON_HIT_TWO_HAND = rageFromSwing(3.4, true);

/**
 * How much of its damage a dual-wield off-hand deals.
 *
 * ASSUMED to be 50%. Kept as a single named constant because talents are
 * expected to change it — `weaponsForStyle` takes an override so a talented
 * character can be built with a different value without touching this default.
 *
 * The multiplier scales the whole swing, attack power contribution included.
 */
export const OFF_HAND_DAMAGE_MULTIPLIER = 0.5;

/**
 * Block chance a character has for holding a shield at all.
 *
 * Stated by the ruleset owner: 5%, before talents, before defense skill and
 * before Shield Block. It belongs to the SHIELD rather than to the class -- a
 * warrior dual-wielding blocks nothing -- so it is granted when one is
 * equipped rather than sitting in the class baseline the way base parry does.
 */
export const BASE_BLOCK_CHANCE_WITH_SHIELD = 5;

export const PLACEHOLDER_ONE_HAND: WeaponProfile = {
  name: 'Melee',
  swingTimerMs: 2600,
  baseDamage: 80,
  damageVariance: 0.15,
  powerCoefficient: attackPowerCoefficientFor(2600),
  school: 'physical',
  skill: MAX_WEAPON_SKILL_AT_60,
  generates: RAGE_ON_HIT_ONE_HAND,
};

export const PLACEHOLDER_TWO_HANDER: WeaponProfile = {
  ...PLACEHOLDER_ONE_HAND,
  name: 'Melee (Two-Hander)',
  // Slower and harder-hitting, so the two styles are distinguishable at all.
  swingTimerMs: 3400,
  baseDamage: 140,
  // Re-derived: the coefficient follows the speed, so it cannot be left behind
  // by a spread from a faster weapon. The rage award follows it too, and for
  // the same reason -- both are functions of the speed being overridden above.
  powerCoefficient: attackPowerCoefficientFor(3400),
  generates: RAGE_ON_HIT_TWO_HAND,
};

export const PLACEHOLDER_RANGED: WeaponProfile = {
  name: 'Ranged',
  swingTimerMs: 2900,
  baseDamage: 110,
  damageVariance: 0.15,
  powerCoefficient: attackPowerCoefficientFor(2900),
  school: 'physical',
  skill: MAX_WEAPON_SKILL_AT_60,
  // No rage: nothing that shoots uses it.
};

/** An off-hand weapon, carrying the dual-wield damage penalty. */
export function makeOffHand(
  damageMultiplier: number = OFF_HAND_DAMAGE_MULTIPLIER,
): WeaponProfile {
  return {
    ...PLACEHOLDER_ONE_HAND,
    name: 'Melee (Off Hand)',
    swingTimerMs: 2400,
    powerCoefficient: attackPowerCoefficientFor(2400),
    damageMultiplier,
  };
}

/*
 * ============================================================================
 * A PAW IS BUILT FROM THE WEAPON THE DRUID IS HOLDING, by the ruleset owner's
 * formula:
 *
 *   Cat  = (BaseCatPaw  + weaponDPS x speed x 1   + AP x 1   / 14 x speed) x rand(0.8, 1.2)
 *   Bear = (BaseBearPaw + weaponDPS x speed x 2.5 + AP x 2.5 / 14 x speed) x rand(0.8, 1.2)
 *
 * `speed` is the HELD weapon's base swing time and `weaponDPS` its dps, both
 * confirmed by the owner. The 1 and the 2.5 are the form's own multiplier.
 *
 * ----------------------------------------------------------------------------
 * THIS IS WHY DRUIDS ARE NOT NORMALISED. The owner's wording: "Normalization
 * doesn't exist for druids because they're effectively already normalized to
 * using their paw to attack." Every Druid ability that deals weapon damage --
 * Shred, Claw, Maul, Primal Bite, Lacerate -- takes the paw, and the paw is
 * one shape whatever is held.
 *
 * THE FORM STILL SWINGS ON ITS OWN TIMER. Cat every second, bear every 2.5,
 * unchanged: the held weapon's speed feeds the DAMAGE and not the cadence.
 * Reading it as the cadence too would make a slow weapon halve a cat's attack
 * rate, which is the opposite of what a form is.
 *
 * NOTHING HELD MEANS NO WEAPON TERMS, and the paw falls back to its base
 * damage and its form multiplier over 14. That is the honest reading of a
 * formula whose weapon terms are all multiplied by a speed that does not
 * exist -- not a reason to invent a default weapon.
 * ============================================================================
 */

/** BaseBearPaw and BaseCatPaw. ASSUMED values; the owner has not stated them. */
export const BASE_BEAR_PAW_DAMAGE = 100;
export const BASE_CAT_PAW_DAMAGE = 50;

/** The form's multiplier on both weapon terms. Cat 1, bear 2.5. */
export const CAT_FORM_MULTIPLIER = 1;
export const BEAR_FORM_MULTIPLIER = 2.5;

/** `random(0.8, 1.2)`, which is +/-20% of the midpoint. */
export const PAW_DAMAGE_VARIANCE = 0.2;

/** What a Druid is holding while in form, if anything. */
export interface HeldWeapon {
  readonly dps: number;
  readonly speedSeconds: number;
}

/**
 * Build a paw from its base damage, its form multiplier and what is held.
 *
 * The attack power term becomes the paw's `powerCoefficient`, because
 * `multiplier / 14 x speed` is exactly the `speed / 14` shape the engine
 * already multiplies attack power by -- so the formula needs no engine change
 * at all, only the right coefficient on the weapon.
 */
function pawProfile(
  name: string,
  baseDamage: number,
  swingTimerMs: number,
  multiplier: number,
  held: HeldWeapon | undefined,
  extra: Partial<WeaponProfile> = {},
): WeaponProfile {
  const speed = held?.speedSeconds ?? 0;
  return {
    name,
    swingTimerMs,
    baseDamage: baseDamage + (held?.dps ?? 0) * speed * multiplier,
    damageVariance: PAW_DAMAGE_VARIANCE,
    powerCoefficient: (multiplier * speed) / ATTACK_POWER_SECONDS_DIVISOR,
    school: 'physical',
    ...extra,
  };
}

/** The Bear's paw, given what the Druid is holding. */
export function bearPaw(held?: HeldWeapon): WeaponProfile {
  return pawProfile('Bear Paw', BASE_BEAR_PAW_DAMAGE, 2500, BEAR_FORM_MULTIPLIER, held, {
    // Bears build rage by attacking, as warriors do.
    generates: RAGE_FROM_BEAR_PAW,
  });
}

/** The Cat's paw, given what the Druid is holding. Cats run on energy. */
export function catPaw(held?: HeldWeapon): WeaponProfile {
  return pawProfile('Cat Paw', BASE_CAT_PAW_DAMAGE, 1000, CAT_FORM_MULTIPLIER, held);
}

/** True for styles whose damage comes from the form rather than from gear. */
export function usesNaturalWeapon(style: CombatStyleId): boolean {
  return getCombatStyle(style)?.damageSource === 'natural';
}

export interface WeaponOptions {
  /**
   * Overrides the off-hand damage penalty, for talents that change it.
   * Defaults to OFF_HAND_DAMAGE_MULTIPLIER.
   */
  readonly offHandDamageMultiplier?: number;
  /**
   * What a shapeshifted Druid is holding, which feeds the paw formula.
   *
   * Absent for every other style, and absent for a Druid holding nothing --
   * in which case the paw keeps its base damage and gains no weapon terms.
   */
  readonly heldWeapon?: HeldWeapon;
}

/**
 * The weapons a combat style fights with.
 *
 * Only the slots that actually swing are filled. Stat-stick slots are left
 * empty because gear does not exist yet; once it does, they will hold whatever
 * is equipped and simply never be scheduled.
 */
export function weaponsForStyle(
  style: CombatStyleId,
  options: WeaponOptions = {},
): Partial<Record<WeaponSlot, WeaponProfile>> {
  switch (style) {
    case 'two_hander':
      return { mainHand: PLACEHOLDER_TWO_HANDER };
    case 'one_hand_shield':
      return { mainHand: PLACEHOLDER_ONE_HAND };
    case 'dual_wield':
      return {
        mainHand: PLACEHOLDER_ONE_HAND,
        offHand: makeOffHand(options.offHandDamageMultiplier),
      };
    case 'ranged':
      return { ranged: PLACEHOLDER_RANGED };
    case 'bear':
      return { mainHand: bearPaw(options.heldWeapon) };
    case 'cat':
      return { mainHand: catPaw(options.heldWeapon) };
    case 'caster':
    case 'moonkin':
    case 'tree':
      // Nothing swings. A weapon may be equipped for its stats, but it never
      // appears here because it would never be scheduled.
      return {};
  }
}

/** The auto-attack mode a style uses. */
export function autoAttackModeForStyle(style: CombatStyleId): AutoAttackMode {
  return getCombatStyle(style)?.autoAttack ?? 'none';
}
