import type { MultiTargetDefaults } from './types';
import type { AplEntry } from '../../game/rotations/apl';
import { all, fightRemaining, selfHas, targetCount, targetExpired } from '../../game/rotations/apl';
import { DRUID_BEAR, DRUID_MOONKIN, MOONKIN_DOT_LAST_SECONDS } from '../../game/rotations/druid';

/** `entries` with `added` inserted immediately above the first entry casting `beforeId`. */
function insertAbove(entries: readonly AplEntry[], beforeId: string, added: readonly AplEntry[]): AplEntry[] {
  const at = entries.findIndex((entry) => entry.abilityId === beforeId);
  if (at < 0) throw new Error(`no ${beforeId} entry to insert above`);
  return [...entries.slice(0, at), ...added, ...entries.slice(at)];
}

/** The Single Target DoT entries, walked across every target (`multiDot`). */
function walkDots(entries: readonly AplEntry[]): AplEntry[] {
  return entries.map((entry) =>
    entry.abilityId === 'moonfire' || entry.abilityId === 'insect_swarm'
      ? { ...entry, multiDot: MOONKIN_DOT_WALK_TARGETS }
      : entry,
  );
}

/** Enough to reach every target the report fights (three, at this list's depth). */
const MOONKIN_DOT_WALK_TARGETS = 5;

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
  /*
   * ROUND 80 ADDED TWO DoT SHAPES, each for the target count it pays at:
   *
   * - AT 4 TO 7 TARGETS, MOONFIRE ON TWO OF THEM ABOVE HURRICANE: +29.96 at
   *   5/60 s (one target +9.83, three +15.62, five -2.23); bit-identical at 8.
   * - BELOW HURRICANE, MOONFIRE AND INSECT SWARM WALKED ACROSS EVERY TARGET,
   *   which only three targets reach (Hurricane is never castable there):
   *   **+144.7** at 3/60 s; at 8/30 s walking them above Hurricane is -241.
   *
   * Both stop with eight seconds left, as the Single Target DoTs do.
   */
  druid_moonkin: {
    name: 'Druid (Moonkin, Multi Target)',
    entries: insertAbove(
      walkDots(DRUID_MOONKIN.entries),
      'innervate',
      [
        {
          abilityId: 'moonfire',
          multiDot: 2,
          condition: all(
            targetCount('atLeast', 4),
            targetCount('atMost', 7),
            targetExpired('moonfire'),
            fightRemaining('atLeast', MOONKIN_DOT_LAST_SECONDS),
          ),
        },
        { abilityId: 'hurricane', condition: targetCount('atLeast', 4) },
      ],
    ),
  },
  /*
   * THE BEAR: PRIMAL BITE WHILE BERSERK IS UP, THEN SWIPE, ABOVE THE ORDINARY
   * PRIMAL BITE. Berserk makes Primal Bite strike three targets with no
   * cooldown, so it goes first while that lasts; outside it Swipe's three
   * targets beat the single Primal Bite. Maul stays above both. Paired TPS:
   * +196.6 at 5 targets/60s, +212.4 at 3/60s and +195.7 at 8/30s, for +0.3 to
   * +0.44 deaths. Swipe ABOVE Maul is -393: it starves the Maul.
   */
  druid_bear: {
    name: 'Druid (Bear, Multi Target)',
    entries: insertAbove(DRUID_BEAR.entries, 'mangle', [
      { abilityId: 'mangle', condition: selfHas('berserk') },
      { abilityId: 'swipe', condition: targetCount('atLeast', 2) },
    ]),
    /*
     * THE OWNER'S OPENER WITH BERSERK ADDED AT THE PULL (round 80), ahead of
     * the Primal Bite so the first bite already strikes three targets and the
     * window's fifteen seconds start at the pull with no global cooldown spent
     * on it. Paired TPS +54.1 at 5/60 s, +86.8 at 3/60 s, +163.9 at 8/30 s;
     * deaths unchanged. At one target it is +2.1 noise, so the Single Target
     * opener is left as the owner wrote it.
     */
    precombat: [
      { abilityId: 'bear_form', secondsBefore: 1.5 },
      { abilityId: 'enrage', secondsBefore: 0 },
      { abilityId: 'mighty_rage_potion', secondsBefore: 0 },
      { abilityId: 'maul', secondsBefore: 0 },
      { abilityId: 'berserk', secondsBefore: 0 },
      { abilityId: 'mangle', secondsBefore: 0 },
    ],
  },
};
