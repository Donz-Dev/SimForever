/*
 * Does each Warlock demon fight, and what does it inherit?
 *
 *   npx vite-node tools/probe_demons.ts
 *
 * Runs the two Warlock presets with each demon summoned, prints the demon's
 * stats as built, its damage rows, and the sacrifice buff the Warlock carries --
 * so "the Imp is out and the Shadow sacrifice still stands" is a line to read
 * rather than an assumption.
 */
import { PRESETS_BY_ID } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { runProfileBatch } from '../src/simulator';
import { Simulation } from '../src/engine';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';

const CASES: readonly { preset: string; summoned?: string; extra?: Record<string, number> }[] = [
  { preset: 'warlock_firelock' },
  { preset: 'warlock_firelock', summoned: 'imp' },
  { preset: 'warlock_smds' },
  { preset: 'warlock_smds', summoned: 'succubus' },
];

for (const c of CASES) {
  const base = PRESETS_BY_ID.get(c.preset)!.build();
  const profile: CharacterProfile = {
    ...base,
    character: { ...base.character, ...(c.summoned ? { summonedDemon: c.summoned } : {}) },
    talents: { ...base.talents, ...(c.extra ?? {}) },
    simulation: { ...base.simulation, iterations: 30, seed: 7 },
  };
  const batch = runProfileBatch(profile);
  console.log(`\n== ${c.preset}${c.summoned ? ' + ' + c.summoned : ''}   ${batch.dps.mean.toFixed(1)} DPS`);

  const sim = new Simulation(trainingDummyEncounter(profile, 7));
  sim.begin();
  const demon = sim.combatants.find((a) => a.kind === 'pet');
  const player = sim.combatants.find((a) => a.kind === 'player')!;
  if (demon) {
    const s = demon.stats.effective;
    console.log(
      `   demon ${demon.name}: spellPower ${s.spellPower.toFixed(1)}  AP ${s.attackPower.toFixed(1)}  ` +
        `hit ${s.hitChance.toFixed(2)}  spellCrit ${s.spellCritChance.toFixed(2)}  meleeCrit ${s.critChance.toFixed(2)}`,
    );
  }
  console.log(
    `   warlock spellPower ${player.stats.effective.spellPower.toFixed(1)}  auras: ` +
      ['demonic_sacrifice_imp', 'demonic_sacrifice_succubus'].filter((id) => player.auras.has(id)).join(', '),
  );
  for (const row of batch.abilities.slice(0, 8)) {
    console.log(`     ${row.abilityName.padEnd(28)} ${row.uses.toFixed(1).padStart(5)} uses  ${row.share !== undefined ? (row.share * 100).toFixed(1) + '%' : ''}`);
  }
}
