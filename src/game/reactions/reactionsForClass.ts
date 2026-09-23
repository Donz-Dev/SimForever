import type { Reaction } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import { talentNumber } from '../talents/talentValues';
import { WARRIOR_REACTIONS } from './warrior';
import { windfuryWeaponReaction } from './shaman';

/**
 * Reactive procs a class has.
 *
 * The same shape as `abilitiesForClass` and `rotationFor`, and for the same
 * reason: it takes the combat style so that per-style lists are a change to
 * this function alone when they are needed.
 *
 * ----------------------------------------------------------------------------
 * AND NOW THE TALENTS TOO, WHICH IS NOT THE SAME AS A TALENT PROC.
 *
 * `build.reactions` already carries every proc a TALENT grants, and Windfury
 * Weapon is not one: a Shaman who never spent a point still casts the imbue
 * and still gets two extra attacks from it. The talent only makes it bigger.
 *
 * So the reaction belongs to the CLASS and reads one number off the
 * allocation. Registering it as a talent proc instead would delete it for a
 * Shaman without Elemental Weapons; registering a second copy from the talent
 * would double it, because reactions are concatenated and both would fire.
 * ----------------------------------------------------------------------------
 *
 * A Rogue's Riposte and a Hunter's counterattack both want this hook when
 * their content arrives.
 */
export function reactionsForClass(
  characterClass: ClassId,
  _style?: CombatStyleId,
  talents?: TalentAllocation,
): readonly Reaction[] {
  if (characterClass === 'warrior') return WARRIOR_REACTIONS;

  if (characterClass === 'shaman') {
    /*
     * Elemental Weapons: "increases the melee attack power bonus of your
     * Rockbiter Weapon by {0}%, your Windfury Weapon effect by {1}% and
     * increases the damage caused by your Flametongue Weapon and Frostbrand
     * Weapon by {2}%."
     *
     * INDEX 1, and reading index 0 would hand Windfury the Rockbiter figure --
     * 20% where 40% belongs. That is exactly the mistake `valueIndex` was
     * added for, and it is silent: the proc still fires and is simply worth
     * less than it should be.
     */
    const rank = talents?.elemental_weapons ?? 0;
    const bonus = rank > 0 ? (talentNumber('shaman', 'elemental_weapons', rank, 1) ?? 0) : 0;
    return [windfuryWeaponReaction(bonus)];
  }

  return [];
}
