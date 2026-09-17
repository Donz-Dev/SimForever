#!/usr/bin/env node
/*
 * Build src/data/talents/values/<class>.json — the hand-editable file holding
 * what each talent's number is at each rank.
 *
 * Two modes:
 *
 *   node tools/derive_talent_values.js skeleton
 *       Regenerates every class from the talent structure already in the repo,
 *       with `values: null` everywhere. Nothing is invented: a null means the
 *       number is not known yet.
 *
 *   node tools/derive_talent_values.js fill <capture.json> [...]
 *       Fills in values from one or more captures produced by
 *       tools/talent_ranks_browser.js, preserving any value a human has
 *       already edited unless --overwrite is passed.
 *
 *
 * WHY A SEPARATE FILE FROM src/data/talents/<class>.json
 *
 * That file is scraped structure — rows, columns, prerequisites, rank caps —
 * and is never hand-edited; refreshing it means re-running the scrape. Balance
 * numbers change far more often than tree structure does, and they are exactly
 * the thing a person wants to edit directly. Keeping them apart means changing
 * what Flurry grants is a one-line edit to a readable file, and nothing about
 * that edit risks disturbing the tree it belongs to.
 *
 *
 * WHAT A VALUE IS
 *
 * Nearly every talent varies exactly one number as it ranks up, and that number
 * is the only thing worth storing:
 *
 *     Improved Heroic Strike   1, 2, 3
 *     Flurry                   5, 10, 15, 20, 25
 *
 * So an entry holds the text with a `{0}` where the number goes, and the value
 * at each rank. Numbers that do NOT change between ranks stay written into the
 * text, because they are not the variable. A talent that varies two numbers
 * gets `{0}` and `{1}`, and each rank's entry is a pair.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRUCTURE_DIR = path.join(ROOT, 'src', 'data', 'talents');
const VALUES_DIR = path.join(STRUCTURE_DIR, 'values');

/** Must match `talentId` in src/game/talents/talentData.ts. */
const talentId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const NUMBER = /-?\d+(?:\.\d+)?/g;

/**
 * Split text into the literal pieces between numbers, plus the numbers.
 * "by 1 Rage" -> { shape: ['by ', ' Rage'], numbers: [1] }
 */
function tokenize(text) {
  const numbers = [];
  const shape = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER)) {
    shape.push(text.slice(last, m.index));
    numbers.push(Number(m[0]));
    last = m.index + m[0].length;
  }
  shape.push(text.slice(last));
  return { shape, numbers };
}

/**
 * Work out which number varies across ranks.
 *
 * Returns { text, values } on success, or { irregular: <reason> } when the
 * ranks are not the same sentence with different numbers — a Druid talent whose
 * higher ranks add a clause, for instance. Those are left for a human rather
 * than guessed at.
 */
function derive(rankTexts) {
  const parsed = rankTexts.map(tokenize);
  const shape = parsed[0].shape;
  const sameShape = parsed.every(
    (p) => p.shape.length === shape.length && p.shape.every((s, i) => s === shape[i]),
  );
  if (!sameShape) return { irregular: 'ranks differ by more than their numbers' };

  const count = parsed[0].numbers.length;
  const varying = [];
  for (let i = 0; i < count; i++) {
    const column = parsed.map((p) => p.numbers[i]);
    if (new Set(column).size > 1) varying.push(i);
  }

  // A single rank cannot reveal which of its numbers is the variable.
  if (rankTexts.length === 1) return { text: rankTexts[0], values: null, note: 'single rank' };
  if (!varying.length) return { irregular: 'no number changes between ranks' };

  let text = '';
  for (let i = 0; i < count; i++) {
    const slot = varying.indexOf(i);
    text += shape[i] + (slot === -1 ? String(parsed[0].numbers[i]) : `{${slot}}`);
  }
  text += shape[count];

  const values = parsed.map((p) => (varying.length === 1 ? p.numbers[varying[0]] : varying.map((i) => p.numbers[i])));
  return { text, values };
}

function readStructure() {
  return fs
    .readdirSync(STRUCTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(STRUCTURE_DIR, f), 'utf8')));
}

function writeValues(cls, doc) {
  fs.mkdirSync(VALUES_DIR, { recursive: true });
  const file = path.join(VALUES_DIR, `${cls}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return file;
}

function loadValues(cls) {
  const file = path.join(VALUES_DIR, `${cls}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function skeleton() {
  let talents = 0;
  for (const structure of readStructure()) {
    const existing = loadValues(structure.class);
    const doc = {
      class: structure.class,
      source: structure.source,
      structure: `src/data/talents/${structure.class}.json`,
      talents: {},
    };
    for (const tree of structure.trees) {
      for (const t of tree.talents) {
        const id = talentId(t.name);
        const prev = existing?.talents?.[id];
        doc.talents[id] = prev ?? {
          name: t.name,
          tree: tree.id,
          ranks: t.ranks,
          text: t.description,
          values: null,
        };
        talents++;
      }
    }
    const file = writeValues(structure.class, doc);
    console.log(`${structure.class.padEnd(8)} ${Object.keys(doc.talents).length} talents -> ${path.relative(ROOT, file)}`);
  }
  console.log(`\n${talents} talents total. Every value is null until captured or entered by hand.`);
}

function fill(files, overwrite) {
  for (const f of files) {
    const capture = JSON.parse(fs.readFileSync(f, 'utf8'));
    const doc = loadValues(capture.class);
    if (!doc) throw new Error(`No values file for ${capture.class}. Run "skeleton" first.`);

    let filled = 0;
    let irregular = 0;
    let skipped = 0;
    const notes = [];
    for (const c of capture.capturedRanks) {
      const id = talentId(c.name);
      const entry = doc.talents[id];
      if (!entry) { notes.push(`  not in structure: ${c.name}`); continue; }
      if (entry.values !== null && !overwrite) { skipped++; continue; }
      if (c.ranks.length !== c.maxRanks || c.ranks.some((x) => !x)) {
        notes.push(`  incomplete capture: ${c.name}`);
        continue;
      }
      const result = derive(c.ranks);
      if (result.irregular) {
        entry.values = null;
        entry.irregular = result.irregular;
        entry.rankText = c.ranks;
        irregular++;
      } else {
        entry.text = result.text;
        entry.values = result.values;
        delete entry.irregular;
        delete entry.rankText;
        if (result.note) entry.note = result.note;
        filled++;
      }
    }
    const file = writeValues(capture.class, doc);
    console.log(
      `${capture.class.padEnd(8)} filled ${filled}, irregular ${irregular}, kept existing ${skipped} -> ${path.relative(ROOT, file)}`,
    );
    if (notes.length) console.log(notes.join('\n'));
  }
}

const [mode, ...rest] = process.argv.slice(2);
const overwrite = rest.includes('--overwrite');
const files = rest.filter((a) => !a.startsWith('--'));

if (mode === 'skeleton') skeleton();
else if (mode === 'fill' && files.length) fill(files, overwrite);
else {
  console.error('usage: derive_talent_values.js skeleton');
  console.error('       derive_talent_values.js fill <capture.json> [...] [--overwrite]');
  process.exit(1);
}
