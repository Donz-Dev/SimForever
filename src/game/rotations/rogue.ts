import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import { comboPointsOn } from '../combat/comboPoints';
import { MAX_COMBO_POINTS } from '../combat/comboPoints';
import { RUPTURE_BY_COMBO_POINT, VENOM_AURA_ID } from '../auras/rogue';

/**
 * Rogue priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS. Every list in this file was specified by them,
 * entry by entry, and measured after -- so a number taken off one describes the
 * ruleset rather than this file's guess.
 *
 * IT SAID THE OPPOSITE FOR MOST OF THIS PROJECT'S LIFE, and the header that
 * said so was doing real work: "these are the standard shape of each build and
 * are NOT the ruleset owner's own lists, which have not been given." That is
 * how a shell is supposed to read, and it is why the figures measured off one
 * were never mistaken for the ruleset's. *
 * THE SHELL'S OWN RULE DID NOT SURVIVE CONTACT WITH THE OWNER'S LISTS, and it
 * is worth keeping the disagreement rather than the rule. This file used to
 * say every Rogue list "spends the rest at five combo points, never at four",
 * because a finisher at one point buys a fifth of the damage for the same 35
 * energy and global cooldown.
 *
 * The Combat list does not hold for five. Its Eviscerate is gated only on
 * Slice and Dice having nine seconds left, and it went from 1.1 casts a fight
 * to 9.0 -- for +0.6 DPS, inside the interval. "Hold for five" is a claim
 * about damage per POINT and the owner's order is a claim about the whole
 * cycle, and the measurement says they are the same cycle.
 * ----------------------------------------------------------------------------
 */

/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS, spelled out as helpers because two lists use
 * the same shapes and a duplicated threshold is a duplicated decision.
 * ============================================================================
 */

/** "combo points >= N", read through the TARGET so a stale pool reads zero. */
const atLeastPoints = (minimum: number) =>
  (_context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    comboPointsOn(actor, target) >= minimum;

/** "exactly N", which for the cap is the same question `AT_FIVE` asks. */
const exactlyPoints = (count: number) =>
  (_context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    comboPointsOn(actor, target) === count;

/** "<buff> is not active", on the Rogue. */
const selfAuraDown = (auraId: string) =>
  (context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.remainingMs(auraId, context.clock.now()) <= 0;

/**
 * "<buff> duration >= N seconds", on the Rogue.
 *
 * THE OWNER'S GATE ON EVISCERATE IS A FLOOR, NOT A WINDOW, and that is the
 * whole point of it: spend on damage only while the maintenance buffs have
 * plenty of time left, so a finisher never lands with Slice and Dice about to
 * drop. It is the opposite polarity to a refresh condition and reads almost
 * the same, so it is named rather than written inline twice.
 */
const selfAuraAtLeast = (auraId: string, seconds: number) =>
  (context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.remainingMs(auraId, context.clock.now()) >= seconds * 1000;

/** Every condition in a list must hold. */
const all =
  (...conditions: readonly ((
    context: SimulationContext,
    actor: Combatant,
    target?: Combatant,
  ) => boolean)[]) =>
  (context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    conditions.every((condition) => condition(context, actor, target));

/** "<buff> is active", on the Rogue. */
const selfActive = (auraId: string) =>
  (_context: SimulationContext, actor: Combatant): boolean => actor.auras.has(auraId);

/** "<debuff> is not active", on the target. */
const targetAuraDown = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.remainingMs(auraId, context.clock.now()) <= 0;

/** "<debuff> duration >= N seconds", on the target. */
const targetAuraAtLeast = (auraId: string, secondsLeft: number) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) >= secondsLeft * 1000;

/** "<debuff> duration <= N seconds", on the target. An absent debuff counts. */
const targetAuraAtMost = (auraId: string, secondsLeft: number) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) <= secondsLeft * 1000;

/** "energy >= N". */
const atLeastEnergy = (minimum: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    (actor.resources.get('energy')?.current ?? 0) >= minimum;

// ---------------------------------------------------------------------------

/*
 * ============================================================================
 * VENOM IS IMPLEMENTED AND IS NOT IN ANY LIST, because it MEASURES AS A LOSS.
 *
 * The finisher works: the talent grants it, its aura runs nine to twenty-one
 * seconds by combo points, and it adds its +30% to poison damage and +10% to
 * apply chance exactly as the owner ruled. It is simply not worth the combo
 * points, and three placements were measured before that was believed --
 * 30 batches of 10 each, which is this project's own method:
 *
 *   not cast at all                415.2  +/- 4.1
 *   above the damage finishers     395.7  +/- 4.6   -19.5
 *   below Eviscerate               398.0  +/- 4.7   -17.2
 *   only at five combo points      400.1  +/- 3.8   -15.1
 *
 * Every one is outside the interval and every one is worse. A point spent on
 * Venom is a point not spent on Eviscerate or Rupture, and the poison damage
 * it multiplies is about a fifth of the build's total -- so a 30% bonus on a
 * fifth is worth less than a whole finisher.
 *
 * THE COMMENT THAT WAS HERE FIRST CLAIMED THE OPPOSITE, and claimed it "by
 * measurement", before anything had been measured. That is the exact mistake
 * the Summon Hawk note made -- specific, plausible, and believed for as long
 * as it existed.
 *
 * IT IS STILL WORTH HAVING BUILT: the mechanism is tested, so the day a poison
 * coefficient or a talent moves, adding one line to this list re-measures it.
 * ============================================================================
 */

// ---------------------------------------------------------------------------

/**
 * VENOM — Assassination, daggers, Mutilate into Eviscerate.
 *
 * Mutilate awards two combo points, so this build reaches five in three casts
 * rather than five and spends far more of its time on finishers. It is also
 * the build the poisons matter most to: the spec is named for them, and its
 * Venom finisher does nothing else at all.
 */
export const ROGUE_VENOM: readonly PriorityEntry[] = [
  /*
   * THREE POINTS, NOT TWO, and the owner's number rather than this file's.
   * Mutilate awards two at a time, so a Venom Rogue passes through three on
   * its way to five in a single cast and the threshold is cheaper to hit here
   * than anywhere.
   *
   * HELD TO FIVE IT MEASURES WORSE, 496.6 against 505.0, because Improved
   * Slice and Dice is +45% and a three-point cast already runs 21.75 seconds.
   * Waiting for five buys nine more seconds of buff and costs the Rupture
   * those points would have paid for.
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * ============================================================================
   * RUPTURE, AND IT IS THE WHOLE OF THIS LIST'S GAIN: 488.1 to 504.8, +16.7.
   *
   * EVERY OTHER FIGURE IN THIS COMMENT COMES FROM ONE SWEEP and is quoted
   * against that sweep's 505.0 for this same list, so the comparisons below are
   * internally consistent; 504.8 is the shipped commit measured on its own. The
   * 0.2 between them is two runs of identical code.
   *
   * It was in the build's ability book and in no list, which is the state the
   * ability audit exists to find -- declared, learnable, castable, never cast.
   * Nothing was wrong with it; there was simply nowhere for the build's combo
   * points to go.
   *
   * THE POINTS WERE OVERFLOWING, which is what made it worth this much. Seal
   * Fate is 100% at 5/5 and MUTILATE CRITS TWICE, so one double-critting cast
   * is four points -- two of its own and two from Seal Fate. The build gains
   * about 28.5 a fight and, before this, wasted 7.21 of them at the cap.
   * Rupture takes 3.3 casts a fight and 7.8% of the damage, and the waste
   * falls to 2.02.
   *
   * ABOVE VENOM RATHER THAN BELOW IT, worth 4.8: 505.0 against 500.2. Below,
   * Venom takes the points first and Rupture drops to 2.2 casts.
   *
   * AT FOUR POINTS AND NOT FIVE, worth 3.9 over `exactly 5`. Mutilate awards
   * two, so a pool sitting at four goes to six and wastes one -- spending at
   * four is what stops that, and it is the same reasoning the Slice and Dice
   * threshold above rests on.
   *
   * "IF NOT ACTIVE" RATHER THAN A REFRESH WINDOW, which is the standing rule
   * here: a refresh RESETS the aura, so whatever is left is thrown away, and
   * the faster the character acts the sooner it reaches the entry inside that
   * window.
   * ============================================================================
   */
  {
    abilityId: 'rupture',
    condition: all(targetAuraDown('rupture'), atLeastPoints(4)),
  },
  /*
   * VENOM SURVIVES THE REORDER, at 1.9 casts rather than 2.8. It was measured
   * out of three earlier lists and back into this one by the owner, and with
   * Rupture above it it is still worth keeping: dropping it entirely reads
   * 507.4 against 505.0, which is inside both intervals and therefore not a
   * difference this method can call.
   *
   * SO THE OWNER'S ENTRY STAYS, because a measurement that cannot separate two
   * lists is not an argument for deleting one of them.
   */
  {
    abilityId: 'venom',
    condition: all(selfAuraDown(VENOM_AURA_ID), atLeastPoints(4)),
  },
  /*
   * ----------------------------------------------------------------------------
   * EVISCERATE IS GONE FROM THIS LIST, AND IT WAS ALREADY DOING NOTHING.
   *
   * It fired 0.3 times a fight for 0.9% of the damage before this change and
   * 0.0 times after it, because its gate asked for three things at once --
   * Slice and Dice above ten seconds, the Venom buff above ten seconds, AND
   * exactly five combo points -- and Rupture now takes the pool at four before
   * the third can be true.
   *
   * REMOVED RATHER THAN LEFT DEAD, on the owner's call. An entry that cannot
   * fire is the single most common rotation bug in this project and the one
   * that hides best: it produces an ordinary DPS figure and an ordinary
   * results page, because a row that is not there looks like a row that is not
   * there. Keeping it would have cost nothing in damage and cost the "every
   * entry fires" invariant that makes `USES=1` worth running.
   *
   * THE POINTS IT WOULD HAVE SPENT ARE NOT LOST. They go to Rupture, which is
   * why this list is faster without it: the owner's instruction for this pass
   * was explicitly NOT to reach a higher figure by casting Eviscerate more.
   * ----------------------------------------------------------------------------
   */
  /*
   * COLD BLOOD AT ZERO POINTS, which reads backwards until the ability is
   * read: it guarantees a crit on the NEXT ability, and for this build that is
   * the Mutilate below. Cast while the pool is empty and the energy is full,
   * it costs nothing a finisher wanted and lands on the builder that is about
   * to go out anyway. Worth 5.1 -- the list reads 502.3 without it.
   */
  {
    abilityId: 'cold_blood',
    condition: all(exactlyPoints(0), atLeastEnergy(60)),
  },
  { abilityId: 'mutilate' },
];

/**
 * COMBAT — swords, Sinister Strike into Eviscerate, with the two cooldowns.
 *
 * The simplest of the three and the one least affected by what is missing:
 * Sinister Strike needs no dagger, no position and no stealth.
 */
export const ROGUE_COMBAT: readonly PriorityEntry[] = [
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * EVISCERATE ABOVE THE TWO COOLDOWNS AND WITH NO POINT GATE, which is the
   * owner's order and is a departure from every other list here.
   *
   * ITS ONLY CONDITION IS SLICE AND DICE HAVING NINE SECONDS LEFT -- so it
   * spends whatever is on the bar rather than holding for five. The ability's
   * own `canCast` still requires at least one point, so it cannot fire empty;
   * what it can do is spend two or three, which this project's earlier shells
   * called wasteful. That reading is a claim about damage per point and the
   * owner's order is a claim about the whole cycle, and only a measurement
   * separates them. This one is theirs.
   *
   * NINE SECONDS RATHER THAN THE VENOM LIST'S TEN, and given as two separate
   * numbers rather than one shared constant, so neither is quietly moved by an
   * edit to the other.
   */
  { abilityId: 'eviscerate', condition: selfAuraAtLeast('slice_and_dice', 9) },
  { abilityId: 'adrenaline_rush' },
  { abilityId: 'blade_flurry' },
  { abilityId: 'sinister_strike' },
];

/**
 * RUPTURE — Subtlety, Hemorrhage into Rupture, bleeding rather than bursting.
 *
 * The build that loses most to an unmodelled clause: Hemorrhage's whole point
 * is +15% Rupture damage taken, and the engine has no per-ability damage-taken
 * multiplier. Both abilities work; the synergy between them does not, and the
 * results page says so.
 */
export const ROGUE_RUPTURE: readonly PriorityEntry[] = [
  /*
   * PREMEDITATION FIRST, and it is two combo points for free on a two-minute
   * cooldown. Its Forever tooltip has no stealth clause at all -- that was
   * Classic's, and reading it into this talent is what kept it recorded as
   * inert.
   */
  { abilityId: 'premeditation' },
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  {
    abilityId: 'rupture',
    condition: all(targetAuraDown('rupture'), exactlyPoints(MAX_COMBO_POINTS)),
  },
  /*
   * THE SAME FLOOR THE VENOM LIST USES, with Rupture in place of Venom: spend
   * five points on damage only while both maintenance effects have ten seconds
   * left, so a finisher never lands just before one has to be rebuilt.
   */
  {
    abilityId: 'eviscerate',
    condition: all(
      selfAuraAtLeast('slice_and_dice', 10),
      targetAuraAtLeast('rupture', 10),
      exactlyPoints(MAX_COMBO_POINTS),
    ),
  },
  /*
   * HEMORRHAGE BECOMES A MAINTENANCE STRIKE RATHER THAN THE FILLER. It was
   * UNCONDITIONAL and the cheapest builder in the list, which made it a floor
   * nothing below could reach -- Ghostly Strike and Sinister Strike both fired
   * zero times, and a six-entry list was really a three-entry one. Gated on
   * its own debuff having a second left, it maintains and Backstab builds.
   */
  { abilityId: 'hemorrhage', condition: targetAuraAtMost('hemorrhage', 1) },
  /*
   * AMBUSH ONLY ON A CUTTHROAT PROC, which is the whole of that talent: it
   * causes the next Ambush within ten seconds not to require Stealth, and
   * nothing here is ever stealthed. The ability's own `canCast` enforces the
   * same thing, so this entry is the list agreeing with it rather than
   * carrying the rule.
   */
  { abilityId: 'ambush', condition: selfActive('cutthroat') },
  { abilityId: 'backstab' },
  /*
   * PREPARATION LAST, below every builder, which is the right place for an
   * ability whose entire value is what it gives back: it fires only when
   * nothing else can, and finishes the cooldown on Premeditation, Ghostly
   * Strike and Cold Blood.
   */
  { abilityId: 'preparation' },
];

export const ROGUE_VENOM_ROTATION: Rotation = new PriorityRotation(
  'Rogue (Assassination, Venom)',
  ROGUE_VENOM,
);
export const ROGUE_COMBAT_ROTATION: Rotation = new PriorityRotation(
  'Rogue (Combat)',
  ROGUE_COMBAT,
);
export const ROGUE_RUPTURE_ROTATION: Rotation = new PriorityRotation(
  'Rogue (Subtlety, Rupture)',
  ROGUE_RUPTURE,
);

/**
 * Which list a Rogue runs.
 *
 * ----------------------------------------------------------------------------
 * CHOSEN BY TALENTS, not by style, and that is a departure from the Warrior.
 *
 * A Warrior's list follows from combat style AND stance, both of which are
 * fields on the character. A Rogue is dual-wield in every spec and has no
 * stance, so the only thing that distinguishes the three builds is where the
 * points went -- which is exactly what a profile carries.
 *
 * Read from the TALENT that defines the build rather than from a tree total,
 * because a total is a number anyone can hit by accident and a capstone is a
 * deliberate choice.
 * ----------------------------------------------------------------------------
 */
export function rogueRotation(talents: Readonly<Record<string, number>>): Rotation {
  if ((talents.mutilate ?? 0) > 0) return ROGUE_VENOM_ROTATION;
  if ((talents.hemorrhage ?? 0) > 0) return ROGUE_RUPTURE_ROTATION;
  return ROGUE_COMBAT_ROTATION;
}

/** Longest Rupture, for anything reasoning about the refresh window. */
export const RUPTURE_MAX_DURATION_MS =
  RUPTURE_BY_COMBO_POINT[RUPTURE_BY_COMBO_POINT.length - 1].durationMs;
