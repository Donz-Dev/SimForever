import type { PrecombatAction } from '../../engine';
import type { AplEntry } from '../../game/rotations/apl';

/**
 * A preset's own Multi Target section (round 78): what it casts when the fight
 * holds more than one target, and -- when it opens differently from its Single
 * Target list -- its own pre-combat list.
 */
export interface MultiTargetDefault {
  /** What the list is called in the panel. */
  readonly name: string;
  readonly entries: readonly AplEntry[];
  /** Absent means the Single Target opener, copied. */
  readonly precombat?: readonly PrecombatAction[];
}

export type MultiTargetDefaults = Readonly<Record<string, MultiTargetDefault>>;
