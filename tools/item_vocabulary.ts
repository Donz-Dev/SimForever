/**
 * WHICH ITEM LINES DOES THE PARSER NOT READ?
 *
 * ==============================================================================
 * THE CHEAP CHECK FOR A VOCABULARY GAP, which is this project's quietest way to
 * lose a stat. `itemData` keeps an effect it cannot read in `Item.unmodelled`
 * with the source's own words, so nothing is ever guessed at -- and an unread
 * line is indistinguishable from an unreadABLE one until somebody looks.
 *
 * It has cost four stats already, every one found this way:
 *
 *   - 1,384 SPELL POWER LINES. Classic writes "Increases damage and healing
 *     done by magical spells and effects by up to 40" and that sentence was the
 *     only rule; Forever writes "+94 Spell Power".
 *   - 12 RANGED ATTACK POWER LINES, including a Hunter's own bow. The rule said
 *     "+48 ranged Attack Power." and Forever writes a capital R.
 *   - 160 MANA REGENERATION LINES, whose unit the capture's own `classicLines`
 *     settled: Classic's "Restores 4 mana per 5 sec." is Forever's "+4 Mana
 *     Regeneration", the same number.
 *   - 2 WEAPON SKILL LINES. Classic writes "Increased Daggers +3." and Forever
 *     writes "+3 Daggers Skill".
 *
 * GROUPED BY SHAPE RATHER THAN BY TEXT -- every number becomes `N` -- so a
 * hundred spell power lines are one row and a one-off proc is one row too. A
 * list of 4,000 distinct sentences is what made this invisible before.
 *
 * READ THE TOP OF THE LIST. A shape with a large count is a RULE the parser is
 * missing; a shape with a count of one is usually a genuine proc or set bonus
 * that no rule could express, and those are listed with their items so the
 * judgement is possible.
 *
 * AND THE GENERATED GEAR IS REPORTED TOO, WHICH IT WAS NOT.
 * ------------------------------------------------------------------------------
 * The benchmark items were EXCLUDED here, on the reasoning that an unread line
 * on a generated item is a bug in `benchmarkGear.ts` rather than a gap in the
 * parser's vocabulary. That reasoning is correct and the exclusion was still
 * wrong: it is the generator that writes a line nobody has taught the parser to
 * read, so excluding it hides exactly the bug it is most likely to have.
 *
 * It hid one for a commit. **Every benchmark set lost all of its primaries** --
 * a Warrior's E65 came out as 328 Critical Strike Rating and no strength,
 * stamina or agility, because "+19 Strength" matched no rule. The two
 * populations are reported separately now, because the ACTION differs: a
 * captured gap wants a new rule, and a generated one wants either a rule or a
 * different line.
 * ==============================================================================
 */
import { ITEMS } from '../src/game/items/itemData';

/** A line's shape: its words, with every number replaced by `N`. */
const shapeOf = (text: string) =>
  text
    .replace(/\d+(\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();

interface Shape {
  n: number;
  readonly items: string[];
}

const BENCHMARK_ID_FLOOR = 9_500_000;

function census(items: typeof ITEMS) {
  const shapes = new Map<string, Shape>();
  let lines = 0;
  for (const item of items) {
    for (const effect of item.unmodelled) {
      const key = shapeOf(effect.text);
      const row = shapes.get(key) ?? { n: 0, items: [] };
      row.n += 1;
      if (row.items.length < 3) row.items.push(`${item.id} ${item.name}`);
      shapes.set(key, row);
      lines += 1;
    }
  }
  return { shapes: [...shapes.entries()].sort((a, b) => b[1].n - a[1].n), lines };
}

const limit = Number(process.env.LIMIT ?? 40);

function report(label: string, items: typeof ITEMS, showAll: boolean) {
  const { shapes, lines } = census(items);
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${label}: ${items.length} items, ${lines} unread lines, ${shapes.length} shapes`);
  console.log('='.repeat(78));
  if (shapes.length === 0) {
    console.log('  Nothing unread. Every line on every one of these items is applied.');
    return;
  }
  const show = showAll ? shapes : shapes.slice(0, limit);
  for (const [key, row] of show) {
    console.log(`${String(row.n).padStart(5)}  ${key.slice(0, 104)}`);
    if (row.n <= 4) console.log(`       ${row.items.join(' | ')}`);
  }
  if (!showAll && shapes.length > limit) {
    console.log(`  ... ${shapes.length - limit} more shapes. LIMIT= to see them.`);
  }
  const singles = shapes.filter(([, row]) => row.n === 1).length;
  console.log(`\n  ${singles} shapes occur once -- usually a real proc or set bonus.`);
  console.log(`  ${shapes.length - singles} occur more than once, which is where a missing RULE shows up.`);
}

report(
  'CAPTURED ITEMS -- a repeated shape here is a rule the parser is missing',
  ITEMS.filter((item) => item.id < BENCHMARK_ID_FLOOR),
  false,
);

/*
 * EVERY ONE OF THESE SHOULD BE EMPTY. A benchmark item's tooltip is written by
 * `LINE` in `benchmarkGear.ts`, so an unread line means the generator and the
 * parser disagree -- which is a stat the set is paying budget for and not
 * granting. `benchmarkGear.test.ts` asserts the count is zero; this prints
 * WHICH, which is what makes it fixable.
 */
report(
  'GENERATED BENCHMARK GEAR -- any shape here is a stat the set paid for and lost',
  ITEMS.filter((item) => item.id >= BENCHMARK_ID_FLOOR),
  true,
);
