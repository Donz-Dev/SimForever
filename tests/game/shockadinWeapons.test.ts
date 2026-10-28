import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SETS,
  BENCHMARK_TEMPLATES_BY_PRESET,
  benchmarkEquipmentFor,
  benchmarkItemsFor,
} from '../../src/game/items/benchmarkSets';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { equipExclusive } from '../../src/game/items/equipRules';

/**
 * ==============================================================================
 * THE SHOCKADIN'S TWO SETS OF HANDS, AND THE RULING THAT THEY ARE EXCLUSIVE.
 *
 * The owner asked for "a fast 2H ... an alternative to the template gear, not a
 * replacement", and then ruled on what holding it means: "You cannot ever have
 * the stats of both active. It's one or the other ... Equipping a 2H weapon
 * REMOVES the 1H+shield from the character planner equipped items."
 *
 * TWO LAYERS HAD TO AGREE AND ONLY ONE DID. `liveEquipment` has always stripped
 * whichever hands a style cannot fill, so the STATS were never doubled -- and
 * the equipment MAP could still carry a two-hander beside a one-hander, which
 * is what a person reads off the planner. "Resolved correctly at the point of
 * use" and "cannot be expressed" are different guarantees and the owner asked
 * for the second.
 * ==============================================================================
 */

const E65 = BENCHMARK_SETS.find((set) => set.id === 'E65')!;
const weaponsOf = (presetId: string) =>
  benchmarkItemsFor(BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!, E65).filter(
    // `weapon` is NULL on an armour piece, not undefined.
    (item) => item.weapon != null || item.subclass === 'Shield',
  );

describe("the Shockadin's fast two-hander", () => {
  it('is the Seal Twist Ret weapon rescaled to 2.0 speed at the same dps', () => {
    /*
     * THE OWNER'S SPECIFICATION, WORD FOR WORD: "similar to the Seal Twist Ret
     * weapon, except rescaled to be 2.0 swing speed with the same DPS."
     *
     * IT FALLS OUT OF THE GENERATOR RATHER THAN BEING TYPED IN. `weaponDamage`
     * takes the two-hand epic dps line and the speed and derives the range from
     * them, so "the same dps at a different speed" is `speed: 2.0` on a two-hand
     * plan and nothing else said. That is why this asserts the EQUALITY against
     * the Ret's weapon rather than the figure 61.5 -- a change to the dps line
     * should move both or neither.
     */
    const ret = weaponsOf('pally_ret').find((item) => item.inventoryType === 'Two-Hand')!;
    const fast = weaponsOf('pally_shockadin_2h').find((item) => item.inventoryType === 'Two-Hand')!;

    expect(ret.weapon!.speed).toBe(3.6);
    expect(fast.weapon!.speed).toBe(2);
    expect(fast.weapon!.dps).toBeCloseTo(ret.weapon!.dps, 1);
    // 61.5 dps at 2.0 seconds is 123 a swing, written out so the derivation is
    // checkable by hand rather than only against itself.
    expect((fast.weapon!.minDamage + fast.weapon!.maxDamage) / 2).toBeCloseTo(123, 0);
  });

  it('is NOT a caster weapon, which is what "the same DPS" decides', () => {
    /*
     * The shield build's one-hander trades 15.7 dps away for stats. A caster
     * two-hander would do the same and come out at 45.7 dps, which is not the
     * Ret's weapon rescaled -- so the plan carries no `caster` flag, and the
     * assertion is the dps it produces rather than the flag it does not set.
     */
    const oneHand = weaponsOf('pally_shockadin').find(
      (item) => item.inventoryType === 'One-Hand',
    )!;
    const fast = weaponsOf('pally_shockadin_2h').find((item) => item.inventoryType === 'Two-Hand')!;
    expect(fast.weapon!.dps).toBeGreaterThan(oneHand.weapon!.dps * 1.9);
  });

  it('is the ONLY thing in its hands, and the shield build has no two-hander', () => {
    /*
     * THE RULING, ASSERTED ON THE SETS THEMSELVES. A set carrying all three
     * would resolve correctly today and is the state the owner excluded.
     */
    const twoHand = benchmarkEquipmentFor('pally_shockadin_2h', 'E65')!;
    expect(twoHand.twoHand).toBeDefined();
    expect(twoHand.mainHand).toBeUndefined();
    expect(twoHand.shield).toBeUndefined();

    const shield = benchmarkEquipmentFor('pally_shockadin', 'E65')!;
    expect(shield.mainHand).toBeDefined();
    expect(shield.shield).toBeDefined();
    expect(shield.twoHand).toBeUndefined();
  });

  it('is the only difference between the two templates, so the armour matches', () => {
    /*
     * THE OWNER'S OTHER CONSTRAINT -- "don't change the gear beyond the two
     * weapon swaps I've identified" -- held by construction: the two templates
     * differ in exactly one field, and nothing about a weapon plan reaches the
     * eight armour slots, the trinkets or the hit spread. `RATING_SLOTS` is
     * armour and jewellery only.
     */
    const armour = (presetId: string) =>
      benchmarkItemsFor(BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!, E65)
        .filter((item) => item.weapon == null && item.subclass !== 'Shield')
        .map((item) => `${item.inventoryType}: ${item.effects.map((e) => e.text).join(', ')}`);

    expect(armour('pally_shockadin_2h')).toEqual(armour('pally_shockadin'));
  });

  it('is what the 2H preset actually wears, enchanted, at 2.0 speed', () => {
    const profile = PRESETS_BY_ID.get('pally_shockadin_2h')!.build();
    expect(profile.character.combatStyle).toBe('two_hander');
    expect(profile.equipment.mainHand).toBeUndefined();
    expect(profile.equipment.shield).toBeUndefined();
    expect(profile.equipment.twoHand?.enchantId).toBeDefined();
    expect(ITEMS_BY_ID.get(profile.equipment.twoHand!.itemId)?.weapon?.speed).toBe(2);

    // The one-hand Shockadin PRESET is gone (round 82); its template row stays,
    // and is what the `pally_shockadin` comparisons above read.
  });
});

describe('equipping a weapon displaces what it makes impossible', () => {
  /*
   * ============================================================================
   * THE RULE ITSELF, AWAY FROM THE PROFILE THAT MOTIVATED IT. It is about what
   * two hands can physically hold, so it is the same answer for every class and
   * every style -- and it is NOT a style rule: a caster holding a two-hander as
   * a stat stick is `liveEquipment`'s business, not this function's.
   * ============================================================================
   */
  const sword = { itemId: 1 };
  const board = { itemId: 2 };
  const greatsword = { itemId: 3 };

  it('removes the one-hander and the shield when a two-hander goes on', () => {
    const before = { mainHand: sword, shield: board, head: { itemId: 9 } };
    const after = equipExclusive(before, 'twoHand', greatsword);
    expect(after.twoHand).toBe(greatsword);
    expect(after.mainHand).toBeUndefined();
    expect(after.shield).toBeUndefined();
    // And nothing else is touched.
    expect(after.head).toEqual({ itemId: 9 });
  });

  it('removes the two-hander when either hand is filled', () => {
    for (const slot of ['mainHand', 'offHand', 'shield'] as const) {
      const after = equipExclusive({ twoHand: greatsword }, slot, sword);
      expect(after.twoHand, slot).toBeUndefined();
      expect(after[slot], slot).toBe(sword);
    }
  });

  it('displaces nothing when a slot is EMPTIED', () => {
    /*
     * Taking a two-hander off does not put a shield back on, and the asymmetry
     * is deliberate: the function knows what a slot excludes and nothing about
     * what used to be there.
     */
    const after = equipExclusive({ twoHand: greatsword, head: { itemId: 9 } }, 'twoHand', undefined);
    expect(after.twoHand).toBeUndefined();
    expect(after.head).toEqual({ itemId: 9 });
  });

  it('leaves an armour slot alone, which is every slot but the hands', () => {
    const before = { twoHand: greatsword, mainHand: sword };
    const after = equipExclusive(before, 'head', { itemId: 9 });
    expect(after.twoHand).toBe(greatsword);
    expect(after.mainHand).toBe(sword);
  });
});
