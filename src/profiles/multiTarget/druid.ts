import type { MultiTargetDefaults } from './types';
import type { AplEntry } from '../../game/rotations/apl';
import { targetCount } from '../../game/rotations/apl';
import { DRUID_MOONKIN } from '../../game/rotations/druid';

/** `entries` with `added` inserted immediately above the first entry casting `beforeId`. */
function insertAbove(entries: readonly AplEntry[], beforeId: string, added: readonly AplEntry[]): AplEntry[] {
  const at = entries.findIndex((entry) => entry.abilityId === beforeId);
  if (at < 0) throw new Error(`no ${beforeId} entry to insert above`);
  return [...entries.slice(0, at), ...added, ...entries.slice(at)];
}

/**
 * The Druid presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 */
export const DRUID_MULTI_TARGET: MultiTargetDefaults = {
  /*
   * THE MOONKIN: HURRICANE ON FOUR TARGETS OR MORE, AND THE SINGLE TARGET LIST
   * BELOW IT. Hurricane hits every target for ten ticks, so it outruns the
   * whole single-target rotation once there are enough of them -- paired at
   * 400 fights, +425.7 at 5 targets/60s and +1,141 at 8 targets/30s. At THREE
   * targets it LOSES (-68.3 at 60s), which is why it is gated at four and three
   * runs the single-target list unchanged. Placed below the potion row, so the
   * Spellblasting Potion still goes out at the pull.
   */
  druid_moonkin: {
    name: 'Druid (Moonkin, Multi Target)',
    entries: insertAbove(DRUID_MOONKIN.entries, 'innervate', [
      { abilityId: 'hurricane', condition: targetCount('atLeast', 4) },
    ]),
  },
};
