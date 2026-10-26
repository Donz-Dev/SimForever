import type { Combatant } from '../actors/Combatant';
import type { AuraInstance } from '../effects/Aura';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';
import type { Ability } from './Ability';
import { spreadsEffectAcrossCast } from './channelled';
import { resolveCast } from './castModifiers';
import { castAbility, castHasteFor, castLength } from './casting';

/**
 * Something the character did before the pull.
 *
 * ==============================================================================
 * THE OWNER'S ASK: "a way to capture pre-combat events a character can do.
 * Things like swapping into berserker stance, shadow form, cat form, going
 * stealth, pre-casting a spell... these events would happen at an amount of
 * time set by the user. 'Use Stealth <= 2 sec before combat initiates', 'Cast
 * Fireball <= 2.5 sec before combat initiates'."
 *
 * THE LEAD TIME IS REAL, ON THE OWNER'S RULING, and it is the whole design
 * decision here. The alternative offered was that the figure is only a
 * feasibility budget and everything lands fresh at t=0; they chose "buffs and
 * cooldowns are already N sec old at the pull".
 *
 * SO IT HAS EXACTLY TWO OBSERVABLE CONSEQUENCES and this file produces both:
 *
 *   an AURA it applied     has N seconds less left at the pull
 *   its own COOLDOWN       comes back N seconds sooner
 *
 * and a third thing that is NOT a consequence: the damage. A pre-cast Fireball
 * lands at t=0 rather than before it, which is the owner's own example and is
 * the only reading that can be simulated at all -- there is no negative time
 * for it to land in, and a fight that began before it started would be a
 * different fight.
 *
 * WHY NOT A NEGATIVE CLOCK, which is the obvious alternative. `SimulationClock`
 * only moves forward and every scheduled event, every swing timer and every
 * aura window is expressed against it; rebasing the whole fight to start at
 * -2500 would touch all of them to buy exactly the two adjustments above.
 * ==============================================================================
 */
export interface PrecombatAction {
  readonly abilityId: string;
  /**
   * How long before the pull the character STARTED this action.
   *
   * THE OWNER WROTE IT AS "<= 2 sec", which is a budget rather than an exact
   * moment -- the action is taken AT MOST this long before combat. It is read
   * as the exact figure, because "at most" has no other number in it to use
   * and the two readings differ only in how a person says it.
   *
   * ==========================================================================
   * STARTED, NOT FINISHED, AND FOR AN INSTANT THOSE ARE THE SAME MOMENT.
   *
   * The distinction only exists for an ability with a CAST TIME, and the owner
   * drew it themselves in the words they specified all 28 openers with: an
   * instant is "3s before Battle Stance" and a cast is "**2.5s before start
   * casting** Frostfire Bolt". Every one of the ten "start casting" leads they
   * gave is exactly that spell's cast time on that build:
   *
   *     Wrath 1.5    Arcane Blast 1.5    Mind Blast 1.5    Lightning Bolt 2
   *     Aimed Shot 2    Incinerate 2    Frostfire Bolt 2.5    Fireball 3
   *     Sniper Shot 4    Shadow Bolt 2.5 -- which is 3.0 MINUS BANE
   *
   * Sniper Shot's 4 and Shadow Bolt's talent-reduced 2.5 are what make that a
   * reading rather than a coincidence: neither is a number somebody would pick
   * out of the air, and the second is not even the figure on the ability.
   *
   * SO THE LEAD IS WHEN THE CAST BEGAN AND THE SPELL LANDS AT THE PULL, and
   * `rewindFor` ages by the time since the action FINISHED -- which for all ten
   * of those is zero.
   * ==========================================================================
   */
  readonly secondsBefore: number;
}

/**
 * Run a character's pre-combat actions, oldest first.
 *
 * ------------------------------------------------------------------------------
 * OLDEST FIRST, WHICH IS THE ORDER THEY HAPPENED IN. A Fireball cast 2.5
 * seconds out and a Stealth used 2 seconds out are, in that order, what the
 * character did -- and the order matters whenever one action's effect gates
 * another's, the way a stance gates Overpower.
 *
 * SORTED RATHER THAN TRUSTED, so the list in the panel can be in whatever
 * order somebody dragged it into. The owner's own examples arrive out of
 * order.
 *
 * AN ABILITY THE BUILD DOES NOT HAVE IS SKIPPED IN SILENCE, which is
 * `PriorityRotation`'s rule and is what lets one saved profile survive a
 * talent change. A REFUSED cast is skipped too -- it costs too much, it is out
 * of stance, it needs a target -- because a pre-combat action is a plan and a
 * plan can be unaffordable.
 * ------------------------------------------------------------------------------
 */
export function runPrecombat(
  context: SimulationContext,
  actor: Combatant,
  actions: readonly PrecombatAction[],
): void {
  const ordered = [...actions].sort((a, b) => b.secondsBefore - a.secondsBefore);

  /*
   * ==========================================================================
   * HOW FAR BEFORE THE PULL WE HAVE GOT TO, as a NEGATIVE offset from it.
   *
   * The owner's ruling: "credit the regen and back-date the five-second rule."
   * So the pre-combat window is walked rather than collapsed -- each action is
   * cast at its own moment and the pools tick between them, which is what a
   * character stood there doing this would actually arrive with.
   *
   * THE CLOCK IS NOT MOVED AND CANNOT BE. `SimulationClock` only goes forward
   * and every scheduled event, swing timer and aura window is expressed against
   * it, which is the reason this whole feature resolves at timestamp zero. This
   * is one local number instead, handed to the things that need to be asked
   * about a moment before the pull.
   * ==========================================================================
   */
  let at = ordered.length > 0 ? -Math.max(0, Math.round(ordered[0].secondsBefore * 1000)) : 0;

  for (const action of ordered) {
    const ability = actor.abilities.get(action.abilityId);
    if (!ability) continue;

    /*
     * A CHANNEL IS REFUSED. `castAbility`'s pre-combat mode zeroes the cast
     * time, which for a channel would deliver ONE tick's worth of effect and
     * report it as the whole channel -- a smaller number and no error. There
     * is no sensible pre-pull reading of a channel anyway: it is the one kind
     * of cast whose effect is spread across the time it occupies.
     *
     * IT ASKED `channelTicks > 1` AND MISSED EVOCATION, which declares no ticks
     * and is still a channel -- so a pre-combat Evocation would have opened and
     * closed its regeneration window in the same millisecond and handed back no
     * mana, for an eight-minute cooldown. No opener pre-casts one, so this is a
     * latent case rather than a live one; `spreadsEffectAcrossCast` is now the
     * one shared answer, written for Presence of Mind and used here.
     */
    if (spreadsEffectAcrossCast(ability)) continue;

    const target = context.defaultTargetFor(actor);

    /*
     * SNAPSHOTTED AROUND THE CAST, rather than asking the ability what it
     * applies. That is the same discipline `AbilityCastEvent.spent` uses for
     * resources and for the same reason: an ability that had to DECLARE its
     * auras is an ability that can forget to, and the one that forgot would be
     * silently exempt from the lead time while everything else obeyed it.
     */
    /*
     * THE POOLS TICK UP TO THIS ACTION BEFORE IT IS CAST, so a cast finds the
     * resource a waiting character would have had. The first gap is almost
     * always wasted -- a pool starts FULL and `grantResource` clamps -- and it
     * is credited anyway rather than special-cased, because "the pool was full"
     * is a fact about the character and not about the rule.
     */
    const finishedAt = -rewindFor(actor, ability, action.secondsBefore);
    creditRegen(context, actor, at, finishedAt);
    at = finishedAt;

    const leadMs = -finishedAt;
    const before = auraWindows(context);
    const result = castAbility(context, actor, ability, target, { precombat: true });
    if (!result.ok) continue;

    /*
     * AND THE SPEND IS STAMPED WHEN IT HAPPENED, which is the whole of
     * "back-date the five-second rule": `castAbility` records it at the clock,
     * which is zero here, so a Mage that drank its Mage Armor 4.5 seconds early
     * arrived with the FULL five second lockout still to run instead of half a
     * second of it.
     *
     * THE STAMP IS A PLAIN NUMBER AND A NEGATIVE ONE IS ARITHMETIC, not a
     * special case: `spentWithin` asks `now - last < windowMs`, so a spend at
     * -4500 reads as 4.5 seconds ago at the pull and the lockout expires 500ms
     * into the fight, by itself, with nothing to clear.
     *
     * THE DECLARED COST ONLY. An ability that drains a pool inside its own
     * `onCast` is not covered, and nothing in any opener does -- said here
     * because the alternative is snapshotting every pool around the cast, which
     * is what `AbilityCastEvent.spent` does and would re-stamp a pool the
     * ability merely GRANTED. Bloodrage grants rage in its `onCast`.
     */
    if (ability.cost && leadMs > 0) {
      actor.recordResourceSpend(ability.cost.resource, finishedAt);
    }

    if (leadMs > 0) {
      rewindAuras(context, before, leadMs);
      actor.abilities.rewindCooldown(ability.id, leadMs);
    }
  }

  // And the last gap, from whatever happened last to the pull itself.
  creditRegen(context, actor, at, 0);
}

/**
 * Tick every pool the actor regenerates across `[from, to)`, both negative.
 *
 * ==============================================================================
 * THE SAME SHAPE `accruesBeforeCombat` ALREADY USES for Bloodrage's rage: count
 * the intervals the window contains and run the effect that many times. There is
 * no other way to do it without a clock that can go backwards.
 *
 * EACH TICK IS EVALUATED AT ITS OWN MOMENT, which is the half that matters and
 * the half a single multiplication would get wrong. Mana's five second rule is
 * read per tick, so a caster that spent at -3000 is correctly locked out for the
 * three seconds that follow -- and crediting `rate x seconds` in one go would
 * hand it every point of that back.
 *
 * SO FOR A CASTER THE CREDIT IS USUALLY ZERO, and that is the ruling working
 * rather than failing: the openers spend mana and the lockout then suppresses
 * exactly the regeneration the lead would have bought. Energy has no such rule,
 * so a Rogue really does bank its ten a second.
 * ==============================================================================
 */
function creditRegen(
  context: SimulationContext,
  actor: Combatant,
  from: Milliseconds,
  to: Milliseconds,
): void {
  const windowMs = to - from;
  if (windowMs <= 0) return;

  for (const regen of actor.regeneration) {
    if (regen.intervalMs <= 0) continue;
    const ticks = Math.floor(windowMs / regen.intervalMs);
    for (let tick = 1; tick <= ticks; tick += 1) {
      /*
       * THE TICK LANDS AT THE END OF ITS OWN INTERVAL, which is
       * `scheduleTick`'s rule in the live path -- "the first tick lands one
       * full interval into the fight, not at time zero" -- so a pool that
       * starts full does not waste one and a window shorter than one interval
       * credits nothing.
       */
      const atTick = from + tick * regen.intervalMs;
      const amount = regen.amountPerTick(actor, context, atTick);
      if (amount > 0) {
        context.grantResource(actor, regen.resource, amount, {
          id: `precombat_regen_${regen.resource}`,
          name: 'Regeneration before the pull',
        });
      }
    }
  }
}

/**
 * How long ago the action FINISHED, which is what the lead time gets spent on.
 *
 * ==============================================================================
 * THE CAST TIME COMES OFF THE LEAD, BECAUSE THE LEAD WAS SPENT CASTING.
 *
 * "3s before begin casting Fireball" is a three-second cast that ENDS at the
 * pull, so nothing about it has aged: the spell lands at t=0 and its burn
 * starts there. An instant has no cast time to subtract, so every instant is
 * unchanged and so is every existing caller.
 *
 * ------------------------------------------------------------------------------
 * WITHOUT THIS, A PRE-CAST SPELL WAS INCOHERENT WITH ITSELF -- the damage
 * landed at t=0 while everything the same cast applied was already aged.
 * Concretely, on the openers the owner specified:
 *
 *   Fireball at 3s          its DoT 3 seconds into an 8 second burn at the pull
 *   Frostfire Bolt at 2.5s  the same, and it is 62% of that profile's damage
 *   Arcane Blast at 1.5s    its 15 second stacking buff already a tenth gone
 *   Aimed Shot at 2s        a 6 second cooldown back at t=4 rather than t=6
 *   Sniper Shot at 4s       a 15 second cooldown back at t=11
 *   Mind Blast at 1.5s      a 6 second cooldown back at t=4.5
 *
 * Two of those are a bigger number and no error, which is this project's own
 * description of the bugs it keeps finding.
 *
 * ------------------------------------------------------------------------------
 * CLAMPED AT ZERO, which is the owner's ORIGINAL example and is why the clamp
 * is not a safety net but a case: "Cast Fireball <= 2.5 sec before combat
 * initiates" is a 2.5 second lead on a THREE second cast. Read as "at most",
 * the character cannot have finished it -- so it finishes at the pull, which is
 * the same answer the ten openers give and is what `precombat.test.ts` has
 * asserted since the feature shipped.
 *
 * THE RESOLVED, HASTED LENGTH rather than the declared one, because that is
 * what the cast would actually have taken this character: Bane takes the
 * SM/DS Warlock's Shadow Bolt from 3.0 to 2.5 before haste touches it, and
 * reading `ability.castTimeMs` would have left half a second of ageing on the
 * one profile whose number proves the whole reading. `resolveCast` is pure --
 * `consumeCastCharges` is the half with the side effects -- so asking it before
 * the cast is safe and is the state this cast is about to be made in.
 * ==============================================================================
 */
function rewindFor(actor: Combatant, ability: Ability, secondsBefore: number): Milliseconds {
  const leadMs = Math.max(0, Math.round(secondsBefore * 1000));
  const resolved = resolveCast(actor, ability);
  const castMs = castLength(ability, castHasteFor(actor, ability), resolved.baseCastTimeMs);
  return Math.max(0, leadMs - castMs);
}

/** Every live aura in the fight, and which window each is on. */
function auraWindows(context: SimulationContext): Map<AuraInstance, number> {
  const seen = new Map<AuraInstance, number>();
  for (const combatant of context.combatants) {
    for (const aura of combatant.auras.active) seen.set(aura, aura.revision);
  }
  return seen;
}

/**
 * Age every aura the cast just applied or refreshed by the lead time.
 *
 * ------------------------------------------------------------------------------
 * NEW *OR REFRESHED*, AND `revision` IS THE ONLY FIELD THAT SAYS WHICH.
 * `AuraCollection.apply` REFRESHES a matching id in place rather than making
 * a second instance, so a pre-combat cast renewing something already up has
 * to count -- and the two obvious discriminators cannot see it, because
 * everything pre-combat happens at timestamp 0:
 *
 *   `appliedAt`   unchanged by a refresh in the same millisecond
 *   `expiresAt`   unchanged whenever the aura was already at full duration
 *
 * A WARRIOR PRE-CASTING BATTLE SHOUT IS EXACTLY THAT CASE, over the raid's
 * own copy applied moments earlier, and it read as untouched: the buff kept
 * its full two minutes and the lead time silently did nothing.
 *
 * ALREADY OVER MEANS GONE. A twenty-second buff used thirty seconds before the
 * pull is not a buff the character has, and leaving it at zero remaining would
 * put a row on the uptime table for something that never applied -- which is
 * the Adrenaline Rush failure, where an aura reported 24.9% uptime and
 * delivered nothing.
 *
 * A PERMANENT AURA IS UNTOUCHED. A stance, a form and Stealth have no duration
 * to shorten, and `expiresAt` is `Infinity` for all of them -- so "swapping
 * into berserker stance 2 seconds before the pull" is simply being in
 * berserker stance, which is what it should be.
 * ------------------------------------------------------------------------------
 */
function rewindAuras(
  context: SimulationContext,
  before: ReadonlyMap<AuraInstance, number>,
  leadMs: Milliseconds,
): void {
  for (const combatant of context.combatants) {
    // Copied, because an aura that has already run out is removed inside it.
    for (const aura of [...combatant.auras.active]) {
      if (aura.isPermanent) continue;
      const previously = before.get(aura);
      if (previously !== undefined && previously === aura.revision) continue;

      /*
       * THROUGH THE COLLECTION, NOT BY WRITING THE TWO FIELDS, because the
       * EXPIRATION IS ALREADY SCHEDULED against the old `expiresAt`. Ageing the
       * window by hand left the aura alive for `leadMs` past its own end, with
       * `remainingMs` reading zero while `has` answered true -- and that
       * disagreement cost a pre-cast Searing Totem a whole application of ticks
       * at an identical uptime. See `AuraCollection.rewindWindow`.
       */
      combatant.auras.rewindWindow(context, aura, leadMs);

      /*
       * THE TICKS THAT HAPPENED BEFORE THE PULL, FOR AN AURA THAT SAYS THEY
       * COUNT. See `PeriodicEffect.accruesBeforeCombat`: Bloodrage's "another 1
       * rage per second for 10 seconds" is rage the character spent those
       * seconds generating, and at the ten-second lead the owner's own openers
       * use, ALL of it elapsed before the clock started.
       *
       * ONE TICK PER WHOLE INTERVAL INSIDE THE LEAD, capped by the aura's own
       * duration -- a thirty-second lead on a ten-second window is still ten
       * ticks. The ticks the engine already scheduled keep firing after the
       * pull and stop when the aged window closes, so the two halves meet
       * exactly rather than overlapping.
       */
      const periodic = aura.definition.periodic;
      if (periodic?.accruesBeforeCombat === true && periodic.intervalMs > 0) {
        const elapsed = Math.min(leadMs, aura.definition.durationMs);
        const ticks = Math.floor(elapsed / periodic.intervalMs);
        for (let tick = 0; tick < ticks; tick += 1) periodic.onTick(context, aura);
      }

      if (aura.expiresAt <= context.clock.now()) {
        combatant.auras.remove(context, aura.definition.id);
      }
    }
  }
}
