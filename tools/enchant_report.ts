/**
 * What enchant each preset actually carries, slot by slot.
 *
 * A one-off reading aid: the owner's table is a spreadsheet, and the only way
 * to check 28 rows x 10 columns is to print the same shape back. Not a test --
 * `tests/game/enchants.test.ts` is the one that fails.
 *
 * ============================================================================
 * IT COVERED NINE OF THE THIRTEEN ENCHANTABLE SLOTS AND SAID NOTHING ABOUT IT.
 *
 * The columns were hand-enumerated from the owner's spreadsheet, so
 * `mainHand`, `offHand`, `twoHand` and `shield` were simply absent -- and the
 * WEAPON carries the largest enchant in the project. The Arcane Mage's staff
 * holds **+65 Spell Power, worth about 41.8 DPS** at that build's measured
 * spell power weight, and the report whose whole job is to show enchants could
 * not show it. A tenth column read `shoulders`, which no enchant can target at
 * all, so the shape matched the spreadsheet while the coverage did not.
 *
 * **A HAND-ENUMERATED LIST OF SUBJECTS DECAYS SILENTLY**, which is the lesson
 * `rotationIds.test.ts` already paid for -- it was written to check four lists
 * and was still checking four when there were twenty-six. So the guard below
 * DERIVES the enchantable slots from the catalogue and throws if any of them is
 * in neither block. A new enchant slot now fails loudly instead of going
 * missing.
 *
 * THE SPREADSHEET'S SHAPE IS KEPT RATHER THAN WIDENED, because that is what
 * makes the first block checkable against the owner's own table by eye --
 * fourteen columns of eighteen characters does not fit a terminal. The weapons
 * get a second block, and `shoulders` stays in the first one even though
 * nothing can go there: the owner's column reads "None" and a report that
 * silently dropped it would no longer line up with theirs.
 * ============================================================================
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { ENCHANTS_BY_ID } from '../src/game/items/itemData';
import type { EquipmentSlot } from '../src/game/items/Item';

/** The owner's spreadsheet, column for column. `shoulders` has no options. */
const ARMOUR_COLUMNS: readonly EquipmentSlot[] = [
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

/** The four the spreadsheet does not have, and which carry the biggest enchants. */
const WEAPON_COLUMNS: readonly EquipmentSlot[] = ['mainHand', 'offHand', 'twoHand', 'shield'];

/*
 * EVERY SLOT AN ENCHANT CAN TARGET MUST BE IN ONE OF THE TWO BLOCKS.
 *
 * Derived from the catalogue rather than asserted against a second hand-written
 * list, because a second list is the same mistake with one more place to forget.
 */
const enchantable = new Set<string>();
for (const enchant of ENCHANTS_BY_ID.values()) {
  for (const slot of enchant.slots) enchantable.add(slot);
}
const covered = new Set<string>([...ARMOUR_COLUMNS, ...WEAPON_COLUMNS]);
const missing = [...enchantable].filter((slot) => !covered.has(slot)).sort();
if (missing.length > 0) {
  throw new Error(
    `enchant_report covers no column for: ${missing.join(', ')}. ` +
      'An enchant exists for those slots and this report would not show it.',
  );
}

const pad = (text: string, width: number) => text.padEnd(width);

/*
 * THE WIDTH IS PER BLOCK, because a weapon enchant's NAME is scraped and long --
 * "Enchant Weapon - Crusader" is 25 characters and silently overran an 18-wide
 * column, which is a report showing the wrong thing rather than nothing.
 */
function block(title: string, columns: readonly EquipmentSlot[], width: number): void {
  console.log(`\n-- ${title} --\n`);
  console.log(pad('profile', 16) + columns.map((slot) => pad(slot, width)).join(''));
  for (const preset of PROFILE_PRESETS) {
    const equipment = preset.build().equipment;
    const cells = columns.map((slot) => {
      const equipped = equipment[slot];
      if (!equipped) return pad('(no item)', width);
      if (equipped.enchantId === undefined) return pad('None', width);
      return pad(ENCHANTS_BY_ID.get(equipped.enchantId)?.name ?? '???', width);
    });
    console.log(pad(preset.label, 16) + cells.join(''));
  }
}

block("armour and ranged -- the owner's spreadsheet, column for column", ARMOUR_COLUMNS, 18);
block('weapons and shield -- not in the spreadsheet, and the biggest enchants here', WEAPON_COLUMNS, 30);
console.log('');
