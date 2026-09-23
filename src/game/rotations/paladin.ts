import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Paladin priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE, as every list since the Warrior's has been.
 *
 * CHOSEN BY TALENTS, the Rogue and Mage arrangement. A Paladin's combat style
 * does separate Protection -- it is the only one holding a shield -- but it
 * cannot tell Seal Twist Retribution from Shockadin, which are both two-hander
 * builds differing only in where their points went.
 * ----------------------------------------------------------------------------
 */

const withoutAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  !actor.auras.has(auraId);

const missingOn = (auraId: string) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && !target.auras.has(auraId);

// ---------------------------------------------------------------------------

/**
 * SEAL TWIST RETRIBUTION — the capstone made into a rotation.
 *
 * ----------------------------------------------------------------------------
 * TWIST OF LIGHT IS WHY THIS LIST LOOKS ODD. Replacing a seal with a different
 * one grants an Echo, and the next melee attack applies the REPLACED seal's
 * effects on top of the new one's. So a Paladin with the capstone wants to be
 * swapping seals rather than settling on one -- which is the opposite of every
 * other class's "put the buff up and leave it".
 *
 * THE CYCLE: Seal of Command is the seal worth echoing, because its echo is a
 * GUARANTEED 70%-of-weapon-damage hit rather than a rolled one. So the list
 * keeps Command up, and swaps to the Crusader when its judgement debuff is
 * missing -- which both refreshes that debuff and leaves an Echo of Command
 * behind for the next swing.
 *
 * JUDGEMENT DOES NOT CONSUME THE SEAL in Forever, so it is simply cast on
 * cooldown and the seal underneath is untouched. That is the single biggest
 * difference from how a Classic paladin plays, and it is what makes this list
 * a priority list rather than a scripted sequence.
 * ----------------------------------------------------------------------------
 */
export const PALADIN_RETRIBUTION: readonly PriorityEntry[] = [
  // The Crusader's judgement is a 40-second debuff; putting it up costs one
  // seal swap and leaves an Echo of Command behind on the way through.
  {
    abilityId: 'seal_of_the_crusader',
    condition: (context, actor, target) =>
      missingOn('judgement_of_the_crusader')(context, actor, target) &&
      actor.auras.has('seal_of_command'),
  },
  { abilityId: 'judgement' },
  { abilityId: 'seal_of_command', condition: withoutAura('seal_of_command') },
  { abilityId: 'holy_strike' },
];

/**
 * SHOCKADIN — a Retribution body with a Holy head.
 *
 * 23/0/28, and the Holy half buys exactly one damaging spell: Holy Shock, on a
 * ten-second cooldown for 325 mana. Everything else the tree gives this build
 * is healing, crit chance and mana.
 *
 * SO IT IS RETRIBUTION'S LIST WITH HOLY SHOCK IN IT, which is an honest
 * description of the build rather than a shortcut. It has no Twist of Light --
 * that is a 31-point Retribution talent and this build stops at 28 -- so the
 * seal swapping above buys it nothing, and it puts up one seal and leaves it.
 *
 * IT IS ALSO THE LIST AN UNTALENTED PALADIN RUNS, because every ability in it
 * is a trainer ability.
 */
export const PALADIN_SHOCKADIN: readonly PriorityEntry[] = [
  { abilityId: 'holy_shock' },
  { abilityId: 'judgement' },
  /*
   * SEAL OF RIGHTEOUSNESS, NOT COMMAND, AND NOT BY PREFERENCE. Seal of
   * Command is a 21-point Retribution talent and this build stops at 28 in
   * that tree WITHOUT taking it -- so a Shockadin simply does not have it.
   *
   * The first version of this list asked for Command anyway. The ability was
   * not in the book, the entry fell through, NO seal was ever cast, and
   * Judgement's `canCast` then refused every single time because it needs one
   * -- so the build silently lost both its seal damage and its Judgement.
   * Nothing errored; the DPS was simply lower than it should have been.
   */
  { abilityId: 'seal_of_righteousness', condition: withoutAura('seal_of_righteousness') },
  { abilityId: 'holy_strike' },
];

/**
 * PROTECTION — Holy Shield up, Consecration down, Holy Strike on cooldown.
 *
 * THE ONLY PALADIN PROFILE THAT IS HIT BACK, which is what makes Redoubt,
 * Reckoning and Seal of Fury's absorb mean anything at all. It is also the
 * profile that loses most to threat not being modelled: six of its talents are
 * threat, and a tank's whole job is threat.
 *
 * SEAL OF FURY RATHER THAN COMMAND, because it is the tanking seal -- a flat
 * 35 Holy on every swing plus an absorb, against Command's rolled burst. The
 * build takes Improved Seal of Fury, which says which one it means to use.
 */
export const PALADIN_PROTECTION: readonly PriorityEntry[] = [
  { abilityId: 'holy_shield', condition: withoutAura('holy_shield') },
  { abilityId: 'seal_of_fury', condition: withoutAura('seal_of_fury') },
  { abilityId: 'judgement' },
  { abilityId: 'consecration', condition: missingOn('consecration') },
  { abilityId: 'holy_strike' },
];

export const PALADIN_RETRIBUTION_ROTATION: Rotation = new PriorityRotation(
  'Paladin (Seal Twist Ret)',
  PALADIN_RETRIBUTION,
);
export const PALADIN_SHOCKADIN_ROTATION: Rotation = new PriorityRotation(
  'Paladin (Shockadin)',
  PALADIN_SHOCKADIN,
);
export const PALADIN_PROTECTION_ROTATION: Rotation = new PriorityRotation(
  'Paladin (Protection)',
  PALADIN_PROTECTION,
);

/**
 * Which list a Paladin runs.
 *
 * PROTECTION BY ITS CAPSTONE, the Rogue's test: Holy Shield is a 31-point
 * Protection talent and no other build can reach it.
 *
 * THEN THE TWO RETRIBUTION BUILDS BY THEIRS. Seal Twist takes Twist of Light
 * at 31 points; Shockadin stops at 28 and takes Holy Shock instead. Both tests
 * name a capstone rather than counting points, because here a capstone
 * genuinely does separate them -- unlike the Mage, whose Frostfire build has
 * none at all.
 */
export function paladinRotation(talents: TalentAllocation): Rotation | undefined {
  if ((talents.holy_shield ?? 0) > 0) return PALADIN_PROTECTION_ROTATION;
  if ((talents.twist_of_light ?? 0) > 0) return PALADIN_RETRIBUTION_ROTATION;
  if ((talents.holy_shock ?? 0) > 0) return PALADIN_SHOCKADIN_ROTATION;
  /*
   * A Paladin with none of the three still fights, and gets the SHOCKADIN
   * list -- which is the one written entirely out of trainer abilities. The
   * Retribution list asks for Seal of Command, a talent an untalented paladin
   * does not have, and a paladin with no seal cannot Judge either.
   */
  return PALADIN_SHOCKADIN_ROTATION;
}
