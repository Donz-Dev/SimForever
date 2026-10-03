import type { CastReaction, Reaction } from '../../engine';

/**
 * Judgement of Wisdom.
 *
 * ----------------------------------------------------------------------------
 * THE RULE, from the ruleset owner:
 *
 *   Every direct damage source (not DoT ticks) or cast against an enemy has a
 *   50% chance to restore 59 mana to classes that use mana.
 *
 * The in-game text is "granting attacks and spells used against the judged
 * enemy a chance to restore 59 mana to the attacker".
 *
 * ONE ROLL PER ACTION, settled by the owner, because a damaging spell is BOTH
 * "a direct damage source" and "a cast against an enemy" and the sentence does
 * not say which. The reading taken is the one where each clause does work and
 * nothing is counted twice:
 *
 *   - an action that DEALT direct damage rolls on the damage
 *   - a cast that dealt none rolls on the cast -- applying Corruption or
 *     Shadow Word: Pain, or a spell that missed
 *
 * The rejected reading rolls on both, which is an effective 75% per Fireball
 * instead of 50% and worth roughly double the mana to a caster. **Both
 * readings produce a plausible number**, which is why the choice is recorded
 * here rather than left to be inferred from the code.
 *
 * THE TWO REACTIONS SHARE ONE CLOSURE, which is the whole mechanism: the
 * damage half records the instant it took its roll, and the cast half refuses
 * when a roll has already been taken at that instant. They are built together
 * for that reason and must not be built separately.
 *
 * DoT TICKS NEED NO CHECK HERE. `dealDamage` dispatches reactions only when
 * `request.attackTable && !request.periodic`, so a tick never reaches a damage
 * reaction at all -- "not DoT ticks" is the engine's behaviour rather than
 * something this file enforces. If that gate ever changes, this breaks
 * silently and generously.
 *
 * AN AVOIDED SWING GETS NO ROLL. The outcomes below are the landed ones, so a
 * missed auto-attack is an action that was not a direct damage source and was
 * not a cast. A missed SPELL still rolls, through the cast half, because it
 * was still a cast against an enemy.
 *
 * NO AURA, so this is a PROC entry rather than a STATE one -- the same shape
 * as Windfury Totem. Nothing about the judgement itself is modelled: not its
 * 40-second duration, not the melee-strike refresh, and not the one-Judgement
 * -per-Paladin limit, because a raid buff here is an assumption that holds for
 * the whole fight.
 * ----------------------------------------------------------------------------
 */
export const JUDGEMENT_OF_WISDOM_CHANCE = 0.5;
export const JUDGEMENT_OF_WISDOM_MANA = 59;

const SOURCE = { id: 'judgement_of_wisdom', name: 'Judgement of Wisdom' };

/**
 * Both halves of the proc, sharing the state that keeps them to one roll.
 *
 * Built per character for the reason every proc here is -- see `RaidBuff`'s
 * `buildReaction`. This one's state is not an internal cooldown but the
 * timestamp of the last roll, and sharing it across a batch would make the
 * cast half refuse casts in a later iteration whose clock had restarted.
 */
export function judgementOfWisdomReactions(): {
  readonly damage: Reaction;
  readonly cast: CastReaction;
} {
  /** When this character last TOOK a roll, won or lost. */
  let lastRolledAt: number | null = null;

  return {
    damage: {
      id: 'judgement_of_wisdom',
      on: 'dealt',
      // Landed outcomes only: an avoided attack is not a direct damage source.
      // `block` is included because a blocked attack lands and is reduced.
      outcomes: ['hit', 'crit', 'glance', 'crush', 'block'],
      canTrigger: (context, actor, attack) => {
        // "to classes that use mana" -- and checked BEFORE the roll, so a
        // Warrior selecting this consumes no random number and a seeded run
        // is identical with it on and off.
        if (!usesMana(actor)) return false;
        if (attack.defender.isPlayerControlled) return false;

        lastRolledAt = context.clock.now();
        return context.rng.rollChance(JUDGEMENT_OF_WISDOM_CHANCE);
      },
      onTrigger: (context, actor) => {
        context.grantResource(actor, 'mana', JUDGEMENT_OF_WISDOM_MANA, SOURCE);
      },
    },

    cast: {
      id: 'judgement_of_wisdom',
      canTrigger: (context, actor, cast) => {
        if (!usesMana(actor)) return false;
        if (!cast.target || cast.target.isPlayerControlled) return false;

        /*
         * THE OTHER HALF ALREADY ROLLED FOR THIS ACTION. `runCast` runs
         * `onCast` before the cast reactions, so a spell that dealt direct
         * damage has already been through the damage pipeline and taken its
         * roll by the time this runs. Comparing the instant is what makes
         * "one roll per action" true rather than aspirational.
         */
        if (lastRolledAt === context.clock.now()) return false;

        lastRolledAt = context.clock.now();
        return context.rng.rollChance(JUDGEMENT_OF_WISDOM_CHANCE);
      },
      onTrigger: (context, actor) => {
        context.grantResource(actor, 'mana', JUDGEMENT_OF_WISDOM_MANA, SOURCE);
      },
    },
  };
}

/**
 * Whether this character has a mana bar at all.
 *
 * A Warrior, Rogue and a Hunter's pet do not, so the buff is simply worth
 * nothing to them -- which is correct, and is why it is checked rather than
 * granting mana into a pool that does not exist.
 */
function usesMana(actor: { resources: { get: (r: 'mana') => unknown } }): boolean {
  return actor.resources.get('mana') !== undefined;
}
