import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SETS,
  BENCHMARK_TEMPLATES_BY_PRESET,
  benchmarkEquipmentFor,
  benchmarkItemsFor,
} from '../../src/game/items/benchmarkSets';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { liveEquipment } from '../../src/game/items/equipment';

/**
 * ==============================================================================
 * THE SHOCKADIN'S TWO WEAPON CONFIGURATIONS, WHICH ARE ONE SET OF GEAR.
 *
 * The owner asked for "a fast 2H ... an alternative to the template gear, not a
 * replacement", swappable "at will". That is expressed as a second weapon plan
 * on the template rather than as a second set: `twoHand` and `mainHand`/`shield`
 * are different slots, `liveEquipment` strips whichever the combat style cannot
 * fill, and flipping `combatStyle` is therefore the whole mechanism.
 *
 * WHAT COULD GO WRONG IS SILENT IN BOTH DIRECTIONS. A set that stopped carrying
 * the alternate looks like a set; a style that failed to strip the loser would
 * hand the character two weapons' stats and still produce an ordinary figure.
 * Both are asserted here.
 * ==============================================================================
 */

const E65 = BENCHMARK_SETS.find((set) => set.id === 'E65')!;
const weaponsOf = (presetId: string) =>
  benchmarkItemsFor(BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!, E65).filter(
    (item) => item.weapon != null || item.subclass === 'Shield',
  );

describe("the Shockadin's fast two-hander", () => {
  it('is the Seal Twist Ret weapon rescaled to 2.0 speed at the same dps', () => {
    /*
     * THE OWNER'S SPECIFICATION, WORD FOR WORD: "similar to the Seal Twist Ret
     * weapon, except rescaled to be 2.0 swing speed with the same DPS."
     *
     * IT FALLS OUT OF THE GENERATOR RATHER THAN BEING TYPED IN. `weaponDamage`
     * takes the two-hand epic dps line and the speed and derives the damage
     * range from them, so "the same dps at a different speed" is `speed: 2.0`
     * on a two-hand plan and nothing else said. That is why this asserts the
     * EQUALITY against the Ret's weapon rather than the figure 61.5 -- a change
     * to the dps line should move both or neither.
     */
    const ret = weaponsOf('pally_ret').find((item) => item.inventoryType === 'Two-Hand')!;
    const fast = weaponsOf('pally_shockadin').find((item) => item.inventoryType === 'Two-Hand')!;

    expect(ret.weapon!.speed).toBe(3.6);
    expect(fast.weapon!.speed).toBe(2);
    expect(fast.weapon!.dps).toBeCloseTo(ret.weapon!.dps, 1);
    // 61.5 dps at 2.0 seconds is 123 a swing, written out so the derivation is
    // checkable by hand rather than only against itself.
    expect((fast.weapon!.minDamage + fast.weapon!.maxDamage) / 2).toBeCloseTo(123, 0);
  });

  it('is NOT a caster weapon, which is what "the same DPS" decides', () => {
    /*
     * The one-hander above it trades 15.7 dps away for stats. A caster
     * two-hander would do the same and come out at 45.7 dps, which is not the
     * Ret's weapon rescaled -- so the alternate plan carries no `caster` flag
     * and the assertion is the dps it produces.
     */
    const oneHand = weaponsOf('pally_shockadin').find(
      (item) => item.inventoryType === 'One-Hand',
    )!;
    const fast = weaponsOf('pally_shockadin').find((item) => item.inventoryType === 'Two-Hand')!;
    expect(fast.weapon!.dps).toBeGreaterThan(oneHand.weapon!.dps * 1.9);
  });

  it('is in BOTH Shockadin sets, beside the one-hander and the shield', () => {
    for (const presetId of ['pally_shockadin', 'pally_shockadin_2h']) {
      const kinds = weaponsOf(presetId).map((item) => item.subclass ?? item.inventoryType);
      expect(kinds, presetId).toHaveLength(3);
      expect(kinds.filter((k) => k === 'Shield'), presetId).toHaveLength(1);

      const equipment = benchmarkEquipmentFor(presetId, 'E65')!;
      expect(equipment.twoHand, presetId).toBeDefined();
      expect(equipment.mainHand, presetId).toBeDefined();
      expect(equipment.shield, presetId).toBeDefined();
    }
  });

  it('is the only difference between the two templates, so the armour matches', () => {
    /*
     * THE OWNER'S OTHER CONSTRAINT -- "don't change the gear beyond the two
     * weapon swaps I've identified" -- held by construction: the two templates
     * differ in exactly which weapon plan is primary, and nothing about a
     * weapon plan reaches the eight armour slots, the trinkets or the hit
     * spread. `RATING_SLOTS` is armour and jewellery only.
     */
    const armour = (presetId: string) =>
      benchmarkItemsFor(BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!, E65)
        .filter((item) => item.weapon == null && item.subclass !== 'Shield')
        .map((item) => `${item.inventoryType}: ${item.effects.map((e) => e.text).join(', ')}`);

    expect(armour('pally_shockadin_2h')).toEqual(armour('pally_shockadin'));
  });

  it('yields to the style, so neither configuration pays for the other', () => {
    /*
     * A CHARACTER CANNOT HOLD BOTH, and the check is that the LOSER contributes
     * nothing -- not merely that the winner is there. `probe_shockadin.ts`
     * measured the point from the other side: changing the two-hand enchant on
     * the shield profile runs BIT-IDENTICAL FIGHTS.
     */
    const equipment = benchmarkEquipmentFor('pally_shockadin', 'E65')!;

    const shield = liveEquipment(equipment, 'one_hand_shield');
    expect(shield.twoHand).toBeUndefined();
    expect(shield.mainHand).toBeDefined();
    expect(shield.shield).toBeDefined();

    const twoHand = liveEquipment(equipment, 'two_hander');
    expect(twoHand.twoHand).toBeDefined();
    expect(twoHand.mainHand).toBeUndefined();
    expect(twoHand.shield).toBeUndefined();
  });

  it('is what each preset actually wears, and both are enchanted', () => {
    /*
     * THE ENCHANT ON THE SLOT THAT IS NOT IN USE IS THE ONE THAT GOES MISSING,
     * because nothing reads it -- so a loadout naming only the live weapon
     * would make flipping the style silently drop +65 spell power, which is the
     * same hole the benchmark buttons had once and just as invisible.
     */
    for (const presetId of ['pally_shockadin', 'pally_shockadin_2h']) {
      const profile = PRESETS_BY_ID.get(presetId)!.build();
      expect(profile.equipment.twoHand?.enchantId, presetId).toBeDefined();
      expect(profile.equipment.mainHand?.enchantId, presetId).toBeDefined();
      expect(ITEMS_BY_ID.get(profile.equipment.twoHand!.itemId)?.weapon?.speed, presetId).toBe(2);
    }
  });

  it('is held by the 2H profile and carried by the shield profile', () => {
    expect(PRESETS_BY_ID.get('pally_shockadin')!.build().character.combatStyle).toBe(
      'one_hand_shield',
    );
    expect(PRESETS_BY_ID.get('pally_shockadin_2h')!.build().character.combatStyle).toBe(
      'two_hander',
    );
  });
});
