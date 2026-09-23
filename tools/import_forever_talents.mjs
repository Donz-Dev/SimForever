/*
 * Import every class's talent tree from the WoW Forever BETA CLIENT.
 *
 *   node tools/import_forever_talents.mjs --check    diff against what is on disk
 *   node tools/import_forever_talents.mjs --write    rewrite src/data/talents/
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

const mode = process.argv.includes('--write') ? 'write' : 'check';
const data = await fetchTalentData();

let changed = 0;
for (const [file, key] of Object.entries(CLASSES)) {
  const classData = data[key];
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
