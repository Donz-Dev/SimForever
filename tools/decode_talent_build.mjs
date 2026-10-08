/*
 * Decode a talentsforever.com build URL into a TalentAllocation.
 *
 *   node tools/decode_talent_build.mjs <url> [<url> ...]
 *   node tools/decode_talent_build.mjs --profiles          decode every profile below
 *   node tools/decode_talent_build.mjs --presets           diff each against presets.ts
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

/**
 * The profiles the ruleset owner specified, by class and name.
 *
 * ----------------------------------------------------------------------------
 * NINE OF THESE MOVED AT CLIENT BUILD 1.60.1.70170, and the reason is worth
 * more than the new strings: SEVEN OF THEM STOPPED DECODING AT ALL. Position is
 * the only key this encoding has, so a talent added, removed or MOVED shifts
 * every digit after it -- and the patch that moved them removed four talents
 * nobody announced (the Paladin's Improved Holy Strike and Crusade, the
 * Warrior's Precision and Toughness) and swapped two Shaman tiers.
 *
 * THE DRUID AND WARRIOR URLS CAME WITH THE PATCH NOTES; THE PALADIN AND SHAMAN
 * ONES WERE ASKED FOR. The four freed-point builds are decisions rather than
 * transcriptions -- Shaman Enhancement cannot reach Elemental Fury any more at
 * 19 points in the tree -- and guessing them would have put a figure in the
 * baseline table on nobody's authority.
 *
 * THE WARRIOR WAS ABSENT FROM THIS LIST FOR THE WHOLE PROJECT, which is why
 * nothing noticed its tree had changed: the one class with four sources was the
 * one class no build URL was checked against.
 * ----------------------------------------------------------------------------
 */
const PROFILES = [
  ['druid', 'Moonkin', 'https://talentsforever.com/druid/60/5232220115501351--505003-BDEFHCJMNKOPjloAI-3'],
  ['druid', 'Cat', 'https://talentsforever.com/druid/60/050022-35200032021032212051-053-BEFRSQWXaZdefgcijlm-6'],
  ['druid', 'Bear', 'https://talentsforever.com/druid/60/050022-45230302120132012551--RVSYZQ1XbcdgfhijBEFTQ-6'],
  ['paladin', 'Seal Twist Ret', 'https://talentsforever.com/paladin/60/550032--05225331201330321-ABEijklmnoprtsvxwF-6'],
  ['paladin', 'Shockadin', 'https://talentsforever.com/paladin/60/55303003000121--052252302010303-ilkjnprtmvABECHLNM-6'],
  ['paladin', 'Prot Pally', 'https://talentsforever.com/paladin/60/50003-0530213321301451-5022-hjAESTVYZXWabdefgk-6'],
  ['warrior', '2H Arms', 'https://talentsforever.com/warrior/60/30325213132515201-0505-2-CA2FAE2HE2KJIMNOLQSUEGiD-6'],
  ['warrior', 'DW Fury', 'https://talentsforever.com/warrior/60/30305013002-05253005142010501--SUVTYZbdfha1ACE4HEGKa-6'],
  ['warrior', 'Prot Warr', 'https://talentsforever.com/warrior/60/35310003002--050532120301021351-jlportmwvxyzABDCHKn-6'],
  ['hunter', 'BM Hunter', 'https://talentsforever.com/hunter/60/5320001505101251-30502500005--ACBGHJMKNOPSVQUa-3'],
  ['hunter', 'LW Ranged', 'https://talentsforever.com/hunter/60/502-3050052511523151-5-ASQVYXZacefWgbdC-3'],
  ['hunter', 'LW Melee', 'https://talentsforever.com/hunter/60/502-005005201-500240031050220151-ACSVWYgjk3onkqtsvwx-3'],
  ['hunter', 'Hawk Melee', 'https://talentsforever.com/hunter/60/50032005001-005005001-5002500300501201-gjk3nkqstvAHSVYEDK-6'],
  ['mage', 'Frostfire', 'https://talentsforever.com/mage/60/-0055103013013304-00550003310003002-3'],
  ['mage', 'Arcane', 'https://talentsforever.com/mage/60/255225223122311531-13--3'],
  ['mage', 'Fire', 'https://talentsforever.com/mage/60/050005-23552330130113151-002-3'],
  ['rogue', 'Venom', 'https://talentsforever.com/rogue/60/00532310551501051-303303-002-kRT2WUCFEDGI1LKJNPQIT-3'],
  ['rogue', 'Combat', 'https://talentsforever.com/rogue/60/005323104-32003311201515231--SRWVYZXbcdegf1hCFDEGIf-3'],
  ['rogue', 'Rupture', 'https://talentsforever.com/rogue/60/005203002-3023-5320003312013011051-kjoCFDIRTUi2qpi1uti1wxirz0-3'],
  /*
   * RE-ENCODED FROM THE PRESET, which is the second URL here that is not a
   * string somebody pasted -- and unlike the Elemental Shaman's, this one was
   * not a tree change.
   *
   * THE RECORDED URL DISAGREED WITH THE PRESET BY ELEVEN POINTS, and had for an
   * unknown length of time: it decoded to `spirit_tap: 5` and
   * `mental_agility: 3` where the preset has `improved_mind_blast: 5`,
   * `silence: 1` and `early_demise: 2`. Both total 51, the Priest tree has not
   * changed shape, and the preset's own comment said "decoded from the owner's
   * URL" -- so one of the two was wrong and nothing could say which.
   *
   * THE OWNER VERIFIED THE PRESET: "I verified that it's using the correct
   * talents." So the URL was the stale half and is re-encoded from the
   * allocation rather than guessed at.
   *
   * WHICH IS WHY THIS LIST IS WORTH KEEPING IN STEP WITH THE PRESETS AT ALL.
   * A build URL that silently stops matching its preset is invisible: both
   * decode to 51 points, both produce an ordinary DPS figure, and the only thing
   * that noticed was decoding all twenty-three at once and diffing them against
   * `presets.ts`. It cost a mana-return talent against a damage one.
   */
  ['priest', 'Shadow', 'https://talentsforever.com/priest/60/0052030003-3-500322501201312251--6'],
  ['warlock', 'SM/DS', 'https://talentsforever.com/warlock/60/05550320035201351-0050203001--3'],
  ['warlock', 'Firelock', 'https://talentsforever.com/warlock/60/05-0050203001-2050355103101351-3'],
  ['shaman', 'Enhance', 'https://talentsforever.com/shaman/60/053033102-054031031005112251--RVUS1XS1bcfedghBEFCGISY-6'],
  /*
   * RE-ENCODED RATHER THAN RE-SPECIFIED, and it is the one URL here that is not
   * a string somebody pasted. Elemental Fury and Elemental Alacrity swapped
   * tiers at build 1.60.1.70170 and the Elemental build takes BOTH, at the same
   * ranks and both still legal -- so the digits moved and the build did not.
   * The owner's own `5505301503123131-055002001-` decoded to this exact
   * allocation against the previous tree.
   */
  ['shaman', 'Ele', 'https://talentsforever.com/shaman/60/5505301303123151-055002001--6'],
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

/**
 * The preset allocation each URL above is supposed to describe, read out of
 * `presets.ts` by name.
 *
 * ----------------------------------------------------------------------------
 * THIS EXISTS BECAUSE A URL AND ITS PRESET DRIFTED ELEVEN POINTS APART AND
 * NOTHING NOTICED. The Shadow Priest's recorded URL decoded to `spirit_tap: 5`
 * and `mental_agility: 3` where the preset had `improved_mind_blast: 5`,
 * `silence: 1` and `early_demise: 2` -- both totalling 51, both producing an
 * ordinary DPS figure, and the preset's own comment claiming it was decoded from
 * that URL. **A number with a source named beside it is not the same as a number
 * that still matches its source.**
 *
 * IT WAS FOUND BY HAND during the 1.60.1.70170 patch, by decoding all
 * twenty-three and diffing them against the constants, which nothing had ever
 * done. `--presets` is that pass, so it is one command rather than a good idea.
 *
 * NOT A TEST, DELIBERATELY. A test would have to decide which side is right, and
 * that is the owner's call: when these disagree one of them is stale and the
 * answer is not derivable. This prints the disagreement and leaves it.
 *
 * THE NAMES ARE THE CONSTANTS', NOT THE PROFILES', so the map is explicit --
 * `presets.ts` calls the Shadow Priest build `PRIEST_SHADOW_TALENTS` and this
 * file calls it "Shadow".
 * ----------------------------------------------------------------------------
 */
const PRESET_CONSTANTS = {
  '2H Arms': 'TWO_HAND_ARMS',
  'DW Fury': 'DW_FURY',
  'Prot Warr': 'PROT_WARR',
  Venom: 'ROGUE_VENOM',
  Combat: 'ROGUE_COMBAT',
  Rupture: 'ROGUE_RUPTURE',
  Moonkin: 'DRUID_MOONKIN',
  Cat: 'DRUID_CAT',
  Bear: 'DRUID_BEAR',
  Ele: 'SHAMAN_ELEMENTAL',
  Enhance: 'SHAMAN_ENHANCEMENT',
  Frostfire: 'MAGE_FROSTFIRE',
  Arcane: 'MAGE_ARCANE',
  Fire: 'MAGE_FIRE',
  'Seal Twist Ret': 'PALADIN_RETRIBUTION',
  Shockadin: 'PALADIN_SHOCKADIN',
  'Prot Pally': 'PALADIN_PROTECTION',
  'BM Hunter': 'HUNTER_BEAST_MASTERY',
  'LW Ranged': 'HUNTER_LONE_WOLF_RANGED',
  'LW Melee': 'HUNTER_LONE_WOLF_MELEE',
  'SM/DS': 'WARLOCK_AFFLICTION',
  Firelock: 'WARLOCK_DESTRUCTION',
  Shadow: 'PRIEST_SHADOW',
};

/**
 * Divergences the owner asked for AFTER the URL was recorded, so a URL cannot
 * express them.
 *
 * ----------------------------------------------------------------------------
 * ONE ENTRY, AND IT IS WHY THIS TABLE EXISTS RATHER THAN A BARE PASS/FAIL. The
 * owner moved one point out of Suppression and into Amplify Curse on the
 * Affliction build after its URL was given; `presets.ts` records the instruction
 * and the reason, and the URL still describes the build as first specified.
 *
 * SO THE TOOL HAS TO TELL "AMENDED" FROM "STALE", because they look identical.
 * Without this the Warlock reports DIFF on every run, which is a standing false
 * positive -- and a check that always complains is a check nobody reads, which
 * would have cost exactly the Shadow Priest finding this tool was written for.
 *
 * AN ENTRY HERE IS A CLAIM THAT THE OWNER ASKED FOR THE DIFFERENCE, so it needs
 * their words beside it. A divergence nobody can source is the stale kind.
 * ----------------------------------------------------------------------------
 */
const DOCUMENTED_AMENDMENTS = {
  'SM/DS': {
    // "ONE POINT MOVED OUT OF SUPPRESSION AND INTO AMPLIFY CURSE, at the
    // ruleset owner's instruction" -- see WARLOCK_AFFLICTION_TALENTS.
    expected: ['amplify_curse 1->0', 'suppression 4->5'],
    why: "the owner's one-point move into Amplify Curse, after the URL",
  },
};

/** Parse one `const NAME_TALENTS: TalentAllocation = { ... }` block. */
function presetAllocation(source, constantName) {
  const marker = `const ${constantName}_TALENTS: TalentAllocation = {`;
  const start = source.indexOf(marker);
  if (start < 0) return undefined;
  const body = source.slice(start, source.indexOf('\n};', start));
  const allocation = {};
  for (const match of body.matchAll(/^\s*([a-z_0-9]+):\s*(\d+),/gm)) {
    allocation[match[1]] = Number(match[2]);
  }
  return allocation;
}

function comparePresets() {
  const source = readFileSync('src/profiles/presets.ts', 'utf8');
  let disagreed = 0;

  for (const [classId, name, url] of PROFILES) {
    const constantName = PRESET_CONSTANTS[name];
    if (!constantName) {
      console.log(` ????  ${name.padEnd(15)} no entry in PRESET_CONSTANTS`);
      disagreed += 1;
      continue;
    }
    const preset = presetAllocation(source, constantName);
    if (!preset) {
      console.log(` ????  ${name.padEnd(15)} ${constantName}_TALENTS not found in presets.ts`);
      disagreed += 1;
      continue;
    }

    let decoded;
    try {
      decoded = decode(url).allocation;
    } catch (error) {
      console.log(` FAIL  ${name.padEnd(15)} ${error.message}`);
      disagreed += 1;
      continue;
    }

    const ids = [...new Set([...Object.keys(preset), ...Object.keys(decoded)])].sort();
    const differences = ids
      .filter((id) => (preset[id] ?? 0) !== (decoded[id] ?? 0))
      .map((id) => `${id} ${preset[id] ?? 0}->${decoded[id] ?? 0}`);

    const amendment = DOCUMENTED_AMENDMENTS[name];
    const asExpected =
      amendment !== undefined &&
      differences.length === amendment.expected.length &&
      differences.every((d, i) => d === amendment.expected[i]);

    if (differences.length === 0) {
      console.log(`  ok   ${classId.padEnd(8)} ${name.padEnd(15)} matches its preset`);
    } else if (asExpected) {
      /*
       * EXPECTED, AND STILL PRINTED. The point is that a reader sees the
       * amendment rather than a clean line hiding it -- and if the difference
       * CHANGES, the comparison above stops matching and it becomes a DIFF.
       */
      console.log(
        `  ok   ${classId.padEnd(8)} ${name.padEnd(15)} amended: ${amendment.why}`,
      );
    } else {
      disagreed += 1;
      console.log(` DIFF  ${classId.padEnd(8)} ${name.padEnd(15)} preset->URL: ${differences.join(', ')}`);
      if (amendment) {
        console.log(`         expected only: ${amendment.expected.join(', ')}`);
      }
    }
  }

  console.log(
    disagreed === 0
      ? `\nAll ${PROFILES.length} URLs match their presets.`
      : `\n${disagreed} of ${PROFILES.length} disagree. ONE OF THE TWO IS STALE and which ` +
          'is the owner\'s call -- see the Shadow Priest note above.',
  );
  return disagreed === 0 ? 0 : 1;
}

const args = process.argv.slice(2);

if (args.includes('--presets')) {
  process.exit(comparePresets());
}

const targets = args.includes('--profiles')
  ? PROFILES
  : args.map((url) => [url.match(/talentsforever\.com\/([a-z]+)/i)?.[1] ?? '?', '', url]);

if (targets.length === 0) {
  console.log(
    'usage: node tools/decode_talent_build.mjs <url> | --profiles | --presets',
  );
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
