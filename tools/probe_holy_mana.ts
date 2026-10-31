/**
 * Where a healer's mana goes, cast by cast, in both healer fights.
 *
 *   npx vite-node tools/probe_holy_mana.ts
 *   PROFILE=holy_pal SEEDS=20 DURATION=180 npx vite-node tools/probe_holy_mana.ts
 *
 * Answers two questions the batch report cannot: does a CANCELLED cast spend
 * mana (it must not -- see `CastOptions.payCostOnCompletion`), and when does
 * the pool run dry and stay dry. Each Holy Light cast is matched to what became
 * of it: completed, cancelled, and what each of those spent.
 */
import type { TelemetryEvent } from '../src/engine';
import { Simulation, seconds } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { healerEncounter, HEALER_ID } from '../src/simulator/healerEncounter';

const id = process.env.PROFILE ?? 'holy_pal';
const seeds = Number(process.env.SEEDS ?? 10);
const durationOverride = process.env.DURATION ? Number(process.env.DURATION) : undefined;
const base = PRESETS_BY_ID.get(id)!.build();
const profile = durationOverride
  ? { ...base, simulation: { ...base.simulation, durationSeconds: durationOverride } }
  : base;

for (const fight of ['tank', 'raid'] as const) {
  const totals = {
    starts: new Map<string, number>(),
    cancelled: new Map<string, number>(),
    spent: new Map<string, number>(),
    spentOnCancelled: 0,
    gained: new Map<string, number>(),
    dryMs: 0,
    firstDryMs: 0,
    fights: 0,
    durationMs: 0,
  };
  const add = (map: Map<string, number>, key: string, value = 1) =>
    map.set(key, (map.get(key) ?? 0) + value);

  for (let seed = 1; seed <= seeds; seed++) {
    const events: TelemetryEvent[] = [];
    const config = healerEncounter(profile, fight, 1000 + seed);
    const simulation = new Simulation(config, { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.advanceTo(seconds(10_000));
    totals.fights += 1;
    const end = events.length ? events[events.length - 1].timestamp : 0;
    totals.durationMs += end;

    // A spend that lands at the same instant as a cancel is the cancelled cast's.
    const cancelAt = new Set<number>();
    for (const e of events) {
      if (e.type === 'channel_interrupted' && e.sourceId === HEALER_ID) {
        add(totals.cancelled, e.abilityId);
        cancelAt.add(e.timestamp);
      }
    }
    // Every cast the healer STARTED: a cast_start where the engine emits one,
    // otherwise the cast event marks completion.
    let mana = Number.NaN;
    let dryFrom: number | undefined;
    let firstDry: number | undefined;
    for (const e of events) {
      // The engine emits `cast` as a cast STARTS, so completed = started - cancelled.
      if (e.type === 'cast' && e.sourceId === HEALER_ID) add(totals.starts, e.abilityId);
      if (e.type === 'resource_spent' && e.actorId === HEALER_ID && e.resource === 'mana') {
        add(totals.spent, e.source ?? '(none)', e.amount);
        if (cancelAt.has(e.timestamp) && e.source === 'holy_light') totals.spentOnCancelled += e.amount;
      }
      if (e.type === 'resource_gained' && e.actorId === HEALER_ID && e.resource === 'mana') {
        add(totals.gained, e.source ?? '(unattributed)', e.amount - e.wasted);
      }
      if ((e.type === 'resource_spent' || e.type === 'resource_gained') && e.actorId === HEALER_ID && e.resource === 'mana') {
        mana = e.current;
        const dry = mana < 400;
        if (dry && dryFrom === undefined) {
          dryFrom = e.timestamp;
          firstDry ??= e.timestamp;
        }
        if (!dry && dryFrom !== undefined) {
          totals.dryMs += e.timestamp - dryFrom;
          dryFrom = undefined;
        }
      }
    }
    if (dryFrom !== undefined) totals.dryMs += end - dryFrom;
    totals.firstDryMs += firstDry ?? end;
  }

  const per = (n: number) => (n / totals.fights).toFixed(1);
  console.log(`\n== ${id} ${fight.toUpperCase()} fight, ${totals.fights} fights, mean ${(totals.durationMs / totals.fights / 1000).toFixed(0)} s`);
  console.log(`  first below 400 mana at ${(totals.firstDryMs / totals.fights / 1000).toFixed(1)} s; below 400 for ${(100 * totals.dryMs / totals.durationMs).toFixed(1)}% of the fight`);
  const abilities = new Set([...totals.starts.keys(), ...totals.cancelled.keys(), ...totals.spent.keys()]);
  for (const ability of abilities) {
    console.log(
      `  ${ability.padEnd(22)} started ${per(totals.starts.get(ability) ?? 0).padStart(6)}  completed ${per((totals.starts.get(ability) ?? 0) - (totals.cancelled.get(ability) ?? 0)).padStart(6)}  cancelled ${per(totals.cancelled.get(ability) ?? 0).padStart(6)}  mana ${per(totals.spent.get(ability) ?? 0).padStart(8)}`,
    );
  }
  console.log(`  mana spent at the instant of a Holy Light cancel: ${per(totals.spentOnCancelled)}`);
  for (const [source, amount] of totals.gained) console.log(`  gained ${source.padEnd(28)} ${per(amount).padStart(8)}`);
}
