/**
 * What share of a real healing item's budget goes on HEALING -- the measure
 * behind the healer templates' healing-power floor (round 52).
 *
 *   npx vite-node tools/healing_share.ts
 *
 * The stamina floor was set the same way (`tools/stamina_share.ts`): the owner
 * asked for a minimum and stated no figure, so the figure is what Forever's own
 * items spend. Healing is priced at 0.45, the transcribed cost that
 * `item_budget.ts` uses, and the "+N Spell Damage" rider a Forever healer
 * piece carries beside it is NOT charged -- `docs/itemization.md` found that
 * charging both lines treats one design decision as two purchases.
 */
import { ITEMS } from '../src/game/items/itemData';

const SLOT_MULTIPLIER: Readonly<Record<string, number>> = {
  head: 1.0, chest: 1.0, legs: 1.0,
  shoulders: 0.77, gloves: 0.77, waist: 0.77, feet: 0.77,
  wrists: 0.55, cloak: 0.55, neck: 0.55, ring1: 0.55,
};
const HEALING_COST = 0.45;
const EXPONENT = 1.5;
const base = (quality: number, ilvl: number) =>
  quality === 4 ? 0.77 * ilvl - 1 : quality === 3 ? 0.625 * ilvl - 1.15 : 0.5 * ilvl - 2;
const isClean = (tooltip: string) => !/Chance on hit|Use:|\(\d\) Set/m.test(tooltip);

const shares: { slot: string; share: number }[] = [];
for (const item of ITEMS) {
  if (item.id >= 9_500_000 || !isClean(item.tooltip)) continue;
  const slot = item.slots[0];
  if (!SLOT_MULTIPLIER[slot]) continue;
  const match = /\+(\d+) Healing\b/.exec(item.tooltip);
  if (!match) continue;
  const budget = base(item.quality, item.itemLevel) * SLOT_MULTIPLIER[slot];
  if (budget <= 0) continue;
  shares.push({ slot, share: (Number(match[1]) * HEALING_COST) ** EXPONENT / budget ** EXPONENT });
}
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
console.log(`${shares.length} clean captured pieces carrying "+N Healing"`);
for (const slot of Object.keys(SLOT_MULTIPLIER)) {
  const mine = shares.filter((row) => row.slot === slot).map((row) => row.share);
  if (mine.length) console.log(`${slot.padEnd(10)} n=${String(mine.length).padStart(3)}  median ${(100 * median(mine)).toFixed(1)}%`);
}
const all = shares.map((row) => row.share);
console.log(`ALL       n=${all.length}  median ${(100 * median(all)).toFixed(1)}%  p25 ${(100 * [...all].sort((a, b) => a - b)[Math.floor(all.length / 4)]).toFixed(1)}%`);
