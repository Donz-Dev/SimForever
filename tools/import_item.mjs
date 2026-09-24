#!/usr/bin/env node
/*
 * Fetch one item's tooltip and print it in the shape src/data/items/*.json uses.
 *
 *   node tools/import_item.mjs forever 19321
 *   node tools/import_item.mjs classic 17075
 *   node tools/import_item.mjs --verify            # re-parse every item on file
 *
 * WHY A TOOL RATHER THAN HAND-TRANSCRIBING
 *
 * The first eighteen items were parsed in a browser and transferred with a
 * SHA-256 check. That proved the BYTES arrived intact, which is not the same as
 * proving they were parsed correctly -- and a mis-read stat is exactly the kind
 * of plausible wrong number this project is built to avoid.
 *
 * `--verify` re-fetches every item already on file and diffs the parse against
 * what is stored. If this tool reproduces eighteen items nobody has complained
 * about, it can be trusted with the nineteenth.
 *
 * WHICH GAME
 *
 * `forever` is the ruleset this simulator is for and is always preferred.
 * `classic` is where the existing eighteen came from, as stand-ins. The two
 * endpoints have the same shape, so the only difference is which numbers are
 * authoritative -- see src/data/items/README.md.
 */

const ENDPOINT = (game, id) => `https://nether.wowhead.com/${game}/tooltip/item/${id}`;
const PAGE = (game, id) => `https://www.wowhead.com/${game}/item=${id}`;

/** Tooltip HTML to the plain text the data file stores. */
function toText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // Rows and tables OPEN without a break of their own, so "Unique" runs
    // straight into "One-Hand Sword" unless one is inserted here.
    .replace(/<\/?(table|tr)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** Stat lines: "+26 Strength", "+27 Block Value". */
const STAT_NAMES = {
  Strength: 'strength',
  Agility: 'agility',
  Stamina: 'stamina',
  Intellect: 'intellect',
  Spirit: 'spirit',
};

const RESISTANCES = ['Fire', 'Nature', 'Frost', 'Shadow', 'Arcane', 'Holy'];

function parse(raw, game, id) {
  const text = toText(raw.tooltip);
  const lines = text.split('\n');

  const itemLevel = Number((text.match(/Item Level (\d+)/) || [])[1] ?? 0);

  /*
   * The equip slot is the left cell of the type row and the subclass the right,
   * e.g. "Off Hand Shield" or "One-Hand Sword". Wowhead prints them on one line
   * once the markup is stripped, so they are recovered from a known list rather
   * than by position -- "Main Hand" and "Off Hand" both contain a space.
   */
  const SLOTS = [
    'Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Wrist', 'Hands', 'Waist',
    'Legs', 'Feet', 'Finger', 'Trinket', 'Two-Hand', 'One-Hand', 'Main Hand',
    'Off Hand', 'Ranged', 'Relic', 'Held In Off-hand',
  ];
  let inventoryType = '';
  let subclass = null;
  for (const line of lines) {
    // The NAME line is skipped, or "Hands of Might" reads as the Hands slot
    // with a subclass of "of Might". Real, and caught by --verify.
    if (line.startsWith(raw.name)) continue;
    const slot = SLOTS.find((s) => line === s || line.startsWith(s + ' '));
    if (!slot) continue;
    inventoryType = slot;
    const rest = line.slice(slot.length).trim();
    subclass = rest || null;
    break;
  }

  const armor = Number((text.match(/([\d,]+) Armor/) || [])[1]?.replace(/,/g, '') ?? '') || null;

  let weapon = null;
  const damage = text.match(/([\d.]+) - ([\d.]+) Damage/);
  const speed = text.match(/Speed ([\d.]+)/);
  const dps = text.match(/\(([\d.]+) damage per second\)/);
  if (damage && speed) {
    weapon = {
      minDamage: Number(damage[1]),
      maxDamage: Number(damage[2]),
      speed: Number(speed[1]),
      dps: dps ? Number(dps[1]) : 0,
    };
  }

  const stats = {};
  for (const [label, key] of Object.entries(STAT_NAMES)) {
    const m = text.match(new RegExp(`\\+(\\d+) ${label}\\b`));
    if (m) stats[key] = Number(m[1]);
  }

  const resistances = {};
  for (const school of RESISTANCES) {
    const m = text.match(new RegExp(`\\+(\\d+) ${school} Resistance`));
    if (m) resistances[school.toLowerCase()] = Number(m[1]);
  }

  /*
   * Everything the shape above does not account for.
   *
   * Prefixed lines are the usual ones. Bare stat lines that no rule claimed --
   * "44 Block", "+27 Block Value" -- are kept too, because a number the loader
   * cannot map must still be VISIBLE rather than dropped. That is what puts it
   * in the Gear panel's "Equipped but not simulated" list.
   */
  const effects = [];
  const PREFIXES = ['Equip', 'Chance on hit', 'Use', 'Set'];
  /*
   * `Block` is deliberately NOT claimed. The engine has no block outcome and no
   * block value stat, so a shield's "44 Block" and "+27 Block Value" have
   * nowhere to go -- and a number with nowhere to go must be VISIBLE, not
   * dropped. Both land in `effects` and the Gear panel prints them under
   * "Equipped but not simulated".
   */
  const CLAIMED = new RegExp(
    `^(\\+?\\d[\\d,.]* (Armor|${Object.keys(STAT_NAMES).join('|')}|` +
      `(${RESISTANCES.join('|')}) Resistance)|Item Level|Durability|Sell Price|Requires|Binds|` +
      `Unique|Classes:|Speed |[\\d.]+ - [\\d.]+ Damage|\\([\\d.]+ damage per second\\))`,
  );
  for (const line of lines) {
    const prefix = PREFIXES.find((p) => line.startsWith(p + ':'));
    if (prefix) {
      effects.push({ kind: prefix, text: line.slice(prefix.length + 1).trim() });
      continue;
    }
    // A bare numeric line the parser recognised is already represented above.
    if (/^[+]?[\d,]/.test(line) && !CLAIMED.test(line)) {
      effects.push({ kind: 'Stat', text: line });
    }
  }

  return {
    id: Number(id),
    name: raw.name,
    quality: raw.quality,
    icon: raw.icon,
    source: PAGE(game, id),
    itemLevel,
    inventoryType,
    subclass,
    armor,
    weapon,
    stats,
    resistances,
    effects,
    tooltip: text,
  };
}

async function fetchItem(game, id) {
  const response = await fetch(ENDPOINT(game, id));
  if (!response.ok) throw new Error(`${game}/${id}: HTTP ${response.status}`);
  return parse(await response.json(), game, id);
}

const [mode, second] = process.argv.slice(2);

if (mode === '--verify') {
  const { readFileSync } = await import('node:fs');
  /*
   * EVERY item file, not just the first. `sod-hunter.json` was added after
   * this was written, and a verify that silently skipped it would turn the
   * README's "re-parse everything already on file" into a false promise --
   * which is worse than no check at all, because it reads as one.
   */
  const FILES = ['src/data/items/classic-warrior.json', 'src/data/items/sod-hunter.json'];
  const storedItems = FILES.flatMap((file) => JSON.parse(readFileSync(file, 'utf8')).items);
  let same = 0;
  for (const stored of storedItems) {
    const game = stored.source.includes('/forever/') ? 'forever' : 'classic';
    const fresh = await fetchItem(game, stored.id);
    const differences = [];
    for (const key of ['name', 'quality', 'icon', 'itemLevel', 'inventoryType', 'subclass', 'armor']) {
      if (JSON.stringify(fresh[key]) !== JSON.stringify(stored[key])) {
        differences.push(`${key}: parsed ${JSON.stringify(fresh[key])} vs stored ${JSON.stringify(stored[key])}`);
      }
    }
    for (const key of ['stats', 'resistances', 'weapon']) {
      if (JSON.stringify(fresh[key]) !== JSON.stringify(stored[key])) {
        differences.push(`${key}: parsed ${JSON.stringify(fresh[key])} vs stored ${JSON.stringify(stored[key])}`);
      }
    }
    if (differences.length) {
      console.log(`\n${stored.name}`);
      for (const d of differences) console.log('  ' + d);
    } else same++;
  }
  console.log(`\n${same} of ${storedItems.length} items reproduce exactly.`);
} else if (mode && second) {
  console.log(JSON.stringify(await fetchItem(mode, second), null, 1));
} else {
  console.error('usage: import_item.mjs <forever|classic> <id>');
  console.error('       import_item.mjs --verify');
  process.exit(1);
}
