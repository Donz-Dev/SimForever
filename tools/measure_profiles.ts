/*
 * ============================================================================
 * MEASURE THE 23 PROFILES, SO AN APL EDIT IS ARGUED FROM A NUMBER.
 *
 *   npx vite-node tools/measure_profiles.ts
 *   PROFILES=cat,bear npx vite-node tools/measure_profiles.ts
 *   SEEDS=30 ITERATIONS=10 npx vite-node tools/measure_profiles.ts
 *   USES=1 PROFILES=druid_cat npx vite-node tools/measure_profiles.ts
 *   SAVE=before.json npx vite-node tools/measure_profiles.ts
 *   BASELINE=before.json npx vite-node tools/measure_profiles.ts
 *
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS WHEN `measure_rotation.ts` ALREADY DID.
 *
 * That one measures WARRIOR TALENT BUILDS it assembles itself, from
 * `createDefaultProfile` and a starting set. It cannot measure a profile: the 23
 * presets carry their own gear, their own raid buffs and their own 51-point
 * allocations, and a Warrior in the default set is not the `2H Arms` profile
 * whose figure HANDOVER.md publishes.
 *
 * Every baseline in this project was produced by a throwaway script that was
 * then deleted, so no published figure could be reproduced by the person who
 * measured it. That is the same failure `measure_rotation.ts` was written to fix
 * one layer down -- "Dual-wield, full Arms build -- 160.60" with no record of
 * the talents behind it is a rumour, not a baseline.
 *
 * ----------------------------------------------------------------------------
 * WHAT MAKES IT AN APL TOOL RATHER THAN A DPS PRINTER.
 *
 * `USES=1` prints THE LIST, IN ORDER, WITH WHAT EACH ENTRY ACTUALLY DID. An
 * entry at zero uses is the single most common rotation bug in this project and
 * it has three different causes, all of them silent:
 *
 *   - the id names no ability            (`rend` for `rend_cast`)
 *   - the build never learned it         (Shockadin asking for Seal of Command)
 *   - the entry above it never yields    (a condition that is always true)
 *
 * `tests/game/rotationIds.test.ts` now covers the first. The other two only show
 * up here.
 *
 * ----------------------------------------------------------------------------
 * WHY IT RUNS BATCHES AND NOT `runProfile`, and why many seeds:
 * both reasons are written out in `measure_rotation.ts` and both still hold.
 * The short version is that the UI renders `runProfileBatch(...)`, so anything
 * measured another way is a different fight; and one fight is noise, because a
 * 6.5% dodge chance goes missing from a whole fight about once in two hundred
 * runs. A difference smaller than the printed interval is NOT A DIFFERENCE.
 * ============================================================================
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { runProfileBatch } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { ALL_PRIORITY_LISTS } from '../src/game/rotations/allLists';
import { DRUID_ABILITIES } from '../src/game/abilities/druid';
import { HUNTER_ABILITIES } from '../src/game/abilities/hunter';
import { MAGE_ABILITIES } from '../src/game/abilities/mage';
import { PALADIN_ABILITIES } from '../src/game/abilities/paladin';
import { PET_ABILITIES } from '../src/game/abilities/pet';
import { PRIEST_ABILITIES } from '../src/game/abilities/priest';
import { ROGUE_ABILITIES } from '../src/game/abilities/rogue';
import { SHAMAN_ABILITIES } from '../src/game/abilities/shaman';
import { WARLOCK_ABILITIES } from '../src/game/abilities/warlock';
import { WARRIOR_ABILITIES } from '../src/game/abilities/warrior';

const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const SHOW_USES = process.env.USES === '1';
const SAVE = process.env.SAVE;
const BASELINE = process.env.BASELINE;

/*
 * Which profiles to run, as comma-separated SUBSTRINGS of the preset id --
 * `PROFILES=rogue` is all three of them. Omitted means all 23, which is the
 * default because the containment check is that the profiles a change should not
 * reach do not move by a decimal.
 */
const FILTERS = (process.env.PROFILES ?? '')
  .split(',')
  .map((part) => part.trim().toLowerCase())
  .filter((part) => part.length > 0);

interface Measurement {
  readonly mean: number;
  /** Half-width of the 95% interval on the mean. */
  readonly interval: number;
  readonly fights: number;
}

/** Mean DPS and its 95% interval over SEEDS independent batches. */
function measure(profile: CharacterProfile): Measurement {
  const samples: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, seed, iterations: ITERATIONS },
    });
    samples.push(batch.dps.mean);
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  /*
   * ONE SEED HAS NO INTERVAL, and the sample variance would divide by zero and
   * print `NaN` -- which reads as a broken tool rather than as "you asked for
   * one sample". `SEEDS=1` is the right setting for a uses audit, where the
   * question is whether an entry fired at all, so it has to be usable.
   */
  if (samples.length < 2) return { mean, interval: NaN, fights: SEEDS * ITERATIONS };
  const variance =
    samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return { mean, interval: 2 * Math.sqrt(variance / samples.length), fights: SEEDS * ITERATIONS };
}

/*
 * id -> display name, for every ability any list can name.
 *
 * `BatchAbilityTotals` is keyed by the NAME the damage table shows and a
 * priority list is written in IDS, so the two cannot be joined without this.
 */
const ABILITY_NAMES: ReadonlyMap<string, string> = new Map(
  [
    WARRIOR_ABILITIES,
    ROGUE_ABILITIES,
    DRUID_ABILITIES,
    SHAMAN_ABILITIES,
    MAGE_ABILITIES,
    PALADIN_ABILITIES,
    HUNTER_ABILITIES,
    WARLOCK_ABILITIES,
    PRIEST_ABILITIES,
    PET_ABILITIES,
  ]
    .flat()
    .map((ability) => [ability.id, ability.name] as const),
);

/**
 * Print the list a profile ran, in priority order, with uses and damage share.
 *
 * ONE BATCH, NOT THE WHOLE SWEEP. The uses table answers "did this entry fire
 * at all", which one batch of ten settles; spending thirty batches on it would
 * multiply the run time of every measurement by nothing useful.
 */
function printUses(presetId: string, profile: CharacterProfile): void {
  const batch = runProfileBatch({
    ...profile,
    simulation: { ...profile.simulation, seed: 12345, iterations: ITERATIONS },
  });
  const list = ALL_PRIORITY_LISTS.find((record) => record.profiles.includes(presetId));

  console.log(`\n  ${batch.rotationName ?? 'NO ROTATION AT ALL'}  (${list?.name ?? 'unregistered'})`);
  if (!list) return;

  const byName = new Map(batch.abilities.map((row) => [row.abilityName, row]));
  list.entries.forEach((entry, index) => {
    const name = ABILITY_NAMES.get(entry.abilityId) ?? entry.abilityId;
    const row = byName.get(name);
    const uses = row?.uses ?? 0;
    const share = row ? row.share * 100 : 0;
    /*
     * A REPEATED ID SHOWS THE POOLED FIGURE ON BOTH ROWS, because the damage
     * table is keyed by ability and does not record which ENTRY cast it. Said
     * on the row rather than left to be discovered, since two identical numbers
     * look like a bug in the tool: the Mage's Arcane Missiles and the Warlock's
     * Shadow Bolt are each in their list twice on purpose, gated above and
     * ungated below.
     */
    const repeated = list.entries.filter((other) => other.abilityId === entry.abilityId).length > 1;
    /*
     * ZERO USES IS FLAGGED RATHER THAN LEFT TO THE READER, because it is the
     * bug and because a row of zeros looks like a row of numbers in a table
     * this wide.
     */
    const flag = uses === 0 ? '  <-- NEVER FIRED' : repeated ? '  (pooled: id appears twice)' : '';
    console.log(
      `    ${String(index + 1).padStart(2)}. ${entry.abilityId.padEnd(26)}` +
        `${uses.toFixed(1).padStart(7)} uses ${share.toFixed(1).padStart(6)}%${flag}`,
    );
  });

  /*
   * And what the character damaged WITHOUT the list asking -- auto attacks,
   * procs, bleeds and poisons. A melee list looks thin until this is read: the
   * melee Hunter's largest single source is its own swing, which appears in no
   * priority list anywhere.
   */
  const listed = new Set(list.entries.map((entry) => ABILITY_NAMES.get(entry.abilityId)));
  const unlisted = batch.abilities
    .filter((row) => !listed.has(row.abilityName) && row.damage > 0)
    .sort((a, b) => b.share - a.share);
  if (unlisted.length > 0) {
    console.log('    -- not in the list, and still dealing damage --');
    for (const row of unlisted) {
      console.log(
        `        ${row.abilityName.padEnd(26)}${row.uses.toFixed(1).padStart(7)} uses ` +
          `${(row.share * 100).toFixed(1).padStart(6)}%`,
      );
    }
  }
}

// ---------------------------------------------------------------------------

const presets = PROFILE_PRESETS.filter(
  (preset) =>
    FILTERS.length === 0 ||
    FILTERS.some(
      (part) => preset.id.toLowerCase().includes(part) || preset.label.toLowerCase().includes(part),
    ),
);

if (presets.length === 0) {
  console.error(`No preset matches PROFILES=${process.env.PROFILES}`);
  console.error(`Known ids: ${PROFILE_PRESETS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const before: Record<string, number> = BASELINE
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>)
  : {};

console.log(
  `\nSEEDS=${SEEDS} ITERATIONS=${ITERATIONS}  ` +
    `(${SEEDS * ITERATIONS} fights per profile, ${presets.length} profiles)\n`,
);

const results: Record<string, number> = {};
for (const preset of presets) {
  const profile = preset.build();
  const m = measure(profile);
  results[preset.id] = m.mean;

  const spread = Number.isNaN(m.interval) ? '  --' : m.interval.toFixed(1).padStart(4);
  let line = `${preset.label.padEnd(16)} ${m.mean.toFixed(1).padStart(7)} DPS  +/- ${spread}`;

  const baseline = before[preset.id];
  if (baseline !== undefined && !Number.isNaN(m.interval)) {
    const delta = m.mean - baseline;
    /*
     * The baseline's own interval is not stored, so the gap is judged against
     * this run's interval doubled -- the same width two equal intervals would
     * give. It is the conservative reading, which is the right way round: it
     * calls a real change NOISE before it calls noise a change.
     */
    const gap = m.interval * 2;
    const verdict = Math.abs(delta) > gap ? 'REAL ' : 'noise';
    line +=
      `   was ${baseline.toFixed(1).padStart(7)}  ` +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(1).padStart(6)}  ${verdict}`;
  }
  console.log(line);

  if (SHOW_USES) printUses(preset.id, profile);
}

if (SAVE) {
  writeFileSync(SAVE, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${Object.keys(results).length} figures to ${SAVE}`);
}
console.log('');
