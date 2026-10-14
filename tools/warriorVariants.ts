/*
 * The variants `probe_build.ts` measures on 2H Arms and DW Fury.
 *
 * The EDITS live in `buildVariants.ts`; what is here is the Warrior-specific
 * part -- which enchant each slot offers, which trees the tier rule allows, and
 * what the two lists look like.
 *
 * BOTH PROFILES ARE RAGE-BOUND AND NEITHER IS WASTING ANY, which is what the
 * groups below are chosen around: 2H Arms wastes 13 rage of 513 and DW Fury 4
 * of 732. So nothing here is a dump for surplus income -- every rage threshold
 * is a question about which ability the next thirty rage goes to.
 *
 * AND EACH HAS AN ABILITY IN THE BOOK AND IN NO LIST. DW Fury's is
 * RECKLESSNESS -- free, Berserker Stance, +100 crit chance for 15 seconds of a
 * 60-second fight -- and 2H Arms' is Sweeping Strikes, which strikes an
 * additional nearby opponent and is correctly absent from a single-target list.
 */
import {
  type Variant,
  treeFor,
  addAbove,
  addEntry,
  apl,
  chain,
  consumable,
  enchant,
  moveAbove,
  moveToBottom,
} from './buildVariants';
import {
  fightRemaining,
  fightRemainingFraction,
  resource,
  swingIn,
  targetTime,
} from '../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../src/game/rotations/apl';

const tree = treeFor('warrior');

/** Replace one entry's condition, refusing an id the list does not carry. */
const regate = (abilityId: string, condition: AplCondition | undefined) =>
  apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === abilityId);
    if (at < 0) throw new Error('no entry for ' + abilityId);
    const { condition: _drop, ...rest } = entries[at];
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

/* ============================================================ the trees */

/*
 * 2H ARMS -- Arms 39 / Fury 10 / Protection 2, and every LIVE talent in it is
 * already maxed. What is movable is three groups of dead points:
 *
 *   IMPROVED TACTICAL MASTERY 5 retains rage across a stance change, and this
 *   list never changes stance -- the preset opens in Battle and
 *   `battle_stance_cast` fires 0.00 times. Only ONE rank is load-bearing:
 *   Anger Management requires it, and `requiresRanks ?? 1` means one.
 *
 *   SWEEPING STRIKES 1 strikes an additional nearby opponent and there is one
 *   target. It is Mortal Strike's prerequisite, so the point cannot leave.
 *
 *   IMPROVED CHARGE 2 is +6 rage on an ability cast once, at the pull.
 *
 * So the question is where four spare ranks can go, and the answer below is
 * that there is nowhere: Arms' remaining options are Deflection (parry, and
 * nothing attacks this build) and Improved Hamstring (a root); Fury's tier-10
 * row is off-hand hit, a health regeneration proc and a daze; and Protection
 * cannot reach tier 5 on six points.
 */
const ARMS_BASE = {
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_charge: 2,
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
  cruelty: 5,
  unbridled_wrath: 5,
  improved_bloodrage: 2,
};

/*
 * DW FURY -- Arms 17 / Fury 34, and the Fury half sits EXACTLY on its tier-15
 * boundary: Cruelty 5 + Lingering Rage 2 + Unbridled Wrath 5 + Furious
 * Precision 3 is fifteen points, so taking either of Lingering Rage's two
 * strands Dual Wield Specialization, Raging Blows, Enrage AND Improved Execute
 * at once. Both tier-0/5 alternatives are dead -- Booming Voice is shout cost
 * on a shout the raid already provides, Lingering Rage is out-of-combat rage
 * decay -- so two dead points are structurally required.
 *
 * ENRAGE 4 IS THE SAME SHAPE ONE ROW DOWN. "After being the victim of any
 * damaging attack", and `targetAttacks: false` -- it reports no uptime at all.
 * Its four points cannot leave Fury either, because Bloodthirst needs thirty
 * below tier 30 and there are thirty-three. What they CAN do is move within
 * Fury, which is what the variants below try.
 */
const FURY_BASE = {
  improved_heroic_strike: 3,
  improved_rend: 3,
  improved_tactical_mastery: 5,
  anger_management: 1,
  deep_wounds: 3,
  impale: 2,
  cruelty: 5,
  lingering_rage: 2,
  unbridled_wrath: 5,
  furious_precision: 3,
  dual_wield_specialization: 5,
  raging_blows: 1,
  enrage: 4,
  improved_execute: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
};

const RECKLESSNESS: AplEntry = { abilityId: 'recklessness_cast' };

/* ========================================================= 2H Arms groups */

const ARMS_ENCHANTS: readonly Variant[] = [
  // Minor Speed is `unmodelled` -- this slot is currently granting nothing.
  { label: 'feet: Minor Speed -> +7 Agility', apply: enchant('feet', 900026) },
  { label: 'feet: Minor Speed -> +7 Stamina', apply: enchant('feet', 900027) },
  { label: 'head: +8 Strength -> +1% Haste', apply: enchant('head', 900002) },
  { label: 'legs: +8 Strength -> +1% Haste', apply: enchant('legs', 900002) },
  {
    label: 'head and legs: +8 Strength -> +1% Haste',
    apply: chain(enchant('head', 900002), enchant('legs', 900002)),
  },
  { label: 'gloves: +15 Strength -> +1% Haste', apply: enchant('gloves', 900002) },
  { label: 'gloves: +15 Strength -> +15 Agility', apply: enchant('gloves', 900022) },
  { label: 'wrists: +9 Strength -> +9 Agility', apply: enchant('wrists', 900019) },
  { label: 'neck: +5 Strength -> +5 Agility', apply: enchant('neck', 900011) },
  { label: 'cloak: +5 Agility -> +60 Armor', apply: enchant('cloak', 900013) },
  { label: 'two-hander: Crusader -> +25 Agility', apply: enchant('twoHand', 900031) },
];

const ARMS_CONSUMABLES: readonly Variant[] = [
  {
    label: 'Blasted Lands: Strength -> Agility',
    apply: consumable('blasted_lands', 'blasted_agility'),
  },
  // Both options are inert on a build nothing attacks and nothing heals.
  {
    label: 'flask: +1200 Hit Points -> +150 Spell Power',
    apply: consumable('flask', 'flask_spell_power'),
  },
  { label: 'potion: Mighty Rage -> Major Frenzy', apply: consumable('potion', 'major_frenzy_potion') },
  // The owner RULED strength food for this preset; measured for the record.
  { label: 'food: +20 Strength -> +20 Agility', apply: consumable('food', 'food_agility') },
  {
    label: 'food: +20 Strength -> +40 Attack Power',
    apply: consumable('food', 'food_attack_power'),
  },
  {
    label: 'weapon: +2% Melee Crit -> caster stone',
    apply: consumable('weapon_effect', 'weapon_spell_crit'),
  },
];

const ARMS_TALENTS: readonly Variant[] = [
  {
    label: 'Tactical Mastery 5->1, four into Fury hit',
    apply: tree({
      ...ARMS_BASE,
      improved_tactical_mastery: 1,
      furious_precision: 3,
      piercing_howl: 1,
    }),
  },
  {
    label: 'Tactical Mastery 5->1, four into Blood Craze',
    apply: tree({
      ...ARMS_BASE,
      improved_tactical_mastery: 1,
      blood_craze: 3,
      piercing_howl: 1,
    }),
  },
  {
    label: 'Tactical Mastery 5->1, four into Iron Will',
    apply: tree({ ...ARMS_BASE, improved_tactical_mastery: 1, iron_will: 4 }),
  },
  // Prices the point, by moving it somewhere known to be worth nothing.
  {
    label: 'price Improved Charge: 2 -> Deflection',
    apply: tree({ ...ARMS_BASE, improved_charge: 0, deflection: 2 }),
  },
  {
    label: 'price Spearing Strike: 1 -> Deflection',
    apply: tree({ ...ARMS_BASE, spearing_strike: 0, deflection: 1 }),
  },
];

const ARMS_APL: readonly Variant[] = [
  /*
   * RECKLESSNESS NEEDS A STANCE DANCE HERE and does not on DW Fury, which is
   * what makes the pair worth measuring together: `PriorityRotation` will cast
   * a stance change to reach an ability, and this list's own
   * `battle_stance_cast` entry sits above Heroic Strike and brings it back. So
   * the price is two global cooldowns and whatever rage Tactical Mastery does
   * not retain -- and those five points are currently dead, so if the dance
   * pays, it pays twice.
   */
  { label: 'add Recklessness above Heroic Strike', apply: addAbove(RECKLESSNESS, 'heroic_strike') },
  {
    label: 'add Recklessness in the execute phase',
    apply: addAbove(
      { ...RECKLESSNESS, condition: fightRemainingFraction('atMost', 0.2) },
      'heroic_strike',
    ),
  },
  { label: 'add Recklessness at the bottom', apply: addEntry(RECKLESSNESS) },
  // The Heroic Strike dump, swept rather than compared at two points.
  {
    label: 'Heroic Strike at 50 rage',
    apply: regate('heroic_strike', resource('atLeast', 50, 'rage')),
  },
  {
    label: 'Heroic Strike at 60 rage',
    apply: regate('heroic_strike', resource('atLeast', 60, 'rage')),
  },
  {
    label: 'Heroic Strike at 70 rage',
    apply: regate('heroic_strike', resource('atLeast', 70, 'rage')),
  },
  {
    label: 'Heroic Strike at 80 rage',
    apply: regate('heroic_strike', resource('atLeast', 80, 'rage')),
  },
  {
    label: 'Heroic Strike at 100 rage',
    apply: regate('heroic_strike', resource('atLeast', 100, 'rage')),
  },
  { label: 'Heroic Strike to the bottom', apply: moveToBottom('heroic_strike') },
  // Overpower is 16.0% of this profile at 83.3% crit; it sits fourth.
  { label: 'Overpower above Heroic Strike', apply: moveAbove('overpower', 'heroic_strike') },
  { label: 'Mortal Strike above Slam', apply: moveAbove('mortal_strike', 'slam') },
  { label: 'Mortal Strike to the top', apply: moveAbove('mortal_strike', 'heroic_strike') },
  // The swing window Slam is squeezed into.
  { label: 'Slam window 500ms', apply: regate('slam', swingIn('above', 500)) },
  { label: 'Slam window 750ms', apply: regate('slam', swingIn('above', 750)) },
  { label: 'Slam window 1500ms', apply: regate('slam', swingIn('above', 1500)) },
  { label: 'Slam window 2000ms', apply: regate('slam', swingIn('above', 2000)) },
  { label: 'Slam ungated', apply: regate('slam', undefined) },
  { label: 'Execute above Slam', apply: moveAbove('execute', 'slam') },
  { label: 'Execute above Overpower', apply: moveAbove('execute', 'overpower') },
  /*
   * A REFRESH WINDOW CLIPS, so `if not active` is the project's rule -- this
   * confirms the two-second window other lists use is worse here rather than
   * assuming it.
   */
  {
    label: 'Rend refreshed with 2s left',
    apply: regate('rend_cast', targetTime('below', 2, 'rend')),
  },
  // Two more damage abilities in the book and in no list, both Battle Stance.
  { label: 'add Thunder Clap at the bottom', apply: addEntry({ abilityId: 'thunder_clap' }) },
  { label: 'add Hamstring at the bottom', apply: addEntry({ abilityId: 'hamstring' }) },
  {
    label: 'add Sweeping Strikes at the bottom',
    apply: addEntry({ abilityId: 'sweeping_strikes' }),
  },
];

/* ========================================================= DW Fury groups */

const FURY_ENCHANTS: readonly Variant[] = [
  { label: 'head: +8 Strength -> +1% Haste', apply: enchant('head', 900002) },
  { label: 'legs: +8 Strength -> +1% Haste', apply: enchant('legs', 900002) },
  {
    label: 'head and legs: +8 Strength -> +1% Haste',
    apply: chain(enchant('head', 900002), enchant('legs', 900002)),
  },
  { label: 'gloves: +15 Strength -> +1% Haste', apply: enchant('gloves', 900002) },
  { label: 'gloves: +15 Strength -> +15 Agility', apply: enchant('gloves', 900022) },
  { label: 'wrists: +9 Strength -> +9 Agility', apply: enchant('wrists', 900019) },
  { label: 'neck: +5 Strength -> +5 Agility', apply: enchant('neck', 900011) },
  { label: 'feet: +7 Agility -> +7 Stamina', apply: enchant('feet', 900027) },
  { label: 'cloak: +5 Agility -> +60 Armor', apply: enchant('cloak', 900013) },
  { label: 'main hand: Crusader -> +25 Agility', apply: enchant('mainHand', 900031) },
  { label: 'off hand: Crusader -> +25 Agility', apply: enchant('offHand', 900031) },
  {
    label: 'both hands: Crusader -> +25 Agility',
    apply: chain(enchant('mainHand', 900031), enchant('offHand', 900031)),
  },
];

const FURY_CONSUMABLES: readonly Variant[] = [
  {
    label: 'Blasted Lands: Strength -> Agility',
    apply: consumable('blasted_lands', 'blasted_agility'),
  },
  {
    label: 'flask: +1200 Hit Points -> +150 Spell Power',
    apply: consumable('flask', 'flask_spell_power'),
  },
  { label: 'potion: Mighty Rage -> Major Frenzy', apply: consumable('potion', 'major_frenzy_potion') },
  { label: 'food: +20 Strength -> +20 Agility', apply: consumable('food', 'food_agility') },
  {
    label: 'food: +20 Strength -> +40 Attack Power',
    apply: consumable('food', 'food_attack_power'),
  },
  {
    label: 'weapon: +2% Melee Crit -> caster stone',
    apply: consumable('weapon_effect', 'weapon_spell_crit'),
  },
];

const FURY_TALENTS: readonly Variant[] = [
  {
    label: 'Enrage 4 -> Imp Berserker Rage 2 + Blood Craze 2',
    apply: tree({ ...FURY_BASE, enrage: 0, improved_berserker_rage: 2, blood_craze: 2 }),
  },
  {
    label: 'Enrage 4 -> Imp Berserker Rage 2 + Booming Voice 2',
    apply: tree({ ...FURY_BASE, enrage: 0, improved_berserker_rage: 2, booming_voice: 2 }),
  },
  {
    label: 'Enrage 4 -> Blood Craze 3 + Piercing Howl 1',
    apply: tree({ ...FURY_BASE, enrage: 0, blood_craze: 3, piercing_howl: 1 }),
  },
  {
    label: 'Lingering Rage 2 -> Booming Voice 2',
    apply: tree({ ...FURY_BASE, lingering_rage: 0, booming_voice: 2 }),
  },
  // Prices Improved Rend, which this list cannot cast Rend to use.
  {
    label: 'price Improved Rend: 3 -> 1 + Deflection 2',
    apply: tree({ ...FURY_BASE, improved_rend: 1, deflection: 2 }),
  },
  {
    label: 'price Impale: 2 -> Deflection',
    apply: tree({ ...FURY_BASE, impale: 0, deflection: 2 }),
  },
  {
    label: 'price Furious Precision: 3 -> Blood Craze',
    apply: tree({ ...FURY_BASE, furious_precision: 0, blood_craze: 3 }),
  },
];

const FURY_APL: readonly Variant[] = [
  /*
   * THE ONE ABILITY IN THIS BUILD'S BOOK AND IN NO LIST. Free, 30-minute
   * cooldown, Berserker Stance -- which this list never leaves -- and +100
   * crit chance for fifteen seconds of a sixty-second fight. Five placements,
   * because a fifteen-second window on a once-a-fight cooldown is entirely a
   * question of WHEN.
   */
  { label: 'add Recklessness at the pull', apply: addAbove(RECKLESSNESS, 'bloodrage_cast') },
  { label: 'add Recklessness above Death Wish', apply: addAbove(RECKLESSNESS, 'death_wish') },
  {
    label: 'add Recklessness with Death Wish (35s left)',
    apply: addAbove({ ...RECKLESSNESS, condition: fightRemaining('atMost', 35) }, 'death_wish'),
  },
  {
    label: 'add Recklessness in the execute phase',
    apply: addAbove(
      { ...RECKLESSNESS, condition: fightRemainingFraction('atMost', 0.2) },
      'execute',
    ),
  },
  { label: 'add Recklessness at the bottom', apply: addEntry(RECKLESSNESS) },
  // The other book-and-no-list entry; worth 10 rage a cast WITH the talent.
  {
    label: 'add Berserker Rage at the bottom',
    apply: addEntry({ abilityId: 'berserker_rage_cast' }),
  },
  {
    label: 'add Berserker Rage under 30 rage',
    apply: addAbove(
      { abilityId: 'berserker_rage_cast', condition: resource('below', 30, 'rage') },
      'heroic_strike',
    ),
  },
  // Heroic Strike is 27.0% of this profile and 234 of its 732 rage.
  {
    label: 'Heroic Strike at 30 rage',
    apply: regate('heroic_strike', resource('atLeast', 30, 'rage')),
  },
  {
    label: 'Heroic Strike at 36 rage',
    apply: regate('heroic_strike', resource('atLeast', 36, 'rage')),
  },
  {
    label: 'Heroic Strike at 50 rage',
    apply: regate('heroic_strike', resource('atLeast', 50, 'rage')),
  },
  {
    label: 'Heroic Strike at 60 rage',
    apply: regate('heroic_strike', resource('atLeast', 60, 'rage')),
  },
  {
    label: 'Heroic Strike at 70 rage',
    apply: regate('heroic_strike', resource('atLeast', 70, 'rage')),
  },
  { label: 'Heroic Strike below Bloodthirst', apply: moveAbove('heroic_strike', 'whirlwind') },
  { label: 'Heroic Strike to the bottom', apply: moveToBottom('heroic_strike') },
  { label: 'Bloodthirst above Execute', apply: moveAbove('bloodthirst', 'execute') },
  { label: 'Whirlwind above Bloodthirst', apply: moveAbove('whirlwind', 'bloodthirst') },
  { label: 'Whirlwind above Heroic Strike', apply: moveAbove('whirlwind', 'heroic_strike') },
  { label: 'Execute to the bottom', apply: moveToBottom('execute') },
  { label: 'Death Wish ungated', apply: regate('death_wish', undefined) },
  { label: 'Death Wish at 30s left', apply: regate('death_wish', fightRemaining('atMost', 30)) },
  { label: 'Death Wish at 45s left', apply: regate('death_wish', fightRemaining('atMost', 45)) },
  { label: 'add Hamstring at the bottom', apply: addEntry({ abilityId: 'hamstring' }) },
  { label: 'add Cleave at the bottom', apply: addEntry({ abilityId: 'cleave' }) },
  {
    label: 'add Cleave above Heroic Strike at 70 rage',
    apply: addAbove(
      { abilityId: 'cleave', condition: resource('atLeast', 70, 'rage') },
      'heroic_strike',
    ),
  },
];

/* ===================================================== round two: the pairs */

/*
 * MARGINAL VALUES DO NOT SUM, AND BOTH OF THIS ROUND'S FINDINGS WANT THE
 * BOTTOM OF THE ARMS LIST. Recklessness measured +40.2 there and Hamstring
 * +29.6, and only one of them can be last -- so the combination is measured as
 * a combination, the way the Cat's Ferocious Bite and Mighty Rage Potion were
 * (+3.6 and +8.4 alone, -1.6 together).
 */
const HAMSTRING: AplEntry = { abilityId: 'hamstring' };

const ARMS_PAIRS: readonly Variant[] = [
  { label: 'Recklessness last', apply: addEntry(RECKLESSNESS) },
  { label: 'Hamstring last', apply: addEntry(HAMSTRING) },
  {
    label: 'Recklessness last, Hamstring above it',
    apply: chain(addEntry(HAMSTRING), addEntry(RECKLESSNESS)),
  },
  {
    label: 'Hamstring last, Recklessness above it',
    apply: chain(addEntry(RECKLESSNESS), addEntry(HAMSTRING)),
  },
  {
    label: 'Recklessness last, Hamstring at 20 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 20, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
  {
    label: 'Recklessness last, Hamstring at 40 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 40, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
  {
    label: 'Recklessness last, Hamstring at 60 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 60, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
  {
    label: 'Recklessness above Heroic Strike, Hamstring last',
    apply: chain(addAbove(RECKLESSNESS, 'heroic_strike'), addEntry(HAMSTRING)),
  },
];

/*
 * THE THREE BEST RECKLESSNESS PLACEMENTS ARE INSIDE EACH OTHER'S INTERVALS at
 * 400 iterations -- +89.9, +88.3 and +83.6 against +/- 9 to 12 -- so they are
 * re-measured together rather than read off the first run's ordering.
 *
 * AND IMPROVED BERSERKER RAGE IS MEASURED WITH ITS LIST ENTRY. The talent
 * alone ran bit-identical fights, which is this project's fourth cause of
 * inert: no list casts Berserker Rage, so the rage it grants on activation has
 * nowhere to arrive.
 */
const BERSERKER_RAGE_TREE = {
  ...FURY_BASE,
  enrage: 0,
  improved_berserker_rage: 2,
  blood_craze: 2,
};

const FURY_PAIRS: readonly Variant[] = [
  {
    label: 'Recklessness with Death Wish (35s left)',
    apply: addAbove({ ...RECKLESSNESS, condition: fightRemaining('atMost', 35) }, 'death_wish'),
  },
  { label: 'Recklessness last', apply: addEntry(RECKLESSNESS) },
  { label: 'Recklessness above Death Wish', apply: addAbove(RECKLESSNESS, 'death_wish') },
  {
    label: 'Recklessness at 35s + Whirlwind above Heroic Strike',
    apply: chain(
      addAbove({ ...RECKLESSNESS, condition: fightRemaining('atMost', 35) }, 'death_wish'),
      moveAbove('whirlwind', 'heroic_strike'),
    ),
  },
  {
    label: 'Recklessness at 35s + Imp Berserker Rage 2 and its entry',
    apply: chain(
      tree(BERSERKER_RAGE_TREE),
      addAbove({ ...RECKLESSNESS, condition: fightRemaining('atMost', 35) }, 'death_wish'),
      addEntry({ abilityId: 'berserker_rage_cast' }),
    ),
  },
  {
    label: 'Imp Berserker Rage 2 and its entry, alone',
    apply: chain(tree(BERSERKER_RAGE_TREE), addEntry({ abilityId: 'berserker_rage_cast' })),
  },
  {
    label: 'Imp Berserker Rage 2, its entry under 30 rage',
    apply: chain(
      tree(BERSERKER_RAGE_TREE),
      addAbove(
        { abilityId: 'berserker_rage_cast', condition: resource('below', 30, 'rage') },
        'heroic_strike',
      ),
    ),
  },
  { label: 'Whirlwind above Heroic Strike', apply: moveAbove('whirlwind', 'heroic_strike') },
];

/* ============================== round three: the thresholds, re-swept */

/*
 * A CRIT PAYS A WARRIOR DOUBLE RAGE, so fifteen seconds at +100 crit chance is
 * fifteen seconds of roughly doubled rage income -- which is exactly the
 * quantity every threshold in these two lists is set against. So the sweeps
 * are taken again WITH the new entries in rather than carried over from the
 * runs that chose them: a peer change to a profile invalidates that profile's
 * deltas even when the mechanism is untouched.
 */
const ARMS_BEST = chain(
  addEntry({ ...HAMSTRING, condition: resource('atLeast', 20, 'rage') }),
  addEntry(RECKLESSNESS),
);

const ARMS_THRESHOLDS: readonly Variant[] = [
  { label: 'best, as chosen (Hamstring at 20)', apply: ARMS_BEST },
  {
    label: 'Hamstring at 10 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 10, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
  {
    label: 'Hamstring at 30 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 30, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
  {
    label: 'Hamstring ungated',
    apply: chain(addEntry(HAMSTRING), addEntry(RECKLESSNESS)),
  },
  {
    label: 'best + Heroic Strike at 70 rage',
    apply: chain(ARMS_BEST, regate('heroic_strike', resource('atLeast', 70, 'rage'))),
  },
  {
    label: 'best + Heroic Strike at 80 rage',
    apply: chain(ARMS_BEST, regate('heroic_strike', resource('atLeast', 80, 'rage'))),
  },
  {
    label: 'best + Heroic Strike at 100 rage',
    apply: chain(ARMS_BEST, regate('heroic_strike', resource('atLeast', 100, 'rage'))),
  },
  {
    label: 'best + Slam window 1500ms',
    apply: chain(ARMS_BEST, regate('slam', swingIn('above', 1500))),
  },
];

const FURY_BEST = addAbove(RECKLESSNESS, 'death_wish');

const FURY_THRESHOLDS: readonly Variant[] = [
  { label: 'best, as chosen (Recklessness above Death Wish)', apply: FURY_BEST },
  {
    label: 'best + Imp Berserker Rage 2, entry last',
    apply: chain(tree(BERSERKER_RAGE_TREE), FURY_BEST, addEntry({ abilityId: 'berserker_rage_cast' })),
  },
  {
    label: 'best + Imp Berserker Rage 2, entry above Heroic Strike',
    apply: chain(
      tree(BERSERKER_RAGE_TREE),
      FURY_BEST,
      addAbove({ abilityId: 'berserker_rage_cast' }, 'heroic_strike'),
    ),
  },
  {
    label: 'best + Heroic Strike at 36 rage',
    apply: chain(FURY_BEST, regate('heroic_strike', resource('atLeast', 36, 'rage'))),
  },
  {
    label: 'best + Heroic Strike at 50 rage',
    apply: chain(FURY_BEST, regate('heroic_strike', resource('atLeast', 50, 'rage'))),
  },
  {
    label: 'best + Heroic Strike at 60 rage',
    apply: chain(FURY_BEST, regate('heroic_strike', resource('atLeast', 60, 'rage'))),
  },
  {
    label: 'best + Death Wish at 30s left',
    apply: chain(FURY_BEST, regate('death_wish', fightRemaining('atMost', 30))),
  },
  {
    label: 'best + Whirlwind above Heroic Strike',
    apply: chain(FURY_BEST, moveAbove('whirlwind', 'heroic_strike')),
  },
];

/* ===================== round four: the two readings that were not separated */

/*
 * TWO VARIANTS MEASURED AGAINST THE SAME BASELINE ARE NOT PAIRED WITH EACH
 * OTHER, so a 5.4 difference between two rows each carrying +/- 4.8 is not a
 * finding -- and ninety rage is the OWNER'S number, respecified from 75, which
 * is exactly the kind of decision that needs the interval to be smaller than
 * the claim. Four thousand iterations halves it.
 */
const ARMS_FINAL: readonly Variant[] = [
  { label: 'the pick: Hamstring at 20, Recklessness last', apply: ARMS_BEST },
  {
    label: 'the pick + Heroic Strike at 70 rage',
    apply: chain(ARMS_BEST, regate('heroic_strike', resource('atLeast', 70, 'rage'))),
  },
  {
    label: 'the pick + Heroic Strike at 80 rage',
    apply: chain(ARMS_BEST, regate('heroic_strike', resource('atLeast', 80, 'rage'))),
  },
  {
    label: 'the pick + Hamstring at 30 rage',
    apply: chain(
      addEntry({ ...HAMSTRING, condition: resource('atLeast', 30, 'rage') }),
      addEntry(RECKLESSNESS),
    ),
  },
];

/*
 * ENRAGE 2 RATHER THAN ENRAGE 0 IS THE SMALLEST EDIT THAT WORKS, and the three
 * dead destinations measured bit-identical to each other, so the choice is a
 * question of legibility rather than of DPS: two of Enrage's four points buy
 * Improved Berserker Rage and the other two stay where the owner put them.
 */
const FURY_BERSERKER_TREE = { ...FURY_BASE, enrage: 2, improved_berserker_rage: 2 };

const FURY_FINAL: readonly Variant[] = [
  { label: 'Recklessness above Death Wish, alone', apply: FURY_BEST },
  {
    label: 'the pick: + Enrage 2, Imp Berserker Rage 2, entry last',
    apply: chain(
      tree(FURY_BERSERKER_TREE),
      FURY_BEST,
      addEntry({ abilityId: 'berserker_rage_cast' }),
    ),
  },
  {
    label: 'same, with Blood Craze 2 holding the other two',
    apply: chain(
      tree(BERSERKER_RAGE_TREE),
      FURY_BEST,
      addEntry({ abilityId: 'berserker_rage_cast' }),
    ),
  },
  {
    label: 'the pick + Death Wish at 30s left',
    apply: chain(
      tree(FURY_BERSERKER_TREE),
      FURY_BEST,
      addEntry({ abilityId: 'berserker_rage_cast' }),
      regate('death_wish', fightRemaining('atMost', 30)),
    ),
  },
];

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  arms_final: ARMS_FINAL,
  fury_final: FURY_FINAL,
  arms_thresholds: ARMS_THRESHOLDS,
  fury_thresholds: FURY_THRESHOLDS,
  arms_enchants: ARMS_ENCHANTS,
  arms_consumables: ARMS_CONSUMABLES,
  arms_talents: ARMS_TALENTS,
  arms_apl: ARMS_APL,
  arms_pairs: ARMS_PAIRS,
  fury_enchants: FURY_ENCHANTS,
  fury_consumables: FURY_CONSUMABLES,
  fury_talents: FURY_TALENTS,
  fury_apl: FURY_APL,
  fury_pairs: FURY_PAIRS,
};
