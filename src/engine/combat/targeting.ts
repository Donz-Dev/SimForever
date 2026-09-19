import type { Combatant } from '../actors';
import type { SimulationContext } from '../simulation';

/**
 * How many enemies an ability strikes, and which ones.
 *
 * ----------------------------------------------------------------------------
 * A SKELETON. THE ENCOUNTER HAS ONE TARGET, AND THIS RESOLVES TO ONE TARGET.
 *
 * Four Warrior abilities hit more than one enemy in Forever -- Cleave (2),
 * Whirlwind (4), Thunder Clap (all nearby) and Sweeping Strikes (the next 5
 * melee attacks each strike an additional opponent). None of them can do that
 * here, because `trainingDummyEncounter` builds exactly one dummy and nothing
 * in the engine has ever created a second.
 *
 * The decision is deliberate: model the SHAPE now so that each ability can
 * state what it hits, and resolve it to one target until an encounter exists
 * that has more. The alternative -- leaving multi-target entirely unsaid --
 * was how Whirlwind and Cleave came to look like single-target abilities with
 * no note anywhere explaining that they are not.
 *
 * WHAT THIS MEANS FOR RESULTS, and it is not nothing:
 *
 *   - Cleave, Whirlwind and Thunder Clap are UNDERSTATED by exactly the
 *     targets they do not hit. Against a single dummy that understatement is
 *     correct, because a single dummy IS one target.
 *   - Sweeping Strikes does nothing at all. Its entire effect is the extra
 *     opponent, so against one target it is 30 rage for no damage. That is the
 *     honest answer for this encounter and a wrong answer for a real fight.
 *
 * Anything reading these numbers for a multi-target fight is reading the wrong
 * simulator, and should say so before it says anything else.
 * ----------------------------------------------------------------------------
 */
export interface TargetSelection {
  /**
   * The most enemies this ability can strike, counting the primary one.
   *
   * `1` is a single-target ability. `Infinity` means "everything in range",
   * which is how Forever words Thunder Clap.
   */
  readonly maxTargets: number;
  /**
   * What a secondary target takes, as a fraction of the primary's damage.
   *
   * One for Cleave and Whirlwind, which deal their full damage to each. Named
   * rather than assumed because an ability that splits damage between targets
   * is the other common shape and would set this below one.
   */
  readonly secondaryFraction?: number;
}

/** Strikes the primary target only. */
export const SINGLE_TARGET: TargetSelection = { maxTargets: 1 };

/**
 * The enemies an ability actually strikes, primary first.
 *
 * TODAY THIS ALWAYS RETURNS AT MOST ONE COMBATANT, because an encounter has one
 * enemy in it. It takes the whole context anyway so that the day an encounter
 * gains a second enemy, this function is the only thing that has to change --
 * every caller already asks the right question.
 */
export function selectTargets(
  context: SimulationContext,
  source: Combatant,
  primary: Combatant,
  selection: TargetSelection,
): readonly Combatant[] {
  if (selection.maxTargets <= 1) return [primary];

  const hostile = context.combatants.filter(
    (actor) => actor.faction !== source.faction && actor.isAlive && actor.id !== primary.id,
  );
  if (hostile.length === 0) return [primary];

  const extra = Number.isFinite(selection.maxTargets)
    ? Math.max(0, selection.maxTargets - 1)
    : hostile.length;
  return [primary, ...hostile.slice(0, extra)];
}

/**
 * How many enemies an ability WOULD have hit, for reporting.
 *
 * Distinct from `selectTargets().length`, which is what it did hit. The gap
 * between the two is exactly the understatement described above, and something
 * that surfaces it to a reader needs both numbers rather than one.
 */
export function unreachedTargets(
  context: SimulationContext,
  source: Combatant,
  primary: Combatant,
  selection: TargetSelection,
): number {
  const wanted = Number.isFinite(selection.maxTargets) ? selection.maxTargets : Infinity;
  const reached = selectTargets(context, source, primary, selection).length;
  return wanted === Infinity ? Infinity : Math.max(0, wanted - reached);
}
