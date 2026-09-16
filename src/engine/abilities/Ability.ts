import type { Combatant } from '../actors/Combatant';
import type { AttackTableKind } from '../combat/attackTable';
import type { ResourceType } from '../resources';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';

/** The default global cooldown before haste. */
export const DEFAULT_GCD_MS = 1500;

/** The floor a hasted global cooldown cannot go below. */
export const MINIMUM_GCD_MS = 750;

/** What an ability costs to use. */
export interface AbilityCost {
  readonly resource: ResourceType;
  readonly amount: number;
}

/** Everything an ability needs in order to decide and to act. */
export interface AbilityContext {
  readonly simulation: SimulationContext;
  readonly caster: Combatant;
  readonly target: Combatant | undefined;
  /** The ability being cast, so `onCast` can read its own declared values. */
  readonly ability: Ability;
}

/**
 * A spell or ability.
 *
 * The engine owns the parts that are the same for every ability in the game:
 * cooldowns, charges, the global cooldown, cast time, resource costs, and
 * target validity. An ability definition only supplies what is unique to it,
 * in `onCast`.
 *
 * That split is what keeps a spell from turning into a copy-pasted block of
 * cooldown bookkeeping. Definitions are content and live under `src/game`.
 */
export interface Ability {
  readonly id: string;
  readonly name: string;

  /** Time to cast. 0 (the default) means instant. */
  readonly castTimeMs?: Milliseconds;
  /** Time before it can be used again. 0 (the default) means no cooldown. */
  readonly cooldownMs?: Milliseconds;
  /** Number of independent charges. Defaults to 1. */
  readonly charges?: number;
  /** Whether using it starts the global cooldown. Defaults to true. */
  readonly triggersGcd?: boolean;
  /** Override the global cooldown length. Defaults to DEFAULT_GCD_MS. */
  readonly gcdMs?: Milliseconds;
  /** Whether haste shortens the cast time and GCD. Defaults to true. */
  readonly affectedByHaste?: boolean;
  readonly cost?: AbilityCost;
  /** Whether a living hostile target is required. Defaults to true. */
  readonly requiresTarget?: boolean;

  /**
   * Which combat table this ability resolves against.
   *
   * Mortal Strike and Rend are `melee-special`; Multi-Shot is
   * `ranged-special`; Fireball and Shadow Word: Pain are `spell`. Even an
   * ability that deals no direct damage declares one, because its table decides
   * whether it lands at all.
   *
   * Read inside `onCast` through `context.ability`, so the table is declared
   * once rather than repeated in every damage call.
   */
  readonly attackTable?: AttackTableKind;

  /**
   * Extra conditions beyond cooldown, cost and target, which the engine
   * already checks. Use for things like "only below 20% health".
   */
  readonly canCast?: (context: AbilityContext) => boolean;

  /**
   * What the ability actually does: deal damage, apply an aura, generate a
   * resource. Runs when the cast completes, which is immediately for an
   * instant ability.
   */
  readonly onCast: (context: AbilityContext) => void;
}
