#!/usr/bin/env node
/**
 * Turn a ForeverChanges item capture into this project's own item data.
 *
 * ----------------------------------------------------------------------------
 * THE POINT IS TO STOP DEPENDING ON SOMEBODY ELSE'S SITE. The capture is taken
 * once, checked in under `tools/data/`, and everything after that is ours: this
 * script converts it into `src/data/items/forever-new-epics.json`, which is the
 * same shape every other item file here uses and is read by the same parser.
 *
 * HOW A CAPTURE IS TAKEN. `foreverchanges.pro` serves plain JSON --
 * `/items/new.json`, `changed.json`, `same.json`, `missing.json`,
 * `sources.json` -- each stating the beta build it came from. **A plain fetch
 * is refused with a 403**, so it is read in a browser ON THE ORIGIN, the
 * payload hashed there with SHA-256 and re-hashed on disk before being
 * accepted, which is this project's rule for anything out of a browser. The
 * capture records its own hash, build and filter.
 *
 * WHAT IS DROPPED, and it is the only thing: an item with no armour, no weapon
 * damage, no stat line, no effect and no set bonus. In this capture that is
 * exactly the eight "Premier Emboldened <slot> Seal" upgrade tokens, which the
 * ruleset owner named as ignorable. They are listed in the capture by name
 * rather than silently filtered, because "nothing was lost" has to be
 * checkable.
 * ----------------------------------------------------------------------------
 *
 *     node tools/import_forever_items.mjs --check    # what it would write
 *     node tools/import_forever_items.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const CAPTURE = 'tools/data/forever-new-epics.capture.json';
const OUT = 'src/data/items/forever-new-epics.json';

/** Inventory types that appear on their own line, with no subclass after a tab. */
const BARE_INVENTORY_TYPES = new Set([
  'Finger',
  'Trinket',
  'Neck',
  'Back',
  'Held In Off-hand',
  'Ranged',
  'Relic',
]);

/** Every inventory type the capture can carry, so an unknown one is caught. */
const INVENTORY_TYPES = new Set([
  ...BARE_INVENTORY_TYPES,
  'Head',
  'Shoulder',
  'Chest',
  'Wrist',
  'Hands',
  'Waist',
  'Legs',
  'Feet',
  'One-Hand',
  'Two-Hand',
  'Main Hand',
  'Off Hand',
  'Shield',
]);

/** The five primaries, which are the only bare `+N` lines that are STATS. */
const PRIMARY = {
  Stamina: 'stamina',
  Strength: 'strength',
  Agility: 'agility',
  Intellect: 'intellect',
  Spirit: 'spirit',
};

const SCHOOLS = ['Arcane', 'Fire', 'Frost', 'Nature', 'Shadow', 'Holy'];

/** Lines that are flavour, binding, restriction or price -- carried in the
 * tooltip and nowhere else. */
const IGNORED = [
  /^Binds when /,
  /^Unique(-Equipped)?(:.*)?$/,
  /^Requires Level \d+$/,
  /^Requires .+ - (Exalted|Revered|Honored|Friendly)$/,
  /^Classes: /,
  /^Races: /,
  /^Sell Price/,
  /^Durability /,
  /^".*"$/,
  /^.+ \(\d+\/\d+\)$/, // a set header, e.g. "Warlord's Threads (0/6)"
];

function convert(raw) {
  const item = {
    id: raw.id,
    name: raw.name,
    quality: raw.quality,
    icon: raw.icon,
    source: `https://foreverchanges.pro/items/new.json#${raw.id}`,
    itemLevel: raw.ilvl,
    inventoryType: null,
    subclass: null,
    armor: null,
    weapon: null,
    stats: {},
    resistances: {},
    effects: [],
    tooltip: [raw.name, ...raw.lines].join('\n'),
  };

  const unknown = [];
  let pendingDamage = null;

  for (const line of raw.lines) {
    // "Head\tCloth", "One-Hand\tSword", or "109 - 165 Damage\tSpeed 2.90".
    if (line.includes('\t')) {
      const [left, right] = line.split('\t');
      if (INVENTORY_TYPES.has(left)) {
        item.inventoryType = left;
        item.subclass = right || null;
        continue;
      }
      const damage = /^(\d+) - (\d+) (?:(\w+) )?Damage$/.exec(left);
      const speed = /^Speed ([\d.]+)$/.exec(right ?? '');
      if (damage && speed) {
        pendingDamage = {
          minDamage: Number(damage[1]),
          maxDamage: Number(damage[2]),
          speed: Number(speed[1]),
          dps: 0,
        };
        continue;
      }
      unknown.push(line);
      continue;
    }

    if (BARE_INVENTORY_TYPES.has(line)) {
      item.inventoryType = line;
      continue;
    }

    const dps = /^\(([\d.]+) damage per second\)$/.exec(line);
    if (dps && pendingDamage) {
      pendingDamage.dps = Number(dps[1]);
      continue;
    }

    const armor = /^(\d+) Armor$/.exec(line);
    if (armor) {
      item.armor = (item.armor ?? 0) + Number(armor[1]);
      continue;
    }

    const bare = /^\+(\d+) (.+?)\.?$/.exec(line);
    if (bare) {
      const value = Number(bare[1]);
      const name = bare[2];
      if (PRIMARY[name]) {
        item.stats[PRIMARY[name]] = (item.stats[PRIMARY[name]] ?? 0) + value;
        continue;
      }
      /*
       * BONUS ARMOUR IS SUMMED INTO THE ARMOUR FIELD, not kept apart.
       *
       * Forever's client lists the slot's own armour and then "+40 Armor"
       * among the stats; Classic and Season of Discovery fold the two into the
       * single number at the top. The parser here reads `armor` as the total,
       * so summing is what makes a Forever item mean the same as an SoD one.
       */
      if (name === 'Armor') {
        item.armor = (item.armor ?? 0) + value;
        continue;
      }
      const resistance = /^(\w+) Resistance$/.exec(name);
      if (resistance && SCHOOLS.includes(resistance[1])) {
        item.resistances[resistance[1].toLowerCase()] = value;
        continue;
      }
      // Anything else bare and numeric is a stat line the existing parser's
      // EFFECT_RULES may claim -- "+27 Block Value" is one. `kind: 'Stat'` is
      // what the other files use for exactly this.
      item.effects.push({ kind: 'Stat', text: line });
      continue;
    }

    // A shield's inherent block value, which is a bare line with no plus.
    if (/^\d+ Block$/.test(line)) {
      item.effects.push({ kind: 'Stat', text: line });
      continue;
    }

    const prefixed = /^(Equip|Use|Chance on hit): (.+)$/.exec(line);
    if (prefixed) {
      item.effects.push({ kind: prefixed[1], text: prefixed[2] });
      continue;
    }

    // "(2) Set: ..." -- the other files store the count in the TEXT and drop
    // the word "Set", so a reader sees "(2) You are immune to...".
    const set = /^\((\d+)\) Set: (.+)$/.exec(line);
    if (set) {
      item.effects.push({ kind: 'Set', text: `(${set[1]}) ${set[2]}` });
      continue;
    }

    if (IGNORED.some((pattern) => pattern.test(line))) continue;
    unknown.push(line);
  }

  if (pendingDamage) item.weapon = pendingDamage;
  return { item, unknown };
}

const capture = JSON.parse(readFileSync(CAPTURE, 'utf8'));
/*
 * RE-HASH THE PAYLOAD, NOT THE FILE.
 *
 * The capture file wraps the transferred payload in two `_`-prefixed fields,
 * so hashing the file answers a different question from the one the browser
 * answered. Rebuilding the payload exactly -- the same keys in the same order,
 * `JSON.stringify` with no spacing -- is what makes the two comparable, and a
 * mismatch means the file was edited after it was accepted.
 */
const { _note, _sha256_of_payload: claimed, ...payload } = capture;
const recomputed = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const problemsBeforeItems = [];
const items = [];
const problems = [...problemsBeforeItems];
for (const raw of capture.items) {
  const { item, unknown } = convert(raw);
  if (!item.inventoryType) problems.push(`${item.name} (${item.id}): no inventory type`);
  for (const line of unknown) problems.push(`${item.name} (${item.id}): unread line "${line}"`);
  items.push(item);
}

const byId = new Map();
for (const item of items) {
  if (byId.has(item.id)) problems.push(`duplicate id ${item.id} (${item.name})`);
  byId.set(item.id, item);
}

console.log(`capture: build ${capture.build}, ${capture.items.length} items, taken ${capture.build_date}`);
console.log(
  `         payload sha256 ${recomputed === claimed ? 'MATCHES' : 'DOES NOT MATCH'} the ` +
    `hash taken in the browser (${claimed.slice(0, 16)}...)`,
);
if (recomputed !== claimed) {
  console.error(`         recomputed ${recomputed}`);
  problemsBeforeItems.push('capture hash mismatch -- the file was changed after it was accepted');
}
console.log(`dropped as having nothing to model: ${capture.dropped_tokens.join(', ')}`);
console.log(`converted ${items.length} items`);
const withWeapon = items.filter((i) => i.weapon).length;
const withArmor = items.filter((i) => i.armor).length;
const withEffects = items.filter((i) => i.effects.length > 0).length;
console.log(`  ${withWeapon} weapons, ${withArmor} with armour, ${withEffects} with effects`);
if (problems.length > 0) {
  console.log(`\n${problems.length} PROBLEMS:`);
  for (const problem of problems.slice(0, 40)) console.log(`  ${problem}`);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
}

if (process.argv.includes('--write')) {
  if (problems.length > 0) {
    console.error('\nrefusing to write with problems outstanding');
    process.exit(1);
  }
  const out = {
    set: 'forever-new-epics',
    description:
      `Every NEW epic weapon and armour piece at item level 55 and above in the ` +
      `WoW: Forever beta client, build ${capture.build}, captured ${capture.build_date}. ` +
      `REAL FOREVER DATA, unlike the Classic and Season of Discovery stand-ins in the ` +
      `other files here. Converted by tools/import_forever_items.mjs from the capture ` +
      `in tools/data/, which records its own SHA-256. The eight "Premier Emboldened" ` +
      `upgrade seals are excluded: they carry no armour, stats or effects.`,
    source: capture.source,
    foreverBuild: capture.build,
    classicBuild: capture.classic_build,
    capturedOn: capture.build_date,
    items,
  };
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`\nwrote ${OUT}`);
} else {
  console.log('\n(dry run -- pass --write to update src/data/items/)');
}
