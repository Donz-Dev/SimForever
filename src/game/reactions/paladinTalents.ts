import type { TalentReactionBuilder } from './warriorTalents';
import { redoubtAura, vengeanceAura } from '../auras/paladin';

/**
 * Paladin talent procs.
 *
 * ----------------------------------------------------------------------------
 * A BLOCK IS NOT AN OUTCOME A REACTION CAN SEE, and it costs this class two
 * clauses. Forever's block LANDS and is reduced by a flat amount in the damage
 * pipeline rather than being rolled as a table result -- which is the right
 * model and is why `AttackOutcome` has no `block` for `melee-received` to
 * produce. An aura can be spent by a block (`consumedByBlock`) and a reaction
 * cannot fire on one.
 *
 * So Reckoning's block half and Holy Shield's damage-per-block are both
 * unmodelled, and both say so. Reckoning's CRIT half works, which is the
 * larger of the two anyway at 100% against 40%.
 *
 * TWO OF THE THREE NEED THE TARGET TO SWING BACK, which makes this the second
 * class after the Warrior where a tree's reactive half is live for one profile
 * and inert for the others.
 * ----------------------------------------------------------------------------
 */

/**
 * Vengeance: a critical strike raises Physical and Holy damage, stacking.
 *
 * ANY CRIT, not only a melee one. "After landing a critical strike" names no
 * school and no weapon, so a Judgement crit arms it exactly as a swing does --
 * which matters for a Retribution paladin judging every ten seconds.
 */
export const vengeance: TalentReactionBuilder = (percentPerStack) => ({
  id: 'vengeance',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => attack.amount > 0,
  onTrigger: (context, actor) => {
    context.applyAura(actor, vengeanceAura(percentPerStack), actor.id);
  },
});

/**
 * Redoubt: a damaging melee attack against the Paladin may raise block chance.
 *
 * ----------------------------------------------------------------------------
 * ITS CHANCE IS THE SAME AT EVERY RANK AND ONLY THE BONUS MOVES. The values
 * are [10, 6], [10, 12], [10, 18], [10, 24], [10, 30] -- ten percent
 * throughout, with the block bonus stepping by six.
 *
 * So this builder takes the BLOCK BONUS, not the chance, and the effect table
 * passes `valueIndex: 1` to make that happen. A builder handed index 0 would
 * receive 10 at every rank and grant a +10% block bonus from a 10% chance --
 * a third of the talent at rank 5, identical at every rank, and completely
 * silent. The chance is the constant below.
 * ----------------------------------------------------------------------------
 */
export const REDOUBT_PROC_CHANCE = 10;

export const redoubt: TalentReactionBuilder = (blockChanceBonus) => ({
  id: 'redoubt',
  on: 'taken',
  // A damaging attack: one that landed. Avoided attacks deal nothing.
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, _actor, attack) =>
    attack.amount > 0 && context.rng.rollChance(REDOUBT_PROC_CHANCE / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, redoubtAura(blockChanceBonus), actor.id);
  },
});

/**
 * Reckoning: an extra attack after being critically hit.
 *
 * ITS BLOCK HALF CANNOT FIRE. "A {0}% chance to gain an extra attack after
 * Blocking" needs a block as an attack OUTCOME, and Forever's block is a flat
 * reduction inside the damage pipeline rather than a table result -- so
 * nothing can key on it. The crit half is 100% at rank 5 against the block
 * half's 40%, so the larger clause is the one that works.
 *
 * AN EXTRA ATTACK, the same machinery Hand of Justice and Windfury use, with
 * the same invariant: `scheduleSwing` keeps at most one pending swing per
 * slot, so this cannot fork the chain.
 */
export const RECKONING_UNMODELLED =
  'Its "extra attack after Blocking" half cannot fire: a block is a flat ' +
  'reduction in the damage pipeline rather than an attack outcome, so no ' +
  'reaction can key on one. Its extra attack after being CRITICALLY HIT ' +
  'applies, and is the larger of the two clauses.';

export const reckoning: TalentReactionBuilder = (_blockChancePercent) => ({
  id: 'reckoning',
  on: 'taken',
  outcomes: ['crit'],
  // "A 100% chance ... after being the victim of a non-periodic critical
  // strike" at rank 5. The chance is the talent's SECOND value and is 100
  // there; below rank 5 it steps 20/40/60/80, which the effect table passes.
  canTrigger: (context, _actor, attack) =>
    attack.amount > 0 && context.rng.rollChance(RECKONING_CRIT_CHANCE / 100),
  onTrigger: (context, actor) => {
    context.extraAttack(actor, 'mainHand');
  },
});

/**
 * Reckoning's crit chance, which the Protection build takes at 5/5.
 *
 * Named rather than threaded through the builder because the builder's one
 * argument is already spoken for by the block chance, and the Protection
 * profile is the only one that takes the talent at all -- at full rank, where
 * this is 100.
 */
export const RECKONING_CRIT_CHANCE = 100;

export const PALADIN_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  vengeance,
  redoubt,
  reckoning,
};
