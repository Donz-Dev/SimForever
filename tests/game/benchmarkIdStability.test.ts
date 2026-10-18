import { describe, expect, it } from 'vitest';
import { BENCHMARK_ID_BASE, BENCHMARK_TEMPLATES, benchmarkEquipmentFor } from '../../src/game/items/benchmarkSets';

/*
 * A BENCHMARK ITEM'S ID IS ITS TEMPLATE'S POSITION, so a template inserted
 * anywhere but the end renumbers every set after it and re-points every saved
 * profile's items. Two comments in `benchmarkSets.ts` said so, and round 40
 * inserted Fire Demo beside the Firelock anyway -- Shadow Priest, Shockadin 2H
 * and Fury Prot all moved 400 ids and nothing failed. Round 45 put it back.
 *
 * SO THE ORDER IS WRITTEN OUT BY HAND. A new template goes on the END of this
 * list and of the table; anything else fails here.
 */
const ORDER = [
  'two_hand_arms', 'dw_fury', 'prot_warr', 'rogue_venom', 'rogue_combat_mut', 'rogue_combat',
  'rogue_rupture', 'rogue_hemo', 'rogue_pure_hemo', 'druid_moonkin', 'druid_cat', 'druid_bear',
  'shaman_elemental', 'shaman_enhancement', 'mage_frostfire', 'mage_arcane', 'mage_fire',
  'pally_ret', 'pally_shockadin', 'prot_pally', 'bm_hunter', 'lw_ranged', 'lw_melee', 'hawk_melee',
  'warlock_smds', 'warlock_firelock', 'shadow_priest', 'pally_shockadin_2h', 'fury_prot',
  'warlock_demonology', 'warlock_sbolt',
];

describe('benchmark item ids', () => {
  it('only ever grow at the end of the template table', () => {
    expect(BENCHMARK_TEMPLATES.map((t) => t.presetId)).toEqual(ORDER);
  });

  it('give Shadow Priest the E65 head it had before Fire Demo was added', () => {
    // Template 26, set E65 (index 1): the id a profile saved before round 40 holds.
    const head = benchmarkEquipmentFor('shadow_priest', 'E65')!.head!.itemId;
    expect(Math.floor((head - BENCHMARK_ID_BASE) / 400)).toBe(26);
  });
});
