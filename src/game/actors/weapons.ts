import type { AutoAttackMode, WeaponProfile, WeaponSlot } from '../../engine';
import type { CombatStyleId } from '../character';
import { getCombatStyle } from '../character';

/*
 * PLACEHOLDER WEAPONS.
 *
 * None of these are Forever data. Gear does not exist yet, so every character
 * swings the same imaginary weapon and only the swing timers and damage
 * sources differ. They exist to make the auto-attack modes observable, and all
 * of them are replaced the moment real item data arrives.
 */

const RAGE_PER_SWING = { resource: 'rage', amount: 15 } as const;

export const PLACEHOLDER_ONE_HAND: WeaponProfile = {
  name: 'Melee',
  swingTimerMs: 2600,
  baseDamage: 80,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  generates: RAGE_PER_SWING,
};

export const PLACEHOLDER_OFF_HAND: WeaponProfile = {
  ...PLACEHOLDER_ONE_HAND,
  name: 'Melee (Off Hand)',
  swingTimerMs: 2400,
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

/**
 * MISSING DATA: BaseBearPaw and BaseCatPaw.
 *
 * Bear and Cat forms attack with their own damage rather than an equipped
 * weapon, and the source calls those values BaseBearPaw and BaseCatPaw. Neither
 * has been provided, so these stand in and are wrong.
 *
 * They are named loudly rather than hidden behind a plausible number, because a
 * druid sim built on invented paw damage would produce results that look
 * completely reasonable and are meaningless.
 */
export const PLACEHOLDER_BEAR_PAW: WeaponProfile = {
  name: 'Bear Paw',
  swingTimerMs: 2500,
  baseDamage: 100,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  // Bears build rage by attacking, as warriors do.
  generates: RAGE_PER_SWING,
};

export const PLACEHOLDER_CAT_PAW: WeaponProfile = {
  name: 'Cat Paw',
  swingTimerMs: 1000,
  baseDamage: 45,
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

/**
 * The weapons a combat style fights with.
 *
 * Only the slots that actually swing are filled. Stat-stick slots are left
 * empty because gear does not exist yet; once it does, they will hold whatever
 * is equipped and simply never be scheduled.
 */
export function weaponsForStyle(
  style: CombatStyleId,
): Partial<Record<WeaponSlot, WeaponProfile>> {
  switch (style) {
    case 'two_hander':
      return { mainHand: PLACEHOLDER_TWO_HANDER };
    case 'one_hand_shield':
      return { mainHand: PLACEHOLDER_ONE_HAND };
    case 'dual_wield':
      return { mainHand: PLACEHOLDER_ONE_HAND, offHand: PLACEHOLDER_OFF_HAND };
    case 'ranged':
      return { ranged: PLACEHOLDER_RANGED };
    case 'bear':
      return { mainHand: PLACEHOLDER_BEAR_PAW };
    case 'cat':
      return { mainHand: PLACEHOLDER_CAT_PAW };
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
