/*
 * Import every class's talent tree from the WoW Forever BETA CLIENT.
 *
 *   node tools/import_forever_talents.mjs --check    diff against what is on disk
 *   node tools/import_forever_talents.mjs --write    rewrite src/data/talents/
 *   node tools/import_forever_talents.mjs --capture druid=tools/data/<file>.json --write
 *
 * ----------------------------------------------------------------------------
 * `--capture` IS FOR A TREE THE CLIENT HAS SHIPPED AND talentsforever.com HAS
 * NOT. Build 1.60.1.70707 reworked the Druid's Feral and Restoration trees and
 * talentsforever.com still served the old ones, so the tree was read off
 * foreverchanges.pro/talents/<class> -- the tie-break source by the owner's
 * standing rule -- in a browser, hashed there and re-hashed on disk. The
 * capture is a list of `{ name, tree, tier, col, max, pre, icon, ranks }` with
 * zero-based tier and column, and is converted to the talentsforever payload
 * shape here so EVERYTHING DOWNSTREAM IS THE SAME CODE: the template matching,
 * the hand-filled merge and the validation. Only the named class is touched.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS REPLACES THE WOWHEAD SCRAPE
 *
 * `src/data/talents/*.json` was scraped from wowhead.com/forever/talent-calc,
 * a client-side rendered page that needed a browser, a DOM walk and a hashed
 * clipboard transfer to get out of. It was right: 468 of its 469 talents match
 * the client exactly, and the Warrior audit found all 154 of its rank values
 * correct.
 *
 * talentsforever.com serves the same data from the beta client's own files as
 * ONE STATIC FILE, fetchable with plain `fetch` -- no browser, no scraping, no
 * clipboard. It also carries three things the scrape does not:
 *
 *   - `req`, the prerequisite talent, by name
 *   - `cost`, the granted ability's rage/cast/cooldown line
 *   - `classic`, what the talent was before Forever changed it
 *
 * THE ONE DISAGREEMENT, and the reason this exists: our Druid Balance tree has
 * seventeen talents and the client has sixteen. The extra one is BALANCE OF
 * NATURE, which is not in the client and is not in the client's list of
 * talents Forever REMOVED either -- so it is Wowhead's, not Forever's.
 *
 * That is not a rounding error. talentsforever.com encodes a saved build as one
 * digit per talent in tree order, so a tree of the wrong length decodes every
 * build after it into the wrong talents. Every profile in this project is
 * specified by one of those URLs.
 * ----------------------------------------------------------------------------
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'https://talentsforever.com/talents.js';
const OUT_DIR = 'src/data/talents';

/** Our file names, and the key each class has in the payload. */
const CLASSES = {
  warrior: 'Warrior',
  paladin: 'Paladin',
  hunter: 'Hunter',
  rogue: 'Rogue',
  priest: 'Priest',
  shaman: 'Shaman',
  mage: 'Mage',
  warlock: 'Warlock',
  druid: 'Druid',
};

/** `Feral Combat` -> `feral_combat`, matching the ids already on disk. */
const treeId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const talentId = treeId;

async function fetchTalentData() {
  const res = await fetch(SOURCE, { headers: { 'user-agent': 'SimForever-import' } });
  if (!res.ok) throw new Error(`${SOURCE} returned ${res.status}`);
  const body = await res.text();

  /*
   * Evaluated in a bare object rather than parsed, because the file is a
   * `window.TALENT_DATA = {...}` assignment and not JSON. No DOM is touched
   * and nothing else is in scope, so this is a parser and not a sandbox
   * escape waiting to happen -- but it IS remote code, which is why the
   * validation below runs before anything is written.
   */
  const scope = {};
  new Function('window', body)(scope);
  if (!scope.TALENT_DATA) throw new Error('no TALENT_DATA in the payload');
  return scope.TALENT_DATA;
}

/**
 * The shape `src/data/talents/<class>.json` already has.
 *
 * `tier` is the points needed to reach the row, which is five a row. `row` and
 * `col` are zero-based here and one-based in the payload.
 */
function toStructure(className, classData) {
  const trees = classData.trees.map((tree) => {
    const byName = new Map(tree.talents.map((t) => [t.name, t]));
    return {
      id: treeId(tree.name),
      name: tree.name,
      talents: tree.talents.map((t) => ({
        row: t.row - 1,
        col: t.col - 1,
        ranks: t.max,
        name: t.name,
        icon: t.icon,
        tier: (t.row - 1) * 5,
        requires: t.req ?? null,
        // The prerequisite must be MAXED, so the rank needed is its own max.
        requiresRanks: t.req ? (byName.get(t.req)?.max ?? null) : null,
        description: t.desc?.[t.desc.length - 1] ?? '',
      })),
    };
  });
  return { class: className, source: SOURCE, trees };
}

/**
 * The per-rank values, which is what the simulator actually reads.
 *
 * Each rank's text differs only in its numbers, so the shared text becomes a
 * template with `{0}`, `{1}` ... and the numbers become an array per rank. A
 * single-rank talent has nothing to template and keeps its text whole.
 */
function toValues(className, classData, existing) {
  const talents = {};
  for (const tree of classData.trees) {
    for (const t of tree.talents) {
      const id = talentId(t.name);
      const descriptions = t.desc ?? [];
      const entry = { name: t.name, tree: treeId(tree.name), ranks: t.max };

      if (descriptions.length <= 1) {
        entry.text = descriptions[0] ?? '';
        entry.values = null;
        entry.note = 'single rank';
      } else {
        const numbersPerRank = descriptions.map((d) => (d.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
        const width = numbersPerRank[0].length;
        const sameShape = numbersPerRank.every((n) => n.length === width);

        if (!sameShape || width === 0) {
          /*
           * Ranks whose text changes shape rather than only its numbers. Kept
           * verbatim per rank rather than forced into a template that would
           * silently drop a clause.
           */
          entry.text = descriptions[descriptions.length - 1];
          entry.values = null;
          entry.note = 'per-rank text differs in shape; not templated';
        } else {
          let index = -1;
          entry.text = descriptions[0].replace(/\d+(?:\.\d+)?/g, () => `{${++index}}`);
          entry.values = width === 1 ? numbersPerRank.map((n) => n[0]) : numbersPerRank;
        }
      }
      /*
       * A SINGLE-RANK TALENT'S VALUES ARE HAND-FILLED AND MUST SURVIVE THIS.
       *
       * Its text carries a number but nothing says which number is the
       * variable -- "reduces the Rage cost of your Cleave ability by 2" could
       * template the 2 or not, and only a person can say. `values/README.md`
       * records that those are filled in by hand on the ruleset owner's
       * confirmation, and CLAUDE.md names this directory as the one piece of
       * scraped data that IS hand-editable.
       *
       * So an import MERGES rather than overwrites: where a hand-filled entry
       * exists and this run produced none, the hand-filled one wins. Raging
       * Blows is the case that caught it -- clobbering its `[2]` took two rage
       * off nothing and failed a real behaviour test.
       */
      const previous = existing?.talents?.[id];
      if (entry.values === null && previous?.values != null && previous.ranks === entry.ranks) {
        entry.text = previous.text;
        entry.values = previous.values;
        entry.note = previous.note ?? 'single rank; value filled in by hand';
      }

      talents[id] = entry;
    }
  }
  return {
    class: className,
    source: SOURCE,
    structure: `src/data/talents/${className}.json`,
    talents,
  };
}

/**
 * Refuse to write anything that fails the invariants `talentData.ts` enforces.
 *
 * A remote file that changes shape should fail loudly here rather than render a
 * tree with a broken arrow, which is the same rule the loader already applies.
 */
function validate(className, structure) {
  const problems = [];
  const names = new Set();
  const ids = new Set();

  for (const tree of structure.trees) {
    for (const t of tree.talents) {
      if (t.tier !== t.row * 5) problems.push(`${t.name}: tier ${t.tier} against row ${t.row}`);
      if (!(t.ranks >= 1)) problems.push(`${t.name}: ${t.ranks} ranks`);
      if (t.row < 0 || t.col < 0) problems.push(`${t.name}: r${t.row}c${t.col}`);
      const id = talentId(t.name);
      if (ids.has(id)) problems.push(`duplicate id ${id}`);
      ids.add(id);
      names.add(t.name);
    }
  }
  for (const tree of structure.trees) {
    for (const t of tree.talents) {
      if (t.requires && !names.has(t.requires)) {
        problems.push(`${t.name} requires ${t.requires}, which is in no tree`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`${className} failed validation:\n  ${problems.join('\n  ')}`);
  }
}

/**
 * Where a capture's rank text is a RENDERING artifact rather than a figure.
 *
 * Thick Hide reads "178 / 179 / 180 additional base Armor per level" across its
 * three ranks on foreverchanges.pro at 1.60.1.70707, where talentsforever.com
 * read 1 / 2 / 3. A per-level figure of 180 would be 10,800 armor at level 60,
 * and 177 + rank is no formula anybody writes -- so the template's {0} is put
 * back to the rank and the defense-point half, which renders cleanly, is kept.
 * A question for the owner rather than a decision, and named here so a
 * re-import cannot quietly reinstate it.
 */
const CAPTURE_CORRECTIONS = {
  'Thick Hide': (text, rank) => text.replace(/gain \d+ additional base Armor per level/, `gain ${rank} additional base Armor per level`),
};

/**
 * A foreverchanges.pro capture, as the talentsforever payload shape.
 *
 * Trees in the order they first appear, talents by row then column -- which is
 * the order every file on disk already has, and the order a build URL's digits
 * run in.
 */
function fromCapture(path) {
  const captured = JSON.parse(readFileSync(path, 'utf8'));
  const trees = [];
  for (const t of captured) {
    let tree = trees.find((x) => x.name === t.tree);
    if (!tree) trees.push((tree = { name: t.tree, talents: [] }));
    tree.talents.push({
      name: t.name,
      row: t.tier + 1,
      col: t.col + 1,
      max: t.max,
      icon: t.icon,
      req: t.pre ?? undefined,
      desc: Array.from({ length: t.max }, (_, i) => {
        const text = t.ranks[String(i + 1)];
        const correct = CAPTURE_CORRECTIONS[t.name];
        return correct ? correct(text, i + 1) : text;
      }),
    });
  }
  for (const tree of trees) tree.talents.sort((a, b) => a.row - b.row || a.col - b.col);
  return { trees };
}

const mode = process.argv.includes('--write') ? 'write' : 'check';
const captureArg = process.argv[process.argv.indexOf('--capture') + 1];
const capture = process.argv.includes('--capture') ? captureArg.split('=') : null;
const data = capture
  ? { [CLASSES[capture[0]]]: fromCapture(capture[1]) }
  : await fetchTalentData();
const source = capture ? `https://foreverchanges.pro/talents/${capture[0]}` : SOURCE;

let changed = 0;
for (const [file, key] of Object.entries(CLASSES)) {
  const classData = data[key];
  if (capture && file !== capture[0]) continue;
  if (!classData?.trees) {
    console.log(`${file.padEnd(8)} MISSING from the payload`);
    continue;
  }

  const valuesPathForMerge = join(OUT_DIR, 'values', `${file}.json`);
  const existingValues = existsSync(valuesPathForMerge)
    ? JSON.parse(readFileSync(valuesPathForMerge, 'utf8'))
    : undefined;

  const structure = toStructure(file, classData);
  const values = toValues(file, classData, existingValues);
  structure.source = source;
  values.source = source;
  validate(file, structure);

  const structurePath = join(OUT_DIR, `${file}.json`);
  const valuesPath = join(OUT_DIR, 'values', `${file}.json`);
  const nextStructure = `${JSON.stringify(structure, null, 1)}\n`;
  const nextValues = `${JSON.stringify(values, null, 1)}\n`;

  const before = existsSync(structurePath) ? JSON.parse(readFileSync(structurePath, 'utf8')) : null;
  const beforeCount = before ? before.trees.reduce((s, t) => s + t.talents.length, 0) : 0;
  const afterCount = structure.trees.reduce((s, t) => s + t.talents.length, 0);

  const countNote = beforeCount === afterCount ? '' : `  TALENT COUNT ${beforeCount} -> ${afterCount}`;
  if (countNote) changed += 1;
  const preserved = Object.values(values.talents).filter(
    (t) => t.ranks === 1 && t.values != null,
  ).length;
  const keptNote = preserved > 0 ? `, ${preserved} hand-filled kept` : '';
  console.log(
    `${file.padEnd(8)} ${afterCount} talents, ${Object.keys(values.talents).length} values${keptNote}${countNote}`,
  );

  if (mode === 'write') {
    writeFileSync(structurePath, nextStructure);
    writeFileSync(valuesPath, nextValues);
  }
}

console.log(
  mode === 'write'
    ? '\nWritten. Run `npm run typecheck && npm test`.'
    : `\nChecked only. ${changed} class(es) would change talent count. Pass --write to apply.`,
);
