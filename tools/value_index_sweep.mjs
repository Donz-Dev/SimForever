/*
 * ============================================================================
 * WHICH TALENTS READ A `valueIndex` INTO A MULTI-NUMBER ROW?
 *
 *   node tools/value_index_sweep.mjs
 *
 * Improved Mind Flay declared index 1 against a row of
 * [damage%, yards, slow%] and applied the YARDS as a damage multiplier for its
 * whole life. The Warlock's Aftermath reads index 2 -- a movement speed
 * reduction -- for Immolate's damage, and gets the right answer only because
 * at 5/5 that number happens to equal the one it wanted.
 *
 * NO EXISTING AUDIT CAN SEE THIS. The talent census has four columns and none
 * of them is "correct": a talent applying the wrong number is counted as fully
 * modelled. `coefficient_probe.ts` asks whether damage responds to a stat and
 * `ability_audit.ts` asks whether an ability is connected. Neither asks whether
 * a multiplier is the RIGHT multiplier -- and the plausible wrong value is
 * usually another rank's right one, so no figure ever looks odd.
 *
 * ----------------------------------------------------------------------------
 * IT IS A LISTER, NOT A CHECKER, AND THAT IS THE HONEST LIMIT. Whether an index
 * is right is a question about the TOOLTIP's placeholder order, which no
 * machine here can settle -- so this prints each site with its max-rank row and
 * its text, and a person reads them. Its `kind` column over-captures: the block
 * match runs to the next `],` and picks up kinds from the talent after. Read
 * the tooltip, not that column.
 *
 * A real test is the better end state, for the subset this can decide: a row
 * whose numbers are all DISTINCT, against an effect kind that implies a unit.
 * ============================================================================
 */
import { readFileSync, readdirSync } from 'node:fs';

const CLASSES = readdirSync('src/data/talents/values')
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

let sites = 0;
for (const cls of CLASSES) {
  const values = JSON.parse(readFileSync(`src/data/talents/values/${cls}.json`, 'utf8')).talents;
  const source = readFileSync(`src/game/talents/${cls}Effects.ts`, 'utf8');

  const lines = [];
  for (const [id, entry] of Object.entries(values)) {
    const rows = entry.values;
    // A single-number row has nothing to index wrongly.
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) continue;

    const at = source.indexOf(`\n  ${id}: [`);
    if (at < 0) continue;
    const block = source.slice(at, source.indexOf('\n  ],', at) + 5) || source.slice(at, at + 400);
    const indices = [...block.matchAll(/valueIndex:\s*(\d+)/g)].map((m) => Number(m[1]));
    if (indices.length === 0) continue;

    sites += 1;
    lines.push(
      `    ${id.padEnd(28)} reads [${indices.join(',')}]  of ${JSON.stringify(rows[rows.length - 1])}\n` +
        `      ${entry.text.replace(/\s+/g, ' ')}`,
    );
  }
  if (lines.length) {
    console.log(`\n=== ${cls} ===`);
    console.log(lines.join('\n'));
  }
}

console.log(`\n${sites} talents read an explicit index into a multi-number row.`);
console.log('Read each against its tooltip. The placeholder order IS the index order.');
