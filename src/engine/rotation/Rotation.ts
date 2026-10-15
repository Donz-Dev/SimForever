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
  /**
   * Further abilities to cast after this entry's, in order, with nothing
   * allowed in between.
   *
   * ============================================================================
   * THE OWNER'S ASK: "a way to combine abilities into one action, that way it
   * can cause a set sequence to occur. Like 5 combo points is reached + 35
   * energy is reached -> use Cold Blood and then Eviscerate."
   *
   * WHY A PRIORITY LIST CANNOT DO THIS ALREADY. CLAUDE.md records that a
   * sequence is normally what EMERGES when each of its steps is in turn the
   * highest castable entry -- which is true, and stops being true the moment
   * something below is castable in the gap. Cold Blood is free and off the
   * global cooldown, so the instant it goes out the list is re-read from the
   * top and Sinister Strike at 45 energy is affordable: the Eviscerate it was
   * pressed for never happens and a two-minute cooldown is spent on nothing.
   *
   * ABSENT MEANS ONE ABILITY, which is what makes this need no migration and
   * what keeps every existing entry byte-identical -- the rule `disabled`
   * already follows.
   *
   * THE STEPS ARE RESOLVED TOGETHER AND CAST APART. `selectAction` refuses to
   * start one unless every step is castable ignoring the clock, and then casts
   * them one per decision -- the engine casts once per decision and nothing
   * here changes that. An off-GCD first step therefore costs ONE 100ms poll,
   * which is the same price Charge and Bloodrage already pay.
   * ============================================================================
   */
  readonly sequence?: readonly string[];
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
    /*
     * ==========================================================================
     * A SEQUENCE IN PROGRESS OUTRANKS THE LIST, which is the whole of what
     * "combine abilities into one action" means. The owner's example is "5
     * combo points is reached + 35 energy is reached -> use Cold Blood and then
     * Eviscerate", and the thing that makes it a SEQUENCE rather than two
     * entries is that nothing may be cast between the two steps.
     *
     * A PRIORITY LIST CANNOT EXPRESS THAT ON ITS OWN. CLAUDE.md records the
     * Rogue stealth design as three entries that EMERGE as a sequence because
     * each step is in turn the highest castable entry -- and that works only
     * when nothing cheaper sits below them. Cold Blood is free and off the
     * global cooldown, so the moment it is cast the list is re-read from the
     * top and Sinister Strike is affordable: the Eviscerate it was pressed for
     * never happens, and the cooldown is spent on nothing.
     * ==========================================================================
     */
    const resumed = this.resumeSequence(context, actor);
    if (resumed !== 'none') return resumed === 'wait' ? null : resumed;

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

      /*
       * THE WHOLE SEQUENCE IS RESOLVED BEFORE ANY OF IT IS CAST, which is the
       * discipline `resolveCast` and `consumeCastCharges` already split along:
       * work out what will happen, then commit. A sequence half-cast is worse
       * than one not started -- Cold Blood spent with no Eviscerate behind it
       * is a two-minute cooldown thrown away, and nothing reports it.
       */
      if (entry.sequence && entry.sequence.length > 0) {
        if (!this.sequenceIsAffordable(context, actor, entry.sequence, target)) continue;
        actor.pendingSequence = { abilityIds: entry.sequence, index: 0 };
      }

      return { ability, target };
    }
    return null;
  }

  /**
   * The next step of a sequence in progress.
   *
   * ----------------------------------------------------------------------------
   * THREE ANSWERS AND THEY ARE GENUINELY DIFFERENT, which is why this does not
   * just return a decision or null:
   *
   *   a decision   cast the next step
   *   `'wait'`     the step is blocked by the global cooldown ALONE. Do nothing
   *                this tick -- and do NOT fall through to the list, which is
   *                the point: an entry below would fire between the two steps.
   *   `'none'`     there is no sequence, or it has been abandoned. Walk the list.
   *
   * IT ABANDONS RATHER THAN BLOCKING FOREVER. A step that is refused for any
   * reason other than the global cooldown -- the cost went somewhere, a
   * cooldown started, the target died -- clears the pointer and lets the list
   * resume. The alternative is an actor that stops acting for the rest of the
   * fight, which is the worst failure available here and would look like a DPS
   * regression rather than a deadlock.
   * ----------------------------------------------------------------------------
   */
  private resumeSequence(
    context: SimulationContext,
    actor: Combatant,
  ): RotationDecision | 'wait' | 'none' {
    const pending = actor.pendingSequence;
    if (!pending) return 'none';

    const ability = actor.abilities.get(pending.abilityIds[pending.index]);
    const target = context.defaultTargetFor(actor);

    if (ability && context.canCast(actor, ability, target)) {
      // Advance, and drop the pointer on the last step rather than leaving an
      // exhausted sequence to be re-checked on every decision.
      if (pending.index + 1 >= pending.abilityIds.length) actor.pendingSequence = null;
      else pending.index += 1;
      return { ability, target };
    }

    if (ability && context.castRejection(actor, ability, target) === 'on_gcd') return 'wait';

    actor.pendingSequence = null;
    return 'none';
  }

  /**
   * Could every step of this sequence be cast, ignoring the clock?
   *
   * `ignoreGcd` IS THE WHOLE POINT. Every step after the first is on the global
   * cooldown the step before it started, so asking the ordinary question would
   * refuse every sequence that exists. What is being asked is "can the
   * character AFFORD all of this" -- cost, cooldown, stance, target -- and the
   * clock is the one thing a sequence is willing to wait out.
   *
   * IT CANNOT BE EXACT AND DOES NOT CLAIM TO BE. The cost is checked against
   * the pool as it is NOW, and step one may spend some of it -- so a sequence
   * whose steps share a resource can still abandon half-way. That is the
   * honest limit of a check made before anything has happened, and abandoning
   * is what it falls back to.
   */
  private sequenceIsAffordable(
    context: SimulationContext,
    actor: Combatant,
    sequence: readonly string[],
    target: Combatant | undefined,
  ): boolean {
    for (const abilityId of sequence) {
      const ability = actor.abilities.get(abilityId);
      if (!ability) return false;
      if (context.castRejection(actor, ability, target, { ignoreGcd: true }) !== undefined) {
        return false;
      }
    }
    return true;
  }

  /**
   * What is worth interrupting the current channel for.
   *
   * ----------------------------------------------------------------------------
   * IT ASKS WHETHER THE ABILITY WOULD BE CASTABLE IF THE CHANNEL WERE
   * ABANDONED, which is the only question an interrupt decision is really
   * making. `ignoreCastLock` is what asks it: everything else is checked as
   * usual, the GLOBAL COOLDOWN INCLUDED, because cancelling a channel to sit on
   * a running GCD would throw the rest of it away and cast nothing.
   *
   * THIS USED TO READ `already_casting` AS THE ANSWER, AND THAT WAS WRONG.
   * `checkCast` reports ONE reason in a fixed order and the cast lock is
   * checked SECOND -- so an earlier reason hides every later one, and
   * `already_casting` establishes only that the caster is ALIVE. It says
   * nothing about the global cooldown, the ability's own cooldown, its cost or
   * its target, every one of which is checked after it.
   *
   * THE COMMENT THAT WAS HERE REASONED ITSELF INTO THE OPPOSITE: "the cast lock
   * is checked second -- so an entry that comes back `already_casting` is one
   * where NOTHING ELSE is in the way". Checked second means everything else is
   * checked LATER, which is to say not checked at all. Every step of that
   * sentence was true and its conclusion was backwards.
   *
   * WHAT IT COST: a Shadow Priest ticking "interrupt Mind Flay" on Mind Blast
   * cancelled the channel on EVERY poll, including the whole eight seconds Mind
   * Blast spends on cooldown -- Mind Flay went from about 30 ticks a fight to
   * ZERO. The stock Warlock list hid it completely, because all three of its
   * interrupting entries are gated on an aura and none of them has a cooldown:
   * their conditions were doing the work this check was supposed to do.
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
      // Castable but for the channel in progress: cost, cooldown, global
      // cooldown, stance and target all checked, the cast lock alone ignored.
      if (context.castRejection(actor, ability, target, { ignoreCastLock: true }) !== undefined) {
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
