import type { AbilityCastEvent, CastReaction, Reaction } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';

/**
 * Rogue talent procs.
 *
 * ----------------------------------------------------------------------------
 * FOUR TALENTS THAT NEEDED A NEW HOOK, and they are why `castReaction` exists.
 *
 * Three of them pay out WHEN A FINISHER IS USED, and a finisher spends its
 * combo points inside its own `onCast` -- so neither the cost system nor a
 * damage reaction can see what happened. The engine now snapshots every pool
 * around a cast and reports the difference, which answers "how many combo
 * points did that spend" without any ability announcing anything.
 *
 * The fourth, Seal Fate, is an ordinary damage reaction that needed one new
 * fact: whether the ability that critted awards combo points. That is declared
 * on the ability rather than inferred, because a reaction sees an id and
 * nothing else.
 *
 * IT WAS NOT COSMETIC. With Relentless Strikes absent the Rogue could not
 * afford its own finisher: Slice and Dice consumed the whole combo point
 * budget and Eviscerate fired zero times at any threshold. See the measurements
 * in `rotations/rogue.ts`.
 * ----------------------------------------------------------------------------
 */

/** A cast that spent combo points is a finisher. Nothing else spends them. */
function comboPointsSpent(cast: AbilityCastEvent): number {
  return cast.spent.comboPoints ?? 0;
}

/**
 * Relentless Strikes: "a 20% chance per Combo Point to restore 25 Energy".
 *
 * ROLLED PER POINT, not once at a scaled chance. Five points is five 20% rolls
 * and can return anything from nothing to 125 energy, which is a different
 * distribution from one roll at 100% -- and the source says "per Combo Point".
 */
export const RELENTLESS_STRIKES_ENERGY = 25;

export const relentlessStrikes = (chancePerPoint: number): CastReaction => ({
  id: 'relentless_strikes',
  canTrigger: (_context, _actor, cast) => comboPointsSpent(cast) > 0,
  onTrigger: (context, actor, cast) => {
    const points = comboPointsSpent(cast);
    for (let i = 0; i < points; i += 1) {
      if (!context.rng.rollChance(chancePerPoint / 100)) continue;
      context.grantResource(actor, 'energy', RELENTLESS_STRIKES_ENERGY, {
        id: 'relentless_strikes',
        name: 'Relentless Strikes',
      });
    }
  },
});

/**
 * Ruthlessness: "gives your finishing moves a 60% chance to add a Combo Point".
 *
 * ONE ROLL FOR THE WHOLE FINISHER, unlike Relentless Strikes: the source says
 * "a 60% chance" rather than a chance per point.
 *
 * The point is granted AFTER the finisher has already drained the bar, so it
 * lands on an empty one and starts the next cycle rather than being consumed
 * by the cast that produced it.
 */
export const ruthlessness = (chancePercent: number): CastReaction => ({
  id: 'ruthlessness',
  canTrigger: (context, _actor, cast) =>
    comboPointsSpent(cast) > 0 && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'comboPoints', 1, {
      id: 'ruthlessness',
      name: 'Ruthlessness',
    });
  },
});

/**
 * Improved Expose Armor: "refunds 2 Combo Points when cast with 5 Combo Points".
 *
 * The refund is FIXED at two and does not scale with rank -- the rank scales
 * the energy reduction, which is a separate effect on the same talent. Bound to
 * the one ability by `abilityId`, so it cannot fire off another finisher.
 */
export const IMPROVED_EXPOSE_ARMOR_REFUND = 2;

export const improvedExposeArmor = (): CastReaction => ({
  id: 'improved_expose_armor',
  abilityId: 'expose_armor',
  canTrigger: (_context, _actor, cast) => comboPointsSpent(cast) >= 5,
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'comboPoints', IMPROVED_EXPOSE_ARMOR_REFUND, {
      id: 'improved_expose_armor',
      name: 'Improved Expose Armor',
    });
  },
});

/**
 * Seal Fate: "your critical strikes from abilities that add Combo Points have a
 * chance to add an additional Combo Point".
 *
 * AN ORDINARY DAMAGE REACTION, because a crit IS a damage event -- this one
 * needed no new hook, only a new fact. `Ability.comboPointsAwarded` is how an
 * ability says it builds, and the reaction reads it from the caster's own book
 * rather than carrying a list of ability ids that would drift from the
 * abilities themselves.
 */
export const sealFate = (chancePercent: number): Reaction => ({
  id: 'seal_fate',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context, actor, attack) => {
    if (!attack.abilityId) return false;
    const ability = actor.abilities.get(attack.abilityId);
    if (!ability?.comboPointsAwarded) return false;
    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'comboPoints', 1, { id: 'seal_fate', name: 'Seal Fate' });
  },
});

/** Procs that fire on a cast, by the talent that grants them. */
export const ROGUE_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  relentless_strikes: relentlessStrikes,
  ruthlessness,
  improved_expose_armor: improvedExposeArmor,
};

/** Procs that fire on an attack, by the talent that grants them. */
export const ROGUE_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  seal_fate: sealFate,
};
