import type { Rotation } from '../../engine';
import type { AplEntry, AplList } from './apl';
import { RACIAL_COOLDOWNS, RACIAL_DEFENSIVE_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_HEALS, consumableCooldowns } from './consumableCooldowns';
import {
  all,
  any,
  castsInstantly,
  compileRotation,
  fightRemaining,
  not,
  resourceFraction,
  selfHas,
  selfHealth,
  selfMissing,
  selfStacks,
  selfTime,
  swungWithin,
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

/**
 * "...and the build made this ability INSTANT", which only Champion of the
 * Light at 5/5 does, and only to Hammer of Wrath (Instrument of Law until
 * 1.60.1.70707, when that talent was removed and its cast time moved here).
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

/**
 * Seal Twist's cycle, the owner's choice of three measured: three attacks under
 * Seal of Righteousness, then one under Seal of Command, counted as the copies
 * each has STORED -- every landed attack stores one, so a copy is an attack.
 */
export const SEAL_TWIST_RIGHTEOUSNESS_ATTACKS = 3;
export const SEAL_TWIST_COMMAND_ATTACKS = 1;

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

/**
 * THE POTION PAIR (round 80), the owner's round 79 rule: a Primary and a
 * Secondary Potion that share the two-minute potion cooldown, and the LIST
 * decides which is drunk when. The shared group with its two potion entries
 * replaced, so every other consumable keeps the shared gate and note.
 *
 * ----------------------------------------------------------------------------
 * A 120 s FIGHT HOLDS ONE POTION, because the cooldown is two minutes and the
 * report's fights are 114 to 126 s long. So the decision is WHICH ONE, and it
 * is made by the two gates rather than by the order:
 *
 *   the mana potion     under `manaFraction` of the pool, as the shared gate is
 *   Spellblasting       only in the last `spellblastingSeconds` of the fight,
 *                       which is where it lands on a build that never needs
 *                       the mana -- and never on one that drank the mana potion
 *                       already, because the cooldown is shared.
 *
 * The Multi Target lists (60 s and 30 s fights) drink Spellblasting at the pull
 * instead; see `profiles/multiTarget/paladin.ts`.
 * ----------------------------------------------------------------------------
 */
export function paladinPotionPair(options: {
  readonly manaFraction: number;
  readonly spellblastingSeconds: number;
}): readonly AplEntry[] {
  const { manaFraction, spellblastingSeconds } = options;
  return [
    {
      abilityId: 'major_mana_potion',
      condition: resourceFraction('atMost', manaFraction, 'mana'),
      note: `Primary or Secondary: drunk under ${manaFraction * 100}% mana. Shares the potion cooldown with Spellblasting.`,
    },
    {
      abilityId: 'major_spellblasting_potion',
      condition: fightRemaining('atMost', spellblastingSeconds),
      note: `40 spell power for 30s, in the last ${spellblastingSeconds}s only -- unless the mana potion already took the shared cooldown.`,
    },
    ...consumableCooldowns({ exclude: ['major_mana_potion', 'major_spellblasting_potion'] }),
  ];
}

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
  /*
   * ROUND 80: THE POTION PAIR. Mana under the shared 30%, Spellblasting only in
   * the last 30 s -- which at 120 s is never, because this build always drinks
   * the mana potion first (+42 in round 78) and the cooldown is shared: the pair
   * ran bit-identical fights to the mana potion alone. Spellblasting at the
   * pull instead is -32.72 +/- 5.80. It is here for a fight that does not run
   * dry, and the Multi Target list drinks it at the pull (+17.00 at 8 targets).
   */
  ...paladinPotionPair({ manaFraction: 0.3, spellblastingSeconds: 30 }),
  ...CONSUMABLE_HEALS,
  /*
   * HAMMER OF WRATH, AND ONLY THE INSTANT ONE. Champion of the Light at 5/5
   * takes the whole second off its cast (Instrument of Law did, until
   * 1.60.1.70707), and the ruleset owner's ruling is that what is left is an
   * instant RANGED attack scaling with SPELL POWER.
   *
   * THE CONDITION IS FOR THE BUILD THAT DOES NOT. Short of 5/5 the ability
   * still has a cast, and a cast on a melee Paladin throws away the swing in
   * progress -- a different ability at a different price, which the owner has
   * not asked this list to pay. **The Shockadin's entry is deliberately NOT
   * gated**: that build does not reach 5/5, casts the one-second version
   * about twice a fight, and the owner's instruction named this profile.
   */
  /*
   * ABOVE JUDGEMENT SINCE ROUND 78: it is legal only in the last fifth of the
   * fight, on a six second cooldown, and at 120 s it is the best damage per
   * mana this build has -- +3.73 +/- 2.07 paired over 400 fights at 120 s.
   */
  { abilityId: 'hammer_of_wrath', condition: castsInstantly('hammer_of_wrath') },
  { abilityId: 'judgement' },
  { abilityId: 'holy_strike' },
  { abilityId: 'consecration' },
  /*
   * THE TWIST, UNDER UNSEALED WRATH (1.60.1.70707): THREE ATTACKS UNDER SEAL OF
   * RIGHTEOUSNESS, THEN ONE UNDER SEAL OF COMMAND, REPEAT. Every landed attack
   * stores a copy of the active seal; an attack under the other seal fires every
   * stored copy. So Command goes up once Righteousness has stored three copies,
   * and its one attack fires all three as Righteousness hits -- Righteousness
   * hits on every attack, so a copy of it is a guaranteed hit -- and stores one
   * Command copy, which the first attack back under Righteousness rolls.
   *
   * THE OWNER CHOSE IT OUT OF THREE, measured paired at 400 fights against
   * "3 Command then 1 Righteousness":
   *
   *   3 Righteousness, 1 Command    +84.50 (60 s)   +80.31 (120 s)   +77.34 (240 s)
   *   1 Command, then 3 and 3       +48.89          +42.37           +59.93
   *
   * so it wins at every clock. `tools/optimise/sealTwist707.ts`.
   *
   * THE SEED IS RIGHTEOUSNESS: with neither seal up, it starts the cycle -- and
   * the opener puts it up last before the pull, so the fight starts under it.
   */
  {
    abilityId: 'seal_of_command',
    condition: all(
      selfActive('seal_of_righteousness'),
      selfStacks(
        'atLeast',
        SEAL_TWIST_RIGHTEOUSNESS_ATTACKS,
        'unsealed_wrath_seal_of_righteousness',
      ),
    ),
  },
  {
    abilityId: 'seal_of_righteousness',
    condition: either(
      all(not(selfActive('seal_of_command')), not(selfActive('seal_of_righteousness'))),
      all(
        selfActive('seal_of_command'),
        selfStacks('atLeast', SEAL_TWIST_COMMAND_ATTACKS, 'unsealed_wrath_seal_of_command'),
      ),
    ),
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
 * description of the build rather than a shortcut. It has no Unsealed Wrath --
 * that is the 31-point Retribution talent and this build stops short -- so the
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
  /*
   * ROUND 80: THE POTION PAIR. This build ends 120 s with 7-16% of its mana
   * spare, so the mana potion (under 20%) is the safety net and Spellblasting
   * is what is drunk -- in the last 45 s rather than at the pull, +0.25 +/-
   * 0.04 on both Shockadins over 800 paired fights (last 30 s: +0.30 on the
   * shield build, +0.01 on the two-hander; last 60 s and 80 s: +0.04, +0.11).
   * At under 30% the two-hander drinks the mana potion and loses the window:
   * -2.99 +/- 1.54. The Multi Target list drinks Spellblasting at the pull.
   */
  ...paladinPotionPair({ manaFraction: 0.2, spellblastingSeconds: 45 }),
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
   * damage, and the bottom of the list is where that cast is cheapest.
   *
   * ONLY WITHIN 300ms OF A MAIN-HAND SWING (round 56b), the owner's call. A
   * cast holds the swing timer at zero until it finishes (round 56), so a
   * cast started just after a swing throws away almost none of the next one.
   * Paired over 500 fights against no Hammer of Wrath at all:
   *
   *                       ungated            gated 300ms
   *   Shockadin     60s   +13.3 +/- 2.9      +16.0 +/- 2.4
   *                180s   +14.7 +/- 1.5      +17.5 +/- 1.5
   *   Shockadin 2H  60s    +8.1 +/- 3.2      +14.6 +/- 2.7
   *                180s    -8.2 +/- 1.8       -3.6 +/- 1.7
   *
   * Better at both lengths on both builds. The 2H build is still a loss at
   * 180s, where it is mana-bound and casts it 1.8 times against the
   * one-hander's 3.9; removing the entry would gain that 3.6 and cost 14.6 at
   * 60s. The old "dropping it measures -20" predates round 56, when a
   * one-second cast cost almost nothing.
   */
  { abilityId: 'hammer_of_wrath', condition: swungWithin('mainHand', 300) },
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
   * RIGHTEOUS FURY: +33% on all threat and a further 90% on Holy since
   * 1.60.1.70707. The Protection Paladin casts it at the pull.
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
  /*
   * ROUND 80: THE POTION PAIR, in the owner's place for the potions. Mana under
   * 30%, Spellblasting only in the last 30 s -- bit-identical fights to the mana
   * potion alone at 120 s (this tank always drinks it), and Spellblasting at the
   * pull instead is -38.46 +/- 5.34 TPS. The Multi Target list drinks it at the
   * pull.
   */
  ...paladinPotionPair({ manaFraction: 0.3, spellblastingSeconds: 30 }),
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
  /*
   * AND SINCE 1.60.1.70707 SWIFT JUDGEMENT IS A JUDGEMENT IN ITS OWN RIGHT --
   * "Does not share a cooldown with your Judgement ability" -- rather than a
   * reset of the one above, so it no longer waits for Judgement to be on
   * cooldown: it is cast whenever its own minute is up. Judgement's `canCast`
   * already refuses without a seal, which is the half of the old gate that
   * still says something.
   */
  { abilityId: 'swift_judgement' },
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
   * prot_pally is Undead (round 80), so not one of them learns an active racial. Stoneform
   * is the one a tank would actually want, and at the bottom it fires when
   * nothing more pressing can, which is the honest policy for a ten percent
   * reduction that costs a global cooldown.
   */
  ...RACIAL_COOLDOWNS,
  ...RACIAL_DEFENSIVE_COOLDOWNS,
],
};

/**
 * PROTRIBUTION -- the Protection list plus HAMMER OF WRATH, by the owner's
 * instruction: "add hammer of wrath to the protribution APL".
 *
 * DERIVED, NOT COPIED, which is `WARRIOR_FURY_PROT`'s arrangement against the
 * Prot Warr list: a change to the Protection list reaches this one too.
 *
 * ITS OWN LIST RATHER THAN AN ENTRY IN THE SHARED ONE, because Prot Pally runs
 * that list and takes no Champion of the Light -- its Hammer of Wrath has a
 * cast, and an entry there would change a profile nobody asked to change.
 * Protribution takes Champion of the Light 5/5, so its Hammer is instant and
 * ranged.
 *
 * ABOVE JUDGEMENT, AND GATED ON BEING INSTANT, exactly as the Retribution list
 * places and gates it: it is legal only in the last fifth of the fight, on a
 * six second cooldown.
 */
export const PALADIN_PROTRIBUTION: AplList = {
  name: 'Paladin (Protribution)',
  entries: PALADIN_PROTECTION.entries.flatMap((entry): AplEntry[] =>
    entry.abilityId === 'judgement'
      ? [{ abilityId: 'hammer_of_wrath', condition: castsInstantly('hammer_of_wrath') }, entry]
      : [entry],
  ),
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
  /*
   * SMART HEALING ON (round 54), the owner's ask: the next heal goes to
   * whoever has the lowest health percentage. A checkbox in the panel turns it
   * off, and the four lines then aim exactly where they were written.
   */
  smartHealing: true,
  entries: [
    /*
     * THE SHARED FREE ENTRIES FIRST, ABOVE THE OWNER'S FOUR -- the racials and
     * the mana potion and Demonic Rune, each gated as every other list gates
     * them. Free and off the global cooldown, so they cost the heals nothing;
     * at the BOTTOM they would never be reached, because line four is castable
     * whenever the tank is below full, which is nearly always.
     */
    ...RACIAL_COOLDOWNS,
    /*
     * ROUND 80: THE POTION PAIR. Mana under 30%, Spellblasting only in the last
     * 30 s -- bit-identical to the mana potion alone in the tank healer fight,
     * which always drinks it. The raid list drops Spellblasting entirely: that
     * fight is mana-bound and Spellblasting at the pull is -99.79 +/- 7.04.
     */
    ...paladinPotionPair({ manaFraction: 0.3, spellblastingSeconds: 30 }),
    /*
     * ========================================================================
     * THE LIGHT'S VIGIL CHAIN (round 61), RAID HEALER ONLY -- the owner's:
     * "Use Light's Vigil on the tank (party 1) and hold your Holy Shock. When
     * the raid damage event happens then use a Holy Shock on the tank/party 1,
     * then use Light's Vigil on party 2 and Holy Shock again. Then 6 seconds
     * later use Light's Vigil on party 3 and the next Holy Shock on that party."
     *
     * TWO ENTRIES MAKE THAT CHAIN. Holy Shock goes to whoever carries the
     * Vigil once that party's average falls under 80%, which the tank alone
     * cannot pull it to -- so it is HELD until the raid pulse. Spending the
     * Vigil gives Holy Shock its cooldown back. Light's Vigil goes out whenever
     * none of yours is up, on the lowest member of the lowest party: party one
     * at the pull, where every party is full and the tie goes to the tank, and
     * then the next-lowest party once the shock has spent it.
     *
     * "RAID HEALER ONLY" IS "AT LEAST 6 RAID MEMBERS TO HEAL" -- one party's
     * worth and more, which the tank fight's single tank never reaches.
     *
     * THE 80% IS OURS, not the owner's: the point at which a party "needs" the
     * shock. Editable in the panel like every other figure here.
     * ========================================================================
     */
    {
      abilityId: 'holy_shock',
      target: { kind: 'withAura', auraId: 'lights_vigil' },
      condition: {
        kind: 'all',
        of: [
          { kind: 'raidSize', compare: 'atLeast', count: 6 },
          { kind: 'friendlyHealth', of: 'party', compare: 'below', fraction: 0.8 },
        ],
      },
      note: "Raid healer: on your Light's Vigil target, once its party is under 80%.",
    },
    {
      abilityId: 'lights_vigil',
      target: { kind: 'lowestParty', withoutAura: 'lights_vigil' },
      condition: {
        kind: 'all',
        of: [
          { kind: 'raidSize', compare: 'atLeast', count: 6 },
          { kind: 'raidAura', auraId: 'lights_vigil', present: false },
        ],
      },
      note: "Raid healer: on the lowest party, whenever none of your Light's Vigils is up.",
    },
    /*
     * OATH OF LIGHT ON THE TANK, kept up for its five minutes (1.60.1.70707).
     * The tank is the one target of every Holy Light in this list and of most
     * Flashes, so it is where 400 / 115 / 229 more healing lands; the cost is
     * Boundless Light's crit on the tank's Holy Shocks. The target is this
     * project's choice, flagged for the owner. BELOW the Vigil, so the owner's
     * raid chain still opens with the Vigil at the pull and the Oath takes the
     * next global cooldown.
     */
    {
      abilityId: 'oath_of_light',
      target: { kind: 'tank' },
      condition: { kind: 'aura', on: 'target', auraId: 'oath_of_light', present: false },
    },
    /*
     * ROUND 80, AN ADDITION ABOVE THE OWNER'S FOUR LINES, TANK HEALER FIGHT
     * ONLY: under 60% mana, the cheap heal on whoever is below full instead of
     * Holy Light. +2.52 +/- 1.34 HPS at 120 s over 400 paired fights (40%:
     * +1.19, real). The raid list leaves it out. Without the "below 100%" half
     * it is +60 -- by casting Flash of Light on a FULL tank, which is the
     * owner's pre-cast line being skipped; that question is for the owner.
     */
    {
      abilityId: 'flash_of_light',
      target: { kind: 'lowestHealth' },
      condition: {
        kind: 'all',
        of: [
          { kind: 'resourceFraction', resource: 'mana', compare: 'atMost', fraction: 0.6 },
          { kind: 'health', on: 'target', compare: 'below', fraction: 1 },
        ],
      },
      note: 'Round 80: under 60% mana, Flash of Light on whoever is below full, before Holy Light.',
    },
    {
      abilityId: 'holy_light',
      target: { kind: 'tank' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.65 },
    },
    {
      /*
       * THE TANK FIGHT'S HOLY SHOCK, and only there (round 61): in the raid
       * fight the shock is HELD for the Vigil chain above, and a shock spent
       * here would put it on a ten second cooldown and break the chain.
       */
      abilityId: 'holy_shock',
      target: { kind: 'tank' },
      condition: {
        kind: 'all',
        of: [
          { kind: 'raidSize', compare: 'below', count: 6 },
          { kind: 'health', on: 'target', compare: 'below', fraction: 0.3 },
        ],
      },
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
     * if the tank is still above 80%. Last, because it is what fills downtime;
     * anything above it is a heal that is needed now.
     *
     * 80% AND NOT 95% SINCE ROUND 89, the owner's choice from a measurement: at
     * 95% a ~2,200 heal landed on a tank missing a few hundred -- 56% overheal
     * on Holy Light -- and at 180 s the mana ran out and the tank died 2.05
     * times a fight. At 80%: HPS 337.8 -> 452.6, tank deaths 2.05 -> 0.00.
     */
    {
      abilityId: 'holy_light',
      target: { kind: 'tank' },
      cancel: {
        atFraction: 0.8,
        condition: { kind: 'health', on: 'target', compare: 'above', fraction: 0.8 },
      },
      note: 'Pre-cast: cancelled at 80% of the cast if the tank is above 80%.',
    },
  ],
};

export const PALADIN_HOLY_ROTATION: Rotation = compileRotation(PALADIN_HOLY);
export const PALADIN_RETRIBUTION_ROTATION: Rotation = compileRotation(PALADIN_RETRIBUTION);
export const PALADIN_SHOCKADIN_ROTATION: Rotation = compileRotation(PALADIN_SHOCKADIN);
export const PALADIN_PROTECTION_ROTATION: Rotation = compileRotation(PALADIN_PROTECTION);
export const PALADIN_PROTRIBUTION_ROTATION: Rotation = compileRotation(PALADIN_PROTRIBUTION);

/**
 * Which list a Paladin runs.
 *
 * PROTECTION BY ITS CAPSTONE, the Rogue's test: Holy Shield is a 31-point
 * Protection talent and no other build can reach it.
 *
 * THEN THE TWO RETRIBUTION BUILDS BY THEIRS. Seal Twist takes Unsealed Wrath
 * at 31 points; Shockadin stops at 28 and takes Holy Shock instead. Both tests
 * name a capstone rather than counting points, because here a capstone
 * genuinely does separate them -- unlike the Mage, whose Frostfire build has
 * none at all.
 */
export function paladinRotation(talents: TalentAllocation): Rotation | undefined {
  // Holy Shield is a row 5 talent since 1.60.1.70707 rather than the capstone,
  // and still only a Protection build spends that deep in the tree.
  if ((talents.holy_shield ?? 0) > 0) {
    // A Holy Shield build that goes deep enough in Retribution for Champion of
    // the Light 5/5 -- the instant Hammer of Wrath -- is Protribution.
    return (talents.champion_of_the_light ?? 0) >= 5
      ? PALADIN_PROTRIBUTION_ROTATION
      : PALADIN_PROTECTION_ROTATION;
  }
  if ((talents.unsealed_wrath ?? 0) > 0) return PALADIN_RETRIBUTION_ROTATION;
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
