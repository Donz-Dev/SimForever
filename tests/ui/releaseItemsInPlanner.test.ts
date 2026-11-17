import { describe, expect, it } from 'vitest';
import { pickerItems } from '../../src/ui/panels/gear/slots';
import { iconUrl } from '../../src/ui/panels/gear/ItemIcon';
import { ITEMS, itemsForSlot } from '../../src/game/items/itemData';
import { defaultValuationForPreset } from '../../src/game/items/defaultValuation';
import type { EquipmentSlot } from '../../src/game/items/Item';

/*
 * ==============================================================================
 * THE RELEASE CAPTURE IN THE GEAR PANEL (build 1.60.1.70959).
 *
 * The owner's three conditions on importing every rare and epic at item level
 * 50 and up, asserted against the data rather than against a hand-built item:
 *
 *   1. offered only to classes with the proficiency -- "once warlock is
 *      selected plate items should not populate on the list; once hunter is
 *      selected mace weapon should not populate on the list"
 *   2. the icons kept, "to be able to quickly parse items by appearance"
 *   3. search and the stat-weight sort unaffected
 * ==============================================================================
 */

const ARMOUR_SLOTS: readonly EquipmentSlot[] = ['head', 'shoulders', 'chest', 'wrists', 'gloves', 'waist', 'legs', 'feet'];
const WEAPON_SLOTS: readonly EquipmentSlot[] = ['mainHand', 'offHand', 'twoHand', 'ranged'];

const listFor = (
  characterClass: Parameters<typeof pickerItems>[0]['characterClass'],
  style: Parameters<typeof pickerItems>[0]['style'],
  slot: EquipmentSlot,
  presetId: string,
  search = '',
) =>
  pickerItems({
    slot,
    characterClass,
    style,
    valuation: defaultValuationForPreset(presetId),
    search,
    showUnusable: false,
  });

describe('the release items, offered by proficiency', () => {
  it('shows a Warlock no plate, mail or leather in any armour slot', () => {
    for (const slot of ARMOUR_SLOTS) {
      const rows = listFor('warlock', 'caster', slot, 'warlock_smds');
      expect(rows.length, slot).toBeGreaterThan(0);
      const worn = new Set(rows.map((row) => row.item.subclass));
      for (const forbidden of ['Plate', 'Mail', 'Leather']) expect(worn.has(forbidden), `${slot} ${forbidden}`).toBe(false);
    }
  });

  it('shows a Hunter no mace of either size, and still offers the data has plenty of', () => {
    // The data is full of maces -- the filter has something to refuse.
    const maces = WEAPON_SLOTS.flatMap((slot) => itemsForSlot(slot)).filter((item) => item.subclass === 'Mace');
    expect(maces.length).toBeGreaterThan(50);

    for (const slot of WEAPON_SLOTS) {
      for (const style of ['dual_wield', 'two_hander', 'ranged'] as const) {
        const rows = listFor('hunter', style, slot, 'bm_hunter');
        expect(rows.some((row) => row.item.subclass === 'Mace'), `${slot} ${style}`).toBe(false);
      }
    }
    // And it is offered the hunter weapons it may use.
    expect(listFor('hunter', 'ranged', 'ranged', 'bm_hunter').some((row) => row.item.subclass === 'Bow')).toBe(true);
  });

  it('shows a Warrior the plate a Warlock is refused', () => {
    expect(listFor('warrior', 'two_hander', 'chest', 'warrior_arms').some((row) => row.item.subclass === 'Plate')).toBe(true);
  });
});

describe('the release items keep their icons', () => {
  it('carries the client icon name on every captured item', () => {
    const captured = ITEMS.filter((item) => item.id < 9_500_000);
    expect(captured.length).toBeGreaterThan(3500);
    // The client's own name, which can carry a space ("insect in amber").
    const bare = captured.filter((item) => !/^[a-z0-9_ ]+$/i.test(item.icon ?? ''));
    expect(bare.map((item) => `${item.name} (${item.id})`)).toEqual([]);
  });

  it('turns a space in an icon name into the hyphen the icon CDN serves', () => {
    expect(iconUrl('trade_archaeology_insect in amber')).toBe(
      'https://wow.zamimg.com/images/wow/icons/medium/trade_archaeology_insect-in-amber.jpg',
    );
    expect(iconUrl('inv_gauntlets_30')).toBe('https://wow.zamimg.com/images/wow/icons/medium/inv_gauntlets_30.jpg');
  });
});

describe('search and the stat-weight sort over the release items', () => {
  it('sorts every slot by value, most valuable first, for a melee and a caster build', () => {
    for (const [characterClass, style, preset] of [
      ['warrior', 'two_hander', 'warrior_arms'],
      ['mage', 'caster', 'mage_fire'],
    ] as const) {
      for (const slot of [...ARMOUR_SLOTS, 'ring1', 'trinket1', 'neck', 'back'] as EquipmentSlot[]) {
        const scores = listFor(characterClass, style, slot, preset).map((row) => row.score);
        expect(scores.every(Number.isFinite), `${preset} ${slot}`).toBe(true);
        for (let i = 1; i < scores.length; i += 1) expect(scores[i]!, `${preset} ${slot}`).toBeLessThanOrEqual(scores[i - 1]!);
      }
    }
  });

  it('finds a release item by part of its name, ignoring case, and nothing else', () => {
    // Feralheart is a Druid set new to the data; a Druid is offered it.
    const rows = listFor('druid', 'cat', 'head', 'druid_cat', 'FERALHEART');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.item.name.toLowerCase().includes('feralheart'))).toBe(true);
  });
});
