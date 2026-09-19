#!/usr/bin/env node
/*
 * Capture Forever spell data for the Warrior.
 *
 *   node tools/import_spell.mjs --refresh        # re-capture everything below
 *   node tools/import_spell.mjs --verify         # re-fetch and diff, exit 1 on drift
 *   node tools/import_spell.mjs forever 23925    # print one spell
 *   node tools/import_spell.mjs classic 23925    # the Classic one, for comparison
 *
 * WHY THIS EXISTS
 *
 * The Warrior ability spreadsheet gives costs, cooldowns and damage for 26
 * abilities and NO EFFECT MAGNITUDES for the ten buffs among them, so those ten
 * were castable and completely inert. The plan on file was to borrow WoW
 * Classic values and flag them.
 *
 * Forever publishes all of it. Two endpoints, both plain HTTP, no browser:
 *
 *   nether.wowhead.com/forever/tooltip/spell/<id>   rendered tooltip, as JSON
 *   www.wowhead.com/forever/spell=<id>              raw effect values, in HTML
 *
 * BOTH ARE NEEDED, and the second is the one that matters for damage. Forever's
 * rendered tooltips substitute a broken variable for several abilities --
 * Shield Slam reads "causing (100% of Spell Power) damage" -- so the number is
 * simply absent from the text. The spell page's "Effect #N: School Damage,
 * Value: 656" carries it. Shield Slam is 656 where the spreadsheet says
 * 421-439, which is exactly the kind of difference this capture exists to find.
 *
 * "(100% of Spell Power)" IS A TOOLTIP ARTIFACT AND IS IGNORED. Warriors have
 * no spell power, nothing in this engine gives them any, and the phrase is a
 * templating failure rather than a statement about the damage formula. The
 * `Value:` from the effect row is the damage.
 *
 * THE IDS ARE THE HIGHEST RANK a level 60 warrior can learn, taken from
 * https://www.wowhead.com/forever/class=1/warrior. Rank matters enormously:
 * Battle Shout rank 1 grants 12 attack power and rank 7 grants 140.
 *
 * WHAT IS STORED, AND WHAT IS NOT. The tooltip text and the effect rows,
 * verbatim. This tool deliberately does not parse a magnitude out of a
 * sentence: the phrasing varies too much between abilities for a regex to be
 * trustworthy, and a mis-read magnitude is precisely the plausible wrong number
 * this project exists to avoid. A person reads the number into a named
 * constant, and a hand-written test asserts the constant against the stored
 * text.
 *
 * `--verify` re-fetches everything and diffs. It matters: Forever has changed
 * under this project before (Bastion left the Protection tree) and was found
 * only by accident.
 */

const TOOLTIP = (game, id) => `https://nether.wowhead.com/${game}/tooltip/spell/${id}`;
const PAGE = (game, id) => `https://www.wowhead.com/${game}/spell=${id}`;
const DATA_FILE = 'src/data/abilities/forever-warrior.json';
const SOURCE_LIST = 'https://www.wowhead.com/forever/class=1/warrior';

/*
 * Every Warrior spell the simulator models, at its highest rank for level 60,
 * plus the five that talents grant and the spreadsheet omits entirely.
 *
 * `ability` is the id used in src/game/abilities/warrior.ts, or null where the
 * simulator has no ability for it yet. Keeping the mapping here means the audit
 * in docs/warrior-abilities.md can be regenerated rather than re-derived.
 */
const WARRIOR_SPELLS = [
  // --- strikes and damage, from the ability spreadsheet ---
  { id: 21553, rank: 4, ability: 'mortal_strike' },
  { id: 23894, rank: 4, ability: 'bloodthirst' },
  { id: 23925, rank: 4, ability: 'shield_slam' },
  { id: 11605, rank: 5, ability: 'slam' },
  { id: 1680, rank: null, ability: 'whirlwind' },
  { id: 1310222, rank: null, ability: 'spearing_strike' },
  { id: 11585, rank: 4, ability: 'overpower' },
  { id: 25288, rank: 6, ability: 'revenge' },
  { id: 20662, rank: 5, ability: 'execute' },
  { id: 25286, rank: 9, ability: 'heroic_strike' },
  { id: 20569, rank: 5, ability: 'cleave' },
  { id: 11574, rank: 7, ability: 'rend_cast' },
  { id: 7373, rank: 3, ability: 'hamstring' },
  { id: 11581, rank: 6, ability: 'thunder_clap' },
  { id: 20617, rank: 3, ability: 'intercept' },
  { id: 11578, rank: 3, ability: 'charge' },

  // --- the buffs and debuffs the spreadsheet leaves without magnitudes ---
  { id: 25289, rank: 7, ability: 'battle_shout_cast' },
  { id: 11556, rank: 5, ability: 'demoralizing_shout_cast' },
  { id: 11597, rank: 5, ability: 'sunder_armor_cast' },
  { id: 1719, rank: null, ability: 'recklessness_cast' },
  { id: 18499, rank: null, ability: 'berserker_rage_cast' },
  { id: 2687, rank: null, ability: 'bloodrage_cast' },
  { id: 871, rank: null, ability: 'shield_wall_cast' },
  { id: 2565, rank: null, ability: 'shield_block_cast' },

  // --- stances ---
  { id: 2457, rank: null, ability: 'battle_stance_cast' },
  { id: 71, rank: null, ability: 'defensive_stance_cast' },
  { id: 2458, rank: null, ability: 'berserker_stance_cast' },

  // --- granted by talents; absent from the ability spreadsheet entirely ---
  { id: 12292, rank: null, ability: null, note: 'Sweeping Strikes, granted by the talent' },
  { id: 12328, rank: null, ability: null, note: 'Death Wish, granted by the talent' },
  { id: 12323, rank: null, ability: null, note: 'Piercing Howl, granted by the talent' },
  { id: 12975, rank: null, ability: null, note: 'Last Stand, granted by the talent' },
  { id: 12809, rank: null, ability: null, note: 'Concussion Blow, granted by the talent' },
];

/** Tooltip HTML to the plain text the data file stores. */
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
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * The last line of the tooltip: the only one carrying an effect magnitude.
 * Everything above it is cost, cast time, cooldown and requirements.
 */
function description(text) {
  const lines = text.split('\n');
  return lines[lines.length - 1] ?? '';
}

/**
 * Which stances the ability can be used in.
 *
 * THE ANSWER TO A QUESTION FILED AS BLOCKED ON THE RULESET OWNER. The ability
 * spreadsheet says nothing about stances and corrections were promised and
 * never arrived; Forever states it outright.
 *
 * READ FROM THE PAGE'S `Forms` ROW, not from the tooltip prose. The prose form
 * is "Requires Battle Stance, Defensive Stance" -- SEVERAL STANCES, comma
 * separated -- and an earlier version of this matched only the first, quietly
 * halving the answer for Rend, Execute and every other multi-stance ability.
 * The Forms row is a plain list and cannot be read partially.
 *
 * An empty list means USABLE IN ANY STANCE, which is a real answer and not an
 * absence of one.
 */
function allowedStances(html) {
  const m = html.match(/<th>Forms<\/th><td[^>]*>([\s\S]*?)<\/td>/);
  if (!m) return [];
  return m[1]
    .replace(/<[^>]+>/g, '')
    .split(',')
    .map((s) => s.trim().replace(/ Stance$/i, '').toLowerCase())
    .filter(Boolean);
}

/**
 * The raw effect rows from the spell page, which is where damage actually
 * lives. Server-rendered, so a plain fetch is enough.
 */
function parseEffects(html) {
  const effects = [];
  /*
   * A spell with ONE effect writes `<th>Effect</th>`; with several it writes
   * `<th>Effect #2</th>`. Matching only the numbered form lost every
   * single-effect ability -- Revenge among them, whose damage is missing from
   * its tooltip too, so it read as having no damage at all.
   */
  const re = /<th>Effect(?: #(\d+))?<\/th><td[^>]*>([\s\S]*?)<small><br \/>Value: (-?[\d.]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    effects.push({
      index: m[1] ? Number(m[1]) : 1,
      type: m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
      /*
       * THE RAW BASE POINTS, AND NOTHING DERIVED FROM THEM.
       *
       * An earlier version stored `amount: value - 1`, having checked the
       * convention against Mortal Strike (161 -> "plus 160"), Execute (601 ->
       * "600"), Recklessness (101 -> "100%") and Sunder Armor (-449 -> "450").
       * Ten abilities agreed. TWO DID NOT:
       *
       *   Battle Shout        value  140  tooltip says 140   (no offset)
       *   Demoralizing Shout  value -195  tooltip says 210   (off by 15)
       *
       * Both of those tooltips carry a standalone "Level 60" line and the
       * others do not: they SCALE WITH LEVEL, so the effect row is the spell's
       * base and the tooltip is the value at 60. A blanket -1 would have made
       * Demoralizing Shout 7% too weak while looking rigorous.
       *
       * So the rule is: THE TOOLTIP WINS WHERE IT STATES A NUMBER, because it
       * is rendered at level 60, which is the only level this simulator runs.
       * The effect row is for the two abilities whose tooltip hides the number
       * behind the "(100% of Spell Power)" artifact -- Shield Slam and Revenge
       * -- and for those the -1 is an ASSUMPTION that cannot be cross-checked
       * against anything. Both are flagged where they are transcribed.
       */
      value: Number(m[3]),
    });
  }
  return effects;
}

const UA = { 'User-Agent': 'Mozilla/5.0 SimForever-import' };

async function fetchSpell(game, id) {
  const tip = await politeFetch(TOOLTIP(game, id), { headers: UA });
  if (!tip.ok) throw new Error(`${game}/${id}: tooltip HTTP ${tip.status}`);
  const raw = await tip.json();
  const text = toText(raw.tooltip);

  const page = await politeFetch(PAGE(game, id), { headers: UA });
  if (!page.ok) throw new Error(`${game}/${id}: page HTTP ${page.status}`);
  const html = await page.text();

  return {
    id: Number(id),
    name: raw.name,
    icon: raw.icon,
    source: PAGE(game, id),
    stances: allowedStances(html),
    description: description(text),
    effects: parseEffects(html),
    tooltip: text,
  };
}

/** Wowhead rate-limits a burst; nine talent trees in one sitting hit it once. */
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Raised when Wowhead refuses to answer, as distinct from answering something
 * unexpected. The difference decides the exit code; see `main`.
 */
class RateLimited extends Error {}

/**
 * Fetch, backing off when Wowhead starts refusing.
 *
 * A full --refresh is 64 requests and a --verify straight afterwards is 64
 * more; the second run gets 403s partway through and stays that way for some
 * minutes. Backing off clears a short burst, not a long one.
 */
async function politeFetch(url, options, attempt = 1) {
  const response = await fetch(url, options);
  if (response.status === 403 || response.status === 429) {
    if (attempt >= 4) throw new RateLimited(`HTTP ${response.status} for ${url}`);
    await pause(2000 * attempt);
    return politeFetch(url, options, attempt + 1);
  }
  return response;
}

const [mode, second] = process.argv.slice(2);

/*
 * THROTTLING IS NOT DRIFT, and the exit code has to say which.
 *
 * Exit 1 means Wowhead's data no longer matches what is on file: a real finding
 * that should stop a build. Exit 2 means we could not ask, because a --refresh
 * followed by a --verify is 128 requests and Wowhead starts answering 403 for
 * several minutes. Reporting those the same way would train someone to ignore a
 * genuine change.
 */
async function main() {
  if (mode === '--refresh') {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const spells = [];
    for (const entry of WARRIOR_SPELLS) {
      const spell = await fetchSpell('forever', entry.id);
      spells.push({ ...spell, rank: entry.rank, ability: entry.ability ?? null, note: entry.note });
      console.error(`  ${String(entry.id).padStart(8)}  ${spell.name}`);
      await pause(600);
    }
    mkdirSync('src/data/abilities', { recursive: true });
    writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          class: 'warrior',
          game: 'forever',
          capturedOn: new Date().toISOString().slice(0, 10),
          spellList: SOURCE_LIST,
          tooltipEndpoint: 'https://nether.wowhead.com/forever/tooltip/spell/<id>',
          pageEndpoint: 'https://www.wowhead.com/forever/spell=<id>',
          note:
            'Generated by tools/import_spell.mjs --refresh; never hand-edited. ' +
            'Highest rank for level 60. "(100% of Spell Power)" in a description ' +
            'is a tooltip artifact and is ignored -- the damage is the effect ' +
            'row Value. Re-run --verify to confirm nothing changed upstream.',
          spells,
        },
        null,
        1,
      ) + '\n',
      'utf8',
    );
    console.error(`\nwrote ${spells.length} spells to ${DATA_FILE}`);
  } else if (mode === '--verify') {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    let same = 0;
    for (const stored of data.spells) {
      const game = stored.source.includes('/forever/') ? 'forever' : 'classic';
      const fresh = await fetchSpell(game, stored.id);
      const differences = [];
      for (const key of ['name', 'description', 'tooltip']) {
        if (fresh[key] !== stored[key]) {
          differences.push(`${key}:\n    fetched ${JSON.stringify(fresh[key])}\n    stored  ${JSON.stringify(stored[key])}`);
        }
      }
      for (const key of ['effects', 'stances']) {
        if (JSON.stringify(fresh[key]) !== JSON.stringify(stored[key])) {
          differences.push(
            `${key}:\n    fetched ${JSON.stringify(fresh[key])}\n    stored  ${JSON.stringify(stored[key])}`,
          );
        }
      }
      if (differences.length) {
        console.log(`\n${stored.name} (${stored.id})`);
        for (const d of differences) console.log('  ' + d);
      } else same++;
      await pause(600);
    }
    console.log(`\n${same} of ${data.spells.length} spells reproduce exactly.`);
    if (same !== data.spells.length) process.exit(1);
  } else if (mode && second) {
    console.log(JSON.stringify(await fetchSpell(mode, second), null, 1));
  } else {
    console.error('usage: import_spell.mjs --refresh | --verify');
    console.error('       import_spell.mjs <forever|classic> <id>');
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof RateLimited) {
    console.error(
      `
Wowhead is rate-limiting this run (${error.message}).
` +
        `Nothing is wrong with the data on file -- it simply could not be ` +
        `re-checked.
Wait a few minutes and run it again.`,
    );
    process.exit(2);
  }
  throw error;
}
