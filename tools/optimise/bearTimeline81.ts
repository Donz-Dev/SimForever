/** Round 81: one Bear fight's casts, with rage, to read a late Primal Bite. RACE= SEED= UNTIL= */
import { Simulation } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import type { RaceId } from '../../src/game/character';

const base = PRESETS_BY_ID.get('druid_bear')!.build();
const profile = syncDefaultRotation({
  ...base,
  character: { ...base.character, race: (process.env.RACE ?? 'windshaper_skyborne') as RaceId },
  simulation: { ...base.simulation, durationSeconds: 120 },
});
const run = new Simulation(trainingDummyEncounter(profile, Number(process.env.SEED ?? 1))).run();
const player = run.actors.find((a) => a.kind === 'player')!.id;
const until = Number(process.env.UNTIL ?? 30) * 1000;
let rage = 0;
let lastBite = -1;
for (const e of run.telemetry as readonly any[]) {
  if (e.timestamp > until) break;
  if ((e.type === 'resource_gained' || e.type === 'resource_spent') && e.actorId === player && e.resource === 'rage') rage = e.current;
  if (e.type === 'cast' && e.sourceId === player) {
    const note = e.abilityId === 'mangle' && lastBite >= 0 ? `  (${e.timestamp - lastBite - 6000}ms after ready)` : '';
    if (e.abilityId === 'mangle') lastBite = e.timestamp;
    console.log(`${(e.timestamp / 1000).toFixed(3).padStart(8)}  ${e.abilityId.padEnd(22)} rage ${rage.toFixed(0)}${note}`);
  }
}
