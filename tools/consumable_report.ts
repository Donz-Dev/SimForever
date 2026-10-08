/**
 * What consumable each preset opens with, category by category.
 *
 * A reading aid for the one thing a test cannot check: whether a row is
 * SENSIBLE. `tests/game/consumables.test.ts` pins that each row is legal, that
 * every entry resolves and that nothing lands outside its category; this is
 * what shows a person the twelve columns at once.
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { CONSUMABLE_CATEGORIES, CONSUMABLES_BY_ID } from '../src/game/buffs/consumables';

const WIDTH = 24;
const pad = (text: string) => text.padEnd(WIDTH);

console.log(pad('profile') + CONSUMABLE_CATEGORIES.map((c) => pad(c.name)).join(''));

for (const preset of PROFILE_PRESETS) {
  const selection = preset.build().consumables;
  const cells = CONSUMABLE_CATEGORIES.map((category) => {
    const id = selection[category.id];
    if (!id) return pad('—');
    return pad(CONSUMABLES_BY_ID.get(id)?.name ?? '???');
  });
  console.log(pad(preset.label) + cells.join(''));
}
