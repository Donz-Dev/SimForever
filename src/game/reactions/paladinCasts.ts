import type { CastReaction } from '../../engine';
import { resolveCast } from '../../engine';
import { activeSeal } from '../auras/paladin';

/**
 * Paladin procs that fire on a CAST rather than on a hit.
 *
 * ----------------------------------------------------------------------------
 * THE THIRD CLASS TO NEED THIS HOOK, after the Rogue's finisher talents and the
 * Mage's. Both Paladin callers key off an ability being USED and neither can see
 * what it wants from a damage event:
 *
 *   SANCTIFIED JUDGEMENT   pays out on Judgement, and its size is a share of a
 *                          DIFFERENT ability's cost
 *   DIVINE FAVOR           is SPENT by the next Holy Shock, and the crit it
 *                          granted has to have been rolled first
 *
 * THE ORDERING IS WHY DIVINE FAVOR LIVES HERE RATHER THAN ON THE AURA.
 * `consumeCastCharges` runs BEFORE `runCast`, so an aura spent by the cast-charge
 * machinery is gone before the spell rolls anything; a cast REACTION runs after
 * `onCast`, so the crit has already been rolled against a buff that was still
 * there. That ordering is documented as load-bearing in CLAUDE.md and this is the
 * second effect to rest on it.
 * ----------------------------------------------------------------------------
 */

/**
 * Sanctified Judgement: "Gives your Judgement ability a 100% chance to return
 * 60% of the Mana cost of the judged seal."
 *
 * ----------------------------------------------------------------------------
 * A REFUND PROPORTIONAL TO ANOTHER ABILITY'S COST, which is what its
 * `unmodelled` reason said had no declaration -- and it needed no new engine
 * capability at all, only a cast reaction that reads the seal's own cost.
 *
 * THE COST IS THE BUILT ONE, NOT THE DECLARATION'S. `resolveCast` is what the
 * cast path itself uses, so Benediction's percentage reduction is already
 * applied -- both Retribution and Shockadin take it at 5/5, which takes a 210
 * mana Seal of Command down. Reading `ability.cost.amount` instead would refund a
 * share of a price the Paladin never paid, and would be wrong in the generous
 * direction. That is the same lesson the Cat Druid's Claw taught about reading a
 * cost off a declaration.
 *
 * "THE JUDGED SEAL" IS WHATEVER IS STILL UP, because Forever's Judgement does not
 * consume the seal. So the seal that was judged is simply the active one, read
 * after the cast exactly as it would be read before it.
 *
 * ITS CHANCE IS THE BUILDER'S ARGUMENT AND THE SHARE IS THE CONSTANT BELOW --
 * 33/66/100 against 20/40/60. Both Paladin profiles that take this take it at
 * 3/3, where the chance is 100 and the share is 60.
 * ----------------------------------------------------------------------------
 */
export const SANCTIFIED_JUDGEMENT_SHARE_PERCENT = 60;

export const sanctifiedJudgement = (chancePercent: number): CastReaction => ({
  id: 'sanctified_judgement',
  abilityId: 'judgement',
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    const sealId = activeSeal(actor);
    if (!sealId) return;
    const seal = actor.abilities.get(sealId);
    if (!seal) return;

    const cost = resolveCast(actor, seal).costAmount;
    const refund = (cost * SANCTIFIED_JUDGEMENT_SHARE_PERCENT) / 100;
    if (refund <= 0) return;

    context.grantResource(actor, 'mana', refund, {
      id: 'sanctified_judgement',
      name: 'Sanctified Judgement',
    });
  },
});

/**
 * Divine Favor's charge, spent by the Holy Shock that used it.
 *
 * ONE CAST, WHICHEVER OF THE THREE IT WAS. Only Holy Shock is declared here, so
 * naming it is both the narrowest and the complete reading: a Paladin who never
 * heals cannot spend the buff any other way.
 */
export const divineFavorSpent = (): CastReaction => ({
  id: 'divine_favor_spent',
  abilityId: 'holy_shock',
  canTrigger: (_context, actor) => actor.auras.has('divine_favor'),
  onTrigger: (context, actor) => {
    actor.auras.remove(context, 'divine_favor');
  },
});

/** Procs that fire on a cast, by the talent that grants them. */
export const PALADIN_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  sanctified_judgement: sanctifiedJudgement,
  divine_favor: () => divineFavorSpent(),
};
