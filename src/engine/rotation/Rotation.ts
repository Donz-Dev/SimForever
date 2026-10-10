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
  /**
   * The action worth CANCELLING an interruptible channel for, or null.
   *
   * Optional, so a rotation that does not express interrupts needs no change.
   * Consulted only while the actor is channelling something that declares
   * itself interruptible.
   */
  selectInterrupt?(context: SimulationContext, actor: Combatant): RotationDecision | null;
  /**
   * Whether anything in this rotation would ever cancel a channel.
   *
   * ----------------------------------------------------------------------------
   * IT EXISTS TO STOP THE ENGINE POLLING FOR NOTHING. An interruptible channel
   * wakes its actor every `ROTATION_POLL_MS` instead of sleeping to the end,
   * because the one moment it would otherwise wake is the moment the channel
   * has already finished. That is the right trade when something might
   * interrupt and pure waste when nothing can -- marking Arcane Missiles and
   * Mind Flay interruptible, with no entry asking to interrupt them, cost the
   * Arcane Mage 13% more events a fight and the Shadow Priest 25%, for an
   * IDENTICAL combat log.
   *
   * A ROTATION THAT DOES NOT SAY IS ASSUMED TO INTERRUPT, which is the safe
   * default: a rotation that wanted to and failed to declare it would silently
   * stop interrupting, where one that says nothing merely polls.
   * ----------------------------------------------------------------------------
   */
  readonly interruptsChannels?: boolean;
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
  /**
   * Whether this entry may CANCEL an interruptible channel in progress.
   *
   * ----------------------------------------------------------------------------
   * BOTH HALVES HAVE TO AGREE. The channel declares `interruptibleChannel` and
   * the entry declares this, and nothing is cancelled unless both are true --
   * so adding an urgent entry to a list does not silently start cutting
   * channels short, and marking a channel interruptible does not put it at the
   * mercy of every entry above it.
   *
   * IT IS NOT "EVERY ENTRY ABOVE THE CHANNEL", which was the tempting
   * shortcut. The ruleset owner named three cases for Wrack -- a Shadow Bolt
   * because Nightfall procced, a Corruption because Corruption fell off, a
   * Bane of Agony because the Bane fell off -- and Siphon Life and Life Tap sit
   * above Wrack in that same list and are NOT among them. A positional rule
   * would have been right about three entries and wrong about two, and the two
   * it was wrong about would have cost channel time to refresh a bleed that was
   * not about to drop.
   * ----------------------------------------------------------------------------
   */
  readonly interruptsChannel?: boolean;
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
  /**
   * Computed once, because it cannot change: the entries are fixed when the
   * character is built, and this is read on every decision an interruptible
   * channel makes.
   */
  readonly interruptsChannels: boolean;

  constructor(
    readonly name: string,
    private readonly entries: readonly PriorityEntry[],
  ) {
    this.interruptsChannels = entries.some((entry) => entry.interruptsChannel === true);
  }

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
   * What is worth interrupting the current channel for.
   *
   * ----------------------------------------------------------------------------
   * `already_casting` IS THE WHOLE TRICK. `checkCast` reports exactly one
   * reason, in a fixed order, and the cast lock is checked second -- so an
   * entry that comes back `already_casting` is one where NOTHING ELSE is in the
   * way: it is affordable, off cooldown, in the right stance and its condition
   * is satisfied. Cancelling the channel is therefore guaranteed to be followed
   * by the cast that justified it.
   *
   * THAT MATTERS BECAUSE THE ALTERNATIVE SILENTLY WASTES THE CHANNEL. Cancelling
   * first and asking afterwards would throw away the remaining ticks whenever
   * the urgent ability turned out to be unaffordable -- a Corruption that has
   * expired while the Warlock is out of mana would cut Wrack short and cast
   * nothing. This is the same shape the stance swap below uses, for the same
   * reason: one rejection reason is actionable and the rest mean "not now".
   * ----------------------------------------------------------------------------
   */
  selectInterrupt(context: SimulationContext, actor: Combatant): RotationDecision | null {
    for (const entry of this.entries) {
      if (!entry.interruptsChannel) continue;

      const ability = actor.abilities.get(entry.abilityId);
      if (!ability) continue;

      const target = entry.selectTarget
        ? entry.selectTarget(context, actor)
        : context.defaultTargetFor(actor);

      if (entry.condition && !entry.condition(context, actor, target)) continue;

      // Everything except the cast lock has to be satisfied already.
      if (context.castRejection(actor, ability, target) !== 'already_casting') continue;

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
