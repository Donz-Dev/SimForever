import type { BatchStatAverages } from '../../analysis';

/**
 * The ONE power figure the results header shows: whichever of the character's
 * pools is largest, named for what it is.
 *
 * The owner's "max(Spell Power, School Spell Power, Melee Attack Power,
 * Ranged Attack Power)". The largest pool is the one the build's damage scales
 * with -- a Hunter's ranged pool beats its melee one, a Shadow Priest's Shadow
 * pool beats the school-blind one -- so it answers "how strong is this
 * character" without a row per pool, most of them noise.
 *
 * A TIE GOES TO THE EARLIER CANDIDATE, which is why melee comes first: every
 * class has 50 ranged attack power, and a Warrior with 50 of both is a melee
 * character. A school pool reads the TOTAL for that school, so it only wins
 * when it adds something over the blind pool.
 */
export interface HeadlinePower {
  readonly label: string;
  readonly value: number;
}

export function headlinePower(stats: BatchStatAverages): HeadlinePower {
  const candidates: HeadlinePower[] = [
    { label: 'Attack Power', value: stats.attackPower },
    { label: 'Ranged Attack Power', value: stats.rangedAttackPower },
    { label: 'Spell Power', value: stats.spellPower },
    ...Object.entries(stats.spellPowerBySchool).map(([school, value]) => ({
      label: `${school.charAt(0).toUpperCase() + school.slice(1)} Spell Power`,
      value: value ?? 0,
    })),
  ];
  return candidates.reduce((best, next) => (next.value > best.value ? next : best));
}
