/*
 * The variants `probe_build.ts` measures on the two ranged Hunters.
 *
 * The EDITS live in `buildVariants.ts`; what is here is the Hunter-specific
 * part -- which enchant ids each slot offers, which trees the tier rule allows,
 * and what the two lists look like.
 *
 * BOTH PROFILES ARE AUTO-SHOT BUILDS FIRST, which is the fact every group below
 * is chosen around: Ranged Auto-Attack is **40.7%** of BM Hunter and **47.8%**
 * of LW Ranged, before the pet's 35% on the first. Anything that reaches the
 * bow reaches nearly half the damage, and anything that only reaches abilities
 * reaches the other half at most.
 */
import {
  type Variant,
  HUNTER_TREE as tree,
  addEntry,
  chain,
  consumable,
  enchant,
  moveAbove,
  moveToBottom,
  removeEntry,
} from './buildVariants';

/* ------------------------------------------------------------- the trees */

/*
 * BEAST MASTERY IS PACKED AND THE MARKSMANSHIP HALF IS NOT.
 *
 * Bestial Wrath is tier 30 of Beast Mastery, so thirty points have to sit below
 * it -- and the tree's real talents come to twenty-five, so five are filler
 * whatever happens. Marksmanship's twenty are where the choice is: fifteen are
 * forced below Mortal Shots and FIVE are free.
 */
const BM_BEAST_MASTERY = {
  deadly_aspects: 5,
  unleashed_fury: 5,
  ferocity: 5,
  frenzy: 5,
  focused_fire: 2,
  bestial_discipline: 2,
  summon_hawk: 1,
  bestial_wrath: 1,
  // Five of filler, and every Beast Mastery candidate is pet survival,
  // movement or a stun. The pet is never attacked and nothing here moves.
  endurance_training: 3,
  bestial_swiftness: 1,
  intimidation: 1,
};

/**
 * Marksmanship's thirteen real points below Mortal Shots.
 *
 * MORTAL SHOTS IS TIER 15 AND THESE COME TO THIRTEEN, so TWO MORE have to sit
 * below it before its five can go in -- and twenty is all Marksmanship gets,
 * because Bestial Wrath's tier 30 takes thirty-one of the fifty-one. **So BM
 * Hunter's entire design space is two points, and they must be below tier 15.**
 *
 * Hawk Eye is range and therefore dead; it is here because Marksmanship's only
 * other tier-0 talent is a stun chance on Concussive Shot.
 */
const BM_MARKS_BELOW_15 = {
  hawk_eye: 3,
  lethal_attacks: 5,
  careful_aim: 5,
};

/*
 * LONE WOLF RANGED. Sniper Shot is tier 30 of Marksmanship and Ranged Weapon
 * Specialization tier 25, so the tree is deep by necessity -- and Survival's
 * seven are five of Improved Tracking (a flat 5% to everything, ratified by the
 * owner) plus two that do nothing at all.
 */
const LW_MARKS_CORE = {
  hawk_eye: 3,
  lethal_attacks: 5,
  careful_aim: 5,
  improved_arcane_shot: 5,
  lone_wolf: 1,
  trueshot_aura: 1,
  mortal_shots: 5,
  barrage: 3,
  ranged_weapon_specialization: 5,
  sniper_shot: 1,
};

/* ------------------------------------------------------------ the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * ENCHANTS. Every slot a Hunter fills already carries agility, which is the
   * stat its gear is built around -- so the question is whether anything beats
   * it, and the two candidates are haste (which reaches the bow) and intellect
   * (which Careful Aim turns into attack power at 100%).
   */
  hunterEnchants: [
    { label: 'head +1% Haste (was +8 Agility)', apply: enchant('head', 900002) },
    { label: 'head +8 Intellect', apply: enchant('head', 900006) },
    { label: 'head +8 Strength', apply: enchant('head', 900005) },
    { label: 'legs +1% Haste (was +8 Agility)', apply: enchant('legs', 900002) },
    { label: 'gloves +1% Haste (was +15 Agility)', apply: enchant('gloves', 900002) },
    { label: 'gloves +15 Strength', apply: enchant('gloves', 900021) },
    { label: 'wrists +9 Strength (was +9 Agility)', apply: enchant('wrists', 900017) },
    { label: 'neck +5 Strength (was +5 Agility)', apply: enchant('neck', 900008) },
    { label: 'cloak +60 Armor (was +5 Agility)', apply: enchant('cloak', 900013) },
    { label: 'feet +7 Stamina (was +7 Agility)', apply: enchant('feet', 900027) },
  ],

  /*
   * THE STAT STICK'S ENCHANT, which is the one slot where the obvious answer is
   * wrong for a reason worth pinning: a ranged Hunter's two-hander NEVER
   * SWINGS, so Crusader cannot proc and a weapon-damage enchant reaches
   * nothing. Only a flat stat on it is worth anything at all.
   */
  hunterStatStick: [
    { label: 'stat stick: Crusader (was +25 Agility)', apply: enchant('twoHand', 20034) },
    { label: 'stat stick: +30 Spell Power', apply: enchant('twoHand', 22749) },
    { label: 'stat stick: +65 Spell Power', apply: enchant('twoHand', 900029) },
  ],

  hunterConsumables: [
    { label: 'food +40 Attack Power (was +20 Agility)', apply: consumable('food', 'food_attack_power') },
    { label: 'food +20 Strength', apply: consumable('food', 'food_strength') },
    { label: 'blasted lands +25 Intellect (was Agility)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'blasted lands +25 Strength', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'potion Major Mana (was Frenzy)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'flask +150 Spell Power (was +1200 Hit Points)', apply: consumable('flask', 'flask_spell_power') },
  ],

  /*
   * BM HUNTER'S FIVE FREE MARKSMANSHIP POINTS. Beast Mastery is forced at 31 by
   * Bestial Wrath's tier, and Marksmanship's fifteen below Mortal Shots are
   * forced too -- so this is the whole of the tree's design space.
   */
  bmTalents: [
    {
      label: 'BM: Improved Arcane Shot 2 (was Efficiency 2)',
      apply: tree({ ...BM_BEAST_MASTERY, ...BM_MARKS_BELOW_15, improved_arcane_shot: 2, mortal_shots: 5 }),
    },
    {
      label: 'BM: Improved Stings 2',
      apply: tree({ ...BM_BEAST_MASTERY, ...BM_MARKS_BELOW_15, improved_stings: 2, mortal_shots: 5 }),
    },
    {
      label: 'BM: Improved Stings 1 + Improved Arcane Shot 1',
      apply: tree({
        ...BM_BEAST_MASTERY,
        ...BM_MARKS_BELOW_15,
        improved_stings: 1,
        improved_arcane_shot: 1,
        mortal_shots: 5,
      }),
    },
    {
      label: 'BM: Rapid Killing 2',
      apply: tree({ ...BM_BEAST_MASTERY, ...BM_MARKS_BELOW_15, rapid_killing: 2, mortal_shots: 5 }),
    },
  ],

  /*
   * THE TALENT AND THE LIST ENTRY TOGETHER, which is the question the two
   * groups above raise and neither can answer: Improved Arcane Shot measured
   * **bit-identical fights** because BM Hunter's list has no Arcane Shot in it,
   * so the talent is inert until the entry exists. Adding the entry is +31 on
   * its own; whether the two free points then want to be on the sting or on the
   * shot's cooldown is a different question from either half.
   */
  bmCombined: [
    {
      label: 'BM: + Arcane Shot, keep Efficiency 2',
      apply: addEntry({ abilityId: 'arcane_shot' }),
    },
    {
      label: 'BM: + Arcane Shot, Improved Stings 2',
      apply: chain(
        addEntry({ abilityId: 'arcane_shot' }),
        tree({ ...BM_BEAST_MASTERY, ...BM_MARKS_BELOW_15, improved_stings: 2, mortal_shots: 5 }),
      ),
    },
    {
      label: 'BM: + Arcane Shot, Improved Arcane Shot 2',
      apply: chain(
        addEntry({ abilityId: 'arcane_shot' }),
        tree({ ...BM_BEAST_MASTERY, ...BM_MARKS_BELOW_15, improved_arcane_shot: 2, mortal_shots: 5 }),
      ),
    },
    {
      label: 'BM: + Arcane Shot, Stings 1 + Improved Arcane Shot 1',
      apply: chain(
        addEntry({ abilityId: 'arcane_shot' }),
        tree({
          ...BM_BEAST_MASTERY,
          ...BM_MARKS_BELOW_15,
          improved_stings: 1,
          improved_arcane_shot: 1,
          mortal_shots: 5,
        }),
      ),
    },
  ],

  /*
   * LW RANGED. Survival's two Survivalist points are +10% health on a profile
   * nothing attacks, and Marksmanship has Hawk Eye, Rapid Killing, Scatter Shot
   * and Rapid Recuperation sitting in it -- range, a cooldown longer than the
   * fight, a disorient, and mana.
   */
  lwTalents: [
    {
      label: 'LW: Survivalist 2 -> Improved Stings, and Rapid Killing out',
      apply: tree({
        deadly_aspects: 5,
        ...LW_MARKS_CORE,
        improved_stings: 3,
        rapid_recuperation: 2,
        scatter_shot: 1,
        efficiency: 1,
        improved_tracking: 5,
      }),
    },
    {
      label: 'LW: the same, with Efficiency instead of Rapid Recuperation',
      apply: tree({
        deadly_aspects: 5,
        ...LW_MARKS_CORE,
        improved_stings: 3,
        efficiency: 3,
        scatter_shot: 1,
        improved_tracking: 5,
      }),
    },
    {
      label: 'LW: Improved Stings 3 + Efficiency 3, no Scatter Shot',
      apply: tree({
        deadly_aspects: 5,
        ...LW_MARKS_CORE,
        improved_stings: 3,
        efficiency: 4,
        improved_tracking: 5,
      }),
    },
    {
      /* The control: are the four weak Marksmanship points worth anything? */
      label: 'LW: current tree with Survivalist 2 moved to Efficiency',
      apply: tree({
        deadly_aspects: 5,
        ...LW_MARKS_CORE,
        rapid_killing: 2,
        rapid_recuperation: 2,
        scatter_shot: 1,
        efficiency: 2,
        improved_tracking: 5,
      }),
    },
  ],

  /*
   * BM HUNTER'S LIST, AND THE ENTRY THAT IS NOT IN IT. Arcane Shot is a trainer
   * shot every Hunter owns and is **14.9% of LW Ranged's damage**; BM Hunter's
   * list has no entry for it at all, which is "an ability in the book, in no
   * list" -- the case `ability_audit.ts` exists for.
   */
  bmApl: [
    { label: 'BM: Arcane Shot above Aimed Shot', apply: moveAbove('arcane_shot', 'aimed_shot') },
    { label: 'BM: Arcane Shot above Summon Hawk', apply: moveAbove('arcane_shot', 'summon_hawk') },
    { label: 'BM: Arcane Shot removed', apply: removeEntry('arcane_shot') },
    { label: 'BM: Summon Hawk to the bottom', apply: moveToBottom('summon_hawk') },
    { label: 'BM: Serpent Sting removed', apply: removeEntry('serpent_sting') },
    { label: 'BM: Hunter’s Mark removed', apply: removeEntry('hunters_mark') },
    { label: 'BM: Rapid Fire removed', apply: removeEntry('rapid_fire') },
    { label: 'BM: Aimed Shot above Summon Hawk', apply: moveAbove('aimed_shot', 'summon_hawk') },
  ],

  lwApl: [
    { label: 'LW: Arcane Shot above Aimed Shot', apply: moveAbove('arcane_shot', 'aimed_shot') },
    { label: 'LW: Arcane Shot above Sniper Shot', apply: moveAbove('arcane_shot', 'sniper_shot') },
    { label: 'LW: Sniper Shot above Aimed Shot', apply: moveAbove('sniper_shot', 'aimed_shot') },
    { label: 'LW: Serpent Sting removed', apply: removeEntry('serpent_sting') },
    { label: 'LW: Hunter’s Mark removed', apply: removeEntry('hunters_mark') },
    { label: 'LW: Rapid Fire removed', apply: removeEntry('rapid_fire') },
    { label: 'LW: Serpent Sting to the bottom', apply: moveToBottom('serpent_sting') },
  ],

  /* The winners stacked, so the parts can be checked against the sum. */
  hunterCombined: [
    {
      label: 'head + legs +1% Haste',
      apply: chain(enchant('head', 900002), enchant('legs', 900002)),
    },
    {
      label: 'head + legs + gloves +1% Haste',
      apply: chain(enchant('head', 900002), enchant('legs', 900002), enchant('gloves', 900002)),
    },
  ],
};
