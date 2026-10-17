/*
 * ==============================================================================
 * THE VARIANTS `probe_build.ts` MEASURES ON THE THREE MAGES.
 *
 * Written for the owner's six-profile optimisation pass, after client build
 * 1.60.1.70425 moved four Mage rank counts, renamed a row and added a talent.
 *
 * ------------------------------------------------------------------------------
 * WHAT EACH OF THE THREE BINDS ON, which is what the groups are chosen around
 * and what the diagnostic run says rather than what the class suggests:
 *
 *   ALL THREE ARE CAST-BOUND AND NONE IS MANA-BOUND. Evocation sits in every
 *   list at a 10% gate and fires ZERO times on all three; the Demonic Rune
 *   fires 0.0 to 0.2 times. So a mana talent or a mana consumable is worth
 *   nothing to any of them, and that rules out most of what the Arcane tree
 *   offers -- Arcane Meditation, Master of Elements, the mana potions.
 *
 *   FROSTFIRE  Frostfire Bolt 34.7%, Pyroblast 17.5%, Ice Lance 15.2%, Fire
 *              Blast 12.3%, Ignite 11.3%, Scorch 9.0%. Its damage is spread
 *              across six spells, so a per-SCHOOL effect reaches nearly all of
 *              it and a per-ability one reaches a third at best.
 *   ARCANE     Arcane Missiles 67% and Arcane Blast 25.5%. TWO spells are 92%
 *              of the profile, which makes Missile Barrage -- whose whole job
 *              is to make the first of them faster and free -- the largest
 *              lever in the tree by a wide margin.
 *   FIRE       Fireball 32.7%, Pyroblast 19.0%, Ignite 15.9%, Scorch 11.4%,
 *              Fire Blast 11.1%, Arcane Missiles 9.9%.
 *
 * ------------------------------------------------------------------------------
 * AND ALL THREE SIT AT 11 POINTS OF SCHOOL-BLIND HIT WHERE THE USABLE CAP IS
 * 16, which is the first thing the stat probe said and is not a gear fault:
 * spells miss on a flat 17% floored at 1%, and the missing five points arrive
 * as SCHOOL-SCOPED hit from a talent. Frostfire's Elemental Precision 5/5 and
 * the Arcane build's Arcane Focus 5/5 close it for every spell those builds
 * cast; **the Fire Mage's Elemental Precision was 4/5**, so its Fire spells
 * missed 2% instead of 1%. That was the one hit gap in the three and it cost
 * one talent point.
 * ==============================================================================
 */
import {
  type Variant,
  MAGE_TREE as tree,
  addAbove,
  addEntry,
  addPrecombat,
  chain,
  consumable,
  enchant,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';

/* --------------------------------------------------------------- the trees */

/**
 * FROSTFIRE -- Fire 29 / Frost 22, and FOUR of its points were dead.
 *
 * `burning_soul` is cast pushback and threat, both permanent rulings, and
 * `flame_throwing` is range. Neither could ever do anything here.
 *
 * THEY WERE ALSO TIER TAX, WHICH IS THE PART THAT DECIDED WHERE THEY WENT. The
 * Fire tree needs fifteen points above row three to reach Improved Scorch,
 * Heating Up and Master of Elements, and those four were part of the fifteen --
 * so they could not simply be deleted, they had to be REPLACED by live talents
 * in rows zero to two. There are exactly two: INCINERATION, which is +6% crit
 * on Fire Blast, Ice Lance, Arcane Blast and Scorch (three of which this build
 * casts), and IMPROVED FIRE BLAST, which is a second off a cooldown this build
 * presses six times a fight. Worth **+28.5 +/- 9.5**, and it is the shipped
 * spread now -- this entry is kept so the figure can be re-derived.
 */
const FROSTFIRE_LIVE = {
  // Fire, 29
  improved_fire_blast: 1,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 4,
  fire_power: 3,
  // Frost, 22
  elemental_precision: 5,
  ice_shards: 5,
  piercing_ice: 3,
  frost_channeling: 3,
  ice_lance: 1,
  shatter: 3,
  fingers_of_frost: 2,
};

/** FROSTFIRE as it was before that trade, so the +28.5 has its control. */
const FROSTFIRE_DEAD_POINTS = {
  improved_fireball: 5,
  ignite: 5,
  flame_throwing: 1,
  burning_soul: 3,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 4,
  fire_power: 3,
  elemental_precision: 5,
  ice_shards: 5,
  piercing_ice: 3,
  frost_channeling: 3,
  ice_lance: 1,
  shatter: 3,
  fingers_of_frost: 2,
};

/**
 * ARCANE -- Arcane 35 / Fire 11 / Frost 5, with SEVEN dead points.
 *
 * `improved_channeling` is five points of cast pushback and threat, and
 * `arcane_subtlety` two of threat and target spell resistance -- which the
 * owner has ruled has no effect on an enemy target. All seven are permanent
 * rulings rather than gaps.
 *
 * MISSILE BARRAGE'S SECOND RANK IS WHAT ONE OF THEM BOUGHT, and it is the
 * largest single figure in the whole pass: **+144.4 +/- 9.3**, 16% of the
 * profile. Arcane Missiles is 67% of this build and Arcane Blast 25.5%, so the
 * talent's trigger and its payout are the build's two spells.
 */
const ARCANE_MISSILE_BARRAGE_2 = {
  // Arcane, 35 -- one point out of Improved Channeling
  arcane_focus: 5,
  improved_channeling: 4,
  arcane_subtlety: 2,
  arcane_concentration: 5,
  arcane_impact: 3,
  arcane_blast: 1,
  arcane_meditation: 3,
  missile_barrage: 2,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  // Fire, 11
  improved_fire_blast: 2,
  incineration: 3,
  ignite: 5,
  pyroblast: 1,
  // Frost, 5
  elemental_precision: 5,
};

/** The same with Missile Barrage back at 1, so the +144.4 has its control. */
const ARCANE_MISSILE_BARRAGE_1 = {
  ...ARCANE_MISSILE_BARRAGE_2,
  improved_channeling: 5,
  missile_barrage: 1,
};

/**
 * ARCANE, WITH ARCANE WRATH TAKEN -- the owner's question, at the corrected
 * numbers.
 *
 * ==============================================================================
 * The spell is a **3.5 second cast** for 439-529 Arcane plus **100% of Spell
 * Power** plus 5% of maximum Mana, on a 6 second cooldown for 395 mana. It
 * shipped as an INSTANT at 406-496 with a borrowed 0.429 coefficient, which is
 * why it was not taken the first time -- so this measures the real spell rather
 * than the one a misread capture field produced.
 *
 * MEASURED: IT LOSES 77 TO 119 WHEREVER IT IS CAST, and is never cast at all in
 * three of the five placements. The spread is in `arcaneWrath` below and the
 * full justification is on `MAGE_ARCANE_TALENTS` in `presets.ts`.
 *
 * ------------------------------------------------------------------------------
 * AND THE ARITHMETIC THAT MADE IT LOOK CLOSE WAS WRONG, WHICH IS THE PART TO
 * KEEP. This comment read:
 *
 *   Arcane Wrath     484 + 785 + 250 = 1,519 over 3.5s  =  434 / sec
 *   Arcane Blast     236 + 785 x 0.4286 = 572 over 1.5s =  381 / sec
 *
 * -- computed at BASE spell power, which prices Arcane Blast as a nuke. It is
 * not one: each stack grants 15% of Intellect as spell power, so at five stacks
 * this build carries **+257 on a base of 785** and Arcane Blast's own figure is
 * `236 + (785 + 257) x 0.4286 = 683` over 1.5 seconds, **455/sec and already
 * ahead** -- before a point of what the ramp does for the 67% of the profile
 * that is Arcane Missiles.
 *
 * **A PER-SECOND COMPARISON ON A BUILD WITH A RAMP HAS TO BE TAKEN AT THE RAMPED
 * FIGURE**, or it prices the spell that breaks the ramp as though the ramp were
 * free. The measurement said so and the arithmetic beside it had already said
 * the opposite, which is this project's own rule about a prediction in a comment
 * -- specific, mechanical, and reading exactly like a finding.
 *
 * THE POINT COMES OUT OF IMPROVED CHANNELING, which has four left after Missile
 * Barrage's second rank took one.
 * ==============================================================================
 */
const ARCANE_WITH_WRATH = {
  // Arcane, 35 -- two points out of Improved Channeling
  arcane_focus: 5,
  improved_channeling: 3,
  arcane_subtlety: 2,
  arcane_concentration: 5,
  arcane_impact: 3,
  arcane_blast: 1,
  arcane_wrath: 1,
  arcane_meditation: 3,
  missile_barrage: 2,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  // Fire, 11
  improved_fire_blast: 2,
  incineration: 3,
  ignite: 5,
  pyroblast: 1,
  // Frost, 5
  elemental_precision: 5,
};

/**
 * FIRE -- Arcane 15 / Fire 31 / Frost 5, after Arcane Subtlety's two dead
 * points bought the last point of hit and Missile Barrage's second rank.
 *
 * Worth **+28.8 +/- 8.2** together, and the halves measure separately at
 * **+19.8** for the barrage rank and **+10.8** for the hit.
 */
const FIRE_BOTH = {
  // Arcane, 15
  arcane_focus: 5,
  arcane_concentration: 5,
  arcane_impact: 3,
  missile_barrage: 2,
  // Fire, 31
  improved_fire_blast: 1,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 5,
  fire_power: 3,
  combustion: 1,
  // Frost, 5
  elemental_precision: 5,
};

/** The control: both points back in Arcane Subtlety. */
const FIRE_DEAD_POINTS = {
  ...FIRE_BOTH,
  arcane_subtlety: 2,
  missile_barrage: 1,
  elemental_precision: 4,
};

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * THE TALENT TRADES, EACH WITH ITS CONTROL. The shipped spread is the one
   * with the live points, so the figure to read is the NEGATIVE of the control
   * row -- which is why both are here: a variant file that only holds what was
   * rejected cannot re-derive what was accepted.
   */
  frostfireTalents: [
    {
      label: 'burning_soul 3 + flame_throwing 1 -> incineration 3 + improved_fire_blast 1',
      apply: tree(FROSTFIRE_LIVE),
    },
    { label: 'back to the dead points -- the control', apply: tree(FROSTFIRE_DEAD_POINTS) },
  ],

  arcaneTalents: [
    { label: 'missile_barrage 1 -> 2 (out of improved_channeling)', apply: tree(ARCANE_MISSILE_BARRAGE_2) },
    { label: 'missile_barrage back to 1 -- the control', apply: tree(ARCANE_MISSILE_BARRAGE_1) },
  ],

  /*
   * ============================================================================
   * ARCANE WRATH, THE OWNER'S QUESTION. The talent alone does nothing -- the
   * spell has to be in the LIST to be cast -- so this measures the pair, which
   * is the Berserker Rage lesson: measured one at a time, both halves of a
   * talent-plus-entry read as worthless and the honest conclusion from either
   * alone is "not worth taking".
   *
   * THREE POSITIONS, because a 3.5 second cast is the longest thing this build
   * would do and where it sits decides what it displaces. Above the Arcane
   * Missiles entries it takes a Missile Barrage window; below them it fills the
   * gap Arcane Blast would otherwise have.
   * ============================================================================
   */
  /*
   * ==========================================================================
   * EVERY ROW MEASURED, AND NOT ONE OF THEM IS POSITIVE. Paired, 400 iterations
   * against a 1077.6 baseline. The justification is on `MAGE_ARCANE_TALENTS`.
   *
   * A FIFTH PLACEMENT WAS MEASURED AND IS NOT A ROW HERE, because it needs a
   * condition the shorthand cannot build: gated on `arcane_blast` at max stacks,
   * so the cast can never break the ramp. It runs **IDENTICAL FIGHTS** -- at max
   * stacks the two Arcane Missiles entries above it win, and below max stacks the
   * gate refuses, so there is no state in which it is the top castable entry.
   * **Protecting the ramp is what makes the spell unreachable**, which is the
   * whole finding in one row.
   * ==========================================================================
   */
  arcaneWrath: [
    {
      label: 'arcane_wrath, entry above arcane_blast (measured -77.15 +/- 12.00)',
      apply: chain(tree(ARCANE_WITH_WRATH), addAbove({ abilityId: 'arcane_wrath' }, 'arcane_blast')),
    },
    {
      label: 'arcane_wrath, above the gated arcane_missiles (measured -118.53 +/- 11.59)',
      apply: chain(
        tree(ARCANE_WITH_WRATH),
        addAbove({ abilityId: 'arcane_wrath' }, 'arcane_missiles'),
      ),
    },
    {
      label: 'arcane_wrath, entry at the BOTTOM (IDENTICAL FIGHTS -- never cast)',
      apply: chain(tree(ARCANE_WITH_WRATH), addEntry({ abilityId: 'arcane_wrath' })),
    },
    {
      label: 'arcane_wrath TALENT ONLY, no entry -- the control (IDENTICAL FIGHTS)',
      apply: tree(ARCANE_WITH_WRATH),
    },
  ],

  fireTalents: [
    { label: 'elemental_precision 5 AND missile_barrage 2', apply: tree(FIRE_BOTH) },
    { label: 'back to arcane_subtlety 2 -- the control', apply: tree(FIRE_DEAD_POINTS) },
  ],

  /*
   * ============================================================================
   * THE ENCHANTS, AND ONLY TWO SLOTS HAVE A LIVE QUESTION.
   *
   * The first pass asked the wrong ones and the harness said so loudly: six of
   * eight rows came back `IDENTICAL FIGHTS` with a spread of exactly 0.0, which
   * reads as a patch that did not apply. It was not -- **every one of those six
   * was already the equipped enchant**, so applying it again is a no-op and the
   * labels had the direction backwards. The caster loadout is head +1% Haste,
   * neck +6 Spell Power, chest +4 Stats, wrists +16 Spell Power, gloves +20
   * Spell Power, legs +1% Haste.
   *
   * AND THE CLOAK AND FEET ENCHANTS ARE DEAD BY TABLE RATHER THAN BY CHOICE.
   * The cloak slot offers Dodge, Agility, Armor and Threat; the feet slot
   * offers Defense Skill, Minor Speed, Agility and Stamina. **A caster can read
   * none of the eight**, so -2% Threat and Minor Speed are as good as anything
   * available and `+60 Armor` measuring 0.00 is the right answer rather than a
   * failed variant. Nothing in this group can fix those slots.
   *
   * SO THE QUESTION IS HASTE AGAINST INTELLECT on head and legs, and SPELL
   * POWER AGAINST HASTE on gloves -- and the shipped loadout wins all three.
   * ============================================================================
   */
  mageEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  /*
   * THE LISTS. One question per profile, chosen from where the diagnostic run
   * says the time goes rather than from the shape of the list.
   *
   * ICE LANCE IS THE ONE THAT MOVED: removing its entry is **+74.1** on
   * Frostfire, because Shatter's window raises EVERY spell's crit and Fingers of
   * Frost holds two charges any cast spends -- so an Ice Lance in the window is
   * a charge Frostfire Bolt does not get. Frostfire Bolt goes 12.8 casts a
   * fight to 16.3 and Ignite's share 11.3% to 15.6%.
   */
  mageApl: [
    { label: 'no ice_lance entry', apply: removeEntry('ice_lance') },
    { label: 'no pyroblast entry', apply: removeEntry('pyroblast') },
    { label: 'no arcane_missiles entry', apply: removeEntry('arcane_missiles') },
    { label: 'no scorch entry', apply: removeEntry('scorch') },
    { label: 'no fire_blast entry', apply: removeEntry('fire_blast') },
    { label: 'no presence_of_mind entry', apply: removeEntry('presence_of_mind') },
  ],

  /*
   * THE PRE-COMBAT LISTS. Each Mage opens with Mage Armor and then a cast whose
   * lead is exactly that spell's cast time on that build, so the nuke lands at
   * t=0. What was NOT there is a DoT or a cooldown, and a pre-combat action
   * costs no global cooldown -- which is worth +25.1 (Frostfire Scorch), +15.2
   * (Fire Scorch) and +24.9 (Arcane Power on the Arcane build).
   */
  magePrecombat: [
    { label: 'arcane_power at 0s before', apply: addPrecombat(0, 'arcane_power') },
    { label: 'combustion at 0s before', apply: addPrecombat(0, 'combustion') },
    { label: 'scorch x1 at 1.5s before', apply: addPrecombat(1.5, 'scorch') },
    { label: 'no pre-combat scorch -- the control', apply: removePrecombat('scorch') },
    { label: 'no pre-combat mage_armor', apply: removePrecombat('mage_armor') },
    { label: 'mage_armor lead -> 0s', apply: precombatLead('mage_armor', 0) },
  ],

  /*
   * THE CONSUMABLES, and every alternative LOST on all three -- which is a
   * result rather than an absence of one. The `potion` row is the one worth
   * asking about: none of the three is mana-bound, so a mana potion is the
   * choice to rule OUT rather than to try.
   */
  mageConsumables: [
    { label: 'school power Fire', apply: consumable('school_spell_power', 'school_fire') },
    { label: 'school power Arcane', apply: consumable('school_spell_power', 'school_arcane') },
    { label: 'school power Frost', apply: consumable('school_spell_power', 'school_frost') },
    { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],
};
