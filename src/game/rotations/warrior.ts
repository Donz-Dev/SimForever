import type { Combatant, PriorityEntry, Rotation, SimulationContext } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId } from '../character';
import { REND } from '../auras/warrior';
import { EXECUTE_HEALTH_THRESHOLD } from '../abilities/warrior';

/**
 * Warrior action priority lists.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * The spreadsheet gives costs, cooldowns and damage. It does not give effect
 * values for any buff or debuff, so Battle Shout, Demoralizing Shout, Sunder
 * Armor, Recklessness, Bloodrage, Berserker Rage, Shield Wall and Shield Block
 * currently DO NOTHING. Casting them would burn a global cooldown to no effect
 * and make the rotation look worse than it is, so they are left out. They come
 * in the moment their numbers do.
 *
 * Stances are left out for a different reason: which abilities each stance
 * gates is an open question with the ruleset owner, and a rotation that stance
 * dances for no modelled benefit would be pure loss.
 *
 * Revenge is in the warrior's book but appears in no list. It is reactive on
 * being attacked, and nothing attacks the player yet, so its window never
 * opens. Overpower is the same mechanism on the other side of the swing and
 * DOES fire, because the training dummy dodges.
 *
 * Charge is left out because its real constraints (a minimum range, being out
 * of combat) are not modelled. Against a stationary dummy it would be a free
 * 15 rage every 15 seconds, which would flatter the results.
 *
 * Slam is left out because its 1.5 second cast does not currently pause the
 * swing timer, and whether it should is unstated. Including it would credit the
 * warrior with a swing it may not get.
 */

/**
 * Rage held back so that Mortal Strike is affordable the moment it comes up.
 *
 * A ROTATION HEURISTIC, not ruleset data. Without it the cheap abilities starve
 * the expensive one: at the rage income a placeholder weapon produces, Rend at
 * 10 rage fires the instant it is affordable and the bar never reaches 30, so
 * the warrior's hardest-hitting ability is never cast at all.
 *
 * Only reserved while Mortal Strike is actually off cooldown. Pooling against
 * an ability that is not coming up for another five seconds just wastes rage to
 * the cap.
 */
export const MORTAL_STRIKE_RAGE_RESERVE = 30;

/** The ability the reserve above is held for. */
const RESERVED_ABILITY_ID = 'mortal_strike';

/**
 * Rage free to spend on something other than Mortal Strike.
 *
 * Shared by every entry below Mortal Strike in the list, so the pooling rule is
 * stated once rather than repeated per line.
 */
function spendableRage(context: SimulationContext, actor: Combatant): number {
  const rage = actor.resources.get('rage')?.current ?? 0;
  if (!actor.abilities.has(RESERVED_ABILITY_ID)) return rage;
  const reserved = actor.abilities.isReady(RESERVED_ABILITY_ID, context.clock.now())
    ? MORTAL_STRIKE_RAGE_RESERVE
    : 0;
  return rage - reserved;
}

/** An entry that only fires when it can be paid for out of spare rage. */
function pooled(abilityId: string, cost: number, extra?: PriorityEntry['condition']): PriorityEntry {
  return {
    abilityId,
    condition: (context, actor, target) =>
      spendableRage(context, actor) >= cost && (!extra || extra(context, actor, target)),
  };
}

/**
 * Rage above which spare rage is dumped into Heroic Strike.
 *
 * Sits high enough that the dump only happens when rage is genuinely surplus
 * rather than merely present.
 */
export const HEROIC_STRIKE_RAGE_THRESHOLD = 50;

/**
 * Refresh Rend when it has less than this left, rather than at zero.
 *
 * Refreshing at exactly zero loses ticks to the global cooldown; refreshing far
 * too early throws away duration. A window slightly longer than one GCD is the
 * usual compromise.
 */
export const REND_REFRESH_WINDOW_MS = 2000;

/**
 * The strikes every warrior opens with, whatever it is holding.
 *
 * Below 20% health Execute consumes the whole rage bar, so it outranks
 * everything: banking rage for anything else at that point wastes it.
 *
 * Mortal Strike and Bloodthirst are both in the sheet, both cost 30 rage and
 * both have a 6 second cooldown. In Classic a warrior has one or the other by
 * talent, never both; Forever's sheet lists them together and says nothing
 * about exclusivity, so both are here.
 */
const CORE_STRIKES: readonly PriorityEntry[] = [
  { abilityId: 'execute' },
  // Overpower whenever the window is open, and not pooled against anything.
  //
  // It costs 5 rage for weapon damage plus 35, which is far and away the best
  // rage a warrior can spend, and the window closes on its own whether or not
  // it is used. Its `canCast` already refuses when the target has not dodged,
  // so no condition is needed here.
  { abilityId: 'overpower' },
  // Rend outranks Mortal Strike, and is NOT pooled against it.
  //
  // It is the most rage-efficient thing a warrior can do: 147 damage for 10
  // rage, and as a bleed it IGNORES ARMOR, so against a 3731-armor boss every
  // point lands where a Mortal Strike loses 39% of its. It is also self
  // limiting — one bleed, refreshed every 21 seconds — so giving it top
  // priority cannot starve anything the way an uncapped spender would.
  //
  // Measured, not assumed: over 400 iterations Rend-first averages 34.9 DPS
  // against 33.2 for Mortal-Strike-first, with a standard error of 0.18. Worth
  // re-measuring once real weapon data changes the rage income, because the
  // ordering follows from rage being scarce rather than from anything intrinsic
  // to the two abilities.
  {
    abilityId: 'rend_cast',
    condition: (context, _actor, target) =>
      target !== undefined &&
      target.auras.remainingMs(REND.id, context.clock.now()) < REND_REFRESH_WINDOW_MS,
  },
  { abilityId: RESERVED_ABILITY_ID },
  { abilityId: 'bloodthirst' },
  pooled('whirlwind', 25),
  pooled('spearing_strike', 15),
];

/** Dump genuinely surplus rage into the next swing. */
const FILLERS: readonly PriorityEntry[] = [
  pooled(
    'heroic_strike',
    15,
    (_context, actor) =>
      (actor.resources.get('rage')?.current ?? 0) >= HEROIC_STRIKE_RAGE_THRESHOLD,
  ),
];

/**
 * Two-handed and dual-wield share a list: the sheet draws no distinction
 * between them, and every ability in it works with either.
 *
 * They still produce different results, because the off-hand penalty and the
 * dual-wield miss chance both apply to weapon damage abilities, not just to
 * auto attacks.
 */
export const WARRIOR_MELEE_ROTATION: Rotation = new PriorityRotation('Warrior', [
  ...CORE_STRIKES,
  ...FILLERS,
]);

/**
 * With a shield, Shield Slam joins the list.
 *
 * Its "+ shield block value" component is missing from the engine entirely, so
 * it currently deals only its stated 421-439 and is undervalued here.
 */
export const WARRIOR_SHIELD_ROTATION: Rotation = new PriorityRotation('Warrior (Shield)', [
  { abilityId: 'execute' },
  { abilityId: 'shield_slam' },
  ...CORE_STRIKES.filter((entry) => entry.abilityId !== 'execute'),
  ...FILLERS,
]);

/** The list a warrior of this combat style uses. */
export function warriorRotation(style: CombatStyleId): Rotation {
  return style === 'one_hand_shield' ? WARRIOR_SHIELD_ROTATION : WARRIOR_MELEE_ROTATION;
}

/** Re-exported so the threshold is documented in one place. */
export { EXECUTE_HEALTH_THRESHOLD };
