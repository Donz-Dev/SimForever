import type { Reaction } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';

/**
 * Druid talent procs.
 *
 * One, so far. Most of the Feral tree's reactive clauses need the target to
 * swing back -- Natural Reaction's rage on dodge, Furor's rage on shifting --
 * and the three profiles face a standing target.
 */

/**
 * Primal Fury: "a 100% chance to gain an additional 5 Rage any time you get a
 * critical strike while in Bear Form or Dire Bear Form".
 *
 * THE FORM CONDITION IS NOT CHECKED HERE and does not need to be: rage is the
 * Bear's resource, and `grantResource` finds no pool on a Cat or a Moonkin and
 * ignores the grant. The condition enforces itself.
 */
export const PRIMAL_FURY_RAGE = 5;

export const primalFury = (chancePercent: number): Reaction => ({
  id: 'primal_fury',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', PRIMAL_FURY_RAGE, {
      id: 'primal_fury',
      name: 'Primal Fury',
    });
  },
});

export const DRUID_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  primal_fury: primalFury,
};
