/*
 * The variants `probe_build.ts` measures on the Moonkin and the Cat.
 *
 * The EDITS live in `buildVariants.ts`; what is here is the Druid-specific
 * part -- which enchant ids each slot offers, which trees the tier rule allows,
 * and what the two lists look like.
 *
 * THE TWO PROFILES BIND ON DIFFERENT THINGS, which is what the groups below are
 * chosen around. The Moonkin is GLOBAL-COOLDOWN bound and finishes a fight with
 * about 2,800 of 8,237 mana unspent; the Cat is COMBO-POINT bound and throws
 * away **13 of the 27 points it generates**, because its only finisher is a Rip
 * it may cast once every sixteen seconds.
 */
import {
  type Variant,
  DRUID_TREE as tree,
  addEntry,
  addAbove,
  consumable,
  enchant,
  moveAbove,
  removeEntry,
} from './buildVariants';
import {
  all,
  comboPoints,
  resource,
  selfHas,
  targetTime,
  targetExpired,
  targetHas,
} from '../src/game/rotations/apl/shorthand';
import type { AplEntry } from '../src/game/rotations/apl';

/* ------------------------------------------------------------- the trees */

/**
 * MOONKIN -- Balance 38 / Restoration 13, and the shape is forced at both ends.
 *
 * Moonkin Form is tier 30 of Balance, so thirty points sit below it; Restoration
 * carries Naturalist, which is **+5% of everything** at tier 5 and therefore
 * needs five points under it. Nature's Focus is those five and is pure filler --
 * cast pushback, which is out of scope.
 */
const MOONKIN_BALANCE_CORE = {
  improved_wrath: 5,
  improved_moonfire: 2,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  nature_s_splendor: 1,
  insect_swarm: 1,
  vengeance: 5,
  improved_starfire: 5,
  nature_s_grace: 1,
  eclipse: 3,
  moonfury: 5,
  moonkin_form: 1,
};

/**
 * CAT -- Balance 9 / Feral 34 / Restoration 8.
 *
 * Berserk is tier 30 of Feral and Rend and Tear tier 25, so Feral is deep by
 * necessity. What is NOT forced: Nature's Reach's two points are **+4% spell
 * hit on a build that casts no spells**, and Feral Swiftness's two are movement
 * and dodge on a profile nothing attacks.
 */
const CAT_FERAL_CORE = {
  ferocity: 3,
  heart_of_the_wild: 5,
  shredding_attacks: 3,
  savage_fury: 2,
  sharpened_claws: 2,
  shifting_power: 1,
  predatory_strikes: 3,
  blood_frenzy: 2,
  improved_shifting_power: 2,
  leader_of_the_pack: 1,
  predatory_instincts: 2,
  rend_and_tear: 5,
  berserk: 1,
};

/* ------------------------------------------------------------ the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * THE MOONKIN'S TWO DEAD ENCHANTS. Its cloak carries -2% Threat and its boots
   * Minor Speed -- both `unmodelled`, both worth exactly nothing, and both in
   * slots that offer a real stat instead.
   */
  moonkinEnchants: [
    { label: 'cloak +5 Agility (was -2% Threat)', apply: enchant('cloak', 900011) },
    { label: 'cloak +60 Armor', apply: enchant('cloak', 900013) },
    { label: 'feet +7 Agility (was Minor Speed)', apply: enchant('feet', 900026) },
    { label: 'feet +7 Stamina', apply: enchant('feet', 900027) },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'head +8 Spirit', apply: enchant('head', 900007) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'wrists +9 Strength (was +16 Spell Power)', apply: enchant('wrists', 900017) },
    { label: 'neck +5 Agility (was +6 Spell Power)', apply: enchant('neck', 900011) },
    { label: 'twoHand +25 Agility (was +65 Spell Power)', apply: enchant('twoHand', 900031) },
  ],

  /*
   * THE CAT'S, and the question is STRENGTH rather than haste: a Druid is two
   * attack power per point of strength against one per agility, which is why
   * `STRENGTH_CONSUMABLES` exists for this profile where a Rogue takes agility.
   * Whether that beats agility's crit is what these measure.
   */
  catEnchants: [
    { label: 'head +8 Strength (was +8 Agility)', apply: enchant('head', 900005) },
    { label: 'head +1% Haste', apply: enchant('head', 900002) },
    { label: 'legs +8 Strength (was +8 Agility)', apply: enchant('legs', 900005) },
    { label: 'gloves +15 Strength (was +15 Agility)', apply: enchant('gloves', 900021) },
    { label: 'gloves +1% Haste', apply: enchant('gloves', 900002) },
    { label: 'wrists +9 Strength (was +9 Agility)', apply: enchant('wrists', 900017) },
    { label: 'neck +5 Strength (was +5 Agility)', apply: enchant('neck', 900008) },
    { label: 'feet +7 Stamina (was +7 Agility)', apply: enchant('feet', 900027) },
    { label: 'twoHand +25 Agility (was Crusader)', apply: enchant('twoHand', 900031) },
    { label: 'twoHand +65 Spell Power', apply: enchant('twoHand', 900029) },
  ],

  moonkinConsumables: [
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'blasted lands +25 Agility', apply: consumable('blasted_lands', 'blasted_agility') },
    { label: 'school power Nature (was Arcane)', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'weapon effect +2% melee crit (was spell)', apply: consumable('weapon_effect', 'weapon_melee_crit') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'flask +1200 Hit Points (was +150 SP)', apply: consumable('flask', 'flask_hit_points') },
    { label: 'food +20 Intellect? -> +20 Spirit', apply: consumable('food', 'food_spirit') },
  ],

  catConsumables: [
    { label: 'blasted lands +25 Agility (was Strength)', apply: consumable('blasted_lands', 'blasted_agility') },
    { label: 'food +20 Agility (was +20 Strength)', apply: consumable('food', 'food_agility') },
    { label: 'food +40 Attack Power', apply: consumable('food', 'food_attack_power') },
    { label: 'potion Mighty Rage (was Frenzy)', apply: consumable('potion', 'mighty_rage_potion') },
    { label: 'other Demonic Rune (was Thistle Tea)', apply: consumable('other', 'demonic_rune') },
    { label: 'weapon effect +1% spell crit (was melee)', apply: consumable('weapon_effect', 'weapon_spell_crit') },
  ],

  /*
   * THE MOONKIN'S MANA TALENTS, which are eight points between Moonglow and
   * Reflection on a build that finishes with 2,800 unspent. Genesis is where
   * they would go: +1% periodic a rank, on the 28% of this profile that is
   * Moonfire and Insect Swarm.
   */
  moonkinTalents: [
    {
      label: 'Moonglow 3 -> Genesis 5 (was Genesis 2)',
      apply: tree({
        ...MOONKIN_BALANCE_CORE,
        genesis: 5,
        nature_s_focus: 5,
        naturalist: 5,
        reflection: 3,
      }),
    },
    {
      label: 'Reflection 3 -> Genesis 5 (Resto down to 10)',
      apply: tree({
        ...MOONKIN_BALANCE_CORE,
        genesis: 5,
        moonglow: 3,
        nature_s_focus: 5,
        naturalist: 5,
      }),
    },
    {
      label: 'Both -> Genesis 5 + Improved Entangling Roots 3',
      apply: tree({
        ...MOONKIN_BALANCE_CORE,
        genesis: 5,
        improved_entangling_roots: 3,
        nature_s_focus: 5,
        naturalist: 5,
      }),
    },
    {
      /* The control: is Nature's Reach's +4% spell hit reaching the cap? */
      label: "Nature's Reach 2 -> Moonglow (is hit already capped?)",
      apply: tree({
        ...MOONKIN_BALANCE_CORE,
        nature_s_reach: 0,
        genesis: 2,
        moonglow: 5,
        nature_s_focus: 5,
        naturalist: 5,
        reflection: 3,
      }),
    },
  ],

  /*
   * THE CAT'S FOUR DEAD POINTS. Nature's Reach is +4% SPELL hit on a profile
   * whose damage is entirely physical, and Feral Swiftness is movement speed
   * and dodge on one nothing attacks. Naturalist is +1% of EVERYTHING a rank.
   */
  catTalents: [
    {
      label: "Nature's Reach 2 -> Naturalist 5 (was 3)",
      apply: tree({
        genesis: 5,
        nature_s_majesty: 2,
        ...CAT_FERAL_CORE,
        feral_swiftness: 2,
        furor: 5,
        naturalist: 5,
      }),
    },
    {
      label: "Nature's Reach 2 + Feral Swiftness 2 -> Naturalist 5 + Ferocity 5",
      apply: tree({
        genesis: 5,
        nature_s_majesty: 2,
        ...CAT_FERAL_CORE,
        ferocity: 5,
        furor: 5,
        naturalist: 5,
      }),
    },
    {
      label: "both -> Naturalist 5 + Savage Fury stays, Sharpened Claws 2 -> Natural Reaction",
      apply: tree({
        genesis: 5,
        nature_s_majesty: 2,
        ...CAT_FERAL_CORE,
        feral_instinct: 2,
        furor: 5,
        naturalist: 5,
      }),
    },
    {
      /* The control: what is Genesis worth on a build that is 29% bleed? */
      label: 'Genesis 5 -> 0, into Feral Instinct (control)',
      apply: tree({
        genesis: 0,
        improved_wrath: 5,
        nature_s_majesty: 2,
        nature_s_reach: 2,
        ...CAT_FERAL_CORE,
        feral_swiftness: 2,
        furor: 5,
        naturalist: 3,
      }),
    },
  ],

  /*
   * ============================================================================
   * THE CAT'S COMBO POINTS, WHICH IS THE BIGGEST THING ON EITHER PROFILE.
   *
   * It generates 27 a fight -- 11 from Shred, 11 from Blood Frenzy's crit proc,
   * 5 from Rake -- and spends 24 on Rip. **Thirteen are thrown away**, because
   * Rip is the only finisher in the list and it is gated on five points AND on
   * Rip having expired, which is once every sixteen seconds.
   *
   * FEROCIOUS BITE IS IN THE BOOK AND IN NO LIST, which is the Hunter's Arcane
   * Shot again: 35 energy, spends whatever is on the bar, and nothing else in
   * the list can absorb an overflow.
   * ============================================================================
   */
  catFinisher: [
    {
      label: '+ Ferocious Bite at the bottom, ungated',
      apply: addEntry({ abilityId: 'ferocious_bite' }),
    },
    {
      label: '+ Ferocious Bite at 5 points, below Shred',
      apply: addEntry({
        abilityId: 'ferocious_bite',
        condition: comboPoints('atLeast', 5),
      }),
    },
    {
      label: '+ Ferocious Bite at 5 points, above Shred',
      apply: addAbove(
        { abilityId: 'ferocious_bite', condition: comboPoints('atLeast', 5) },
        'shred',
      ),
    },
    {
      label: '+ Ferocious Bite at 5 points while Rip is up, above Shred',
      apply: addAbove(
        {
          abilityId: 'ferocious_bite',
          condition: all(comboPoints('atLeast', 5), targetHas('rip')),
        },
        'shred',
      ),
    },
    {
      label: '+ Ferocious Bite at 4 points while Rip is up, above Shred',
      apply: addAbove(
        {
          abilityId: 'ferocious_bite',
          condition: all(comboPoints('atLeast', 4), targetHas('rip')),
        },
        'shred',
      ),
    },
  ],

  /*
   * THE RESOURCE THRESHOLDS, SWEPT RATHER THAN COMPARED AT TWO POINTS -- a
   * two-point comparison cannot see a peak, and a gate is one number whose
   * whole range costs the same measurement each.
   *
   * SHIFTING POWER'S CEILING IS THE OWNER'S OWN 50, chosen ten energy inside
   * the no-waste region rather than on its edge: the ability grants 40 into a
   * cap of 100, so anything at or below 60 wastes nothing.
   */
  catThresholds: [
    ...[30, 40, 60, 70].map((energy) => ({
      label: `Shifting Power at energy <= ${energy} (owner: 50)`,
      apply: ((e: number) => (profile: Parameters<Variant['apply']>[0]) => ({
        ...profile,
        rotation: {
          ...profile.rotation,
          source: 'custom' as const,
          entries: profile.rotation.entries.map((entry) =>
            entry.abilityId === 'shifting_power'
              ? { ...entry, condition: resource('atMost', e, 'energy') }
              : entry,
          ) as readonly AplEntry[],
        },
      }))(energy),
    })),
    ...[0, 15, 50].map((floor) => ({
      label: `Berserk at energy >= ${floor} (list: 30)`,
      apply: ((f: number) => (profile: Parameters<Variant['apply']>[0]) => ({
        ...profile,
        rotation: {
          ...profile.rotation,
          source: 'custom' as const,
          entries: profile.rotation.entries.map((entry) =>
            entry.abilityId === 'berserk'
              ? {
                  ...entry,
                  condition: all(
                    resource('atLeast', f, 'energy'),
                    targetTime('atLeast', 2, 'rake'),
                  ),
                }
              : entry,
          ) as readonly AplEntry[],
        },
      }))(floor),
    })),
    ...[3, 4].map((points) => ({
      label: `Rip at ${points} combo points (list: 5)`,
      apply: ((p: number) => (profile: Parameters<Variant['apply']>[0]) => ({
        ...profile,
        rotation: {
          ...profile.rotation,
          source: 'custom' as const,
          entries: profile.rotation.entries.map((entry) =>
            entry.abilityId === 'rip'
              ? {
                  ...entry,
                  condition: all(comboPoints('atLeast', p), targetExpired('rip')),
                }
              : entry,
          ) as readonly AplEntry[],
        },
      }))(points),
    })),
  ],

  /* The three calls that sat inside their own interval at 800 iterations. */
  druidMarginal: [
    { label: 'CAT potion Mighty Rage (was Frenzy)', apply: consumable('potion', 'mighty_rage_potion') },
    {
      label: 'CAT + Ferocious Bite at 5 points, at the bottom',
      apply: addEntry({ abilityId: 'ferocious_bite', condition: comboPoints('atLeast', 5) }),
    },
    { label: 'MOONKIN Moonfire below Insect Swarm', apply: moveAbove('insect_swarm', 'moonfire') },
  ],

  /*
   * MIGHTY RAGE AGAINST FRENZY, AND WHETHER THE OWNER'S "HOLD IT FOR BERSERK"
   * SURVIVES THE SWAP. The Cat's list excludes the generic Frenzy entry and
   * re-adds it gated on Berserk; the generic MIGHTY RAGE entry is gated on rage
   * instead, which a Cat reads as zero, so it fires at the pull.
   */
  catPotion: [
    { label: 'Mighty Rage, at the pull (the generic entry)', apply: consumable('potion', 'mighty_rage_potion') },
    {
      label: 'Mighty Rage, held for Berserk',
      apply: (profile) => ({
        ...consumable('potion', 'mighty_rage_potion')(profile),
        rotation: {
          ...profile.rotation,
          source: 'custom' as const,
          entries: profile.rotation.entries.map((entry) =>
            entry.abilityId === 'mighty_rage_potion'
              ? { ...entry, condition: selfHas('berserk') }
              : entry,
          ),
        },
      }),
    },
  ],

  /* The Cat's whole package, to check the parts against the sum. */
  catCombined: [
    {
      label: 'Mighty Rage + Ferocious Bite at 5, bottom',
      apply: (profile) =>
        addEntry({ abilityId: 'ferocious_bite', condition: comboPoints('atLeast', 5) })(
          consumable('potion', 'mighty_rage_potion')(profile),
        ),
    },
  ],

  catApl: [
    { label: 'Rake above Shred(Clearcasting)', apply: moveAbove('rake', 'shred') },
    { label: 'Rip removed (control)', apply: removeEntry('rip') },
    { label: 'Berserk removed', apply: removeEntry('berserk') },
    { label: 'Shifting Power removed', apply: removeEntry('shifting_power') },
    {
      label: 'Rip refreshed early, at 2 seconds left',
      apply: (profile) => ({
        ...profile,
        rotation: {
          ...profile.rotation,
          source: 'custom',
          entries: profile.rotation.entries.map((entry) =>
            entry.abilityId === 'rip'
              ? { ...entry, condition: all(comboPoints('atLeast', 5), targetExpired('rip')) }
              : entry,
          ),
        },
      }),
    },
  ],

  moonkinCombined: [
    {
      label: 'Reflection 3 -> Genesis 5, AND Insect Swarm above Moonfire',
      apply: (profile) =>
        moveAbove('insect_swarm', 'moonfire')(
          tree({
            ...MOONKIN_BALANCE_CORE,
            genesis: 5,
            moonglow: 3,
            nature_s_focus: 5,
            naturalist: 5,
          })(profile),
        ),
    },
  ],

  moonkinApl: [
    { label: 'Wrath above Insect Swarm', apply: moveAbove('wrath', 'insect_swarm') },
    { label: 'Moonfire removed', apply: removeEntry('moonfire') },
    { label: 'Insect Swarm removed', apply: removeEntry('insect_swarm') },
    { label: 'Moonfire below Insect Swarm', apply: moveAbove('insect_swarm', 'moonfire') },
  ],
};
