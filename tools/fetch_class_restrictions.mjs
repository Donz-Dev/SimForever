#!/usr/bin/env node
/**
 * THE `Classes:` LINE FOR THE ITEMS FOREVER'S OWN CAPTURE LEAVES OUT.
 *
 * ==============================================================================
 * WHY THIS IS ALLOWED TO READ WOWHEAD, which is normally ranked below
 * `foreverchanges.pro` and is "for READING an item Forever inherited, and no
 * longer the project's item data":
 *
 * **THE PREFERRED SOURCE IS SILENT, NOT DIFFERENT.** CLAUDE.md states the
 * exception in those words, for Shadowburn's Soul Shard: `foreverchanges.pro`
 * carries no reagent field for any spell, so its 365-mana cost does not
 * contradict the reagent the other source states -- it cannot express one.
 * The same holds here. The Forever capture has no class field at all for these
 * items; it is not asserting that they are unrestricted.
 *
 * AND IT WAS CHECKED RATHER THAN ASSUMED. Conqueror's Crown carries
 * "Classes: Warrior" in the Forever capture and Bonescythe Helmet carries
 * nothing -- and Wowhead's Classic data has "Classes: Rogue" for the second.
 * So the line exists upstream and the capture dropped it, which is a gap and
 * not a ruling.
 *
 * ------------------------------------------------------------------------------
 * SCOPED TO ITEMS THAT CARRY A SET BONUS AND NO CLASS LINE, which is the
 * population the gap lives in -- 184 of them, across 48 sets. It is not every
 * item lacking a line: most items genuinely have none, and a thousand requests
 * to someone else's service to confirm that would be rude as well as slow.
 *
 * **AND NOT EVERY ONE OF THE 184 IS RESTRICTED.** Devilsaur Armor, the Dragon
 * Mail sets and the Highlander's/Defiler's PvP sets are crafted and reputation
 * sets with no class restriction at all -- so this ASKS each one rather than
 * inferring from the set bonus, and writes down only what comes back.
 *
 *   node tools/fetch_class_restrictions.mjs          # writes the capture
 *   node tools/fetch_class_restrictions.mjs --check  # reports, writes nothing
 * ==============================================================================
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = new URL('../src/data/items/forever-class-restrictions.json', import.meta.url);
const CHECK = process.argv.includes('--check');

const FILES = [
  'forever-new-epics',
  'forever-new-rares',
  'forever-changed-epics',
  'forever-changed-rares',
  'forever-same',
];

/** Every captured item, by id, with its tooltip. */
const items = new Map();
for (const file of FILES) {
  const path = new URL(`../src/data/items/${file}.json`, import.meta.url);
  for (const item of JSON.parse(readFileSync(path, 'utf8')).items) {
    items.set(item.id, item);
  }
}

const SET_BONUS = /^\(\d+\) Set/m;
const CLASSES = /^Classes:/m;

const candidates = [...items.values()].filter(
  (item) => SET_BONUS.test(item.tooltip) && !CLASSES.test(item.tooltip),
);

console.log(`${items.size} captured items, ${candidates.length} with a set bonus and no class line`);
if (CHECK) {
  const sets = new Map();
  for (const item of candidates) {
    const name = /^(.+) \(0\/\d+\)$/m.exec(item.tooltip)?.[1] ?? '(unnamed set)';
    sets.set(name, (sets.get(name) ?? 0) + 1);
  }
  for (const [name, count] of [...sets].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(2)}  ${name}`);
  }
  process.exit(0);
}

const CLASS_NAMES = new Set([
  'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid',
]);

/** Pull the `Classes:` names out of a Wowhead tooltip's HTML. */
function classesFrom(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const match = /Classes:\s*([A-Za-z, ]+?)\s+(?:Requires|Durability|Item Level|$)/.exec(text);
  if (!match) return undefined;
  const named = match[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => CLASS_NAMES.has(name));
  return named.length > 0 ? named : undefined;
}

const restrictions = {};
let found = 0;
let failed = 0;

for (const [index, item] of candidates.entries()) {
  const url = `https://nether.wowhead.com/classic/tooltip/item/${item.id}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const classes = classesFrom(body.tooltip ?? '');
    if (classes) {
      restrictions[item.id] = { name: item.name, classes };
      found += 1;
    }
  } catch (error) {
    failed += 1;
    console.warn(`  ${item.id} ${item.name}: ${error.message}`);
  }
  if ((index + 1) % 25 === 0) {
    console.log(`  ${index + 1}/${candidates.length}  found ${found}, failed ${failed}`);
  }
  // Considerate rather than fast: this is somebody else's service.
  await new Promise((resolve) => setTimeout(resolve, 120));
}

const payload = {
  source:
    'https://nether.wowhead.com/classic/tooltip/item/<id> -- the `Classes:` line for items whose ' +
    'foreverchanges.pro capture omits one. Read because the preferred source is SILENT rather ' +
    'than different; see the header of tools/fetch_class_restrictions.mjs.',
  captured: new Date().toISOString().slice(0, 10),
  candidates: candidates.length,
  restrictions,
};
const json = `${JSON.stringify(payload, null, 2)}\n`;
writeFileSync(OUT, json);

console.log(
  `\nwrote ${found} restrictions for ${candidates.length} candidates ` +
    `(${candidates.length - found - failed} genuinely unrestricted, ${failed} failed)`,
);
console.log(`sha256 ${createHash('sha256').update(json).digest('hex').slice(0, 16)}`);
