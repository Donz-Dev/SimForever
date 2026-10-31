/*
 * ==============================================================================
 * THE FIRST FIFTEEN SECONDS (round 90): Prot Pally and Bear Druid at B55, E65
 * and E75, with the target attacking and not.
 *
 *   npx vite-node tools/tank_opening_threat.ts
 *   OUT=opening.json ITER=200 npx vite-node tools/tank_opening_threat.ts
 *   WINDOW=10 PROFILES=druid_bear npx vite-node tools/tank_opening_threat.ts
 *
 * RAW THREAT: every threat event the player generated with a timestamp inside
 * the window, summed, single target. Read off the combat log, so it is the
 * same stream the TPS tile reads, and the fight is the profile's own 60 s --
 * only the window is cut, so nothing keyed to the fight length moves.
 *
 * THREE ENCOUNTERS, because the panel's switch moves two things at once:
 *
 *   attacking        targetAttacks on, Salvation off -- the shipped tank fight
 *   idle, raw        targetAttacks off, Salvation still off -- what the build
 *                    generates on its own when nothing hits it
 *   idle, Salvation  targetAttacks off with Salvation on, which is what
 *                    `withSalvationFor` does when the switch is flipped
 *
 * "Not attacking" also takes away the target's 14% parry and everything that
 * feeds on being hit: a Bear's rage from damage taken, Holy Shield's blocks,
 * Reckoning and Redoubt. So the difference is the build's whole reactive half,
 * which the per-source breakdown names.
 * ==============================================================================
 */
import { writeFileSync } from 'node:fs';
import type { TelemetryEvent } from '../src/engine';
import { Simulation, deriveSeed, seconds } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import type { CharacterProfile } from '../src/profiles';
import type { BenchmarkSetId } from '../src/game/items/benchmarkSets';
import { benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { templateIdFor } from '../src/game/items/defaultValuation';
import { withSalvationFor } from '../src/game/buffs/raidBuffs';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';

const ITER = Number(process.env.ITER ?? 200);
const SEED = Number(process.env.SEED ?? 20261031);
const WINDOW_MS = seconds(Number(process.env.WINDOW ?? 15));
const PROFILES = (process.env.PROFILES ?? 'prot_pally,druid_bear').split(',');
const TIERS = (process.env.TIERS ?? 'B55,E65,E75').split(',') as BenchmarkSetId[];
const OUT = process.env.OUT;

type Encounter = 'attacking' | 'idle_raw' | 'idle_salvation';
const ENCOUNTERS: readonly Encounter[] = ['attacking', 'idle_raw', 'idle_salvation'];

function variant(base: CharacterProfile, encounter: Encounter): CharacterProfile {
  const attacks = encounter === 'attacking';
  return {
    ...base,
    encounter: { ...base.encounter, targetAttacks: attacks, numberOfTargets: 1 },
    raidBuffs: [...withSalvationFor(base.raidBuffs, encounter !== 'idle_salvation')],
  };
}

interface Row {
  profile: string;
  tier: string;
  encounter: Encounter;
  threat: number;
  at5: number;
  at10: number;
  sources: Record<string, number>;
  resourceGained: Record<string, number>;
}

const rows: Row[] = [];
for (const id of PROFILES) {
  for (const tier of TIERS) {
    const base = PRESETS_BY_ID.get(id)!.build();
    const equipment = benchmarkEquipmentFor(templateIdFor(base.benchmarkTemplateId, base.character.name)!, tier, base.equipment)!;
    for (const encounter of ENCOUNTERS) {
      const profile = variant({ ...base, equipment }, encounter);
      let total = 0;
      let at5 = 0;
      let at10 = 0;
      const sources = new Map<string, number>();
      const gained = new Map<string, number>();
      for (let i = 0; i < ITER; i++) {
        const seed = deriveSeed(SEED, i);
        const events: TelemetryEvent[] = [];
        const simulation = new Simulation({ ...trainingDummyEncounter(profile, seed), seed }, { emit: (e) => events.push(e) });
        const player = simulation.combatants.find((c) => c.kind === 'player')!;
        simulation.begin();
        simulation.advanceTo(WINDOW_MS);
        for (const e of events) {
          if (e.timestamp > WINDOW_MS) break;
          if (e.type === 'threat' && e.sourceId === player.id) {
            total += e.amount;
            if (e.timestamp <= seconds(5)) at5 += e.amount;
            if (e.timestamp <= seconds(10)) at10 += e.amount;
            const key = e.cause === 'resource' ? `${e.abilityName} (resource)` : e.abilityName;
            sources.set(key, (sources.get(key) ?? 0) + e.amount);
          } else if (e.type === 'resource_gained' && e.actorId === player.id && (e.resource === 'rage' || e.resource === 'mana')) {
            gained.set(e.resource, (gained.get(e.resource) ?? 0) + e.amount - e.wasted);
          }
        }
      }
      const per = (n: number) => Math.round((n / ITER) * 10) / 10;
      const row: Row = {
        profile: id,
        tier,
        encounter,
        threat: per(total),
        at5: per(at5),
        at10: per(at10),
        sources: Object.fromEntries([...sources].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, per(v)])),
        resourceGained: Object.fromEntries([...gained].map(([k, v]) => [k, per(v)])),
      };
      rows.push(row);
      const top = Object.entries(row.sources).slice(0, 5).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ');
      console.log(
        `${id.padEnd(11)} ${tier} ${encounter.padEnd(15)} ${row.threat.toFixed(0).padStart(6)} threat` +
          `  (5 s ${row.at5.toFixed(0)}, 10 s ${row.at10.toFixed(0)})  gained ${JSON.stringify(row.resourceGained)}  top: ${top}`,
      );
    }
  }
}

if (OUT) writeFileSync(OUT, JSON.stringify({ iterations: ITER, windowMs: WINDOW_MS, seed: SEED, rows }, null, 2));
