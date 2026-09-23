import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Warlock priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE. Not the ruleset owner's own lists.
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

const hasAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  actor.auras.has(auraId);

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
  { abilityId: 'shadow_bolt', condition: hasAura('shadow_trance') },
  { abilityId: 'corruption', condition: missing('corruption') },
  { abilityId: 'siphon_life', condition: missing('siphon_life') },
  { abilityId: 'bane_of_agony', condition: missing('bane_of_agony') },
  { abilityId: 'life_tap' },
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
