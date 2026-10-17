/*
 * ============================================================================
 * WHAT A LONGER FIGHT DOES TO ONE PROFILE: the pool it is bound by, and the
 * cast count of every ability its list reaches.
 *
 * THIS IS THE FIRST OF THE FOUR THINGS A PAIRED PROBE STRUCTURALLY CANNOT SEE.
 * `docs/profile-optimisation.md` names them: the fight length is in the
 * baseline AND in every variant, so it cancels and becomes invisible. Every
 * profile carries `durationSeconds: 60`, and a minute is shorter than several
 * of the cooldowns a list holds -- so at the default length such an ability is
 * cast once whatever the list says, and any conclusion about where it belongs
 * is a conclusion about the clock.
 *
 * TWO QUESTIONS, AND NOTHING ELSE HERE ANSWERS EITHER:
 *
 *   1. WHAT BINDS THE BUILD, at each length. `probe_resources.ts` answers this
 *      at 60s only. The Arcane Mage is global-cooldown bound at 60s with 2,638
 *      mana spare and MANA bound by 300s -- a different optimisation problem
 *      wearing the same name, and it made three "settled" answers on that
 *      profile answers about a one-minute clock.
 *
 *   2. WHETHER A NEVER-FIRED ENTRY IS DEAD OR MERELY WAITING. That is the
 *      eighth cause of a never-fired entry and the only one a different clock
 *      makes disappear: Mage Armor is a thirty-minute buff and no fight length
 *      brings it back, where `arcane_power` is a three-minute cooldown that
 *      fires 0.00 times at 60s and 2.00 at 240s. The two read identically in
 *      the uses column and are opposites. The owner caught that one as a
 *      write-up error.
 *
 * `probe_build.ts DURATION=` applies a length to a VARIANT SWEEP and prints
 * DPS; it prints neither the pool nor the cast counts, which are the two
 * things this question is actually about.
 *
 *   PROFILE=shadow_priest npx vite-node tools/probe_fight_length.ts
 *   PROFILE=mage_arcane LENGTHS=60,180,300 ITERATIONS=200 npx vite-node tools/probe_fight_length.ts
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfileBatch } from '../src/simulator';

const PROFILE = process.env.PROFILE ?? 'shadow_priest';
const ITERATIONS = Number(process.env.ITERATIONS ?? 120);
const SEED = Number(process.env.SEED ?? 20260101);
const LENGTHS = (process.env.LENGTHS ?? '60,120,180,300').split(',').map((s) => Number(s.trim()));

const preset = PRESETS_BY_ID.get(PROFILE);
if (!preset) throw new Error(`no preset "${PROFILE}"`);

console.log(`\n==== ${PROFILE} -- ${preset.detail} ====`);
console.log(`${ITERATIONS} iterations a length, seed ${SEED}\n`);

/*
 * THE NAME IS THE JOIN, because `BatchAbilityTotals` is keyed by ability NAME
 * and not by id -- a row is pooled by name so that a proc sharing one merges
 * into it. So the cast counts below are printed in the batch's own order
 * rather than the list's.
 */
for (const durationSeconds of LENGTHS) {
  const base = preset.build();
  const profile = {
    ...base,
    simulation: { ...base.simulation, durationSeconds, iterations: ITERATIONS, seed: SEED },
  };
  const batch = runProfileBatch(profile);

  const pools = batch.resources
    .map((flow) => {
      const unspent = flow.totalGained - flow.totalSpent;
      const pct = flow.totalGained > 0 ? (unspent / flow.totalGained) * 100 : 0;
      return (
        `${flow.resource} gained ${flow.totalGained.toFixed(0)} spent ` +
        `${flow.totalSpent.toFixed(0)} unspent ${unspent.toFixed(0)} (${pct.toFixed(1)}%)` +
        (flow.totalWasted > 0 ? ` WASTED ${flow.totalWasted.toFixed(0)}` : '')
      );
    })
    .join('\n       ');

  console.log(`== ${String(durationSeconds).padStart(4)}s ==  ${batch.dps.mean.toFixed(1)} DPS`);
  console.log(`       ${pools}`);

  /*
   * EVERY CAST ROW, including the zeros. A zero is the finding here -- and an
   * entry that goes from 1.00 to 2.00 between two lengths is the opposite of
   * a dead one, which is the distinction this whole tool exists for.
   */
  for (const row of [...batch.abilities].sort((a, b) => b.uses - a.uses)) {
    if (row.uses === 0 && row.damage === 0) continue;
    console.log(`         ${row.abilityName.padEnd(28)} ${row.uses.toFixed(2).padStart(6)} casts`);
  }
  console.log('');
}
