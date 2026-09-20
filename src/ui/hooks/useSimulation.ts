import { useCallback, useState } from 'react';
import type { BatchResult } from '../../simulator';
import { runProfileBatch } from '../../simulator';
import type { CharacterProfile } from '../../profiles';

/** A fresh non-negative integer seed, in the range the engine expects. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export type SimulationState =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | { readonly status: 'done'; readonly batch: BatchResult }
  | { readonly status: 'error'; readonly message: string };

/**
 * Runs a simulation and exposes its state to React.
 *
 * This hook is the entire connection between the UI and the engine. Note what
 * is not here: no damage formulas, no event handling, no combat logic. A React
 * component asks for a simulation and renders the result, exactly as the
 * architecture requires.
 *
 * The run is deferred by one frame so the browser can paint the "Running..."
 * state first; the engine is synchronous and would otherwise block the paint.
 * Moving iterations onto Web Workers later changes this file and nothing else.
 *
 * Every run draws a FRESH SEED rather than using the profile's. Two clicks of
 * Run on an unchanged setup should show the spread the fight actually has;
 * reusing one seed would repeat a single fight and make a noisy result look
 * certain. The seed used is recorded on the result and is NOT SHOWN ANYWHERE:
 * a seed on screen invites reading one fight as the answer, so a run can still be identified after the fact.
 *
 * The profile's own seed is left alone, so a saved profile still describes a
 * reproducible fight for anything that runs it directly.
 */
export function useSimulation() {
  const [state, setState] = useState<SimulationState>({ status: 'idle' });
  const [progress, setProgress] = useState(0);

  const run = useCallback((profile: CharacterProfile) => {
    setState({ status: 'running' });
    setProgress(0);

    setTimeout(() => {
      try {
        const batch = runProfileBatch(
          { ...profile, simulation: { ...profile.simulation, seed: randomSeed() } },
          (fraction) => setProgress(fraction),
        );
        setState({ status: 'done', batch });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, 0);
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    setProgress(0);
  }, []);

  return { state, progress, run, reset };
}
