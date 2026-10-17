/*
 * The full results page for one Shockadin profile: damage table, buff uptimes,
 * resource flow and the character sheet.
 *
 *   PRESET=pally_shockadin_2h npx vite-node tools/probe_profile_report.ts
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfileBatch, characterAtCombatStart } from '../src/simulator';
import { critChanceFrom, spellCritChanceFrom } from '../src/engine';

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
/*
 * ============================================================================
 * THROUGH `critChanceFrom` AND `spellCritChanceFrom`, NOT OFF THE STAT.
 *
 * These two rows read `stats.critChance` and `stats.spellCritChance` directly,
 * and `critRating` is the OTHER HALF of both -- Forever grants crit as a rating
 * and those functions are the only place the division by 14 lives. So on every
 * profile that wears Forever gear this line was short by `rating / 14` in both
 * columns: the Fire Mage printed 3.00% melee and 10.82% spell where the engine
 * rolls 14.00% and 21.82%.
 *
 * IT IS THE SAME BUG THE OWNER CAUGHT IN `CharacterSheetPanel` -- "if the
 * character sheet is saying 10.82% it's likely missing proper calculation" --
 * and that panel was fixed while this tool was not. A FIX IS NOT LANDED UNTIL
 * EVERY READER OF THE SAME STAT HAS IT, which is this project's own rule about
 * a join that is missing in one place being worth grepping for in all of them.
 *
 * AND IT IS WORSE HERE THAN IN A PANEL, because this tool is Step 1 of
 * `docs/profile-optimisation.md`: the line a round reads to decide whether to
 * buy crit was the one line understating it.
 *
 * THE NEIGHBOURS WERE ALWAYS RIGHT, which is what made it invisible. Spell
 * power and the haste rating go through the engine's own functions or are
 * printed as the rating they are; crit was the one stat read raw.
 * ============================================================================
 */
const stats = character!.stats.effective;
console.log(
  `AP ${n(s.attackPower)}  SP ${n(s.spellPower)}  ` +
    `crit ${n(critChanceFrom(stats) * 100, 2)}%  ` +
    `spellCrit ${n(spellCritChanceFrom(stats) * 100, 2)}%  ` +
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
