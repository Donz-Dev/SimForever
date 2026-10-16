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
 * Talent procs -- Blood Frenzy, Nature's Grace and Natural Reaction -- live in
 * `druidTalents.ts`.
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
 *
 * ----------------------------------------------------------------------------
 * THE FAERIE FIRE FIX HAS NOTHING TO FIX HERE, and that is recorded rather than
 * left as silence: "a note we did nothing about" and "a note nobody read" look
 * identical from a diff.
 *
 * "Omen of Clarity: Fixed a bug where this could be triggered by Faerie Fire
 * while in Cat Form, Bear Form, or Dire Bear Form. Since Faerie Fire costs no
 * resources in those forms, it cannot trigger Omen of Clarity."
 *
 * THIS PROJECT HAS NO FAERIE FIRE ABILITY. The Druid's book is twenty abilities
 * and Faerie Fire is not one of them -- the only `faerie_fire` in the project is
 * a RAID DEBUFF, an armor reduction the encounter assumes rather than something
 * the Druid casts, and it deals no damage at all. So there is nothing for this
 * reaction to refuse: it fires on a damage event, and the debuff produces none.
 *
 * AND THE NOTE'S OWN REASONING WOULD NOT APPLY EITHER, which is worth knowing
 * for the day Faerie Fire (Feral) is declared. The note says the proc should be
 * refused because the ability "costs no resources" -- but that is Clearcasting's
 * CONSUMPTION rule, not this proc's trigger: `CLEARCASTING`'s cast modifier
 * already carries `requiresCost`, so a free ability cannot SPEND the charge.
 * Nothing here filters on cost, because every Druid ability that deals damage
 * has one. A free damaging ability would need this reaction to ask.
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
