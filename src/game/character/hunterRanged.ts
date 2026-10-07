import type { WeaponProfile } from '../../engine';

/**
 * The two things a Hunter carries that are not in an equipment slot.
 *
 * ------------------------------------------------------------------------------
 * A QUIVER AND AMMUNITION, both supplied by the ruleset owner, and both a
 * property of the CLASS rather than of the gear set. "Hunters also passively
 * have a quiver equipped -- which is not a normal equipment slot."
 *
 * SO THEY LIVE HERE AND NOT IN `gearSets.ts`. There is no slot to put them in,
 * no item id to reference, and nothing for the Gear panel to show -- a Hunter
 * simply has them. Modelling them as equipment would mean inventing a slot the
 * profile schema does not have and the planner does not show.
 *
 * NEITHER TOUCHES A MELEE HUNTER, and that falls out rather than being checked:
 * `weaponsForEquipment` gives the ranged slot no weapon profile unless the
 * style marks it `required`, so a dual-wielding Hunter has nothing here to
 * apply to. Its bow still contributes STATS, which is a different path.
 * ------------------------------------------------------------------------------
 */

/**
 * The quiver: 15% ranged attack speed.
 *
 * ----------------------------------------------------------------------------
 * A DIVISOR, NOT A SUBTRACTION, and the owner's own example says so: "whatever
 * the attack time is for a ranged weapon on a hunter, it can be reduced by 15%
 * (ex: 2.9 / 1.15 = 2.5217)". 2.9 / 1.15 is 2.5217; 2.9 x 0.85 is 2.465, which
 * is a 2% faster bow and a plausible wrong number.
 *
 * IT MOVES THE SWING TIMER AND NOTHING ELSE. In particular it does NOT move
 * `powerCoefficient`, which is `baseSpeed / 14` -- the universal weapon formula
 * reads the weapon's BASE speed, so a faster bow fires more often for the same
 * attack power per shot. That is how every other speed modifier in the engine
 * behaves and it is what makes haste worth what it is worth.
 *
 * ON THE WEAPON RATHER THAN AS A HASTE STAT, because the engine has ONE haste
 * rating and it reaches every slot. A quiver that hastened a Hunter's melee
 * swings would be a bigger number and no error.
 *
 * MULTIPLICATIVE WITH HASTE, which falls out: Rapid Fire's rating is applied to
 * this already-shortened timer when a swing is scheduled.
 * ----------------------------------------------------------------------------
 */
export const QUIVER_RANGED_SPEED_DIVISOR = 1.15;

/**
 * The ammunition: Ice Threaded Arrow, 16.5 damage per second.
 *
 * ----------------------------------------------------------------------------
 * AMMO ADDS A DPS TO THE WEAPON, NOT A FLAT HIT, which is why it is multiplied
 * by a speed to become per-shot damage. The owner: "the damage formula for
 * ranged attacks need 16.5 * baserangedattackspeed added to the base hit damage
 * of the weapon, BEFORE it's modified by attack power or ability effects."
 *
 * SO IT GOES INTO `baseDamage` AND NOWHERE ELSE. That is the term the damage
 * roll varies and the term every ranged ability adds its own flat damage on top
 * of, so "before attack power or ability effects" is exactly what putting it
 * there means -- `weaponDamageFor` computes `baseDamage x roll + coefficient x
 * AP`, and the ammo is inside the first half.
 *
 * `baserangedattackspeed` IS THE WEAPON'S OWN SPEED, BEFORE THE QUIVER, and
 * that is a reading rather than a transcription. The owner wrote "base", the
 * codebase already uses "base speed" to mean the un-modified figure
 * (`powerCoefficient` is `baseSpeed / 14`), and it is how Classic behaves: ammo
 * raises the weapon's DPS as displayed at base speed, and then anything that
 * makes you shoot faster -- the quiver, Rapid Fire -- multiplies that too.
 *
 * THE CONSEQUENCE IS THAT AMMO IS WORTH MORE THAN 16.5 DPS IN PRACTICE. At
 * Rhok'delar's 3.2-second base it adds 52.8 a shot, and the quiver fires those
 * shots every 2.78 seconds instead -- about 19 DPS. The other reading, where
 * the quiver-shortened speed is used, pins it at exactly 16.5 forever. If the
 * owner meant that one it is a one-line change here.
 * ----------------------------------------------------------------------------
 */
export const AMMO_DAMAGE_PER_SECOND = 16.5;

/**
 * A Hunter's bow, with the quiver and the ammunition on it.
 *
 * Returns the profile unchanged for anything that is not a Hunter's ranged
 * weapon, so the caller needs no branch of its own.
 */
export function withQuiverAndAmmo(weapon: WeaponProfile): WeaponProfile {
  // The weapon's own speed, which is the one both numbers below read.
  const baseSpeedSeconds = weapon.swingTimerMs / 1000;

  return {
    ...weapon,
    /*
     * ROUNDED TO WHOLE MILLISECONDS, because time is integer milliseconds below
     * the UI and a swing timer that is not would drift against every other
     * scheduled event. 3200 / 1.15 is 2782.6, so this is 2783.
     */
    swingTimerMs: Math.round(weapon.swingTimerMs / QUIVER_RANGED_SPEED_DIVISOR),
    baseDamage: weapon.baseDamage + AMMO_DAMAGE_PER_SECOND * baseSpeedSeconds,
    /*
     * `powerCoefficient` IS DELIBERATELY UNTOUCHED. It is the BASE speed over
     * fourteen, and the quiver does not change the weapon's base speed -- it
     * changes how often the weapon swings. Recomputing it from the shortened
     * timer would quietly cut every Hunter's attack power scaling by 13%.
     */
  };
}
