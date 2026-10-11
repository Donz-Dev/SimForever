/**
 * What the loader made of an item. `ITEMS=19321,21126 npx vite-node tools/item_show.ts`
 *
 * A reading aid for writing a test: the point of the item tests is that every
 * number in them is transcribed from the TOOLTIP by hand, so this prints the
 * tooltip beside the parse rather than instead of it -- read the left, write
 * the test, and let the right half be what the assertion is checked against.
 */
import { ITEMS_BY_ID, ITEMS } from '../src/game/items/itemData';

const ids = (process.env.ITEMS ?? '')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((id) => Number.isFinite(id) && id > 0);

const named = (process.env.NAME ?? '').toLowerCase();

const chosen = named
  ? ITEMS.filter((item) => item.name.toLowerCase().includes(named))
  : ids.map((id) => ITEMS_BY_ID.get(id)).filter((item) => item !== undefined);

for (const item of chosen) {
  if (!item) continue;
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${item.id}  ${item.name}   [${item.slots.join(', ')}]  ilvl ${item.itemLevel}`);
  console.log('-'.repeat(78));
  console.log(item.tooltip);
  console.log('-'.repeat(78));
  console.log('stats      ', JSON.stringify(item.stats));
  if (Object.keys(item.schoolPower).length > 0) console.log('schoolPower', JSON.stringify(item.schoolPower));
  if (Object.keys(item.styleStats ?? {}).length > 0) console.log('styleStats ', JSON.stringify(item.styleStats));
  if (Object.keys(item.resistances).length > 0) console.log('resistances', JSON.stringify(item.resistances));
  if (item.weapon) console.log('weapon     ', JSON.stringify(item.weapon));
  for (const effect of item.unmodelled) {
    console.log(`UNREAD     "${effect.text}"`);
    console.log(`           ${effect.reason}`);
  }
}
if (chosen.length === 0) console.log('nothing matched. Set ITEMS= or NAME=');
