import type { CharacterProfile, ProfileLoadResult } from '../profiles';
import { parseProfile, serializeProfile } from '../profiles';
import { getClass, getRace } from '../game/character';

/**
 * Saving a profile to a file, and loading one back.
 *
 * ----------------------------------------------------------------------------
 * THE FILE IS THE PROFILE'S OWN JSON, not a format of its own. The owner asked
 * for "a simple build text file with all of the variables that make a profile",
 * and `serializeProfile` already writes exactly that -- indented, diffable, and
 * hand-editable, which is what that file was always for.
 *
 * WHAT A SECOND FORMAT WOULD COST IS THE VERSION FIELD. Every profile carries
 * `version`, and `migrateProfile` has twelve steps behind it: a file saved
 * today still loads after the format moves on, because loading runs parse ->
 * MIGRATE -> validate in that order. A bespoke text format would be a second
 * serializer to keep in step with `CharacterProfile`, with no migration path
 * and nothing to notice when the two drifted.
 *
 * THE THREE FUNCTIONS ARE SPLIT BY WHAT THEY TOUCH. `profileFileName` is pure
 * and `readProfileFile` needs only a `File`, so both are tested directly;
 * `downloadProfile` is the one that reaches the DOM, and it holds no logic
 * worth testing because everything it would assert is the browser's.
 * ----------------------------------------------------------------------------
 */

/** The extension every saved profile carries. */
export const PROFILE_FILE_EXTENSION = '.json';

/**
 * What the save dialog should offer to call the file.
 *
 * Named after the CHARACTER rather than the format -- `thrall-orc-warrior.json`
 * -- because a folder of saved builds is read by their names, and "profile (3)"
 * is what a download directory does to anything that does not name itself.
 *
 * The race and class are in it because a name alone does not say what the build
 * is, and because two characters called "Test" are the common case while saving
 * repeatedly. They come from the definitions rather than the ids so the file
 * reads the way the character sheet does.
 *
 * SLUGGED RATHER THAN SANITISED, which is the difference that matters on
 * Windows: a name may legally contain `:`, `/`, `?` or a trailing dot, and a
 * download whose filename holds one is silently renamed or refused by the
 * browser. Reducing to lowercase letters, digits and hyphens cannot produce any
 * of them. A name made ENTIRELY of such characters leaves nothing behind, so
 * there is a fallback rather than a file called `-warrior.json`.
 */
export function profileFileName(profile: CharacterProfile): string {
  const race = getRace(profile.character.race);
  const classDefinition = getClass(profile.character.characterClass);
  const parts = [profile.character.name, race?.name, classDefinition?.name]
    .map((part) => slug(part ?? ''))
    .filter((part) => part.length > 0);

  // Every part can slug away -- a character named "???" on a build whose race
  // and class ids are not in the tables. `profile` is still a real file name.
  const stem = parts.length > 0 ? parts.join('-') : 'profile';
  return `${stem}${PROFILE_FILE_EXTENSION}`;
}

/** Lowercase, letters digits and hyphens only, no leading or trailing hyphen. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Hand the profile to the browser as a download.
 *
 * An object URL and a synthetic click, which is the only way to write a file
 * from a page without a server or the File System Access API -- the latter is
 * not in Firefox or Safari, and this app is a static GitHub Pages site with
 * nothing to POST to.
 *
 * THE URL IS REVOKED, because an object URL pins its Blob in memory until it
 * is. Someone saving a build after every talent change would otherwise leak one
 * profile's worth of text per click for the life of the tab.
 */
export function downloadProfile(profile: CharacterProfile): void {
  const blob = new Blob([serializeProfile(profile)], {
    // `application/json` rather than `text/plain`: the content IS JSON, and
    // naming it honestly is what makes a browser offer to save rather than to
    // display it.
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = profileFileName(profile);
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Read a chosen file and turn it into a profile, or into the reasons it is not
 * one.
 *
 * ASYNC BECAUSE THE FILE IS, and for no other reason: everything after
 * `file.text()` is the same `parseProfile` the paste box uses, so a file and a
 * paste cannot disagree about whether something is loadable.
 *
 * A READ FAILURE IS A LOAD FAILURE, reported in the same shape as a validation
 * issue rather than thrown. The caller is a button: it has one place to show
 * what went wrong, and a rejected promise would need a second.
 */
export async function readProfileFile(file: File): Promise<ProfileLoadResult> {
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, issues: [{ path: '', message: `Could not read the file: ${message}` }] };
  }

  return parseProfile(text);
}
