import { StreamingDamageTotals } from '../analysis';
import type { SimulationConfig } from '../engine';
import { Simulation, deriveSeed, toSeconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * Per-iteration DPS, and nothing else.
 *
 * ------------------------------------------------------------------------------
 * WHY THIS EXISTS WHEN `runBatch` ALREADY RUNS ITERATIONS. Two reasons, and the
 * second is the one that matters.
 *
 * It is CHEAPER: `runBatch` accumulates a `BatchTotals` -- every ability's
 * attempts, hits and crits, every resource's flow, every aura's uptime, the
 * damage taken, the stat averages -- and a stat-weight variant throws all of it
 * away. Swapping that for `StreamingDamageTotals`, which keeps one number per
 * source id, measured 1.23x faster on DW Fury and 1.75x on the Frostfire Mage,
 * and reproduced `runBatch`'s DPS TO THE DECIMAL on both. That equality is the
 * check that this is the same fight and not a cheaper approximation of one.
 *
 * It is SLICEABLE, which `runBatch` is not. A slice is a half-open range of
 * iteration INDICES, and iteration `i` always derives its seed from the base
 * seed the same way -- so [0, 250) in one worker and [250, 500) in another
 * produce exactly the samples a single [0, 500) call would, in the same order.
 * That is what lets a run spread across twelve cores, and it is also what keeps
 * the pairing below honest: iteration `i` of a variant and iteration `i` of the
 * baseline are the same fight with one stat changed.
 *
 * IT SUMS EVERY FRIENDLY ACTOR, like `runBatch`'s own DPS and for the same
 * reason: a Hunter's pet is a second friendly combatant and a third of the
 * build's damage. Reading the player alone would price every Beast Mastery
 * stat against two thirds of the character.
 * ------------------------------------------------------------------------------
 */

/** A half-open range of iteration indices. */
export interface SampleSlice {
  /** First iteration index, inclusive. */
  readonly from: number;
  /** One past the last, exclusive. */
  readonly to: number;
}

/**
 * DPS for each iteration in a slice, in index order.
 *
 * `config` is built once by the caller and reused across slices, because
 * `trainingDummyEncounter` resolves the raid buffs and the duration override on
 * every call and a slice is not a new encounter. The COMBATANTS are still built
 * fresh per iteration -- `createCombatants` is a factory for exactly that
 * reason, and sharing them would hand iteration two the leftovers of iteration
 * one.
 */
export function dpsSamplesFor(
  config: SimulationConfig,
  baseSeed: number,
  slice: SampleSlice,
): number[] {
  const out: number[] = new Array(Math.max(0, slice.to - slice.from));

  for (let index = slice.from; index < slice.to; index++) {
    const totals = new StreamingDamageTotals();
    const run = new Simulation({ ...config, seed: deriveSeed(baseSeed, index) }, totals).run();

    const friendly = run.actors
      .filter((actor) => actor.faction === 'friendly')
      .map((actor) => actor.id);

    /*
     * THE SAME GUARD `runBatch` USES, and it is not cosmetic: a fight that
     * somehow ended at zero would divide by nothing and poison a mean that
     * everything downstream reads.
     */
    const elapsedSeconds = Math.max(toSeconds(run.elapsedMs), 0.001);
    out[index - slice.from] = totals.totalForAny(friendly) / elapsedSeconds;
  }

  return out;
}

/** The same thing from a profile, for a caller that has no config in hand. */
export function profileDpsSamples(
  profile: CharacterProfile,
  baseSeed: number,
  slice: SampleSlice,
): number[] {
  return dpsSamplesFor(trainingDummyEncounter(profile), baseSeed, slice);
}
