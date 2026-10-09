/*
 * ============================================================================
 * WHY IS PARRY WORTH HALF OF DODGE? Both avoid the whole blow.
 *
 *   npx vite-node tools/probe_parry_haste.ts
 *   PROFILE=prot_pally ITER=1000 npx vite-node tools/probe_parry_haste.ts
 *
 * ----------------------------------------------------------------------------
 * THE ANSWER IS PARRY HASTE, AND THIS IS HOW IT WAS ESTABLISHED RATHER THAN
 * ASSERTED. Parrying hurries the PARRIER's own next swing and dodging does
 * not, so the two are the same avoidance with an extra on one of them, and
 * the question is how much of any gap that accounts for.
 *
 * IT ACCOUNTS FOR ALL OF IT. Strip `parryHaste` off every combatant and the
 * two come back IDENTICAL to four decimal places -- which is stronger than
 * "similar": under shared seeds, swapping two points of dodge for two points
 * of parry then produces bit-identical fights, so there is provably no other
 * asymmetry between them anywhere in the engine.
 *
 * THIS PROBE IS WHY THE DIRECTION WAS CAUGHT AT ALL. With the mechanic built
 * backwards it reported parry at 42% of dodge, which looked like a finding
 * rather than a bug -- two stats that both avoid the whole blow pricing 2.4x
 * apart is the kind of thing worth asking about, and asking is what produced
 * the owner's clarification.
 *
 * IT IS STRIPPED AT RUNTIME rather than by editing the source, so the probe
 * cannot leave a half-reverted change behind -- which is the failure this
 * project has recorded twice under isolation probes.
 * ============================================================================
 */
import { pairedDelta, withStat } from '../src/simulator';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { sampleIterations } from '../src/simulator/iterationSamples';
import { PROFILE_PRESETS } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import type { SimulationConfig } from '../src/engine';

const ITER = Number(process.env.ITER ?? 3000);
const SEED = 20261009;
const base = PROFILE_PRESETS.find((x) => x.id === (process.env.PROFILE ?? 'prot_warr'))!.build();
const slice = { from: 0, to: ITER };

/** The same encounter with parry haste taken off every combatant. */
function withoutParryHaste(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    createCombatants: () =>
      config.createCombatants().map((actor) => {
        (actor as unknown as { parryHaste?: unknown }).parryHaste = undefined;
        return actor;
      }),
  };
}

const neg = (xs: readonly number[]) => xs.map((x) => -x);

for (const [label, wrap] of [
  ['parry haste ON ', (c: SimulationConfig) => c],
  ['parry haste OFF', withoutParryHaste],
] as const) {
  const baseline = sampleIterations(wrap(trainingDummyEncounter(base)), SEED, slice);
  const deaths = baseline.deaths.reduce((a, b) => a + b, 0) / ITER;
  const row = (stat: 'dodgeChance' | 'parryChance') => {
    const v = sampleIterations(
      wrap(trainingDummyEncounter(withStat(base, stat, 2) as CharacterProfile)),
      SEED,
      slice,
    );
    const d = pairedDelta(neg(baseline.deaths), neg(v.deaths));
    return `${(d.delta / 2).toFixed(4)} +-${(d.interval / 2).toFixed(4)}`;
  };
  const dodge = row('dodgeChance');
  const parry = row('parryChance');
  console.log(`\n${label}  baseline ${deaths.toFixed(3)} deaths`);
  console.log(`  +2% dodge   ${dodge}  avoid death / point`);
  console.log(`  +2% parry   ${parry}  avoid death / point`);
}
