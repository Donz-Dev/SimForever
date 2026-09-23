/*
 * Decode a talentsforever.com build URL into a TalentAllocation.
 *
 *   node tools/decode_talent_build.mjs <url> [<url> ...]
 *   node tools/decode_talent_build.mjs --profiles          decode every profile below
 *
 * ----------------------------------------------------------------------------
 * THE ENCODING, worked out from a build whose totals the site prints.
 *
 *   https://talentsforever.com/druid/60/5232220115501351--505003-BDEF...-3
 *                              ^class ^level ^tree1 ^t2 ^t3   ^perks ^ver
 *
 * ONE DIGIT PER TALENT, in the order the tree lists them, trees separated by
 * `-`. Trailing zeroes are dropped, so a segment is shorter than its tree and
 * an empty segment means no points at all. Anything after the third tree is
 * the Legacy perk selection and a version marker, neither of which this
 * project models.
 *
 * Verified against the site's own arithmetic: the Moonkin URL decodes to 38
 * Balance and 13 Restoration, and the page header reads "38/0/13, Points
 * left: 0".
 *
 * WHICH IS WHY THE TREE HAS TO BE EXACTLY RIGHT. Position is the only key
 * there is: one extra, missing or reordered talent and every digit after it
 * lands on the wrong one, silently, producing a legal-looking build that is
 * not the one anybody chose. Our Wowhead scrape had three such errors across
 * the nine classes -- see `tools/import_forever_talents.mjs`.
 * ----------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';

/** The profiles the ruleset owner specified, by class and name. */
const PROFILES = [
  ['druid', 'Moonkin', 'https://talentsforever.com/druid/60/5232220115501351--505003-BDEFHCJMNKOPjloAI-3'],
  ['druid', 'Cat', 'https://talentsforever.com/druid/60/050022-3520002123032213051-052-BF1klRSQWXYcbZdefh4ihFE-3'],
  ['druid', 'Bear', 'https://talentsforever.com/druid/60/050022-4523032120132210551--RVSTBFEXYcbWaehigdQ-3'],
  ['paladin', 'Seal Twist Ret', 'https://talentsforever.com/paladin/60/253003--052253312012330321-jBFAkmnopqtsuvyxzCl-3'],
  ['paladin', 'Shockadin', 'https://talentsforever.com/paladin/60/235303003000121--0522503020120303-ABFDIMC3ON1jlkm1qostm2vmxCN-3'],
  ['paladin', 'Prot Pally', 'https://talentsforever.com/paladin/60/230003-0530313321301551-502-TUW2XYa1cbaeikf4ghABFfZW-3'],
  ['hunter', 'BM Hunter', 'https://talentsforever.com/hunter/60/5320001505101251-30502500005--ACBGHJMKNOPSVQUa-3'],
  ['hunter', 'LW Ranged', 'https://talentsforever.com/hunter/60/502-3050052511523151-5-ASQVYXZacefWgbdC-3'],
  ['hunter', 'LW Melee', 'https://talentsforever.com/hunter/60/502-005005201-500240031050220151-ACSVWYgjk3onkqtsvwx-3'],
  ['mage', 'Frostfire', 'https://talentsforever.com/mage/60/-0055103013013304-00550003310003002-3'],
  ['mage', 'Arcane', 'https://talentsforever.com/mage/60/255225223122311531-13--3'],
  ['mage', 'Fire', 'https://talentsforever.com/mage/60/050005-23552330130113151-002-3'],
  ['rogue', 'Venom', 'https://talentsforever.com/rogue/60/00532310551501051-303303-002-kRT2WUCFEDGI1LKJNPQIT-3'],
  ['rogue', 'Combat', 'https://talentsforever.com/rogue/60/005323104-32003311201515231--SRWVYZXbcdegf1hCFDEGIf-3'],
  ['rogue', 'Rupture', 'https://talentsforever.com/rogue/60/005203002-3023-5320003312013011051-kjoCFDIRTUi2qpi1uti1wxirz0-3'],
  ['priest', 'Shadow', 'https://talentsforever.com/priest/60/0052030303-3-505322001201302051-jnom1rsmuv1l3xvl1z0SlCFDJH-3'],
  ['warlock', 'SM/DS', 'https://talentsforever.com/warlock/60/05550320035201351-0050203001--3'],
  ['warlock', 'Firelock', 'https://talentsforever.com/warlock/60/05-0050203001-2050355103101351-3'],
  ['shaman', 'Enhance', 'https://talentsforever.com/shaman/60/05003305201-052031031005112251--BEFHIKRS1UVXYbcdefgSh-3'],
  ['shaman', 'Ele', 'https://talentsforever.com/shaman/60/5505301503123131-055002001--3'],
];

const TALENT_POINTS_AT_60 = 51;
const talentId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

function treesFor(classId) {
  const path = `src/data/talents/${classId}.json`;
  return JSON.parse(readFileSync(path, 'utf8')).trees;
}

/**
 * Decode one URL. Throws rather than guessing when anything does not line up.
 */
export function decode(url) {
  const match = url.match(/talentsforever\.com\/([a-z]+)\/\d+\/([^/?#]*)/i);
  if (!match) throw new Error(`not a talentsforever build URL: ${url}`);
  const [, classId, encoded] = match;

  const trees = treesFor(classId);
  const segments = encoded.split('-');

  const allocation = {};
  const perTree = [];

  trees.forEach((tree, index) => {
    const digits = segments[index] ?? '';
    if (digits.length > tree.talents.length) {
      throw new Error(
        `${classId}/${tree.id}: ${digits.length} digits for ${tree.talents.length} talents. ` +
          'The tree on disk does not match the one the URL was written against.',
      );
    }

    let spent = 0;
    // Trailing zeroes are dropped, so anything past the segment is unspent.
    for (let i = 0; i < digits.length; i += 1) {
      const rank = Number(digits[i]);
      const talent = tree.talents[i];
      if (!Number.isInteger(rank)) throw new Error(`${classId}/${tree.id}: bad digit "${digits[i]}"`);
      if (rank > talent.ranks) {
        throw new Error(
          `${classId}/${tree.id}: ${talent.name} given ${rank} of ${talent.ranks} ranks. ` +
            'The digits are landing on the wrong talents.',
        );
      }
      if (rank > 0) allocation[talentId(talent.name)] = rank;
      spent += rank;
    }
    perTree.push(spent);
  });

  const total = perTree.reduce((a, b) => a + b, 0);
  return { classId, url, allocation, perTree, total };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const targets = args.includes('--profiles')
  ? PROFILES
  : args.map((url) => [url.match(/talentsforever\.com\/([a-z]+)/i)?.[1] ?? '?', '', url]);

if (targets.length === 0) {
  console.log('usage: node tools/decode_talent_build.mjs <url> | --profiles');
  process.exit(1);
}

let bad = 0;
for (const [, name, url] of targets) {
  try {
    const result = decode(url);
    const spread = result.perTree.join('/');
    const flag = result.total === TALENT_POINTS_AT_60 ? '  ok  ' : ` ${result.total}pt `;
    if (result.total !== TALENT_POINTS_AT_60) bad += 1;
    console.log(
      `${flag} ${result.classId.padEnd(8)} ${(name || '').padEnd(15)} ${spread.padEnd(10)} ` +
        `${Object.keys(result.allocation).length} talents`,
    );
    if (args.includes('--verbose')) {
      console.log(`         ${JSON.stringify(result.allocation)}`);
    }
  } catch (error) {
    bad += 1;
    console.log(` FAIL  ${(name || url).padEnd(24)} ${error.message}`);
  }
}

console.log(
  bad === 0
    ? `\nAll ${targets.length} decoded to ${TALENT_POINTS_AT_60} points.`
    : `\n${bad} of ${targets.length} did not decode cleanly.`,
);
