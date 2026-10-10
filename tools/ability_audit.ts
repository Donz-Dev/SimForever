/*
 * ============================================================================
 * THE ABILITY AUDIT: does every declared ability actually DO something, in a
 * real fight, in at least one of the 23 profiles?
 *
 *     npx vite-node tools/ability_audit.ts            # the report
 *     npx vite-node tools/ability_audit.ts --json     # machine-readable
 *     PROFILES=cat,rogue npx vite-node tools/ability_audit.ts
 *
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS, AND WHAT THE OTHER TWO TOOLS CANNOT SEE.
 *
 * `coefficient_probe.ts` casts every ability in ISOLATION and asks whether its
 * damage responds to a stat. That answers "does the damage scale" and says
 * nothing about whether any profile ever casts it.
 *
 * `measure_profiles.ts USES=1` prints THE LIST with what each entry did, plus
 * the damage sources that are not in the list. Between them those two cover
 * every ability that is either IN A LIST or DEALING DAMAGE.
 *
 * WHICH LEAVES A THIRD CATEGORY COMPLETELY INVISIBLE: an ability in the
 * character's OWN BOOK that is in no list and deals no damage. It is declared,
 * it is learnable, the profile can cast it, and nothing anywhere reports that
 * it never does. That is the gap this tool closes, and it is the macro question
 * -- not "is this number right" but "is this thing connected at all".
 *
 * ----------------------------------------------------------------------------
 * THE AGGREGATE IS THE POINT, NOT THE PER-PROFILE TABLE. An ability that fires
 * in one profile and not another is usually correct: Execute needs a dying
 * target, Hammer of Wrath the same, and a Warrior in Berserker Stance cannot
 * Revenge. An ability that fires in NO profile is the finding, because the
 * whole project only has 23 characters and if none of them ever uses a thing
 * then nothing in this simulator has ever exercised it.
 *
 * DAMAGE SHARES ARE CHECKED TO SUM TO 100% for the same reason the resource
 * books are: a source nobody reports reads as a zero rather than as a gap, and
 * "the shares add up" is the only thing that says the table is complete.
 * ============================================================================
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import type { CharacterProfile } from '../src/profiles/CharacterProfile';
import { characterAtCombatStart, runProfileBatch } from '../src/simulator';
import { ALL_PRIORITY_LISTS } from '../src/game/rotations/allLists';
import { DRUID_ABILITIES } from '../src/game/abilities/druid';
import { HUNTER_ABILITIES } from '../src/game/abilities/hunter';
import { MAGE_ABILITIES } from '../src/game/abilities/mage';
import { PALADIN_ABILITIES } from '../src/game/abilities/paladin';
import { PRIEST_ABILITIES } from '../src/game/abilities/priest';
import { ROGUE_ABILITIES } from '../src/game/abilities/rogue';
import { SHAMAN_ABILITIES } from '../src/game/abilities/shaman';
import { WARLOCK_ABILITIES } from '../src/game/abilities/warlock';
import { WARRIOR_ABILITIES } from '../src/game/abilities/warrior';

/**
 * Every ability DECLARED, class by class, against which "in a book somewhere" is
 * checked.
 *
 * ----------------------------------------------------------------------------
 * THE THIRD BLIND SPOT, AND IT IS THE SAME SHAPE AS THE FIRST TWO. This audit
 * exists because an ability in the book, in no list, dealing no damage was
 * invisible to everything. An ability in NO BOOK AT ALL was invisible to this
 * audit as well: it appears in neither the "in a book somewhere" total nor the
 * "cast by none of the 23" list, so it reads as an ability that does not exist.
 *
 * Nature's Swiftness is the first one -- declared, granted by a talent no Druid
 * profile takes, and therefore learnable by nobody here. That is a fact about
 * the three builds rather than a bug, and it has to be REPORTED to be that.
 * ----------------------------------------------------------------------------
 */
const DECLARED_BY_CLASS = {
  warrior: WARRIOR_ABILITIES,
  rogue: ROGUE_ABILITIES,
  druid: DRUID_ABILITIES,
  shaman: SHAMAN_ABILITIES,
  mage: MAGE_ABILITIES,
  paladin: PALADIN_ABILITIES,
  hunter: HUNTER_ABILITIES,
  warlock: WARLOCK_ABILITIES,
  priest: PRIEST_ABILITIES,
} as const;

const AS_JSON = process.argv.includes('--json');
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const SEED = Number(process.env.SEED ?? 12345);
const ONLY = (process.env.PROFILES ?? '')
  .split(',')
  .map((part) => part.trim().toLowerCase())
  .filter((part) => part.length > 0);

/**
 * How an ability ended up in one profile's fight.
 *
 * `listedNeverFired` is the only one that is unambiguously a BUG; the other two
 * quiet ones are judgements a reader has to make, which is why they are named
 * apart rather than lumped together as "unused".
 */
type Verdict =
  /** Cast at least once. Working, whatever the number. */
  | 'fired'
  /** In the priority list and never cast. The list is asking for the impossible. */
  | 'listedNeverFired'
  /** Not in the list, never cast, and dealt damage anyway -- a proc, a bleed, a swing. */
  | 'passiveDamage'
  /** In the book, in no list, never cast, dealt nothing. Declared and unreachable HERE. */
  | 'inBookOnly';

interface Row {
  readonly preset: string;
  readonly className: string;
  readonly abilityId: string;
  readonly abilityName: string;
  readonly inList: boolean;
  readonly uses: number;
  readonly damage: number;
  readonly share: number;
  readonly verdict: Verdict;
}

interface ProfileReport {
  readonly preset: string;
  readonly className: string;
  readonly rotation: string;
  readonly rows: readonly Row[];
  /** Damage shares totalled. Anything but ~1 means the table is incomplete. */
  readonly shareTotal: number;
}

function auditOne(presetId: string, label: string, profile: CharacterProfile): ProfileReport {
  const batch = runProfileBatch({
    ...profile,
    simulation: { ...profile.simulation, seed: SEED, iterations: ITERATIONS },
  });

  /*
   * THE BOOK IS READ OFF THE BUILT CHARACTER, not from `abilitiesForClass`.
   * What a character knows depends on its talents AND its gear, and the built
   * one is the only thing that has both applied -- reading the class list would
   * report abilities no profile can actually learn as though they were missing.
   */
  const player = characterAtCombatStart(profile);
  const book = player?.abilities.all ?? [];

  const record = ALL_PRIORITY_LISTS.find((row) => row.profiles.includes(presetId));
  const listedIds = new Set(record?.list.entries.map((entry) => entry.abilityId) ?? []);

  // The damage table is keyed by NAME, so the book supplies the id -> name map.
  const byName = new Map(batch.abilities.map((row) => [row.abilityName, row]));

  const rows: Row[] = [];
  for (const ability of book) {
    const row = byName.get(ability.name);
    const uses = row?.uses ?? 0;
    const damage = row?.damage ?? 0;
    const inList = listedIds.has(ability.id);
    const verdict: Verdict =
      uses > 0 ? 'fired' : inList ? 'listedNeverFired' : damage > 0 ? 'passiveDamage' : 'inBookOnly';
    rows.push({
      preset: label,
      className: profile.character.characterClass,
      abilityId: ability.id,
      abilityName: ability.name,
      inList,
      uses,
      damage,
      share: row?.share ?? 0,
      verdict,
    });
  }

  /*
   * AND EVERY DAMAGE SOURCE THAT IS NOT AN ABILITY IN THE BOOK -- an auto
   * attack, a pet's swing, a poison, an item proc. Included so the share total
   * can be checked: leaving them out would make every melee profile look as
   * though 60% of its damage were unaccounted for.
   */
  for (const row of batch.abilities) {
    if (book.some((ability) => ability.name === row.abilityName)) continue;
    rows.push({
      preset: label,
      className: profile.character.characterClass,
      abilityId: `(not in book) ${row.abilityName}`,
      abilityName: row.abilityName,
      inList: false,
      uses: row.uses,
      damage: row.damage,
      share: row.share,
      verdict: row.uses > 0 ? 'fired' : row.damage > 0 ? 'passiveDamage' : 'inBookOnly',
    });
  }

  const shareTotal = batch.abilities.reduce((sum, row) => sum + row.share, 0);
  return {
    preset: label,
    className: profile.character.characterClass,
    rotation: batch.rotationName ?? 'NO ROTATION AT ALL',
    rows,
    shareTotal,
  };
}

const reports: ProfileReport[] = [];
for (const preset of PROFILE_PRESETS) {
  const matches =
    ONLY.length === 0 ||
    ONLY.some(
      (part) => preset.id.toLowerCase().includes(part) || preset.label.toLowerCase().includes(part),
    );
  if (!matches) continue;
  reports.push(auditOne(preset.id, preset.label, preset.build()));
}

if (AS_JSON) {
  console.log(JSON.stringify({ reports }, null, 1));
} else {
  const pad = (text: string, width: number) => text.padEnd(width);

  console.log(`ABILITY AUDIT  --  ${reports.length} profiles, ${ITERATIONS} iterations each\n`);

  for (const report of reports) {
    const broken = report.rows.filter((row) => row.verdict === 'listedNeverFired');
    const unreachable = report.rows.filter((row) => row.verdict === 'inBookOnly');
    const shareNote =
      Math.abs(report.shareTotal - 1) > 0.005
        ? `  <-- SHARES SUM TO ${(report.shareTotal * 100).toFixed(1)}%`
        : '';
    console.log(`${pad(report.preset, 16)} ${report.rotation}${shareNote}`);
    for (const row of broken) {
      console.log(`    LISTED, NEVER FIRED   ${row.abilityId}`);
    }
    if (unreachable.length > 0) {
      console.log(
        `    in book, never cast, no damage: ${unreachable.map((row) => row.abilityId).join(', ')}`,
      );
    }
  }

  /*
   * THE AGGREGATE. An ability that fires somewhere is exercised; one that fires
   * nowhere has never been run by this simulator at all, whatever its tests say.
   */
  const firedSomewhere = new Set<string>();
  const seenSomewhere = new Map<string, string>();
  for (const report of reports) {
    for (const row of report.rows) {
      if (row.abilityId.startsWith('(not in book)')) continue;
      seenSomewhere.set(row.abilityId, row.className);
      if (row.verdict === 'fired' || row.verdict === 'passiveDamage') {
        firedSomewhere.add(row.abilityId);
      }
    }
  }
  const neverAnywhere = [...seenSomewhere.entries()].filter(([id]) => !firedSomewhere.has(id));

  /*
   * DECLARED AND IN NOBODY'S BOOK. Counted apart from the two buckets above,
   * because "never cast" and "never even learnable" are different claims and
   * only one of them is about a priority list.
   */
  const unlearnable: [string, string][] = [];
  for (const [className, abilities] of Object.entries(DECLARED_BY_CLASS)) {
    for (const ability of abilities) {
      if (!seenSomewhere.has(ability.id)) unlearnable.push([ability.id, className]);
    }
  }

  console.log(`\n${'='.repeat(74)}`);
  console.log(
    `IN A BOOK SOMEWHERE: ${seenSomewhere.size}   ` +
      `EXERCISED BY AT LEAST ONE PROFILE: ${firedSomewhere.size}   ` +
      `NEVER, ANYWHERE: ${neverAnywhere.length}`,
  );
  console.log('='.repeat(74));
  if (neverAnywhere.length > 0) {
    console.log('\nDeclared, learnable by some profile, and cast by NONE of the 23:\n');
    const byClass = new Map<string, string[]>();
    for (const [id, className] of neverAnywhere) {
      if (!byClass.has(className)) byClass.set(className, []);
      byClass.get(className)!.push(id);
    }
    for (const [className, ids] of [...byClass].sort()) {
      console.log(`  ${pad(className, 9)} ${ids.sort().join(', ')}`);
    }
  }
  if (unlearnable.length > 0) {
    console.log(
      `
DECLARED AND IN NO PROFILE'S BOOK -- ${unlearnable.length}, each one a talent no profile takes:
`,
    );
    for (const [id, className] of unlearnable.sort()) {
      console.log(`  ${pad(className, 9)} ${id}`);
    }
  }
}
