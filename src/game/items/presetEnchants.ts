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
  /*
   * THE ONLY SLOT ON THIS BUILD THAT WAS GRANTING NOTHING. Its boots carried
   * MINOR SPEED, which is `unmodelled` -- the engine has no positions -- so the
   * slot was worth literally zero, and +7 Agility measures **+1.72** at 400
   * paired iterations. Stamina is the other option and runs BIT-IDENTICAL
   * fights, which is what says the agility figure is the slot's whole value
   * rather than noise: nothing attacks a damage Warrior.
   *
   * EVERY OTHER SLOT STAYS ON STRENGTH, measured rather than assumed. Plate
   * gives 2 attack power a strength against agility's 1 plus a twentieth of a
   * crit, and agility lost in all four slots that offer the choice -- neck
   * -1.75, wrists -2.20, gloves -2.22, and +1% Haste -2.57 on head or legs.
   */
  two_hand_arms: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900021, head: 900005, legs: 900005, neck: 900008, twoHand: 20034, wrists: 900017 },
  dw_fury: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900021, head: 900005, legs: 900005, mainHand: 20034, neck: 900008, offHand: 20034, wrists: 900017 },
  prot_warr: { chest: 900015, cloak: 900001, feet: 900025, gloves: 900024, head: 900001, legs: 900001, mainHand: 20034, neck: 900012, shield: 900030, wrists: 900016 },
  rogue_venom: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  // The Venom loadout exactly; see `benchmarkSets.ts` for why the two share.
  rogue_combat_mut: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_combat: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_rupture: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  rogue_hemo: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  // The Hemo Dagger loadout exactly; only the main-hand ITEM differs.
  rogue_pure_hemo: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  druid_moonkin: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  druid_cat: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, twoHand: 20034, wrists: 900019 },
  druid_bear: { chest: 900015, cloak: 900001, feet: 900025, gloves: 900022, head: 900001, legs: 900001, neck: 900011, twoHand: 20034, wrists: 900019 },
  shaman_elemental: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, mainHand: 22749, neck: 900009, shield: 900030, wrists: 900018 },
  /*
   * ==========================================================================
   * THE BOOTS GO FROM MINOR SPEED TO +7 AGILITY, worth **+1.9 +/- 1.8** paired
   * over 300 iterations. Small, real, and the ONE free enchant in the six
   * profiles the owner asked to have optimised.
   *
   * Minor Speed is `unmodelled` -- movement, which nothing here has -- so the
   * slot was worth exactly zero, and the feet table offers +7 Agility, which a
   * build that is 61% auto-attack and Windfury reads in full.
   *
   * THE FIVE CASTERS CANNOT DO THE SAME AND IT IS WORTH SAYING WHY. They carry
   * Minor Speed too, and the feet slot offers only Defense Skill, Minor Speed,
   * Agility and Stamina -- **a caster can read none of the four**. Their cloaks
   * are the same story: Dodge, Agility, Armor and Threat. So those two
   * `unmodelled` enchants are dead BY TABLE rather than by choice, and
   * measuring +60 Armor on a Mage at exactly 0.00 is the right answer rather
   * than a variant that failed to apply.
   *
   * EVERYTHING ELSE ON THIS ROW WAS MEASURED AND KEPT. +15 Agility for +15
   * Strength is -1.7, +8 Agility on the head is -1.0, and haste on the head,
   * legs or gloves is noise against an interval of 11 -- so Strength holds
   * every slot that offers it.
   * ==========================================================================
   */
  shaman_enhancement: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900021, head: 900005, legs: 900005, neck: 900008, twoHand: 20034, wrists: 900017 },
  mage_frostfire: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  mage_arcane: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  mage_fire: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  pally_ret: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900002, head: 900002, legs: 900002, neck: 900008, twoHand: 20034, wrists: 900017 },
  /*
   * THE TWO SHOCKADINS SHARE EIGHT SLOTS AND DIFFER ONLY IN THE HANDS, which is
   * what their being two profiles on one gear shape means: the only difference
   * between them is which weapon is held, and the owner has ruled that holding
   * one excludes the other -- "You cannot ever have the stats of both active."
   * So neither row names a slot its own set does not fill.
   *
   * HASTE ON THE HEAD AND LEGS AND SPELL POWER ON THE NECK, which replaces +8
   * Strength twice and +5 Strength once. Neither the head nor the leg slot
   * offers spell power at all -- the options are dodge, haste and the five
   * primaries -- so for a build that is three-quarters Holy the question is
   * which physical line reaches furthest, and haste shortens the swing that
   * carries Seal of Righteousness. Haste and +8 Intellect measured as a TIE at
   * 4,000 paired iterations (+0.4 +/- 1.4 and -0.4 +/- 1.6); both beat +8
   * Strength by two to three.
   *
   * THE GLOVES AND WRISTS KEEP THEIR SPELL POWER, which is the same question
   * answered the other way: +20 Spell Power beats 1% haste by about two, and
   * +16 beats +9 Strength by five.
   *
   * AND THE TWO-HANDER TAKES +65 SPELL POWER, the one enchant only that slot is
   * offered, against Crusader at -17 and the +30 the one-hander wears at -15.
   */
  pally_shockadin: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900023, head: 900002, legs: 900002, mainHand: 22749, neck: 900009, shield: 900030, wrists: 900018 },
  pally_shockadin_2h: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  prot_pally: { chest: 900015, cloak: 900001, feet: 900027, gloves: 900023, head: 900001, legs: 900001, mainHand: 22749, neck: 900012, shield: 900030, wrists: 900016 },
  bm_hunter: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, ranged: 900028, twoHand: 900031, wrists: 900019 },
  lw_ranged: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, neck: 900011, ranged: 900028, twoHand: 900031, wrists: 900019 },
  lw_melee: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  hawk_melee: { chest: 900015, cloak: 900011, feet: 900026, gloves: 900022, head: 900003, legs: 900003, mainHand: 20034, neck: 900011, offHand: 20034, wrists: 900019 },
  warlock_smds: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  warlock_firelock: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
  shadow_priest: { chest: 900015, cloak: 900014, feet: 900025, gloves: 900023, head: 900002, legs: 900002, neck: 900009, twoHand: 900029, wrists: 900018 },
};
