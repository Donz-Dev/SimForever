import type { Combatant, PriorityEntry, Rotation, SimulationContext } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId } from '../character';
import {
  BATTLE_SHOUT,
  REND,
  SUNDER_ARMOR,
  SUNDER_ARMOR_MAX_STACKS,
} from '../auras/warrior';
import { EXECUTE_HEALTH_THRESHOLD } from '../abilities/warrior';

/**
 * Warrior action priority lists.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * The spreadsheet gives costs, cooldowns and damage and no effect magnitudes,
 * so for months Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness,
 * Bloodrage, Berserker Rage, Shield Wall and Shield Block all DID NOTHING and
 * were all left out. Forever's own spell data supplied the magnitudes (see
 * `src/data/abilities/README.md`), and the three that raise damage are now in
 * the list with measured priorities.
 *
 * Still out, each for its own reason:
 *
 *   - DEMORALIZING SHOUT lowers the TARGET's attack power. Against a standing
 *     dummy that is nothing, and when the target swings back it is actively
 *     NEGATIVE for damage: less damage taken is less rage from damage taken.
 *     It is a survival cooldown in a simulator that does not model survival.
 *   - BERSERKER RAGE is still inert. Forever's tooltip names no magnitude.
 *   - BLOODRAGE grants rage, and the grant is not wired: the aura has no
 *     periodic and there is no per-tick mechanism yet.
 *   - SHIELD WALL and SHIELD BLOCK are damage-taken effects that cost a global
 *     cooldown. Shield Block's "only 2 attacks" charge cap is not expressible,
 *     so its aura carries no block modifier at all.
 *   - The STANCES gate nothing, so stance dancing is pure loss. Unchanged.
 *
 * Revenge is IN the list now. It is reactive on being attacked, so its window
 * only opens in an encounter where the target swings back -- and until one
 * existed, listing it would have been dead weight. Its `canCast` refuses when
 * the window is shut, so a warrior nobody is hitting simply never reaches it.
 *
 * Overpower is the same mechanism on the other side of the swing, and fires in
 * every fight because the training dummy dodges.
 *
 * Charge is left out because its real constraints (a minimum range, being out
 * of combat) are not modelled. Against a stationary dummy it would be a free
 * 15 rage every 15 seconds, which would flatter the results.
 *
 * Slam is in the list but CONDITIONAL, and the condition is the whole point of
 * it. A cast interrupts the swing in progress and resets the swing timer, so an
 * untalented Slam trades a full swing for its own damage and is a loss. With
 * Improved Slam it holds the swing instead, and is not. The entry therefore
 * asks the ability itself whether it holds the swing, rather than asking which
 * talents were taken -- the rotation stays a statement about what is worth
 * casting, and the talent stays the thing that changed it.
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
 * Buffs and debuffs that raise damage, above the strikes that spend the rage.
 *
 * MEASURED, not assumed. `npx vite-node tools/measure_rotation.ts` is the
 * harness; every figure here is 200 fights on a geared dual-wielder against the
 * level 63 dummy, quoted with a 95% interval. Each ability's worth was found by
 * REMOVING it and re-running, not by adding it to an empty list, so the numbers
 * are what dropping it would cost rather than what adding it to nothing gains.
 *
 *   all three openers   148.20 +/- 2.38
 *   without Sunder      135.69            -12.51
 *   without Battle Shout 136.37           -11.83
 *   without Recklessness 142.87            -5.33
 *   no openers at all   119.88 +/- 1.71   -28.32
 *
 * Together they are worth +28.32 DPS, a quarter of the class's output, which is
 * the size of the hole that sat in the rotation while these were inert.
 *
 * WHETHER THEY GO ABOVE OR BELOW THE STRIKES IS NOT MEASURABLE. Above reads
 * 148.20 +/- 2.38 and below 145.44 +/- 2.13, a gap of 2.76 against a combined
 * interval of 3.19 -- and in the attacking case below is very slightly ahead.
 * They are kept above on the principle that a buff multiplying everything after
 * it should be paid for before the first strike rather than after, and the
 * honest statement is that the measurement does not object rather than that it
 * agrees. Anyone reordering these should not expect to find a difference.
 */
const OPENERS: readonly PriorityEntry[] = [
  /*
   * Battle Shout, once: 140 attack power for three minutes at 10 rage. It
   * outlasts every fight this simulator runs, so the condition is simply
   * "not up".
   *
   * FIRST IN THIS LIST IS NOT FIRST IN THE FIGHT. A warrior opens at zero rage,
   * so Battle Shout cannot be paid for until a few swings have landed -- in a
   * sampled fight it goes up at 7.5 seconds, behind the free Recklessness. The
   * list states a preference; the rage bar decides when it is honoured.
   *
   * Worth +11.83 DPS -- attack power is in every swing and every weapon damage
   * ability, so it compounds with everything.
   */
  {
    abilityId: 'battle_shout_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(BATTLE_SHOUT.id, context.clock.now()) <= 0,
  },
  /*
   * Recklessness next: free, and 100 points of crit for 15 seconds.
   *
   * On a 30 minute cooldown it fires once and never again, so it is a question
   * of WHEN rather than whether, and the answer is immediately -- a crit window
   * spent on early swings is worth the same as one spent on late swings, and
   * casting it at the start guarantees it is spent at all.
   *
   * It also raises damage TAKEN by 20%, which is a real cost only when the
   * target swings back -- and measuring both ways shows that is not a cost at
   * all here: +5.33 DPS standing and +6.56 when attacked, because the extra
   * damage taken feeds rage. In a simulator where the player cannot die, a
   * damage-taken penalty is a rage BONUS. Read that second figure with the
   * caveat that survival is not modelled.
   */
  { abilityId: 'recklessness_cast' },
  /*
   * Sunder Armor to five stacks, then leave it alone.
   *
   * 450 armor a stack to a cap of five is 2250 off the boss's 3731. At +12.51
   * DPS it is the LARGEST single gain of the three, ahead of Battle Shout, and
   * worth its five global cooldowns early because every physical hit for the
   * rest of the fight lands against less armor.
   *
   * The condition stops at the cap rather than refreshing: the debuff lasts 30
   * seconds and `refreshBehaviour: 'reset'` means any later application renews
   * the whole stack, so re-applying at the cap would spend 15 rage to replace a
   * debuff that is already at full strength. The rotation re-applies only once
   * it has actually fallen off, which against a 100 second fight happens once.
   */
  {
    abilityId: 'sunder_armor_cast',
    condition: (_context, _actor, target) =>
      target !== undefined && target.auras.stacksOf(SUNDER_ARMOR.id) < SUNDER_ARMOR_MAX_STACKS,
  },
];

/**
 * The strikes every warrior opens with, whatever it is holding.
 *
 * Below 20% health Execute consumes the whole rage bar, so it outranks
 * everything: banking rage for anything else at that point wastes it.
 *
 * Mortal Strike and Bloodthirst are both in the sheet, both cost 30 rage and
 * both have a 6 second cooldown. They are 31-point capstones in two different
 * trees, so a warrior reaches exactly one — `abilitiesForClass` enforces that
 * from the talent allocation.
 *
 * Both still appear in this list, and that is deliberate rather than an
 * oversight. `PriorityRotation` skips an entry whose ability the actor does not
 * know, so one list serves every build and the ordering states the preference
 * for the warrior who somehow has both rather than pretending it cannot happen.
 */
const CORE_STRIKES: readonly PriorityEntry[] = [
  { abilityId: 'execute' },
  /*
   * Revenge outranks everything but Execute when its window is open.
   *
   * 5 rage for a flat 81-99 is the cheapest damage a warrior has, and the
   * window closes on its own whether or not it is used -- the same argument
   * that puts Overpower where it is. `canCast` already refuses when the window
   * is shut, so no condition is needed here.
   */
  { abilityId: 'revenge' },
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
  // Only worth casting when it does not cost a swing. See the note above.
  pooled(
    'slam',
    15,
    (_context, actor) => actor.abilities.get('slam')?.swingTimer === 'hold',
  ),
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
  ...OPENERS,
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
  ...OPENERS,
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
