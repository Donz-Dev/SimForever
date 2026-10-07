import type { AttackEvent, Combatant, Reaction, SimulationContext } from '../../engine';
import { EventPriority, createEvent, dealDamage, isWeaponUseOf, seconds } from '../../engine';
import { WINDFURY_WEAPON_IMBUE } from '../auras/shaman';

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
 * THREE SECONDS, THE RULESET OWNER'S OWN FIGURE for the imbue: "Windfury Weapon
 * imbue has a 3 second internal cooldown", given 2026-09-30.
 *
 * It was 1.5, borrowed from Windfury Totem, and it was twice too generous. The
 * totem and the imbue are the same effect at different strengths and they do
 * NOT share this number -- which is exactly the risk a borrowed value carries,
 * and the reason the borrow had to stay visible.
 *
 * AN EFFECT THAT CAN CHAIN OFF ITS OWN EXTRA ATTACKS NEEDS SOME LIMIT or it
 * runs away, which is why one had to be assumed in the first place. The two
 * special attacks below are main-hand weapon uses, so they roll this again and
 * this cooldown is what refuses them.
 */
export const WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS = seconds(3);

/*
 * ITS OWN DAMAGE ROW, AND THEREFORE ITS OWN NAME -- NOT "Windfury Weapon".
 *
 * ----------------------------------------------------------------------------
 * `abilityBreakdown` KEYS ON THE NAME and builds one row per name, taking
 * `uses` from CAST events and `attempts`, `hits` and `damage` from DAMAGE
 * events. The imbue is an ability called "Windfury Weapon" that is cast exactly
 * once and deals nothing, so naming these hits the same thing produces a single
 * row reading ONE USE and nine ATTEMPTS -- internally consistent, adding to
 * 100%, and nonsense.
 *
 * That is the failure this project has already met twice: `resourceFlow`
 * summing every pool under a heading saying "Rage", and a pet's swing landing
 * in the row called "Main Hand Auto-Attack" and becoming a documented fact
 * about the BM Hunter in one reading. **A row is only "its own" if nothing else
 * shares its key.**
 *
 * So the imbue keeps its name and its single cast, and the hits get this one.
 * The precedent is Vis'kag, whose proc reports as "Fatal Wound" rather than as
 * the sword.
 * ----------------------------------------------------------------------------
 */
export const WINDFURY_WEAPON_ATTACK_ID = 'windfury_weapon_attack';
export const WINDFURY_WEAPON_ATTACK_NAME = 'Windfury Attack';

/**
 * One of the two extra SPECIAL attacks, scheduled at this instant.
 *
 * ----------------------------------------------------------------------------
 * SCHEDULED AND NOT DEALT INLINE, AND THE REASON IS THE RE-ENTRY GUARD.
 * `runReactions` claims a per-actor lock before it calls anything, so damage
 * dealt from inside a reaction reaches no `dealt` reaction at all -- Maelstrom
 * Weapon would never see these, and the ruleset owner has said it must. One
 * `schedule` at the current timestamp puts them back on the ordinary event
 * path, which is the same trick `extraAttack` uses and for the same reason.
 *
 * IT IS NOT `extraAttack`, THOUGH, AND THE DIFFERENCE IS THE SWING TIMER. That
 * function completes the weapon's swing now and RESTARTS the timer, so every
 * Windfury proc pushed the next real swing out by a full cycle. The owner's
 * ruling is that the imbue "does not reset the auto-attack swing timer", so
 * nothing here touches `scheduleSwing` and the weapon's rhythm is untouched.
 *
 * `melee-special` IS WHAT MAKES IT A SPECIAL ATTACK: a two-roll table with
 * miss, dodge and parry on the first roll and crit on the second, and NO
 * GLANCING BLOW. That last is most of the change -- a glancing blow against a
 * level 63 target is both frequent and reduced, and these cannot glance.
 *
 * A MAIN-HAND WEAPON USE, carrying `weaponSlot`, so Maelstrom Weapon, a
 * main-hand Crusader and Hand of Justice all see it. That is what "extra
 * attacks" has to mean, and it is the owner's standing instruction that whether
 * an ability can proc something is asked rather than assumed.
 */
function scheduleWindfuryAttack(
  context: SimulationContext,
  actor: Combatant,
  target: Combatant,
  bonusAttackPower: number,
  index: number,
): void {
  context.events.schedule(
    context.clock.now(),
    createEvent(
      `windfury-weapon:${actor.id}:${index}`,
      EventPriority.AutoAttack,
      (ctx) => {
        if (!actor.isAlive || !target.isAlive || ctx.hasEnded) return;
        dealDamage(ctx, {
          source: actor,
          target,
          abilityId: WINDFURY_WEAPON_ATTACK_ID,
          abilityName: WINDFURY_WEAPON_ATTACK_NAME,
          school: 'physical',
          baseAmount: 0,
          /*
           * NOT NORMALISED. The imbue grants extra ATTACKS, so each one is the
           * weapon's own damage at the weapon's own speed -- normalising would
           * replace the speed of a swing that really did happen.
           */
          weaponScaling: { slot: 'mainHand', bonusAttackPower },
          attackTable: 'melee-special',
          weaponSlot: 'mainHand',
        });
      },
    ),
  );
}

/**
 * Built PER CHARACTER, because the internal cooldown is per-character state.
 * A shared closure silently stopped Windfury Totem proccing after the first
 * iteration of a batch, which is a bug that costs a whole Monte Carlo run and
 * leaves nothing behind to notice.
 *
 * `elementalWeaponsBonus` is Elemental Weapons' "increases ... your Windfury
 * Weapon effect by {0}%", passed in rather than looked up so this file needs no
 * talent knowledge. It raises the ATTACK POWER, which is the only number the
 * effect has.
 */
export function windfuryWeaponReaction(elementalWeaponsBonusPercent = 0): Reaction {
  let lastProcAt: number | null = null;
  const bonusAttackPower =
    WINDFURY_WEAPON_ATTACK_POWER * (1 + elementalWeaponsBonusPercent / 100);

  return {
    id: 'windfury_weapon',
    on: 'dealt',
    // Landed main-hand uses. An avoided attack is not a use that connected.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, actor, attack) => {
      if (!actor.auras.has(WINDFURY_WEAPON_IMBUE.id)) return false;
      if (!isWeaponUseOf(attack, 'mainHand')) return false;

      const now = context.clock.now();
      if (lastProcAt !== null && now - lastProcAt < WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS) {
        return false;
      }

      return context.rng.rollChance(WINDFURY_WEAPON_PROC_CHANCE);
    },
    onTrigger: (context, actor, attack: AttackEvent) => {
      lastProcAt = context.clock.now();
      for (let i = 0; i < WINDFURY_WEAPON_EXTRA_ATTACKS; i += 1) {
        scheduleWindfuryAttack(context, actor, attack.defender, bonusAttackPower, i);
      }
    },
  };
}
