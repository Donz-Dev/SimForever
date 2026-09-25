import type { Equipment } from './Item';

/**
 * THE GEAR EACH CLASS ACTUALLY WEARS, item for item.
 *
 * ----------------------------------------------------------------------------
 * Twelve sets, every one from a sixtyupgrades.com link the project owner
 * supplied, and each one validated against that planner's own stat panel --
 * `panel - base` against what the items supply, with talents and raid buffs
 * off. See `src/data/items/README.md` for the method and for what each set does
 * NOT model.
 *
 * WHY THEY LIVE HERE RATHER THAN IN `profiles/presets.ts`, WHICH IS WHERE THEY
 * WERE WRITTEN. Two things need them and they are in different layers: a
 * PRESET, which is a stated build, and the STARTING SET a character created
 * from scratch is given. Duplicating three hundred lines of item ids in both is
 * the one option that guarantees they drift, and `game` may not import from
 * `profiles` -- dependencies point one way.
 *
 * A PRESET NAMING ONE OF THESE IS STILL A STATED BUILD. What `presets.ts`
 * deliberately does not do is call `startingEquipmentFor`, which is a LOOKUP
 * whose answer changes with the class and style on screen; spreading a named
 * const is the opposite of that.
 *
 * The Warrior's set is NOT here. It is `SHARED_ARMOUR` in `presets.ts` and the
 * style-keyed sets in `startingSets.ts`, which predate all of this and are the
 * one class whose two answers are deliberately not identical.
 * ----------------------------------------------------------------------------
 */

/** Crusader: a proc, and what every melee build's weapon carries. */
export const CRUSADER = 20034;

/**
 * Enchant Weapon - Spell Power, "add up to 30 damage to spells".
 *
 * The five caster sets name it on their staff or dagger, and it is a flat stat
 * rather than a proc -- so it applies to a weapon that is only ever HELD, which
 * is what a caster's main hand is.
 */
export const SPELL_POWER = 22749;

export /**
 * A ROGUE'S OWN GEAR, and no longer a Warrior's: full Nightslayer.
 *
 * ----------------------------------------------------------------------------
 * From the two sixtyupgrades.com sets the owner supplied -- see
 * `src/data/items/sod-rogue.json`. The ARMOUR is identical between them, item
 * for item, so it is written once and only the weapons differ.
 *
 * BACKSTAB AND MUTILATE ARE CASTABLE NOW, which the old shell made impossible.
 * Both require daggers and the shell had a sword in each hand, so Venom fell
 * back to Sinister Strike for its whole life. Perdition's Blade and Core Hound
 * Tooth are both daggers, so the build the owner asked for is the build that
 * runs.
 * ----------------------------------------------------------------------------
 */
const ROGUE_ARMOUR: Equipment = {
  ranged: { itemId: 228252 }, // Striker's Mark
  head: { itemId: 226446 }, // Nightslayer Cover
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 226444 }, // Nightslayer Shoulder Pads
  cloak: { itemId: 13340 }, // Cape of the Black Baron
  chest: { itemId: 226447 }, // Nightslayer Chestpiece
  wrists: { itemId: 226442 }, // Nightslayer Bracelets
  gloves: { itemId: 226441 }, // Nightslayer Gloves
  waist: { itemId: 226440 }, // Nightslayer Belt
  legs: { itemId: 226445 }, // Nightslayer Pants
  feet: { itemId: 226443 }, // Nightslayer Boots
  ring1: { itemId: 228286 }, // Band of Accuria
  ring2: { itemId: 19325 }, // Don Julio's Band
  trinket1: { itemId: 228722 }, // Hand of Justice
  trinket2: { itemId: 228464 }, // Royal Seal of Eldre'Thalas
};

export const ROGUE_DAGGERS: Equipment = {
  mainHand: { itemId: 228296, enchantId: CRUSADER }, // Perdition's Blade
  offHand: { itemId: 228277, enchantId: CRUSADER }, // Core Hound Tooth
};

export const ROGUE_SWORDS: Equipment = {
  mainHand: { itemId: 17075, enchantId: CRUSADER }, // Vis'kag the Bloodletter
  offHand: { itemId: 228265, enchantId: CRUSADER }, // Brutality Blade
};

export /**
 * A DRUID'S OWN GEAR, in three sets rather than one.
 *
 * ----------------------------------------------------------------------------
 * The owner supplied Moonkin, Cat and Bear separately, and they share only six
 * pieces between them -- Cenarion Raiment comes in a caster, a feral and a tank
 * cut, and the three builds want different jewellery as well. So each is
 * written out in full, the way a preset always is.
 *
 * THE FERAL WEAPON CARRIES NO CRUSADER, and the owner's own sets do. A Cat and
 * a Bear swing PAWS: `damageSource: 'natural'`, and `weaponsForEquipment`
 * refuses to build a weapon for a stat-stick hand, so the Glaive is held and
 * never used. An enchant whose whole effect is a proc on a weapon use would
 * have fired off paw swings that never touched the weapon -- the same reason
 * the Hunter's stat stick carries none.
 *
 * ITS 172 ATTACK POWER IS LISTED AND NOT APPLIED. "+172 Attack Power in Cat,
 * Bear, and Dire Bear forms only" is conditional on the combat style, and an
 * item stat cannot be. It is the largest single unmodelled line in the whole
 * item set, and the Gear panel prints it.
 * ----------------------------------------------------------------------------
 */
const DRUID_MOONKIN_GEAR: Equipment = {
  twoHand: { itemId: 228271, enchantId: SPELL_POWER }, // Staff of Dominance
  head: { itemId: 226658 }, // Cenarion Antlers
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 226653 }, // Cenarion Mantle
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 226656 }, // Cenarion Embrace
  wrists: { itemId: 226655 }, // Cenarion Wrists
  gloves: { itemId: 226777 }, // Feralheart Hands
  waist: { itemId: 228256 }, // Mana Igniting Cord
  legs: { itemId: 226651 }, // Cenarion Pants
  feet: { itemId: 226774 }, // Feralheart Galoshes
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 13968 }, // Eye of the Beast
  relic: { itemId: 23197 }, // Idol of the Moon
};

export const DRUID_CAT_GEAR: Equipment = {
  twoHand: { itemId: 227833 }, // Glaive of Obsidian Fury, held and never swung
  head: { itemId: 226659 }, // Cenarion Horns
  neck: { itemId: 19491 }, // Amulet of the Darkmoon
  shoulders: { itemId: 226665 }, // Cenarion Shoulders
  cloak: { itemId: 13340 }, // Cape of the Black Baron
  chest: { itemId: 226661 }, // Cenarion Tunic
  wrists: { itemId: 226662 }, // Cenarion Bands
  gloves: { itemId: 226664 }, // Cenarion Fists
  waist: { itemId: 226660 }, // Cenarion Girdle
  legs: { itemId: 226666 }, // Cenarion Trousers
  feet: { itemId: 226663 }, // Cenarion Treads
  ring1: { itemId: 228261 }, // Quick Strike Ring
  ring2: { itemId: 228286 }, // Band of Accuria
  trinket1: { itemId: 228722 }, // Hand of Justice
  trinket2: { itemId: 13965 }, // Blackhand's Breadth
  relic: { itemId: 220606 }, // Idol of the Dream
};

export const DRUID_BEAR_GEAR: Equipment = {
  twoHand: { itemId: 227833 }, // Glaive of Obsidian Fury, held and never swung
  head: { itemId: 226670 }, // Cenarion Crown
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 226674 }, // Cenarion Pauldrons
  cloak: { itemId: 228360 }, // Eskhandar's Pelt
  chest: { itemId: 226661 }, // Cenarion Tunic
  wrists: { itemId: 226668 }, // Cenarion Wristguards
  gloves: { itemId: 226664 }, // Cenarion Fists
  waist: { itemId: 226667 }, // Cenarion Waistguard
  legs: { itemId: 226666 }, // Cenarion Trousers
  feet: { itemId: 226673 }, // Cenarion Walkers
  ring1: { itemId: 228261 }, // Quick Strike Ring
  ring2: { itemId: 228286 }, // Band of Accuria
  trinket1: { itemId: 228722 }, // Hand of Justice
  trinket2: { itemId: 228686 }, // Onyxia Blood Talisman
  relic: { itemId: 23198 }, // Idol of Brutality
};

export /**
 * A GEAR SHELL, and said to be one.
 *
 * Earthfury, in the two cuts the owner supplied: an Elemental caster set and an
 * Enhancement melee one. They share no armour piece at all.
 *
 * ELEMENTAL HOLDS A SHIELD, and that is not a mistake. Earth and Fire is a
 * CASTER shield -- 26 spell power, 9 stamina, 7 intellect -- and a caster style
 * carries both hands as stat sticks, so the dagger and the shield contribute
 * their stats and neither swings. `liveEquipment` used to delete both off-hand
 * slots for every stat-stick style, which threw the shield away entirely.
 *
 * ENHANCEMENT IS A TWO-HANDER, which is what the owner's set gives it: The
 * Unstoppable Force, 3.8 seconds, exactly what Windfury Weapon wants.
 */
const SHAMAN_ELEMENTAL_GEAR: Equipment = {
  mainHand: { itemId: 228263, enchantId: SPELL_POWER }, // Sorcerous Dagger
  shield: { itemId: 228142 }, // Earth and Fire
  head: { itemId: 227002 }, // Coif of The Five Thunders
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 226624 }, // Earthfury Mantle
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 226619 }, // Earthfury Ringmail
  wrists: { itemId: 226626 }, // Earthfury Wristbands
  gloves: { itemId: 226621 }, // Earthfury Hands
  waist: { itemId: 228256 }, // Mana Igniting Cord
  legs: { itemId: 226623 }, // Earthfury Leggings
  feet: { itemId: 226620 }, // Earthfury Walkers
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 18471 }, // Royal Seal of Eldre'Thalas
  trinket2: { itemId: 12930 }, // Briarwood Reed
  relic: { itemId: 23199 }, // Totem of the Storm
};

export const SHAMAN_ENHANCEMENT_GEAR: Equipment = {
  twoHand: { itemId: 19323, enchantId: CRUSADER }, // The Unstoppable Force
  head: { itemId: 228291 }, // Crown of Destruction
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 226640 }, // Earthfury Spaulders
  cloak: { itemId: 228360 }, // Eskhandar's Pelt
  chest: { itemId: 227024 }, // Chain of The Five Thunders
  wrists: { itemId: 226642 }, // Earthfury Bindings
  gloves: { itemId: 227022 }, // Fists of The Five Thunders
  waist: { itemId: 226641 }, // Earthfury Girdle
  legs: { itemId: 226639 }, // Earthfury Chain Leggings
  feet: { itemId: 226636 }, // Earthfury Battleboots
  ring1: { itemId: 228261 }, // Quick Strike Ring
  ring2: { itemId: 228286 }, // Band of Accuria
  trinket1: { itemId: 13965 }, // Blackhand's Breadth
  trinket2: { itemId: 228722 }, // Hand of Justice
  /*
   * Totem of Rage, and it does NOTHING. The tooltip Wowhead serves for this id
   * carries no equip line at all -- item level, binding, "Relic", and nothing
   * else. Whatever the relic grants is not stated by the source, so nothing is
   * invented; it is worn, and it is empty.
   */
  relic: { itemId: 227977 },
};

export /**
 * A MAGE'S OWN GEAR: full Arcanist, and ONE set for all three builds.
 *
 * ----------------------------------------------------------------------------
 * The owner supplied a single set for Frostfire, Arcane and Fire, so all three
 * share it -- unlike the Druid and the Paladin, whose specs came separately.
 *
 * `spellPower` NO LONGER READS ZERO, which is the whole point of this import
 * for a caster: 452 of it by the planner's count, where the Warrior shell gave
 * none. A Mage figure is still a floor for the OTHER reason the handover gives
 * -- Forever's spell data states flat damage and no spell power coefficient --
 * but it is no longer a floor for lack of gear.
 * ----------------------------------------------------------------------------
 */
const MAGE_GEAR: Equipment = {
  twoHand: { itemId: 228271, enchantId: SPELL_POWER }, // Staff of Dominance
  ranged: { itemId: 228262 }, // Crimson Shocker, a wand that never fires here
  head: { itemId: 226562 }, // Arcanist Crown
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 226560 }, // Arcanist Mantle
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 228239 }, // Robe of Volatile Power
  wrists: { itemId: 226558 }, // Arcanist Bindings
  gloves: { itemId: 226556 }, // Arcanist Gloves
  waist: { itemId: 228256 }, // Mana Igniting Cord
  legs: { itemId: 226561 }, // Arcanist Leggings
  feet: { itemId: 226557 }, // Arcanist Boots
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 13968 }, // Eye of the Beast
};

export /**
 * A PALADIN'S OWN GEAR, in the three sets the owner supplied separately.
 *
 * ----------------------------------------------------------------------------
 * Lawbringer in all three, with Soulforge on Retribution and the tank cut on
 * Protection. Almost no piece is shared between them, which is why there are
 * three and not one.
 *
 * SHOCKADIN CHANGED COMBAT STYLE, and the gear is what changed it. Its set is a
 * ONE-HANDER and a caster SHIELD -- Azuresong Mageblade and Earth and Fire --
 * where the preset said `two_hander`. Under a two-hand style `liveEquipment`
 * deletes the main hand and both off-hand slots, so the build would have stood
 * there with no weapon at all. A one-hander plus a shield IS `one_hand_shield`,
 * the style the Paladin already has, so that is what it now uses. The other
 * four settings are untouched; this is the one the gear forced.
 *
 * PROTECTION KEEPS ITS OWN SHIELD ONLY IN SPIRIT. Earthen Guard is the owner's
 * choice and it replaces The Immovable Object, which was the one real FOREVER
 * item in the whole project and is now equipped by nobody. It is still in the
 * item data and still selectable.
 * ----------------------------------------------------------------------------
 */
const PALADIN_RET_GEAR: Equipment = {
  twoHand: { itemId: 228229, enchantId: CRUSADER }, // Obsidian Edged Blade
  head: { itemId: 226976 }, // Soulforge Greathelm
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 221783 }, // Lawbringer Spaulders
  cloak: { itemId: 20691 }, // Windshear Cape
  chest: { itemId: 226973 }, // Soulforge Breastplate
  wrists: { itemId: 226596 }, // Lawbringer Warbands
  gloves: { itemId: 226975 }, // Soulforge Gauntlets
  waist: { itemId: 228295 }, // Onslaught Girdle
  legs: { itemId: 226598 }, // Lawbringer Leggings
  feet: { itemId: 226601 }, // Lawbringer Battleboots
  ring1: { itemId: 228261 }, // Quick Strike Ring
  ring2: { itemId: 19325 }, // Don Julio's Band
  trinket1: { itemId: 228722 }, // Hand of Justice
  trinket2: { itemId: 13965 }, // Blackhand's Breadth
  relic: { itemId: 215435 }, // Libram of Benediction
};

export const PALADIN_SHOCKADIN_GEAR: Equipment = {
  mainHand: { itemId: 228269, enchantId: CRUSADER }, // Azuresong Mageblade
  shield: { itemId: 228142 }, // Earth and Fire
  head: { itemId: 226599 }, // Lawbringer Crown
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 221783 }, // Lawbringer Spaulders
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 226602 }, // Lawbringer Breastplate
  wrists: { itemId: 226596 }, // Lawbringer Warbands
  gloves: { itemId: 226600 }, // Lawbringer Grips
  waist: { itemId: 226597 }, // Lawbringer Girdle
  legs: { itemId: 226598 }, // Lawbringer Leggings
  feet: { itemId: 226601 }, // Lawbringer Battleboots
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 13965 }, // Blackhand's Breadth
  relic: { itemId: 22401 }, // Libram of Hope
};

export const PALADIN_PROT_GEAR: Equipment = {
  mainHand: { itemId: 228269, enchantId: CRUSADER }, // Azuresong Mageblade
  shield: { itemId: 20688 }, // Earthen Guard
  head: { itemId: 226607 }, // Lawbringer Headguard
  neck: { itemId: 228249 }, // Medallion of Steadfast Might
  shoulders: { itemId: 226605 }, // Lawbringer Pauldrons
  cloak: { itemId: 228360 }, // Eskhandar's Pelt
  chest: { itemId: 226595 }, // Lawbringer Chestguard
  wrists: { itemId: 226603 }, // Lawbringer Vambraces
  gloves: { itemId: 226608 }, // Lawbringer Handguards
  waist: { itemId: 226604 }, // Lawbringer Battlebelt
  legs: { itemId: 226606 }, // Lawbringer Legguards
  feet: { itemId: 226609 }, // Lawbringer Sabatons
  ring1: { itemId: 228242 }, // Heavy Dark Iron Ring
  ring2: { itemId: 19325 }, // Don Julio's Band
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 228686 }, // Onyxia Blood Talisman
  relic: { itemId: 22401 }, // Libram of Hope
};

export /**
 * A HUNTER'S OWN GEAR, and no longer a Warrior's.
 *
 * ----------------------------------------------------------------------------
 * From a sixtyupgrades.com set the project owner supplied, item for item:
 * full Giantstalker with Rhok'delar. Season of Discovery ids, the same source
 * and namespace as the Unstoppable Might set `SHARED_ARMOUR` already uses --
 * see `src/data/items/sod-hunter.json`.
 *
 * WHY IT MATTERS MORE THAN A GEAR SWAP USUALLY WOULD. The three Hunters wore
 * `SHARED_ARMOUR`, which is the WARRIOR set: 370 strength and 245 agility. A
 * Hunter is the other way round -- this set is 58 strength and 334 agility --
 * and strength grants a Hunter NO ranged attack power at all. So every Hunter
 * figure on file was built on a stat the class cannot use for the thing it
 * mostly does.
 *
 * THE MELEE WEAPON IS SEPARATE, because the two ranged builds and the melee
 * one want different things from that slot. Dreadforge Retaliator is a STAT
 * STICK for a bow build -- 12 agility, 30 attack power and 1% crit off a
 * two-hander that never swings, which is exactly how the set uses it. Handing
 * it to LW Melee, whose two-hander IS its damage, would be 53.11 dps against
 * the Obsidian Edged Blade's 64.86 and no Crusader; that build keeps its own
 * weapon.
 * ----------------------------------------------------------------------------
 */
const HUNTER_ARMOUR: Equipment = {
  ranged: { itemId: 228334 }, // Rhok'delar, Longbow of the Ancient Keepers
  head: { itemId: 228291 }, // Crown of Destruction
  neck: { itemId: 228685 }, // Onyxia Tooth Pendant
  shoulders: { itemId: 226527 }, // Giantstalker's Epaulets
  cloak: { itemId: 13340 }, // Cape of the Black Baron
  chest: { itemId: 226534 }, // Giantstalker's Breastplate
  wrists: { itemId: 228284 }, // Wristguards of True Flight
  gloves: { itemId: 226528 }, // Giantstalker's Gloves
  waist: { itemId: 226529 }, // Giantstalker's Belt
  legs: { itemId: 226532 }, // Giantstalker's Leggings
  feet: { itemId: 226531 }, // Giantstalker's Boots
  ring1: { itemId: 228286 }, // Band of Accuria
  ring2: { itemId: 19325 }, // Don Julio's Band
  trinket1: { itemId: 13965 }, // Blackhand's Breadth
  trinket2: { itemId: 18473 }, // Royal Seal of Eldre'Thalas
};

export /**
 * The set's melee slot, for the two builds that only stand there holding it.
 *
 * A two-hander on a `ranged` style is a stat stick by the style's own
 * definition and contributes its stats without ever swinging.
 */
const HUNTER_STAT_STICK: Equipment = {
  twoHand: { itemId: 227981 }, // Dreadforge Retaliator
};

export /**
 * The melee build's two-hander, kept from before the Hunter set arrived.
 *
 * Its own stated weapon rather than the set's -- see HUNTER_ARMOUR above for
 * why. It fills the same slot, so it replaces the stat stick rather than
 * stacking with it.
 */
const HUNTER_MELEE_WEAPONS: Equipment = {
  twoHand: { itemId: 228229, enchantId: CRUSADER },
};

export /**
 * A WARLOCK'S OWN GEAR: Felheart, with the Deathmist mask and sandals.
 *
 * One set for both builds, as the owner supplied it. 471 spell power by the
 * planner's count, against the Warrior shell's nothing.
 */
const WARLOCK_GEAR: Equipment = {
  twoHand: { itemId: 228271, enchantId: SPELL_POWER }, // Staff of Dominance
  ranged: { itemId: 220604 }, // Nightmare Trophy, a wand that never fires here
  head: { itemId: 226909 }, // Deathmist Mask
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 226550 }, // Felheart Shoulder Pads
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 226548 }, // Felheart Robes
  wrists: { itemId: 226553 }, // Felheart Bracers
  gloves: { itemId: 226552 }, // Felheart Gloves
  waist: { itemId: 228256 }, // Mana Igniting Cord
  legs: { itemId: 226547 }, // Felheart Pants
  feet: { itemId: 226908 }, // Deathmist Sandals
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 13968 }, // Eye of the Beast
};

export /**
 * A SHADOW PRIEST'S OWN GEAR: Vestments of Prophecy, with Anathema.
 *
 * ----------------------------------------------------------------------------
 * AND IT IS THE ONE SET THE ENGINE CANNOT FULLY WEAR. Almost every spell power
 * line in it names a SCHOOL -- "Increases damage done by Shadow spells and
 * effects by up to 39" on six of the eight tier pieces, and 75 on Anathema --
 * and `spellPower` here is school-blind, one number read by every non-physical
 * school. Applying a Shadow-only bonus to it would make the Priest's Holy and
 * Arcane spells hit harder, which is wrong, so those lines stay unmodelled and
 * the Gear panel prints every one.
 *
 * The planner reads 204 spell damage generic and 497 Shadow. This character
 * gets the 204. The ~293 difference is the single largest known shortfall in
 * the item data and it is a missing ENGINE STAT rather than missing data --
 * see `src/data/items/README.md`.
 * ----------------------------------------------------------------------------
 */
const PRIEST_GEAR: Equipment = {
  twoHand: { itemId: 228336, enchantId: SPELL_POWER }, // Anathema
  ranged: { itemId: 13396 }, // Skul's Ghastly Touch, a wand that never fires here
  head: { itemId: 226584 }, // Crown of Prophecy
  neck: { itemId: 228289 }, // Choker of the Fire Lord
  shoulders: { itemId: 226581 }, // Shoulderpads of Prophecy
  cloak: { itemId: 228100 }, // Drape of the Fire Lord
  chest: { itemId: 226582 }, // Garments of Prophecy
  wrists: { itemId: 226579 }, // Wristwraps of Prophecy
  gloves: { itemId: 226585 }, // Hands of Prophecy
  waist: { itemId: 228256 }, // Mana Igniting Cord
  legs: { itemId: 226583 }, // Leggings of Prophecy
  feet: { itemId: 226586 }, // Sandals of Prophecy
  ring1: { itemId: 228287 }, // Band of Sulfuras
  ring2: { itemId: 228243 }, // Ring of Spell Power
  trinket1: { itemId: 12930 }, // Briarwood Reed
  trinket2: { itemId: 13968 }, // Eye of the Beast
};
