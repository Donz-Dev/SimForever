/*
 * Import a class's spellbook from the WoW Forever BETA CLIENT.
 *
 *   node tools/import_forever_spells.mjs rogue            print the max ranks
 *   node tools/import_forever_spells.mjs rogue --write    write the JSON
 *   node tools/import_forever_spells.mjs --all --write    every class
 *
 * ----------------------------------------------------------------------------
 * STEP 3 OF docs/class-implementation.md, which used to say "not yet a tool".
 *
 * Two files, both static and both reachable with plain `fetch`:
 *
 *   spellbooks.js   which spells a class has, and at which ranks
 *   spelldesc.js    what each one costs, casts and does, keyed
 *                   "Class|Name|Rank"
 *
 * WHAT IT TAKES AND WHY. Only the MAX RANK of each spell, because the
 * simulator runs at level 60 and no other rank can apply. That is also the
 * single trap this data set has: a talent tooltip and a spellbook page both
 * show RANK 1 of a talent-granted ability, and reading one cost this project
 * three separate arguments -- Mortal Strike 85 against 160, Bloodthirst 30
 * against 48, Shield Slam 421-439 against 640-670. Taking the max rank by
 * construction is what stops a fourth.
 *
 * WHAT IT DOES NOT HAVE. The effect ROWS -- the raw base points behind a
 * tooltip -- which is where Revenge's 153 and Bloodthirst's 48 came from when
 * Forever's own description rendered "(100% of Spell Power)" instead of a
 * number. This source renders the real numbers instead, so the artifact does
 * not arise; where a number still cannot be read, go to the spell page.
 * ----------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SPELLBOOKS = 'https://talentsforever.com/spellbooks.js';
const DESCRIPTIONS = 'https://talentsforever.com/spelldesc.js';

const CLASSES = [
  'warrior', 'paladin', 'hunter', 'rogue',
  'priest', 'shaman', 'mage', 'warlock', 'druid',
];

async function loadGlobal(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'SimForever-import' } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const scope = {};
  new Function('window', await res.text())(scope);
  return scope;
}

/** "Rank 8" -> 8, and a spell with no rank -> 0 so it sorts below rank 1. */
const rankNumber = (rank) => Number(/\d+/.exec(rank ?? '')?.[0] ?? 0);

/**
 * The cost/range/cast/cooldown lines, which arrive as a 2x2 grid of strings.
 *
 * Each cell is free text -- "45 Energy", "Melee Range", "Instant", "6 sec
 * cooldown" -- and any of them can be empty. Sorted into named fields by what
 * they say rather than by position, because position is not stable: a spell
 * with no cost puts its range where the cost would be.
 */
function readLines(lines) {
  const cells = (lines ?? []).flat().map((cell) => String(cell).trim()).filter(Boolean);
  const out = {
    cost: undefined,
    range: undefined,
    cast: undefined,
    cooldown: undefined,
    requires: undefined,
  };

  for (const cell of cells) {
    /*
     * `requires` IS MATCHED FIRST AND HAS ITS OWN FIELD. The grid has a third
     * row for a requirement -- "Requires Daggers", "Requires Stealth" -- and
     * without this it falls through to the cost, which is the last branch.
     * Mutilate then reported its cost as "Requires Daggers" and its real 60
     * Energy vanished: a free ability, silently.
     */
    if (/^Requires /i.test(cell)) out.requires = cell;
    else if (/cooldown/i.test(cell)) out.cooldown = cell;
    else if (/^instant$|sec cast|min cast|channel/i.test(cell)) out.cast = cell;
    else if (/range|yd|melee/i.test(cell)) out.range = cell;
    else out.cost = cell;
  }
  return out;
}

function importClass(className, spellbooks, descriptions) {
  const key = className[0].toUpperCase() + className.slice(1);
  const book = spellbooks[key];
  if (!book) throw new Error(`no spellbook for ${className}`);

  /*
   * MAX RANK ONLY, chosen per NAME across every tab. A spell can appear in
   * more than one tab, and the ranks are listed ascending, so the last one
   * seen for a name is the one a level 60 trains.
   */
  const best = new Map();
  for (const tab of book.tabs ?? []) {
    for (const [name, rank] of tab.spells ?? []) {
      const previous = best.get(name);
      if (!previous || rankNumber(rank) >= rankNumber(previous.rank)) {
        best.set(name, { name, rank: rank ?? '', tab: tab.name });
      }
    }
  }

  const spells = [];
  for (const entry of [...best.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const description = descriptions[`${key}|${entry.name}|${entry.rank}`];
    if (!description) continue;

    const lines = readLines(description.l);
    spells.push({
      id: description.id,
      name: entry.name,
      rank: rankNumber(entry.rank) || null,
      tab: entry.tab,
      level: description.lv ?? null,
      school: description.sc ?? null,
      ...lines,
      description: description.d ?? '',
      // How it compares with Classic: "same", "changed", "new".
      versusClassic: description.cs ?? null,
    });
  }

  return {
    class: className,
    source: DESCRIPTIONS,
    build: book.build ?? null,
    note:
      'Max rank only. The simulator runs at level 60, and a talent tooltip ' +
      'shows rank 1 of the ability it grants -- see docs/class-implementation.md.',
    spells,
  };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const write = args.includes('--write');
const targets = args.includes('--all') ? CLASSES : args.filter((a) => !a.startsWith('--'));

if (targets.length === 0) {
  console.log('usage: node tools/import_forever_spells.mjs <class> [--write] | --all --write');
  process.exit(1);
}

const [{ SPELLBOOKS: books }, { SPELL_DESC: descriptions }] = await Promise.all([
  loadGlobal(SPELLBOOKS),
  loadGlobal(DESCRIPTIONS),
]);

for (const className of targets) {
  const data = importClass(className, books, descriptions);
  const changed = data.spells.filter((s) => s.versusClassic && s.versusClassic !== 'same').length;
  console.log(
    `${className.padEnd(8)} ${String(data.spells.length).padStart(3)} spells, ` +
      `${changed} differ from Classic  (build ${data.build})`,
  );

  if (write) {
    const path = `src/data/abilities/forever-${className}-spellbook.json`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);
  } else if (targets.length === 1) {
    for (const spell of data.spells) {
      const cost = [spell.cost, spell.cast, spell.cooldown].filter(Boolean).join(' | ');
      console.log(`  ${spell.name}${spell.rank ? ` (r${spell.rank})` : ''} -- ${cost}`);
    }
  }
}

if (!write) console.log('\nNothing written. Pass --write.');
