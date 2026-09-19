import type { WeaponProfile } from '../../engine';
import { seconds } from '../../engine';

/**
 * A raid boss's melee, for an encounter where the target hits back.
 *
 * WHY THIS MATTERS AT ALL
 *
 * Three whole systems are built, tested, and have never fired in a real fight:
 * the attacks-received combat table, rage from damage taken, and Revenge. Six
 * Warrior talents are inert for the same reason. All of it is waiting on
 * something swinging at the player, and this is that something.
 *
 *
 * THE NUMBERS ARE BORROWED, AND EVERY ONE IS A PLACEHOLDER
 *
 * The ruleset gives the attacks-received TABLE -- boss miss, crit, crush and
 * their multipliers are all real Forever data in `COMBAT_CONSTANTS`. What it
 * does not give is how hard a boss hits or how often.
 *
 * So these are WoW Classic figures for a mid-tier raid boss, used on the
 * explicit instruction to prefer clearly-flagged Classic values over leaving
 * the systems unreachable. They are PLACEHOLDER-prefixed, they are editable
 * per encounter from the profile, and the Encounter panel labels them on
 * screen. Nothing here is Forever data.
 *
 * A wrong figure here moves rage income, and rage income moves everything a
 * warrior does. Treat any absolute number from a fight with this enabled as
 * provisional even by this project's standards.
 */

/**
 * Seconds between boss swings.
 *
 * PLACEHOLDER. Two seconds is the Classic raid-boss convention and nothing in
 * Forever states it.
 */
export const PLACEHOLDER_BOSS_SWING_SECONDS = 2;

/**
 * Damage per swing, BEFORE armor and before the attacks-received table.
 *
 * PLACEHOLDER. A mid-tier Classic raid boss against plate. The engine applies
 * armor on top, so a warrior in the starting set takes materially less than
 * this per landed swing.
 */
export const PLACEHOLDER_BOSS_SWING_DAMAGE = 4000;

/**
 * How far a boss swing varies either side of its average.
 *
 * PLACEHOLDER, and deliberately narrow: the point of the variance is that two
 * swings are not identical, not to model a specific boss's spread.
 */
export const PLACEHOLDER_BOSS_DAMAGE_VARIANCE = 0.15;

/**
 * The weapon a target swings with when an encounter says it attacks back.
 *
 * No attack power contribution: the damage figure IS the whole swing, rather
 * than a base that something scales. A boss has no attack power in this model
 * and inventing one would be a second guess on top of the first.
 */
export function bossMeleeWeapon(options: {
  readonly damage?: number;
  readonly swingSeconds?: number;
} = {}): WeaponProfile {
  return {
    name: 'Melee',
    swingTimerMs: seconds(options.swingSeconds ?? PLACEHOLDER_BOSS_SWING_SECONDS),
    baseDamage: options.damage ?? PLACEHOLDER_BOSS_SWING_DAMAGE,
    damageVariance: PLACEHOLDER_BOSS_DAMAGE_VARIANCE,
    powerCoefficient: 0,
  };
}
