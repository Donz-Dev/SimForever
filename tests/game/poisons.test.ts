import { describe, expect, it } from 'vitest';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  DEADLY_POISON_CHANCE,
  DEFAULT_POISON_LOADOUT,
  INSTANT_POISON_CHANCE,
  INSTANT_POISON_DAMAGE,
  poisonTalentBonuses,
} from '../../src/game/reactions/poisons';
import {
  DEADLY_POISON_DAMAGE_PER_STACK,
  DEADLY_POISON_MAX_STACKS,
  DEADLY_POISON_TICKS,
  deadlyPoisonAura,
} from '../../src/game/auras/rogue';
import {
  DEADLY_POISON_TICK_AP_COEFFICIENT,
  INSTANT_POISON_AP_COEFFICIENT,
} from '../../src/game/combat/coefficients';

/*
 * ==============================================================================
 * POISONS, written out by hand from the spellbook capture and the owner's
 * rulings rather than read back out of the code under test.
 *
 *   Instant Poison r6  "Each strike has a 20% chance of poisoning the enemy
 *                       which instantly inflicts 76 to 100 Nature damage."
 *   Deadly Poison r5   "Each strike has a 30% chance of poisoning the enemy
 *                       for 92 Nature damage over 12 sec. Stacks up to 5
 *                       times on a single target."
 *
 * The owner's readings, given when asked: Deadly is 92 x 5 = 460 over twelve
 * seconds at full stacks, ticking every three seconds for 115; a poison proc is
 * NOT a weapon use but IS triggered by one; and charges are infinite.
 * ==============================================================================
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('the numbers, from the capture', () => {
  it('states the two chances and Instant Poison’s damage', () => {
    expect(INSTANT_POISON_CHANCE).toBe(0.2);
    expect(DEADLY_POISON_CHANCE).toBe(0.3);
    // The midpoint of "76 to 100"; the combat table supplies the spread.
    expect(INSTANT_POISON_DAMAGE).toBe(88);
  });

  it('carries the sheet’s coefficients', () => {
    expect(INSTANT_POISON_AP_COEFFICIENT).toBe(0.005);
    expect(DEADLY_POISON_TICK_AP_COEFFICIENT).toBe(0.0045);
  });

  it('makes a full stack 460 over twelve seconds, ticking 115', () => {
    /*
     * The owner's arithmetic, reproduced: 92 a stack, five stacks, four ticks.
     * The ALTERNATIVE reading -- 92 as the total, with stacks only refreshing
     * it -- is five times smaller and equally consistent with the wording, so
     * this is asserted rather than left implied.
     */
    expect(DEADLY_POISON_DAMAGE_PER_STACK * DEADLY_POISON_MAX_STACKS).toBe(460);
    expect(DEADLY_POISON_TICKS).toBe(4);
    expect((DEADLY_POISON_DAMAGE_PER_STACK * DEADLY_POISON_MAX_STACKS) / DEADLY_POISON_TICKS).toBe(
      115,
    );
  });

  it('stacks to five and lasts twelve seconds', () => {
    const aura = deadlyPoisonAura();
    expect(aura.maxStacks).toBe(5);
    expect(aura.durationMs).toBe(12_000);
    expect(aura.periodic?.intervalMs).toBe(3000);
  });
});

describe('the talents that reach poisons', () => {
  it('Vile Poisons is +20% damage at five points, and nothing at none', () => {
    expect(poisonTalentBonuses({ vile_poisons: 5 }).damageMultiplier).toBeCloseTo(1.2, 6);
    expect(poisonTalentBonuses({ vile_poisons: 3 }).damageMultiplier).toBeCloseTo(1.12, 6);
    expect(poisonTalentBonuses({}).damageMultiplier).toBe(1);
    expect(poisonTalentBonuses(undefined).damageMultiplier).toBe(1);
  });

  it('Improved Poisons ADDS ten points of chance, it does not multiply', () => {
    /*
     * 20% to 30%, not 20% to 22%. Both readings are plausible and one is worth
     * half the other, which is exactly the shape of thing this project writes
     * a test for.
     */
    expect(poisonTalentBonuses({ improved_poisons: 5 }).extraChance).toBeCloseTo(0.1, 6);
    expect(INSTANT_POISON_CHANCE + poisonTalentBonuses({ improved_poisons: 5 }).extraChance)
      .toBeCloseTo(0.3, 6);
  });
});

describe('poisons in a real fight', () => {
  /*
   * MEASURED, not declared. A reaction that is built but never wired to the
   * character produces no error and no damage -- which is how five Rogue
   * talents sat inert for months.
   */
  const batch = batchOf('rogue_venom', 40, 12345);
  const rows = batch.abilities.filter((ability) => /Poison/.test(ability.abilityName));

  it('both poisons actually land', () => {
    const names = rows.map((row) => row.abilityName).sort();
    expect(names).toEqual(['Deadly Poison', 'Instant Poison']);
    for (const row of rows) expect(row.damage, row.abilityName).toBeGreaterThan(0);
  });

  it('is a large share of a poison build’s damage', () => {
    /*
     * Deliberately a floor rather than a figure: the exact share moves with
     * every coefficient and rotation change, and pinning it would make this
     * test a tripwire for unrelated work. What must stay true is that poisons
     * are a major source rather than a rounding error -- the Venom build spends
     * eleven talent points on them.
     */
    const total = batch.abilities.reduce((sum, ability) => sum + ability.damage, 0);
    const fromPoison = rows.reduce((sum, row) => sum + row.damage, 0);
    expect(fromPoison / total).toBeGreaterThan(0.1);
  });

  it('DOES NOT CHAIN: a poison never triggers another poison', () => {
    /*
     * The owner's ruling is that a poison proc is not a weapon use. If it were,
     * each poison hit would roll both poisons again and the count would run
     * away -- so the check is that poison applications stay BELOW the number of
     * real weapon strikes, which they cannot do if they feed themselves.
     */
    const weaponStrikes = batch.abilities
      .filter((ability) => /Auto-Attack|Mutilate|Sinister Strike/.test(ability.abilityName))
      .reduce((sum, ability) => sum + ability.attempts, 0);
    const poisonHits = rows.reduce((sum, row) => sum + row.attempts, 0);
    expect(poisonHits).toBeGreaterThan(0);
    expect(poisonHits).toBeLessThan(weaponStrikes);
  });
});

describe('the loadout', () => {
  it('defaults to Instant on the main hand and Deadly on the off hand', () => {
    expect(DEFAULT_POISON_LOADOUT).toEqual({
      mainHand: 'instant_poison',
      offHand: 'deadly_poison',
    });
  });

  it('SWAPPING THEM CHANGES THE RESULT, which is what makes the control real', () => {
    /*
     * Deadly on the main hand and Instant on the off hand is a different
     * fight: the hands swing at different speeds and the two poisons have
     * different chances, so the same pair the other way round cannot come out
     * the same. A control that changed nothing would look identical to a
     * control that was not wired up.
     */
    const built = PRESETS_BY_ID.get('rogue_venom')!.build();
    const swapped = runProfileBatch({
      ...built,
      poisons: { mainHand: 'deadly_poison', offHand: 'instant_poison' },
      simulation: { ...built.simulation, iterations: 40, seed: 12345 },
    } as never);

    expect(swapped.dps.mean).not.toBeCloseTo(batchOf('rogue_venom', 40, 12345).dps.mean, 1);
  });
});
