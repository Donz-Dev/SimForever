import { ITEMS } from '../src/game/items/itemData';
import { canEquip } from '../src/game/items/equipRules';
import type { ClassId } from '../src/game/character/ids';
import type { EquipmentSlot, Item } from '../src/game/items/Item';

/**
 * WHAT A REAL SET OF A GIVEN ITEM LEVEL ACTUALLY CARRIES, slot by slot.
 *
 * ==============================================================================
 * THE QUESTION THIS ANSWERS IS "IS THE BENCHMARK REALISTIC", which is the
 * owner's own standard -- "if 750 isn't reachable that's fine. I want it to be
 * realistic." A target figure cannot be checked against anything; a
 * distribution of real Forever items at the same item level can.
 *
 * ------------------------------------------------------------------------------
 * THE MEDIAN IS THE ANSWER AND THE MAXIMUM IS NOT. Taking the single richest
 * spell-power item in every slot across the whole database gives a CEILING that
 * no real character wears: it cherry-picks across factions, raids and
 * professions, and it is what a first pass at this reported. The median over
 * the items that carry the stat at all is "what a piece of this kind looks
 * like", and the sum of the medians is a set somebody could actually assemble.
 *
 * BOTH ARE PRINTED, because the gap between them is the thing to read: a
 * benchmark set sitting at the median is ordinary gear and one sitting at the
 * ceiling is the best in the game, and a BENCHMARK should be the latter without
 * exceeding it.
 *
 * ------------------------------------------------------------------------------
 * ONLY THE ITEMS THAT CARRY THE STAT ARE COUNTED. A median over every cloth
 * chest including the healing ones would be zero on most slots and would say
 * nothing about what a damage caster wears. `n` is printed beside every row so
 * a median resting on two items is visible as such.
 *
 *   npx vite-node tools/real_set_shape.ts
 *   STAT=critRating CLASS=warrior LEVELS=60-70 npx vite-node tools/real_set_shape.ts
 * ==============================================================================
 */

const STAT = (process.env.STAT ?? 'spellPower') as 'spellPower' | 'critRating' | 'attackPower';
const CLASS = (process.env.CLASS ?? 'mage') as ClassId;
const [LOW, HIGH] = (process.env.LEVELS ?? '60-70').split('-').map(Number);

const SLOTS: readonly EquipmentSlot[] = [
  'head', 'neck', 'shoulders', 'cloak', 'chest', 'wrists', 'gloves',
  'waist', 'legs', 'feet', 'ring1', 'ring2', 'trinket1', 'trinket2',
];

/**
 * School-scoped spell power counts.
 *
 * "Increases damage done by Shadow spells by up to 39" is not in `stats` --
 * `STAT_NAMES` is a closed flat set -- and leaving it out would read half the
 * caster items in the database as carrying no spell power at all. The MAXIMUM
 * over the schools rather than the sum: an item naming two schools grants two
 * pools and a character casts one of them.
 */
function amount(item: Item): number {
  const flat = (item.stats as Record<string, number | undefined>)[STAT] ?? 0;
  if (STAT !== 'spellPower') return flat;
  const school = Object.values(item.schoolPower).reduce((best, v) => Math.max(best, v ?? 0), 0);
  return flat + school;
}

/**
 * PvP sets are excluded from the median.
 *
 * `item_budget.ts` found them to be a different population -- 40.8% of their
 * budget is stamina against 14.0% for Classic's own epics -- and they come in
 * blocks of 30 near-identical pieces, so leaving them in would weight the
 * median towards one designer's template rather than towards the range.
 */
const isPvp = (item: Item) =>
  /^(Premier |High Warlord|Grand Marshal|Field Marshal|Warlord's|Marshal's|Champion's|Lieutenant Commander|Knight-|Centurion's|Legionnaire's|Sergeant |Blood Guard)/.test(
    item.name,
  );

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

console.log(
  `${STAT} on real Forever items a ${CLASS} can equip, item level ${LOW}-${HIGH}, PvP excluded\n`,
);
console.log(
  ['slot'.padEnd(10), 'n'.padStart(4), 'median'.padStart(7), 'p75'.padStart(5), 'max'.padStart(5)].join(' '),
);
console.log('-'.repeat(36));

let medianTotal = 0;
let p75Total = 0;
let maxTotal = 0;

const report = (label: string, slot: EquipmentSlot) => {
  const values = ITEMS.filter(
    (item) =>
      item.id < 9_500_000 &&
      item.slots.includes(slot) &&
      canEquip(CLASS, item, slot) &&
      item.itemLevel >= LOW &&
      item.itemLevel <= HIGH &&
      !isPvp(item) &&
      amount(item) > 0,
  ).map(amount);

  const sorted = [...values].sort((a, b) => a - b);
  const med = median(values);
  const p75 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))] : 0;
  const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  medianTotal += med;
  p75Total += p75;
  maxTotal += max;

  console.log(
    [
      label.padEnd(10),
      String(values.length).padStart(4),
      med.toFixed(1).padStart(7),
      String(p75).padStart(5),
      String(max).padStart(5),
    ].join(' '),
  );
};

for (const slot of SLOTS) report(slot, slot);
report('weapon', 'twoHand');

console.log('-'.repeat(36));
console.log(
  `${'SET TOTAL'.padEnd(10)} ${''.padStart(4)} ${medianTotal.toFixed(1).padStart(7)} ` +
    `${String(p75Total).padStart(5)} ${String(maxTotal).padStart(5)}`,
);
console.log(
  '\nmedian = an ordinary piece of that kind; p75 = a good one; ' +
    'max = the single best in the database.',
);
