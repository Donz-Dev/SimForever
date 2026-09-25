import {
  CRUSADER,
  DRUID_BEAR_GEAR,
  DRUID_CAT_GEAR,
  DRUID_MOONKIN_GEAR,
  HUNTER_ARMOUR,
  HUNTER_MELEE_WEAPONS,
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
} from '../game/items/gearSets';
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
 * cannot be taken alongside it; and neither curse.
 *
 * SUNDER ARMOR IS THE INTERESTING ONE. The target starts at five stacks, so the
 * warrior's own list stops opening every fight by applying five of them and
 * only refreshes what the raid supplied. That was the ruleset owner's reason
 * for adding the list to the presets, and it is a large change to the rage
 * economy rather than a cosmetic one.
 *
 * In catalogue order, so the file matches what `withRaidBuff` writes back and
 * a preset can be compared to a hand-edited profile without a diff.
 * ----------------------------------------------------------------------------
 */
const PRESET_RAID_BUFFS: readonly string[] = [
  'battle_shout',
  'thunder_clap',
  'sunder_armor',
  'power_word_fortitude',
  'divine_spirit',
  'blessing_of_kings',
  'blessing_of_might',
  'faerie_fire',
  'mark_of_the_wild',
  'strength_of_earth_totem',
  'windfury_totem',
  'leader_of_the_pack',
];

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
 * 2H Arms: 38 in Arms, 13 in Fury. Fifty-one exactly.
 *
 * ----------------------------------------------------------------------------
 * THE LAST THREE WENT INTO IMPROVED CLEAVE, which the ruleset owner named when
 * the list as first given came to forty-eight. It was left three short rather
 * than filled in, because choosing where they went would have been inventing a
 * build.
 *
 * IT DOES NOTHING HERE, and that is worth saying rather than leaving to be
 * discovered. Improved Cleave reduces Cleave's rage cost by three, and CLEAVE
 * IS IN NO PRIORITY LIST -- it is an on-next-swing ability for hitting two
 * targets, and every encounter this simulator has is one target. Three points
 * of a real talent that changes no number in a result.
 *
 * It is not the only one: Improved Tactical Mastery's five points retain rage
 * through a stance change, and this list never changes stance after the pull.
 * Both are the owner's choices and both are honoured as given.
 * ----------------------------------------------------------------------------
 */
const TWO_HAND_ARMS_TALENTS: TalentAllocation = {
  // Arms, 38
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_charge: 1,
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
  // Fury, 13
  cruelty: 5,
  unbridled_wrath: 5,
  // Requires ten points in Fury, which the two above supply exactly.
  improved_cleave: 3,
};

/**
 * DW Fury: 18 in Arms, 33 in Fury. Fifty-one exactly.
 *
 * The ruleset owner's list, transcribed. It is a legal allocation as given --
 * every tier is reached and every prerequisite met -- which is checked by a
 * test rather than assumed.
 */
const DW_FURY_TALENTS: TalentAllocation = {
  // Arms, 18
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_tactical_mastery: 5,
  anger_management: 1,
  deep_wounds: 3,
  spearing_strike: 1,
  impale: 2,
  // Fury, 33
  cruelty: 5,
  unbridled_wrath: 5,
  blood_craze: 3,
  boundless_rage: 2,
  dual_wield_specialization: 5,
  raging_blows: 1,
  enrage: 5,
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
  improved_bloodrage: 2,
  last_stand: 1,
  master_of_defense: 2,
  improved_revenge: 3,
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

/** Venom and Rupture: two daggers, which is what those builds are written for. */
/** Combat: two swords, the owner's own second set. */

/**
 * THE THREE DRUID BUILDS, decoded from the owner's URLs. 38/0/13, 9/35/7 and
 * 9/42/0, each exactly 51 points.
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
  savage_fury: 2,
  feral_charge: 1,
  sharpened_claws: 2,
  shredding_attacks: 3,
  predatory_strikes: 3,
  primal_fury: 2,
  predatory_instincts: 2,
  leader_of_the_pack: 1,
  king_of_the_jungle: 3,
  rend_and_tear: 5,
  berserk: 1,
  furor: 5,
  naturalist: 2,
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
  mangle: 1,
  predatory_strikes: 3,
  primal_fury: 2,
  predatory_instincts: 2,
  leader_of_the_pack: 1,
  natural_reaction: 5,
  rend_and_tear: 5,
  berserk: 1,
};

/**
 * THE TWO SHAMAN BUILDS, decoded from the owner's URLs. 38/13/0 and 19/32/0,
 * each exactly 51 points.
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
  call_of_flame: 3,
  elemental_devastation: 3,
  elemental_fury: 5,
  improved_fire_nova: 2,
  call_of_thunder: 1,
  thundering_strikes: 5,
  ancestral_knowledge: 2,
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
  hot_streak: 1,
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
  hot_streak: 1,
  master_of_elements: 1,
  critical_mass: 3,
  blast_wave: 1,
  fire_power: 5,
  combustion: 1,
  elemental_precision: 2,
};

/**
 * THE THREE PALADIN BUILDS, decoded from the owner's URLs. 13/0/38, 23/0/28
 * and 8/36/7, each exactly 51 points.
 *
 * EACH HAS A DIFFERENT CAPSTONE, which is what lets the rotation tell them
 * apart: Twist of Light, Holy Shock and Holy Shield belong to exactly one
 * build each.
 */
const PALADIN_RETRIBUTION_TALENTS: TalentAllocation = {
  improved_holy_strike: 2,
  divine_strength: 5,
  divine_intellect: 3,
  improved_seals: 3,
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  seal_of_command: 1,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  crusade: 2,
  two_handed_weapon_specialization: 3,
  vengeance: 3,
  champion_of_the_light: 3,
  instrument_of_law: 2,
  twist_of_light: 1,
};

const PALADIN_SHOCKADIN_TALENTS: TalentAllocation = {
  improved_holy_strike: 2,
  divine_strength: 3,
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
  sanctified_judgement: 3,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  crusade: 2,
  vengeance: 3,
  champion_of_the_light: 3,
};

const PALADIN_PROTECTION_TALENTS: TalentAllocation = {
  improved_holy_strike: 2,
  divine_strength: 3,
  improved_seals: 3,
  redoubt: 5,
  precision: 3,
  anticipation: 3,
  improved_seal_of_fury: 1,
  improved_righteous_fury: 3,
  shield_specialization: 3,
  sacred_duty: 2,
  swift_judgement: 1,
  one_handed_weapon_specialization: 3,
  templar_s_bulwark: 1,
  reckoning: 5,
  iron_creed: 5,
  holy_shield: 1,
  deflection: 5,
  improved_judgement: 2,
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
const WARLOCK_AFFLICTION_TALENTS: TalentAllocation = {
  suppression: 5,
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
  mental_agility: 3,
  meditation: 3,
  twilight_focus: 3,
  shadow_focus: 5,
  spirit_tap: 5,
  shadow_affinity: 3,
  improved_shadow_word_pain: 2,
  shadow_reach: 2,
  mind_flay: 1,
  improved_mind_flay: 2,
  vampiric_embrace: 1,
  shadow_weaving: 3,
  devouring_contagion: 2,
  darkness: 5,
  shadowform: 1,
};

export const PROFILE_PRESETS: readonly ProfilePreset[] = [
  {
    id: 'two_hand_arms',
    label: '2H Arms',
    detail: 'Orc, two-hander, Battle Stance, standing target',
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
      equipment: {
        ...SHARED_ARMOUR,
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
      equipment: {
        ...SHARED_ARMOUR,
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
      equipment: {
        ...SHARED_ARMOUR,
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
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_DAGGERS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'rogue_combat',
    label: 'Combat',
    detail: 'Orc, dual-wield, standing target. 18 Assassination / 33 Combat',
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
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_SWORDS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'rogue_rupture',
    label: 'Rupture',
    detail: 'Undead, dual-wield, standing target. 31 Subtlety',
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
      equipment: { ...ROGUE_ARMOUR, ...ROGUE_DAGGERS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'druid_moonkin',
    label: 'Moonkin',
    detail: 'Tauren, Moonkin Form, standing target. 38 Balance / 13 Restoration',
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...DRUID_MOONKIN_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'druid_cat',
    label: 'Cat',
    detail: 'Tauren, Cat Form, standing target. 35 Feral Combat',
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
      equipment: { ...DRUID_CAT_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'druid_bear',
    label: 'Bear',
    detail: 'Tauren, Bear Form, target swings back. 42 Feral Combat',
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
      equipment: { ...SHAMAN_ELEMENTAL_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'shaman_enhancement',
    label: 'Enh Shaman',
    detail: 'Tauren, two-hander, standing target. 19 Elemental / 32 Enhancement',
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
      equipment: { ...SHAMAN_ENHANCEMENT_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_frostfire',
    label: 'Frostfire',
    detail: 'Gnome, caster, standing target. 29 Fire / 22 Frost',
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
      equipment: { ...MAGE_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_arcane',
    label: 'Arcane',
    detail: 'Gnome, caster, standing target. 47 Arcane / 4 Fire',
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
      equipment: { ...MAGE_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'mage_fire',
    label: 'Fire',
    detail: 'Gnome, caster, standing target. 39 Fire / 10 Arcane',
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
      equipment: { ...MAGE_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'pally_ret',
    label: 'Seal Twist Ret',
    detail: 'Human, two-hander, standing target. 13 Holy / 38 Retribution',
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
      equipment: { ...PALADIN_RET_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'pally_shockadin',
    label: 'Shockadin',
    detail: 'Human, 1H and a caster shield, standing target. 23 Holy / 28 Retribution',
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
      equipment: { ...PALADIN_SHOCKADIN_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'prot_pally',
    label: 'Prot Pally',
    detail: 'Human, 1H and shield, target swings back. 36 Protection',
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
      equipment: { ...PALADIN_PROT_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: true },
    }),
  },
  {
    id: 'bm_hunter',
    label: 'BM Hunter',
    detail: 'Orc, bow and a Cat, standing target. 31 Beast Mastery',
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...HUNTER_ARMOUR, ...HUNTER_STAT_STICK },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'lw_ranged',
    label: 'LW Ranged',
    detail: 'Orc, bow, no pet, standing target. 39 Marksmanship',
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...HUNTER_ARMOUR, ...HUNTER_STAT_STICK },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'lw_melee',
    label: 'LW Melee',
    detail: 'Orc, two-hander, no pet, standing target. 31 Survival',
    build: () => ({
      ...createDefaultProfile(),
      character: {
        name: 'LW Melee',
        race: 'orc',
        characterClass: 'hunter',
        level: 60,
        combatStyle: 'two_hander',
        stance: 'battle',
      },
      talents: { ...HUNTER_LONE_WOLF_MELEE_TALENTS },
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...HUNTER_ARMOUR, ...HUNTER_MELEE_WEAPONS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'warlock_smds',
    label: 'SM/DS',
    detail: 'Undead, caster, Imp sacrificed, standing target. 40 Affliction',
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...WARLOCK_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'warlock_firelock',
    label: 'Firelock',
    detail: 'Undead, caster, Succubus sacrificed, standing target. 35 Destruction',
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
      raidBuffs: [...PRESET_RAID_BUFFS],
      equipment: { ...WARLOCK_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
  {
    id: 'shadow_priest',
    label: 'Shadow',
    detail: 'Troll, caster, Shadowform, standing target. 32 Shadow',
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
      equipment: { ...PRIEST_GEAR },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
];

export const PRESETS_BY_ID: ReadonlyMap<string, ProfilePreset> = new Map(
  PROFILE_PRESETS.map((preset) => [preset.id, preset]),
);
