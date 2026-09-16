import type { Combatant, WeaponSlot } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { AttackOutcome } from './attackTable';

/**
 * An attack that has finished resolving, handed to anything reacting to it.
 *
 * A snapshot rather than a live handle: by the time a reaction sees this, the
 * damage has already been applied and the telemetry already emitted. A reaction
 * responds to what happened; it cannot change it.
 */
export interface AttackEvent {
  readonly attacker: Combatant;
  readonly defender: Combatant;
  readonly outcome: AttackOutcome;
  readonly abilityId: string | undefined;
  readonly abilityName: string;
  /** What reached the defender. Zero for a missed, dodged or parried attack. */
  readonly amount: number;
  readonly weaponSlot: WeaponSlot | undefined;
  readonly critical: boolean;
}

/**
 * Which side of an attack a reaction watches.
 *
 * - `dealt` fires on the attacker, for attacks it made
 * - `taken` fires on the defender, for attacks it received
 *
 * Both exist because the two are genuinely different triggers: a Warrior's
 * Overpower keys off the TARGET dodging, while its Revenge keys off the warrior
 * itself avoiding a blow.
 */
export type ReactionTrigger = 'dealt' | 'taken';

/**
 * Something that happens in response to an attack result.
 *
 * The engine resolves attacks and knows nothing about what should follow from
 * one. A reaction is the seam: content declares which outcomes it cares about
 * and what to do, and the engine calls it at the right moment.
 *
 * Reactions live on the combatant, alongside `statDerivation` and
 * `resourceOnDamageTaken`, because they are a property of the character rather
 * than of the fight. The alternative — a single simulation-wide hook that
 * switched on class — would put content knowledge in the engine.
 *
 * Typically a reaction applies an aura that an ability's `canCast` then reads.
 * That keeps the "am I allowed to use this" question in one place, and gives
 * the window a visible lifetime in the combat log for free.
 */
export interface Reaction {
  readonly id: string;
  readonly on: ReactionTrigger;
  /**
   * Outcomes that trigger it. An attack whose outcome is not listed is ignored.
   *
   * Note which outcomes a table can actually produce: `melee-received` yields
   * miss, dodge, parry, crush, crit and hit. There is no `block`, so a reaction
   * that should key off blocking cannot express it yet.
   */
  readonly outcomes: readonly AttackOutcome[];
  /** Extra conditions beyond the outcome. */
  readonly canTrigger?: (
    context: SimulationContext,
    actor: Combatant,
    attack: AttackEvent,
  ) => boolean;
  readonly onTrigger: (
    context: SimulationContext,
    actor: Combatant,
    attack: AttackEvent,
  ) => void;
}

/**
 * Run the reactions an actor has for one attack.
 *
 * Emits no telemetry of its own. A reaction that applies an aura already
 * produces an `aura_applied` event, so the combat log shows the window opening
 * without a second kind of record to keep in step with the first.
 *
 * Re-entrancy is guarded per actor: a reaction that deals damage would come
 * back through the damage pipeline, and without the guard a reaction that
 * triggers on its own outcome would recurse forever. One actor's reactions
 * firing does not stop another's, so a riposte that provokes a counter-riposte
 * still works.
 */
export function runReactions(
  context: SimulationContext,
  actor: Combatant,
  trigger: ReactionTrigger,
  attack: AttackEvent,
): void {
  if (actor.reactions.length === 0) return;
  if (!actor.isAlive) return;
  if (!actor.beginReacting()) return;

  try {
    for (const reaction of actor.reactions) {
      if (reaction.on !== trigger) continue;
      if (!reaction.outcomes.includes(attack.outcome)) continue;
      if (reaction.canTrigger && !reaction.canTrigger(context, actor, attack)) continue;
      reaction.onTrigger(context, actor, attack);
    }
  } finally {
    actor.endReacting();
  }
}
