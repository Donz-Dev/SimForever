import type { Milliseconds } from '../../engine';

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
