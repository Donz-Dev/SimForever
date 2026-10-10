import type { Combatant, PriorityEntry, SimulationContext } from '../../../engine';
import { PriorityRotation } from '../../../engine';
import { comboPointsOn } from '../../combat/comboPoints';
import type { AplCompare, AplCondition, AplEntry, AplList } from './AplCondition';
import { builtinCondition } from './builtins';

/** The shape `PriorityEntry.condition` has. */
type Condition = (
  context: SimulationContext,
  actor: Combatant,
  target: Combatant | undefined,
) => boolean;

/**
 * Turn a list written as data into the rotation the engine runs.
 *
 * ----------------------------------------------------------------------------
 * COMPILED ONCE, WHEN THE CHARACTER IS BUILT, so the cost is paid per fight
 * rather than per decision -- a condition is consulted every global cooldown
 * by every actor, and walking a tree of plain objects there would be the one
 * place this representation could cost something.
 *
 * EVERY COMPARISON HERE MIRRORS THE NINE CLASS FILES EXACTLY, including which
 * of `<` and `<=` each one wrote. That is the whole correctness requirement of
 * this file: a list that compiles to a different closure makes different
 * decisions, and a rotation that makes slightly different decisions produces a
 * perfectly ordinary DPS figure. `tools/rotation_fingerprint.ts` is what says
 * it did not -- it hashes the combat log, so one changed decision anywhere
 * moves it.
 * ----------------------------------------------------------------------------
 */
export function compileRotation(list: AplList): PriorityRotation {
  /*
   * A SWITCHED-OFF ENTRY NEVER REACHES THE ROTATION AT ALL, which is the only
   * place this can be honoured safely.
   *
   * --------------------------------------------------------------------------
   * NOT A CHECK INSIDE `selectAction`, which is the obvious alternative and is
   * worse in two ways: it would ask the question on every entry of every
   * decision for a flag almost nothing sets, and `PriorityRotation` computes
   * `interruptsChannels` from its entries ONCE in the constructor -- so a
   * disabled interrupting entry would still make the actor poll its channel
   * every 100ms. That is the cost `Rotation.interruptsChannels` exists to
   * avoid, and it is invisible: the combat log is byte-identical and only
   * `eventsProcessed` moves, which is how the same mistake was found before.
   *
   * Filtering here means the rotation is built as though the entry were not
   * there, which is exactly what switching it off is supposed to mean.
   * --------------------------------------------------------------------------
   */
  const live = list.entries.filter((entry) => entry.disabled !== true);
  return new PriorityRotation(list.name, live.map(compileEntry));
}

export function compileEntry(entry: AplEntry): PriorityEntry {
  return {
    abilityId: entry.abilityId,
    ...(entry.condition ? { condition: compileCondition(entry.condition) } : {}),
    ...(entry.interruptsChannel ? { interruptsChannel: true } : {}),
  };
}

/** Apply a comparison. `below` and `above` are STRICT; see `AplCompare`. */
function compare(value: number, how: AplCompare, against: number): boolean {
  switch (how) {
    case 'atLeast':
      return value >= against;
    case 'atMost':
      return value <= against;
    case 'exactly':
      return value === against;
    case 'below':
      return value < against;
    case 'above':
      return value > against;
  }
}

/**
 * The actor a subject names, or undefined.
 *
 * A PET IS FOUND BY LOOKING BACK, which is how the Hunter's Bestial Wrath
 * entry already worked: a pet names its owner through `ownerId`, so the owner
 * finds it among the friendly actors that point at them. It is the only thing
 * in any list that reads across combatants.
 */
function subjectOf(
  on: 'self' | 'target' | 'pet',
  context: SimulationContext,
  actor: Combatant,
  target: Combatant | undefined,
): Combatant | undefined {
  if (on === 'self') return actor;
  if (on === 'target') return target;
  /*
   * `isAlive` AND NOT `kind === 'pet'`, which is what the Hunter's own helper
   * wrote and what this first got wrong. The two differ on a dead pet: the
   * narrower test would find it and report its auras, and Bestial Wrath would
   * be spent feeding a corpse's Frenzy.
   */
  return context.combatants.find(
    (combatant) => combatant.ownerId === actor.id && combatant.isAlive,
  );
}

export function compileCondition(condition: AplCondition): Condition {
  switch (condition.kind) {
    case 'all': {
      const parts = condition.of.map(compileCondition);
      return (context, actor, target) => parts.every((part) => part(context, actor, target));
    }
    case 'any': {
      const parts = condition.of.map(compileCondition);
      return (context, actor, target) => parts.some((part) => part(context, actor, target));
    }
    case 'not': {
      const part = compileCondition(condition.of);
      return (context, actor, target) => !part(context, actor, target);
    }

    case 'aura': {
      const { on, auraId, present } = condition;
      return (context, actor, target) => {
        const subject = subjectOf(on, context, actor, target);
        // An absent subject is FALSE whichever way `present` points: "the
        // target does not have Rend" is not satisfied by there being no target.
        if (!subject) return false;
        return subject.auras.has(auraId) === present;
      };
    }

    case 'auraTime': {
      const { on, auraId, compare: how, seconds } = condition;
      const milliseconds = seconds * 1000;
      return (context, actor, target) => {
        const subject = on === 'self' ? actor : target;
        if (!subject) return false;
        return compare(subject.auras.remainingMs(auraId, context.clock.now()), how, milliseconds);
      };
    }

    case 'auraStacks': {
      const { on, auraId, compare: how, stacks } = condition;
      return (_context, actor, target) => {
        const subject = on === 'self' ? actor : target;
        if (!subject) return false;
        return compare(subject.auras.stacksOf(auraId), how, stacks);
      };
    }

    case 'resource': {
      const { resource, compare: how, amount } = condition;
      // A pool the class does not have reads as zero, which is what every
      // class file's `?? 0` already did.
      return (_context, actor) =>
        compare(actor.resources.get(resource)?.current ?? 0, how, amount);
    }

    case 'resourceFraction': {
      const { resource, compare: how, fraction } = condition;
      return (_context, actor) => {
        const pool = actor.resources.get(resource);
        // No pool, or a pool with no maximum, is not "at 0%" -- it is a
        // question that does not apply, and false is the safe answer for both
        // directions of `compare`.
        if (!pool || pool.maximum <= 0) return false;
        return compare(pool.current / pool.maximum, how, fraction);
      };
    }

    case 'comboPoints': {
      const { compare: how, points } = condition;
      return (_context, actor, target) => compare(comboPointsOn(actor, target), how, points);
    }

    case 'cooldown': {
      const { abilityId, state } = condition;
      return (context, actor) => {
        /*
         * AN ABILITY THE BUILD DOES NOT HAVE IS NEITHER READY NOR ON COOLDOWN,
         * so both states are false for one. That is the Rogue's own helper and
         * NOT the Paladin's, and the two genuinely disagree: `chargesAvailable`
         * returns 0 for an absent ability, so `isReady` is false, so the
         * Paladin's unguarded `!isReady` reported an ability it never learned
         * as ON COOLDOWN -- permanently, which would hold an entry shut for a
         * whole fight.
         *
         * BOTH READINGS SURVIVE ANYWAY, because `not` distinguishes them:
         * `{ state: 'onCooldown' }` is the Rogue's (absent -> false) and
         * `not({ state: 'ready' })` is the Paladin's (absent -> true). The
         * conversion uses whichever its class file wrote, so no list changed
         * behaviour -- and a list written in the panel gets the guarded one,
         * which is the reading somebody picking from a dropdown means.
         */
        if (!actor.abilities.has(abilityId)) return false;
        const ready = actor.abilities.isReady(abilityId, context.clock.now());
        return state === 'ready' ? ready : !ready;
      };
    }

    case 'fightRemaining': {
      const { compare: how, seconds, fraction } = condition;
      return (context) => {
        const remaining = context.plannedDurationMs - context.clock.now();
        const against =
          fraction !== undefined ? context.plannedDurationMs * fraction : (seconds ?? 0) * 1000;
        return compare(remaining, how, against);
      };
    }

    case 'fightElapsed': {
      const { compare: how, seconds } = condition;
      const milliseconds = seconds * 1000;
      return (context) => compare(context.clock.now(), how, milliseconds);
    }

    case 'health': {
      const { on, compare: how, fraction } = condition;
      return (context, actor, target) => {
        const subject = subjectOf(on, context, actor, target);
        if (!subject || subject.health.maximum <= 0) return false;
        return compare(subject.health.current / subject.health.maximum, how, fraction);
      };
    }

    case 'swingIn': {
      const { slot, compare: how, milliseconds } = condition;
      return (context, actor) => {
        /*
         * AN IDLE SLOT IS ZERO, matching the Warrior's own helper. Read off the
         * PENDING SWING's scheduled timestamp rather than computed from the
         * weapon's speed, which is the only thing that actually knows: haste,
         * an extra attack and a cast that reset the timer all move it.
         */
        const pending = actor.pendingSwing(slot);
        const due = !pending || pending.cancelled
          ? 0
          : Math.max(0, pending.timestamp - context.clock.now());
        return compare(due, how, milliseconds);
      };
    }

    case 'swungWithin': {
      const { slot, withinMs } = condition;
      return (context, actor) => actor.swungWithin(slot, context.clock.now(), withinMs);
    }

    case 'hasReaction': {
      const { reactionId } = condition;
      return (_context, actor) => actor.reactions.some((reaction) => reaction.id === reactionId);
    }

    case 'castsInstantly': {
      const { abilityId } = condition;
      return (_context, actor) => (actor.abilities.get(abilityId)?.castTimeMs ?? 0) <= 0;
    }

    case 'builtin':
      return builtinCondition(condition.id, condition.args ?? []);
  }
}
