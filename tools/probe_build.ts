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
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PRESETS_BY_ID } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import type { IterationSamples } from '../src/simulator/iterationSamples';
import { healerSamples, profileSamples } from '../src/simulator/iterationSamples';
import type { HealerFight } from '../src/simulator/healerEncounter';
import { HEALER_PROFILE_IDS } from '../src/profiles/presetRoles';
import { COMBAT_COLUMNS, HEALER_COLUMNS } from './fullReportColumns';
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
import { VARIANT_GROUPS as FURY_PROT } from './furyProtVariants';
import { VARIANT_GROUPS as DEMO } from './demoVariants';
import { VARIANT_GROUPS as FIRELOCK } from './firelockVariants';

/*
 * ONE REGISTRY, SPREAD FROM THE PER-CLASS FILES. A group name is a command-line
 * argument, so they share a namespace -- each file prefixes its own.
 */
/*
 * `FILE=` LOADS ONE MORE VARIANT FILE BY PATH (round 78), so a file written for
 * one optimisation round is measurable without editing this registry -- nine
 * classes optimised at once would otherwise all edit the import list above.
 */
const EXTRA: Record<string, readonly { label: string; apply: Variant['apply'] }[]> = process.env.FILE
  ? ((await import(/* @vite-ignore */ pathToFileURL(resolve(process.env.FILE)).href))
      .VARIANT_GROUPS as Record<string, readonly { label: string; apply: Variant['apply'] }[]>)
  : {};

const VARIANT_GROUPS: Record<string, readonly { label: string; apply: Variant['apply'] }[]> = {
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
  ...FURY_PROT,
  ...DEMO,
  ...FIRELOCK,
  // LAST, so a group in the file named on the command line wins a name clash.
  ...EXTRA,
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

/*
 * ============================================================================
 * TARGETS, A HEALER'S FIGHT, AND WHICH FIGURE IS DIFFERENCED (round 78).
 *
 *   TARGETS=5           the encounter's Number of Targets. More than one runs
 *                       the profile's Multi Target section, as the app does.
 *   FIGHT=tank|raid     a healer's fight. Defaults to `tank` for a healer
 *                       preset; ignored for anyone else.
 *   METRIC=dps|tps|hps  the figure each row differences. Defaults by ROLE:
 *                       hps for a healer, tps for a build whose target swings
 *                       back, dps otherwise. The owner's core drivers.
 *
 * All three are applied to the baseline and every variant alike, so the
 * comparison stays paired.
 * ============================================================================
 */
const TARGETS = process.env.TARGETS === undefined ? undefined : Number(process.env.TARGETS);
const HEALER = HEALER_PROFILE_IDS.includes(PRESET);
const FIGHT: HealerFight = process.env.FIGHT === 'raid' ? 'raid' : 'tank';

const preset = PRESETS_BY_ID.get(PRESET)!.build();
const base: CharacterProfile = {
  ...preset,
  simulation: { ...preset.simulation, ...(DURATION === undefined ? {} : { durationSeconds: DURATION }) },
  encounter: { ...preset.encounter, ...(TARGETS === undefined ? {} : { numberOfTargets: TARGETS }) },
};
const METRIC = (process.env.METRIC ?? (HEALER ? 'hps' : base.encounter.targetAttacks ? 'tps' : 'dps')) as
  | 'dps'
  | 'tps'
  | 'hps';
const slice = { from: 0, to: ITER };
const samplesOf = (profile: CharacterProfile): IterationSamples =>
  HEALER ? healerSamples(profile, FIGHT, SEED, slice) : profileSamples(profile, SEED, slice);
const metricOf = (samples: IterationSamples): number[] => samples[METRIC];

/*
 * ============================================================================
 * WEIGHTED=1 (round 79): every row is the WEIGHTED SCORE across the report's
 * own encounters, at their own clocks -- single target 120 s at 49% and 3, 5
 * and 8 targets at 17% each, or the two healer fights at half each. Each
 * encounter is paired on its own and the deltas are combined with the weights,
 * the interval as independent columns. This is what a TALENT build is chosen
 * on: one build has to serve every fight, where a list or a potion need not.
 * DURATION, TARGETS and FIGHT are ignored in this mode.
 * ============================================================================
 */
if (process.env.WEIGHTED === '1') {
  const columns = HEALER ? HEALER_COLUMNS : COMBAT_COLUMNS;
  const metric = (process.env.METRIC ?? (HEALER ? 'hps' : preset.encounter.targetAttacks ? 'tps' : 'dps')) as
    | 'dps'
    | 'tps'
    | 'hps';
  const atColumn = (profile: CharacterProfile, column: (typeof columns)[number]): number[] => {
    const shaped: CharacterProfile = {
      ...profile,
      simulation: { ...profile.simulation, durationSeconds: column.seconds },
      encounter: { ...profile.encounter, ...(column.targets ? { numberOfTargets: column.targets } : {}) },
    };
    const samples = column.fight
      ? healerSamples(shaped, column.fight, SEED, slice)
      : profileSamples(shaped, SEED, slice);
    return samples[metric];
  };
  const baseByColumn = columns.map((column) => atColumn(preset, column));
  const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const baseScore = columns.reduce((sum, column, at) => sum + column.weight * mean(baseByColumn[at]), 0);
  console.log(
    `${PRESET}   baseline WEIGHTED ${metric.toUpperCase()} ${baseScore.toFixed(1)} over ${ITER} paired iterations a column (` +
      columns.map((column, at) => `${column.id} ${mean(baseByColumn[at]).toFixed(1)}`).join(', ') +
      ')\n',
  );
  for (const group of WANTED.includes('all') ? Object.keys(VARIANT_GROUPS) : WANTED) {
    const variants = VARIANT_GROUPS[group];
    if (!variants) {
      console.log(`-- ${group}: no such group --`);
      continue;
    }
    console.log(`== ${group} ==`);
    const rows: { label: string; delta: number; interval: number; parts: string }[] = [];
    for (const variant of variants) {
      let profile;
      try {
        profile = syncDefaultRotation(variant.apply(preset));
      } catch (error) {
        console.log(`  ${variant.label.padEnd(46)} SKIPPED: ${(error as Error).message}`);
        continue;
      }
      let delta = 0;
      let variance = 0;
      const parts: string[] = [];
      columns.forEach((column, at) => {
        const d = pairedDelta(baseByColumn[at], atColumn(profile, column));
        delta += column.weight * d.delta;
        variance += (column.weight * d.interval) ** 2;
        parts.push(`${column.id} ${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(1)}`);
      });
      rows.push({ label: variant.label, delta, interval: Math.sqrt(variance), parts: parts.join(' ') });
    }
    rows.sort((a, b) => b.delta - a.delta);
    for (const row of rows) {
      const verdict = Math.abs(row.delta) > row.interval ? 'real' : 'noise';
      console.log(
        `  ${row.label.padEnd(46)} ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(2)}`.padEnd(58) +
          `+/- ${row.interval.toFixed(2)}  ${verdict}   [${row.parts}]`,
      );
    }
    console.log('');
  }
  process.exit(0);
}

const baseline = samplesOf(base);
const baseMean = metricOf(baseline).reduce((a, b) => a + b, 0) / ITER;
/*
 * A TANK IS READ ON DEATHS FIRST, which `docs/profile-optimisation.md` says in
 * capitals and this tool could not show: the samples already carried a death
 * count per iteration and only the DPS was differenced. So when the baseline
 * dies at all, every row gets a paired DEATHS delta beside its DPS one --
 * negative is better -- and a DPS profile, which never dies, prints as before.
 */
const baseDeaths = baseline.deaths.reduce((a, b) => a + b, 0) / baseline.deaths.length;
const SHOW_DEATHS = baseDeaths > 0;
console.log(
  `${PRESET}   baseline ${baseMean.toFixed(1)} ${METRIC.toUpperCase()}` +
    (SHOW_DEATHS ? `, ${baseDeaths.toFixed(2)} deaths` : '') +
    ` over ${ITER} paired iterations at ${base.simulation.durationSeconds}s` +
    (HEALER ? `, ${FIGHT} healer fight` : `, ${base.encounter.numberOfTargets} target(s)`) +
    '\n',
);

const groups = WANTED.includes('all') ? Object.keys(VARIANT_GROUPS) : WANTED;

for (const group of groups) {
  const variants = VARIANT_GROUPS[group];
  if (!variants) {
    console.log(`-- ${group}: no such group --`);
    continue;
  }
  console.log(`== ${group} ==`);
  const rows: {
    label: string;
    delta: number;
    interval: number;
    spread: number;
    deaths?: { delta: number; interval: number };
  }[] = [];
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
    const samples = samplesOf(profile);
    const d = pairedDelta(metricOf(baseline), metricOf(samples));
    const dd = SHOW_DEATHS ? pairedDelta(baseline.deaths, samples.deaths) : undefined;
    rows.push({
      label: variant.label,
      delta: d.delta,
      interval: d.interval,
      spread: d.spread,
      ...(dd ? { deaths: { delta: dd.delta, interval: dd.interval } } : {}),
    });
  }
  rows.sort((a, b) => b.delta - a.delta);
  for (const row of rows) {
    const verdict =
      row.spread === 0 ? 'IDENTICAL FIGHTS' : Math.abs(row.delta) > row.interval ? 'real' : 'noise';
    console.log(
      `  ${row.label.padEnd(46)} ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(2)}`.padEnd(58) +
        `+/- ${row.interval.toFixed(2)}  spread ${row.spread.toFixed(1)}  ${verdict}` +
        (row.deaths
          ? `   deaths ${row.deaths.delta >= 0 ? '+' : ''}${row.deaths.delta.toFixed(3)} +/- ${row.deaths.interval.toFixed(3)}`
          : ''),
    );
  }
  for (const failure of failures) console.log(failure);
  console.log('');
}
