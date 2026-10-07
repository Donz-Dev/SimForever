import { describe, expect, it } from 'vitest';
import { BatchTotals } from '../../src/analysis';
import type { StatSampleEvent } from '../../src/engine';
import { RATING_PER_PERCENT, hasteMultiplierFrom } from '../../src/engine';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { SLICE_AND_DICE_ATTACK_SPEED } from '../../src/game/auras/rogue';

/*
 * ==============================================================================
 * AVERAGING A STAT OVER A FIGHT IS A TIME-WEIGHTED INTEGRAL, NOT A MEAN OF
 * SAMPLES, and the two differ by a lot rather than a little.
 *
 * Samples arrive on buff EDGES, so they are not evenly spaced: a ten-second
 * trinket proc in a sixty-second fight produces exactly as many samples as a
 * raid buff that is up the whole time. The arithmetic below is written out by
 * hand from the window lengths rather than read back out of the accumulator,
 * because an accumulator that averaged the samples would also pass a test that
 * asked it for its own answer.
 * ==============================================================================
 */

const sample = (
  timestamp: number,
  values: Partial<Omit<StatSampleEvent, 'type' | 'timestamp' | 'actorId'>>,
): StatSampleEvent => ({
  type: 'stat_sample',
  timestamp,
  actorId: 'player',
  attackPower: 0,
  rangedAttackPower: 0,
  spellPower: 0,
  spellPowerBySchool: {},
  hasteMultiplier: 1,
  ...values,
});

describe('the arithmetic, written out by hand', () => {
  it('weights each window by how long it lasted', () => {
    const totals = new BatchTotals();
    /*
     * 1000 attack power for 10 seconds, then 2000 for 90.
     *
     *   (1000 x 10,000ms + 2000 x 90,000ms) / 100,000ms = 1900
     *
     * The MEAN OF THE SAMPLES would be 1500, which is the wrong answer by 400
     * -- and it is wrong in the direction that flatters a short cooldown.
     */
    totals.emit(sample(0, { attackPower: 1000 }));
    totals.emit(sample(10_000, { attackPower: 2000 }));
    totals.finishIteration(100_000);

    expect(totals.statAverages('player')!.attackPower).toBeCloseTo(1900, 6);
    expect(totals.statAverages('player')!.attackPower).not.toBeCloseTo(1500, 0);
  });

  it('closes the final window at the end of the fight', () => {
    /*
     * A buff that lands at the pull and is never removed emits ONE sample and
     * no closing one, so without `finishIteration` closing the window the
     * whole fight would contribute nothing. This is the same failure that once
     * made Battle Shout read 0% uptime.
     */
    const totals = new BatchTotals();
    totals.emit(sample(0, { attackPower: 1500 }));
    totals.finishIteration(60_000);
    expect(totals.statAverages('player')!.attackPower).toBeCloseTo(1500, 6);
  });

  it('pools across iterations by total time, not by iteration count', () => {
    const totals = new BatchTotals();
    // A long fight at 1000 and a short one at 2000 is NOT 1500: the long fight
    // is three quarters of the time, so the answer is 1250.
    totals.emit(sample(0, { attackPower: 1000 }));
    totals.finishIteration(90_000);
    totals.emit(sample(0, { attackPower: 2000 }));
    totals.finishIteration(30_000);

    expect(totals.statAverages('player')!.attackPower).toBeCloseTo(1250, 6);
  });

  it('averages haste as the MULTIPLIER, so 30% for half a fight is 1.15', () => {
    const totals = new BatchTotals();
    totals.emit(sample(0, { hasteMultiplier: 1 }));
    totals.emit(sample(30_000, { hasteMultiplier: 1.3 }));
    totals.finishIteration(60_000);
    expect(totals.statAverages('player')!.hasteMultiplier).toBeCloseTo(1.15, 10);
  });

  it('says nothing rather than zero for an actor that emitted no samples', () => {
    /*
     * "No samples" and "averaged zero" are different statements, and for spell
     * power on a Warrior the second one is true and the first is not. A caller
     * that cannot tell them apart renders an empty row as a real figure.
     */
    const totals = new BatchTotals();
    totals.finishIteration(60_000);
    expect(totals.statAverages('nobody')).toBeUndefined();
  });

  it('keeps the four stats apart', () => {
    const totals = new BatchTotals();
    totals.emit(
      sample(0, {
        attackPower: 100,
        rangedAttackPower: 200,
        spellPower: 300,
        hasteMultiplier: 1.4,
      }),
    );
    totals.finishIteration(10_000);
    const averages = totals.statAverages('player')!;
    expect(averages.attackPower).toBeCloseTo(100, 6);
    expect(averages.rangedAttackPower).toBeCloseTo(200, 6);
    expect(averages.spellPower).toBeCloseTo(300, 6);
    expect(averages.hasteMultiplier).toBeCloseTo(1.4, 10);
  });
});

// ---------------------------------------------------------------------------

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('the wiring, through a real fight', () => {
  /*
   * SLICE AND DICE IS THE WHOLE POINT OF THIS STATISTIC. It is +30% attack
   * speed and the Venom Rogue keeps it up for most of the fight, so the
   * character's AVERAGE haste is a long way above the character sheet's --
   * which shows the pull, before the Rogue has cast anything at all.
   */
  it('reports a Rogue hasted well above its own character sheet', () => {
    const batch = batchOf('rogue_venom', 12, 4242);
    const stats = batch.stats!;
    expect(stats).toBeDefined();

    // The sheet's figure is 1.0: nothing is hasting a Rogue at the pull.
    expect(stats.hasteMultiplier).toBeGreaterThan(1.05);
    // And it cannot exceed what Slice and Dice alone grants, because that is
    // the only haste in the build -- a figure above it would mean the average
    // was counting something twice.
    expect(stats.hasteMultiplier).toBeLessThanOrEqual(1 + SLICE_AND_DICE_ATTACK_SPEED);
  });

  it('reports attack power at or above the unbuffed character', () => {
    const atPull = characterAtCombatStart(PRESETS_BY_ID.get('rogue_venom')!.build() as never)!;
    const batch = batchOf('rogue_venom', 12, 4242);
    // Buffs only ever add here, so the fight average cannot be below the pull.
    expect(batch.stats!.attackPower).toBeGreaterThanOrEqual(
      atPull.stats.effective.attackPower - 1,
    );
  });

  /*
   * THE PANEL'S TWO HIDING RULES, and they are NOT the same rule.
   *
   * Spell power is genuinely 0 on a melee class, so `> 0` works. Ranged attack
   * power is 50 on EVERY class -- a shared base -- so `!== 0` hides nothing at
   * all, which is what the character sheet uses and what its comment claims
   * keeps the row off nine classes in ten. The Results panel shows it only when
   * it EXCEEDS the melee pool, which is the question a reader is really asking.
   */
  it('has a base 50 ranged attack power on a class that never shoots', () => {
    const warrior = batchOf('two_hand_arms', 6, 7).stats!;
    expect(warrior.spellPower).toBe(0);
    expect(warrior.rangedAttackPower).toBeCloseTo(50, 0);
    // So `!== 0` would show the row, and the panel's rule does not.
    expect(warrior.rangedAttackPower).not.toBe(0);
    expect(warrior.rangedAttackPower).toBeLessThan(warrior.attackPower);
  });

  it('gives a Hunter a ranged pool ABOVE its melee one', () => {
    const hunter = batchOf('lw_ranged', 6, 7).stats!;
    expect(hunter.rangedAttackPower).toBeGreaterThan(hunter.attackPower);
  });

  it('gives a caster spell power and a melee class none', () => {
    expect(batchOf('mage_fire', 6, 7).stats!.spellPower).toBeGreaterThan(0);
    expect(batchOf('rogue_venom', 6, 7).stats!.spellPower).toBe(0);
  });

  it('is the PLAYER’s and not the pet’s', () => {
    /*
     * A pet is a friendly actor with attack power of its own, and the damage
     * breakdown deliberately pools every friendly actor. This does not: the
     * player's attack power and its pet's averaged together would describe
     * nobody, and a Beast Mastery Hunter is where the two differ most.
     */
    const batch = batchOf('bm_hunter', 6, 11);
    const atPull = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build() as never)!;
    expect(batch.representative.actors.some((actor) => actor.kind === 'pet')).toBe(true);
    expect(batch.stats!.rangedAttackPower).toBeGreaterThanOrEqual(
      atPull.stats.effective.rangedAttackPower - 1,
    );
  });

  it('converts haste through the same function the swing timer divides by', () => {
    // Not a new conversion: `hasteMultiplierFrom` is what `applyHaste` uses, so
    // every attack-speed effect in the game is in the average by construction.
    expect(hasteMultiplierFrom({ hasteRating: RATING_PER_PERCENT.haste * 30 } as never)).toBeCloseTo(
      1.3,
      10,
    );
  });
});
