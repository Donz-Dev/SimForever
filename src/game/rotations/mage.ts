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
  any,
  compileRotation,
  fightRemaining,
  hasReaction,
  resourceFraction,
  selfHas,
  selfMissing,
  selfStacks,
  selfTime,
  targetStacks,
  targetTime,
} from './apl';
import type { TalentAllocation } from '../talents/Talent';
import {
  ARCANE_BLAST_MAX_STACKS,
  HEATING_UP_MAX_STACKS,
  IMPROVED_SCORCH_MAX_STACKS,
} from '../auras/mage';

/**
 * Mage priority lists.
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
 * were never mistaken for the ruleset's.
 *
 * CHOSEN BY TALENTS, the ROGUE'S arrangement rather than the Warrior's. All
 * three Mage builds are `caster` and the Mage has no stances and one form, so
 * style cannot tell them apart -- and unlike the Rogue there is no single
 * capstone that does it either, because the Frostfire build's points are split
 * 0/29/22 with no 31-point talent at all. The TREE WITH THE MOST POINTS is
 * what names the spec, which is how a person reads a build too.
 * ----------------------------------------------------------------------------
 */


/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. All three lists below are theirs; what was
 * here before was this file's own guess and said so.
 * ============================================================================
 */

/** "<buff> is not active", on the Mage. */
const selfExpired = (auraId: string) => selfTime('atMost', 0, auraId);

/** "<buff> stacks = N", on the Mage. */
const selfStacksExactly = (auraId: string, count: number) => selfStacks('exactly', count, auraId);

/** "<buff> stacks > 0", on the Mage. */
const selfHasStack = (auraId: string) => selfStacks('atLeast', 1, auraId);

/** "<debuff> stacks >= N", on the target. */
const targetStacksAtLeast = (auraId: string, minimum: number) =>
  targetStacks('atLeast', minimum, auraId);

/** "<debuff> duration <= N seconds", on the target. An absent debuff counts. */
const targetAuraAtMost = (auraId: string, secondsLeft: number) =>
  targetTime('atMost', secondsLeft, auraId);

/** "<debuff> duration >= N seconds", on the target. */
const targetAuraAtLeast = (auraId: string, secondsLeft: number) =>
  targetTime('atLeast', secondsLeft, auraId);

/** "<debuff> stacks < N", on the target. */
const targetStacksBelow = (auraId: string, cap: number) => targetStacks('below', cap, auraId);

/**
 * "The character actually has <reaction>", which is how a list asks whether a
 * TALENT was taken.
 *
 * ----------------------------------------------------------------------------
 * IT READS THE BUILT CHARACTER AND NOT THE BUILD, which is the arrangement
 * this codebase already uses to gate Charge behind Vanguard: the talent puts
 * something on the character and the rule reads that, so no list has to name a
 * talent id and no rank arithmetic happens here.
 *
 * A REACTION IS THE RIGHT THING TO READ FOR THIS ONE. Improved Scorch IS its
 * reaction -- the Fire Vulnerability debuff is applied by it and by nothing
 * else -- so "does this character have the reaction" and "is Scorch worth
 * casting for the debuff" are the same question. Asking the ability book would
 * not work: Scorch is a trainer spell every Mage owns.
 * ----------------------------------------------------------------------------
 */

/** "Mana is at or below N% of maximum." */
const selfResourceBelowPercent = (resource: 'mana', percent: number) =>
  /*
   * THE CLOSURE COMPARED A PERCENTAGE AND THE DATA MODEL HOLDS A FRACTION, so
   * the conversion happens here rather than at every call: `(current/maximum)
   * * 100 <= percent` is `current/maximum <= percent/100`, which is the same
   * comparison and the same boundary.
   */
  resourceFraction('atMost', percent / 100, resource);

/** "<buff> is not on the Mage at all." */
const selfLacks = selfMissing;

/** "<buff> is up", on the Mage -- `auras.has`, not a reading of the clock. */
const selfActive = selfHas;

/** "<buff> has at most N seconds left", on the Mage. */
const selfAuraAtMost = (auraId: string, secondsLeft: number) =>
  selfTime('atMost', secondsLeft, auraId);

/** "Mana is at or above N% of maximum" -- `selfResourceBelowPercent`'s mirror. */
const selfResourceAbovePercent = (resource: 'mana', percent: number) =>
  resourceFraction('atLeast', percent / 100, resource);


const either = any;

/*
 * ----------------------------------------------------------------------------
 * "SCORCH IF SCORCH DEBUFF < 5", CONFIRMED BY THE RULESET OWNER.
 *
 * The spec said `<= 5` and it was implemented as `< 5`, flagged as an
 * interpretation, and the owner has since settled it in those words: "scorch
 * should be cast if there are <5 stacks of it, not <=5". So the reading that
 * was chosen is the one intended, and this is no longer a question.
 *
 * WHY IT COULD NOT BE TAKEN LITERALLY. Fire Vulnerability caps at five stacks,
 * so `<= 5` is always true -- Scorch would be unconditional and every entry
 * below it in the Fire and Frostfire lists unreachable. The evidence for `< 5`
 * was the owner's own Combustion entry using `>= 5` to mean "at cap", and the
 * rule this project follows: implement the reading that leaves every clause
 * doing work, name the constant, and say which reading was chosen. Both halves
 * of that worked -- the reading was right and the flag is what got it asked.
 * ----------------------------------------------------------------------------
 */
const SCORCH_STACK_CAP = IMPROVED_SCORCH_MAX_STACKS;
/** "or scorch duration <= 3 seconds", which refreshes it before it drops. */
const SCORCH_REFRESH_SECONDS = 3;

/*
 * ----------------------------------------------------------------------------
 * AND ONLY IF THE BUILD HAS IMPROVED SCORCH AT ALL, which the ruleset owner
 * has now added. Without the talent, Scorch applies no Fire Vulnerability --
 * so the two clauses below are permanently true, Scorch becomes an
 * unconditional entry near the top of two lists, and every entry beneath it is
 * unreachable. That is the same failure the `<= 5` reading would have caused,
 * arrived at from the other direction: there the cap made the test always
 * true, here the absent debuff does.
 *
 * AND IT IS NOT HYPOTHETICAL FOR A LIST THAT SERVES SEVERAL BUILDS. All three
 * of the owner's Mage profiles take Improved Scorch 3/3 today, so this changes
 * none of them -- it is a guard on the LIST rather than a fix to a profile,
 * and the reason to put it in now is that an untalented Fire mage running the
 * Fire list would otherwise cast a 181-damage spell over a 483-damage one for
 * a whole fight and look perfectly ordinary doing it.
 * ----------------------------------------------------------------------------
 */
/*
 * ============================================================================
 * EVOCATION AT 10% MANA, IN ALL THREE LISTS, by the ruleset owner.
 *
 * ONCE A FIGHT EFFECTIVELY -- an eight-minute cooldown against a one-minute
 * encounter -- so the only decision the list makes is WHEN, and the owner has
 * set it at a tenth of the pool. That is late on purpose: the channel is eight
 * seconds of casting nothing, so spending it early means paying the eight
 * seconds for mana the Mage had not yet run out of.
 *
 * ABOVE EVERYTHING BUT THE ARMOR, because a conditional entry that is almost
 * never true costs the entries below it nothing -- and when it IS true, a Mage
 * at 10% mana is about to be unable to cast its filler anyway.
 *
 * ----------------------------------------------------------------------------
 * IT FIRES ON NO PROFILE AT ALL, AND THE OWNER HAS RULED THAT INTENDED.
 *
 * None of the three Mage builds now drops to a tenth of its pool -- the Fire one
 * stopped running dry when Heating Up became consumed by a single Pyroblast, so
 * it spends 7,854 mana of 9,751 instead of emptying the bar. Measured at ZERO
 * casts across three profiles and twenty seeds each.
 *
 * Reported to the owner with the threshold offered as the thing to move, and the
 * answer was **"This is intended"** (2026-10-08). So the entry stays where it is
 * at the threshold it has, and **a never-fired entry is not therefore a defect**
 * -- the second time the owner's list has outranked a measurement of ours, after
 * Hunter's Mark's -10.1. It is a safety net that costs nothing: it pays out only
 * in a fight that goes differently from the ones measured, which is what a 10%
 * gate is for.
 *
 * DO NOT "FIX" THE ZERO. `mageAbilities.test.ts` records it as a known fact and
 * asserts the invariant -- the entry present in all three lists at the owner's
 * threshold, with the condition answering correctly on both sides of it -- rather
 * than a cast count, which three unrelated changes had already invalidated.
 * ----------------------------------------------------------------------------
 * ============================================================================
 */
const EVOCATION_MANA_PERCENT = 10;

/**
 * AND ENOUGH FIGHT LEFT TO BE WORTH CHANNELLING, which is the owner's new
 * second clause -- and it is NOT the same number on all three lists.
 *
 * ============================================================================
 * EVOCATION IS AN EIGHT-SECOND CHANNEL THAT DEALS NOTHING. Starting one with
 * five seconds on the clock is five seconds of silence bought with mana the
 * fight ends before anybody can spend, so the gate above -- "the pool is
 * nearly empty" -- is only half the question. The other half is whether there
 * is a fight left to spend the pool in.
 *
 * IT DOES NOT CHANGE THE ZERO ABOVE, AND THAT IS WORTH SAYING. The entry still
 * fires on no profile at all: this NARROWS a condition that was already never
 * true, so the ruling recorded above ("This is intended") is untouched and
 * `mageAbilities.test.ts` still pins the zero. What moves is what the entry
 * does in a fight that goes differently from the ones measured, which is the
 * only thing a safety net is for.
 *
 * FIFTEEN SECONDS ON ARCANE AND FROSTFIRE, TEN ON FIRE, both the owner's.
 * STATED AS TWO CONSTANTS rather than one shared number: nothing says the
 * three lists should agree, the owner has given two figures, and the Thistle
 * Tea gate next door is the worked example of what happens when a shared
 * constant has to serve three owner answers at once.
 * ============================================================================
 */
const EVOCATION_FIGHT_SECONDS = 15;
const FIRE_EVOCATION_FIGHT_SECONDS = 10;

const evocationFor = (secondsLeft: number) =>
  all(
    selfResourceBelowPercent('mana', EVOCATION_MANA_PERCENT),
    fightRemaining('atLeast', secondsLeft),
  );

/**
 * The Heating Up stacks the FROSTFIRE list salvages, and how little is left.
 *
 * Two of three, with 3.5 seconds to run. Both the owner's, and see the entry
 * for why spending at two stacks is worse than waiting anywhere else.
 */
const HEATING_UP_SALVAGE_STACKS = 2;
const HEATING_UP_SALVAGE_SECONDS = 3.5;

const scorchNeeded = all(
  hasReaction('improved_scorch'),
  either(
    targetStacksBelow('fire_vulnerability', SCORCH_STACK_CAP),
    targetAuraAtMost('fire_vulnerability', SCORCH_REFRESH_SECONDS),
  ),
);

// ---------------------------------------------------------------------------

/**
 * FIRE — Scorch to five stacks, then Fireball, with Pyroblast on Hot Streak.
 *
 * SCORCH FIRST AND ONLY UNTIL IT CAPS. Improved Scorch is a stacking FIRE
 * VULNERABILITY on the target worth 3% a stack, so the first few casts buy
 * every Fire spell after them a discount. Once it is at five, Scorch is a
 * 181-damage spell and Fireball is a 483-damage one, so the condition stops
 * casting it rather than a timer doing so.
 *
 * PYROBLAST ONLY WITH HOT STREAK. Six seconds of cast time for 583 is worse
 * than two Fireballs; at three Hot Streak stacks it is a second and a half,
 * which is better than either. The entry says exactly that.
 *
 * COMBUSTION AND FIRE BLAST ON COOLDOWN, both instants that cost nothing but
 * a global cooldown.
 */
export const MAGE_FIRE: AplList = {
  name: 'Mage (Fire)',
  entries: [
  { abilityId: 'mage_armor', condition: selfExpired('mage_armor') },
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
  { abilityId: 'evocation', condition: evocationFor(FIRE_EVOCATION_FIGHT_SECONDS) },
  { abilityId: 'scorch', condition: scorchNeeded },
  /*
   * AT THREE STACKS, WHICH IS THE CAP. Heating Up takes a quarter off
   * Pyroblast's cast per stack, so three turns a six-second cast into a second
   * and a half -- the only point at which it beats two Fireballs.
   */
  { abilityId: 'pyroblast', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * COMBUSTION ONLY WITH THE DEBUFF CAPPED AND HOLDING. It is a crit cooldown,
   * so it is worth most when every Fire spell under it is already taking the
   * full Fire Vulnerability -- and the ten-second floor is what stops it being
   * spent on a stack about to fall off.
   */
  {
    abilityId: 'combustion',
    condition: all(
      targetStacksAtLeast('fire_vulnerability', IMPROVED_SCORCH_MAX_STACKS),
      targetAuraAtLeast('fire_vulnerability', 10),
    ),
  },
  /*
   * ==========================================================================
   * FIRE BLAST ONLY WHILE CLEARCASTING IS *NOT* UP, which is the owner's gate
   * and is the opposite polarity to the one a reader expects of a free cast.
   *
   * CLEARCASTING MAKES THE NEXT SPELL FREE and `CastModifier` spends the charge
   * on whatever goes out next, narrowed by `requiresCost` and
   * `requiresAttackTable` but not by how much the spell costs. So a 425-mana
   * instant under the proc eats a charge that a 585-mana Fireball wanted, and
   * the saving simply lands somewhere worth less -- the invisible failure this
   * project already records for a charge spent on the wrong ability: the proc
   * fires, the aura reports its uptime, and nothing anywhere reads wrong.
   *
   * SO THE GATE HOLDS THE CHEAP INSTANT BACK until the free cast has been
   * taken by the filler below.
   * ==========================================================================
   */
  { abilityId: 'fire_blast', condition: selfLacks('clearcasting') },
  /*
   * ARCANE MISSILES ON A BARRAGE PROC, WHICH IS NEW TO THIS LIST AND IS PAID
   * FOR IN TALENTS. The respecification moves six points into Arcane for
   * Missile Barrage; without the talent nothing applies the aura, so the entry
   * would be permanently false and the list would be eleven rows describing a
   * ten-row rotation. THE LIST AND THE ALLOCATION ARE ONE CHANGE.
   */
  { abilityId: 'arcane_missiles', condition: selfHasStack('missile_barrage') },
  { abilityId: 'fireball' },
  ],
};

/**
 * FROSTFIRE — Frostfire Bolt as the filler, with the same Scorch opener.
 *
 * 0/29/22, WITH NO CAPSTONE IN EITHER TREE. It is the Fire tree's cast-time
 * and crit talents plus the Frost tree's crit damage, and Frostfire Bolt is
 * what both halves scale: Improved Fireball shortens it, Fire Power raises it,
 * and Ice Shards raises its crits because it is the one spell that is both.
 *
 * ICE LANCE IS IN THE BOOK AND NOT IN THE LIST. Its 300% clause needs a frozen
 * target and nothing freezes a raid boss, so what is left is a 148-damage
 * instant for 160 mana -- worse per global cooldown than anything above it.
 * Left out deliberately rather than forgotten.
 */
export const MAGE_FROSTFIRE: AplList = {
  name: 'Mage (Frostfire)',
  entries: [
  { abilityId: 'mage_armor', condition: selfExpired('mage_armor') },
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
  { abilityId: 'evocation', condition: evocationFor(EVOCATION_FIGHT_SECONDS) },
  { abilityId: 'scorch', condition: scorchNeeded },
  { abilityId: 'pyroblast', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * ==========================================================================
   * A SECOND PYROBLAST AT *TWO* STACKS, AND ONLY WHEN THEY ARE ABOUT TO GO.
   *
   * THE OWNER'S ENTRY, AND IT IS A SALVAGE RATHER THAN A ROTATION. Heating Up
   * lasts twenty seconds and is `consumedByCast: 'all'`, so a build that
   * reaches two stacks and then does not reach three throws BOTH away -- and
   * this repository has measured exactly that shape next door: correcting the
   * consumption rule took the Fire build's Pyroblast from 13.55 casts a fight
   * to 1.75, because three stacks are only reached twice.
   *
   * THE 3.5-SECOND WINDOW IS WHAT MAKES IT A SALVAGE AND NOT A DOWNGRADE. Two
   * stacks is two thirds of the cast-time reduction of three, so spending
   * there is worse than waiting -- everywhere except in the last moment before
   * the waiting costs everything, which is the only moment this fires.
   *
   * IT IS A SECOND ENTRY FOR THE SAME ABILITY, which is legal and deliberate:
   * the Mage's own Arcane Missiles is in its list twice. What is illegal is a
   * copy below an UNCONDITIONAL one, and both of these are gated.
   *
   * AND IT CANNOT SHADOW THE ENTRY ABOVE IT, because the two conditions are
   * mutually exclusive by construction -- `exactly 3` and `exactly 2` -- so
   * the order between them decides nothing. That is not true of a `below 3`
   * reading, which is the version to not quietly "simplify" this into.
   * ==========================================================================
   */
  {
    abilityId: 'pyroblast',
    condition: all(
      selfStacksExactly('heating_up', HEATING_UP_SALVAGE_STACKS),
      selfAuraAtMost('heating_up', HEATING_UP_SALVAGE_SECONDS),
    ),
  },
  /*
   * ==========================================================================
   * ICE LANCE LEAVES THIS LIST, AND IT IS WORTH **+74.1** TO TAKE IT OUT.
   *
   * It entered when Fingers of Frost made the 300% clause reachable -- the
   * talent does not freeze anything, it makes the caster's next spells behave
   * as though the target were -- and the entry was correctly gated on a charge
   * being in hand. It was still 15.2% of the profile's damage and still a loss.
   *
   * BECAUSE THE CHARGE IS WORTH MORE TO SOMETHING ELSE. Shatter is
   * `critWhileAura('fingers_of_frost', ALL_ABILITIES)`, so the window raises
   * the crit of EVERY spell -- and Fingers of Frost holds two charges that any
   * cast spends. An Ice Lance inside the window is a charge Frostfire Bolt or
   * Pyroblast does not get, which is this project's own "a charge spent on the
   * wrong ability" failure: the proc fires, the aura reports its uptime, and
   * the saving lands somewhere it should not.
   *
   * THE USES COLUMN IS WHAT SAYS SO RATHER THAN THE DPS. Removing the entry
   * takes Frostfire Bolt from **12.8 casts a fight to 16.3** and Pyroblast from
   * 3.7 to 4.2, and Ignite's share from 11.3% to 15.6% -- so 5.6 Ice Lances
   * become three and a half casts of the biggest spell in the build plus the
   * Fire crits that ride on them. **A DPS figure alone could not have told a
   * displaced cast from a worse one.**
   *
   * THE ABILITY IS STILL DECLARED, STILL GATED AND STILL CORRECT. What is
   * measured here is that a 1.5/3.5/3 coefficient tripled is worth less than
   * the 2.5-second cast it displaces -- which is a fact about this build's
   * spell power rather than about Ice Lance, and would flip on a build whose
   * Frostfire Bolt were weaker. One line puts it back.
   * ==========================================================================
   */
  /*
   * FIRE BLAST ONLY ABOVE 10% MANA, which is the MIRROR of the Evocation entry
   * at the top of this list and shares its constant deliberately. Below that
   * threshold the list is about to stop and channel for eight seconds, and
   * spending the last of the pool on a 425-mana instant is spending it on the
   * thing that caused the channel.
   *
   * NOT GATED ON CLEARCASTING, WHICH THE FIRE LIST'S COPY IS. Two owner
   * conditions for one ability on two lists, and they are left as two: the
   * Fire build takes Arcane Concentration 5/5 and has a proc to protect, and
   * nothing says the Frostfire build's answer should be the same one.
   */
  { abilityId: 'fire_blast', condition: selfResourceAbovePercent('mana', EVOCATION_MANA_PERCENT) },
  { abilityId: 'frostfire_bolt' },
  ],
};

/**
 * ARCANE — Arcane Blast until it is too expensive, Missiles on a proc.
 *
 * THE COST ESCALATION IS THE WHOLE ROTATION. Arcane Blast is 140 mana at no
 * stacks and 175% more per stack, so a fourth cast costs eight times the
 * first. The list spends up to a threshold and then lets the debuff fall off
 * during an Arcane Missiles channel, which is what makes Missile Barrage worth
 * having: the channel is both the damage and the pause.
 *
 * MISSILE BARRAGE FIRST, because a procced Arcane Missiles is free, half as
 * long, and the reason to stop casting Arcane Blast at all.
 *
 * PRESENCE OF MIND AND ARCANE POWER ON COOLDOWN. Presence of Mind makes the
 * next cast instant, which is worth most on the longest one it can reach --
 * but the list uses it on cooldown rather than saving it, because a shell that
 * hoards a three-minute cooldown for a perfect moment is describing a player
 * and not a rotation.
 */
export const MAGE_ARCANE: AplList = {
  name: 'Mage (Arcane)',
  entries: [
  /*
   * "MAGE ARMOR IS NOT UP", AND IT IS *NOT* THE "HAS RUN OUT" THE OTHER TWO
   * LISTS USE.
   *
   * --------------------------------------------------------------------------
   * The owner's Arcane panel reads `aura present: false` where the Fire and
   * Frostfire panels read the clock, and the two are different tests: an aura
   * can be PRESENT with nothing left on it. `AplCompare` carries both because
   * the nine class files wrote both and meant both.
   *
   * IT IS WORTH NOTHING TODAY AND IS TRANSCRIBED ANYWAY. Mage Armor lasts
   * thirty minutes against a one-minute fight, so neither reading can be
   * reached after the opener and the entry fires exactly once either way. What
   * is being preserved is that opening the panel and changing nothing leaves
   * the condition byte-identical -- the editor's one promise -- and a list that
   * quietly normalises the owner's two readings into one breaks it.
   * --------------------------------------------------------------------------
   */
  { abilityId: 'mage_armor', condition: selfLacks('mage_armor') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  /*
   * AND THE SPELLBLASTING POTION HELD FOR PRESENCE OF MIND, which is the
   * owner's gate and is the first time anything in this project lines a potion
   * up against one of the character's own cooldowns.
   *
   * ITS POSITION IS UNCHANGED -- the potion is last in the shared group, so
   * excluding it and placing it here keeps every other row exactly where it
   * was. What moved is the condition, and `buffPotionCooldown` is what carries
   * the NOTE with it: a note is a frozen string, and an override that touched
   * only the condition would leave the panel explaining a gate that is gone.
   */
  buffPotionCooldown('major_spellblasting_potion', {
    id: 'presence_of_mind',
    label: 'Presence of Mind',
  }),
  ...CONSUMABLE_HEALS,
  { abilityId: 'evocation', condition: evocationFor(EVOCATION_FIGHT_SECONDS) },
  /*
   * ARCANE POWER ON A BARRAGE PROC ALONE, which is LOOSER than it was. The
   * entry used to want a proc AND three Arcane Blast stacks; the owner has
   * dropped the stack clause, so the cooldown now fires on the first free
   * Missiles of the fight rather than waiting for the Blast debuff to build
   * underneath it.
   *
   * WHY THAT IS NOT A REGRESSION. Arcane Power is +30% damage for fifteen
   * seconds on a three-minute cooldown, so in a one-minute fight it is cast at
   * most once and every poll it spends waiting is a poll of the window thrown
   * away. The tighter gate was this file's reading of "worth most"; the looser
   * one is the owner's reading of "worth having at all", and in a fight this
   * short the second is the better trade.
   */
  { abilityId: 'arcane_power', condition: selfHasStack('missile_barrage') },
  /*
   * ==========================================================================
   * PRESENCE OF MIND AT THE ARCANE BLAST CAP, AND THE PYROBLAST BENEATH IT IS
   * WHAT IT IS FOR. The owner has moved both: the old entry fired at exactly
   * ONE stack to make a cheap Blast instant, and these two make a SIX-SECOND
   * PYROBLAST instant instead.
   *
   * THE PAIR IS THE ROTATION AND NEITHER HALF WORKS ALONE. Presence of Mind
   * applies an aura with `requiresCastTime`, so the charge survives every
   * instant and off-GCD entry above it and is spent by the next real cast --
   * and the next real cast is the Pyroblast directly below, because its
   * condition is this entry's condition plus "the charge is in hand". Nothing
   * between them can take it.
   *
   * WHY PYROBLAST IS THE RIGHT TARGET. It is the longest cast the build owns at
   * six seconds against Arcane Blast's two and a half, so making it free of its
   * cast time is worth two and a half times what the old one-stack entry bought
   * -- and the four-stack clause is why the pair sits where it does: at the cap
   * the next Blast costs 175% more for no further damage, so a global cooldown
   * spent on something else is a global cooldown saved.
   *
   * PYROBLAST IS NEW TO THIS BUILD AND IS PAID FOR IN TALENTS. The
   * respecification moves eleven points into Fire for Ignite and Pyroblast;
   * without the talent the ability is not in the book and `PriorityRotation`
   * skips the entry in SILENCE, which is the fourth cause of inert. THE LIST
   * AND THE ALLOCATION ARE ONE CHANGE.
   * ==========================================================================
   */
  {
    abilityId: 'presence_of_mind',
    condition: selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
  },
  {
    abilityId: 'pyroblast',
    condition: all(
      selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
      selfActive('presence_of_mind'),
    ),
  },
  { abilityId: 'arcane_missiles', condition: selfHasStack('missile_barrage') },
  /*
   * AND AT THE ARCANE BLAST CAP WITHOUT ONE. Four is the cap, where the next
   * Blast costs 175% more for no further damage bonus -- so the list spends the
   * stack on Missiles rather than paying that price, and the debuff falls off
   * during the channel.
   *
   * A repeated ability id is legal; what is not is a copy below an
   * UNCONDITIONAL one. Both entries are gated and Arcane Blast is the filler.
   */
  {
    abilityId: 'arcane_missiles',
    condition: selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
  },
  { abilityId: 'arcane_blast' },
  ],
};

/**
 * How much Frost makes a mostly-Fire build a FROSTFIRE one.
 *
 * The owner's Frostfire build is 0/29/22 and the Fire one is 10/39/2, so
 * anything between those two works; fifteen is stated rather than tuned.
 */
export const FROSTFIRE_FROST_THRESHOLD = 15;

export const MAGE_FIRE_ROTATION: Rotation = compileRotation(MAGE_FIRE);
export const MAGE_FROSTFIRE_ROTATION: Rotation = compileRotation(MAGE_FROSTFIRE);
export const MAGE_ARCANE_ROTATION: Rotation = compileRotation(MAGE_ARCANE);

/**
 * Which list a Mage runs, from where its points went.
 *
 * THE TREE WITH THE MOST POINTS NAMES THE SPEC, which is how a person reads a
 * build. A capstone cannot do it here: the Frostfire build is 0/29/22 and has
 * no 31-point talent in either tree, so the Rogue's test would find nothing
 * and fall through to a default that describes none of the three.
 */
export function mageRotation(talents: TalentAllocation): Rotation | undefined {
  const spent = (ids: readonly string[]) =>
    ids.reduce((total, id) => total + (talents[id] ?? 0), 0);

  /*
   * ALL THREE TREES ARE COUNTED, and the first version of this counted two.
   * It compared Arcane against Frost and never looked at Fire, so the 10/39/2
   * Fire build -- ten Arcane points against two Frost -- came back as ARCANE
   * and ran a list built around a spell it has one point in. It produced a
   * perfectly ordinary 143.9 DPS while casting nothing but Arcane Missiles.
   *
   * Named rather than derived from the tree data, so this file states which
   * talents it considers which tree and a rename fails a test rather than
   * quietly reclassifying a build.
   */
  const arcane = spent([
    'wand_specialization',
    'arcane_focus',
    'improved_channeling',
    'arcane_subtlety',
    'magic_absorption',
    'arcane_concentration',
    'arcane_resilience',
    'arcane_geometry',
    'arcane_impact',
    'arcane_blast',
    'arcane_shielding',
    'improved_counterspell',
    'arcane_meditation',
    'missile_barrage',
    'presence_of_mind',
    'arcane_mind',
    'arcane_instability',
    'arcane_power',
  ]);
  const fire = spent([
    'wake_of_fire',
    'incineration',
    'improved_fireball',
    'ignite',
    'flame_throwing',
    'impact',
    'burning_soul',
    'improved_flamestrike',
    'pyroblast',
    'improved_scorch',
    'improved_fire_ward',
    'heating_up',
    'master_of_elements',
    'critical_mass',
    'blast_wave',
    'fire_power',
    'combustion',
  ]);
  const frost = spent([
    'frost_warding',
    'improved_frostbolt',
    'elemental_precision',
    'ice_shards',
    'permafrost',
    'improved_frost_nova',
    'frostbite',
    'piercing_ice',
    'frost_channeling',
    'ice_lance',
    'improved_blizzard',
    'arctic_reach',
    'ice_block',
    'shatter',
    'improved_cone_of_cold',
    'cold_snap',
    'fingers_of_frost',
    'winter_s_chill',
    'ice_barrier',
  ]);

  /*
   * A MAGE WITH NO TALENTS STILL GETS A LIST, and falls through to Fire below.
   *
   * Returning nothing would leave it standing still -- a `caster` has no
   * auto-attack, so no rotation means no damage at all -- and it has a
   * trainer's Fireball and Scorch in hand either way. The Fire list names two
   * talent-granted abilities it will not have, and `PriorityRotation` skips
   * an entry whose ability is not in the book, which is the same thing every
   * other class's list relies on.
   */
  if (arcane > fire && arcane > frost) return MAGE_ARCANE_ROTATION;
  /*
   * FROST POINTS MAKE IT FROSTFIRE, not Frost. There is no pure Frost profile
   * in the owner's list, and the 0/29/22 build's Frost half exists to scale
   * Frostfire Bolt's crits rather than to cast Frostbolt -- so a build with
   * real Frost investment runs the Frostfire list even though Fire has more
   * points in it.
   */
  if (frost >= FROSTFIRE_FROST_THRESHOLD) return MAGE_FROSTFIRE_ROTATION;
  return MAGE_FIRE_ROTATION;
}
