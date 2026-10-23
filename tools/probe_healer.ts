/**
 * Both healer fights for one profile, in brief (round 52).
 *
 *   npx vite-node tools/probe_healer.ts
 *   PROFILE=holy_pal ITER=100 npx vite-node tools/probe_healer.ts
 */
import { runHealerBatch, resourceFlowOf } from '../src/simulator';
import { PRESETS_BY_ID } from '../src/profiles/presets';

const id = process.env.PROFILE ?? 'holy_pal';
const iterations = Number(process.env.ITER ?? 50);
const base = PRESETS_BY_ID.get(id)!.build();
const profile = { ...base, simulation: { ...base.simulation, iterations } };

for (const fight of ['tank', 'raid'] as const) {
  const batch = runHealerBatch(profile, fight);
  const mana = resourceFlowOf(batch, 'mana');
  console.log(
    `\n${fight.toUpperCase()} HEALER  HPS ${batch.hps.mean.toFixed(1)} +/- ${batch.hps.standardDeviation.toFixed(1)}` +
      `  TPS ${batch.tps.mean.toFixed(1)}  healing power ${batch.stats?.healingPower.toFixed(0)}` +
      `  haste ${(((batch.stats?.hasteMultiplier ?? 1) - 1) * 100).toFixed(2)}%` +
      `  allied deaths ${batch.alliedDeaths.toFixed(2)}  mana gained ${mana.totalGained.toFixed(0)} spent ${mana.totalSpent.toFixed(0)}`,
  );
  for (const row of batch.healing) {
    console.log(
      `  ${row.abilityName.padEnd(16)} ${row.uses.toFixed(1).padStart(6)} casts  ${row.healing.toFixed(0).padStart(7)} healed` +
        `  ${(100 * row.share).toFixed(1).padStart(5)}%  crit ${(100 * row.critRate).toFixed(1)}%  overheal ${(100 * row.overhealRate).toFixed(1)}%`,
    );
  }
}
