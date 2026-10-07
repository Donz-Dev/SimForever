import type { Reaction } from '../../engine';
import {
  CLEARCASTING,
  OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS,
  OMEN_OF_CLARITY_MOONKIN_MULTIPLIER,
  OMEN_OF_CLARITY_PROC_CHANCE,
} from '../auras/druid';

/**
 * Druid procs that belong to the CLASS rather than to a talent.
 *
 * ----------------------------------------------------------------------------
 * THE SAME DISTINCTION `reactionsForClass` DRAWS FOR WINDFURY WEAPON: a Druid
 * who never spent a point still has Omen of Clarity, because it is a trainer
 * spell learned at 20. Registering it as a TALENT proc would delete it for
 * every build; registering a second copy from a talent would double it, because
 * reactions are concatenated and both would fire.
 *
 * Talent procs -- Primal Fury, Nature's Grace, Natural Reaction and King of the
 * Jungle -- live in `druidTalents.ts`.
 * ----------------------------------------------------------------------------
 */

/**
 * Omen of Clarity: a chance per spell or attack at a free next ability.
 *
 * ----------------------------------------------------------------------------
 * THE CHANCE IS THE OWNER'S AND SO IS THE DOUBLING. 4% per spell or attack,
 * doubled in Moonkin form, with a ten second internal cooldown -- and the
 * tooltip states none of the three. The doubling is Moonkin Form's own clause,
 * "Omen of Clarity gains 100% increased chance to trigger", which that talent
 * carried as `unmodelled` on the honest grounds that there was no proc to
 * double. It is PASSED IN rather than read here, so the reaction does no
 * arithmetic on a form it cannot see -- `reactionsForClass` has the style.
 *
 * BUILT PER CHARACTER, and that is not optional: `lastProcAt` is per-character
 * state, and one shared closure is how Windfury silently stopped proccing after
 * the first iteration of a batch -- it carried the previous fight's timestamp
 * into a clock that had restarted at zero, so the check read negative forever.
 *
 * THE COOLDOWN IS CHECKED BEFORE THE ROLL, so a blocked proc consumes no random
 * number. That keeps a seeded run identical whether or not the window happens
 * to be open, which is the same ordering Windfury uses.
 *
 * ON LANDED OUTCOMES ONLY, AND THAT IS AN INTERPRETATION. "Your spells and
 * attacks have a chance" names the ACTION, which could be read as including one
 * that missed; every other reaction in this project fires on what connected,
 * and that reading is the conservative one -- it can only understate the proc.
 * Worth about a sixth of its rate for a caster at the Moonkin's hit, so it is
 * recorded as a question for the owner rather than settled here.
 * ----------------------------------------------------------------------------
 */
export function omenOfClarityReaction(chancePercent: number): Reaction {
  let lastProcAt: number | null = null;

  return {
    id: 'omen_of_clarity',
    on: 'dealt',
    // What connected. See the interpretation note above.
    outcomes: ['hit', 'crit', 'glance', 'crush', 'block'],
    canTrigger: (context) => {
      const now = context.clock.now();
      if (lastProcAt !== null && now - lastProcAt < OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS) {
        return false;
      }
      return context.rng.rollChance(chancePercent / 100);
    },
    onTrigger: (context, actor) => {
      lastProcAt = context.clock.now();
      context.applyAura(actor, CLEARCASTING, actor.id);
    },
  };
}

/** The chance a Druid in this form procs it, in percentage points. */
export function omenOfClarityChanceFor(style: string | undefined): number {
  return style === 'moonkin'
    ? OMEN_OF_CLARITY_PROC_CHANCE * OMEN_OF_CLARITY_MOONKIN_MULTIPLIER
    : OMEN_OF_CLARITY_PROC_CHANCE;
}
