/*
 * ============================================================================
 * WHAT ONE PROFILE DOES AT FOUR FIGHT LENGTHS: casts, uptimes and the pool.
 *
 *   PRESET=mage_fire npx vite-node tools/probe_clock.ts
 *   PRESET=mage_arcane LENGTHS=60,300 ITER=100 npx vite-node tools/probe_clock.ts
 *
 * ----------------------------------------------------------------------------
 * THE FIRST OF THE FOUR THINGS `docs/profile-optimisation.md` SAYS A PAIRED
 * PROBE STRUCTURALLY CANNOT FIND. Every tool in this project defaults to the
 * 60 seconds `createDefaultProfile` carries, so the clock is in the baseline
 * AND in every variant and therefore cancels -- and the owner's instruction is
 * the opposite: "rotations need to be built for longer than 1 minute ... ensure
 * that variable combat time is taken into account."
 *
 * WHAT IT ANSWERS THAT `probe_build.ts DURATION=` CANNOT. That one gives a
 * paired DELTA at one length, which is what to trust for a decision. This gives
 * the CAST COUNTS and the mana book at several lengths, which is what says
 * whether a never-fired entry is dead or merely waiting, and whether the build
 * is bound by the global cooldown or by a pool. Those are different questions
 * and the second has twice been written down as the first.
 *
 * TWO WORKED CASES, BOTH MAGES:
 *
 *   `arcane_power` fires 0.00 times at 60s and 2.00 at 240s, and was written up
 *   as a dead entry on the strength of the first figure. The owner: "the moment
 *   a combat run exceeds 3 minutes it'll want to be cast a second time."
 *
 *   `mage_fire`'s Evocation and Demonic Rune both read `<-- NEVER FIRED` at 60s
 *   and fire 1.00 and 2.02 times at 300s, because that build crosses from
 *   GLOBAL-COOLDOWN bound (2,615 mana spare) to MANA bound (196) on the way.
 *   One talent swap there measures +2.92 at 60s and **-33.76 at 300s**.
 *
 * ONE BATCH PER LENGTH, SO READ THE SHAPE AND NOT THE DECIMALS. It is a
 * diagnostic the way `probe_resources.ts` is; `probe_build.ts` is what gives an
 * interval. The DPS column in particular is a single unpaired batch and the
 * fall across lengths is much larger than its own noise, which is the only
 * reason it is printed at all.
 *
 * AURAS AT 100% UPTIME ARE OMITTED, because a raid buff list is fourteen rows
 * of 100.0% on every profile and the rows that move are the ones being read.
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfileBatch } from '../src/simulator';

const PRESET = process.env.PRESET ?? 'mage_fire';
const ITER = Number(process.env.ITER ?? 40);
const LENGTHS = (process.env.LENGTHS ?? '60,120,180,300').split(',').map(Number);

const preset = PRESETS_BY_ID.get(PRESET);
if (!preset) {
  throw new Error(
    `No preset "${PRESET}". Known ids: ${[...PRESETS_BY_ID.keys()].join(', ')}`,
  );
}

for (const seconds of LENGTHS) {
  const profile = preset.build();
  const batch = runProfileBatch({
    ...profile,
    simulation: { ...profile.simulation, iterations: ITER, durationSeconds: seconds },
  });

  /*
   * THE POOL IS SUMMED FROM THE SAME EVENT STREAM THE RESOURCE PANEL READS,
   * rather than from a counter -- `headroom` is what says which regime the
   * build is in, and `wasted` is what says it is capping instead.
   */
  const lines: string[] = [];
  for (const flow of batch.resources) {
    const gained = flow.gained.reduce((a, g) => a + g.amount, 0);
    const spent = flow.spent.reduce((a, g) => a + g.amount, 0);
    const wasted = flow.gained.reduce((a, g) => a + g.wasted, 0);
    if (gained === 0 && spent === 0) continue;
    lines.push(
      `${flow.resource} gained ${gained.toFixed(0)} spent ${spent.toFixed(0)} ` +
        `headroom ${(gained - spent).toFixed(0)} wasted ${wasted.toFixed(0)}`,
    );
  }

  console.log(
    `\n== ${seconds}s ==  ${batch.dps.mean.toFixed(1)} DPS  (${ITER} fights)` +
      (lines.length > 0 ? `\n   ${lines.join('\n   ')}` : ''),
  );
  for (const row of batch.abilities) {
    console.log(
      `   ${row.abilityName.padEnd(28)} ${row.uses.toFixed(2).padStart(7)} uses ` +
        `${row.share.toFixed(1).padStart(6)}%`,
    );
  }
  for (const row of [...batch.buffUptime, ...batch.debuffUptime]) {
    if (row.uptime >= 0.999) continue;
    console.log(
      `     [aura] ${row.auraName.padEnd(26)} ${(row.uptime * 100).toFixed(1).padStart(6)}%`,
    );
  }
}
