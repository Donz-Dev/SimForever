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

/**
 * ONE CAPTURE, SIX OUTPUT FILES (build 1.60.1.70959, the release).
 *
 * ----------------------------------------------------------------------------
 * The ruleset owner named two payloads -- every rare at item level 50 and up
 * (2,778) and every epic at 50 and up (2,106) -- and the site builds both from
 * the same four files, `new`, `changed`, `same` and `missing`. So they were
 * captured as ONE payload, filtered in the browser, and are split here by which
 * file each item came from (`t`) and its quality (`q`).
 *
 * `missing` IS CAPTURED AND NOT IMPORTED: Classic items the Forever client has
 * not revealed yet, which the site shows as "NO FOREVER DATA", so their lines
 * are CLASSIC's. The ruleset owner ruled them out (2026-11-17) -- "None of the
 * old WoW Vanilla/Classic/SoD items" stands -- and they stay in the capture so
 * a refresh that reveals them is a one-line change here.
 *
 * THE OLD FIVE CAPTURES ARE SUPERSEDED, all at build 1.60.1.70338. The two
 * CHANGED ones stay in `tools/data/` for one reason: they carried the site's
 * `wordingOnly` flag, which the new format no longer has. See `WORDING_ONLY`.
 * ----------------------------------------------------------------------------
 */
const CAPTURE_FILE = 'tools/data/forever-items-70959.capture.json';

const JOBS = [
  {
    out: 'src/data/items/forever-new-epics.json',
    set: 'forever-new-epics',
    keep: (raw) => raw.t !== 'changed' && raw.t !== 'same' && raw.t !== 'missing' && raw.q === 4,
    what: 'Every NEW epic item at item level 50 and above',
  },
  {
    out: 'src/data/items/forever-new-rares.json',
    set: 'forever-new-rares',
    keep: (raw) => raw.t !== 'changed' && raw.t !== 'same' && raw.t !== 'missing' && raw.q === 3,
    what: 'Every NEW rare (blue) item at item level 50 and above',
  },
  {
    out: 'src/data/items/forever-changed-epics.json',
    set: 'forever-changed-epics',
    keep: (raw) => raw.t === 'changed' && raw.q === 4,
    what: 'Every CLASSIC epic at item level 50 and above that Forever CHANGED',
  },
  {
    out: 'src/data/items/forever-changed-rares.json',
    set: 'forever-changed-rares',
    keep: (raw) => raw.t === 'changed' && raw.q === 3,
    what: 'Every CLASSIC rare (blue) item at item level 50 and above that Forever CHANGED',
  },
  {
    out: 'src/data/items/forever-same.json',
    set: 'forever-same',
    keep: (raw) => raw.t === 'same',
    what:
      'Every rare and epic at item level 50 and above that Forever did NOT change ' +
      'from Classic -- real Forever items, identical to their Classic originals',
  },
];

/**
 * THE `wordingOnly` FLAG, CARRIED FROM THE 1.60.1.70338 CAPTURES WHERE IT STILL
 * HOLDS.
 *
 * ----------------------------------------------------------------------------
 * The site used to say which CHANGED items differ from Classic in prose only --
 * the control group `tools/item_budget.ts` prices Classic's itemization with.
 * The 70959 format carries Classic's lines (`y`) and no flag. So an old flag is
 * kept ONLY where the item's Forever lines are byte-identical to the ones it was
 * computed against; anything that moved since is left unflagged rather than
 * guessed at, and the count of each is printed.
 * ----------------------------------------------------------------------------
 */
const WORDING_ONLY = new Map();
for (const file of ['tools/data/forever-changed.capture.json', 'tools/data/forever-changed-rares.capture.json']) {
  for (const old of JSON.parse(readFileSync(file, 'utf8')).items) {
    if (old.wordingOnly !== undefined) WORDING_ONLY.set(old.id, { flag: old.wordingOnly, lines: JSON.stringify(old.lines) });
  }
}

/**
 * Not gear: no equipment slot, or a slot nothing here equips.
 *
 * `s` is null for a recipe, a mount, a quest item, a book; a bag and ammunition
 * have a slot of their own. Ammunition is a Hunter's ROUND RULE, not an item a
 * slot holds -- `game/character/hunterRanged.ts` -- so a captured arrow has no
 * slot to go in. All are listed, grouped by what they are.
 */
const NOT_GEAR_SLOTS = new Set([null, 'Bag', 'Ammo']);

/** Inventory types that appear on their own line, with no subclass after a tab. */
const BARE_INVENTORY_TYPES = new Set([
  'Finger',
  'Trinket',
  'Neck',
  'Back',
  'Held In Off-hand',
  'Ranged',
  'Relic',
  // A thrown weapon. Classic puts it in the RANGED slot, which is the mapping
  // `itemData` makes -- the source's own word is kept here so the tooltip and
  // the slot do not have to agree textually.
  'Thrown',
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
  // A reputation requirement, at any standing -- `Neutral` is the one that
  // turned up only in the CHANGED capture, on the Brood of Nozdormu rings.
  /^Requires .+ - (Exalted|Revered|Honored|Friendly|Neutral|Unfriendly|Hostile|Hated)$/,
  // A profession requirement: "Requires Engineering (300)".
  /^Requires [A-Za-z ]+ \(\d+\)$/,
  /^Classes: /,
  /^Races: /,
  /^Sell Price/,
  /^Durability /,
  // A use count on a tool, e.g. Grizzle's Skinner: "30 Charges".
  /^\d+ Charges?$/,
  /^".*"$/,
  /^.+ \(\d+\/\d+\)$/, // a set header, e.g. "Warlord's Threads (0/6)"
];

/**
 * A developer test item, excluded on the ruleset owner's instruction.
 *
 * ----------------------------------------------------------------------------
 * Thirty-nine items named "90 Epic <class> <slot>" -- a full epic set per class
 * at item level 90, in a ruleset whose cap is 60. They are REQUIRES LEVEL 60,
 * so a character could wear them and they would be offered in the Gear panel
 * beside real gear; they are also plainly a tuning fixture rather than loot.
 *
 * MATCHED ON THE NAME AND NOT ON THE ITEM LEVEL, because item level 90 is not
 * the thing that makes them test items. Six REAL Naxxramas trinkets sit at 90
 * -- Slayer's Crest, Mark of the Champion, Eye of the Dead, The Restrained
 * Essence of Sapphiron, Glyph of Deflection -- and an item-level rule would
 * have taken those with them.
 *
 * Excluded items are listed BY NAME in the output, the same as the "Premier
 * Emboldened" seals, because "nothing was lost" has to be checkable rather
 * than asserted.
 * ----------------------------------------------------------------------------
 */
const TEST_ITEM = /^90 Epic /;

/** The site's compact record, in the shape `convert` reads. */
function expand(raw) {
  const out = { id: raw.i, name: raw.n, quality: raw.q, ilvl: raw.l, icon: raw.k, lines: raw.x, file: raw.t };
  const old = WORDING_ONLY.get(raw.i);
  if (raw.t === 'changed' && old && old.lines === JSON.stringify(raw.x)) out.wordingOnly = old.flag;
  return out;
}

function convert(raw) {
  const item = {
    id: raw.id,
    name: raw.name,
    quality: raw.quality,
    // THE ICON IS KEPT, the client's own file name -- the Gear panel draws it so
    // items can be told apart by appearance.
    icon: raw.icon,
    source: `https://foreverchanges.pro/items/${raw.file}.json#${raw.id}`,
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
  /*
   * CARRIED THROUGH, because it is what makes a CONTROL GROUP possible.
   *
   * `wordingOnly` means Forever changed the prose and not a single number, so
   * the item's stats ARE Classic's -- and pricing those through the budget
   * model measures CLASSIC's itemization, on the same slots at the same item
   * levels, with the same blind spots. Without it the only available baseline
   * is 100%, which is not a number this model reaches even on Classic, and
   * comparing against it is what produced a "Forever runs 11 points light"
   * reading that was entirely the model's own residual.
   */
  if (raw.wordingOnly !== undefined) item.wordingOnly = raw.wordingOnly;

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
          printedDps: 0,
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
      pendingDamage.printedDps = Number(dps[1]);
      continue;
    }

    const armor = /^(\d+) Armor$/.exec(line);
    if (armor) {
      item.armor = (item.armor ?? 0) + Number(armor[1]);
      continue;
    }

    /*
     * A SIGN, BECAUSE A STAT CAN BE NEGATIVE. The Lapidis Tankard of Tidesippe
     * states "-15 Agility" -- Classic has a handful of cursed items and the
     * `same` capture is the first to reach one. Matching `+` only sent it to
     * the unread list, which would have stopped the whole import rather than
     * losing the line, so the importer's refusal did its job.
     */
    const bare = /^([+-]\d+) (.+?)\.?$/.exec(line);
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

  if (pendingDamage) {
    /*
     * DPS IS DERIVED, NOT TRANSCRIBED, and the printed figure becomes the
     * CHECK on it rather than the value.
     *
     * `(min + max) / 2 / speed` is what dps means, and the source prints it
     * ROUNDED on at least one item -- the 90 Epic Frost Staff is 119-226 at
     * 2.70s, which is 63.889, and the tooltip says 64. `itemData` cross-checks
     * damage against dps to a tolerance of 0.05 and would throw on that, so
     * storing the printed number puts a display rounding into the data and
     * then fails on it.
     *
     * The redundancy that check exists for is kept here instead, at the
     * source's own precision: a scrape that dropped a digit moves the printed
     * figure by far more than half a point.
     */
    const { minDamage, maxDamage, speed, printedDps } = pendingDamage;
    const derived = (minDamage + maxDamage) / 2 / speed;
    if (Math.abs(derived - printedDps) > 0.5) {
      unknown.push(
        `dps ${printedDps} disagrees with ${minDamage}-${maxDamage} at ${speed}s (${derived.toFixed(2)})`,
      );
    }
    item.weapon = { minDamage, maxDamage, speed, dps: Number(derived.toFixed(2)) };
  }
  return { item, unknown };
}

const CAPTURE = JSON.parse(readFileSync(CAPTURE_FILE, 'utf8'));
{
  const { _note, _sha256_of_payload: claimed, ...payload } = CAPTURE;
  const recomputed = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  console.log(
    `capture ${CAPTURE_FILE}: ${CAPTURE.items.length} items, payload sha256 ` +
      `${recomputed === claimed ? 'MATCHES' : 'DOES NOT MATCH'} the browser hash (${claimed.slice(0, 16)}...)`,
  );
  if (recomputed !== claimed) {
    console.error(`recomputed ${recomputed}`);
    process.exit(1);
  }
  const claimedByJob = JOBS.map((job) => CAPTURE.items.filter(job.keep).length);
  const missing = CAPTURE.items.filter((raw) => raw.t === 'missing').length;
  console.log(`not imported: ${missing} "NO FOREVER DATA" items, whose lines are Classic's (owner's ruling)`);
  const total = claimedByJob.reduce((a, b) => a + b, 0) + missing;
  if (total !== CAPTURE.items.length) {
    console.error(`the jobs claim ${total} of ${CAPTURE.items.length} items -- one is in two files or none`);
    process.exit(1);
  }
}
const build = CAPTURE.builds.new;
const notGearAll = new Map();
let carried = 0;
let unflagged = 0;
for (const job of JOBS) run(job);
console.log(`\nexcluded as not gear, by what they are:`);
for (const [kind, names] of [...notGearAll].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(names.length).padStart(4)}  ${kind}`);
}
console.log(`wordingOnly carried from 1.60.1.70338 on ${carried} changed items; ${unflagged} changed items left unflagged`);

function run({ out: OUT, set: SET, what: WHAT, keep }) {
const capture = {
  build: build.build,
  classic_build: build.classic,
  build_date: build.date,
  source: CAPTURE.source,
  items: CAPTURE.items.filter(keep),
};
console.log(`\n== ${SET}: ${capture.items.length} items`);
const problemsBeforeItems = [];
const items = [];
const problems = [];
/** Excluded for two different reasons, reported as two different lines. */
const testItems = [];
const notGear = [];
const noDamage = [];
for (const compact of capture.items) {
  if (NOT_GEAR_SLOTS.has(compact.s)) {
    const sub = compact.x.find((line) => line.includes('\t'))?.split('\t')[1] || 'other';
    const kind = compact.s ? `${compact.s} (${sub})` : sub;
    if (!notGearAll.has(kind)) notGearAll.set(kind, []);
    notGearAll.get(kind).push(`${compact.n} (${compact.i})`);
    notGear.push(`${compact.n} (${compact.i})`);
    continue;
  }
  /*
   * A WEAPON WITH NO DAMAGE FIGURE. The client prints "Damage set by hand" in
   * place of a range on three items -- Screeching Bow, Bland Bow of Steadiness,
   * Bland Dagger -- which is a server-side value the client does not carry.
   * Excluded by name rather than given an invented range.
   */
  if (compact.x.some((line) => line.startsWith('Damage set by hand'))) {
    noDamage.push(`${compact.n} (${compact.i})`);
    continue;
  }
  const raw = expand(compact);
  if (raw.file === 'changed') {
    if (raw.wordingOnly !== undefined) carried += 1;
    else unflagged += 1;
  }
  if (TEST_ITEM.test(raw.name)) {
    testItems.push(`${raw.name} (${raw.id})`);
    continue;
  }
  const { item, unknown } = convert(raw);
  if (!item.inventoryType) {
    /*
     * NOT EQUIPPABLE, SO NOT GEAR. An item with no inventory type has no slot
     * to go in -- Orb of Deception is a bag item whose only line is a Use
     * effect. It reached this far because the capture filter keeps anything
     * with an effect, which is right for a trinket and wrong for this.
     *
     * Listed by name like every other exclusion rather than counted as a
     * problem, because a problem stops the write and this is simply not gear.
     */
    notGear.push(`${raw.name} (${raw.id})`);
    continue;
  }
  for (const line of unknown) problems.push(`${item.name} (${item.id}): unread line "${line}"`);
  items.push(item);
}

const byId = new Map();
for (const item of items) {
  if (byId.has(item.id)) problems.push(`duplicate id ${item.id} (${item.name})`);
  byId.set(item.id, item);
}

problems.push(...problemsBeforeItems);
{
}
if (capture.dropped_tokens) {
  console.log(`dropped as having nothing to model: ${capture.dropped_tokens.join(', ')}`);
}
if (testItems.length > 0) {
  console.log(`excluded ${testItems.length} developer test items: ${testItems.join(', ')}`);
}
if (notGear.length > 0) {
  console.log(`excluded ${notGear.length} with no equipment slot (grouped at the end)`);
}
if (noDamage.length > 0) {
  console.log(`excluded ${noDamage.length} weapons whose damage the client does not state: ${noDamage.join(', ')}`);
}
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
    set: SET,
    description:
      `${WHAT}, WoW: Forever client build ${capture.build}, captured ${capture.build_date} ` +
      `from foreverchanges.pro. Converted by tools/import_forever_items.mjs from ` +
      `${CAPTURE_FILE}, which records its own SHA-256.`,
    source: capture.source,
    excludedTestItems: testItems,
    excludedNotEquippable: notGear,
    excludedNoDamageFigure: noDamage,
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
}
