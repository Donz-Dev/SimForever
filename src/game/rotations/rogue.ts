import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import { comboPointsOn } from '../combat/comboPoints';
import { MAX_COMBO_POINTS } from '../combat/comboPoints';
import { RUPTURE_BY_COMBO_POINT } from '../auras/rogue';

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

// ---------------------------------------------------------------------------

/**
 * VENOM — Assassination, daggers, Mutilate into Eviscerate.
 *
 * Mutilate awards two combo points, so this build reaches five in three casts
 * rather than five and spends far more of its time on finishers. It is also
 * the build most hurt by poisons being absent: the spec is named for them.
 */
export const ROGUE_VENOM: readonly PriorityEntry[] = [
  { abilityId: 'slice_and_dice', condition: sliceAndDiceNeeded },
  { abilityId: 'cold_blood', condition: AT_FIVE },
  { abilityId: 'rupture', condition: ruptureNeeded },
  { abilityId: 'eviscerate', condition: AT_FIVE },
  { abilityId: 'mutilate' },
  // Falls back when no dagger is held, so the list is never empty.
  { abilityId: 'sinister_strike' },
];

/**
 * COMBAT — swords, Sinister Strike into Eviscerate, with the two cooldowns.
 *
 * The simplest of the three and the one least affected by what is missing:
 * Sinister Strike needs no dagger, no position and no stealth.
 */
export const ROGUE_COMBAT: readonly PriorityEntry[] = [
  { abilityId: 'slice_and_dice', condition: sliceAndDiceNeeded },
  { abilityId: 'adrenaline_rush' },
  { abilityId: 'blade_flurry' },
  { abilityId: 'eviscerate', condition: AT_FIVE },
  { abilityId: 'ghostly_strike' },
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
