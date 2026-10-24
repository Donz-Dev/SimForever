/**
 * What a profile does at several targets, with one AoE entry gated on the APL's
 * "number of targets" condition (round 57).
 *
 *   npx vite-node tools/probe_multi_target.ts
 *   PROFILES=prot_warr TARGETS=1,3,8 ITERATIONS=40 npx vite-node tools/probe_multi_target.ts
 *
 * A DIAGNOSTIC, not a baseline: the stock lists are single-target lists, so the
 * AoE entry here is the probe's own -- put FIRST and gated on `targetCount >= 3`,
 * the shape a person would write. It answers whether the area ability reaches
 * every target and whether the report stays sensible: DPS summing across targets,
 * one debuff row per aura, the adds' swings in a row of their own on a tank run.
 */
import { runProfileBatch } from '../src/simulator/runBatch';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import type { CharacterProfile } from '../src/profiles';
import { targetCount } from '../src/game/rotations/apl';

/** One AoE ability per profile, from the owner's list. */
const AOE: Readonly<Record<string, string>> = {
  prot_warr: 'thunder_clap',
  dw_fury: 'whirlwind',
  rogue_combat: 'blade_flurry',
  druid_bear: 'swipe',
  druid_moonkin: 'hurricane',
  mage_fire: 'blast_wave',
  mage_arcane: 'arcane_explosion',
  mage_frostfire: 'blizzard',
  pally_ret: 'consecration',
  prot_pally: 'consecration',
  shaman_elemental: 'magma_totem',
  bm_hunter: 'multi_shot',
  lw_ranged: 'volley',
  warlock_firelock: 'rain_of_fire',
  warlock_smds: 'hellfire',
};

const ids = (process.env.PROFILES ?? 'prot_warr,mage_arcane,warlock_firelock,rogue_combat').split(',');
const counts = (process.env.TARGETS ?? '1,4').split(',').map(Number);
const iterations = Number(process.env.ITERATIONS ?? 30);

for (const id of ids) {
  const preset = PRESETS_BY_ID.get(id);
  const abilityId = AOE[id];
  if (!preset || !abilityId) {
    console.log(`${id}: no preset or no AoE ability named for it`);
    continue;
  }
  const built = preset.build();
  for (const targets of counts) {
    const profile: CharacterProfile = {
      ...built,
      simulation: { ...built.simulation, iterations },
      encounter: { ...built.encounter, numberOfTargets: targets },
      rotation: {
        ...built.rotation,
        source: 'custom',
        entries: [
          { abilityId, condition: targetCount('atLeast', 3) },
          ...built.rotation.entries,
        ],
      },
    };
    const batch = runProfileBatch(profile);
    // The row whose name IS the ability: "Multi-Shot" is `multi_shot`.
    const row = batch.abilities.find(
      (a) => a.abilityName.toLowerCase().replace(/[ \-:]/g, '_') === abilityId,
    );
    const dupes = batch.debuffUptime.length - new Set(batch.debuffUptime.map((d) => d.auraId)).size;
    console.log(
      `${id.padEnd(18)} ${String(targets).padStart(2)} targets  DPS ${batch.dps.mean.toFixed(1).padStart(7)}` +
        `  TPS ${batch.tps.mean.toFixed(1).padStart(7)}` +
        `  ${abilityId}: ${row ? `${row.uses.toFixed(2)} casts, ${(row.share * 100).toFixed(1)}%` : 'no row'}` +
        `  debuff rows ${batch.debuffUptime.length} (duplicates ${dupes})`,
    );
    if (profile.encounter.targetAttacks) {
      for (const taken of batch.damageTaken) {
        console.log(`    taken from ${taken.sourceName.padEnd(32)} ${taken.damage.toFixed(0)}`);
      }
    }
  }
}
