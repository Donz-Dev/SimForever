/*
 * The Bear's armor, dodge, deaths, damage taken and rage, in whatever state the
 * source is in right now.
 *
 * Driven by `tools/thick_hide_attribution.py`, which reverts one fix around it
 * per variant -- and it exists because A DPS FIGURE INSIDE THE INTERVAL DOES
 * NOT SAY WHICH MECHANISM MOVED. Thick Hide's 220 extra armor measured -1.7
 * DPS, which is "no difference", and the prediction being tested was that it
 * would cost RAGE. These columns are what showed the armor landing and the
 * rage not moving -- rage comes off the PRE-ARMOR figure, so armor cannot
 * reduce it, which `resourceRules.ts` states in those words.
 *
 * Reads the PLAYER's own survival and rage, which is the choice `BatchResult`
 * already makes: not every friendly actor, and keyed by resource so a pool
 * cannot be mislabelled.
 *
 * ----------------------------------------------------------------------------
 * IT TAKES A `PROFILE` NOW, defaulting to the Bear it is named after.
 *
 * The columns are not a Druid fact -- they are what any build whose figure of
 * merit is a DEATH COUNT has to be read on, and there are three such presets.
 * Pointing it at the Protection warrior was a copy-and-edit away, which is the
 * shape this project keeps paying for: the second copy is where it drifts.
 *
 *     PROFILE=prot_warr npx vite-node tools/bear_survival.ts
 *
 * HEALTH IS A COLUMN because a stamina change is invisible in every other one.
 * It moves the maximum, and Forever's `D x 10 / H` then makes each point of
 * damage taken worth LESS rage -- so stamina is expected to move deaths DOWN
 * and rage DOWN together, which no single figure here would have shown.
 * ----------------------------------------------------------------------------
 *
 * Not a test and not a baseline.
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch } from '../src/simulator';
import { characterAtCombatStart } from '../src/simulator';

const presetId = process.env.PROFILE ?? 'druid_bear';
const preset = PRESETS_BY_ID.get(presetId);
if (!preset) throw new Error(`no preset "${presetId}"`);
const profile = preset.build();
if (!profile.encounter.targetAttacks) {
  // A survival column on a build nothing attacks is a row of zeros that reads
  // like a finding. Refuse rather than print one.
  throw new Error(`${presetId} is not attacked, so it has no survival to read`);
}
const start = characterAtCombatStart(profile)!;

let deaths = 0;
let taken = 0;
let gained = 0;
let dps = 0;
/* The pool a build actually spends, so this works for a Bear and a Warrior. */
const RAGE = 'rage';
const SEEDS = 30;
for (let seed = 1; seed <= SEEDS; seed += 1) {
  const batch = runProfileBatch({
    ...profile,
    simulation: { ...profile.simulation, seed, iterations: 10 },
  });
  deaths += batch.survival.deaths;
  taken += batch.survival.damageTaken;
  gained += batch.resources.find((r) => r.resource === RAGE)?.totalGained ?? 0;
  dps += batch.dps.mean;
}
console.log(
  [
    presetId.padEnd(12),
    `dps ${(dps / SEEDS).toFixed(1)}`,
    `health ${start.health.maximum.toFixed(0)}`,
    `armor ${start.stats.get('armor').toFixed(0)}`,
    `dodge ${start.stats.get('dodgeChance').toFixed(2)}%`,
    `deaths ${(deaths / SEEDS).toFixed(2)}`,
    `taken ${(taken / SEEDS).toFixed(0)}`,
    `rage ${(gained / SEEDS).toFixed(0)}`,
  ].join('  '),
);
