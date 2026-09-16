import type { SimulationConfig } from '../engine';
import { Simulation } from '../engine';
import type { SimulationResult } from '../analysis';
import { buildSimulationResult } from '../analysis';
import { trainingDummyEncounter } from './trainingDummyEncounter';
import type { CharacterProfile } from '../profiles';

/**
 * Run one fight and analyse it.
 *
 * This is the whole public API for a single simulation, and it is two lines:
 * the engine produces an event stream, the analysis layer interprets it. The
 * UI never sees either half on its own.
 */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const simulation = new Simulation(config);
  return buildSimulationResult(simulation.run());
}

/** Run one fight described by a character profile. */
export function runProfile(
  profile: CharacterProfile,
  seed: number = profile.simulation.seed,
): SimulationResult {
  return runSimulation(trainingDummyEncounter(profile, seed));
}
