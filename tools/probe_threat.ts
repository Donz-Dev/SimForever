/*
 * What each profile threatens for, and where it comes from (round 47).
 *
 *   PROFILES=prot_warr,dw_fury npx vite-node tools/probe_threat.ts
 *   ITER=200 npx vite-node tools/probe_threat.ts      # every profile
 */
import { PROFILE_PRESETS } from '../src/profiles';
import { runBatch } from '../src/simulator/runBatch';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';

const ITER = Number(process.env.ITER ?? 60);
const WANTED = process.env.PROFILES?.split(',').map((s) => s.trim());
const TOP = Number(process.env.TOP ?? 6);

for (const preset of PROFILE_PRESETS) {
  if (WANTED && !WANTED.includes(preset.id)) continue;
  const profile = preset.build();
  const batch = runBatch(trainingDummyEncounter(profile), { iterations: ITER, baseSeed: 20261018 });
  const ratio = batch.dps.mean > 0 ? batch.tps.mean / batch.dps.mean : 0;
  console.log(
    `${preset.id.padEnd(22)} DPS ${batch.dps.mean.toFixed(1).padStart(7)}  TPS ${batch.tps.mean.toFixed(1).padStart(7)}  TPS/DPS ${ratio.toFixed(3)}`,
  );
  if (WANTED) {
    for (const row of batch.threat.slice(0, TOP)) {
      console.log(`    ${row.name.padEnd(30)} ${row.threat.toFixed(0).padStart(8)}`);
    }
  }
}
