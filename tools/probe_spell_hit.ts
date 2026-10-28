/**
 * What each caster profile misses with its spells at every benchmark tier,
 * per school, after the school-scoped hit talents.
 *
 *   npx vite-node tools/probe_spell_hit.ts
 *   PROFILES=druid_moonkin,shadow_priest npx vite-node tools/probe_spell_hit.ts
 *
 * THE SPELL TABLE ALONE IS NOT THE ANSWER. Shadow Focus, Divine Precision,
 * Elemental Precision, Arcane Focus and Suppression reach their cap through a
 * school-scoped `hitBonus`, which `combineModifiers` adds later -- so this
 * reads the table's miss and takes the school's bonus off it, the way the
 * roll does. A school appears only when an ability the build has deals it.
 */
import { createForeverAttackChances } from '../src/game/combat/attackChances';
import { createTrainingDummy } from '../src/game/actors/createTrainingDummy';
import { BENCHMARK_SETS, benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { characterAtCombatStart } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';
import { templateIdFor } from '../src/game/items/defaultValuation';

const CASTERS = [
  'druid_moonkin',
  'shaman_elemental',
  'mage_arcane',
  'pally_shockadin_2h',
  'warlock_smds',
  'warlock_firelock',
  'warlock_sm_ruin',
  'warlock_demonology',
  'shadow_priest',
];
const WANTED = process.env.PROFILES?.split(',') ?? CASTERS;
const SCHOOLS = ['arcane', 'fire', 'frost', 'nature', 'shadow', 'holy'] as const;

const BOSS = createTrainingDummy({ armor: 3731, level: 63 });

for (const id of WANTED) {
  const preset = PROFILE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  const base = preset.build();
  const templateId = templateIdFor(base.benchmarkTemplateId, base.character.name);
  const chances = createForeverAttackChances({ targetAttacks: base.encounter.targetAttacks });
  const line: string[] = [];
  for (const set of BENCHMARK_SETS) {
    const equipment = templateId ? benchmarkEquipmentFor(templateId, set.id, base.equipment) : undefined;
    if (!equipment) continue;
    const player = characterAtCombatStart({ ...base, equipment });
    if (!player) continue;
    const miss = chances('spell', player, BOSS, {}).miss / 100;
    const parts = SCHOOLS.map((school) => {
      const bonus = player.schoolModifiers.for(school).hitBonus ?? 0;
      return `${school[0]}${(miss - bonus).toFixed(1)}`;
    });
    line.push(`${set.id} gear ${player.stats.effective.hitChance.toFixed(1)}% [${parts.join(' ')}]`);
  }
  console.log(`${id.padEnd(20)} ${line.join(' | ')}`);
}
