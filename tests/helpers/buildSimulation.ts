import type { Combatant, SimulationConfig } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';

/**
 * Build a simulation around a fixed set of combatants.
 *
 * Tests construct their combatants directly and hand them over, rather than
 * going through game content, so a test of the aura system fails only when the
 * aura system is broken.
 */
export function buildSimulation(
  combatants: Combatant[],
  overrides: Partial<SimulationConfig> = {},
  /** A sink, for a test that needs to read the event stream. */
  sink?: ConstructorParameters<typeof Simulation>[1],
): Simulation {
  const config: SimulationConfig = {
    durationMs: seconds(60),
    seed: 1,
    createCombatants: () => combatants,
    ...overrides,
  };
  return new Simulation(config, sink);
}
