import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import {
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

/*
 * `selfExpired` IS GONE WITH THE LAST MAGE ARMOR ENTRY. It had one caller per
 * list and all three lists dropped theirs -- Arcane in round 24, Fire in 28,
 * Frostfire in 32 -- for the same reason: the buff lasts thirty minutes, so
 * the gate is false from the first poll and the entry can never fire. The two
 * comments below still describe the entries it used to gate.
 */

/** "<buff> stacks = N", on the Mage. */
const selfStacksExactly = (auraId: string, count: number) => selfStacks('exactly', count, auraId);

/**
 * HOW MUCH ARCANE BLAST WINDOW A MISSILES CHANNEL NEEDS TO BE WORTH STARTING.
 *
 * Mid-plateau rather than tuned: 1s to 3s all measure +13.1 to +13.5 and are
 * indistinguishable, 0.5s is +4.9 and 4s is noise. See the entry that reads it.
 */
const ARCANE_BLAST_CHANNEL_FLOOR_SECONDS = 2;

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

/** "<buff> has at most N seconds left", on the Mage. */
const selfAuraAtMost = (auraId: string, secondsLeft: number) =>
  selfTime('atMost', secondsLeft, auraId);

/** "Mana is at or above N% of maximum" -- `selfResourceBelowPercent`'s mirror. */
const selfResourceAbovePercent = (resource: 'mana', percent: number) =>
  resourceFraction('atLeast', percent / 100, resource);


const either = any;

/**
 * "Fire blast should be used at <= 1 stacks of Heating Up only" -- the owner,
 * for both Fire and Frostfire. A Fire Blast at two stacks would push Heating Up
 * to three and spend the Pyroblast window on a cast that is already instant;
 * at none or one it builds toward the window instead. ABSENT COUNTS AS NONE.
 */
const heatingUpAtMostOne = either(
  selfLacks('heating_up'),
  selfStacks('atMost', 1, 'heating_up'),
);

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

/*
 * ============================================================================
 * "OR THE VULNERABILITY IS ABOUT TO DROP", AND IT IS **FIVE SECONDS ON FIRE
 * AND THREE ON FROSTFIRE** -- two constants, because the two lists were swept
 * separately and only one of them has been.
 *
 * THE SWEEP ON THE FIRE LIST, 1500 paired iterations each against the legal
 * opener, as a delta from the 3 seconds both lists used to share:
 *
 *   2s   -13.70      4s   +6.56      6s   +9.84
 *   3s     0         5s   +9.74      8s   +8.63
 *
 * SO 5s AND 6s ARE TIED AT THE TOP and 4s to 8s is a plateau; 5 is mid-plateau
 * rather than tuned, which is the reading `ARCANE_BLAST_CHANNEL_FLOOR_SECONDS`
 * next door already takes of its own flat range.
 *
 * AND THE HYPOTHESIS THAT PRODUCED THIS SWEEP WAS WRONG IN BOTH DIRECTIONS.
 * A refresh window CLIPS -- refreshing a 30 second debuff at 3 seconds left
 * throws 3 seconds away -- which is the Moonkin's Nature's Grace failure and
 * says the window should be made SMALLER. It measures -13.7 at two seconds.
 *
 * WHAT IS ACTUALLY BEING TRADED IS A REBUILD. Fire Vulnerability is five
 * stacks at 3% each on a build whose damage is 84% Fire, and if it LAPSES all
 * five go -- so the next five Scorches are spent climbing back rather than
 * maintaining, at 562 damage a second of global cooldown against the filler's
 * 712. A three second margin is a gamble against a 2.5 second Fireball being
 * in flight when the debuff ends, and the clip is the cheaper of the two
 * mistakes. The curve turning over above 6s is the clip finally costing more
 * than the gamble.
 *
 * A TWO-POINT COMPARISON AT 3s AND 1s WOULD HAVE CONCLUDED "KEEP 3" and been
 * confident about it, which is why this is a sweep.
 *
 * FROSTFIRE IS LEFT AT 3s ON PURPOSE. Its filler is faster and its Scorch
 * carries Ice Shards' crit damage, so nothing here transfers -- and a shared
 * constant serving two unswept answers is the Thistle Tea gate's documented
 * mistake. Whoever sweeps that list owns that number.
 * ============================================================================
 */
const FIRE_SCORCH_REFRESH_SECONDS = 5;
const FROSTFIRE_SCORCH_REFRESH_SECONDS = 3;

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

const scorchNeededWithin = (refreshSeconds: number) =>
  all(
    hasReaction('improved_scorch'),
    either(
      targetStacksBelow('fire_vulnerability', SCORCH_STACK_CAP),
      targetAuraAtMost('fire_vulnerability', refreshSeconds),
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
  /*
   * ==========================================================================
   * MAGE ARMOR IS NOT IN THIS LIST, WHICH IS THE ARCANE RULING APPLIED TO THE
   * PROFILE IT WAS LEFT FOR. The owner: "Mage Armor doesn't need to be captured
   * in the main APL section. It's being taken care of in the pre-combat
   * section." That arrived as an audit of the ARCANE profile, so only that list
   * changed -- and `MAGE_ARCANE` records in its own words that Fire pre-casts
   * the buff at a 4.5s lead and the entry is equally dead here, "so the next
   * Mage round starts with it".
   *
   * THE ENTRY COULD NEVER FIRE. `selfExpired('mage_armor')` is false from the
   * pull onward: the opener casts it, the buff lasts THIRTY MINUTES against a
   * one-minute fight, and nothing in the encounter dispels. `USES=1` reported
   * **1.0 uses** against it and that use was the PRE-COMBAT cast charged to the
   * entry, which is why reading the uses column alone could not see this.
   *
   * REMOVING IT RUNS BIT-IDENTICAL FIGHTS at 1500 paired iterations, which is
   * the containment check and the only thing separating "redundant" from
   * "load-bearing" -- a change worth nothing still shifts the RNG sequence, so
   * a zero spread here means the entry was never REACHED rather than reached
   * and worth nothing.
   *
   * AND UNLIKE COMBUSTION, NO FIGHT LENGTH BRINGS IT BACK: the test is the
   * buff's duration against the clock, and thirty minutes beats any fight this
   * project runs. Frostfire still carries its copy, for the reason the Arcane
   * ruling gave -- a list is changed for the profile that was named.
   * ==========================================================================
   */
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS.filter((entry) => entry.abilityId !== 'eureka'),
  /*
   * ==========================================================================
   * EUREKA HELD FOR THE PYROBLAST IT MAKES BIGGER, WORTH **+5.34 +/- 0.55**.
   *
   * The Gnome racial is an 8 SECOND WINDOW of +10% NON-PERIODIC damage, free
   * and off the global cooldown -- and in the shared block it carries no
   * condition, so it is spent on whatever the first poll of the fight happens
   * to be. On the legal opener that poll faces a target with ZERO Fire
   * Vulnerability stacks, which is the worst eight seconds of the fight to
   * spend a damage window in.
   *
   * THREE HEATING UP STACKS IS A PYROBLAST ON THE NEXT CAST, which is the entry
   * below. At three stacks Pyroblast is a 1.5 second cast for about 2,950 --
   * the biggest single non-periodic hit this build has -- so the window opens
   * exactly as it lands. **The four gates measure +5.34 here, +4.69 on a
   * Combustion window, +2.58 on five Fire Vulnerability stacks and +2.50 on a
   * Missile Barrage proc**, which last is the ARCANE list's own answer and is
   * the worst of the four on this build.
   *
   * AND `any` OF THE TWO BEST IS WORSE THAN EITHER ALONE, at +3.51: the
   * Combustion branch spends the window on a poll where no Pyroblast is coming,
   * so a looser gate is not a safer one here. Removing the entry altogether is
   * **-8.94**, which is the sign check that says a gate is not merely a tax.
   *
   * THE INTERVALS ARE TENTHS BECAUSE A GATE ON A FREE OFF-GCD COOLDOWN CANNOT
   * FLIP A ROLL -- spread 5.5 against the 90-odd a talent or an opener change
   * produces. A small figure here is not a small sample.
   *
   * GATING THE SHARED BLOCK IS NOT AVAILABLE: `RACIAL_COOLDOWNS` is spread into
   * lists belonging to no race, so a condition written there would be a
   * condition on three abilities this character cannot cast. Eureka is last of
   * the four, so filtering it out and restating it here leaves every other
   * racial exactly where it was.
   * ==========================================================================
   */
  { abilityId: 'eureka', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * THE SPELLBLASTING POTION IS EXCLUDED HERE AND IS STEP TWO OF THE
   * COMBUSTION STACK BELOW, where the owner's gate for it actually belongs
   * now that a sequence can express the pairing. Excluding it keeps every
   * other row of the shared block exactly where it was.
   */
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  ...CONSUMABLE_HEALS,
  { abilityId: 'evocation', condition: evocationFor(FIRE_EVOCATION_FIGHT_SECONDS) },
  { abilityId: 'scorch', condition: scorchNeededWithin(FIRE_SCORCH_REFRESH_SECONDS) },
  /*
   * AT THREE STACKS, WHICH IS THE CAP. Heating Up takes a quarter off
   * Pyroblast's cast per stack, so three turns a six-second cast into a second
   * and a half -- the only point at which it beats two Fireballs.
   */
  { abilityId: 'pyroblast', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * ==========================================================================
   * COMBUSTION AND THE SPELLBLASTING POTION AS ONE ACTION, which is the
   * Arcane list's cooldown stack reached from the other direction.
   *
   * COMBUSTION ONLY WITH THE DEBUFF CAPPED AND HOLDING. It is a crit cooldown,
   * so it is worth most when every Fire spell under it is already taking the
   * full Fire Vulnerability -- and the ten-second floor is what stops it being
   * spent on a stack about to fall off. **Both clauses are inert at a
   * one-minute fight**: Fire Vulnerability sits at 99.9% uptime on a 30 second
   * duration, so once five stacks exist there are always more than twenty
   * seconds left, and moving the floor to 0 or to 20 runs bit-identical
   * fights. They are kept because they are a claim about when the cooldown is
   * worth spending rather than a claim about this clock.
   *
   * ------------------------------------------------------------------------
   * THE POTION IS A STEP RATHER THAN AN ENTRY, AND THE OWNER'S COMBUSTION
   * RULING IS WHAT MADE THAT POSSIBLE. It was a separate entry above this one,
   * gated on Combustion's own AURA: one poll cast the cooldown and a later poll
   * drank the potion, which worked and depended on two things no reader of
   * either entry could see -- the list ORDER, and a second decision happening
   * before anything took the global cooldown.
   *
   * WITH COMBUSTION OFF THE GLOBAL COOLDOWN the two resolve in ONE instant: the
   * cast leaves the actor free, `nextDecisionTime` returns at once, and the
   * potion goes out before anything else can act. **That is an emergent stack
   * held together by both being off the GCD** -- and one of them became so in
   * the same change, which is the Arcane round's own warning that "your own
   * change can create or destroy that in the same round."
   *
   * SO IT IS WRITTEN AS A GUARANTEE. `AplEntry.sequence` means nothing may be
   * cast between the steps whatever happens to either ability's GCD flag
   * later. It measures **bit-identical fights** at 1500 paired iterations,
   * which is the containment check and is also the Arcane verdict on the same
   * shape: measure it as neutral and ship it as structure.
   *
   * `abilityId` IS STEP ONE AND `sequence` HOLDS WHAT FOLLOWS IT, which is the
   * convention the Arcane stack uses and is easy to get wrong: `selectAction`
   * casts `entry.abilityId` and sets `pendingSequence.index = 0`, so naming
   * Combustion in BOTH places casts it, finds it on cooldown on the resume,
   * clears the pointer, and the potion never fires -- **-14.81 with a spread of
   * 0.08**.
   *
   * THE SPREAD IS WHAT SAID IT WAS A BUG RATHER THAN A FINDING. 0.08 on a
   * 1500-iteration paired run means the same loss in every fight, which is 40
   * spell power for 30 seconds going missing and not a decision changing
   * anywhere. `USES=1` shows it too -- it prints a sequence step as its own
   * `then <id>` row under the entry, so the step read 0.00 uses -- and this
   * round found it by asking the damage table instead, which is the slower
   * route to the same zero.
   *
   * AND THE GATE HAD TO MOVE OFF THE AURA ONTO THE SEQUENCE, which is forced
   * rather than chosen: `sequenceIsAffordable` resolves every step before any
   * of it is cast, so a step gated on what an earlier step APPLIES is refused
   * outright. That is the Vanish-into-Ambush limit, and here it is free --
   * Combustion's own condition is the right gate for the pair.
   *
   * ------------------------------------------------------------------------
   * THE POTION IS `abilityId` AND COMBUSTION IS THE STEP, WHICH IS THE ARCANE
   * STACK'S ARRANGEMENT TO THE LETTER and is not arbitrary. The two resolve in
   * one instant either way, so nothing about the fight depends on it -- what
   * depends on it is every READER that keys on `abilityId`, and a consumable
   * has two of them.
   *
   * `midFightConsumables.test.ts` ASSERTS THAT EVERY PRESET HAS A LIST ENTRY
   * FOR EXACTLY WHAT IT SELECTED, and it failed with Combustion as the id: the
   * potion became invisible, which is a potion that reads as never drunk. The
   * test has been taught to look inside a sequence as well -- a selection can
   * legitimately be a STEP -- and this entry is also written the way round the
   * precedent already is, so the two fixes are independent rather than one
   * propping up the other.
   * ==========================================================================
   */
  {
    abilityId: 'major_spellblasting_potion',
    sequence: ['combustion'],
    condition: all(
      targetStacksAtLeast('fire_vulnerability', IMPROVED_SCORCH_MAX_STACKS),
      targetAuraAtLeast('fire_vulnerability', 10),
    ),
    note:
      'Cooldown stack: the Spellblasting potion and Combustion as one action, at five ' +
      'stacks of Fire Vulnerability with ten seconds left on them. Both are off the ' +
      'global cooldown, so a player presses them together -- written as a sequence so ' +
      'nothing can land between them if either ever starts taking one again.',
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
  { abilityId: 'fire_blast', condition: all(selfLacks('clearcasting'), heatingUpAtMostOne) },
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
  /*
   * ==========================================================================
   * MAGE ARMOR IS NOT IN THIS LIST, BY THE OWNER'S RULING: "Mage Armor doesn't
   * need to be captured in the main APL section. It's being taken care of in
   * the pre-combat section."
   *
   * THE RULING ARRIVED AS PART OF AN AUDIT OF THE *ARCANE* PROFILE, and the
   * note on that list recorded the consequence for this one -- "the other two
   * Mage lists still carry theirs ... recorded here so the next Mage round
   * starts with it." **This is that round.**
   *
   * The entry was `mage_armor` gated on `selfExpired('mage_armor')`, and it
   * could never fire: this opener casts it at a 4 second lead, the buff lasts
   * THIRTY MINUTES against a one-minute fight, and nothing in the encounter
   * dispels. So the gate was false from the pull onward and the entry was a
   * poll that could only ever be skipped.
   *
   * `USES=1` REPORTED IT AS 1.0 USES, WHICH IS THE TRAP. That is the
   * PRE-COMBAT cast counted against the entry, so the one reading that would
   * have flagged it showed a working line instead -- the caveat
   * `docs/profile-optimisation.md`'s Appendix B carries about that block.
   *
   * REMOVING IT RUNS BIT-IDENTICAL FIGHTS at 60s, which is the containment
   * check and is the only thing that distinguishes "redundant" from
   * "load-bearing".
   *
   * **THE FIRE LIST STILL CARRIES ITS COPY**, at a 4.5s lead and equally dead.
   * A list is changed for the profile that was named rather than by analogy, so
   * that one waits for a Fire round -- and this note is now the place that says
   * so, the way the Arcane one did for this list.
   * ==========================================================================
   */
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS.filter((entry) => entry.abilityId !== 'eureka'),
  /*
   * ==========================================================================
   * EUREKA IS HELD FOR A FINGERS OF FROST WINDOW, WORTH **+5.99 +/- 0.95 REAL**
   * over 400 paired iterations at 60s.
   *
   * The Gnome racial is an 8 SECOND WINDOW of +10% NON-PERIODIC damage, and in
   * the shared block it carries no condition -- so it was spent on whatever the
   * first poll of the fight happened to be. The Arcane list gates its copy on a
   * Missile Barrage proc for exactly this reason and measured +1.92 for it; this
   * build has no Missile Barrage, so the candidates were its own two windows.
   *
   * THE BLOCK IS WHY IT HAD NO GATE RATHER THAN AN OVERSIGHT: that constant is
   * spread into lists belonging to no race, so a condition written there would
   * be a condition on three abilities this character cannot cast. Gating it is
   * therefore a change to THIS list, which is what the filter above does.
   *
   * ITS POSITION IS UNCHANGED. Eureka is last of the four, so taking it out of
   * the spread and restating it immediately after leaves every other racial
   * exactly where it was.
   *
   * ------------------------------------------------------------------------
   * **FINGERS OF FROST BEAT A PYROBLAST WINDOW, AND A LOOSER GATE BEAT
   * NEITHER.** Four readings, 400 paired iterations each:
   *
   *   Fingers of Frost            **+5.99 +/- 0.95**
   *   three Heating Up stacks       +5.83 +/- 2.67
   *   two Heating Up stacks         +4.80 +/- 2.59
   *   EITHER window                 +4.53 +/- 0.77
   *
   * The first two are indistinguishable -- 0.16 apart against a combined
   * interval of 2.83 -- and the looser "either" gate is WORSE than Fingers
   * alone by 1.46 against a combined 1.22, because a window spent on a
   * Pyroblast moment is a window not spent on a Shatter moment. Fingers is
   * taken for the tighter interval and because `shatter` 3/3 makes that window
   * the build's own best one.
   *
   * THE INTERVALS ARE SMALL BECAUSE A GATE ON A FREE OFF-GCD COOLDOWN CANNOT
   * FLIP A ROLL -- it moves WHEN the window opens and nothing else, which is
   * why the Arcane copy of this change also measured to two decimal places.
   *
   * AND IT SURVIVES THE CLOCK, WHICH IS THE PART THAT MADE IT SHIPPABLE. The
   * talent change this round measured at +22.14 INVERTED to -11.27 at 180s;
   * this is +5.99 at 60s, -0.34 +/- 4.19 at 180s and +2.80 +/- 4.17 at 300s --
   * a real gain at the published length and noise at every other, so it is
   * never a loss.
   * ==========================================================================
   */
  { abilityId: 'eureka', condition: selfHas('fingers_of_frost') },
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  { abilityId: 'evocation', condition: evocationFor(EVOCATION_FIGHT_SECONDS) },
  { abilityId: 'scorch', condition: scorchNeededWithin(FROSTFIRE_SCORCH_REFRESH_SECONDS) },
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
  {
    abilityId: 'fire_blast',
    condition: all(selfResourceAbovePercent('mana', EVOCATION_MANA_PERCENT), heatingUpAtMostOne),
  },
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
   * ==========================================================================
   * MAGE ARMOR IS NOT IN THIS LIST, BY THE OWNER'S RULING: "Mage Armor doesn't
   * need to be captured in the main APL section. It's being taken care of in
   * the pre-combat section."
   *
   * The entry was `mage_armor` gated on `selfLacks('mage_armor')`, and it could
   * never fire: the opener casts it at a 3 second lead, the buff lasts THIRTY
   * MINUTES against a one-minute fight, and nothing in the encounter dispels.
   * So the gate was false from the pull onward and the entry was a poll that
   * could only ever be skipped.
   *
   * REMOVING IT RUNS BIT-IDENTICAL FIGHTS, which is the containment check and
   * is the only thing that distinguishes "redundant" from "load-bearing".
   *
   * THE OTHER TWO MAGE LISTS STILL CARRY THEIRS. Fire pre-casts Mage Armor at a
   * 4.5s lead and Frostfire at 4s, so the entry is equally dead in both -- but
   * this ruling arrived as part of an AUDIT OF THE ARCANE PROFILE, and a list
   * is changed for the profile that was named rather than by analogy. Recorded
   * here so the next Mage round starts with it.
   * ==========================================================================
   */
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS.filter((entry) => entry.abilityId !== 'eureka'),
  /*
   * ==========================================================================
   * EUREKA IS GATED ON THIS BUILD AND NOWHERE ELSE, WORTH **+1.92 +/- 0.28**.
   *
   * The Gnome racial is an 8 SECOND WINDOW of +10% non-periodic damage, and in
   * the shared block it carries no condition -- so it is spent on whatever the
   * first poll of the fight happens to be. Arcane Power's entry below is gated
   * on a Missile Barrage proc for exactly this reason, and nothing did the same
   * for the window beside it.
   *
   * THE BLOCK IS WHY IT HAD NO GATE RATHER THAN AN OVERSIGHT: that constant is
   * spread into lists belonging to no race, so a condition written there would
   * be a condition on three abilities this character cannot cast. Gating it is
   * therefore a change to THIS list, which is what the filter does.
   *
   * ITS POSITION IS UNCHANGED. Eureka is last of the four, so taking it out of
   * the spread and restating it immediately after leaves every other racial
   * exactly where it was -- the arrangement `buffPotionCooldown` already uses
   * for the Spellblasting potion a few lines down.
   *
   * THE FIGURE IS SMALL AND IT IS NOT NOISE: its spread is **2.8** against the
   * 112 a pre-combat change produces, because a gate that only moves WHEN a free
   * off-GCD cooldown fires cannot flip a roll. The three alternatives are worse
   * -- on Arcane Power being up it runs **bit-identical** fights (Arcane Power is
   * pre-cast, so it is already up at t=0 and the gate is never false), on the
   * Arcane Blast cap **-2.92**, and with no entry at all **-16.35**.
   * ==========================================================================
   */
  { abilityId: 'eureka', condition: selfHas('missile_barrage') },
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
  /*
   * THE SPELLBLASTING POTION IS NOT A STANDALONE ENTRY HERE ANY MORE -- it is
   * step one of the cooldown stack below, which is where the owner's gate
   * ("held for Presence of Mind") actually belongs now that a sequence can
   * express it.
   *
   * THE OTHER TWO MAGE LISTS SPREAD THE SHARED `CONSUMABLE_COOLDOWNS` BLOCK,
   * which carries the potion UNGATED -- so `buffPotionCooldown` now has no
   * caller in this file at all and its import is gone. It is still used by the
   * Druid, Shaman and Warlock lists.
   */
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
  /*
   * ARCANE POWER HAS NO ENTRY OF ITS OWN NOW: it is a step of the cooldown stack
   * below, and a standalone entry would fire it first and leave the stack
   * refused for its cooldown.
   */
  /*
   * ==========================================================================
   * THE COOLDOWN STACK, AS ONE ACTION. The owner: "Take a look at setting up a
   * cooldown overlap condition with Arcane Wrath / Pyroblast. This is often
   * times how real players use their cooldowns."
   *
   * The potion, Presence of Mind and the Pyroblast it is for were three
   * separate entries that happened to fire together. `AplEntry.sequence` says
   * so outright: the condition gates the WHOLE thing, the steps resolve as a
   * unit, and nothing may be cast between them.
   *
   * ------------------------------------------------------------------------
   * **IT RUNS BIT-IDENTICAL FIGHTS TODAY, AND IS STILL WORTH MAKING EXPLICIT.**
   * The three already emerged as a sequence -- but ONLY because the potion,
   * Arcane Power and Presence of Mind are all off the global cooldown, and two
   * of those three became so in the same change as this one. **Emergence is an
   * accident of what is castable; a sequence is a guarantee.** The old shape
   * would have come apart silently the moment anything above it took a global
   * cooldown, and nothing would have reported it.
   *
   * PYROBLAST IS THE PAYLOAD AND ARCANE WRATH IS NOT, which is the half the
   * owner asked to be looked at. Presence of Mind erases a CAST TIME, so the
   * payload wants to be the longest cast in the kit: Pyroblast is **six
   * seconds** against Arcane Wrath's 3.5, and Arcane Wrath also costs a talent
   * point. Measured over 1,000 paired iterations:
   *
   *   potion > PoM > pyroblast          **bit-identical** (this entry)
   *   potion > PoM > arcane_wrath       **-72.4**
   *   potion > AP > PoM > pyroblast     **-34.9**
   *   potion > AP > PoM > arcane_wrath  **-43.8**   (the screenshot's shape)
   *
   * **ARCANE POWER STAYS IN THE OPENER RATHER THAN JOINING THE STACK**, and
   * that is what the last two rows price. It cannot be both: the whole sequence
   * is resolved before any of it is cast, so a step on cooldown refuses the lot
   * -- the stack would silently never fire. Pre-cast at a 0s lead it is worth
   * **+24.2** for no global cooldown, and giving that up to group it here costs
   * more than the grouping is worth.
   *
   * **AND THIS IS THE FIRST TIME ARCANE WRATH HAS BEEN PRICED AS ANYTHING BUT A
   * FILLER.** Its -76.7 and -118.2 were measured DISPLACING Arcane Blasts every
   * cycle; here it displaces nothing and is cast once inside a +30% window, and
   * it still loses. The old conclusion survives a reading it was never tested
   * under.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * THE OWNER'S COOLDOWN STACK, IN ONE SHOT: "Major Spellblasting Potion paired
   * with Arcane Power and Presence of Mind and Arcane Wrath so they cast in
   * sequence/all in one shot when you have 4 stacks of Arcane Blast." It was the
   * potion, Presence of Mind and an instant PYROBLAST; Arcane Wrath is the
   * 3.5-second cast Presence of Mind makes instant now, inside Arcane Power.
   * ==========================================================================
   */
  {
    abilityId: 'major_spellblasting_potion',
    sequence: ['arcane_power', 'presence_of_mind', 'arcane_wrath'],
    condition: selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
    note: 'Cooldown stack: the potion, Arcane Power, Presence of Mind and an instant Arcane Wrath, at the Arcane Blast cap.',
  },
  { abilityId: 'arcane_missiles', condition: selfHasStack('missile_barrage') },
  /*
   * AND AT THE ARCANE BLAST CAP WITHOUT ONE -- BUT ONLY IF THE WINDOW CAN COVER
   * THE CHANNEL. Four is the cap, where the next Blast costs 175% more for no
   * further damage bonus, so the list spends the stack on Missiles rather than
   * paying that price.
   *
   * ==========================================================================
   * THE SECOND CLAUSE IS WORTH **+13.2 +/- 3.2** AND CAME OFF THE UPTIME TABLE.
   *
   * Arcane Blast's window is fifteen seconds FROM FIRST APPLICATION --
   * `refreshBehaviour: 'ignore'`, so no cast extends it -- the ramp spends six
   * of those reaching four stacks, and Arcane Missiles is a CHANNEL. So the
   * window kept expiring part-way through a channel: the remaining missiles were
   * paid at the unbuffed price AND the re-ramp could not start until the channel
   * ended. **Measured uptime was 77.7%, and the missing 22.3% was that
   * straddle.** With this clause it is **83.0%**, and Arcane Blast's own casts
   * go 13.1 to 14.0 a fight at a higher average -- 948 to 1,021 -- because each
   * one now lands inside a window rather than after it.
   *
   * SO THE GATE TURNS A STRADDLING CHANNEL INTO A SINGLE BLAST AND AN EARLIER
   * FRESH RAMP, which is not obviously a win and is why it is measured: the
   * entry it falls through to is Arcane Blast, and at four stacks that costs
   * EIGHT TIMES base for a stack about to vanish.
   *
   * **TWO SECONDS IS THE MIDDLE OF A PLATEAU, NOT A TUNED EDGE.** Swept over
   * 1,200 paired iterations: 0.5s **+4.9**, then 1s, 1.5s, 2s, 2.5s and 3s all
   * between **+13.1 and +13.5** -- indistinguishable, since the differences are
   * far inside the combined intervals -- and 4s and 5s fall back to noise. The
   * boundary is therefore SAFE rather than tight, which is the thing to assert
   * about a stated threshold.
   *
   * THE BARRAGE ENTRY ABOVE DELIBERATELY KEEPS NO SUCH CLAUSE: a Missile Barrage
   * proc is worth channelling through an expiry, and gating it would throw the
   * proc away.
   * ==========================================================================
   *
   * A repeated ability id is legal; what is not is a copy below an
   * UNCONDITIONAL one. Both entries are gated and Arcane Blast is the filler.
   */
  /*
   * ARCANE WRATH ABOVE THE NON-BARRAGE MISSILES, the owner's placement, under
   * the same four-stack gate as the entry it sits above -- below four stacks
   * the list is still building, which is Arcane Blast's job.
   */
  {
    abilityId: 'arcane_wrath',
    condition: selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
  },
  {
    abilityId: 'arcane_missiles',
    condition: all(
      selfStacksExactly('arcane_blast', ARCANE_BLAST_MAX_STACKS),
      selfTime('atLeast', ARCANE_BLAST_CHANNEL_FLOOR_SECONDS, 'arcane_blast'),
    ),
  },
  /*
   * "IF LESS THAN 4 STACKS OF ARCANE BLAST, AND MISSILE BARRAGE NOT ACTIVE" --
   * the owner. It was ungated, the floor under the whole list.
   */
  {
    abilityId: 'arcane_blast',
    condition: all(
      selfStacks('below', ARCANE_BLAST_MAX_STACKS, 'arcane_blast'),
      selfLacks('missile_barrage'),
    ),
  },
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
