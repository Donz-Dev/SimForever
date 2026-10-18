import type { AttackEvent, Combatant, Reaction, SimulationContext } from '../../engine';
import { dealDamage, isWeaponUseOf } from '../../engine';
import { linearBySpeed } from '../combat/speedRow';

/**
 * Flametongue Totem and Flametongue Weapon: Fire damage on every main-hand hit,
 * sized by the weapon's BASE speed.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S FIGURES, both stated at a 1.3 and a 4.0 base speed with "a
 * linear relationship between those points":
 *
 *   Flametongue Totem    17 at 1.3, 55 at 4.0       100% on every main-hand hit
 *   Flametongue Weapon   35 at 1.3, 112 at 4.0      + 10% of spell power
 *
 * `combat/speedRow.ts` is the line, shared with Seal of Righteousness.
 *
 * A HIT IS A USE, by the project's standing rule: an auto-attack or any ability
 * that needs the main hand -- Stormstrike, a Windfury Totem extra swing. The
 * Fire damage itself carries no `weaponSlot`, so it procs nothing.
 *
 * NO TABLE OF ITS OWN AND A MELEE CRIT, the shape a poison and a seal already
 * have: the strike that carried it settled whether it landed, so it cannot
 * miss on top of that, and it crits at the carrier's melee crit chance. The
 * owner stated neither -- it is the existing precedent for damage that rides
 * on a weapon hit, and it is a question.
 *
 * MAIN HAND ONLY. The totem says "each main hand hit"; the imbue is on the
 * weapon it was cast on, and the three Shaman imbues here go on the main hand.
 * ----------------------------------------------------------------------------
 */
export const FLAMETONGUE_TOTEM_AT_MIN_SPEED = 17;
export const FLAMETONGUE_TOTEM_AT_MAX_SPEED = 55;
export const FLAMETONGUE_WEAPON_AT_MIN_SPEED = 35;
export const FLAMETONGUE_WEAPON_AT_MAX_SPEED = 112;
export const FLAMETONGUE_WEAPON_SP_COEFFICIENT = 0.1;

export const FLAMETONGUE_TOTEM_PROC_ID = 'flametongue_totem';
export const FLAMETONGUE_WEAPON_PROC_ID = 'flametongue_attack';

const LANDED = ['hit', 'crit', 'glance', 'crush'] as const;

/** The base speed of the main hand, in seconds. Haste is never stored on it. */
function mainHandBaseSpeed(actor: Combatant): number {
  return (actor.weapons.mainHand?.swingTimerMs ?? 0) / 1000;
}

export function flametongueTotemDamage(baseSpeedSeconds: number): number {
  return linearBySpeed(
    baseSpeedSeconds,
    FLAMETONGUE_TOTEM_AT_MIN_SPEED,
    FLAMETONGUE_TOTEM_AT_MAX_SPEED,
  );
}

export function flametongueWeaponDamage(baseSpeedSeconds: number): number {
  return linearBySpeed(
    baseSpeedSeconds,
    FLAMETONGUE_WEAPON_AT_MIN_SPEED,
    FLAMETONGUE_WEAPON_AT_MAX_SPEED,
  );
}

function fireHit(
  context: SimulationContext,
  actor: Combatant,
  attack: AttackEvent,
  id: string,
  name: string,
  amount: number,
  powerCoefficient: number,
): void {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: id,
    abilityName: name,
    school: 'fire',
    baseAmount: amount,
    powerCoefficient,
    critFrom: 'melee-special',
  });
}

/**
 * Flametongue Totem's proc, for the raid buff.
 *
 * `FLAMETONGUE_WEAPON_IMBUE` disables it for its own carrier, by the imbue's
 * own tooltip: "When applied to main hand, disables any benefit you personally
 * receive from Flametongue Totem." Asked at proc time for the reason
 * `windfuryTotemReaction` gives: the imbue arrives as a pre-combat cast.
 */
export function flametongueTotemReaction(): Reaction {
  return {
    id: FLAMETONGUE_TOTEM_PROC_ID,
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      isWeaponUseOf(attack, 'mainHand') &&
      !actor.auras.has('flametongue_weapon') &&
      mainHandBaseSpeed(actor) > 0,
    onTrigger: (context, actor, attack) => {
      fireHit(
        context,
        actor,
        attack,
        FLAMETONGUE_TOTEM_PROC_ID,
        'Flametongue Totem',
        flametongueTotemDamage(mainHandBaseSpeed(actor)),
        0,
      );
    },
  };
}

/**
 * Flametongue Weapon's proc, carried by every Shaman and gated on the imbue --
 * the arrangement Windfury Weapon has, because the imbue is a spell anyone can
 * cast rather than a talent.
 *
 * `elementalWeaponsPercent` is Elemental Weapons' "increases the damage caused
 * by your Flametongue Weapon ... by {2}%", read off the ability at proc time
 * so a Shaman without the talent reads zero.
 */
export function flametongueWeaponReaction(): Reaction {
  return {
    id: FLAMETONGUE_WEAPON_PROC_ID,
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      actor.auras.has('flametongue_weapon') &&
      isWeaponUseOf(attack, 'mainHand') &&
      mainHandBaseSpeed(actor) > 0,
    onTrigger: (context, actor, attack) => {
      const bonus =
        actor.abilities.get('flametongue_weapon')?.bonuses?.elementalWeaponsPercent ?? 0;
      fireHit(
        context,
        actor,
        attack,
        FLAMETONGUE_WEAPON_PROC_ID,
        'Flametongue Attack',
        /*
         * Elemental Weapons raises "the damage caused by" the imbue, so it
         * multiplies the flat half here. The spell power half goes through
         * the coefficient and is NOT raised -- a talent percentage on a
         * figure, not on the power, which is the reading that adds nothing
         * the tooltip did not say.
         */
        flametongueWeaponDamage(mainHandBaseSpeed(actor)) * (1 + bonus / 100),
        FLAMETONGUE_WEAPON_SP_COEFFICIENT,
      );
    },
  };
}
