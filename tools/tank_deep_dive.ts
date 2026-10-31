/*
 * ==============================================================================
 * THE TWO TANK DEEP DIVE (round 90): Prot Pally and Bear Druid at B55, E65 and
 * E75, off the event stream.
 *
 *   npx vite-node tools/tank_deep_dive.ts                       # everything, JSON to stdout's tail
 *   OUT=tanks.json ITER=200 npx vite-node tools/tank_deep_dive.ts
 *   PROFILES=prot_pally TIERS=E65 ITER=40 npx vite-node tools/tank_deep_dive.ts
 *
 * SEVEN QUESTIONS, ALL READ OFF THE TELEMETRY rather than the batch report,
 * because three of them have no batch figure at all:
 *
 *   TPS              every threat event the player generated, over the fight.
 *                    Multi-target also gives the LEAST-threatened target, which
 *                    is the one an add peels off.
 *   DTPS             health damage the player took, after armor, block and
 *                    absorbs. Pre-absorb and absorbed are printed beside it.
 *   HEALING NEEDED   health damage taken minus the player's OWN healing, per
 *                    second -- what somebody else has to supply to break even.
 *                    The assumed healer's actual delivery is printed beside it.
 *   FIRST DEATH      the first player death with the boss's ramp UNCAPPED. Round
 *                    79 capped "Mounting Fury" at 2x the base swing; this tool
 *                    lifts that cap for this one measurement (see `uncapRamp`)
 *                    and puts it back. Everything else uses the shipped cap.
 *   OOM              Prot Pally only, a 240 s fight, at two lines: the first
 *                    moment mana is below the cheapest core spell -- Holy Shield,
 *                    Consecration, Holy Strike or Judgement, so it can cast none
 *                    of them -- and the first moment it is below HOLY SHIELD'S
 *                    cost, so it cannot keep its block shield up. Holy Strike is
 *                    20 mana, which makes the first line an empty bar.
 *                    `OOM_ONLY=1` runs these fights alone.
 *
 * PAIRED SEEDS THROUGHOUT (`deriveSeed(SEED, i)`), so the Seal of Fury against
 * Seal of Righteousness comparison differences two runs of the same fights.
 * ==============================================================================
 */
import { writeFileSync } from 'node:fs';
import type { Combatant, TelemetryEvent } from '../src/engine';
import { Simulation, deriveSeed, seconds } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import type { CharacterProfile } from '../src/profiles';
import type { BenchmarkSetId } from '../src/game/items/benchmarkSets';
import { benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { templateIdFor } from '../src/game/items/defaultValuation';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { BOSS_DAMAGE_RAMP } from '../src/game/encounters/raidBoss';

const ITER = Number(process.env.ITER ?? 200);
const DEATH_ITER = Number(process.env.DEATH_ITER ?? ITER);
const SEED = Number(process.env.SEED ?? 20261031);
const PROFILES = (process.env.PROFILES ?? 'prot_pally,druid_bear').split(',');
const TIERS = (process.env.TIERS ?? 'B55,E65,E75').split(',');
const TARGETS = (process.env.TARGETS ?? '1,3,5,8').split(',').map(Number);
const OOM_SECONDS = 240;
const OUT = process.env.OUT;
/** Only the out-of-mana fights, for Prot Pally. */
const OOM_ONLY = process.env.OOM_ONLY === '1';

const CORE_MANA_SPELLS = ['holy_shield', 'consecration', 'holy_strike', 'judgement'];

/** The ramp's round 79 cap, lifted for the first-death measurement only. */
function uncapRamp<T>(body: () => T): T {
  const ramp = BOSS_DAMAGE_RAMP as { maxStackedMultiplier?: number };
  const cap = ramp.maxStackedMultiplier;
  ramp.maxStackedMultiplier = undefined;
  try {
    return body();
  } finally {
    ramp.maxStackedMultiplier = cap;
  }
}

function geared(id: string, tier: string): CharacterProfile {
  const base = PRESETS_BY_ID.get(id)!.build();
  const templateId = templateIdFor(base.benchmarkTemplateId, base.character.name)!;
  const equipment = benchmarkEquipmentFor(templateId, tier as BenchmarkSetId, base.equipment);
  if (!equipment) throw new Error(`${id}: no ${tier} set`);
  return { ...base, equipment };
}

/** The same profile on Seal of Righteousness, which is what Prot Pally ran before round 90. */
function onRighteousness(profile: CharacterProfile): CharacterProfile {
  return JSON.parse(JSON.stringify(profile).replaceAll('"seal_of_fury"', '"seal_of_righteousness"'));
}

interface Fight {
  readonly events: TelemetryEvent[];
  readonly player: Combatant;
  readonly enemyIds: readonly string[];
  readonly endMs: number;
}

function fight(
  profile: CharacterProfile,
  targets: number,
  durationSeconds: number,
  seed: number,
  stopAtFirstDeath = false,
): Fight {
  const p: CharacterProfile = {
    ...profile,
    simulation: { ...profile.simulation, durationSeconds },
    encounter: { ...profile.encounter, numberOfTargets: targets },
  };
  const events: TelemetryEvent[] = [];
  let died = false;
  let playerId = '';
  const simulation = new Simulation(
    { ...trainingDummyEncounter(p, seed), seed },
    {
      emit: (e) => {
        events.push(e);
        if (e.type === 'death' && e.actorId === playerId) died = true;
      },
    },
  );
  const player = simulation.combatants.find((c) => c.kind === 'player')!;
  playerId = player.id;
  const enemyIds = simulation.combatants.filter((c) => c.faction === 'hostile').map((c) => c.id);
  simulation.begin();
  if (stopAtFirstDeath) {
    for (let t = 1; t <= durationSeconds && !died && !simulation.hasEnded; t++) simulation.advanceTo(seconds(t));
  } else {
    simulation.advanceTo(seconds(durationSeconds * 2));
  }
  const endMs = events.length ? events[events.length - 1].timestamp : 0;
  return { events, player, enemyIds, endMs };
}

interface Cell {
  tps: number;
  minTargetTps: number;
  dtps: number;
  preAbsorbDtps: number;
  absorbedPerSecond: number;
  furyShieldGrantsPerSecond: number;
  healingNeeded: number;
  externalHps: number;
  selfHps: number;
  deaths: number;
  avoided: number;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function steady(profile: CharacterProfile, targets: number): Cell {
  const rows: Cell[] = [];
  for (let i = 0; i < ITER; i++) {
    const { events, player, enemyIds, endMs } = fight(profile, targets, profile.simulation.durationSeconds, deriveSeed(SEED, i));
    const s = Math.max(endMs / 1000, 0.001);
    const byTarget = new Map<string, number>(enemyIds.map((id) => [id, 0]));
    let threat = 0;
    let taken = 0;
    let absorbed = 0;
    let external = 0;
    let self = 0;
    let deaths = 0;
    let swings = 0;
    let avoided = 0;
    let grants = 0;
    for (const e of events) {
      if (e.type === 'threat' && e.sourceId === player.id) {
        threat += e.amount;
        byTarget.set(e.targetId, (byTarget.get(e.targetId) ?? 0) + e.amount);
      } else if (e.type === 'damage' && e.targetId === player.id) {
        taken += e.amount;
        absorbed += e.absorbed;
        if (!e.periodic) {
          swings += 1;
          if (e.outcome === 'miss' || e.outcome === 'dodge' || e.outcome === 'parry') avoided += 1;
        }
      } else if (e.type === 'heal' && e.targetId === player.id) {
        if (e.external) external += e.amount;
        else self += e.amount;
      } else if (e.type === 'death' && e.actorId === player.id) {
        deaths += 1;
      } else if (
        (e.type === 'aura_applied' || e.type === 'aura_refreshed') &&
        e.auraId === 'seal_of_fury_shield'
      ) {
        grants += 1;
      }
    }
    rows.push({
      tps: threat / s,
      minTargetTps: Math.min(...byTarget.values()) / s,
      dtps: taken / s,
      preAbsorbDtps: (taken + absorbed) / s,
      absorbedPerSecond: absorbed / s,
      furyShieldGrantsPerSecond: grants / s,
      healingNeeded: (taken - self) / s,
      externalHps: external / s,
      selfHps: self / s,
      deaths,
      avoided: swings ? avoided / swings : 0,
    });
  }
  const out = {} as Cell;
  for (const key of Object.keys(rows[0]) as (keyof Cell)[]) out[key] = mean(rows.map((r) => r[key]));
  return out;
}

interface Censored {
  readonly mean: number;
  readonly median: number;
  readonly reached: number;
}

function censored(times: readonly number[], cap: number): Censored {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    mean: mean(times),
    median: sorted[Math.floor(sorted.length / 2)],
    reached: times.filter((t) => t < cap).length / times.length,
  };
}

function firstDeath(profile: CharacterProfile, targets: number): Censored {
  const CAP = 900;
  return uncapRamp(() => {
    const times: number[] = [];
    for (let i = 0; i < DEATH_ITER; i++) {
      const { events, player } = fight(profile, targets, CAP, deriveSeed(SEED + 1, i), true);
      const death = events.find((e) => e.type === 'death' && e.actorId === player.id);
      times.push(death ? death.timestamp / 1000 : CAP);
    }
    return censored(times, CAP);
  });
}

interface Oom {
  /** Below the cheapest core spell: it can cast none of them. */
  readonly empty: Censored & { readonly threshold: number };
  /** Below Holy Shield's cost: it can no longer keep its block shield up. */
  readonly holyShield: Censored & { readonly threshold: number };
}

function oom(profile: CharacterProfile, targets: number): Oom {
  const empty: number[] = [];
  const shield: number[] = [];
  let emptyAt = 0;
  let shieldAt = 0;
  for (let i = 0; i < DEATH_ITER; i++) {
    const { events, player } = fight(profile, targets, OOM_SECONDS, deriveSeed(SEED + 2, i));
    emptyAt = Math.min(...CORE_MANA_SPELLS.map((id) => player.abilities.get(id)?.cost?.amount ?? Infinity));
    shieldAt = player.abilities.get('holy_shield')?.cost?.amount ?? 0;
    const first = (threshold: number) => {
      for (const e of events) {
        if (e.timestamp > seconds(OOM_SECONDS)) break;
        if (
          (e.type === 'resource_spent' || e.type === 'resource_gained') &&
          e.actorId === player.id &&
          e.resource === 'mana' &&
          e.current < threshold
        ) {
          return e.timestamp / 1000;
        }
      }
      return OOM_SECONDS;
    };
    empty.push(first(emptyAt));
    shield.push(first(shieldAt));
  }
  return {
    empty: { ...censored(empty, OOM_SECONDS), threshold: emptyAt },
    holyShield: { ...censored(shield, OOM_SECONDS), threshold: shieldAt },
  };
}

const report: Record<string, unknown> = { iterations: ITER, deathIterations: DEATH_ITER, seed: SEED, rows: [] };
const rows = report.rows as unknown[];
const f = (n: number, d = 1) => n.toFixed(d);

for (const id of PROFILES) {
  for (const tier of TIERS) {
    const profile = geared(id, tier);
    const variants: [string, CharacterProfile][] = [['shipped', profile]];
    if (id === 'prot_pally') variants.push(['righteousness', onRighteousness(profile)]);
    for (const [variant, p] of variants) {
      const cells: Record<number, Cell> = {};
      const deaths: Record<number, Censored> = {};
      const ooms: Record<number, Oom> = {};
      for (const targets of TARGETS) {
        if (OOM_ONLY) {
          if (id === 'prot_pally') ooms[targets] = oom(p, targets);
          const o = ooms[targets];
          if (o) console.log(`${id} ${tier} ${variant} ${targets}T  empty ${f(o.empty.reached * 100, 0)}% at mean ${f(o.empty.mean)}s  below Holy Shield ${f(o.holyShield.reached * 100, 0)}% median ${f(o.holyShield.median)}s`);
          continue;
        }
        cells[targets] = steady(p, targets);
        if (variant === 'shipped') deaths[targets] = firstDeath(p, targets);
        if (id === 'prot_pally') ooms[targets] = oom(p, targets);
        const c = cells[targets];
        console.log(
          `${id.padEnd(11)} ${tier} ${variant.padEnd(13)} ${String(targets).padStart(2)}T` +
            `  TPS ${f(c.tps).padStart(7)} (min tgt ${f(c.minTargetTps).padStart(6)})` +
            `  DTPS ${f(c.dtps).padStart(6)} pre-abs ${f(c.preAbsorbDtps).padStart(6)} abs ${f(c.absorbedPerSecond).padStart(5)}` +
            `  heal-need ${f(c.healingNeeded).padStart(6)} ext ${f(c.externalHps).padStart(6)} self ${f(c.selfHps).padStart(5)}` +
            `  deaths ${f(c.deaths, 2)} avoid ${f(c.avoided * 100)}%` +
            (deaths[targets] ? `  1st death ${f(deaths[targets].median)}s` : '') +
            (ooms[targets] ? `  OOM ${f(ooms[targets].empty.median)}s (${f(ooms[targets].empty.reached * 100, 0)}%)` : ''),
        );
      }
      rows.push({ id, tier, variant, cells, deaths, ooms });
    }
  }
}

if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
