import type { Ability } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import { WARRIOR_ABILITIES } from './warrior';

/**
 * Abilities that exist only because a talent grants them, as
 * `ability id -> the talent id that grants it`.
 *
 * All four Warrior entries are one-rank talents, and their slugified names
 * happen to equal their ability ids. That is a coincidence worth not relying
 * on: the mapping is written out so that renaming either side is a visible
 * change rather than a silent one, and a test asserts every talent id here
 * exists in the class's trees.
 *
 * Three of these are 31-point capstones in three different trees:
 *
 *     arms       row 6   Mortal Strike
 *     fury       row 6   Bloodthirst
 *     protection row 6   Shield Slam
 *
 * 51 points cannot reach two of them, so a warrior has exactly one. Before this
 * mapping existed every warrior was handed all three, which made every measured
 * damage figure too high for a reason nothing in the results could show.
 */
const WARRIOR_TALENT_ABILITIES: Readonly<Record<string, string>> = {
  mortal_strike: 'mortal_strike',
  bloodthirst: 'bloodthirst',
  shield_slam: 'shield_slam',
  spearing_strike: 'spearing_strike',
};

/** Which abilities each class gets from talents rather than from levelling. */
const TALENT_ABILITIES: Partial<Record<ClassId, Readonly<Record<string, string>>>> = {
  warrior: WARRIOR_TALENT_ABILITIES,
};

/** The talent id that grants an ability, if a talent grants it at all. */
export function talentGranting(
  characterClass: ClassId,
  abilityId: string,
): string | undefined {
  return TALENT_ABILITIES[characterClass]?.[abilityId];
}

/**
 * Abilities a class knows.
 *
 * Only the Warrior has content, from WoWForeverWarriorAbilities.xlsx — see
 * `warrior.ts` and `docs/warrior-abilities.md`. Every other class returns an
 * empty list and fights with auto attacks alone.
 *
 * That gap is deliberate and visible rather than papered over with invented
 * spells. Each class is filled in as its spreadsheet arrives.
 *
 * Two things gate what comes back:
 *
 * - **The combat style**, for abilities that need particular gear in hand.
 * - **The talent allocation**, for abilities a tree grants. An OMITTED
 *   allocation means no talents, and so no talent-granted abilities. That is
 *   the honest reading rather than a lenient one: a caller that has not said
 *   what it spent has not spent anything, and the alternative — treating
 *   "unknown" as "all of them" — is exactly the bug this gating exists to fix.
 */
export function abilitiesForClass(
  characterClass: ClassId,
  style?: CombatStyleId,
  talents?: TalentAllocation,
): readonly Ability[] {
  if (characterClass !== 'warrior') return [];

  return WARRIOR_ABILITIES.filter((ability) => {
    // Shield Slam needs a shield. Gating on the weapon rather than on a stance
    // is how Classic expresses it; the spreadsheet says nothing either way.
    // This is checked before the talent, so a warrior who took Shield Slam and
    // put away their shield still cannot use it.
    if (ability.id === 'shield_slam' && style !== 'one_hand_shield') return false;

    const required = WARRIOR_TALENT_ABILITIES[ability.id];
    if (required === undefined) return true;
    return (talents?.[required] ?? 0) > 0;
  });
}
