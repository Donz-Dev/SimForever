/**
 * Damage schools. The school decides which mitigation applies (armor for
 * physical, resistance for magical) and gives the analysis layer a natural
 * axis to break damage down by.
 */
export const DAMAGE_SCHOOLS = [
  'physical',
  'arcane',
  'fire',
  'frost',
  'holy',
  'nature',
  'shadow',
] as const;

export type DamageSchool = (typeof DAMAGE_SCHOOLS)[number];

export function isPhysical(school: DamageSchool): boolean {
  return school === 'physical';
}
