import type { Combatant, PriorityEntry, Rotation, SimulationContext } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId, StanceId } from '../character';
import { isTankBuild } from '../character';
import {
  BATTLE_SHOUT,
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  DEMORALIZING_SHOUT,
  LAST_STAND,
  REND,
  SUNDER_ARMOR,
  SUNDER_ARMOR_MAX_STACKS,
} from '../auras/warrior';
import { EXECUTE_PHASE_FRACTION } from '../abilities/warrior';
import { seconds } from '../../engine';

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
 * Most of that paragraph's successors are now IN the tank list, and the
 * reasons they were out are worth keeping because every one of them expired:
 *
 *   - BLOODRAGE's grant is wired -- ten on cast and ten over ten seconds --
 *     and it opens the tank list.
 *   - SHIELD BLOCK's "only 2 attacks" is expressible as `consumedByBlock`, and
 *     it does not cost a global cooldown after all: it is one of the three
 *     Warrior abilities the ruleset owner names as exceptions.
 *   - SHIELD WALL was "a damage-taken effect in a simulator that does not
 *     model survival". Survival is modelled now, as a count of deaths, so it
 *     is a real decision and it is second in the tank list.
 *   - The STANCES gate plenty, and the two stance-specific lists exist
 *     precisely so that neither ever dances.
 *
 * Still out:
 *
 *   - BERSERKER RAGE is still inert. Forever's tooltip names no magnitude.
 *   - DEMORALIZING SHOUT is IN the tank list at the ruleset owner's request
 *     and still does nothing, for a different reason than before: it removes
 *     210 attack power and the boss melee has `powerCoefficient: 0`, so there
 *     is no attack power term for it to reduce. It becomes real the day a
 *     target's damage is derived rather than stated.
 *
 * STANCE DANCING IS NAIVE, AND IT COSTS REAL DAMAGE.
 *
 * Abilities are stance-gated now (see docs/warrior-ability-audit.md) and
 * `PriorityRotation` swaps stance for the highest-priority ability that is
 * blocked only by its stance. That is enough to make Revenge, Whirlwind and
 * Recklessness reachable at all, and it is not a good rotation.
 *
 * DEFENSIVE STANCE IS -10% DAMAGE DONE. The list swaps into it for Revenge and
 * then does everything else from there until something pulls it back, so a
 * shield warrior spends much of the fight taking a tenth off every hit to keep
 * a 153-damage ability available. Measured: 1H & Shield with the target
 * swinging back reads 151.88 with gating against 219.07 without it. Most of
 * that gap is the stance penalty being modelled for the first time, not a
 * regression -- but some of it is the rotation being stupid.
 *
 * WHAT IS NOT MODELLED, and it matters in the other direction: swapping costs
 * NO RAGE here. In Classic a swap drops rage unless Tactical Mastery preserves
 * it, and Forever states nothing either way. So dancing is cheaper here than it
 * should be, while the stance penalty it incurs is fully counted.
 *
 * The honest reading is that both stance-dancing numbers are provisional. A
 * rotation that weighed the stance cost against what the swap buys would beat
 * this one, and nobody has written it.
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
/**
 * Charge, at the pull, and NEVER by changing stance to reach it.
 *
 * ----------------------------------------------------------------------------
 * TWO RULES IN ONE CONDITION, and the second is the one that bites.
 *
 * WHEN. The ability's own `canCast` allows it only at timestamp zero -- it
 * cannot be used in combat, and a fight that opens in combat leaves exactly
 * one legal moment. That rule lives on `CHARGE` so every list gets it.
 *
 * AND ONLY FROM A STANCE THAT ALREADY ALLOWS IT. `PriorityRotation` treats a
 * wrong stance as "not yet, and here is how" and will cast a stance change to
 * unblock an entry. That is right for Revenge and wrong here: dropping Charge
 * into the Protection list sent the tank into Battle Stance at the pull,
 * which is a different character. A `condition` is checked BEFORE the swap is
 * considered, so refusing here refuses the swap too.
 *
 * IT IS ALSO EXACTLY THE VANGUARD GATE the ruleset owner asked for, with no
 * talent named anywhere. Charge allows Battle Stance; Vanguard adds Defensive
 * to the character's own copy. A Protection warrior without it is in a stance
 * Charge does not list, so this returns false; with it, the same entry starts
 * working. Reading the ability's stance list rather than the talent means the
 * rule cannot drift from the talent that grants it.
 * ----------------------------------------------------------------------------
 */
const chargeAtThePull: PriorityEntry = {
  abilityId: 'charge',
  condition: (_context, actor) => {
    const charge = actor.abilities.get('charge');
    if (!charge?.stances) return true;
    return charge.stances.some((stanceId) => actor.auras.has(stanceId));
  },
};

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
   * Death Wish, if the talent granted it: 10 rage for +20% damage done and +5%
   * damage taken, 30 seconds, on a 3 minute cooldown.
   *
   * `PriorityRotation` skips an ability the actor does not know, so this line
   * costs an untalented warrior nothing and the list stays one list.
   *
   * Beside Recklessness for the same reason: a cooldown longer than the fight
   * is a question of WHEN, and the answer is immediately.
   *
   * MEASURED at +11.77 +/- 3.29 DPS over 250 fights, against the same Fury
   * build with the point moved off Death Wish. Isolating the ability rather
   * than the tree is the only comparison that means anything: a build that
   * reaches tier 20 of Fury differs from a talentless one in a dozen ways.
   */
  { abilityId: 'death_wish' },
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
/*
 * Exported as DATA as well as wrapped, like the two stance-specific lists, so
 * that `tests/game/rotationIds.test.ts` can check every id in it resolves to
 * a real ability. `PriorityRotation` skips an id it cannot resolve in silence,
 * and one list carried a misspelled one for its whole life.
 */
export const WARRIOR_BATTLE: readonly PriorityEntry[] = [
  ...OPENERS,
  ...CORE_STRIKES,
  ...FILLERS,
];

export const WARRIOR_MELEE_ROTATION: Rotation = new PriorityRotation(
  'Warrior',
  WARRIOR_BATTLE,
);

/**
 * With a shield, Shield Slam joins the list.
 *
 * Its "+ shield block value" component is missing from the engine entirely, so
 * it currently deals only its stated 421-439 and is undervalued here.
 */
export const WARRIOR_SHIELD: readonly PriorityEntry[] = [
  { abilityId: 'execute' },
  /*
   * SHIELD SLAM OUTRANKS THE OPENERS, which is the opposite of how the melee
   * list is built, and it is measured rather than reasoned.
   *
   * A shield warrior is RAGE STARVED in a way a dual-wielder is not: one
   * moderate weapon, no off-hand, and standing still it takes no damage to
   * convert. Sunder Armor's five stacks cost 75 rage, and spending that first
   * left Shield Slam cast TWICE in a hundred seconds against thirteen times
   * when the target swings back. At 655 plus block value it is far too large a
   * hit to starve.
   *
   * Measured over 250 fights a row, against the openers-first order:
   *
   *   standing        101.69 +/- 2.42  against  97.33 +/- 2.03   +4.36
   *   target attacks  218.57 +/- 2.53  against 206.43 +/- 2.12  +12.14
   *
   * Both survive their intervals. Dropping Sunder entirely was also tried and
   * is better standing (102.63) but worse when attacked (207.77), so this
   * ordering wins on the case that matters and keeps the armour debuff.
   *
   * THE LESSON, which cost a wrong ordering to learn: the opener priorities
   * were measured on a dual-wielder and applied to both lists. A rotation
   * measured on one build is not measured for another.
   */
  { abilityId: 'shield_slam' },
  ...OPENERS,
  ...CORE_STRIKES.filter((entry) => entry.abilityId !== 'execute'),
  ...FILLERS,
];

export const WARRIOR_SHIELD_ROTATION: Rotation = new PriorityRotation(
  'Warrior (Shield)',
  WARRIOR_SHIELD,
);

/**
 * Seconds of fight left when Death Wish goes out.
 *
 * Death Wish lasts 30 seconds, so casting it with 35 left covers the end of
 * the fight with a little slack for the global cooldown it waits behind.
 */
export const DEATH_WISH_WINDOW_MS = seconds(35);

/** Refresh Sunder Armor with less than this left, rather than at zero. */
export const SUNDER_REFRESH_WINDOW_MS = seconds(4);

/** Rage above which the surplus goes into Heroic Strike. */
export const BERSERKER_HEROIC_STRIKE_RAGE = 42;

/**
 * Rage at which the tank list spends on Heroic Strike.
 *
 * The ruleset owner's figure, and lower than the Berserker list's 42: a tank
 * generates less rage and has more that must be paid for.
 */
export const DEFENSIVE_HEROIC_STRIKE_RAGE = 26;

/**
 * Rage below which the tank list casts Bloodrage.
 *
 * The ruleset owner's figure. Bloodrage gives ten at once and ten over ten
 * seconds, so casting it near the cap throws most of the second half away.
 */
export const DEFENSIVE_BLOODRAGE_RAGE = 50;

/**
 * Health below which the tank list reaches for a survival cooldown.
 *
 * The ruleset owner's figure, and the first entry in any list that has ever
 * read the character's health -- which was impossible until the encounter
 * started killing people. Last Stand goes first and Shield Wall behind it,
 * because Last Stand has a three minute cooldown and Shield Wall has thirty.
 */
export const DEFENSIVE_EMERGENCY_HEALTH = 0.3;

/** Milliseconds of fight remaining. */
function remainingMs(context: SimulationContext): number {
  return context.plannedDurationMs - context.clock.now();
}

/**
 * Dual-wield, Berserker Stance. Specified by the ruleset owner, in this order.
 *
 * NOTHING IN THIS LIST LEAVES BERSERKER STANCE, and that is the whole point of
 * it. Battle Shout, Sunder Armor, Death Wish, Heroic Strike, Bloodthirst and
 * Bloodrage are usable in any stance; Whirlwind and Execute are Berserker
 * abilities. So a warrior running this never pays the stance-change cost --
 * the other lists spend hundreds of rage a fight swapping for Overpower and
 * Rend, and this one simply does not reach for them.
 *
 * It is also DELIBERATELY NOT the melee list with a filter. The order is
 * different, the Heroic Strike threshold is different, there is no Mortal
 * Strike rage reserve, and Rend and Overpower are absent rather than
 * unreachable. Deriving it from the other list would make every one of those a
 * coincidence rather than a decision.
 */
export const WARRIOR_DUAL_WIELD_BERSERKER: readonly PriorityEntry[] = [
  // Once, and it lasts three minutes.
  {
    abilityId: 'battle_shout_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(BATTLE_SHOUT.id, context.clock.now()) <= 0,
  },
  /*
   * Build to five stacks, then hold it there.
   *
   * Two conditions, and both are needed: below five stacks it is still being
   * built, and with under four seconds left it is about to fall off and take
   * all five with it. `refreshBehaviour: 'reset'` means one cast renews the
   * whole stack, so the refresh is cheap and losing it is not.
   */
  {
    abilityId: 'sunder_armor_cast',
    condition: (context, _actor, target) => {
      if (!target) return false;
      const stacks = target.auras.stacksOf(SUNDER_ARMOR.id);
      if (stacks < SUNDER_ARMOR_MAX_STACKS) return true;
      return target.auras.remainingMs(SUNDER_ARMOR.id, context.clock.now()) <
        SUNDER_REFRESH_WINDOW_MS;
    },
  },
  // Timed to cover the end of the fight rather than used on cooldown.
  {
    abilityId: 'death_wish',
    condition: (context) => remainingMs(context) <= DEATH_WISH_WINDOW_MS,
  },
  /*
   * The execute phase, measured in TIME rather than target health.
   *
   * A training dummy never drops to 20% health, so Execute's own gate accepts
   * the last 20% of a fixed-length fight as well. See `EXECUTE`.
   */
  {
    abilityId: 'execute',
    condition: (context) =>
      remainingMs(context) <= context.plannedDurationMs * EXECUTE_PHASE_FRACTION,
  },
  // Surplus rage into the next swing.
  {
    abilityId: 'heroic_strike',
    condition: (_context, actor) =>
      (actor.resources.get('rage')?.current ?? 0) >= BERSERKER_HEROIC_STRIKE_RAGE,
  },
  { abilityId: 'bloodthirst' },
  { abilityId: 'whirlwind' },
  /*
   * Below both, on the ruleset owner's instruction. It was in the DW Fury
   * preset's talents and in no list that build could reach, so one point was
   * doing nothing -- turned up by auditing each preset's choices against what
   * the fight actually exercises.
   *
   * Not `pooled`: the two strikes above it already take priority, so rationing
   * it behind a rage floor as well would keep it in the same place it was.
   */
  { abilityId: 'spearing_strike' },
  // Last, so it fills a gap rather than taking a global cooldown from a strike.
  { abilityId: 'bloodrage_cast' },
];

export const WARRIOR_DUAL_WIELD_BERSERKER_ROTATION: Rotation = new PriorityRotation(
  'Warrior (Dual-Wield, Berserker)',
  WARRIOR_DUAL_WIELD_BERSERKER,
);

/**
 * 1H & Shield, Defensive Stance. Specified by the ruleset owner, in this order.
 *
 * ----------------------------------------------------------------------------
 * A TANK'S LIST, and like the Berserker one it is a list rather than the
 * general shield list with a filter. The order is the owner's, the Heroic
 * Strike threshold is its own, and what is absent is absent on purpose.
 *
 * It OPENS BY GETTING INTO DEFENSIVE STANCE and stays there. Every other
 * entry is castable in Defensive, so the only stance change it ever makes is
 * the one that puts it right -- which matters more here than anywhere, since
 * Defensive Stance is where the damage reduction and Revenge live, and the
 * general shield list spends hundreds of rage a fight dancing out of it.
 *
 * Revenge needs no condition of its own: it is gated on the window a dodge,
 * parry or block opens, and `checkCast` refuses it until then. Writing the
 * condition here as well would put the same rule in two places and let them
 * drift. The same goes for Shield Slam and its talent -- a character without
 * it does not have the ability at all.
 * ----------------------------------------------------------------------------
 */
/*
 * Exported as DATA as well as wrapped in a rotation, so a test can assert on
 * the order and the conditions without the rotation having to expose its
 * entries. What order a list is in is the thing being specified.
 */
export const WARRIOR_SHIELD_DEFENSIVE: readonly PriorityEntry[] = [
  // At the pull, and only with Vanguard. See `chargeAtThePull`, which reads
  // the stance list rather than naming the talent.
  chargeAtThePull,
  /*
   * SURVIVAL FIRST. Two entries that nothing in this project could have
   * written a week ago, because the character could not drop below one health
   * and no rotation had any reason to look at the number.
   *
   * Last Stand raises maximum health 30% and grants that much, on a three
   * minute cooldown. It goes above Shield Wall because it is the one that
   * comes back: Shield Wall's thirty minute cooldown means a sixty second
   * fight gets exactly one, so spending it while the cheaper cooldown is
   * available wastes the only one there is.
   */
  {
    abilityId: 'last_stand',
    condition: (_context, actor) => actor.health.fraction < DEFENSIVE_EMERGENCY_HEALTH,
  },
  /*
   * Shield Wall, only once Last Stand cannot help.
   *
   * Both halves of that matter and they are different questions. "Last Stand
   * is not active" stops the two being stacked on one swing, and "Last Stand
   * is on cooldown" stops Shield Wall being spent while the cheap cooldown is
   * sitting there ready.
   *
   * `isReady` answers false for an ability the character does not KNOW, which
   * is the behaviour wanted here: an untalented warrior has no Last Stand to
   * wait for, so Shield Wall should not wait for it.
   */
  {
    abilityId: 'shield_wall_cast',
    condition: (context, actor) => {
      if (actor.health.fraction >= DEFENSIVE_EMERGENCY_HEALTH) return false;
      const now = context.clock.now();
      if (actor.auras.remainingMs(LAST_STAND.id, now) > 0) return false;
      return !actor.abilities.isReady('last_stand', now);
    },
  },
  /*
   * FIRST OF THE ROTATION PROPER, and only while there is room for the rage.
   *
   * Above the stance because it costs nothing to be there: Bloodrage is off
   * the global cooldown, so taking this entry does not delay whatever comes
   * next. A tank opens at zero rage and can do nothing until it has some,
   * which is the one moment in the fight when twenty rage matters most.
   *
   * The fifty is the ruleset owner's. Bloodrage grants ten immediately and
   * ten more over ten seconds, so casting it near the cap throws most of the
   * second half away -- rage lost to the cap is the one waste this list can
   * actually avoid.
   */
  {
    abilityId: 'bloodrage_cast',
    condition: (_context, actor) =>
      (actor.resources.get('rage')?.current ?? 0) < DEFENSIVE_BLOODRAGE_RAGE,
  },
  /*
   * Then the stance, and only when it is not already up.
   *
   * A stance is an aura that lasts until another replaces it, so this fires
   * once at the pull and then never again -- unless something else moved the
   * character, which is exactly when it should fire.
   */
  {
    abilityId: 'defensive_stance_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(DEFENSIVE_STANCE.id, context.clock.now()) <= 0,
  },
  {
    abilityId: 'battle_shout_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(BATTLE_SHOUT.id, context.clock.now()) <= 0,
  },
  /*
   * To five stacks, and then held there.
   *
   * The owner's wording is "if not 5 stacks", and the refresh window is kept
   * as well: `refreshBehaviour: 'reset'` means one cast renews the whole
   * stack, so letting it expire throws away five casts rather than one.
   */
  {
    abilityId: 'sunder_armor_cast',
    condition: (context, _actor, target) => {
      if (!target) return false;
      const stacks = target.auras.stacksOf(SUNDER_ARMOR.id);
      if (stacks < SUNDER_ARMOR_MAX_STACKS) return true;
      return (
        target.auras.remainingMs(SUNDER_ARMOR.id, context.clock.now()) <
        SUNDER_REFRESH_WINDOW_MS
      );
    },
  },
  /*
   * Demoralizing Shout, kept up on the target.
   *
   * IT DOES NOTHING TO THIS TARGET, and that is worth saying plainly rather
   * than leaving someone to find it in a result. It removes 210 attack power,
   * and the boss melee in `encounters/raidBoss.ts` carries
   * `powerCoefficient: 0` -- the swing damage IS the whole swing, with no
   * attack power term for this to reduce. So the entry costs 10 rage and a
   * global cooldown and changes no incoming damage at all.
   *
   * It is in the list because the ruleset owner put it there. It becomes real
   * the moment a target's damage is derived from its attack power instead of
   * being stated outright, and nothing else about the entry would change.
   */
  {
    abilityId: 'demoralizing_shout_cast',
    condition: (context, _actor, target) =>
      !!target && target.auras.remainingMs(DEMORALIZING_SHOUT.id, context.clock.now()) <= 0,
  },
  /*
   * Surplus rage into the next swing, at 26 rather than the Berserker list's
   * 42. A tank has less rage to spare and more to spend it on.
   */
  {
    abilityId: 'heroic_strike',
    condition: (_context, actor) =>
      (actor.resources.get('rage')?.current ?? 0) >= DEFENSIVE_HEROIC_STRIKE_RAGE,
  },
  /*
   * Above Shield Slam, and it costs nothing to put there: Shield Block does
   * not trigger the global cooldown, so taking this entry does not delay the
   * strike below it. Casting it is a rage cost and a five second cooldown,
   * nothing more.
   *
   * No condition. It lasts two blocks or seven seconds, so "cast it whenever
   * it is off cooldown" is the whole rule -- and the cooldown check in
   * `checkCast` already enforces the only limit there is.
   */
  { abilityId: 'shield_block_cast' },
  // Talent-gated: a character without Shield Slam does not know the ability,
  // so the entry is simply skipped rather than needing a condition.
  { abilityId: 'shield_slam' },
  // Gated on the window an avoided attack opens. `checkCast` refuses it until
  // then, so repeating that rule here would be a second copy of it.
  { abilityId: 'revenge' },
  { abilityId: 'thunder_clap' },
  /*
   * Last: a bleed is worth least when everything else is available.
   *
   * The id is `rend_cast`, not `rend`. It said `rend` from the day this list
   * was written, and `PriorityRotation` skips an id it cannot resolve without
   * a word -- so the entry was dead at any position and any rage level, and
   * the zero casts it produced read as "starved" rather than "misspelled".
   * `tests/game/rotationIds.test.ts` now refuses the whole class of it.
   */
  {
    abilityId: 'rend_cast',
    condition: (context, _actor, target) =>
      !!target && target.auras.remainingMs(REND.id, context.clock.now()) <= 0,
  },
];

export const WARRIOR_SHIELD_DEFENSIVE_ROTATION: Rotation = new PriorityRotation(
  'Warrior (Shield, Defensive)',
  WARRIOR_SHIELD_DEFENSIVE,
);

/** Rage above which the Arms list spends the surplus on Heroic Strike. */
export const BATTLE_HEROIC_STRIKE_RAGE = 75;

/**
 * Refresh Sunder Armor with less than this left, in the ARMS list.
 *
 * THREE SECONDS, and the Protection list uses four. Both are the ruleset
 * owner's, given for their own list, and nothing says they should agree -- so
 * they are two constants rather than one shared value quietly applied to a
 * list nobody checked it against. Worth unifying if the owner intends one
 * rule; see `SUNDER_REFRESH_WINDOW_MS`.
 */
export const BATTLE_SUNDER_REFRESH_WINDOW_MS = seconds(3);

/**
 * How much of a swing must be left for the Arms list to cast Slam.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S RULE, and their reason in their own words: "this
 * attempts to squeeze a Slam cast in without it affecting your auto-attack
 * flow."
 *
 * Slam is the one ability in this list with a cast time, and Improved Slam
 * takes it to half a second and makes it HOLD the swing rather than reset it.
 * So a Slam started with more than a second of swing timer left finishes well
 * before the swing is due and costs that swing nothing.
 *
 * Read off the pending swing's own scheduled timestamp, which is the only
 * thing that actually knows -- haste, an extra attack and a cast that reset
 * the timer all move it, and a rotation computing it from the weapon's speed
 * would be guessing at all three.
 * ----------------------------------------------------------------------------
 */
export const SLAM_SWING_WINDOW_MS = seconds(1);

/** Milliseconds until this actor's main hand swings again, or 0 if it is idle. */
function mainHandSwingIn(context: SimulationContext, actor: Combatant): number {
  const pending = actor.pendingSwing('mainHand');
  if (!pending || pending.cancelled) return 0;
  return Math.max(0, pending.timestamp - context.clock.now());
}

/**
 * Two-hander, Battle Stance. Specified by the ruleset owner, in this order.
 *
 * ----------------------------------------------------------------------------
 * THE ARMS LIST, and the third to be given as an explicit order rather than
 * assembled from shared fragments. Like the other two it is a LIST rather than
 * the general melee list with a filter, and like them it never leaves its
 * stance: every entry is castable in Battle, so the only stance change it
 * makes is the one that puts it right at the pull.
 *
 * WHAT IS DIFFERENT FROM THE OTHER TWO.
 *
 *   - HEROIC STRIKE AT 75 RAGE, against Berserker's 42 and the tank's 26. An
 *     Arms warrior has Mortal Strike, Slam, Rend and Execute to spend on, so
 *     the surplus that goes into a swing is a much bigger surplus.
 *   - SLAM IS LAST and gated on the swing timer, which is the only entry in
 *     any list that reads it. See `SLAM_SWING_WINDOW_MS`.
 *   - OVERPOWER IS THIRD, above everything that costs a global cooldown worth
 *     having. It needs no condition here: it is gated on the window a target's
 *     dodge opens, and `checkCast` refuses it until then.
 *
 * Execute needs no talent gate and Mortal Strike does: a warrior without the
 * capstone simply does not know it, so the entry is skipped rather than
 * needing a condition.
 * ----------------------------------------------------------------------------
 */
export const WARRIOR_TWO_HAND_BATTLE: readonly PriorityEntry[] = [
  /*
   * FIRST, because it is the one entry whose window is a single instant: put
   * it below anything and that anything takes the instant. It is off the
   * global cooldown, so it costs the entries below it nothing.
   */
  chargeAtThePull,
  /*
   * The stance first, and only when it is not already up. A stance lasts until
   * another replaces it, so this fires once at the pull and then never again.
   */
  {
    abilityId: 'battle_stance_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(BATTLE_STANCE.id, context.clock.now()) <= 0,
  },
  {
    abilityId: 'battle_shout_cast',
    condition: (context, actor) =>
      actor.auras.remainingMs(BATTLE_SHOUT.id, context.clock.now()) <= 0,
  },
  // Gated on the window a target's dodge opens; `checkCast` refuses it until
  // then, so repeating that rule here would be a second copy of it.
  { abilityId: 'overpower' },
  {
    abilityId: 'sunder_armor_cast',
    condition: (context, _actor, target) => {
      if (!target) return false;
      const stacks = target.auras.stacksOf(SUNDER_ARMOR.id);
      if (stacks < SUNDER_ARMOR_MAX_STACKS) return true;
      return (
        target.auras.remainingMs(SUNDER_ARMOR.id, context.clock.now()) <
        BATTLE_SUNDER_REFRESH_WINDOW_MS
      );
    },
  },
  // Surplus rage into the next swing, at 75 -- see the constant.
  {
    abilityId: 'heroic_strike',
    condition: (_context, actor) =>
      (actor.resources.get('rage')?.current ?? 0) >= BATTLE_HEROIC_STRIKE_RAGE,
  },
  {
    abilityId: 'rend_cast',
    condition: (context, _actor, target) =>
      !!target && target.auras.remainingMs(REND.id, context.clock.now()) <= 0,
  },
  // Talent-gated: a warrior without the capstone does not know it.
  { abilityId: 'mortal_strike' },
  /*
   * The execute phase, measured in TIME rather than target health, because a
   * training dummy never drops to 20%. The same rule the Berserker list uses.
   */
  {
    abilityId: 'execute',
    condition: (context) =>
      remainingMs(context) <= context.plannedDurationMs * EXECUTE_PHASE_FRACTION,
  },
  { abilityId: 'spearing_strike' },
  /*
   * LAST, and only with room to cast it. The one entry in any list that reads
   * the swing timer; see `SLAM_SWING_WINDOW_MS` for why a cast time makes this
   * different from everything above it.
   */
  {
    abilityId: 'slam',
    condition: (context, actor) => mainHandSwingIn(context, actor) > SLAM_SWING_WINDOW_MS,
  },
];

export const WARRIOR_TWO_HAND_BATTLE_ROTATION: Rotation = new PriorityRotation(
  'Warrior (Two-Hander, Battle)',
  WARRIOR_TWO_HAND_BATTLE,
);

/**
 * The list a warrior of this combat style and stance uses.
 *
 * Stance selects a list as well as gating abilities, because a rotation that
 * never leaves its stance is a different rotation and not a filtered one.
 * Dual-wield in Berserker has its own; everything else falls back to the two
 * general lists.
 */
export function warriorRotation(style: CombatStyleId, stance?: StanceId): Rotation {
  if (style === 'dual_wield' && stance === 'berserker') {
    return WARRIOR_DUAL_WIELD_BERSERKER_ROTATION;
  }
  // The tank list, by the same rule that picks the Berserker one: style AND
  // stance together, because a shield warrior in Berserker is a different
  // character from one in Defensive.
  if (isTankBuild(style, stance)) return WARRIOR_SHIELD_DEFENSIVE_ROTATION;
  /*
   * The Arms list, by the same rule again. A DUAL-WIELDER IN BATTLE STANCE
   * does not get it: this is a two-hander's list -- Slam's cast and Heroic
   * Strike at 75 rage both assume one big slow swing -- and a dual-wielder in
   * Battle keeps the general melee list it has always had.
   */
  if (style === 'two_hander' && stance === 'battle') return WARRIOR_TWO_HAND_BATTLE_ROTATION;
  return style === 'one_hand_shield' ? WARRIOR_SHIELD_ROTATION : WARRIOR_MELEE_ROTATION;
}

/** Re-exported so the threshold is documented in one place. */
export { EXECUTE_PHASE_FRACTION };
