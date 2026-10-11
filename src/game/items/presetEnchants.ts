import type { EquipmentSlot } from './Item';

/**
 * The enchant each preset wears, slot by slot.
 *
 * ==============================================================================
 * EXTRACTED FROM THE OLD GEAR SETS BEFORE THEY WERE DELETED, because the owner
 * asked for the enchants to stay exactly as they were while the Classic and
 * Season of Discovery items went. They used to live inside each preset's
 * `equipment` block, applied by `withEnchants` over a gear set -- and that set
 * no longer exists, so the loadout had to become a thing of its own or be lost
 * in the deletion.
 *
 * READ OFF THE BUILT PROFILES rather than retyped, so what is here is what the
 * presets actually wore rather than what somebody believed they wore. The ids
 * are `foreverEnchants.ts`'s own, allocated by position from 900,000 -- except
 * 20034 (Crusader) and 22749 (Weapon Spell Power), which are real Wowhead
 * spell ids because those two were SCRAPED and the other 28 are the owner's
 * table.
 *
 * A SLOT THE BENCHMARK SET DOES NOT FILL SIMPLY LOSES ITS ENCHANT -- the four
 * Hunters' `ranged` is the only one, and they keep it because the benchmark
 * gives them a bow.
 *
 * IT LIVES IN `game/items/` RATHER THAN IN `profiles/presets.ts`, WHICH IS AN
 * ARCHITECTURE POINT AND NOT A TIDYING ONE. Two layers need it: a PRESET wears
 * a loadout, and so does a character created FROM SCRATCH -- and `game` may
 * not import from `profiles`, so a table in `presets.ts` is one the Gear panel
 * cannot reach. `startingEquipmentFor` silently stopped enchanting anything
 * when the old gear sets were deleted, which is worth +2.4 to +53.7 DPS a
 * character and showed up as nothing at all.
 * ==============================================================================
 */
export const PRESET_ENCHANTS: Readonly<
  Record<string, Readonly<Partial<Record<EquipmentSlot, number>>>>
> = {
  two_hand_arms: { chest: 900015, cloak: 900011, feet: 900025, gloves: 900021, head: 900005, legs: 900005, neck: 900008, twoHand: 20034, wrists: 900017 },
  dw_fury: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900021, head: 900005, legs: 900005, mainHand: 20034, neck: 900008, offHand: 20034, wrists: 900017 },
  prot_warr: { chest: 900015, cloak: 900001, feet: 900025, gloves: 900024, head: 900001, legs: 900001, mainHand: 20034, neck: 900012, wrists: 900016 },
  rogue_venom: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_combat: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_rupture: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_hemo: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  druid_moonkin: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  druid_cat: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, wrists: 900019 },
  druid_bear: { chest: 900015, cloak: 900001, feet: 900025, gloves: 900022, head: 900001, legs: 900001, neck: 900011, wrists: 900019 },
  shaman_elemental: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, mainHand: 22749, neck: 900009, wrists: 900018 },
  shaman_enhancement: { chest: 900015, cloak: 900011, feet: 900025, gloves: 900021, head: 900005, legs: 900005, neck: 900008, twoHand: 20034, wrists: 900017 },
  mage_frostfire: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  mage_arcane: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  mage_fire: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  pally_ret: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900002, head: 900002, legs: 900002, neck: 900008, twoHand: 20034, wrists: 900017 },
  pally_shockadin: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900023, head: 900005, legs: 900005, mainHand: 20034, neck: 900008, wrists: 900018 },
  prot_pally: { chest: 900015, cloak: 900001, feet: 900027, gloves: 900023, head: 900001, legs: 900001, mainHand: 20034, neck: 900012, wrists: 900016 },
  bm_hunter: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, ranged: 900028, wrists: 900019 },
  lw_ranged: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, ranged: 900028, wrists: 900019 },
  lw_melee: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  hawk_melee: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  warlock_smds: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  warlock_firelock: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
  shadow_priest: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 22749, wrists: 900018 },
};
