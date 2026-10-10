import type { Ability } from '../abilities/Ability';
import type { ResourceType } from '../resources/Resource';
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
export function isWeaponUseOf(attack: AttackEvent, slot: MeleeWeaponSlot): boolean {
  return isWeaponUse(attack) && attack.weaponSlot === slot;
}

/**
 * THE SLOTS `isWeaponUseOf` CAN HONESTLY ANSWER FOR, which is not every slot.
 *
 * ------------------------------------------------------------------------------
 * `isWeaponUse` MEANS "A USE OF A MELEE WEAPON", so `isWeaponUseOf(attack,
 * 'ranged')` was `(mainHand || offHand) && ranged` -- ALWAYS FALSE, for every
 * attack, forever. It compiled, it read as the obvious thing to write, and the
 * Hunter's Deadly Aspects asked it on every Auto Shot: 403 ranged swings over
 * twenty fights produced ZERO procs of a talent whose stated chance is 10%.
 *
 * NARROWING THE PARAMETER IS THE FIX RATHER THAN WIDENING THE PREDICATE. The
 * melee meaning is load-bearing -- Thunder Clap, Intercept and Charge declare
 * `weaponSlot: 'ranged'` precisely so `isWeaponUse` excludes them, and a
 * Warrior's weapon procs depend on it. So the type now refuses the question
 * instead of answering it wrongly, and a caller that wants a ranged auto-attack
 * tests the slot directly.
 * ------------------------------------------------------------------------------
 */
export type MeleeWeaponSlot = 'mainHand' | 'offHand';

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
export type ReactionTrigger =
  | 'dealt'
  | 'taken'
  /**
   * Damage this combatant dealt WITH A PERIODIC TICK.
   *
   * ----------------------------------------------------------------------------
   * `dealt` DELIBERATELY EXCLUDES A TICK, AND THAT IS NOT CHANGING. `dealDamage`
   * runs `dealt` and `taken` only for damage that consulted a combat table and
   * is not periodic -- "a bleed ticking is not an attack anyone parries" -- and
   * every one of the project's reactions is written against that. Widening
   * `dealt` would hand Flurry, Blood Craze, Reckoning, Seal Fate and forty
   * others a stream of events they have never seen.
   *
   * So a tick gets its own trigger, and a reaction has to ASK for it. Nothing
   * that exists today declares this, so adding it changes no behaviour at all --
   * which is what made it safe to add for one caller.
   *
   * THE ONE CALLER IS TOUCH OF THE GRAVE, and it is the owner's ruling that
   * created the need: DoTs and channels may proc it "only on cast not each
   * tick", with two named exceptions, and one of them -- Consecration -- is a
   * ground effect whose cast deals nothing at all. Through `dealt` it could
   * never have procced, so the exception would have been silently absent on a
   * racial whose every other clause was implemented.
   *
   * ITS `outcome` IS SYNTHESISED, because a tick never rolled a table: `crit`
   * when the tick critically struck and `hit` otherwise. A tick's LANDING was
   * settled when the aura went on, so "it landed" is the honest outcome, and it
   * keeps `Reaction.outcomes` meaning one thing across all three triggers.
   * ----------------------------------------------------------------------------
   */
  | 'periodicDealt';

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
   * ----------------------------------------------------------------------------
   * `melee-received` PRODUCES `block`, AND THIS COMMENT USED TO SAY IT DID NOT.
   * It listed "miss, dodge, parry, crush, crit and hit" and concluded that a
   * reaction keying off blocking "cannot express it yet" -- and `TABLES` in
   * `attackTable.ts` has had `block` in that table's first roll since it was
   * written, `runReactions` filters on nothing but this list, and the Warrior's
   * own Shield Specialization, Revenge, Enrage and Blood Craze all name `block`
   * and all fire.
   *
   * IT COST THE PALADIN TWO CLAUSES AND THE PROJECT A DOCUMENTED RULE. Holy
   * Shield's "221 Holy damage for each attack blocked" and Reckoning's "extra
   * attack after Blocking" were both written off against it, the reasons quoted
   * this sentence, and CLAUDE.md carried it as design. A block IS a landed
   * outcome a reaction can see; what it is NOT is an avoided one, which is the
   * true half of the rule and the only half `AVOIDED_OUTCOMES` claims.
   * ----------------------------------------------------------------------------
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
/**
 * A cast that has finished, handed to anything reacting to it.
 *
 * ----------------------------------------------------------------------------
 * NAMED `AbilityCastEvent` because `CastEvent` is already a telemetry line.
 * The two are easy to confuse and mean different things: one is what was
 * logged, this is what a reaction is offered.
 *
 * A SEPARATE TYPE FROM `AttackEvent`, AND A SEPARATE LIST, because a cast is
 * not an attack and sharing one would make every existing reaction narrow a
 * union it does not care about. The two triggers answer different questions:
 * "something was hit" and "something was used".
 *
 * `spent` IS MEASURED, NOT DECLARED. The engine snapshots every resource pool
 * before the ability runs and again after, and reports the difference -- so it
 * covers the declared `cost` AND anything the ability drained itself. Execute
 * emptying the rage bar and a Rogue finisher emptying its combo points are the
 * same shape to this, and neither has to remember to announce it.
 *
 * WHY THAT MATTERS: four Rogue talents key off "a finisher was cast and spent
 * N combo points", and a finisher spends them inside its own `onCast`. Asking
 * abilities to report what they spent would have put the burden on every
 * ability to get right, and the one that forgot would be silently inert.
 * ----------------------------------------------------------------------------
 */
export interface AbilityCastEvent {
  readonly caster: Combatant;
  readonly target: Combatant | undefined;
  readonly ability: Ability;
  /** What the pools lost across the cast, by resource. Absent means nothing. */
  readonly spent: Readonly<Partial<Record<ResourceType, number>>>;
  /**
   * Whether this is the LAST effect this cast will produce.
   *
   * ----------------------------------------------------------------------------
   * TRUE FOR EVERY CAST BUT THE EARLY TICKS OF A CHANNEL. `runCast` runs once
   * per `channelTicks`, so a cast reaction on an Arcane Missiles channel fires
   * five times -- and a reaction that ENDS something has to fire on the last
   * one, or it ends it before the spell has finished happening.
   *
   * ARCANE BLAST IS WHY. Its stacks last "8 sec or until any other damage
   * spell is cast", and the only reading where the damage clause does any work
   * at all is that the other spell BENEFITS and then the stacks go. Removing
   * them on the first missile would leave four of five unbuffed, which is a
   * smaller number and no error -- and it would quietly contradict the owner's
   * own Arcane list, which spends the stacks INTO a Missiles channel.
   *
   * IT IS NOT `castEndsAt === 0`, though that is true at the same moments.
   * Resting a ruleset reading on a field the engine happens to clear one line
   * earlier is the kind of coupling that survives until somebody reorders two
   * statements, and then fails silently.
   * ----------------------------------------------------------------------------
   */
  readonly final: boolean;
}

/** Something that happens in response to an ability being used. */
export interface CastReaction {
  readonly id: string;
  /** Only this ability, when given. Otherwise every cast. */
  readonly abilityId?: string;
  readonly canTrigger?: (
    context: SimulationContext,
    actor: Combatant,
    cast: AbilityCastEvent,
  ) => boolean;
  readonly onTrigger: (context: SimulationContext, actor: Combatant, cast: AbilityCastEvent) => void;
}

/**
 * Offer a finished cast to the caster's cast reactions.
 *
 * Guarded by the same re-entry flag attack reactions use: a reaction that
 * grants a resource must not be able to provoke itself.
 */
export function runCastReactions(
  context: SimulationContext,
  actor: Combatant,
  cast: AbilityCastEvent,
): void {
  if (actor.castReactions.length === 0) return;
  if (!actor.isAlive) return;
  if (!actor.beginReacting()) return;

  try {
    for (const reaction of actor.castReactions) {
      if (reaction.abilityId !== undefined && reaction.abilityId !== cast.ability.id) continue;
      if (reaction.canTrigger && !reaction.canTrigger(context, actor, cast)) continue;
      reaction.onTrigger(context, actor, cast);
    }
  } finally {
    actor.endReacting();
  }
}

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
