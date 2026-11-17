import { ITEMS_BY_ID } from '../src/game/items/itemData';
for (const id of process.argv.slice(2).map(Number)) {
  const i = ITEMS_BY_ID.get(id)!;
  console.log('---', id, i.name, JSON.stringify(i.stats), 'unmodelled:', JSON.stringify(i.unmodelled.map((e) => e.text)));
  console.log(i.tooltip);
}
