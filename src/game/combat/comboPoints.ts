import type { Combatant, SimulationContext } from '../../engine';

/**
 * Combo points: the resource a Rogue and a Cat Druid build and then spend.
 *
 * ----------------------------------------------------------------------------
 * NOT AN ENGINE CHANGE, AND THAT IS THE POINT.
 *
 * `comboPoints` has been a `ResourceType` since the resource system was
 * written, the UI has always known its label, and the pattern a finisher needs
 * was already proven by EXECUTE: take a fixed cost through `Ability.cost`,
 * then drain what is left in a second pool inside `onCast` and scale the
 * damage by what was drained.
 *
 * What was missing was three small things in `game`, and this file plus two
 * lines in `character/resources.ts` and `character/definitions.ts` are all of
 * them:
 *
 *   - a maximum. Without one the pool is built with `maximum: 0` and every
 *     point awarded is immediately wasted, silently.
 *   - the Rogue and the Druid owning the pool at all.
 *   - one place that says what a builder and a finisher do, so four profiles
 *     across two classes cannot disagree about it.
 *
 * WHY A HELPER RATHER THAN EACH ABILITY DOING IT. A finisher has to read the
 * points, drain them, and scale by the number it drained -- three steps in
 * that order, and getting them out of order reads the pool after emptying it
 * and scales by zero. Cat Druid and three Rogue builds all need it.
 * ----------------------------------------------------------------------------
 */

/** Five, and the pool is built with this as its maximum. */
export const MAX_COMBO_POINTS = 5;

/**
 * Award one combo point for a builder that landed.
 *
 * ----------------------------------------------------------------------------
 * ONLY FOR AN ATTACK THAT CONNECTED. A builder that missed builds nothing,
 * which is the same rule Forever's rage follows for the same reason: it is a
 * resource earned by hitting something. The caller checks the outcome, because
 * only the caller knows whether the swing landed.
 *
 * AT THE CAP IT IS WASTED, NOT REFUSED. `grantResource` reports the overflow
 * as `wasted`, which is what makes "how much of my Sinister Strike was thrown
 * away" a number on the results page rather than a guess. Refusing the award
 * instead would hide it.
 *
 * PER TARGET IS NOT MODELLED. In the real game combo points live on the target
 * and are lost when you switch; every encounter here has exactly one enemy, so
 * there is nothing to switch to and the distinction cannot be observed. Worth
 * knowing before an encounter with adds is built -- at that point this becomes
 * wrong rather than merely simplified.
 * ----------------------------------------------------------------------------
 */
export function awardComboPoint(
  context: SimulationContext,
  actor: Combatant,
  abilityId: string,
  abilityName: string,
  amount = 1,
): void {
  context.grantResource(actor, 'comboPoints', amount, {
    id: abilityId,
    name: abilityName,
  });
}

/** How many combo points this character is holding. */
export function comboPointsOn(actor: Combatant): number {
  return actor.resources.get('comboPoints')?.current ?? 0;
}

/**
 * Spend every combo point and report how many there were.
 *
 * THE ORDER IS THE WHOLE HELPER: read, then drain, then let the caller scale
 * by the returned count. Draining first and reading after gives zero, and a
 * finisher that deals its one-point damage at five points is not obviously
 * broken from the outside -- it just looks like a weak ability.
 */
export function spendComboPoints(actor: Combatant): number {
  const pool = actor.resources.get('comboPoints');
  if (!pool) return 0;

  const held = pool.current;
  if (held <= 0) return 0;

  pool.drain(held);
  return held;
}

/**
 * Whether a finisher is worth casting at all.
 *
 * A finisher at zero points does nothing and still costs its energy and a
 * global cooldown, so every one of them gates on this rather than each
 * repeating the comparison.
 */
export function hasComboPoints(actor: Combatant): boolean {
  return comboPointsOn(actor) > 0;
}
