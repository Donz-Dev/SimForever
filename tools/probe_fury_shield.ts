/**
 * Does Seal of Fury's absorb do what its tooltip says, hit by hit (round 90)?
 *
 *   npx vite-node tools/probe_fury_shield.ts
 *   TIER=B55 SEEDS=20 npx vite-node tools/probe_fury_shield.ts
 *
 * "While a shield is equipped, each attack also grants an absorb shield equal
 * to 50% of the Holy damage dealt." So, over Prot Pally's fights:
 *
 *   - every landed melee attack (re)grants the shield;
 *   - the pool after a grant is 0.5 x (35 + 10% of Holy spell power), and a
 *     second grant REPLACES it rather than adding to it;
 *   - a boss swing landing on a fresh pool absorbs min(swing, pool).
 *
 * Absorbs are attributed by reading which shields were up: Templar's Bulwark is
 * the build's other one, so hits taken under it are counted apart.
 */
import type { TelemetryEvent } from '../src/engine';
import { Simulation, deriveSeed, seconds } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import type { BenchmarkSetId } from '../src/game/items/benchmarkSets';
import { benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { templateIdFor } from '../src/game/items/defaultValuation';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { SEAL_OF_FURY_SHIELD_ID, sealOfFuryShield } from '../src/game/auras/paladin';

const tier = process.env.TIER ?? 'E65';
const seeds = Number(process.env.SEEDS ?? 10);
const base = PRESETS_BY_ID.get('prot_pally')!.build();
const equipment = benchmarkEquipmentFor(templateIdFor(base.benchmarkTemplateId, base.character.name)!, tier as BenchmarkSetId, base.equipment)!;
const profile = { ...base, equipment };

let grants = 0;
let landedSeals = 0;
let hits = 0;
let underFuryOnly = 0;
let absorbedFuryOnly = 0;
let poolWrong = 0;
let stacked = 0;
let expected = 0;
let underOther = 0;
const others = new Map<string, number>();
let unknown = 0;
/** The Spellblasting Potion's 40 Holy spell power, through 10% and then 50%. */
const POTION_POOL = 40 * 0.1 * 0.5;

for (let i = 0; i < seeds; i++) {
  const seed = deriveSeed(7, i);
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation({ ...trainingDummyEncounter(profile, seed), seed }, { emit: (e) => events.push(e) });
  const player = simulation.combatants.find((c) => c.kind === 'player')!;
  simulation.begin();
  // Step a second at a time so the live aura state can be read beside each event.
  let seen = 0;
  for (let t = 1; t <= profile.simulation.durationSeconds * 2 && !simulation.hasEnded; t++) {
    simulation.advanceTo(seconds(t));
    for (; seen < events.length; seen++) {
      const e = events[seen];
      if (e.type === 'damage' && e.sourceId === player.id && e.abilityId === 'seal_of_fury') landedSeals += 1;
      if ((e.type === 'aura_applied' || e.type === 'aura_refreshed') && e.auraId === SEAL_OF_FURY_SHIELD_ID) grants += 1;
    }
  }
  /*
   * Second pass. The pool is the engine's own figure -- the shield's `absorb`
   * evaluated on the character -- and a spent shield is REMOVED AT THE SAME
   * MILLISECOND as the hit that spent it, logged before the damage event, so the
   * replay tracks "granted since the last hit" rather than the remove events.
   */
  expected = sealOfFuryShield().absorb!(player);
  let armed: boolean | undefined = false;
  let bulwark = false;
  let bulwarkSpentAt = -1;
  for (const e of events) {
    if ((e.type === 'aura_applied' || e.type === 'aura_refreshed') && e.targetId === player.id) {
      if (e.auraId === SEAL_OF_FURY_SHIELD_ID) armed = true;
      if (e.auraId === 'templars_bulwark') bulwark = true;
    } else if (e.type === 'aura_removed' && e.targetId === player.id && e.auraId === 'templars_bulwark') {
      // A SPENT shield is removed before the hit that spent it is logged.
      bulwark = false;
      bulwarkSpentAt = e.timestamp;
    } else if (e.type === 'damage' && e.targetId === player.id && !e.periodic) {
      if (e.outcome === 'miss' || e.outcome === 'dodge' || e.outcome === 'parry') continue;
      hits += 1;
      if (bulwark || e.timestamp === bulwarkSpentAt) {
        underOther += 1;
        others.set('templars_bulwark', (others.get('templars_bulwark') ?? 0) + 1);
        /*
         * UNKNOWN AFTERWARDS: the engine spends shields in the order they were
         * applied, so a Bulwark hit may or may not have taken the Fury pool with
         * it. The next hit is checked only once a fresh grant says what is up.
         */
        armed = undefined;
        continue;
      }
      if (armed === undefined) {
        unknown += 1;
        armed = false;
        continue;
      }
      /*
       * THE POOL MOVES WITH SPELL POWER, because each grant re-reads it: the
       * Spellblasting Potion's +40 in the last 30 s is +2.0 a grant. So a hit is
       * right if it absorbs the pool at either level, capped by the hit.
       */
      const hit = e.absorbed + e.amount;
      const right = armed
        ? [expected, expected - POTION_POOL].some((pool) => Math.abs(e.absorbed - Math.min(pool, hit)) < 0.01)
        : e.absorbed < 0.01;
      const want = armed ? Math.min(expected, hit) : 0;
      if (armed) {
        underFuryOnly += 1;
        absorbedFuryOnly += e.absorbed;
      }
      if (!right) {
        poolWrong += 1;
        if (process.env.SHOW && poolWrong <= 12) console.log(`    t=${e.timestamp} ${e.outcome} amount ${e.amount.toFixed(0)} absorbed ${e.absorbed.toFixed(1)} want ${want.toFixed(1)} armed ${armed}`);
      }
      if (e.absorbed > expected + 0.01) stacked += 1;
      armed = false;
    }
  }
}

console.log(`Prot Pally ${tier}, ${seeds} fights`);
console.log(`  Seal of Fury hits landed ${landedSeals}, shield grants ${grants}  (expect equal)`);
console.log(`  pool per grant ${expected.toFixed(2)}, the shield's own absorb on the character = 0.5 x (35 + 10% Holy SP)`);
console.log(`  boss hits that landed ${hits}: ${underFuryOnly} under the Fury shield alone, ${underOther} under another shield ${JSON.stringify([...others])}`);
console.log(`  hits straight after a Bulwark hit with no grant between, not checked: ${unknown}`);
console.log(`  absorbed under the Fury shield alone: ${absorbedFuryOnly.toFixed(0)} total, ${(absorbedFuryOnly / Math.max(1, underFuryOnly)).toFixed(2)} a hit`);
console.log(`  hits whose absorb disagreed with the replayed pool: ${poolWrong}`);
console.log(`  hits absorbing MORE than one grant (stacking): ${stacked}`);

if (process.env.OUT) {
  const row = {
    tier,
    fights: seeds,
    sealHits: landedSeals,
    shieldGrants: grants,
    poolPerGrant: Number(expected.toFixed(2)),
    hitsTaken: hits,
    hitsUnderFuryAlone: underFuryOnly,
    absorbedPerHit: Number((absorbedFuryOnly / Math.max(1, underFuryOnly)).toFixed(2)),
    disagreements: poolWrong,
    stacked,
  };
  const { existsSync, readFileSync, writeFileSync } = await import('node:fs');
  const rows = existsSync(process.env.OUT) ? JSON.parse(readFileSync(process.env.OUT, 'utf8')) : [];
  writeFileSync(process.env.OUT, JSON.stringify([...rows.filter((r: { tier: string }) => r.tier !== tier), row], null, 2));
}
