import type { AutoAttackMode, WeaponProfile, WeaponSlot } from '../../engine';
import type { CombatStyleId } from '../character';
import { getCombatStyle } from '../character';

/*
 * PLACEHOLDER WEAPONS.
 *
 * Gear does not exist yet, so every character swings the same imaginary weapon
 * and only the swing timers and damage sources differ. These exist to make the
 * auto-attack modes observable and are replaced the moment real item data
 * arrives.
 *
 * The paw damage and the off-hand penalty below are the exception: those are
 * stated values rather than invented ones. See the notes on each.
 */

const RAGE_PER_SWING = { resource: 'rage', amount: 15 } as const;

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

export const PLACEHOLDER_ONE_HAND: WeaponProfile = {
  name: 'Melee',
  swingTimerMs: 2600,
  baseDamage: 80,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  generates: RAGE_PER_SWING,
};

export const PLACEHOLDER_TWO_HANDER: WeaponProfile = {
  ...PLACEHOLDER_ONE_HAND,
  name: 'Melee (Two-Hander)',
  // Slower and harder-hitting, so the two styles are distinguishable at all.
  swingTimerMs: 3400,
  baseDamage: 140,
};

export const PLACEHOLDER_RANGED: WeaponProfile = {
  name: 'Ranged',
  swingTimerMs: 2900,
  baseDamage: 110,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
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
    damageMultiplier,
  };
}

/*
 * Bear and Cat attack with their own damage rather than an equipped weapon.
 * The source names these BaseBearPaw and BaseCatPaw.
 *
 * ASSUMED values: 100 for bear, 50 for cat. Everything else about the paws —
 * swing speed, attack power scaling, variance — is still placeholder, so a
 * druid's auto-attack damage is directionally right and not yet accurate.
 */
export const BASE_BEAR_PAW_DAMAGE = 100;
export const BASE_CAT_PAW_DAMAGE = 50;

export const BEAR_PAW: WeaponProfile = {
  name: 'Bear Paw',
  swingTimerMs: 2500,
  baseDamage: BASE_BEAR_PAW_DAMAGE,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  // Bears build rage by attacking, as warriors do.
  generates: RAGE_PER_SWING,
};

export const CAT_PAW: WeaponProfile = {
  name: 'Cat Paw',
  swingTimerMs: 1000,
  baseDamage: BASE_CAT_PAW_DAMAGE,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  // Cats run on energy, which regenerates on a timer rather than per swing.
  // Energy regeneration is not implemented, so a cat currently never refills.
};

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
      return { mainHand: BEAR_PAW };
    case 'cat':
      return { mainHand: CAT_PAW };
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
