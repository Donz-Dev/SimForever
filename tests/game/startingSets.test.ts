import { describe, expect, it } from 'vitest';
import type { CombatStyleId } from '../../src/game/character';
import type { EquipmentSlot } from '../../src/game/items/Item';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { hasStartingEquipment, startingEquipmentFor } from '../../src/game/items/startingSets';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { validateProfile } from '../../src/profiles';
import { createDefaultProfile } from '../../src/profiles';

/*
 * The Warrior's starting set, transcribed BY HAND from the item data rather
 * than read out of startingSets.ts. A test that asked the set what the set said
 * would pass whatever the set said -- including pointing at an item that no
 * longer exists, which is the failure this is guarding against.
 */
const WARRIOR_ARMOUR: Partial<Record<EquipmentSlot, string>> = {
  head: 'Jaws of Might',
  neck: 'Onyxia Tooth Pendant',
  shoulders: 'Pauldrons of Might',
  cloak: 'Cape of the Black Baron',
  chest: 'Hauberk of Might',
  wrists: 'Armguards of Might',
  gloves: 'Hands of Might',
  waist: 'Sash of Might',
  legs: 'Leggings of Might',
  feet: 'Treads of Might',
  ring1: "Don Julio's Band",
  ring2: 'Quick Strike Ring',
  trinket1: "Blackhand's Breadth",
  trinket2: 'Hand of Justice',
  ranged: "Striker's Mark",
};

const WARRIOR_WEAPONS: Record<string, Partial<Record<EquipmentSlot, string>>> = {
  dual_wield: { mainHand: "Vis'kag the Bloodletter", offHand: 'Brutality Blade' },
  two_hander: { twoHand: 'Obsidian Edged Blade' },
  one_hand_shield: { mainHand: "Vis'kag the Bloodletter" },
};

const nameOf = (itemId: number) => ITEMS_BY_ID.get(itemId)?.name;

describe('the Warrior starting set', () => {
  for (const [style, weapons] of Object.entries(WARRIOR_WEAPONS)) {
    const expected = { ...WARRIOR_ARMOUR, ...weapons };

    it(`equips the right items for ${style}`, () => {
      const set = startingEquipmentFor('warrior', style as CombatStyleId);
      const actual: Record<string, string | undefined> = {};
      for (const [slot, equipped] of Object.entries(set)) {
        actual[slot] = equipped ? nameOf(equipped.itemId) : undefined;
      }
      expect(actual).toEqual(expected);
    });

    it(`puts every ${style} item in a slot it can actually go in`, () => {
      const set = startingEquipmentFor('warrior', style as CombatStyleId);
      for (const [slot, equipped] of Object.entries(set)) {
        const item = ITEMS_BY_ID.get(equipped!.itemId);
        expect(item, `${slot} points at a missing item`).toBeDefined();
        expect(item!.slots, `${item!.name} cannot go in ${slot}`).toContain(slot);
      }
    });
  }

  it('leaves the shield slot empty, because the item data has no shields', () => {
    /*
     * Deliberate. An invented shield would be worse than a visible gap, and the
     * gap is exactly where a person would look for one.
     */
    const set = startingEquipmentFor('warrior', 'one_hand_shield');
    expect(set.shield).toBeUndefined();
    expect([...ITEMS_BY_ID.values()].filter((item) => item.slots.includes('shield'))).toEqual([]);
  });

  it('gives nothing to a class with no curated set', () => {
    expect(startingEquipmentFor('mage', 'caster')).toEqual({});
    expect(hasStartingEquipment('mage')).toBe(false);
    expect(hasStartingEquipment('warrior')).toBe(true);
  });

  it('produces a profile that validates', () => {
    // The set goes onto a profile, so it has to survive the same checks a
    // hand-edited or imported one does.
    const profile = {
      ...createDefaultProfile(),
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    };
    expect(validateProfile(profile).ok).toBe(true);
  });

  it('actually arms the character it is given to', () => {
    const naked = createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield' });
    const geared = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });

    // Real weapons replace the placeholders outright.
    expect(geared.weapons.mainHand?.name).toBe("Vis'kag the Bloodletter");
    expect(geared.weapons.offHand?.name).toBe('Brutality Blade');
    // And the armour is worth something.
    expect(geared.stats.effective.attackPower).toBeGreaterThan(
      naked.stats.effective.attackPower,
    );
    expect(geared.stats.effective.armor).toBeGreaterThan(naked.stats.effective.armor);
  });
});
