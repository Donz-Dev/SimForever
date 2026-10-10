import type { Rotation } from '../../engine';
import type { AplCondition, AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_COOLDOWNS, CONSUMABLE_HEALS } from './consumableCooldowns';
import {
  all,
  comboPoints,
  compileRotation,
  not,
  onCooldown,
  resource,
  selfHas,
  selfTime,
  targetTime,
} from './apl';

import { MAX_COMBO_POINTS } from '../combat/comboPoints';
import { RUPTURE_BY_COMBO_POINT, VENOM_AURA_ID } from '../auras/rogue';
import { AMBUSH_ENERGY_COST } from '../abilities/rogue';

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
 * The Combat list does not hold for five, and it does not spend at one either.
 * It spends at TWO, and that was found by sweeping the gate rather than by
 * arguing about it -- 577.7 at one point, 588.5 at two, 572.2 at five.
 *
 * THE EARLIER READING WAS TAKEN BETWEEN THE TWO WORST POINTS ON THAT CURVE, and
 * it is worth keeping what it said: "its Eviscerate went from 1.1 casts a fight
 * to 9.0 -- for +0.6 DPS, inside the interval", which was read as the whole
 * question being flat. Both of those lists were bad in opposite directions, the
 * ungated one spending exactly one point every cast and the gated one barely
 * firing, and the +10.8 sitting between them was invisible from either end.
 * A TWO-POINT COMPARISON CANNOT SEE A PEAK, and "it does not matter" is the
 * conclusion it hands you when the two points happen to measure the same.
 * ----------------------------------------------------------------------------
 */

/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS, spelled out as helpers because two lists use
 * the same shapes and a duplicated threshold is a duplicated decision.
 * ============================================================================
 */

/** "combo points >= N", read through the TARGET so a stale pool reads zero. */
const atLeastPoints = (minimum: number) => comboPoints('atLeast', minimum);

/** "exactly N", which for the cap is the same question `AT_FIVE` asks. */
const exactlyPoints = (count: number) => comboPoints('exactly', count);

/** "<buff> is not active", on the Rogue. */
const selfAuraDown = (auraId: string) => selfTime('atMost', 0, auraId);

/**
 * "<buff> duration >= N seconds", on the Rogue.
 *
 * THE OWNER'S GATE ON EVISCERATE IS A FLOOR, NOT A WINDOW, and that is the
 * whole point of it: spend on damage only while the maintenance buffs have
 * plenty of time left, so a finisher never lands with Slice and Dice about to
 * drop. It is the opposite polarity to a refresh condition and reads almost
 * the same, so it is named rather than written inline twice.
 */
const selfAuraAtLeast = (auraId: string, seconds: number) => selfTime('atLeast', seconds, auraId);

/** Every condition in a list must hold. */

/** "<debuff> is not active", on the target. */
const targetAuraDown = (auraId: string) => targetTime('atMost', 0, auraId);

/** "<debuff> duration <= N seconds", on the target. An absent debuff counts. */
const targetAuraAtMost = (auraId: string, secondsLeft: number) =>
  targetTime('atMost', secondsLeft, auraId);

/** "combo points <= N", read through the TARGET like `atLeastPoints`. */
const atMostPoints = (maximum: number) => comboPoints('atMost', maximum);

/**
 * "<ability> is known AND its cooldown is running."
 *
 * ----------------------------------------------------------------------------
 * `has` IS THE HALF THAT IS EASY TO LEAVE OUT, AND LEAVING IT OUT IS SILENT.
 * `AbilityBook.isReady` returns false for an ability the character does not
 * have -- there are no charges to count -- so a bare `!isReady` reads "on
 * cooldown" for an ability the build never learned. That is the wrong answer in
 * the dangerous direction: Preparation's gate below asks whether the cooldowns
 * it would reset are DOWN, and a build with no Vanish has nothing to get back.
 *
 * It matters even though the only list using it requires both talents, because
 * the next list to use this primitive will not necessarily.
 * ----------------------------------------------------------------------------
 */
/*
 * THE GUARDED READING -- an ability the build never learned is NOT on
 * cooldown. That is what this closure wrote (`has(id) && !isReady(id)`) and
 * the Paladin's wrote the other one; both survive, see `compile.ts`.
 */
const abilityOnCooldown = onCooldown;

/** "<buff> is active", on the Rogue. */
const selfActive = selfHas;

/** Inverts a condition, so a cheap entry can be held rather than duplicated. */

/**
 * "a Cutthroat window is open and the pool cannot pay for Ambush yet."
 *
 * ----------------------------------------------------------------------------
 * USED NEGATED, TO HOLD A CHEAPER ENTRY SO THE POOL CAN REACH AMBUSH'S COST.
 * This is the inverse of the floor rule: an unconditional entry is a floor under
 * everything BELOW it, and a CHEAPER entry below an expensive one starves it
 * from beneath. Ambush sits second in the Rupture list and could still not be
 * cast, because Hemorrhage at 35 energy is below it and took the pool every time
 * it passed 35.
 *
 * MEASURED, AND THE SHAPE OF THE WASTE IS WHY IT NEEDED MEASURING. Over 300
 * fights there were 207 Cutthroat windows and only 30 ended in an Ambush. Mean
 * energy at the moment the window OPENED was 0.2 -- because Cutthroat procs off
 * BACKSTAB, which costs 60, so the proc always lands on an empty pool -- and the
 * mean PEAK during the ten seconds that followed was 45.2. Only 30 of the 207
 * windows ever reached 60 at all. The window was not expiring because ten
 * seconds is short; it was expiring because 100 energy of regeneration was being
 * spent by 156 Hemorrhages, 47 Backstabs, 78 Ruptures and 62 Slice and Dices
 * before any of it could be banked.
 *
 * CUTTHROAT ONLY, AND NOT THE STEALTH WINDOW. A stealth window is already spent
 * every single time -- 2.64 opened, 2.64 spent, none expired -- because Vanish
 * carries its own energy gate and therefore never opens one it cannot use. A
 * condition for a case that does not arise is still a decision somebody has to
 * read.
 * ----------------------------------------------------------------------------
 */
const poolingForAmbush: AplCondition = all(
  selfHas('cutthroat'),
  // A STRICT `<`, which is what the closure wrote: at exactly the cost the
  // Rogue is not pooling any more, it can afford the Ambush.
  resource('below', AMBUSH_ENERGY_COST, 'energy'),
);

/** "energy >= N". */
const atLeastEnergy = (minimum: number) => resource('atLeast', minimum, 'energy');

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
export const ROGUE_VENOM: AplList = {
  name: 'Rogue (Assassination, Venom)',
  entries: [
  /*
   * THREE POINTS, NOT TWO, and the owner's number rather than this file's.
   * Mutilate awards two at a time, so a Venom Rogue passes through three on
   * its way to five in a single cast and the threshold is cheaper to hit here
   * than anywhere.
   *
   * THE WHOLE THRESHOLD GRID WAS MEASURED AND ONLY ONE ROW OF IT MATTERS.
   * Slice and Dice at 2, 3, 4 and 5 against Venom at 2, 3, 4 and 5, sixteen
   * lists, 30 batches of 10 each:
   *
   *              Venom>=2   Venom>=3   Venom>=4   Venom>=5
   *     SnD>=2      504.8      504.5      504.6      505.4
   *     SnD>=3      504.2      505.2      504.8      504.0   <- shipped
   *     SnD>=4      503.2      505.2      505.1      504.6
   *     SnD>=5      491.4      489.4      493.1      498.4
   *
   * TWELVE OF THE SIXTEEN ARE ONE LIST. The top three rows span 503.2 to
   * 505.4 -- a range of 2.2 against intervals of +/- 4 to 5 -- so nothing in
   * them is separable, and the best cell beats the shipped one by 0.6, which
   * is not a number this method can report. The thresholds are not a lever.
   *
   * THE ONE REAL EDGE IS HOLDING SLICE AND DICE TO FIVE, which costs 8 to 15
   * depending on the Venom threshold beside it. It is a MAINTENANCE buff, so
   * what matters is uptime and not duration: Improved Slice and Dice is +45%
   * and a three-point cast already runs 21.75 seconds, while waiting for five
   * leaves the 30% attack speed DOWN while the pool refills. Buying nine more
   * seconds of a buff that is already up is worth less than not dropping it.
   *
   * SO THE OWNER'S ORIGINAL NUMBERS STAY. A measurement that cannot separate
   * twelve lists is not an argument for changing any of them.
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
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
  ],
};

/**
 * COMBAT — swords, Sinister Strike into Eviscerate, with the two cooldowns.
 *
 * The simplest of the three and the one least affected by what is missing:
 * Sinister Strike needs no dagger, no position and no stealth.
 */
/**
 * What the Combat list spends on Eviscerate, measured rather than chosen.
 *
 * NAMED BECAUSE IT IS A MEASURED RESULT AND NOT A TOOLTIP NUMBER, so the sweep
 * that produced it has somewhere to live and the next reader does not take it
 * for the owner's figure. The sweep is on the entry.
 */
const EVISCERATE_COMBO_POINTS_COMBAT = 2;

export const ROGUE_COMBAT: AplList = {
  name: 'Rogue (Combat)',
  entries: [
  /*
   * THE OWNER'S "IF NOT ACTIVE" STAYS, AND A REFRESH WINDOW WAS MEASURED AND
   * REJECTED. Recorded here so it is not re-run.
   *
   * Slice and Dice sat at 86.7% uptime, which looks like something to fix: the
   * entry only fires once the buff is GONE, and rebuilding three points takes
   * three Sinister Strikes, so every expiry costs a visible gap. Refreshing at
   * two or four seconds remaining does close most of it -- and is worth nothing
   * measurable, both at 90 batches of 10:
   *
   *     if not active        588.5  +/- 2.9    88.3% uptime   <- shipped
   *     <= 2s remaining      590.2  +/- 2.9    89.3% uptime
   *     <= 4s remaining      590.0  +/- 3.3    89.4% uptime
   *
   * +1.7 against an interval of +/- 2.9 is not a difference this method can
   * report, and the project's standing warning about refresh windows applies in
   * full -- a refresh RESETS the aura, so whatever is left is thrown away. With
   * no Improved Slice and Dice in this build (it is an Assassination talent) a
   * three-point cast runs 15 seconds, not 21.75, so four seconds clipped is a
   * QUARTER of the buff rather than a fifth.
   *
   * WHAT ACTUALLY RAISED THE UPTIME WAS THE EVISCERATE GATE BELOW, 86.7% to
   * 88.3% with this entry untouched: an ungated Eviscerate was draining the bar
   * to zero on every single point, so there was never a point banked when Slice
   * and Dice needed three. The uptime problem was not in the Slice and Dice
   * entry at all.
   *
   * THE THRESHOLD IS NOT A LEVER EITHER. Dropping it to two points measures
   * 580.0 to 583.7 and raising it to five measures 583.6, both worse than the
   * owner's three.
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * EVISCERATE ABOVE THE TWO COOLDOWNS, WITH THE OWNER'S NINE-SECOND FLOOR AND
   * A TWO-POINT GATE. The gate is new; everything else is the owner's order.
   *
   * ==========================================================================
   * WITHOUT A GATE IT SPENT EXACTLY ONE POINT, EVERY SINGLE CAST. Ten casts a
   * fight, ten points. That is not a tendency, it is arithmetic: Sinister
   * Strike is the only builder in this list and awards one point, Eviscerate
   * sits ABOVE it and is the first castable entry the moment a point exists, so
   * the bar went 0 -> 1 -> 0 and could never reach two. An ungated finisher
   * above the only builder does not "spend whatever is on the bar" -- it spends
   * ONE, always, and the list reads as though it might spend five.
   *
   * SO THE GATE IS NOT A FLOOR HERE, IT IS THE POINT COUNT. Every cast lands at
   * exactly the gate -- the same mechanism, now choosing the number -- which is
   * what makes the sweep below a sweep over Eviscerate's combo point cost
   * rather than over a condition.
   *
   *     points spent    DPS (90 batches of 10)
   *       1 (ungated)   577.7  +/- 3.4
   *       2             588.5  +/- 2.9   <- shipped
   *       3             587.2  +/- 3.4
   *       4             580.6  +/- 4.9
   *       5             572.2  +/- 4.2
   *
   * TWO POINTS IS WORTH +10.8 OVER ONE, and five is worth -5.5. Two and three
   * cannot be separated, so the lower one ships: it is the one that reaches the
   * finisher sooner and therefore depends least on the fight not ending.
   *
   * THE REASON FIVE LOSES IS IN THE DAMAGE TABLE, AND IT IS THE OPPOSITE OF
   * THIS PROJECT'S USUAL INTUITION. `EVISCERATE_BY_COMBO_POINT` is 278, 448,
   * 618, 788, 958 -- which is 278 for the FIRST point and 170 for each one
   * after it. So damage per combo point FALLS as the bar fills: 278 at one
   * point, 224 at two, 206 at three, 192 at five. Holding for five buys 170
   * more damage per extra point while the Sinister Strike that bought that
   * point costs 45 energy and a global cooldown of its own. "Hold for five"
   * is the right rule for a finisher whose table runs through the origin, and
   * Eviscerate's does not.
   *
   * AND ONE POINT STILL LOSES, because the 35 energy and the global cooldown
   * are paid per CAST rather than per point: 278 damage for a full cast is
   * worse than the Sinister Strike it displaced. The peak is where those two
   * pressures meet, which is why it is measured and not reasoned.
   * ==========================================================================
   *
   * NINE SECONDS RATHER THAN THE VENOM LIST'S TEN, and given as two separate
   * numbers rather than one shared constant, so neither is quietly moved by an
   * edit to the other.
   */
  {
    abilityId: 'eviscerate',
    condition: all(
      selfAuraAtLeast('slice_and_dice', 9),
      atLeastPoints(EVISCERATE_COMBO_POINTS_COMBAT),
    ),
  },
  { abilityId: 'adrenaline_rush' },
  { abilityId: 'blade_flurry' },
  { abilityId: 'sinister_strike' },
  ],
};

/**
 * RUPTURE — Subtlety, Hemorrhage into Rupture, bleeding rather than bursting.
 *
 * The build that loses most to an unmodelled clause: Hemorrhage's whole point
 * is +15% Rupture damage taken, and the engine has no per-ability damage-taken
 * multiplier. Both abilities work; the synergy between them does not, and the
 * results page says so.
 */
/*
 * ============================================================================
 * THE OWNER'S STEALTH CYCLE, AND WHAT A PRIORITY LIST CAN AND CANNOT SAY.
 *
 * The design, in their words:
 *
 *     Opener:                                    Stealth, Premeditation, Ambush
 *     When <= 3 combo points:                    Vanish, Ambush
 *     When Vanish + Premed on CD and CP <= 1:    Preparation
 *     When Prep is on CD and the others are not: Vanish, Premeditation, Ambush
 *
 * FOUR SEQUENCES, AND THEY COLLAPSE INTO THREE ENTRIES. A priority list has no
 * notion of a sequence: it is re-read from the top every global cooldown and the
 * first castable entry wins, so a sequence is what EMERGES when each of its
 * steps is the highest castable entry in turn. Premeditation, Ambush and Vanish
 * at the top produce every one of the four above, including the last -- once
 * Preparation has finished their cooldowns, Vanish and Premeditation are simply
 * castable again and the list walks the same three entries.
 *
 * SO THE FOURTH SEQUENCE NEEDS NO ENTRY, and writing one would be the duplicate
 * -id shape this project only wants deliberately. Said out loud because an
 * absent entry for a named clause reads like an omission.
 *
 * AND THE OPENER'S "STEALTH" IS NOT AN ENTRY EITHER. There is no Stealth
 * ability: the Rogue starts the fight with the `stealth` aura from
 * `openingAuras`, which is the owner's "you start from stealth" expressed as the
 * one thing it does. Vanish applies the same aura, so the opener and every
 * later window are one mechanism.
 * ============================================================================
 */
/**
 * What the Rupture list spends on Rupture, measured rather than chosen.
 *
 * NAMED BECAUSE IT IS A MEASURED RESULT AND NOT A TOOLTIP NUMBER. The sweep that
 * produced it, and why four beats five on a bleed whose damage per point falls,
 * are on the entry itself.
 */
const RUPTURE_COMBO_POINTS = 4;

export const ROGUE_RUPTURE: AplList = {
  name: 'Rogue (Subtlety, Rupture)',
  entries: [
  /*
   * PREMEDITATION FIRST, UNGATED, WHICH IS THE OWNER'S ENTRY UNCHANGED. Free,
   * two minutes, +2 combo points. Its Forever tooltip has no stealth clause at
   * all -- that was Classic's, and reading it into this talent is what kept it
   * recorded as inert.
   *
   * A POINT GATE WAS TRIED AND MEASURES EXACTLY NOTHING, 482.8 either way to
   * the decimal, so it is not here. `atMostPoints(3)` is the arithmetic the
   * Slice and Dice threshold rests on -- it grants two, so a pool at four
   * throws one away -- and the reason it buys nothing is the COOLDOWN: at two
   * minutes this fires at the pull and once more after Preparation, and the
   * pool is low at both. A guard against a case that cannot arise is still a
   * decision somebody has to read, so the owner's simpler entry stands.
   */
  { abilityId: 'premeditation' },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * AMBUSH SECOND AND UNCONDITIONAL, because its own `canCast` is the gate: a
   * dagger in the main hand and EITHER the Cutthroat proc or a stealth window.
   * The entry used to carry `selfActive('cutthroat')`, which was the list
   * restating the ability's rule -- and once there were two routes to the gate
   * it would have been the list restating HALF of it, which is worse than not
   * restating it at all.
   *
   * IT IS NOT A FLOOR UNDER THE LIST despite being unconditional, because
   * `checkCast` refuses it whenever neither aura is up. An ungated entry is only
   * a floor when it is ALSO always castable.
   *
   * SECOND RATHER THAN FIRST so the opener spends Premeditation's global
   * cooldown while still stealthed -- the window is ten seconds and one global
   * cooldown is one. That is the owner's order.
   */
  { abilityId: 'ambush' },
  /*
   * VANISH, WHICH EXISTS TO BE AMBUSH'S SECOND AND THIRD USE. Five minutes is
   * longer than any fight here, so on its own it is one extra Ambush; what makes
   * it worth a list entry is Preparation finishing its cooldown.
   *
   * A POINT GATE, because Ambush awards TWO points with Initiative at 3/3: a
   * pool at three goes to five and a pool at four wastes one. Gating Vanish
   * rather than Ambush is the deliberate choice -- a Cutthroat proc is free and
   * should be spent whatever the pool looks like, and a five-minute cooldown
   * should not be.
   *
   * ------------------------------------------------------------------------
   * AND AN ENERGY GATE, WORTH +5.7 AND THE ONLY REFINEMENT IN THIS LIST THAT
   * MEASURED AS ONE: 488.5 against 482.8 at 60 batches of 10.
   *
   * SPENDING A GLOBAL COOLDOWN ON VANISH ONLY TO FIND AMBUSH UNAFFORDABLE IS
   * THE FAILURE IT PREVENTS. Ambush costs 60 of a 100 energy pool, and the
   * window is ten seconds -- long enough that it does not usually expire, but
   * the Rogue spends those seconds on Backstab and Hemorrhage, each of which
   * pushes the 60 further away. The waste is not a lost window so much as a
   * stealth Ambush arriving several global cooldowns late, behind builders that
   * refilled the pool it was waiting on.
   *
   * ON VANISH AND NOT ON AMBUSH, which is the same split as the point gate: the
   * cost of being early is paid by the thing with the cooldown.
   * ------------------------------------------------------------------------
   */
  {
    abilityId: 'vanish',
    /*
     * AND IT REFUSES WHILE CUTTHROAT IS UP, which is the owner's instruction and
     * measures as EXACTLY NOTHING -- 493.0 either way, and zero occurrences in
     * 300 fights before it existed. It is here because the reasoning is sound
     * and the guard is free: spending a five-minute cooldown to open a gate that
     * is already open would waste it outright.
     *
     * THE REASON IT CANNOT HAPPEN TODAY IS AN ORDERING, NOT A RULE, and that is
     * the case for writing it down. Ambush sits ABOVE Vanish, so whenever
     * Cutthroat is up and Ambush is affordable, Ambush is simply the first
     * castable entry -- and when it is not affordable, Vanish's own energy gate
     * refuses too, because the two share a cost. Both halves of that accident
     * are things a later edit could move.
     */
    condition: all(
      atMostPoints(3),
      atLeastEnergy(AMBUSH_ENERGY_COST),
      not(selfActive('cutthroat')),
    ),
  },
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * RUPTURE AT FOUR POINTS RATHER THAN FIVE, worth +3.0.
   *
   * ==========================================================================
   * ITS DAMAGE *AND* ITS DURATION PER COMBO POINT BOTH FALL AS THE POOL FILLS,
   * which is the opposite of the intuition "hold for five" rests on.
   * `RUPTURE_BY_COMBO_POINT` is 159/222/295/377/469 damage over 8/10/12/14/16
   * seconds, so per point:
   *
   *     points    1      2      3      4      5
   *     damage   159    111     98     94     94
   *     seconds  8.0    5.0    4.0    3.5    3.2
   *
   * A FOUR-POINT RUPTURE IS 94 DAMAGE AND 3.5 SECONDS PER POINT AGAINST THE
   * FIFTH POINT'S 92 AND 2.0. The fifth point buys 92 damage and two seconds;
   * a fourth buys 82 and two. They are close, and what separates them is the
   * WAIT: this build gains 21.5 combo points a fight and spends 19.7, so the
   * binding constraint is time-to-threshold rather than points available, and
   * the debuff was up only 43.7% of the fight.
   *
   * THE WHOLE GRID WAS MEASURED, 60 batches of 10 a cell, with the Slice and
   * Dice threshold on the other axis:
   *
   *              Rupt>=3   Rupt>=4   Rupt=5
   *     SnD>=2     494.8     495.2     492.3
   *     SnD>=3     494.4     495.7     493.0   <- shipped row
   *     SnD>=4     489.6     493.7     494.1
   *     SnD>=5     477.4     476.7     489.2
   *
   * Confirmed at 150 batches: 493.6 at five points, 496.6 at four.
   *
   * SLICE AND DICE'S OWN THRESHOLD IS NOT A LEVER between two and four -- the
   * top rows are inside each other's intervals -- and holding it to FIVE costs
   * 4 to 18. Same finding as the Combat list: it is a MAINTENANCE buff, so
   * uptime beats duration. The owner's three stands.
   *
   * AND RUPTURE MUST STAY *BELOW* SLICE AND DICE. Swapping the two entries
   * measures 487.2, a loss of 8.5: the haste is on every auto-attack and the
   * autos are half this profile's damage, so losing attack speed to keep a
   * bleed up is the wrong trade in exactly the way the ordering already said.
   * ==========================================================================
   */
  {
    abilityId: 'rupture',
    condition: all(targetAuraDown('rupture'), atLeastPoints(RUPTURE_COMBO_POINTS)),
  },
  /*
   * EVISCERATE'S TWO DURATION FLOORS ARE GONE, worth +1.5 ON TOP of Rupture's
   * threshold -- and it is the SECOND list those floors have suppressed.
   *
   * ==========================================================================
   * THEY SUPPRESSED IT TO ZERO CASTS A FIGHT, for the whole life of this list.
   * "Spend five points on damage only while Slice and Dice AND Rupture both
   * have ten seconds left" is three conditions at once, and the third is the
   * only one doing useful work. CLAUDE.md already records the same pair costing
   * the VENOM list 20 DPS; this is the same mistake in the same file, found by
   * reading the `USES=1` column rather than by suspecting it.
   *
   * IT ONLY BECAME CASTABLE ONCE RUPTURE STOPPED HOARDING THE FIFTH POINT, so
   * the two halves of this change are not independent: at Rupture-exactly-five
   * dropping the floors is worth +0.6 and nothing fires, and at Rupture-four it
   * is worth +1.5 and Eviscerate fires 0.2 times a fight for 1.2% of damage.
   * A finisher with nothing left to spend reads identically to a suppressed one.
   *
   * FIVE POINTS AND NOT FOUR, which is the reverse of the Combat list's answer
   * and for a reason: this profile has a BLEED to maintain, so a point taken by
   * Eviscerate is a point Rupture needed. Letting it spend less is a real loss
   * rather than a flat choice --
   *
   *     Eviscerate at 5   498.1      at >=4   497.7
   *     Eviscerate at 3   489.3      at >=2   479.2
   *
   * -- and the two upper figures are inside each other's intervals, so the
   * HIGHER gate ships: it keeps Eviscerate as an overflow valve for the points
   * Rupture and Slice and Dice could not use, rather than a competitor for them.
   * ==========================================================================
   */
  { abilityId: 'eviscerate', condition: exactlyPoints(MAX_COMBO_POINTS) },
  /*
   * HEMORRHAGE BECOMES A MAINTENANCE STRIKE RATHER THAN THE FILLER. It was
   * UNCONDITIONAL and the cheapest builder in the list, which made it a floor
   * nothing below could reach -- Ghostly Strike and Sinister Strike both fired
   * zero times, and a six-entry list was really a three-entry one. Gated on
   * its own debuff having a second left, it maintains and Backstab builds.
   */
  /*
   * AND IT HOLDS FOR A CUTTHROAT WINDOW. At 35 energy it is the cheapest thing
   * in the list, which made it the reason Ambush could not be cast: 156 of them
   * fired inside the 177 windows that never produced an Ambush.
   */
  {
    abilityId: 'hemorrhage',
    condition: all(targetAuraAtMost('hemorrhage', 1), not(poolingForAmbush)),
  },
  /*
   * PREPARATION, MOVED UP OUT OF LAST PLACE AND GIVEN THE OWNER'S CONDITION.
   *
   * --------------------------------------------------------------------------
   * IT USED TO BE UNCONDITIONAL AND BOTTOM, below every builder, and the
   * comment there argued that was the right place for "an ability whose entire
   * value is what it gives back": it fires only when nothing else can. That
   * reasoning was sound while the only things it reset were Premeditation,
   * Ghostly Strike and Cold Blood -- none of which the list is ever waiting on.
   *
   * VANISH CHANGES WHAT IT IS FOR. The thing worth resetting is now a
   * five-minute cooldown that buys an Ambush, so Preparation is the second half
   * of the stealth cycle rather than a tidy-up at the end of the fight, and
   * WHEN it fires decides whether that second Vanish happens inside the fight
   * at all.
   *
   * THE OWNER'S CONDITION IS BOTH COOLDOWNS DOWN AND THE POOL NEARLY EMPTY:
   * both, because resetting one while the other is up wastes the other; and a
   * pool at one point or less, because the Vanish-Ambush-Premeditation sequence
   * it unlocks is worth four points and wants somewhere to put them.
   *
   * STILL BELOW THE DAMAGE FINISHERS, so a Rupture or an Eviscerate that is
   * ready is never displaced by a cooldown reset.
   *
   * IT MEASURES FLAT AND IT IS THE OWNER'S DESIGN, WHICH IS THE WHOLE NOTE.
   * Unconditional and last, as it was, reads 481.6 against 482.8 -- inside the
   * interval, so this method cannot separate the two placements. The condition
   * is here because the owner specified it, and the measurement is recorded as
   * its price rather than as an argument for it: the 1.0 cast a fight happens
   * either way, and what the gate changes is WHEN, which a sixty-second fight
   * is too short to reward.
   * --------------------------------------------------------------------------
   */
  {
    abilityId: 'preparation',
    condition: all(
      abilityOnCooldown('vanish'),
      abilityOnCooldown('premeditation'),
      atMostPoints(1),
    ),
  },
  /*
   * BACKSTAB HOLDS FOR THE WINDOW TOO, and it is the same 60 energy as Ambush --
   * so without this the filler and the thing it is meant to make room for race
   * for the same pool, and the filler is below everything else that can also
   * spend it.
   *
   * ONLY THESE TWO HOLD, AND HOLDING MORE MEASURED WORSE. Gating Slice and Dice
   * and Rupture the same way reads 490.8 against 493.0 -- they are maintenance,
   * and dropping a Rupture to buy an Ambush gives back more than it takes.
   */
  { abilityId: 'backstab', condition: not(poolingForAmbush) },
  ],
};

/**
 * HEMO — the Rupture build with the Backstab engine taken out.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S LIST, AND IT IS THIS FILE'S RUPTURE LIST MINUS ONE ENTRY:
 * "exactly the same as the Rupture profile except these talents, and Backstab
 * won't be in the Hemo APL at all."
 *
 * SO IT IS DERIVED FROM `ROGUE_RUPTURE` RATHER THAN TRANSCRIBED, by filtering
 * out the one ability. Two lists that have to stay in step and are maintained
 * by hand DRIFT, and the drift is invisible: a Rogue entry is four lines, and a
 * difference between two near-identical lists reads as deliberate. Anything
 * measured into the Rupture list from here on reaches this one for free, which
 * is the behaviour the owner's "exactly the same except" asks for.
 *
 * ----------------------------------------------------------------------------
 * AND REMOVING BACKSTAB IS NOT A ROTATION PREFERENCE, IT FOLLOWS THE TREE.
 * The build drops CUTTHROAT (Backstab's proc, and the Rupture list's only
 * in-combat route to Ambush) and PUNCTURING_WOUNDS (Backstab's extra combo
 * point and its crit). With both gone Backstab is a 60-energy strike with
 * nothing attached, against Hemorrhage at 35 that also maintains a debuff —
 * so the entry the owner removed is the entry the talents stopped paying for.
 *
 * WHICH MAKES AMBUSH A STEALTH-ONLY ABILITY HERE. Its gate has one route, the
 * pull and Vanish, where the Rupture list has two. The energy-pooling condition
 * on Hemorrhage reads the Cutthroat aura and therefore never holds in this
 * build, which is correct rather than inert: there is no Cutthroat window to
 * pool for, and the stealth windows Vanish opens are already gated on being
 * affordable.
 * ----------------------------------------------------------------------------
 */
export const ROGUE_HEMO: AplList = {
  name: 'Rogue (Subtlety, Hemo)',
  entries: [
  /*
   * Everything above the filler, in the Rupture list's own order.
   */
  ...ROGUE_RUPTURE.entries.filter(
    (entry) => entry.abilityId !== 'backstab' && entry.abilityId !== 'hemorrhage',
  ),
  /*
   * NO RACIAL COOLDOWNS OF ITS OWN: the spread above already carries them.
   *
   * This list is another list's entries plus a change, so `RACIAL_COOLDOWNS`
   * arrives inside that spread -- in the position the other list put them,
   * which is the position this list wants too. Adding them here as well put
   * four abilities in twice, and `rotationIds.test.ts` caught it as a duplicate
   * below an unconditional copy: a second entry for an ability on cooldown is
   * unreachable, which reads as a list four entries longer than it is.
   */
  /*
   * ==========================================================================
   * HEMORRHAGE UNGATED, AND IT IS WORTH +108.9 -- 416.9 to 525.8.
   *
   * REMOVING BACKSTAB REMOVED THE LIST'S ONLY UNGATED BUILDER, and nothing in
   * the entries above it is castable on demand: Premeditation and Vanish are on
   * minute cooldowns, Ambush needs a stealth window this build can only get from
   * Vanish, and the three finishers need combo points this list then has no way
   * to earn. With Hemorrhage still gated on its own debuff, the profile wasted
   * 272.7 energy a fight at the cap -- a THIRD of its income -- and spent global
   * cooldowns doing nothing.
   *
   * THE GATE'S OWN JUSTIFICATION WENT WITH BACKSTAB, which is why this is not a
   * second opinion about the owner's list. The Rupture list's note reads
   * "gated on its own debuff having a second left, it MAINTAINS and Backstab
   * BUILDS" -- the gate was correct because something else was doing the
   * building, and it made Hemorrhage a floor that starved Ghostly Strike and
   * Sinister Strike beneath it. HERE THERE IS NOTHING BENEATH IT, so the floor
   * costs nothing and the building has to come from somewhere.
   *
   * SO IT MAINTAINS AND BUILDS, which is what Hemorrhage was in this file before
   * the Rupture list had a Backstab engine to separate the two jobs.
   *
   * ----------------------------------------------------------------------------
   * MEASURED, 60 batches of 10, and a 45-energy filler is strictly worse:
   *
   *     Backstab out, nothing added          416.9   the specification as given
   *     Hemorrhage ungated                   525.8   shipped
   *     Sinister Strike at the bottom        483.8
   *     BOTH of the above                    525.8   identical, to the decimal
   *     (reference) Backstab left in          506.9
   *
   * THE "BOTH" ROW IS THE FLOOR RULE CONFIRMING ITSELF: Sinister Strike at 45
   * energy below an ungated Hemorrhage at 35 can never be the first castable
   * entry, so adding it changes nothing at all. That is the same arithmetic that
   * made Hemorrhage a problem in the Rupture list, pointing the other way.
   *
   * AND IT BEATS THE RUPTURE LIST WITH BACKSTAB IN IT, 525.8 against 506.9 on
   * this build -- so the owner's instruction to drop Backstab is right about this
   * tree, and what it needed was the filler moving rather than the entry staying.
   * ----------------------------------------------------------------------------
   * ==========================================================================
   */
  { abilityId: 'hemorrhage' },
  ],
};

export const ROGUE_VENOM_ROTATION: Rotation = compileRotation(ROGUE_VENOM);
export const ROGUE_COMBAT_ROTATION: Rotation = compileRotation(ROGUE_COMBAT);
export const ROGUE_RUPTURE_ROTATION: Rotation = compileRotation(ROGUE_RUPTURE);
export const ROGUE_HEMO_ROTATION: Rotation = compileRotation(ROGUE_HEMO);

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
  /*
   * TWO SUBTLETY BUILDS NOW, AND HEMORRHAGE NO LONGER SEPARATES THEM -- both
   * take it, because both are built around it.
   *
   * CUTTHROAT IS THE DISCRIMINATOR, and it is a functional one rather than an
   * arbitrary tiebreak: Cutthroat is Backstab's proc and the Rupture list's only
   * in-combat route to Ambush, so a Hemorrhage build WITHOUT it cannot run the
   * Rupture list's Backstab engine at all. The talent that decides which list
   * works is the talent the dispatch reads.
   *
   * Reading Quietus, which the Hemo build takes and Rupture does not, would
   * work today and is the weaker choice: it is a damage talent that says nothing
   * about which list can function.
   */
  if ((talents.hemorrhage ?? 0) > 0) {
    return (talents.cutthroat ?? 0) > 0 ? ROGUE_RUPTURE_ROTATION : ROGUE_HEMO_ROTATION;
  }
  return ROGUE_COMBAT_ROTATION;
}

/** Longest Rupture, for anything reasoning about the refresh window. */
export const RUPTURE_MAX_DURATION_MS =
  RUPTURE_BY_COMBO_POINT[RUPTURE_BY_COMBO_POINT.length - 1].durationMs;
