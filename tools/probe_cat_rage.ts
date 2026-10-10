/**
 * Does a Cat Form Druid's rage pool ever hold anything?
 *
 * Asked because a comment on the Mighty Rage Potion asserted that "Cat Form has
 * an energy pool and no rage, so `grantResource` finds nothing" -- and
 * `resourceSpecsFor` keys pools by CLASS rather than by form, so a Druid owns a
 * rage pool in every one of them. The claim was specific, mechanical, plausible
 * and wrong, which is this project's own worked example of a prediction in a
 * comment being a measurement that has not happened.
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch, resourceFlowOf } from '../src/simulator';

const CAT = PRESETS_BY_ID.get('druid_cat')!;
const profile = CAT.build();
const batch = runProfileBatch({
  ...profile,
  simulation: { ...profile.simulation, iterations: 20, seed: 12345 },
});

console.log('Cat Druid, 20 fights\n');
for (const resource of ['rage', 'energy', 'mana'] as const) {
  const flow = resourceFlowOf(batch, resource);
  console.log(
    '%s  gained %s  spent %s  wasted %s',
    resource.padEnd(7),
    flow.totalGained.toFixed(1).padStart(9),
    flow.totalSpent.toFixed(1).padStart(9),
    flow.totalWasted.toFixed(1).padStart(9),
  );
}

console.log('\nsources of rage, if any:');
const rage = resourceFlowOf(batch, 'rage');
for (const source of rage.gained) {
  console.log('  %s  %s', source.sourceName.padEnd(28), source.amount.toFixed(1));
}
if (rage.gained.length === 0) console.log('  (none)');
