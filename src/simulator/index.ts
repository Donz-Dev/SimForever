/**
 * The facade the rest of the application uses.
 *
 * The engine produces events and the analysis layer interprets them; neither
 * knows about the other. This module is the only place the two are wired
 * together, which is why the UI imports from here and never from `src/engine`
 * directly.
 *
 * It is also the seam where the implementation can change without anything
 * above noticing: running iterations in Web Workers, or posting them to a
 * server, replaces the inside of these functions and nothing else.
 */
export type { BatchOptions, BatchResult } from './runBatch';
export { runBatch, runProfileBatch } from './runBatch';
export { runProfile, runSimulation } from './runSimulation';
export { FIGHT_DURATION_VARIANCE } from './trainingDummyEncounter';
