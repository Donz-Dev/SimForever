import { StreamingIterationTotals } from '../analysis';
import type { SimulationConfig } from '../engine';
import { Simulation, deriveSeed, toSeconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * Per-iteration DPS and deaths, and nothing else.
 *
 * ------------------------------------------------------------------------------
 * WHY THIS EXISTS WHEN `runBatch` ALREADY RUNS ITERATIONS. Two reasons, and the
 * second is the one that matters.
 *
 * It is CHEAPER: `runBatch` accumulates a `BatchTotals` -- every ability's
 * attempts, hits and crits, every resource's flow, every aura's uptime, the
 * damage taken, the stat averages -- and a stat-weight variant throws all of it
 * away. Swapping that for `StreamingIterationTotals`, which keeps two numbers
 * per actor, measured 1.23x faster on DW Fury and 1.75x on the Frostfire Mage,
 * and reproduced `runBatch`'s DPS TO THE DECIMAL on both. That equality is the
 * check that this is the same fight and not a cheaper approximation of one.
 *
 * It is SLICEABLE, which `runBatch` is not. A slice is a half-open range of
 * iteration INDICES, and iteration `i` always derives its seed from the base
 * seed the same way -- so [0, 250) in one worker and [250, 500) in another
 * produce exactly the samples a single [0, 500) call would, in the same order.
 * That is what lets a run spread across twelve cores, and it is also what keeps
 * the pairing honest: iteration `i` of a variant and iteration `i` of the
 * baseline are the same fight with one stat changed.
 *
 * ------------------------------------------------------------------------------
 * BOTH METRICS OFF THE SAME FIGHTS. A damage stat weight asks what a point is
 * worth in DPS and a TANK stat weight asks what it is worth in deaths avoided,
 * and those are two readings of one run rather than two runs. Sampling them
 * separately would double every tank-weight run and produce figures measured on
 * different fights, which is exactly the pairing this file exists to preserve.
 *
 * DPS SUMS EVERY FRIENDLY ACTOR and DEATHS COUNT THE PLAYER. That split is the
 * same one `runBatch` makes and for the same reason: a Hunter's pet is a third
 * of the build's damage, and a pet dying is not the thing a tank weight is
 * trying to avoid.
 * ------------------------------------------------------------------------------
 */

/** A half-open range of iteration indices. */
export interface SampleSlice {
  /** First iteration index, inclusive. */
  readonly from: number;
  /** One past the last, exclusive. */
  readonly to: number;
}

/** What one slice of iterations produced, in index order. */
export interface IterationSamples {
  /** DPS of every friendly actor together, per iteration. */
  readonly dps: number[];
  /**
   * Times the PLAYER died, per iteration.
   *
   * All zero in a fight the target does not swing in, which is the default --
   * and the tank-weight panel only appears when it does.
   */
  readonly deaths: number[];
}

/**
 * Both metrics for each iteration in a slice, in index order.
 *
 * `config` is built once by the caller and reused across slices, because
 * `trainingDummyEncounter` resolves the raid buffs and the duration override on
 * every call and a slice is not a new encounter. The COMBATANTS are still built
 * fresh per iteration -- `createCombatants` is a factory for exactly that
 * reason, and sharing them would hand iteration two the leftovers of iteration
 * one.
 */
export function sampleIterations(
  config: SimulationConfig,
  baseSeed: number,
  slice: SampleSlice,
): IterationSamples {
  const count = Math.max(0, slice.to - slice.from);
  const dps: number[] = new Array(count);
  const deaths: number[] = new Array(count);

  for (let index = slice.from; index < slice.to; index++) {
    const totals = new StreamingIterationTotals();
    const run = new Simulation({ ...config, seed: deriveSeed(baseSeed, index) }, totals).run();

    const friendly = run.actors.filter((actor) => actor.faction === 'friendly');
    const ids = friendly.map((actor) => actor.id);

    /*
     * THE SAME GUARD `runBatch` USES, and it is not cosmetic: a fight that
     * somehow ended at zero would divide by nothing and poison a mean that
     * everything downstream reads.
     */
    const elapsedSeconds = Math.max(toSeconds(run.elapsedMs), 0.001);
    const at = index - slice.from;
    dps[at] = totals.totalForAny(ids) / elapsedSeconds;
    /*
     * THE PLAYER, WHICH IS THE FIRST FRIENDLY ACTOR. `runBatch` reads survival
     * off `playerId` the same way, and for the reason it gives: rage, survival
     * and resources are genuinely the player's where damage is shared.
     */
    deaths[at] = friendly[0] ? totals.deathsFor(friendly[0].id) : 0;
  }

  return { dps, deaths };
}

/** The same thing from a profile, for a caller that has no config in hand. */
export function profileSamples(
  profile: CharacterProfile,
  baseSeed: number,
  slice: SampleSlice,
): IterationSamples {
  return sampleIterations(trainingDummyEncounter(profile), baseSeed, slice);
}
