/**
 * HOW MUCH OF AN ARMOUR ITEM'S BUDGET DOES FOREVER SPEND ON STAMINA?
 *
 * ==============================================================================
 * THE OWNER'S CLAIM, CHECKED: "Typically all armor class items have stamina --
 * and I believe the figure was around 10-15% of its item budget for those 8
 * slots."
 *
 * Two questions, and they want different arithmetic:
 *
 *   HOW MANY carry it at all -- a count, per slot.
 *   HOW MUCH it takes -- a share, and the share has to be measured in the units
 *   the budget is actually spent in.
 *
 * THE BUDGET IS SPENT AT THE 3/2 POWER: `budget^1.5 = sum((value x cost)^1.5)`.
 * So "stamina's share of the budget" is `(stamina x 1.0)^1.5 / budget^1.5` --
 * NOT `stamina / budget`, which is a different number entirely and about twice
 * as large at these magnitudes. Both are printed, because the owner's figure
 * could reasonably mean either and the two readings have to be told apart
 * before one of them is built into the generator.
 *
 * CLEAN ITEMS ONLY, by `item_budget.ts`'s own rule: a proc, an on-use or a set
 * bonus costs budget that nothing here can price, so an item carrying one reads
 * low through no fault of the ruleset.
 * ==============================================================================
 */
import { ITEMS } from '../src/game/items/itemData';
import { FOREVER_STAT_COST } from './foreverItems';

/** The eight armour slots the owner named. A cloak is reported apart. */
const ARMOUR_SLOTS = ['head', 'shoulders', 'chest', 'wrists', 'gloves', 'waist', 'legs', 'feet'];

const SLOT_MULTIPLIER: Readonly<Record<string, number>> = {
  head: 1.0,
  chest: 1.0,
  legs: 1.0,
  shoulders: 0.77,
  gloves: 0.77,
  waist: 0.77,
  feet: 0.77,
  wrists: 0.55,
  cloak: 0.55,
  neck: 0.55,
  ring1: 0.55,
  ring2: 0.55,
};

const EXPONENT = 1.5;

/** Quality base, from the owner's own table. */
function qualityBase(quality: number, itemLevel: number): number {
  if (quality === 4) return 0.77 * itemLevel - 1;
  if (quality === 3) return 0.625 * itemLevel - 1.15;
  return 0.5 * itemLevel - 2;
}

/** A proc, an on-use or a set bonus is budget this model cannot price. */
const isClean = (tooltip: string) =>
  !/Chance on hit|Chance on melee|Use:|\(\d\) Set|^\(\d\)/m.test(tooltip);

/**
 * PvP GEAR IS A DIFFERENT POPULATION AND IT DOMINATES THIS SAMPLE.
 *
 * ----------------------------------------------------------------------------
 * The first run of this tool put stamina at 37% of an armour item's budget,
 * against the owner's remembered 10-15% -- and 175 of the 177 waists in it are
 * PvP set pieces, because those sets are thirty items a slot built from a
 * handful of stat blocks while everything else is individually designed.
 *
 * `foreverItems.ts` already records the figures: the Premier PvP sets spend
 * **40.8%** of their budget on stamina against **14.0%** for Classic's own
 * epics. So the owner's recollection is about non-PvP gear, and a mean over the
 * blend is a number for a population that does not exist.
 *
 * NAMED BY PREFIX, which is what `item_budget.ts` does: every PvP piece in this
 * data is a "Premier", a Marshal/Field Marshal, a Warlord/High Warlord, a
 * Knight/Champion rank item or a Grand Marshal.
 * ----------------------------------------------------------------------------
 */
const PVP_NAME =
  /^(Premier |Grand Marshal|Field Marshal|Marshal|High Warlord|Warlord|Knight-|Champion|Lieutenant Commander|Legionnaire|Centurion|Sergeant|Blood Guard|Stone Guard|First Sergeant|Senior Sergeant|Master Sergeant|Knight |Knight's|Champion's)/;

interface Row {
  readonly pvp: boolean;
  readonly slot: string;
  readonly stamina: number;
  readonly budget: number;
  /** Stamina's share of the budget AT THE 3/2 POWER, which is how it is spent. */
  readonly powerShare: number;
  /** Stamina over the budget, linearly. The other reading. */
  readonly linearShare: number;
}

const rows: Row[] = [];
const withoutStamina: { slot: string; name: string }[] = [];

for (const item of ITEMS) {
  if (item.id >= 9_500_000) continue; // generated, not captured
  if (!item.stats.armor) continue; // armour pieces only
  if (!isClean(item.tooltip)) continue;

  const slot = item.slots[0];
  if (!SLOT_MULTIPLIER[slot]) continue;
  if (!ARMOUR_SLOTS.includes(slot) && slot !== 'cloak') continue;

  const budget = qualityBase(item.quality, item.itemLevel) * SLOT_MULTIPLIER[slot];
  if (budget <= 0) continue;

  const stamina = item.stats.stamina ?? 0;
  if (stamina === 0) {
    withoutStamina.push({ slot, name: item.name });
    continue;
  }

  const cost = FOREVER_STAT_COST.Stamina ?? 1;
  rows.push({
    pvp: PVP_NAME.test(item.name),
    slot,
    stamina,
    budget,
    powerShare: (stamina * cost) ** EXPONENT / budget ** EXPONENT,
    linearShare: (stamina * cost) / budget,
  });
}

const mean = (list: readonly number[]) => list.reduce((a, b) => a + b, 0) / list.length;
const median = (list: readonly number[]) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

console.log('CLEAN CAPTURED ARMOUR PIECES, by slot\n');
console.log(
  `${'slot'.padEnd(11)} ${'n'.padStart(5)} ${'none'.padStart(5)}  ` +
    `${'carry%'.padStart(7)}  ${'3/2 share'.padStart(10)}  ${'linear'.padStart(8)}`,
);

for (const slot of [...ARMOUR_SLOTS, 'cloak']) {
  const mine = rows.filter((row) => row.slot === slot);
  const none = withoutStamina.filter((row) => row.slot === slot).length;
  if (mine.length === 0 && none === 0) continue;
  const carry = (100 * mine.length) / (mine.length + none);
  console.log(
    `${slot.padEnd(11)} ${String(mine.length).padStart(5)} ${String(none).padStart(5)}  ` +
      `${carry.toFixed(1).padStart(6)}%  ` +
      `${(100 * mean(mine.map((r) => r.powerShare))).toFixed(1).padStart(9)}%  ` +
      `${(100 * mean(mine.map((r) => r.linearShare))).toFixed(1).padStart(7)}%`,
  );
}

/* ---------------------------------------------------------------- the split */
console.log('\nSPLIT BY POPULATION, over the eight slots\n');
for (const [label, want] of [['non-PvP', false], ['PvP sets', true]] as const) {
  const mine = rows.filter((row) => ARMOUR_SLOTS.includes(row.slot) && row.pvp === want);
  if (mine.length === 0) continue;
  console.log(
    `${label.padEnd(10)} n=${String(mine.length).padStart(4)}  ` +
      `3/2 share mean ${(100 * mean(mine.map((r) => r.powerShare))).toFixed(1)}% ` +
      `median ${(100 * median(mine.map((r) => r.powerShare))).toFixed(1)}%  |  ` +
      `linear mean ${(100 * mean(mine.map((r) => r.linearShare))).toFixed(1)}% ` +
      `median ${(100 * median(mine.map((r) => r.linearShare))).toFixed(1)}%`,
  );
}

const eight = rows.filter((row) => ARMOUR_SLOTS.includes(row.slot));
const eightNone = withoutStamina.filter((row) => ARMOUR_SLOTS.includes(row.slot));
console.log(`\nTHE EIGHT SLOTS TOGETHER: ${eight.length} carry stamina, ${eightNone.length} do not`);
console.log(
  `  carry it:      ${((100 * eight.length) / (eight.length + eightNone.length)).toFixed(1)}%`,
);
console.log(
  `  3/2 share:     mean ${(100 * mean(eight.map((r) => r.powerShare))).toFixed(1)}%, ` +
    `median ${(100 * median(eight.map((r) => r.powerShare))).toFixed(1)}%`,
);
console.log(
  `  linear share:  mean ${(100 * mean(eight.map((r) => r.linearShare))).toFixed(1)}%, ` +
    `median ${(100 * median(eight.map((r) => r.linearShare))).toFixed(1)}%`,
);

/* ------------------------------------------------- what a RESERVE would give */
console.log('\nA RESERVED SHARE OF THE BUDGET, against what Forever actually carries\n');
console.log(
  `${'slot'.padEnd(11)} ${'E65 budget'.padStart(10)}  ` +
    `${'@10%'.padStart(6)} ${'@12.5%'.padStart(7)} ${'@15%'.padStart(6)}  ` +
    `${'real median'.padStart(12)}  ${'its share'.padStart(10)}`,
);
const E65_BASE = 0.77 * 65 - 1;
for (const slot of ARMOUR_SLOTS) {
  const budget = E65_BASE * SLOT_MULTIPLIER[slot];
  const atShare = (share: number) => ((share * budget ** EXPONENT) ** (1 / EXPONENT)).toFixed(0);
  const real = rows.filter((row) => row.slot === slot && !row.pvp);
  const realMedian = real.length > 0 ? median(real.map((r) => r.stamina)) : 0;
  const realShare = real.length > 0 ? 100 * median(real.map((r) => r.powerShare)) : 0;
  console.log(
    `${slot.padEnd(11)} ${budget.toFixed(1).padStart(10)}  ` +
      `${atShare(0.1).padStart(6)} ${atShare(0.125).padStart(7)} ${atShare(0.15).padStart(6)}  ` +
      `${String(realMedian).padStart(12)}  ${realShare.toFixed(1).padStart(9)}%`,
  );
}
console.log(
  '\n  (a reserve is a share of budget^1.5, the currency the allocator spends in:' +
    '\n   stamina = (share * budget^1.5)^(2/3) / cost)',
);

if (eightNone.length > 0 && eightNone.length <= 30) {
  console.log('\nPIECES WITH NO STAMINA AT ALL:');
  for (const row of eightNone) console.log(`  ${row.slot.padEnd(10)} ${row.name}`);
}
