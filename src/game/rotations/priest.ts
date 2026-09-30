import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
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
 * SHADOW WORD: DEATH HURTS. The target is never killed, so its backlash always
 * lands — a tenth of the priest's health every fifteen seconds with no healer.
 * It is still worth casting and it is still the entry most likely to be wrong
 * in a shell nobody has tuned.
 */
export const PRIEST_SHADOW: readonly PriorityEntry[] = [
  { abilityId: 'shadowform', condition: withoutAura('shadowform') },
  { abilityId: 'shadow_word_pain', condition: expired('shadow_word_pain') },
  { abilityId: 'devouring_plague', condition: expired('devouring_plague') },
  { abilityId: 'vampiric_embrace', condition: expired('vampiric_embrace') },
  { abilityId: 'mind_blast' },
  /*
   * SHADOW WORD: DEATH IS OUT, on the ruleset owner's list. It fired four
   * times a fight for 11.6% of the profile's damage, so this is a real
   * subtraction rather than the removal of a dead entry -- and what it buys is
   * those four global cooldowns going to Mind Flay instead.
   */
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
