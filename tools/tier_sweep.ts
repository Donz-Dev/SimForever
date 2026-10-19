/*
 * ==============================================================================
 * EVERY PROFILE AT THE FOUR BENCHMARK GEAR LEVELS -- B55, E65, E75, E85, which
 * the owner charts as Pre-BiS, Tier 1, Tier 2 and Tier 3.
 *
 *   HTML=sweep.html npx vite-node tools/tier_sweep.ts       # the chart page, 300 fights each
 *   OUT=sweep.json HTML=sweep.html npx vite-node tools/tier_sweep.ts   # and the raw figures
 *   ITER=100 PROFILES=prot_warr,dw_fury npx vite-node tools/tier_sweep.ts
 *
 * THE PAGE IS `tools/tier_sweep_chart.ts`, which can also re-render a saved
 * JSON without re-running anything.
 *
 * THE GEAR IS SWAPPED THE WAY THE GEAR PANEL'S BUTTONS SWAP IT --
 * `benchmarkEquipmentFor` with the current equipment, so every slot keeps its
 * enchant. Nothing else about the profile moves.
 *
 * DPS for every profile; TPS and DAMAGE TAKEN PER SECOND as well, which are
 * what a tank row is read for. Damage taken per second divides by the mean
 * fight length, which varies a little around the profile's 60 seconds.
 * ==============================================================================
 */
import { writeFileSync } from 'node:fs';
import { PROFILE_PRESETS } from '../src/profiles';
import { BENCHMARK_SETS, benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { templateIdFor } from '../src/game/items/defaultValuation';
import { runProfileBatch } from '../src/simulator/runBatch';
import type { TierSweepRow } from './tier_sweep_chart';
import { renderTierSweepPage } from './tier_sweep_chart';

const ITER = Number(process.env.ITER ?? 300);
const SEED = Number(process.env.SEED ?? 20261019);
const WANTED = process.env.PROFILES?.split(',').map((s) => s.trim());
const OUT = process.env.OUT;
const HTML = process.env.HTML;

/** The four builds whose target attacks back. */
export const TANKS = new Set(['prot_warr', 'fury_prot', 'prot_pally', 'druid_bear']);

const rows: TierSweepRow[] = [];
for (const preset of PROFILE_PRESETS) {
  if (WANTED && !WANTED.includes(preset.id)) continue;
  const base = preset.build();
  const templateId = templateIdFor(base.benchmarkTemplateId, base.character.name);
  if (!templateId) {
    console.log(`${preset.id}: no benchmark template, skipped`);
    continue;
  }
  const row: TierSweepRow = { id: preset.id, name: base.character.name, tank: TANKS.has(preset.id), levels: {} };
  const line: string[] = [];
  for (const set of BENCHMARK_SETS) {
    const equipment = benchmarkEquipmentFor(templateId, set.id, base.equipment);
    if (!equipment) continue;
    const profile = {
      ...base,
      equipment,
      simulation: { ...base.simulation, iterations: ITER, seed: SEED },
    };
    const batch = runProfileBatch(profile);
    const seconds = batch.meanDurationMs / 1000;
    const entry = {
      dps: batch.dps.mean,
      tps: batch.tps.mean,
      dtps: batch.survival.damageTaken / seconds,
    };
    row.levels[set.id] = entry;
    line.push(
      row.tank
        ? `${set.id} ${entry.dps.toFixed(1)} dps ${entry.tps.toFixed(1)} tps ${entry.dtps.toFixed(1)} dtps`
        : `${set.id} ${entry.dps.toFixed(1)}`,
    );
  }
  rows.push(row);
  console.log(`${row.name.padEnd(16)} ${line.join('  |  ')}`);
}

if (OUT) {
  writeFileSync(OUT, JSON.stringify({ iterations: ITER, seed: SEED, rows }, null, 2));
  console.log(`\nWrote ${rows.length} profiles to ${OUT}`);
}
if (HTML) {
  writeFileSync(HTML, renderTierSweepPage({ iterations: ITER, rows }));
  console.log(`Wrote the chart page to ${HTML}`);
}
