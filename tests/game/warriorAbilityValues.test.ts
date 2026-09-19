import { describe, expect, it } from 'vitest';
import spellData from '../../src/data/abilities/forever-warrior.json';
import {
  BATTLE_SHOUT_ATTACK_POWER,
  BATTLE_SHOUT_DURATION_MS,
  BERSERKER_STANCE_CRIT_BONUS,
  BERSERKER_STANCE_DAMAGE_TAKEN,
  DEFENSIVE_STANCE_DAMAGE_DONE,
  DEFENSIVE_STANCE_DAMAGE_TAKEN,
  DEMORALIZING_SHOUT_ATTACK_POWER,
  DEMORALIZING_SHOUT_DURATION_MS,
  RECKLESSNESS_CRIT_BONUS,
  RECKLESSNESS_DAMAGE_TAKEN_MULTIPLIER,
  RECKLESSNESS_DURATION_MS,
  SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER,
  SHIELD_WALL_DURATION_MS,
  SUNDER_ARMOR_DURATION_MS,
  SUNDER_ARMOR_MAX_STACKS,
  SUNDER_ARMOR_PER_STACK,
} from '../../src/game/auras/warrior';

/*
 * The Warrior's effect magnitudes, checked two ways.
 *
 * These numbers were missing for months. The ability spreadsheet gives costs,
 * cooldowns and damage and no magnitudes at all, and the standing plan was to
 * borrow WoW Classic values and flag them. Forever's own spell data turned out
 * to be reachable, so they are real Forever numbers instead.
 *
 * TWO INDEPENDENT CHECKS, deliberately:
 *
 *   1. The expected value is written out BY HAND below, from reading the
 *      tooltip. A test that derived its expectation from the constant under
 *      test would pass whatever the constant said.
 *   2. The stored tooltip is then asserted to contain that same number, which
 *      ties the hand-transcription to the captured source. A typo in the
 *      transcription fails check 2; a drift in the source fails
 *      `node tools/import_spell.mjs --verify`.
 *
 * Between them, the only way a wrong number survives is if the same wrong
 * number is typed twice AND matches the tooltip, which is not a mistake, it is
 * a decision.
 */

/** The spell whose tooltip a constant was read from. */
function spell(id: number) {
  const found = spellData.spells.find((s) => s.id === id);
  if (!found) throw new Error(`spell ${id} is not in forever-warrior.json`);
  return found;
}

describe('the captured spell data', () => {
  it('covers every ability whose magnitude the spreadsheet omits', () => {
    // Transcribed by hand from src/data/abilities/README.md's table.
    const expected = [25289, 11556, 11597, 1719, 18499, 2687, 871, 2565, 2457, 71, 2458];
    expect(spellData.spells.map((s) => s.id).sort()).toEqual([...expected].sort());
  });

  it('is Forever data, not Classic', () => {
    expect(spellData.game).toBe('forever');
    for (const s of spellData.spells) {
      expect(s.source).toContain('/forever/');
    }
  });
});

describe('Battle Shout', () => {
  // Spell 25289, rank 7: "increasing the melee attack power of all party
  // members within 20 yards by 140. Lasts 3 min."
  it('grants 140 attack power', () => {
    expect(BATTLE_SHOUT_ATTACK_POWER).toBe(140);
    expect(spell(25289).description).toContain('by 140');
  });

  it('lasts 3 minutes', () => {
    expect(BATTLE_SHOUT_DURATION_MS).toBe(180_000);
    expect(spell(25289).description).toContain('3 min');
  });

  it('is rank 7, not rank 1', () => {
    // Rank 1 grants 12. Getting the rank wrong is an order-of-magnitude error,
    // not a rounding one.
    expect(BATTLE_SHOUT_ATTACK_POWER).toBeGreaterThan(12);
  });
});

describe('Demoralizing Shout', () => {
  /*
   * Spell 11556, rank 5: "Reduces the melee attack power of all enemies within
   * 10 yards by 210 for 45 sec."
   *
   * CLASSIC IS 146 FOR 30 SEC. This is the ability that most justified fetching
   * Forever's own numbers: borrowing would have been 30% too weak.
   */
  it('removes 210 attack power for 45 seconds', () => {
    expect(DEMORALIZING_SHOUT_ATTACK_POWER).toBe(210);
    expect(DEMORALIZING_SHOUT_DURATION_MS).toBe(45_000);
    expect(spell(11556).description).toContain('by 210 for 45 sec');
  });

  it('is not the Classic value', () => {
    expect(DEMORALIZING_SHOUT_ATTACK_POWER).not.toBe(146);
  });
});

describe('Sunder Armor', () => {
  // Spell 11597, rank 5: "reducing it by 450 per Sunder Armor ... Can be
  // applied up to 5 times. Lasts 30 sec."
  it('removes 450 armor per stack, to 5 stacks, for 30 seconds', () => {
    expect(SUNDER_ARMOR_PER_STACK).toBe(450);
    expect(SUNDER_ARMOR_MAX_STACKS).toBe(5);
    expect(SUNDER_ARMOR_DURATION_MS).toBe(30_000);
    const text = spell(11597).description;
    expect(text).toContain('by 450 per Sunder Armor');
    expect(text).toContain('up to 5 times');
  });

  it('strips 2250 armor at full stacks', () => {
    // Worth stating as its own number: against a 3731-armor boss this is most
    // of the way to halving its mitigation, which is why Sunder moves DPS.
    expect(SUNDER_ARMOR_PER_STACK * SUNDER_ARMOR_MAX_STACKS).toBe(2250);
  });
});

describe('Recklessness', () => {
  /*
   * Spell 1719: "100% increased critical strike chance and will be immune to
   * Fear effects for the next 15 sec, but all damage taken is increased by
   * 20%."
   *
   * Held in percentage POINTS, like every other crit figure in the engine.
   */
  it('grants 100 points of crit for 15 seconds', () => {
    expect(RECKLESSNESS_CRIT_BONUS).toBe(100);
    expect(RECKLESSNESS_DURATION_MS).toBe(15_000);
    expect(spell(1719).description).toContain('100% increased critical strike chance');
  });

  it('increases damage taken by 20%', () => {
    expect(RECKLESSNESS_DAMAGE_TAKEN_MULTIPLIER).toBeCloseTo(1.2);
    expect(spell(1719).description).toContain('damage taken is increased by 20%');
  });
});

describe('Shield Wall', () => {
  /*
   * Spell 871: "Reduces the damage taken from all attacks by 60% for 12 sec."
   *
   * CLASSIC IS 75% FOR 10 SEC on a 30 minute cooldown. Forever is weaker and
   * longer, on a 15 minute cooldown.
   */
  it('takes 60% off damage taken, which is a multiplier of 0.4', () => {
    expect(SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER).toBeCloseTo(0.4);
    expect(spell(871).description).toContain('by 60% for 12 sec');
  });

  it('lasts 12 seconds, not the Classic 10', () => {
    expect(SHIELD_WALL_DURATION_MS).toBe(12_000);
  });
});

describe('the stances', () => {
  // Spell 71: "Decreases damage taken by 10% and damage caused by 10%."
  it('Defensive Stance trades 10% of damage done for 10% of damage taken', () => {
    expect(DEFENSIVE_STANCE_DAMAGE_DONE).toBeCloseTo(0.9);
    expect(DEFENSIVE_STANCE_DAMAGE_TAKEN).toBeCloseTo(0.9);
    expect(spell(71).description).toContain('damage taken by 10% and damage caused by 10%');
  });

  // Spell 2458: "Critical strike chance increased by 3% and all damage taken is
  // increased by 10%."
  it('Berserker Stance trades 10% more damage taken for 3 points of crit', () => {
    expect(BERSERKER_STANCE_CRIT_BONUS).toBe(3);
    expect(BERSERKER_STANCE_DAMAGE_TAKEN).toBeCloseTo(1.1);
    expect(spell(2458).description).toContain('increased by 3%');
  });

  /*
   * Battle Stance's whole tooltip is "A balanced combat stance."
   *
   * The engine invented Battle Stance because two stances with no way back to a
   * neutral one is not a coherent ruleset, and gave it no modifiers. Forever
   * confirms both the existence and the emptiness, so an assumption became a
   * fact. Asserted here so that if Forever ever gives it an effect, this fails.
   */
  it('Battle Stance really does nothing', () => {
    expect(spell(2457).description).toBe('A balanced combat stance.');
  });
});

describe('what is still missing', () => {
  /*
   * Berserker Rage is the one ability Forever's own data does not answer. Its
   * tooltip names no magnitude -- "generating extra rage when taking damage" --
   * and its other half is immunity to Fear and Incapacitate, which the engine
   * has no notion of.
   *
   * Asserted rather than merely written down, so that the day the tooltip gains
   * a number, this test fails and someone goes and models it.
   */
  it('Berserker Rage still names no magnitude, even in Forever', () => {
    const text = spell(18499).description;
    expect(text).toContain('generating extra rage when taking damage');
    expect(text).not.toMatch(/\d+ rage/i);
  });
});
