import type { Rotation } from '../../engine';
import type { AplCondition, AplList } from './apl';
import {
  all,
  any,
  castsInstantly,
  compileRotation,
  fightElapsed,
  not,
  ready,
  selfHas,
  selfHealth,
  selfTime,
} from './apl';
import type { TalentAllocation } from '../talents/Talent';
import { SEAL_AURA_IDS } from '../auras/paladin';

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

/**
 * "FIRST EVENT ONLY", which all three of the owner's lists open with.
 *
 * ----------------------------------------------------------------------------
 * THE SAME RULE CHARGE ALREADY RUNS ON, and reached the same way: the opening
 * instant is the one moment nothing else has taken yet, and an ability gated on
 * it fires once and never again. Charge states it as
 * `now() === CHARGE_OPENING_TIMESTAMP_MS` in its own `canCast`.
 *
 * Here it is a LIST condition rather than an ability one, because Seal of the
 * Crusader is a perfectly ordinary seal that these lists happen to want exactly
 * once -- to put its Judgement debuff up -- and gating the ability itself would
 * be wrong for anything else that ever wants to cast it.
 * ----------------------------------------------------------------------------
 */
const OPENING_TIMESTAMP_MS = 0;
const firstEventOnly: AplCondition = fightElapsed('exactly', OPENING_TIMESTAMP_MS / 1000);

/** "<buff> is not active", on the Paladin. */
const selfExpired = (auraId: string) => selfTime('atMost', 0, auraId);

/** "<buff> is active", on the Paladin. */
const selfActive = selfHas;

/**
 * "A seal is up", whichever one.
 *
 * Judgement's own `canCast` is exactly this, so a list entry that depends on a
 * Judgement being castable states the ability's rule rather than a narrower
 * guess at it.
 */
/*
 * "ANY SEAL IS UP", built from the SAME LIST `activeSeal` walks rather than
 * from a builtin of its own. `activeSeal` is `SEAL_AURA_IDS.find(has)`, so a
 * disjunction over those ids is the same question -- and it stays the same
 * question when a seal is added, because both read the one array.
 */
const anySealUp: AplCondition = any(...SEAL_AURA_IDS.map(selfHas));

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
  { abilityId: 'seal_of_the_crusader', condition: firstEventOnly },
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
  { abilityId: 'seal_of_the_crusader', condition: firstEventOnly },
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
   * DIVINE FAVOR ABOVE HOLY SHOCK, on the ruleset owner's choice, and the order
   * is the whole of the entry: the buff is "your NEXT Holy Shock", so a Divine
   * Favor cast below Holy Shock would spend its global cooldown arming a spell
   * that had already gone. Its own `canCast` refuses a second one while the first
   * is unspent, so the two-minute cooldown is what paces it rather than the list.
   *
   * IT COSTS A GLOBAL COOLDOWN FOR NO DAMAGE OF ITS OWN, which is why it is
   * measured rather than argued about -- the same reason Hunter's Mark is in the
   * melee Hunter's list at a known price.
   */
  { abilityId: 'divine_favor' },
  { abilityId: 'holy_shock' },
  { abilityId: 'holy_strike' },
  { abilityId: 'hammer_of_wrath' },
  { abilityId: 'consecration' },
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
  { abilityId: 'seal_of_the_crusader', condition: firstEventOnly },
  /*
   * RIGHTEOUS FURY DOES NOTHING HERE AND IS CAST ANYWAY, on the owner's
   * ruling. Its whole effect is "+60% threat from your Holy attacks" and
   * threat is permanently out of scope -- so the Protection Paladin spends
   * 30% of its base mana and a global cooldown on it at the pull exactly as it
   * would in game, and gets nothing modelled back. Dropping the entry would
   * hand the build a cast it does not get to keep.
   */
  { abilityId: 'righteous_fury', condition: selfExpired('righteous_fury') },
  { abilityId: 'holy_shield', condition: selfExpired('holy_shield') },
  { abilityId: 'templars_bulwark', condition: healthAtMostFraction(0.35) },
  { abilityId: 'judgement' },
  /*
   * SWIFT JUDGEMENT IS A SECOND JUDGEMENT, BACK TO BACK, which is the whole
   * point of it: Judgement, then this, then Judgement again.
   *
   * --------------------------------------------------------------------------
   * ITS GATE USED TO NAME SEAL OF FURY, and that cost it the back-to-back. The
   * Protection opener is Seal of the Crusader, judge, THEN Seal of Fury -- so at
   * the first moment Judgement was on cooldown the named seal was not up yet,
   * the entry fell through, and Swift Judgement went a global cooldown later
   * than it had to. Judgement landed at 4.5s and 9.0s with a seal cast wedged
   * between them instead of the two being consecutive.
   *
   * ANY SEAL, which is the real condition and is Judgement's own: `canCast`
   * refuses without one, so resetting the cooldown for a Paladin carrying no
   * seal would waste a one-minute cooldown rather than a global. Reading it off
   * `activeSeal` means the list states the same rule the ability does instead of
   * a narrower guess at it.
   *
   * IT FIRES ONCE A FIGHT AND THAT IS ITS COOLDOWN, not a bug: sixty seconds
   * against a sixty-second encounter.
   * --------------------------------------------------------------------------
   */
  {
    abilityId: 'swift_judgement',
    condition: all(abilityOnCooldown('judgement'), anySealUp),
  },
  { abilityId: 'seal_of_fury', condition: selfExpired('seal_of_fury') },
  { abilityId: 'holy_strike' },
  { abilityId: 'consecration' },
  ],
};

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
  if ((talents.holy_shock ?? 0) > 0) return PALADIN_SHOCKADIN_ROTATION;
  /*
   * A Paladin with none of the three still fights, and gets the SHOCKADIN
   * list -- which is the one written entirely out of trainer abilities. The
   * Retribution list asks for Seal of Command, a talent an untalented paladin
   * does not have, and a paladin with no seal cannot Judge either.
   */
  return PALADIN_SHOCKADIN_ROTATION;
}
