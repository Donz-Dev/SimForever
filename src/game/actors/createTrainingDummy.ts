import { Combatant } from '../../engine';

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
}

/**
 * A target that stands still and does nothing.
 *
 * It has no rotation and no weapon, so it schedules no events of its own. That
 * is the whole point: it isolates player output from anything the encounter
 * might do. Bosses that fight back are encounter content and belong in
 * `src/game/encounters`.
 */
export function createTrainingDummy(options: TrainingDummyOptions = {}): Combatant {
  return new Combatant({
    id: options.id ?? 'dummy_1',
    name: options.name ?? 'Training Dummy',
    kind: 'enemy',
    faction: 'hostile',
    maxHealth: options.health ?? 100_000,
    level: options.level ?? RAID_BOSS_LEVEL,
    stats: { armor: options.armor ?? RAID_BOSS_ARMOR },
  });
}
