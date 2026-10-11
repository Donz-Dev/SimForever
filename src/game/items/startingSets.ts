import type { ClassId, CombatStyleId } from '../character';
import type { Equipment } from './Item';
import {
  BENCHMARK_TEMPLATES,
  benchmarkEquipmentFor,
  type BenchmarkSetId,
} from './benchmarkSets';
import { PRESET_ENCHANTS } from './presetEnchants';

/**
 * The gear a character starts with, which is now a BENCHMARK SET.
 *
 * ==============================================================================
 * THE CLASSIC AND SEASON OF DISCOVERY SETS ARE GONE, on the ruleset owner's
 * instruction: "they were just random templates of items that won't exist
 * 1-to-1 in Forever". `src/data/items/` holds Forever's own items only, and
 * the 151 stand-ins that used to furnish every preset went with them.
 *
 * WHAT REPLACED THEM is the E65 benchmark set -- generated from the
 * itemization budget at item level 65 epic, targeting the build's hit cap and
 * its preferred stats. Every build therefore starts at the same item level,
 * which the old sets never managed: they ran from item level 66 to 88 and were
 * distributed unevenly between classes, so part of any gap between two presets
 * was a gap in their gear.
 *
 * THE FUNCTION KEPT ITS NAME AND SHAPE DELIBERATELY. Twenty-three test files
 * call `startingEquipmentFor` to furnish a realistic character, and none of
 * them cares WHICH realistic character -- rewriting all of them to say
 * `benchmarkEquipmentFor` would have been twenty-three chances to change what
 * a test was measuring while claiming to move a gear set.
 * ==============================================================================
 */

/**
 * Which template furnishes a bare class and style.
 *
 * ----------------------------------------------------------------------------
 * A BENCHMARK TEMPLATE IS PER PROFILE and this function is handed a CLASS and a
 * STYLE, which is less: four Rogue builds share one class and one style and
 * differ in their weapons and their rotations. So one representative is picked
 * per (class, style), and `isTank` separates the two Paladin shield builds the
 * way `isTankBuild` already does elsewhere -- Protection wants stamina and
 * defense, the Shockadin wants spell power.
 * ----------------------------------------------------------------------------
 */
const REPRESENTATIVE: Readonly<Record<string, string>> = {
  'warrior|two_hander': 'two_hand_arms',
  'warrior|dual_wield': 'dw_fury',
  'warrior|one_hand_shield': 'prot_warr',
  'rogue|dual_wield': 'rogue_venom',
  'druid|moonkin': 'druid_moonkin',
  'druid|cat': 'druid_cat',
  'druid|bear': 'druid_bear',
  'druid|caster': 'druid_moonkin',
  'shaman|caster': 'shaman_elemental',
  'shaman|two_hander': 'shaman_enhancement',
  'shaman|dual_wield': 'shaman_enhancement',
  'mage|caster': 'mage_fire',
  'paladin|two_hander': 'pally_ret',
  /*
   * THE SHOCKADIN IS THE DEFAULT SHIELD PALADIN, not Protection, and this read
   * `prot_pally` -- which made `SHIELD_TANK` below a no-op and gave a
   * from-scratch Paladin a tank's stat line whether or not anything was hitting
   * it. The two are separated by the ENCOUNTER, so the damage build has to be
   * the one here and the tank the override.
   */
  'paladin|one_hand_shield': 'pally_shockadin',
  'paladin|caster': 'pally_shockadin',
  'hunter|ranged': 'bm_hunter',
  'hunter|dual_wield': 'lw_melee',
  'hunter|two_hander': 'bm_hunter',
  'warlock|caster': 'warlock_smds',
  'priest|caster': 'shadow_priest',
};

/** The Shockadin and the Protection Paladin share a class and a style. */
const SHIELD_TANK: Readonly<Record<string, string>> = {
  'paladin|one_hand_shield': 'prot_pally',
  'warrior|one_hand_shield': 'prot_warr',
};

export interface StartingSetOptions {
  /** Whether the target swings back, which picks between two shield builds. */
  readonly targetAttacks?: boolean;
  /** Which benchmark set to install. E65 unless a caller says otherwise. */
  readonly set?: BenchmarkSetId;
}

/** Whether this class has a starting set at all. Every one of the nine does. */
export function hasStartingEquipment(characterClass: ClassId): boolean {
  return BENCHMARK_TEMPLATES.some((template) =>
    template.presetId.startsWith(characterClass.slice(0, 3)),
  )
    ? true
    : Object.keys(REPRESENTATIVE).some((key) => key.startsWith(`${characterClass}|`));
}

/** The equipment a freshly created character of this class and style wears. */
export function startingEquipmentFor(
  characterClass: ClassId,
  style: CombatStyleId,
  options: StartingSetOptions = {},
): Equipment {
  const key = `${characterClass}|${style}`;
  const tank = options.targetAttacks === true ? SHIELD_TANK[key] : undefined;
  const presetId = tank ?? REPRESENTATIVE[key];
  if (!presetId) return {};
  const gear = benchmarkEquipmentFor(presetId, options.set ?? 'E65');
  if (!gear) return {};

  /*
   * ENCHANTED, AS IT ALWAYS WAS, AND IT STOPPED BEING FOR A COMMIT.
   *
   * --------------------------------------------------------------------------
   * The old curated sets carried their enchants inside them -- the tank set's
   * main hand was Brutality Blade WITH Crusader -- so a character created from
   * scratch arrived enchanted. Deleting those sets took the enchants with them
   * and left this function handing back bare gear: worth **+2.4 to +53.7 DPS**,
   * the figures `enchants.test.ts` records, lost with nothing on screen to say
   * so. A preset kept its loadout because `withBenchmarkGear` re-applies one;
   * nothing re-applied it here.
   *
   * THE SAME TABLE AS THE PRESETS USE, which is why it lives in `game/items/`.
   * A character created as a Warrior and a Warrior preset should be wearing the
   * same enchants, and two copies of that table would be two things to drift.
   *
   * ONLY THE SLOTS THE SET ACTUALLY FILLS, so a loadout naming a slot this
   * build does not use -- a `ranged` row on a melee Hunter -- is dropped rather
   * than producing an enchant hanging off nothing.
   * --------------------------------------------------------------------------
   */
  const loadout = PRESET_ENCHANTS[presetId] ?? {};
  const enchanted: Record<string, { itemId: number; enchantId?: number }> = {};
  for (const [slot, equipped] of Object.entries(gear)) {
    if (!equipped) continue;
    const enchantId = loadout[slot as keyof typeof loadout];
    enchanted[slot] =
      enchantId === undefined
        ? { itemId: equipped.itemId }
        : { itemId: equipped.itemId, enchantId };
  }
  return enchanted as Equipment;
}
