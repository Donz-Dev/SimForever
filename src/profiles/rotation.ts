import { resolveCombatStyle, resolveStance } from '../game/character';
import { aplFor } from '../game/rotations/rotationFor';
import { withoutOtherRacials } from '../game/rotations/racialCooldowns';
import { withoutUnselectedConsumables } from '../game/rotations/consumableCooldowns';
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

/**
 * The stock list for a build, or undefined where there is none.
 *
 * NARROWED BY RACE, which `aplFor` cannot do: it is keyed by class, style,
 * stance and talents, and the five racial cooldowns belong to none of those.
 * Every list names all four free ones because the shared constant is spread
 * into lists that belong to no race -- and a build only ever learns whichever
 * its own race grants, so the rest are entries a person reading the panel
 * cannot act on. See `withoutOtherRacials`.
 *
 * AND NARROWED BY WHAT IT DRANK, for the identical reason one step along: every
 * list names all nine mid-fight consumables, and a build carries only the one
 * Potion and the one Other it selected. See `withoutUnselectedConsumables`.
 *
 * THE TWO NARROWINGS DIFFER IN ONE WAY THAT MATTERS. A race is settled when the
 * character is made; a SELECTION changes while somebody is looking at the
 * Consumables panel -- and `syncDefaultRotation` re-derives a `default` list on
 * every profile change, so choosing a Major Mana Potion is what makes its entry
 * appear in the list. That is the owner's ask satisfied by a mechanism that was
 * already here rather than by a new one.
 */
export function stockListFor(profile: CharacterProfile): AplList | undefined {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const stance =
    profile.character.characterClass === 'warrior'
      ? resolveStance(style, profile.character.stance)
      : undefined;
  const list = aplFor(profile.character.characterClass, style, stance, profile.talents);
  if (!list) return undefined;
  return withoutUnselectedConsumables(
    withoutOtherRacials(list, profile.character.race),
    profile.character.characterClass,
    profile.consumables,
  );
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
  /*
   * COMPARED BY CONTENTS AND NOT BY NAME ALONE, WHICH IS A CHANGE AND IS WHAT
   * RACE MADE NECESSARY.
   *
   * The name identifies which stock list applies, and for class, style, stance
   * and talents that was the whole question -- a different build means a
   * different list and therefore a different name. RACE does not work that way:
   * an Orc Warrior and a Gnome Warrior run the same NAMED list with different
   * racial entries in it, so a name comparison would have left an Orc's Blood
   * Fury in the list after somebody changed them to a Gnome, and left Eureka!
   * out.
   *
   * Unchanged is still the common case by far and still returns the SAME
   * OBJECT, which keeps React's reference equality useful downstream --
   * `withoutOtherRacials` returns its argument when it has nothing to drop for
   * the same reason.
   */
  if (sameRotation(stock, profile.rotation)) return profile;
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

/**
 * Whether two stored rotations are the same list.
 *
 * BY VALUE, THROUGH JSON, which is enough because a `StoredRotation` is exactly
 * what gets written to a file: plain data, no closures, no undefined-versus-
 * absent ambiguity that `JSON.stringify` does not already resolve the same way
 * on both sides. `aplEditing.ts` relies on the identical property -- that a
 * list round-trips byte-identically -- so this is the same promise read back.
 *
 * KEY ORDER IS NOT A RISK HERE, because both sides are built by the same code
 * from the same declarations: one is `defaultRotationFor` and the other was
 * `defaultRotationFor` the last time this ran.
 */
function sameRotation(a: StoredRotation, b: StoredRotation): boolean {
  return a.name === b.name && JSON.stringify(a.entries) === JSON.stringify(b.entries);
}
