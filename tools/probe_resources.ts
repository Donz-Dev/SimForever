/*
 * ============================================================================
 * WHERE ONE PROFILE'S RESOURCE WENT, on the command line.
 *
 *   npx vite-node tools/probe_resources.ts
 *   PROFILE=pally_ret RESOURCE=mana npx vite-node tools/probe_resources.ts
 *
 * ----------------------------------------------------------------------------
 * WHY IT EXISTS WHEN THE RESOURCE PANEL ALREADY SHOWS THIS. Because the
 * question it answers is asked while reading a priority list, and the answer
 * decides whether a never-fired entry is a list bug or an economy. Hammer of
 * Wrath is the worked case twice over: its silence was first explained as "the
 * target never drops below 20% health", which was wrong and is written up in
 * docs/ability-audit.md -- and the thing that actually settled it was the mana
 * book. Retribution gains 4101 and spends 4023, so a 255-mana ability that only
 * becomes legal in the last fifth of the fight arrives with 78 mana of headroom.
 *
 * AND IT SURVIVES THE SESSION THAT WROTE IT, which is the standing complaint in
 * HANDOVER.md: every baseline in this project was once produced by a throwaway
 * script that was then deleted, so no published figure could be reproduced by
 * the person who measured it. A figure quoted from this is re-derivable.
 *
 * ONE BATCH, SO READ THE SHAPE AND NOT THE DECIMALS. It is a diagnostic, not a
 * measurement -- `measure_profiles.ts` is the harness that gives an interval.
 * ============================================================================
 */
import { runProfileBatch, resourceFlowOf } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';

const profileId = process.env.PROFILE ?? 'pally_ret';
const resource = process.env.RESOURCE ?? 'mana';
const ITERATIONS = Number(process.env.ITERATIONS ?? 30);

const preset = PROFILE_PRESETS.find((p) => p.id === profileId);
if (!preset) {
  throw new Error(
    `No preset "${profileId}". Known ids: ${PROFILE_PRESETS.map((p) => p.id).join(', ')}`,
  );
}

const profile = preset.build();
const batch = runProfileBatch({
  ...profile,
  simulation: { ...profile.simulation, iterations: ITERATIONS },
});
const flow = resourceFlowOf(batch, resource);

console.log(`${preset.label}  ${batch.dps.mean.toFixed(1)} DPS  (${ITERATIONS} iterations)`);
console.log(
  `\n${resource}: gained ${flow.totalGained.toFixed(0)}  ` +
    `spent ${flow.totalSpent.toFixed(0)}  wasted ${flow.totalWasted.toFixed(0)}  ` +
    `headroom ${(flow.totalGained - flow.totalSpent).toFixed(0)}`,
);

if (flow.gained.length === 0 && flow.spent.length === 0) {
  console.log(`\n  Nothing gained or spent. Does this profile use ${resource}?`);
}

if (flow.gained.length > 0) {
  console.log('\n  GAINED');
  for (const row of flow.gained) {
    console.log(`    ${row.sourceName.padEnd(30)} ${row.amount.toFixed(0)}`);
  }
}
if (flow.spent.length > 0) {
  console.log('\n  SPENT');
  for (const row of flow.spent) {
    console.log(`    ${row.sourceName.padEnd(30)} ${row.amount.toFixed(0)}`);
  }
}

console.log('\n  USES AND DAMAGE');
for (const row of batch.abilities) {
  console.log(
    `    ${row.abilityName.padEnd(30)} ${row.uses.toFixed(1)} uses  ` +
      `${row.damage.toFixed(0)} damage`,
  );
}
