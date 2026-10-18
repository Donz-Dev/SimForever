/*
 * ============================================================================
 * ONE PROFILE AT SEVERAL FIGHT LENGTHS, with the cast counts and the mana book
 * beside each.
 *
 *   npx vite-node tools/probe_clock.ts
 *   PROFILE=shaman_elemental LENGTHS=60,180,300 npx vite-node tools/probe_clock.ts
 *
 * ----------------------------------------------------------------------------
 * THE CLOCK IS THE ONE AXIS A PAIRED PROBE CANNOT SEE, which is why this is a
 * tool and not a scratch script. Every profile carries `durationSeconds: 60`,
 * so the length is in the baseline AND in every variant and cancels in the
 * difference -- `docs/profile-optimisation.md`'s "What the loop cannot find".
 *
 * TWO THINGS ONLY IT ANSWERS:
 *
 *   WHICH POOL BINDS. The Arcane Mage is global-cooldown bound at 60s with
 *   2,638 mana spare and MANA bound by 300s, which is a different optimisation
 *   problem wearing the same name. `headroom` as a SHARE of what was gained is
 *   the reading, because the absolute figure grows with the fight.
 *
 *   WHETHER A NEVER-FIRED ENTRY IS DEAD. An ability whose cooldown is longer
 *   than the fight is cast once whatever the list says, so its entry can never
 *   be reached again -- and that is a fact about the clock, not about the list.
 *   The owner caught exactly that write-up error: "arcane power being pre-cast
 *   doesn't remove it from the main combat APL because the moment a combat run
 *   exceeds 3 minutes it'll want to be cast a second time." Mage Armor at
 *   THIRTY minutes reads identically in the uses column and is genuinely dead.
 *
 * `DURATION=` on `probe_build.ts` already applies a length to the baseline and
 * every variant alike; what it does not print is the cast counts, which are the
 * whole point here.
 *
 * ONE BATCH PER LENGTH, SO READ THE SHAPE AND NOT THE DECIMALS. A diagnostic
 * like `probe_resources.ts`, not a measurement -- nothing here carries an
 * interval and no figure from it belongs in a baseline.
 * ============================================================================
 */
import { runProfileBatch, resourceFlowOf } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';
import type { ResourceType } from '../src/engine';

const profileId = process.env.PROFILE ?? 'shaman_elemental';
const resource = (process.env.RESOURCE ?? 'mana') as ResourceType;
const ITERATIONS = Number(process.env.ITERATIONS ?? 40);
const LENGTHS = (process.env.LENGTHS ?? '60,120,180,300')
  .split(',')
  .map((s) => Number(s.trim()));

const preset = PROFILE_PRESETS.find((p) => p.id === profileId);
if (!preset) {
  throw new Error(
    `No preset "${profileId}". Known ids: ${PROFILE_PRESETS.map((p) => p.id).join(', ')}`,
  );
}

console.log(`${preset.label}  (${preset.id})  --  ${ITERATIONS} iterations per length\n`);

for (const seconds of LENGTHS) {
  const profile = preset.build();
  const batch = runProfileBatch({
    ...profile,
    /*
     * `simulation.durationSeconds`, NOT `encounter.durationSeconds`. The first
     * draft of this tool wrote the second -- a field that does not exist -- and
     * every one of four lengths came back IDENTICAL TO THE DECIMAL, which is
     * this project's own tell for a patch that did not apply rather than for a
     * change worth nothing. `trainingDummyEncounter` reads the simulation block.
     */
    simulation: {
      ...profile.simulation,
      iterations: ITERATIONS,
      durationSeconds: seconds,
    },
  });
  const flow = resourceFlowOf(batch, resource);
  const headroom = flow.totalGained - flow.totalSpent;
  const share = flow.totalGained === 0 ? 0 : (headroom / flow.totalGained) * 100;

  console.log(
    `== ${String(seconds).padStart(4)}s ==  ${batch.dps.mean.toFixed(1)} DPS` +
      `   ${resource}: gained ${flow.totalGained.toFixed(0)}` +
      `  spent ${flow.totalSpent.toFixed(0)}` +
      `  headroom ${headroom.toFixed(0)} (${share.toFixed(1)}%)`,
  );
  for (const row of batch.abilities) {
    if (row.uses === 0 && row.damage === 0) continue;
    console.log(
      `     ${row.abilityName.padEnd(30)} ${row.uses.toFixed(2).padStart(6)} uses` +
        `  ${row.damage.toFixed(0).padStart(7)} damage`,
    );
  }
  /*
   * THE UPTIMES, BECAUSE A MAINTENANCE ENTRY IS THE FIRST THING A LONGER FIGHT
   * BREAKS. A debuff held up by an "if not active" entry needs a free global
   * cooldown and a free pool to be re-applied, and a build that has run dry has
   * neither -- so its uptime falls with the clock while the CAST COUNT above
   * still rises. Only the pair reads correctly.
   */
  const held = [...batch.buffUptime, ...batch.debuffUptime].filter(
    (row) => row.uptime < 0.999,
  );
  if (held.length > 0) {
    console.log('     -- not up all fight --');
    for (const row of held) {
      console.log(`     ${row.auraName.padEnd(30)} ${(row.uptime * 100).toFixed(1)}%`);
    }
  }
  console.log('');
}
