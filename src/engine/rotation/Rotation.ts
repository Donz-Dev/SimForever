import type { Ability } from '../abilities/Ability';
import type { Combatant } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';

/** The ability an actor has chosen, and what to point it at. */
export interface RotationDecision {
  readonly ability: Ability;
  readonly target: Combatant | undefined;
}

/**
 * Decides what an actor does next.
 *
 * Kept as an interface with a single method so that a hand-written rotation, a
 * data-driven Action Priority List, and a future optimiser that searches for
 * the best sequence are all interchangeable without touching the engine.
 */
export interface Rotation {
  readonly name: string;
  /** The next action, or null if the actor should wait. */
  selectAction(context: SimulationContext, actor: Combatant): RotationDecision | null;
}

/** One line of a priority list. */
export interface PriorityEntry {
  readonly abilityId: string;
  /**
   * Extra condition on top of the engine's own castability checks. Use for
   * rotation logic ("only when the debuff has under 3 seconds left"), not for
   * things the engine already knows ("only when off cooldown").
   */
  readonly condition?: (context: SimulationContext, actor: Combatant, target: Combatant | undefined) => boolean;
  /** Overrides the actor's default target for this entry. */
  readonly selectTarget?: (context: SimulationContext, actor: Combatant) => Combatant | undefined;
}

/**
 * An Action Priority List: walk the entries top to bottom and use the first
 * ability that is castable right now.
 *
 * This is how SimulationCraft and most sim tools express a rotation, and it is
 * a good fit for WoW because real rotations genuinely are priority lists rather
 * than fixed sequences.
 */
export class PriorityRotation implements Rotation {
  constructor(
    readonly name: string,
    private readonly entries: readonly PriorityEntry[],
  ) {}

  selectAction(context: SimulationContext, actor: Combatant): RotationDecision | null {
    for (const entry of this.entries) {
      const ability = actor.abilities.get(entry.abilityId);
      if (!ability) continue;

      const target = entry.selectTarget
        ? entry.selectTarget(context, actor)
        : context.defaultTargetFor(actor);

      if (entry.condition && !entry.condition(context, actor, target)) continue;
      if (!context.canCast(actor, ability, target)) continue;

      return { ability, target };
    }
    return null;
  }
}
