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
 * Not a test and not a baseline.
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch } from '../src/simulator';
import { characterAtCombatStart } from '../src/simulator';

const profile = PRESETS_BY_ID.get('druid_bear')!.build();
const start = characterAtCombatStart(profile)!;

let deaths = 0;
let taken = 0;
let gained = 0;
let dps = 0;
const SEEDS = 30;
for (let seed = 1; seed <= SEEDS; seed += 1) {
  const batch = runProfileBatch({
    ...profile,
    simulation: { ...profile.simulation, seed, iterations: 10 },
  });
  deaths += batch.survival.deaths;
  taken += batch.survival.damageTaken;
  gained += batch.resources.find((r) => r.resource === 'rage')?.totalGained ?? 0;
  dps += batch.dps.mean;
}
console.log(
  [
    `dps ${(dps / SEEDS).toFixed(1)}`,
    `armor ${start.stats.get('armor').toFixed(0)}`,
    `dodge ${start.stats.get('dodgeChance').toFixed(2)}%`,
    `deaths ${(deaths / SEEDS).toFixed(2)}`,
    `taken ${(taken / SEEDS).toFixed(0)}`,
    `rage ${(gained / SEEDS).toFixed(0)}`,
  ].join('  '),
);
