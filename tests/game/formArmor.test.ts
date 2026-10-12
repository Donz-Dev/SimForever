import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { armorFromItems } from '../../src/game/items/equipment';
import {
  FORM_ARMOR_PERCENT,
  formArmorMultiplier,
} from '../../src/game/character/druidForms';
import { BASE_STATS } from '../../src/game/character/baseStats';
import { talentBuild, talentContextFor } from '../../src/game/talents/talentBuild';
import { MAX_CHARACTER_LEVEL } from '../../src/game/character';

/*
 * ============================================================================
 * THE FORM'S ARMOR MULTIPLIER, WHICH DID NOT EXIST AND WAS THE LARGEST THING
 * THE DRUID TANK WAS OWED.
 *
 * Forever's Dire Bear Form: "increasing Attack Power by 180, Armor
 * contribution from items by 360%, and Health by 1,240."
 *
 * WHY IT WENT MISSING FOR THE WHOLE PROJECT, which is the part worth keeping:
 * a form is a COMBAT STYLE here, and nothing anywhere granted stats for a
 * style. Moonkin Form's identical clause worked only because Moonkin Form is
 * a TALENT and could carry an `itemArmorPercent` effect; Bear Form is a base
 * ability with no talent to hang one on, so there was no hook and no error.
 * The Bear ran on item armor alone -- 3,103 against the plate tanks' 6,552 --
 * which made the profile that should be hardest to kill the softest.
 *
 * NO TEST COULD HAVE CAUGHT IT. There was nothing to assert against: a stat
 * that was never declared leaves no zero, no caveat and no unmodelled entry.
 * What found it was the owner reading a damage-taken figure across the three
 * tanks and asking which of them was wrong -- the fifth time their reading of
 * a printed table has beaten every tool in this repository.
 * ============================================================================
 */

const bearPlayer = (talents?: Record<string, number>) => {
  const built = PRESETS_BY_ID.get('druid_bear')!.build();
  return createPlayer({
    race: built.character.race as never,
    characterClass: 'druid',
    combatStyle: 'bear',
    talents: talents ?? built.talents,
    equipment: built.equipment,
  });
};

describe('Dire Bear Form multiplies armor from items', () => {
  it('is 360%, and ONLY the bear has one', () => {
    expect(FORM_ARMOR_PERCENT.bear).toBe(360);
    expect(formArmorMultiplier('druid', 'bear')).toBeCloseTo(3.6, 10);

    /*
     * CAT FORM HAS NO ARMOR CLAUSE AT ALL -- "increasing Attack Power by 120
     * plus Agility" and nothing else -- so its absence here is the tooltip and
     * not an omission.
     *
     * AND MOONKIN IS NOT HERE EITHER, deliberately: its identical 360% stays
     * on the `moonkin_form` TALENT, because a character can only be in Moonkin
     * Form by having spent the point. Putting it here too would double it.
     */
    expect(formArmorMultiplier('druid', 'cat')).toBe(0);
    expect(formArmorMultiplier('druid', 'caster')).toBe(0);
    expect(formArmorMultiplier('druid', 'moonkin')).toBe(0);
    // And no other class has forms at all.
    expect(formArmorMultiplier('warrior', 'bear')).toBe(0);
  });

  it('`bear` IS Dire Bear Form, which the base stats settle independently', () => {
    /*
     * ========================================================================
     * THE ENGINE FOLDS BEAR AND DIRE BEAR INTO ONE STYLE, so which tooltip
     * applies is a real question -- 180% against 360% is about 35,000 damage
     * taken a fight. It is answered by data this mechanism does not own.
     *
     * Dire Bear states +1,240 health; Bear states +180. The spreadsheet's own
     * per-form base stats carry the Dire Bear figure exactly, so the owner's
     * data had already chosen the form before this multiplier existed.
     * ========================================================================
     */
    for (const race of ['tauren', 'night_elf'] as const) {
      const variants = BASE_STATS[race]?.druid;
      if (!variants) continue;
      const caster = variants.find((v) => v.form === 'caster')!;
      const bear = variants.find((v) => v.form === 'bear')!;
      expect(bear.stats.hitPoints - caster.stats.hitPoints, race).toBe(1240);
    }
  });

  it('multiplies item armor AND Thick Hide, and nothing else', () => {
    /*
     * ASSERTED AS A DIFFERENCE AGAINST THE SAME CHARACTER WITHOUT THICK HIDE,
     * because the absolute armor figure is base armor plus gear plus talents
     * plus the multiplier and an expectation on it would be a claim about all
     * four. The RATIO is what this mechanism owns.
     */
    const built = PRESETS_BY_ID.get('druid_bear')!.build();
    const itemArmor = armorFromItems(built.equipment, 'bear');
    expect(itemArmor).toBeGreaterThan(0);

    const build = talentBuild(
      'druid',
      built.talents,
      talentContextFor(built.equipment, 'bear', {}, {
        characterClass: 'druid',
        talents: built.talents,
        level: MAX_CHARACTER_LEVEL,
      }),
    );
    expect(build.formScalableArmor.flat).toBeGreaterThan(0);

    const withForm = bearPlayer();
    const withoutThickHide = { ...built.talents };
    delete withoutThickHide.thick_hide;

    /*
     * THICK HIDE'S WHOLE CONTRIBUTION, multiplied. Its per-level half is flat
     * and its per-defense half is a conversion, so this covers both at once
     * and the two are asserted apart in `druidTalents.test.ts`.
     */
    const surplus = withForm.stats.get('defenseSkill');
    const thickHide = build.formScalableArmor.flat + build.formScalableArmor.perDefensePoint * surplus;
    const delta = withForm.stats.get('armor') - bearPlayer(withoutThickHide).stats.get('armor');
    expect(delta).toBeCloseTo(thickHide * (1 + 3.6), 4);
  });

  it('leaves a Cat on its item armor, which is the control', () => {
    /*
     * THE SAME GEAR AND THE SAME TALENTS IN A FORM WITH NO CLAUSE. Thick Hide
     * applies in Cat Form too, so the Cat gets the talent's armor and NOT the
     * multiplier -- which is the one comparison that separates "the form
     * multiplies" from "the talent got bigger".
     */
    const built = PRESETS_BY_ID.get('druid_bear')!.build();
    const cat = createPlayer({
      race: built.character.race as never,
      characterClass: 'druid',
      combatStyle: 'cat',
      talents: built.talents,
      equipment: built.equipment,
    });
    const bear = bearPlayer();
    expect(bear.stats.get('armor')).toBeGreaterThan(cat.stats.get('armor') * 2);
  });

  it('does not multiply armor that did not come from an item', () => {
    /*
     * THE OWNER'S EXISTING RULING, READ TWICE. An enchant's armor and a
     * potion's are not "armor from items" -- `armorFromItems` sums item stats
     * directly and has never counted either -- and the form's clause says
     * "Armor contribution from ITEMS", which is the same line.
     *
     * Asserted by adding armor the way a potion does and checking it arrives
     * ONCE rather than 4.6 times.
     */
    const bear = bearPlayer();
    const before = bear.stats.get('armor');
    bear.stats.addModifier({
      stat: 'armor',
      operation: 'flat',
      value: 450,
      sourceId: 'probe-potion',
    });
    expect(bear.stats.get('armor') - before).toBeCloseTo(450, 6);
  });
});
