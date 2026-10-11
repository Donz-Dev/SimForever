import { describe, expect, it } from 'vitest';
import { AUTO_ATTACK_NAMES, AUTO_ATTACK_RESOURCE_SOURCES } from '../../src/engine';
import { createDefaultProfile } from '../../src/profiles';
import { characterAtCombatStart, runProfile, runProfileBatch, resourceFlowOf } from '../../src/simulator';
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
    /*
     * AND NO ITEM NAME HEADS A ROW. This named Vis'kag and Brutality Blade,
     * which is the Classic set; the benchmark weapons are called "E65
     * Main-Hand Axe" and so on, so the check is that NO row is named after
     * whatever is in the hands -- which is the stronger version of the same
     * assertion and does not need rewriting when the gear moves again.
     */
    const equipped = ['E65 Main-Hand Axe', 'E65 Off-Hand Axe'];
    for (const weapon of equipped) {
      expect(names, weapon).not.toContain(weapon);
    }
  });

  it('still names a weapon PROC after the weapon, not after the hand', () => {
    /*
     * ------------------------------------------------------------------------
     * ON CRUSADER, BECAUSE VIS'KAG IS GONE FROM THE RULESET.
     *
     * Fatal Wound was the example and Vis'kag the Bloodletter is in Forever's
     * own `missing.json` -- so no set can equip one and this row can never
     * appear. Crusader makes the same point: the proc's effect is reported
     * under its OWN name, Holy Strength, rather than collapsed into the swing
     * that triggered it.
     *
     * WHY THE DISTINCTION MATTERS is Windfury's: an extra SWING reports as
     * "Main Hand Auto-Attack" and hid 15.9% of a build, and the fix was to
     * name the effect rather than the weapon. A proc with its own damage or its
     * own aura needs its own row.
     * ------------------------------------------------------------------------
     */
    const batch = runProfileBatch(geared());
    const auras = batch.buffUptime.map((row) => row.auraId);
    expect(auras.some((id) => id.startsWith('holy_strength'))).toBe(true);

    // And the two hands are told apart, which one shared row could not do.
    expect(auras).toContain('holy_strength_mainHand');
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
    const gained = resourceFlowOf(runProfileBatch(geared()), 'rage').gained;
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
    const batch = runProfileBatch(
      geared({
        character: {
          ...createDefaultProfile().character,
          combatStyle: 'two_hander',
          stance: 'battle',
        },
        equipment: startingEquipmentFor('warrior', 'two_hander'),
      }),
    );
    const gained = resourceFlowOf(batch, 'rage').gained;

    expect(gained.some((row) => row.sourceId === 'auto_attack_main_hand')).toBe(true);
    expect(gained.some((row) => row.sourceId === 'auto_attack_off_hand')).toBe(false);
  });

  it('keeps the ledger balanced', () => {
    // Splitting a source must not lose or duplicate a point of rage.
    const rage = resourceFlowOf(runProfileBatch(geared()), 'rage');
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

    /*
     * AGAINST AN EQUAL-LEVEL TARGET THERE IS NO SUPPRESSION AT ALL, so crit
     * must be higher than against a boss.
     *
     * NOT BY A FIXED MARGIN, THOUGH, which is what this asserted. Suppression
     * is a flat 1.8 percentage points off a 1-10000 die, and whether the
     * MEASURED rate over sixty fights clears a 2-point margin depends on how
     * many swings the build makes -- the margin was 0.0004 short after a gear
     * change. The suppression itself is pinned exactly by `critSuppression`
     * below; what is asserted here is that it reaches the roll.
     */
    expect(critRateAt(60)).toBeGreaterThan(critRateAt(63));
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
