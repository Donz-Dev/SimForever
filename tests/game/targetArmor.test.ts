import { describe, expect, it } from 'vitest';
import { armorReduction } from '../../src/engine';
import {
  createTrainingDummy,
  RAID_BOSS_ARMOR,
  TARGET_ARMOR_OPTIONS,
} from '../../src/game/actors/createTrainingDummy';
import { armorOptions } from '../../src/ui/panels/EncounterPanel';
import { createDefaultProfile } from '../../src/profiles';

/*
 * Target armor is a choice between three figures given by the ruleset owner,
 * written out by hand here rather than read back from the list that defines
 * them.
 */

describe('the three target armor values', () => {
  it('offers exactly 4638, 3731 and 3009', () => {
    expect([...TARGET_ARMOR_OPTIONS]).toEqual([4638, 3731, 3009]);
  });

  it('defaults to 3731', () => {
    expect(RAID_BOSS_ARMOR).toBe(3731);
    expect(TARGET_ARMOR_OPTIONS).toContain(RAID_BOSS_ARMOR);
    expect(createDefaultProfile().encounter.targetArmor).toBe(3731);
    expect(createTrainingDummy().stats.get('armor')).toBe(3731);
  });

  it('is descending, so the list reads as a scale', () => {
    const sorted = [...TARGET_ARMOR_OPTIONS].sort((a, b) => b - a);
    expect([...TARGET_ARMOR_OPTIONS]).toEqual(sorted);
  });

  it('is honoured by the target that is built from it', () => {
    for (const armor of TARGET_ARMOR_OPTIONS) {
      expect(createTrainingDummy({ armor }).stats.get('armor')).toBe(armor);
    }
  });
});

describe('the armor dropdown', () => {
  it('lists the three, in order', () => {
    expect(armorOptions(3731, 63).map((option) => option.value)).toEqual([4638, 3731, 3009]);
  });

  it('states the reduction the simulation will actually apply', () => {
    /*
     * The percentage is derived, not written down, so it cannot disagree with
     * the engine. Computed here from the same function the panel calls, but
     * checked against a hand figure too: 3731 armor at level 63 is the
     * familiar just-under-40%.
     */
    const at63 = armorOptions(3731, 63);
    expect(at63[1].label).toContain('39.3% reduced');
    expect(at63[0].label).toContain('4,638');

    for (const option of at63) {
      const expected = `${(armorReduction(option.value, 63) * 100).toFixed(1)}% reduced`;
      expect(option.label).toContain(expected);
    }
  });

  it('moves with the target level', () => {
    // The same armor is worth less against a higher-level target, and the
    // label has to follow or it becomes a lie about the fight being run.
    const [, at60] = armorOptions(3731, 60);
    const [, at63] = armorOptions(3731, 63);
    expect(at60.label).not.toBe(at63.label);
  });

  it('keeps an armor value the list does not know about', () => {
    /*
     * A profile written before the dropdown existed can hold any number. A
     * select whose value matches no option renders blank and reports the first
     * option on the next change, which would silently rewrite the encounter.
     */
    const options = armorOptions(4000, 63);
    expect(options.map((option) => option.value)).toEqual([4638, 4000, 3731, 3009]);
    expect(options[1].label).toContain('from profile');
  });

  it('marks only the unknown one', () => {
    for (const option of armorOptions(3009, 63)) {
      expect(option.label).not.toContain('from profile');
    }
  });
});
