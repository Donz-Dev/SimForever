/*
 * A HEALER'S BOOK, ONE BATCH (round 78 diagnostic, not a measurement): casts,
 * effective and over-healing per spell, the mana flow, and the HPS, in one of
 * the two healer fights.
 *
 *   PRESET=shaman_resto FIGHT=raid DURATION=60 npx vite-node tools/optimise/probe_healer_book.ts
 */
import { PRESETS_BY_ID } from '../../src/profiles';
import { runHealerBatch } from '../../src/simulator/runBatch';
import type { HealerFight } from '../../src/simulator/healerEncounter';

const PRESET = process.env.PRESET ?? 'shaman_resto';
const FIGHT: HealerFight = process.env.FIGHT === 'raid' ? 'raid' : 'tank';
const DURATION = Number(process.env.DURATION ?? (FIGHT === 'raid' ? 60 : 120));
const ITER = Number(process.env.ITER ?? 60);

const preset = PRESETS_BY_ID.get(PRESET)!.build();
const profile = {
  ...preset,
  simulation: { ...preset.simulation, durationSeconds: DURATION, iterations: ITER },
};
const batch = runHealerBatch(profile, FIGHT);
console.log(`${PRESET} ${FIGHT} ${DURATION}s  HPS ${batch.hps?.mean?.toFixed?.(1) ?? JSON.stringify(batch.hps)}`);
for (const row of batch.healing) {
  console.log(
    `  ${row.abilityName.padEnd(26)} uses ${row.uses.toFixed(2).padStart(6)}  heal ${row.healing.toFixed(0).padStart(7)}  over ${row.overhealing.toFixed(0).padStart(7)}  cancelled ${row.cancelled.toFixed(2)}`,
  );
}
for (const row of batch.abilities) {
  if (row.uses > 0) console.log(`  cast ${row.abilityName.padEnd(26)} ${row.uses.toFixed(2)}`);
}
for (const flow of batch.resources) {
  const f = flow as unknown as Record<string, unknown> & {
    gained: { sourceName: string; amount: number }[];
  };
  console.log(`  mana gained: ${f.gained.map((g) => `${g.sourceName} ${g.amount.toFixed(0)}`).join(', ')}`);
  for (const [k, v] of Object.entries(f)) {
    if (k !== 'gained') console.log(`  ${k}: ${JSON.stringify(v).slice(0, 500)}`);
  }
}
