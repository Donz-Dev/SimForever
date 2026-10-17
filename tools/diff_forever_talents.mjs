/*
 * What CHANGED in a class's talent tree, talent by talent.
 *
 *   node tools/diff_forever_talents.mjs                 every class
 *   node tools/diff_forever_talents.mjs shaman mage     only these
 *
 * ----------------------------------------------------------------------------
 * `import_forever_talents.mjs --check` REPORTS A COUNT, AND A COUNT CANNOT SEE
 * A SWAP.
 *
 * That is the whole reason this exists. A patch that replaces one talent with
 * another leaves the count identical, and so does moving a row, changing a
 * prerequisite, adding a rank or restating a value -- every one of which this
 * project has been caught by:
 *
 *   a RENAME is a new talent id, which silently loses a hand-filled value
 *   a ROW move changes the tier, which changes which builds are legal
 *   a RANK count change makes a saved build decode into the wrong talents
 *   a DESCRIPTION change is a value change, and the generated values follow it
 *
 * So this diffs the live payload against what is on disk along every one of
 * those axes and prints only what moved. It writes nothing -- `--write` on the
 * importer is still the only thing that touches `src/data/talents/`.
 *
 * READ THE DESCRIPTION DIFFS, which are where a patch hides. A talent that
 * keeps its name, row, ranks and prerequisite and changes its NUMBERS is the
 * commonest kind of change and the one with no structural tell at all.
 * ----------------------------------------------------------------------------
 */
import { readFileSync, existsSync } from 'node:fs';

const SOURCE = 'https://talentsforever.com/talents.js';

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

const treeId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

async function fetchTalentData() {
  const res = await fetch(SOURCE, { headers: { 'user-agent': 'SimForever-diff' } });
  if (!res.ok) throw new Error(`${SOURCE} returned ${res.status}`);
  const scope = {};
  // Same parser as the importer: the file is an assignment, not JSON.
  new Function('window', await res.text())(scope);
  if (!scope.TALENT_DATA) throw new Error('no TALENT_DATA in the payload');
  return scope.TALENT_DATA;
}

/** The live tree, in the shape the on-disk file already uses. */
function live(classData) {
  return classData.trees.map((tree) => {
    const byName = new Map(tree.talents.map((t) => [t.name, t]));
    return {
      id: treeId(tree.name),
      name: tree.name,
      talents: tree.talents.map((t) => ({
        row: t.row - 1,
        col: t.col - 1,
        ranks: t.max,
        name: t.name,
        tier: (t.row - 1) * 5,
        requires: t.req ?? null,
        requiresRanks: t.req ? (byName.get(t.req)?.max ?? null) : null,
        description: t.desc?.[t.desc.length - 1] ?? '',
      })),
    };
  });
}

const FIELDS = ['row', 'col', 'ranks', 'tier', 'requires', 'requiresRanks'];

/** A description as ONE line, so `was:` and `now:` stay next to each other. */
const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

function diffTree(before, after, treeName, out) {
  const was = new Map(before.map((t) => [t.name, t]));
  const now = new Map(after.map((t) => [t.name, t]));

  for (const [name, t] of now) {
    if (!was.has(name)) out.push(`    + ADDED    ${name}  (row ${t.row}, ${t.ranks} ranks)`);
  }
  for (const [name, t] of was) {
    if (!now.has(name)) out.push(`    - REMOVED  ${name}  (row ${t.row}, ${t.ranks} ranks)`);
  }

  for (const [name, after1] of now) {
    const before1 = was.get(name);
    if (!before1) continue;

    for (const field of FIELDS) {
      if (before1[field] !== after1[field]) {
        out.push(`    ~ ${name}: ${field}  ${before1[field]} -> ${after1[field]}`);
      }
    }
    if (before1.description !== after1.description) {
      /*
       * ONE LINE EACH, WITH NEWLINES ESCAPED, AND THAT IS NOT COSMETIC.
       *
       * A dozen of these descriptions carry a blank line and a second
       * paragraph -- Moonkin Form, Devouring Contagion, Water Shield. Printed
       * raw, the `was:` and `now:` labels end up several lines apart and a
       * reader pairs the wrong halves: the first pass over this output
       * concluded that Moonkin Form and Furor had LOST their descriptions
       * entirely, which would have meant their generated values coming back
       * null and the Moonkin's 360% armor silently switching off. Both were
       * fine. **The tool invented a critical finding by wrapping a line.**
       */
      out.push(`    ~ ${name}: DESCRIPTION`);
      out.push(`        was: ${oneLine(before1.description)}`);
      out.push(`        now: ${oneLine(after1.description)}`);
    }
  }

  // Position in the tree IS the build encoding, so a reorder matters even when
  // every talent survives: one digit per talent in tree order.
  const beforeOrder = before.map((t) => t.name).join('|');
  const afterOrder = after.map((t) => t.name).join('|');
  if (beforeOrder !== afterOrder && out.length === 0) {
    out.push(`    ~ TREE ORDER changed with no talent added or removed`);
  }
  if (out.length > 0) out.unshift(`  ${treeName}`);
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const data = await fetchTalentData();
let anyChange = false;

for (const [file, key] of Object.entries(CLASSES)) {
  if (wanted.length > 0 && !wanted.includes(file)) continue;

  const path = `src/data/talents/${file}.json`;
  if (!existsSync(path)) {
    console.log(`\n${file}: NOT ON DISK`);
    continue;
  }
  const onDisk = JSON.parse(readFileSync(path, 'utf8'));
  const classData = data[key];
  if (!classData) {
    console.log(`\n${file}: NOT IN THE PAYLOAD`);
    continue;
  }

  const after = live(classData);
  const lines = [];

  // Trees are matched by id, not by position, so a reordered tree list reads as
  // unchanged rather than as every talent moving.
  const beforeTrees = new Map(onDisk.trees.map((t) => [t.id, t]));
  for (const tree of after) {
    const was = beforeTrees.get(tree.id);
    if (!was) {
      lines.push(`  ${tree.name}: NEW TREE`);
      continue;
    }
    diffTree(was.talents, tree.talents, tree.name, lines);
  }
  for (const [id, tree] of beforeTrees) {
    if (!after.some((t) => t.id === id)) lines.push(`  ${tree.name}: TREE GONE`);
  }

  const countWas = onDisk.trees.reduce((n, t) => n + t.talents.length, 0);
  const countNow = after.reduce((n, t) => n + t.talents.length, 0);

  if (lines.length === 0 && countWas === countNow) {
    console.log(`\n${file}: unchanged (${countNow} talents)`);
    continue;
  }
  anyChange = true;
  console.log(`\n${file}: ${countWas} -> ${countNow} talents`);
  for (const line of lines) console.log(line);
}

console.log(anyChange ? '\nChanges above. Nothing written.\n' : '\nNo changes.\n');
