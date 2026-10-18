/*
 * ============================================================================
 * A/B A WHOLE SHOCKADIN BUILD AGAINST ITS BASELINE, UNDER SHARED SEEDS.
 *
 *   PRESET=pally_shockadin_2h VARIANTS=enchants npx vite-node tools/probe_build.ts
 *   ITER=500 VARIANTS=all npx vite-node tools/probe_build.ts
 *
 * ----------------------------------------------------------------------------
 * PAIRED, FOR THE REASON `statWeights.ts` GIVES: `deriveSeed(baseSeed, i)`
 * fixes iteration i's fight, so the two runs share fight lengths and the
 * DIFFERENCE is four orders of magnitude quieter than two independent means.
 * The per-iteration SPREAD is printed beside every figure, because a change
 * that can flip a roll decorrelates the two fights and the pairing stops
 * helping -- and a reader sorting by value has no other way to see that.
 *
 * `none` MEANS THE VARIANT RAN BIT-IDENTICAL FIGHTS, which is this project's
 * own tell for a patch that did not apply as much as it is for a change worth
 * nothing. Both readings are reported, never collapsed to "0.0".
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { profileSamples } from '../src/simulator/iterationSamples';
import { pairedDelta } from '../src/simulator/statWeights';
import { syncDefaultRotation } from '../src/profiles/rotation';
import { VARIANT_GROUPS as SHOCKADIN } from './shockadinVariants';
import { VARIANT_GROUPS as HUNTER } from './hunterVariants';
import { VARIANT_GROUPS as DRUID } from './druidVariants';
import { VARIANT_GROUPS as WARRIOR } from './warriorVariants';
import { VARIANT_GROUPS as MAGE } from './mageVariants';
import { VARIANT_GROUPS as SHAMAN } from './shamanVariants';
import { VARIANT_GROUPS as PRIEST } from './priestVariants';
import { VARIANT_GROUPS as ARCANE } from './arcaneVariants';
import { VARIANT_GROUPS as FIRE } from './fireVariants';
import { VARIANT_GROUPS as FROSTFIRE } from './frostfireVariants';

/*
 * ONE REGISTRY, SPREAD FROM THE PER-CLASS FILES. A group name is a command-line
 * argument, so they share a namespace -- each file prefixes its own.
 */
const VARIANT_GROUPS = {
  ...SHOCKADIN,
  ...HUNTER,
  ...DRUID,
  ...WARRIOR,
  ...MAGE,
  ...SHAMAN,
  ...PRIEST,
  ...ARCANE,
  ...FIRE,
  ...FROSTFIRE,
};

const PRESET = process.env.PRESET ?? 'pally_shockadin_2h';
const ITER = Number(process.env.ITER ?? 400);
const SEED = Number(process.env.SEED ?? 20260101);
const WANTED = (process.env.VARIANTS ?? 'all').split(',').map((s) => s.trim());

export type Variant = {
  readonly group: string;
  readonly label: string;
  readonly apply: (profile: CharacterProfile) => CharacterProfile;
};

/*
 * ============================================================================
 * FIGHT LENGTH IS AN AXIS, NOT A CONSTANT. The owner: "rotations need to be
 * built for longer than 1 minute ... ensure that variable combat time is taken
 * into account."
 *
 * Every profile carries `durationSeconds: 60` from `createDefaultProfile`, and
 * a minute is SHORTER THAN SEVERAL OF THE COOLDOWNS THE LIST HOLDS -- Arcane
 * Power and Presence of Mind are three minutes each. At 60s such an ability is
 * cast once and its list entry can never be reached a second time, so any
 * conclusion about WHERE it belongs in the list is a conclusion about the
 * clock rather than about the rotation.
 *
 * APPLIED TO THE BASELINE AND EVERY VARIANT ALIKE, which is the whole point:
 * the comparison stays paired and only the clock moves.
 * ============================================================================
 */
const DURATION = process.env.DURATION === undefined ? undefined : Number(process.env.DURATION);

const preset = PRESETS_BY_ID.get(PRESET)!.build();
const base: CharacterProfile =
  DURATION === undefined
    ? preset
    : { ...preset, simulation: { ...preset.simulation, durationSeconds: DURATION } };
const slice = { from: 0, to: ITER };

const baseline = profileSamples(base, SEED, slice);
const baseMean = baseline.dps.reduce((a, b) => a + b, 0) / baseline.dps.length;
console.log(`${PRESET}   baseline ${baseMean.toFixed(1)} DPS over ${ITER} paired iterations at ${base.simulation.durationSeconds}s\n`);

const groups = WANTED.includes('all') ? Object.keys(VARIANT_GROUPS) : WANTED;

for (const group of groups) {
  const variants = VARIANT_GROUPS[group];
  if (!variants) {
    console.log(`-- ${group}: no such group --`);
    continue;
  }
  console.log(`== ${group} ==`);
  const rows: { label: string; delta: number; interval: number; spread: number }[] = [];
  const failures: string[] = [];
  for (const variant of variants) {
    /*
     * `syncDefaultRotation` AFTER EVERY EDIT, because a talent change moves
     * which stock list applies and a consumable selection decides which
     * entries are in it. A variant that changed the talents and kept the old
     * list would be measuring two things and reporting one.
     */
    /*
     * ONE BAD VARIANT MUST NOT TAKE THE WHOLE GROUP WITH IT. The talent guard
     * throws on an illegal tree, which is what it is for -- and a throw that
     * discards nine measured rows costs a run each time somebody mistypes a
     * point total.
     */
    let profile;
    try {
      profile = syncDefaultRotation(variant.apply(base));
    } catch (error) {
      failures.push(`  ${variant.label.padEnd(46)} SKIPPED: ${(error as Error).message}`);
      continue;
    }
    const samples = profileSamples(profile, SEED, slice);
    const d = pairedDelta(baseline.dps, samples.dps);
    rows.push({ label: variant.label, delta: d.delta, interval: d.interval, spread: d.spread });
  }
  rows.sort((a, b) => b.delta - a.delta);
  for (const row of rows) {
    const verdict =
      row.spread === 0 ? 'IDENTICAL FIGHTS' : Math.abs(row.delta) > row.interval ? 'real' : 'noise';
    console.log(
      `  ${row.label.padEnd(46)} ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(2)}`.padEnd(58) +
        `+/- ${row.interval.toFixed(2)}  spread ${row.spread.toFixed(1)}  ${verdict}`,
    );
  }
  for (const failure of failures) console.log(failure);
  console.log('');
}
