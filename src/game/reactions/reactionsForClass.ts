import type { Reaction } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import { talentNumber } from '../talents/talentValues';
import { WARRIOR_REACTIONS } from './warrior';
import { windfuryWeaponReaction } from './shaman';
import { PALADIN_REACTIONS, PALADIN_SHIELD_REACTIONS } from './paladin';
import { omenOfClarityChanceFor, omenOfClarityReaction } from './druid';

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
  style?: CombatStyleId,
  talents?: TalentAllocation,
): readonly Reaction[] {
  if (characterClass === 'warrior') return WARRIOR_REACTIONS;
  /*
   * EVERY PALADIN CARRIES EVERY SEAL'S PROC, and the AURA decides which one
   * fires. A seal is swapped mid-fight -- the Retribution capstone is built
   * around doing exactly that -- so binding the reaction to the seal at build
   * time would make swapping do nothing.
   */
  if (characterClass === 'paladin') {
    /*
     * AND SEAL OF FURY'S SHIELD NEEDS A SHIELD, which is a BUILD fact rather than
     * something an `AttackEvent` could answer: a `WeaponProfile` says nothing
     * about what is in the off hand, so "while a shield is equipped" is knowable
     * exactly once, here, where the style is in scope.
     *
     * The same place Shield Slam's gate lives, and the same reasoning the
     * Warrior's Master of Defense was fixed by after its rage proc fired for a
     * Protection warrior carrying two weapons.
     */
    if (style === 'one_hand_shield') return [...PALADIN_REACTIONS, ...PALADIN_SHIELD_REACTIONS];
    return PALADIN_REACTIONS;
  }

  /*
   * OMEN OF CLARITY, which every Druid learns at 20 and no Druid spends a point
   * on -- the same reason Windfury Weapon is here rather than among the talent
   * procs. It is the second caller of this function's STYLE argument, and the
   * reason that argument earns its keep: Moonkin Form doubles the proc chance,
   * which is a property of the form and not of the allocation.
   *
   * BUILT HERE, PER CHARACTER, because the reaction carries its own internal
   * cooldown timestamp -- the state that made a shared Windfury closure stop
   * proccing after one iteration of a batch.
   */
  if (characterClass === 'druid') {
    return [omenOfClarityReaction(omenOfClarityChanceFor(style))];
  }

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
