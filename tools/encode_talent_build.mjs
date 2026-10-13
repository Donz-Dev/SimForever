/*
 * Encode a preset's TalentAllocation back into a talentsforever.com build URL,
 * so an allocation this repository chose can be audited on the site that owns
 * the trees.
 *
 *   node tools/encode_talent_build.mjs pally_shockadin pally_shockadin_2h
 *   node tools/encode_talent_build.mjs --all
 *
 * ----------------------------------------------------------------------------
 * EVERY URL IS DECODED AGAIN BEFORE IT IS PRINTED, and the round trip has to
 * come back byte-for-byte equal to the allocation that went in. That is not
 * belt and braces: position is the ONLY key this encoding has, so a talent
 * added, removed or moved in the tree shifts every digit after it and produces
 * a legal-looking build that is not the one anybody chose --
 * `decode_talent_build.mjs` says so in its own words, and seven of twenty URLs
 * stopped decoding at client build 1.60.1.70170 for exactly that reason.
 *
 * THE TAIL IS CARRIED OVER RATHER THAN GENERATED. Everything after the third
 * tree is the Legacy perk selection and a version marker, neither of which this
 * project models -- so a preset whose URL is on record keeps that URL's tail and
 * only its talent digits are rewritten. Inventing a perk string would be
 * inventing a choice the owner made elsewhere.
 * ----------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { decode, PROFILES } from './decode_talent_build.mjs';

const talentId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

function treesFor(classId) {
  return JSON.parse(readFileSync(`src/data/talents/${classId}.json`, 'utf8')).trees;
}

/**
 * The tail a build URL carries, read off the one already on record for it.
 *
 * ==============================================================================
 * EVERYTHING AFTER THE THIRD TREE IS THE LEGACY PERK SELECTION AND A VERSION
 * MARKER, neither of which this project models -- so it is CARRIED OVER rather
 * than generated, and generating one would be inventing a choice the owner made
 * somewhere this repository cannot see.
 *
 * KEYED BY THE PROFILE'S NAME AND NOT BY ITS CLASS, which was the first version
 * and is wrong in a way that renders perfectly: the perk letters are per BUILD,
 * so a class-keyed table handed the Retribution Paladin and the Protection
 * Paladin the Shockadin's perks. The digits were right and the tail was
 * somebody else's.
 *
 * READ FROM `decode_talent_build.mjs`'s own list rather than copied, so there is
 * one record of what each build's URL is and this cannot drift from it.
 * ==============================================================================
 */
const TAIL_BY_NAME = new Map(
  PROFILES.map(([, name, url]) => {
    const encoded = url.match(/talentsforever\.com\/[a-z]+\/\d+\/([^/?#]*)/i)?.[1] ?? '';
    // Three tree segments, then whatever is left.
    const parts = encoded.split('-');
    return [name, parts.slice(3).join('-')];
  }),
);

export function encode(classId, allocation, name) {
  const trees = treesFor(classId);

  const segments = trees.map((tree) => {
    const digits = tree.talents.map((talent) => allocation[talentId(talent.name)] ?? 0);
    // Trailing zeroes are dropped, which is what the site emits and what the
    // decoder expects: a segment is allowed to be shorter than its tree.
    while (digits.length > 0 && digits[digits.length - 1] === 0) digits.pop();
    for (const [index, rank] of digits.entries()) {
      if (rank > tree.talents[index].ranks) {
        throw new Error(
          `${classId}/${tree.id}: ${tree.talents[index].name} given ${rank} of ` +
            `${tree.talents[index].ranks} ranks`,
        );
      }
    }
    return digits.join('');
  });

  const tail = TAIL_BY_NAME.get(name) ?? '';
  const url = `https://talentsforever.com/${classId}/60/${segments.join('-')}-${tail}`;

  /*
   * THE ROUND TRIP, which is the whole guarantee. An allocation that comes back
   * different means the tree on disk is not the tree the site is serving, and
   * the URL would be a plausible wrong build rather than an error.
   */
  const back = decode(url);
  const wanted = Object.fromEntries(
    Object.entries(allocation).filter(([, rank]) => rank > 0),
  );
  const got = back.allocation;
  const keys = new Set([...Object.keys(wanted), ...Object.keys(got)]);
  for (const key of keys) {
    if (wanted[key] !== got[key]) {
      throw new Error(
        `round trip changed ${key}: ${wanted[key] ?? 0} in, ${got[key] ?? 0} out. ` +
          'The tree on disk does not match the one this URL encodes against.',
      );
    }
  }

  return { url, perTree: back.perTree, total: back.total };
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { PROFILE_PRESETS, PRESETS_BY_ID } = await import('../src/profiles/presets.ts');

  const ids =
    args.length === 0 || args[0] === '--all'
      ? PROFILE_PRESETS.map((preset) => preset.id)
      : args;

  for (const id of ids) {
    const preset = PRESETS_BY_ID.get(id);
    if (!preset) {
      console.log(`${id}: no such preset`);
      continue;
    }
    const profile = preset.build();
    const classId = profile.character.characterClass;
    try {
      const { url, perTree, total } = encode(classId, profile.talents, preset.label);
      console.log(`\n${preset.label}  (${id})   ${perTree.join('/')}   ${total} points`);
      console.log(`  ${url}`);
    } catch (error) {
      console.log(`\n${preset.label}  (${id})   FAILED: ${error.message}`);
    }
  }
  console.log('');
}

/*
 * NO ENTRY-POINT GUARD HERE, AND THE REASON IS THE RUNNER RATHER THAN A
 * SHORTCUT. This file has to run under `vite-node`, because it imports
 * `presets.ts` -- and vite-node puts ITS OWN path in `process.argv[1]` and
 * drops the script name from argv entirely, so `import.meta.url ===
 * pathToFileURL(process.argv[1]).href` is false for every script it runs.
 *
 * The guard in `decode_talent_build.mjs` is correct because that file is plain
 * `.mjs` run by `node`, and it is the one that NEEDED a guard: it is the
 * module being imported. This one is a leaf nothing imports, so running `main`
 * unconditionally is the honest version of the same intent.
 */
await main();
