/**
 * Round 82: read the owner's saved profiles against today's rules before
 * turning them into presets. FILES=a.json,b.json
 */
import { readFileSync } from 'node:fs';
import { Simulation } from '../../src/engine';
import { parseProfile } from '../../src/profiles/serialization';
import { withSection } from '../../src/profiles/aplSections';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalAllocation } from '../../src/game/talents/talentRules';
import { enchantsForSlot } from '../../src/game/items/itemData';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import type { CharacterProfile } from '../../src/profiles';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { runProfileBatch } from '../../src/simulator';

function casts(profile: CharacterProfile, targets: number, seconds: number, seeds = 20) {
  const p = {
    ...profile,
    simulation: { ...profile.simulation, durationSeconds: seconds },
    encounter: { ...profile.encounter, numberOfTargets: targets },
  };
  const count: Record<string, number> = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const run = new Simulation(trainingDummyEncounter(p, seed)).run();
    const player = run.actors.find((a) => a.kind === 'player')!.id;
    for (const e of run.telemetry as readonly any[]) {
      if (e.type === 'cast' && e.sourceId === player) count[e.abilityId] = (count[e.abilityId] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, +(v / seeds).toFixed(2)]));
}

const sources = [
  ...(process.env.FILES ?? '').split(',').filter(Boolean).map((file) => ({ file, json: readFileSync(file, 'utf8') })),
  ...(process.env.PRESETS ?? '').split(',').filter(Boolean).map((id) => ({ file: id, json: JSON.stringify(PRESETS_BY_ID.get(id)!.build()) })),
];
for (const { file, json } of sources) {
  console.log(`\n===== ${file}`);
  const result = parseProfile(json);
  if (!result.ok) {
    console.log('  LOAD FAILED', JSON.stringify(result.issues));
    continue;
  }
  const profile = result.profile;
  console.log(`  loaded; warnings: ${JSON.stringify((result as any).warnings ?? (result as any).issues ?? [])}`);
  const tree = talentsForClass(profile.character.characterClass)!;
  const legal = legalAllocation(tree, profile.talents);
  const split = tree.trees.map((t: any) => t.talents.reduce((s: number, x: any) => s + (profile.talents[x.id] ?? 0), 0));
  const unknown = Object.keys(profile.talents).filter((id) => !tree.trees.some((t: any) => t.talents.some((x: any) => x.id === id)));
  console.log(`  talents ${split.join('/')} (= ${split.reduce((a, b) => a + b, 0)}), dropped ${JSON.stringify(legal.dropped)}, unknown ${JSON.stringify(unknown)}`);
  for (const [slot, eq] of Object.entries(profile.equipment) as [string, any][]) {
    if (eq?.enchantId === undefined) continue;
    const ok = enchantsForSlot(slot as never).some((e) => e.id === eq.enchantId);
    if (!ok) console.log(`  ILLEGAL ENCHANT ${eq.enchantId} on ${slot}`);
  }
  console.log(`  consumables ${JSON.stringify(profile.consumables)}`);
  const listIds = (entries: readonly any[]) => entries.filter((e) => !e.disabled).map((e) => e.abilityId);
  const st = listIds(profile.rotation.entries);
  const stCasts = casts(profile, 1, 120);
  console.log(`  ST list: ${st.join(', ')}`);
  console.log(`  ST casts 1T/120s: ${JSON.stringify(stCasts)}`);
  const dps = (targets: number, seconds: number) =>
    runProfileBatch({ ...profile, simulation: { ...profile.simulation, durationSeconds: seconds, iterations: 200 }, encounter: { ...profile.encounter, numberOfTargets: targets } }).dps.mean.toFixed(1);
  console.log(`  DPS 1T/120 ${dps(1, 120)}  3T/60 ${dps(3, 60)}  5T/60 ${dps(5, 60)}  8T/30 ${dps(8, 30)}`);
  console.log(`  ST never cast: ${JSON.stringify(st.filter((id) => !stCasts[id]))}`);
  if (profile.multiTarget) {
    const multi = withSection(profile, 'multi');
    const mt = listIds(multi.rotation.entries);
    const mtCasts = casts(profile, 5, 60);
    console.log(`  MT list: ${mt.join(', ')}`);
    console.log(`  MT casts 5T/60s: ${JSON.stringify(mtCasts)}`);
    console.log(`  MT never cast: ${JSON.stringify(mt.filter((id) => !mtCasts[id]))}`);
  }
}
