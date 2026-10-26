/*
 * ============================================================================
 * ROUND 78 -- THE SIX ROGUE PRESETS, optimised for the full report's encounters:
 * Single Target 120s and Multi Target 5 targets 60s (reused at 3/60 and 8/30).
 *
 * THEME INVARIANTS (Step 0), from `encode_talent_build.mjs --all` and the
 * presets. None of them may move:
 *
 * | preset            | race    | split     | style                       | target swings |
 * | ---               | ---     | ---       | ---                         | ---           |
 * | rogue_venom       | undead  | 33/16/2   | dual wield, daggers         | no            |
 * | rogue_combat_mut  | undead  | 30/21/0   | dual wield, daggers         | no            |
 * | rogue_combat      | orc     | 18/33/0   | dual wield, swords          | no            |
 * | rogue_rupture     | undead  | 12/8/31   | dual wield, daggers         | no            |
 * | rogue_hemo        | undead  | 17/3/31   | dual wield, daggers         | no            |
 * | rogue_pure_hemo   | undead  | 19/8/24   | sword main hand, dagger off | no            |
 *
 * (Race is a CANDIDATE here by the round 78 brief, so the race column is the
 * shipped race, not an invariant.)
 *
 * THE ONLY ROGUE AREA EFFECT IS BLADE FLURRY, and only the two Combat-tree
 * builds can reach it: it is tier 20 of Combat, so a 31-point Assassination or
 * Subtlety capstone plus 21 Combat points is 52. So the four other presets
 * have no Multi Target lever in the APL at all -- their 3/5/8-target figures
 * are their single-target damage, and BLADE FLURRY COPIES ONTO ONE EXTRA
 * TARGET ONLY, which is why t3 and t5 are identical for every Rogue.
 *
 * Group names are prefixed per profile: ven, cmut, cmb, rup, hemo, phemo.
 * Every group carries the no-op control first.
 * ============================================================================
 */
import {
  type Apply,
  type Variant,
  ROGUE_TREE as tree,
  apl,
  addAbove,
  chain,
  consumable,
  enchant,
  inMulti,
  precombatLead,
  removeEntry,
} from '../buildVariants';
import {
  all,
  comboPoints,
  not,
  resource,
  selfHas,
  selfTime,
  targetTime,
  targetCount,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { CharacterProfile } from '../../src/profiles';
import type { PoisonId } from '../../src/game/reactions/poisons';

const CONTROL: Variant = { label: 'the shipped build -- the control', apply: (p) => p };

/* ------------------------------------------------------------- helpers */

const onlyIndex = (entries: readonly AplEntry[], id: string): number => {
  const hits = entries.flatMap((e, i) => (e.abilityId === id ? [i] : []));
  if (hits.length !== 1) throw new Error(`${hits.length} entries for ${id}, wanted exactly one`);
  return hits[0];
};

/** Replace the condition on the ONE entry for `id`. */
const cond = (id: string, condition: AplCondition | undefined): Apply =>
  apl((entries) => {
    const at = onlyIndex(entries, id);
    const { condition: _old, ...rest } = entries[at];
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

const RACIAL_ENTRY: Partial<Record<string, string>> = {
  orc: 'blood_fury',
  troll: 'berserking',
  night_elf: 'elunes_light',
  gnome: 'eureka',
};

/**
 * A RACE SWAP, holding gear, talents, enchants and consumables fixed. The new
 * race's own cooldown entry is switched ON (each list carries all four, the
 * absent races' disabled), and the old race's is switched off, so the variant
 * prices the race and not a disabled checkbox.
 */
const race =
  (to: string): Apply =>
  (profile: CharacterProfile) => {
    const from = profile.character.race;
    let next: CharacterProfile = { ...profile, character: { ...profile.character, race: to as never } };
    next = apl((entries) =>
      entries.map((e) => {
        if (e.abilityId === RACIAL_ENTRY[to]) {
          const { disabled: _d, ...rest } = e;
          return rest;
        }
        if (e.abilityId === RACIAL_ENTRY[from]) return { ...e, disabled: true };
        return e;
      }),
    )(next);
    return next;
  };

const poisons =
  (mainHand: PoisonId, offHand: PoisonId): Apply =>
  (profile) => ({ ...profile, poisons: { mainHand, offHand } });

const RACES = [
  'human',
  'dwarf',
  'night_elf',
  'gnome',
  'high_order_skyborne',
  'orc',
  'undead',
  'troll',
  'windshaper_skyborne',
];

const raceGroup = (current: string): readonly Variant[] => [
  CONTROL,
  ...RACES.filter((r) => r !== current).map((r) => ({ label: `race ${r}`, apply: race(r) })),
];

/* Enchant ids, from `foreverEnchants.ts`. */
const HASTE = 900002; // +1% Haste: head, gloves, legs
const WEAPON_AGILITY = 900031; // +25 Agility: main hand, off hand
const CRUSADER = 20034;

const enchantGroup: readonly Variant[] = [
  CONTROL,
  { label: 'head +1% haste for +8 agility', apply: enchant('head', HASTE) },
  { label: 'legs +1% haste for +8 agility', apply: enchant('legs', HASTE) },
  { label: 'gloves +1% haste for +15 agility', apply: enchant('gloves', HASTE) },
  { label: 'main hand +25 agility for Crusader', apply: enchant('mainHand', WEAPON_AGILITY) },
  { label: 'off hand +25 agility for Crusader', apply: enchant('offHand', WEAPON_AGILITY) },
  {
    label: 'both hands +25 agility for Crusader',
    apply: chain(enchant('mainHand', WEAPON_AGILITY), enchant('offHand', WEAPON_AGILITY)),
  },
  { label: 'both hands Crusader (written out)', apply: chain(enchant('mainHand', CRUSADER), enchant('offHand', CRUSADER)) },
];

const consumableGroup = (food: 'food_agility' | 'food_attack_power', mhStone: boolean): readonly Variant[] => [
  CONTROL,
  { label: 'poisons Deadly MH / Instant OH', apply: poisons('deadly_poison', 'instant_poison') },
  { label: 'poisons Instant / Instant', apply: poisons('instant_poison', 'instant_poison') },
  { label: 'poisons Deadly / Deadly', apply: poisons('deadly_poison', 'deadly_poison') },
  food === 'food_agility'
    ? { label: 'food +40 attack power for +20 agility', apply: consumable('food', 'food_attack_power') }
    : { label: 'food +20 agility for +40 attack power', apply: consumable('food', 'food_agility') },
  mhStone
    ? { label: 'MH +2% crit stone for the Dense stone', apply: consumable('weapon_effect_main_hand', 'weapon_melee_crit_main_hand') }
    : { label: 'MH Dense stone for the +2% crit stone', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
  { label: 'OH Dense stone for the +2% crit stone', apply: consumable('weapon_effect_off_hand', 'dense_sharpening_stone_off_hand') },
  { label: 'other: Healthstone for Thistle Tea', apply: consumable('other', 'healthstone') },
];

const cp = (compare: 'atLeast' | 'exactly' | 'atMost', n: number) => comboPoints(compare, n);
const energyAtMost = (n: number) => resource('atMost', n, 'energy');

/* ================================================================ VENOM */

const VENOM_TREE = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 2, relentless_strikes: 1, lethality: 5,
  vile_poisons: 4, cold_blood: 1, improved_poisons: 5, mutilate: 1, seal_fate: 5, venom: 1,
  improved_eviscerate: 3, lightning_reflexes: 2, puncturing_wounds: 3, precision: 3, endurance: 2,
  improved_sprint: 2, flawless_execution: 1, opportunity: 2,
};

/** Venom's finisher conditions with the combo point gate and maintenance floor as parameters. */
const venomFinishers = (points: number, floor: number): Apply =>
  chain(
    cond(
      'eviscerate',
      all(
        cp('atLeast', points),
        ...(floor > 0 ? [selfTime('atLeast', floor, 'slice_and_dice'), selfTime('atLeast', floor, 'venom')] : []),
      ),
    ),
  );

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  venTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(VENOM_TREE) },
    {
      label: 'Flawless + Endurance + Imp Sprint (5) -> Vile 5, ISnD 3, Vigor 2, LR 3',
      apply: tree({ ...VENOM_TREE, flawless_execution: 0, endurance: 0, improved_sprint: 0, vile_poisons: 5, improved_slice_and_dice: 3, vigor: 2, lightning_reflexes: 3 }),
    },
    {
      label: 'Opportunity 2 -> ISnD 3, Vile 5',
      apply: tree({ ...VENOM_TREE, opportunity: 0, improved_slice_and_dice: 3, vile_poisons: 5 }),
    },
    {
      label: 'Opportunity 2 -> Vigor 2',
      apply: tree({ ...VENOM_TREE, opportunity: 0, vigor: 2 }),
    },
  ],
  venApl: [
    CONTROL,
    { label: 'Eviscerate at 2+ points', apply: venomFinishers(2, 3) },
    { label: 'Eviscerate at 4+ points', apply: venomFinishers(4, 3) },
    { label: 'Eviscerate at 5 points', apply: venomFinishers(5, 3) },
    { label: 'Eviscerate floors 3s -> 1s', apply: venomFinishers(3, 1) },
    { label: 'Eviscerate floors removed', apply: venomFinishers(3, 0) },
    { label: 'Venom at 2+ points', apply: cond('venom', all(selfTime('atMost', 0, 'venom'), cp('atLeast', 2))) },
    { label: 'Venom at 4+ points', apply: cond('venom', all(selfTime('atMost', 0, 'venom'), cp('atLeast', 4))) },
    { label: 'Venom at 5 points', apply: cond('venom', all(selfTime('atMost', 0, 'venom'), cp('atLeast', 5))) },
    { label: 'Slice and Dice at 2+ points', apply: cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', 2))) },
    { label: 'Thistle Tea at energy <= 25', apply: cond('thistle_tea', energyAtMost(25)) },
    { label: 'Frenzy potion ungated', apply: cond('major_frenzy_potion', undefined) },
  ],
  venEnch: enchantGroup,
  venCons: consumableGroup('food_agility', false),
  venRace: raceGroup('undead'),

  /* ============================================================ COMBAT MUT */
  cmutTalents: [
    CONTROL,
    {
      label: 'Improved Sprint 2 -> 1, Dual Wield Spec 5',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5,
        vile_poisons: 1, cold_blood: 1, improved_poisons: 5, mutilate: 1, seal_fate: 5,
        improved_eviscerate: 3, lightning_reflexes: 2, puncturing_wounds: 3, precision: 3, endurance: 2,
        improved_sprint: 1, flawless_execution: 1, dual_wield_specialization: 5, blade_flurry: 1,
      }),
    },
  ],
  cmutApl: [
    CONTROL,
    { label: 'Eviscerate at 2+ points', apply: cond('eviscerate', cp('atLeast', 2)) },
    { label: 'Eviscerate at 4+ points', apply: cond('eviscerate', cp('atLeast', 4)) },
    { label: 'Eviscerate at 5 points', apply: cond('eviscerate', cp('atLeast', 5)) },
    { label: 'Slice and Dice at 2+ points', apply: cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', 2))) },
    { label: 'Cold Blood at 5 points, 35 energy', apply: cond('cold_blood', all(cp('atLeast', 5), resource('atLeast', 35, 'energy'))) },
    { label: 'Blade Flurry entry removed (single target)', apply: removeEntry('blade_flurry') },
    { label: 'Thistle Tea at energy <= 25', apply: cond('thistle_tea', energyAtMost(25)) },
    { label: 'Frenzy potion ungated', apply: cond('major_frenzy_potion', undefined) },
  ],
  cmutAoe: [
    CONTROL,
    { label: 'multi: Eviscerate at 4+ points', apply: inMulti(cond('eviscerate', cp('atLeast', 4))) },
    { label: 'multi: Eviscerate at 5 points', apply: inMulti(cond('eviscerate', cp('atLeast', 5))) },
    { label: 'multi: Eviscerate at 2+ points', apply: inMulti(cond('eviscerate', cp('atLeast', 2))) },
    {
      label: 'multi: Cold Blood only while Blade Flurry is up',
      apply: inMulti(cond('cold_blood', all(cp('atLeast', 4), resource('atLeast', 25, 'energy'), selfHas('blade_flurry')))),
    },
    {
      label: 'multi: Blade Flurry above Slice and Dice',
      apply: inMulti(apl((entries) => {
        const [bf] = entries.splice(onlyIndex(entries, 'blade_flurry'), 1);
        entries.splice(onlyIndex(entries, 'slice_and_dice'), 0, bf);
        return entries;
      })),
    },
    { label: 'multi: Frenzy potion only while Blade Flurry is up', apply: inMulti(cond('major_frenzy_potion', all(selfHas('slice_and_dice'), selfHas('blade_flurry')))) },
  ],
  cmutEnch: enchantGroup,
  cmutCons: consumableGroup('food_agility', false),
  cmutRace: raceGroup('undead'),

  /* ================================================================ COMBAT */
  cmbTalents: [
    CONTROL,
    {
      label: 'Dual Wield Spec 5 -> 3, Vile Poisons 2',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5,
        cold_blood: 1, vile_poisons: 2, improved_eviscerate: 3, improved_sinister_strike: 2, deflection: 3,
        precision: 3, endurance: 1, riposte: 1, improved_sprint: 2, flawless_execution: 1,
        dual_wield_specialization: 3, blade_flurry: 1, hack_and_slash: 5, weapon_expertise: 2,
        aggression: 3, adrenaline_rush: 1,
      }),
    },
    {
      label: 'Dual Wield Spec 5 -> 3, Improved Poisons 2',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5,
        cold_blood: 1, improved_poisons: 2, improved_eviscerate: 3, improved_sinister_strike: 2,
        deflection: 3, precision: 3, endurance: 1, riposte: 1, improved_sprint: 2, flawless_execution: 1,
        dual_wield_specialization: 3, blade_flurry: 1, hack_and_slash: 5, weapon_expertise: 2,
        aggression: 3, adrenaline_rush: 1,
      }),
    },
  ],
  cmbApl: [
    CONTROL,
    ...[2, 3, 4].map((n) => ({
      label: `Eviscerate (and Cold Blood) at ${n}+ points`,
      apply: chain(cond('eviscerate', cp('atLeast', n)), cond('cold_blood', cp('atLeast', n))),
    })),
    ...[1, 2, 4, 5].map((n) => ({
      label: `Slice and Dice at ${n}+ points`,
      apply: cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', n))),
    })),
    { label: 'Thistle Tea at energy <= 10', apply: cond('thistle_tea', energyAtMost(10)) },
    { label: 'Thistle Tea at energy <= 25', apply: cond('thistle_tea', energyAtMost(25)) },
    { label: 'Frenzy potion ungated', apply: cond('major_frenzy_potion', undefined) },
    { label: 'Blade Flurry entry removed (single target)', apply: removeEntry('blade_flurry') },
  ],
  cmbAoe: [
    CONTROL,
    ...[2, 3, 4].map((n) => ({
      label: `multi: Eviscerate (and Cold Blood) at ${n}+ points`,
      apply: inMulti(cond('eviscerate', cp('atLeast', n)), cond('cold_blood', cp('atLeast', n))),
    })),
    {
      label: 'multi: Blade Flurry above Adrenaline Rush',
      apply: inMulti(apl((entries) => {
        const [bf] = entries.splice(onlyIndex(entries, 'blade_flurry'), 1);
        entries.splice(onlyIndex(entries, 'adrenaline_rush'), 0, bf);
        return entries;
      })),
    },
    { label: 'multi: Cold Blood only while Blade Flurry is up', apply: inMulti(cond('cold_blood', all(cp('exactly', 5), selfHas('blade_flurry')))) },
    { label: 'multi: Slice and Dice at 1+ points', apply: inMulti(cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', 1)))) },
  ],
  cmbEnch: enchantGroup,
  cmbCons: consumableGroup('food_agility', true),
  cmbRace: raceGroup('orc'),

  /* =============================================================== RUPTURE */
  rupTalents: [
    CONTROL,
    {
      label: 'Combat 8 (IE, LR, Puncturing) -> Lethality 5, Vile 3',
      apply: tree({
        malice: 5, ruthlessness: 3, relentless_strikes: 1, improved_slice_and_dice: 3, lethality: 5, vile_poisons: 3,
        camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3, ghostly_strike: 1,
        improved_distract: 2, premeditation: 1, serrated_blades: 3, preparation: 1, hemorrhage: 1, cutthroat: 5,
        thousand_cuts: 1,
      }),
    },
    {
      label: 'Combat 8 -> Lethality 5, Improved Poisons 3',
      apply: tree({
        malice: 5, ruthlessness: 3, relentless_strikes: 1, improved_slice_and_dice: 3, lethality: 5, improved_poisons: 3,
        camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3, ghostly_strike: 1,
        improved_distract: 2, premeditation: 1, serrated_blades: 3, preparation: 1, hemorrhage: 1, cutthroat: 5,
        thousand_cuts: 1,
      }),
    },
  ],
  rupApl: [
    CONTROL,
    ...[3, 5].map((n) => ({
      label: `Rupture at ${n}+ points`,
      apply: cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', n), { kind: 'aura', on: 'target', auraId: 'hemorrhage', present: true } as AplCondition)),
    })),
    ...[0, 2, 3].map((s) => ({
      label: `Hemorrhage refresh window ${s}s`,
      apply: cond('hemorrhage', all(targetTime('atMost', s, 'hemorrhage'), not(all(selfHas('cutthroat'), resource('below', 60, 'energy'))))),
    })),
    {
      label: 'Eviscerate floors 6s -> 3s',
      apply: cond('eviscerate', all(cp('atLeast', 4), targetTime('atLeast', 3, 'rupture'), selfTime('atLeast', 3, 'slice_and_dice'))),
    },
    {
      label: 'Eviscerate at 5 points',
      apply: cond('eviscerate', all(cp('atLeast', 5), targetTime('atLeast', 6, 'rupture'), selfTime('atLeast', 6, 'slice_and_dice'))),
    },
    {
      label: 'ADD Ghostly Strike above Backstab, same pooling gate',
      apply: addAbove({ abilityId: 'ghostly_strike', condition: not(all(selfHas('cutthroat'), resource('below', 60, 'energy'))) }, 'backstab'),
    },
    {
      label: 'ADD Ghostly Strike above Slice and Dice, same pooling gate',
      apply: addAbove({ abilityId: 'ghostly_strike', condition: not(all(selfHas('cutthroat'), resource('below', 60, 'energy'))) }, 'slice_and_dice'),
    },
  ],
  rupEnch: enchantGroup,
  rupCons: consumableGroup('food_agility', true),
  rupRace: raceGroup('undead'),

  /* ================================================================== HEMO */
  hemoTalents: [
    CONTROL,
    {
      label: 'Improved Eviscerate 3 -> ISnD 3, Vile 2',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        vile_poisons: 2, camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3,
        improved_distract: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
        quietus: 5, thousand_cuts: 1,
      }),
    },
    {
      label: 'Improved Eviscerate 3 -> ISnD 3, Improved Poisons 2',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        improved_poisons: 2, camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3,
        improved_distract: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
        quietus: 5, thousand_cuts: 1,
      }),
    },
  ],
  hemoApl: [
    CONTROL,
    ...[4, 5].map((n) => ({
      label: `Rupture at ${n}+ points`,
      apply: cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', n))),
    })),
    {
      label: 'Eviscerate and Cold Blood at 4+ points',
      apply: chain(
        cond('eviscerate', all(cp('atLeast', 4), targetTime('atLeast', 4, 'rupture'), selfTime('atLeast', 4, 'slice_and_dice'))),
        cond('cold_blood', all(cp('atLeast', 4), targetTime('atLeast', 4, 'rupture'), selfTime('atLeast', 4, 'slice_and_dice'))),
      ),
    },
    ...[2, 6].map((s) => ({
      label: `Eviscerate and Cold Blood floors 4s -> ${s}s`,
      apply: chain(
        cond('eviscerate', all(cp('exactly', 5), targetTime('atLeast', s, 'rupture'), selfTime('atLeast', s, 'slice_and_dice'))),
        cond('cold_blood', all(cp('exactly', 5), targetTime('atLeast', s, 'rupture'), selfTime('atLeast', s, 'slice_and_dice'))),
      ),
    })),
    { label: 'Slice and Dice at 2+ points', apply: cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', 2))) },
    { label: 'Thistle Tea at energy <= 25', apply: cond('thistle_tea', energyAtMost(25)) },
  ],
  hemoEnch: enchantGroup,
  hemoCons: consumableGroup('food_attack_power', true),
  hemoRace: raceGroup('undead'),

  /* ============================================================= PURE HEMO */
  phemoTalents: [
    CONTROL,
    {
      label: 'Improved Poisons 1 -> Vile Poisons 1',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        vile_poisons: 1, improved_eviscerate: 3, lightning_reflexes: 2, precision: 3, camouflage: 5,
        master_of_deception: 3, opportunity: 2, elusiveness: 2, initiative: 3, ghostly_strike: 1, premeditation: 1,
        serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
      }),
    },
    {
      label: 'Combat 8 (IE, LR, Precision) -> Improved Poisons 5, Vile 4',
      apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        improved_poisons: 5, vile_poisons: 4, camouflage: 5, master_of_deception: 3, opportunity: 2, elusiveness: 2,
        initiative: 3, ghostly_strike: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1,
        hemorrhage: 1,
      }),
    },
  ],
  phemoApl: [
    CONTROL,
    {
      label: 'ADD Ghostly Strike above Hemorrhage, same pooling gate',
      apply: addAbove(
        {
          abilityId: 'ghostly_strike',
          condition: not(all(targetTime('atMost', 0, 'garrote'), { kind: 'cooldown', abilityId: 'vanish', state: 'ready' } as AplCondition, resource('below', 50, 'energy'))),
        },
        'hemorrhage',
      ),
    },
    {
      label: 'ADD Ghostly Strike above Slice and Dice, same pooling gate',
      apply: addAbove(
        {
          abilityId: 'ghostly_strike',
          condition: not(all(targetTime('atMost', 0, 'garrote'), { kind: 'cooldown', abilityId: 'vanish', state: 'ready' } as AplCondition, resource('below', 50, 'energy'))),
        },
        'slice_and_dice',
      ),
    },
    { label: 'Rupture gated on points and the bleed only (owner line, priced)', apply: cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 3))) },
    ...[1, 2, 5].map((n) => ({
      label: `Slice and Dice at ${n}+ points`,
      apply: cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', n))),
    })),
    {
      label: 'Eviscerate and Cold Blood floor 1s -> 3s',
      apply: chain(
        cond('eviscerate', all(cp('exactly', 5), selfTime('atLeast', 3, 'slice_and_dice'))),
        cond('cold_blood', all(cp('exactly', 5), selfTime('atLeast', 3, 'slice_and_dice'))),
      ),
    },
    { label: 'Thistle Tea at energy <= 25', apply: cond('thistle_tea', energyAtMost(25)) },
  ],
  phemoEnch: enchantGroup,
  phemoCons: consumableGroup('food_attack_power', true),
  phemoRace: raceGroup('undead'),
};

/* ------------------------------------------------- confirmation groups */

const HEMO_TREE = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 2, relentless_strikes: 1, lethality: 5, cold_blood: 1,
  improved_eviscerate: 3, camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3,
  improved_distract: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
  quietus: 5, thousand_cuts: 1,
};
const RUP_GHOSTLY = addAbove(
  { abilityId: 'ghostly_strike', condition: not(all(selfHas('cutthroat'), resource('below', 60, 'energy'))) },
  'backstab',
);

Object.assign(VARIANT_GROUPS, {
  hemoTalents2: [
    CONTROL,
    { label: 'control written out', apply: tree(HEMO_TREE) },
    { label: 'IE 3 -> ISnD 3, Improved Poisons 2', apply: tree({ ...HEMO_TREE, improved_eviscerate: 0, improved_slice_and_dice: 3, improved_poisons: 2 }) },
    { label: 'IE 3 -> Improved Poisons 3', apply: tree({ ...HEMO_TREE, improved_eviscerate: 0, improved_poisons: 3 }) },
    { label: 'IE 3 -> ISnD 3, Improved Poisons 1, Vile 1', apply: tree({ ...HEMO_TREE, improved_eviscerate: 0, improved_slice_and_dice: 3, improved_poisons: 1, vile_poisons: 1 }) },
    { label: 'IE 3 -> Vile 3', apply: tree({ ...HEMO_TREE, improved_eviscerate: 0, vile_poisons: 3 }) },
    { label: 'off hand +25 agility', apply: enchant('offHand', WEAPON_AGILITY) },
  ],
  rupConfirm: [
    CONTROL,
    { label: 'ADD Ghostly Strike above Backstab', apply: RUP_GHOSTLY },
    { label: 'race high_order_skyborne', apply: race('high_order_skyborne') },
    { label: 'both hands +25 agility', apply: chain(enchant('mainHand', WEAPON_AGILITY), enchant('offHand', WEAPON_AGILITY)) },
    { label: 'off hand +25 agility', apply: enchant('offHand', WEAPON_AGILITY) },
    { label: 'head and legs +1% haste', apply: chain(enchant('head', HASTE), enchant('legs', HASTE)) },
  ],
  phemoConfirm: [
    CONTROL,
    { label: 'off hand +25 agility', apply: enchant('offHand', WEAPON_AGILITY) },
    { label: 'both hands +25 agility', apply: chain(enchant('mainHand', WEAPON_AGILITY), enchant('offHand', WEAPON_AGILITY)) },
    { label: 'race gnome', apply: race('gnome') },
    { label: 'race high_order_skyborne', apply: race('high_order_skyborne') },
    { label: 'Combat 8 -> Improved Poisons 5, Vile 4', apply: tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        improved_poisons: 5, vile_poisons: 4, camouflage: 5, master_of_deception: 3, opportunity: 2, elusiveness: 2,
        initiative: 3, ghostly_strike: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1,
        hemorrhage: 1,
      }) },
  ],
});

const COMBAT_TREE = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
  improved_eviscerate: 3, improved_sinister_strike: 2, deflection: 3, precision: 3, endurance: 1, riposte: 1,
  improved_sprint: 2, flawless_execution: 1, dual_wield_specialization: 5, blade_flurry: 1, hack_and_slash: 5,
  weapon_expertise: 2, aggression: 3, adrenaline_rush: 1,
};
const multiSnd = (n: number): Apply =>
  inMulti(cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', n))));

Object.assign(VARIANT_GROUPS, {
  cmbTalents2: [
    CONTROL,
    { label: 'control written out', apply: tree(COMBAT_TREE) },
    { label: 'Dual Wield Spec 5 -> 4, Improved Poisons 1', apply: tree({ ...COMBAT_TREE, dual_wield_specialization: 4, improved_poisons: 1 }) },
    { label: 'Dual Wield Spec 5 -> 4, Vile Poisons 1', apply: tree({ ...COMBAT_TREE, dual_wield_specialization: 4, vile_poisons: 1 }) },
  ],
  cmbAoe2: [
    CONTROL,
    { label: 'multi: Slice and Dice at 1+ points', apply: multiSnd(1) },
    { label: 'multi: Slice and Dice at 2+ points', apply: multiSnd(2) },
    { label: 'multi: Slice and Dice at 1+, gnome', apply: chain(multiSnd(1), race('gnome')) },
    { label: 'race gnome', apply: race('gnome') },
  ],
  cmutAoe2: [
    CONTROL,
    { label: 'multi: Slice and Dice at 2+ points', apply: inMulti(cond('slice_and_dice', all(selfTime('atMost', 0, 'slice_and_dice'), cp('atLeast', 2)))) },
    { label: 'multi: Blade Flurry pre-cast at 0s rather than 1s (opener line, priced)', apply: inMulti(precombatLead('blade_flurry', 0)) },
  ],
});

const OH_AGILITY = enchant('offHand', WEAPON_AGILITY);
const HEMO_IP3 = tree({ ...HEMO_TREE, improved_eviscerate: 0, improved_poisons: 3 });

Object.assign(VARIANT_GROUPS, {
  venCombined: [CONTROL, { label: 'off hand +25 agility', apply: OH_AGILITY }],
  cmutCombined: [CONTROL, { label: 'off hand +25 agility', apply: OH_AGILITY }],
  cmbCombined: [
    CONTROL,
    { label: 'race gnome', apply: race('gnome') },
    { label: 'race gnome + multi Slice and Dice at 1+', apply: chain(race('gnome'), multiSnd(1)) },
    { label: 'race gnome + off hand +25 agility', apply: chain(race('gnome'), OH_AGILITY) },
  ],
  rupCombined: [
    CONTROL,
    { label: 'off hand +25 agility', apply: OH_AGILITY },
    { label: 'off hand +25 agility + head/legs haste', apply: chain(OH_AGILITY, enchant('head', HASTE), enchant('legs', HASTE)) },
    { label: 'off hand +25 agility + skyborne', apply: chain(OH_AGILITY, race('high_order_skyborne')) },
    { label: 'all three', apply: chain(OH_AGILITY, enchant('head', HASTE), enchant('legs', HASTE), race('high_order_skyborne')) },
  ],
  hemoCombined: [
    CONTROL,
    { label: 'IE 3 -> Improved Poisons 3', apply: HEMO_IP3 },
    { label: 'IE 3 -> Improved Poisons 3 + off hand +25 agility', apply: chain(HEMO_IP3, OH_AGILITY) },
    { label: 'off hand +25 agility', apply: OH_AGILITY },
  ],
  phemoCombined: [
    CONTROL,
    { label: 'off hand +25 agility', apply: OH_AGILITY },
    { label: 'off hand +25 agility + Combat 8 -> IP 5, Vile 4', apply: chain(OH_AGILITY, tree({
        malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
        improved_poisons: 5, vile_poisons: 4, camouflage: 5, master_of_deception: 3, opportunity: 2, elusiveness: 2,
        initiative: 3, ghostly_strike: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1,
        hemorrhage: 1,
      })) },
  ],
});

const HEAD_LEGS_HASTE = chain(enchant('head', HASTE), enchant('legs', HASTE));
Object.assign(VARIANT_GROUPS, {
  hemoFinal: [
    CONTROL,
    { label: 'IP 3 + off hand agility', apply: chain(HEMO_IP3, OH_AGILITY) },
    { label: 'IP 3 + off hand agility + head/legs haste', apply: chain(HEMO_IP3, OH_AGILITY, HEAD_LEGS_HASTE) },
  ],
});

/* Not every builder is used by every group; keep the import list honest. */
void targetCount;
