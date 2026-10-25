import type { CharacterProfile, StoredAplSection } from './CharacterProfile';

/**
 * THE TWO APL SECTIONS (round 64): "APL: Single Target" and "APL: Multi
 * Target", each a pre-combat list and a combat list.
 *
 * ============================================================================
 * SINGLE TARGET IS `rotation` AND `precombat` ON THE PROFILE ROOT, unchanged,
 * and Multi Target is `multiTarget` beside them. So the rest of the app keeps
 * reading the root, and these helpers are how a section is SWAPPED INTO the
 * root -- for the panel that edits it, and for the fight that runs it.
 *
 * WHICH ONE A FIGHT RUNS, the owner's split:
 *
 *   - DPS and tank fights: Multi Target when there is more than one target,
 *     Single Target otherwise;
 *   - the tank healer fight: Single Target, one target to heal;
 *   - the raid healer fight: Multi Target, always.
 * ============================================================================
 */

export type AplSection = 'single' | 'multi';

/** One section of a profile. Multi Target falls back to Single when absent. */
export function sectionOf(profile: CharacterProfile, section: AplSection): StoredAplSection {
  const single: StoredAplSection = {
    rotation: profile.rotation,
    ...(profile.precombat ? { precombat: profile.precombat } : {}),
  };
  return section === 'multi' ? (profile.multiTarget ?? single) : single;
}

/**
 * The profile with a section's lists at the ROOT, and no second list -- which
 * is what makes it idempotent: a profile already swapped has nothing left to
 * swap, so an encounter that swaps again changes nothing.
 */
export function withSection(profile: CharacterProfile, section: AplSection): CharacterProfile {
  const chosen = sectionOf(profile, section);
  const { precombat: _precombat, multiTarget: _multi, ...rest } = profile;
  void _precombat;
  void _multi;
  return {
    ...rest,
    rotation: chosen.rotation,
    ...(chosen.precombat ? { precombat: chosen.precombat } : {}),
  };
}

/**
 * Write a section back: `view` is a profile whose ROOT lists are that
 * section's, as `withSection` made it and an editor changed it.
 */
export function setSection(
  profile: CharacterProfile,
  section: AplSection,
  view: CharacterProfile,
): CharacterProfile {
  const lists: StoredAplSection = {
    rotation: view.rotation,
    ...(view.precombat ? { precombat: view.precombat } : {}),
  };
  if (section === 'multi') return { ...profile, multiTarget: lists };
  const { precombat: _dropped, ...rest } = profile;
  void _dropped;
  return { ...rest, ...lists };
}

/** The section a fight runs. See the table above. */
export function fightSection(fight: { readonly targets: number; readonly healer?: 'tank' | 'raid' }): AplSection {
  if (fight.healer === 'raid') return 'multi';
  if (fight.healer === 'tank') return 'single';
  return fight.targets > 1 ? 'multi' : 'single';
}
