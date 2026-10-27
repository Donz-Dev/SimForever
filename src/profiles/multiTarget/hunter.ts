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
 * five, priced as a question).
 *
 * ROUND 80 -- VOLLEY IN THE MELEE LISTS, WHICH THE OWNER ASKED FOR BY NAME. It
 * is a ranged channel with no cooldown and needs no swinging bow (it reads
 * ranged attack power only), so above Raptor Strike it is a FLOOR: from that
 * point on the list is Explosive Trap and Volley. 300 paired fights:
 *
 *   LW Melee    +603.5 at 5/60s, +1376.0 at 8/30s; at 3/60s +63.5, and +88.1
 *               with the boss's Serpent Sting above it at three targets or
 *               fewer (above it at five it costs 31). +442.4 weighted.
 *   Hawk Melee  +503.5 at 5, +1234.7 at 8, but -29.5 at 3 -- the hawks and the
 *               melee keep more value there -- so Volley is gated on FOUR
 *               targets, and at three the list is the Single Target one
 *               (sting above Raptor, Arcane above Wing Clip): +89.9 at 3.
 *               +355.0 weighted.
 *
 * Volley above Explosive Trap was +368 / +272, above Strider Kick +500 / +380,
 * above Wing Clip +466 / +324. A mana floor on it changed nothing (no fight
 * reached 2,000 mana). Multi-Shot reads the ranged weapon, which a dual-wield
 * build does not swing: -42 / -40. Serpent Sting on three targets: -168 / -237.
 *
 * LW RANGED, ROUND 80: the sting walks FIVE targets (+22.1 at five) and
 * Multi-Shot goes above it at three targets or fewer (+14.2 at three).
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
function splitSting(sting: AplEntry, multiDot = 3): AplEntry[] {
  return [and({ ...sting, multiDot }, targetCount('atMost', 5)), and(sting, targetCount('atLeast', 6))];
}

function bmAoe(): MultiTargetDefault {
  const { head, rest } = opening(HUNTER_BEAST_MASTERY, 'orc');
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
  const { head, rest } = opening(HUNTER_LONE_WOLF_RANGED, 'troll');
  return {
    name: 'Hunter (Lone Wolf Ranged) AoE',
    entries: [
      ...head,
      EXPLOSIVE_WEAVE,
      VOLLEY_FROM_SIX,
      { abilityId: 'multi_shot', condition: targetCount('atMost', 3) },
      ...splitSting(find(rest, 'serpent_sting'), 5),
      { abilityId: 'multi_shot' },
      { abilityId: 'volley' },
      find(rest, 'aimed_shot'),
      find(rest, 'arcane_shot'),
      find(rest, 'sniper_shot'),
    ],
  };
}

/**
 * A melee list with Explosive Trap in Immolation Trap's place, above the
 * Serpent Sting the Single Target list puts over Raptor Strike, and Volley
 * (the `volley` entry) above Raptor Strike. `stingFirst` puts the sting above
 * the Volley and gates it to three targets or fewer (LW Melee); otherwise the
 * Volley is above the sting (Hawk Melee, whose Volley is gated instead).
 * `drop` names Single Target entries the section does without.
 */
function meleeAoe(
  list: AplList,
  name: string,
  opts: { readonly volley: AplEntry; readonly stingFirst: boolean; readonly drop?: readonly string[] },
): MultiTargetDefault {
  const drop = new Set(['immolation_trap', ...(opts.drop ?? [])]);
  const entries = withoutOtherRacials(list, 'orc').entries.filter((e) => !drop.has(e.abilityId));
  const at = entries.findIndex((e) => e.abilityId === 'serpent_sting');
  if (at < 0 || entries[at + 1]?.abilityId !== 'raptor_strike') {
    throw new Error(`${list.name}: expected Serpent Sting directly above Raptor Strike`);
  }
  const sting = entries[at];
  const middle = opts.stingFirst
    ? [and(sting, targetCount('atMost', 3)), opts.volley]
    : [opts.volley, sting];
  return {
    name,
    entries: [...entries.slice(0, at), { abilityId: 'explosive_trap' }, ...middle, ...entries.slice(at + 1)],
  };
}

export const HUNTER_MULTI_TARGET: MultiTargetDefaults = {
  bm_hunter: bmAoe(),
  lw_ranged: lwRangedAoe(),
  lw_melee: meleeAoe(HUNTER_LONE_WOLF_MELEE, 'Hunter (Lone Wolf Melee) AoE', {
    volley: { abilityId: 'volley' },
    stingFirst: true,
    // Below an ungated Volley it could never be reached.
    drop: ['arcane_shot'],
  }),
  hawk_melee: meleeAoe(HUNTER_HAWK_MELEE, 'Hunter (Hawk Melee) AoE', {
    volley: { abilityId: 'volley', condition: targetCount('atLeast', 4) },
    stingFirst: false,
  }),
};
