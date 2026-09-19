#!/usr/bin/env node
/*
 * Rebuild src/data/talents/warrior.json from Forever.
 *
 *   node tools/import_talents.mjs --build     # write the file
 *   node tools/import_talents.mjs --verify    # re-fetch descriptions and diff
 *
 * WHY THIS EXISTS, AND WHY IT IS HALF A TOOL
 *
 * The talent calculator renders client-side, so the GRID -- rows, columns, rank
 * caps, tier gates, prerequisites -- cannot be fetched. It has to be read out
 * of a browser's DOM. `STRUCTURE` below is that read, taken on 2026-09-18 and
 * checked with a SHA-256 computed in the browser against one computed here, so
 * it is the bytes the page produced rather than a transcription of them.
 *
 * Everything else -- each talent's NAME and DESCRIPTION -- comes from the spell
 * the calculator links to, which IS fetchable. That is the half this tool does
 * on its own, and the half most likely to be retuned.
 *
 * WHY IT EXISTS AT ALL: the previous file was corrected BY HAND when Bastion
 * appeared to leave the Protection tree, and the hand edit left Vitality in a
 * slot Forever fills with Bastion -- a five-rank damage talent a shield build
 * badly wants. A hand edit cannot be re-run and cannot be checked. This can.
 */

const TOOLTIP = (id) => `https://nether.wowhead.com/forever/tooltip/spell/${id}`;
const SOURCE = 'https://www.wowhead.com/forever/talent-calc/warrior';
const DATA_FILE = 'src/data/talents/warrior.json';

/**
 * The grid, read from the calculator's DOM on 2026-09-18.
 *
 * SHA-256 of `JSON.stringify(STRUCTURE)` as the browser produced it:
 *   de6df76b0bdba2466c29b07cd2e31e78b3528bb623639823c750f5ce9bfda88a
 *
 * `--build` recomputes that and refuses to write if it differs, so an edit to
 * this array fails loudly rather than silently becoming the new truth. To
 * change it legitimately, re-read the DOM and paste a new hash with it.
 */
const STRUCTURE_SHA256 = 'de6df76b0bdba2466c29b07cd2e31e78b3528bb623639823c750f5ce9bfda88a';

const STRUCTURE = [
  {
    id: 'arms',
    name: 'Arms',
    talents: [
      { row: 0, col: 0, ranks: 3, spell: 12282, slug: 'improved-heroic-strike', tier: 0, requires: null, requiresRanks: null },
      { row: 0, col: 1, ranks: 5, spell: 16462, slug: 'deflection', tier: 0, requires: null, requiresRanks: null },
      { row: 0, col: 2, ranks: 3, spell: 12286, slug: 'improved-rend', tier: 0, requires: null, requiresRanks: null },
      { row: 1, col: 0, ranks: 2, spell: 12285, slug: 'improved-charge', tier: 5, requires: 'Arms Talents', requiresRanks: 5 },
      { row: 1, col: 1, ranks: 5, spell: 12295, slug: 'improved-tactical-mastery', tier: 5, requires: 'Arms Talents', requiresRanks: 5 },
      { row: 1, col: 3, ranks: 2, spell: 12290, slug: 'improved-overpower', tier: 5, requires: 'Arms Talents', requiresRanks: 5 },
      { row: 2, col: 1, ranks: 1, spell: 12296, slug: 'anger-management', tier: 10, requires: 'Arms Talents', requiresRanks: 10 },
      { row: 2, col: 2, ranks: 3, spell: 12834, slug: 'deep-wounds', tier: 10, requires: 'Arms Talents', requiresRanks: 10 },
      { row: 3, col: 0, ranks: 1, spell: 1310222, slug: 'spearing-strike', tier: 15, requires: 'Arms Talents', requiresRanks: 15 },
      { row: 3, col: 1, ranks: 3, spell: 12163, slug: 'two-handed-weapon-specialization', tier: 15, requires: 'Arms Talents', requiresRanks: 15 },
      { row: 3, col: 2, ranks: 2, spell: 16493, slug: 'impale', tier: 15, requires: 'Arms Talents', requiresRanks: 15 },
      { row: 4, col: 0, ranks: 5, spell: 1289682, slug: 'bloodthrill', tier: 20, requires: 'Arms Talents', requiresRanks: 20 },
      { row: 4, col: 1, ranks: 1, spell: 12292, slug: 'sweeping-strikes', tier: 20, requires: 'Arms Talents', requiresRanks: 20 },
      { row: 4, col: 2, ranks: 5, spell: 1290261, slug: 'weaponmaster', tier: 20, requires: 'Arms Talents', requiresRanks: 20 },
      { row: 5, col: 0, ranks: 2, spell: 12862, slug: 'improved-slam', tier: 25, requires: 'Arms Talents', requiresRanks: 25 },
      { row: 5, col: 2, ranks: 3, spell: 12289, slug: 'improved-hamstring', tier: 25, requires: 'Arms Talents', requiresRanks: 25 },
      { row: 6, col: 1, ranks: 1, spell: 12294, slug: 'mortal-strike', tier: 30, requires: 'Arms Talents', requiresRanks: 30 },
    ],
  },
  {
    id: 'fury',
    name: 'Fury',
    talents: [
      { row: 0, col: 1, ranks: 5, spell: 12321, slug: 'booming-voice', tier: 0, requires: null, requiresRanks: null },
      { row: 0, col: 2, ranks: 5, spell: 12320, slug: 'cruelty', tier: 0, requires: null, requiresRanks: null },
      { row: 1, col: 1, ranks: 5, spell: 12962, slug: 'iron-will', tier: 5, requires: 'Fury Talents', requiresRanks: 5 },
      { row: 1, col: 2, ranks: 5, spell: 12322, slug: 'unbridled-wrath', tier: 5, requires: 'Fury Talents', requiresRanks: 5 },
      { row: 2, col: 0, ranks: 3, spell: 12329, slug: 'improved-cleave', tier: 10, requires: 'Fury Talents', requiresRanks: 10 },
      { row: 2, col: 1, ranks: 1, spell: 12323, slug: 'piercing-howl', tier: 10, requires: 'Fury Talents', requiresRanks: 10 },
      { row: 2, col: 2, ranks: 3, spell: 16487, slug: 'blood-craze', tier: 10, requires: 'Fury Talents', requiresRanks: 10 },
      { row: 2, col: 3, ranks: 3, spell: 1310236, slug: 'boundless-rage', tier: 10, requires: 'Fury Talents', requiresRanks: 10 },
      { row: 3, col: 0, ranks: 5, spell: 23584, slug: 'dual-wield-specialization', tier: 15, requires: 'Fury Talents', requiresRanks: 15 },
      { row: 3, col: 1, ranks: 1, spell: 1310315, slug: 'raging-blows', tier: 15, requires: 'Fury Talents', requiresRanks: 15 },
      { row: 3, col: 2, ranks: 5, spell: 12317, slug: 'enrage', tier: 15, requires: 'Fury Talents', requiresRanks: 15 },
      { row: 3, col: 3, ranks: 2, spell: 20502, slug: 'improved-execute', tier: 15, requires: 'Fury Talents', requiresRanks: 15 },
      { row: 4, col: 0, ranks: 3, spell: 1225295, slug: 'precision', tier: 20, requires: 'Fury Talents', requiresRanks: 20 },
      { row: 4, col: 1, ranks: 1, spell: 12328, slug: 'death-wish', tier: 20, requires: 'Fury Talents', requiresRanks: 20 },
      { row: 4, col: 3, ranks: 2, spell: 20504, slug: 'improved-intercept', tier: 20, requires: 'Fury Talents', requiresRanks: 20 },
      { row: 5, col: 0, ranks: 2, spell: 20500, slug: 'improved-berserker-rage', tier: 25, requires: 'Fury Talents', requiresRanks: 25 },
      { row: 5, col: 2, ranks: 5, spell: 12319, slug: 'flurry', tier: 25, requires: 'Fury Talents', requiresRanks: 25 },
      { row: 6, col: 1, ranks: 1, spell: 23881, slug: 'bloodthirst', tier: 30, requires: 'Fury Talents', requiresRanks: 30 },
    ],
  },
  {
    id: 'protection',
    name: 'Protection',
    talents: [
      { row: 0, col: 1, ranks: 5, spell: 12298, slug: 'shield-specialization', tier: 0, requires: null, requiresRanks: null },
      { row: 0, col: 2, ranks: 5, spell: 12297, slug: 'anticipation', tier: 0, requires: null, requiresRanks: null },
      { row: 1, col: 0, ranks: 2, spell: 12301, slug: 'improved-bloodrage', tier: 5, requires: 'Protection Talents', requiresRanks: 5 },
      { row: 1, col: 2, ranks: 5, spell: 12299, slug: 'toughness', tier: 5, requires: 'Protection Talents', requiresRanks: 5 },
      { row: 1, col: 3, ranks: 3, spell: 12287, slug: 'improved-thunder-clap', tier: 5, requires: 'Protection Talents', requiresRanks: 5 },
      { row: 2, col: 0, ranks: 1, spell: 12975, slug: 'last-stand', tier: 10, requires: 'Protection Talents', requiresRanks: 10 },
      { row: 2, col: 1, ranks: 2, spell: 1310316, slug: 'master-of-defense', tier: 10, requires: 'Protection Talents', requiresRanks: 10 },
      { row: 2, col: 2, ranks: 3, spell: 12797, slug: 'improved-revenge', tier: 10, requires: 'Protection Talents', requiresRanks: 10 },
      { row: 2, col: 3, ranks: 3, spell: 12792, slug: 'defiance', tier: 10, requires: 'Protection Talents', requiresRanks: 10 },
      { row: 3, col: 0, ranks: 3, spell: 12308, slug: 'improved-sunder-armor', tier: 15, requires: 'Protection Talents', requiresRanks: 15 },
      { row: 3, col: 1, ranks: 3, spell: 12313, slug: 'improved-disarm', tier: 15, requires: 'Protection Talents', requiresRanks: 15 },
      { row: 3, col: 2, ranks: 1, spell: 1310317, slug: 'vanguard', tier: 15, requires: 'Protection Talents', requiresRanks: 15 },
      { row: 4, col: 0, ranks: 2, spell: 12312, slug: 'improved-shield-wall', tier: 20, requires: 'Protection Talents', requiresRanks: 20 },
      { row: 4, col: 1, ranks: 1, spell: 12809, slug: 'concussion-blow', tier: 20, requires: 'Protection Talents', requiresRanks: 20 },
      { row: 4, col: 2, ranks: 2, spell: 12311, slug: 'improved-shield-bash', tier: 20, requires: 'Protection Talents', requiresRanks: 20 },
      { row: 4, col: 3, ranks: 5, spell: 16538, slug: 'bastion', tier: 20, requires: 'Protection Talents', requiresRanks: 20 },
      { row: 5, col: 2, ranks: 3, spell: 29787, slug: 'focused-rage', tier: 25, requires: 'Protection Talents', requiresRanks: 25 },
      { row: 6, col: 1, ranks: 1, spell: 23922, slug: 'shield-slam', tier: 30, requires: 'Protection Talents', requiresRanks: 30 },
    ],
  },
];

/**
 * Prerequisites, read from the same DOM.
 *
 * Kept SEPARATE from the grid above because the calculator stores them in the
 * same attribute as the tier gate, one per line, and a regex that reads only
 * the first line returns the tier gate for every talent and no prerequisite for
 * any of them. Splitting them apart here makes that mistake impossible to
 * repeat silently: a prerequisite is either in this map or it does not exist.
 */
const PREREQUISITES = {
  'mortal-strike': { requires: 'Sweeping Strikes', requiresRanks: 1 },
  'deep-wounds': { requires: 'Improved Rend', requiresRanks: 3 },
  'anger-management': { requires: 'Improved Tactical Mastery', requiresRanks: 5 },
  flurry: { requires: 'Enrage', requiresRanks: 5 },
  bloodthirst: { requires: 'Death Wish', requiresRanks: 1 },
  'shield-slam': { requires: 'Concussion Blow', requiresRanks: 1 },
  'last-stand': { requires: 'Improved Bloodrage', requiresRanks: 2 },
  'master-of-defense': { requires: 'Shield Specialization', requiresRanks: 5 },
};

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
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

class RateLimited extends Error {}

async function politeFetch(url, attempt = 1) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SimForever-import' } });
  if (response.status === 403 || response.status === 429) {
    if (attempt >= 4) throw new RateLimited(`HTTP ${response.status} for ${url}`);
    await pause(2000 * attempt);
    return politeFetch(url, attempt + 1);
  }
  return response;
}

/** Name and rank-one description, from the talent's own spell. */
async function describe(spell) {
  const res = await politeFetch(TOOLTIP(spell));
  if (!res.ok) throw new Error(`spell ${spell}: HTTP ${res.status}`);
  const raw = await res.json();
  const lines = toText(raw.tooltip).split('\n');
  return { name: raw.name, description: lines[lines.length - 1] ?? '' };
}

async function build() {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(JSON.stringify(STRUCTURE)).digest('hex');
  if (hash !== STRUCTURE_SHA256) {
    console.error(
      `STRUCTURE has been edited.\n  expected ${STRUCTURE_SHA256}\n  got      ${hash}\n` +
        `\nThe grid is a verbatim read of the calculator's DOM and is not meant to be\n` +
        `hand-edited -- that is exactly how Vitality ended up in Bastion's slot.\n` +
        `Re-read the DOM, and paste the new hash alongside the new array.`,
    );
    process.exit(1);
  }

  const trees = [];
  for (const tree of STRUCTURE) {
    const talents = [];
    for (const t of tree.talents) {
      const { name, description } = await describe(t.spell);
      const pre = PREREQUISITES[t.slug] ?? { requires: null, requiresRanks: null };
      talents.push({
        row: t.row,
        col: t.col,
        ranks: t.ranks,
        name,
        icon: '',
        tier: t.tier,
        requires: pre.requires,
        requiresRanks: pre.requiresRanks,
        description,
      });
      console.error(`  ${tree.name.padEnd(11)} ${name}`);
      await pause(400);
    }
    trees.push({ id: tree.id, name: tree.name, talents });
  }

  const { readFileSync, writeFileSync } = await import('node:fs');
  // Icons are not on the spell endpoint; keep whatever the old file had.
  let icons = {};
  try {
    const old = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    for (const tree of old.trees) for (const t of tree.talents) icons[t.name] = t.icon;
  } catch {
    /* first run */
  }
  for (const tree of trees) for (const t of tree.talents) t.icon = icons[t.name] ?? '';

  writeFileSync(
    DATA_FILE,
    JSON.stringify({ class: 'warrior', source: SOURCE, trees }, null, 1) + '\n',
    'utf8',
  );
  console.error(`\nwrote ${trees.reduce((n, t) => n + t.talents.length, 0)} talents`);
}

async function verify() {
  const { readFileSync } = await import('node:fs');
  const stored = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const byName = new Map();
  for (const tree of stored.trees) for (const t of tree.talents) byName.set(t.name, t);

  let same = 0;
  let total = 0;
  for (const tree of STRUCTURE) {
    for (const t of tree.talents) {
      total++;
      const { name, description } = await describe(t.spell);
      const on = byName.get(name);
      if (!on) {
        console.log(`\nMISSING from the file: ${name} (spell ${t.spell})`);
      } else if (on.description !== description) {
        console.log(`\n${name}\n  fetched ${JSON.stringify(description)}\n  stored  ${JSON.stringify(on.description)}`);
      } else same++;
      await pause(400);
    }
  }
  console.log(`\n${same} of ${total} talents reproduce exactly.`);
  if (same !== total) process.exit(1);
}

const mode = process.argv[2];
try {
  if (mode === '--build') await build();
  else if (mode === '--verify') await verify();
  else {
    console.error('usage: import_talents.mjs --build | --verify');
    process.exit(1);
  }
} catch (error) {
  if (error instanceof RateLimited) {
    console.error(`\nWowhead is rate-limiting this run (${error.message}).\nThe data on file is unchanged. Wait a few minutes and retry.`);
    process.exit(2);
  }
  throw error;
}
