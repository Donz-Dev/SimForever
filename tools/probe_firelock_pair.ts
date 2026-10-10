/*
 * Which PAIR the Firelock should carry, now that Life Tap is gated on mana.
 *
 * ----------------------------------------------------------------------------
 * `probe_consumable_choice.ts` measures each candidate ALONE against nothing,
 * which is the right shape for choosing within a category and the wrong shape
 * for this question: the Demonic Rune and the Major Mana Potion both restore
 * MANA from two categories that are not exclusive, so each one makes the other
 * worth less. "Marginal values measured against a full build do not sum to the
 * total and can exceed it" -- so the pair has to be measured as a pair.
 *
 * WHY IT IS ONLY THIS PROFILE. Gating Life Tap turned the Firelock from a build
 * that printed mana on demand into one that genuinely runs out, which is what
 * made a mana restore worth anything at all. No other preset's economy moved:
 * SM/DS already Life Tapped 0.00 times at every gate from 2% to 30%.
 * ----------------------------------------------------------------------------
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch } from '../src/simulator';
import { syncDefaultRotation } from '../src/profiles/rotation';
import type { CharacterProfile } from '../src/profiles';

const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const base = PRESETS_BY_ID.get(process.env.PRESET ?? 'warlock_firelock')!.build();

const PAIRS: readonly (readonly [string, string | undefined, string | undefined])[] = [
  ['nothing', undefined, undefined],
  ['spellblasting + rune', 'major_spellblasting_potion', 'demonic_rune'],
  ['mana potion + rune', 'major_mana_potion', 'demonic_rune'],
  ['mana potion alone', 'major_mana_potion', undefined],
  ['rune alone', undefined, 'demonic_rune'],
  ['spellblasting alone', 'major_spellblasting_potion', undefined],
  ['frenzy + rune', 'major_frenzy_potion', 'demonic_rune'],
];

function build(potion: string | undefined, other: string | undefined): CharacterProfile {
  const consumables = { ...base.consumables };
  if (potion) consumables.potion = potion;
  else delete consumables.potion;
  if (other) consumables.other = other;
  else delete consumables.other;
  return syncDefaultRotation({ ...base, consumables });
}

function measure(profile: CharacterProfile) {
  const samples: number[] = [];
  let taps = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, seed, iterations: ITERATIONS },
    });
    samples.push(batch.dps.mean);
    taps += batch.abilities.find((row) => row.abilityName === 'Life Tap')?.uses ?? 0;
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return { mean, interval: 2 * Math.sqrt(variance / samples.length), taps: taps / SEEDS };
}

console.log(`SEEDS=${SEEDS} ITERATIONS=${ITERATIONS}\n`);
console.log('%-24s %9s %7s %7s %9s', 'pair', 'dps', '+/-', 'taps', 'vs none');

let none = 0;
for (const [label, potion, other] of PAIRS) {
  const row = measure(build(potion, other));
  if (label === 'nothing') none = row.mean;
  console.log(
    '%-24s %9s %7s %7s %9s',
    label,
    row.mean.toFixed(1),
    row.interval.toFixed(1),
    row.taps.toFixed(2),
    label === 'nothing' ? '--' : `${row.mean - none >= 0 ? '+' : ''}${(row.mean - none).toFixed(1)}`,
  );
}
