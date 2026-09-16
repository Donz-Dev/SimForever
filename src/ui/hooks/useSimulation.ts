import { useCallback, useState } from 'react';
import type { BatchResult } from '../../simulator';
import { runProfileBatch } from '../../simulator';
import type { CharacterProfile } from '../../profiles';

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
 */
export function useSimulation() {
  const [state, setState] = useState<SimulationState>({ status: 'idle' });
  const [progress, setProgress] = useState(0);

  const run = useCallback((profile: CharacterProfile) => {
    setState({ status: 'running' });
    setProgress(0);

    setTimeout(() => {
      try {
        const batch = runProfileBatch(profile, (fraction) => setProgress(fraction));
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
