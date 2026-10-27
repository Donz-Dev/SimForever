/**
 * Round 81: the Bear race question, read off the event stream rather than
 * differenced. Per race: Primal Bite casts and how late each comes after its
 * cooldown, rage by source, blows taken and dodged.
 *
 *   SEEDS=200 npx vite-node tools/optimise/bearRaceMechanism81.ts
 */
import { Simulation } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import type { RaceId } from '../../src/game/character';

const SEEDS = Number(process.env.SEEDS ?? 200);
const base = PRESETS_BY_ID.get('druid_bear')!.build();

for (const race of ['windshaper_skyborne', 'tauren'] as RaceId[]) {
  const profile = syncDefaultRotation({
    ...base,
    character: { ...base.character, race },
    simulation: { ...base.simulation, durationSeconds: 120 },
  });
  const hist: Record<string, number> = {};
  let bites = 0, lateMs = 0, lateCount = 0, lacerates = 0, hitsTaken = 0, dodged = 0, parried = 0;
  const rage: Record<string, number> = {};
  const blockedBy: Record<string, number> = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const run = new Simulation(trainingDummyEncounter(profile, seed)).run();
    const player = run.actors.find((a) => a.kind === 'player')!.id;
    let lastBite = -1;
    const casts: { t: number; id: string }[] = [];
    for (const e of run.telemetry as readonly any[]) {
      if (e.type === 'cast' && e.sourceId === player) {
        casts.push({ t: e.timestamp, id: e.abilityId });
        if (e.abilityId === 'mangle') {
          bites++;
          if (lastBite >= 0) {
            const late = e.timestamp - lastBite - 6000;
            if (late >= 0) { lateMs += late; lateCount++; const b = late < 100 ? '<0.1s' : late < 500 ? '<0.5s' : late < 1500 ? '<1.5s' : late < 3000 ? '<3s' : late < 6000 ? '<6s' : '6s+'; hist[b] = (hist[b] ?? 0) + 1; }
          }
          lastBite = e.timestamp;
        }
        if (e.abilityId === 'lacerate') lacerates++;
      }
      if (e.type === 'resource_gained' && e.actorId === player && e.resource === 'rage') {
        const k = String(e.source ?? 'unattributed');
        rage[k] = (rage[k] ?? 0) + e.amount;
      }
      if (e.type === 'damage' && e.targetId === player && !e.periodic) {
        if (e.outcome === 'dodge') dodged++;
        else if (e.outcome === 'parry') parried++;
        else if (e.amount > 0) hitsTaken++;
      }
    }
    // what was cast in the 1.5s before each bite that came late
    for (let i = 1; i < casts.length; i++) {
      if (casts[i].id !== 'mangle') continue;
      const prev = casts[i - 1];
      if (casts[i].t - prev.t <= 1500) blockedBy[prev.id] = (blockedBy[prev.id] ?? 0) + 1;
    }
  }
  const per = (n: number) => (n / SEEDS).toFixed(2);
  console.log(`\n${race}`);
  console.log(`  Primal Bite ${per(bites)}  mean late ${(lateMs / Math.max(1, lateCount)).toFixed(0)}ms  Lacerate ${per(lacerates)}`);
  console.log(`  lateness: ${['<0.1s','<0.5s','<1.5s','<3s','<6s','6s+'].map((k) => `${k} ${per(hist[k] ?? 0)}`).join(', ')}`);
  console.log(`  blows taken ${per(hitsTaken)}  dodged ${per(dodged)}  parried ${per(parried)}`);
  console.log(`  rage by source: ${Object.entries(rage).map(([k, v]) => `${k} ${per(v)}`).join(', ')}`);
  console.log(`  cast just before a bite: ${Object.entries(blockedBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${per(v)}`).join(', ')}`);
}
