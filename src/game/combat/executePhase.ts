import type { SimulationContext } from '../../engine';

/*
 * ============================================================================
 * THE EXECUTE PHASE IS MEASURED IN TIME, NOT IN TARGET HEALTH.
 *
 * The ruleset owner's decision, made for Execute and now shared by every
 * ability that states a low-health requirement. It follows from what the
 * encounter is: the target is a damage sink running for a fixed duration, not
 * something with a health bar to whittle down.
 *
 * A HEALTH GATE COULD NEVER FIRE AGAINST IT. A hundred thousand health taking
 * fifteen thousand damage in a hundred seconds never reaches 20%, so Execute
 * sat in every Warrior list and had never once been cast -- an entry that is
 * present, correct, affordable and silent.
 *
 * ----------------------------------------------------------------------------
 * IT LIVES HERE RATHER THAN IN `abilities/warrior.ts` BECAUSE IT IS NOT THE
 * WARRIOR'S.
 *
 * Hammer of Wrath says "only usable on enemies that have 20% or less health"
 * and gets the same answer, and the Paladin reaching into the Warrior's file
 * for it would read as a Warrior rule being borrowed rather than as one rule
 * with two callers. `EXECUTE_PHASE_FRACTION` is re-exported from
 * `abilities/warrior.ts` so nothing that already imports it has to move.
 *
 * Keeping a health branch "for realism" would mean two ways for the same
 * ability to become available that can never both be true. One rule.
 * ============================================================================
 */

/** The last fifth of the fight. */
export const EXECUTE_PHASE_FRACTION = 0.2;

/**
 * Whether the fight has reached its execute phase.
 *
 * Read off the PLANNED duration rather than a fight that has already ended,
 * which is the only thing that knows -- `FIGHT_DURATION_VARIANCE` moves the
 * real length per iteration, so a fixed number of seconds would open the
 * window at a different fraction in every fight of a batch.
 */
export function inExecutePhase(simulation: SimulationContext): boolean {
  const remaining = simulation.plannedDurationMs - simulation.clock.now();
  return remaining <= simulation.plannedDurationMs * EXECUTE_PHASE_FRACTION;
}
