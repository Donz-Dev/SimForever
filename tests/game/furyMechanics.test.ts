import { describe, expect, it } from 'vitest';
import { toSeconds } from '../../src/engine';
import {
  ANGER_MANAGEMENT_INTERVAL_MS,
  ANGER_MANAGEMENT_MAX_START_OFFSET_MS,
  ANGER_MANAGEMENT_RAGE_PER_TICK,
} from '../../src/game/auras/warrior';
import { OFF_HAND_DAMAGE_MULTIPLIER } from '../../src/game/actors/weapons';
import { WHIRLWIND_OFF_HAND_NAME } from '../../src/game/abilities/warrior';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { createDefaultProfile } from '../../src/profiles';
import { characterAtCombatStart, runProfile, runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { legalise } from '../helpers/legalTalents';

/*
 * Three Fury mechanics, written out by hand from the ruleset owner's
 * instructions and cross-checked against the captured per-rank values.
 */

function profile(talents: Record<string, number> = {}, extra: Record<string, unknown> = {}) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    talents,
    simulation: { ...base.simulation, iterations: 60, seed: 19, durationSeconds: 60 },
    ...extra,
  } as never;
}

// ---------------------------------------------------------------------------
// Anger Management
// ---------------------------------------------------------------------------

describe('Anger Management', () => {
  it('is one rage every three seconds', () => {
    expect(ANGER_MANAGEMENT_RAGE_PER_TICK).toBe(1);
    expect(toSeconds(ANGER_MANAGEMENT_INTERVAL_MS)).toBe(3);
  });

  it('starts somewhere in the first three seconds, not at a fixed moment', () => {
    /*
     * A passive on its own timer did not start that timer when the pull did.
     * Every fight ticking first at exactly 3000ms would give an extra rage to
     * fights of one length and not another, and tighten the distribution
     * around a fiction.
     */
    expect(ANGER_MANAGEMENT_MAX_START_OFFSET_MS).toBe(3000);

    const firstTick = (seed: number) => {
      const result = runProfile(
        profile(legalise({ anger_management: 1 }), {
          simulation: { ...createDefaultProfile().simulation, seed, durationSeconds: 30 },
        }),
      );
      const tick = result.timeline.find(
        (event) => event.type === 'resource_gained' && event.source === 'anger_management',
      );
      return tick?.timestamp;
    };

    const firsts = [1, 2, 3, 4, 5, 6].map(firstTick);
    for (const at of firsts) {
      expect(at).toBeDefined();
      expect(at!).toBeGreaterThanOrEqual(1);
      expect(at!).toBeLessThanOrEqual(ANGER_MANAGEMENT_MAX_START_OFFSET_MS);
    }
    // Rolled, not fixed: six seeds must not all land on the same millisecond.
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });

  it('delivers about twenty rage over a sixty second fight', () => {
    // 60 / 3 is twenty ticks of one rage, give or take where the first landed.
    const gained = runProfileBatch(profile(legalise({ anger_management: 1 }))).rage.gained;
    const anger = gained.find((row) => row.sourceId === 'anger_management');

    expect(anger).toBeDefined();
    expect(anger!.amount).toBeGreaterThan(18);
    expect(anger!.amount).toBeLessThanOrEqual(21);
  });

  it('grants nothing without the talent', () => {
    const gained = runProfileBatch(profile()).rage.gained;
    expect(gained.some((row) => row.sourceId === 'anger_management')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dual Wield Specialization
// ---------------------------------------------------------------------------

describe('Dual Wield Specialization', () => {
  const offHand = (ranks: number) =>
    characterAtCombatStart(
      profile(ranks > 0 ? legalise({ dual_wield_specialization: ranks }) : {}),
    )!;

  it('takes off-hand damage from half to five eighths at 5/5', () => {
    /*
     * The ruleset owner's figure, and the captured rank values agree: +25% on
     * top of the base half, so 0.5 becomes 0.625.
     */
    expect(OFF_HAND_DAMAGE_MULTIPLIER).toBe(0.5);
    expect(offHand(0).weapons.offHand?.damageMultiplier).toBe(0.5);
    expect(offHand(5).weapons.offHand?.damageMultiplier).toBeCloseTo(0.625, 10);
  });

  it('doubles off-hand rage generation at 5/5', () => {
    const plain = offHand(0).weapons.offHand?.generates?.perDamage ?? 0;
    const talented = offHand(5).weapons.offHand?.generates?.perDamage ?? 0;
    expect(plain).toBeGreaterThan(0);
    expect(talented).toBeCloseTo(plain * 2, 10);
  });

  it('gives ten points of hit to the off hand and NONE to the main hand', () => {
    /*
     * The reason this needed a per-slot mechanism. Folding it into the
     * character-wide hit stat would have handed the main hand ten free points
     * -- a third of the talent applied to the wrong weapon.
     */
    expect(offHand(5).hitBonusFor('offHand')).toBe(10);
    expect(offHand(5).hitBonusFor('mainHand')).toBe(0);
    expect(offHand(0).hitBonusFor('offHand')).toBe(0);
  });

  it('scales all three clauses per rank, from captured values', () => {
    // [5,20,2] .. [25,100,10]. Written out by hand from the values file's own
    // numbers rather than computed from the rank.
    const build = (ranks: number) =>
      talentBuild('warrior', legalise({ dual_wield_specialization: ranks }));

    expect(build(1).offHandDamageMultiplier).toBeCloseTo(1.05, 10);
    expect(build(1).offHandResourceMultiplier).toBeCloseTo(1.2, 10);
    expect(build(1).offHandHitBonus).toBe(2);

    expect(build(3).offHandDamageMultiplier).toBeCloseTo(1.15, 10);
    expect(build(3).offHandResourceMultiplier).toBeCloseTo(1.6, 10);
    expect(build(3).offHandHitBonus).toBe(6);

    expect(build(5).offHandDamageMultiplier).toBeCloseTo(1.25, 10);
    expect(build(5).offHandResourceMultiplier).toBeCloseTo(2, 10);
    expect(build(5).offHandHitBonus).toBe(10);
  });

  it('shows up as a lower off-hand miss chance in the fight', () => {
    // The GUI reads this same provider per hand, so a change here is a change
    // on the character sheet.
    const missRate = (ranks: number) => {
      const rows = runProfileBatch(
        profile(ranks ? legalise({ dual_wield_specialization: ranks }) : {}),
      ).abilities;
      return rows.find((row) => row.abilityName === 'Off Hand Auto-Attack')!.avoidRate;
    };
    expect(missRate(5)).toBeLessThan(missRate(0) - 0.05);
  });

  it('is no longer reported as unmodelled', () => {
    const kinds = WARRIOR_TALENT_EFFECTS.dual_wield_specialization.map((e) => e.kind);
    expect(kinds).not.toContain('unmodelled');
    expect(kinds).toEqual(['offHandDamage', 'offHandResourceGeneration', 'offHandHit']);
  });
});

// ---------------------------------------------------------------------------
// Raging Blows
// ---------------------------------------------------------------------------

describe('Raging Blows', () => {
  it('gives Whirlwind a second strike with the off hand', () => {
    const names = (talents: Record<string, number>) =>
      runProfileBatch(profile(talents)).abilities.map((row) => row.abilityName);

    expect(names({})).not.toContain(WHIRLWIND_OFF_HAND_NAME);
    expect(names(legalise({ raging_blows: 1 }))).toContain(WHIRLWIND_OFF_HAND_NAME);
  });

  it('lands the off-hand strike as often as the main-hand one', () => {
    // One cast, two strikes. Attempts must match, or the second strike is
    // being skipped on some casts.
    const rows = runProfileBatch(profile(legalise({ raging_blows: 1 }))).abilities;
    const main = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const off = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    expect(off.attempts).toBeCloseTo(main.attempts, 5);
  });

  it('carries the off-hand DAMAGE penalty', () => {
    /*
     * Half the main hand's average, untalented, because the penalty is the
     * off-hand weapon's own `damageMultiplier` -- the same one an auto attack
     * uses. Not exact: the two hands hold different weapons.
     */
    const rows = runProfileBatch(profile(legalise({ raging_blows: 1 }))).abilities;
    const main = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const off = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    expect(off.average).toBeLessThan(main.average);
    expect(off.average).toBeGreaterThan(main.average * 0.3);
  });

  it('does NOT carry the off-hand miss penalty', () => {
    /*
     * A special, not a swing. The dual-wield miss penalty lives only in the
     * `melee-auto` table, so the off-hand Whirlwind should be avoided at
     * roughly the rate the MAIN-HAND Whirlwind is -- and far less often than
     * an off-hand auto attack.
     */
    const rows = runProfileBatch(profile(legalise({ raging_blows: 1 }))).abilities;
    const mainWhirl = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const offWhirl = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    const offAuto = rows.find((row) => row.abilityName === 'Off Hand Auto-Attack')!;

    expect(offWhirl.avoidRate).toBeLessThan(offAuto.avoidRate - 0.1);
    expect(Math.abs(offWhirl.avoidRate - mainWhirl.avoidRate)).toBeLessThan(0.05);
  });

  it('benefits from Dual Wield Specialization, which it feeds off', () => {
    const average = (talents: Record<string, number>) => {
      const rows = runProfileBatch(profile(talents)).abilities;
      return rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!.average;
    };
    const plain = average(legalise({ raging_blows: 1 }));
    const specced = average(legalise({ raging_blows: 1, dual_wield_specialization: 5 }));
    // 0.5 to 0.625 is a quarter more per landed strike.
    expect(specced).toBeGreaterThan(plain * 1.15);
  });

  it('still reports the Cleave half as unmodelled', () => {
    /*
     * Honest about the part that is missing. The two-rage reduction has no
     * captured value -- the talent is single-rank, so its values entry is
     * null and the number exists only in the tooltip's prose.
     */
    const reasons = WARRIOR_TALENT_EFFECTS.raging_blows
      .filter((effect) => effect.kind === 'unmodelled')
      .map((effect) => (effect as { reason: string }).reason);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('Cleave');
  });
});

// ---------------------------------------------------------------------------
// Blood Craze and Enrage: the ruleset owner's item 4
// ---------------------------------------------------------------------------

describe('Blood Craze and Enrage stay tied to being attacked', () => {
  it('leaves Enrage inert when nothing attacks the player', () => {
    /*
     * ALREADY THE CASE, pinned rather than changed. Enrage is a reaction to
     * being hit, so a fight where the target stands still can never trigger
     * it -- which is exactly the ruleset owner's instruction to ignore it
     * unless the encounter is set up to take damage.
     */
    const result = runProfileBatch(profile(legalise({ enrage: 5 })));
    expect(result.buffUptime.some((row) => row.auraName.includes('Enrage'))).toBe(false);
  });

  it('brings Enrage to life when the target swings back', () => {
    const base = createDefaultProfile();
    const result = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'one_hand_shield', stance: 'defensive' },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      talents: legalise({ enrage: 5 }),
      simulation: { ...base.simulation, iterations: 40, seed: 21, durationSeconds: 60 },
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);

    expect(result.buffUptime.some((row) => row.auraName.includes('Enrage'))).toBe(true);
  });

  it('keeps Blood Craze reported as unmodelled, for a stated reason', () => {
    // Healing is not observable: the character cannot drop below one health.
    const reasons = WARRIOR_TALENT_EFFECTS.blood_craze
      .filter((effect) => effect.kind === 'unmodelled')
      .map((effect) => (effect as { reason: string }).reason);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/health|heal/i);
  });
});
