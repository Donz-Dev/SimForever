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
 * Triggers on a dodge, a parry OR a block, which is all three of the ways
 * Classic opens the window. Block was missing until the engine gained the
 * outcome, and Revenge caught two thirds of what it should.
 *
 * It still never fires in practice, for a more basic reason: nothing attacks
 * the player.
 */
export const REVENGE_ON_AVOID: Reaction = {
  id: 'revenge_on_avoid',
  on: 'taken',
  outcomes: ['dodge', 'parry', 'block'],
  onTrigger: (context, actor) => {
    context.applyAura(actor, REVENGE_READY, actor.id);
  },
};

export const WARRIOR_REACTIONS: readonly Reaction[] = [
  OVERPOWER_ON_DODGE,
  REVENGE_ON_AVOID,
];
