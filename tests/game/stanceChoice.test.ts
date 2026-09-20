import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { defaultStanceFor, resolveStance, STANCES } from '../../src/game/character';
import { createDefaultProfile, migrateProfile } from '../../src/profiles';
import { runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';

/*
 * The stance is a PLAYER CHOICE with a per-style default.
 *
 * Defaults stated by the ruleset owner and written out by hand here, not read
 * back from the table that defines them.
 */

describe('each combat style has a default stance', () => {
  it('opens a two-hander in Battle Stance', () => {
    expect(defaultStanceFor('two_hander')).toBe('battle');
  });

  it('opens a dual-wielder in Berserker Stance', () => {
    expect(defaultStanceFor('dual_wield')).toBe('berserker');
  });

  it('opens a shield warrior in Defensive Stance', () => {
    expect(defaultStanceFor('one_hand_shield')).toBe('defensive');
  });

  it('falls back to Battle for a style with no default', () => {
    // Every non-Warrior style. A stance is meaningless for them, and Battle
    // does nothing, so it is the harmless answer.
    expect(defaultStanceFor('caster')).toBe('battle');
    expect(defaultStanceFor(undefined)).toBe('battle');
  });

  it('offers exactly the three stances', () => {
    expect(STANCES.map((s) => s.id)).toEqual(['battle', 'defensive', 'berserker']);
  });
});

describe('resolveStance', () => {
  it('honours a chosen stance over the default', () => {
    // Choosing Defensive on a dual-wielder is a legitimate thing to measure.
    expect(resolveStance('dual_wield', 'defensive')).toBe('defensive');
  });

  it('falls back when nothing was chosen', () => {
    expect(resolveStance('one_hand_shield', undefined)).toBe('defensive');
  });

  it('falls back when the stance is not one this build knows', () => {
    // A profile from a future build, or a hand-edited one. A warrior in no
    // stance can cast almost nothing, so an unknown id must not leave it bare.
    expect(resolveStance('two_hander', 'gladiator' as never)).toBe('battle');
  });
});

describe('a warrior opens combat in its chosen stance', () => {
  const opened = (style: 'dual_wield' | 'two_hander' | 'one_hand_shield', stance?: never) =>
    createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: style,
      stance,
    }).openingAuras.map((aura) => aura.id);

  it('uses the style default when none was chosen', () => {
    expect(opened('dual_wield')).toEqual(['berserker_stance']);
    expect(opened('two_hander')).toEqual(['battle_stance']);
    expect(opened('one_hand_shield')).toEqual(['defensive_stance']);
  });

  it('uses the chosen stance when one was', () => {
    expect(opened('dual_wield', 'defensive' as never)).toEqual(['defensive_stance']);
  });

  it('gives a non-Warrior no stance at all', () => {
    const rogue = createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      combatStyle: 'dual_wield',
    });
    expect(rogue.openingAuras).toEqual([]);
  });
});

describe('the opening stance is honoured, and the rotation dances away from it', () => {
  /*
   * THIS IS NOT A FIX FOR STANCE DANCING, and the measurement says so.
   *
   * The intent was that starting a build in its own stance would remove most
   * of the swapping -- a shield warrior opening in Defensive already has
   * Revenge, Shield Slam and Shield Wall. It does not, because the rotation
   * swaps for the abilities OUTSIDE whichever stance it is in, and after the
   * first few seconds the opening stance no longer matters.
   *
   * Measured over 200 iterations, 1H & Shield against an attacking target:
   *
   *   opening in Battle      122.51 DPS   18.41 swaps   543.9 rage
   *   opening in Defensive   122.51 DPS   18.32 swaps   542.3 rage
   *   opening in Berserker   121.91 DPS   17.77 swaps   540.7 rage
   *
   * So the choice is real and its effect on results is not. Making it matter
   * needs the rotation to RESPECT the chosen stance rather than treating it as
   * a starting position -- a separate decision, deliberately not taken here.
   */
  function swaps(stance: 'battle' | 'defensive'): number {
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'one_hand_shield', stance },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      simulation: { ...base.simulation, iterations: 40, seed: 12 },
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);
    return batch.rage.spent.find((row) => row.sourceId === 'stance_change')?.count ?? 0;
  }

  it('swaps about as much whichever stance it opens in', () => {
    // Pinned as a near-equality rather than an improvement, because asserting
    // an improvement here would be asserting something that is not true.
    expect(Math.abs(swaps('defensive') - swaps('battle'))).toBeLessThan(2);
  });

  it('still swaps a great deal, whatever it opens in', () => {
    expect(swaps('defensive')).toBeGreaterThan(5);
  });
});

describe('profile format 7', () => {
  it('leaves an older profile without a stance, so it takes the default', () => {
    /*
     * Deliberately NOT backfilled with 'battle'. Writing that in would
     * preserve the old numbers and preserve a character standing in the wrong
     * stance; taking the default changes the fight, which is the point.
     */
    const old = { ...createDefaultProfile(), version: 6 } as Record<string, unknown>;
    delete (old.character as Record<string, unknown>).stance;
    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const migrated = result.value as {
      version: number;
      character: { combatStyle?: never; stance?: never };
    };
    expect(migrated.version).toBe(7);
    expect(migrated.character.stance).toBeUndefined();
    expect(resolveStance(migrated.character.combatStyle, migrated.character.stance)).toBe(
      'battle',
    );
  });
});
