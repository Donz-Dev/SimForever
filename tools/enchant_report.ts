/**
 * What enchant each preset actually carries, slot by slot.
 *
 * A one-off reading aid: the owner's table is a spreadsheet, and the only way
 * to check 24 rows x 10 columns is to print the same shape back. Not a test --
 * `tests/game/enchants.test.ts` is the one that fails.
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { ENCHANTS_BY_ID } from '../src/game/items/itemData';
import type { EquipmentSlot } from '../src/game/items/Item';

const COLUMNS: readonly EquipmentSlot[] = [
  'head',
  'neck',
  'shoulders',
  'cloak',
  'chest',
  'wrists',
  'gloves',
  'legs',
  'feet',
  'ranged',
];

const pad = (text: string, width: number) => text.padEnd(width);

console.log(
  pad('profile', 16) + COLUMNS.map((slot) => pad(slot, 18)).join(''),
);

for (const preset of PROFILE_PRESETS) {
  const equipment = preset.build().equipment;
  const cells = COLUMNS.map((slot) => {
    const equipped = equipment[slot];
    if (!equipped) return pad('(no item)', 18);
    if (equipped.enchantId === undefined) return pad('None', 18);
    return pad(ENCHANTS_BY_ID.get(equipped.enchantId)?.name ?? '???', 18);
  });
  console.log(pad(preset.label, 16) + cells.join(''));
}
