import { describe, expect, it } from 'vitest';
import { RATING_PER_PERCENT, STAT_NAMES } from '../../src/engine';
import type { StatName } from '../../src/engine';
import { scoreItem, scoreStats, unitsOf } from '../../src/game/items/itemValue';
import {
  PLACEHOLDER_PREFERRED_WEIGHT,
  STAT_FOR_BENCH_STAT,
  defaultValuationForName,
  defaultValuationForPreset,
  templateIdFor,
} from '../../src/game/items/defaultValuation';
import { BENCHMARK_TEMPLATES, BENCHMARK_TEMPLATES_BY_PRESET } from '../../src/game/items/benchmarkSets';
import { WEIGHTABLE_STATS } from '../../src/simulator/statWeights';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * THE UNIT AGREEMENT IS THE TEST THAT MATTERS.
 *
 * A valuation is keyed by `StatName` and its unit is "one displayed unit" --
 * the SAME unit a stat-weight run reports, so pressing "use these weights"
 * after a run is a copy rather than a conversion. The two tables live in two
 * layers that may not import each other (`game` is below `simulator`), so
 * nothing in the type system holds them together.
 *
 * THIS IS WHAT HOLDS THEM TOGETHER. If `WeightableStat.statPerUnit` ever
 * disagrees with `unitsOf`, a measured weight pasted into a valuation would be
 * out by a factor of fourteen on crit and ten on haste -- which sorts a slot
 * wrongly and reads as a perfectly ordinary number.
 * ==============================================================================
 */
describe('a valuation is in the stat-weight run s own units', () => {
  it.each(WEIGHTABLE_STATS.map((stat) => [stat.id, stat] as const))(
    '%s converts the same way in both tables',
    (_id, stat) => {
      // One displayed unit of the stat, through each table's own conversion.
      expect(unitsOf(stat.id, stat.statPerUnit)).toBeCloseTo(1, 10);
    },
  );

  it('prices the two ratings per percentage point and everything else per point', () => {
    expect(unitsOf('critRating', RATING_PER_PERCENT.crit)).toBeCloseTo(1, 10);
    expect(unitsOf('hasteRating', RATING_PER_PERCENT.haste)).toBeCloseTo(1, 10);
    expect(unitsOf('strength', 30)).toBe(30);
    // `hitChance` is already a percentage POINT by the time the item parser is
    // finished with it -- "+14 Hit Rating" becomes 1.4 -- so it converts by one
    // and NOT by `RATING_PER_PERCENT.hit`. Scoring the engine stats raw would
    // make a point of crit worth ten times a point of hit for no reason
    // anybody chose, which is the whole thing `unitsOf` exists to undo.
    expect(unitsOf('hitChance', 1.4)).toBe(1.4);
  });
});

describe('the two attack power pools are one purchase', () => {
  /*
   * The owner's ruling is that a bare "+40 Attack Power" line reaches BOTH
   * melee and ranged attack power, so 164 item lines set the two fields to the
   * same number. Pricing them independently doubles every one of them -- a
   * bigger number and no error, which is this project's commonest shape of
   * wrong.
   */
  it('prices a line that grants both pools once', () => {
    const both = { attackPower: 40, rangedAttackPower: 40 };
    expect(scoreStats(both, { attackPower: 1 })).toBe(40);
    expect(scoreStats(both, { rangedAttackPower: 1 })).toBe(40);
    expect(scoreStats(both, { attackPower: 1, rangedAttackPower: 1 })).toBe(40);
  });

  it('prices a ranged-only line for a build that wants ranged, and not otherwise', () => {
    const rangedOnly = { rangedAttackPower: 36 };
    expect(scoreStats(rangedOnly, { rangedAttackPower: 1 })).toBe(36);
    expect(scoreStats(rangedOnly, { attackPower: 1 })).toBe(0);
  });

  it('still prices a melee-only line, and only for a build that wants melee', () => {
    expect(scoreStats({ attackPower: 40 }, { attackPower: 1 })).toBe(40);
    /*
     * THE OWNER'S RULING READ BACKWARDS IS THE BUG THIS CAUGHT. "Melee Attack
     * Power NEVER reaches Ranged Attack Power", so a Hunter gains nothing from
     * a melee-only line -- and the first version of `scoreStats` took the
     * larger of the two weights unconditionally, which paid it in full.
     */
    expect(scoreStats({ attackPower: 40 }, { rangedAttackPower: 1 })).toBe(0);
  });

  it('takes the larger of the two weights, not their sum', () => {
    expect(scoreStats({ attackPower: 10, rangedAttackPower: 10 }, { attackPower: 2, rangedAttackPower: 3 })).toBe(30);
  });
});

describe('scoring an item', () => {
  it('ignores a stat the valuation does not name', () => {
    expect(scoreStats({ spirit: 100 }, { strength: 1 })).toBe(0);
  });

  it('folds school-scoped spell power into the spell power weight', () => {
    /*
     * "Increases damage done by Shadow spells by up to 39" is not in `stats`
     * -- `STAT_NAMES` is a closed flat set with no keyed entry -- so an item
     * carrying only school power would score ZERO for a caster, which is the
     * one population that would be looking at it.
     */
    const schoolOnly = [...ITEMS_BY_ID.values()].find(
      (item) =>
        Object.keys(item.schoolPower).length > 0 &&
        (item.stats.spellPower ?? 0) === 0,
    );
    expect(schoolOnly).toBeDefined();
    expect(scoreItem(schoolOnly!, 'caster', { spellPower: 1 })).toBeGreaterThan(0);
  });

  it('scores nothing under an empty valuation, which is what the panel detects', () => {
    const item = ITEMS_BY_ID.values().next().value!;
    expect(scoreItem(item, 'two_hander', {})).toBe(0);
  });
});

/*
 * ==============================================================================
 * THE DEFAULT VALUATION INVENTS NO MAGNITUDE.
 *
 * The owner's instruction: "I'll provide the stat valuation after this feature
 * is fully implemented. For now just make all the preferred stats valued at
 * 1.00." So WHICH stats a build prefers is the owner's own data -- the
 * `preferred` column of their benchmark spreadsheet -- and the only thing this
 * project adds is a flat 1.00 against each, which they specified.
 * ==============================================================================
 */
describe('the default valuation is the owner s preference list at 1.00', () => {
  it('is exactly 1.00 everywhere, for every one of the 25 templates', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      const valuation = defaultValuationForPreset(template.presetId);
      const weights = Object.values(valuation);
      expect(weights.length).toBeGreaterThan(0);
      expect(new Set(weights)).toEqual(new Set([PLACEHOLDER_PREFERRED_WEIGHT]));
      expect(PLACEHOLDER_PREFERRED_WEIGHT).toBe(1);
    }
  });

  it('names exactly the stats the template prefers, plus the ranged pool for a bow build', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      const expected = new Set<StatName>(
        template.preferred.map((stat) => STAT_FOR_BENCH_STAT[stat]),
      );
      if (template.weapons.ranged === true && template.preferred.includes('Attack Power')) {
        expected.add('rangedAttackPower');
      }
      expect(new Set(Object.keys(defaultValuationForPreset(template.presetId)))).toEqual(expected);
    }
  });

  it('maps every BenchStat onto a real engine stat', () => {
    for (const stat of Object.values(STAT_FOR_BENCH_STAT)) {
      expect(STAT_NAMES).toContain(stat);
    }
  });

  it('gives a build with no template an EMPTY valuation rather than a guess', () => {
    // There is nothing to derive from: the 25 templates are the owner's, and a
    // character somebody assembled by hand has no row in that spreadsheet. The
    // panel sorts by item level and says so, which beats a column of zeroes.
    expect(defaultValuationForPreset('not_a_preset')).toEqual({});
    expect(defaultValuationForPreset(undefined)).toEqual({});
    expect(defaultValuationForName('Somebody Else')).toEqual({});
  });
});

describe('which template a profile belongs to', () => {
  it('prefers the stored id over the character s name', () => {
    // The name join is on a string a user can edit; the stored id is not.
    expect(templateIdFor('dw_fury', 'Renamed By Hand')).toBe('dw_fury');
  });

  it('falls back to the name for a file saved before the id existed', () => {
    expect(templateIdFor(undefined, 'DW Fury')).toBe('dw_fury');
    // The four Mage presets are labelled differently from their characters.
    expect(templateIdFor(undefined, 'Frostfire Mage')).toBe('mage_frostfire');
  });

  it('falls through a stored id this build no longer carries', () => {
    expect(templateIdFor('a_template_that_was_removed', 'DW Fury')).toBe('dw_fury');
    expect(templateIdFor('a_template_that_was_removed', 'Renamed')).toBeUndefined();
  });

  /*
   * THE BUG THE STORED ID FIXES, pinned as a behaviour rather than as a field.
   * Renaming the character used to take away the four test-set buttons AND the
   * default stat valuation, because the only join between a profile and its
   * template was `character.name`.
   */
  it('keeps a preset s template and valuation after the character is renamed', () => {
    const preset = PRESETS_BY_ID.get('dw_fury')!.build();
    const renamed = { ...preset, character: { ...preset.character, name: 'My Warrior' } };

    const templateId = templateIdFor(renamed.benchmarkTemplateId, renamed.character.name);
    expect(templateId).toBe('dw_fury');
    expect(BENCHMARK_TEMPLATES_BY_PRESET.has(templateId!)).toBe(true);
    expect(defaultValuationForPreset(templateId)).toEqual(
      defaultValuationForPreset('dw_fury'),
    );
    // And the name join alone would have lost both.
    expect(defaultValuationForName(renamed.character.name)).toEqual({});
  });

  it('stamps the template id on all 25 presets', () => {
    for (const [id, preset] of PRESETS_BY_ID) {
      expect(preset.build().benchmarkTemplateId).toBe(id);
    }
  });
});
