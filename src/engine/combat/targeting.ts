import type { Combatant } from '../actors';
import type { SimulationContext } from '../simulation';

/**
 * How many enemies an ability strikes, and which ones.
 *
 * ----------------------------------------------------------------------------
 * IT WAS A SKELETON FOR A LONG TIME AND IS LIVE SINCE ROUND 57. The encounter
 * builds `numberOfTargets` dummies -- the boss first, then adds -- and every
 * area ability in the game layer asks this function, through
 * `game/combat/multiTarget.ts`'s `areaTargets`. Nothing here had to change: the
 * shape below was written so that the day a second enemy existed, only the
 * callers would be new, and that is how it went.
 *
 * AT ONE TARGET IT RETURNS `[primary]`, which is what keeps a one-target fight
 * byte-identical to the encounter before adds existed. The primary comes FIRST
 * so the events it produces are emitted in their old order.
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
 * Living enemies other than the primary, in combatant order -- which is the
 * encounter's own order, boss then adds.
 */
export function selectTargets(
  context: SimulationContext,
  source: Combatant,
  primary: Combatant,
  selection: TargetSelection,
): readonly Combatant[] {
  if (selection.maxTargets <= 1) return [primary];

  const hostile = context.combatants.filter(
    (actor) =>
      actor.faction !== source.faction && actor.isAlive && actor.present && actor.id !== primary.id,
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
