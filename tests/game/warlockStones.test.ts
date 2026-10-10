import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  createDefaultProfile,
  CURRENT_PROFILE_VERSION,
  migrateProfile,
  validateProfile,
} from '../../src/profiles';
import { RATING_PER_PERCENT, hasteMultiplierFrom } from '../../src/engine';
import {
  DEFAULT_WARLOCK_STONE,
  FIRESTONE_SPELL_CRIT,
  SPELLSTONE_SPELL_HASTE_PERCENT,
  WARLOCK_STONE_EFFECTS,
  WARLOCK_STONE_NAMES,
  WARLOCK_STONE_SCHOOL_POWER,
  isWarlockStoneId,
} from '../../src/game/buffs/warlockStones';

/*
 * ============================================================================
 * THE WARLOCK'S TEMPORARY WEAPON ENCHANT, written out by hand from the source.
 *
 *   Firestone   "increasing your spell critical strike chance by 2% and the
 *                damage done by your Fire spells by up to 21"
 *   Spellstone  "increasing your spell haste by 2% and the damage done by your
 *                Shadow spells by up to 21"
 *
 * BOTH SOURCES AGREE ON BOTH STONES -- the ruleset owner's message and
 * `forever-warlock-spellbook.json` state the same four numbers -- which for
 * this class is the confidence measure, since eight of the nine classes rest on
 * one capture.
 * ============================================================================
 */

const warlock = (stone: 'none' | 'firestone' | 'spellstone') => {
  const built = PRESETS_BY_ID.get('warlock_smds')!.build();
  return createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
    warlockStone: stone,
  });
};

describe('the numbers, from the capture', () => {
  it('states both stones exactly as the source words them', () => {
    expect(FIRESTONE_SPELL_CRIT).toBe(2);
    expect(SPELLSTONE_SPELL_HASTE_PERCENT).toBe(2);
    expect(WARLOCK_STONE_SCHOOL_POWER).toBe(21);
  });

  it('reads "+21 damage done by Fire spells" as SCHOOL-SCOPED SPELL POWER', () => {
    /*
     * ------------------------------------------------------------------------
     * THE INTERPRETATION, AND IT IS THE ONE THE PROJECT ALREADY MAKES.
     * `SCHOOL_SPELL_POWER_PATTERN` in `items/itemData.ts` matches "Increases
     * damage done by (school) spells and effects by up to (N)" on seventeen
     * item lines and routes it to `SchoolModifiers.spellPower`. The stones use
     * the same idiom, "up to" included, so they take the same route.
     *
     * READING IT AS FLAT DAMAGE PER CAST would be the plausible alternative and
     * is wrong in a way no result would show: worth several times as much to a
     * fast spell as to a slow one, and scaling with nothing.
     * ------------------------------------------------------------------------
     */
    expect(WARLOCK_STONE_EFFECTS.firestone.schoolPower).toEqual({ fire: 21 });
    expect(WARLOCK_STONE_EFFECTS.spellstone.schoolPower).toEqual({ shadow: 21 });
    // And neither touches the school-blind pool, which would reach every school.
    expect(WARLOCK_STONE_EFFECTS.firestone.stats.spellPower ?? 0).toBe(0);
    expect(WARLOCK_STONE_EFFECTS.spellstone.stats.spellPower ?? 0).toBe(0);
  });

  it('grants spell crit as POINTS and never melee crit', () => {
    // `critChance` and `spellCritChance` are read by separate tables, and the
    // stone says "spell critical strike chance".
    expect(WARLOCK_STONE_EFFECTS.firestone.stats.spellCritChance).toBe(2);
    expect(WARLOCK_STONE_EFFECTS.firestone.stats.critChance ?? 0).toBe(0);
  });

  it('converts 2% haste into rating rather than writing 340 out', () => {
    /*
     * `hasteRating` IS SPELL HASTE FOR A WARLOCK. The stat set is closed and
     * has one haste member, which drives swing speed and cast speed through the
     * same multiplier -- and a Warlock is `autoAttack: 'none'`, so the only
     * thing it can reach is a cast. Exact here, generous for a class that
     * swings, and no such class can carry a stone.
     */
    expect(WARLOCK_STONE_EFFECTS.spellstone.stats.hasteRating).toBe(
      2 * RATING_PER_PERCENT.haste,
    );
  });

  it('carries no stone by default, which is the OPPOSITE of the poison default', () => {
    /*
     * Version 10 gave every Rogue the owner's stated pairing and changed old
     * results doing it. The owner has not said which stone a Warlock carries,
     * so choosing one here would invent a build decision and move a published
     * baseline. The control is the deliverable; the choice is the owner's.
     */
    expect(DEFAULT_WARLOCK_STONE).toBe('none');
    expect(createDefaultProfile().warlockStone).toBe('none');
    expect(WARLOCK_STONE_EFFECTS.none.schoolPower).toEqual({});
    expect(WARLOCK_STONE_EFFECTS.none.stats).toEqual({});
  });
});

describe('the stone reaches the character', () => {
  it('puts the Firestone on spell crit and on FIRE alone', () => {
    const base = warlock('none');
    const fire = warlock('firestone');

    expect(fire.stats.effective.spellCritChance - base.stats.effective.spellCritChance)
      .toBeCloseTo(FIRESTONE_SPELL_CRIT, 6);
    // Melee crit untouched, which is the half an item line gets wrong.
    expect(fire.stats.effective.critChance).toBeCloseTo(base.stats.effective.critChance, 6);

    const firePower = (c: typeof base, school: 'fire' | 'shadow') =>
      c.schoolModifiers.for(school).spellPower ?? 0;
    expect(firePower(fire, 'fire') - firePower(base, 'fire')).toBe(WARLOCK_STONE_SCHOOL_POWER);
    // And not a point of it on Shadow, which is 100% of this profile's damage.
    expect(firePower(fire, 'shadow')).toBe(firePower(base, 'shadow'));
  });

  it('puts the Spellstone on haste and on SHADOW alone', () => {
    const base = warlock('none');
    const spell = warlock('spellstone');

    /*
     * ASSERTED THROUGH THE MULTIPLIER, not the rating, because the multiplier
     * is what a cast time actually divides by -- a rating that arrived and was
     * never converted would pass a rating assertion.
     */
    const before = hasteMultiplierFrom(base.stats.effective);
    const after = hasteMultiplierFrom(spell.stats.effective);
    expect(after - before).toBeCloseTo(SPELLSTONE_SPELL_HASTE_PERCENT / 100, 6);

    const power = (c: typeof base, school: 'fire' | 'shadow') =>
      c.schoolModifiers.for(school).spellPower ?? 0;
    expect(power(spell, 'shadow') - power(base, 'shadow')).toBe(WARLOCK_STONE_SCHOOL_POWER);
    expect(power(spell, 'fire')).toBe(power(base, 'fire'));
  });

  it('STACKS WITH THE WEAPON ENCHANT rather than replacing it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S RULING, and the assertion is that the gear's contribution is
     * untouched. A stone is layered on as plain stats and nothing in the path
     * reads `equipment`, so "stacks" falls out rather than being arranged --
     * but an implementation that had routed the stone through the enchant slot
     * would pass every other test in this file and fail this one.
     * ------------------------------------------------------------------------
     */
    const base = warlock('none');
    const stoned = warlock('spellstone');

    // Everything the gear supplies is still there, to the decimal.
    expect(stoned.stats.effective.spellPower).toBeCloseTo(base.stats.effective.spellPower, 6);
    expect(stoned.stats.effective.intellect).toBeCloseTo(base.stats.effective.intellect, 6);
    expect(stoned.weapons.mainHand?.name).toBe(base.weapons.mainHand?.name);
  });

  it('is ignored for a class that cannot have one', () => {
    /*
     * The field is on EVERY profile and only the panel is class-gated, so a
     * Mage profile can carry a stone id -- hand-edited, or left behind by a
     * class change. `createPlayer` gates on the class for the same reason it
     * double-gates poisons.
     */
    const mage = PRESETS_BY_ID.get('mage_fire')!.build();
    const withStone = createPlayer({
      race: 'undead',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: mage.talents,
      equipment: mage.equipment,
      warlockStone: 'firestone',
    });
    const without = createPlayer({
      race: 'undead',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: mage.talents,
      equipment: mage.equipment,
    });
    expect(withStone.stats.effective.spellCritChance).toBeCloseTo(
      without.stats.effective.spellCritChance,
      6,
    );
    expect(withStone.schoolModifiers.for('fire').spellPower ?? 0).toBe(
      without.schoolModifiers.for('fire').spellPower ?? 0,
    );
  });
});

describe('the selection, which is what makes the control real', () => {
  it('CHANGES THE RESULT, and the two stones do not change it alike', () => {
    /*
     * ------------------------------------------------------------------------
     * THE POISON SUITE'S ARGUMENT, and it is the one test that cannot be
     * satisfied by a control that is wired to nothing: a dropdown that changed
     * no number would look exactly like a dropdown that was never plumbed in.
     *
     * AND THE TWO STONES MUST DIFFER FROM EACH OTHER TOO. SM/DS deals almost
     * nothing but Shadow, so a Firestone's Fire power reaches none of its
     * damage while a Spellstone's Shadow power reaches all of it -- if both
     * came back the same, the school scoping would be the thing that is broken.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('warlock_smds')!.build();
    const run = (stone: 'none' | 'firestone' | 'spellstone') =>
      runProfileBatch({
        ...built,
        warlockStone: stone,
        simulation: { ...built.simulation, iterations: 40, seed: 12345 },
      } as never).dps.mean;

    const none = run('none');
    const spellstone = run('spellstone');
    const firestone = run('firestone');

    expect(spellstone).toBeGreaterThan(none);
    expect(spellstone).not.toBeCloseTo(firestone, 1);
  });

  it('is NOT a Fire stone and a Shadow stone, which is the trap', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FIRESTONE'S CRIT HALF IS SCHOOL-BLIND, AND THAT COST ME A WRONG
     * ASSERTION HERE. This test used to read "gives SM/DS more from the
     * Spellstone than from the Firestone", reasoned from SM/DS dealing almost
     * nothing but Shadow -- and it failed: 486.7 against 478.4.
     *
     * WHY: only the "+21 damage done by your Fire spells" half is Fire-scoped.
     * `spellCritChance` is a whole-character stat read by the spell table for
     * EVERY school, so a Firestone's 2% crit reaches all of a Warlock's damage
     * while its 21 reaches none of SM/DS's. The two stones are therefore not
     * "the Fire one and the Shadow one"; they are "crit plus a little Fire
     * power" and "haste plus a little Shadow power".
     *
     * SO THIS ASSERTS THE SCOPING AND NOT AN ORDERING. Which stone is better is
     * a measurement, it is close, and it belongs in the handoff brief where it
     * can go stale honestly -- not in a test that would have to be rewritten
     * every time a coefficient moves.
     * ------------------------------------------------------------------------
     */
    const base = warlock('none');
    const fire = warlock('firestone');

    // The crit is school-blind: one stat, read by the spell table for all.
    expect(fire.stats.effective.spellCritChance).toBeGreaterThan(
      base.stats.effective.spellCritChance,
    );
    expect(WARLOCK_STONE_EFFECTS.firestone.stats.spellCritChance).toBe(FIRESTONE_SPELL_CRIT);
    // And only the power half is scoped, to the school this profile never casts.
    expect(Object.keys(WARLOCK_STONE_EFFECTS.firestone.schoolPower)).toEqual(['fire']);
    expect(fire.schoolModifiers.for('shadow').spellPower ?? 0).toBe(
      base.schoolModifiers.for('shadow').spellPower ?? 0,
    );
  });
});

describe('the profile field', () => {
  it('arrived in format 11, and the format has moved past it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE STONE IS STILL A VERSION 11 FIELD; the FORMAT is 12 now, because the
     * consumables landed on a branch written from the same base as this one.
     * Both took 11 and both keyed their migration at 10, and **git merged the
     * two tables with no conflict** -- one object literal with `10` twice,
     * where the second silently wins and the first migration never runs.
     *
     * So this asserts the two things separately: the migration that introduced
     * the stone is still keyed at 10 (which is what makes a version 10 file
     * gain one), and the current format is whatever the latest field says.
     * Written out rather than read from the constant, so a bump is deliberate.
     * ------------------------------------------------------------------------
     */
    expect(CURRENT_PROFILE_VERSION).toBe(13);
    expect(createDefaultProfile().version).toBe(13);
    // And a version 10 file still gains a stone, which is the test below.
  });

  it('migrates a version 10 profile to none, changing no result', () => {
    const old = { ...createDefaultProfile(), version: 10 } as Record<string, unknown>;
    delete old.warlockStone;

    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const migrated = result.value as { version: number; warlockStone: string };
    expect(migrated.version).toBe(CURRENT_PROFILE_VERSION);
    expect(migrated.warlockStone).toBe('none');
  });

  it('never clobbers a stone the old file already carried', () => {
    // The migration spreads the default FIRST, so real data wins. That is what
    // makes it idempotent, and it is easy to write the other way round.
    const old = {
      ...createDefaultProfile(),
      version: 10,
      warlockStone: 'firestone',
    } as Record<string, unknown>;
    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as { warlockStone: string }).warlockStone).toBe('firestone');
  });

  it('VALIDATES THE ID, which the poison field does not', () => {
    /*
     * ------------------------------------------------------------------------
     * Validation runs on anything a user can paste. `poisons` takes whatever it
     * is handed -- `{ mainHand: 'banana' }` reaches the reaction builder -- and
     * that is a real gap rather than a precedent to copy: an unknown stone
     * would silently grant nothing while the panel showed the nonsense id back.
     *
     * So an unrecognised value becomes `none` AND is reported, which is what
     * every other closed set here does.
     * ------------------------------------------------------------------------
     */
    expect(isWarlockStoneId('firestone')).toBe(true);
    expect(isWarlockStoneId('banana')).toBe(false);
    expect(isWarlockStoneId(undefined)).toBe(false);

    const pasted = { ...createDefaultProfile(), warlockStone: 'banana' };
    const result = validateProfile(pasted);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.warlockStone).toBe('none');
  });

  it('offers exactly the three options the panel shows', () => {
    expect(Object.keys(WARLOCK_STONE_NAMES)).toEqual(['none', 'firestone', 'spellstone']);
  });
});
