import type { AplList } from './apl';
import type { ClassId } from '../character';
import { DRUID_BEAR, DRUID_CAT, DRUID_MOONKIN } from './druid';
import {
  HUNTER_BEAST_MASTERY,
  HUNTER_HAWK_MELEE,
  HUNTER_LONE_WOLF_MELEE,
  HUNTER_LONE_WOLF_RANGED,
} from './hunter';
import { MAGE_ARCANE, MAGE_FIRE, MAGE_FROSTFIRE } from './mage';
import {
  PALADIN_PROTECTION,
  PALADIN_RETRIBUTION,
  PALADIN_SHOCKADIN,
} from './paladin';
import { PET_PRIORITY } from './pet';
import { PRIEST_SHADOW } from './priest';
import { ROGUE_COMBAT, ROGUE_HEMO, ROGUE_RUPTURE, ROGUE_VENOM } from './rogue';
import { SHAMAN_ELEMENTAL, SHAMAN_ENHANCEMENT } from './shaman';
import { WARLOCK_AFFLICTION, WARLOCK_DESTRUCTION } from './warlock';
import {
  WARRIOR_BATTLE,
  WARRIOR_DUAL_WIELD_BERSERKER,
  WARRIOR_SHIELD,
  WARRIOR_SHIELD_DEFENSIVE,
  WARRIOR_TWO_HAND_BATTLE,
} from './warrior';

/*
 * ============================================================================
 * EVERY ACTION PRIORITY LIST IN THE PROJECT, IN ONE PLACE.
 *
 * ----------------------------------------------------------------------------
 * THIS EXISTS BECAUSE THE TEST THAT CHECKS THE LISTS ONLY CHECKED FOUR OF THEM.
 *
 * `rotationIds.test.ts` was written the day a Protection entry was found asking
 * for `rend` when the ability is `rend_cast` -- an id `PriorityRotation` skips
 * in silence, so the entry could never fire at any position, at any rage, with
 * any talents. It enumerated the Warrior's lists by hand, and by the time nine
 * classes existed it was checking FOUR of twenty-six: not the Warrior's own
 * two-handed list, and not one entry belonging to any other class.
 *
 * A hand-written list of lists decays exactly this way, so this one is checked
 * against the source files rather than trusted: `rotationIds.test.ts` reads
 * every `src/game/rotations/*.ts` and fails if it exports a list this registry
 * does not carry. That is the same structural argument
 * `classRegistration.test.ts` makes about a class's four registries -- the
 * failure mode of a missing entry is silence, so the coverage has to be
 * derived rather than remembered.
 * ----------------------------------------------------------------------------
 *
 * WHO ELSE READS IT. `tools/measure_profiles.ts` uses it to answer the one
 * question APL work always asks first -- did every entry in this list actually
 * fire -- which needs the ENTRIES and not the wrapped `Rotation`, whose
 * `PriorityRotation` keeps them private on purpose.
 *
 * ORDER IS THE ORDER THE LIST IS WALKED and is load-bearing. Nothing here
 * sorts it.
 * ============================================================================
 */

export interface PriorityListRecord {
  /** The constant's own name, so a failure names the thing to open. */
  readonly name: string;
  /**
   * Whose ability book the ids must resolve in.
   *
   * `'pet'` rather than a `ClassId`, because a pet's abilities are its own
   * three and belong to no class -- a Hunter cannot cast Claw.
   */
  readonly owner: ClassId | 'pet';
  /**
   * The list itself, which now CARRIES its own name.
   *
   * ------------------------------------------------------------------------
   * `rotationName` USED TO BE A SEPARATE FIELD HERE and is gone, because a
   * list is data now and names itself -- `list.name` is what `compileRotation`
   * hands the `PriorityRotation`, so the registry and the results page cannot
   * disagree about what a list is called. It was written out on purpose when
   * the only alternative was reading it off a compiled rotation, and that
   * reason expired with this format.
   *
   * What it was FOR has not changed and is still the point of this registry:
   * pinning WHICH LIST EACH PROFILE RUNS. A Warrior's depends on style and
   * stance, a Mage's on points spent, and the Shockadin profile spent its
   * whole life running a list built around a talent it does not take.
   * ------------------------------------------------------------------------
   */
  readonly list: AplList;
  /**
   * Which of the 25 profiles runs it, by preset id, or `[]` for a list no
   * preset reaches.
   *
   * TWO LISTS ARE REACHED BY NO PROFILE, and they are not dead code: they are
   * `warriorRotation`'s fallbacks for a Warrior whose style and stance match
   * none of the three specific cases. A Warrior in Battle Stance with a
   * shield, or dual-wielding, is a character the app can build and no preset
   * offers. Say so here rather than deleting them or letting them read as
   * profiles nobody measured.
   */
  readonly profiles: readonly string[];
}

export const ALL_PRIORITY_LISTS: readonly PriorityListRecord[] = [
  // Warrior -- by style AND stance, the only class where stance picks a list.
  {
    name: 'WARRIOR_TWO_HAND_BATTLE',
    owner: 'warrior',
    list: WARRIOR_TWO_HAND_BATTLE,
    profiles: ['two_hand_arms'],
  },
  {
    name: 'WARRIOR_DUAL_WIELD_BERSERKER',
    owner: 'warrior',
    list: WARRIOR_DUAL_WIELD_BERSERKER,
    profiles: ['dw_fury'],
  },
  {
    name: 'WARRIOR_SHIELD_DEFENSIVE',
    owner: 'warrior',
    list: WARRIOR_SHIELD_DEFENSIVE,
    profiles: ['prot_warr'],
  },
  {
    name: 'WARRIOR_BATTLE',
    owner: 'warrior',
    list: WARRIOR_BATTLE,
    profiles: [],
  },
  {
    name: 'WARRIOR_SHIELD',
    owner: 'warrior',
    list: WARRIOR_SHIELD,
    profiles: [],
  },

  // Rogue -- by capstone. Dual-wield in every spec, so style cannot separate them.
  {
    name: 'ROGUE_VENOM',
    owner: 'rogue',
    list: ROGUE_VENOM,
    profiles: ['rogue_venom'],
  },
  {
    name: 'ROGUE_COMBAT',
    owner: 'rogue',
    list: ROGUE_COMBAT,
    profiles: ['rogue_combat'],
  },
  {
    name: 'ROGUE_RUPTURE',
    owner: 'rogue',
    list: ROGUE_RUPTURE,
    profiles: ['rogue_rupture'],
  },
  {
    name: 'ROGUE_HEMO',
    owner: 'rogue',
    list: ROGUE_HEMO,
    profiles: ['rogue_hemo'],
  },

  // Druid -- by form, which IS the combat style.
  {
    name: 'DRUID_MOONKIN',
    owner: 'druid',
    list: DRUID_MOONKIN,
    profiles: ['druid_moonkin'],
  },
  {
    name: 'DRUID_CAT',
    owner: 'druid',
    list: DRUID_CAT,
    profiles: ['druid_cat'],
  },
  {
    name: 'DRUID_BEAR',
    owner: 'druid',
    list: DRUID_BEAR,
    profiles: ['druid_bear'],
  },

  // Shaman -- by style, a caster against a two-hander.
  {
    name: 'SHAMAN_ELEMENTAL',
    owner: 'shaman',
    list: SHAMAN_ELEMENTAL,
    profiles: ['shaman_elemental'],
  },
  {
    name: 'SHAMAN_ENHANCEMENT',
    owner: 'shaman',
    list: SHAMAN_ENHANCEMENT,
    profiles: ['shaman_enhancement'],
  },

  // Mage -- by POINTS SPENT, because all three builds are `caster`.
  {
    name: 'MAGE_FIRE',
    owner: 'mage',
    list: MAGE_FIRE,
    profiles: ['mage_fire'],
  },
  {
    name: 'MAGE_FROSTFIRE',
    owner: 'mage',
    list: MAGE_FROSTFIRE,
    profiles: ['mage_frostfire'],
  },
  {
    name: 'MAGE_ARCANE',
    owner: 'mage',
    list: MAGE_ARCANE,
    profiles: ['mage_arcane'],
  },

  // Paladin -- by capstone.
  {
    name: 'PALADIN_RETRIBUTION',
    owner: 'paladin',
    list: PALADIN_RETRIBUTION,
    profiles: ['pally_ret'],
  },
  {
    name: 'PALADIN_SHOCKADIN',
    owner: 'paladin',
    list: PALADIN_SHOCKADIN,
    profiles: ['pally_shockadin'],
  },
  {
    name: 'PALADIN_PROTECTION',
    owner: 'paladin',
    list: PALADIN_PROTECTION,
    profiles: ['prot_pally'],
  },

  // Hunter -- by capstone AND style, because both Lone Wolf builds share a tree.
  {
    name: 'HUNTER_BEAST_MASTERY',
    owner: 'hunter',
    list: HUNTER_BEAST_MASTERY,
    profiles: ['bm_hunter'],
  },
  {
    name: 'HUNTER_LONE_WOLF_RANGED',
    owner: 'hunter',
    list: HUNTER_LONE_WOLF_RANGED,
    profiles: ['lw_ranged'],
  },
  {
    name: 'HUNTER_LONE_WOLF_MELEE',
    owner: 'hunter',
    list: HUNTER_LONE_WOLF_MELEE,
    profiles: ['lw_melee'],
  },
  {
    name: 'HUNTER_HAWK_MELEE',
    owner: 'hunter',
    list: HUNTER_HAWK_MELEE,
    profiles: ['hawk_melee'],
  },

  // Warlock -- by capstone. 51 points cannot reach both Wrack and Incinerate.
  {
    name: 'WARLOCK_AFFLICTION',
    owner: 'warlock',
    list: WARLOCK_AFFLICTION,
    profiles: ['warlock_smds'],
  },
  {
    name: 'WARLOCK_DESTRUCTION',
    owner: 'warlock',
    list: WARLOCK_DESTRUCTION,
    profiles: ['warlock_firelock'],
  },

  // Priest -- one profile, one list.
  {
    name: 'PRIEST_SHADOW',
    owner: 'priest',
    list: PRIEST_SHADOW,
    profiles: ['shadow_priest'],
  },

  /*
   * And the pet's, which runs on the BM Hunter's PET rather than on the
   * Hunter. It is the one list whose owner is not a class: a Hunter cannot
   * cast Claw.
   */
  {
    name: 'PET_PRIORITY',
    owner: 'pet',
    list: PET_PRIORITY,
    profiles: ['bm_hunter'],
  },
];
