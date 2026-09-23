import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { defaultStanceFor, resolveStance, STANCES } from '../../src/game/character';
import {
  CURRENT_PROFILE_VERSION,
  createDefaultProfile,
  migrateProfile,
} from '../../src/profiles';
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

describe('the tank list stays in Defensive Stance', () => {
  /*
   * THIS USED TO BE THE OPPOSITE TEST, and it was right at the time.
   *
   * A shield warrior opening in Defensive Stance used to dance straight back
   * out of it -- eighteen swaps and 540 rage a fight -- because the general
   * shield list reaches for abilities in other stances and the opening stance
   * stopped mattering after the first few seconds. That was measured and
   * pinned here as a near-equality, with a comment saying plainly that
   * choosing a stance was real and its effect on results was not.
   *
   * The tank list fixes it, which is what a per-stance list is FOR: every
   * entry in it is castable in Defensive, so the only stance change it makes
   * is the one that puts it right at the pull.
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

  it('never changes stance at all', () => {
    /*
     * Zero, not "about one". The character OPENS in Defensive -- that is what
     * choosing the stance does -- so the list's first entry finds the aura
     * already up and falls straight through to Battle Shout.
     */
    expect(swaps('defensive')).toBe(0);
  });

  it('is only the tank list that stays put', () => {
    /*
     * A shield warrior in Battle Stance is NOT a tank build, so it gets the
     * general shield list and dances as it always did. The tank list is
     * chosen by style AND stance together, and this is the difference that
     * makes visible.
     */
    expect(swaps('battle')).toBeGreaterThan(3);
  });

  it('keeps Defensive Stance up for the whole fight', () => {
    // The point of the list: Defensive is where the damage reduction and
    // Revenge live, and the general list spends most of a fight outside it.
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'one_hand_shield', stance: 'defensive' },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      simulation: { ...base.simulation, iterations: 40, seed: 12 },
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);
    const defensive = batch.buffUptime.find((row) => row.auraName === 'Defensive Stance');
    expect(defensive?.uptime).toBeCloseTo(1, 2);
  });
});

describe('an older profile with no stance', () => {
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
    // Carried to the CURRENT format, whatever that is, rather than to the one
    // this test was written against.
    expect(migrated.version).toBe(CURRENT_PROFILE_VERSION);
    expect(migrated.character.stance).toBeUndefined();
    expect(resolveStance(migrated.character.combatStyle, migrated.character.stance)).toBe(
      'battle',
    );
  });
});
