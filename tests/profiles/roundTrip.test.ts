import { describe, expect, it } from 'vitest';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import { createDefaultProfile, parseProfile, serializeProfile } from '../../src/profiles';
import type { CharacterProfile } from '../../src/profiles';
import { sacrificedDemon } from '../../src/game/rotations/warlock';

/*
 * ============================================================================
 * SAVE AND LOAD, AS ONE QUESTION: does a character come back?
 *
 * The Save button writes `serializeProfile` and the Load button reads
 * `parseProfile`, so the whole feature is this pair of functions with a file
 * between them. What makes it worth a test of its own is that the two are NOT
 * inverses by construction: `validateProfile` rebuilds the profile FIELD BY
 * FIELD, deliberately, so unknown keys cannot ride along -- which means every
 * field has to be named in that rebuild, and a field that is not is dropped in
 * total silence.
 *
 * IT HAD ALREADY HAPPENED TWICE. `stance` was found missing from the rebuild
 * and fixed with a comment recording the lesson; `petFamily` arrived later,
 * was never added, and repeated it underneath that comment. Both are invisible
 * from inside the app: the file is written correctly, the load reports no
 * issue, and the character that comes back is a different one.
 *
 * SO THE ASSERTION IS A WHOLE-PROFILE COMPARISON OVER ALL 25 PRESETS, rather
 * than a list of fields to check. A test naming the fields is a second copy of
 * the rebuild, with the same hole available to it -- whoever forgets the field
 * forgets the assertion. Comparing the entire structure needs no maintenance
 * and covers whatever is added next.
 * ============================================================================
 */

/** Save, then load: exactly what the two buttons do, with no file in between. */
function roundTrip(profile: CharacterProfile): CharacterProfile {
  const result = parseProfile(serializeProfile(profile));
  if (!result.ok) {
    throw new Error(
      `A profile this app produced did not load: ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(', ')}`,
    );
  }
  return result.profile;
}

describe('a saved profile loads back as the same character', () => {
  /*
   * KEY ORDER IS NOT PART OF IT. The rebuild emits fields in its own order, so
   * the two JSON TEXTS differ for every preset while the characters are
   * identical. `toEqual` compares structurally, which is the question being
   * asked -- comparing the text would fail all 25 and say nothing.
   */
  it.each(PROFILE_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s survives a save and a load unchanged',
    (_id, preset) => {
      const before = preset.build();
      expect(roundTrip(before)).toEqual(before);
    },
  );

  it('a brand new character survives one too', () => {
    const fresh = createDefaultProfile();
    expect(roundTrip(fresh)).toEqual(fresh);
  });

  /*
   * ONE PRESET PINNED BY ITS CONSEQUENCE RATHER THAN BY ITS FIELD, because
   * this is what the dropped field actually cost and it is not visible in a
   * comparison of two profiles.
   *
   * `sacrificedDemon` returns UNDEFINED when no family is named -- it does not
   * fall back the way the Hunter's `petFor` does -- so a Warlock that lost
   * `petFamily` on load applied no Demonic Sacrifice aura at all, and went
   * without 15% of a school's damage. Nothing reported it: the talent was
   * still allocated, the profile still loaded, and the buff simply was not
   * there.
   */
  it('a loaded Warlock still sacrificed the demon it saved', () => {
    for (const id of ['warlock_smds', 'warlock_firelock']) {
      const preset = PROFILE_PRESETS.find((candidate) => candidate.id === id);
      expect(preset, `${id} is missing`).toBeDefined();
      const before = preset!.build();
      const after = roundTrip(before);

      const demon = sacrificedDemon(before.talents, before.character.petFamily);
      expect(demon, `${id} should sacrifice a demon`).toBeDefined();
      expect(sacrificedDemon(after.talents, after.character.petFamily)).toBe(demon);
    }
  });
});

describe('what a load refuses', () => {
  /*
   * THE OTHER HALF OF THE BUTTON. A file picker hands back whatever was
   * chosen, so the common failure is not a corrupt profile but a file that was
   * never one -- and every path below has to say so rather than loading a
   * character nobody has.
   */
  it('reports a file that is not JSON', () => {
    const result = parseProfile('this is my warrior');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toContain('Not valid JSON');
  });

  it('reports JSON that is not a profile', () => {
    const result = parseProfile('{"hello":"world"}');
    expect(result.ok).toBe(false);
  });

  /*
   * AN EMPTY FILE IS THE ONE WORTH NAMING, because it is what a save that went
   * wrong leaves on disk and because `JSON.parse('')` throws rather than
   * returning anything -- so it takes the "not valid JSON" path and not a
   * missing-section one.
   */
  it('reports an empty file', () => {
    expect(parseProfile('').ok).toBe(false);
  });

  it('refuses a pet family that is not an id string', () => {
    const profile = createDefaultProfile();
    const broken = JSON.parse(serializeProfile(profile));
    broken.character.petFamily = 42;
    const result = parseProfile(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.path === 'character.petFamily')).toBe(true);
  });

  /*
   * AND A FAMILY THIS BUILD DOES NOT CARRY STILL LOADS, which is the opposite
   * decision and is deliberate -- the `raidBuffs` rule rather than the
   * `warlockStone` one. Families are content; a profile saved when one existed
   * should open after it is renamed, as a Cat rather than as an error.
   */
  it('loads a pet family it does not recognise', () => {
    const profile = createDefaultProfile();
    const edited = JSON.parse(serializeProfile(profile));
    edited.character.petFamily = 'chimaera';
    const result = parseProfile(JSON.stringify(edited));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.character.petFamily).toBe('chimaera');
  });
});
