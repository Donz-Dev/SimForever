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

      if (!context.canCast(actor, ability, target)) {
        /*
         * STANCE DANCING. The one rejection worth acting on rather than
         * skipping past: everything else means "not now", while the wrong
         * stance means "not yet, and here is how".
         *
         * A warrior cannot be in Battle Stance and cast Revenge, which needs
         * Defensive. Without this the rotation would silently skip every
         * ability outside its opening stance -- Whirlwind, Recklessness and
         * Revenge all fell out of the list the moment gating was implemented,
         * which reads as those abilities being bad rather than unreachable.
         *
         * Only for an ability the actor could otherwise cast RIGHT NOW: the
         * swap is checked against the rest of the ability's requirements first,
         * so a rotation never burns a stance change reaching for something it
         * cannot afford anyway.
         */
        const swap = this.stanceSwapFor(context, actor, ability, target);
        if (swap) return { ability: swap, target: undefined };
        continue;
      }

      return { ability, target };
    }
    return null;
  }

  /**
   * The stance-change ability that would unblock `ability`, or null.
   *
   * Returns null unless the WRONG STANCE is the only thing in the way, which is
   * what stops a rotation thrashing between stances for an ability it is too
   * poor to cast.
   */
  private stanceSwapFor(
    context: SimulationContext,
    actor: Combatant,
    ability: Ability,
    target: Combatant | undefined,
  ): Ability | undefined {
    if (!ability.stances || ability.stances.length === 0) return undefined;
    if (ability.stances.some((id) => actor.auras.has(id))) return undefined;

    const blocked = context.castRejection(actor, ability, target);
    if (blocked !== 'wrong_stance') return undefined;

    for (const stanceId of ability.stances) {
      const swap = actor.abilities.all.find((a: Ability) => a.grantsStance === stanceId);
      if (swap && context.canCast(actor, swap, undefined)) return swap;
    }
    return undefined;
  }
}
