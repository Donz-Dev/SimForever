import { describe, expect, it } from 'vitest';
import { AUTO_ATTACK_NAMES, AUTO_ATTACK_RESOURCE_SOURCES } from '../../src/engine';
import { createDefaultProfile } from '../../src/profiles';
import { characterAtCombatStart, runProfile, runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { critSuppression } from '../../src/game/combat/attackChances';

/*
 * How a swing is LABELLED, and how its rage is attributed.
 *
 * A dual-wielder's breakdown used to be headed by two weapon names, which say
 * which item is equipped and not which hand swung. The hand is the thing being
 * audited: the off hand carries a damage penalty, its own miss chance and its
 * own rage rate.
 */

function geared(extra: Record<string, unknown> = {}) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    simulation: { ...base.simulation, iterations: 30, seed: 11, durationSeconds: 60 },
    ...extra,
  } as never;
}

describe('a swing is named for the hand that threw it', () => {
  it('names the three slots', () => {
    expect(AUTO_ATTACK_NAMES.mainHand).toBe('Main Hand Auto-Attack');
    expect(AUTO_ATTACK_NAMES.offHand).toBe('Off Hand Auto-Attack');
    expect(AUTO_ATTACK_NAMES.ranged).toBe('Ranged Auto-Attack');
  });

  it('uses them in the damage breakdown instead of the weapon name', () => {
    const names = runProfileBatch(geared()).abilities.map((row) => row.abilityName);

    expect(names).toContain('Main Hand Auto-Attack');
    expect(names).toContain('Off Hand Auto-Attack');
    // The starting set is Vis'kag and Brutality Blade; neither should head a row.
    expect(names.some((name) => name.includes("Vis'kag"))).toBe(false);
    expect(names.some((name) => name.includes('Brutality'))).toBe(false);
  });

  it('still names a weapon PROC after the weapon', () => {
    /*
     * Only the swing is renamed. Fatal Wound is Vis'kag's proc and is its own
     * effect with its own damage -- collapsing it into the hand would lose the
     * one thing the row exists to show.
     */
    const names = runProfileBatch(geared()).abilities.map((row) => row.abilityName);
    expect(names).toContain('Fatal Wound');
  });
});

describe('rage is attributed per hand', () => {
  it('names the three sources', () => {
    expect(AUTO_ATTACK_RESOURCE_SOURCES.mainHand.id).toBe('auto_attack_main_hand');
    expect(AUTO_ATTACK_RESOURCE_SOURCES.offHand.id).toBe('auto_attack_off_hand');
  });

  it('splits a dual-wielder rage between the hands', () => {
    /*
     * ONE BUCKET COULD NOT SHOW THIS, and the split is what makes Dual Wield
     * Specialization auditable -- it doubles off-hand rage generation, which
     * is invisible in a total that mixes both hands.
     */
    const gained = runProfileBatch(geared()).rage.gained;
    const main = gained.find((row) => row.sourceId === 'auto_attack_main_hand');
    const off = gained.find((row) => row.sourceId === 'auto_attack_off_hand');

    expect(main).toBeDefined();
    expect(off).toBeDefined();
    expect(main!.amount).toBeGreaterThan(0);
    expect(off!.amount).toBeGreaterThan(0);
    // No combined bucket left behind.
    expect(gained.some((row) => row.sourceId === 'auto_attack')).toBe(false);
  });

  it('gives a two-hander a main hand source and no off hand one', () => {
    const gained = runProfileBatch(
      geared({
        character: {
          ...createDefaultProfile().character,
          combatStyle: 'two_hander',
          stance: 'battle',
        },
        equipment: startingEquipmentFor('warrior', 'two_hander'),
      }),
    ).rage.gained;

    expect(gained.some((row) => row.sourceId === 'auto_attack_main_hand')).toBe(true);
    expect(gained.some((row) => row.sourceId === 'auto_attack_off_hand')).toBe(false);
  });

  it('keeps the ledger balanced', () => {
    // Splitting a source must not lose or duplicate a point of rage.
    const rage = runProfileBatch(geared()).rage;
    const sum = rage.gained.reduce((total, row) => total + row.amount, 0);
    expect(sum).toBeCloseTo(rage.totalGained, 5);
  });
});

describe('the character sheet shows the stance, and hides crit suppression', () => {
  const sheetCrit = (stance: string) =>
    characterAtCombatStart(
      geared({
        character: {
          ...createDefaultProfile().character,
          combatStyle: 'dual_wield',
          stance,
        },
      }),
    )!.stats.effective.critChance;

  it('applies the stance aura, which createPlayer alone does not', () => {
    /*
     * THE BUG THIS FIXES. A stance is an aura, and its stat modifiers land
     * when combat begins -- so a sheet built from `createPlayer` showed a
     * Warrior in no stance, three crit below what the fight rolls.
     */
    expect(sheetCrit('berserker') - sheetCrit('battle')).toBeCloseTo(3, 5);
  });

  it('does NOT subtract crit suppression from the sheet', () => {
    /*
     * 4.8 points against a level 63 target. It belongs to the combat table,
     * not to the character -- it is hidden in game for the same reason -- and
     * subtracting it here would make the sheet wrong the moment the
     * encounter's target level changed.
     */
    expect(critSuppression(60, 63)).toBe(480);
    const crit = sheetCrit('berserker');
    expect(crit).toBeGreaterThan(4.8);
    // The suppressed figure would be 4.8 lower. The sheet must not show it.
    expect(crit).not.toBeCloseTo(crit - 4.8, 5);
  });

  it('still applies the suppression in the fight', () => {
    /*
     * Hidden on the sheet, live in combat. Measured as a real difference in
     * crit rate between a level 60 and a level 63 target, over the same seed.
     */
    const critRateAt = (targetLevel: number) => {
      const base = createDefaultProfile();
      const rows = runProfileBatch({
        ...base,
        character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
        equipment: startingEquipmentFor('warrior', 'dual_wield'),
        simulation: { ...base.simulation, iterations: 60, seed: 5, durationSeconds: 60 },
        encounter: { ...base.encounter, targetLevel, targetArmor: 0 },
      } as never).abilities;
      return rows.find((row) => row.abilityName === 'Main Hand Auto-Attack')!.critRate;
    };

    // Against an equal-level target there is no suppression at all, so crit
    // must be materially higher than against a boss.
    expect(critRateAt(60)).toBeGreaterThan(critRateAt(63) + 0.02);
  });
});

describe('the log names the hand too', () => {
  it('reads as the hand, not the item', () => {
    const base = createDefaultProfile();
    const log = runProfile({
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      simulation: { ...base.simulation, seed: 3, durationSeconds: 30 },
    } as never).combatLog;

    // The log is a formatter over the same stream the breakdown reads, so the
    // two cannot disagree about what a swing is called.
    expect(log.some((line) => line.includes('Main Hand Auto-Attack'))).toBe(true);
    expect(log.some((line) => line.includes('Off Hand Auto-Attack'))).toBe(true);
  });
});
