import { Combatant } from '../../engine';
import { bossMeleeWeapon } from '../encounters/raidBoss';

/**
 * Raid boss level, three above a level 60 character.
 *
 * The gap is what drives the whole combat table: 315 defense skill against
 * 300 weapon skill, and 4.8 percentage points of crit suppression.
 */
export const RAID_BOSS_LEVEL = 63;

/** Armor of a level 63 raid boss: just under 40% physical reduction. */
export const RAID_BOSS_ARMOR = 3731;

export interface TrainingDummyOptions {
  readonly id?: string;
  readonly name?: string;
  readonly health?: number;
  /** Physical damage reduction. Defaults to raid boss armor. */
  readonly armor?: number;
  /** Defaults to raid boss level. Drives defense skill and crit suppression. */
  readonly level?: number;
  /**
   * Whether it swings back.
   *
   * Off by default, which is what makes it a training dummy. Turning it on is
   * what brings the attacks-received table, rage from damage taken and Revenge
   * to life -- none of which has ever fired in a real fight.
   */
  readonly attacks?: boolean;
  /** Damage per swing before armor. Defaults to the placeholder boss figure. */
  readonly swingDamage?: number;
  /** Seconds between swings. Defaults to the placeholder boss figure. */
  readonly swingSeconds?: number;
}

/**
 * A target that stands still, and optionally hits back.
 *
 * With `attacks` off it has no rotation and no weapon, so it schedules no
 * events of its own. That isolates player output from anything the encounter
 * might do, and is the right default for measuring damage.
 *
 * With `attacks` on it swings on a timer using the numbers in
 * `encounters/raidBoss.ts`, every one of which is a flagged placeholder
 * borrowed from Classic. That is what makes the attacks-received table, rage
 * from damage taken and Revenge reachable at all.
 */
export function createTrainingDummy(options: TrainingDummyOptions = {}): Combatant {
  return new Combatant({
    /*
     * IT DOES NOT DIE, whatever it is hit with.
     *
     * The ruleset owner's decision, and it is what the encounter has always
     * been for: a target that takes damage for a predetermined duration, not
     * something with a health bar to get through. Its health pool is a number
     * damage is subtracted from so the log has somewhere to put it, and
     * nothing should depend on the total.
     *
     * Without this a long enough fight ends early -- a rogue probe at one hour
     * killed a hundred-thousand-health dummy and cut the iteration short,
     * which silently changes the denominator of every per-second figure in it.
     */
    survivesLethalDamage: true,
    id: options.id ?? 'dummy_1',
    name: options.name ?? 'Training Dummy',
    kind: 'enemy',
    faction: 'hostile',
    maxHealth: options.health ?? 100_000,
    level: options.level ?? RAID_BOSS_LEVEL,
    stats: { armor: options.armor ?? RAID_BOSS_ARMOR },
    ...(options.attacks
      ? {
          autoAttack: 'main-hand' as const,
          weapons: {
            mainHand: bossMeleeWeapon({
              damage: options.swingDamage,
              swingSeconds: options.swingSeconds,
            }),
          },
        }
      : {}),
  });
}
