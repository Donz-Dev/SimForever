/*
 * The full results page for one Shockadin profile: damage table, buff uptimes,
 * resource flow and the character sheet.
 *
 *   PRESET=pally_shockadin_2h npx vite-node tools/probe_shockadin_report.ts
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfileBatch, characterAtCombatStart } from '../src/simulator';

const PRESET = process.env.PRESET ?? 'pally_shockadin_2h';
const ITER = Number(process.env.ITER ?? 100);

const preset = PRESETS_BY_ID.get(PRESET)!.build();
const profile = { ...preset, simulation: { ...preset.simulation, iterations: ITER } };
const batch = runProfileBatch(profile);

const character = characterAtCombatStart(profile);
const s = character!.stats.effective as unknown as Record<string, number>;
const n = (v: number | undefined, d = 0) => (v ?? 0).toFixed(d);
console.log(`\n==== ${PRESET} ====`);
console.log(
  `str ${n(s.strength)}  agi ${n(s.agility)}  int ${n(s.intellect)}  sta ${n(s.stamina)}  spi ${n(s.spirit)}`,
);
console.log(
  `AP ${n(s.attackPower)}  SP ${n(s.spellPower)}  crit ${n(s.critChance, 2)}%  spellCrit ${n(s.spellCritChance, 2)}%  ` +
    `hit ${n(s.hitChance, 2)}%  hasteRating ${n(s.hasteRating)}`,
);
console.log(`\nDPS ${batch.dps.mean.toFixed(1)} +/- ${(batch.dps.max - batch.dps.min).toFixed(0)} range\n`);

console.log('-- damage --');
for (const row of batch.abilities) {
  console.log(
    `  ${row.abilityName.padEnd(28)} ${row.share.toFixed(1).padStart(5)}%  uses ${row.uses.toFixed(2).padStart(6)}` +
      `  attempts ${row.attempts.toFixed(1).padStart(6)}  avg ${row.average.toFixed(0).padStart(6)}` +
      `  crit ${(row.critRate * 100).toFixed(1).padStart(5)}%  avoid ${(row.avoidRate * 100).toFixed(1).padStart(5)}%`,
  );
}

console.log('\n-- buff uptime --');
for (const row of batch.buffUptime) {
  console.log(`  ${row.auraName.padEnd(32)} ${(row.uptime * 100).toFixed(1).padStart(6)}%`);
}
console.log('\n-- debuff uptime --');
for (const row of batch.debuffUptime) {
  console.log(`  ${row.auraName.padEnd(32)} ${(row.uptime * 100).toFixed(1).padStart(6)}%`);
}

console.log('\n-- resources --');
for (const flow of batch.resources) {
  console.log(`  [${flow.resource}]`);
  for (const row of flow.gained) {
    console.log(`     + ${row.sourceName.padEnd(28)} ${row.amount.toFixed(0).padStart(6)}  wasted ${row.wasted.toFixed(0)}`);
  }
  for (const row of flow.spent) {
    console.log(`     - ${row.sourceName.padEnd(28)} ${row.amount.toFixed(0).padStart(6)}`);
  }
}
