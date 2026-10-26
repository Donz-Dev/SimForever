import type { MultiTargetDefault, MultiTargetDefaults } from './types';
import type { AplCondition, AplEntry, AplList } from '../../game/rotations/apl';
import { all, targetCount } from '../../game/rotations/apl';
import {
  HUNTER_BEAST_MASTERY,
  HUNTER_HAWK_MELEE,
  HUNTER_LONE_WOLF_MELEE,
  HUNTER_LONE_WOLF_RANGED,
} from '../../game/rotations/hunter';
import { withoutOtherRacials } from '../../game/rotations/racialCooldowns';
import type { RaceId } from '../../game/character';

/**
 * ==============================================================================
 * THE HUNTER PRESETS' MULTI TARGET LISTS (round 78), keyed by preset id.
 *
 * Each is built FROM its Single Target stock list, so the Aspect, the racials,
 * the consumables, the cooldown stack and Hunter's Mark arrive in the positions
 * that list puts them and nothing is retyped. Measured at 5 targets/60s with
 * 400 paired fights against the Single Target list run on five targets, and
 * checked at 3 targets/60s and 8 targets/30s, where each also wins.
 *
 * THE RANGED PAIR -- Multi-Shot takes Aimed Shot's place (they share a
 * cooldown group), the trap goes in through the Melee Weave as Explosive Trap,
 * Serpent Sting walks three targets up to five, and Volley is a channel with
 * NO COOLDOWN, which makes it a floor wherever it sits:
 *
 *   BM Hunter  +636.9 at 5, +371.2 at 3, +1563.9 at 8 (Volley lifted above the
 *              sting from six targets is +346 of that 8-target figure and runs
 *              identical fights at 3 and 5)
 *   LW Ranged  +818.1 at 5, +375.6 at 3, +1937.2 at 8
 *
 * BM keeps Volley LAST up to five targets (+496 against +470 above Multi-Shot
 * on the first pass): its pet and hawks are a third of its damage and want the
 * mana that keeps the hawks and the sting up. LW Ranged has neither, and wants
 * Volley above Aimed Shot.
 *
 * THE MELEE PAIR -- Explosive Trap REPLACES Immolation Trap and moves above
 * Raptor Strike: LW Melee +267.3 at 5, +139.2 at 3, +481.4 at 8; Hawk Melee
 * +261.1, +136.6, +469.6 (both including Clever Traps). NOT BOTH TRAPS: "only
 * one Fire trap can be active at a time" is not enforced by the engine, and a
 * list casting both would be collecting on that gap (+243.7 and +229.5 at
 * five, priced as a question). Volley and Multi-Shot are ranged and are not
 * added to a melee list.
 * ==============================================================================
 */

const and = (entry: AplEntry, condition: AplCondition): AplEntry => ({
  ...entry,
  condition: entry.condition ? all(entry.condition, condition) : condition,
});

const EXPLOSIVE_WEAVE: AplEntry = { abilityId: 'melee_weave', weave: ['explosive_trap'] };
const VOLLEY_FROM_SIX: AplEntry = { abilityId: 'volley', condition: targetCount('atLeast', 6) };

/** The stock entries, narrowed to the preset's race, split after Hunter's Mark. */
function opening(list: AplList, race: RaceId): { head: AplEntry[]; rest: AplEntry[] } {
  const entries = [...withoutOtherRacials(list, race).entries];
  const at = entries.findIndex((e) => e.abilityId === 'hunters_mark');
  if (at < 0) throw new Error(`${list.name} has no Hunter's Mark entry`);
  return { head: entries.slice(0, at + 1), rest: entries.slice(at + 1) };
}

function find(entries: readonly AplEntry[], id: string): AplEntry {
  const entry = entries.find((e) => e.abilityId === id);
  if (!entry) throw new Error(`no entry for ${id}`);
  return entry;
}

/** Serpent Sting on three targets up to five, and on the boss alone above that. */
function splitSting(sting: AplEntry): AplEntry[] {
  return [and({ ...sting, multiDot: 3 }, targetCount('atMost', 5)), and(sting, targetCount('atLeast', 6))];
}

function bmAoe(): MultiTargetDefault {
  const { head, rest } = opening(HUNTER_BEAST_MASTERY, 'high_order_skyborne');
  return {
    name: 'Hunter (Beast Mastery) AoE',
    entries: [
      ...head,
      EXPLOSIVE_WEAVE,
      VOLLEY_FROM_SIX,
      ...splitSting(find(rest, 'serpent_sting')),
      find(rest, 'summon_hawk'),
      { abilityId: 'multi_shot' },
      find(rest, 'aimed_shot'),
      find(rest, 'arcane_shot'),
      { abilityId: 'volley' },
    ],
  };
}

function lwRangedAoe(): MultiTargetDefault {
  const { head, rest } = opening(HUNTER_LONE_WOLF_RANGED, 'high_order_skyborne');
  return {
    name: 'Hunter (Lone Wolf Ranged) AoE',
    entries: [
      ...head,
      EXPLOSIVE_WEAVE,
      VOLLEY_FROM_SIX,
      ...splitSting(find(rest, 'serpent_sting')),
      { abilityId: 'multi_shot' },
      { abilityId: 'volley' },
      find(rest, 'aimed_shot'),
      find(rest, 'arcane_shot'),
      find(rest, 'sniper_shot'),
    ],
  };
}

/** A melee list with Explosive Trap in Immolation Trap's place, above Raptor Strike. */
function meleeAoe(list: AplList, name: string): MultiTargetDefault {
  const entries = withoutOtherRacials(list, 'orc').entries.filter((e) => e.abilityId !== 'immolation_trap');
  const at = entries.findIndex((e) => e.abilityId === 'raptor_strike');
  if (at < 0) throw new Error(`${list.name} has no Raptor Strike entry`);
  return { name, entries: [...entries.slice(0, at), { abilityId: 'explosive_trap' }, ...entries.slice(at)] };
}

export const HUNTER_MULTI_TARGET: MultiTargetDefaults = {
  bm_hunter: bmAoe(),
  lw_ranged: lwRangedAoe(),
  lw_melee: meleeAoe(HUNTER_LONE_WOLF_MELEE, 'Hunter (Lone Wolf Melee) AoE'),
  hawk_melee: meleeAoe(HUNTER_HAWK_MELEE, 'Hunter (Hawk Melee) AoE'),
};
