import { describe, expect, it } from 'vitest';
import type { BatchStatAverages } from '../../src/analysis';
import { headlinePower } from '../../src/ui/panels/headlinePower';
import type { SimHistoryEntry } from '../../src/ui/simHistory';
import { SIM_HISTORY_LIMIT, withRun } from '../../src/ui/simHistory';

/*
 * The fifth GUI pass's two pure pieces (round 48): the results header's one
 * power tile, and Sim History's ten-run list.
 */

const averages = (overrides: Partial<BatchStatAverages>): BatchStatAverages => ({
  attackPower: 0,
  rangedAttackPower: 50,
  spellPower: 0,
  spellPowerBySchool: {},
  hasteMultiplier: 1,
  ...overrides,
});

describe('the power tile', () => {
  it('shows a melee build its attack power', () => {
    expect(headlinePower(averages({ attackPower: 1560 }))).toEqual({
      label: 'Attack Power',
      value: 1560,
    });
  });

  it('shows a Hunter its ranged pool when that is the larger', () => {
    expect(headlinePower(averages({ attackPower: 1292, rangedAttackPower: 1372 })).label).toBe(
      'Ranged Attack Power',
    );
  });

  it("shows a Shadow Priest the Shadow pool, which includes the blind one", () => {
    expect(
      headlinePower(averages({ spellPower: 785, spellPowerBySchool: { shadow: 845 } })),
    ).toEqual({ label: 'Shadow Spell Power', value: 845 });
  });

  it('breaks a tie toward melee, so 50 of each reads as a melee character', () => {
    expect(headlinePower(averages({ attackPower: 50 })).label).toBe('Attack Power');
  });
});

describe('sim history', () => {
  const entry = (id: number) => ({ id }) as unknown as SimHistoryEntry;

  it('keeps the newest first and at most ten', () => {
    let history: readonly SimHistoryEntry[] = [];
    for (let id = 1; id <= 12; id++) history = withRun(history, entry(id));
    expect(history).toHaveLength(SIM_HISTORY_LIMIT);
    expect(history.map((e) => e.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });
});

describe('raid-forced auras', () => {
  it('lists every selected state buff and no proc', async () => {
    const { raidForcedAuraIds } = await import('../../src/game/buffs/raidBuffs');
    const ids = raidForcedAuraIds(['blessing_of_kings', 'sunder_armor', 'windfury_totem', 'judgement_of_wisdom']);
    expect(ids).toEqual(['blessing_of_kings', 'sunder_armor']);
  });
});
