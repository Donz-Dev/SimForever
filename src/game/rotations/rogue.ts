import type { Rotation, WeaponType } from '../../engine';
import type { AplCondition, AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import {
  COMBAT_THISTLE_TEA_ENERGY_THRESHOLD,
  CONSUMABLE_HEALS,
  TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  consumableCooldowns,
  thistleTeaCooldown,
} from './consumableCooldowns';
import {
  all,
  comboPoints,
  compileRotation,
  not,
  onCooldown,
  ready,
  resource,
  selfHas,
  selfTime,
  targetHas,
  targetTime,
} from './apl';

import { MAX_COMBO_POINTS } from '../combat/comboPoints';
import { RUPTURE_BY_COMBO_POINT, VENOM_AURA_ID } from '../auras/rogue';
import { AMBUSH_ENERGY_COST, GARROTE_ENERGY_COST } from '../abilities/rogue';

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

/**
 * "exactly N", which the Hemo Dagger list uses for both of its finisher gates.
 *
 * ----------------------------------------------------------------------------
 * IT WAS DELETED ONE ROUND AGO AND IS BACK, which is worth a sentence rather
 * than a silent restore. Every `exactly` gate went to `atLeast` when the owner
 * respecified Venom, Combat and Rupture -- and their Hemo Dagger panel reads
 * `=` on Cold Blood and Eviscerate, so the helper has callers again.
 *
 * `atLeast` AT THE CAP AND `exactly` AT THE CAP ARE THE SAME TEST TODAY. They
 * stop being the same the moment a cap moves, which is why the owner's own
 * wording is followed in each list rather than normalised across them.
 * ----------------------------------------------------------------------------
 */
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

/**
 * "<debuff> duration >= N seconds", on the TARGET -- `selfAuraAtLeast`'s mirror.
 *
 * THE FIRST FLOOR IN THESE LISTS THAT IS ON A BLEED rather than on a buff the
 * character carries. The Rupture list holds Eviscerate behind six seconds of
 * Rupture: spending four points on a direct hit while the bleed is about to
 * fall off is how a Subtlety Rogue loses the thing it is built around.
 */
const targetAuraAtLeast = (auraId: string, seconds: number) =>
  targetTime('atLeast', seconds, auraId);

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

/*
 * ----------------------------------------------------------------------------
 * POOLING FOR THE VANISH-GARROTE SEQUENCE, Pure Hemo's version of the Ambush
 * pooling above and for the same reason. The owner's sequence fires "when
 * Garrote fades", and it needs 50 energy for the Garrote at the end of it --
 * but Hemorrhage below it is cheaper and ungated, so it took the pool every
 * time it passed its own cost and the sequence fired 0.6 times a fight. So the
 * filler waits while Garrote is down and Vanish is ready, until the pool can
 * pay for the whole sequence.
 * ----------------------------------------------------------------------------
 */
const poolingForGarrote: AplCondition = all(
  targetAuraDown('garrote'),
  ready('vanish'),
  resource('below', GARROTE_ENERGY_COST, 'energy'),
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
/**
 * What the Venom list spends on a finisher, and the floor its two buffs must
 * clear before it does. All four are the ruleset owner's, read off their panel.
 *
 * ----------------------------------------------------------------------------
 * THREE EVERYWHERE EXCEPT SLICE AND DICE, WHICH IS ONE -- and the asymmetry is
 * the design rather than an oversight. Slice and Dice is a MAINTENANCE buff, so
 * what matters is that it is UP: Improved Slice and Dice is +45% and even a
 * one-point cast runs long enough that refreshing early beats letting 30%
 * attack speed drop while the pool refills. Everything else is damage, and
 * damage waits for points.
 *
 * THE THREE-SECOND FLOOR IS A FLOOR AND NOT A REFRESH WINDOW, which is the
 * opposite polarity and reads almost the same: spend on damage only while both
 * buffs have plenty of time left, so a finisher never lands with Slice and Dice
 * about to drop.
 * ----------------------------------------------------------------------------
 */
const VENOM_SLICE_AND_DICE_POINTS = 1;
const VENOM_BUFF_COMBO_POINTS = 3;
const VENOM_FINISHER_COMBO_POINTS = 3;
const VENOM_MAINTENANCE_FLOOR_SECONDS = 3;

/**
 * The energy Cold Blood waits for, which is about what comes AFTER it.
 *
 * Cold Blood is free and off the global cooldown, so the number is not its own
 * cost -- it is the cost of the Eviscerate directly beneath it. Firing the
 * guaranteed crit with nothing in the pool to spend it on would put it on the
 * Mutilate below instead, which is where the previous version of this list
 * deliberately aimed it and is not where the owner aims it now.
 */
const VENOM_COLD_BLOOD_ENERGY = 35;
/** "Cold Blood paired with a 4+ combo point Eviscerate" -- the owner's figure. */
const VENOM_COLD_BLOOD_COMBO_POINTS = 4;

export const ROGUE_VENOM: AplList = {
  name: 'Rogue (Assassination, Venom)',
  entries: [
  /*
   * ==========================================================================
   * THE MID-FIGHT CONSUMABLES OPEN THIS LIST, which is new and is the owner's
   * order -- everywhere else they sit below whatever opens it.
   *
   * AND THE THISTLE TEA GATE IS THIS LIST'S OWN, at ten rather than the shared
   * twenty. Five profiles drink Thistle Tea and the owner respecified one, so
   * the number is passed in rather than moved; see
   * `TIGHT_THISTLE_TEA_ENERGY_THRESHOLD`.
   * ==========================================================================
   */
  ...consumableCooldowns({
    thistleTeaEnergy: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
    exclude: ['major_frenzy_potion'],
  }),
  /*
   * MAJOR FRENZY POTION, ON THE OWNER'S CONDITION: "when Slice and Dice + Venom are both active". It replaces the shared
   * ungated entry, which `consumableCooldowns` is told to leave out.
   */
  { abilityId: 'major_frenzy_potion', condition: all(selfHas('slice_and_dice'), selfHas(VENOM_AURA_ID)) },

  /*
   * THE RACIAL COOLDOWNS AND THE HEALS, both of which narrow to NOTHING on the
   * preset that runs this list: a Venom Rogue is UNDEAD, which learns no active
   * racial, and its `other` slot is the Thistle Tea above rather than a
   * Healthstone. They are here so a hand-built character of another race gets
   * them, which is the same reason every list carries all four racials.
   *
   * SO THE OWNER'S SCREENSHOT SHOWS SEVEN ENTRIES AND THIS LIST DECLARES
   * TWELVE, and the two agree. Their position could not be read off the
   * picture, because nothing in either group is drawn for this build.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * AT ONE POINT, which is as early as a finisher can be cast.
   *
   * --------------------------------------------------------------------------
   * IT WAS THREE, AND THE SWEEP THAT CHOSE THREE COULD NOT HAVE SEPARATED ONE
   * FROM IT. Sixteen lists were measured across Slice and Dice at 2-5 against
   * Venom at 2-5, and the top twelve cells spanned 503.2 to 505.4 against
   * intervals of +/-4 to 5 -- "the thresholds are not a lever" was the
   * conclusion and it still is. ONE was never in that grid.
   *
   * THE REASONING SURVIVES THE OWNER'S CHANGE AND POINTS THE SAME WAY: what a
   * maintenance buff wants is UPTIME rather than duration, so the cheapest cast
   * that keeps it up is the right one. One point is that argument taken to its
   * end.
   * --------------------------------------------------------------------------
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(VENOM_SLICE_AND_DICE_POINTS)),
  },
  /*
   * VENOM NEXT, AND RUPTURE IS GONE FROM THIS LIST.
   *
   * ==========================================================================
   * THAT REVERSES A MEASURED DECISION OF OURS, AND THE OWNER IS WHO REVERSED
   * IT. Rupture was worth +16.7 here and was put in precisely because the
   * build's points were overflowing -- Seal Fate at 5/5 and a Mutilate that
   * crits twice gives about 28.5 points a fight, of which 7.21 were being
   * wasted at the cap. **The overflow is real and it has a different outlet
   * now**: Eviscerate comes back at three points below, where the old version
   * gated it at five and it fired 0.3 times a fight.
   *
   * SO THE POINTS STILL HAVE SOMEWHERE TO GO, which is the half of the old
   * argument that had to survive. What changed is which finisher they go to,
   * and that is the owner's call rather than a measurement's.
   * ==========================================================================
   */
  {
    abilityId: 'venom',
    condition: all(selfAuraDown(VENOM_AURA_ID), atLeastPoints(VENOM_BUFF_COMBO_POINTS)),
  },
  /*
   * COLD BLOOD, AND IT NOW AIMS AT THE EVISCERATE BELOW IT RATHER THAN AT A
   * MUTILATE.
   *
   * --------------------------------------------------------------------------
   * THE PREVIOUS VERSION FIRED IT AT **zero points and 60 energy** on the
   * stated reasoning that the next ability would be the builder -- "it costs
   * nothing a finisher wanted and lands on the builder that is about to go out
   * anyway". The owner's gate is the opposite in every term: three points, 35
   * energy, and both buffs comfortably up, which is EVISCERATE'S OWN GATE plus
   * the energy to pay for it.
   *
   * IT ONLY WORKS BECAUSE COLD BLOOD TAKES NO GLOBAL COOLDOWN. Being off the
   * GCD means one thing -- it does not START one -- so the Eviscerate beneath
   * it goes out in the same decision window and takes the guaranteed crit. An
   * entry above a finisher that DID cost a global would push that finisher a
   * cast later and aim the crit at whatever came next instead.
   * --------------------------------------------------------------------------
   */
  /*
   * COLD BLOOD PAIRED WITH A 4+ COMBO POINT EVISCERATE, by the owner, as one SEQUENCE so
   * nothing can be cast between the two -- Cold Blood is free and off the
   * global cooldown, and as two entries the list re-read from the top the
   * instant it went out.
   */
  {
    abilityId: 'cold_blood',
    sequence: ['eviscerate'],
    condition: all(
      atLeastPoints(VENOM_COLD_BLOOD_COMBO_POINTS),
      atLeastEnergy(VENOM_COLD_BLOOD_ENERGY),
      selfAuraAtLeast('slice_and_dice', VENOM_MAINTENANCE_FLOOR_SECONDS),
      selfAuraAtLeast(VENOM_AURA_ID, VENOM_MAINTENANCE_FLOOR_SECONDS),
    ),
  },
  /*
   * EVISCERATE IS BACK, AND THE REASON IT WAS REMOVED IS THE REASON IT RETURNS.
   *
   * ==========================================================================
   * IT WAS TAKEN OUT BECAUSE IT FIRED 0.0 TIMES. Its gate asked for Slice and
   * Dice above TEN seconds, Venom above TEN seconds AND exactly FIVE points --
   * three conditions at once, with Rupture taking the pool at four before the
   * third could ever be true. "An entry that cannot fire is the single most
   * common rotation bug in this project and the one that hides best" is what
   * the removal note said, and it was right.
   *
   * THE OWNER'S GATE IS THE SAME SHAPE WITH EVERY NUMBER LOOSENED: three
   * points rather than five, three seconds rather than ten, and Rupture gone
   * from above it. So the entry that could not fire is now the list's only
   * damage finisher -- which is what makes this a respecification rather than a
   * revert.
   * ==========================================================================
   */
  {
    abilityId: 'eviscerate',
    condition: all(
      atLeastPoints(VENOM_FINISHER_COMBO_POINTS),
      selfAuraAtLeast('slice_and_dice', VENOM_MAINTENANCE_FLOOR_SECONDS),
      selfAuraAtLeast(VENOM_AURA_ID, VENOM_MAINTENANCE_FLOOR_SECONDS),
    ),
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
 * What the Combat list spends on Eviscerate: the FULL five, the owner's figure.
 *
 * ----------------------------------------------------------------------------
 * IT WAS TWO AND IT WAS MEASURED, and this constant's own doc comment used to
 * say "measured rather than chosen ... the next reader does not take it for the
 * owner's figure". It is the owner's figure now, which is the opposite reading
 * of the same name -- so the comment is rewritten rather than left to be read
 * the wrong way round.
 *
 * THE SWEEP THAT CHOSE TWO IS QUOTED ON THE ENTRY, along with why a figure from
 * it is a price rather than a veto.
 * ----------------------------------------------------------------------------
 */
const EVISCERATE_COMBO_POINTS_COMBAT = MAX_COMBO_POINTS;

/**
 * COMBAT MUT -- Assassination 30 / Combat 21, Mutilate into Eviscerate.
 *
 * ============================================================================
 * A NEW PROFILE, AND THE OWNER'S FRAMING IS WHAT MAKES IT CHEAP: "this profile
 * copies everything from Venom except the APL and Talents which I'll provide."
 * So the preset is the Venom preset with two fields replaced, and this is one
 * of them.
 *
 * IT IS A VENOM ROGUE THAT SPENDS ON EVISCERATE RATHER THAN ON VENOM. Both
 * builds take Mutilate and Seal Fate -- so both gain about two points a cast
 * and four on a double crit -- and this one has no Venom entry at all, which
 * is what the twenty-one Combat points are for: Dual Wield Specialization,
 * Precision, Puncturing Wounds and Blade Flurry are all about what the two
 * daggers do rather than about a finisher.
 *
 * NO RUPTURE AND NO COLD BLOOD BELOW THE FINISHER, which is where it diverges
 * from both of its neighbours: Cold Blood sits ABOVE Eviscerate here, as it
 * does on Venom, but the gate is the owner's own pair -- four points and
 * twenty-five energy -- rather than Venom's four-term one.
 * ============================================================================
 */
const COMBAT_MUT_SLICE_AND_DICE_POINTS = 1;
const COMBAT_MUT_COLD_BLOOD_POINTS = 4;
const COMBAT_MUT_COLD_BLOOD_ENERGY = 25;
const COMBAT_MUT_EVISCERATE_POINTS = 3;

export const ROGUE_COMBAT_MUT: AplList = {
  name: 'Rogue (Assassination, Combat Mut)',
  entries: [
  /*
   * SLICE AND DICE OPENS THE LIST, which no other Rogue list does -- and at
   * ONE point, which three of the four now share. A maintenance buff wants
   * UPTIME rather than duration, so the cheapest cast that keeps it up is the
   * right one, and opening with it is that argument taken to the pull.
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(
      selfAuraDown('slice_and_dice'),
      atLeastPoints(COMBAT_MUT_SLICE_AND_DICE_POINTS),
    ),
  },
  /*
   * THISTLE TEA AT TEN, the third list to take that gate -- see
   * `TIGHT_THISTLE_TEA_ENERGY_THRESHOLD`. It sits above Blade Flurry and the
   * Frenzy Potion, which is the owner's order and costs nothing: all three are
   * free or off the global cooldown.
   */
  thistleTeaCooldown(TIGHT_THISTLE_TEA_ENERGY_THRESHOLD),
  { abilityId: 'blade_flurry' },
  ...consumableCooldowns({ exclude: ['thistle_tea', 'major_frenzy_potion'] }),
  /*
   * MAJOR FRENZY POTION, ON THE OWNER'S CONDITION: "when Slice and Dice is active". It replaces the shared
   * ungated entry, which `consumableCooldowns` is told to leave out.
   */
  { abilityId: 'major_frenzy_potion', condition: selfHas('slice_and_dice') },

  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * COLD BLOOD ABOVE THE FINISHER, AIMED AT IT.
   *
   * --------------------------------------------------------------------------
   * FOUR POINTS AND TWENTY-FIVE ENERGY, which is the Eviscerate beneath it
   * plus the energy to pay for it -- the same shape the Venom list uses and a
   * point looser on both terms. Cold Blood is free and takes NO GLOBAL
   * COOLDOWN, so the Eviscerate is the next thing out and takes the guaranteed
   * crit; a global between them would aim it at whatever the list reached
   * first.
   *
   * ITS GATE IS A POINT ABOVE EVISCERATE'S ON PURPOSE. Eviscerate spends at
   * three and Cold Blood waits for four, so the cheapest finisher does not
   * consume a three-minute cooldown -- which is the opposite of the failure a
   * matched pair would produce and is not something the order alone can do.
   * --------------------------------------------------------------------------
   */
  /*
   * COLD BLOOD PAIRED WITH A 4+ COMBO POINT EVISCERATE, by the owner, as one SEQUENCE so
   * nothing can be cast between the two -- Cold Blood is free and off the
   * global cooldown, and as two entries the list re-read from the top the
   * instant it went out.
   */
  {
    abilityId: 'cold_blood',
    sequence: ['eviscerate'],
    condition: all(
      atLeastPoints(COMBAT_MUT_COLD_BLOOD_POINTS),
      atLeastEnergy(COMBAT_MUT_COLD_BLOOD_ENERGY),
    ),
  },
  /*
   * EVISCERATE AT THREE, WITH NO FLOORS AT ALL -- which is the third different
   * answer the four Rogue lists give to the same question. Venom holds it
   * behind three seconds of two buffs, Rupture behind six seconds of two, and
   * Combat spends the full five ungated. Nothing here should be normalised
   * across them.
   */
  { abilityId: 'eviscerate', condition: atLeastPoints(COMBAT_MUT_EVISCERATE_POINTS) },
  { abilityId: 'mutilate' },
  ],
};

export const ROGUE_COMBAT: AplList = {
  name: 'Rogue (Combat)',
  entries: [
  /*
   * ==========================================================================
   * THISTLE TEA FIRST, ABOVE THE RACIALS -- and the rest of its own row BELOW
   * them, which is why the group is split rather than reordered.
   *
   * THAT IS WHAT THE OWNER'S PANEL SHOWS, and the shape of it says how it was
   * made: Thistle Tea moved from third to first and Blood Fury and the Frenzy
   * Potion stayed exactly where they were relative to each other. One entry
   * dragged to the top, nothing else touched.
   *
   * IT IS WORTH ABOUT NOTHING AND IS IMPLEMENTED ANYWAY. All three are free
   * and off the global cooldown, so the only thing a position decides among
   * them is which 100ms poll each takes -- and the two beneath it are on long
   * cooldowns, so neither is a floor under anything. The owner drew it; the
   * cost of being faithful here is one line.
   * ==========================================================================
   */
  thistleTeaCooldown(COMBAT_THISTLE_TEA_ENERGY_THRESHOLD),
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build that
   * is not of the race that learns them. The Combat preset is an ORC, so Blood
   * Fury is the one of the four it draws.
   */
  ...RACIAL_COOLDOWNS,
  ...consumableCooldowns({ exclude: ['thistle_tea', 'major_frenzy_potion'] }),
  /*
   * MAJOR FRENZY POTION, ON THE OWNER'S CONDITION: "when Slice and Dice is active + Adrenaline Rush is active". It sits
   * ABOVE the Adrenaline Rush entry and waits for the rush to be up. It replaces the shared
   * ungated entry, which `consumableCooldowns` is told to leave out.
   */
  { abilityId: 'major_frenzy_potion', condition: all(selfHas('slice_and_dice'), selfHas('adrenaline_rush')) },

  ...CONSUMABLE_HEALS,
  /*
   * THE TWO COOLDOWNS, ABOVE EVERYTHING THAT SPENDS ENERGY -- the owner's
   * order, and they moved up from sixth and seventh.
   *
   * --------------------------------------------------------------------------
   * NEITHER IS A FLOOR, which is what makes the position cheap: both are on
   * cooldowns far longer than a fight's decision cadence, so an ungated entry
   * here is refused on nearly every poll and the list walks straight past it.
   *
   * AND ADRENALINE RUSH WANTS TO BE EARLY FOR A REASON THE OTHERS DO NOT.
   * It multiplies energy REGENERATION for its window, so what it is worth
   * depends on how much of the window is spent at a pool that is not full --
   * which is the opposite of a flat buff and is why "cast it on cooldown" is
   * the whole rule rather than a compromise.
   * --------------------------------------------------------------------------
   */
  { abilityId: 'adrenaline_rush' },
  { abilityId: 'blade_flurry' },
  /*
   * THE OWNER'S "IF NOT ACTIVE" STAYS, AND A REFRESH WINDOW WAS MEASURED AND
   * REJECTED. Recorded here so it is not re-run.
   *
   * Slice and Dice sat at 86.7% uptime, which looks like something to fix: the
   * entry only fires once the buff is GONE, and rebuilding three points takes
   * a moment. A two-second refresh window was tried and measured 576.4 against
   * 577.7 -- inside the interval, and in the direction this project's own rule
   * predicts: a refresh RESETS the aura, so whatever is left is thrown away.
   *
   * IT DROPS TO SIXTH, BELOW THE TWO COOLDOWNS, which is the owner's order and
   * is where the gate makes it harmless: it needs three points AND the buff
   * down, so it cannot starve the Eviscerate beneath it on a full pool.
   */
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(3)),
  },
  /*
   * EVISCERATE AT FIVE POINTS, AND NO SLICE AND DICE FLOOR AT ALL.
   *
   * ==========================================================================
   * BOTH HALVES REVERSE A MEASURED DECISION, AND THE SWEEP THAT PRODUCED IT IS
   * WORTH QUOTING RATHER THAN DELETING. Sweeping the point gate over every
   * count gave 577.7, **588.5**, 587.2, 580.6, **572.2** for one through five
   * -- so TWO was the peak and FIVE was the worst cell in the sweep, 16.3
   * below it. The old entry also held a nine-second floor on Slice and Dice.
   *
   * THE SWEEP IS WHY THAT FIGURE IS NOT A REASON TO REFUSE. It was taken
   * before the benchmark gear, before the racials, and before Hack and Slash
   * started paying this build its off-hand dagger's 5% crit -- which is +32.5
   * on this profile alone. A sweep is true of the build it was run on.
   *
   * AND IT IS THE OWNER'S CALL EITHER WAY, which is the standing rule here:
   * their list outranks a measured decision of ours, and the measurement
   * becomes the PRICE of the choice rather than an argument against it. The
   * price is re-measured on this commit rather than quoted from the old sweep.
   * ==========================================================================
   */
  /*
   * COLD BLOOD PAIRED WITH A 5 COMBO POINT EVISCERATE, by the owner, as one SEQUENCE so
   * nothing can be cast between the two -- Cold Blood is free and off the
   * global cooldown, and as two entries the list re-read from the top the
   * instant it went out.
   */
  { abilityId: 'cold_blood', sequence: ['eviscerate'], condition: exactlyPoints(MAX_COMBO_POINTS) },
  { abilityId: 'eviscerate', condition: atLeastPoints(EVISCERATE_COMBO_POINTS_COMBAT) },
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
 * What the Rupture list spends on Rupture. FOUR, and now twice over: it was a
 * measured result and it is also the owner's figure in their respecification,
 * which is the rare case of the two agreeing. The sweep, and why four beats
 * five on a bleed whose damage per point falls, are on the entry itself.
 */
const RUPTURE_COMBO_POINTS = 4;

/**
 * What the Rupture list spends and waits for. All four are the owner's.
 *
 * ----------------------------------------------------------------------------
 * EVISCERATE DROPS TO FOUR AND GAINS TWO FLOORS, where it was `exactly 5` and
 * had none. The floors are the same shape the Venom list uses -- spend on
 * damage only while the things that must stay up have plenty of time left --
 * and they are SIX seconds here against Venom's three, which is the longer
 * window a bleed deserves: Rupture is the build's name and re-applying it late
 * costs ticks rather than a buff's uptime.
 *
 * AND SLICE AND DICE DROPS TO ONE, which is the same move the Venom list made
 * and rests on the same argument: a maintenance buff wants UPTIME, so the
 * cheapest cast that keeps it up is the right one.
 * ----------------------------------------------------------------------------
 */
const RUPTURE_SLICE_AND_DICE_POINTS = 1;
const RUPTURE_EVISCERATE_POINTS = 4;
const RUPTURE_FLOOR_SECONDS = 6;

export const ROGUE_RUPTURE: AplList = {
  name: 'Rogue (Subtlety, Rupture)',
  entries: [
  /*
   * PREMEDITATION OPENS THE LIST, and it is off the global cooldown now on the
   * owner's ruling -- which is what makes opening with it free. It banks two
   * points for whatever goes out next, so a global spent here would be a
   * global the thing it was banked FOR does not get.
   */
  /*
   * NO STANDALONE PREMEDITATION ANY MORE. It sat first and fired at the pull,
   * while the opening stealth was up -- so Premeditation was on its two-minute
   * cooldown every time Vanish came round, and the owner's Vanish sequence
   * (which checks every step's cooldown before it starts) was refused. The
   * owner took it off the opener and paired it with Vanish; this is the list
   * half of the same decision.
   */
  /*
   * THISTLE TEA AT TEN, the same gate the Venom list uses and the second time
   * the owner has given that number. See `TIGHT_THISTLE_TEA_ENERGY_THRESHOLD`.
   */
  thistleTeaCooldown(TIGHT_THISTLE_TEA_ENERGY_THRESHOLD),
  ...consumableCooldowns({ exclude: ['thistle_tea'] }),
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * ==========================================================================
   * AMBUSH, AND VANISH DIRECTLY BENEATH IT RATHER THAN ABOVE IT.
   *
   * A PRIORITY LIST CANNOT HOLD A SEQUENCE AND DOES NOT NEED TO. The owner's
   * design is Vanish into Ambush, and what makes that happen is that the list
   * is re-read from the top every decision: Vanish puts stealth up, and on the
   * next read Ambush is the higher entry and takes it. Ambush ABOVE Vanish is
   * the sequence expressed as priorities rather than as steps.
   *
   * AMBUSH NEEDS NO CONDITION. Its own `canCast` asks for the stealth, and a
   * gate here would be the list restating half of a rule the ability already
   * owns -- which is harmless until the owner adds a second route to it, as
   * they did when Cutthroat became Ambush's stealth requirement.
   * ==========================================================================
   */
  { abilityId: 'ambush' },
  /*
   * VANISH, AND IT IS OFF THE GLOBAL COOLDOWN NOW on the owner's ruling. That
   * matters more here than a free cast usually does: the Ambush it exists to
   * enable is the entry directly above, so a global between them would push
   * the Ambush a cast later and spend the window on something else.
   *
   * THE CUTTHROAT CLAUSE IS WHY IT IS NOT CAST INTO A WINDOW THAT IS ALREADY
   * OPEN -- Cutthroat's proc IS Ambush's stealth requirement, by the owner's
   * ruling, so Vanishing while it is up buys nothing and spends a five minute
   * cooldown.
   */
  /*
   * VANISH, THEN PREMEDITATION, THEN AMBUSH, as one SEQUENCE by the owner. It
   * used to emerge from three entries, and an auto-attack could land in the
   * gap and take the stealth window -- the engine now forgives a later step's
   * own gate when checking a sequence, because Vanish is what opens it.
   */
  {
    abilityId: 'vanish',
    sequence: ['premeditation', 'ambush'],
    condition: all(atMostPoints(3), atLeastEnergy(AMBUSH_ENERGY_COST), not(selfActive('cutthroat'))),
  },
  {
    abilityId: 'slice_and_dice',
    condition: all(
      selfAuraDown('slice_and_dice'),
      atLeastPoints(RUPTURE_SLICE_AND_DICE_POINTS),
    ),
  },
  /*
   * ==========================================================================
   * HEMORRHAGE MOVES ABOVE RUPTURE, AND RUPTURE NOW REQUIRES IT.
   *
   * The two changes are one change: Hemorrhage is a DEBUFF the list wants on
   * the target before it commits four points to a bleed, so it goes above the
   * thing that waits for it and the thing that waits for it says so.
   *
   * WITHOUT THE REQUIREMENT THE ORDER ALONE WOULD NOT DO IT. Hemorrhage is
   * gated on its own debuff running out, so it yields as soon as the debuff is
   * up -- and Rupture directly beneath it would then fire on a target that had
   * never had it, exactly once, at the pull. The clause is what makes the
   * order mean anything.
   * ==========================================================================
   */
  {
    abilityId: 'hemorrhage',
    condition: all(targetAuraAtMost('hemorrhage', 1), not(poolingForAmbush)),
  },
  {
    abilityId: 'rupture',
    condition: all(
      targetAuraDown('rupture'),
      atLeastPoints(RUPTURE_COMBO_POINTS),
      targetHas('hemorrhage'),
    ),
  },
  /*
   * EVISCERATE AT FOUR, BEHIND SIX SECONDS OF EACH OF THE TWO THINGS THAT MUST
   * STAY UP. It was `exactly 5` with no floors at all.
   *
   * THE FLOOR ON RUPTURE IS THE ONE THAT IS NEW IN KIND: every other floor in
   * these lists is on a buff the character carries, and this is on the BLEED.
   * Spending four points on a direct hit while the bleed is about to fall off
   * is how a Subtlety Rogue loses the thing it is built around.
   */
  {
    abilityId: 'eviscerate',
    condition: all(
      atLeastPoints(RUPTURE_EVISCERATE_POINTS),
      targetAuraAtLeast('rupture', RUPTURE_FLOOR_SECONDS),
      selfAuraAtLeast('slice_and_dice', RUPTURE_FLOOR_SECONDS),
    ),
  },
  /*
   * PREPARATION, WHICH IS WHAT MAKES VANISH ROTATIONAL. It finishes the
   * cooldown on every other Rogue ability, so one Vanish and one Preparation
   * is two Vanishes -- and the gate waits until both of the things worth
   * resetting are actually spent.
   *
   * THE FOURTH SEQUENCE THE OWNER DESCRIBED NEEDS NO ENTRY: once Preparation
   * has finished their cooldowns, the same three entries above are castable
   * again and the list simply walks them. Said here because an absent entry
   * for a clause the owner named reads exactly like an omission.
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
   * BACKSTAB LAST, AND THE POOLING GATE IS WHY AMBUSH CAN EVER BE CAST.
   *
   * AN UNGATED CHEAPER ENTRY STARVES AN EXPENSIVE ONE FROM BENEATH, however
   * high the expensive one sits: both cost 60 energy, so without this the pool
   * would never hold enough for the Ambush seven entries above. Measured over
   * 300 fights before the gate existed: 207 Cutthroat windows, 30 ending in an
   * Ambush, with mean energy at the moment a window OPENED of 0.2.
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
/**
 * What the Hemo Dagger list spends and waits for. All four are the owner's.
 *
 * ----------------------------------------------------------------------------
 * EVERY ONE OF THEM DIFFERS FROM THE RUPTURE LIST'S, which is why this list is
 * no longer derived from it -- see the list itself.
 *
 *   Rupture at THREE points, where the Rupture list spends four.
 *   Both finishers at EXACTLY FIVE, where that list takes four or more.
 *   The floors at FOUR seconds, where that list waits six.
 *
 * SO THE TWO BUILDS WANT OPPOSITE THINGS FROM THE SAME POOL. The Rupture list
 * has Backstab, so points are cheap and a bleed can afford to wait; this one
 * has Hemorrhage as its only builder and a much lower point income, so the
 * bleed goes out earlier and the direct finishers wait for the full five.
 * ----------------------------------------------------------------------------
 */
const HEMO_RUPTURE_POINTS = 3;
const HEMO_SLICE_AND_DICE_POINTS = 1;
const HEMO_FLOOR_SECONDS = 4;

export const ROGUE_HEMO: AplList = {
  name: 'Rogue (Subtlety, Hemo Dagger)',
  entries: [
  /*
   * ==========================================================================
   * IT IS A LIST OF ITS OWN NOW, AND IT WAS `ROGUE_RUPTURE.entries.filter(...)`.
   *
   * THE DERIVATION WAS RIGHT WHILE THE TWO LISTS AGREED ON EVERY NUMBER. It is
   * what this file argues for everywhere else -- a hand-written copy of eleven
   * entries drifts from its original silently, and the copy is the one nobody
   * re-reads -- and it is why the Hemo profile moved +10.4 last round on
   * nobody's instruction, inheriting four Rupture changes it had never been
   * given.
   *
   * THE OWNER HAS NOW GIVEN IT ITS OWN NUMBERS, and they differ from the
   * Rupture list's in every one of the four places the two lists overlap. A
   * derivation that has to override four of eleven entries is not a derivation
   * any more; it is a copy with extra steps, and the overrides are where the
   * two would drift.
   *
   * SO THE FLAG FROM LAST ROUND IS CLOSED BY THE OWNER RATHER THAN BY US: the
   * profile that was moving without a spec has a spec.
   * ==========================================================================
   */
  /*
   * NO STANDALONE PREMEDITATION ANY MORE. It sat first and fired at the pull,
   * while the opening stealth was up -- so Premeditation was on its two-minute
   * cooldown every time Vanish came round, and the owner's Vanish sequence
   * (which checks every step's cooldown before it starts) was refused. The
   * owner took it off the opener and paired it with Vanish; this is the list
   * half of the same decision.
   */
  thistleTeaCooldown(TIGHT_THISTLE_TEA_ENERGY_THRESHOLD),
  ...consumableCooldowns({ exclude: ['thistle_tea'] }),
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * AMBUSH ABOVE VANISH, which is the sequence expressed as priorities: Vanish
   * puts the stealth up and the next read of the list finds Ambush higher and
   * takes it. A priority list cannot hold a sequence and does not need to.
   */
  { abilityId: 'ambush' },
  /*
   * VANISH, THEN PREMEDITATION, THEN AMBUSH, as one SEQUENCE by the owner. It
   * used to emerge from three entries, and an auto-attack could land in the
   * gap and take the stealth window -- the engine now forgives a later step's
   * own gate when checking a sequence, because Vanish is what opens it.
   */
  {
    abilityId: 'vanish',
    sequence: ['premeditation', 'ambush'],
    condition: all(atMostPoints(3), atLeastEnergy(AMBUSH_ENERGY_COST), not(selfActive('cutthroat'))),
  },
  {
    abilityId: 'slice_and_dice',
    condition: all(selfAuraDown('slice_and_dice'), atLeastPoints(HEMO_SLICE_AND_DICE_POINTS)),
  },
  /*
   * RUPTURE AT THREE, AND WITH NO HEMORRHAGE CLAUSE -- both of which separate
   * it from the Rupture list, where it waits for four points AND for the
   * debuff.
   *
   * THE DEBUFF CLAUSE WOULD BE REDUNDANT HERE AND IS CORRECTLY ABSENT.
   * Hemorrhage is this list's UNGATED FILLER at the bottom rather than a
   * maintained debuff above the bleed, so it is on the target almost all the
   * time and a clause asking for it would be a condition that is nearly always
   * true -- which is a floor wearing a gate's clothes.
   */
  {
    abilityId: 'rupture',
    condition: all(targetAuraDown('rupture'), atLeastPoints(HEMO_RUPTURE_POINTS)),
  },
  /*
   * COLD BLOOD AND EVISCERATE SHARE A GATE, EXACTLY, AND THAT IS THE DESIGN.
   *
   * --------------------------------------------------------------------------
   * BOTH ASK FOR FIVE POINTS AND FOUR SECONDS OF EACH OF THE TWO THINGS THAT
   * MUST STAY UP, so Cold Blood fires in the same decision window as the
   * Eviscerate beneath it and the guaranteed crit lands on it. Cold Blood is
   * free and takes NO GLOBAL COOLDOWN, which is what makes a matched pair work
   * at all -- a global between them would aim the crit at whatever came next.
   *
   * IT IS THE OPPOSITE ARRANGEMENT TO COMBAT MUT, where the owner put Cold
   * Blood's gate a point ABOVE the finisher's so the cheapest Eviscerate does
   * not consume a three-minute cooldown. Here the finisher only ever spends at
   * the cap, so there is no cheaper cast for the cooldown to be wasted on and
   * the two gates can be identical. **Nothing here should be normalised across
   * the five Rogue lists**; this is the fourth different answer they give.
   *
   * COLD BLOOD IS A NEW TALENT ON THIS BUILD, paid for out of Improved Slice
   * and Dice. The list and the allocation are one change.
   * --------------------------------------------------------------------------
   */
  /*
   * COLD BLOOD PAIRED WITH A 5 COMBO POINT EVISCERATE, by the owner, as one SEQUENCE so
   * nothing can be cast between the two -- Cold Blood is free and off the
   * global cooldown, and as two entries the list re-read from the top the
   * instant it went out.
   */
  {
    abilityId: 'cold_blood',
    sequence: ['eviscerate'],
    condition: all(
      exactlyPoints(MAX_COMBO_POINTS),
      targetAuraAtLeast('rupture', HEMO_FLOOR_SECONDS),
      selfAuraAtLeast('slice_and_dice', HEMO_FLOOR_SECONDS),
    ),
  },
  {
    abilityId: 'eviscerate',
    condition: all(
      exactlyPoints(MAX_COMBO_POINTS),
      targetAuraAtLeast('rupture', HEMO_FLOOR_SECONDS),
      selfAuraAtLeast('slice_and_dice', HEMO_FLOOR_SECONDS),
    ),
  },
  {
    abilityId: 'preparation',
    condition: all(
      abilityOnCooldown('vanish'),
      abilityOnCooldown('premeditation'),
      atMostPoints(1),
    ),
  },
  /*
   * HEMORRHAGE LAST AND UNGATED, which is worth +108.9 on this build and is
   * the one entry that survived the respecification untouched.
   *
   * REMOVING BACKSTAB REMOVED THE LIST'S ONLY UNGATED BUILDER. Nothing above it
   * is castable on demand -- Premeditation and Vanish are on minute cooldowns,
   * Ambush needs a stealth window, and the finishers need points this list
   * would then have no way to earn. With Hemorrhage gated on its own debuff the
   * profile wasted 272.7 energy a fight at the cap, a THIRD of its income.
   *
   * SO IT MAINTAINS AND BUILDS, and the gate's own justification went with
   * Backstab rather than being a second opinion about the owner's list.
   */
  { abilityId: 'hemorrhage' },
  ],
};

/**
 * What the Pure Hemo list spends and waits for. All of it is the owner's.
 *
 * ----------------------------------------------------------------------------
 * THE SLICE AND DICE FLOOR IS ONE SECOND, which is the loosest in the project
 * and reads almost like no floor at all. It is not: the entry it guards spends
 * the FULL FIVE points, so what one second buys is that a five-point Eviscerate
 * never lands in the instant the buff is expiring -- the cheapest possible
 * version of the protection the other four lists pay three, four or six
 * seconds for.
 * ----------------------------------------------------------------------------
 */
const PURE_HEMO_RUPTURE_POINTS = 3;
const PURE_HEMO_SLICE_AND_DICE_POINTS = 3;
const PURE_HEMO_FLOOR_SECONDS = 1;

export const ROGUE_PURE_HEMO: AplList = {
  name: 'Rogue (Subtlety, Pure Hemo)',
  entries: [
  /*
   * NO STANDALONE PREMEDITATION ANY MORE. It sat first and fired at the pull,
   * while the opening stealth was up -- so Premeditation was on its two-minute
   * cooldown every time Vanish came round, and the owner's Vanish sequence
   * (which checks every step's cooldown before it starts) was refused. The
   * owner took it off the opener and paired it with Vanish; this is the list
   * half of the same decision.
   */
  thistleTeaCooldown(TIGHT_THISTLE_TEA_ENERGY_THRESHOLD),
  ...consumableCooldowns({ exclude: ['thistle_tea'] }),
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * VANISH, THEN PREMEDITATION, THEN GARROTE, as one sequence, "when Garrote
   * fades" -- the owner's design for this build, with Garrote declared for it.
   */
  {
    abilityId: 'vanish',
    sequence: ['premeditation', 'garrote'],
    condition: all(targetAuraDown('garrote'), atLeastEnergy(GARROTE_ENERGY_COST)),
  },
  /*
   * ==========================================================================
   * RUPTURE BEHIND SIX CLAUSES, WHICH IS THE MOST CONDITIONED ENTRY IN THE
   * PROJECT -- AND ALL SIX SAY ONE THING: do not spend points on the bleed
   * while any of the burst is available.
   *
   * The three cooldown clauses and the aura clause are the same question asked
   * four ways: Preparation, Cold Blood and Premeditation all have to be SPENT,
   * and the Cold Blood buff has to be gone. Only then are the points free for
   * a bleed.
   *
   * WHY THAT IS NOT REDUNDANT. Premeditation banks two points and Preparation
   * gives Cold Blood and Premeditation back, so a pool that looks spendable can
   * be about to be needed -- and the finisher the points are being saved FOR is
   * five entries below, where nothing can hold them for it. A priority list
   * cannot reserve a resource; this is how a build asks it to anyway.
   *
   * IT IS ALSO THE SHAPE THAT MOST EASILY NEVER FIRES, which is why the
   * profile test counts its casts rather than trusting the gate.
   * ==========================================================================
   */
  {
    abilityId: 'rupture',
    condition: all(
      targetAuraDown('rupture'),
      atLeastPoints(PURE_HEMO_RUPTURE_POINTS),
      abilityOnCooldown('preparation'),
      abilityOnCooldown('cold_blood'),
      // VANISH, not Premeditation, since round 37: Premeditation is only ever a
      // step of the Vanish sequence now, so it sat off cooldown most of the
      // fight and this entry fired 0.0 times.
      abilityOnCooldown('vanish'),
      selfAuraDown('cold_blood'),
    ),
  },
  {
    abilityId: 'slice_and_dice',
    condition: all(
      selfAuraDown('slice_and_dice'),
      atLeastPoints(PURE_HEMO_SLICE_AND_DICE_POINTS),
    ),
  },
  /*
   * COLD BLOOD AND EVISCERATE SHARE A GATE EXACTLY, the Hemo Dagger
   * arrangement: the free off-GCD cooldown fires in the same window as the
   * finisher it is saved for, so the guaranteed crit lands on a five-point
   * Eviscerate. There is no cheaper finisher here for it to be wasted on.
   */
  /*
   * COLD BLOOD PAIRED WITH A 5 COMBO POINT EVISCERATE, by the owner, as one SEQUENCE so
   * nothing can be cast between the two -- Cold Blood is free and off the
   * global cooldown, and as two entries the list re-read from the top the
   * instant it went out.
   */
  {
    abilityId: 'cold_blood',
    sequence: ['eviscerate'],
    condition: all(
      exactlyPoints(MAX_COMBO_POINTS),
      selfAuraAtLeast('slice_and_dice', PURE_HEMO_FLOOR_SECONDS),
    ),
  },
  {
    abilityId: 'eviscerate',
    condition: all(
      exactlyPoints(MAX_COMBO_POINTS),
      selfAuraAtLeast('slice_and_dice', PURE_HEMO_FLOOR_SECONDS),
    ),
  },
  /*
   * PREPARATION WAITS ON VANISH AND COLD BLOOD, like every other list that casts
   * it, since round 37 gave this list a Vanish -- Garrote sequence. It waited on
   * Premeditation while the list had no Vanish. "Finishes the cooldown on your other Rogue abilities" is
   * worth what the abilities it gives back are worth, and here those are the
   * two that feed the five-point Eviscerate.
   */
  {
    abilityId: 'preparation',
    condition: all(abilityOnCooldown('vanish'), abilityOnCooldown('cold_blood')),
  },
  { abilityId: 'hemorrhage', condition: not(poolingForGarrote) },
  ],
};

export const ROGUE_VENOM_ROTATION: Rotation = compileRotation(ROGUE_VENOM);
export const ROGUE_COMBAT_ROTATION: Rotation = compileRotation(ROGUE_COMBAT);
export const ROGUE_RUPTURE_ROTATION: Rotation = compileRotation(ROGUE_RUPTURE);
export const ROGUE_HEMO_ROTATION: Rotation = compileRotation(ROGUE_HEMO);
export const ROGUE_PURE_HEMO_ROTATION: Rotation = compileRotation(ROGUE_PURE_HEMO);
export const ROGUE_COMBAT_MUT_ROTATION: Rotation = compileRotation(ROGUE_COMBAT_MUT);

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
export function rogueRotation(
  talents: Readonly<Record<string, number>>,
  /** What is in the MAIN HAND, for the two Hemorrhage builds. See below. */
  mainHandWeapon?: WeaponType,
): Rotation {
  /*
   * ==========================================================================
   * TWO MUTILATE BUILDS NOW, AND THE VENOM CAPSTONE SEPARATES THEM.
   *
   * `mutilate > 0` alone sent BOTH to the Venom list, which is the failure
   * this project has already shipped twice: a Fire Mage ran the Arcane list
   * and a Shockadin ran a list built around a talent it does not take, and
   * both produced perfectly ordinary DPS figures. A list that names an ability
   * the build cannot cast is skipped IN SILENCE.
   *
   * THE DISCRIMINATOR IS FUNCTIONAL RATHER THAN AN ARBITRARY TIEBREAK, which
   * is the rule the Cutthroat clause below already follows: the Venom list is
   * built around the Venom finisher, so a Mutilate build WITHOUT the talent
   * cannot run it at all -- its second entry would be dead. Combat Mut takes
   * Mutilate and Seal Fate and spends on Eviscerate instead.
   * ==========================================================================
   */
  if ((talents.mutilate ?? 0) > 0) {
    return (talents.venom ?? 0) > 0 ? ROGUE_VENOM_ROTATION : ROGUE_COMBAT_MUT_ROTATION;
  }
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
    if ((talents.cutthroat ?? 0) > 0) return ROGUE_RUPTURE_ROTATION;
    /*
     * ========================================================================
     * AND THE TWO HEMORRHAGE BUILDS BY THE WEAPON IN THE MAIN HAND, which is
     * the first time anything in this project has dispatched on one.
     *
     * IT IS THE FUNCTIONAL DISCRIMINATOR AND NOT A PROXY. The Hemo Dagger list
     * casts AMBUSH, and Ambush requires a dagger in the main hand -- so a
     * sword-wielding Hemorrhage build cannot run that list, and two of its
     * eleven entries (Ambush and the Vanish that exists to enable it) would be
     * dead. Pure Hemo has neither, and holds the Combat template's sword.
     *
     * A TALENT WOULD HAVE BEEN A PROXY HERE. The two builds differ in eight
     * talents and not one of them gates a list entry: Quietus and Thousand
     * Cuts are damage, Precision and Vigor are stats. Reading one would work
     * today and say nothing about which list can FUNCTION, which is the
     * standard the Cutthroat clause above sets.
     *
     * AN UNKNOWN WEAPON KEEPS THE DAGGER LIST, which is the existing answer
     * for every caller that does not supply one -- a hand-built Rogue with no
     * equipment behaves exactly as it did.
     * ========================================================================
     */
    return mainHandWeapon === 'sword' ? ROGUE_PURE_HEMO_ROTATION : ROGUE_HEMO_ROTATION;
  }
  return ROGUE_COMBAT_ROTATION;
}

/** Longest Rupture, for anything reasoning about the refresh window. */
export const RUPTURE_MAX_DURATION_MS =
  RUPTURE_BY_COMBO_POINT[RUPTURE_BY_COMBO_POINT.length - 1].durationMs;
