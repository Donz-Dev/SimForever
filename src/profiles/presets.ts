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

/** Crusader, the only weapon enchant in the item data. */
const CRUSADER = 20034;

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

/**
 * A GEAR SHELL, and said to be one.
 *
 * The item data holds nineteen Classic stand-ins curated for a Warrior, and
 * nothing in it is leather, a dagger or a Rogue's. These three carry the same
 * armour the Warrior presets do, so a Rogue has stats at all, and Brutality
 * Blade in each hand because it is the only one-hander there is.
 *
 * WHICH MAKES BACKSTAB AND MUTILATE UNCASTABLE: both require daggers, and
 * their own `canCast` refuses rather than pretending. The Venom build is the
 * one this costs -- it falls back to Sinister Strike, which is exactly what
 * its priority list is written to do.
 */
const ROGUE_WEAPONS: Equipment = {
  mainHand: { itemId: 228265, enchantId: CRUSADER },
  offHand: { itemId: 228265, enchantId: CRUSADER },
};


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
 * A GEAR SHELL for the Druid, and a thinner one than the Rogue's.
 *
 * Nothing in the item data is leather, a staff or an idol. These carry the
 * shared armour so a Druid has stats at all, and ONE weapon rather than two --
 * a Druid holds a two-hander or a one-hander and never dual-wields.
 *
 * IT MATTERS LESS THAN IT LOOKS. Cat and Bear are `damageSource: 'natural'`:
 * they swing paws, and the equipped weapon is a stat stick whatever it is.
 * Moonkin never auto-attacks at all. So the wrong weapon costs these three far
 * less than it costs a Warrior.
 */
const DRUID_WEAPONS: Equipment = {
  twoHand: { itemId: 228229, enchantId: CRUSADER },
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
 * A GEAR SHELL, and said to be one.
 *
 * The item data is nineteen Classic stand-ins curated for a Warrior and holds
 * nothing mail, no shield and no caster weapon. Both Shaman profiles therefore
 * carry the Warrior's plate, so they have stats at all, and Obsidian Edged
 * Blade -- the only two-hander there is.
 *
 * WHICH SUITS ENHANCEMENT AND MISLEADS NOBODY ABOUT ELEMENTAL. A 3.6-second
 * two-hander is exactly what Windfury Weapon wants, because a proc pays two
 * full extra swings whatever the speed. Elemental holds the same blade as a
 * STAT STICK and never swings it, and its `spellPower` reads zero for the same
 * reason a Moonkin's does: there is no caster item in the data to equip.
 */
const SHAMAN_WEAPONS: Equipment = {
  twoHand: { itemId: 228229, enchantId: CRUSADER },
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
 * A GEAR SHELL, and said to be one.
 *
 * The item data is nineteen Classic stand-ins curated for a Warrior. There is
 * no cloth in it, no staff and no caster weapon of any kind, so all three Mage
 * profiles carry the Warrior's plate and hold Obsidian Edged Blade as a STAT
 * STICK they never swing -- `caster` has no auto-attack at all.
 *
 * WHICH MEANS `spellPower` READS ZERO, for the third class running. A Mage
 * figure here is a FLOOR rather than an estimate, and for the same two reasons
 * the Moonkin and the Elemental shaman are: no caster item, and no spell power
 * coefficient in Forever's spell data to multiply even if there were.
 */
const MAGE_WEAPONS: Equipment = {
  twoHand: { itemId: 228229, enchantId: CRUSADER },
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
      equipment: { ...SHARED_ARMOUR, ...ROGUE_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...ROGUE_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...ROGUE_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...DRUID_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...DRUID_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...DRUID_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...SHAMAN_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...SHAMAN_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...MAGE_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...MAGE_WEAPONS },
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
      equipment: { ...SHARED_ARMOUR, ...MAGE_WEAPONS },
      encounter: { ...createDefaultProfile().encounter, targetAttacks: false },
    }),
  },
];

export const PRESETS_BY_ID: ReadonlyMap<string, ProfilePreset> = new Map(
  PROFILE_PRESETS.map((preset) => [preset.id, preset]),
);
