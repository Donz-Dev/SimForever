/*
 * ============================================================================
 * A TANK'S BLOCK CHAIN, LINK BY LINK.
 *
 *   npx vite-node tools/probe_block.ts
 *
 * ----------------------------------------------------------------------------
 * WHY IT EXISTS. "I expected four extra attacks from Reckoning and I see two"
 * is a question about five separate numbers -- base block chance, Holy Shield's
 * +20%, Redoubt's +30%, how often the boss actually connects, and Reckoning's
 * own 40% -- and NO SINGLE FIGURE IN THE APP ANSWERS IT. Each link can be right
 * while the total looks wrong, and a count of 3.3 expected events comes back as
 * 2 in a single fight often enough to look broken.
 *
 * SO IT PRINTS THE RESOLVED TABLE CHANCE IN EACH STATE, which is the only way
 * to see a stat and a buff and a proc as three separate contributions rather
 * than as one number.
 *
 * AND IT COUNTS EXTRA ATTACKS BY DIFFING A RUN AGAINST ONE WITHOUT THE TALENT,
 * because an extra attack emits NO TELEMETRY OF ITS OWN -- it is an ordinary
 * main-hand swing by the time anything can see it. That is also why the answer
 * has to be a mean over many fights rather than a number read off one.
 *
 * ONE BATCH PER SIDE AND NO INTERVAL: this is a diagnostic, not a measurement.
 * `measure_profiles.ts` is the harness that gives a REAL/noise verdict.
 * ============================================================================
 */
import { Simulation } from '../src/engine';
import type { TelemetryEvent } from '../src/engine';
import { PROFILE_PRESETS } from '../src/profiles';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { characterAtCombatStart } from '../src/simulator/characterAtCombatStart';
import { HOLY_SHIELD, redoubtAura } from '../src/game/auras/paladin';
import { toPercent } from '../src/engine';

const preset = PROFILE_PRESETS.find((p) => p.id === 'prot_pally')!;
const base = preset.build();

const ITERATIONS = 40;

interface Counts {
  blocks: number;
  critsTaken: number;
  landed: number;
  hits: number;
  swings: number;
  redoubts: number;
  holyShield: number;
  casts: Map<string, number>;
  order: string[];
}

function run(profile: typeof base): Counts {
  const out: Counts = {
    blocks: 0,
    critsTaken: 0,
    landed: 0,
    hits: 0,
    swings: 0,
    redoubts: 0,
    holyShield: 0,
    casts: new Map(),
    order: [],
  };

  for (let i = 0; i < ITERATIONS; i += 1) {
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(trainingDummyEncounter(profile, 1000 + i), {
      emit: (e: TelemetryEvent) => events.push(e),
    });
    simulation.run();
    const player = simulation.combatants.find((c) => c.kind === 'player')!;

    for (const event of events) {
      if (event.type === 'damage') {
        if (event.targetId === player.id && !event.periodic) {
          out.hits += 1;
          if (event.amount > 0) out.landed += 1;
          if (event.outcome === 'block') out.blocks += 1;
          if (event.outcome === 'crit') out.critsTaken += 1;
        }
        if (event.sourceId === player.id && event.abilityName === 'Main Hand Auto-Attack') {
          out.swings += 1;
        }
        if (event.sourceId === player.id && event.abilityId === 'holy_shield') out.holyShield += 1;
      }
      if (event.type === 'aura_applied' && event.auraId === 'redoubt') out.redoubts += 1;
      if (event.type === 'cast') {
        out.casts.set(event.abilityId, (out.casts.get(event.abilityId) ?? 0) + 1);
        if (i === 0) out.order.push(`${(event.timestamp / 1000).toFixed(1)}s ${event.abilityId}`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- the chances

const config = trainingDummyEncounter(base, 1);
const simulation = new Simulation(config);
const player = simulation.combatants.find((c) => c.kind === 'player')!;
const boss = simulation.combatants.find((c) => c.kind !== 'player')!;

const blockChance = () =>
  toPercent(simulation.attackChances('melee-received', boss, player, {}).block);

console.log('BLOCK CHANCE AS THE TABLE RESOLVES IT');
console.log(`  base (stat ${player.stats.get('blockChance').toFixed(1)}, defense ${player.stats.get('defenseSkill').toFixed(0)})  ${blockChance().toFixed(2)}%`);
simulation.applyAura(player, HOLY_SHIELD, player.id);
console.log(`  + Holy Shield                             ${blockChance().toFixed(2)}%`);
simulation.applyAura(player, redoubtAura(30), player.id);
console.log(`  + Redoubt at 5/5                          ${blockChance().toFixed(2)}%`);

// ------------------------------------------------------------ the measurement

const withTalent = run(base);
const without = run({
  ...base,
  talents: { ...base.talents, reckoning: 0 },
});

const per = (n: number) => n / ITERATIONS;
const sheet = characterAtCombatStart(base)!;
const swingMs = sheet.weapons.mainHand?.swingTimerMs ?? 0;

console.log(`\nPER FIGHT, mean of ${ITERATIONS}  (${base.simulation.durationSeconds}s, ${swingMs}ms weapon)`);
console.log(`  attacks taken            ${per(withTalent.hits).toFixed(2)}`);
console.log(
  `  of which BLOCKED         ${per(withTalent.blocks).toFixed(2)}   ` +
    `(${((withTalent.blocks / withTalent.hits) * 100).toFixed(1)}% of what landed)`,
);
console.log(`  Redoubt applications     ${per(withTalent.redoubts).toFixed(2)}`);
console.log(`  Holy Shield hits         ${per(withTalent.holyShield).toFixed(2)}`);
console.log(`  main-hand swings         ${per(withTalent.swings).toFixed(2)}`);
console.log(`  ...with reckoning 0/5    ${per(without.swings).toFixed(2)}`);
console.log(
  `  => RECKONING IS WORTH    ${(per(withTalent.swings) - per(without.swings)).toFixed(2)} extra swings a fight`,
);
console.log(
  `     expected from blocks  ${(per(withTalent.blocks) * 0.4).toFixed(2)}  (40% of ${per(withTalent.blocks).toFixed(2)})`,
);
console.log(
  `     + expected from crits ${per(withTalent.critsTaken).toFixed(2)}  (100% of ${per(withTalent.critsTaken).toFixed(2)} crits taken)`,
);
console.log(
  `     = EXPECTED TOTAL      ${(per(withTalent.blocks) * 0.4 + per(withTalent.critsTaken)).toFixed(2)}`,
);
console.log(`  attacks that LANDED      ${per(withTalent.landed).toFixed(2)}  (of ${per(withTalent.hits).toFixed(2)} swung)`);

console.log('\nCASTS PER FIGHT');
for (const [id, n] of [...withTalent.casts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(id).padEnd(24)} ${per(n).toFixed(2)}`);
}

console.log('\nFIRST FIGHT, cast order (first 16)');
for (const line of withTalent.order.slice(0, 16)) console.log(`  ${line}`);
