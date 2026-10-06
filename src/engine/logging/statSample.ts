import type { Combatant } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import { hasteMultiplierFrom } from '../combat/ratings';

/**
 * The stats a results page averages over a fight.
 *
 * Three of the four are read straight off the block; haste is converted to the
 * MULTIPLIER the swing timer divides by, because a rating is not a number
 * anybody can read and because the conversion is the thing that makes Slice and
 * Dice, Flurry and Rapid Fire the same kind of quantity.
 */
export interface StatSampleValues {
  readonly attackPower: number;
  readonly rangedAttackPower: number;
  readonly spellPower: number;
  readonly hasteMultiplier: number;
}

/** What this combatant's sampled stats are right now. Pure; emits nothing. */
export function statSampleOf(actor: Combatant): StatSampleValues {
  const stats = actor.stats.effective;
  return {
    attackPower: stats.attackPower,
    rangedAttackPower: stats.rangedAttackPower,
    spellPower: stats.spellPower,
    hasteMultiplier: hasteMultiplierFrom(stats),
  };
}

/**
 * Emit a stat sample, unless nothing the sample carries has moved.
 *
 * ------------------------------------------------------------------------------
 * THE SKIP IS WHAT KEEPS THIS CHEAP ENOUGH TO CALL FROM EVERY AURA EDGE. Most
 * auras carry no stat modifiers at all -- a debuff on the target, a cooldown
 * marker, a proc window -- so calling this on every application and removal
 * would otherwise double the event stream to say nothing. Comparing against the
 * last sample costs four number comparisons against a cached stat block.
 *
 * `force` IS FOR THE TWO BOUNDARIES. Combat start must emit whatever the
 * character opened with, or the first window has no value; combat end must
 * emit so the last window has a length. Neither can be skipped on "nothing
 * changed", and the start one also re-bases the memo -- which matters because a
 * test may hand the SAME `Combatant` to two simulations in a row.
 * ------------------------------------------------------------------------------
 */
export function sampleStats(
  context: SimulationContext,
  actor: Combatant,
  force = false,
): void {
  const values = statSampleOf(actor);
  if (!force && unchanged(actor.lastStatSample, values)) return;

  actor.lastStatSample = values;
  context.telemetry.emit({
    type: 'stat_sample',
    timestamp: context.clock.now(),
    actorId: actor.id,
    ...values,
  });
}

function unchanged(
  previous: StatSampleValues | undefined,
  next: StatSampleValues,
): boolean {
  return (
    previous !== undefined &&
    previous.attackPower === next.attackPower &&
    previous.rangedAttackPower === next.rangedAttackPower &&
    previous.spellPower === next.spellPower &&
    previous.hasteMultiplier === next.hasteMultiplier
  );
}
