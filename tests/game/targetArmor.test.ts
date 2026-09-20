import { describe, expect, it } from 'vitest';
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
    expect(armorOptions(3731).map((option) => option.value)).toEqual([4638, 3731, 3009]);
  });

  it('labels each option with the number and nothing else', () => {
    /*
     * Deliberately bare. The panel once printed the damage reduction beside
     * each figure; the ruleset owner asked for the number alone, and there is
     * nothing else true to say -- nothing states which boss or tier any of the
     * three is.
     */
    for (const option of armorOptions(3731)) {
      expect(option.label).not.toContain('%');
      expect(option.label.replace(/\D/g, '')).toBe(String(option.value));
    }
  });

  it('keeps an armor value the list does not know about', () => {
    /*
     * A profile written before the dropdown existed can hold any number. A
     * select whose value matches no option renders blank and reports the first
     * option on the next change, which would silently rewrite the encounter.
     */
    const options = armorOptions(4000);
    expect(options.map((option) => option.value)).toEqual([4638, 4000, 3731, 3009]);
  });
});
