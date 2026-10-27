/*
 * ============================================================================
 * ROUND 80 -- THE SIX ROGUE PRESETS, second run of "Optimize, Update, and
 * Report", under the owner's round 79 rules: one talent build on the WEIGHTED
 * score (49% 1T/120s + 17% each 3T/60s, 5T/60s, 8T/30s), Single Target and
 * Multi Target lists tuned separately, Horde or Windshaper races only, legal
 * enchants, and "go deeper".
 *
 * THEME INVARIANTS (Step 0). None may move:
 *
 * | preset            | split     | style                       | target swings |
 * | ---               | ---       | ---                         | ---           |
 * | rogue_venom       | 33/16/2   | dual wield, daggers         | no            |
 * | rogue_combat_mut  | 30/21/0   | dual wield, daggers         | no            |
 * | rogue_combat      | 18/33/0   | dual wield, swords          | no            |
 * | rogue_rupture     | 12/8/31   | dual wield, daggers         | no            |
 * | rogue_hemo        | 20/0/31   | dual wield, daggers         | no            |
 * | rogue_pure_hemo   | 19/8/24   | sword main hand, dagger off | no            |
 *
 * Group names are prefixed `r80` plus a profile key: ven, cmut, cmb, rup,
 * hemo, phemo. Every group carries the no-op control first.
 * ============================================================================
 */
import {
  type Apply,
  type Variant,
  ROGUE_TREE as tree,
  addAbove,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  precombatLead,
  removeEntry,
} from '../buildVariants';
import {
  all,
  any,
  comboPoints,
  fightRemaining,
  not,
  onCooldown,
  ready,
  resource,
  selfHas,
  selfTime,
  targetCount,
  targetHas,
  targetTime,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { CharacterProfile } from '../../src/profiles';
import type { PoisonId } from '../../src/game/reactions/poisons';

const CONTROL: Variant = { label: 'the shipped build -- the control', apply: (p) => p };

/* ------------------------------------------------------------- helpers */

const onlyIndex = (entries: readonly AplEntry[], id: string): number => {
  // The end-of-fight Eviscerate (round 80) is a second `eviscerate` entry; the
  // owner's line is the one that does not read the fight clock.
  const isDump = (e: AplEntry) => JSON.stringify(e.condition ?? {}).includes('fightRemaining');
  const hits = entries.flatMap((e, i) => (e.abilityId === id && !isDump(e) ? [i] : []));
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

/** Add an entry at the very top of the list. */
const addTop = (entry: AplEntry): Apply => apl((entries) => [entry, ...entries]);

const cp = (compare: 'atLeast' | 'exactly' | 'atMost', n: number) => comboPoints(compare, n);
const energyAtLeast = (n: number) => resource('atLeast', n, 'energy');
const energyAtMost = (n: number) => resource('atMost', n, 'energy');
const sndDown = selfTime('atMost', 0, 'slice_and_dice');

const RACIAL_IDS = ['blood_fury', 'berserking', 'elunes_light', 'eureka'];
const RACIAL_OF: Partial<Record<string, string>> = { orc: 'blood_fury', troll: 'berserking' };

/**
 * A RACE SWAP, gear, talents, enchants and consumables held fixed. The harness
 * re-derives a DEFAULT list; a CUSTOM list (a Multi Target section) keeps the
 * old race's racial entry, so swap it here: the old racial out, the new one in
 * at the same position.
 */
const swapRacials = (to: string): Apply =>
  apl((entries) => {
    const at = entries.findIndex((e) => RACIAL_IDS.includes(e.abilityId));
    const kept = entries.filter((e) => !RACIAL_IDS.includes(e.abilityId));
    const mine = RACIAL_OF[to];
    if (at >= 0 && mine) kept.splice(at, 0, { abilityId: mine });
    return kept;
  });
const race =
  (to: string): Apply =>
  (profile: CharacterProfile) => {
    const next: CharacterProfile = { ...profile, character: { ...profile.character, race: to as never } };
    return next.multiTarget ? inMulti(swapRacials(to))(next) : next;
  };

const ALLOWED_RACES = ['orc', 'undead', 'troll', 'windshaper_skyborne'];
const raceGroup = (current: string): readonly Variant[] => [
  CONTROL,
  ...ALLOWED_RACES.filter((r) => r !== current).map((r) => ({ label: `race ${r}`, apply: race(r) })),
];

const poisons =
  (mainHand: PoisonId, offHand: PoisonId): Apply =>
  (profile) => ({ ...profile, poisons: { mainHand, offHand } });

/* Enchant ids, from `foreverEnchants.ts`. */
const HASTE = 900002; // +1% Haste: head, gloves, legs
const HEAD_LEGS_AGI = 900003; // +8 Agility: head, legs
const ONE_HAND_AGI = 900022; // +15 Agility: gloves, one-hand weapons
const CRUSADER = 20034;

const enchantGroup: readonly Variant[] = [
  CONTROL,
  { label: 'head +1% haste', apply: enchant('head', HASTE) },
  { label: 'legs +1% haste', apply: enchant('legs', HASTE) },
  { label: 'head and legs +1% haste', apply: chain(enchant('head', HASTE), enchant('legs', HASTE)) },
  { label: 'head and legs +8 agility', apply: chain(enchant('head', HEAD_LEGS_AGI), enchant('legs', HEAD_LEGS_AGI)) },
  { label: 'gloves +1% haste', apply: enchant('gloves', HASTE) },
  { label: 'main hand +15 agility', apply: enchant('mainHand', ONE_HAND_AGI) },
  { label: 'off hand +15 agility', apply: enchant('offHand', ONE_HAND_AGI) },
  { label: 'off hand Crusader', apply: enchant('offHand', CRUSADER) },
  { label: 'both hands +15 agility', apply: chain(enchant('mainHand', ONE_HAND_AGI), enchant('offHand', ONE_HAND_AGI)) },
];

const consumableGroup: readonly Variant[] = [
  CONTROL,
  { label: 'poisons Deadly MH / Instant OH', apply: poisons('deadly_poison', 'instant_poison') },
  { label: 'poisons Instant / Instant', apply: poisons('instant_poison', 'instant_poison') },
  { label: 'poisons Deadly / Deadly', apply: poisons('deadly_poison', 'deadly_poison') },
  { label: 'food +40 attack power', apply: consumable('food', 'food_attack_power') },
  { label: 'food +20 agility', apply: consumable('food', 'food_agility') },
  { label: 'MH Dense stone', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
  { label: 'MH +2% crit stone', apply: consumable('weapon_effect_main_hand', 'weapon_melee_crit_main_hand') },
  { label: 'OH Dense stone', apply: consumable('weapon_effect_off_hand', 'dense_sharpening_stone_off_hand') },
  { label: 'OH +2% crit stone', apply: consumable('weapon_effect_off_hand', 'weapon_melee_crit_off_hand') },
  { label: 'other: Healthstone for Thistle Tea', apply: consumable('other', 'healthstone') },
];

/* ---------------------------------------------------- generic additions */

/** An end-of-fight dump: spend whatever is on the pool when the fight is about to end. */
const dump = (seconds: number, points = 1): Apply =>
  addTop({ abilityId: 'eviscerate', condition: all(fightRemaining('atMost', seconds), cp('atLeast', points)) });

/** Expose Armor kept up at N points (it is a DIFFERENT aura id from Sunder Armor here, so it stacks). */
const exposeAbove = (beforeId: string, points: number): Apply =>
  addAbove({ abilityId: 'expose_armor', condition: all(targetTime('atMost', 0, 'expose_armor'), cp('atLeast', points)) }, beforeId);

const ruptureAbove = (beforeId: string, points: number, extra: readonly AplCondition[] = []): Apply =>
  addAbove({ abilityId: 'rupture', condition: all(targetTime('atMost', 0, 'rupture'), cp('atLeast', points), ...extra) }, beforeId);

/** Thistle Tea's energy gate, written on whatever entry the list carries. */
const tea = (n: number): Apply => cond('thistle_tea', energyAtMost(n));

/* ================================================================ VENOM */

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  r80venRace: raceGroup('undead'),
  r80venOpen: [
    CONTROL,
    { label: 'opener: stealth, Ambush at 0s', apply: addPrecombat(0, 'ambush') },
    { label: 'opener: stealth, Ambush + Frenzy potion at 0s', apply: addPrecombat(0, 'ambush', 'major_frenzy_potion') },
    { label: 'opener: Frenzy potion at 0s', apply: addPrecombat(0, 'major_frenzy_potion') },
  ],
  r80venSt: [
    CONTROL,
    { label: 'ADD Rupture at 4+ above Eviscerate', apply: ruptureAbove('eviscerate', 4) },
    { label: 'ADD Rupture at 5 above Eviscerate', apply: ruptureAbove('eviscerate', 5) },
    { label: 'ADD Rupture at 5 above Cold Blood', apply: ruptureAbove('cold_blood', 5) },
    { label: 'ADD Rupture at 3+ above Mutilate (sink)', apply: ruptureAbove('mutilate', 3) },
    { label: 'ADD Expose Armor at 5 above Eviscerate', apply: exposeAbove('eviscerate', 5) },
    { label: 'ADD Expose Armor at 3+ above Eviscerate', apply: exposeAbove('eviscerate', 3) },
    { label: 'ADD end dump: Eviscerate in last 3s', apply: dump(3) },
    { label: 'ADD end dump: Eviscerate in last 6s at 2+', apply: dump(6, 2) },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
    { label: 'Thistle Tea at energy <= 40', apply: tea(40) },
  ],
  /* Owner lines, priced, never shipped in the Single Target list. */
  r80venOwner: [
    CONTROL,
    { label: 'Eviscerate floors removed', apply: cond('eviscerate', cp('atLeast', 3)) },
    { label: 'Eviscerate floors 1s', apply: cond('eviscerate', all(cp('atLeast', 3), selfTime('atLeast', 1, 'slice_and_dice'), selfTime('atLeast', 1, 'venom'))) },
    { label: 'Slice and Dice at 2+', apply: cond('slice_and_dice', all(sndDown, cp('atLeast', 2))) },
    { label: 'Slice and Dice at 3+', apply: cond('slice_and_dice', all(sndDown, cp('atLeast', 3))) },
    { label: 'Venom at 2+', apply: cond('venom', all(selfTime('atMost', 0, 'venom'), cp('atLeast', 2))) },
    { label: 'Venom at 5', apply: cond('venom', all(selfTime('atMost', 0, 'venom'), cp('atLeast', 5))) },
    { label: 'Venom entry removed', apply: removeEntry('venom') },
    { label: 'Cold Blood ungated but points', apply: apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', 4) } : e))) },
  ],
  r80venEnch: enchantGroup,
  r80venCons: consumableGroup,
};

/* Not every builder is used by every group; keep the import list honest. */
void [any, not, onCooldown, ready, selfHas, targetCount, targetHas, energyAtLeast, precombatLead];

const dumpSweep = (prefix = ''): readonly Variant[] => [
  CONTROL,
  ...[2, 4, 6, 8, 10, 12].flatMap((s) =>
    [1, 2, 3].map((n) => ({ label: `${prefix}end dump: Eviscerate in last ${s}s at ${n}+`, apply: dump(s, n) })),
  ),
];
Object.assign(VARIANT_GROUPS, { r80venDump: dumpSweep() });

Object.assign(VARIANT_GROUPS, {
  r80venDump2: [
    CONTROL,
    ...[12, 15, 18, 22, 26, 30].map((s) => ({ label: `end dump: Eviscerate in last ${s}s at 2+`, apply: dump(s, 2) })),
    ...[15, 20].map((s) => ({ label: `end dump: Eviscerate in last ${s}s at 4+`, apply: dump(s, 4) })),
  ],
});

const venFloors = (n: number, floor: number): Apply =>
  cond('eviscerate', all(cp('atLeast', n), ...(floor > 0 ? [selfTime('atLeast', floor, 'slice_and_dice'), selfTime('atLeast', floor, 'venom')] : [])));
Object.assign(VARIANT_GROUPS, {
  r80venDumpClock: [
    CONTROL,
    ...[8, 12, 20, 26].map((s) => ({ label: `end dump: last ${s}s at 2+`, apply: dump(s, 2) })),
  ],
  r80venMt: [
    CONTROL,
    ...[8, 12, 20].map((s) => ({ label: `multi: end dump last ${s}s at 2+`, apply: inMulti(dump(s, 2)) })),
    { label: 'multi: dump 12 + floors removed', apply: inMulti(dump(12, 2), venFloors(3, 0)) },
    { label: 'multi: dump 12 + floors removed + SnD 2+', apply: inMulti(dump(12, 2), venFloors(3, 0), cond('slice_and_dice', all(sndDown, cp('atLeast', 2)))) },
    { label: 'multi: dump 12 + Eviscerate 4+ no floors', apply: inMulti(dump(12, 2), venFloors(4, 0)) },
    { label: 'multi: dump 12 + Cold Blood points only', apply: inMulti(dump(12, 2), apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', 4) } : e)))) },
    { label: 'multi: dump 12 + Expose 3+', apply: inMulti(dump(12, 2), exposeAbove('eviscerate', 3)) },
  ],
});

const cbPointsOnly = (n: number): Apply =>
  apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', n) } : e)));
const VEN_D = dump(20, 2);
Object.assign(VARIANT_GROUPS, {
  r80venMt2: [
    CONTROL,
    { label: 'multi: dump 20', apply: inMulti(VEN_D) },
    { label: 'multi: floors removed + dump 20', apply: inMulti(venFloors(3, 0), VEN_D) },
    { label: 'multi: floors 1s + dump 20', apply: inMulti(venFloors(3, 1), VEN_D) },
    { label: 'multi: Cold Blood 4+ + dump 20', apply: inMulti(cbPointsOnly(4), VEN_D) },
    { label: 'multi: Cold Blood 3+ + dump 20', apply: inMulti(cbPointsOnly(3), VEN_D) },
    { label: 'multi: floors removed + CB 4+ + dump 20', apply: inMulti(venFloors(3, 0), cbPointsOnly(4), VEN_D) },
    { label: 'multi: floors removed + CB 4+ + SnD 2+ + dump 20', apply: inMulti(venFloors(3, 0), cbPointsOnly(4), cond('slice_and_dice', all(sndDown, cp('atLeast', 2))), VEN_D) },
    { label: 'multi: floors removed + CB 4+ + Evis 4+ + dump 20', apply: inMulti(venFloors(4, 0), cbPointsOnly(4), VEN_D) },
    { label: 'multi: floors removed + CB 4+ + dump 26', apply: inMulti(venFloors(3, 0), cbPointsOnly(4), dump(26, 2)) },
    { label: 'multi: floors removed + CB 4+ + dump 20 + Frenzy at 0s', apply: chain(inMulti(venFloors(3, 0), cbPointsOnly(4), VEN_D, addPrecombat(0, 'major_frenzy_potion'))) },
  ],
});

/* ========================================== the other five, first pass */

const stCommon = (extra: readonly Variant[] = []): readonly Variant[] => [
  CONTROL,
  ...[8, 14, 20, 26].map((s) => ({ label: `ADD end dump: Eviscerate in last ${s}s at 2+`, apply: dump(s, 2) })),
  { label: 'ADD end dump: last 20s at 1+', apply: dump(20, 1) },
  { label: 'ADD end dump: last 20s at 3+', apply: dump(20, 3) },
  { label: 'ADD end dump: last 20s at 4+', apply: dump(20, 4) },
  { label: 'ADD Expose Armor at 5 above Eviscerate', apply: exposeAbove('eviscerate', 5) },
  { label: 'ADD Expose Armor at 3+ above Eviscerate', apply: exposeAbove('eviscerate', 3) },
  ...extra,
];
const ghostly = (beforeId: string, condition?: AplCondition): Apply =>
  addAbove(condition ? { abilityId: 'ghostly_strike', condition } : { abilityId: 'ghostly_strike' }, beforeId);

Object.assign(VARIANT_GROUPS, {
  r80cmutRace: raceGroup('undead'),
  r80cmbRace: raceGroup('gnome'),
  r80rupRace: raceGroup('undead'),
  r80hemoRace: raceGroup('undead'),
  r80phemoRace: raceGroup('undead'),
  r80cmutSt: stCommon([
    { label: 'ADD Rupture at 5 above Cold Blood', apply: ruptureAbove('cold_blood', 5) },
    { label: 'ADD Rupture at 4+ above Eviscerate', apply: ruptureAbove('eviscerate', 4) },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
    { label: 'Thistle Tea at energy <= 40', apply: tea(40) },
  ]),
  r80cmbSt: stCommon([
    { label: 'ADD Rupture at 5 above Cold Blood', apply: ruptureAbove('cold_blood', 5) },
    { label: 'ADD Rupture at 4+ above Eviscerate', apply: ruptureAbove('eviscerate', 4) },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
    { label: 'Thistle Tea at energy <= 40', apply: tea(40) },
  ]),
  r80rupSt: stCommon([
    { label: 'ADD Ghostly Strike above Backstab, pooling gate', apply: ghostly('backstab', not(all(selfHas('cutthroat'), resource('below', 60, 'energy')))) },
    { label: 'ADD Rupture at 5 bottom-ish (above Preparation), any Hemo', apply: ruptureAbove('preparation', 5) },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
  ]),
  r80hemoSt: stCommon([
    { label: 'ADD Eviscerate at 4+ above Preparation (no floors)', apply: addAbove({ abilityId: 'eviscerate', condition: cp('atLeast', 4) }, 'preparation') },
    { label: 'ADD Eviscerate at 5 above Preparation, rupture 2s', apply: addAbove({ abilityId: 'eviscerate', condition: all(cp('atLeast', 5), targetTime('atLeast', 2, 'rupture')) }, 'preparation') },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
  ]),
  r80phemoSt: stCommon([
    { label: 'ADD Ghostly Strike above Hemorrhage', apply: ghostly('hemorrhage') },
    { label: 'ADD Ghostly Strike above Hemorrhage, 60+ energy', apply: ghostly('hemorrhage', energyAtLeast(60)) },
    { label: 'Thistle Tea at energy <= 10', apply: tea(10) },
  ]),
});

/* ============================================ talents, WEIGHTED=1 only */

const VEN_T = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 2, relentless_strikes: 1, lethality: 5,
  vile_poisons: 4, cold_blood: 1, improved_poisons: 5, mutilate: 1, seal_fate: 5, venom: 1,
  improved_eviscerate: 3, lightning_reflexes: 2, puncturing_wounds: 3, precision: 3, endurance: 2,
  improved_sprint: 2, flawless_execution: 1, opportunity: 2,
};
const CMUT_T = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5,
  vile_poisons: 1, cold_blood: 1, improved_poisons: 5, mutilate: 1, seal_fate: 5,
  improved_eviscerate: 3, lightning_reflexes: 2, puncturing_wounds: 3, precision: 3, endurance: 2,
  improved_sprint: 2, flawless_execution: 1, dual_wield_specialization: 4, blade_flurry: 1,
};
const CMB_T = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
  improved_eviscerate: 3, improved_sinister_strike: 2, deflection: 3, precision: 3, endurance: 1, riposte: 1,
  improved_sprint: 2, flawless_execution: 1, dual_wield_specialization: 5, blade_flurry: 1, hack_and_slash: 5,
  weapon_expertise: 2, aggression: 3, adrenaline_rush: 1,
};

Object.assign(VARIANT_GROUPS, {
  r80venTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(VEN_T) },
    { label: 'Opportunity 2 -> Vigor 2', apply: tree({ ...VEN_T, opportunity: 0, vigor: 2 }) },
    { label: 'Opportunity 2 -> ISnD 3, Vile 5', apply: tree({ ...VEN_T, opportunity: 0, improved_slice_and_dice: 3, vile_poisons: 5 }) },
    { label: 'Vile 4 -> Vigor 2, ISnD 3, (Vile 1)', apply: tree({ ...VEN_T, vile_poisons: 1, vigor: 2, improved_slice_and_dice: 3 }) },
    { label: 'Improved Poisons 5 -> 3, Vile 5, ISnD 3', apply: tree({ ...VEN_T, improved_poisons: 3, vile_poisons: 5, improved_slice_and_dice: 3 }) },
    { label: 'Improved Eviscerate 3 -> Deflection? no: -> ISS 2 + LR 3', apply: tree({ ...VEN_T, improved_eviscerate: 0, improved_sinister_strike: 2, lightning_reflexes: 3 }) },
  ],
  r80cmutTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(CMUT_T) },
    { label: 'Vile 1 + DWS 1 -> Vigor 2', apply: tree({ ...CMUT_T, vile_poisons: 0, dual_wield_specialization: 3, vigor: 2 }) },
    { label: 'Improved Poisons 5 -> 4, DWS 5', apply: tree({ ...CMUT_T, improved_poisons: 4, dual_wield_specialization: 5 }) },
    { label: 'Vile 1 -> DWS 5', apply: tree({ ...CMUT_T, vile_poisons: 0, dual_wield_specialization: 5 }) },
    { label: 'Improved Poisons 5 -> 2, Vile 4', apply: tree({ ...CMUT_T, improved_poisons: 2, vile_poisons: 4 }) },
  ],
  r80cmbTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(CMB_T) },
    { label: 'Riposte 1 + Deflection 1 -> Vile 2', apply: tree({ ...CMB_T, riposte: 0, deflection: 2, lightning_reflexes: 1, vile_poisons: 2 }) },
    { label: 'Riposte 1 + Imp Sprint 1 -> Improved Poisons 2', apply: tree({ ...CMB_T, riposte: 0, deflection: 3, improved_sprint: 1, lightning_reflexes: 1, improved_poisons: 2 }) },
    { label: 'DWS 5 -> 3, Vile 2', apply: tree({ ...CMB_T, dual_wield_specialization: 3, vile_poisons: 2 }) },
  ],
});

const RUP_T = {
  malice: 5, ruthlessness: 3, relentless_strikes: 1, improved_slice_and_dice: 3, improved_eviscerate: 3,
  lightning_reflexes: 2, puncturing_wounds: 3, camouflage: 5, master_of_deception: 3, opportunity: 2,
  improved_ambush: 3, initiative: 3, ghostly_strike: 1, improved_distract: 2, premeditation: 1,
  serrated_blades: 3, preparation: 1, hemorrhage: 1, cutthroat: 5, thousand_cuts: 1,
};
const HEMO_T = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 2, relentless_strikes: 1, lethality: 5, cold_blood: 1,
  improved_poisons: 3, camouflage: 5, master_of_deception: 3, opportunity: 2, improved_ambush: 3, initiative: 3,
  improved_distract: 1, premeditation: 1, serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
  quietus: 5, thousand_cuts: 1,
};
const PHEMO_T = {
  malice: 5, ruthlessness: 3, improved_slice_and_dice: 3, relentless_strikes: 1, lethality: 5, cold_blood: 1,
  improved_poisons: 1, improved_eviscerate: 3, lightning_reflexes: 2, precision: 3, camouflage: 5,
  master_of_deception: 3, opportunity: 2, elusiveness: 2, initiative: 3, ghostly_strike: 1, premeditation: 1,
  serrated_blades: 3, dirty_deeds: 2, preparation: 1, hemorrhage: 1,
};
Object.assign(VARIANT_GROUPS, {
  r80rupTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(RUP_T) },
    { label: 'Lightning Reflexes 2 -> Precision 2', apply: tree({ ...RUP_T, lightning_reflexes: 0, precision: 2 }) },
    { label: 'Puncturing 3 + LR 2 -> Precision 3 + ISS 2', apply: tree({ ...RUP_T, lightning_reflexes: 0, puncturing_wounds: 0, precision: 3, improved_sinister_strike: 2 }) },
    { label: 'Improved Distract 2 -> ... Elusiveness 2', apply: tree({ ...RUP_T, improved_distract: 0, elusiveness: 2 }) },
  ],
  r80hemoTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(HEMO_T) },
    { label: 'Improved Poisons 3 -> Vile 3', apply: tree({ ...HEMO_T, improved_poisons: 0, vile_poisons: 3 }) },
    { label: 'Improved Poisons 3 -> IP 2, ISnD 3', apply: tree({ ...HEMO_T, improved_poisons: 2, improved_slice_and_dice: 3 }) },
    { label: 'Improved Distract 1 -> Elusiveness 1', apply: tree({ ...HEMO_T, improved_distract: 0, elusiveness: 1 }) },
  ],
  r80phemoTalents: [
    CONTROL,
    { label: 'control written out', apply: tree(PHEMO_T) },
    { label: 'Elusiveness 2 -> Improved Ambush? no dagger: -> Improved Distract 2', apply: tree({ ...PHEMO_T, elusiveness: 0, improved_distract: 2 }) },
    { label: 'Improved Poisons 1 -> Vile 1', apply: tree({ ...PHEMO_T, improved_poisons: 0, vile_poisons: 1 }) },
    { label: 'Combat 8 -> IP 5, Vile 3 (Precision lost)', apply: tree({ ...PHEMO_T, improved_eviscerate: 0, lightning_reflexes: 0, precision: 0, improved_poisons: 5, vile_poisons: 4 }) },
  ],
});

/* ================================================ Multi Target, pass 1 */

const mtDumps = (points = 2): readonly Variant[] =>
  [8, 14, 20, 26].map((s) => ({ label: `multi: end dump last ${s}s at ${points}+`, apply: inMulti(dump(s, points)) }));

Object.assign(VARIANT_GROUPS, {
  r80cmutMt: [
    CONTROL,
    ...mtDumps(),
    { label: 'multi: dump 14 + Cold Blood 4+ points only', apply: inMulti(cbPointsOnly(4), dump(14, 2)) },
    { label: 'multi: dump 14 + Cold Blood 3+ points only', apply: inMulti(cbPointsOnly(3), dump(14, 2)) },
    { label: 'multi: dump 14 + Eviscerate 2+', apply: inMulti(cond('eviscerate', cp('atLeast', 2)), dump(14, 2)) },
    { label: 'multi: dump 14 + Eviscerate 4+', apply: inMulti(cond('eviscerate', cp('atLeast', 4)), dump(14, 2)) },
    { label: 'multi: dump 14 + SnD 2+', apply: inMulti(cond('slice_and_dice', all(sndDown, cp('atLeast', 2))), dump(14, 2)) },
    { label: 'multi: dump 14 + Blade Flurry lead 0s', apply: inMulti(dump(14, 2), precombatLead('blade_flurry', 0)) },
    { label: 'multi: dump 14 + Thistle Tea at 40', apply: inMulti(tea(40), dump(14, 2)) },
  ],
  r80cmbMt: [
    CONTROL,
    ...mtDumps(),
    { label: 'multi: dump 14 + Eviscerate/CB 4+', apply: inMulti(cond('eviscerate', cp('atLeast', 4)), apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', 4) } : e))), dump(14, 2)) },
    { label: 'multi: dump 14 + Eviscerate/CB 3+', apply: inMulti(cond('eviscerate', cp('atLeast', 3)), apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', 3) } : e))), dump(14, 2)) },
    { label: 'multi: dump 14 + SnD 2+', apply: inMulti(cond('slice_and_dice', all(sndDown, cp('atLeast', 2))), dump(14, 2)) },
    { label: 'multi: dump 14 + Thistle Tea at 40', apply: inMulti(tea(40), dump(14, 2)) },
    { label: 'multi: dump 14 + Blade Flurry lead 0s', apply: inMulti(dump(14, 2), precombatLead('blade_flurry', 0)) },
  ],
  r80rupMt: [
    CONTROL,
    ...mtDumps(),
    { label: 'multi: dump 14 + Rupture at 3+', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 3), targetHas('hemorrhage'))), dump(14, 2)) },
    { label: 'multi: dump 14 + Rupture at 5', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 5), targetHas('hemorrhage'))), dump(14, 2)) },
    { label: 'multi: dump 14 + Eviscerate floors 3s', apply: inMulti(cond('eviscerate', all(cp('atLeast', 4), targetTime('atLeast', 3, 'rupture'), selfTime('atLeast', 3, 'slice_and_dice'))), dump(14, 2)) },
    { label: 'multi: dump 14 + Eviscerate 4+ no floors', apply: inMulti(cond('eviscerate', cp('atLeast', 4)), dump(14, 2)) },
    { label: 'multi: dump 14 + Rupture removed, Eviscerate 4+', apply: inMulti(removeEntry('rupture'), cond('eviscerate', cp('atLeast', 4)), dump(14, 2)) },
  ],
  r80hemoMt: [
    CONTROL,
    ...mtDumps(),
    { label: 'multi: Rupture at 4+', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 4)))) },
    { label: 'multi: Rupture at 5', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 5)))) },
    { label: 'multi: Rupture removed', apply: inMulti(removeEntry('rupture')) },
    { label: 'multi: Eviscerate/CB 4+ floors 2s', apply: inMulti(
        cond('eviscerate', all(cp('atLeast', 4), targetTime('atLeast', 2, 'rupture'), selfTime('atLeast', 2, 'slice_and_dice'))),
        apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: all(cp('atLeast', 4), targetTime('atLeast', 2, 'rupture'), selfTime('atLeast', 2, 'slice_and_dice')) } : e)))) },
    { label: 'multi: Rupture removed + Evis/CB 4+ no floors', apply: inMulti(removeEntry('rupture'), cond('eviscerate', cp('atLeast', 4)),
        apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: cp('atLeast', 4) } : e)))) },
  ],
  r80phemoMt: [
    CONTROL,
    ...mtDumps(),
    { label: 'multi: dump 8 + SnD 1+', apply: inMulti(cond('slice_and_dice', all(sndDown, cp('atLeast', 1))), dump(8, 2)) },
    { label: 'multi: dump 8 + SnD 2+', apply: inMulti(cond('slice_and_dice', all(sndDown, cp('atLeast', 2))), dump(8, 2)) },
    { label: 'multi: dump 8 + Rupture removed', apply: inMulti(removeEntry('rupture'), dump(8, 2)) },
    { label: 'multi: dump 8 + Evis/CB 4+', apply: inMulti(cond('eviscerate', all(cp('atLeast', 4), selfTime('atLeast', 1, 'slice_and_dice'))),
        apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: all(cp('atLeast', 4), selfTime('atLeast', 1, 'slice_and_dice')) } : e))), dump(8, 2)) },
  ],
});

/* ============================================================ openers */

const withOpener = (actions: readonly [string, number][]): Apply => (profile) => ({
  ...profile,
  precombat: actions.map(([abilityId, secondsBefore]) => ({ abilityId, secondsBefore })),
});
Object.assign(VARIANT_GROUPS, {
  r80cmutOpen: [
    CONTROL,
    { label: 'owner line: Ambush then Blade Flurry, both at 0s', apply: withOpener([['ambush', 0], ['blade_flurry', 0]]) },
    { label: 'ADD Frenzy potion at 0s after Blade Flurry', apply: addPrecombat(0, 'major_frenzy_potion') },
  ],
  r80cmbOpen: [
    CONTROL,
    { label: 'owner line: Garrote then Blade Flurry, both at 0s', apply: withOpener([['garrote', 0], ['blade_flurry', 0]]) },
    { label: 'ADD Frenzy potion at 0s', apply: addPrecombat(0, 'major_frenzy_potion') },
    { label: 'ADD Adrenaline Rush at 0s', apply: addPrecombat(0, 'adrenaline_rush') },
    { label: 'ADD Adrenaline Rush + Frenzy at 0s', apply: addPrecombat(0, 'adrenaline_rush', 'major_frenzy_potion') },
  ],
  r80rupOpen: [
    CONTROL,
    { label: 'ADD Premeditation before Ambush? (opener line)', apply: withOpener([['stealth', 2], ['premeditation', 0], ['ambush', 0], ['major_frenzy_potion', 0]]) },
  ],
  r80phemoOpen: [
    CONTROL,
    { label: 'opener: Premeditation, Garrote, potion', apply: withOpener([['stealth', 2], ['premeditation', 0], ['garrote', 0], ['major_frenzy_potion', 0]]) },
  ],
});

/* ================================================ Multi Target, pass 2 */

const hemoFinish = (n: number, floor: number): Apply => {
  const c = all(cp('atLeast', n), ...(floor > 0 ? [targetTime('atLeast', floor, 'rupture'), selfTime('atLeast', floor, 'slice_and_dice')] : []));
  return chain(cond('eviscerate', c), apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: c } : e))));
};
Object.assign(VARIANT_GROUPS, {
  r80venMt3: [
    CONTROL,
    { label: 'multi: Cold Blood 3+ points only', apply: inMulti(cbPointsOnly(3)) },
    ...[25, 40, 55].map((n) => ({ label: `multi: CB 3+ + Thistle Tea at ${n}`, apply: inMulti(cbPointsOnly(3), tea(n)) })),
    { label: 'multi: CB 3+ + SnD 2+', apply: inMulti(cbPointsOnly(3), cond('slice_and_dice', all(sndDown, cp('atLeast', 2)))) },
    { label: 'multi: CB 3+ + Frenzy potion ungated', apply: inMulti(cbPointsOnly(3), cond('major_frenzy_potion', undefined)) },
  ],
  r80cmbMt2: [
    CONTROL,
    ...[25, 40, 55, 70].map((n) => ({ label: `multi: Thistle Tea at ${n}`, apply: inMulti(tea(n)) })),
    { label: 'multi: Thistle Tea at 40 + SnD 2+', apply: inMulti(tea(40), cond('slice_and_dice', all(sndDown, cp('atLeast', 2)))) },
    { label: 'multi: Thistle Tea at 40 + Frenzy ungated', apply: inMulti(tea(40), cond('major_frenzy_potion', undefined)) },
    { label: 'multi: Thistle Tea only while Blade Flurry is up, at 55', apply: inMulti(cond('thistle_tea', all(energyAtMost(55), selfHas('blade_flurry')))) },
  ],
  r80cmutMt2: [
    CONTROL,
    ...[25, 40, 55].map((n) => ({ label: `multi: Thistle Tea at ${n}`, apply: inMulti(tea(n)) })),
    { label: 'multi: Thistle Tea only while Blade Flurry is up, at 55', apply: inMulti(cond('thistle_tea', all(energyAtMost(55), selfHas('blade_flurry')))) },
    { label: 'multi: Frenzy ungated', apply: inMulti(cond('major_frenzy_potion', undefined)) },
  ],
  r80hemoMt2: [
    CONTROL,
    ...[0, 1, 2, 3].map((f) => ({ label: `multi: Evis/CB 4+ floors ${f}s`, apply: inMulti(hemoFinish(4, f)) })),
    { label: 'multi: Evis/CB 5 floors 2s', apply: inMulti(hemoFinish(5, 2)) },
    { label: 'multi: Evis/CB 4+ floors 2s + dump 14', apply: inMulti(hemoFinish(4, 2), dump(14, 2)) },
    { label: 'multi: Evis/CB 4+ floors 2s + dump 8', apply: inMulti(hemoFinish(4, 2), dump(8, 2)) },
  ],
  r80phemoMt2: [
    CONTROL,
    { label: 'multi: Rupture removed', apply: inMulti(removeEntry('rupture')) },
    { label: 'multi: Rupture removed + SnD 1+', apply: inMulti(removeEntry('rupture'), cond('slice_and_dice', all(sndDown, cp('atLeast', 1)))) },
    { label: 'multi: Rupture removed + SnD 2+', apply: inMulti(removeEntry('rupture'), cond('slice_and_dice', all(sndDown, cp('atLeast', 2)))) },
    { label: 'multi: Rupture removed + dump 14', apply: inMulti(removeEntry('rupture'), dump(14, 2)) },
  ],
  r80rupMt2: [
    CONTROL,
    { label: 'multi: Rupture at 3+', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 3), targetHas('hemorrhage')))) },
    ...[25, 40].map((n) => ({ label: `multi: Thistle Tea at ${n}`, apply: inMulti(tea(n)) })),
  ],
});

/* ================================================ Multi Target, pass 3 */

const sndAt = (n: number): Apply => cond('slice_and_dice', all(sndDown, cp('atLeast', n)));
Object.assign(VARIANT_GROUPS, {
  r80venMt4: [
    CONTROL,
    { label: 'multi: CB 3+ + SnD 2+', apply: inMulti(cbPointsOnly(3), sndAt(2)) },
    ...[15, 20, 25, 30].map((n) => ({ label: `multi: CB 3+ + SnD 2+ + tea ${n}`, apply: inMulti(cbPointsOnly(3), sndAt(2), tea(n)) })),
    { label: 'multi: CB 3+ + SnD 2+ + tea 25 + Frenzy ungated', apply: inMulti(cbPointsOnly(3), sndAt(2), tea(25), cond('major_frenzy_potion', undefined)) },
    { label: 'multi: CB 3+ + SnD 3+ + tea 25', apply: inMulti(cbPointsOnly(3), sndAt(3), tea(25)) },
  ],
  r80cmbMt3: [
    CONTROL,
    ...[20, 25, 30, 35].map((n) => ({ label: `multi: tea ${n}`, apply: inMulti(tea(n)) })),
    { label: 'multi: tea 25 + Frenzy ungated', apply: inMulti(tea(25), cond('major_frenzy_potion', undefined)) },
    { label: 'multi: tea 25 + SnD 2+', apply: inMulti(tea(25), sndAt(2)) },
    { label: 'multi: tea 25 + dump 8', apply: inMulti(tea(25), dump(8, 2)) },
  ],
  r80cmbTea: [
    CONTROL,
    ...[20, 25, 30].map((n) => ({ label: `owner line: Single Target tea at ${n}`, apply: tea(n) })),
  ],
  r80cmutMt3: [
    CONTROL,
    { label: 'multi: Frenzy ungated', apply: inMulti(cond('major_frenzy_potion', undefined)) },
    { label: 'multi: Frenzy ungated + SnD 2+', apply: inMulti(cond('major_frenzy_potion', undefined), sndAt(2)) },
    { label: 'multi: Frenzy ungated + tea 15', apply: inMulti(cond('major_frenzy_potion', undefined), tea(15)) },
  ],
  r80phemoMt3: [
    CONTROL,
    { label: 'multi: Rupture removed + SnD 1+', apply: inMulti(removeEntry('rupture'), sndAt(1)) },
    { label: 'multi: Rupture removed + SnD 1+ + Evis/CB 4+', apply: inMulti(removeEntry('rupture'), sndAt(1),
        cond('eviscerate', all(cp('atLeast', 4), selfTime('atLeast', 1, 'slice_and_dice'))),
        apl((es) => es.map((e) => (e.abilityId === 'cold_blood' ? { ...e, condition: all(cp('atLeast', 4), selfTime('atLeast', 1, 'slice_and_dice')) } : e)))) },
    { label: 'multi: Rupture removed + SnD 1+ + tea 25', apply: inMulti(removeEntry('rupture'), sndAt(1), tea(25)) },
  ],
  r80hemoMt3: [
    CONTROL,
    { label: 'multi: Evis/CB 4+ floors 2s + dump 8', apply: inMulti(hemoFinish(4, 2), dump(8, 2)) },
    { label: 'multi: + SnD 2+', apply: inMulti(hemoFinish(4, 2), dump(8, 2), sndAt(2)) },
    { label: 'multi: + tea 25', apply: inMulti(hemoFinish(4, 2), dump(8, 2), tea(25)) },
    { label: 'multi: Rupture at 2+, Evis/CB 4+ floors 2s, dump 8', apply: inMulti(cond('rupture', all(targetTime('atMost', 0, 'rupture'), cp('atLeast', 2))), hemoFinish(4, 2), dump(8, 2)) },
  ],
});

for (const k of ['cmut', 'cmb', 'rup', 'hemo', 'phemo']) {
  VARIANT_GROUPS[`r80${k}Ench`] = enchantGroup;
  VARIANT_GROUPS[`r80${k}Cons`] = consumableGroup;
}

/* ======================================= Vanish, which every Rogue owns */

const vanishInto = (finisher: 'ambush' | 'garrote', cost: number, extra: readonly AplCondition[] = []): AplEntry => ({
  abilityId: 'vanish',
  sequence: [finisher],
  condition: all(energyAtLeast(cost), ...extra),
});
const coldBloodVanishAmbush: AplEntry = {
  abilityId: 'cold_blood',
  sequence: ['vanish', 'ambush'],
  condition: all(energyAtLeast(60), cp('atMost', 3)),
};
Object.assign(VARIANT_GROUPS, {
  r80venVanish: [
    CONTROL,
    { label: 'ADD Vanish -> Ambush above Mutilate', apply: addAbove(vanishInto('ambush', 60), 'mutilate') },
    { label: 'ADD Vanish -> Ambush above Mutilate, at 3 or fewer points', apply: addAbove(vanishInto('ambush', 60, [cp('atMost', 3)]), 'mutilate') },
    { label: 'ADD Vanish -> Ambush at the top, 60 energy', apply: addTop(vanishInto('ambush', 60)) },
    { label: 'ADD Cold Blood -> Vanish -> Ambush above Mutilate', apply: addAbove(coldBloodVanishAmbush, 'mutilate') },
  ],
  r80cmbVanish: [
    CONTROL,
    { label: 'ADD Vanish -> Garrote above Sinister Strike', apply: addAbove(vanishInto('garrote', 50), 'sinister_strike') },
    { label: 'ADD Vanish -> Garrote at the top', apply: addTop(vanishInto('garrote', 50)) },
  ],
});
VARIANT_GROUPS.r80cmutVanish = VARIANT_GROUPS.r80venVanish;

Object.assign(VARIANT_GROUPS, {
  r80cmbCombined: [
    CONTROL,
    { label: 'ADD Vanish -> Garrote at the top, Single Target only', apply: addTop(vanishInto('garrote', 50)) },
    { label: 'ADD Vanish -> Garrote at the top, both lists', apply: chain(addTop(vanishInto('garrote', 50)), inMulti(addTop(vanishInto('garrote', 50)))) },
    { label: 'ADD Vanish -> Garrote above Sinister Strike, both lists', apply: chain(addAbove(vanishInto('garrote', 50), 'sinister_strike'), inMulti(addAbove(vanishInto('garrote', 50), 'sinister_strike'))) },
  ],
});
