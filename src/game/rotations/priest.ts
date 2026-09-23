import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Priest priority lists — APL SHELLS.
 *
 * ONE PROFILE, Shadow, and it is the last of the twenty-one. Not the ruleset
 * owner's own list.
 */

const REFRESH_WINDOW_MS = 2000;

const missing = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) < REFRESH_WINDOW_MS;

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
  { abilityId: 'shadow_word_pain', condition: missing('shadow_word_pain') },
  { abilityId: 'devouring_plague', condition: missing('devouring_plague') },
  { abilityId: 'vampiric_embrace', condition: missing('vampiric_embrace') },
  { abilityId: 'mind_blast' },
  { abilityId: 'shadow_word_death' },
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
