import { describe, expect, it } from 'vitest';
import { critChanceFrom, spellCritChanceFrom } from '../../src/engine';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { genericRows, warriorRows } from '../../src/ui/panels/CharacterSheetPanel';
import { resolveCombatStyle } from '../../src/game/character';

/**
 * ==============================================================================
 * THE SHEET MUST NOT DISAGREE WITH THE FIGHT ABOUT CRIT, AND IT DID FOR THE
 * WHOLE PROJECT.
 *
 * Both crit rows printed the stat block RAW -- `stats.critChance` and
 * `stats.spellCritChance` -- and `critRating` is the other half of both
 * numbers. On all 28 profiles, in both rows:
 *
 *     profile          sheet said   engine rolls
 *     mage_fire          3.00%        14.00%      (melee)
 *     mage_fire         10.82%        21.82%      (spell)
 *     two_hand_arms     25.01%        38.44%      (melee)
 *
 * THE PANEL'S OWN COMMENT ALREADY STATED THE RULE, twenty lines above the
 * broken pair: spell power goes through "the same function `dealDamage` and
 * the Paladin's seal use, so the sheet cannot disagree with the fight". The
 * crit rows directly beneath it did exactly that.
 *
 * NO FIGURE MOVED, because nothing in `engine`, `game` or `simulator` reads
 * this panel. What it cost was a PERSON reading the sheet -- and it cost one
 * directly: Revelation's proc rate was built against the 10.82% shown here,
 * and the owner caught it by saying the number looked wrong.
 *
 * SO THIS TEST COMPARES THE PANEL TO THE ENGINE'S OWN FUNCTIONS rather than to
 * literals. A literal would have to be re-typed every time gear moves, which
 * is the "a test that hard-codes a gear figure is testing the gear" failure --
 * and it would not catch the panel drifting back to the raw stat on a build
 * whose rating happened to be zero.
 * ==============================================================================
 */
const rowsFor = (presetId: string) => {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );
  /* Both builders, because the Warrior has its own and it had the same bug. */
  return profile.character.characterClass === 'warrior'
    ? warriorRows(profile, style)
    : genericRows(profile, style);
};

const profileClass = (presetId: string) =>
  PRESETS_BY_ID.get(presetId)!.build().character.characterClass;

const valueOf = (rows: readonly { label: string; value: string }[], label: string) =>
  rows.find((row) => row.label === label)?.value;

describe('every preset s sheet agrees with the engine about crit', () => {
  for (const preset of PROFILE_PRESETS) {
    it(`${preset.id} prints the crit the fight rolls against`, () => {
      const character = characterAtCombatStart(PRESETS_BY_ID.get(preset.id)!.build());
      if (!character) return;
      const stats = character.stats.effective;
      const rows = rowsFor(preset.id) as readonly { label: string; value: string }[];

      expect(valueOf(rows, 'Crit Chance')).toBe(`${(critChanceFrom(stats) * 100).toFixed(2)}%`);

      /*
       * ------------------------------------------------------------------------
       * THE SPELL ROW IS GATED ON THE COMPUTED FIGURE, not on the flat stat.
       * A Forever caster carries its crit as RATING, so a build with no flat
       * spell crit and 154 rating used to show NO ROW AT ALL -- an absence
       * that reads as "this character has none".
       *
       * AND `warriorRows` HAS NO SPELL ROW ON PURPOSE, which is why this is
       * asked of the generic builder only. The Warrior's considered list omits
       * it because a Warrior casts nothing -- it still has 17.43% by the
       * derivation, and printing that would be a row about spells for a class
       * with none. Asserting it for every preset made the three Warriors fail
       * for a reason that has nothing to do with the bug.
       * ------------------------------------------------------------------------
       */
      if (profileClass(preset.id) === 'warrior') {
        expect(valueOf(rows, 'Spell Crit Chance')).toBeUndefined();
        return;
      }
      const spell = spellCritChanceFrom(stats);
      if (spell !== 0) {
        expect(valueOf(rows, 'Spell Crit Chance')).toBe(`${(spell * 100).toFixed(2)}%`);
      }
    });
  }

  it('is a REAL difference and not a rounding one, on the worst row', () => {
    /*
     * THE GUARD AGAINST THIS TEST BECOMING VACUOUS. If `critRating` ever went
     * to zero across the presets, every assertion above would pass against the
     * raw stat as well -- so this pins that at least one profile has a gap
     * large enough for the two readings to be visibly different.
     *
     * The Fire Mage is the worst: 3.00% raw against 14.00% effective, which is
     * a factor of 4.7 rather than a rounding artefact.
     */
    const stats = characterAtCombatStart(PRESETS_BY_ID.get('mage_fire')!.build())!.stats.effective;
    expect(critChanceFrom(stats) * 100 - stats.critChance).toBeGreaterThan(10);
    expect(spellCritChanceFrom(stats) * 100 - stats.spellCritChance).toBeGreaterThan(10);
  });
});
