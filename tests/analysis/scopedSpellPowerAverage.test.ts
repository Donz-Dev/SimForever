import { describe, expect, it } from 'vitest';
import { DAMAGE_SCHOOLS, spellPowerFor } from '../../src/engine';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ============================================================================
 * THE FIGHT-AVERAGE SPELL POWER MUST BE THE NUMBER THE DAMAGE READ.
 *
 * `BatchStatAverages.spellPower` is the SCHOOL-BLIND pool, which is the right
 * number for the row it labels and is not what a Shadow Priest's spells use:
 * `dealDamage` reads `spellPowerFor(source, school)`, the blind pool plus
 * whatever the school's own modifier adds, and seventeen item lines in this
 * project say "damage done by <school> spells".
 *
 * IT WAS UNDER-REPORTED INVISIBLY. The figure was plausible, it agreed exactly
 * with the character sheet's own blind row, and the sheet listed the scoped
 * pools in a DIFFERENT panel -- so the two never had to agree and nothing on
 * either page contradicted the other.
 * ============================================================================
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('the Shadow Priest, which owns a Shadow-only pool', () => {
  const stats = batchOf('shadow_priest', 6, 11).stats!;

  it('reports a Shadow figure that is LARGER than the blind one', () => {
    expect(stats.spellPowerBySchool.shadow).toBeDefined();
    expect(stats.spellPowerBySchool.shadow!).toBeGreaterThan(stats.spellPower);
  });

  /*
   * THE GAP IS THE GEAR'S, and it is checked against the character the profile
   * builds rather than against a number written here -- a hand-written 293
   * would pass while the gear changed underneath it.
   */
  it('is the blind pool plus exactly what the equipped set scopes to Shadow', () => {
    const built = PRESETS_BY_ID.get('shadow_priest')!.build();
    const character = characterAtCombatStart(built)!;
    const scoped = spellPowerFor(character, 'shadow') - character.stats.effective.spellPower;

    expect(scoped).toBeGreaterThan(0);
    expect(stats.spellPowerBySchool.shadow! - stats.spellPower).toBeCloseTo(scoped, 6);
  });

  /*
   * ONLY THE SCHOOLS THAT DIFFER. A row per school would put five zero-valued
   * lines on every caster's results page, and a row for `physical` would be a
   * row about a pool physical damage never reads.
   */
  it('carries no row for a school that reads the blind pool', () => {
    for (const school of DAMAGE_SCHOOLS) {
      if (school === 'shadow') continue;
      expect(stats.spellPowerBySchool[school]).toBeUndefined();
    }
  });
});

describe('what it does not touch', () => {
  it('gives a Warrior no scoped rows at all', () => {
    expect(Object.keys(batchOf('two_hand_arms', 4, 7).stats!.spellPowerBySchool)).toEqual([]);
  });

  /*
   * THE BLIND ROW IS UNCHANGED, which matters because it is the one every
   * recorded figure was taken against. This adds a row; it does not move one.
   */
  it('leaves the blind average exactly where it was', () => {
    const stats = batchOf('shadow_priest', 6, 11).stats!;
    const character = characterAtCombatStart(PRESETS_BY_ID.get("shadow_priest")!.build())!;

    // No aura in this build moves spell power, so the average is the opener's.
    expect(stats.spellPower).toBeCloseTo(character.stats.effective.spellPower, 6);
  });
});
