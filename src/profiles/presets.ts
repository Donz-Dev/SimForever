import {
  CRUSADER,
  DRUID_BEAR_GEAR,
  DRUID_CAT_GEAR,
  DRUID_MOONKIN_GEAR,
  HUNTER_ARMOUR,
  HUNTER_DUAL_WIELD_WEAPONS,
  HUNTER_STAT_STICK,
  MAGE_GEAR,
  PALADIN_PROT_GEAR,
  PALADIN_RET_GEAR,
  PALADIN_SHOCKADIN_GEAR,
  PRIEST_GEAR,
  ROGUE_ARMOUR,
  ROGUE_DAGGERS,
  ROGUE_SWORDS,
  SHAMAN_ELEMENTAL_GEAR,
  SHAMAN_ENHANCEMENT_GEAR,
  WARLOCK_GEAR,
  withEnchants,
  PROTECTION_WARRIOR_ENCHANTS,
  STRENGTH_ENCHANTS,
  STRENGTH_ENCHANTS_WITH_AGILITY_BOOTS,
  HUNTER_ARMOUR_RANGED_CRIT,
} from '../game/items/gearSets';
import {
  AGILITY_CONSUMABLES,
  RANGED_HUNTER_CONSUMABLES,
  STRENGTH_CONSUMABLES,
  casterConsumables,
  hybridConsumables,
} from '../game/buffs/consumables';
import type { ClassId } from '../game/character';
import type { Equipment } from '../game/items/Item';
import type { TalentAllocation } from '../game/talents/Talent';
import type { CharacterProfile } from './CharacterProfile';
import { createDefaultProfile } from './CharacterProfile';

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
 * TWO PRESETS SUBSTITUTE ONE ENTRY EACH, and both swap rather than drop: the
 * ranged Hunters take Grace of Air instead of Windfury, and the MOONKIN TAKES
 * MOONKIN AURA INSTEAD OF LEADER OF THE PACK. The owner's instruction -- the
 * Moonkin profile should have Moonkin Aura selected by default, because that is
 * the one it brings.
 *
 * ITS CRIT IS +3% EITHER WAY, and that is the containment check rather than a
 * coincidence: Moonkin Aura, Leader of the Pack and the two Druid talents that
 * grant them are ONE aura with one id, so no combination of them is worth more
 * than one. See `PARTY_CRIT_AURA` in `auras/druid.ts`, which carries the ruling
 * and the 6% it used to be possible to hold.
 *
 * THAT IS STILL "one raid", read properly: the raid supplies whichever of the
 * two auras it has a druid for, and for this profile that druid is the
 * character. Nothing else about who turned up changes.
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
  'faerie_fire',
  'mark_of_the_wild',
  'strength_of_earth_totem',
  'mana_spring_totem',
  'windfury_totem',
  'trueshot_aura',
  'leader_of_the_pack',
];

/**
 * The same raid, for the two profiles whose main hand never swings.
 *
 * ----------------------------------------------------------------------------
 * GRACE OF AIR INSTEAD OF WINDFURY, on the ruleset owner's instruction, and for
 * the two RANGED Hunters only. Windfury Totem is "20% chance on each MAIN-HAND
 * use", which a Hunter shooting a bow never has -- so for those two it is a
 * checked box worth exactly nothing, and 89 agility is worth something.
 *
 * LW MELEE IS NOT ONE OF THEM, deliberately: it swings a main hand, so Windfury
 * is real for it. The split is by what the profile DOES rather than by class,
 * which is why it is two of the three Hunters and not all three.
 *
 * DERIVED BY SUBSTITUTION rather than written out, so a buff added above reaches
 * these two as well -- a second hand-kept copy is exactly how they would quietly
 * stop receiving something every other profile got. The substitution keeps
 * Windfury's POSITION rather than re-sorting into catalogue order, which costs a
 * one-line diff against a hand-edited profile and buys the guarantee that the
 * two lists cannot drift apart.
 * ----------------------------------------------------------------------------
 */
const RANGED_HUNTER_RAID_BUFFS: readonly string[] = PRESET_RAID_BUFFS.map((id) =>
  id === 'windfury_totem' ? 'grace_of_air_totem' : id,
);

/**
 * The same raid, for the one character that brings the other half of it.
 *
 * MOONKIN AURA IN LEADER OF THE PACK'S PLACE, on the ruleset owner's
 * instruction. The Moonkin provides this half of the exclusive pair, so it is
 * the half its raid is running.
 *
 * A SUBSTITUTION RATHER THAN A REMOVAL, which is both more accurate -- the raid
 * is not short a buff, it has the other one -- and what makes the Raid Buffs
 * panel show a ticked box where a person would look for it. Derived by mapping
 * rather than written out, like `RANGED_HUNTER_RAID_BUFFS` above and for the
 * same reason: a buff added to the list above reaches this one too, where a
 * second hand-kept copy is how the Moonkin would quietly stop receiving
 * something every other profile got. The position is kept rather than re-sorted
 * into catalogue order, which costs a one-line diff against a hand-edited
 * profile and buys the guarantee that the two lists cannot drift apart.
 */
const MOONKIN_RAID_BUFFS: readonly string[] = PRESET_RAID_BUFFS.map((id) =>
  id === 'leader_of_the_pack' ? 'moonkin_form' : id,
);

/**
 * Everything that is not a weapon, shared by all three builds.
 *
 * Identical in the ruleset owner's three lists, item for item, which is why it
 * is written once. The ids are the same ones `startingSets.ts` curates -- and this
 * deliberately does NOT call that function, because a preset is a stated build
 * rather than "whatever the starting set happens to be today". If the starting
 * set changes, these should not silently change with it.
 */
const SHARED_ARMOUR: Equipment = {
  ranged: { itemId: 17069 }, // Striker's Mark
  head: { itemId: 226495 }, // Jaws of Might
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 226492 }, // Pauldrons of Might
  cloak: { itemId: 13340 }, // Cape of the Black Baron
  chest: { itemId: 226494 }, // Hauberk of Might
  wrists: { itemId: 226499 }, // Armguards of Might
  gloves: { itemId: 226497 }, // Hands of Might
  waist: { itemId: 226498 }, // Sash of Might
  legs: { itemId: 226493 }, // Leggings of Might
  feet: { itemId: 226496 }, // Treads of Might
  ring1: { itemId: 19325 }, // Don Julio's Band
  ring2: { itemId: 228261 }, // Quick Strike Ring
  trinket1: { itemId: 13965 }, // Blackhand's Breadth
  trinket2: { itemId: 11815 }, // Hand of Justice
};

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
  enrage: 4,
  improved_execute: 2,
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
  malice: 5,
  ruthlessness: 3,
  murder: 2,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 5,
  vile_poisons: 5,
  cold_blood: 1,
  improved_poisons: 5,
  mutilate: 1,
  seal_fate: 5,
  venom: 1,
  improved_eviscerate: 3,
  lightning_reflexes: 3,
  puncturing_wounds: 3,
  precision: 3,
  opportunity: 2,
};

/** Combat -- Assassination 18 / Combat 33. Sinister Strike and the cooldowns. */
const ROGUE_COMBAT_TALENTS: TalentAllocation = {
  malice: 5,
  ruthlessness: 3,
  murder: 2,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 4,
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
const ROGUE_RUPTURE_TALENTS: TalentAllocation = {
  malice: 5,
  ruthlessness: 2,
  improved_slice_and_dice: 3,
  lethality: 2,
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
  malice: 5,
  ruthlessness: 3,
  improved_slice_and_dice: 3,
  relentless_strikes: 1,
  lethality: 5,
  improved_eviscerate: 3,
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
 * THE THREE DRUID BUILDS, decoded from the owner's URLs. 38/0/13, 9/34/8 and
 * 9/42/0, each exactly 51 points.
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
const DRUID_MOONKIN_TALENTS: TalentAllocation = {
  improved_wrath: 5,
  genesis: 2,
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
  reflection: 3,
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
  predatory_instincts: 2,
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
  predatory_instincts: 2,
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
const SHAMAN_ELEMENTAL_TALENTS: TalentAllocation = {
  convection: 5,
  concussion: 5,
  reverberation: 5,
  call_of_flame: 3,
  elemental_focus: 1,
  elemental_fury: 5,
  eye_of_the_storm: 3,
  call_of_thunder: 1,
  elemental_reach: 2,
  lightning_overload: 3,
  earthbound: 1,
  elemental_alacrity: 3,
  lava_burst: 1,
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  improved_ghost_wolf: 2,
  shamanistic_focus: 1,
};

const SHAMAN_ENHANCEMENT_TALENTS: TalentAllocation = {
  concussion: 5,
  elemental_warding: 3,
  call_of_flame: 3,
  elemental_devastation: 3,
  elemental_focus: 1,
  improved_fire_nova: 2,
  thundering_strikes: 5,
  ancestral_knowledge: 4,
  mental_dexterity: 3,
  improved_ghost_wolf: 1,
  elemental_weapons: 3,
  shamanistic_focus: 1,
  flurry: 5,
  stormstrike: 1,
  spirit_weapons: 1,
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
  improved_fireball: 5,
  ignite: 5,
  flame_throwing: 1,
  burning_soul: 3,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 3,
  fire_power: 4,
  elemental_precision: 5,
  ice_shards: 5,
  piercing_ice: 3,
  frost_channeling: 3,
  ice_lance: 1,
  shatter: 3,
  fingers_of_frost: 2,
};

const MAGE_ARCANE_TALENTS: TalentAllocation = {
  wand_specialization: 2,
  arcane_focus: 5,
  improved_channeling: 5,
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
  missile_barrage: 1,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  wake_of_fire: 1,
  incineration: 3,
};

const MAGE_FIRE_TALENTS: TalentAllocation = {
  arcane_focus: 5,
  arcane_concentration: 5,
  wake_of_fire: 2,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  flame_throwing: 2,
  impact: 3,
  burning_soul: 3,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 1,
  critical_mass: 3,
  blast_wave: 1,
  fire_power: 5,
  combustion: 1,
  elemental_precision: 2,
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
  unyielding_faith: 2,
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

const PALADIN_SHOCKADIN_TALENTS: TalentAllocation = {
  divine_strength: 5,
  divine_intellect: 5,
  healing_light: 3,
  improved_seals: 3,
  reverence: 3,
  divine_favor: 1,
  divine_precision: 2,
  holy_shock: 1,
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 2,
  sanctified_judgement: 3,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  vengeance: 3,
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
 * THE THREE HUNTER BUILDS, decoded from the owner's URLs. 31/20/0, 7/39/5 and
 * 7/13/31, each exactly 51 points.
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
  hawk_eye: 3,
  lethal_attacks: 5,
  efficiency: 2,
  careful_aim: 5,
  mortal_shots: 5,
};

const HUNTER_LONE_WOLF_RANGED_TALENTS: TalentAllocation = {
  deadly_aspects: 5,
  focused_fire: 2,
  hawk_eye: 3,
  lethal_attacks: 5,
  careful_aim: 5,
  rapid_killing: 2,
  improved_arcane_shot: 5,
  lone_wolf: 1,
  trueshot_aura: 1,
  mortal_shots: 5,
  rapid_recuperation: 2,
  barrage: 3,
  scatter_shot: 1,
  ranged_weapon_specialization: 5,
  sniper_shot: 1,
  improved_tracking: 5,
};

const HUNTER_LONE_WOLF_MELEE_TALENTS: TalentAllocation = {
  deadly_aspects: 5,
  focused_fire: 2,
  lethal_attacks: 5,
  careful_aim: 5,
  rapid_killing: 2,
  lone_wolf: 1,
  improved_tracking: 5,
  savage_strikes: 2,
  survivalist: 4,
  surefooted: 3,
  deterrence: 1,
  predator_s_edge: 5,
  resourcefulness: 2,
  expose_prey: 2,
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
  malediction: 5,
  improved_drains: 3,
  improved_bane_of_agony: 2,
  pandemic: 3,
  malevolence: 5,
  nightfall: 2,
  siphon_life: 1,
  soul_siphon: 3,
  shadow_mastery: 5,
  wrack: 1,
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
};

const WARLOCK_DESTRUCTION_TALENTS: TalentAllocation = {
  suppression: 5,
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
  destructive_reach: 2,
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
 * THE SHADOW PRIEST BUILD, decoded from the owner's URL. 16/3/32, exactly 51
 * points, and the twenty-first profile in the project.
 */
const PRIEST_SHADOW_TALENTS: TalentAllocation = {
  twin_disciplines: 5,
  silent_resolve: 2,
  improved_power_word_shield: 3,
  meditation: 3,
  twilight_focus: 3,
  shadow_focus: 5,
  shadow_affinity: 3,
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

export const PROFILE_PRESETS: readonly ProfilePreset[] = [
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
      consumables: STRENGTH_CONSUMABLES,
      equipment: {
        ...withEnchants(SHARED_ARMOUR, STRENGTH_ENCHANTS),
        // Obsidian Edged Blade, enchanted. A two-hander carries one weapon and
        // therefore one Crusader.
        twoHand: { itemId: 228229, enchantId: CRUSADER },
      },
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
      consumables: STRENGTH_CONSUMABLES,
      equipment: {
        // Arms' row with AGILITY boots instead of Minor Speed, which is the
        // owner's one difference between the two damage warriors.
        ...withEnchants(SHARED_ARMOUR, STRENGTH_ENCHANTS_WITH_AGILITY_BOOTS),
        /*
         * BOTH WEAPONS ENCHANTED, which the dual-wield starting set is not.
         * The ruleset owner asks for Crusader on each, and Forever stacks the
         * two hands' Holy Strength separately -- so the second enchant is
         * worth a second hundred strength rather than refreshing the first.
         */
        mainHand: { itemId: 17075, enchantId: CRUSADER }, // Vis'kag the Bloodletter
        offHand: { itemId: 228265, enchantId: CRUSADER }, // Brutality Blade
      },
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: STRENGTH_CONSUMABLES,
      equipment: {
        // Dodge, defense skill and threat: the one Warrior row that spends
        // nothing on damage.
        ...withEnchants(SHARED_ARMOUR, PROTECTION_WARRIOR_ENCHANTS),
        mainHand: { itemId: 228265, enchantId: CRUSADER }, // Brutality Blade
        shield: { itemId: 19321 }, // The Immovable Object
      },
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
      consumables: AGILITY_CONSUMABLES,
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_DAGGERS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
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
      consumables: AGILITY_CONSUMABLES,
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_SWORDS },
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
      consumables: AGILITY_CONSUMABLES,
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_DAGGERS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'rogue_hemo',
    label: 'Hemo',
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
        name: 'Hemo',
        race: 'undead',
        characterClass: 'rogue',
        level: 60,
        combatStyle: 'dual_wield',
        stance: 'battle',
      },
      talents: { ...ROGUE_HEMO_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: AGILITY_CONSUMABLES,
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_DAGGERS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
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
       * THE ONE PRESET THAT IS NOT ON `PRESET_RAID_BUFFS`. It takes the Moonkin
       * Form talent, which grants Moonkin Aura, and that is "exclusive with"
       * Leader of the Pack by both tooltips and by the owner's ruling. Its crit
       * is +3% from its own talent instead of +3% from the raid, so the figure
       * does not move -- which is the check that this is a correctness change
       * and not a buff.
       */
      raidBuffs: [...MOONKIN_RAID_BUFFS],
      consumables: casterConsumables('school_arcane'),
      equipment: { ...DRUID_MOONKIN_GEAR },
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
      consumables: STRENGTH_CONSUMABLES,
      equipment: { ...DRUID_CAT_GEAR },
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: STRENGTH_CONSUMABLES,
      equipment: { ...DRUID_BEAR_GEAR },
      /*
       * THE ONE DRUID PROFILE THAT IS HIT BACK, which is the whole point of
       * Bear Form: rage is earned by taking damage as well as dealing it, and
       * Natural Reaction, Primal Fury and Demoralizing Roar are all inert
       * against a target that never swings.
       */
      encounter: { ...createDefaultProfile().encounter, targetAttacks: true },
    }),
  },
  {
    id: 'shaman_elemental',
    label: 'Ele Shaman',
    detail: 'Troll, caster, standing target. 38 Elemental / 13 Enhancement',
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
      equipment: { ...SHAMAN_ELEMENTAL_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'shaman_enhancement',
    label: 'Enh Shaman',
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
       * WINDFURY TOTEM IS NOT SELECTED, and it is the only preset that drops
       * it. The imbue this build casts says so itself: "when applied to main
       * hand, disables any benefit you personally receive from Windfury
       * Totem." Ticking both would pay a Shaman twice for one effect, and the
       * bigger of the two is the one it casts.
       */
      raidBuffs: PRESET_RAID_BUFFS.filter((id) => id !== 'windfury_totem'),
      consumables: hybridConsumables({
        school: 'school_fire',
        meleeWeaponEffect: true,
        blastedLands: 'blasted_strength',
      }),
      equipment: { ...SHAMAN_ENHANCEMENT_GEAR },
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
      equipment: { ...MAGE_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_arcane',
    label: 'Arcane',
    detail: 'Gnome, caster, standing target. 47 Arcane / 4 Fire',
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
      equipment: { ...MAGE_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_fire',
    label: 'Fire',
    detail: 'Gnome, caster, standing target. 39 Fire / 10 Arcane',
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
      equipment: { ...MAGE_GEAR },
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
      consumables: hybridConsumables({
        school: 'school_holy',
        meleeWeaponEffect: true,
        blastedLands: 'blasted_strength',
      }),
      equipment: { ...PALADIN_RET_GEAR },
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
      consumables: hybridConsumables({
        school: 'school_holy',
        meleeWeaponEffect: false,
        blastedLands: 'blasted_strength',
      }),
      equipment: { ...PALADIN_SHOCKADIN_GEAR },
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      consumables: hybridConsumables({
        school: 'school_holy',
        meleeWeaponEffect: false,
        blastedLands: 'blasted_strength',
      }),
      equipment: { ...PALADIN_PROT_GEAR },
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
      raidBuffs: [...RANGED_HUNTER_RAID_BUFFS],
      consumables: RANGED_HUNTER_CONSUMABLES,
      equipment: { ...HUNTER_ARMOUR_RANGED_CRIT, ...HUNTER_STAT_STICK },
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
      raidBuffs: [...RANGED_HUNTER_RAID_BUFFS],
      consumables: RANGED_HUNTER_CONSUMABLES,
      equipment: { ...HUNTER_ARMOUR_RANGED_CRIT, ...HUNTER_STAT_STICK },
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
      consumables: { ...AGILITY_CONSUMABLES, mana_regen: 'mana_regen_12' },
      equipment: { ...HUNTER_ARMOUR, ...HUNTER_DUAL_WIELD_WEAPONS },
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
      equipment: { ...WARLOCK_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'warlock_firelock',
    label: 'Firelock',
    detail: 'Undead, caster, Succubus sacrificed, standing target. 35 Destruction',
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
      equipment: { ...WARLOCK_GEAR },
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
      equipment: { ...PRIEST_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
];

export const PRESETS_BY_ID: ReadonlyMap<string, ProfilePreset> = new Map(
  PROFILE_PRESETS.map((preset) => [preset.id, preset]),
);
