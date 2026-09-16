import type { Combatant } from '../actors/Combatant';
import type { Milliseconds } from '../time';
import type { SimulationContext } from './SimulationContext';

/**
 * Everything needed to run one fight.
 *
 * `createCombatants` is a factory rather than a ready-made array because a
 * Monte Carlo batch runs the same config thousands of times and every
 * iteration needs its own untouched combatants. Passing objects instead would
 * mean iteration 2 starting with iteration 1's spent resources and dead boss.
 */
export interface SimulationConfig {
  /** Fight length before variance. */
  readonly durationMs: Milliseconds;

  /** Seed for this run. The same seed and config always produce the same fight. */
  readonly seed: number;

  /**
   * Randomises the fight length by this fraction either side of `durationMs`.
   * 0.1 means the fight lasts between 90% and 110% of the nominal duration.
   *
   * Real encounters do not end at an exact time, and cooldown alignment is very
   * sensitive to fight length, so a fixed duration makes some abilities look
   * better than they are. Defaults to 0.
   */
  readonly durationVariance?: number;

  /** Builds a fresh set of combatants for one iteration. */
  readonly createCombatants: () => Combatant[];

  /**
   * Runs once at time 0, after combatants exist and before any event fires.
   * Use for opening buffs, pre-pull cooldowns and encounter setup.
   */
  readonly onCombatStart?: (context: SimulationContext) => void;
}
