import type { Combatant } from '../actors/Combatant';
import type { AuraInstance } from '../effects/Aura';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';
import { castAbility } from './casting';

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
   * How long before the pull it was used.
   *
   * THE OWNER WROTE IT AS "<= 2 sec", which is a budget rather than an exact
   * moment -- the action is taken AT MOST this long before combat. It is read
   * as the exact figure, because "at most" has no other number in it to use
   * and the two readings differ only in how a person says it.
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

  for (const action of ordered) {
    const ability = actor.abilities.get(action.abilityId);
    if (!ability) continue;

    /*
     * A CHANNEL IS REFUSED. `castAbility`'s pre-combat mode zeroes the cast
     * time, which for a channel would deliver ONE tick's worth of effect and
     * report it as the whole channel -- a smaller number and no error. There
     * is no sensible pre-pull reading of a channel anyway: it is the one kind
     * of cast whose effect is spread across the time it occupies.
     */
    if ((ability.channelTicks ?? 1) > 1) continue;

    const leadMs = Math.max(0, Math.round(action.secondsBefore * 1000));
    const target = context.defaultTargetFor(actor);

    /*
     * SNAPSHOTTED AROUND THE CAST, rather than asking the ability what it
     * applies. That is the same discipline `AbilityCastEvent.spent` uses for
     * resources and for the same reason: an ability that had to DECLARE its
     * auras is an ability that can forget to, and the one that forgot would be
     * silently exempt from the lead time while everything else obeyed it.
     */
    const before = auraWindows(context);
    const result = castAbility(context, actor, ability, target, { precombat: true });
    if (!result.ok) continue;

    if (leadMs > 0) {
      rewindAuras(context, before, leadMs);
      actor.abilities.rewindCooldown(ability.id, leadMs);
    }
  }
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

      aura.appliedAt -= leadMs;
      aura.expiresAt -= leadMs;
      if (aura.expiresAt <= context.clock.now()) {
        combatant.auras.remove(context, aura.definition.id);
      }
    }
  }
}
