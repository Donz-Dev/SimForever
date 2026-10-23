import { useCallback, useState } from 'react';
import type { BatchResult } from '../../simulator';
import { runHealerBatch, runProfileBatch } from '../../simulator';
import type { CharacterProfile } from '../../profiles';

/** A fresh non-negative integer seed, in the range the engine expects. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export type SimulationState =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  /*
   * `profile` IS THE ONE THAT RAN, SEED INCLUDED (round 48): the hook draws a
   * fresh seed per run, so the profile on screen cannot reproduce the result
   * and this one can. Sim History stores it.
   */
  | {
      readonly status: 'done';
      readonly batch: BatchResult;
      readonly profile: CharacterProfile;
      /**
       * A HEALER RUN'S TWO REPORTS (round 52): the Tank Healer fight and the
       * Raid Healer fight, run back to back at one seed. `batch` is the tank
       * fight's, so everything that reads a single batch -- Sim History --
       * still has one.
       */
      readonly healer?: HealerReports;
    }
  | { readonly status: 'error'; readonly message: string };

export interface HealerReports {
  readonly tank: BatchResult;
  readonly raid: BatchResult;
}

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
        const ran = { ...profile, simulation: { ...profile.simulation, seed: randomSeed() } };
        const batch = runProfileBatch(ran, (fraction) => setProgress(fraction));
        setState({ status: 'done', batch, profile: ran });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, 0);
  }, []);

  /**
   * A healer run: the Tank Healer fight, then the Raid Healer fight, on one
   * fresh seed. The progress bar covers both, half each.
   */
  const runHealer = useCallback((profile: CharacterProfile) => {
    setState({ status: 'running' });
    setProgress(0);

    setTimeout(() => {
      try {
        const ran = { ...profile, simulation: { ...profile.simulation, seed: randomSeed() } };
        const tank = runHealerBatch(ran, 'tank', (fraction) => setProgress(fraction / 2));
        const raid = runHealerBatch(ran, 'raid', (fraction) => setProgress(0.5 + fraction / 2));
        setState({ status: 'done', batch: tank, profile: ran, healer: { tank, raid } });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, 0);
  }, []);

  /** Put a finished run back on screen as though it had just completed. */
  const restore = useCallback(
    (batch: BatchResult, profile: CharacterProfile, healer?: HealerReports) => {
      setState({ status: 'done', batch, profile, ...(healer ? { healer } : {}) });
      setProgress(1);
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    setProgress(0);
  }, []);

  return { state, progress, run, runHealer, restore, reset };
}
