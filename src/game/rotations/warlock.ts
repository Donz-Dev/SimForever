import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Warlock priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS, specified entry by entry and measured after.
 * This header said the opposite -- "SHELLS, AND SAID TO BE. Not the ruleset
 * owner's own lists" -- for most of the project's life, which is exactly how a
 * shell should read while it is one.
 *
 * CHOSEN BY CAPSTONE, the Rogue's test: Wrack is 31 points into Affliction and
 * Incinerate is 31 into Destruction, and no build reaches both.
 *
 * BOTH LISTS OPEN THEIR DAMAGE-OVER-TIME EFFECTS AND THEN FILL, which is what
 * a Warlock is: the fillers are worth less per global cooldown than keeping a
 * bleed up, so every list is "is anything about to fall off" first.
 * ----------------------------------------------------------------------------
 */

/** Refresh a debuff when it is nearly gone, not on cooldown. */
const REFRESH_WINDOW_MS = 2000;

const missing = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) < REFRESH_WINDOW_MS;

/**
 * "IF NOT ACTIVE", which is the ruleset owner's wording and is NOT the same as
 * the two-second refresh window beside it.
 *
 * ----------------------------------------------------------------------------
 * A REFRESH RESETS THE AURA, so anything left on the clock when the rotation
 * reaches the entry is thrown away. A two-second window clips up to two
 * seconds off every application -- and the faster the character acts, the
 * sooner it reaches the entry inside that window and the more it loses.
 *
 * MEASURED ON THE MOONKIN, where Nature's Grace cost 14.9 DPS by doing nothing
 * but speeding the character up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5. The buff was fine; the window was paying for it.
 *
 * `missing` is kept for the lists the owner has not replaced, so the two
 * readings sit side by side rather than one silently becoming the other.
 * ----------------------------------------------------------------------------
 */
const expired = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.remainingMs(auraId, context.clock.now()) <= 0;

/** "current mana is below N% of maximum". */
const manaBelowFraction = (fraction: number) =>
  (_context: SimulationContext, actor: Combatant): boolean => {
    const mana = actor.resources.get('mana');
    if (!mana || mana.maximum <= 0) return false;
    return mana.current / mana.maximum < fraction;
  };

// ---------------------------------------------------------------------------

/**
 * SM/DS — Shadow Mastery and Demonic Sacrifice, which is what the name means.
 *
 * 40/11/0. Its damage is three damage-over-time effects and Shadow Bolt, and
 * almost every talent it takes raises one or the other: Shadow Mastery is +5%
 * Shadow, Malediction +5% periodic, Improved Corruption both a faster cast and
 * more damage.
 *
 * SHADOW BOLT LAST AND SHADOW TRANCE FIRST. Nightfall gives the bolt a chance
 * to become instant off a damage-over-time tick, and an instant Shadow Bolt is
 * worth more than a three-second one by exactly the cast time -- so the
 * proc is spent as soon as it arrives.
 *
 * LIFE TAP WHERE THE MANA RUNS OUT. It is free here in a way it is not in a
 * real raid: nothing attacks these profiles, so the health has no other use.
 * Its own `canCast` refuses when the pool is near full, which keeps it from
 * costing a global cooldown for nothing.
 */
export const WARLOCK_AFFLICTION: readonly PriorityEntry[] = [
  /*
   * THE THREE DOTS FIRST, IN THE OWNER'S ORDER, and the Shadow Trance-gated
   * Shadow Bolt that used to head this list is gone. That entry existed to
   * spend a proc the moment it landed; the owner's order holds the bleeds up
   * first and lets the filler at the bottom take the proc when it comes.
   */
  { abilityId: 'bane_of_agony', condition: expired('bane_of_agony') },
  { abilityId: 'corruption', condition: expired('corruption') },
  { abilityId: 'siphon_life', condition: expired('siphon_life') },
  /*
   * LIFE TAP ON A MANA THRESHOLD rather than ungated. It was unconditional and
   * fired five times a fight, each one a global cooldown that dealt nothing --
   * at 15% it fires only when the bar actually needs it.
   */
  { abilityId: 'life_tap', condition: manaBelowFraction(0.15) },
  /*
   * WRACK BELONGS HERE, between Life Tap and Shadow Bolt, gated on all three
   * bleeds having six seconds left. It is DELIBERATELY ABSENT: the ruleset
   * owner paused its implementation, and as modelled it could not be worth
   * casting anyway -- a flat 216 over a six-second channel, with no
   * coefficient because the sheet has no Wrack row, and its +10% to other
   * Shadow damage-over-time effects unmodelled. See `WRACK`.
   */
  { abilityId: 'shadow_bolt' },
];

/**
 * FIRELOCK — Immolate held up, Conflagrate on cooldown, Incinerate as filler.
 *
 * 5/11/35, and Shadow and Flame at 5/5 is what shapes it. That talent does
 * three things and two of them change this list rather than a number:
 * Conflagrate no longer consumes Immolate, so it goes on cooldown rather than
 * being saved; and Shadowburn refunds its soul shard, so it can be cast at all
 * in a fight with no shard income.
 *
 * IMMOLATE ABOVE INCINERATE AND THE ORDER IS LOAD-BEARING. Incinerate is worth
 * 25% more against a burning target and reads that at cast time, so a list
 * that let Immolate lapse would quietly lose a quarter of its filler.
 */
export const WARLOCK_DESTRUCTION: readonly PriorityEntry[] = [
  { abilityId: 'immolate', condition: missing('immolate') },
  { abilityId: 'conflagrate' },
  { abilityId: 'shadowburn' },
  { abilityId: 'corruption', condition: missing('corruption') },
  { abilityId: 'life_tap' },
  { abilityId: 'incinerate' },
];

export const WARLOCK_AFFLICTION_ROTATION: Rotation = new PriorityRotation(
  'Warlock (SM/DS)',
  WARLOCK_AFFLICTION,
);
export const WARLOCK_DESTRUCTION_ROTATION: Rotation = new PriorityRotation(
  'Warlock (Firelock)',
  WARLOCK_DESTRUCTION,
);

/**
 * Which list a Warlock runs, by capstone.
 *
 * Wrack is 31 into Affliction and Incinerate 31 into Destruction; 51 points
 * cannot reach both. A Warlock with neither gets the Affliction list, which is
 * written entirely out of trainer abilities.
 */
export function warlockRotation(talents: TalentAllocation): Rotation | undefined {
  if ((talents.incinerate ?? 0) > 0) return WARLOCK_DESTRUCTION_ROTATION;
  return WARLOCK_AFFLICTION_ROTATION;
}

/** Which demon this build sacrificed, if it took the talent. */
export function sacrificedDemon(
  talents: TalentAllocation,
  petFamily: string | undefined,
): string | undefined {
  if ((talents.demonic_sacrifice ?? 0) === 0) return undefined;
  return petFamily;
}
