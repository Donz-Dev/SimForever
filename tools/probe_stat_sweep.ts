/*
 * ============================================================================
 * ONE STAT, SWEPT IN BOTH DIRECTIONS, PAIRED.
 *
 *   PROFILE=shaman_elemental STAT=hasteRating npx vite-node tools/probe_stat_sweep.ts
 *   PROFILE=shaman_elemental STAT=hasteRating STEPS=-20,-2,2,20 DURATION=180 \
 *     npx vite-node tools/probe_stat_sweep.ts
 *
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS WHEN `stat_weights.ts` ALREADY PRICES TWENTY STATS. Because
 * that tool adds ONE positive step per stat and divides, which reports a SLOPE
 * -- and a slope is only an answer if the function is monotone.
 *
 * ON THE ELEMENTAL SHAMAN IT IS NOT. `stat_weights` priced +1% haste at
 * **-15.12 +/- 0.77** at 180s, and a paired swap taking the same 2% back OFF
 * measured **-22.58**: both directions lose, which no slope can express. Swept
 * finely at 60s the shape is
 *
 *     -20     -10      -2      -1      +1      +2     +10     +20     +40
 *   -12.04   -9.80   -1.01   -0.46   +0.54   +1.12   -4.34   -0.40   +7.74
 *
 * -- a small POSITIVE slope with a step of about -10 sitting on top of it. The
 * step is a SEARING TOTEM boundary: the totem is 55 seconds, its re-application
 * is gated on the aura having fallen off, and whether that last application
 * delivers any ticks before the fight ends moves with anything that changes the
 * cast rhythm. Totem ticks read **35.0 at haste ratings 0, 9, 10, 11, 30 and
 * 60, and 37.7 at 19, 20 and 21** -- and 20 is what the build wears.
 *
 * SO THE LESSON IS THE TOOL'S REASON FOR EXISTING: a single step cannot tell a
 * weight from a discontinuity, and the cheap way to tell them apart is to ask
 * for the same stat on both sides of where the build already sits. Two
 * directions losing is not a weight at all.
 *
 * IT READS THE SAME `withStat` AND `pairedDelta` `stat_weights.ts` DOES, so a
 * figure here is comparable with a row there rather than being a second
 * measurement of the same thing by a different route.
 *
 * A DIAGNOSTIC, like `probe_resources.ts` and `probe_clock.ts`. Nothing here
 * belongs in a baseline.
 * ============================================================================
 */
import { profileSamples } from '../src/simulator/iterationSamples';
import { pairedDelta, withStat } from '../src/simulator/statWeights';
import { PROFILE_PRESETS } from '../src/profiles';
import type { StatName } from '../src/engine';

const profileId = process.env.PROFILE ?? 'shaman_elemental';
const stat = (process.env.STAT ?? 'hasteRating') as StatName;
const ITER = Number(process.env.ITER ?? 400);
const SEED = Number(process.env.SEED ?? 20260101);
const STEPS = (process.env.STEPS ?? '-20,-10,-2,-1,1,2,10,20,40')
  .split(',')
  .map((s) => Number(s.trim()));
const DURATION = process.env.DURATION === undefined ? undefined : Number(process.env.DURATION);

const preset = PROFILE_PRESETS.find((p) => p.id === profileId);
if (!preset) {
  throw new Error(
    `No preset "${profileId}". Known ids: ${PROFILE_PRESETS.map((p) => p.id).join(', ')}`,
  );
}

const built = preset.build();
const base =
  DURATION === undefined
    ? built
    : { ...built, simulation: { ...built.simulation, durationSeconds: DURATION } };

const slice = { from: 0, to: ITER };
const baseline = profileSamples(base, SEED, slice);
const mean = baseline.dps.reduce((a, b) => a + b, 0) / baseline.dps.length;

/*
 * `profile.stats` IS THE PROFILE'S OWN BONUS BLOCK AND NOT THE CHARACTER'S
 * TOTAL -- the Elemental Shaman's 20 haste rating comes from two ENCHANTS, so
 * this prints 0 and the sweep is still relative to a character that has 20.
 * Said here because a reader comparing a step to the printed figure would
 * otherwise think the stat was absent.
 */
console.log(
  `\n${preset.label}  (${preset.id})   ${stat}` +
    `   fight ${base.simulation.durationSeconds}s   ${ITER} paired iterations`,
);
console.log(`  baseline ${mean.toFixed(1)} DPS   profile.stats.${stat} = ${base.stats?.[stat] ?? 0}\n`);

for (const step of STEPS) {
  const samples = profileSamples(withStat(base, stat, step), SEED, slice);
  const d = pairedDelta(baseline.dps, samples.dps);
  const verdict =
    d.spread === 0 ? 'IDENTICAL FIGHTS' : Math.abs(d.delta) > d.interval ? 'real' : 'noise';
  console.log(
    `  ${stat} ${step > 0 ? '+' : ''}${step}`.padEnd(28) +
      `${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(2)}`.padEnd(10) +
      `+/- ${d.interval.toFixed(2)}  spread ${d.spread.toFixed(1)}  ${verdict}`,
  );
}
