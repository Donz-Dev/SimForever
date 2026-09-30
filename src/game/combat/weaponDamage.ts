import type { Milliseconds, WeaponType } from '../../engine';

/**
 * The universal weapon damage formula.
 *
 * Every weapon-damage ability in Forever, for every class, computes
 *
 *     weapon damage = weapon base damage + (speed in seconds / 14) * attack power
 *
 * and an ability with its own flat component adds it on top:
 *
 *     Mortal Strike = weapon base damage + speed / 14 * attack power + 160
 *
 * The off-hand penalty applies ONCE to that finished total, not to the weapon's
 * own damage alone. That is handled by the engine, in `WeaponScaling`.
 *
 * Stated by the ruleset owner as universal across all classes.
 */

/**
 * Seconds of weapon speed per point of attack power in the formula above.
 *
 * A ruleset constant, not a derived quantity. It is the reason a slow weapon
 * gains more from attack power per swing than a fast one: the contribution is
 * proportional to how long the swing took.
 *
 * Note that this uses the weapon's ACTUAL base speed. Some rulesets normalise
 * special attacks to a fixed speed per weapon class so that a fast weapon is
 * not punished; Forever's formula as given does not, and reads "Base Weapon
 * Speed" directly.
 */
export const ATTACK_POWER_SECONDS_DIVISOR = 14;

/**
 * The attack power coefficient a weapon of this speed carries.
 *
 * This is what a `WeaponProfile.powerCoefficient` must be set to. It lives here
 * rather than in the engine because the 14 is a ruleset number, and the engine
 * takes it as a value on the weapon rather than knowing it.
 *
 * @param swingTimerMs the weapon's UNHASTED base speed
 */
export function attackPowerCoefficientFor(swingTimerMs: Milliseconds): number {
  return swingTimerMs / 1000 / ATTACK_POWER_SECONDS_DIVISOR;
}

/*
 * ============================================================================
 * NORMALISATION.
 *
 * Seventeen of Forever's weapon-damage abilities replace the weapon's OWN base
 * speed with a fixed one for the attack power half of the formula, so that
 *
 *     normalised = weapon base damage + normalisedSpeed / 14 x attackPower
 *
 * A slow weapon still ROLLS bigger, because `weapon base damage` is untouched.
 * What normalisation removes is the second advantage a slow weapon used to get
 * -- a larger attack power term on an instant strike, which does not depend on
 * how long the swing took because an instant does not wait for one.
 *
 * SUPPLIED BY THE RULESET OWNER, 2026-09-30, with the list of which abilities
 * take it. That list is the interesting half: it is not derivable from
 * anything about an ability, so it is declared per ability and the five
 * exceptions are named where they sit.
 * ============================================================================
 */

/**
 * The normalised speed, in seconds, for each kind of weapon.
 *
 * DAGGERS ARE THEIR OWN CASE and that is the whole reason this table has four
 * rows rather than three. A one-handed sword normalises to 2.4 and a dagger to
 * 1.7, so a Rogue's Backstab gains markedly less attack power than the same
 * ability would with a mace -- which is what stops fast daggers being strictly
 * better once normalisation exists.
 */
export const NORMALIZED_SPEED_SECONDS = {
  twoHand: 3.3,
  ranged: 2.8,
  oneHand: 2.4,
  dagger: 1.7,
} as const;

/** Bows, guns and crossbows, which normalise to 2.8 rather than to a melee speed. */
const RANGED_WEAPON_TYPES = new Set<WeaponType>(['bow', 'gun', 'crossbow']);

/**
 * Which normalised speed a weapon takes, in seconds.
 *
 * ORDER MATTERS: ranged is checked before two-handed, because a bow is both.
 * Reading `twoHanded` first would normalise every bow to 3.3 and quietly
 * inflate every Hunter shot by 18%.
 */
export function normalizedSpeedSecondsFor(weapon: {
  readonly weaponType?: WeaponType;
  readonly twoHanded?: boolean;
}): number {
  if (weapon.weaponType && RANGED_WEAPON_TYPES.has(weapon.weaponType)) {
    return NORMALIZED_SPEED_SECONDS.ranged;
  }
  if (weapon.twoHanded === true) return NORMALIZED_SPEED_SECONDS.twoHand;
  if (weapon.weaponType === 'dagger') return NORMALIZED_SPEED_SECONDS.dagger;
  return NORMALIZED_SPEED_SECONDS.oneHand;
}

/** The attack power coefficient a normalised ability uses with this weapon. */
export function normalizedPowerCoefficientFor(weapon: {
  readonly weaponType?: WeaponType;
  readonly twoHanded?: boolean;
}): number {
  return normalizedSpeedSecondsFor(weapon) / ATTACK_POWER_SECONDS_DIVISOR;
}
