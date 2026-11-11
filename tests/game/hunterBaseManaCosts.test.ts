import { describe, expect, it } from 'vitest';
import {
  ARCANE_SHOT,
  ARCANE_SHOT_BASE_MANA_FRACTION,
  HUNTER_BASE_MANA,
  SUMMON_HAWK,
} from '../../src/game/abilities/hunter';

/*
 * THE OWNER'S 2026-11-11 NOTE, both halves: "Arcane Shot mana cost changed to
 * 11% of base Mana for all ranks of Arcane Shot" and "Summon Hawk Mana cost
 * changed to 11% of base Mana for all ranks of Summon Hawk, same as Arcane
 * Shot." foreverchanges.pro's 1.60.1.70888 diff carries the Arcane Shot half
 * too: "Costs 11% of base mana instead of 190 Mana".
 *
 * Written out by hand from the base mana rather than read back off the
 * constant, so a wrong fraction fails here.
 */
describe('Arcane Shot and Summon Hawk at 11% of base mana', () => {
  it('cost eleven percent of a Hunter base mana, and the same as each other', () => {
    expect(ARCANE_SHOT_BASE_MANA_FRACTION).toBe(0.11);
    expect(HUNTER_BASE_MANA).toBe(1440);
    expect(ARCANE_SHOT.cost).toEqual({ resource: 'mana', amount: Math.round(1440 * 0.11) });
    expect(ARCANE_SHOT.cost).toEqual({ resource: 'mana', amount: 158 });
    expect(SUMMON_HAWK.cost).toEqual(ARCANE_SHOT.cost);
  });
});
