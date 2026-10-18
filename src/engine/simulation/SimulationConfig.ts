import type { Combatant } from '../actors/Combatant';
import type { ThreatRules } from '../combat/threat';
import type { AttackChanceProvider } from '../combat/attackTable';
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
   * Supplies miss, dodge, parry, glance and crit chances for the combat tables.
   *
   * Defaults to `defaultAttackChances`, which only rolls crit. Real rulesets
   * pass their own; the numbers are content, not engine.
   */
  readonly attackChances?: AttackChanceProvider;

  /**
   * The constant K in a spell's average resisted share, `|R| / (|R| + K)`,
   * for a caster of the given level. See `engine/combat/spellResistance.ts`.
   *
   * ABSENT MEANS RESISTANCE IS OFF: no hit is resisted and no random number
   * is drawn for it, which is what every engine test that builds a fight by
   * hand wants. The ruleset passes its own.
   */
  readonly spellResistanceConstant?: (casterLevel: number) => number;

  /**
   * The ruleset's threat numbers. ABSENT MEANS THREAT IS NOT TRACKED and no
   * threat event is emitted; see `engine/combat/threat.ts`.
   */
  readonly threatRules?: ThreatRules;

  /**
   * Runs once at time 0, after combatants exist and before any event fires.
   * Use for opening buffs, pre-pull cooldowns and encounter setup.
   */
  readonly onCombatStart?: (context: SimulationContext) => void;

  /**
   * Runs at time 0, AFTER the opening auras and BEFORE anything swings.
   *
   * ============================================================================
   * FOR WHAT THE CHARACTER DID BEFORE THE PULL -- a stance, a form, Stealth, a
   * pre-cast spell. See `runPrecombat`.
   *
   * A SECOND HOOK RATHER THAN `onCombatStart`, AND THE ORDER IS THE WHOLE
   * REASON. `onCombatStart` runs BEFORE the `openingAuras` loop, which is where
   * a Warrior's stance and a Druid's form are applied -- so a pre-combat action
   * fired there would be acting on a character that is not yet in its stance,
   * and Overpower's gate would refuse it. This runs after, so the character the
   * pre-pull sees is the character the first swing sees.
   *
   * AND BEFORE AUTO-ATTACK, so a pre-cast spell does not throw away a swing
   * that has already been scheduled -- which a pre-combat cast must not do, and
   * is the other half of why it is not just an ordinary cast at time 0.
   * ============================================================================
   */
  readonly onPrecombat?: (context: SimulationContext) => void;
}
