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

/*
 * ----------------------------------------------------------------------------
 * AND THE RULING IS NOT THE WARRIOR'S FRACTION, IT IS THE READING.
 *
 * Execute and Hammer of Wrath both say "20% or less health" and share the
 * constant above. Two TALENTS state their own thresholds and do not: the
 * Priest's Early Demise at 20% and the Rogue's Quietus at 35%, the second of
 * which the ruleset owner set explicitly. So 0.2 is one ruleset number among
 * several, and what is shared is that a stated low-health threshold is read as
 * the final fraction of the fight.
 *
 * THOSE TWO TAKE THEIR FRACTION FROM THEIR OWN DATA rather than from a constant
 * here -- `values/priest.json` states 20 and `values/rogue.json` states 35, in
 * the same rows as the bonuses they go with, so a Forever change to either
 * moves the talent without anybody editing TypeScript. `abilityCritInFinalFraction`
 * in `TalentEffect.ts` is how they say which of their own numbers is the
 * threshold.
 *
 * THREE ENTRIES IN THIS PROJECT EXPLAINED A SILENCE AS "the target never
 * drops", and all three were wrong to. It is written here rather than in each
 * of them because the next one will be written by somebody who has not read
 * them.
 * ----------------------------------------------------------------------------
 */

/**
 * Whether the fight has reached its execute phase.
 *
 * Read off the PLANNED duration rather than a fight that has already ended,
 * which is the only thing that knows -- `FIGHT_DURATION_VARIANCE` moves the
 * real length per iteration, so a fixed number of seconds would open the
 * window at a different fraction in every fight of a batch.
 */
export function inExecutePhase(
  simulation: SimulationContext,
  /** The last `fraction` of the fight. Defaults to Execute's own 20%. */
  fraction: number = EXECUTE_PHASE_FRACTION,
): boolean {
  const remaining = simulation.plannedDurationMs - simulation.clock.now();
  return remaining <= simulation.plannedDurationMs * fraction;
}
