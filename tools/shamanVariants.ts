/*
 * ==============================================================================
 * THE VARIANTS `probe_build.ts` MEASURES ON THE TWO SHAMANS.
 *
 * Written for the owner's six-profile optimisation pass. Client build
 * 1.60.1.70425 removed Call of Thunder, added the ELEMENTAL MASTERY capstone,
 * moved Lava Burst from row 6 to row 4 and renamed Improved Fire Nova -- and
 * Call of Flame's nine seconds of Flame Shock duration were implemented in the
 * same round, which changed what the Elemental list spends its time on.
 *
 * ------------------------------------------------------------------------------
 * THE ELEMENTAL BUILD IS CAST-BOUND AND NOT MANA-BOUND, WHICH IS THE FINDING
 * THAT RULES OUT HALF ITS TREE.
 *
 * It was measured directly: CONVECTION 5/5 is "10% off Shock, Lightning Bolt,
 * Lava Burst and Chain Lightning", bought with ten dead points, and it measured
 * **-0.18 against an interval of 1.63** -- with the cast counts IDENTICAL to the
 * decimal. 25.0 Lightning Bolts, 6.0 Lava Bursts, 3.0 Flame Shocks before and
 * after. The mana was saved and there was nothing to spend it on.
 *
 * SO "A MANA TALENT ON A CASTER" IS SETTLED FOR THIS BUILD and the variants
 * below do not re-ask it. What is left is DAMAGE and CAST TIME.
 *
 * ------------------------------------------------------------------------------
 * AND ITS HIT IS EXACTLY AT THE CAP, WITH A TALENT HOLDING IT THERE. 16.00
 * points against a usable spell cap of 16 -- 17% miss floored at 1% -- and
 * TIDAL FOCUS supplies five of them. So the five Restoration points that look
 * like filler are the difference between 1% and 6% spell miss, which is why no
 * variant here touches them. The three Mages and the Shadow Priest sit at 11
 * and make it up with SCHOOL-scoped hit; the Elemental Shaman's is school-blind
 * and comes from this talent.
 *
 * ------------------------------------------------------------------------------
 * THE ENHANCEMENT BUILD IS A PHYSICAL BUILD WEARING A CASTER'S TREE: Main Hand
 * Auto-Attack 38.3% plus Windfury Attack 22.4% is 61% of it, against Stormstrike
 * 12.8%, Fire Nova 7.7%, Searing Totem 6.2% and Earth Shock 6.1%. Lightning
 * Bolt is 1.2% on 1.8 casts.
 *
 * AND ALMOST NOTHING ON IT MOVED: its list was measured entry by entry and
 * every removal lost -- Fire Nova by **69.6**, even after the client cut its
 * damage 44%. Its one gain was a dead boot enchant, +1.9.
 * ==============================================================================
 */
import {
  type Variant,
  SHAMAN_TREE as tree,
  addPrecombat,
  chain,
  consumable,
  enchant,
  moveAbove,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';

/* --------------------------------------------------------------- the trees */

/**
 * ELEMENTAL, with the ten dead points moved to Convection and Reverberation.
 *
 * KEPT AS A MEASURED NEGATIVE RATHER THAN DELETED. `elemental_warding` 3 is
 * damage taken on a profile nothing attacks, `eye_of_the_storm` 3 is cast
 * pushback, `elemental_reach` 2 is range and `trial_by_fire` 2 is Fire Nova,
 * which the Elemental list never casts -- ten points that provably do nothing.
 * They still measured as NOISE when moved, because the only things left to buy
 * in the tree are MANA, and this build has mana to spare.
 *
 * **TEN DEAD POINTS WITH NOWHERE LIVE TO GO IS A STATEMENT ABOUT THE TREE**,
 * not a failure of the search, and it is the reason this variant is here: a
 * reader who finds Elemental Warding in the owner's spread should see that
 * moving it was tried and measured rather than assume nobody looked.
 */
const ELEMENTAL_NO_DEAD_POINTS = {
  // Elemental, 32
  convection: 5,
  concussion: 5,
  reverberation: 5,
  elemental_alacrity: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  lava_burst: 1,
  lightning_overload: 3,
  elemental_fury: 5,
  elemental_mastery: 1,
  // Enhancement, 6
  thundering_strikes: 5,
  ancestral_knowledge: 1,
  // Restoration, 13
  tidal_focus: 5,
  totemic_focus: 5,
  mindfulness: 3,
};

/**
 * ELEMENTAL, trading the near-dead Restoration filler for +8% Intellect.
 *
 * `totemic_focus` is 25% off a totem cast twice a fight and `mindfulness` is
 * threat; ANCESTRAL KNOWLEDGE is +2% Intellect a rank at Enhancement tier 0, so
 * four of those eight points become +8% Intellect without disturbing a single
 * tier gate. Worth **+2.95 +/- 0.63** -- small, real, and the only talent move
 * on this profile that measured as anything at all. It is the shipped spread.
 */
const ELEMENTAL_INTELLECT = {
  // Elemental, 32 -- unchanged from the owner's spread
  concussion: 5,
  elemental_warding: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  elemental_alacrity: 3,
  trial_by_fire: 2,
  eye_of_the_storm: 3,
  elemental_mastery: 1,
  elemental_reach: 2,
  lightning_overload: 3,
  elemental_fury: 5,
  lava_burst: 1,
  // Enhancement, 10
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  // Restoration, 9
  tidal_focus: 5,
  totemic_focus: 4,
};

/** The control: Ancestral Knowledge back at 1, the filler back in Restoration. */
const ELEMENTAL_OWNER_SPREAD = {
  ...ELEMENTAL_INTELLECT,
  ancestral_knowledge: 1,
  totemic_focus: 5,
  mindfulness: 3,
};

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  elementalTalents: [
    { label: 'ancestral_knowledge 1 -> 5 (out of Restoration filler)', apply: tree(ELEMENTAL_INTELLECT) },
    { label: 'back to the owner spread -- the control', apply: tree(ELEMENTAL_OWNER_SPREAD) },
    {
      label: '10 dead points -> convection 5 + reverberation 5 (measured NOISE)',
      apply: tree(ELEMENTAL_NO_DEAD_POINTS),
    },
  ],

  /*
   * THE ELEMENTAL LIST. Elemental Mastery's entry is worth **+24.4** and is
   * shipped; these are the questions left after it. Both maintenance entries
   * are load-bearing -- Searing Totem by 80.4 and Flame Shock by 32.9 -- and
   * Earth Shock as a filler on the shock cooldowns Call of Flame freed up is
   * **-30.3**, because it cost 6.5 Lightning Bolts and pushed the build into
   * its mana.
   */
  elementalApl: [
    { label: 'no elemental_mastery entry -- the control', apply: removeEntry('elemental_mastery') },
    { label: 'no searing_totem entry', apply: removeEntry('searing_totem') },
    { label: 'no flame_shock entry', apply: removeEntry('flame_shock') },
    { label: 'no lava_burst entry', apply: removeEntry('lava_burst') },
  ],

  /*
   * ============================================================================
   * THE PRE-COMBAT DIMENSION, AND ELEMENTAL MASTERY IS THE REASON IT IS HERE.
   *
   * A pre-combat action skips the global cooldown it would start, so a fifteen
   * second window opened at a 0s lead is the SAME window the fight would get,
   * bought for no GCD -- and this build's GCD is the thing it is short of. The
   * list entry is worth +24.4 with the GCD paid; the pre-cast is **+13.9** on
   * top, and Searing Totem moved to the Enhancement opener's own 1.5s lead is
   * **+11.0**. Together **+27.5 +/- 5.0**.
   *
   * THE LEAD CUTS BOTH WAYS AND 0s IS WHAT WINS. The lead is REAL, so 0s gives
   * the full fifteen seconds from the pull and a 5s lead gives ten -- while the
   * cooldown comes back five seconds sooner, which on a three minute cooldown
   * in a hundred second fight buys nothing.
   * ============================================================================
   */
  elementalPrecombat: [
    {
      label: 'elemental_mastery 0s + searing_totem 1.5s before',
      apply: chain(addPrecombat(0, 'elemental_mastery'), addPrecombat(1.5, 'searing_totem')),
    },
    { label: 'elemental_mastery at 0s before only', apply: addPrecombat(0, 'elemental_mastery') },
    { label: 'searing_totem at 1.5s before only', apply: addPrecombat(1.5, 'searing_totem') },
    { label: 'elemental_mastery lead 0s -> 5s', apply: precombatLead('elemental_mastery', 5) },
    { label: 'no pre-combat lightning_bolt', apply: removePrecombat('lightning_bolt') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
  ],

  enhancementPrecombat: [
    { label: 'rage_of_the_farseer at 0s before', apply: addPrecombat(0, 'rage_of_the_farseer') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
    { label: 'no pre-combat searing_totem', apply: removePrecombat('searing_totem') },
  ],

  /*
   * FIRE NOVA AFTER A 44% DAMAGE CUT: removing it is **-69.6**, so it is still
   * the fourth-largest source on this profile and stays where the owner put it.
   * Its position is noise.
   */
  enhancementApl: [
    { label: 'no fire_nova entry', apply: removeEntry('fire_nova') },
    { label: 'fire_nova above earth_shock', apply: moveAbove('fire_nova', 'earth_shock') },
    { label: 'no lightning_bolt entry', apply: removeEntry('lightning_bolt') },
    { label: 'no earth_shock entry', apply: removeEntry('earth_shock') },
  ],

  /*
   * THE ELEMENTAL LOADOUT IS THE SAME FIVE-CASTER ONE, so the same slots are
   * the only live questions -- see `mageVariants.ts`, which carries the
   * argument: the cloak and feet slots offer a caster NOTHING, so their
   * `unmodelled` enchants are dead by table rather than by choice.
   */
  elementalEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  /*
   * ============================================================================
   * THE ENHANCEMENT SHAMAN HAD A DEAD ENCHANT ITS SLOT COULD ACTUALLY FIX, which
   * none of the five casters does: its boots carried MINOR SPEED, and the feet
   * slot offers +7 AGILITY -- which a 61%-physical build reads in full. Worth
   * **+1.9 +/- 1.8**, and it was the one free enchant in the six profiles: a
   * slot worth zero with a live option in the same table. It is shipped, so the
   * row below is the control.
   *
   * EVERYTHING ELSE STAYS ON STRENGTH, measured rather than assumed: +15 Agility
   * for +15 Strength is -1.7, +8 Agility on the head is -1.0, and haste on the
   * head, legs or gloves is noise against an interval of 11.
   * ============================================================================
   */
  enhancementEnchants: [
    { label: 'feet Minor Speed (was +7 Agility) -- the control', apply: enchant('feet', 900025) },
    { label: 'feet +7 Stamina', apply: enchant('feet', 900027) },
    { label: 'gloves +15 Agility (was +15 Strength)', apply: enchant('gloves', 900022) },
    { label: 'head +8 Agility (was +8 Strength)', apply: enchant('head', 900003) },
    { label: 'head +1% Haste (was +8 Strength)', apply: enchant('head', 900002) },
    { label: 'legs +1% Haste (was +8 Strength)', apply: enchant('legs', 900002) },
    { label: 'gloves +1% Haste (was +15 Strength)', apply: enchant('gloves', 900002) },
  ],

  /* Every alternative lost on both Shamans. Kept so that can be re-derived. */
  shamanConsumables: [
    { label: 'school power Fire', apply: consumable('school_spell_power', 'school_fire') },
    { label: 'school power Nature', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'blasted lands +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],
};
