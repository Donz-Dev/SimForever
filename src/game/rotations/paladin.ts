import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS, RACIAL_DEFENSIVE_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_COOLDOWNS, CONSUMABLE_HEALS } from './consumableCooldowns';
import {
  all,
  any,
  castsInstantly,
  compileRotation,
  not,
  ready,
  selfHas,
  selfHealth,
  selfMissing,
  selfTime,
} from './apl';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Paladin priority lists.
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
 * CHOSEN BY TALENTS, the Rogue and Mage arrangement. A Paladin's combat style
 * does separate Protection -- it is the only one holding a shield -- but it
 * cannot tell Seal Twist Retribution from Shockadin, which are both two-hander
 * builds differing only in where their points went.
 * ----------------------------------------------------------------------------
 */


/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. All three lists below are theirs; what was
 * here before was this file's own guess and said so.
 * ============================================================================
 */


/** "<buff> is not active", on the Paladin. */
const selfExpired = (auraId: string) => selfTime('atMost', 0, auraId);

/** "<buff> is active", on the Paladin. */
const selfActive = selfHas;

/*
 * ============================================================================
 * "ANY SEAL IS UP" IS GONE, AND SAYING SO IS THE POINT.
 *
 * It was `any(...SEAL_AURA_IDS.map(selfHas))` -- built from the SAME array
 * `activeSeal` walks, so it asked Judgement's own `canCast` question and
 * stayed the same question when a seal was added.
 *
 * ITS ONE CALLER WAS THE PROTECTION LIST'S SWIFT JUDGEMENT, and the owner has
 * replaced the clause with a specific seal. For that build the two select the
 * same states -- it applies no other seal -- so what was lost is generality
 * rather than behaviour, and the generality was only ever used once.
 *
 * IF A LIST WANTS IT AGAIN, rebuild it from `SEAL_AURA_IDS` rather than
 * writing the disjunction out: that is the half worth keeping, and it is why
 * this note names the array instead of just deleting the line.
 * ============================================================================
 */

/** "hit points <= N% of maximum". */
const healthAtMostFraction = (fraction: number) => selfHealth('atMost', fraction);

/**
 * "<ability> is on cooldown", which the Protection list gates Swift Judgement
 * on -- it is the fallback for the window where the real Judgement cannot go.
 */
/*
 * `not(ready(...))` AND NOT `onCooldown(...)`, which differ on an ability the
 * build never learned: `isReady` is false for an absent ability, so this
 * closure reported one as permanently on cooldown. Preserved exactly rather
 * than quietly corrected -- this commit changes no behaviour, and the Paladin
 * lists only ask it about Judgement, which every build has.
 */
const abilityOnCooldown = (abilityId: string) => not(ready(abilityId));

/**
 * "...and the build made this ability INSTANT", which only Instrument of Law
 * at 2/2 does, and only to Hammer of Wrath.
 *
 * ----------------------------------------------------------------------------
 * THE RULE READS THE ABILITY RATHER THAN THE BUILD, which is how Vanguard gates
 * Charge: the talent changes the character's own copy of the ability, and the
 * condition asks the copy. Naming the talent here would put a second copy of
 * "which rank makes it instant" in a file that has no other business knowing.
 *
 * WHY THE ENTRY IS GATED AT ALL. The ruleset owner wants Hammer of Wrath in this
 * list only as the instant ranged attack 2/2 turns it into. At 1/2 or 0/2 it
 * still has a cast, and a cast on a melee Paladin throws away the swing in
 * progress -- a different ability at a different price, which the owner has not
 * asked for.
 * ----------------------------------------------------------------------------
 */


const either = any;

/*
 * ----------------------------------------------------------------------------
 * "HAMMER OF WRATH IF COMBAT DURATION <= 20%" IS THE EXECUTE PHASE, and the
 * ability already enforces it: its "only usable on enemies that have 20% or
 * less health" is modelled as the CLOCK by the ruleset owner's earlier ruling,
 * the same one Execute runs on. `inExecutePhase` is the shared rule.
 *
 * So the entry needs no condition of its own. Stated rather than left blank,
 * because an entry with no condition in a list whose spec gave it one reads as
 * a dropped clause.
 *
 * AND IT STILL NEVER FIRES IN RETRIBUTION, FOR A REASON THAT IS NOT THE GATE.
 * The window opens on schedule -- `paladinAbilities.test.ts` pins that, and the
 * Shockadin list casts the same entry 0.3 times a fight. What refuses it here is
 * MANA: sampling `checkCast` every half second through the execute phase gives
 * 22 refusals for `not_enough_resource` against 3 for `on_gcd`, because this
 * build spends 3425 of the 3449 mana it gains and a 425-mana ability that only
 * becomes legal in the last fifth arrives with nothing left to pay with. The
 * Shockadin affords it on 4129 gained.
 *
 * LEFT AS IS. Reordering does not conjure mana, and whether Hammer of Wrath is
 * worth more per mana than the Judgement or Holy Strike it would displace is a
 * measurement nobody has taken. Written down so the next reader does not spend
 * the afternoon on the gate, which is where this one was first looked for.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------

/**
 * SEAL TWIST RETRIBUTION — the capstone made into a rotation.
 *
 * ----------------------------------------------------------------------------
 * TWIST OF LIGHT IS WHY THIS LIST LOOKS ODD. Replacing a seal with a different
 * one grants an Echo, and the next melee attack applies the REPLACED seal's
 * effects on top of the new one's. So a Paladin with the capstone wants to be
 * swapping seals rather than settling on one -- which is the opposite of every
 * other class's "put the buff up and leave it".
 *
 * THE CYCLE: Seal of Command is the seal worth echoing, because its echo is a
 * GUARANTEED 70%-of-weapon-damage hit rather than a rolled one. So the list
 * keeps Command up, and swaps to the Crusader when its judgement debuff is
 * missing -- which both refreshes that debuff and leaves an Echo of Command
 * behind for the next swing.
 *
 * JUDGEMENT DOES NOT CONSUME THE SEAL in Forever, so it is simply cast on
 * cooldown and the seal underneath is untouched. That is the single biggest
 * difference from how a Classic paladin plays, and it is what makes this list
 * a priority list rather than a scripted sequence.
 * ----------------------------------------------------------------------------
 */
export const PALADIN_RETRIBUTION: AplList = {
  name: 'Paladin (Seal Twist Ret)',
  entries: [
  /*
   * SEAL OF THE CRUSADER IS OUT OF THIS LIST, by the owner: "Remove Seal of the
   * Crusader from the APL." It opened the fight to judge the Crusader debuff,
   * which the raid buff `judgement_of_the_crusader` now supplies on every
   * preset for the whole fight.
   */
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
  { abilityId: 'judgement' },
  { abilityId: 'holy_strike' },
  /*
   * HAMMER OF WRATH, AND ONLY THE INSTANT ONE. Instrument of Law at 2/2 takes
   * the whole second off its cast, and the ruleset owner's ruling is that what
   * is left is an instant RANGED attack scaling with SPELL POWER. This build
   * takes the talent at 2/2.
   *
   * THE CONDITION IS FOR THE BUILD THAT DOES NOT. At 1/2 or 0/2 the ability
   * still has a cast, and a cast on a melee Paladin throws away the swing in
   * progress -- a different ability at a different price, which the owner has
   * not asked this list to pay. **The Shockadin's entry is deliberately NOT
   * gated**: that build takes no Instrument of Law, casts the one-second version
   * about twice a fight, and the owner's instruction named this profile.
   */
  { abilityId: 'hammer_of_wrath', condition: castsInstantly('hammer_of_wrath') },
  { abilityId: 'consecration' },
  /*
   * THE TWIST, AND IT IS THE LAST TWO ENTRIES RATHER THAN THE FIRST. Each seal
   * is cast only while the OTHER one is up and its own echo is not -- so the
   * pair alternates, and neither can fire twice in a row or overwrite an echo
   * that has not been spent.
   *
   * `echo_<sealId>` is what replacing a seal leaves behind, and the next melee
   * attack applies the REPLACED seal's effects on top of the new one's. That is
   * why a Paladin with the capstone wants to keep swapping rather than settle,
   * and why these two entries are a cycle rather than a preference.
   */
  {
    abilityId: 'seal_of_command',
    condition: either(
      /*
       * THE SEED, and without it the cycle below can never start. The owner's
       * two conditions are mutually dependent -- Command wants Righteousness
       * up, Righteousness wants Command up -- and after the opening Seal of
       * the Crusader NEITHER is, so both entries fired zero times and the
       * profile named "Seal Twist" ran a whole fight on one seal.
       *
       * Nothing errored. Two tests caught it only because they assert the
       * invariant that every Paladin build keeps a seal up and judges it.
       *
       * The ruleset owner chose Command to start the cycle. This clause is the
       * only addition to their order.
       */
      all(not(selfActive('seal_of_command')), not(selfActive('seal_of_righteousness'))),
      all(
        selfActive('seal_of_righteousness'),
        not(selfActive('echo_seal_of_righteousness')),
      ),
    ),
  },
  {
    abilityId: 'seal_of_righteousness',
    condition: all(selfActive('seal_of_command'), not(selfActive('echo_seal_of_command'))),
  },
  ],
};

/**
 * SHOCKADIN — a Retribution body with a Holy head.
 *
 * 23/0/28, and the Holy half buys exactly one damaging spell: Holy Shock, on a
 * ten-second cooldown for 325 mana. Everything else the tree gives this build
 * is healing, crit chance and mana.
 *
 * SO IT IS RETRIBUTION'S LIST WITH HOLY SHOCK IN IT, which is an honest
 * description of the build rather than a shortcut. It has no Twist of Light --
 * that is a 31-point Retribution talent and this build stops at 28 -- so the
 * seal swapping above buys it nothing, and it puts up one seal and leaves it.
 *
 * IT IS ALSO THE LIST AN UNTALENTED PALADIN RUNS, because every ability in it
 * is a trainer ability.
 */
export const PALADIN_SHOCKADIN: AplList = {
  name: 'Paladin (Shockadin)',
  entries: [
  /*
   * SEAL OF THE CRUSADER IS OUT OF THIS LIST, by the owner: "Remove Seal of the
   * Crusader from the APL." It opened the fight to judge the Crusader debuff,
   * which the raid buff `judgement_of_the_crusader` now supplies on every
   * preset for the whole fight.
   */
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
  { abilityId: 'judgement' },
  /*
   * SEAL OF RIGHTEOUSNESS, NOT COMMAND, AND NOT BY PREFERENCE. Seal of
   * Command is a 21-point Retribution talent and this build stops at 28 in
   * that tree WITHOUT taking it -- so a Shockadin simply does not have it.
   *
   * The first version of this list asked for Command anyway. The ability was
   * not in the book, the entry fell through, NO seal was ever cast, and
   * Judgement's `canCast` then refused every single time because it needs one
   * -- so the build silently lost both its seal damage and its Judgement.
   * Nothing errored; the DPS was simply lower than it should have been.
   */
  { abilityId: 'seal_of_righteousness', condition: selfExpired('seal_of_righteousness') },
  /*
   * ==========================================================================
   * DIVINE FAVOR ABOVE HOLY SHOCK, which is where the owner put it -- AND THE
   * POSITION IS NOW WORTH NOTHING EITHER WAY, which is the interesting part.
   *
   * THE ARGUMENT THAT PUT IT HERE WAS WRONG AND THE PLACE WAS RIGHT. It read:
   * the buff is "your NEXT Holy Shock", so arming it below the spell it arms
   * wastes a global cooldown. `DIVINE_FAVOR.durationMs` is **0** -- the aura
   * lasts until it is SPENT -- so the next Holy Shock collects the crit
   * whether Divine Favor was cast one global cooldown earlier or thirty
   * seconds earlier. Position decided only WHEN the global cooldown was paid.
   *
   * AND THEN THE OWNER RULED THAT IT PAYS NONE: "the Divine Favor
   * talent/cooldown doesn't trigger the global cooldown." Measured at 3,000
   * paired iterations after that change, the top of the list, above
   * Consecration, above Judgement and the very bottom are **all inside +/-2.2
   * of each other** -- so this is a free choice and the owner's own order is
   * what it falls back to.
   *
   * WHAT IS NOT FREE IS HAVING IT AT ALL: removing the entry measures
   * **-9.7**. Off the global cooldown the ability costs one `ROTATION_POLL_MS`
   * and buys a guaranteed Holy Shock crit, which is the same trade the racials
   * and the mid-fight consumables make at the top of this list.
   * ==========================================================================
   */
  { abilityId: 'divine_favor' },
  /*
   * ==========================================================================
   * CONSECRATION ABOVE THE TWO TEN-SECOND STRIKES, which is where it was NOT,
   * and it is worth **+14** on the two-hander and **+14** on the shield build.
   *
   * IT IS NOT ABOUT CONSECRATION'S OWN DAMAGE. The ability is on an eight
   * second cooldown with an eight second ground effect, so at the bottom of
   * the list it fired 6.0 times in a sixty second fight where 7.5 fit -- every
   * cycle it lost a global cooldown to Holy Shock or Holy Strike, and the
   * debuff spent a quarter of the fight off the target.
   *
   * AND CONSECRATED GROUND IS WHAT MAKES THAT EXPENSIVE. The talent is "+10%
   * Holy damage against enemies in your Consecration", carried by the ground
   * effect's own debuff -- so the gap in its uptime is a gap in a multiplier
   * on three quarters of this build's damage, not just in one ability's ticks.
   * The two changes are each worth about fifty on their own and the list order
   * is what lets the talent collect.
   *
   * NOT ABOVE JUDGEMENT, which was measured and is **-9**: Judgement is on an
   * eight second cooldown too, it carries the largest single coefficient this
   * build has, and it is what keeps Judgement of the Crusader's +161 Holy
   * spell power on the target.
   * ==========================================================================
   */
  { abilityId: 'consecration' },
  { abilityId: 'holy_shock' },
  { abilityId: 'holy_strike' },
  /*
   * HAMMER OF WRATH LAST, and here it is the ONE-SECOND version: Instrument of
   * Law is tier 25 in Retribution and neither Shockadin can afford it -- taking
   * it costs both of Holy's tier-20 slots and measures **-41**. So this entry
   * pays a cast that resets the swing timer on a build that is half swing
   * damage, and is still worth having: dropping it measures **-20**, and the
   * bottom of the list is where that cast is cheapest.
   */
  { abilityId: 'hammer_of_wrath' },
  ],
};

/**
 * PROTECTION — Holy Shield up, Consecration down, Holy Strike on cooldown.
 *
 * THE ONLY PALADIN PROFILE THAT IS HIT BACK, which is what makes Redoubt,
 * Reckoning and Seal of Fury's absorb mean anything at all. It is also the
 * profile that loses most to threat not being modelled: six of its talents are
 * threat, and a tank's whole job is threat.
 *
 * SEAL OF FURY RATHER THAN COMMAND, because it is the tanking seal -- a flat
 * 35 Holy on every swing plus an absorb, against Command's rolled burst. The
 * build takes Improved Seal of Fury, which says which one it means to use.
 */
export const PALADIN_PROTECTION: AplList = {
  name: 'Paladin (Protection)',
  entries: [
  /*
   * ==========================================================================
   * SEAL OF RIGHTEOUSNESS IS THE ONLY SEAL IN THIS LIST NOW, and it replaces
   * TWO entries: the Seal of the Crusader that opened it and the Seal of Fury
   * that was maintained below Swift Judgement.
   *
   * THE OWNER'S LIST, AND IT SIMPLIFIES THE SEAL STORY TO ONE LINE. What went
   * with Seal of the Crusader is its Judgement of the Crusader debuff -- the
   * +Holy damage taken that the opener existed to apply -- and what went with
   * Seal of Fury is its rage-equivalent clause. Both are the owner's to spend.
   *
   * "IS NOT UP" AND NOT "HAS RUN OUT", which the panel distinguishes and this
   * project does too: an aura can be PRESENT with nothing left on it. Here the
   * difference is real rather than cosmetic -- JUDGEMENT CONSUMES THE SEAL, so
   * what this entry mostly reacts to is a seal that was spent rather than one
   * that expired, and `auras.has` is the test that sees that immediately.
   * ==========================================================================
   */
  {
    abilityId: 'seal_of_righteousness',
    condition: selfMissing('seal_of_righteousness'),
  },
  /*
   * RIGHTEOUS FURY: +90% threat from Holy attacks, tracked since round 47 --
   * this said "+60%, and threat is permanently out of scope" until then. The
   * Protection Paladin casts it at the pull, which is also what switches
   * Instrument of Law's reduction OFF for a build that takes that talent.
   */
  { abilityId: 'righteous_fury', condition: selfExpired('righteous_fury') },
  { abilityId: 'holy_shield', condition: selfExpired('holy_shield') },
  { abilityId: 'templars_bulwark', condition: healthAtMostFraction(0.35) },
  /*
   * THE TWO HEALS, WITH THE REST OF THE SURVIVAL COOLDOWNS -- WHICH IS *NOT*
   * WHERE THIS LIST PUTS THE OTHER FREE ENTRIES.
   *
   * The racial and consumable cooldowns sit LAST in a tank list, because "100ms
   * is not free to a tank at thirty percent health". A healing potion is the one
   * free entry that argument does not reach: the bottom of a tank list is a
   * place entries are not REACHED, and something above is nearly always
   * castable -- which is how five of seven racials came back inert.
   *
   * So they go here, beside the cooldowns that answer the same question, and
   * below them because those are the bigger answer. See `CONSUMABLE_HEALS`.
   */
  ...CONSUMABLE_HEALS,
  /*
   * ==========================================================================
   * AND THE MID-FIGHT CONSUMABLES COME OFF THE BOTTOM OF THIS TANK LIST, which
   * is the owner's order and is the SECOND tank list to move them this round --
   * the Bear's Mighty Rage Potion made the same journey.
   *
   * THE TANK RULE PUTS FREE ENTRIES LAST, on a measured argument: "100ms is not
   * free to a tank at thirty percent health". What that rule costs is REACH,
   * and this file already records the price next door -- five of seven racials
   * came back inert at the bottom of a tank list, because something above is
   * nearly always castable and the list never falls that far.
   *
   * SO THIS IS THE HEALS' OWN ARGUMENT, APPLIED ONE CATEGORY ALONG. They are
   * directly above for exactly this reason; the owner has decided the
   * Spellblasting Potion belongs with them rather than beneath Consecration.
   *
   * THE RACIALS STAY AT THE BOTTOM. They were not named, and the two groups
   * were separated for a reason -- a racial is a flat buff window with nothing
   * to line it up against, where a potion the owner has placed is a decision.
   * ==========================================================================
   */
  ...CONSUMABLE_COOLDOWNS,
  { abilityId: 'judgement' },
  /*
   * SWIFT JUDGEMENT IS A SECOND JUDGEMENT, BACK TO BACK, which is the whole
   * point of it: Judgement, then this, then Judgement again. It is OFF the
   * global cooldown as of the owner's ruling, so the two really are
   * consecutive rather than 1.5 seconds apart.
   *
   * --------------------------------------------------------------------------
   * ITS GATE USED TO NAME SEAL OF FURY, and that cost it the back-to-back. The
   * Protection opener was Seal of the Crusader, judge, THEN Seal of Fury -- so
   * at the first moment Judgement was on cooldown the named seal was not up
   * yet, the entry fell through, and Swift Judgement went a global cooldown
   * later than it had to.
   *
   * IT NAMES SEAL OF RIGHTEOUSNESS NOW, which is the owner's clause and is the
   * same rule one seal narrower: this list applies no other seal, so "any seal"
   * and "Seal of Righteousness" select the same states for this build. The
   * requirement it restates is Judgement's own -- `canCast` refuses without a
   * seal, so resetting a one-minute cooldown for a Paladin carrying none would
   * waste the cooldown rather than a global.
   *
   * ==========================================================================
   * THE READING OF THAT CLAUSE IS A CHOICE AND IS FLAGGED. The owner's panel
   * draws it as a NEGATABLE GROUP around "Seal of Righteousness is up", and
   * whether that group's own NOT is set is not legible in the screenshot. The
   * two readings are not close:
   *
   *   seal IS up    this entry, and the one implemented. Judgement consumes
   *                 the seal, so a Judgement is available the moment the seal
   *                 is back -- and the seal entry is FIRST in the list, so it
   *                 is back on the very next decision.
   *   seal is NOT   permanently dead. The seal entry at the top of the list
   *                 re-applies the seal before anything can reach row eight,
   *                 so the clause would be false every time it was evaluated.
   *
   * IMPLEMENT THE READING THAT LEAVES EVERY CLAUSE DOING WORK -- this
   * project's own rule, the one that settled "Scorch if the debuff <= 5" and
   * the Seal Twist cycle that had no entry point. Both of those were a
   * specification read literally disabling itself, and both looked fine.
   * ==========================================================================
   */
  {
    abilityId: 'swift_judgement',
    condition: all(abilityOnCooldown('judgement'), selfHas('seal_of_righteousness')),
  },
  { abilityId: 'holy_strike' },
  { abilityId: 'consecration' },
    /*
   * THE RACIAL COOLDOWNS LAST, WHICH IS A TANK LIST'S OWN RULE.
   *
   * Everywhere else they sit second -- high enough to fire, below whatever
   * opens the list. A TANK LIST PUTS THEM LAST INSTEAD, and the reason is the
   * one `protectionRotation.test.ts` already states about Charge: an entry
   * above a survival cooldown "would cost a survival cooldown the moment it was
   * needed". A racial is free and off the global cooldown, but casting one
   * still moves the next decision 100ms out -- and 100ms is not free to a tank
   * at thirty percent health taking twelve thousand a swing.
   *
   * WHAT IT COSTS: the four offensive racials may not fire at all here, because
   * a tank list rarely falls this far. That is the right trade for a build
   * whose figure of merit is a DEATH COUNT, and it is worth 0.0 to all three
   * tank presets either way -- prot_warr and druid_bear are Tauren and
   * prot_pally is Human, so not one of them learns an active racial. Stoneform
   * is the one a tank would actually want, and at the bottom it fires when
   * nothing more pressing can, which is the honest policy for a ten percent
   * reduction that costs a global cooldown.
   */
  ...RACIAL_COOLDOWNS,
  ...RACIAL_DEFENSIVE_COOLDOWNS,
],
};

/**
 * HOLY -- the owner's Holy Pal, the project's first HEALER list (round 52).
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S FOUR LINES, IN THEIR ORDER:
 *
 *   1. Holy Light on the tank below 65%
 *   2. Holy Shock on the tank below 30%
 *   3. Flash of Light on any other raid member below 70%
 *   4. Flash of Light on the tank below 100%
 *
 * "LESS THAN" IS `below`, strict. Each entry names its TARGET, and its
 * condition reads `health` on that target -- so line 3 picks the raid member
 * with the least health that is not the tank and casts only if that one is
 * under 70%.
 *
 * LINE 2 SITS UNDER LINE 1 ON PURPOSE AND WILL RARELY FIRE: a tank under 30% is
 * also under 65%, so Holy Light wins whenever it is castable, and Holy Shock is
 * reached only while Holy Light is not -- out of mana, or mid-cast with the
 * instant behind it. That is the order the owner gave and it is kept; whether
 * the instant should go first is a question for them, recorded in HANDOVER.
 * ----------------------------------------------------------------------------
 */
export const PALADIN_HOLY: AplList = {
  name: 'Paladin (Holy)',
  entries: [
    /*
     * THE SHARED FREE ENTRIES FIRST, ABOVE THE OWNER'S FOUR -- the racials and
     * the mana potion and Demonic Rune, each gated as every other list gates
     * them. Free and off the global cooldown, so they cost the heals nothing;
     * at the BOTTOM they would never be reached, because line four is castable
     * whenever the tank is below full, which is nearly always.
     */
    ...RACIAL_COOLDOWNS,
    ...CONSUMABLE_COOLDOWNS,
    {
      abilityId: 'holy_light',
      target: { kind: 'tank' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.65 },
    },
    {
      abilityId: 'holy_shock',
      target: { kind: 'tank' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.3 },
    },
    {
      abilityId: 'flash_of_light',
      target: { kind: 'lowestHealth', excludeTank: true },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.7 },
    },
    {
      abilityId: 'flash_of_light',
      target: { kind: 'tank' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 1 },
    },
    /*
     * THE PRE-CAST (round 53), the owner's: whenever nothing above is castable
     * a Holy Light is started on the tank, and at 80% through it is cancelled
     * if the tank is still above 95%. Last, because it is what fills downtime;
     * anything above it is a heal that is needed now.
     */
    {
      abilityId: 'holy_light',
      target: { kind: 'tank' },
      cancel: {
        atFraction: 0.8,
        condition: { kind: 'health', on: 'target', compare: 'above', fraction: 0.95 },
      },
      note: 'Pre-cast: cancelled at 80% of the cast if the tank is above 95%.',
    },
  ],
};

export const PALADIN_HOLY_ROTATION: Rotation = compileRotation(PALADIN_HOLY);
export const PALADIN_RETRIBUTION_ROTATION: Rotation = compileRotation(PALADIN_RETRIBUTION);
export const PALADIN_SHOCKADIN_ROTATION: Rotation = compileRotation(PALADIN_SHOCKADIN);
export const PALADIN_PROTECTION_ROTATION: Rotation = compileRotation(PALADIN_PROTECTION);

/**
 * Which list a Paladin runs.
 *
 * PROTECTION BY ITS CAPSTONE, the Rogue's test: Holy Shield is a 31-point
 * Protection talent and no other build can reach it.
 *
 * THEN THE TWO RETRIBUTION BUILDS BY THEIRS. Seal Twist takes Twist of Light
 * at 31 points; Shockadin stops at 28 and takes Holy Shock instead. Both tests
 * name a capstone rather than counting points, because here a capstone
 * genuinely does separate them -- unlike the Mage, whose Frostfire build has
 * none at all.
 */
export function paladinRotation(talents: TalentAllocation): Rotation | undefined {
  if ((talents.holy_shield ?? 0) > 0) return PALADIN_PROTECTION_ROTATION;
  if ((talents.twist_of_light ?? 0) > 0) return PALADIN_RETRIBUTION_ROTATION;
  // The Holy capstone: a 31-point Holy build heals (round 52).
  if ((talents.light_s_vigil ?? 0) > 0) return PALADIN_HOLY_ROTATION;
  if ((talents.holy_shock ?? 0) > 0) return PALADIN_SHOCKADIN_ROTATION;
  /*
   * A Paladin with none of the three still fights, and gets the SHOCKADIN
   * list -- which is the one written entirely out of trainer abilities. The
   * Retribution list asks for Seal of Command, a talent an untalented paladin
   * does not have, and a paladin with no seal cannot Judge either.
   */
  return PALADIN_SHOCKADIN_ROTATION;
}
