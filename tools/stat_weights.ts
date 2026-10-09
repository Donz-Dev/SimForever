/*
 * ============================================================================
 * STAT WEIGHTS FOR A PRESET, FROM THE COMMAND LINE.
 *
 *   npx vite-node tools/stat_weights.ts
 *   PROFILE=dw_fury npx vite-node tools/stat_weights.ts
 *   PROFILE=rogue_combat STATS=agility,hitChance,critChance npx vite-node tools/stat_weights.ts
 *   PROFILE=prot_warr ITERATIONS=6000 npx vite-node tools/stat_weights.ts
 *   PROFILE=mage_fire PLAN=1 npx vite-node tools/stat_weights.ts   (plan only, no fights)
 *
 * ----------------------------------------------------------------------------
 * WHY A TOOL AND NOT ONLY THE PANEL. Every other measurement in this project
 * can be reproduced from a command, and a stat weight is a measurement -- it
 * has a step size, an iteration count and an interval, and a figure quoted
 * without those is a rumour. The GUI drives the same `src/simulator` functions
 * across a pool of Web Workers; this drives them on one thread, which is slower
 * and produces identical numbers for the same base seed.
 *
 * IT IS NOT A BASELINE PRINTER. `measure_profiles.ts` is what reproduces a
 * published DPS figure; the `baseline` line here is whatever the chosen
 * iteration count happened to give and should not be quoted as one.
 * ============================================================================
 */
import type { StatName } from '../src/engine';
import {
  WEIGHTABLE_STATS,
  runStatWeights,
  statWeightPlan,
} from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';

const PROFILE = process.env.PROFILE ?? 'dw_fury';
/*
 * THE SAME COUNT FOR THE BASELINE AND FOR EVERY VARIANT, on the ruleset
 * owner's instruction. It replaced an allocation that gave a noisy stat more
 * fights than a quiet one, which was cheaper and made two rows of one table
 * incomparable.
 */
const ITERATIONS = Number(process.env.ITERATIONS ?? 3000);
const SEED = Number(process.env.SEED ?? 20_261_008);
const PLAN_ONLY = process.env.PLAN === '1';

const selected: StatName[] = process.env.STATS
  ? (process.env.STATS.split(',').map((name) => name.trim()) as StatName[])
  : WEIGHTABLE_STATS.map((stat) => stat.id);

const preset = PROFILE_PRESETS.find((candidate) => candidate.id === PROFILE);
if (!preset) {
  console.error(
    `No preset "${PROFILE}". One of:\n  ${PROFILE_PRESETS.map((p) => p.id).join('\n  ')}`,
  );
  process.exit(1);
}

const profile = preset.build();
const plan = statWeightPlan(profile, selected);

console.log(`\n${preset.label} — ${preset.detail}  (${PROFILE})`);

/*
 * THE LADDER FIRST, because it is the part a reader has to agree with before
 * any weight below it means anything. "nine more points caps the off hand" is
 * the claim, and this is where it is checked.
 */
for (const report of plan.headroom) {
  console.log(`\n  ${report.name} — slice by slice:`);
  for (const slice of report.slices) {
    console.log(
      `    ${slice.label.padEnd(26)} now ${slice.current.toFixed(2).padStart(6)}%` +
        `   to cap ${slice.headroom === 0 ? '  capped' : `+${slice.headroom.toFixed(2)}%`}`,
    );
  }
  if (report.tiers.length === 0) {
    console.log('    -> capped everywhere. No stat weight.');
  }
  for (const tier of report.tiers) {
    console.log(
      `    -> +${(tier.to - tier.from).toFixed(2)}% caps ${tier.caps.join(', ')}` +
        `   (still paying: ${tier.benefits.join(', ')})`,
    );
  }
}

if (plan.skipped.length > 0) {
  console.log('\n  Not measured:');
  for (const entry of plan.skipped) {
    console.log(`    ${entry.name.padEnd(24)} ${entry.reason}`);
  }
}

if (PLAN_ONLY) {
  console.log(`\n  ${plan.variants.length} variants would run.\n`);
  process.exit(0);
}

const run = runStatWeights(profile, selected, { baseSeed: SEED, iterations: ITERATIONS });

console.log(
  `\n  baseline ${run.baselineDps.toFixed(1)} DPS` +
    (run.baselineDeaths > 0 ? `, ${run.baselineDeaths.toFixed(2)} deaths a fight` : '') +
    `, ${run.iterations} iterations each` +
    `   (${run.fights} fights total, ${(run.elapsedRealMs / 1000).toFixed(1)}s)\n`,
);

const rows = [...run.weights].sort((a, b) => b.perUnit - a.perUnit);
/*
 * RELATIVE TO THE LARGEST MEASURED WEIGHT, which is how a gear planner reads a
 * weight list: the absolute DPS figure depends on the step and the build, and
 * the ratio is what decides between two items. Only rows the run can stand
 * behind set the scale.
 */
const top = Math.max(
  ...rows.filter((row) => row.verdict === 'measured').map((row) => Math.abs(row.perUnit)),
  1e-9,
);

/*
 * THE VERDICT IS THE COLUMN TO READ FIRST. "nothing" is a confident answer --
 * the variant ran bit-identical fights and the planner checked the stat
 * reached the character before spending one -- and "not measured" is the
 * absence of an answer. They print as the same zero otherwise.
 */
const VERDICTS = {
  measured: '',
  none: '   nothing: this build cannot read it',
  inconclusive: '   not measured: the interval swallows the value',
} as const;

console.log(
  '  stat                                                   added    delta    per unit        95%     rel',
);
for (const row of rows) {
  const unit = `${row.units}${row.unitLabel}`;
  const relative = row.verdict === 'measured' ? (row.perUnit / top).toFixed(3) : '';
  console.log(
    `  ${row.name.padEnd(54)} ${unit.padStart(5)} ` +
      `${row.delta.toFixed(2).padStart(8)} ` +
      `${row.perUnit.toFixed(4).padStart(10)} ` +
      `${`+-${row.interval.toFixed(4)}`.padStart(11)} ` +
      `${relative.padStart(6)}` +
      VERDICTS[row.verdict],
  );
}

/*
 * THE SPREAD COLUMN, kept separate because it answers a different question:
 * not "what is this stat worth" but "why is that interval so wide". Near zero
 * means the variant ran the same fights as the baseline; tens of DPS means one
 * flipped roll reordered the random stream, and no iteration count inside a
 * browser session will settle it to a decimal.
 */
const noisy = rows.filter((row) => row.spread > 1);
if (noisy.length > 0) {
  console.log('\n  Paired spread — why some intervals are wide:');
  for (const row of noisy) {
    console.log(
      `    ${row.name.padEnd(54)} per-iteration sd ${row.spread.toFixed(1).padStart(7)} DPS`,
    );
  }
}

/*
 * THE TANK TABLE, off the SAME fights. A defensive weight asks what a point
 * takes off the death count rather than what it adds to DPS, and both numbers
 * were read from one pass -- so this costs no iterations at all.
 *
 * Only where something can die: in a fight the target does not swing in, every
 * row would be a confident zero.
 */
if (run.survival.length > 0) {
  const tank = [...run.survival].sort((a, b) => b.perUnit - a.perUnit);
  const best = Math.max(
    ...tank.filter((row) => row.verdict === 'measured').map((row) => Math.abs(row.perUnit)),
    1e-9,
  );

  console.log('\n  TANK WEIGHTS -- deaths avoided per point, higher is better\n');
  console.log(
    '  stat                                                   added  avoid death/pt        95%     rel',
  );
  for (const row of tank) {
    const unit = `${row.units}${row.unitLabel}`;
    const relative = row.verdict === 'measured' ? (row.perUnit / best).toFixed(3) : '';
    console.log(
      `  ${row.name.padEnd(54)} ${unit.padStart(5)} ` +
        `${row.perUnit.toFixed(4).padStart(12)} ` +
        `${`+-${row.interval.toFixed(4)}`.padStart(11)} ` +
        `${relative.padStart(6)}` +
        VERDICTS[row.verdict],
    );
  }
}

console.log('');
