/*
 * One variant's results page (round 80): damage table and uptimes for a
 * variant out of `hunterVariants80.ts`, so a weave can be read rather than
 * only differenced.
 *
 *   PRESET=lw_melee GROUP=h80lwmWeave INDEX=1 DURATION=120 TARGETS=1 npx vite-node tools/optimise/hunterVariantReport80.ts
 */
import { PRESETS_BY_ID } from '../../src/profiles';
import { runProfileBatch } from '../../src/simulator';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import { VARIANT_GROUPS } from './hunterVariants80';

const PRESET = process.env.PRESET ?? 'lw_melee';
const preset = PRESETS_BY_ID.get(PRESET)!.build();
const group = process.env.GROUP;
const index = Number(process.env.INDEX ?? 0);
const variant = group ? VARIANT_GROUPS[group][index] : undefined;
const base = {
  ...preset,
  simulation: { ...preset.simulation, iterations: Number(process.env.ITER ?? 60), ...(process.env.DURATION ? { durationSeconds: Number(process.env.DURATION) } : {}) },
  encounter: { ...preset.encounter, ...(process.env.TARGETS ? { numberOfTargets: Number(process.env.TARGETS) } : {}) },
};
const profile = syncDefaultRotation(variant ? variant.apply(base) : base);
const batch = runProfileBatch(profile);
console.log(`${PRESET} ${variant?.label ?? 'preset'}  DPS ${batch.dps.mean.toFixed(1)}`);
for (const row of batch.abilities) {
  console.log(
    `  ${row.abilityName.padEnd(28)} ${row.share.toFixed(1).padStart(5)}%  uses ${row.uses.toFixed(2).padStart(6)}  attempts ${row.attempts.toFixed(1).padStart(6)}  avg ${row.average.toFixed(0).padStart(6)}`,
  );
}
if (process.env.BUFFS) for (const row of batch.buffUptime) console.log(`  buff ${row.auraName.padEnd(30)} ${(row.uptime * 100).toFixed(1)}%`);
for (const flow of batch.resources) {
  const f = flow as unknown as Record<string, unknown>;
  console.log(`  [${flow.resource}] ${JSON.stringify(Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'number')))}`);
}
