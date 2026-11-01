import type { Reaction } from '../../engine';
import { isWeaponUse } from '../../engine';
import { ppmChance, triggeringSpeedSeconds } from './procs';

/**
 * Set bonuses, by id, without a set behind them yet.
 *
 * ----------------------------------------------------------------------------
 * IN THE BACKGROUND, BY THE OWNER'S INSTRUCTION: "I don't need a full-fledged
 * set bonus controller yet, but I want to implement a specific set bonus in
 * the background (not active or on the GUI)." So a bonus here is reached only
 * through `CharacterProfile.setBonuses`, which no preset sets and no panel
 * offers. Nothing about wearing the pieces is modelled -- which items make up
 * the set and how many it takes is the information that is missing.
 * ----------------------------------------------------------------------------
 */
export type SetBonusId = 'energize';

export const SET_BONUS_IDS: readonly SetBonusId[] = ['energize'];

/**
 * Energize, a Rogue set bonus: "Chance on melee attack to restore 20 Energy."
 *
 * ----------------------------------------------------------------------------
 * 1 PPM, ON EVERY WEAPON USE THAT DEALS DAMAGE -- the owner's rate and scope:
 * "all weapon swings (main hand auto-attacks, off hand auto-attacks, and
 * ability uses that actually deal damage)".
 *
 * GLOBAL, NOT WEAPON-BOUND, which is Hand of Justice's shape rather than
 * Crusader's: a set bonus belongs to the character, so a use of either hand
 * rolls. PPM still needs a SPEED, and it is the BASE speed of the weapon that
 * made the use -- so a dual-wielder's dagger off hand rolls a smaller chance
 * per hit than its sword main hand and both deliver 1 a minute from their own
 * swings, which is what PPM is for. A poison hit carries no `weaponSlot`, so
 * it is not a use and cannot roll.
 *
 * PER DAMAGE EVENT, so Mutilate's two hands are two rolls: each is a strike
 * with that weapon, the same reading Crusader takes of it.
 *
 * "ACTUALLY DEAL DAMAGE" IS A LANDED OUTCOME WITH AN AMOUNT. A miss, dodge or
 * parry is refused by the outcome list; a zero-damage use is refused by the
 * amount.
 * ----------------------------------------------------------------------------
 */
export const ENERGIZE_PPM = 1;
export const ENERGIZE_ENERGY = 20;

export function energizeReaction(): Reaction {
  return {
    id: 'energize',
    on: 'dealt',
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, actor, attack) => {
      if (attack.amount <= 0) return false;
      if (!isWeaponUse(attack)) return false;
      const speed = triggeringSpeedSeconds(actor, attack.weaponSlot);
      if (speed === undefined) return false;
      return context.rng.nextFloat(0, 1) < ppmChance(speed, ENERGIZE_PPM);
    },
    onTrigger: (context, actor) => {
      context.grantResource(actor, 'energy', ENERGIZE_ENERGY, {
        id: 'energize',
        name: 'Energize',
      });
    },
  };
}

/**
 * The reactions a list of set bonuses brings. Built per character, like every
 * proc here, so nothing is shared between combatants or iterations.
 */
export function setBonusReactions(ids: readonly string[] | undefined): readonly Reaction[] {
  return (ids ?? []).flatMap((id) => (id === 'energize' ? [energizeReaction()] : []));
}
