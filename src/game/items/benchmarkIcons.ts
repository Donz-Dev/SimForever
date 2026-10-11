import type { ArmourClass } from './benchmarkGear';

/**
 * AN ICON FOR EVERY BENCHMARK PIECE, so a template set does not read as broken.
 *
 * ==============================================================================
 * THE OWNER'S INSTRUCTION: "just pick an icon that makes sense, assign it, and
 * stick to it across the 4 sets for that slot. That way the user isn't
 * inundated with question marks and something feels wrong."
 *
 * Every generated item used to carry `inv_misc_questionmark`, which is the
 * client's own "this icon is missing" placeholder -- so a character pane full
 * of benchmark gear looked like a rendering fault rather than like a set.
 *
 * ------------------------------------------------------------------------------
 * EVERY NAME HERE IS ONE A REAL ITEM IN THE DATABASE USES, which is the whole
 * reason this table was not written from memory. The icons are fetched from
 * `wow.zamimg.com` by file name; a name that does not exist there renders as a
 * BROKEN IMAGE, which is worse than the question mark it replaced and would
 * only show up in a browser. Choosing from icons the capture already references
 * makes "does this file exist" a property of the data rather than of my
 * recollection, and `benchmarkIcons.test.ts` asserts it for all 41 entries.
 *
 * THEY WERE PICKED AS THE COMMONEST ICON for that slot and armour class among
 * the real items, with ties broken towards keeping the four armour classes
 * DISTINCT: real data gives leather and mail the same helmet, and two sets
 * that look identical in a character pane defeat the point of having icons.
 *
 * ONE PER (SLOT, ARMOUR CLASS) AND PER WEAPON TYPE, and the same one at every
 * item level -- so B55, E65, E75 and E85 differ in their numbers and not in
 * their appearance, which is what the owner asked for.
 * ==============================================================================
 */

/** The eight armour slots, by the inventory type the generator writes. */
const ARMOUR_ICONS: Readonly<Record<string, Readonly<Record<ArmourClass, string>>>> = {
  Head: {
    Cloth: 'inv_helmet_24',
    Leather: 'inv_helmet_41',
    Mail: 'inv_helmet_09',
    Plate: 'inv_helmet_05',
  },
  Shoulder: {
    Cloth: 'inv_shoulder_02',
    Leather: 'inv_shoulder_07',
    Mail: 'inv_shoulder_29',
    Plate: 'inv_shoulder_20',
  },
  Chest: {
    Cloth: 'inv_chest_cloth_12',
    Leather: 'inv_chest_leather_07',
    Mail: 'inv_chest_chain_11',
    Plate: 'inv_chest_plate03',
  },
  Wrist: {
    Cloth: 'inv_bracer_07',
    Leather: 'inv_bracer_03',
    Mail: 'inv_bracer_16',
    Plate: 'inv_bracer_18',
  },
  Hands: {
    Cloth: 'inv_gauntlets_17',
    Leather: 'inv_gauntlets_25',
    Mail: 'inv_gauntlets_11',
    Plate: 'inv_gauntlets_29',
  },
  Waist: {
    Cloth: 'inv_belt_22',
    Leather: 'inv_belt_06',
    Mail: 'inv_belt_14',
    Plate: 'inv_belt_27',
  },
  Legs: {
    Cloth: 'inv_pants_07',
    Leather: 'inv_pants_06',
    Mail: 'inv_pants_mail_15',
    Plate: 'inv_pants_04',
  },
  Feet: {
    Cloth: 'inv_boots_05',
    Leather: 'inv_boots_08',
    Mail: 'inv_boots_chain_02',
    Plate: 'inv_boots_plate_09',
  },
};

/** Jewellery and the cloak, which have no armour class. */
const PLAIN_ICONS: Readonly<Record<string, string>> = {
  Neck: 'inv_jewelry_necklace_26',
  Back: 'inv_misc_cape_16',
  Finger: 'inv_jewelry_ring_40',
  Trinket: 'inv_misc_rune_06',
};

/** Weapons and shields, by the subclass the generator gives them. */
const WEAPON_ICONS: Readonly<Record<string, string>> = {
  Sword: 'inv_sword_39',
  Axe: 'inv_axe_24',
  Mace: 'inv_mace22',
  Dagger: 'inv_weapon_shortblade_26',
  Staff: 'inv_staff_20',
  Polearm: 'inv_spear_08',
  Bow: 'inv_weapon_bow_12',
  Shield: 'inv_shield_05',
  'Fist Weapon': 'inv_misc_monsterclaw_03',
};

/**
 * Every icon this table can hand out, for the test that checks they all exist.
 *
 * Derived from the three tables rather than listed again, so an entry added to
 * one of them is covered without anybody remembering to add it here -- which
 * is the enumeration-by-hand decay `rotationIds.test.ts` was rewritten for.
 */
export const BENCHMARK_ICONS: readonly string[] = [
  ...Object.values(ARMOUR_ICONS).flatMap((byClass) => Object.values(byClass)),
  ...Object.values(PLAIN_ICONS),
  ...Object.values(WEAPON_ICONS),
];

/**
 * The icon a generated piece carries.
 *
 * FALLS BACK TO THE QUESTION MARK, deliberately, and that is not a cop-out: a
 * slot or subclass this table has not been taught about should look WRONG, the
 * same way an `unmodelled` effect is listed rather than guessed at. The test
 * asserts no real template piece reaches the fallback, so it is visible in the
 * suite rather than only in a browser.
 */
export function benchmarkIcon(
  inventoryType: string,
  subclass: string | null,
  armour: ArmourClass,
): string {
  const weapon = subclass !== null ? WEAPON_ICONS[subclass] : undefined;
  if (weapon) return weapon;

  const byClass = ARMOUR_ICONS[inventoryType];
  if (byClass) return byClass[armour];

  return PLAIN_ICONS[inventoryType] ?? 'inv_misc_questionmark';
}
