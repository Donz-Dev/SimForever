import type { Reaction } from '../../engine';
import { isWeaponUseOf, seconds } from '../../engine';
import { WINDFURY_WEAPON_IMBUE, windfuryWeaponAura } from '../auras/shaman';

/**
 * Reactions a Shaman has from its own spells rather than from a talent.
 *
 * ----------------------------------------------------------------------------
 * WINDFURY WEAPON, WHICH IS WINDFURY TOTEM WITH DIFFERENT NUMBERS.
 *
 *   "Each hit has a 20% chance of granting you 2 extra attacks with 333 extra
 *    melee attack power."
 *
 * Against the totem's "1 extra attack with 246 extra melee attack power". The
 * mechanics are the ruleset owner's, settled for the totem and applying here
 * unchanged:
 *
 *   A USE, NOT A SWING     an auto-attack or any ability that needs the main
 *                          hand. Stormstrike counts; a shock does not.
 *   MAIN HAND ONLY         "when applied to main hand", and the imbue is per
 *                          weapon. `isWeaponUseOf` is the whole test.
 *   THE BUFF FIRST         the attack power window goes up BEFORE the extra
 *                          attacks are requested, because `extraAttack`
 *                          schedules rather than runs and would otherwise
 *                          resolve at base attack power.
 *   AN INTERNAL COOLDOWN   without one the effect chains off itself: an extra
 *                          swing is a main-hand use and rolls again.
 *
 * GATED ON THE IMBUE BEING UP, which is what makes this a spell rather than a
 * property of being a Shaman. The reaction is carried by every Shaman and
 * fires for none of them until Windfury Weapon has been cast -- so the global
 * cooldown and the 165 mana are paid for, and a priority list that leaves it
 * out gets nothing.
 *
 * TWO EXTRA ATTACKS ARE TWO CALLS. Each schedules its own swing at this
 * timestamp; both resolve, and the later one's `scheduleSwing` cancels the
 * earlier one's pending timer, so the weapon still ends with exactly one
 * outstanding swing. That is the invariant that stops a proc forking the
 * chain, and it survives being asked for two.
 * ----------------------------------------------------------------------------
 */

export const WINDFURY_WEAPON_PROC_CHANCE = 0.2;
export const WINDFURY_WEAPON_ATTACK_POWER = 333;
export const WINDFURY_WEAPON_EXTRA_ATTACKS = 2;

/**
 * The internal cooldown, borrowed from Windfury Totem and UNVERIFIED for the
 * imbue.
 *
 * The owner stated 1.5 seconds for the totem. The spellbook says nothing about
 * one for the weapon, and an effect that can chain off its own extra attacks
 * needs some limit or it runs away -- so the totem's figure is used, named as
 * a placeholder, and surfaced here. Confirming it is one line from the owner.
 */
export const PLACEHOLDER_WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS = seconds(1.5);

/**
 * Built PER CHARACTER, because the internal cooldown is per-character state.
 * A shared closure silently stopped Windfury Totem proccing after the first
 * iteration of a batch, which is a bug that costs a whole Monte Carlo run and
 * leaves nothing behind to notice.
 *
 * `elementalWeaponsBonus` is Elemental Weapons' "increases ... your Windfury
 * Weapon effect by {0}%", passed in rather than looked up so this file needs
 * no talent knowledge. It raises the ATTACK POWER, which is the only number
 * the effect has to raise.
 */
export function windfuryWeaponReaction(elementalWeaponsBonusPercent = 0): Reaction {
  let lastProcAt: number | null = null;
  const attackPower = WINDFURY_WEAPON_ATTACK_POWER * (1 + elementalWeaponsBonusPercent / 100);

  return {
    id: 'windfury_weapon',
    on: 'dealt',
    // Landed main-hand uses. An avoided attack is not a use that connected.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, actor, attack) => {
      if (!actor.auras.has(WINDFURY_WEAPON_IMBUE.id)) return false;
      if (!isWeaponUseOf(attack, 'mainHand')) return false;

      const now = context.clock.now();
      if (
        lastProcAt !== null &&
        now - lastProcAt < PLACEHOLDER_WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS
      ) {
        return false;
      }

      return context.rng.rollChance(WINDFURY_WEAPON_PROC_CHANCE);
    },
    onTrigger: (context, actor) => {
      lastProcAt = context.clock.now();
      context.applyAura(actor, windfuryWeaponAura(attackPower), actor.id);
      for (let i = 0; i < WINDFURY_WEAPON_EXTRA_ATTACKS; i += 1) {
        context.extraAttack(actor, 'mainHand');
      }
    },
  };
}
