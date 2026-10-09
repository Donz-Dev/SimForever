/// <reference lib="webworker" />
import type { BatchResult, IterationSamples } from '../../simulator';
import { profileSamples, runProfileBatch } from '../../simulator';
import type { CharacterProfile } from '../../profiles';

/**
 * One fight-running thread.
 *
 * ==============================================================================
 * THE ARCHITECTURE ALREADY ALLOWED THIS AND SAID SO. `src/simulator/index.ts`
 * has described itself as "the seam where the implementation can change without
 * anything above noticing: running iterations in Web Workers, or posting them to
 * a server, replaces the inside of these functions and nothing else", and
 * `SimulationResult` has carried "it is plain JSON-serialisable data, which is
 * what allows the engine to move into a Web Worker" since before batching
 * existed. This is the file that takes them up on it.
 *
 * It holds NO state between messages and knows nothing about stat weights. Two
 * jobs, both of which are "run fights and hand back numbers":
 *
 *   batch    one full `runProfileBatch`, for the ordinary results page. Its
 *            `dpsSamples` and `deathSamples` double as the paired baselines a
 *            stat weight needs.
 *   samples  a SLICE of iterations: DPS and deaths, both read off the same
 *            fights. The parallel unit.
 *
 * A SLICE IS A RANGE OF ITERATION INDICES, which is what makes splitting safe:
 * iteration `i` derives its seed from the base seed the same way wherever it
 * runs, so [0, 100) here and [100, 200) there produce exactly what one
 * [0, 200) call would, in the same order. Nothing is averaged in the worker --
 * the driver owns every statistic, so there is one implementation of the
 * arithmetic and not one per thread.
 *
 * WHY THE PROFILE AND NOT A CONFIG. A `SimulationConfig` holds closures --
 * `createCombatants` is a factory and `attackChances` is a provider -- and a
 * function cannot cross a `postMessage`. A profile is plain JSON by design, so
 * the worker rebuilds the encounter from it. Which is the same reason a profile
 * is plain JSON in the first place.
 * ==============================================================================
 */

export interface BatchTask {
  readonly kind: 'batch';
  readonly id: number;
  readonly profile: CharacterProfile;
  readonly iterations: number;
  readonly baseSeed: number;
}

export interface SamplesTask {
  readonly kind: 'samples';
  readonly id: number;
  readonly profile: CharacterProfile;
  readonly baseSeed: number;
  readonly from: number;
  readonly to: number;
}

export type SimTask = BatchTask | SamplesTask;

export type SimReply =
  | { readonly kind: 'batch'; readonly id: number; readonly batch: BatchResult }
  | { readonly kind: 'samples'; readonly id: number; readonly samples: IterationSamples }
  /*
   * A FAILURE COMES BACK AS A MESSAGE RATHER THAN AS AN UNCAUGHT ERROR, so the
   * driver can fail the whole run with the reason on screen. A worker that
   * simply dies leaves its task pending for ever, which looks like a progress
   * bar that stopped.
   */
  | { readonly kind: 'error'; readonly id: number; readonly message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<SimTask>) => {
  const task = event.data;
  try {
    if (task.kind === 'batch') {
      const batch = runProfileBatch({
        ...task.profile,
        // `runProfileBatch` reads `simulation.seed` AS the base seed, and the
        // pairing depends on the baseline and every variant sharing it.
        simulation: {
          ...task.profile.simulation,
          iterations: task.iterations,
          seed: task.baseSeed,
        },
      });
      const reply: SimReply = { kind: 'batch', id: task.id, batch };
      scope.postMessage(reply);
      return;
    }

    const samples = profileSamples(task.profile, task.baseSeed, {
      from: task.from,
      to: task.to,
    });
    const reply: SimReply = { kind: 'samples', id: task.id, samples };
    scope.postMessage(reply);
  } catch (error) {
    const reply: SimReply = {
      kind: 'error',
      id: task.id,
      message: error instanceof Error ? error.message : String(error),
    };
    scope.postMessage(reply);
  }
};
