import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import { inExecutePhase } from '../combat/executePhase';
import type { TalentAllocation } from '../talents/Talent';

/**
 * "IF NOT ACTIVE", which is the ruleset owner's wording and is NOT the same as
 * the two-second refresh window beside it.
 *
 * ----------------------------------------------------------------------------
 * A REFRESH RESETS THE AURA, so anything left on the clock when the rotation
 * reaches the entry is thrown away. A two-second window clips up to two
 * seconds off every application -- and the faster the character acts, the
 * sooner it reaches the entry inside that window and the more it loses.
 *
 * MEASURED ON THE MOONKIN, where Nature's Grace cost 14.9 DPS by doing nothing
 * but speeding the character up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5. The buff was fine; the window was paying for it.
 *
 * `missing` is kept for the lists the owner has not replaced, so the two
 * readings sit side by side rather than one silently becoming the other.
 * ----------------------------------------------------------------------------
 */
const expired = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.remainingMs(auraId, context.clock.now()) <= 0;

const withoutAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  !actor.auras.has(auraId);

/**
 * Where Shadow Word: Death is HELD, so it comes off cooldown inside the window
 * Early Demise opens.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S INSTRUCTION, and it is a rotation decision rather than a
 * reading of any tooltip: "cast on cooldown, but NOT between 21-35% of the
 * remaining combat duration." So the entry fires freely down to 35% remaining,
 * goes quiet through the band, and fires again from 20% -- which is exactly
 * when Early Demise's +30% critical strike chance starts applying.
 *
 * THE BAND IS ONE COOLDOWN WIDE AND THAT IS WHY IT IS 35. Shadow Word: Death
 * has a 15-second cooldown; 35% to 20% of a 100-second fight is 15 seconds. A
 * cast let through at 34% remaining would still be on cooldown when the window
 * opened, which is the whole thing being avoided. Written down because the two
 * numbers look independent and are not: **move the cooldown and this band is
 * wrong**, and nothing would say so -- the entry would still fire, just not
 * where it was meant to.
 *
 * `EARLY_DEMISE_FRACTION` IS NOT `EXECUTE_PHASE_FRACTION`, and not Quietus's
 * 0.35 either, however much the arithmetic rhymes. Early Demise states its own
 * 20 at index 0 of every rank's row in `values/priest.json`, and
 * `priestAbilities.test.ts` pins that this constant still matches it -- so a
 * Forever change to the talent fails a test instead of silently leaving the
 * hold in the wrong place.
 * ----------------------------------------------------------------------------
 */
export const EARLY_DEMISE_FRACTION = 0.2;
export const SHADOW_WORD_DEATH_HOLD_FRACTION = 0.35;

const outsideTheHoldBand = (context: SimulationContext): boolean =>
  !inExecutePhase(context, SHADOW_WORD_DEATH_HOLD_FRACTION) ||
  inExecutePhase(context, EARLY_DEMISE_FRACTION);

/**
 * SHADOW — the form first, then the two bleeds, then Mind Flay as the filler.
 *
 * SHADOWFORM OPENS IT AND IS CAST EXACTLY ONCE. It has no duration and its own
 * canCast refuses while it is up, so the entry falls through for the rest of
 * the fight. It is worth a global cooldown and 40% of base mana at the pull
 * for +10% Shadow damage, half-price Shadow spells and double Shadow crit
 * damage — which is most of what the build is.
 *
 * MIND FLAY IS THE FILLER AND IT IS A CHANNEL, three seconds for 390. Mind
 * Blast is 490 in a 1.5 second cast on an eight-second cooldown, so it goes
 * above; what Mind Flay fills is the gaps between everything else.
 *
 * SHADOW WORD: DEATH HURTS, AND IT IS BACK, AND IT IS HELD. The target is never
 * killed, so its backlash always lands — a tenth of the priest's health every
 * fifteen seconds with no healer. The owner's earlier list had it out, measured
 * at a cost of 35.2 DPS; the build now takes Early Demise 2/2, so it is in and
 * gated to come off cooldown inside that talent's window. See
 * `outsideTheHoldBand` above for why the band is 15 percentage points wide.
 */
export const PRIEST_SHADOW: readonly PriorityEntry[] = [
  { abilityId: 'shadowform', condition: withoutAura('shadowform') },
  { abilityId: 'shadow_word_pain', condition: expired('shadow_word_pain') },
  { abilityId: 'devouring_plague', condition: expired('devouring_plague') },
  { abilityId: 'vampiric_embrace', condition: expired('vampiric_embrace') },
  { abilityId: 'mind_blast' },
  /*
   * ON COOLDOWN, EXCEPT THROUGH THE HOLD BAND. The condition is the only thing
   * gating it -- there is no combo point, no proc and no debuff to wait for --
   * so between 35% and 20% remaining the list simply falls past it to Mind
   * Flay, which is what "held" costs and is less than the cooldown would.
   */
  { abilityId: 'shadow_word_death', condition: outsideTheHoldBand },
  { abilityId: 'mind_flay' },
];

export const PRIEST_SHADOW_ROTATION: Rotation = new PriorityRotation(
  'Priest (Shadow)',
  PRIEST_SHADOW,
);

/**
 * Which list a Priest runs.
 *
 * ONE LIST, because there is one profile. A Discipline or Holy priest is a
 * healer, and nothing in this project measures healing — so the honest answer
 * for any build is the Shadow list, whose abilities are all trainer spells bar
 * the capstone.
 */
export function priestRotation(_talents: TalentAllocation): Rotation | undefined {
  return PRIEST_SHADOW_ROTATION;
}
