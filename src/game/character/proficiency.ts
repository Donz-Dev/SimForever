import type { ClassId } from './ids';
import { CLASS_IDS } from './ids';

/**
 * WHAT EACH CLASS MAY EQUIP. The ruleset owner's own table, transcribed whole.
 *
 * ==============================================================================
 * THE SOURCE IS THE OWNER, NOT CLASSIC, AND THE DIFFERENCE IS NOT COSMETIC.
 *
 * Nothing in this project's six data sources states a proficiency -- not the
 * spellbook captures, not `talentsforever.com`, not `foreverchanges.pro` -- so
 * the honest options were to borrow Classic's table behind a `PLACEHOLDER_`
 * name or to ask. Asking got the whole thing in one message, and **three rows
 * disagree with Classic**:
 *
 *   - a ROGUE may use a ONE-HANDED AXE. Classic's rogue cannot, until
 *     The Burning Crusade.
 *   - a DRUID may NOT use a DAGGER. Classic's druid can.
 *   - a HUNTER may use a TWO-HANDED AXE and a POLEARM and NOT a mace of
 *     either size, which is Classic's rule and is the one that reads wrong.
 *
 * So a table copied from Classic would have been wrong in both directions on
 * the very class the owner used as their example. **This is the fourth time
 * asking has beaten inferring**, and it cost one question.
 *
 * ------------------------------------------------------------------------------
 * `block` AND `parry` ARE IN THE OWNER'S TABLE AND ARE NOT EQUIP FILTERS.
 *
 * They are columns of the same table, so they are transcribed with the rest
 * rather than dropped -- a transcription that silently omits two of
 * twenty-seven columns is a transcription nobody can check against the source.
 * `canEquip` never reads them. They are here for whatever asks next, and
 * `proficiency.test.ts` pins them so a reader can diff this file against the
 * owner's spreadsheet row by row.
 *
 * `feral_combat` is the same: a Druid-only column with no item behind it.
 * ==============================================================================
 */
export const PROFICIENCIES = [
  // Not equip filters. See above.
  'block',
  'parry',
  // Ranged.
  'bow',
  'gun',
  'crossbow',
  'thrown',
  'wand',
  // Armour.
  'cloth',
  'leather',
  'mail',
  'plate',
  'shield',
  // Melee.
  'dual_wield',
  'dagger',
  'fist',
  'axe_1h',
  'mace_1h',
  'sword_1h',
  'polearm',
  'staff',
  'axe_2h',
  'mace_2h',
  'sword_2h',
  // Relics.
  'totem',
  'libram',
  'idol',
  // Druid only, and not an item.
  'feral_combat',
] as const;

export type Proficiency = (typeof PROFICIENCIES)[number];

/**
 * One row of the owner's table, written as the ids it grants.
 *
 * AS A LIST OF WHAT IS TRUE rather than as 27 booleans, because a boolean row
 * is 27 values in one order and a reordering of `PROFICIENCIES` would silently
 * re-point every one of them. A list says what it means at each entry.
 */
export const CLASS_PROFICIENCIES: Readonly<Record<ClassId, readonly Proficiency[]>> = {
  warrior: [
    'block', 'parry',
    'bow', 'gun', 'crossbow', 'thrown',
    'cloth', 'leather', 'mail', 'plate', 'shield',
    'dual_wield', 'dagger', 'fist', 'axe_1h', 'mace_1h', 'sword_1h',
    'polearm', 'staff', 'axe_2h', 'mace_2h', 'sword_2h',
  ],
  warlock: ['cloth', 'dagger', 'sword_1h', 'staff', 'wand'],
  shaman: [
    'block',
    'cloth', 'leather', 'mail', 'shield',
    'dagger', 'fist', 'axe_1h', 'mace_1h', 'staff', 'axe_2h', 'mace_2h',
    'totem',
  ],
  rogue: [
    'parry',
    'bow', 'gun', 'crossbow', 'thrown',
    'cloth', 'leather',
    // ONE-HANDED AXES, which Classic's rogue cannot use. The owner's table.
    'dual_wield', 'dagger', 'fist', 'axe_1h', 'mace_1h', 'sword_1h',
  ],
  priest: ['cloth', 'dagger', 'mace_1h', 'staff', 'wand'],
  paladin: [
    'block', 'parry',
    'cloth', 'leather', 'mail', 'plate', 'shield',
    'axe_1h', 'mace_1h', 'sword_1h', 'polearm', 'axe_2h', 'mace_2h', 'sword_2h',
    'libram',
  ],
  mage: ['cloth', 'dagger', 'sword_1h', 'staff', 'wand'],
  hunter: [
    'parry',
    'bow', 'gun', 'crossbow', 'thrown',
    'cloth', 'leather', 'mail',
    'dual_wield', 'dagger', 'fist', 'axe_1h', 'sword_1h',
    'polearm', 'staff', 'axe_2h', 'sword_2h',
  ],
  druid: [
    'cloth', 'leather',
    // NO DAGGER, which Classic's druid has. The owner's table.
    'fist', 'mace_1h', 'polearm', 'staff', 'mace_2h',
    'idol', 'feral_combat',
  ],
};

const SETS = new Map<ClassId, ReadonlySet<Proficiency>>(
  CLASS_IDS.map((id) => [id, new Set(CLASS_PROFICIENCIES[id])] as const),
);

export function hasProficiency(characterClass: ClassId, proficiency: Proficiency): boolean {
  return SETS.get(characterClass)?.has(proficiency) ?? false;
}

/**
 * The proficiency an item demands, from the source's own two words for it.
 *
 * ------------------------------------------------------------------------------
 * IT TAKES BOTH, because neither alone is enough. The capture's `subclass` says
 * "Axe" and says nothing about which hand, and the owner's table has separate
 * columns for a one-handed and a two-handed axe -- so a Hunter, who may use a
 * two-handed axe and may not use a mace of either size, needs both halves of
 * the answer. `inventoryType` supplies the hand.
 *
 * AND `subclass` IS NULL FOR A WHOLE CLASS OF ITEMS: every ring, neck,
 * trinket, held-off-hand and the one Thrown weapon. All but the thrown weapon
 * are unrestricted, and the thrown weapon is found by its inventory type --
 * which is why this reads the type FIRST.
 *
 * `undefined` MEANS ANYONE MAY EQUIP IT, and is the answer for jewellery, for
 * a cloak, and for an item whose words this does not recognise. **The default
 * is permissive on purpose**: a filter that hides an item nobody can explain
 * is worse than one that shows it, because a hidden item leaves nothing behind
 * to notice. `itemVocabulary.test.ts`'s argument, applied to a different file.
 * ------------------------------------------------------------------------------
 */
export function proficiencyForItem(
  inventoryType: string,
  subclass: string | undefined,
  /**
   * ARMOUR CLASS APPLIES TO THE EIGHT ARMOUR SLOTS AND NOT TO A CLOAK.
   *
   * Every cloak in the data carries the subclass "Cloth" -- all 44 of them --
   * and a Warrior wears one. Reading the subclass without asking which slot it
   * is for would have left eight classes with no back slot at all, and it
   * would have looked exactly like a correct filter.
   */
  isArmourSlot: boolean,
): Proficiency | undefined {
  // A thrown weapon: `subclass` is null, so the type is the only thing to read.
  if (inventoryType === 'Thrown') return 'thrown';
  if (subclass === undefined || subclass === null) return undefined;

  switch (subclass) {
    case 'Cloth':
    case 'Leather':
    case 'Mail':
    case 'Plate':
      return isArmourSlot ? (subclass.toLowerCase() as Proficiency) : undefined;
    case 'Shield':
      return 'shield';
    case 'Bow':
      return 'bow';
    case 'Gun':
      return 'gun';
    case 'Crossbow':
      return 'crossbow';
    case 'Wand':
      return 'wand';
    case 'Dagger':
      return 'dagger';
    case 'Fist Weapon':
      return 'fist';
    case 'Staff':
      return 'staff';
    case 'Polearm':
      return 'polearm';
    case 'Axe':
      return inventoryType === 'Two-Hand' ? 'axe_2h' : 'axe_1h';
    case 'Mace':
      return inventoryType === 'Two-Hand' ? 'mace_2h' : 'mace_1h';
    case 'Sword':
      return inventoryType === 'Two-Hand' ? 'sword_2h' : 'sword_1h';
    case 'Totem':
      return 'totem';
    case 'Libram':
      return 'libram';
    case 'Idol':
      return 'idol';
    default:
      // "Cosmetic", and anything a future capture adds. Permissive, and the
      // vocabulary tool is what reports a shape nobody has taught this about.
      return undefined;
  }
}
