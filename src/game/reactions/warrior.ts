import type { Reaction } from '../../engine';
import { OVERPOWER_READY, REVENGE_READY } from '../auras/warrior';

/**
 * Warrior reactive procs.
 *
 * Neither trigger is in WoWForeverWarriorAbilities.xlsx. The spreadsheet gives
 * Overpower and Revenge a cost and a 5 second cooldown and says nothing about
 * what makes them available. The ruleset owner CONFIRMED the Classic behaviour
 * explicitly, which is the only reason these exist.
 *
 * Both work by applying an aura that the ability's `canCast` then reads, rather
 * than by setting a flag. An aura already has a duration, a refresh rule and a
 * visible lifetime in the combat log, so the window shows up in results for
 * free and there is no second piece of state to keep in step.
 */

/**
 * The target dodged, so Overpower is available.
 *
 * Fires on attacks the warrior DEALT. Note that this includes dodged special
 * attacks as well as dodged swings — nothing states otherwise, and the melee
 * special table can produce a dodge.
 */
export const OVERPOWER_ON_DODGE: Reaction = {
  id: 'overpower_on_dodge',
  on: 'dealt',
  outcomes: ['dodge'],
  onTrigger: (context, actor) => {
    context.applyAura(actor, OVERPOWER_READY, actor.id);
  },
};

/**
 * The warrior avoided a blow, so Revenge is available.
 *
 * Fires on attacks the warrior RECEIVED.
 *
 * INCOMPLETE: in Classic this also triggers on a BLOCK, and the engine has no
 * block outcome — `melee-received` produces miss, dodge, parry, crush, crit and
 * hit. Blocking needs a block chance, a block value and a table entry, none of
 * which exist. Until then Revenge triggers on two thirds of what it should.
 *
 * It also never fires in practice yet, for a second and more basic reason:
 * nothing attacks the player.
 */
export const REVENGE_ON_AVOID: Reaction = {
  id: 'revenge_on_avoid',
  on: 'taken',
  outcomes: ['dodge', 'parry'],
  onTrigger: (context, actor) => {
    context.applyAura(actor, REVENGE_READY, actor.id);
  },
};

export const WARRIOR_REACTIONS: readonly Reaction[] = [
  OVERPOWER_ON_DODGE,
  REVENGE_ON_AVOID,
];
