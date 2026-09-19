#!/usr/bin/env node
/*
 * Fetch one spell's tooltip and print it in the shape
 * src/data/abilities/forever-warrior.json uses.
 *
 *   node tools/import_spell.mjs forever 25289
 *   node tools/import_spell.mjs classic 25289     # for comparing the two
 *   node tools/import_spell.mjs --verify          # re-fetch every spell on file
 *
 * WHY THIS EXISTS
 *
 * The Warrior ability spreadsheet gives costs, cooldowns and damage and NO
 * EFFECT MAGNITUDES, so ten abilities were castable and completely inert for
 * months. The standing plan was to borrow WoW Classic values and flag them.
 *
 * That turned out to be unnecessary. `nether.wowhead.com/forever/tooltip/item/`
 * was already known to serve Forever item data; the same host serves
 * `/forever/tooltip/spell/` and the Warrior's spells are all there, with real
 * Forever numbers. They are NOT the Classic ones -- Shield Wall is 60% for 12
 * seconds in Forever against 75% for 10 in Classic, and Shield Block runs 7
 * seconds and two attacks against 5 and one. Borrowing from Classic would have
 * produced confident, plausible, wrong figures for exactly the abilities the
 * project most wanted.
 *
 * WHAT IS STORED, AND WHAT IS NOT
 *
 * The tooltip TEXT, verbatim. This tool deliberately does not parse magnitudes
 * out of it: the sentences vary too much between abilities for a regex to be
 * trustworthy, and a mis-read magnitude is precisely the plausible wrong number
 * this project exists to avoid.
 *
 * A person reads the number out of the stored text into a named constant in
 * `src/game/auras/warrior.ts`, and a hand-written test asserts the constant
 * independently. `--verify` then re-fetches every spell and diffs the tooltip,
 * so the day Forever retunes one, it fails loudly. That matters: the talent
 * tree changed under this project once already (Bastion was removed) and was
 * found only by accident.
 */

const ENDPOINT = (game, id) => `https://nether.wowhead.com/${game}/tooltip/spell/${id}`;
const PAGE = (game, id) => `https://www.wowhead.com/${game}/spell=${id}`;
const DATA_FILE = 'src/data/abilities/forever-warrior.json';

/** Tooltip HTML to the plain text the data file stores. */
function toText(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(table|tr)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/*
 * The one thing worth pulling out mechanically: the description, which is the
 * last line of the tooltip and the only line that carries an effect magnitude.
 * Everything above it is cost, cast time, cooldown and requirements, all of
 * which the ability spreadsheet already gives authoritatively.
 *
 * Kept as a whole SENTENCE rather than a number. The number is transcribed by
 * hand into a named constant, where a reader can see it beside its source.
 */
function description(text) {
  const lines = text.split('\n');
  return lines[lines.length - 1] ?? '';
}

function parse(raw, game, id) {
  const text = toText(raw.tooltip);
  return {
    id: Number(id),
    name: raw.name,
    icon: raw.icon,
    source: PAGE(game, id),
    description: description(text),
    tooltip: text,
  };
}

async function fetchSpell(game, id) {
  const response = await fetch(ENDPOINT(game, id));
  if (!response.ok) throw new Error(`${game}/${id}: HTTP ${response.status}`);
  return parse(await response.json(), game, id);
}

const [mode, second] = process.argv.slice(2);

if (mode === '--verify') {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  let same = 0;
  for (const stored of data.spells) {
    const game = stored.source.includes('/forever/') ? 'forever' : 'classic';
    const fresh = await fetchSpell(game, stored.id);
    const differences = [];
    for (const key of ['name', 'description', 'tooltip']) {
      if (fresh[key] !== stored[key]) {
        differences.push(`${key}:\n    parsed ${JSON.stringify(fresh[key])}\n    stored ${JSON.stringify(stored[key])}`);
      }
    }
    if (differences.length) {
      console.log(`\n${stored.name} (${stored.id})`);
      for (const d of differences) console.log('  ' + d);
    } else same++;
  }
  console.log(`\n${same} of ${data.spells.length} spells reproduce exactly.`);
  if (same !== data.spells.length) process.exit(1);
} else if (mode && second) {
  console.log(JSON.stringify(await fetchSpell(mode, second), null, 1));
} else {
  console.error('usage: import_spell.mjs <forever|classic> <id>');
  console.error('       import_spell.mjs --verify');
  process.exit(1);
}
