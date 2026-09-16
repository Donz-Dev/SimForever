import { Combatant } from '../../engine';

export interface TrainingDummyOptions {
  readonly id?: string;
  readonly name?: string;
  readonly health?: number;
  /**
   * Physical damage reduction. Defaults to 0 so that first-run numbers are easy
   * to check by hand: damage dealt is damage taken.
   */
  readonly armor?: number;
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
    stats: { armor: options.armor ?? 0 },
  });
}
