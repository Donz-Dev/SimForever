/**
 * WHICH PRESETS ARE TANKS AND WHICH ARE HEALERS, the owner's assignment.
 *
 * NAMED, NOT DERIVED. A tank or a healer is a ROLE the owner assigned, and Fury
 * Prot is a dual-wielding tank that `isTankBuild` would have to be taught
 * about. A preset in neither list is a DPS profile, so a new one appears there.
 *
 * Here rather than in the profile rail (round 78), because the measurement and
 * report tools need the same answer and must not import the UI for it.
 */
export const TANK_PROFILE_IDS: readonly string[] = ['druid_bear', 'prot_warr', 'prot_pally', 'fury_prot', 'protribution'];
export const HEALER_PROFILE_IDS: readonly string[] = [
  'shaman_resto',
  'holy_pal',
  'druid_resto',
  'priest_holy',
  'priest_disc',
];

export type PresetRole = 'dps' | 'tank' | 'healer';

/** A preset's role. */
export function presetRole(id: string): PresetRole {
  if (TANK_PROFILE_IDS.includes(id)) return 'tank';
  if (HEALER_PROFILE_IDS.includes(id)) return 'healer';
  return 'dps';
}
