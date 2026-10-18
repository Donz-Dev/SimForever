import {
  AGILITY_CONSUMABLES,
  RANGED_HUNTER_CONSUMABLES,
  STRENGTH_CONSUMABLES,
  casterConsumables,
  hybridConsumables,
} from '../game/buffs/consumables';
import { getCombatStyle } from '../game/character';
import { RAID_BUFFS } from '../game/buffs/raidBuffs';
import type { ClassId } from '../game/character';
import type { Equipment, EquippedSlot } from '../game/items/Item';
import { benchmarkEquipmentForName } from '../game/items/benchmarkSets';
import { PRESET_ENCHANTS } from '../game/items/presetEnchants';
import type { TalentAllocation } from '../game/talents/Talent';
import type { PrecombatAction } from '../engine';
import type { CharacterProfile } from './CharacterProfile';
import { createDefaultProfile } from './CharacterProfile';
import { syncDefaultRotation } from './rotation';

/**
 * Ready-made characters, chosen with one button.
 *
 * ----------------------------------------------------------------------------
 * WHAT THIS FORMALISES.
 *
 * "If 1H and shield is selected", "if Battle Stance is chosen", "if the target
 * attacks back is checked" -- the same three or four conditions have been
 * repeated in almost every instruction about how this simulator should behave,
 * and they have never been written down as one thing. They are not independent
 * settings: a Protection warrior is a shield AND Defensive Stance AND a target
 * that swings back AND a particular tree AND particular gear, and choosing
 * three of the five produces a character nobody meant.
 *
 * A preset is that whole answer, named. `isTankBuild` already had to infer one
 * of them from two fields; this is the same idea made explicit and complete.
 *
 * EVERY FIELD IS SET, none inherited. A preset that left the stance alone would
 * behave differently depending on what was on screen when it was pressed, which
 * is the opposite of what a named starting point is for. The only thing carried
 * over is the profile FORMAT -- these build on `createDefaultProfile`, so a
 * format change reaches them without anything here being edited.
 *
 * THE RAID IS THE SAME FOR ALL THREE, and it is the ruleset owner's own
 * selection rather than a guess -- see `PRESET_RAID_BUFFS`. A new profile still
 * starts with none, which is what keeps every figure measured without them
 * comparable; a preset is a stated character, and this is part of what it
 * states.
 * ----------------------------------------------------------------------------
 */

export interface ProfilePreset {
  /** Stable id. Not stored anywhere, but tests and buttons key on it. */
  readonly id: string;
  /** What the button says. Short, because several sit in a row. */
  readonly label: string;
  /** One line under the button: what this character is. */
  readonly detail: string;
  /**
   * WHOSE CLASS THIS IS, stated rather than derived.
   *
   * The profile rail colours each pill by class, and the alternative was
   * calling `build()` for all 23 just to read one field off the character it
   * assembles -- a full profile, gear and talents included, thrown away. It is
   * also the only part of a preset a reader could not already see at a glance:
   * `detail` names the race and the weapon, never the class.
   *
   * `presetClassMatchesBuild` in the tests asserts this against what `build()`
   * actually produces, so the two cannot drift.
   */
  readonly characterClass: ClassId;
  readonly build: () => CharacterProfile;
}

/**
 * The raid every preset assumes, chosen by the ruleset owner.
 *
 * ----------------------------------------------------------------------------
 * IDENTICAL FOR ALL THREE. One raid, so two presets differ by the character and
 * not by who else turned up -- which is the only way their numbers can be
 * compared to each other at all.
 *
 * WHAT IS ABSENT IS ABSENT ON PURPOSE. No Arcane Intellect, Blessing of Wisdom
 * or Mana Spring Totem, because a warrior has no mana; no Trueshot Aura,
 * because the ranged attack power reaches a bow that does not swing; no Grace
 * of Air Totem; no Moonkin Form, which is Leader of the Pack's other half and
 * cannot be taken alongside it -- except on the one profile that provides it,
 * see below; and neither curse.
 *
 * JUDGEMENT OF WISDOM JOINED LATER, on the owner's instruction, and it is the
 * second entry after Sunder Armor to change a resource economy rather than a
 * stat. It restores 59 mana on about half of the actions a character takes
 * against the target, so it is worth most to a build that runs dry and nothing
 * at all to one with no mana bar -- the five profiles that deal pure physical
 * damage do not move by a decimal, which is the containment check.
 *
 * SUNDER ARMOR IS THE INTERESTING ONE. The target starts at five stacks, so the
 * warrior's own list stops opening every fight by applying five of them and
 * only refreshes what the raid supplied. That was the ruleset owner's reason
 * for adding the list to the presets, and it is a large change to the rage
 * economy rather than a cosmetic one.
 *
 * In catalogue order, so the file matches what `withRaidBuff` writes back and
 * a preset can be compared to a hand-edited profile without a diff.
 *
 * ----------------------------------------------------------------------------
 * TWO PRESETS SUBSTITUTE ONE ENTRY AND IT USED TO BE THREE: the two ranged
 * Hunters take Grace of Air instead of Windfury, which a bow can never trigger.
 *
 * THE THIRD WAS THE MOONKIN, WHICH TOOK MOONKIN AURA INSTEAD OF LEADER OF THE
 * PACK, and that swap is gone because the thing it was for is gone. The two
 * were declared mutually exclusive when they were the same 3% global crit, so
 * the raid could only have whichever druid turned up -- and the owner has since
 * ruled: "Moonkin and Leader of the Pack are no longer exclusive. And all
 * profiles should have both enabled by default in the raid buffs." A patch had
 * already split them by attack TYPE, Moonkin Aura spell crit and Leader of the
 * Pack melee and ranged, so a raid with a feral druid and a moonkin has both
 * and they do two different things.
 *
 * SO EVERY PROFILE SELECTS BOTH and the list below is the whole of it -- the
 * Moonkin runs the same raid as everybody else now, with its own talent and the
 * raid entry sharing one aura id, which is what keeps that 3% from being 6%.
 * See `MOONKIN_AURA_ID` in `auras/druid.ts`.
 * ----------------------------------------------------------------------------
 */
const PRESET_RAID_BUFFS: readonly string[] = [
  'battle_shout',
  'thunder_clap',
  'sunder_armor',
  'arcane_intellect',
  'power_word_fortitude',
  'divine_spirit',
  'curse_of_the_elements',
  'judgement_of_wisdom',
  'blessing_of_wisdom',
  'blessing_of_kings',
  'blessing_of_might',
  // On every profile, by the owner's instruction.
  'devotion_aura',
  'judgement_of_the_crusader',
  'gift_of_arthas',
  'faerie_fire',
  'mark_of_the_wild',
  'strength_of_earth_totem',
  'grace_of_air_totem',
  'mana_spring_totem',
  'windfury_totem',
  'trueshot_aura',
  'leader_of_the_pack',
  'moonkin_form',
];

/**
 * THE THREE TANKS ADD THORNS AND RETRIBUTION AURA, by the owner's instruction:
 * "only on by default for Prot Warr, Prot Pally, and Bear". They deal damage to
 * whatever attacks the character, and nothing attacks any other profile, so
 * everywhere else they would be a ticked box worth exactly nothing. In
 * catalogue order, like the list above.
 */
const TANK_RAID_BUFFS: readonly string[] = presetRaidBuffsWith(['thorns', 'retribution_aura']);

function presetRaidBuffsWith(extra: readonly string[]): readonly string[] {
  const chosen = new Set([...PRESET_RAID_BUFFS, ...extra]);
  return RAID_BUFFS.map((buff) => buff.id).filter((id) => chosen.has(id));
}

/*
 * ==============================================================================
 * THE SWAP AND THE DROP ARE BOTH GONE, AND EVERY PROFILE NOW TAKES THE SAME
 * TWENTY-TWO.
 *
 * The owner's instruction: "For all profiles ensure that all raid buffs are
 * checked on except for Curse of Recklessness." So there is ONE list, it is the
 * whole catalogue minus one entry, and no profile differs from any other.
 *
 * WHAT WENT WITH IT:
 *
 *   `RANGED_HUNTER_RAID_BUFFS`  Grace of Air INSTEAD of Windfury on the two
 *                               ranged Hunters. Both are on now, so there is
 *                               nothing to substitute -- Windfury is simply
 *                               worth nothing to a bow, which a ticked box is
 *                               allowed to be
 *   the Enhancement DROP        Windfury Totem, which that build's own imbue
 *                               disables. **The box is ticked and the ENGINE
 *                               enforces the disabling now**, which is the
 *                               honest version of the same answer: see
 *                               `windfuryTotemReaction`
 *
 * AND A DROPPED BOX WAS NEVER THE RIGHT MECHANISM FOR THE SECOND ONE. "The
 * imbue disables any benefit you personally receive from Windfury Totem" is a
 * RULESET rule about a character, and expressing it as an unticked checkbox put
 * it in the one place a user can undo by accident -- the same mistake as
 * enforcing the Moonkin exclusivity at the chooser, which let a talent reach
 * the aura without passing through it and read +6% crit.
 * ==============================================================================
 */

/**
 * ==============================================================================
 * WHAT EACH PROFILE DID BEFORE THE PULL, AND IT IS THE OWNER'S OWN LIST.
 *
 * They specified an opener for all 28 profiles at once, each as a sequence of
 * "N seconds before <ability>". `before` is written so a preset's block reads
 * back in those words -- one call per lead time, the abilities in the order
 * they were named -- because the thing a reader has to be able to check is the
 * list against the message it came from.
 *
 *     ...before(10, 'bloodrage_cast', 'battle_shout_cast'),
 *     ...before(3, 'battle_stance_cast'),
 *     ...before(0, 'charge', 'mighty_rage_potion'),
 *
 * ------------------------------------------------------------------------------
 * ORDER WITHIN ONE LEAD TIME IS THE ORDER WRITTEN HERE. `runPrecombat` sorts
 * by `secondsBefore` DESCENDING and `Array.prototype.sort` is stable, so two
 * actions at the same instant happen in the order the preset lists them. That
 * matters on the Bear, whose whole 0s block is "Enrage + Mighty Rage Potion +
 * queue Maul + Primal Bite" -- Enrage first is the reading that gives the
 * queued swing the buff.
 *
 * ------------------------------------------------------------------------------
 * SEVEN OF THE OWNER'S LINES NAME A STATE RATHER THAN AN ABILITY, AND ALL SEVEN
 * ARE WRITTEN OUT ANYWAY -- ON THEIR INSTRUCTION.
 *
 *   "2s before Stealth"          x3  a Rogue's `openingAuras` carry `stealth`;
 *                                    there is no Stealth ABILITY, deliberately
 *   "2s before cat form"             a COMBAT STYLE on the profile
 *   "3s before Moonkin Form"         the same
 *   "1.5s before Dire Bear Form"     the same
 *
 * **THEY WERE LEFT OUT AT FIRST AND THE OWNER ASKED FOR THEM BACK**: "Even if
 * lines were already true, like Moonkin Form, just leave it in the pre-combat so
 * users know that." The argument for omitting them was that `runPrecombat` finds
 * no ability and skips in silence, so the entry does nothing -- which is true of
 * the ENGINE and misses what the list is for. It is also what a person reads to
 * see how the fight is opened, and a step missing from it reads as a step the
 * character does not take.
 *
 * SO `PRECOMBAT_STATES` CARRIES THE SEVEN, with what makes each one true, and
 * two readers that would otherwise misreport them use it: the APL panel, which
 * labelled them "(not in this build)" -- exactly backwards -- and the opener
 * guard, which asserts every declared action FIRES and must check the state
 * instead. See `game/abilities/precombatStates.ts`.
 * ==============================================================================
 */
const before = (
  secondsBefore: number,
  ...abilityIds: readonly string[]
): readonly PrecombatAction[] => abilityIds.map((abilityId) => ({ abilityId, secondsBefore }));


/**
 * 2H Arms: 39 in Arms, 10 in Fury, 2 in Protection. Fifty-one exactly.
 *
 * ----------------------------------------------------------------------------
 * ALL THREE WARRIOR BUILDS WERE RE-SPECIFIED AT CLIENT BUILD 1.60.1.70170 and
 * the owner supplied all three URLs with the patch notes. The class took the
 * largest reshuffle in the patch: Improved Cleave, Boundless Rage, Precision and
 * Toughness removed, Lingering Rage, Furious Precision and Gore Drinker added,
 * Iron Will moved out of Fury into Protection, and six Protection rows moved.
 *
 * SO THE THREE POINTS THAT USED TO SIT IN IMPROVED CLEAVE ARE GONE WITH IT, and
 * the note they carried goes with them. It read: the owner named Improved Cleave
 * when the list as first given came to forty-eight, and it did nothing, because
 * Cleave is in no priority list and every encounter here is one target. Three
 * points of a real talent that changed no number in a result. Kept here because
 * "a talent the owner chose can be worth literally zero" is the lesson, and it
 * now has a successor: Improved Tactical Mastery's five points retain rage
 * through a stance change and this list never changes stance after the pull.
 *
 * THE REPLACEMENT IS NOT A STRAIGHT SWAP. A second point of Improved Charge and
 * two of Improved Bloodrage, which puts a 2H Arms warrior in the PROTECTION tree
 * for the first time -- and both are rage at the pull rather than throughput.
 * ----------------------------------------------------------------------------
 */
const TWO_HAND_ARMS_TALENTS: TalentAllocation = {
  // Arms, 39
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_charge: 2,
  improved_tactical_mastery: 5,
  improved_overpower: 2,
  anger_management: 1,
  deep_wounds: 3,
  spearing_strike: 1,
  two_handed_weapon_specialization: 3,
  impale: 2,
  bloodthrill: 5,
  sweeping_strikes: 1,
  weaponmaster: 5,
  improved_slam: 2,
  mortal_strike: 1,
  // Fury, 10
  cruelty: 5,
  unbridled_wrath: 5,
  // Protection, 2
  improved_bloodrage: 2,
};

/**
 * DW Fury: 17 in Arms, 34 in Fury. Fifty-one exactly.
 *
 * The ruleset owner's list, decoded from their URL. It is a legal allocation as
 * given -- every tier is reached and every prerequisite met -- which is checked
 * by a test rather than assumed.
 *
 * ----------------------------------------------------------------------------
 * SPEARING STRIKE IS OUT, AND NOT BECAUSE THE BUILD GOT WORSE AT IT. The patch
 * replaced its two-handed requirement with a Battle Stance one -- so a
 * dual-wielding Fury warrior can now hold the weapons for it and cannot hold the
 * stance, and the point went to Improved Execute instead. The old build spent
 * that point on an ability the profile could never cast, which a test asserted;
 * see `abilitiesForBuild`.
 *
 * ENRAGE DROPS TO 4/5 AND FLURRY IS STILL FULL, which the patch made possible:
 * Flurry required Enrage 5 and now requires Death Wish 1. Gore Drinker, the new
 * talent that DOES require Enrage 5, is not taken.
 * ----------------------------------------------------------------------------
 */
const DW_FURY_TALENTS: TalentAllocation = {
  // Arms, 17
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_tactical_mastery: 5,
  anger_management: 1,
  deep_wounds: 3,
  impale: 2,
  // Fury, 34
  cruelty: 5,
  lingering_rage: 2,
  unbridled_wrath: 5,
  furious_precision: 3,
  dual_wield_specialization: 5,
  raging_blows: 1,
  /*
   * ENRAGE 4 -> 2, AND THE TWO POINTS BUY IMPROVED BERSERKER RAGE.
   *
   * --------------------------------------------------------------------------
   * ENRAGE IS WORTH NOTHING TO THIS PROFILE AND ALWAYS WAS. "A 30% chance to
   * deal 10% increased Physical damage for 12 sec AFTER BEING THE VICTIM OF ANY
   * DAMAGING ATTACK", and this preset sets `targetAttacks: false` -- so the
   * aura reports no uptime at all. It is the `target` cause of inert rather
   * than an engine gap, and it expires the day somebody hits this warrior.
   *
   * ALL FOUR POINTS CANNOT LEAVE, WHICH IS WHY THIS IS 2 AND NOT 0.
   * Bloodthirst needs thirty points below tier 30 of Fury and there are
   * thirty-three, so three is the most that can move -- and every other talent
   * at or below tier 20 is already maxed or equally dead. Two is what the
   * destination costs.
   *
   * AND THE THREE DEAD DESTINATIONS MEASURE BIT-IDENTICAL TO EACH OTHER.
   * Enrage 2, Blood Craze 2 and Booming Voice 2 all ran IDENTICAL FIGHTS
   * holding the leftover pair, so the choice is legibility rather than DPS:
   * two of Enrage's points stay where the owner put them.
   * --------------------------------------------------------------------------
   */
  enrage: 2,
  improved_execute: 2,
  /*
   * IMPROVED BERSERKER RAGE, AND IT IS HALF A FIX RATHER THAN HALF A TALENT.
   *
   * --------------------------------------------------------------------------
   * `abilities/warrior.ts` HAS SAID FOR SEVERAL RELEASES THAT THIS TALENT WAS
   * BUILT AND THAT NO PROFILE COULD SHOW IT -- "the talent is built and no
   * profile can show it", the fourth cause of inert, which is a LIST and not
   * the engine. Berserker Rage was in the book of every Warrior build and in
   * none of their lists.
   *
   * SO THE TALENT ALONE IS STILL WORTH NOTHING: taking it without an entry ran
   * BIT-IDENTICAL FIGHTS, because the ten rage it grants on activation has
   * nowhere to arrive. With the entry at the bottom of the list it is
   * **+6.02 +/- 5.43** over the same build without either. Both halves or
   * neither, which is why they ship together -- see `WARRIOR_DUAL_WIELD_BERSERKER`.
   *
   * THE BASE ABILITY IS STILL INERT AND THAT IS THE SOURCE'S DOING; its own
   * `unmodelled` entry says so. What the talent adds is a stated number.
   * --------------------------------------------------------------------------
   */
  improved_berserker_rage: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
};

/**
 * Prot Warr: 17 in Arms, 34 in Protection. Fifty-one exactly.
 *
 * ----------------------------------------------------------------------------
 * AS GIVEN THIS WAS FIFTY-TWO, one over the cap, and the point that came out
 * is ANGER MANAGEMENT -- the ruleset owner's choice when asked.
 *
 * It is called out here because the alternative was silent. `legalAllocation`
 * strips whatever it reaches last when a build overflows, and left alone it
 * would have dropped this very talent on its own -- producing exactly the
 * right build by accident, with nobody aware that a point had been thrown
 * away or which one.
 *
 * RE-SPECIFIED AT CLIENT BUILD 1.60.1.70170 and still 17/0/34, which is why the
 * paragraph above still reads true: Anger Management is still the point not
 * taken. The Protection tree moved six rows under it and the one real swap is
 * IMPROVED BLOODRAGE OUT, IMPROVED THUNDER CLAP IN -- the former moved to row 1
 * where this build no longer reaches past it, and the latter is two points of
 * Thunder Clap damage on the one profile whose rotation leans on the ability.
 * ----------------------------------------------------------------------------
 */
const PROT_WARR_TALENTS: TalentAllocation = {
  // Arms, 17. Anger Management is the point the owner gave up; see above.
  improved_heroic_strike: 3,
  deflection: 5,
  improved_rend: 3,
  improved_charge: 1,
  deep_wounds: 3,
  impale: 2,
  // Protection, 34
  shield_specialization: 5,
  anticipation: 5,
  improved_revenge: 3,
  improved_thunder_clap: 2,
  last_stand: 1,
  master_of_defense: 2,
  defiance: 3,
  vanguard: 1,
  improved_shield_wall: 2,
  concussion_blow: 1,
  bastion: 5,
  focused_rage: 3,
  shield_slam: 1,
};

/**
 * Fury Prot: 5 in Arms, 31 in Fury, 15 in Protection. Fifty-one exactly.
 *
 * ----------------------------------------------------------------------------
 * DECODED FROM THE OWNER'S URL by `tools/decode_talent_build.mjs`, not
 * transcribed -- build 70425, and it decodes to 51 with nothing dropped.
 *
 * A SHIELD TANK THAT REACHES BLOODTHIRST AND NOT SHIELD SLAM, which is what
 * picks its list: `warriorRotation` sends a Defensive shield warrior with the
 * Bloodthirst capstone to `WARRIOR_FURY_PROT` and every other one to the Prot
 * list. Death Wish, Flurry and Enrage come with the Fury depth; the Protection
 * fifteen are the survival tier -- Shield Specialization, Anticipation,
 * Improved Revenge, Last Stand and Defiance -- and nothing past it, so no
 * Vanguard and therefore NO CHARGE OUT OF DEFENSIVE STANCE, which the owner's
 * opener agrees with by not having one.
 * ----------------------------------------------------------------------------
 */
const FURY_PROT_TALENTS: TalentAllocation = {
  // Arms, 5
  deflection: 5,
  // Fury, 31
  booming_voice: 5,
  cruelty: 5,
  unbridled_wrath: 2,
  blood_craze: 3,
  enrage: 5,
  improved_execute: 2,
  improved_berserker_rage: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
  // Protection, 15
  shield_specialization: 5,
  anticipation: 3,
  improved_revenge: 3,
  last_stand: 1,
  defiance: 3,
};


/**
 * ----------------------------------------------------------------------------
 * THE THREE ROGUE BUILDS, decoded from the ruleset owner's talentsforever.com
 * URLs by `tools/decode_talent_build.mjs` rather than transcribed.
 *
 * Each decodes to exactly 51 points, which the decoder checks: the encoding is
 * one digit per talent IN TREE ORDER, so a tree of the wrong length lands every
 * digit after it on a different talent and produces a legal-looking build
 * nobody chose. See docs/class-implementation.md.
 * ----------------------------------------------------------------------------
 */

/** Venom -- Assassination 37 / Combat 12 / Subtlety 2. Mutilate and poisons. */
const ROGUE_VENOM_TALENTS: TalentAllocation = {
  // The owner's respecification, decoded from https://talentsforever.com/rogue/60/00530210541501051-30230320201-002-CFD2I2GDIJ3KLNPQRTWUZXbkJ-7
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 2,
  relentless_strikes: 1,
  lethality: 5,
  vile_poisons: 4,
  cold_blood: 1,
  improved_poisons: 5,
  mutilate: 1,
  seal_fate: 5,
  venom: 1,
  improved_eviscerate: 3,
  lightning_reflexes: 2,
  puncturing_wounds: 3,
  precision: 3,
  endurance: 2,
  improved_sprint: 2,
  flawless_execution: 1,
  opportunity: 2,
};

/** Combat -- Assassination 18 / Combat 33. Sinister Strike and the cooldowns. */
const ROGUE_COMBAT_TALENTS: TalentAllocation = {
  // The owner's respecification, decoded from https://talentsforever.com/rogue/60/00530310501-32003311201515231--CFDGIKRSWVYZXbcdefgh-7
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 5,
  cold_blood: 1,
  improved_eviscerate: 3,
  improved_sinister_strike: 2,
  deflection: 3,
  precision: 3,
  endurance: 1,
  riposte: 1,
  improved_sprint: 2,
  flawless_execution: 1,
  dual_wield_specialization: 5,
  blade_flurry: 1,
  hack_and_slash: 5,
  weapon_expertise: 2,
  aggression: 3,
  adrenaline_rush: 1,
};

/** Rupture -- Assassination 12 / Combat 8 / Subtlety 31. Hemorrhage and bleeds. */
/**
 * Combat Mut -- Assassination 30 / Combat 21 / Subtlety 0.
 *
 * ============================================================================
 * A NEW PROFILE, AND THE OWNER'S FRAMING IS WHAT KEEPS IT SMALL: "this profile
 * copies everything from Venom except the APL and Talents which I'll provide."
 * So the preset below spreads the Venom one and replaces two fields.
 *
 * READ OFF THE TALENT PANEL, and the per-tree totals it prints -- 30, 21, 0 --
 * are what made the decode checkable. **THEY ARE ALSO WHAT CAUGHT A MISREAD**:
 * the Combat icons summed to 18 against a stated 21, and exactly two single
 * talents could close a three-point gap. The owner answered Precision, which
 * is the one that matters -- +3% hit against Lightning Reflexes' dodge, worth
 * nothing to a build nothing attacks. **A tree total is the cheap check that a
 * decode is right**, and it is the one thing a screenshot states in words.
 *
 * IT IS A VENOM BUILD THAT SPENDS ON EVISCERATE. Both take Mutilate and Seal
 * Fate, so both gain about two points a cast and four on a double crit; what
 * the twenty-one Combat points buy is what the two daggers DO -- Dual Wield
 * Specialization, Precision, Puncturing Wounds, Blade Flurry -- rather than a
 * finisher. The Venom capstone is NOT taken, which is what `rogueRotation`
 * reads to tell the two apart.
 * ============================================================================
 */
const ROGUE_COMBAT_MUT_TALENTS: TalentAllocation = {
  // The owner's respecification, decoded from https://talentsforever.com/rogue/60/0053031051150105-3023032020141--CF2D2I2GDIJKLNP4RTWUZXbcdFP-7
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 5,
  vile_poisons: 1,
  cold_blood: 1,
  improved_poisons: 5,
  mutilate: 1,
  seal_fate: 5,
  improved_eviscerate: 3,
  lightning_reflexes: 2,
  puncturing_wounds: 3,
  precision: 3,
  endurance: 2,
  improved_sprint: 2,
  flawless_execution: 1,
  dual_wield_specialization: 4,
  blade_flurry: 1,
};

/**
 * Pure Hemo -- Assassination 21 / Combat 8 / Subtlety 22.
 *
 * ============================================================================
 * A NEW PROFILE AND THE SECOND HEMORRHAGE BUILD, and the owner's framing is
 * "the same as Hemo Dagger except it's gonna use the Main Hand weapon from the
 * Combat templates" -- plus its own talents and its own list.
 *
 * ALL THREE TREE TOTALS SUM EXACTLY from the icons, which is the first talent
 * panel in this series that needed no question asked. The totals the panel
 * prints are the check.
 *
 * IT SPENDS NO POINTS BELOW TIER FOUR OF SUBTLETY, which is what makes it
 * "pure": no Cutthroat, so no in-combat Ambush window, and no Quietus or
 * Thousand Cuts. The twenty-two points buy Hemorrhage, Serrated Blades and
 * Preparation and stop. What the other twenty-nine buy is the five-point
 * Eviscerate its list is built around -- Lethality, Improved Eviscerate,
 * Relentless Strikes, Ruthlessness, Cold Blood and Precision.
 * ============================================================================
 */
const ROGUE_PURE_HEMO_TALENTS: TalentAllocation = {
  // The owner's respecification, decoded from https://talentsforever.com/rogue/60/005303105011-302003-5320200310013211-RTWi4kjm1pmituqwxCFDGIKvL-7
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 5,
  cold_blood: 1,
  improved_poisons: 1,
  improved_eviscerate: 3,
  lightning_reflexes: 2,
  precision: 3,
  camouflage: 5,
  master_of_deception: 3,
  opportunity: 2,
  elusiveness: 2,
  initiative: 3,
  ghostly_strike: 1,
  premeditation: 1,
  serrated_blades: 3,
  dirty_deeds: 2,
  preparation: 1,
  hemorrhage: 1,
};

const ROGUE_RUPTURE_TALENTS: TalentAllocation = {
  /*
   * ==========================================================================
   * THE ASSASSINATION TWELVE WERE RESPECIFIED, AND THE OTHER TWO TREES WERE
   * NOT. Combat stays at 8 and Subtlety at 31; what moved is three talents
   * inside the first tree, for a net of zero points.
   *
   *   Ruthlessness        2 -> 3
   *   Lethality           2 -> 0
   *   Relentless Strikes  0 -> 1
   *
   * READ OFF THE OWNER'S TALENT PANEL rather than a build URL, so the grid was
   * decoded against `src/data/talents/rogue.json` by row and column and the
   * three per-tree totals checked against the ones the panel prints -- 12, 8
   * and 31. **A tree total is the cheap check that a decode is right**, and it
   * is the one thing a screenshot states in words rather than in icons.
   * ==========================================================================
   */
  malice: 5,
  ruthlessness: 3,
  relentless_strikes: 1,
  improved_slice_and_dice: 3,
  improved_eviscerate: 3,
  lightning_reflexes: 2,
  puncturing_wounds: 3,
  camouflage: 5,
  master_of_deception: 3,
  opportunity: 2,
  improved_ambush: 3,
  initiative: 3,
  ghostly_strike: 1,
  improved_distract: 2,
  premeditation: 1,
  serrated_blades: 3,
  preparation: 1,
  hemorrhage: 1,
  cutthroat: 5,
  thousand_cuts: 1,
};

/**
 * Hemo -- Assassination 17 / Combat 3 / Subtlety 31. Hemorrhage without Backstab.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S URL, decoded to 51 points:
 * talentsforever.com/rogue/60/005303105-3-5320003301013211501-kjoCFD2I2Ri2pi1uti1wxirvy4GDIy0-6
 *
 * IT IS THE RUPTURE BUILD WITH THE BACKSTAB ENGINE TAKEN OUT, and that is what
 * makes it a different list rather than a variant of the same one. Ten talents
 * differ, and three of them are the point:
 *
 *   CUTTHROAT 5 -> 0. Backstab's proc is what let the Rupture list cast Ambush
 *     at all outside a stealth window, so Ambush here has ONE route to its gate
 *     -- the pull and Vanish -- rather than two.
 *   PUNCTURING_WOUNDS 3 -> 0. Backstab's extra combo point and its crit.
 *   GHOSTLY_STRIKE 1 -> 0, so the ability is absent from the book entirely.
 *
 * The rest is a shift of five points from Combat into Assassination: Lethality
 * 2 -> 5, Ruthlessness 2 -> 3, Relentless Strikes 1, Quietus 5 and Dirty Deeds
 * 2 arriving, Lightning Reflexes 2 going.
 *
 * QUIETUS IS FIVE POINTS AND ONLY ITS HEMORRHAGE CLAUSE IS LIVE HERE -- it also
 * names Sinister Strike and Ghostly Strike, and this build takes neither in its
 * list or its tree. That is the right clause for it to have: Hemorrhage is this
 * profile's maintenance strike.
 *
 * DIRTY DEEDS' TWO POINTS DO NOTHING, and that is a RULING rather than a gap:
 * both its abilities are stealth openers the owner has ruled out for good.
 * ----------------------------------------------------------------------------
 */
const ROGUE_HEMO_TALENTS: TalentAllocation = {
  // Assassination, 17
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 2,
  relentless_strikes: 1,
  lethality: 5,
  /*
   * COLD BLOOD IS THE NEW POINT, and it is what the respecified list needs:
   * the owner's Hemo Dagger APL has a Cold Blood entry, and this build did not
   * take the talent. A list naming an ability the build cannot cast is skipped
   * IN SILENCE, so the two halves of the respecification only work together.
   *
   * IT IS PAID FOR OUT OF IMPROVED SLICE AND DICE, 3 -> 2, for a net of zero.
   * That is the cheapest place it could have come from on this build: the list
   * casts Slice and Dice at ONE combo point and only when the buff is DOWN, so
   * what the talent buys is duration on a buff whose uptime is already the
   * thing being managed.
   */
  cold_blood: 1,
  // Combat, 3
  improved_eviscerate: 3,
  /*
   * ==========================================================================
   * SUBTLETY IS UNCHANGED, ON THE OWNER'S INSTRUCTION, AND THEIR SCREENSHOT
   * DISAGREES WITH IT.
   *
   * The panel they sent shows Improved Ambush at 0/3 against the 3/3 below,
   * and states a tree total of 31 either way -- so three points moved inside
   * Subtlety and the icons were not legible enough to say where to. Asked
   * which, the owner chose to keep this tree as it is.
   *
   * RECORDED RATHER THAN SILENTLY RESOLVED, because it is the one part of this
   * build that is a READING rather than a statement: if the figure looks wrong
   * later, this is the first thing to re-ask, and the build URL run through
   * `decode_talent_build.mjs` is what would settle it in one command.
   * ==========================================================================
   */
  camouflage: 5,
  master_of_deception: 3,
  opportunity: 2,
  improved_ambush: 3,
  initiative: 3,
  improved_distract: 1,
  premeditation: 1,
  serrated_blades: 3,
  dirty_deeds: 2,
  preparation: 1,
  hemorrhage: 1,
  quietus: 5,
  thousand_cuts: 1,
};

/** Venom and Rupture: two daggers, which is what those builds are written for. */
/** Combat: two swords, the owner's own second set. */

/**
 * THE THREE DRUID BUILDS, decoded from the owner's URLs. 41/0/10, 9/34/8 and
 * 9/42/0, each exactly 51 points.
 *
 * MOONKIN READ 38/0/13 HERE while the comment seventeen lines below correctly
 * said "41 Balance / 10 Restoration, was 38/0/13" -- a header restating
 * figures that are also stated beside the thing they describe is a figure
 * written twice, and the one nobody edits is the one that drifts.
 *
 * ----------------------------------------------------------------------------
 * CAT AND BEAR WERE RE-SPECIFIED AT CLIENT BUILD 1.60.1.70170, Moonkin was not.
 * The patch removed King of the Jungle and Tiger's Fury, added Shifting Power
 * and Improved Shifting Power, moved Shredding Attacks up a row and renamed
 * Primal Fury to Blood Frenzy -- so neither feral URL decoded any more, and the
 * owner supplied both new ones with the notes.
 *
 * THE CAT LOST A TALENT IT WAS SPENDING FOUR POINTS ON and gained three: King
 * of the Jungle's three points and Feral Charge's one pay for Shifting Power 1,
 * Improved Shifting Power 2 and a third point of Naturalist.
 * ----------------------------------------------------------------------------
 */
/*
 * ============================================================================
 * MOONKIN -- 41 Balance / 10 Restoration, was 38/0/13.
 *
 * REFLECTION'S THREE POINTS BUY GENESIS 2 -> 5, worth **+5.7**. Reflection is
 * "50% of your Mana regeneration continues while casting" and this build ends a
 * fight with about **2,800 of 8,237 mana unspent** -- so it is regeneration on
 * a pool that never empties. Genesis is +1% periodic damage a rank, on the 28%
 * of this profile that is Moonfire and Insect Swarm.
 *
 * MOONGLOW STAYS, WHICH IS THE SAME ARGUMENT POINTING THE OTHER WAY and was
 * measured rather than assumed: it is also mana, and moving ITS three as well
 * came out **worse** (+4.4 against +5.7), because Genesis caps at 5 and the
 * spare three have nowhere to go but Improved Entangling Roots.
 *
 * RESTORATION'S TEN ARE FIVE REAL AND FIVE FORCED. Naturalist is +1% of
 * EVERYTHING a rank and sits at tier 5, so five points have to be under it --
 * and every tier-0 Restoration talent is healing, threat or cast pushback.
 * Nature's Focus is those five and does nothing at all.
 *
 * NATURE'S REACH IS NOT SPARE, which is worth saying because its first clause
 * is range: its second is +4% hit, and this build sits at exactly the 16%
 * usable spell cap WITH it.
 * ============================================================================
 */
const DRUID_MOONKIN_TALENTS: TalentAllocation = {
  improved_wrath: 5,
  genesis: 5,
  moonglow: 3,
  improved_moonfire: 2,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  nature_s_splendor: 1,
  insect_swarm: 1,
  vengeance: 5,
  improved_starfire: 5,
  nature_s_grace: 1,
  eclipse: 3,
  moonfury: 5,
  moonkin_form: 1,
  nature_s_focus: 5,
  naturalist: 5,
};

const DRUID_CAT_TALENTS: TalentAllocation = {
  genesis: 5,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  ferocity: 3,
  heart_of_the_wild: 5,
  feral_swiftness: 2,
  shredding_attacks: 3,
  savage_fury: 2,
  sharpened_claws: 2,
  shifting_power: 1,
  predatory_strikes: 3,
  blood_frenzy: 2,
  improved_shifting_power: 2,
  leader_of_the_pack: 1,
  natural_instinct: 2,
  rend_and_tear: 5,
  berserk: 1,
  furor: 5,
  naturalist: 3,
};

const DRUID_BEAR_TALENTS: TalentAllocation = {
  genesis: 5,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  ferocity: 4,
  heart_of_the_wild: 5,
  feral_swiftness: 2,
  feral_instinct: 3,
  thick_hide: 3,
  savage_fury: 2,
  feral_charge: 1,
  sharpened_claws: 2,
  primal_bite: 1,
  predatory_strikes: 3,
  blood_frenzy: 2,
  natural_instinct: 2,
  leader_of_the_pack: 1,
  natural_reaction: 5,
  rend_and_tear: 5,
  berserk: 1,
};

/**
 * THE TWO SHAMAN BUILDS, decoded from the owner's URLs. 38/13/0 and 17/34/0,
 * each exactly 51 points.
 *
 * ----------------------------------------------------------------------------
 * ELEMENTAL FURY AND ELEMENTAL ALACRITY SWAPPED TIERS at client build
 * 1.60.1.70170 -- Fury from row 3 to row 6 (tier 10 to tier 25), Alacrity the
 * other way -- and Call of Thunder now requires Alacrity 3 where it required
 * Fury 5. The patch notes do not mention it.
 *
 * THAT BROKE ONE BUILD AND NOT THE OTHER, which is the whole reason the two are
 * handled differently below. ELEMENTAL takes both talents, so the swap only
 * moved its digits and the allocation is byte-for-byte what the owner's original
 * URL decoded to; `tools/decode_talent_build.mjs` carries the re-encoded string
 * and says so. ENHANCEMENT spent 19 points in Elemental and five of them were
 * Elemental Fury, which is now unreachable below 25 -- so there is no re-encoding
 * of it, and the owner supplied a new URL when asked.
 * ----------------------------------------------------------------------------
 */
/**
 * Elemental -- 32 Elemental / 6 Enhancement / 13 Restoration, respecified.
 *
 * ----------------------------------------------------------------------------
 * IT WAS 38/13/0 AND THE THIRTEEN MOVED OUT OF ENHANCEMENT INTO RESTORATION.
 * Convection, Reverberation, Earthbound, Improved Ghost Wolf and Shamanistic
 * Focus are gone; Elemental Warding, Improved Fire Nova, Totemic Focus,
 * Mindfulness and Tidal Focus arrive.
 *
 * ALL THREE TREE TOTALS SUM FROM THE ICONS, which the panel prints and which
 * is the check: 32, 6 and 13 is 51.
 * ----------------------------------------------------------------------------
 */
const SHAMAN_ELEMENTAL_TALENTS: TalentAllocation = {
  /*
   * ==========================================================================
   * MINDFULNESS 3 AND CONVECTION 5, WORTH **+84.08 +/- 2.84** AT A 180 SECOND
   * FIGHT AND **+1.01 +/- 2.09, NOISE,** AT SIXTY.
   *
   * THE PREVIOUS SPREAD RESTED ON A FINDING THAT WAS TRUE ONLY AT ONE CLOCK.
   * It read, in capitals, that "the build is CAST-bound and not MANA-bound" --
   * measured, correctly, at the sixty seconds every profile here carries. Run
   * longer, the same build has **1.3% mana headroom at 180s and at 300s** and
   * its DPS falls 802 -> 546 -> 465: it spends the whole pool in the first
   * minute and then stands still. `tools/probe_clock.ts` prints it.
   *
   * SO EVERY MANA TALENT IN THIS TREE WAS PRICED IN THE ONE REGIME WHERE MANA
   * IS FREE. Convection 5/5 is 10% off Shock, Lightning Bolt, Lava Burst and
   * Chain Lightning: **-0.18 noise** then, **+19.05 +/- 2.35** now at 180s.
   *
   * ------------------------------------------------------------------------------
   * AND MINDFULNESS WAS NOT A CHOICE AT ALL -- IT WAS A BROKEN DECLARATION.
   * The owner's own spread spends 3 points there. The round that moved them out
   * recorded "`mindfulness` is threat" and measured **+2.95 +/- 0.63** for the
   * move, which was correct arithmetic on a talent that did nothing: it was
   * declared `scope: 'threat'` carrying `natural_grace`'s tooltip, one talent
   * across in the same tier. What it says is "Allows 17/33/50% of your Mana
   * regeneration to continue while casting", and this build regenerated **ZERO**
   * mana in a fight -- 163.65 MP5 suppressed by the five second rule from the
   * pull to the end. See `shamanEffects.ts`.
   *
   * THE RANK LADDER IS MONOTONE AND THE PAIR IS SUPER-ADDITIVE, which is what
   * says the figure is the mechanism and not a boundary artefact: 1/2/3 ranks
   * measure **+12.84 / +28.01 / +43.98** at 180s, and Convection on top takes
   * +43.98 and +19.05 to **+84.08** rather than to their 63.03 sum -- both buy
   * mana, and enough mana lifts the build out of the dry regime altogether.
   * Mana gained goes 12,317 -> 13,597 and Lightning Bolt 41.4 -> 51.0 casts a
   * fight, with Searing Totem's damage going slightly DOWN.
   *
   * ------------------------------------------------------------------------------
   * THE FIVE POINTS LEFT IN `elemental_warding` AND `trial_by_fire` ARE FORCED,
   * not filler by choice. The Elemental tree sits exactly on every tier gate
   * it needs -- and with Convection and Concussion both maxed there are only
   * seventeen points of LIVE talent below tier 20, against the twenty that
   * Lava Burst and Lightning Overload demand. So three dead points are the
   * price of reaching tier 20 and a fourth is the price of tier 25. Moving a
   * point DOWN a tree is always legal, which is why Convection could be bought
   * with `eye_of_the_storm` 3 and `elemental_reach` 2.
   *
   * REVERBERATION IS THE ONE REMAINING DESTINATION AND IT IS WORTH NOTHING:
   * **+0.03 +/- 0.47** for five points. It takes a second off a shock cooldown
   * that Call of Flame has already made irrelevant -- Flame Shock lasts
   * twenty-one seconds and the cooldown is six.
   *
   * ------------------------------------------------------------------------------
   * TIDAL FOCUS IS NOT FILLER AND MUST NOT BE MOVED. This build sits at exactly
   * **16.00** points of hit, which WAS the usable spell cap of 16 -- 17% miss
   * floored at 1% -- and five of those sixteen are this talent. THE OWNER HAS
   * SINCE REMOVED THE FLOOR, so the cap is 17 and this build misses 1%; the
   * point is on the benchmark template's hit row, which is the owner's. It is the only one of
   * the six profiles whose hit is school-BLIND; the three Mages and the Priest
   * sit at 11 and make it up with a school-scoped talent.
   * ==========================================================================
   */
  // Elemental, 32
  concussion: 5, convection: 5, elemental_warding: 3, call_of_flame: 3,
  elemental_focus: 1, elemental_alacrity: 3, trial_by_fire: 2,
  elemental_mastery: 1, lightning_overload: 3, elemental_fury: 5, lava_burst: 1,
  // Enhancement, 10
  thundering_strikes: 5, ancestral_knowledge: 5,
  // Restoration, 9
  // Totemic Focus's point moved to Shamanistic Focus, by the owner (round 37).
  tidal_focus: 5, mindfulness: 3, shamanistic_focus: 1,
};

/*
 * ============================================================================
 * FIVE DEAD POINTS BECAME REVERBERATION 5/5, worth **+16.19 +/- 3.61** paired
 * over 3000 iterations. 17/34/0 -> **19/32/0**, and Enhancement is still the
 * majority tree.
 *
 * WHAT CAME OUT, AND ALL THREE WERE RULED OUT RATHER THAN MERELY SMALL:
 *
 *   elemental_warding 3    reduces Fire, Frost and Nature damage TAKEN, and
 *                          this profile sets `targetAttacks: false`
 *   improved_ghost_wolf 1  `scope: 'positioning'` -- a travel form
 *   spirit_weapons 1       `scope: 'threat'` -- an unquantified parry chance
 *                          plus two threat clauses
 *
 * WHAT IT BUYS IS A SHOCK CHARGE. All three shocks share one `cooldownGroup`,
 * so 1.0 second off takes the group from 6.0s to 5.0s -- 12 charges in a 60
 * second fight where there were 10 -- and the build was already spending 9.1 of
 * the 10 (5.90 Earth Shocks plus 3.22 Flame Shocks). Flame Shock is
 * duration-bound at 21 seconds, so the extra charges all go to Earth Shock.
 *
 * ----------------------------------------------------------------------------
 * THE TIER ARITHMETIC IS WHY THESE THREE DESTINATIONS AND NOT OTHERS, and it
 * bounds the search in both trees at once.
 *
 * ELEMENTAL's seventeen sat exactly on `trial_by_fire`'s tier-15 gate -- 5 + 6 +
 * 4 below it is 15 -- so Elemental Warding's three could not LEAVE the tree
 * without stranding Fire Nova's cooldown reduction. They could move DOWN a row,
 * which is what makes Reverberation reachable and Restoration's Tidal Focus not.
 *
 * ENHANCEMENT held every gate with slack -- 17 below tier 15 where 15 is wanted,
 * 33 below tier 30 where 30 is wanted -- so at most THREE points could leave it
 * and at most TWO of those from rows 0-2. `mental_dexterity` 3 and
 * `mental_quickness` 2 are locked by `requiresRanks` on Flurry and on the
 * capstone.
 *
 * ----------------------------------------------------------------------------
 * EVERY OTHER DESTINATION WAS MEASURED AND THREE OF THEM ARE WORTH EXACTLY
 * NOTHING, which is a statement about the tree rather than a gap in the search:
 *
 *   convection 3           **IDENTICAL FIGHTS.** 10% off the shocks and the
 *                          bolt, on a build ending the fight with 1,984 mana of
 *                          headroom. The containment check that this build is
 *                          NOT mana-bound, which `docs/handoff/shaman.md` still
 *                          says it is
 *   elemental_alacrity 3   **IDENTICAL FIGHTS.** Cast time on Lightning Bolt,
 *                          which this list only ever casts at five Maelstrom
 *                          stacks, where it is already instant
 *   improved_stormstrike 1 +0.50 +/- 3.89, noise. Its live clause is 50% mana
 *                          regeneration while casting, which is the same
 *                          nothing Convection buys
 *
 * And two are real and smaller: `tidal_focus` 2 is **+3.46 +/- 1.51** (spell
 * miss 9% -> 7%; melee and specials are already capped) and the fifth rank of
 * `ancestral_knowledge` is **+1.47 +/- 0.15**. Reverberation 5 plus either of
 * them is inside Reverberation 5's own interval -- +17.28 and +16.48 against
 * +16.19 -- so the smallest edit wins and both live clauses stay whole.
 *
 * ----------------------------------------------------------------------------
 * AND THE OWNER'S OWN URL DISAGREED WITH THIS PRESET ABOUT EXACTLY THESE THREE
 * POINTS BEFORE ANY OF IT: `decode_talent_build.mjs --presets` reports
 * `elemental_alacrity 0->3, elemental_warding 3->0`, so the stored link spends
 * them on Alacrity where the preset spends them on Warding. **Both measure
 * zero**, which is why the drift cost nothing and why it is worth recording
 * rather than quietly resolving -- which of the two is stale is the owner's.
 * ============================================================================
 */
const SHAMAN_ENHANCEMENT_TALENTS: TalentAllocation = {
  // Elemental, 19
  concussion: 5,
  call_of_flame: 3,
  elemental_devastation: 3,
  reverberation: 5,
  elemental_focus: 1,
  // Trial by Fire is Improved Fire Nova renamed, same row and same two clauses.
  trial_by_fire: 2,
  // Enhancement, 32
  thundering_strikes: 5,
  ancestral_knowledge: 4,
  mental_dexterity: 3,
  elemental_weapons: 3,
  shamanistic_focus: 1,
  flurry: 5,
  stormstrike: 1,
  mental_quickness: 2,
  improved_stormstrike: 2,
  maelstrom_weapon: 5,
  rage_of_the_farseer: 1,
};

/**
 * THE THREE MAGE BUILDS, decoded from the owner's URLs. 0/29/22, 47/4/0 and
 * 10/39/2, each exactly 51 points.
 *
 * FROSTFIRE HAS NO CAPSTONE IN EITHER TREE, which is why the rotation is
 * chosen by points spent rather than by a 31-point talent the way the Rogue's
 * is.
 */
const MAGE_FROSTFIRE_TALENTS: TalentAllocation = {
  /*
   * ==========================================================================
   * FOUR DEAD POINTS TRADED FOR FOUR LIVE ONES, worth **+28.5 +/- 9.5** paired
   * over 400 iterations.
   *
   * `burning_soul` was three points of cast pushback and threat and
   * `flame_throwing` one of range -- all four permanent rulings, so they could
   * never do anything. What replaces them:
   *
   *   INCINERATION 3        +6% crit on Fire Blast, Ice Lance, Arcane Blast and
   *                         Scorch. This build casts three of the four.
   *   IMPROVED FIRE BLAST 1 a second off a cooldown it presses six times a
   *                         fight, which is Wake of Fire renamed.
   *
   * THEY WERE ALSO TIER TAX, WHICH IS WHY THE REPLACEMENTS ARE IN ROWS 0-2.
   * The Fire tree needs fifteen points above row three to reach Improved
   * Scorch, Heating Up and Master of Elements, and those four were part of the
   * fifteen -- so deleting them would have cost three talents. **A dead point
   * can be load-bearing**, and the only question is what else can hold the tier
   * up.
   *
   * CRITICAL MASS IS 4/5 AND NOT 5/5 for the same reason the Fire Mage's is
   * 5/5: the client took it from three ranks to five and took Fire Power from
   * five to three in the same patch, so this build's lost Fire Power rank paid
   * for one Critical Mass rank and the Fire Mage's two paid for Combustion's
   * new 5/5 prerequisite.
   * ==========================================================================
   */
  // Fire, 29
  improved_fire_blast: 1, incineration: 3, improved_fireball: 5,
  ignite: 5, pyroblast: 1,
  improved_scorch: 3, heating_up: 1, master_of_elements: 3,
  critical_mass: 4, fire_power: 3,
  // Frost, 22
  elemental_precision: 5, ice_shards: 5,
  piercing_ice: 3, frost_channeling: 3, ice_lance: 1,
  shatter: 3, fingers_of_frost: 2,
};

/**
 * Arcane -- 35 Arcane / 11 Fire / 5 Frost, respecified.
 *
 * ----------------------------------------------------------------------------
 * IT WAS 47/4/0, so TWELVE POINTS LEFT THE ARCANE TREE. What goes is the
 * defensive and utility filler -- Wand Specialization, Magic Absorption,
 * Arcane Resilience, Arcane Geometry, Arcane Shielding, Improved Counterspell
 * -- and what arrives is IGNITE, PYROBLAST and ELEMENTAL PRECISION, which is
 * the list's new Pyroblast entry paid for in talents.
 *
 * THE LIST AND THE ALLOCATION ARE ONE CHANGE, the shape these respecifications
 * keep taking: the APL gained a Pyroblast and the build had no Pyroblast
 * talent, and a list naming an ability the build cannot cast is skipped IN
 * SILENCE.
 *
 * All three tree totals sum from the icons: 35, 11 and 5 is 51.
 * ----------------------------------------------------------------------------
 */
const MAGE_ARCANE_TALENTS: TalentAllocation = {
  // The owner's respecification, decoded from https://talentsforever.com/mage/60/1552225223122311531-03--UDCBEFGHKONMJILPQRSA-7
  wand_specialization: 1,
  arcane_focus: 5,
  improved_channeling: 5,
  missile_barrage: 2,
  arcane_subtlety: 2,
  magic_absorption: 2,
  arcane_concentration: 5,
  arcane_resilience: 2,
  arcane_geometry: 2,
  arcane_impact: 3,
  arcane_blast: 1,
  arcane_shielding: 2,
  improved_counterspell: 2,
  arcane_meditation: 3,
  arcane_wrath: 1,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  incineration: 3,
};

/**
 * Fire -- 16 Arcane / 31 Fire / 4 Frost, respecified.
 *
 * ----------------------------------------------------------------------------
 * IT WAS 10/39/2. The Fire tree LOSES eight -- Flame Throwing, Impact, Burning
 * Soul, Blast Wave and one of Wake of Fire -- and Arcane gains six, which buys
 * ARCANE SUBTLETY, ARCANE IMPACT and MISSILE BARRAGE. The list's Arcane
 * Missiles entry is gated on Missile Barrage, and this build did not have the
 * talent: the list and the allocation are one change again.
 *
 * MASTER OF ELEMENTS GOES 1 -> 3, which is the other half of the mana story --
 * this is the build whose Evocation the owner has also loosened.
 *
 * All three tree totals sum from the icons: 16, 31 and 4 is 51.
 * ----------------------------------------------------------------------------
 */
const MAGE_FIRE_TALENTS: TalentAllocation = {
  /*
   * ==========================================================================
   * ARCANE SUBTLETY'S TWO DEAD POINTS BUY THE LAST POINT OF HIT AND MISSILE
   * BARRAGE'S SECOND RANK, worth **+28.8 +/- 8.2** together.
   *
   * `arcane_subtlety` is threat plus target spell resistance, which the owner
   * has ruled has no effect on an enemy target -- so both points were permanent
   * rulings. The two halves measure separately:
   *
   *   MISSILE BARRAGE 1 -> 2        **+19.8**  every chance doubles, and the
   *                                 Fireball trigger goes 10% -> 20% on a spell
   *                                 cast eleven times a fight
   *   ELEMENTAL PRECISION 4 -> 5    **+10.8**  the only hit gap in the three
   *                                 Mages
   *
   * THE HIT POINT IS THE ONE WORTH EXPLAINING. All three Mages sit at 11 points
   * of school-BLIND hit where the usable spell cap is 16, and the missing five
   * arrive as SCHOOL-scoped hit from a talent. Frostfire's Elemental Precision
   * 5/5 and the Arcane build's Arcane Focus 5/5 close it for everything those
   * builds cast; this one was at 4/5, so its Fire spells missed 2% where the
   * floor is 1%. **One point, on 90% of the profile's damage.**
   *
   * AND THE TWO DO NOT SUM: 19.8 + 10.8 is 30.6 against a measured 28.8,
   * because both buy casts and the casts come out of the same global cooldowns.
   * Marginal values, not addends.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * ONE POINT OF CLEARCASTING WOULD BUY FIRE BLAST'S SECOND COOLDOWN RANK --
   * 7 seconds to 6 -- AND IT IS **NOT TAKEN**, because it is worth +2.92 at a
   * one-minute fight and **-33.76 +/- 7.52 at a five-minute one.**
   *
   * ==========================================================================
   * THE CLOCK IS WHAT DECIDES IT, AND A 60-SECOND MEASUREMENT SAID THE
   * OPPOSITE. Against the pre-round build the swap measured **+8.00 +/- 3.10**
   * at 1500 paired iterations, and on the finished list it is +2.92 +/- 2.81 --
   * both real, both positive, and both answers about a one-minute clock.
   *
   * AT 300s IT IS THE LARGEST SINGLE LOSS THIS ROUND MEASURED. Reverting it on
   * the shipped build is +33.76 +/- 7.52, and reverting the whole package is
   * +34.12 -- so essentially all of the long-fight loss is this one point.
   *
   * AND THE MECHANISM WAS PREDICTED BEFORE IT WAS MEASURED, which is the only
   * reason it was looked for. This build is GLOBAL-COOLDOWN bound at 60s with
   * 2,615 mana spare and MANA bound by 300s with 196 -- and Fire Blast costs
   * 340 mana for about 1,347, where the filler costs 410 for about 1,781. More
   * Fire Blasts is more damage per global cooldown and LESS damage per mana, so
   * the change is worth something exactly as long as the global cooldown is
   * what binds.
   *
   * THE OWNER'S STANDING INSTRUCTION IS WHY THIS IS A REVERT RATHER THAN A
   * FOOTNOTE: "rotations need to be built for longer than 1 minute ... ensure
   * that variable combat time is taken into account." A change that buys 2.9
   * DPS at one minute and gives back 33.8 at five is not a change.
   *
   * THE SCORCH WINDOW THAT SHIPPED ALONGSIDE IT HOLDS AT BOTH LENGTHS, which
   * is what makes this a statement about the talent rather than about the
   * round: +5.03 +/- 3.20 at 60s and -1.57 +/- 7.59 at 300s, which is noise.
   * ==========================================================================
   *
   * WHAT IS BELOW IS STILL TRUE AND IS KEPT, because it is the map of this
   * tree's whole design space and the next round should not re-derive it.
   *
   * THE FIRE TREE IS FORCED AND THE ARCANE ONE IS NOT, which is the whole of
   * why the donor is the question. Combustion sits at tier 30 and
   * `pointsBelowTier` counts STRICTLY below it, so all 30 Fire points under the
   * capstone are load-bearing -- take one out anywhere and the capstone is
   * refunded. What is not forced is WHICH of them, and the Fire tree has
   * exactly TWO unspent slots that are not a declared `OutOfScope` member:
   * this one, and Blast Wave.
   *
   * FIRE BLAST IS THE DESTINATION TO WANT FOR TWO REASONS RATHER THAN ONE. It
   * is 898 damage a second of global cooldown against the filler's 712, AND it
   * is the Heating Up engine -- "Fire Blast grants an additional stack every
   * time it deals damage", so a crit gives two and a miss still gives one.
   * More Fire Blasts is more Pyroblasts.
   *
   * CLEARCASTING IS THE DONOR BECAUSE IT IS WORTH NOTHING HERE, and that was
   * measured rather than argued: `arcane_concentration 0/5` with all five
   * points parked in `improved_channeling` -- pure cast pushback, a declared
   * `OutOfScope` member -- is **+10.02 +/- 5.68**. Five points of Clearcasting
   * are worth NEGATIVE ten DPS.
   *
   * AND THE REASON IS NOT THE MANA, IT IS THE FIRE BLAST GATE. `fire_blast` is
   * gated on `selfLacks('clearcasting')` by the owner's own instruction, so
   * every proc HOLDS the instant above -- and `fire_blast ungated` measures
   * **+7.68 +/- 3.22** by itself, which accounts for nearly all of the 10.02.
   * With the gate removed as well, dropping the talent entirely is still
   * +10.02 and the two builds run bit-identical fights, because a 0/5 talent
   * makes `selfLacks('clearcasting')` permanently true.
   *
   * SO THE DONOR CHOICE SURVIVES WHATEVER THE OWNER RULES ABOUT THAT GATE,
   * which is why this ships and the gate does not: with the gate gone,
   * Clearcasting's own contribution is 10.02 - 7.68 = about 2.3 on an interval
   * of 6.5, which is nothing. This build ends a 60 second fight with 2,782 mana
   * unspent and `manaPer5` weighs 0.0000, so a mana saving has nothing to buy.
   *
   * THE TWO ALTERNATIVE DONORS BOTH MEASURE WORSE AND NEITHER IS SEPARABLE
   * FROM THIS ONE: `master_of_elements` 3 -> 2 is +4.63 +/- 2.69 and
   * `arcane_impact` 3 -> 2 is +3.54 +/- 2.69, against +8.00 +/- 3.10 here. The
   * gaps are inside the combined intervals, so what chose this one is the
   * mechanism above rather than the ranking.
   *
   * `elemental_precision` IS NOT A CANDIDATE. Its fifth point is the Fire hit
   * cap and measured +10.8 when it was bought: all three Mages sit at 11 points
   * of school-blind hit against what was a usable spell cap of 16 (17 since the
   * owner removed the 1% floor), and the missing five
   * arrive as school-scoped hit from a talent.
   *
   * BLAST WAVE IS THE OTHER SLOT AND IS WORTH EXACTLY NOTHING, which took two
   * measurements that agreed to the decimal to establish. Taking it measured
   * +2.59 +/- 1.70 -- and so did taking it AND giving it a list entry, the same
   * figure with the same spread, which is this project's own tell for a patch
   * that did not apply. It applied: an ungated `fireball` sits at the bottom of
   * the list and an unconditional entry is a FLOOR under everything below it,
   * so a new entry there can never be reached. Every point of that +2.59 was
   * the OTHER half of the variant -- one fewer rank of Clearcasting. The
   * arithmetic agrees: 493 base plus a 0.129 coefficient is about 594 before
   * multipliers, which is 582 damage a second of global cooldown against the
   * filler's 712.
   * ==========================================================================
   */
  // Arcane, 15
  arcane_focus: 5,
  arcane_concentration: 5,
  arcane_impact: 3,
  missile_barrage: 2,
  // Fire, 31
  improved_fire_blast: 1,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 5,
  fire_power: 3,
  combustion: 1,
  // Frost, 5
  elemental_precision: 5,
};

/**
 * THE THREE PALADIN BUILDS, decoded from the owner's URLs. 15/0/36, 23/0/28
 * and 8/34/9, each exactly 51 points.
 *
 * EACH HAS A DIFFERENT CAPSTONE, which is what lets the rotation tell them
 * apart: Twist of Light, Holy Shock and Holy Shield belong to exactly one
 * build each.
 *
 * ----------------------------------------------------------------------------
 * ALL THREE WERE RE-SPECIFIED AT CLIENT BUILD 1.60.1.70170, AND THE PATCH NOTES
 * NAME NEITHER TALENT THAT FORCED IT. The client dropped IMPROVED HOLY STRIKE
 * from Holy and CRUSADE from Retribution; all three builds spent two points in
 * the first and two of them spent two in the second, so none of the three URLs
 * decoded any more -- 4, 4 and 2 points with nowhere to be.
 *
 * WHICH IS A DECISION AND NOT A TRANSCRIPTION, so it was asked rather than
 * guessed: the owner supplied three new URLs. What they bought is recorded here
 * because "where did these points go" is the first question a reader of the
 * baseline table will have. Retribution took Divine Intellect to 5 and two of
 * Unyielding Faith; the Shockadin took Divine Strength to 5 and two of
 * Vindication; Protection took Divine Strength to 5 and two of Holy Conduit,
 * paying for the second with a point each off Anticipation and Reckoning.
 * ----------------------------------------------------------------------------
 */
const PALADIN_RETRIBUTION_TALENTS: TalentAllocation = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  // Unyielding Faith's two points moved to Reverence, by the owner (round 37).
  reverence: 2,
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  seal_of_command: 1,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  two_handed_weapon_specialization: 3,
  vengeance: 3,
  champion_of_the_light: 3,
  instrument_of_law: 2,
  twist_of_light: 1,
};

/*
 * ============================================================================
 * THE TWO SHOCKADIN TREES, AND THE TIER RULE THAT SHAPES BOTH OF THEM.
 *
 * A TALENT'S TIER COUNTS POINTS IN STRICTLY LOWER TIERS -- not its own ranks,
 * and not its neighbours' in the same row. That is `pointsBelowTier`, and it
 * was measured against talentsforever.com after a generated build URL was
 * pasted in and came back with six points refunded. It is the entire shape of
 * what follows, so it is written out as tiers rather than as one flat object:
 *
 *   Holy Shock, Divine Precision, Consecrated Ground   tier 20
 *   Vengeance, Two-Handed Weapon Specialization        tier 20 (Retribution)
 *   Champion of the Light                              tier 25 (Retribution)
 *
 * SO ALMOST THE WHOLE TREE IS FORCED. Twenty below tier 20 in Holy to reach
 * Holy Shock, twenty below tier 20 in Retribution to reach Vengeance, and
 * twenty-five below tier 25 to reach Champion of the Light -- which leaves the
 * SHIELD build two free points and the TWO-HANDER one.
 *
 * AND THE TWO-HANDER HAS FEWER BECAUSE ITS TIER 20 IS FULLER. Vengeance and
 * Two-Handed Weapon Specialization are both tier 20 and both wanted, which is
 * six points there: twenty-five below tier 25 minus six leaves nineteen below
 * tier 20, one short of what tier 20 needs. So Retribution goes to 29 and Holy
 * to 22. That is not a preference, it is arithmetic, and it is the kind of
 * thing a flat allocation hides.
 * ----------------------------------------------------------------------------
 * WHAT CHANGED FROM THE OWNER'S 23/0/28, measured on the two-hander over 600
 * to 3,000 paired iterations:
 *
 *   Consecrated Ground            the free points. +10% Holy damage carried by
 *                                 the Consecration debuff, on a build that is
 *                                 three-quarters Holy
 *   Two-Handed Weapon Spec 3/3    the two-hander only, and it is what pushes
 *                                 Retribution to 29
 *   Vindication 2 -> 3            inside the forced twenty
 *
 * AND MANA IS NOT WHAT BINDS THIS BUILD, which is what makes the filler
 * genuinely filler: swapping Benediction 5/5 for Deflection 5/5 measured
 * **bit-identical fights** -- the same rolls in the same order, which is the
 * strongest statement the harness can make. The profile ends a fight with
 * about 3,200 mana unspent.
 * ============================================================================
 */

/** Holy tiers 0-15: the twenty points that open tier 20. */
const SHOCKADIN_HOLY_BELOW_20: TalentAllocation = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  /*
   * SIX OF THESE NINE ARE FILLER AND EVERY CANDIDATE IS DEAD. Holy's tiers 5
   * and 10 offer healing, fear duration, a dispel, cast pushback and mana
   * regeneration while casting; twenty points have to be here to reach Holy
   * Shock at all. Reverence and Healing Light are what the owner's own build
   * used, so they stay.
   */
  reverence: 3,
  healing_light: 3,
  /*
   * DIVINE FAVOR IS TIER 15 AND THEREFORE PART OF THE TWENTY, which is what
   * makes it free: the point is one the tier requirement needs anyway, and the
   * ability it grants is worth **+9.7** now that it starts no global cooldown.
   */
  divine_favor: 1,
};

/** Retribution tiers 0-15: the twenty that open tier 20. */
const SHOCKADIN_RET_BELOW_20: TalentAllocation = {
  improved_judgement: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  sacred_arbiter: 1,
  // Six of filler. See the note above on why none of it can pay.
  benediction: 5,
  holy_conduit: 1,
};

/**
 * 1H AND SHIELD -- 23 Holy / 28 Retribution.
 *
 * Twenty-two below Retribution's tier 20 rather than twenty, because Champion
 * of the Light needs twenty-five below tier 25 and Vengeance alone only brings
 * it to twenty-three. The two spare go into Holy Conduit and Pursuit of
 * Justice, which is where Retribution's dead points live.
 */
const PALADIN_SHOCKADIN_TALENTS: TalentAllocation = {
  ...SHOCKADIN_HOLY_BELOW_20,
  holy_shock: 1,
  consecrated_ground: 2,
  ...SHOCKADIN_RET_BELOW_20,
  holy_conduit: 2,
  pursuit_of_justice: 1,
  vengeance: 3,
  champion_of_the_light: 3,
};

/**
 * THE FAST TWO-HANDER -- 22 Holy / 29 Retribution.
 *
 * Two-Handed Weapon Specialization is the only talent in the class that reads
 * the weapon this profile is named for, and taking it beside Vengeance fills
 * Retribution's tier 20 with six points. That forces the twenty below it to be
 * exactly twenty, pushes the tree to 29, and leaves Holy one free point where
 * the shield build has two -- so Consecrated Ground is 1/2 here and 2/2 there.
 */
const PALADIN_SHOCKADIN_2H_TALENTS: TalentAllocation = {
  ...SHOCKADIN_HOLY_BELOW_20,
  holy_shock: 1,
  // One point from Two-Handed Weapon Specialization, by the owner (round 37).
  consecrated_ground: 2,
  ...SHOCKADIN_RET_BELOW_20,
  vengeance: 3,
  two_handed_weapon_specialization: 2,
  champion_of_the_light: 3,
};

const PALADIN_PROTECTION_TALENTS: TalentAllocation = {
  divine_strength: 5,
  improved_seals: 3,
  redoubt: 5,
  precision: 3,
  anticipation: 2,
  improved_seal_of_fury: 1,
  improved_righteous_fury: 3,
  shield_specialization: 3,
  sacred_duty: 2,
  swift_judgement: 1,
  one_handed_weapon_specialization: 3,
  templar_s_bulwark: 1,
  reckoning: 4,
  iron_creed: 5,
  holy_shield: 1,
  deflection: 5,
  improved_judgement: 2,
  holy_conduit: 2,
};

/**
 * THE THREE HUNTER BUILDS, decoded from the owner's URLs. 31/20/0, 5/41/5 and
 * 5/13/33, each exactly 51 points. (There are four Hunter presets now; Hawk
 * Melee arrived later and has its own block.)
 *
 * TWO OF THE THREE WERE STALE HERE -- 7/39/5 and 7/13/31 -- while the blocks
 * below state both correctly with their own "was" values. Same drift as the
 * Druid header above: the restatement is what rots.
 *
 * ONLY THE FIRST BRINGS A PET. Both Lone Wolf builds take the talent that
 * reads "while you do not have an active pet", which is what makes it a
 * choice rather than an oversight -- and it is worth 20% damage for making it.
 */
const HUNTER_BEAST_MASTERY_TALENTS: TalentAllocation = {
  deadly_aspects: 5,
  endurance_training: 3,
  focused_fire: 2,
  bestial_swiftness: 1,
  unleashed_fury: 5,
  ferocity: 5,
  summon_hawk: 1,
  intimidation: 1,
  bestial_discipline: 2,
  frenzy: 5,
  bestial_wrath: 1,
  /*
   * ==========================================================================
   * MARKSMANSHIP IS TWENTY POINTS AND EIGHTEEN OF THEM ARE FORCED.
   *
   * Bestial Wrath is tier 30 of Beast Mastery, so thirty-one of the fifty-one
   * are spoken for before Marksmanship starts; Mortal Shots is tier 15, so
   * fifteen have to sit below it and its own five go on top. Hawk Eye, Lethal
   * Attacks and Careful Aim come to thirteen -- **so this build's entire talent
   * design space is TWO points, and they must be below tier 15.**
   *
   * IMPROVED STINGS RATHER THAN EFFICIENCY, worth **+11.2** on its own and
   * **+41.7** beside the Arcane Shot entry the list was missing. Efficiency is
   * mana, and this profile ends a fight with about 3,100 of 7,961 unspent.
   *
   * IMPROVED ARCANE SHOT WAS THE OTHER CANDIDATE AND LOSES, which is worth
   * saying because it looks like the obvious partner to the new list entry: at
   * 2/2 it measured **+25.0** against Improved Stings' **+41.7**, because more
   * Arcane Shots crowd out Aimed Shots, which hit for about half as much again.
   * Measured before the entry existed it was BIT-IDENTICAL -- a talent whose
   * ability no list casts.
   * ==========================================================================
   */
  hawk_eye: 3,
  lethal_attacks: 5,
  improved_stings: 2,
  careful_aim: 5,
  mortal_shots: 5,
};

/**
 * LONE WOLF RANGED -- 5 Beast Mastery / 39 Marksmanship / 7 Survival.
 *
 * ============================================================================
 * TWO POINTS OUT OF FOCUSED FIRE AND INTO SURVIVALIST, by the owner, and
 * **BOTH ENDS OF THAT MOVE ARE WORTH EXACTLY NOTHING TO THIS PROFILE.** Said
 * plainly because a talent change that cannot move a figure reads as a
 * measurement that failed to apply.
 *
 *   FOCUSED FIRE   "increases all damage you and your pet deal by 2% WHILE
 *                  YOUR PET IS ACTIVE". `bringsPet` is exactly
 *                  `lone_wolf === 0`, so this build has no pet and the clause
 *                  has never paid -- it was a cheap route to Careful Aim and
 *                  nothing else. (It DID pay once, wrongly: the talent shipped
 *                  with `requires: {}` and both Lone Wolf builds collected the
 *                  2% for a pet that is never built. That is fixed, which is
 *                  what makes these two points genuinely free to move.)
 *   SURVIVALIST    "+10% total Health" at 5/5, so +4% here. This profile sets
 *                  `targetAttacks: false` and is never hit, so health is a
 *                  number nothing reads.
 *
 * SO THE EXPECTED MEASUREMENT IS 0.0 TO THE DECIMAL, which is a prediction
 * and is checked rather than assumed. What the move DOES change is the tree
 * totals a person reads on the panel, and those are the owner's to set.
 * ============================================================================
 */
/*
 * ============================================================================
 * LONE WOLF RANGED -- 5 Beast Mastery / 41 Marksmanship / 5 Survival, was
 * 5/39/7.
 *
 * WHAT MOVED: Survivalist's two points and two of Marksmanship's dead ones
 * (Rapid Killing, Scatter Shot) buy **Improved Stings 3/3**, worth **+20.8**.
 * Serpent Sting is 11.4% of this build's damage and the talent is +20% of it.
 *
 * AND THE THINGS THAT MOVED OUT MEASURED BIT-IDENTICAL FIGHTS, which is the
 * strongest statement this harness makes: swapping Survivalist for Efficiency
 * ran the same rolls in the same order. Survivalist is +10% health on a profile
 * nothing attacks; Rapid Killing takes Rapid Fire's cooldown from five minutes
 * to three, and the fight is sixty seconds; Scatter Shot is a disorient.
 *
 * THE FOUR POINTS LEFT IN EFFICIENCY ARE FILLER AND ARE SAID SO. Marksmanship
 * needs thirty below Sniper Shot's tier 30, which is more than its useful
 * talents come to -- and this build ends a fight with about 1,570 of 8,071 mana
 * unspent, so a cost reduction buys nothing. They are in a mana talent because
 * there is nowhere better, not because they pay.
 * ============================================================================
 */
const HUNTER_LONE_WOLF_RANGED_TALENTS: TalentAllocation = {
  // Beast Mastery, 5
  deadly_aspects: 5,
  // Marksmanship, 41
  hawk_eye: 3,
  lethal_attacks: 5,
  improved_stings: 3,
  careful_aim: 5,
  efficiency: 4,
  improved_arcane_shot: 5,
  lone_wolf: 1,
  trueshot_aura: 1,
  mortal_shots: 5,
  barrage: 3,
  ranged_weapon_specialization: 5,
  sniper_shot: 1,
  // Survival, 5
  improved_tracking: 5,
};

/*
 * ----------------------------------------------------------------------------
 * HAWK MELEE -- 16/11/24. Sixteen points into Beast Mastery for Summon Hawk and
 * Unleashed Fury, and LONE WOLF KEPT. Decoded from the ruleset owner's build:
 *
 *   https://talentsforever.com/hunter/60/50032005001-005005001-5002500300501201-gjk3nkqstvAHSVYEDK-6
 *
 * IT TAKES BOTH LONE WOLF AND SUMMON HAWK, which is the combination the whole
 * profile rests on and the one that decides how `hunterRotation` tells the two
 * melee lists apart. `bringsPet` is exactly `lone_wolf === 0`, so this build has
 * NO PET -- it is Lone Wolf Melee's 20% with a hawk bolted on, not a pet build.
 *
 * THE OWNER MEASURED IT AGAINST A 16/10/25 ALTERNATIVE THAT DROPPED LONE WOLF
 * FOR THE PET, and this one won by 20.7 -- 824.4 against 803.8. The pet and its
 * Claw and Bite were 13.2% of that profile and did not cover the 20% they cost.
 * Both readings were live until they were measured; see docs/handoff/hunter.md.
 *
 * FIVE OF ITS FIFTY-ONE POINTS DO NOTHING HERE and it wins anyway. Improved
 * Aspect of the Monkey is dodge from an Aspect no damage profile uses, and
 * Pathfinding is `scope: 'positioning'`, which is a permanent ruling rather
 * than a gap. Recorded rather than quietly re-spent: the allocation is the
 * owner's, and a preset that improved on it would stop being the build they
 * specified.
 * ----------------------------------------------------------------------------
 */
const HUNTER_HAWK_MELEE_TALENTS: TalentAllocation = {
  deadly_aspects: 5,
  improved_aspect_of_the_monkey: 3,
  pathfinding: 2,
  unleashed_fury: 5,
  summon_hawk: 1,
  lethal_attacks: 5,
  careful_aim: 5,
  lone_wolf: 1,
  improved_tracking: 5,
  savage_strikes: 2,
  survivalist: 5,
  surefooted: 3,
  predator_s_edge: 5,
  resourcefulness: 1,
  expose_prey: 2,
  strider_kick: 1,
};

/**
 * LONE WOLF MELEE -- 5 Beast Mastery / 13 Marksmanship / 33 Survival.
 *
 * ============================================================================
 * THE SAME TWO POINTS OUT OF FOCUSED FIRE AS LW RANGED, and they land on
 * SURVIVALIST'S DISCIPLINE here. **Both ends are worth nothing again, and for
 * a different reason at the far end** -- which is worth separating, because
 * one of the two reasons expires and the other does not.
 *
 *   FOCUSED FIRE               no pet, so the clause cannot pay. A BUILD
 *                              cause, and it expires only if this build takes
 *                              a pet, which Lone Wolf forbids.
 *   SURVIVALIST'S DISCIPLINE   "reduces the cooldown of your Trap and
 *                              Deterrence abilities by 40%" -- declared
 *                              `unmodelled`, because `abilityCooldown`
 *                              subtracts a FLAT amount and has no fractional
 *                              form. **An ENGINE cause, and it expires the day
 *                              somebody adds one**, at which point this build
 *                              gains two points of real effect without
 *                              anybody touching it.
 *
 * SO THIS IS A LIVE GAP ARRIVING IN A PROFILE, which the census counts and a
 * DPS figure cannot see. Expected measurement: 0.0 to the decimal.
 * ============================================================================
 */
const HUNTER_LONE_WOLF_MELEE_TALENTS: TalentAllocation = {
  // Beast Mastery, 5
  deadly_aspects: 5,
  // Marksmanship, 13
  lethal_attacks: 5,
  careful_aim: 5,
  rapid_killing: 2,
  lone_wolf: 1,
  // Survival, 33
  improved_tracking: 5,
  savage_strikes: 2,
  survivalist: 4,
  surefooted: 3,
  deterrence: 1,
  predator_s_edge: 5,
  resourcefulness: 2,
  expose_prey: 2,
  survivalist_s_discipline: 2,
  strider_kick: 1,
  lightning_reflexes: 5,
  lacerating_strikes: 1,
};

/**
 * THE TWO WARLOCK BUILDS, decoded from the owner's URLs. 40/11/0 and 5/11/35,
 * each exactly 51 points.
 *
 * BOTH TAKE DEMONIC SACRIFICE, so neither keeps a demon: SM/DS sacrifices the
 * Imp for +15% Shadow and Firelock the Succubus for +15% Fire, which is what
 * those profile names mean. That makes the Warlock the second class running
 * whose builds opt out of the pet system, after both Lone Wolf hunters.
 */
/*
 * ONE POINT MOVED OUT OF SUPPRESSION AND INTO AMPLIFY CURSE, at the ruleset
 * owner's instruction. Suppression drops to 4/5, so the build keeps 4 points of
 * spell hit rather than 5, and gains a 50% opener on the first Bane of Agony
 * for free -- Amplify Curse is off the global cooldown, so the Bane it precedes
 * pays nothing for it.
 *
 * STILL EXACTLY 51 POINTS. The allocation is checked by the profile tests,
 * which is what catches a point going missing rather than moving.
 */
const WARLOCK_AFFLICTION_TALENTS: TalentAllocation = {
  suppression: 4,
  amplify_curse: 1,
  improved_corruption: 5,
  improved_drains: 3,
  improved_bane_of_agony: 2,
  pandemic: 3,
  malevolence: 5,
  nightfall: 2,
  siphon_life: 1,
  soul_siphon: 3,
  shadow_mastery: 5,
  wrack: 1,
  /*
   * ==========================================================================
   * MALEDICTION'S FIVE POINTS BECOME BANE, AND THE PROFILE'S OWN OPENER IS WHAT
   * CHOSE THAT -- not a measurement and not a preference.
   *
   * Malediction was deleted at client build 1.60.1.70425 and GRIM REACH took
   * its slot at two ranks, so five points needed a home. Nothing live was left
   * in Affliction: Grim Reach is `positioning`, Soul Harvest needs a kill, Fel
   * Concentration is `castPushback`, and the fifth point of Suppression is one
   * the OWNER moved out deliberately. Malediction was +% to every periodic
   * effect on the project's most DoT-heavy build, so what replaced it replaces
   * nothing -- that is the ruleset's change and not a hole to fill.
   *
   * WHAT POINTS AT BANE IS THIS PRESET'S `precombat`: the owner specified "2.5s
   * before start casting Shadow Bolt", and Shadow Bolt DECLARES three seconds.
   * `secondsBefore` is the cast time on the BUILD, so a 2.5 second lead says
   * this character casts Shadow Bolt in 2.5 seconds -- and Bane at 5/5 is
   * exactly 0.5 seconds off it. Nothing else in the Warlock's three trees
   * touches that cast.
   *
   * SO THE BUILD HAD BEEN MISSING A TALENT THE OWNER'S OPENER ASSUMED, AND THE
   * COMMENT BESIDE THAT OPENER SAID SO WITHOUT ANYBODY CHECKING. It reads "the
   * declaration says 3.0 and BANE takes half a second off it" and is cited in
   * CLAUDE.md as the sharpest evidence for how a lead is read -- on a build
   * that spent no points in Destruction at all. **A comment explaining a number
   * can be true of the ruleset and false of the profile it sits on**, and this
   * one was describing the Firelock, which does take Bane 5/5.
   *
   * IT COST NOTHING AT THE PULL AND THE REPAIR IS STILL REAL. `runPrecombat`
   * ages by the lead MINUS the cast time clamped at zero, so a 2.5 second lead
   * on a 3.0 second cast already finished at t=0; what was wrong was the fight
   * that followed, where every Shadow Bolt took three seconds instead of 2.5.
   *
   * UNMEASURED, AND SAID SO. This profile is not one of the six the owner asked
   * to have optimised, so the five points went where the evidence pointed
   * rather than where a measurement would put them.
   * ==========================================================================
   */
  bane: 5,
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
};

/**
 * FIRELOCK -- 5 Affliction / 11 Demonology / 35 Destruction, respecified.
 *
 * ============================================================================
 * THREE POINTS OUT OF AFTERMATH AND INTO INTENSITY, and nothing else moves.
 * Both halves are worth reading, because they fail in opposite directions.
 *
 *   INTENSITY      "a 70% chance to resist interruption caused by damage while
 *                  casting or channeling any Destruction spell" -- which is
 *                  `castPushback`, a PERMANENT RULING rather than a gap. The
 *                  engine resolves a cast time once, before `onCast`, AND no
 *                  caster profile is attacked: blocked twice, which is this
 *                  project's own test for a ruling. So three points buy
 *                  exactly nothing here and will never buy anything.
 *   AFTERMATH 5->2 Immolate's initial damage falls from +50% to +20%.
 *
 * AND THE SECOND HALF IS WHY THIS COMMIT IS NOT JUST AN ALLOCATION EDIT.
 * `aftermath` declared `valueIndex: 2`, which is the MOVEMENT SPEED of its
 * daze clause -- constant at 50 across every rank. At 5/5 the correct figure
 * is also 50, so the wrong index was invisible; at 2/5 it would have paid 50
 * where the talent grants 20. **The owner's talent change is what turns a
 * dormant bug into a live one**, and `warlockEffects.ts` carries the table.
 *
 * All three tree totals sum from the icons: 5, 11 and 35 is 51.
 * ============================================================================
 */
/*
 * ============================================================================
 * ROUND 42 MOVED FIVE DEAD POINTS, AND THE BUILD IS 7/11/33 NOW.
 *
 *   DESTRUCTIVE REACH 2 -> IMPROVED LIFE TAP 2   range, which nothing here has,
 *                                                for +20% mana on every tap
 *   INTENSITY 3 -> AFTERMATH 5/5                 cast pushback, a permanent
 *                                                ruling, for +30% more on
 *                                                Immolate's opening hit
 *
 * Both were priced after Life Tap stopped costing health (round 41): the build
 * taps 33 times in five minutes now, so a fifth more mana a tap is worth a
 * global cooldown every few taps. Together, with a Bane of Agony opener:
 * +51.90 / +58.13 / +60.90 at 60 / 180 / 300s, paired, 400 iterations.
 *
 * AFTERMATH 2/5 WITH INTENSITY 3/3 WAS THE OWNER'S RESPECIFICATION, which the
 * comment above records; this reverses it on measurement. The owner's spread
 * is one edit away -- Intensity 3, Aftermath 2 -- if it was meant as a choice.
 * Destruction stays the majority at 33.
 * ============================================================================
 */
const WARLOCK_DESTRUCTION_TALENTS: TalentAllocation = {
  // Affliction, 7
  improved_life_tap: 2,
  suppression: 5,
  // Demonology, 11
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
  // Destruction, 33
  bane: 5,
  cataclysm: 3,
  aftermath: 5,
  ruin: 5,
  shadowburn: 1,
  agonizing_flames: 3,
  conflagrate: 1,
  bane_of_havoc: 1,
  fire_and_brimstone: 3,
  shadow_and_flame: 5,
  incinerate: 1,
};

/**
 * DEMONOLOGY -- 5 Affliction / 31 Demonology / 15 Destruction.
 *
 * ============================================================================
 * THE OWNER'S FOUR FIXED POINTS: at least 31 in Demonology, Suppression 5/5,
 * Ruin 5/5, the Succubus sacrificed and the Imp summoned with Master
 * Demonologist. Everything else here was chosen, and the tree has almost no
 * freedom once those are placed:
 *
 *   SUPPRESSION 5   all five Affliction points.
 *   RUIN 5          tier 10 of Destruction, so ten points under it: Bane 5/5
 *                   (which the owner's Decimation figure of a 2.4s Soul Fire
 *                   assumes) and Aftermath 5/5. Fifteen in all, which is why
 *                   Agonizing Flames (tier 15) is out of reach.
 *
 * AFTERMATH 5/5 OVER CATACLYSM 3/3 + AFTERMATH 2/5, round 41. Cataclysm's 10%
 * off every Destruction spell's mana won past a minute only while the build
 * ran out of mana; once Life Tap stopped costing health the trade inverted,
 * and Aftermath 5/5 is +38.6 / +33.5 / +31.7 at 60 / 180 / 300s.
 *   DEMONIC PACT    the 31st Demonology point and FORCED: without it,
 *                   summoning the Imp cancels the Succubus sacrifice. It needs
 *                   Soul Link, which needs Demonic Sacrifice.
 *
 * THE LIVE DEMONOLOGY TALENTS ARE 23 POINTS: Unholy Power 5, Improved Imp 3,
 * Fel Vitality 3 (+15% maximum mana), Demonic Sacrifice 1, Demonic Brand 3,
 * Decimation 2, Soul Link 1, Demonic Knowledge 3, Master Demonologist 5.
 * Pact's tier wants 30 points under it, so FOUR more go where they do nothing
 * -- Demonic Embrace 4/5, the stamina talent the Firelock also carries, and
 * three of the four have to sit at tier 10 or below to open Decimation's tier.
 * ============================================================================
 */
/*
 * ROUND 44, THE OWNER'S: "Fire Demo", and three Suppression points moved to
 * Agonizing Flames 3/3 -- +10% to every Destruction spell and +10% crit on
 * Searing Pain, the filler. Fifteen Destruction points under it open its tier
 * exactly. The three points of hit they cost are bought back in the gear: the
 * profile's benchmark row asks for 40 more hit rating, paid out of crit.
 * The build is 2/31/18.
 */
const WARLOCK_DEMONOLOGY_TALENTS: TalentAllocation = {
  // Affliction, 2
  suppression: 2,
  // Demonology, 31
  unholy_power: 5,
  improved_imp: 3,
  demonic_embrace: 4,
  fel_vitality: 3,
  demonic_sacrifice: 1,
  demonic_brand: 3,
  decimation: 2,
  soul_link: 1,
  demonic_knowledge: 3,
  master_demonologist: 5,
  demonic_pact: 1,
  // Destruction, 18
  bane: 5,
  aftermath: 5,
  ruin: 5,
  agonizing_flames: 3,
};

/**
 * THE SHADOW PRIEST BUILD. 13/3/35, exactly 51 points, and the twenty-first
 * profile in the project.
 *
 * ----------------------------------------------------------------------------
 * THIS COMMENT SAID "decoded from the owner's URL. 16/3/32" AND BOTH HALVES WERE
 * WRONG. The allocation below is 13/3/35, and the URL recorded for it in
 * `tools/decode_talent_build.mjs` decoded to a DIFFERENT build: `spirit_tap: 5`
 * and `mental_agility: 3` where this has `improved_mind_blast: 5`,
 * `silence: 1` and `early_demise: 2`. Eleven points apart, both totalling 51.
 *
 * THE OWNER VERIFIED THIS ONE -- "I verified that it's using the correct
 * talents" -- so the URL was the stale half and has been re-encoded from this
 * allocation. The 16/3/32 in the old comment was the URL's spread, which is how
 * the two drifted without either looking wrong on its own.
 *
 * IT WAS FOUND BY DECODING ALL TWENTY-THREE AT ONCE AND DIFFING THEM AGAINST
 * THESE CONSTANTS, which nothing had done before the 1.60.1.70170 patch forced
 * it. A preset that no longer matches its URL is invisible: both decode to 51
 * points and both produce an ordinary DPS figure. **A number with a source named
 * beside it is not the same as a number that still matches its source.**
 * ----------------------------------------------------------------------------
 */
const PRIEST_SHADOW_TALENTS: TalentAllocation = {
  /*
   * ==========================================================================
   * THE DISCIPLINE THIRTEEN WERE REBUILT, because IMPROVED POWER WORD: SHIELD
   * MOVED DOWN A ROW -- tier 5 to tier 10 at client build 1.60.1.70425 -- and
   * this tree spends only seven points above it. So the talent became illegal
   * and took Meditation, at the same tier, with it.
   *
   * MENTAL STRENGTH MOVED THE OTHER WAY in the same patch, tier 15 up to tier
   * 5, which is what makes the repair a straight swap rather than a choice: the
   * ten points row two now demands are exactly Twin Disciplines and Mental
   * Strength, and Mental Strength is +% Intellect where the two talents it
   * replaces are a SHIELD nothing attacks and a THREAT ruling.
   *
   * SO THE REFRESH HANDED THIS BUILD FIVE LIVE POINTS FOR FIVE DEAD ONES and
   * the only thing it had to be told was which rows they sit in now. Meditation
   * keeps its three -- `manaRegenBypass` is a real stat, and mana RETURN is
   * explicitly not out of scope.
   * ==========================================================================
   */
  twin_disciplines: 5,
  mental_strength: 5,
  meditation: 3,
  /*
   * ==========================================================================
   * INNER FOCUS TAKES ONE POINT OFF TWILIGHT FOCUS -- **14 / 2 / 35**, worth
   * **+6.13 +/- 0.50** at 60s over 1200 paired iterations and **+2.40 +/-
   * 0.26** at 300s over 400.
   *
   * BOTH FIGURES ARE THE COST OF REMOVING IT FROM THE SHIPPED BUILD, which is
   * the direction that needs no trust in a stale baseline. Measured the other
   * way round before it shipped it read +6.67 +/- 0.90 and +2.29 +/- 0.30, so
   * the two agree -- and the quoted pair is the tighter one.
   *
   * IT IS WORTH LESS IN A LONGER FIGHT AND THAT IS ARITHMETIC, NOT DECAY: a
   * 180-second cooldown fires once in a 60-second fight and twice in a
   * 300-second one, so its fixed contribution is spread over five times the
   * clock. `tools/probe_fight_length.ts` prints the cast count per length.
   *
   * **ONLY WITH ITS LIST ENTRY. THE TALENT ALONE IS WORTH EXACTLY NOTHING** --
   * `probe_build.ts` reports `IDENTICAL FIGHTS` for the spread without the
   * entry, because `grantAbility` puts Inner Focus in the book and no stock
   * list cast it. That is the Berserker Rage shape: both halves or neither, and
   * measured one at a time both halves read as worthless. See
   * `rotations/priest.ts` for the entry.
   *
   * WHY TWILIGHT FOCUS IS THE DONOR. Its three points buy a `castPushback`
   * effect, which the ruleset owner has ruled permanently out of scope -- so
   * they can never become live. The two alternatives measured **exactly the
   * same +6.67**: one point off `meditation`, or all three off Twilight Focus
   * with two parked in `mental_agility`. Every donor is worth nothing, which
   * is the result rather than a disappointment -- so the tie is broken on
   * which donor is SAFEST, and a permanent ruling beats a live talent whose
   * value is zero only because this build is global-cooldown bound.
   *
   * AND IT IS ONE POINT RATHER THAN THREE, so the owner's stated 13/3/35 moves
   * as little as it can. Discipline still spends exactly 10 below tier 10,
   * which is what Inner Focus's tier requires; Shadow is untouched at 35 and
   * stays the majority tree.
   *
   * IT IS THE ONLY LIVE DESTINATION IN THE WHOLE SPREAD. Every live Shadow
   * talent this build can reach is already maxed, and the six soft points are
   * rulings (`twilight_focus` 3, `shadow_reach` 2, `silence` 1) or worth
   * nothing (`dark_inspiration`'s Spirit weighs **0.0000** here, and
   * `meditation`'s regen is mana on a build that leaves 52.5% of its mana
   * unspent). `shadow_reach 2 -> dark_inspiration 5/5` measured IDENTICAL
   * FIGHTS.
   * ==========================================================================
   */
  twilight_focus: 2,
  inner_focus: 1,
  shadow_focus: 5,
  /*
   * DARK INSPIRATION TAKES SHADOW AFFINITY'S THREE POINTS, and it is a live
   * talent where that one was a `threat` ruling -- so this is the second trade
   * of dead points for working ones in the same spread.
   *
   * IT IS TWO ROWS LOWER, tier 15 against tier 5, which the tier arithmetic
   * absorbs: the Shadow tree spends 17 points above row three where it needs
   * 15. Shadow Affinity's removal is what dropped Early Demise, Darkness and
   * Shadowform in the first place, because three points vanishing from row one
   * took the tree under three later gates at once.
   */
  dark_inspiration: 3,
  improved_shadow_word_pain: 2,
  shadow_reach: 2,
  improved_mind_blast: 5,
  mind_flay: 1,
  improved_mind_flay: 2,
  vampiric_embrace: 1,
  shadow_weaving: 3,
  silence: 1,
  devouring_contagion: 2,
  early_demise: 2,
  darkness: 5,
  shadowform: 1,
};

/**
 * Every preset, with its stock priority list filled in.
 *
 * ----------------------------------------------------------------------------
 * WRAPPED RATHER THAN WRITTEN INTO ALL 25, which is the same argument the
 * preset raid buff list already makes: twenty-five copies of a thing that can
 * be derived is twenty-five chances for one of them to be the wrong list, and
 * `rotationIds.test.ts` had to exist because exactly that happened -- the
 * Shockadin profile spent its whole life running a list built around a talent
 * it does not take.
 *
 * `syncDefaultRotation` READS THE BUILT PROFILE, so it sees the class, style,
 * stance and talents each preset actually sets and dispatches the same way the
 * engine did before this field existed. A preset's figure therefore cannot
 * move: it stores the list it was already running.
 * ----------------------------------------------------------------------------
 */

/*
 * ============================================================================
 * THE GEAR IS APPLIED BEFORE THE ROTATIONS, AND THE ORDER IS NOW LOAD-BEARING.
 *
 * IT WAS `withBenchmarkGear(withStockRotations(...))` -- rotations first --
 * which was fine while a list depended only on class, style, stance and
 * talents. The Rogue's two Hemorrhage builds are told apart by the WEAPON IN
 * THE MAIN HAND, so `stockListFor` has to see the gear, and at the old order
 * the equipment was still empty: Pure Hemo silently got the dagger list.
 *
 * SILENTLY IS THE WHOLE PROBLEM. `PriorityRotation` skips an entry whose
 * ability the character does not know, so a sword-wielding build running the
 * dagger list simply loses its Ambush and its Vanish and produces an ordinary
 * figure -- which is the failure this project has shipped twice already.
 *
 * THE OTHER DIRECTION IS SAFE: nothing about which GEAR a preset gets depends
 * on its rotation, so gearing first cannot change what any of the other 26
 * wear. `presets.test.ts` round-trips every one of them.
 * ============================================================================
 */
export const PROFILE_PRESETS: readonly ProfilePreset[] = withStockRotations(withBenchmarkGear([
  {
    id: 'two_hand_arms',
    label: '2H Arms',
    detail: 'Orc, two-hander, Battle Stance, standing target',
    characterClass: 'warrior',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: '2H Arms',
        race: 'orc',
        characterClass: 'warrior',
        level: 60,
        combatStyle: 'two_hander',
        stance: 'battle',
      },
      talents: { ...TWO_HAND_ARMS_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * THE ARMOUR ENCHANTS ARE APPLIED HERE RATHER THAN ON `SHARED_ARMOUR`,
       * because the three Warrior builds share every item and share none of
       * their enchants: Arms and Fury take strength and Protection takes dodge
       * and defense skill. The set is the items; the loadout is the build.
       */
      /*
       * STRENGTH FOOD RATHER THAN ATTACK POWER, AND ON THIS PRESET ALONE.
       *
       * ----------------------------------------------------------------------
       * THE OWNER'S RULING: "2H Arms warrior Food Consumable needs to be
       * changed from attack power to strength." It is +20 Strength against
       * +40 Attack Power, which for a plate build is the SAME 40 attack power
       * before anything scales it and more after -- strength goes through the
       * conversion, so every percentage multiplier on the primary reaches it
       * and none of them reaches a flat pool.
       *
       * AN OVERRIDE ON THE PRESET, NOT AN EDIT TO `MELEE_COMMON`. The ruling
       * names one profile, and a ruling covers what it says and is not
       * extended by analogy -- `STRENGTH_CONSUMABLES` is shared with DW Fury,
       * Prot Warr and both feral Druids, and `MELEE_COMMON` beneath it with
       * four Rogues and a Hunter besides. Changing the row would move eleven
       * published figures on one sentence about one of them.
       *
       * IT IS THEREFORE THE FIRST THING IN THIS FILE TO DISAGREE WITH ITS OWN
       * ARCHETYPE ROW, which is worth saying because the row's whole argument
       * is that twenty-five separate opinions is not something a reader can
       * check. The exception is the owner's, stated here, and if they want it
       * for the archetype the edit is one line up in `consumables.ts`.
       * ----------------------------------------------------------------------
       */
      consumables: { ...STRENGTH_CONSUMABLES, food: 'food_strength' },
      /*
       * THE OWNER'S OPENER, and the three entries it replaces are gone from the
       * list: Charge, Battle Stance and Battle Shout. See `WARRIOR_TWO_HAND_BATTLE`.
       *
       * THE STANCE ENTRY IS A RE-CAST OF THE STANCE IT IS ALREADY IN -- the
       * preset declares `stance: 'battle'` and `openingAuras` applies it before
       * any pre-combat action runs. A stance ability has no `canCast` gate, so
       * the cast succeeds and the `already` guard inside it means NO RAGE IS
       * LOST; what it buys is that the panel says out loud which stance this
       * character pulls in, where before it was a field three screens away.
       *
       * AND IT IS WHY BLOODRAGE IS SAFE AT 10s. A stance CHANGE dumps rage
       * above the floor, so an opener that banked rage and then genuinely
       * swapped would throw it away -- this one does not swap.
       */
      precombat: [
        ...before(10, 'bloodrage_cast', 'battle_shout_cast'),
        ...before(3, 'battle_stance_cast'),
        ...before(0, 'charge', 'mighty_rage_potion'),
      ],
      encounter: {
        ...createDefaultProfile().encounter,
        // A damage warrior is not the one being hit.
        targetAttacks: false,
      },
    }),
  },
  {
    id: 'dw_fury',
    label: 'DW Fury',
    detail: 'Orc, dual-wield, Berserker Stance, standing target',
    characterClass: 'warrior',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'DW Fury',
        race: 'orc',
        characterClass: 'warrior',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'berserker',
      },
      talents: { ...DW_FURY_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * STRENGTH FOOD, THE SECOND PROFILE TO TAKE IT, AND STILL AN OVERRIDE.
       *
       * ----------------------------------------------------------------------
       * THE OWNER NAMED 2H ARMS FIRST AND DW FURY SECOND, one profile at a
       * time, so this is a second RULING rather than the first one extended by
       * analogy -- which is the difference that kept the archetype row intact
       * when only one of them had been named.
       *
       * AND THE ROW STILL SHOULD NOT MOVE, because it would now take three
       * profiles with it that the owner has NOT named: Prot Warr and both
       * feral Druids. `MELEE_COMMON` beneath it would take four Rogues and a
       * melee Hunter as well. **Two of five is not a row** -- if the owner
       * names the Druids too, the honest edit is `STRENGTH_CONSUMABLES` and
       * these two overrides come out together.
       * ----------------------------------------------------------------------
       */
      consumables: { ...STRENGTH_CONSUMABLES, food: 'food_strength' },
      /*
       * NO CHARGE HERE AND THE OWNER DID NOT ASK FOR ONE, which is the spec
       * agreeing with the engine: Charge lists Battle Stance only on this
       * build -- Vanguard is what adds Defensive, and a Fury warrior takes
       * neither -- so a Berserker opener cannot Charge at all. Its list has
       * never carried the entry either.
       */
      precombat: [
        ...before(10, 'bloodrage_cast', 'battle_shout_cast'),
        ...before(3, 'berserker_stance_cast'),
      ],
      encounter: {
        ...createDefaultProfile().encounter,
        // A damage warrior is not the one being hit.
        targetAttacks: false,
      },
    }),
  },
  {
    id: 'prot_warr',
    label: 'Prot Warr',
    detail: 'Tauren, shield, Defensive Stance, target swings back',
    characterClass: 'warrior',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Prot Warr',
        race: 'tauren',
        characterClass: 'warrior',
        level: 60,
        combatStyle: 'one_hand_shield',
        stance: 'defensive',
      },
      talents: { ...PROT_WARR_TALENTS },
      raidBuffs: [...TANK_RAID_BUFFS],
      /*
       * STAMINA FOOD, AND IT IS THE THIRD FOOD RULING AND THE FIRST TO GIVE A
       * DIFFERENT ANSWER.
       *
       * ----------------------------------------------------------------------
       * 2H ARMS AND DW FURY TOOK +20 STRENGTH; A TANK TAKES +20 STAMINA. So the
       * five members of `STRENGTH_CONSUMABLES` now hold THREE different answers
       * between them, which settles the question these overrides kept raising:
       * **the row cannot be edited to satisfy them**, because a shared row has
       * one value and the owner has given three.
       *
       * THAT IS A STRONGER REASON THAN "a ruling covers what it says", which is
       * what the first two overrides rested on. It was a rule about caution;
       * this is a fact about the shape.
       *
       * AND IT IS THE ONE FOOD CHANGE THAT IS NOT A DPS DECISION. Stamina buys
       * health, health is what a tank's figure of merit is counted in, and
       * Forever's rage formula is `D x 10 / H` -- so a bigger pool also makes
       * every point of damage taken worth LESS rage. Read this change on
       * DEATHS, not on the DPS row, and expect the DPS to fall slightly.
       * ----------------------------------------------------------------------
       */
      consumables: { ...STRENGTH_CONSUMABLES, food: 'food_stamina' },
      /*
       * THE ONE OPENER THAT CHARGES OUT OF DEFENSIVE STANCE, and it works for
       * a reason that is in the data rather than in this list: VANGUARD adds
       * Defensive to this character's own copy of Charge, so the book reads
       * `stances battle_stance/defensive_stance` where every other warrior's
       * reads Battle only. A Protection warrior without that talent would have
       * this entry refused and skipped in silence.
       *
       * AND HEROIC STRIKE IS QUEUED RATHER THAN CAST. An on-next-swing ability
       * is ARMED by `castAbility` -- paid for now, delivered by the first swing
       * that lands -- so "queue Heroic Strike" is exactly what the engine does
       * with it, and it costs the rage Bloodrage just banked.
       */
      precombat: [
        ...before(10, 'bloodrage_cast', 'battle_shout_cast'),
        ...before(3, 'defensive_stance_cast'),
        ...before(0, 'charge', 'mighty_rage_potion', 'heroic_strike'),
      ],
      encounter: {
        ...createDefaultProfile().encounter,
        /*
         * ON, and it has to be. Half of what a Protection warrior does is
         * waiting on something swinging back: the attacks-received table,
         * rage from damage taken, Revenge, Shield Block, Last Stand, Shield
         * Wall and Blood Craze. A tank preset with this off would produce a
         * confident number about a character doing none of it.
         */
        targetAttacks: true,
      },
    }),
  },
  {
    id: 'fury_prot',
    label: 'Fury Prot',
    detail: 'Tauren, shield, Defensive Stance, Bloodthirst, target swings back',
    characterClass: 'warrior',
    /*
     * PROT WARR WITH A FURY TREE, by the owner's word -- "in almost every other
     * case this profile will copy Prot Warr". So it DERIVES from that preset
     * and states only what differs: the name, the tree and the opener. Race,
     * gear, enchants, raid buffs, consumables and the encounter all come from
     * the Prot Warr build, which is the arrangement Pure Hemo uses with Hemo
     * Dagger -- a change to Prot Warr's consumables reaches this one too.
     */
    build: () => {
      const prot = PRESETS_BY_ID.get('prot_warr')!.build();
      return {
        ...prot,
        character: { ...prot.character, name: 'Fury Prot' },
        talents: { ...FURY_PROT_TALENTS },
        /*
         * THE OWNER'S OPENER: "T-10 Bloodrage, T-10 Battle Shout, T-3 Defensive
         * Stance, T-1.5 Death Wish, T-0 Mighty Rage Potion + Heroic Strike
         * Queue + Bloodthirst."
         *
         * NO CHARGE, where Prot Warr's opener has one: Charge reaches Defensive
         * Stance only through Vanguard, and this tree does not take it.
         *
         * BLOODTHIRST IS THE PULL -- the one damaging cast an opener may finish,
         * at exactly 0s. Death Wish deals nothing, and Heroic Strike is armed
         * rather than cast, so its blow lands on the first swing after the pull.
         */
        precombat: [
          ...before(10, 'bloodrage_cast', 'battle_shout_cast'),
          ...before(3, 'defensive_stance_cast'),
          ...before(1.5, 'death_wish'),
          ...before(0, 'mighty_rage_potion', 'heroic_strike', 'bloodthirst'),
        ],
      };
    },
  },
  {
    id: 'rogue_venom',
    label: 'Venom',
    detail: 'Undead, dual-wield, standing target. 37 Assassination / 12 Combat',
    characterClass: 'rogue',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Venom',
        race: 'undead',
        characterClass: 'rogue',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...ROGUE_VENOM_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * AGILITY FOOD, THE FOURTH FOOD RULING AND THE THIRD ANSWER.
       *
       * ----------------------------------------------------------------------
       * +20 Agility against +40 Attack Power, and for a Rogue that trade is NOT
       * the Warrior's. Agility is 1 attack power a point here, so the owner is
       * giving up HALF the attack power -- and buying crit with it, which
       * attack power does not touch. It is also a primary, so it goes through
       * the conversion and a percentage modifier reaches it.
       *
       * SO THE THREE ANSWERS ARE NOW STRENGTH, STAMINA AND AGILITY across two
       * shared rows, which is the argument these are overrides stated a third
       * time: `AGILITY_CONSUMABLES` is shared with the other three Rogues and
       * the melee Hunter, and `MELEE_COMMON` beneath it with the Warriors and
       * both feral Druids. A shared row holds one value.
       *
       * THIS PRESET ALREADY OVERRODE THE ROW for `other`, so the food is one
       * more key rather than a new shape -- the Rogue row carries no `other` at
       * all, because Thistle Tea is "(Rogue, Druid)" and the row is shared with
       * a Hunter that may not drink it.
       * ----------------------------------------------------------------------
       */
      consumables: { ...AGILITY_CONSUMABLES, other: 'thistle_tea', food: 'food_agility' },
      /*
       * "Venom: none" -- the owner's own word, and the only profile of the 28
       * with no opener. Left ABSENT rather than written as an empty array: the
       * field is optional, `absent` is what every saved profile before format
       * 16 carries, and `roundTrip.test.ts` compares the whole structure.
       */
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    /*
     * ==========================================================================
     * COMBAT MUT, AND IT IS THE VENOM PRESET WITH TWO FIELDS REPLACED.
     *
     * The owner's own framing: "this profile copies everything from Venom
     * except the APL and Talents which I'll provide." So it SPREADS the Venom
     * build rather than restating it -- same race, same gear, same enchants,
     * same consumables, same encounter -- and the two things that differ are
     * the two things named.
     *
     * A SPREAD RATHER THAN A COPY, which is the rule this file already follows
     * for `ROGUE_HEMO` deriving from `ROGUE_RUPTURE`: a hand-written copy of
     * eight fields drifts from its original silently, and the copy is the one
     * nobody re-reads. `presets.test.ts` asserts every preset sets every field,
     * and a spread satisfies that by construction.
     *
     * THE APL IS NOT A FIELD HERE: `withStockRotations` fills each preset's
     * rotation from `aplFor`, which dispatches on the TALENTS. So replacing the
     * allocation is what gives this profile its own list, and `rogueRotation`
     * reads the Venom capstone to tell the two Mutilate builds apart.
     * ==========================================================================
     */
    id: 'rogue_combat_mut',
    label: 'Combat Mut',
    detail: 'Undead, dual-wield, standing target. 30 Assassination / 21 Combat',
    characterClass: 'rogue',
    build: () => {
      const venom = PRESETS_BY_ID.get('rogue_venom')!.build();
      return {
        ...venom,
        character: { ...venom.character, name: 'Combat Mut' },
        talents: { ...ROGUE_COMBAT_MUT_TALENTS },
        precombat: [
          ...before(1, 'blade_flurry'),
        ],
      };
    },
  },
  {
    id: 'rogue_combat',
    label: 'Combat',
    detail: 'Orc, dual-wield, standing target. 18 Assassination / 33 Combat',
    characterClass: 'rogue',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Combat',
        race: 'orc',
        characterClass: 'rogue',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...ROGUE_COMBAT_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * AGILITY FOOD, THE SECOND ROGUE TO TAKE IT AND THE FIFTH FOOD RULING.
       *
       * Two of the five members of `AGILITY_CONSUMABLES` are named now, which
       * is the same arithmetic the plate-and-fur row is at: a shared row holds
       * ONE value, and until the Rupture and Hemo Rogues and the melee Hunter
       * are named too, overriding is the only reading that does not move a
       * published figure on somebody else's behalf.
       */
      consumables: {
        ...AGILITY_CONSUMABLES,
        other: 'thistle_tea',
        food: 'food_agility',
        // +8 weapon damage on the main hand, by the owner.
        weapon_effect_main_hand: 'dense_sharpening_stone_main_hand',
      },
      precombat: [
        ...before(1, 'blade_flurry'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'rogue_rupture',
    label: 'Rupture',
    detail: 'Undead, dual-wield, standing target. 31 Subtlety',
    characterClass: 'rogue',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Rupture',
        race: 'undead',
        characterClass: 'rogue',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...ROGUE_RUPTURE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * AGILITY FOOD, THE THIRD ROGUE AND THE SIXTH FOOD RULING. Three of the
       * five members of `AGILITY_CONSUMABLES` are named now; the Hemo Rogue
       * and the melee Hunter are what is left.
       */
      consumables: {
        ...AGILITY_CONSUMABLES,
        other: 'thistle_tea',
        food: 'food_agility',
        // +8 weapon damage on the main hand, by the owner.
        weapon_effect_main_hand: 'dense_sharpening_stone_main_hand',
      },
      /*
       * STEALTH IS A STATE RATHER THAN A CAST, AND IS LISTED ANYWAY. A Rogue's
       * `openingAuras` carry the `stealth` aura -- the one thing about stealth
       * this project models -- and `openingAuras` are applied BEFORE
       * `onPrecombat`, so it is already true when the opener runs. The owner
       * asked for the line to stay so the sequence reads completely; see
       * `PRECOMBAT_STATES`.
       *
       * SO AMBUSH'S OWN GATE IS ALREADY SATISFIED -- a dagger main hand AND
       * Cutthroat or Stealth -- and the pre-combat Ambush SPENDS that window
       * exactly as the list's first entry used to.
       */
      precombat: [
        ...before(2, 'stealth'),
        // Premeditation is off the opener and the Major Frenzy Potion is on it
        // at 0s, so it is drunk with the first Ambush -- the owner's round 37.
        // AMBUSH FIRST, THEN THE POTION, in the same instant: a potion is a
        // completed action and the owner's stealth rule ("almost every completed
        // cast or attack breaks stealth ... the only thing that doesn't is a
        // rogue's premeditation") would end Stealth before the Ambush. So the first
        // Ambush does not carry the potion's attack power -- a question for the owner.
        ...before(0, 'ambush', 'major_frenzy_potion'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    /*
     * THE ID STAYS `rogue_hemo` WHILE THE LABEL BECOMES "Hemo Dagger".
     *
     * A preset id is a STABLE KEY: saved profiles carry it, and the benchmark
     * gear templates, the enchant loadouts, the baseline table and six test
     * files are all keyed by it. Renaming it would silently unenchant and
     * un-gear this profile and drop it out of the table's set assertion --
     * which is the one thing that would NOT show up as an error.
     *
     * The label and the character name are what a person reads, and those are
     * what the owner asked to change.
     */
    id: 'rogue_hemo',
    label: 'Hemo Dagger',
    detail: 'Undead, dual-wield, standing target. 31 Subtlety, no Backstab',
    characterClass: 'rogue',
    /*
     * EVERY FIELD IS THE RUPTURE PRESET'S EXCEPT THE TALENTS, which is the
     * owner's specification -- same race, same style, same gear, same raid
     * buffs, same standing target. SET OUT IN FULL RATHER THAN SPREAD FROM
     * `rogue_rupture`: a preset that inherits behaves differently depending on
     * what it inherited from, and all five build settings have to agree.
     */
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Hemo Dagger',
        race: 'undead',
        characterClass: 'rogue',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...ROGUE_HEMO_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: {
        ...AGILITY_CONSUMABLES,
        other: 'thistle_tea',
        // +8 weapon damage on the main hand, by the owner.
        weapon_effect_main_hand: 'dense_sharpening_stone_main_hand',
      },
      precombat: [
        ...before(2, 'stealth'),
        // Premeditation is off the opener and the Major Frenzy Potion is on it
        // at 0s, so it is drunk with the first Ambush -- the owner's round 37.
        // AMBUSH FIRST, THEN THE POTION, in the same instant: a potion is a
        // completed action and the owner's stealth rule ("almost every completed
        // cast or attack breaks stealth ... the only thing that doesn't is a
        // rogue's premeditation") would end Stealth before the Ambush. So the first
        // Ambush does not carry the potion's attack power -- a question for the owner.
        ...before(0, 'ambush', 'major_frenzy_potion'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    /*
     * ==========================================================================
     * PURE HEMO, AND IT IS THE HEMO DAGGER PRESET WITH TWO FIELDS REPLACED.
     *
     * The owner's framing: "the same as Hemo Dagger - except it's gonna use the
     * Main Hand weapon from the Combat templates. And it has a different talent
     * spread, and APL." So it SPREADS that build and changes the name and the
     * allocation, the arrangement Combat Mut already uses.
     *
     * THE WEAPON IS NOT A FIELD HERE AND THE APL IS NOT EITHER, which is the
     * thing worth knowing about this preset: `withBenchmarkGear` gears it from
     * its OWN template -- keyed by preset id, and that template carries the
     * sword main hand -- and `withStockRotations` fills its rotation from
     * `aplFor`, which now reads that weapon to choose the list. So replacing
     * the id-keyed template is what gives this profile both its gear AND its
     * rotation, and the two cannot disagree.
     * ==========================================================================
     */
    id: 'rogue_pure_hemo',
    label: 'Pure Hemo',
    detail: 'Undead, sword and dagger, standing target. 21 Assassination / 22 Subtlety',
    characterClass: 'rogue',
    build: () => {
      const hemo = PRESETS_BY_ID.get('rogue_hemo')!.build();
      return {
        ...hemo,
        character: { ...hemo.character, name: 'Pure Hemo' },
        talents: { ...ROGUE_PURE_HEMO_TALENTS },
        /*
         * NO AMBUSH, WHICH IS THE OWNER'S SPEC AGREEING WITH AMBUSH'S OWN GATE.
         * Every other Rogue opener ends on it; this build holds a SWORD in its
         * main hand and `canCast` asks for a dagger, so an Ambush entry here
         * would be refused and skipped in silence. It has to be written out
         * because this preset DERIVES from Hemo Dagger, whose opener does ambush
         * -- inheriting the spread would have carried it.
         */
        precombat: [
          ...before(2, 'stealth'),
          // Premeditation off; the potion and a GARROTE at 0s, the owner's
          // opener for this build now Garrote is declared.
            // AMBUSH FIRST, THEN THE POTION, in the same instant: a potion is a
          // completed action and the owner's stealth rule ("almost every completed
          // cast or attack breaks stealth ... the only thing that doesn't is a
          // rogue's premeditation") would end Stealth before the Garrote. So the first
          // Garrote does not carry the potion's attack power -- a question for the owner.
          ...before(0, 'garrote', 'major_frenzy_potion'),
        ],
      };
    },
  },
  {
    id: 'druid_moonkin',
    label: 'Moonkin',
    detail: 'Tauren, Moonkin Form, standing target. 38 Balance / 13 Restoration',
    characterClass: 'druid',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Moonkin',
        race: 'tauren',
        characterClass: 'druid',
        level: 60,
        combatStyle: 'moonkin',
        stance: 'battle',
      },
      talents: { ...DRUID_MOONKIN_TALENTS },
      /*
       * ON `PRESET_RAID_BUFFS` LIKE EVERYBODY ELSE, WHICH IT WAS NOT FOR MOST
       * OF ITS LIFE. It took Moonkin Aura in Leader of the Pack's place, on the
       * ruling that the two were one exclusive 3% and the raid could only have
       * the druid it had -- and the owner has since ruled them not exclusive
       * with both selected by default everywhere. **Its own crit does not move
       * either way**: the Moonkin Form talent grants the same aura id the raid
       * entry does, so the two cannot add up. What it GAINS is Leader of the
       * Pack's MELEE AND RANGED 3%, which is worth whatever this build's
       * physical share is and nothing more -- see HANDOVER for the figure.
       */
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_arcane'),
      /*
       * MOONKIN FORM IS A STATE RATHER THAN A CAST, AND IS LISTED ANYWAY -- on
       * the owner's instruction, and it is the example they used: "Even if lines
       * were already true, like Moonkin Form, just leave it in the pre-combat so
       * users know that." It is a COMBAT STYLE on this profile, so the character
       * is in it before a pre-combat action could be taken. See
       * `PRECOMBAT_STATES`.
       */
      precombat: [
        ...before(3, 'moonkin_form'),
        ...before(1.5, 'wrath'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'druid_cat',
    label: 'Cat',
    detail: 'Tauren, Cat Form, standing target. 35 Feral Combat',
    characterClass: 'druid',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Cat',
        race: 'tauren',
        characterClass: 'druid',
        level: 60,
        combatStyle: 'cat',
        stance: 'battle',
      },
      talents: { ...DRUID_CAT_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * ======================================================================
       * STRENGTH FOOD AND THE FRENZY POTION, BOTH THE OWNER'S -- and with them
       * FOUR of the five members of `STRENGTH_CONSUMABLES` are named, holding
       * THREE different food answers between them.
       *
       * 2H Arms and DW Fury eat strength, Prot Warr eats stamina, and this one
       * eats strength. Only the Bear is unnamed on food -- and it is named in
       * this same round, for stamina -- so after it the row supplies NOTHING to
       * anybody and every member overrides it.
       *
       * THAT IS WORTH SAYING RATHER THAN COLLAPSING. The honest edit at that
       * point is to delete the `food` key from the row and let each preset
       * state its own, and it is a question for the owner rather than a tidy-up
       * to do unasked: the row still carries nine other categories that all
       * five agree on, and a row that is right about nine of ten is not a row
       * to delete.
       *
       * AND THE POTION IS THE ROW'S OWN MIGHTY RAGE AGAIN, WHICH REVERSES A
       * SWAP THIS FILE ARGUED FOR AND NEVER MEASURED.
       *
       * ----------------------------------------------------------------------
       * THE ARGUMENT THAT MADE THE SWAP: "Mighty Rage is 60 strength and 45-75
       * RAGE, and a Cat gains no rage at all -- measured at zero over twenty
       * fights -- so half of it was always wasted here. The Frenzy Potion is 40
       * attack power with nothing wasted."
       *
       * BOTH FACTS ARE TRUE AND THE CONCLUSION DOES NOT FOLLOW. The half that is
       * wasted is the rage; the half that is NOT is 60 strength, and a Druid is
       * two attack power a point -- **120 against the Frenzy Potion's 40**. Over
       * the two durations that is 2,400 attack-power-seconds against 1,200.
       * Measured at 3,000 paired iterations: **+8.4**.
       *
       * AND HOLDING IT FOR BERSERK IS WORSE THAN DRINKING IT AT THE PULL, which
       * is the other half of the old entry and was also worth checking: the hold
       * measures **-4.9** against the pull, because twenty seconds of potion
       * spent waiting for a cooldown is twenty seconds not spent. The list's
       * generic Mighty Rage entry is gated on RAGE, which a Cat reads as zero,
       * so it fires at the pull by itself and the Cat's own exclusion is gone.
       *
       * FEROCIOUS BITE WAS THE OTHER CANDIDATE AND DOES NOT SURVIVE THIS ONE.
       * See `DRUID_CAT` in `rotations/druid.ts`.
       * ----------------------------------------------------------------------
       * ======================================================================
       */
      consumables: {
        ...STRENGTH_CONSUMABLES,
        other: 'thistle_tea',
        food: 'food_strength',
        // Major Frenzy Potion where Mighty Rage was, by the owner.
        potion: 'major_frenzy_potion',
        // +8 weapon damage on the main hand, by the owner.
        weapon_effect_main_hand: 'dense_sharpening_stone_main_hand',
      },
      /*
       * ======================================================================
       * THE STEALTH OPENER, AND IT IS THE ONE THE OWNER HAD TO RESTATE.
       *
       * "Cat Druid -- the precombat should be 2s before cat form, 1s before
       * prowl, 0s Ravage", with Ravage supplied outright: "60 energy, Instant
       * cast ... 350% damage plus 343 ... Must be prowling and behind the
       * target. Awards 1 combo points."
       *
       * IT WAS EMPTY, ON TWO READINGS THAT WERE BOTH WRONG. Cat Form was left
       * out as "already true" -- the owner wants the line shown -- and Ravage
       * was refused as unimplementable, because "must be prowling AND behind
       * the target" looked like `stealth` and `positioning` together. The
       * ruling: **"You do NOT need to scope in behind the target positioning.
       * Once again this should be assumed in all cases EXCEPT when 'Target
       * attacks back' is checked."** This profile sets `targetAttacks: false`.
       *
       * PROWL IS A REAL CAST HERE, unlike the form above it: it is declared,
       * costs nothing, has a ten second cooldown, and leaves the aura Ravage
       * reads. See `PROWL` and `RAVAGE` in the Druid files for the one clause
       * neither source states -- whether Ravage SPENDS the window -- which
       * follows Ambush.
       * ======================================================================
       */
      precombat: [
        ...before(2, 'cat_form'),
        ...before(1, 'prowl'),
        ...before(0, 'ravage'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'druid_bear',
    label: 'Bear',
    detail: 'Tauren, Bear Form, target swings back. 42 Feral Combat',
    characterClass: 'druid',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Bear',
        race: 'tauren',
        characterClass: 'druid',
        level: 60,
        combatStyle: 'bear',
        stance: 'battle',
      },
      talents: { ...DRUID_BEAR_TALENTS },
      raidBuffs: [...TANK_RAID_BUFFS],
      /*
       * STAMINA FOOD, THE OWNER'S, AND THE FIFTH AND LAST MEMBER OF THE ROW TO
       * BE NAMED. The three answers across the five are strength, stamina and
       * strength again -- see `druid_cat` for why the row is not collapsed.
       *
       * IT IS THE SECOND TANK TO TAKE IT and for the same reason: stamina buys
       * health, health is what a death count is counted in, and Forever's
       * `D x 10 / H` then makes each point of damage taken worth LESS rage. Read
       * this one on DEATHS, not on the DPS row, and expect the DPS to fall.
       */
      consumables: { ...STRENGTH_CONSUMABLES, food: 'food_stamina' },
      /*
       * THE ONE DRUID PROFILE THAT IS HIT BACK, which is the whole point of
       * Bear Form: rage is earned by taking damage as well as dealing it, and
       * Natural Reaction, Primal Fury and Demoralizing Roar are all inert
       * against a target that never swings.
       */
      /*
       * EVERYTHING AT THE PULL, AND THE ORDER INSIDE THE 0s BLOCK IS THE
       * READING. Enrage first, then the potion, then the queued Maul, then
       * Primal Bite: a queued swing delivered after the pull collects both
       * buffs, where arming it first would be the same four actions in an order
       * that reads the same and pays less. `runPrecombat` sorts stably, so the
       * order written here is the order taken.
       *
       * DIRE BEAR FORM IS A STATE RATHER THAN A CAST and is listed anyway, on
       * the owner's instruction -- see `PRECOMBAT_STATES`. The profile is in the
       * Bear combat style, so it is already true when the opener runs.
       */
      precombat: [
        ...before(1.5, 'bear_form'),
        ...before(0, 'enrage', 'mighty_rage_potion', 'maul', 'mangle'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: true },
    }),
  },
  {
    id: 'shaman_elemental',
    label: 'Ele Shaman',
    /*
     * 32/10/9, WHICH THIS LINE SAID WAS 38/13 FOR SEVERAL REFRESHES. Step 0 of
     * `docs/profile-optimisation.md` reads `preset.detail` for the theme's
     * invariants, so a stale split here is the one place it misleads -- and the
     * figure it gave was not even a legal reading of this tree. Derive it from
     * `encode_talent_build.mjs --all` rather than editing this sentence.
     */
    detail: 'Troll, caster, standing target. 32 Elemental / 10 Enhancement / 9 Restoration',
    characterClass: 'shaman',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Ele Shaman',
        race: 'troll',
        characterClass: 'shaman',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
      },
      talents: { ...SHAMAN_ELEMENTAL_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_nature'),
      /*
       * THE ONE OPENER WHOSE CAST IS NOT LAST. Lightning Bolt occupies the two
       * seconds before the pull and LANDS at it; Flame Shock is then taken at
       * the pull itself. Both resolve at t=0 and the order here is the order
       * the owner wrote them in.
       *
       * ----------------------------------------------------------------------
       * TWO ACTIONS ADDED, WORTH **+27.5 +/- 5.0** TOGETHER, and both for the
       * same reason: a pre-combat action costs NO GLOBAL COOLDOWN, and this
       * build's global cooldowns are the thing it is short of -- the Convection
       * probe proved it is cast-bound rather than mana-bound.
       *
       *   ELEMENTAL MASTERY  **+13.9** on its own. A three minute cooldown
       *                      opening a fifteen second window, claimed at a 0s
       *                      lead for free. The lead is REAL, so 0s is what
       *                      gives the full fifteen seconds from the pull --
       *                      a longer lead would spend the window before the
       *                      fight and buy back a cooldown that cannot return
       *                      inside a hundred seconds. It keeps its list entry
       *                      as a safety net, which therefore reads 0.00 uses.
       *   SEARING TOTEM      **+11.0** on its own, and it is the ENHANCEMENT
       *                      opener's own line applied here. That profile has
       *                      pre-cast the totem at 1.5s all along and this one
       *                      spent two global cooldowns on a 55 second totem in
       *                      the fight; why the two differed was recorded
       *                      nowhere, and the answer is that it should not.
       *
       * AND THE PAIR IS LESS THAN THE SUM -- 13.9 + 11.0 = 24.9 against a
       * measured 27.5, which is slightly MORE, so they do not compete. Said
       * either way because marginal values normally overlap when both buy the
       * same scarce thing, and here the extra Lightning Bolts the window pays
       * for are what the totem's freed cooldown spends.
       * ----------------------------------------------------------------------
       */
      precombat: [
        // Lightning Bolt is off the opener, by the owner -- which also clears
        // this profile's Gate B failure: Flame Shock at 0s is the one cast.
        ...before(1.5, 'searing_totem'),
        ...before(0, 'elemental_mastery'),
        ...before(0, 'flame_shock'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'shaman_enhancement',
    label: 'Enh Shaman',
    /*
     * THIS LINE WAS WRONG FOR SEVERAL ROUNDS AND IS RIGHT AGAIN BY ACCIDENT,
     * which is worth a sentence rather than a silent edit.
     *
     * It read 19/32 while the tree was **17/34**: the client swap that moved
     * Elemental Fury to tier 25 cost this build five Elemental points, the owner
     * chose where they went, and the split moved with them while the description
     * did not. The Reverberation round has now taken the tree to 19/32, so the
     * stale sentence became true -- and a reader who checks it against the
     * allocation today learns nothing about how long it was wrong.
     *
     * SO DERIVE THE THEME, DO NOT RECALL IT. `encode_talent_build.mjs --all`
     * prints the split and a URL the owner can audit, which is Step 0 of
     * `docs/profile-optimisation.md` and is the only reading that cannot drift.
     */
    detail: 'Tauren, two-hander, standing target. 19 Elemental / 32 Enhancement',
    characterClass: 'shaman',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Enh Shaman',
        race: 'tauren',
        characterClass: 'shaman',
        level: 60,
        combatStyle: 'two_hander',
        stance: 'battle',
      },
      talents: { ...SHAMAN_ENHANCEMENT_TALENTS },
      /*
       * WINDFURY TOTEM IS SELECTED NOW LIKE EVERYTHING ELSE, and the engine is
       * what stops it paying twice. The imbue this build casts says so itself:
       * "when applied to main hand, disables any benefit you personally receive
       * from Windfury Totem" -- so `windfuryTotemReaction` refuses while the
       * imbue is up, and the box can be ticked honestly.
       */
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * ========================================================================
       * TWO ROWS OVERRIDE THE SHARED HYBRID SELECTION, which is the arrangement
       * the three Paladins already use -- `hybridConsumables` hands all four of
       * its callers `flask_hit_points` and `food_attack_power`, and a preset that
       * wants otherwise says so here rather than moving the shared row under
       * three profiles nobody measured.
       *
       * THE FLASK IS +33.45 +/- 0.24 PAIRED OVER 400 ITERATIONS, which is the
       * largest single thing found on this profile and was never asked before:
       * +1200 Hit Points reaches NOTHING here (`targetAttacks` is false, so
       * health never leaves maximum, and a Shaman has no `D x 10 / H` rage rule
       * for a bigger pool to feed) and +150 Spell Power reaches 26.4% of the
       * damage table. The stat weight predicted 150 x 0.2227 = 33.4.
       *
       * AND SPELL POWER BEATS ATTACK POWER PER POINT ON A 73.5% PHYSICAL BUILD,
       * which reads like a contradiction and is not: attack power sits at 1,965
       * and spell power at 124, so a point of the second is a far larger share
       * of the smaller thing it reaches. It is also why the potion row does not
       * divide -- Spellblasting's +40 Spell Power beats Frenzy's +40 Attack
       * Power by 0.85, measured.
       *
       * THE FOOD IS +0.72 +/- 0.01, the same arithmetic that moved 2H Arms, DW
       * Fury, Venom and the Cat: +20 Strength is 7.91 against +40 Attack Power's
       * 7.19, because a Shaman makes 2 attack power from a point of strength.
       * ========================================================================
       */
      consumables: {
        ...hybridConsumables({
          school: 'school_fire',
          meleeWeaponEffect: true,
          blastedLands: 'blasted_strength',
        }),
        flask: 'flask_spell_power',
        food: 'food_strength',
        // +1% spell crit and +36 spell power on the main hand, by the owner
        // (round 37) -- the caster half of the row, where it was melee crit.
        weapon_effect_main_hand: 'weapon_spell_crit_main_hand',
      },
      /*
       * ========================================================================
       * THE OWNER'S THREE LINES, PLUS ONE ADDITION WORTH **+12.71 +/- 3.00**
       * paired over 5000 iterations -- declared separately in
       * `tests/profiles/precombatOpeners.test.ts` so a reader can tell whose
       * decision each line is.
       *
       * RAGE OF THE FARSEER PASSES GATE B TRIVIALLY: its `onCast` applies an
       * aura and calls `dealDamage` never, so it is not a damaging action and the
       * at-most-one rule does not reach it. A 0s lead on an instant is the
       * safest edit available -- it cannot fail B2 either.
       *
       * WHAT IT BUYS IS THE GLOBAL COOLDOWN, which `abilities/shaman.ts`
       * deliberately leaves it paying: the capture says "Instant" and says
       * nothing about the GCD, and guessing it off would be free uptime nobody
       * granted. Pre-combat mode skips the GCD the action would start, so the
       * whole 25 second window arrives for nothing -- and the cooldown is 180
       * seconds, three times the fight, so nothing is lost at the other end.
       *
       * ------------------------------------------------------------------------
       * AND IT MEASURED **-4.79, NOISE** EARLIER IN THIS SAME ROUND, which is
       * the knock-on the loop exists for rather than a contradiction.
       *
       * Before the talent and flask changes this list made about 33 casts in a
       * 60 second fight and had global cooldowns to spare, so a saved one bought
       * nothing -- which is the retraction `docs/profile-optimisation.md`
       * records in the other direction. Reverberation's two extra shock charges
       * took Earth Shock from 5.90 casts to 7.60 and Fire Nova to 9.40, and a
       * GCD that was free became worth something. **A figure can go stale inside
       * the round that produced it.**
       * ========================================================================
       */
      precombat: [
        // FLAMETONGUE, not Windfury, by the owner's round 37.
        ...before(3, 'flametongue_weapon'),
        ...before(1.5, 'searing_totem'),
        ...before(0, 'flame_shock'),
        ...before(0, 'rage_of_the_farseer'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_frostfire',
    label: 'Frostfire',
    detail: 'Gnome, caster, standing target. 29 Fire / 22 Frost',
    characterClass: 'mage',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Frostfire Mage',
        race: 'gnome',
        characterClass: 'mage',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
      },
      talents: { ...MAGE_FROSTFIRE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_fire'),
      /*
       * ==================================================================
       * THE OWNER'S OPENER, AND NOTHING ELSE -- A PRE-PULL SCORCH REVERTED
       * FOR **-25.90 +/- 9.70** OVER 400 PAIRED ITERATIONS.
       *
       * **THE RULING: "Once you deal damage or finish casting a damaging
       * ability combat has started."** So a pre-combat list may finish AT
       * MOST ONE damaging ability, and it must finish at exactly t=0.
       *
       *   mage_armor       4.0s   not damaging, free at any lead
       *   frostfire_bolt   2.5s   DAMAGING, finishes -0.049s   the pull
       *   scorch           1.5s   DAMAGING, finishes -0.029s   REMOVED
       *
       * Both deficits are the haste artefact on a lead written as the
       * spell's declared cast time, which is not a violation to fix.
       * **B1 is the violation: there were two damaging casts**, so the
       * Scorch dealt its damage and put a Fire Vulnerability stack on the
       * boss before the clock started, and the +25.1 it was credited with
       * was bought with a fight that had already begun.
       *
       * THIS IS THE ARCANE MAGE'S FAILURE A SECOND TIME, in a profile
       * `docs/profile-optimisation.md`'s Appendix A had already flagged as
       * failing -- audited, written down, and still shipped. Nothing in the
       * engine enforces the rule, no fight reveals it, and `USES=1` prints
       * an illegal opener as cheerfully as a legal one.
       *
       * AND THE LEGAL DESIGN SPACE HERE IS EMPTY, which is why nothing
       * replaces it. An addition has to be a NON-damaging action, and this
       * build's only non-damaging castables are Mage Armor (already here),
       * Evocation (a channel, refused outright) and two things that are
       * ALREADY off the global cooldown -- the Spellblasting potion and the
       * Gnome racial. **Pre-casting is only worth the global cooldown it
       * saves**, and both were measured at a 0s lead: each ran a
       * BIT-IDENTICAL fight to this opener. That is the retracted Arcane
       * Power figure's lesson, measured rather than asserted.
       *
       * THE MAGE ARMOR LEAD IS LEFT ALONE. Moving it to 0s is **+0.49**
       * against an interval of 9.70, and REMOVING it was -26.2 -- so the
       * buff is load-bearing and its lead is not.
       * ==================================================================
       */
      precombat: [...before(4, 'mage_armor'), ...before(2.5, 'frostfire_bolt')],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_arcane',
    label: 'Arcane',
    detail: 'Gnome, caster, standing target. 35 Arcane / 11 Fire / 5 Frost',
    characterClass: 'mage',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Arcane Mage',
        race: 'gnome',
        characterClass: 'mage',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
      },
      talents: { ...MAGE_ARCANE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_arcane'),
      /*
       * ========================================================================
       * THE OPENER IS THE OWNER'S OWN TWO LINES PLUS ONE FREE WINDOW, AND THAT
       * IS A GATE RATHER THAN A MEASUREMENT.
       *
       * **THE RULING: "Once you deal damage or finish casting a damaging
       * ability combat has started."** So a pre-combat list may finish AT MOST
       * ONE damaging ability and it must finish at exactly t=0 -- that cast is
       * the pull. This list is:
       *
       *   mage_armor    instant at t-3     the owner's line. Deals nothing
       *   arcane_blast  t-1.5 -> t0        the owner's line. THE one damaging
       *                                    cast, and it IS the pull
       *   arcane_power  instant at t0      deals nothing; a 15s window claimed
       *                                    for no global cooldown (+24.9)
       *
       * ------------------------------------------------------------------------
       * **WHAT WAS HERE BEFORE DEALT ABOUT 1,200 TO 1,400 DAMAGE BEFORE THE
       * CLOCK STARTED, AND ITS +95.9 IS VOID.** A Pyroblast finishing at t-7.5
       * and three Arcane Blasts finishing at t-6, t-4.5 and t-3, for a
       * four-stack spell-power ramp bought for no global cooldown. Reverting it
       * costs **-96.5 +/- 9.4** over 600 paired iterations -- measured by
       * restoring it as a variant rather than by subtracting two figures taken
       * at different iteration counts. That is the honest price of the ruling
       * and not a regression: the build never legally had it.
       *
       * AND THE OWNER'S OWN SINGLE BLAST IS WORTH **+23.6 +/- 9.8** against no
       * damaging cast at all, so the pull being a real spell is most of what a
       * legal opener can buy here.
       *
       * **AND NOTHING IN THE ENGINE WOULD HAVE CAUGHT IT.** `runPrecombat`
       * resolves every action at timestamp zero, so the damage, the procs and
       * the auras all arrive free -- there is no zero anywhere to notice, the
       * suite was green at 3731, CI passed on Node 20 and 22, and `USES=1`
       * printed the illegal opener as cheerfully as this one. It passed a
       * self-authored OVERLAP check too, which is the instructive part: a
       * sequence can be perfectly non-overlapping and still deal damage four
       * times before the pull. **Finding a constraint was mistaken for finding
       * the constraint.** The gate is arithmetic on the declared leads and is
       * written down in docs/profile-optimisation.md as Gate B.
       *
       * ------------------------------------------------------------------------
       * **THE 0.029s IS THE OWNER'S TRANSCRIPTION MEETING HASTE, NOT A
       * VIOLATION.** `rewindFor` is `max(0, lead - hastedCastTime)`, and their
       * leads are each spell's DECLARED cast time -- so a 1.5s lead on an Arcane
       * Blast hasted to 1.471s finishes 29ms before the pull. Recorded rather
       * than "fixed", because the line is theirs; what may never happen is
       * ADDING a line that relies on that gap.
       *
       * ------------------------------------------------------------------------
       * **AND THE OPENER'S DESIGN SPACE UNDER THE GATE IS ALMOST EMPTY**, which
       * is worth stating so nobody re-derives it: one damaging cast, so it is
       * Arcane Blast OR Pyroblast and not both; a channel is refused outright,
       * so Arcane Missiles and Evocation cannot go here at all; and everything
       * else that may be added is a non-damaging instant at any lead. That
       * leaves Arcane Power, Presence of Mind, Eureka and the potion as the only
       * candidates, and only Arcane Power is worth anything -- see
       * `tools/arcaneVariants.ts`, group `arcGate`.
       * ========================================================================
       */
      precombat: [
        ...before(3, 'mage_armor'),
        ...before(1.5, 'arcane_blast'),
        // Arcane Power is off the opener: it is a step of the cooldown stack.
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_fire',
    label: 'Fire',
    detail: 'Gnome, caster, standing target. 15 Arcane / 31 Fire / 5 Frost',
    characterClass: 'mage',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Fire Mage',
        race: 'gnome',
        characterClass: 'mage',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
      },
      talents: { ...MAGE_FIRE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_fire'),
      /*
       * ========================================================================
       * THE PRE-PULL SCORCH IS GONE, AT A COST OF **-24.23 +/- 4.29**, AND IT
       * WAS NOT A CHOICE.
       *
       * THE OWNER'S RULING: "Once you deal damage or finish casting a damaging
       * ability combat has started." So a pre-combat list may finish AT MOST
       * ONE damaging ability and it must finish at exactly t=0 -- that cast is
       * the pull. This opener finished TWO: their own `fireball` at a 3s lead,
       * and a `scorch` at 1.5s that this project added and recorded here at
       * +15.2 +/- 10.2.
       *
       * NOTHING IN THE ENGINE ENFORCES IT AND NO FIGHT REVEALS IT.
       * `runPrecombat` resolves every action at timestamp zero, so the damage,
       * the procs and the auras all arrive free; there is no zero anywhere to
       * notice, the suite stays green, and `USES=1` printed it as cheerfully as
       * a legal opener. `docs/profile-optimisation.md` Appendix A had it as one
       * of three profiles still failing Gate B.
       *
       * WHAT THE REVERT ACTUALLY COST IS LESS THAN THAT FIGURE, because the
       * round recovered most of it legally: the whole package measures **-3.57
       * +/- 4.83 against the illegal build**, which is noise. See HANDOVER.md.
       *
       * THE OWNER'S TWO LINES ARE UNTOUCHED, which is what
       * `tests/profiles/precombatOpeners.test.ts` asserts: an optimisation may
       * ADD to their opener and may not reorder or replace it. This round
       * removed only the addition.
       *
       * AND THE OPENER HAS NOTHING LEFT TO ADD, WHICH THE COMBUSTION RULING
       * MADE MUCH MORE TRUE RATHER THAN LESS.
       *
       * A pre-cast is worth only the global cooldown it saves, so anything
       * already off the GCD is not a candidate -- which ruled out the potion,
       * the Demonic Rune and Eureka, and now rules out **Combustion**, the one
       * candidate that was left. The owner has ruled it off the global
       * cooldown, so a pre-cast of it saves nothing and only pays the cost.
       *
       * AND THE COST IS LARGE. It measured **-4.69 +/- 10.91** (noise) while
       * Combustion paid a GCD and **-36.38 +/- 5.52 (real)** once it stopped.
       * The window is spent by four Fire crits rather than by a clock, and a
       * three-minute cooldown pre-cast at t=0 can never be reached again inside
       * a one-minute fight -- so the whole window is burned on a target with
       * ZERO Fire Vulnerability stacks instead of at the five-stack cap about
       * eight seconds in.
       *
       * THIS IS THE RETRACTED ARCANE POWER FIGURE POINTING THE OTHER WAY.
       * There, +24.9 for a pre-cast turned out to be mostly a global cooldown
       * the ability should never have paid, and once the flag was fixed the
       * pre-cast was worth nothing. Here the same fix took a pre-cast from
       * "noise" to a clear loss. **Check the GCD flag before pricing a
       * pre-cast**, in both directions.
       *
       * REMOVING THE OWNER'S OWN `fireball` IS **-42.68 +/- 10.93**, which is
       * what that line is worth and is here so nobody prices the opener by
       * removing it.
       * ========================================================================
       */
      precombat: [...before(4.5, 'mage_armor'), ...before(3, 'fireball')],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'pally_ret',
    label: 'Seal Twist Ret',
    detail: 'Human, two-hander, standing target. 13 Holy / 38 Retribution',
    characterClass: 'paladin',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Seal Twist Ret',
        race: 'human',
        characterClass: 'paladin',
        level: 60,
        combatStyle: 'two_hander',
        stance: 'battle',
      },
      talents: { ...PALADIN_RETRIBUTION_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * ======================================================================
       * THE SPELL POWER FLASK AND THE SPELL POWER FOOD, BOTH THE OWNER'S, AND
       * BOTH AS OVERRIDES RATHER THAN AS AN EDIT TO `hybridConsumables`.
       *
       * THE ROW SERVES FOUR BUILDS -- this one, the Shockadin, the Protection
       * Paladin and the Enhancement Shaman -- and the owner has now named
       * three of them with TWO DIFFERENT ANSWERS: Retribution and the Shockadin
       * take the Spell Power flask, and the Protection Paladin was given the
       * FOOD and not the flask. So no edit to the shared row satisfies the
       * rulings that exist, which is the same arithmetic that settled
       * `STRENGTH_CONSUMABLES` and is a fact about the SHAPE rather than a
       * reading of any one sentence.
       *
       * THE FLASK IS A REAL TRADE AND NOT A STRICT UPGRADE. +1200 Hit Points
       * against +150 Spell Power: this profile is 54% Holy by measured share,
       * so the spell power reaches rather more than half of what it does, and
       * the hit points reach a build that is never attacked. For the
       * PROTECTION Paladin the hit points reach a build that IS attacked,
       * which is the obvious reason the owner named its food and not its
       * flask -- recorded as the likely reason and not as an inference acted
       * on. A ruling covers what it says.
       * ======================================================================
       */
      consumables: {
        ...hybridConsumables({
          school: 'school_holy',
          meleeWeaponEffect: true,
          blastedLands: 'blasted_strength',
        }),
        flask: 'flask_spell_power',
        food: 'food_spell_power',
      },
      /*
       * TWO SEALS IN SEQUENCE, WHICH IS THE SEAL TWIST OPENED BEFORE THE PULL.
       * Seal of Righteousness at 3s and Seal of Command at 1.5s means the
       * character pulls with Command up and Righteousness spent -- which is
       * the state the twist cycle expects to find, and the reason the list had
       * no entry point of its own when both seals were gated on each other.
       */
      precombat: [
        ...before(3, 'seal_of_righteousness'),
        ...before(1.5, 'seal_of_command'),
        ...before(0, 'judgement'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'pally_shockadin',
    label: 'Shockadin',
    detail: 'Human, 1H and a caster shield, standing target. 23 Holy / 28 Retribution',
    characterClass: 'paladin',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Shockadin',
        race: 'human',
        characterClass: 'paladin',
        level: 60,
        /*
         * THE GEAR DECIDED THIS, and it used to be `two_hander`.
         *
         * The owner's Shockadin set is Azuresong Mageblade and Earth and Fire:
         * a one-hander and a caster shield. A two-hand style deletes the main
         * hand and both off-hand slots, so that set under that style is a
         * Paladin holding nothing. Five settings have to agree, and this is the
         * one that did not.
         */
        combatStyle: 'one_hand_shield',
        stance: 'battle',
      },
      talents: { ...PALADIN_SHOCKADIN_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      /*
       * THE SAME PAIR AS SEAL TWIST RET, and on this build the case is
       * stronger rather than merely equal: the Shockadin is **74% Holy** by
       * measured share, the highest of the four hybrids, so +150 Spell Power
       * reaches nearly all of its damage. See the Retribution row above for
       * why these are overrides and not an edit to the shared one.
       *
       * THE FLASK IS THE LARGEST SINGLE CONSUMABLE DECISION EITHER SHOCKADIN
       * MAKES: +1200 Hit Points against it measures **-63** on the shield
       * build and **-65** on the two-hander, on a profile nothing attacks.
       */
      /*
       * BLASTED LANDS IS INTELLECT HERE, NOT STRENGTH, AND CHAMPION OF THE
       * LIGHT IS THE WHOLE REASON. +25 Intellect is 60% of itself as SPELL
       * POWER on this build -- plus Divine Intellect's 10% on top -- against
       * +25 Strength's fifty attack power, and this profile is three-quarters
       * Holy. Measured +2.9 on the shield build and +3.0 on the two-hander.
       */

      consumables: {
        ...hybridConsumables({
          school: 'school_holy',
          meleeWeaponEffect: false,
          blastedLands: 'blasted_intellect',
        }),
        flask: 'flask_spell_power',
        food: 'food_spell_power',
        // Frost Oil on the main hand, by the owner.
        weapon_effect_main_hand: 'frost_oil_main_hand',
      },
      precombat: [
        ...before(1.5, 'seal_of_righteousness'),
        ...before(0, 'judgement'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  /*
   * ==========================================================================
   * SHOCKADIN 2H -- THE SAME CHARACTER WITH THE OTHER WEAPON IN ITS HANDS.
   *
   * The owner asked for a fast two-hander as "an alternative to the template
   * gear, not a replacement", and for the two setups to be optimised against
   * each other. A PRESET is what can hold a whole setup: the talents, the
   * enchants, the consumables and the list are all allowed to differ, and a
   * style flip on one profile cannot carry four of those.
   *
   * ITS GEAR IS THE SHOCKADIN'S GEAR. The two benchmark templates differ in
   * exactly one field -- which weapon plan is primary -- so every armour slot,
   * both trinkets and the whole hit spread come out identical. That is the
   * owner's "don't change the gear beyond the two weapon swaps I've
   * identified", held by construction rather than by care.
   * ==========================================================================
   */
  {
    id: 'pally_shockadin_2h',
    label: 'Shockadin 2H',
    detail: 'Human, fast 2H mace, standing target. 23 Holy / 28 Retribution',
    characterClass: 'paladin',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Shockadin 2H',
        race: 'human',
        characterClass: 'paladin',
        level: 60,
        /*
         * THE FIELD THAT MAKES THIS A DIFFERENT CHARACTER FROM THE ROW ABOVE,
         * and it agrees with the gear rather than overriding it: this profile's
         * benchmark set contains the fast two-hander and NO one-hander and NO
         * shield, because the owner ruled that holding one excludes the other
         * -- "You cannot ever have the stats of both active. It's one or the
         * other." See `equipExclusive`, which is that ruling where the planner
         * enforces it.
         */
        combatStyle: 'two_hander',
        stance: 'battle',
      },
      talents: { ...PALADIN_SHOCKADIN_2H_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: {
        ...hybridConsumables({
          school: 'school_holy',
          /*
           * THE SPELL-CRIT STONE ON BOTH ROWS, measured rather than assumed on
           * each: the melee option costs **-10.2** here and **-10.4** on the
           * shield build. A two-hander and a one-hander-plus-shield are each
           * ONE swinging weapon, so `ConsumableCategory.perWeapon` pays the
           * same once either way and the hands do not divide this row.
           */
          meleeWeaponEffect: false,
          blastedLands: 'blasted_intellect',
        }),
        flask: 'flask_spell_power',
        food: 'food_spell_power',
        // Frost Oil on the main hand, by the owner.
        weapon_effect_main_hand: 'frost_oil_main_hand',
      },
      precombat: [
        ...before(1.5, 'seal_of_righteousness'),
        ...before(0, 'judgement'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'prot_pally',
    label: 'Prot Pally',
    detail: 'Human, 1H and shield, target swings back. 36 Protection',
    characterClass: 'paladin',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Prot Pally',
        race: 'human',
        characterClass: 'paladin',
        level: 60,
        combatStyle: 'one_hand_shield',
        stance: 'battle',
      },
      talents: { ...PALADIN_PROTECTION_TALENTS },
      raidBuffs: [...TANK_RAID_BUFFS],
      /*
       * THE HEALTHSTONE RATHER THAN THE RUNE, which is the one place a hybrid
       * row is overridden and the reason is the same one that makes this
       * profile different from the other three: it is HIT BACK. Health is the
       * pool it empties, and the Rune is never drunk by it at all -- where the
       * Healthstone fires 0.96 times a fight and takes deaths 8.54 to 8.31,
       * the biggest survival figure any Other candidate produced here.
       *
       * IT COSTS 2.0 DPS TO DO THAT, which is the right trade for a build whose
       * figure of merit is a death count and the reason the DPS table is the
       * wrong measure for this row -- the same thing already recorded about the
       * tanks' enchants being dodge and defense skill.
       */
      /*
       * AND THE SPELL POWER FOOD, WITHOUT THE SPELL POWER FLASK, which is what
       * the owner named for this profile and is the one asymmetry in the three
       * Paladin rows. The other two took both. +1200 Hit Points is worth
       * something here that it is worth nowhere else in the row -- this is the
       * build that is HIT BACK -- so the asymmetry reads as deliberate, and it
       * is applied exactly as stated either way.
       */
      consumables: {
        ...hybridConsumables({
          school: 'school_holy',
          meleeWeaponEffect: false,
          blastedLands: 'blasted_strength',
        }),
        food: 'food_spell_power',
        other: 'healthstone',
      },
      precombat: [
        ...before(4.5, 'righteous_fury'),
        ...before(3, 'seal_of_righteousness'),
        ...before(1.5, 'holy_shield'),
        ...before(0, 'judgement'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: true },
    }),
  },
  {
    id: 'bm_hunter',
    label: 'BM Hunter',
    detail: 'Orc, bow and a Cat, standing target. 31 Beast Mastery',
    characterClass: 'hunter',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'BM Hunter',
        race: 'orc',
        characterClass: 'hunter',
        level: 60,
        combatStyle: 'ranged',
        stance: 'battle',
        petFamily: 'cat',
      },
      talents: { ...HUNTER_BEAST_MASTERY_TALENTS },
      // Grace of Air rather than Windfury: a bow has no main-hand use.
      // See `RANGED_HUNTER_RAID_BUFFS`.
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: RANGED_HUNTER_CONSUMABLES,
      precombat: [
        ...before(5, 'hunters_mark'),
        ...before(3.5, 'aspect_of_the_hawk'),
        ...before(2, 'aimed_shot'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'lw_ranged',
    label: 'LW Ranged',
    detail: 'Orc, bow, no pet, standing target. 39 Marksmanship',
    characterClass: 'hunter',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'LW Ranged',
        race: 'orc',
        characterClass: 'hunter',
        level: 60,
        combatStyle: 'ranged',
        stance: 'battle',
      },
      talents: { ...HUNTER_LONE_WOLF_RANGED_TALENTS },
      // Grace of Air rather than Windfury: a bow has no main-hand use.
      // See `RANGED_HUNTER_RAID_BUFFS`.
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: RANGED_HUNTER_CONSUMABLES,
      precombat: [
        ...before(7, 'hunters_mark'),
        ...before(5.5, 'aspect_of_the_hawk'),
        // AIMED SHOT AT 2s, where Sniper Shot was at 4s -- the owner's round 37.
        ...before(2, 'aimed_shot'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'lw_melee',
    label: 'LW Melee',
    detail: 'Orc, dual wield, no pet, standing target. 31 Survival',
    characterClass: 'hunter',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'LW Melee',
        race: 'orc',
        characterClass: 'hunter',
        level: 60,
        /*
         * DUAL WIELD, on the ruleset owner's instruction, and it is the fifth
         * of the five settings a build has to agree on. The style decides which
         * slots auto-attack, which weapon set is legal, and -- through
         * Predator's Edge -- what a talent this build already took is worth.
         */
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...HUNTER_LONE_WOLF_MELEE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      // A melee Hunter HAS a mana pool, so it takes the Rune where a Rogue on
      // the same row takes Thistle Tea -- which is Rogue-and-Druid only. It
      // fires 0.00 times at sixty seconds on both, and is kept for the reason
      // every rarely-fired safety net here is kept. See `casterConsumables`.
      consumables: {
        ...AGILITY_CONSUMABLES,
        mana_regen: 'mana_regen_12',
        other: 'demonic_rune',
      },
      /*
       * ======================================================================
       * "QUEUE RAPTOR STRIKE + CAST MONGOOSE BITE", AND ONLY THE FIRST HALF IS
       * POSSIBLE.
       *
       * Raptor Strike is on-next-swing, so `castAbility` ARMS it -- paid for
       * now, delivered by the first swing that lands -- which is exactly what
       * the owner's word "queue" describes, and it is the distinction they drew
       * between the two halves of this line.
       *
       * AND MONGOOSE BITE WAS REPLACED BY STRIDER KICK, WHICH IS THE OWNER'S
       * ANSWER TO A PROBLEM THE OPENER GUARD FOUND.
       *
       * Their line was "queue Raptor Strike + cast Mongoose Bite", and Mongoose
       * Bite "can only be performed after you dodge" -- nothing attacks a
       * Hunter here, so its only route is EXPOSE PREY, the Survival talent this
       * build takes at 2/2: "your attacks against targets with Hunter's Mark
       * have a 10% chance to activate your Mongoose Bite". **Before the pull no
       * attack has landed, so the window cannot be open**, and the pre-combat
       * cast was refused and skipped in silence. `precombatOpeners.test.ts`
       * caught it the first time it ran; the owner: "good catch. Replace
       * Mongoose Bite with Strider kick instead for those pre-combat
       * instances."
       *
       * STRIDER KICK HAS NO GATE AT ALL -- 100% melee weapon damage, instant,
       * free, an eight second cooldown -- so it simply happens. Mongoose Bite
       * keeps its list entry and still fires when the proc lands; what it
       * cannot do is open.
       * ======================================================================
       */
      precombat: [
        ...before(3, 'hunters_mark'),
        ...before(1.5, 'aspect_of_the_beast'),
        ...before(0, 'raptor_strike', 'strider_kick'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'hawk_melee',
    label: 'Hawk Melee',
    detail: 'Orc, dual wield, no pet, two hawks, standing target. 16 Beast Mastery',
    characterClass: 'hunter',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Hawk Melee',
        race: 'orc',
        characterClass: 'hunter',
        level: 60,
        // Every setting is LW Melee's. The TALENTS are the whole difference.
        combatStyle: 'dual_wield',
        stance: 'battle',
        /*
         * NO `petFamily`, and that is correct rather than an omission: this
         * build takes Lone Wolf, so `bringsPet` is false and `petFor` never
         * reaches its Cat fallback. Naming a family here would be inert and
         * would read as a pet build -- which is what the first version of this
         * profile was, before the owner's two allocations were measured
         * against each other.
         */
      },
      talents: { ...HUNTER_HAWK_MELEE_TALENTS },
      // Everything below is LW Melee's, on the owner's instruction that race,
      // gear, raid buffs and consumables are the same.
      raidBuffs: [...PRESET_RAID_BUFFS],
      // A melee Hunter HAS a mana pool, so it takes the Rune where a Rogue on
      // the same row takes Thistle Tea -- which is Rogue-and-Druid only. It
      // fires 0.00 times at sixty seconds on both, and is kept for the reason
      // every rarely-fired safety net here is kept. See `casterConsumables`.
      consumables: {
        ...AGILITY_CONSUMABLES,
        mana_regen: 'mana_regen_12',
        other: 'demonic_rune',
      },
      // The same opener as LW Melee, including Strider Kick in Mongoose Bite's
      // place -- the dodge window cannot be open before the pull. See there.
      precombat: [
        ...before(3, 'hunters_mark'),
        ...before(1.5, 'aspect_of_the_beast'),
        ...before(0, 'raptor_strike', 'strider_kick'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'warlock_smds',
    label: 'SM/DS',
    detail: 'Undead, caster, Imp sacrificed, standing target. 40 Affliction',
    characterClass: 'warlock',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'SM/DS',
        race: 'undead',
        characterClass: 'warlock',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
        // Sacrificed rather than kept: Demonic Sacrifice names which buff.
        petFamily: 'imp',
      },
      talents: { ...WARLOCK_AFFLICTION_TALENTS },
      /*
       * THE SPELLSTONE, BY THE RULESET OWNER'S CHOICE, and the measurement says
       * it was a free choice rather than an obvious one: over thirty batches of
       * ten the two stones were worth +7.3 EACH to this profile, a dead heat.
       *
       * They get there by different routes, which is why the tie is not a
       * coincidence. The Spellstone's 2% haste reaches every cast and its 21
       * Shadow power reaches all of this build's damage; the Firestone's 2%
       * spell crit is school-blind and also reaches all of it, while its 21
       * Fire power reaches none. See `docs/handoff/warlock.md`.
       */
      warlockStone: 'spellstone',
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_shadow'),
      /*
       * 2.5 SECONDS IS SHADOW BOLT'S CAST TIME ON THIS BUILD AND NOT ON THE
       * ABILITY, which is the sharpest evidence for how `secondsBefore` reads:
       * the declaration says 3.0 and BANE takes half a second off it. See
       * `PrecombatAction`.
       */
      precombat: [
        ...before(2.5, 'shadow_bolt'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'warlock_firelock',
    label: 'Firelock',
    detail: 'Undead, caster, Succubus sacrificed, standing target. 33 Destruction',
    characterClass: 'warlock',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Firelock',
        race: 'undead',
        characterClass: 'warlock',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
        // Sacrificed rather than kept: Demonic Sacrifice names which buff.
        petFamily: 'succubus',
      },
      talents: { ...WARLOCK_DESTRUCTION_TALENTS },
      /*
       * THE FIRESTONE, BY THE RULESET OWNER'S CHOICE, and here the measurement
       * agreed emphatically: +20.0 REAL against the Spellstone's +2.4, inside
       * the interval, over thirty batches of ten.
       *
       * BOTH HALVES LAND ON THIS BUILD, which is the whole of the difference.
       * ~93% of its damage is Fire, so the 21 Fire power reaches nearly all of
       * it and the school-blind crit reaches all of it -- where a Spellstone's
       * 21 Shadow power would reach only Shadowburn.
       */
      warlockStone: 'firestone',
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_fire'),
      /*
       * BANE OF AGONY AT 0s IS THIS ROUND'S ADDITION (round 42): a pure DoT
       * deals nothing before the pull, so it is free of Gate B and saves the
       * global cooldown -- +10.30 / +4.46 / +4.71 at 60 / 180 / 300s alone.
       */
      precombat: [
        ...before(2, 'incinerate'),
        ...before(0, 'bane_of_agony'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    // The id keeps its first name, so a saved profile still finds it.
    id: 'warlock_demonology',
    label: 'Fire Demo',
    detail: 'Undead, caster, Imp summoned, Succubus sacrificed, standing target. 31 Demonology',
    characterClass: 'warlock',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Fire Demo',
        race: 'undead',
        characterClass: 'warlock',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
        // Sacrificed, and Demonic Pact keeps the sacrifice when the Imp is out.
        petFamily: 'succubus',
        summonedDemon: 'imp',
      },
      talents: { ...WARLOCK_DEMONOLOGY_TALENTS },
      // The Firelock's stone, consumables and raid: the owner's "everything
      // else ... the same as the Firelock profile".
      warlockStone: 'firestone',
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_fire'),
      /*
       * SEARING PAIN IS THE PULL AND BANE OF AGONY GOES OUT WITH IT. The Searing
       * Pain finishes at t=0 and brands the target, so the Imp's first Firebolt
       * already carries a brand charge; it is the one damaging cast, which is
       * what Gate B allows. Bane of Agony at a 0s lead deals nothing before
       * the pull -- its first tick is after it -- and buys the DoT for no
       * global cooldown: +13.88 +/- 4.87 at 60s, noise at 180s and 300s.
       */
      precombat: [
        ...before(1.5, 'searing_pain'),
        ...before(0, 'bane_of_agony'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'shadow_priest',
    label: 'Shadow',
    detail: 'Troll, caster, Shadowform, standing target. 35 Shadow',
    characterClass: 'priest',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'Shadow Priest',
        race: 'troll',
        characterClass: 'priest',
        level: 60,
        combatStyle: 'caster',
        stance: 'battle',
      },
      talents: { ...PRIEST_SHADOW_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: casterConsumables('school_shadow'),
      /*
       * ==================================================================
       * BOTH DoTs MOVED BEFORE THE PULL, WORTH **+35.5 +/- 4.1** TOGETHER --
       * and **+77.4 +/- 4.7** with the Vampiric Embrace entry removed, which
       * is 9% of the profile and the largest change in the six-profile pass
       * after the Arcane Mage's Missile Barrage rank.
       *
       * Shadow Word: Pain is 20% of this build's damage and Devouring Plague
       * 12.4%, both pure DoTs with nothing to roll at the pull -- so applying
       * them before it costs NO GLOBAL COOLDOWN, where in the fight they cost
       * two. It is the Enhancement Shaman's own Flame Shock line applied to a
       * caster.
       *
       * THE PAIR IS WORTH LESS THAN THE SUM OF ITS HALVES: 26.8 + 26.7 = 53.5
       * against a measured 35.5, because both buy the same scarce thing. The
       * fight only has so many global cooldowns at the pull, and the second
       * DoT moved there is competing with the first for what fills the gap.
       * **Marginal values, not addends** -- which is why the pair was measured
       * as a pair rather than added.
       *
       * AND WITH VAMPIRIC EMBRACE OUT IT GOES SLIGHTLY SUPER-ADDITIVE, 39.5 +
       * 35.5 = 75.0 against 77.4: the freed cooldowns at the pull and the freed
       * cooldowns in the fight are not the same cooldowns.
       *
       * AT A 0s LEAD, so each aura is at full duration when the fight starts.
       * A longer lead would hand the fight a DoT already partly expired, which
       * is the one thing a real lead costs.
       * ==================================================================
       */
      precombat: [
        ...before(3, 'shadowform'),
        ...before(1.5, 'mind_blast'),
        // Shadow Word: Pain is off the opener, by the owner (round 37).
        ...before(0, 'devouring_plague'),
      ],
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
]));

/** Give every preset's `build` the stock list for the character it builds. */
function withStockRotations(presets: readonly ProfilePreset[]): readonly ProfilePreset[] {
  return presets.map((preset) => ({
    ...preset,
    build: () => syncDefaultRotation(withoutUnusedOffHandEffect(preset.build())),
  }));
}

/**
 * The Off Hand weapon effect is EMPTY on every preset that swings no off-hand
 * weapon.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER LISTED SEVENTEEN PROFILES BY NAME and every one of them is exactly
 * a build whose style has no second weapon -- the row already contributed
 * nothing there (`consumableReachesCharacter`), and the panel showed a stone on
 * a shield or a staff. So it is written as the rule the list describes rather
 * than as seventeen edits, and a new single-weapon preset gets it for free.
 * The dual-wielders -- DW Fury, the six Rogues, LW and Hawk Melee -- keep theirs.
 * ----------------------------------------------------------------------------
 */
function withoutUnusedOffHandEffect(profile: CharacterProfile): CharacterProfile {
  const style = profile.character.combatStyle ? getCombatStyle(profile.character.combatStyle) : undefined;
  if (style?.offHand === 'weapon') return profile;
  if (!('weapon_effect_off_hand' in profile.consumables)) return profile;
  const { weapon_effect_off_hand: _dropped, ...consumables } = profile.consumables;
  void _dropped;
  return { ...profile, consumables };
}

/**
 * Every preset wears the E65 benchmark set, on the ruleset owner's instruction.
 *
 * ==============================================================================
 * WRAPPED AND NOT EDITED, the same way `withStockRotations` fills the priority
 * list: twenty-five hand-written swaps would be twenty-five chances to put the
 * wrong set on a build, and the one that drifts is the one nobody measures.
 *
 * WHY: the real sets are Classic and Season of Discovery stand-ins at whatever
 * item level the owner's spreadsheets supplied -- item level 66 to 88, with
 * procs, and unevenly distributed between classes. Some of any gap between two
 * presets was therefore a gap in their GEAR. Every build now wears the same
 * quality at the same item level, targeting its own hit cap and its own
 * preferred stats, so a comparison between two rows is a comparison between
 * two BUILDS.
 *
 * IT MOVES EVERY PUBLISHED FIGURE AND IS MEANT TO. The benchmark set is leaner
 * than what the presets wore -- 2H Arms goes from 1829 attack power to 1055 --
 * because it is item level 65 flat against a set that reached 88, and because
 * a generated item has no proc. The baseline table was re-measured in full.
 *
 * THE REAL GEAR IS NOT GONE. `startingEquipmentFor` still returns it and the
 * Gear panel's "Starting set" button still installs it, which is the way back
 * to the figures every earlier commit was measured on.
 * ==============================================================================
 */
function withBenchmarkGear(presets: readonly ProfilePreset[]): readonly ProfilePreset[] {
  return presets.map((preset) => ({
    ...preset,
    build: () => {
      /*
       * THE TEMPLATE ID IS STAMPED ON HERE, where the preset id is in hand.
       *
       * ----------------------------------------------------------------------
       * IT REPLACES A JOIN ON THE CHARACTER'S NAME. `BENCHMARK_TEMPLATES_BY_LABEL`
       * matches `character.name` against the 25 template labels, because `game`
       * may not import `profiles` and the name was the only thing both layers
       * had. That join is on a string a user can edit: renaming the character
       * took away the four test-set buttons AND the default stat valuation.
       *
       * THIS IS THE ONE PLACE THAT KNOWS BOTH, which is why it is here rather
       * than in each of the 25 `build()` functions -- twenty-five hand-written
       * copies is the mistake `withStockRotations` already exists to avoid.
       * The name join is kept as the fallback for files saved before it.
       * ----------------------------------------------------------------------
       */
      const profile = { ...preset.build(), benchmarkTemplateId: preset.id };
      const benchmark = benchmarkEquipmentForName(profile.character.name, 'E65');
      if (!benchmark) return profile;

      /*
       * THE ENCHANTS COME ACROSS, on the owner's instruction: the gear changed
       * and the enchants were to stay exactly as they were. They are worth
       * +2.4 to +53.7 DPS a profile -- the figures `enchants.test.ts` records
       * -- so losing them inside a gear swap is the kind of change nobody
       * would think to look for.
       *
       * `withEnchants` could not be reused: it THROWS when a loadout names a
       * slot the set does not fill, and a benchmark set has no relic and gives
       * a ranged weapon only to the four Hunters.
       */
      const loadout = PRESET_ENCHANTS[preset.id] ?? {};
      const equipment: Record<string, { itemId: number; enchantId?: number }> = {};
      for (const [slot, equipped] of Object.entries(benchmark) as [
        string,
        EquippedSlot | undefined,
      ][]) {
        if (!equipped) continue;
        const enchantId = loadout[slot as keyof typeof loadout];
        equipment[slot] =
          enchantId === undefined
            ? { itemId: equipped.itemId }
            : { itemId: equipped.itemId, enchantId };
      }
      return { ...profile, equipment: equipment as Equipment };
    },
  }));
}

export const PRESETS_BY_ID: ReadonlyMap<string, ProfilePreset> = new Map(
  PROFILE_PRESETS.map((preset) => [preset.id, preset]),
);
