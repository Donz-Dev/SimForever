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
 * Whether this attack was a USE OF A MELEE WEAPON, which is what a weapon-bound
 * effect triggers from.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET, from the ruleset owner, and it is the whole of the rule:
 *
 *   A "use" of a weapon is a SWING OR AN ABILITY. Anything that goes through a
 *   combat table and needs the weapon to be used counts. An auto-attack is a
 *   use; so are Bloodthirst, Mortal Strike, Rend and Heroic Strike, every one
 *   of which is a "main hand swing" for the purpose of triggering effects.
 *
 *   Thunder Clap is NOT, because it does not require a melee weapon. Neither
 *   are Intercept and Charge. They resolve on the ranged table with
 *   `weaponSlot: 'ranged'`, which is exactly what this function excludes.
 *
 * WHY A SLOT IS ENOUGH TO DECIDE IT. A reaction only ever sees attacks that
 * consulted a combat table and were not periodic -- `dealDamage` will not
 * dispatch any other kind -- so by the time this runs, "went through a combat
 * table" is already true. All that is left to ask is which weapon swung, and
 * an ability that needs no weapon does not name a melee slot.
 *
 * WHY IT IS HERE rather than in `game`. It was a private one-liner in
 * `game/reactions/warriorTalents.ts` and the reactions that live in other
 * files re-derived it -- two of them wrongly. Hand of Justice asked only
 * whether the attack landed, so Thunder Clap procced an extra melee attack;
 * Windfury refused every `abilityId`, so Bloodthirst and Mortal Strike procced
 * nothing. Naming the concept once is the fix for both.
 * ----------------------------------------------------------------------------
 */
export function isWeaponUse(attack: AttackEvent): boolean {
  return attack.weaponSlot === 'mainHand' || attack.weaponSlot === 'offHand';
}

/**
 * Whether this attack was a use of the weapon in ONE PARTICULAR slot.
 *
 * What makes an off-hand enchant an off-hand enchant: a main-hand Crusader is
 * triggered by main-hand uses and by nothing else, and the same weapon in the
 * other hand is a separate effect with a separate roll.
 *
 * WHIRLWIND WITH RAGING BLOWS IS THE CASE THAT SHOWS THE DIFFERENCE. It strikes
 * with both hands, as two attacks, so it is a main-hand use AND an off-hand
 * use: it can trigger main-hand Crusader, off-hand Crusader and Windfury, and
 * Windfury only from the main-hand half.
 */
export function isWeaponUseOf(attack: AttackEvent, slot: WeaponSlot): boolean {
  return isWeaponUse(attack) && attack.weaponSlot === slot;
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
