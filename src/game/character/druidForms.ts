import type { CombatStyleId } from './ids';

/**
 * What a Druid's FORM grants, which is not a talent and had nowhere to live.
 *
 * ============================================================================
 * THE BEAR'S ARMOR MULTIPLIER WAS MISSING ENTIRELY, AND IT IS THE LARGEST
 * SINGLE THING THE DRUID TANK WAS OWED.
 *
 * Forever's own spellbook states it on the form:
 *
 *   Bear Form       "increasing Attack Power by 120, Armor contribution from
 *                    items by 180%, and Health by 180"
 *   Dire Bear Form  "increasing Attack Power by 180, Armor contribution from
 *                    items by 360%, and Health by 1,240"
 *   Moonkin Form    "...Armor contribution from items by 360%..."
 *   Cat Form        "increasing Attack Power by 120 plus Agility" -- NO ARMOR
 *                    CLAUSE, which is why there is no entry for it below.
 *
 * WHY IT WENT MISSING FOR THE WHOLE PROJECT. Moonkin Form is a TALENT, so its
 * clause could hang off `moonkin_form` as an `itemArmorPercent` effect and did.
 * Bear Form and Cat Form are base abilities and the engine models a form as a
 * COMBAT STYLE -- and nothing anywhere granted stats for a style, so there was
 * no hook to hang the bear's on and no error when it was absent. The Bear ran
 * the whole project on item armor alone: **3,103 of it against the plate tanks'
 * 6,552**, which made the profile that should be the hardest to kill the
 * softest.
 *
 * ============================================================================
 * `bear` IS DIRE BEAR FORM, AND THE BASE STATS ALREADY SAID SO.
 *
 * The engine folds Bear and Dire Bear into one style, so which tooltip applies
 * is a real question -- 180% against 360% is about 35,000 damage taken a fight.
 * It is answered by data this file does not own: `baseStats.ts` gives a Tauren
 * Druid 1,303 hit points in caster form and **2,543 in bear**, a difference of
 * exactly **1,240**, which is DIRE Bear Form's health figure and not Bear
 * Form's 180. A Night Elf's attack power moves -20 to 160, exactly the **+180**
 * Dire Bear states.
 *
 * So the owner's spreadsheet had already chosen Dire Bear for the stats it
 * supplies, and this is the same form's remaining clause. The owner confirmed
 * it directly.
 *
 * AND `ENRAGE_BEAR_ARMOR_REDUCTION` POINTS THE OTHER WAY, which is worth
 * saying rather than leaving for somebody to find: that constant uses the 27%
 * BEAR figure, with the 16% Dire Bear number declared beside it and unused, on
 * the reasoning that "there is no Dire Bear combat style". **Two places now
 * resolve the same ambiguity differently**, and this one is resolved by the
 * base stats rather than by a default -- so Enrage is the one to re-read, not
 * this.
 * ============================================================================
 */
export const FORM_ARMOR_PERCENT: Partial<Record<CombatStyleId, number>> = {
  /*
   * DIRE BEAR FORM. Moonkin's identical 360% is NOT here: it stays on the
   * `moonkin_form` talent, because a character can only be in Moonkin Form by
   * having spent the point, and moving it here would hand the multiplier to a
   * build that set the style without the talent. The bear has no such talent
   * to gate on, which is the whole reason this table exists.
   */
  bear: 360,
};

/**
 * The armor multiplier a style applies to its ITEM armor, as a fraction.
 *
 * Zero for everything that is not a form with the clause, so a caller may add
 * it unconditionally.
 */
export function formArmorMultiplier(
  characterClass: string,
  style: CombatStyleId,
): number {
  if (characterClass !== 'druid') return 0;
  return (FORM_ARMOR_PERCENT[style] ?? 0) / 100;
}
