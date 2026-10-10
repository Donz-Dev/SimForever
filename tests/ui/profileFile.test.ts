import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterPanel } from '../../src/ui/panels/CharacterPanel';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import { createDefaultProfile, serializeProfile } from '../../src/profiles';
import type { CharacterProfile } from '../../src/profiles';
import {
  PROFILE_FILE_EXTENSION,
  profileFileName,
  readProfileFile,
} from '../../src/ui/profileFile';

/*
 * ============================================================================
 * THE SAVE AND LOAD BUTTONS.
 *
 * `roundTrip.test.ts` covers whether a profile survives the trip; this covers
 * the parts either side of it -- what the file is called, what happens when
 * the file is not a profile, and whether the two controls are on the screen at
 * all.
 *
 * THE RENDER TESTS ARE HERE BECAUSE NOTHING ELSE WOULD NOTICE THE BUTTONS
 * GOING. Both are one line in a panel, both were `() => undefined` for the
 * whole life of the project, and a no-op button is indistinguishable from a
 * working one until it is pressed. `gearPanelStone.test.ts` is the precedent
 * and the reason this file is `.ts` with `createElement` rather than `.tsx`:
 * `vite.config.ts` includes `tests/**\/*.test.ts` only, jsdom is not a
 * dependency, and `renderToStaticMarkup` answers the question being asked.
 *
 * WHAT THEY DO NOT COVER, said plainly: the CLICK. A hidden file input opened
 * by `.click()` and a download driven by an object URL are both browser
 * behaviour, and neither exists in a static render. What is asserted is that
 * the controls are present and pointed at the right handlers' neighbours --
 * the input's `accept`, the buttons' labels -- and the logic they lead to is
 * tested directly above.
 * ============================================================================
 */

const noop = () => undefined;

function renderPanel(profile: CharacterProfile, confirmed: boolean): string {
  return renderToStaticMarkup(
    createElement(CharacterPanel, {
      profile,
      confirmed,
      onChange: noop,
      onConfirm: noop,
      onEdit: noop,
      onImport: noop,
      onLoad: noop,
    }),
  );
}

describe('what a saved file is called', () => {
  it('names the file after the character, its race and its class', () => {
    const profile = createDefaultProfile();
    expect(
      profileFileName({
        ...profile,
        character: { ...profile.character, name: 'Thrall', race: 'orc', characterClass: 'warrior' },
      }),
    ).toBe('thrall-orc-warrior.json');
  });

  /*
   * THE WINDOWS CASE, and the reason this is a slug rather than a sanitiser.
   * A character name may legally hold a colon, a slash or a trailing dot, and
   * a download whose filename carries one is silently renamed or refused.
   * Reducing to lowercase letters, digits and hyphens cannot produce any of
   * them, so there is no list of forbidden characters to keep up to date.
   */
  it('cannot produce a character Windows refuses in a filename', () => {
    const profile = createDefaultProfile();
    const name = profileFileName({
      ...profile,
      character: { ...profile.character, name: 'A: B/C\\D*E?"F<G>H|I.' },
    });
    expect(name).toMatch(/^[a-z0-9-]+\.json$/);
    expect(name.endsWith(PROFILE_FILE_EXTENSION)).toBe(true);
  });

  it('spaces and capitals become hyphens and lowercase', () => {
    const profile = createDefaultProfile();
    expect(
      profileFileName({
        ...profile,
        character: { ...profile.character, name: 'Sir  Reginald The Third' },
      }),
    ).toBe('sir-reginald-the-third-human-warrior.json');
  });

  /*
   * A NAME THAT SLUGS AWAY TO NOTHING still has to produce a file name, and it
   * must not be the empty string or a bare extension -- a browser handed
   * `.json` as a download name does something different in each of them.
   */
  it('falls back rather than producing a bare extension', () => {
    const profile = createDefaultProfile();
    const nameless = {
      ...profile,
      character: {
        ...profile.character,
        name: '???',
        race: 'nowhere' as never,
        characterClass: 'nobody' as never,
      },
    };
    expect(profileFileName(nameless)).toBe('profile.json');
  });

  it('every preset produces a distinct, legal file name', () => {
    const names = PROFILE_PRESETS.map((preset) => profileFileName(preset.build()));
    for (const name of names) expect(name).toMatch(/^[a-z0-9-]+\.json$/);
    // Distinct, because saving two builds into one folder should not have the
    // second quietly land as "(1)".
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('reading a chosen file', () => {
  /*
   * A REAL `File`, which Node has had as a global since 20 -- the same object
   * the input element hands the panel. Going through `readProfileFile` rather
   * than `parseProfile` is the point: the panel calls this one, and the
   * `await file.text()` in front of it is the step that could be wrong.
   */
  const asFile = (text: string, name = 'build.json') =>
    new File([text], name, { type: 'application/json' });

  it('loads a profile that was saved from this app', async () => {
    const preset = PROFILE_PRESETS[0];
    const saved = preset.build();
    const result = await readProfileFile(asFile(serializeProfile(saved)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual(saved);
  });

  it('reports a file that is not a profile instead of throwing', async () => {
    const result = await readProfileFile(asFile('nope'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  /*
   * MIGRATION RUNS ON THE WAY IN, which is the whole reason the saved file is
   * the profile's own JSON rather than a format of its own. A build saved
   * before `consumables` existed still loads, and arrives with the field.
   */
  it('migrates an older file rather than refusing it', async () => {
    const current = createDefaultProfile();
    const old = JSON.parse(serializeProfile(current));
    old.version = 9;
    delete old.poisons;
    delete old.warlockStone;
    delete old.consumables;

    const result = await readProfileFile(asFile(JSON.stringify(old)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.profile.version).toBe(current.version);
    expect(result.profile.consumables).toEqual({});
  });
});

describe('the controls are on the screen', () => {
  it('the creation screen offers Load, and a file input to open', () => {
    const markup = renderPanel(createDefaultProfile(), false);
    expect(markup).toContain('>Load</button>');
    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="application/json,.json"');
  });

  /*
   * SAVE IS ON THE CONFIRMED SUMMARY AND NOWHERE ELSE, because that is the
   * only screen with a whole character on it -- the creation screen has five
   * fields, and the talents, gear, buffs, consumables and encounter that make
   * up the rest of the file are all chosen after it.
   */
  it('the confirmed character offers Save, beside Change', () => {
    const markup = renderPanel(PROFILE_PRESETS[0].build(), true);
    expect(markup).toContain('>Save</button>');
    expect(markup).toContain('>Change</button>');
  });

  it('the creation screen does not offer Save', () => {
    expect(renderPanel(createDefaultProfile(), false)).not.toContain('>Save</button>');
  });

  /*
   * LOAD IS ON BOTH SCREENS, and the confirmed one is what this pins. It was
   * creation-screen-only at first, which made `Change` the only route to it --
   * and Change CLEARS THE TALENT ALLOCATION, so cancelling the file dialog
   * afterwards cost somebody their build. The second entry point is the fix,
   * and a render test is the only thing that would notice it going again.
   */
  it('the confirmed character offers Load too, with an input to open', () => {
    const markup = renderPanel(PROFILE_PRESETS[0].build(), true);
    expect(markup).toContain('>Load</button>');
    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="application/json,.json"');
  });

  /*
   * THE DESTRUCTIVE BUTTON IS LAST, on both screens that have one. Change
   * clears the talents, so it sits to the right of the two buttons that
   * preserve a build rather than between them.
   */
  it('puts Change after the buttons that preserve the build', () => {
    const markup = renderPanel(PROFILE_PRESETS[0].build(), true);
    const change = markup.indexOf('>Change</button>');
    expect(markup.indexOf('>Save</button>')).toBeLessThan(change);
    expect(markup.indexOf('>Load</button>')).toBeLessThan(change);
  });

  /*
   * EXACTLY ONE FILE INPUT ON EITHER SCREEN. Both screens need one and only
   * one is mounted at a time, so the element is built once and passed to
   * whichever renders -- two copies would be two things to keep in step, and
   * the half that drifted would be the one nobody pressed.
   */
  it.each([
    ['the creation screen', false],
    ['the confirmed summary', true],
  ] as const)('%s has exactly one file input', (_where, confirmed) => {
    const markup = renderPanel(
      confirmed ? PROFILE_PRESETS[0].build() : createDefaultProfile(),
      confirmed,
    );
    expect(markup.match(/type="file"/g)?.length).toBe(1);
  });
});
