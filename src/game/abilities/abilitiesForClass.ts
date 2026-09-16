import type { Ability } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import { WARRIOR_ABILITIES } from './warrior';

/**
 * Abilities a class knows.
 *
 * Only the Warrior has content, from WoWForeverWarriorAbilities.xlsx — see
 * `warrior.ts` and `docs/warrior-abilities.md`. Every other class returns an
 * empty list and fights with auto attacks alone.
 *
 * That gap is deliberate and visible rather than papered over with invented
 * spells. Each class is filled in as its spreadsheet arrives.
 */
export function abilitiesForClass(
  characterClass: ClassId,
  style?: CombatStyleId,
): readonly Ability[] {
  if (characterClass !== 'warrior') return [];

  // Shield Slam needs a shield. Gating on the weapon rather than on a stance is
  // how Classic expresses it; the spreadsheet says nothing either way.
  if (style === 'one_hand_shield') return WARRIOR_ABILITIES;
  return WARRIOR_ABILITIES.filter((ability) => ability.id !== 'shield_slam');
}
