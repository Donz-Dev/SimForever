import type { Combatant, PriorityEntry, Rotation, SimulationContext } from '../../engine';
import { PriorityRotation } from '../../engine';
import { BITE, CLAW } from '../abilities/pet';

/**
 * What a pet does, which is not much and is not supposed to be.
 *
 * ----------------------------------------------------------------------------
 * BITE THEN CLAW, both on focus, with the auto-attack underneath carrying most
 * of it. Bite is on a ten-second cooldown and hits for nearly twice what Claw
 * does, so it leads; Claw has no cooldown and is what the rest of the focus
 * goes on.
 *
 * GROWL IS DELIBERATELY ABSENT. It is a taunt, the engine does not track
 * threat, and casting it would spend focus a Claw could have used. A pet that
 * wasted a fifth of its resource on an effect worth nothing would understate
 * Beast Mastery for a reason that has nothing to do with Beast Mastery.
 *
 * THE SAME LIST FOR EVERY FAMILY, because `abilitiesForFamily` has already
 * decided what the pet knows -- a Wolf has no Claw, so the entry falls through
 * exactly as an unlearned talent ability does for a player.
 * ----------------------------------------------------------------------------
 */
/**
 * Claw only with enough focus left over for a Bite.
 *
 * BITE IS WORTH MORE PER FOCUS -- 90 damage for 35 against Claw's 51 for 25,
 * so 2.57 a point against 2.04 -- and it is on a ten-second cooldown. Clawing
 * freely drains the bar between Bites, so Bite comes off cooldown to an empty
 * pool and is skipped: the first version of this list landed ONE Bite in a
 * sixty-second fight instead of six.
 *
 * Reserving its cost is the whole fix, and it is a priority list doing what a
 * priority list is for rather than an engine rule.
 */
const focusToSpare = (_context: SimulationContext, actor: Combatant): boolean =>
  (actor.resources.get('focus')?.current ?? 0) >=
  (CLAW.cost?.amount ?? 0) + (BITE.cost?.amount ?? 0);

export const PET_PRIORITY: readonly PriorityEntry[] = [
  { abilityId: 'pet_bite' },
  { abilityId: 'pet_claw', condition: focusToSpare },
];

export const PET_ROTATION: Rotation = new PriorityRotation('Pet', PET_PRIORITY);
