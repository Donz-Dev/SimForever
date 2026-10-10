import { resolveCombatStyle, resolveStance } from '../game/character';
import { aplFor } from '../game/rotations/rotationFor';
import type { AplList } from '../game/rotations/apl';
import type { CharacterProfile, StoredRotation } from './CharacterProfile';

/**
 * Keeping a profile's stored priority list honest about the build it belongs
 * to.
 *
 * ============================================================================
 * A STORED LIST IS FROZEN, WHICH IS WHAT WAS ASKED FOR AND IS ALSO A TRAP.
 *
 * The owner's call is that a saved file carries the list in full, so nothing
 * about it depends on what this build of the simulator thinks a Beast Mastery
 * Hunter's stock list is. The consequence is that the list stops following the
 * BUILD -- and the build is editable. Change a Rogue's capstone and the stock
 * list for the new spec is a different one; change class and the stored list
 * names another class's abilities entirely, every one of which
 * `PriorityRotation` skips in silence.
 *
 * THIS PROJECT HAS ALREADY PAID FOR THAT EXACT FAILURE. A Fire Mage ran the
 * Arcane list for its whole life and produced a perfectly ordinary DPS figure,
 * because a wrong rotation does not look wrong -- it looks like a build that is
 * worse than you expected.
 *
 * SO `source` DECIDES, AND THE TWO CASES ARE GENUINELY DIFFERENT:
 *
 *   - `'default'` is the stock list written out. Editing the build inside the
 *     app RE-DERIVES it, which is the same rule gear already follows -- "gear
 *     belongs to a class, so changing class replaces it".
 *   - `'custom'` is somebody's own list, and nothing may silently replace it.
 *     What happens instead is that the panel SAYS it no longer matches the
 *     build's stock list, which is a decision for the person rather than for
 *     this function.
 *
 * AND LOADING A FILE CALLS NEITHER OF THESE. A loaded profile runs exactly what
 * is in the file, whichever `source` it names; `syncDefaultRotation` is for
 * edits made in the app.
 * ============================================================================
 */

/** The stock list for a build, as a profile would store it. */
export function defaultRotationFor(profile: CharacterProfile): StoredRotation {
  const list = stockListFor(profile);
  return {
    source: 'default',
    /*
     * A BUILD WITH NO LIST STORES AN EMPTY ONE RATHER THAN NOTHING. Three
     * Druid forms and a healer spec have no damage list, and the field is not
     * optional -- an empty list is what "fights with auto attacks only"
     * already means to `createPlayer`, which leaves the rotation off when
     * there is nothing to choose.
     */
    name: list?.name ?? '',
    entries: list ? [...list.entries] : [],
  };
}

/** The stock list for a build, or undefined where there is none. */
export function stockListFor(profile: CharacterProfile): AplList | undefined {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const stance =
    profile.character.characterClass === 'warrior'
      ? resolveStance(style, profile.character.stance)
      : undefined;
  return aplFor(profile.character.characterClass, style, stance, profile.talents);
}

/**
 * Re-derive a `'default'` list after an edit, and leave a `'custom'` one alone.
 *
 * Called on every profile change the app makes rather than only on the ones
 * that could matter, because it is idempotent and because the alternative is a
 * list of "edits that change which stock list applies" -- class, style, stance
 * and talents today, and whatever selects a list next. That list would be
 * correct until somebody adds a fifth thing and does not think of it.
 */
export function syncDefaultRotation(profile: CharacterProfile): CharacterProfile {
  if (profile.rotation.source === 'custom') return profile;
  const stock = defaultRotationFor(profile);
  // Unchanged is the common case by far, and returning the SAME OBJECT keeps
  // React's reference equality useful for everything downstream.
  if (stock.name === profile.rotation.name) return profile;
  return { ...profile, rotation: stock };
}

/**
 * Whether a CUSTOM list was built for a different list than the build now
 * wants -- the question the panel warns about.
 *
 * Compared by NAME rather than by contents, because a custom list has
 * different contents by definition. The name says which stock list it was
 * derived from, so it is the only thing that can answer "is this list still
 * about this build".
 */
export function rotationMatchesBuild(profile: CharacterProfile): boolean {
  if (profile.rotation.source === 'default') return true;
  const stock = stockListFor(profile);
  return (stock?.name ?? '') === profile.rotation.name;
}
