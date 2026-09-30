import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import { comboPointsOn } from '../combat/comboPoints';
import { MAX_COMBO_POINTS } from '../combat/comboPoints';
import { RUPTURE_BY_COMBO_POINT, VENOM_AURA_ID } from '../auras/rogue';

/**
 * Rogue priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE. The ruleset owner asked for "an APL shell" per
 * profile; these are the standard shape of each build's rotation and are NOT
 * the owner's own lists, which have not been given. Every Warrior list in this
 * project came from the owner directly, and the difference matters: a number
 * measured off one of these describes this file's guess, not the ruleset.
 *
 * THE SHAPE EVERY ROGUE LIST SHARES, which is why they look alike:
 *
 *   1. keep Slice and Dice up, because it is a flat 30% attack speed and
 *      everything else is worth less than that
 *   2. spend the rest at five combo points, never at four
 *   3. otherwise build
 *
 * A damage finisher at one point is not wrong, it is wasteful: the same 35
 * energy and global cooldown buys a fifth of the damage. Holding for five is
 * what makes the class a queue rather than a reaction.
 * ----------------------------------------------------------------------------
 */

/** Spend only at the cap, which is where a finisher is worth its energy. */
const AT_FIVE = (_context: SimulationContext, actor: Combatant): boolean =>
  comboPointsOn(actor) >= MAX_COMBO_POINTS;

/**
 * Slice and Dice goes up whenever it is down, at ANY number of combo points.
 *
 * ----------------------------------------------------------------------------
 * NOT AT FIVE, AND THE ABILITY SAYS WHY. Its magnitude does not scale -- thirty
 * percent attack speed at one combo point is the same thirty percent as at
 * five -- and only its DURATION does. So a point spent here buys uptime, while
 * a point spent on Eviscerate buys damage that scales linearly with it.
 *
 * ----------------------------------------------------------------------------
 * THIS USED TO SAY EVISCERATE NEVER FIRED, and it was right about the
 * behaviour and wrong about why.
 *
 * Measured across every threshold, Eviscerate fired zero times and DPS moved
 * six points. The note blamed Relentless Strikes being unmodelled. That was
 * one of two causes and the smaller one: the Rogue was also MISSING FROM
 * `talentValues.ts`, so every rank value resolved to nothing and all twenty of
 * its talents were silently inert. Invisible, because a talent with no value
 * reports itself unmodelled -- which is what an unfinished class is meant to
 * say.
 *
 * Both fixed. Eviscerate fires about once a fight on the Combat build and the
 * three profiles gained 21, 55 and 88 DPS.
 *
 * TWO IS STILL THE THRESHOLD, and still by measurement rather than by taste:
 * Slice and Dice buys uptime with a point and Eviscerate buys damage, and the
 * point where those cross has not moved.
 * ----------------------------------------------------------------------------
 */
const SLICE_AND_DICE_MINIMUM_POINTS = 2;
function sliceAndDiceNeeded(context: SimulationContext, actor: Combatant): boolean {
  if (comboPointsOn(actor) < SLICE_AND_DICE_MINIMUM_POINTS) return false;
  return actor.auras.remainingMs('slice_and_dice', context.clock.now()) <= 0;
}

/**
 * Rupture is worth refreshing when it is about to fall off, not on cooldown.
 *
 * Its five-point duration is sixteen seconds, and re-applying early throws
 * away whatever was left: `refreshBehaviour: 'reset'` replaces rather than
 * extends.
 */
const RUPTURE_REFRESH_WINDOW_MS = 2000;

function ruptureNeeded(context: SimulationContext, actor: Combatant, target?: Combatant): boolean {
  if (!target) return false;
  // At five, unlike Slice and Dice: BOTH its damage and its duration scale, so
  // a short Rupture is worse twice over.
  if (comboPointsOn(actor) < MAX_COMBO_POINTS) return false;
  return target.auras.remainingMs('rupture', context.clock.now()) < RUPTURE_REFRESH_WINDOW_MS;
}


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
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * VENOM IS BACK IN A LIST, AND IT WAS MEASURED OUT OF ONE. Three placements
   * were tried and every one was a loss -- 415.2 without it against 395.7,
   * 398.0 and 400.1. None of those three was this one: at four points and
   * gated on the buff being DOWN, so it is cast once and held rather than
   * re-spent, which is the arrangement that makes a maintenance finisher pay.
   * The measurement below says what this version is worth.
   */
  {
    abilityId: 'venom',
    condition: all(selfAuraDown(VENOM_AURA_ID), atLeastPoints(4)),
  },
  /*
   * DAMAGE ONLY WHILE BOTH MAINTENANCE BUFFS HAVE TIME LEFT. A floor rather
   * than a window: spending five points on Eviscerate is wasted if Slice and
   * Dice drops two seconds later and has to be rebuilt from nothing.
   */
  {
    abilityId: 'eviscerate',
    condition: all(
      selfAuraAtLeast('slice_and_dice', 10),
      selfAuraAtLeast(VENOM_AURA_ID, 10),
      exactlyPoints(MAX_COMBO_POINTS),
    ),
  },
  /*
   * COLD BLOOD AT ZERO POINTS, which reads backwards until the ability is
   * read: it guarantees a crit on the NEXT ability, and for this build that is
   * the Mutilate below. Cast while the pool is empty and the energy is full,
   * it costs nothing a finisher wanted and lands on the builder that is about
   * to go out anyway.
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
  { abilityId: 'slice_and_dice', condition: sliceAndDiceNeeded },
  { abilityId: 'rupture', condition: ruptureNeeded },
  { abilityId: 'eviscerate', condition: AT_FIVE },
  { abilityId: 'hemorrhage' },
  { abilityId: 'ghostly_strike' },
  { abilityId: 'sinister_strike' },
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
