import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import {
  buffPotionCooldown,
  consumableCooldowns,
  CONSUMABLE_COOLDOWNS,
  CONSUMABLE_HEALS,
} from './consumableCooldowns';
import {
  all,
  compileRotation,
  fightRemaining,
  fightRemainingFraction,
  resourceFraction,
  selfHas,
  targetExpired,
  targetMissing,
  targetTime,
} from './apl';
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

/*
 * ============================================================================
 * THE SHARED TWO-SECOND REFRESH WINDOW IS GONE, AND ITS LAST CALLER WENT WITH
 * THE OWNER'S FIRELOCK LIST.
 *
 * It was `targetTime('below', 2, auraId)` -- a STRICT `<`, because that is
 * what the original closure wrote and `below` differs from `atMost` at
 * exactly the boundary, which is a value a tick can land on.
 *
 * BOTH LISTS ARE THE OWNER'S NOW and neither wants it: the Affliction list
 * asks "if not active" and the Firelock list carries its own, TIGHTER window
 * of 1.5 seconds on Immolate alone. So the constant is removed rather than
 * left for a caller that no longer exists -- and the reading it stood for is
 * kept where it is now used, beside `IMMOLATE_REFRESH_SECONDS`.
 *
 * WHAT THE WINDOW COSTS IS STILL THE THING TO KNOW. A refresh RESETS the
 * aura, so whatever is left on the clock is thrown away, and the faster the
 * character acts the sooner it reaches the entry inside the window and the
 * more it clips. Measured on the Moonkin, where Nature's Grace cost 14.9 DPS
 * doing nothing but speeding it up.
 * ============================================================================
 */

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
const expired = targetExpired;

/** "<debuff> is not up" on the target -- `auras.has`, not the clock. */
const targetLacks = targetMissing;

/** "<debuff> has at most N seconds left" on the target. */
const targetAuraAtMost = (auraId: string, secondsLeft: number) =>
  targetTime('atMost', secondsLeft, auraId);

/**
 * What the Firelock's two damage-over-time entries wait for, both the owner's.
 *
 * ============================================================================
 * A ONE-AND-A-HALF SECOND REFRESH WINDOW ON IMMOLATE, which is this file's
 * `REFRESH_WINDOW_MS` tightened by half a second -- and it is a WINDOW rather
 * than the "if not active" the owner's other lists use, which is worth saying
 * because this file already records what a window costs: a refresh RESETS the
 * aura, so whatever is left is thrown away, and the faster the character acts
 * the sooner it reaches the entry inside the window.
 *
 * AND A FIGHT FLOOR UNDER EACH, which is new here and is the half that derives
 * cleanly. A damage-over-time effect applied with less fight left than its own
 * duration is mana and a global cooldown spent on ticks nobody collects:
 *
 *     Immolate       15s burn, floor  3s  -- a fifth of it, loose
 *     Bane of Agony  24s burn, floor 25s  -- ONE SECOND MORE THAN ITS OWN
 *                                            DURATION, so it goes out only if
 *                                            it can run in full
 *
 * SO BANE OF AGONY'S FLOOR IS NOT A JUDGEMENT AT ALL -- 25 is
 * `BANE_OF_AGONY_DURATION_MS` plus one, and a reader can check it against the
 * constant. Immolate's 3 is a choice, and it is the owner's.
 * ============================================================================
 */
const IMMOLATE_REFRESH_SECONDS = 1.5;
const IMMOLATE_FIGHT_FLOOR_SECONDS = 3;
const BANE_OF_AGONY_FIGHT_FLOOR_SECONDS = 25;
/** Corruption's 18 seconds plus one, the same rule as Bane of Agony's floor. */
const CORRUPTION_FIGHT_FLOOR_SECONDS = 19;

/** "this aura is on the actor", for a proc the next action should spend. */
const actorHas = selfHas;

/** "current mana is below N% of maximum". */
const manaBelowFraction = (fraction: number) => resourceFraction('below', fraction, 'mana');

/**
 * The mana a Firelock Life Taps at. A MEASURED PEAK; see the entry.
 *
 * Named and exported so the test that pins it reads the same number the list
 * does, and so the one figure in this file that was arrived at by a sweep says
 * so where it is declared rather than only where it is used.
 */
export const FIRELOCK_LIFE_TAP_MANA = 0.05;

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
export const WARLOCK_AFFLICTION: AplList = {
  name: 'Warlock (SM/DS)',
  entries: [
  /*
   * THE THREE DOTS FIRST, IN THE OWNER'S ORDER, and the Shadow Trance-gated
   * Shadow Bolt that used to head this list is gone. That entry existed to
   * spend a proc the moment it landed; the owner's order holds the bleeds up
   * first and lets the filler at the bottom take the proc when it comes.
   */
  /*
   * AMPLIFY CURSE FIRST, AND IT COSTS THE LIST NOTHING. "A cooldown that needs
   * to be cast before applying the first Bane of Agony of the fight. It does
   * not trigger a global cooldown" -- the owner's words, and both halves are
   * load-bearing: off the global cooldown means the Bane below it lands in the
   * same instant, and a three-minute cooldown in a sixty-second fight means it
   * fires exactly once without needing a condition to say so.
   *
   * UNGATED ON PURPOSE. An entry that is ungated and always castable is a floor
   * under everything below it -- but this one has a COOLDOWN, which is the half
   * of that rule that is easy to forget, so the list falls straight past it for
   * the rest of the fight.
   */
  { abilityId: 'amplify_curse' },
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
   * SHADOW TRANCE SPENT THE MOMENT IT LANDS. "Ensure that if a corruption tick
   * or wrack tick triggers Nightfall, the next action is to cast an instant
   * Shadow Bolt and consume the nightfall proc" -- the owner's instruction, and
   * it puts back an entry that an earlier version of this list had and the
   * owner's first ordering removed.
   *
   * ABOVE THE BLEEDS, which is what "the NEXT action" requires. Below them, a
   * proc landing while two bleeds were due would wait two global cooldowns and
   * could expire -- Shadow Trance lasts ten seconds and the bleeds cost 1.5
   * each, so it would usually survive, which is exactly the kind of "usually"
   * that hides a dropped proc.
   *
   * THE DUPLICATE ID IS LEGAL AND IS THE DOCUMENTED SHAPE: gated on a proc
   * above, ungated as the filler below. What is NOT legal is a copy below an
   * unconditional one, which could never be reached.
   */
  { abilityId: 'shadow_bolt', condition: actorHas('shadow_trance'), interruptsChannel: true },
  { abilityId: 'bane_of_agony', condition: expired('bane_of_agony'), interruptsChannel: true },
  { abilityId: 'corruption', condition: expired('corruption'), interruptsChannel: true },
  { abilityId: 'siphon_life', condition: expired('siphon_life') },
  /*
   * LIFE TAP ON A MANA THRESHOLD rather than ungated. It was unconditional and
   * fired five times a fight, each one a global cooldown that dealt nothing --
   * at 15% it fires only when the bar actually needs it.
   */
  { abilityId: 'life_tap', condition: manaBelowFraction(0.15) },
  /*
   * WRACK, BETWEEN LIFE TAP AND SHADOW BOLT, GATED ON ALL THREE BLEEDS HAVING
   * SIX SECONDS LEFT. The ruleset owner's own position and own condition, which
   * this comment carried for the whole time the entry was absent.
   *
   * --------------------------------------------------------------------------
   * IT WAS PAUSED AND IS BACK, and the two reasons it was paused have both
   * expired. The comment here said "a flat 216 over a six-second channel, with
   * no coefficient because the sheet has no Wrack row, and its +10% to other
   * Shadow damage-over-time effects unmodelled" -- and the owner has since
   * supplied the coefficient directly at 14.3% of spell power a tick, and the
   * amplification is applied through `periodicDamageTakenBySchool`. Neither
   * half is missing now.
   *
   * THE SIX-SECOND GATE IS WHAT MAKES IT CASTABLE AT ALL rather than a
   * throughput loss. See `allLastingAtLeast`: the channel locks the caster, so
   * the entry only fires when it can afford to stop acting.
   * --------------------------------------------------------------------------
   */
  /*
   * WRACK, UNGATED, AND IT IS THE INTERRUPT RULE THAT MAKES THAT SAFE.
   *
   * --------------------------------------------------------------------------
   * THE SIX-SECOND GATE IS GONE, at the ruleset owner's instruction, and the
   * interrupt rule replaces it rather than merely removing it. The gate asked
   * "can I afford to stop acting for six seconds" and answered conservatively,
   * because a channel used to be a commitment; now it is not. Three things cut
   * it short -- a Shadow Bolt because Nightfall procced, a Corruption because
   * Corruption fell off, a Bane of Agony because the Bane fell off -- and each
   * of those entries says `interruptsChannel` above.
   *
   * SIPHON LIFE AND LIFE TAP SIT ABOVE IT AND DO NOT INTERRUPT IT, which is why
   * the flag is per ENTRY rather than "anything above the channel". Siphon Life
   * lasts thirty seconds and loses little by waiting out a channel; Life Tap is
   * not urgent by construction.
   *
   * UNGATED AND WITHOUT A COOLDOWN MAKES IT A FLOOR under everything below it,
   * which here is the filler Shadow Bolt -- and that entry does now fire zero
   * times. It is kept because it is the owner's and because the proc-gated copy
   * above is what casts Shadow Bolt; see the note on the filler below.
   * --------------------------------------------------------------------------
   */
  { abilityId: 'wrack' },
  /*
   * THE FILLER, AND IT NOW FIRES ZERO TIMES. Wrack above it is ungated and has
   * no cooldown, so nothing below it is ever the first castable entry -- the
   * documented shape of an unconditional entry being a floor.
   *
   * KEPT RATHER THAN DELETED, for two reasons. It is the owner's entry, and the
   * owner's list outranks a measured decision of ours. And it costs nothing: an
   * entry the walk never reaches spends no global cooldown, which the Life Tap
   * entry above it has already demonstrated at 441.6 against 441.5.
   *
   * SHADOW BOLT IS STILL CAST -- 7.3 times a fight -- by the proc-gated copy at
   * the top of this list. The id appearing twice is the documented legal shape,
   * and this is the half that is now redundant rather than the half that works.
   */
  { abilityId: 'shadow_bolt' },
  ],
};

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
export const WARLOCK_DESTRUCTION: AplList = {
  name: 'Warlock (Firelock)',
  entries: [
  /*
   * THE SPELLBLASTING POTION OPENS THE LIST, the owner's order and the third
   * list to take it -- the Elemental Shaman and the Moonkin are the others. A
   * free off-GCD cast pushes the next decision one 100ms poll out, which is
   * what destroyed Charge at the top of a Warrior list; nothing here has a
   * one-instant window for that poll to miss.
   */
  buffPotionCooldown('major_spellblasting_potion'),
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build that
   * is not of the race that learns them -- which is this one. Firelock is
   * UNDEAD and Touch of the Grave is a passive proc rather than an entry, so
   * no racial row appears on the owner's panel at all and their position here
   * is this file's choice rather than a transcription.
   */
  ...RACIAL_COOLDOWNS,
  /*
   * SHADOWBURN SECOND, WHERE IT WAS SIXTH -- the one reorder in this list that
   * changes WHICH spell gets a global cooldown rather than only when. It is
   * instant and it was below Conflagrate; both now sit above the filler.
   */
  { abilityId: 'shadowburn' },
  /*
   * IMMOLATE ON A TIGHT WINDOW AND A FIGHT FLOOR, where it was "if not active".
   * See the constants for why Bane of Agony's floor derives and this one does
   * not.
   */
  {
    abilityId: 'immolate',
    condition: all(
      targetAuraAtMost('immolate', IMMOLATE_REFRESH_SECONDS),
      fightRemaining('atLeast', IMMOLATE_FIGHT_FLOOR_SECONDS),
    ),
  },
  { abilityId: 'conflagrate' },
  /*
   * ==========================================================================
   * BANE OF AGONY IS NEW TO THIS LIST, and it is the first Affliction spell a
   * Destruction Warlock casts here.
   *
   * "IS NOT UP" RATHER THAN A WINDOW, which is the owner's other reading and
   * the one this project measured as better: a refresh RESETS the aura, and a
   * 24-second debuff clipped at two seconds throws away a twelfth of itself on
   * every application. The Immolate entry above uses a window and this one
   * does not, so BOTH READINGS SIT IN ONE LIST -- transcribed as given rather
   * than normalised, which is the editor's own promise.
   *
   * THE BUILD CAN CAST IT: Bane of Agony is a trainer spell, so the entry is
   * live on a build that spends nothing in Affliction beyond Suppression.
   * ==========================================================================
   */
  {
    abilityId: 'bane_of_agony',
    condition: all(
      targetLacks('bane_of_agony'),
      fightRemaining('atLeast', BANE_OF_AGONY_FIGHT_FLOOR_SECONDS),
    ),
  },
  /*
   * AND THE REST OF THE CONSUMABLES DOWN HERE WITH LIFE TAP, which is the
   * owner's split and reads as one decision rather than two: the Demonic Rune
   * at 10% mana and Life Tap at 5% are a LADDER down the same pool, and the
   * Rune is the rung that costs no global cooldown. Putting them together is
   * what makes that legible on the panel.
   */
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  ...CONSUMABLE_HEALS,
  /*
   * NO CORRUPTION, by the ruleset owner's instruction. It was 10.3% of this
   * profile's damage and it is out: a 2-second cast and a global cooldown spent
   * on a Shadow bleed that this build's talents barely touch -- Firelock takes
   * no Malediction, no Improved Corruption and no Shadow Mastery, and since Ruin
   * and Agonizing Flames were correctly scoped to the Destruction tree they do
   * not reach it either. What the global cooldown buys instead is Incinerate,
   * which is 25% larger against a burning target.
   */
  /*
   * ==========================================================================
   * LIFE TAP ON A MANA THRESHOLD, BY THE RULESET OWNER'S RULING: "spending life
   * tap on global cooldowns should only be based on the warlock's current mana."
   *
   * IT WAS UNGATED HERE AND GATED IN THE SM/DS LIST, WHICH IS THE WHOLE BUG.
   * That list carries the lesson in its own comment -- an unconditional Life Tap
   * "fired five times a fight, each one a global cooldown that dealt nothing" --
   * and the fix was applied to one of the two lists that needed it. **One caller
   * is not a sample**, and the sibling list is the first place to look.
   *
   * WHAT UNGATED MEANT IS NOT "ALWAYS", WHICH IS WHY IT LOOKED REASONABLE. Life
   * Tap's own `canCast` refuses unless there is health to spend AND the mana
   * pool has room for the 840 it grants. Room in the pool is a LEGALITY check
   * and belongs on the ability; "is the mana wanted" is a POLICY question and
   * belongs here. The policy was "whenever the pool is 840 below full", which on
   * this build is most of the fight: **5.46 taps a fight**, every one of them a
   * global cooldown that could have been an Incinerate.
   *
   * FIVE PERCENT IS A MEASURED PEAK AND NOT A COPY OF SM/DS's FIFTEEN, which
   * this project's own rule asks for -- "do not normalise a threshold across two
   * lists of the same class". Swept by `tools/probe_life_tap_gate.ts`:
   *
   *     ungated   776.6      5.46 taps
   *     below 1%  850.3      0.27        +73.7
   *     below 3%  862.8      0.83        +86.2
   *     below 5%  865.4      1.05        +88.7   <-- the peak
   *     below 8%  862.9      1.23        +86.3
   *     below 15% 855.9      1.70        +79.3
   *     below 50% 793.3      5.00        +16.7
   *
   * IT FALLS OFF BOTH SIDES, which is what makes it a peak rather than a trend:
   * too loose and the taps are waste, too tight and the build runs dry before it
   * taps. A two-point comparison would have found neither edge.
   *
   * AND SM/DS NEEDS NO CHANGE, measured at **0.00 taps at every gate from 2% to
   * 30%** -- its mana never falls that far, so its 15% was already doing the
   * whole job. Every one of those cells reads 715.4, identical to the decimal,
   * which would normally be this project's tell for a patch that did not apply;
   * the `taps` column is what says it is genuine.
   * ==========================================================================
   */
  { abilityId: 'life_tap', condition: manaBelowFraction(FIRELOCK_LIFE_TAP_MANA) },
  { abilityId: 'incinerate' },
  ],
};

/**
 * The share of the fight Decimation's window covers: "below 35% health", which
 * by the owner's ruling is the last 35% of the planned fight. The talent reads
 * its own figure off its values row; this is the same number for the LIST, and
 * `warlockDemonology.test.ts` pins that the two still agree.
 */
export const DECIMATION_PHASE_FRACTION = 0.35;

/** "We are inside Decimation's window", the condition every execute entry reads. */
export const DECIMATION_PHASE = fightRemainingFraction('atMost', DECIMATION_PHASE_FRACTION);

/**
 * DEMONOLOGY -- the Imp out, the Succubus sacrificed, Fire through Searing Pain.
 *
 * ============================================================================
 * 5/31/15, and the owner's design: Suppression and Ruin at 5/5, Demonic
 * Sacrifice on the Succubus for +15% Fire, Master Demonologist on the Imp for
 * another +10% Fire to both of them -- which needs Demonic Pact, or summoning
 * the Imp would cancel the sacrifice -- and Decimation's Soul Fire in the last
 * 35% of the fight.
 *
 * SEARING PAIN IS THE FILLER AND IT ALSO FEEDS THE IMP. Demonic Brand rides on
 * it: each Searing Pain brands the target for 10 seconds, and each of the
 * Imp's next six Firebolts adds 65 to 68 Fire. An Imp casting every 2.4
 * seconds spends six charges in 14.4 seconds, so the brand's 10-second window
 * runs out before its charges do, and a filler that is cast every 1.5 seconds
 * keeps it up for free.
 *
 * INCINERATE AND CONFLAGRATE ARE OUT OF REACH -- both sit deeper in
 * Destruction than 15 points go -- so the only Fire spells are Searing Pain,
 * Immolate and Soul Fire.
 * ============================================================================
 */
export const WARLOCK_DEMONOLOGY: AplList = {
  name: 'Warlock (Fire Demo)',
  entries: [
  buffPotionCooldown('major_spellblasting_potion'),
  ...RACIAL_COOLDOWNS,
  /*
   * SOUL FIRE WHILE DECIMATION IS UP, ON COOLDOWN. The buff -- 10 seconds,
   * opened by a Searing Pain or Shadow Bolt in the last 35% of the fight --
   * makes it a 2.4-second cast with Bane 5/5 that costs no shard, and the
   * talent's standing half takes it to a 6-second cooldown. Above everything
   * else, because it is the largest single hit the build has. Read off the
   * BUFF since round 44, so the panel's dropdown names what gates it.
   */
  { abilityId: 'soul_fire', condition: actorHas('decimation') },
  {
    abilityId: 'immolate',
    condition: all(
      targetAuraAtMost('immolate', IMMOLATE_REFRESH_SECONDS),
      fightRemaining('atLeast', IMMOLATE_FIGHT_FLOOR_SECONDS),
    ),
  },
  {
    abilityId: 'bane_of_agony',
    condition: all(
      targetLacks('bane_of_agony'),
      fightRemaining('atLeast', BANE_OF_AGONY_FIGHT_FLOOR_SECONDS),
    ),
  },
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  ...CONSUMABLE_HEALS,
  /*
   * CORRUPTION, round 41: kept up when it is not, with a floor one second past
   * its 18-second duration so it goes out only if it can run in full -- the
   * rule Bane of Agony's floor already follows. It lost past a minute while
   * Life Tap cost health and the build ran dry; with the group healing every
   * tap back it is +17.4 / +21.3 / +19.6 at 60 / 180 / 300s.
   */
  {
    abilityId: 'corruption',
    condition: all(targetLacks('corruption'), fightRemaining('atLeast', CORRUPTION_FIGHT_FLOOR_SECONDS)),
  },
  { abilityId: 'life_tap', condition: manaBelowFraction(FIRELOCK_LIFE_TAP_MANA) },
  { abilityId: 'searing_pain' },
  ],
};

/**
 * SBOLT SPAM -- the owner's list, entry for entry. 22/11/18 with the Imp
 * sacrificed for +15% Shadow: Improved Corruption, Malevolence, Pandemic and
 * Nightfall in Affliction, Improved Shadow Bolt, Bane, Ruin and Agonizing
 * Flames in Destruction, and Shadow Bolt as the filler.
 *
 * ============================================================================
 * ENTRY 1 IS ONE SEQUENCE: "Major Spellblasting Potion + Blood Fury + Amplify
 * Curse + Bane of Agony (if those cooldowns are available)". A sequence checks
 * EVERY step's cooldown before it starts, which is that parenthesis exactly,
 * and nothing may be cast between the steps -- so the Bane of Agony it ends on
 * is the one Amplify Curse empowers. Blood Fury is a step rather than a
 * standalone racial entry, the Hunter stack's arrangement: a standalone one
 * would fire first and hold the whole sequence off its cooldown.
 * ============================================================================
 */
/** The owner's two mana gates on Sbolt Spam: the Rune below 15%, Life Tap below 10%. */
export const SBOLT_DEMONIC_RUNE_MANA = 0.15;
export const SBOLT_LIFE_TAP_MANA = 0.1;

export const WARLOCK_SBOLT: AplList = {
  name: 'Warlock (Sbolt Spam)',
  entries: [
  {
    abilityId: 'major_spellblasting_potion',
    sequence: ['blood_fury', 'amplify_curse', 'bane_of_agony'],
    note: 'Cooldown stack: the potion, Blood Fury, Amplify Curse and an amplified Bane of Agony, in one shot.',
  },
  /*
   * THE OTHER THREE FREE RACIALS, which every list carries so it serves any
   * race; a stored list drops the ones its race cannot cast, so an Orc's panel
   * shows the owner's seven entries and nothing else.
   */
  ...RACIAL_COOLDOWNS.filter((entry) => entry.abilityId !== 'blood_fury'),
  // Nightfall's Shadow Trance: the next Shadow Bolt is instant.
  { abilityId: 'shadow_bolt', condition: actorHas('shadow_trance') },
  { abilityId: 'corruption', condition: targetLacks('corruption') },
  { abilityId: 'bane_of_agony', condition: targetLacks('bane_of_agony') },
  { abilityId: 'demonic_rune', condition: manaBelowFraction(SBOLT_DEMONIC_RUNE_MANA) },
  { abilityId: 'life_tap', condition: manaBelowFraction(SBOLT_LIFE_TAP_MANA) },
  { abilityId: 'shadow_bolt' },
  ],
};

export const WARLOCK_AFFLICTION_ROTATION: Rotation = compileRotation(WARLOCK_AFFLICTION);
export const WARLOCK_SBOLT_ROTATION: Rotation = compileRotation(WARLOCK_SBOLT);
export const WARLOCK_DESTRUCTION_ROTATION: Rotation = compileRotation(WARLOCK_DESTRUCTION);
export const WARLOCK_DEMONOLOGY_ROTATION: Rotation = compileRotation(WARLOCK_DEMONOLOGY);

/**
 * Which list a Warlock runs, by capstone.
 *
 * Wrack is 31 into Affliction, Incinerate 31 into Destruction and Demonic Pact
 * 31 into Demonology; 51 points cannot reach two of them. A Warlock with none
 * gets the Affliction list, which is written entirely out of trainer abilities.
 */
export function warlockRotation(talents: TalentAllocation): Rotation | undefined {
  if ((talents.incinerate ?? 0) > 0) return WARLOCK_DESTRUCTION_ROTATION;
  if ((talents.demonic_pact ?? 0) > 0) return WARLOCK_DEMONOLOGY_ROTATION;
  /*
   * RUIN WITHOUT ANY 31-POINT CAPSTONE is Sbolt Spam: Incinerate and Demonic
   * Pact are caught above and Wrack would be the Affliction list's own. A
   * Warlock with no talents still gets the Affliction list below.
   */
  if ((talents.ruin ?? 0) > 0 && (talents.wrack ?? 0) === 0) return WARLOCK_SBOLT_ROTATION;
  return WARLOCK_AFFLICTION_ROTATION;
}

/**
 * Which demon's sacrifice buff this build carries into the fight, if any.
 *
 * ----------------------------------------------------------------------------
 * THE TOOLTIP DECIDES IT IN TWO SENTENCES. Demonic Sacrifice: "The effect is
 * canceled if any Demon is summoned." Demonic Pact: "Your Demonic Sacrifice
 * effect is no longer cancelled by summoning a different Demon pet.
 * Resummoning the sacrificed pet will still cancel the effect."
 *
 *   no demon out                       the sacrifice stands
 *   a demon out, no Pact               cancelled
 *   a demon out, Pact, a different one the sacrifice stands -- the owner's
 *                                      "sacrifice Succubus, summon Imp"
 *   a demon out, Pact, the same one    cancelled
 * ----------------------------------------------------------------------------
 */
export function sacrificedDemon(
  talents: TalentAllocation,
  petFamily: string | undefined,
  summonedDemon?: string,
): string | undefined {
  if ((talents.demonic_sacrifice ?? 0) === 0) return undefined;
  if (petFamily === undefined) return undefined;
  if (summonedDemon === undefined) return petFamily;
  const pact = (talents.demonic_pact ?? 0) > 0;
  return pact && summonedDemon !== petFamily ? petFamily : undefined;
}
