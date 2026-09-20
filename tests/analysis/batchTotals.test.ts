import { describe, expect, it } from 'vitest';
import { runProfileBatch } from '../../src/simulator';
import { createDefaultProfile } from '../../src/profiles';
import { startingEquipmentFor } from '../../src/game/items/startingSets';

/*
 * A batch reports an AVERAGE OVER EVERY ITERATION, not one iteration's numbers.
 *
 * It used to read the breakdown off the iteration whose DPS landed nearest the
 * median. That is reasonable beside a combat log and useless for auditing a
 * talent: one hundred-second fight lands about forty main-hand swings, so its
 * crit rate was a forty-sample estimate and a talent's effect is smaller than
 * the gap between neighbouring iterations.
 */

function batch(talents: Record<string, number> = {}, iterations = 120) {
  const base = createDefaultProfile();
  return runProfileBatch({
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield' },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    talents,
    simulation: { ...base.simulation, iterations, seed: 31 },
  } as never);
}

describe('a batch averages every iteration', () => {
  it('reports mean damage consistent with mean DPS and duration', () => {
    const b = batch();
    // damage = dps * seconds, and both are means over the same iterations.
    expect(b.meanDamage / (b.meanDurationMs / 1000)).toBeCloseTo(b.dps.mean, 4);
  });

  it('does not report the representative iteration as the total', () => {
    /*
     * The bug this replaces. The representative is ONE fight, so its total is
     * a sample and the mean is not -- they agree only by coincidence. Asserted
     * as "not identical" rather than "far apart", because on a low-variance
     * build they can be close and the point is that they are different numbers
     * from different populations.
     */
    const b = batch();
    expect(b.meanDamage).not.toBe(b.representative.damage.total);
  });

  it('pools ability rates over the batch, not over one fight', () => {
    const b = batch();
    const main = b.abilities.find((a) => a.abilityName.includes("Vis'kag"));
    expect(main).toBeDefined();
    // Over 120 fights a crit rate settles near the character sheet's figure.
    // A single fight's estimate swings several points either way.
    expect(main!.critRate).toBeGreaterThan(0.1);
    expect(main!.critRate).toBeLessThan(0.3);
    // Attempts are a per-iteration mean, so a 100s fight with a 2.6s weapon is
    // tens of swings, not thousands.
    expect(main!.attempts).toBeGreaterThan(20);
    expect(main!.attempts).toBeLessThan(60);
  });

  it('sums ability shares to one', () => {
    const b = batch();
    const total = b.abilities.reduce((sum, a) => sum + a.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe('rage is attributed to a source', () => {
  it('accounts for every point gained and spent', () => {
    const b = batch();
    // Nothing unattributed: every grantResource call in the repo names itself.
    expect(b.rage.gained.some((r) => r.sourceId === 'unattributed')).toBe(false);
    expect(b.rage.spent.some((r) => r.sourceId === 'unattributed')).toBe(false);
    expect(b.rage.totalGained).toBeGreaterThan(0);
    expect(b.rage.totalSpent).toBeGreaterThan(0);
  });

  it('names auto attack as the source of a standing warrior rage', () => {
    // Nothing is hitting back, so damage taken cannot contribute.
    const b = batch();
    expect(b.rage.gained.map((r) => r.sourceId)).toContain('auto_attack');
    expect(b.rage.gained.map((r) => r.sourceId)).not.toContain('damage_taken');
  });

  /*
   * THE POINT OF THE WHOLE BREAKDOWN. Improved Heroic Strike reduces a cost,
   * and a cost reduction is invisible in a damage table -- the ability hits for
   * the same amount. It shows up here as the same uses at a lower price, which
   * is what makes the talent auditable at all.
   */
  it('shows a cost-reduction talent as a lower price per use', () => {
    const perUse = (talents: Record<string, number>) => {
      const hs = batch(talents).rage.spent.find((r) => r.sourceId === 'heroic_strike');
      return hs && hs.count > 0 ? hs.amount / hs.count : NaN;
    };
    // Heroic Strike costs 15; the talent takes a rage a rank.
    expect(perUse({})).toBeCloseTo(15, 5);
    expect(perUse({ improved_heroic_strike: 1 })).toBeCloseTo(14, 5);
    expect(perUse({ improved_heroic_strike: 3 })).toBeCloseTo(12, 5);
  });
});

describe('damage taken is broken out separately', () => {
  it('is empty when nothing attacks the player', () => {
    const b = batch();
    expect(b.damageTaken).toEqual([]);
  });

  it('reports the outcomes only an attacks-received table can produce', () => {
    /*
     * B2's answer: parry, dodge and block appear ONLY on attacks the player
     * receives, so no amount of staring at the damage-done table shows whether
     * a parry talent did anything.
     */
    const base = createDefaultProfile();
    const b = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'one_hand_shield' },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      simulation: { ...base.simulation, iterations: 60, seed: 8 },
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);

    expect(b.damageTaken.length).toBeGreaterThan(0);
    const swings = b.damageTaken[0];
    expect(swings.attempts).toBeGreaterThan(0);
    // A shield warrior being attacked blocks and dodges.
    const anyAvoidance =
      (swings.rates.dodge ?? 0) + (swings.rates.block ?? 0) + (swings.rates.miss ?? 0);
    expect(anyAvoidance).toBeGreaterThan(0);
  });
});
