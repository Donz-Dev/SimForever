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
];

export const PRESETS_BY_ID: ReadonlyMap<string, ProfilePreset> = new Map(
  PROFILE_PRESETS.map((preset) => [preset.id, preset]),
);
