import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BatchResult,
  StatWeight,
  StatWeightPlan,
  StatWeightVariant,
} from '../../simulator';
import { statWeightPlan, weightsFrom, withStat } from '../../simulator';
import type { CharacterProfile } from '../../profiles';
import type { StatName } from '../../engine';
import type { SimReply, SimTask } from '../workers/simWorker';

/**
 * Drive a stat-weight run across a pool of Web Workers.
 *
 * ==============================================================================
 * IT COMPUTES NO STATISTICS OF ITS OWN. `statWeightPlan`, `pairedDelta`,
 * `allocate` and `weightsFrom` all live in `src/simulator` and are called from
 * here, so this file is scheduling and nothing else. That split is the reason
 * `tools/stat_weights.ts` and this panel cannot disagree about a number: the
 * tool runs the same four functions on one thread.
 *
 * ------------------------------------------------------------------------------
 * WHY IT IS WORTH A POOL AT ALL. A fight costs 3 to 5 ms and a demanding
 * selection is tens of thousands of them -- DW Fury's full stat list came to
 * 18,750 fights, which is 56 seconds on one thread. Iterations are perfectly
 * independent and the engine holds no module-level state, so they parallelise
 * exactly; this machine's twelve cores turn that minute into a few seconds.
 *
 * ------------------------------------------------------------------------------
 * ONE PHASE, AND EVERY ROW RUNS THE SAME COUNT. The baseline batch and every
 * variant are dispatched together and the pool drains them; nothing waits on
 * anything else, and no fight is run twice.
 *
 * IT USED TO BE TWO, with a short probe block deciding how many iterations each
 * variant deserved from how noisy its paired difference was. That was cheaper
 * -- a stat worth nothing settled in 250 fights where hit took 3000 -- and the
 * ruleset owner ruled it out, because it made two rows of one table
 * incomparable: a reader sorting by weight could not see that one figure rested
 * on twelve times the evidence of the one above it. Uniform iterations cost
 * more fights and buy a table that can be read straight down.
 *
 * It also removed the only duplication the scheme had. The probe needed the
 * baseline's spreads BEFORE the baseline batch finished, so the baseline's
 * first 250 iterations were run a second time as lean slices just to unblock
 * the pool. With nothing to decide, there is nothing to unblock.
 *
 * ------------------------------------------------------------------------------
 * THE BASELINE IS A FULL BATCH AND THERE IS ONLY ONE OF IT. It produces the
 * ordinary results page and the combat log, and its `dpsSamples` are the paired
 * reference every variant is differenced against -- so the DPS on the results
 * page is by construction the same number the weights were measured from.
 *
 * IT IS ALSO THE FLOOR ON THE WALL CLOCK, because it cannot be split:
 * `BatchTotals` is one accumulator for the whole run and nothing merges two, so
 * every breakdown on the results page has to come off one thread. The variants
 * spread across every other core while it runs.
 *
 * ==============================================================================
 */

/** Iterations per work unit handed to a worker. */
const CHUNK = 100;

/**
 * `Omit` across a union, which the built-in one is not.
 *
 * `Omit<SimTask, 'id'>` keeps only the keys BOTH members share, so it would
 * reject the `from` and `to` a samples task carries and the `iterations` a
 * batch task carries -- and the error reads as if the task were malformed.
 */
type TaskRequest<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * How many workers.
 *
 * One fewer than the cores, so the thread painting the progress bar is not
 * competing with twelve others for it. Falls back to four where the browser
 * will not say.
 */
function poolSize(): number {
  const cores = navigator.hardwareConcurrency ?? 5;
  return Math.max(1, Math.min(12, cores - 1));
}

export type StatWeightState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'running';
      readonly phase: string;
      readonly plan: StatWeightPlan;
    }
  | {
      readonly status: 'done';
      readonly plan: StatWeightPlan;
      readonly baseline: BatchResult;
      readonly weights: readonly StatWeight[];
      readonly fights: number;
      readonly elapsedRealMs: number;
      readonly workers: number;
    }
  | { readonly status: 'error'; readonly message: string };

/** A pool that drains a task list, newest worker free takes the next job. */
class Pool {
  private readonly workers: Worker[] = [];
  private nextId = 1;
  private readonly pending = new Map<number, (reply: SimReply) => void>();
  private readonly idle: Worker[] = [];
  private readonly queue: { task: SimTask; settle: (reply: SimReply) => void }[] = [];

  constructor(size: number) {
    for (let index = 0; index < size; index++) {
      /*
       * THE `new URL(..., import.meta.url)` FORM IS THE ONE THE BUNDLER CAN
       * SEE. Vite rewrites exactly this shape into a built worker chunk; a
       * path assembled from a variable is left alone and 404s in production
       * while working perfectly in dev.
       */
      const worker = new Worker(new URL('../workers/simWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<SimReply>) => {
        const settle = this.pending.get(event.data.id);
        this.pending.delete(event.data.id);
        this.release(worker);
        settle?.(event.data);
      };
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  private release(worker: Worker): void {
    const next = this.queue.shift();
    if (next) {
      this.dispatch(worker, next.task, next.settle);
      return;
    }
    this.idle.push(worker);
  }

  private dispatch(worker: Worker, task: SimTask, settle: (reply: SimReply) => void): void {
    this.pending.set(task.id, settle);
    worker.postMessage(task);
  }

  run(task: TaskRequest<SimTask>): Promise<SimReply> {
    const id = this.nextId++;
    const full = { ...task, id } as SimTask;
    return new Promise((resolve) => {
      const worker = this.idle.pop();
      if (worker) this.dispatch(worker, full, resolve);
      else this.queue.push({ task: full, settle: resolve });
    });
  }

  terminate(): void {
    for (const worker of this.workers) worker.terminate();
    this.workers.length = 0;
    this.idle.length = 0;
    this.queue.length = 0;
    this.pending.clear();
  }
}

export function useStatWeights() {
  const [state, setState] = useState<StatWeightState>({ status: 'idle' });
  const [progress, setProgress] = useState(0);
  const pool = useRef<Pool | undefined>(undefined);
  /*
   * A RUN TOKEN, so a result from an abandoned run cannot land on screen. The
   * user can edit the character and press Run again while a pool is still
   * draining, and the stale reply would otherwise overwrite the new one -- the
   * kind of mix-up `editCharacter` already clears the results for.
   */
  const token = useRef(0);

  useEffect(() => () => pool.current?.terminate(), []);

  const reset = useCallback(() => {
    token.current += 1;
    setState({ status: 'idle' });
    setProgress(0);
  }, []);

  const run = useCallback(
    async (profile: CharacterProfile, selected: readonly StatName[], baseSeed: number) => {
      const mine = ++token.current;
      const plan = statWeightPlan(profile, selected);

      setProgress(0);
      setState({ status: 'running', phase: 'Planning', plan });

      /*
       * THE SAME COUNT FOR THE BASELINE AND FOR EVERY VARIANT. The owner's
       * instruction, and it is what makes two rows of the table comparable.
       */
      const iterations = Math.max(1, profile.simulation.iterations);

      pool.current?.terminate();
      const workers = new Pool(poolSize());
      pool.current = workers;

      try {
        /*
         * Progress is counted in FIGHTS, which is the only unit that behaves:
         * counting tasks makes the bar jump when a long variant finishes, and
         * every task here is the same size anyway only because the counts are
         * now uniform.
         */
        let done = 0;
        const total = iterations * (plan.variants.length + 1);
        const advance = (fights: number) => {
          done += fights;
          setProgress(Math.min(0.999, done / Math.max(1, total)));
        };

        /** One variant's iterations, split across whichever workers are free. */
        const samplesFor = async (variant: StatWeightVariant): Promise<number[]> => {
          const runProfile = withStat(profile, variant.statId, variant.added);
          const slices: Promise<SimReply>[] = [];
          for (let start = 0; start < iterations; start += CHUNK) {
            const end = Math.min(iterations, start + CHUNK);
            slices.push(
              workers
                .run({ kind: 'samples', profile: runProfile, baseSeed, from: start, to: end })
                .then((reply) => {
                  advance(end - start);
                  return reply;
                }),
            );
          }
          const replies = await Promise.all(slices);
          const out: number[] = [];
          for (const reply of replies) {
            if (reply.kind === 'error') throw new Error(reply.message);
            if (reply.kind === 'samples') out.push(...reply.samples);
          }
          return out;
        };

        setState({ status: 'running', phase: 'Running', plan });

        /*
         * ALL AT ONCE. The baseline is one long unsplittable task and the
         * variants are many short ones, so dispatching them together fills
         * every core and the baseline runs inside the pool's own wall clock
         * rather than in front of it.
         */
        const baselineTask = workers
          .run({ kind: 'batch', profile, iterations, baseSeed })
          .then((reply) => {
            advance(iterations);
            return reply;
          });

        const [baselineReply, variantResults] = await Promise.all([
          baselineTask,
          Promise.all(
            plan.variants.map(async (variant) => ({
              variant,
              samples: await samplesFor(variant),
            })),
          ),
        ]);
        if (mine !== token.current) return;
        if (baselineReply.kind === 'error') throw new Error(baselineReply.message);
        if (baselineReply.kind !== 'batch') throw new Error('The baseline came back wrong.');

        const baseline = baselineReply.batch;
        const samples = new Map<string, number[]>(
          variantResults.map((result) => [result.variant.key, result.samples]),
        );

        const weights = weightsFrom(plan, baseline.dpsSamples, samples);
        const fights =
          baseline.dpsSamples.length +
          [...samples.values()].reduce((sum, list) => sum + list.length, 0);

        setProgress(1);
        setState({
          status: 'done',
          plan,
          baseline,
          weights,
          fights,
          elapsedRealMs: baseline.elapsedRealMs,
          workers: workers.size,
        });
      } catch (error) {
        if (mine !== token.current) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (mine === token.current) {
          workers.terminate();
          if (pool.current === workers) pool.current = undefined;
        }
      }
    },
    [],
  );

  return { state, progress, run, reset };
}
