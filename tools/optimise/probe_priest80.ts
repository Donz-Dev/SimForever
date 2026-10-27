/*
 * ROUND 80 DIAGNOSTIC (not a measurement): one batch of one Priest preset, with
 * an optional variant from `priestVariants80.ts` applied, printing casts, the
 * damage or healing per ability, and the mana flow -- in a healer fight or a
 * damage fight at any clock and target count.
 *
 *   PRESET=priest_holy FIGHT=tank DURATION=120 npx vite-node tools/optimise/probe_priest80.ts
 *   PRESET=shadow_priest TARGETS=5 DURATION=60 GROUP=sp80Race INDEX=1 npx vite-node tools/optimise/probe_priest80.ts
 */
import { PRESETS_BY_ID } from '../../src/profiles';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import { runHealerBatch, runProfileBatch } from '../../src/simulator/runBatch';
import type { HealerFight } from '../../src/simulator/healerEncounter';
import { VARIANT_GROUPS } from './priestVariants80';

const PRESET = process.env.PRESET ?? 'shadow_priest';
const HEALER = PRESET !== 'shadow_priest';
const FIGHT: HealerFight = process.env.FIGHT === 'raid' ? 'raid' : 'tank';
const DURATION = Number(process.env.DURATION ?? (HEALER && FIGHT === 'raid' ? 60 : 120));
const TARGETS = Number(process.env.TARGETS ?? 1);
const ITER = Number(process.env.ITER ?? 60);

let preset = PRESETS_BY_ID.get(PRESET)!.build();
if (process.env.GROUP) {
  const variant = VARIANT_GROUPS[process.env.GROUP]![Number(process.env.INDEX ?? 0)]!;
  console.log(`variant: ${variant.label}`);
  preset = syncDefaultRotation(variant.apply(preset));
}
const profile = {
  ...preset,
  simulation: { ...preset.simulation, durationSeconds: DURATION, iterations: ITER },
  encounter: { ...preset.encounter, numberOfTargets: TARGETS },
};
const batch = HEALER ? runHealerBatch(profile, FIGHT) : runProfileBatch(profile);
console.log(
  `${PRESET} ${HEALER ? FIGHT : `${TARGETS}T`} ${DURATION}s  ${HEALER ? `HPS ${batch.hps.mean.toFixed(1)}` : `DPS ${batch.dps.mean.toFixed(1)}`}`,
);
if (HEALER) {
  for (const row of batch.healing) {
    console.log(
      `  ${row.abilityName.padEnd(26)} uses ${row.uses.toFixed(2).padStart(6)}  heal ${row.healing.toFixed(0).padStart(7)}  over ${row.overhealing.toFixed(0).padStart(7)}`,
    );
  }
}
for (const row of batch.abilities) {
  const r = row as unknown as { abilityName: string; uses: number; damage?: number; share?: number };
  if (r.uses > 0 || (r.damage ?? 0) > 0)
    console.log(`  cast ${r.abilityName.padEnd(26)} ${r.uses.toFixed(2).padStart(6)}  dmg ${(r.damage ?? 0).toFixed(0).padStart(8)}  ${(((r.share ?? 0) * 100).toFixed(1))}%`);
}
for (const flow of batch.resources) {
  const f = flow as unknown as {
    resource: string;
    gained: { sourceName: string; amount: number }[];
    spent: { sourceName: string; amount: number; count: number }[];
    totalGained: number;
    totalSpent: number;
  };
  if (f.resource !== 'mana') continue;
  console.log(`  mana gained ${f.totalGained.toFixed(0)}: ${f.gained.map((g) => `${g.sourceName} ${g.amount.toFixed(0)}`).join(', ')}`);
  console.log(`  mana spent ${f.totalSpent.toFixed(0)}: ${f.spent.map((g) => `${g.sourceName} ${g.amount.toFixed(0)}`).join(', ')}`);
}
