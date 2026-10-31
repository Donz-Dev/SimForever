import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_ID_BASE,
  BENCHMARK_TEMPLATES,
  ID_BLOCK_SIZE,
  benchmarkEquipmentFor,
  benchmarkItemsFor,
  checkIdBlocks,
} from '../../src/game/items/benchmarkSets';
import { BENCHMARK_SETS } from '../../src/game/items/benchmarkGear';

/*
 * A BENCHMARK ITEM'S ID IS ITS ROW'S DECLARED `idBlock`, and a saved profile
 * stores those ids. Round 40 broke this when the id was still the row's
 * POSITION: inserting Fire Demo mid-table moved Shadow Priest, Shockadin 2H and
 * Fury Prot by 400 ids, and nothing failed.
 *
 * SO EACH ROW'S BLOCK IS WRITTEN OUT BY HAND. A block may be added and never
 * changed or reused; the table's ORDER is free.
 */
const BLOCKS: Readonly<Record<string, number>> = {
  two_hand_arms: 0, dw_fury: 1, prot_warr: 2, rogue_venom: 3, rogue_combat_mut: 4,
  rogue_combat: 5, rogue_rupture: 6, rogue_hemo: 7, rogue_pure_hemo: 8, druid_moonkin: 9,
  druid_cat: 10, druid_bear: 11, shaman_elemental: 12, shaman_enhancement: 13,
  mage_frostfire: 14, mage_arcane: 15, mage_fire: 16, pally_ret: 17, pally_shockadin: 18,
  prot_pally: 19, bm_hunter: 20, lw_ranged: 21, lw_melee: 22, hawk_melee: 23,
  warlock_smds: 24, warlock_firelock: 25, shadow_priest: 26, pally_shockadin_2h: 27,
  fury_prot: 28, warlock_demonology: 29, warlock_sbolt: 30,
  holy_pal: 31,
  mage_frost: 32,
  shaman_resto: 33,
  druid_resto: 34,
  priest_holy: 35,
  priest_disc: 36,
  // The owner's saved 3-target builds (round 82). Rupture (6), Shockadin (18)
  // and Sbolt Spam (30) are no longer presets; their rows stay, so a saved
  // profile still holding one of their ids resolves, and no block is reused.
  hunter_survival_weave: 37,
  shaman_spellhance: 38,
  warlock_sm_ruin: 39,
  // Protribution, appended on a fresh block.
  protribution: 40,
};

describe('benchmark item ids', () => {
  it('keeps every row on the block it was given, which is what a saved profile holds', () => {
    expect(Object.fromEntries(BENCHMARK_TEMPLATES.map((t) => [t.presetId, t.idBlock]))).toEqual(BLOCKS);
  });

  it('builds every id from the block and not from the row position', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        for (const item of benchmarkItemsFor(template, set)) {
          expect(Math.floor((item.id - BENCHMARK_ID_BASE) / ID_BLOCK_SIZE), template.presetId).toBe(
            template.idBlock,
          );
        }
      }
    }
  });

  it('does not move an id when a row is taken out of the table', () => {
    // A copy of a row is in no table at all -- it has no position, only its block.
    const row = BENCHMARK_TEMPLATES.find((t) => t.presetId === 'shadow_priest')!;
    const set = BENCHMARK_SETS[1];
    expect(benchmarkItemsFor({ ...row }, set).map((i) => i.id)).toEqual(
      benchmarkItemsFor(row, set).map((i) => i.id),
    );
  });

  it('refuses two rows with one block, at load', () => {
    const [a, b] = BENCHMARK_TEMPLATES;
    expect(() => checkIdBlocks([a, { ...b, idBlock: a.idBlock }])).toThrow(/share idBlock/);
    expect(() => checkIdBlocks([{ ...a, idBlock: -1 }])).toThrow(/not a whole number/);
  });

  it('give Shadow Priest the E65 head it had before Fire Demo was added', () => {
    const head = benchmarkEquipmentFor('shadow_priest', 'E65')!.head!.itemId;
    expect(Math.floor((head - BENCHMARK_ID_BASE) / ID_BLOCK_SIZE)).toBe(26);
  });
});
