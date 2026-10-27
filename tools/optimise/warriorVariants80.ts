/*
 * ============================================================================
 * ROUND 80: THE FOUR WARRIOR PRESETS, SECOND RUN OF THE FULL-REPORT PROCEDURE.
 *
 *   PRESET=dw_fury FILE=tools/optimise/warriorVariants80.ts VARIANTS=w80FuryRace WEIGHTED=1 \
 *     ITER=300 npx vite-node tools/probe_build.ts
 *   PRESET=dw_fury FILE=tools/optimise/warriorVariants80.ts VARIANTS=w80FurySt DURATION=120 \
 *     ITER=400 npx vite-node tools/probe_build.ts
 *   PRESET=dw_fury FILE=tools/optimise/warriorVariants80.ts VARIANTS=w80FuryAoe TARGETS=5 \
 *     DURATION=60 ITER=400 npx vite-node tools/probe_build.ts
 *
 * THE THEME (Step 0). These may not move:
 *
 *   | preset        | tree      | style and weapons    | stance     | target swings back |
 *   | ------------- | --------- | -------------------- | ---------- | ------------------ |
 *   | two_hand_arms | 39/10/2   | two-hander (E65)     | Battle     | no  -> DPS         |
 *   | dw_fury       | 17/34/0   | dual-wield (E65)     | Berserker  | no  -> DPS         |
 *   | prot_warr     | 17/2/32   | one-hand and shield  | Defensive  | yes -> TPS         |
 *   | fury_prot     | 5/31/15   | one-hand and shield  | Defensive  | yes -> TPS         |
 *
 * THE ROUND 79 RULES: talents, race, enchants and stat consumables on the
 * WEIGHTED score (49% 1T/120s + 17% each 3T/60, 5T/60, 8T/30); the Single
 * Target list on 1T/120s; the Multi Target list on 5T/60s, checked at 3/60 and
 * 8/30. All four Single Target lists are the OWNER'S, so an edit there may only
 * ADD an entry or retune one this project added; an owner line or number that
 * loses is a "Needs the owner" row.
 *
 * BEFORE (full_report, ITER=300, seed 20261025):
 *
 *   2H Arms    DPS  t1 842.5   t3 1129.3  t5 1196.7  t8 1258.5  weighted 1022.2
 *   DW Fury    DPS  t1 979.3   t3 1381.7  t5 1475.4  t8 1643.2  weighted 1244.9
 *   Prot Warr  TPS  t1 1064.8  t3 1558.0  t5 1860.4  t8 2271.5  weighted 1489.0
 *   Fury Prot  TPS  t1 1121.4  t3 1754.3  t5 2088.5  t8 2826.3  weighted 1683.2
 * ============================================================================
 */
import {
  type Apply,
  type Variant,
  WARRIOR_TREE as tree,
  addAbove,
  addEntry,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  removeEntry,
  removePrecombat,
} from '../buildVariants';
import {
  all,
  any,
  fightElapsed,
  fightRemaining,
  fightRemainingFraction,
  not,
  resource,
  targetCount,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { CharacterProfile } from '../../src/profiles';
import type { RaceId } from '../../src/game/character';

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

const entryAt = (entries: readonly AplEntry[], id: string) => {
  const at = entries.findIndex((e) => e.abilityId === id);
  if (at < 0) throw new Error('no entry for ' + id);
  return at;
};

/** Replace one entry's condition (the first entry for that ability). */
const regate = (abilityId: string, condition: AplCondition | undefined): Apply =>
  apl((entries) => {
    const at = entryAt(entries, abilityId);
    const { condition: _drop, ...rest } = entries[at];
    void _drop;
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

const enable = (abilityId: string): Apply =>
  apl((entries) => {
    const at = entryAt(entries, abilityId);
    const { disabled: _d, ...rest } = entries[at];
    void _d;
    entries[at] = rest;
    return entries;
  });

const swapAbility = (from: string, to: string, condition?: AplCondition): Apply =>
  apl((entries) => {
    const at = entryAt(entries, from);
    entries[at] = { ...entries[at], abilityId: to, ...(condition ? { condition } : {}) };
    return entries;
  });

const addTop = (entry: AplEntry): Apply => apl((entries) => [entry, ...entries]);

const race =
  (r: RaceId): Apply =>
  (p: CharacterProfile) => ({ ...p, character: { ...p.character, race: r } });

/** A race swap that also trades the Orc's Blood Fury pre-combat line for the new race's own. */
const raceFromOrc = (r: RaceId): Apply =>
  chain(race(r), removePrecombat('blood_fury'), ...(r === 'troll' ? [addPrecombat(0, 'berserking')] : []));

const dropConsumable =
  (category: string): Apply =>
  (p) => {
    const { [category]: _gone, ...rest } = p.consumables as Record<string, string>;
    void _gone;
    return { ...p, consumables: rest };
  };

const EXECUTE_PHASE = fightRemainingFraction('atMost', 0.2);
const outsideExecute = (c?: AplCondition): AplCondition => (c ? all(c, not(EXECUTE_PHASE)) : not(EXECUTE_PHASE));

const without = (a: Record<string, number>, ...ids: string[]) => {
  const c = { ...a };
  for (const id of ids) delete c[id];
  return c;
};

const HORDE: readonly RaceId[] = ['orc', 'undead', 'tauren', 'troll', 'windshaper_skyborne'];

/* ============================================================== RACE (weighted) */

const dpsRaces: Variant[] = [
  control('race (orc)'),
  ...HORDE.filter((r) => r !== 'orc').map((r) => ({ label: `race -> ${r}`, apply: raceFromOrc(r) })),
];
const tankRaces: Variant[] = [
  control('race (tauren)'),
  ...HORDE.filter((r) => r !== 'tauren').map((r) => ({ label: `race -> ${r}`, apply: race(r) })),
];

/* ============================================================== TALENTS (weighted) */

const ARMS: Record<string, number> = {
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
const armsTalents: Variant[] = [
  control('2H Arms tree (39/10/2)'),
  { label: 'Improved Bloodrage 2 -> Deflection 2', apply: tree({ ...without(ARMS, 'improved_bloodrage'), deflection: 2 }) },
  { label: 'Improved Charge 2 -> Deflection 2', apply: tree({ ...without(ARMS, 'improved_charge'), deflection: 2 }) },
  { label: 'Improved Overpower 2 -> Deflection 2', apply: tree({ ...without(ARMS, 'improved_overpower'), deflection: 2 }) },
  { label: 'Unbridled Wrath 5 -> Booming Voice 5', apply: tree({ ...without(ARMS, 'unbridled_wrath'), booming_voice: 5 }) },
  { label: 'Unbridled Wrath 5 -> Lingering Rage 5 (dead)', apply: tree({ ...without(ARMS, 'unbridled_wrath'), lingering_rage: 5 }) },
  { label: 'IBR 2 + ICharge 2 -> Deflection 4', apply: tree({ ...without(ARMS, 'improved_bloodrage', 'improved_charge'), deflection: 4 }) },
];

const FURY: Record<string, number> = {
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
  enrage: 2,
  improved_execute: 2,
  improved_berserker_rage: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
};
const furyTalents: Variant[] = [
  control('DW Fury tree (17/34/0)'),
  { label: 'Lingering Rage 2 -> Booming Voice 2', apply: tree({ ...without(FURY, 'lingering_rage'), booming_voice: 2 }) },
  { label: 'Enrage 2 -> Booming Voice 2', apply: tree({ ...without(FURY, 'enrage'), booming_voice: 2 }) },
  { label: 'Raging Blows 1 -> Piercing Howl 1', apply: tree({ ...without(FURY, 'raging_blows'), piercing_howl: 1 }) },
  { label: 'Improved Execute 2 -> Enrage 4', apply: tree({ ...without(FURY, 'improved_execute', 'enrage'), enrage: 4 }) },
  { label: 'IBR 2 -> Enrage 4', apply: tree({ ...without(FURY, 'improved_berserker_rage', 'enrage'), enrage: 4 }) },
  {
    label: 'Improved Rend 3 -> Improved Overpower 2 + Deflection 1 (Deep Wounds dropped? no: needs IR 3)',
    apply: tree({ ...without(FURY, 'improved_rend'), improved_overpower: 2, deflection: 1 }),
  },
];

const PROT: Record<string, number> = {
  improved_heroic_strike: 3,
  deflection: 5,
  improved_rend: 3,
  improved_charge: 1,
  deep_wounds: 3,
  impale: 2,
  cruelty: 2,
  shield_specialization: 5,
  anticipation: 5,
  improved_revenge: 3,
  improved_thunder_clap: 2,
  last_stand: 1,
  master_of_defense: 2,
  defiance: 3,
  vanguard: 1,
  concussion_blow: 1,
  bastion: 5,
  focused_rage: 3,
  shield_slam: 1,
};
const PROT_AM = {
  ...without(PROT, 'deflection', 'improved_charge'),
  improved_tactical_mastery: 5,
  anger_management: 1,
};
const protTalents: Variant[] = [
  control('Prot Warr tree (17/2/32)'),
  { label: 'Deflection 5 + ICharge 1 -> ITM 5 + Anger Management', apply: tree(PROT_AM) },
  { label: 'Cruelty 2 -> ITC 3 + Improved Bloodrage 1', apply: tree({ ...without(PROT, 'cruelty'), improved_thunder_clap: 3, improved_bloodrage: 1 }) },
  { label: 'Cruelty 2 -> Improved Bloodrage 2', apply: tree({ ...without(PROT, 'cruelty'), improved_bloodrage: 2 }) },
  { label: 'AM build, Cruelty 2 -> Improved Bloodrage 2', apply: tree({ ...without(PROT_AM, 'cruelty'), improved_bloodrage: 2 }) },
  { label: 'Anticipation 5 -> Cruelty 5 (Cruelty 2 -> UW? no) i.e. Cruelty 2+5 = 5, UW 2', apply: tree({ ...without(PROT, 'anticipation', 'cruelty'), cruelty: 5, unbridled_wrath: 2 }) },
  { label: 'Anticipation 5 -> Cruelty 3 more + ITC 1 + IBR 1', apply: tree({ ...without(PROT, 'anticipation', 'cruelty'), cruelty: 5, improved_thunder_clap: 3, improved_bloodrage: 1 }) },
  { label: 'Vanguard 1 -> ITC 3 (no Charge in Defensive)', apply: tree({ ...without(PROT, 'vanguard'), improved_thunder_clap: 3 }) },
];

const FP: Record<string, number> = {
  deflection: 5,
  booming_voice: 4,
  cruelty: 5,
  unbridled_wrath: 5,
  blood_craze: 3,
  enrage: 5,
  improved_execute: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
  shield_specialization: 5,
  anticipation: 3,
  improved_revenge: 3,
  last_stand: 1,
  defiance: 3,
};
const FP_MOD = { ...without(FP, 'deflection'), improved_thunder_clap: 3, master_of_defense: 2 };
const fpCandidates: Variant[] = [
  control('Fury Prot build'),
  { label: 'Deflection 5 -> ITC 3 + MoD 2', apply: tree(FP_MOD) },
  { label: 'MoD tree + orc', apply: chain(tree(FP_MOD), race('orc')) },
  { label: 'MoD tree + undead', apply: chain(tree(FP_MOD), race('undead')) },
  { label: 'MoD tree + orc + Str x4 + cloak Agi', apply: chain(tree(FP_MOD), race('orc'), TANK_STR_AGI_FN()) },
  { label: 'MoD tree + undead + Str x4 + cloak Agi', apply: chain(tree(FP_MOD), race('undead'), TANK_STR_AGI_FN()) },
  { label: 'orc + Str x4 + cloak Agi (Deflection kept)', apply: chain(race('orc'), TANK_STR_AGI_FN()) },
  { label: 'undead + Str x4 + cloak Agi (Deflection kept)', apply: chain(race('undead'), TANK_STR_AGI_FN()) },
];
const fpTalents: Variant[] = [
  control('Fury Prot tree (5/31/15)'),
  { label: 'Deflection 5 -> ITC 3 + Master of Defense 2', apply: tree({ ...without(FP, 'deflection'), improved_thunder_clap: 3, master_of_defense: 2 }) },
  { label: 'Deflection 5 -> Anticipation 5 + MoD 2 + ITC 1', apply: tree({ ...without(FP, 'deflection', 'anticipation'), anticipation: 5, master_of_defense: 2, improved_thunder_clap: 1 }) },
  { label: 'Anticipation 3 -> ITC 3', apply: tree({ ...without(FP, 'anticipation'), improved_thunder_clap: 3 }) },
  { label: 'Anticipation 3 -> MoD 2 + ITC 1', apply: tree({ ...without(FP, 'anticipation'), master_of_defense: 2, improved_thunder_clap: 1 }) },
  { label: 'Blood Craze 3 -> Furious Precision 3 (both dead-ish)', apply: tree({ ...without(FP, 'blood_craze'), furious_precision: 3 }) },
  { label: 'Deflection 5 -> Improved Bloodrage 2 + ITC 3', apply: tree({ ...without(FP, 'deflection'), improved_bloodrage: 2, improved_thunder_clap: 3 }) },
];

/* ============================================================== ENCHANTS (weighted) */

const E = {
  dodge: 900001,
  haste: 900002,
  agi8: 900003,
  sta8: 900004,
  str8: 900005,
  neckStr: 900008,
  neckAgi: 900011,
  neckDef: 900012,
  cloakAgi: 900011,
  cloakArmor: 900013,
  def4: 900016,
  wristStr: 900017,
  wristAgi: 900019,
  gloveStr: 900021,
  gloveAgi: 900022,
  threat: 900024,
  feetAgi: 900026,
  feetSta: 900027,
  agi15: 900022,
  agi25: 900031,
};

const dpsEnchants = (twoHand: boolean): Variant[] => [
  control('enchants'),
  { label: 'head +8 Str -> +1% Haste', apply: enchant('head', E.haste) },
  { label: 'legs +8 Str -> +1% Haste', apply: enchant('legs', E.haste) },
  { label: 'gloves +15 Str -> +1% Haste', apply: enchant('gloves', E.haste) },
  { label: 'cloak +5 Agi -> +60 Armor (control: worth 0)', apply: enchant('cloak', E.cloakArmor) },
  { label: 'feet +7 Agi -> +7 Stamina (control: worth 0)', apply: enchant('feet', E.feetSta) },
  twoHand
    ? { label: 'two-hand Crusader -> +25 Agility', apply: enchant('twoHand', E.agi25) }
    : { label: 'off hand Crusader -> +15 Agility', apply: enchant('offHand', E.agi15) },
];

const tankEnchants: Variant[] = [
  control('tank enchants'),
  { label: 'head +1% Dodge -> +1% Haste', apply: enchant('head', E.haste) },
  { label: 'legs +1% Dodge -> +1% Haste', apply: enchant('legs', E.haste) },
  { label: 'gloves +2% Threat -> +1% Haste', apply: enchant('gloves', E.haste) },
  { label: 'gloves +2% Threat -> +15 Strength', apply: enchant('gloves', E.gloveStr) },
  { label: 'head +1% Dodge -> +8 Strength', apply: enchant('head', E.str8) },
  { label: 'legs +1% Dodge -> +8 Strength', apply: enchant('legs', E.str8) },
  { label: 'neck +5 Def -> +5 Strength', apply: enchant('neck', E.neckStr) },
  { label: 'wrists +4 Def -> +9 Strength', apply: enchant('wrists', E.wristStr) },
  { label: 'cloak +1% Dodge -> +5 Agility', apply: enchant('cloak', E.cloakAgi) },
  { label: 'main hand Crusader -> +15 Agility', apply: enchant('mainHand', E.agi15) },
];
function TANK_STR_AGI_FN(): Apply {
  return chain(enchant('head', 900005), enchant('legs', 900005), enchant('wrists', 900017), enchant('neck', 900008), enchant('cloak', 900011));
}
const TANK_STR = chain(enchant('head', E.str8), enchant('legs', E.str8), enchant('wrists', E.wristStr), enchant('neck', E.neckStr));
const TANK_STR_AGI = chain(TANK_STR, enchant('cloak', E.cloakAgi));
const tankEnchantsStr: Variant[] = [
  control('tank enchants'),
  { label: 'head+legs Str', apply: chain(enchant('head', E.str8), enchant('legs', E.str8)) },
  { label: 'head+legs+wrists+neck Str', apply: TANK_STR },
  { label: 'head+legs+wrists+neck Str, cloak Agi', apply: TANK_STR_AGI },
  { label: 'Str x4, cloak Agi, feet Sta? no: feet Agi kept; chest +4 stats kept -- head haste, legs Str', apply: chain(enchant('head', E.haste), enchant('legs', E.str8), enchant('wrists', E.wristStr), enchant('neck', E.neckStr), enchant('cloak', E.cloakAgi)) },
  { label: 'undead + Str x4 + cloak Agi', apply: chain(race('undead'), TANK_STR_AGI) },
  { label: 'orc + Str x4 + cloak Agi', apply: chain(race('orc'), TANK_STR_AGI) },
];
const tankCandidates: Variant[] = [
  control('tank build'),
  { label: 'race undead', apply: race('undead') },
  { label: 'race orc', apply: race('orc') },
  { label: 'Str x4 (head, legs, wrists, neck)', apply: TANK_STR },
  { label: 'undead + Str x4', apply: chain(race('undead'), TANK_STR) },
  { label: 'orc + Str x4', apply: chain(race('orc'), TANK_STR) },
  { label: 'undead + Str x4 + cloak Agi', apply: chain(race('undead'), TANK_STR_AGI) },
];
const tankEnchantsCombo: Variant[] = [
  control('tank enchants'),
  { label: 'head+legs haste', apply: chain(enchant('head', E.haste), enchant('legs', E.haste)) },
  { label: 'head+legs haste, wrists+neck Str', apply: chain(enchant('head', E.haste), enchant('legs', E.haste), enchant('wrists', E.wristStr), enchant('neck', E.neckStr)) },
  { label: 'all offence: head/legs haste, wrists/neck Str, cloak Agi', apply: chain(enchant('head', E.haste), enchant('legs', E.haste), enchant('wrists', E.wristStr), enchant('neck', E.neckStr), enchant('cloak', E.cloakAgi)) },
  { label: 'all offence + gloves haste', apply: chain(enchant('head', E.haste), enchant('legs', E.haste), enchant('wrists', E.wristStr), enchant('neck', E.neckStr), enchant('cloak', E.cloakAgi), enchant('gloves', E.haste)) },
];

/* ============================================================== CONSUMABLES (weighted) */

const dpsConsumables: Variant[] = [
  control('consumables'),
  { label: 'Secondary Potion: Major Frenzy', apply: consumable('potion_secondary', 'secondary_major_frenzy_potion') },
  { label: 'Primary Frenzy, Secondary Mighty Rage', apply: chain(consumable('potion', 'major_frenzy_potion'), consumable('potion_secondary', 'secondary_mighty_rage_potion')) },
  { label: 'blasted Strength -> Agility', apply: consumable('blasted_lands', 'blasted_agility') },
  { label: 'food Strength -> Attack Power (owner ruled Strength)', apply: consumable('food', 'food_attack_power') },
  { label: 'main stone: melee crit -> dense sharpening', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
];

const tankConsumables: Variant[] = [
  control('tank consumables'),
  { label: 'Secondary Potion: Major Healing', apply: consumable('potion_secondary', 'secondary_major_healing_potion') },
  { label: 'Secondary Potion: Major Frenzy', apply: consumable('potion_secondary', 'secondary_major_frenzy_potion') },
  { label: 'hit_points elixir dropped', apply: dropConsumable('hit_points') },
  { label: 'flask Hit Points dropped', apply: dropConsumable('flask') },
  { label: 'armor elixir dropped', apply: dropConsumable('armor') },
  { label: 'flask + elixir + armor dropped (all defensive)', apply: chain(dropConsumable('flask'), dropConsumable('hit_points'), dropConsumable('armor')) },
  { label: 'OWNER: food Agility -> Strength', apply: consumable('food', 'food_strength') },
  { label: 'OWNER: blasted Agility -> Strength', apply: consumable('blasted_lands', 'blasted_strength') },
  { label: 'main stone: melee crit -> dense sharpening', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
];

/* ============================================================== 2H ARMS, SINGLE TARGET (1T / 120 s) */

const armsSt: Variant[] = [
  control('2H Arms list'),
  { label: 'Execute (exec phase) at the top', apply: addTop({ abilityId: 'execute', condition: EXECUTE_PHASE }) },
  { label: 'Execute (exec phase) above Overpower', apply: addAbove({ abilityId: 'execute', condition: EXECUTE_PHASE }, 'overpower') },
  { label: 'Execute (exec phase) above Slam', apply: addAbove({ abilityId: 'execute', condition: EXECUTE_PHASE }, 'slam') },
  { label: 'Execute (exec phase) above Mortal Strike', apply: addAbove({ abilityId: 'execute', condition: EXECUTE_PHASE }, 'mortal_strike') },
  { label: 'Whirlwind (dance) above Slam', apply: addAbove({ abilityId: 'whirlwind' }, 'slam') },
  { label: 'Whirlwind (dance) above Spearing Strike', apply: addAbove({ abilityId: 'whirlwind' }, 'spearing_strike') },
  { label: 'Whirlwind (dance) above Hamstring', apply: addAbove({ abilityId: 'whirlwind' }, 'hamstring') },
  { label: 'Hamstring at 10 rage (shipped 20)', apply: regate('hamstring', resource('atLeast', 10, 'rage')) },
  { label: 'Hamstring at 30 rage', apply: regate('hamstring', resource('atLeast', 30, 'rage')) },
  { label: 'Hamstring at 45 rage', apply: regate('hamstring', resource('atLeast', 45, 'rage')) },
  { label: 'Hamstring at 60 rage', apply: regate('hamstring', resource('atLeast', 60, 'rage')) },
  { label: 'Hamstring not in execute phase', apply: regate('hamstring', all(resource('atLeast', 20, 'rage'), not(EXECUTE_PHASE))) },
  { label: 'Hamstring removed', apply: removeEntry('hamstring') },
  { label: 'Thunder Clap at 50 rage above Hamstring', apply: addAbove({ abilityId: 'thunder_clap', condition: resource('atLeast', 50, 'rage') }, 'hamstring') },
  { label: 'Cleave at 90 above Heroic Strike (1 target: control-ish)', apply: addAbove({ abilityId: 'cleave', condition: resource('atLeast', 95, 'rage') }, 'heroic_strike') },
  { label: 'OWNER EYE: Recklessness on (last)', apply: enable('recklessness_cast') },
  { label: 'Recklessness on, at the top', apply: chain(removeEntry('recklessness_cast'), addTop({ abilityId: 'recklessness_cast' })) },
  { label: 'Recklessness on, top, last 20s', apply: chain(removeEntry('recklessness_cast'), addTop({ abilityId: 'recklessness_cast', condition: fightRemaining('atMost', 20) })) },
];
const armsStOwner: Variant[] = [
  control('2H Arms list'),
  { label: 'OWNER: HS at 60', apply: regate('heroic_strike', resource('atLeast', 60, 'rage')) },
  { label: 'OWNER: HS at 70', apply: regate('heroic_strike', resource('atLeast', 70, 'rage')) },
  { label: 'OWNER: HS at 80', apply: regate('heroic_strike', resource('atLeast', 80, 'rage')) },
  { label: 'OWNER: HS at 100', apply: regate('heroic_strike', resource('atLeast', 100, 'rage')) },
  { label: 'OWNER: HS at 90, not in execute', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 90, 'rage'))) },
  { label: 'OWNER: Execute above Overpower (moved)', apply: moveAbove('execute', 'overpower') },
  { label: 'OWNER: Execute above Slam (moved)', apply: moveAbove('execute', 'slam') },
  { label: 'OWNER: MS above Slam', apply: moveAbove('mortal_strike', 'slam') },
  { label: 'OWNER: Rend removed', apply: removeEntry('rend_cast') },
  { label: 'OWNER: Spearing Strike removed', apply: removeEntry('spearing_strike') },
  { label: 'OWNER: Slam removed', apply: removeEntry('slam') },
];

/* ============================================================== DW FURY, SINGLE TARGET */

const furySt: Variant[] = [
  control('DW Fury list'),
  { label: 'Mighty Rage at <=35s left (Death Wish)', apply: regate('mighty_rage_potion', fightRemaining('atMost', 35)) },
  { label: 'Mighty Rage at <=25s left', apply: regate('mighty_rage_potion', fightRemaining('atMost', 25)) },
  { label: 'Mighty Rage at <=20s left (execute)', apply: regate('mighty_rage_potion', fightRemaining('atMost', 20)) },
  { label: 'Mighty Rage at <=25s left and rage <=40', apply: regate('mighty_rage_potion', all(fightRemaining('atMost', 25), resource('atMost', 40, 'rage'))) },
  { label: 'Mighty Rage ungated (pull)', apply: regate('mighty_rage_potion', undefined) },
  { label: 'Mighty Rage in the opener at 0s', apply: addPrecombat(0, 'mighty_rage_potion') },
  { label: 'Death Wish in the opener at 0s', apply: addPrecombat(0, 'death_wish') },
  { label: 'Berserker Rage at <=40 rage (was ungated)', apply: regate('berserker_rage_cast', resource('atMost', 40, 'rage')) },
  { label: 'Berserker Rage at <=20 rage', apply: regate('berserker_rage_cast', resource('atMost', 20, 'rage')) },
  { label: 'Berserker Rage at the top', apply: chain(removeEntry('berserker_rage_cast'), addTop({ abilityId: 'berserker_rage_cast' })) },
  { label: 'Hamstring at 60 rage at the bottom', apply: addEntry({ abilityId: 'hamstring', condition: resource('atLeast', 60, 'rage') }) },
  { label: 'Hamstring at 80 rage at the bottom', apply: addEntry({ abilityId: 'hamstring', condition: resource('atLeast', 80, 'rage') }) },
  { label: 'Overpower (dance) at the bottom', apply: addEntry({ abilityId: 'overpower' }) },
  { label: 'Overpower (dance) above Whirlwind', apply: addAbove({ abilityId: 'overpower' }, 'whirlwind') },
  { label: 'Slam at the bottom at 60 rage', apply: addEntry({ abilityId: 'slam', condition: resource('atLeast', 60, 'rage') }) },
  { label: 'Execute at the top (exec phase)', apply: addTop({ abilityId: 'execute', condition: EXECUTE_PHASE }) },
  { label: 'OWNER EYE: Recklessness on', apply: enable('recklessness_cast') },
  { label: 'Recklessness on, last 20s', apply: chain(enable('recklessness_cast'), regate('recklessness_cast', fightRemaining('atMost', 20))) },
];
const furyStOwner: Variant[] = [
  control('DW Fury list'),
  { label: 'OWNER: HS at 30', apply: regate('heroic_strike', resource('atLeast', 30, 'rage')) },
  { label: 'OWNER: HS at 36', apply: regate('heroic_strike', resource('atLeast', 36, 'rage')) },
  { label: 'OWNER: HS at 50', apply: regate('heroic_strike', resource('atLeast', 50, 'rage')) },
  { label: 'OWNER: HS at 60', apply: regate('heroic_strike', resource('atLeast', 60, 'rage')) },
  { label: 'OWNER: HS at 42, not in execute', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 42, 'rage'))) },
  { label: 'OWNER: Death Wish ungated', apply: regate('death_wish', undefined) },
  { label: 'OWNER: Death Wish at <=30s', apply: regate('death_wish', fightRemaining('atMost', 30)) },
  { label: 'OWNER: Death Wish at <=60s', apply: regate('death_wish', fightRemaining('atMost', 60)) },
  { label: 'OWNER: Whirlwind above Bloodthirst', apply: moveAbove('whirlwind', 'bloodthirst') },
  { label: 'OWNER: Bloodthirst above Heroic Strike', apply: moveAbove('bloodthirst', 'heroic_strike') },
];

/* ============================================================== TANKS, SINGLE TARGET */

const SUNDER = (c?: AplCondition): AplEntry => ({ abilityId: 'sunder_armor_cast', condition: outsideExecute(c) });
const tankSt = (fury: boolean): Variant[] => [
  control(fury ? 'Fury Prot list' : 'Prot Warr list'),
  { label: 'Sunder (threat filler) above Thunder Clap', apply: addAbove(SUNDER(), 'thunder_clap') },
  { label: 'Sunder (threat filler) above Rend', apply: addAbove(SUNDER(), 'rend_cast') },
  { label: 'Sunder (threat filler) at the bottom', apply: addEntry(SUNDER()) },
  { label: `Sunder above ${fury ? 'Bloodthirst' : 'Shield Slam'}`, apply: addAbove(SUNDER(), fury ? 'bloodthirst' : 'shield_slam') },
  { label: 'Sunder above Revenge', apply: addAbove(SUNDER(), 'revenge') },
  { label: 'Sunder at >=40 rage above Revenge', apply: addAbove(SUNDER(resource('atLeast', 40, 'rage')), 'revenge') },
  { label: 'Hamstring at 50 rage at the bottom', apply: addEntry({ abilityId: 'hamstring', condition: resource('atLeast', 50, 'rage') }) },
  { label: 'Execute phase: Revenge above Execute', apply: addAbove({ abilityId: 'revenge', condition: EXECUTE_PHASE }, 'execute') },
  { label: 'Execute phase: HS at 60 above Execute', apply: addAbove({ abilityId: 'heroic_strike', condition: all(EXECUTE_PHASE, resource('atLeast', 60, 'rage')) }, 'execute') },
  ...(fury
    ? [
        { label: 'HS at 40 (shipped 65)', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 40, 'rage'))) },
        { label: 'HS at 50', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 50, 'rage'))) },
        { label: 'HS at 80', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 80, 'rage'))) },
        { label: 'Death Wish removed (pre-cast only)', apply: removeEntry('death_wish') },
        { label: 'Bloodthirst above Revenge', apply: moveAbove('bloodthirst', 'revenge') },
      ]
    : []),
];
const tankStOwner = (fury: boolean): Variant[] => [
  control(fury ? 'Fury Prot list' : 'Prot Warr list'),
  ...(fury
    ? []
    : [
        { label: 'OWNER: HS at 15', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 15, 'rage'))) },
        { label: 'OWNER: HS at 40', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 40, 'rage'))) },
        { label: 'OWNER: HS at 60', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 60, 'rage'))) },
      ]),
  { label: 'OWNER: Bloodrage at <30', apply: regate('bloodrage_cast', resource('below', 30, 'rage')) },
  { label: 'OWNER: Bloodrage at <70', apply: regate('bloodrage_cast', resource('below', 70, 'rage')) },
  { label: 'OWNER: Bloodrage ungated', apply: regate('bloodrage_cast', undefined) },
  { label: 'OWNER: Demoralizing Shout removed', apply: removeEntry('demoralizing_shout_cast') },
  { label: 'OWNER: Thunder Clap removed', apply: removeEntry('thunder_clap') },
  { label: 'OWNER: Shield Block removed', apply: removeEntry('shield_block_cast') },
  { label: 'OWNER: Rend removed', apply: removeEntry('rend_cast') },
];

/* Execute phase, tanks: copies of the rotation's own entries above Execute, gated on the phase. */
const inExec = (abilityId: string, c?: AplCondition): AplEntry => ({ abilityId, condition: c ? all(EXECUTE_PHASE, c) : EXECUTE_PHASE });
const execAbove = (...entries: AplEntry[]): Apply => apl((list) => {
  const at = entryAt(list, 'execute');
  list.splice(at, 0, ...entries);
  return list;
});
const tankExec = (fury: boolean): Variant[] => {
  const slam = fury ? 'bloodthirst' : 'shield_slam';
  const hs = fury ? 65 : 26;
  return [
    control(fury ? 'Fury Prot list' : 'Prot Warr list'),
    { label: 'exec: Revenge above Execute', apply: execAbove(inExec('revenge')) },
    { label: `exec: Revenge, ${slam} above Execute`, apply: execAbove(inExec('revenge'), inExec(slam)) },
    { label: `exec: Revenge, Shield Block, ${slam}`, apply: execAbove(inExec('shield_block_cast'), inExec('revenge'), inExec(slam)) },
    { label: `exec: HS ${hs}, Revenge, ${slam}`, apply: execAbove(inExec('heroic_strike', resource('atLeast', hs, 'rage')), inExec('revenge'), inExec(slam)) },
    { label: `exec: HS ${hs}, Block, Revenge, ${slam}, TC`, apply: execAbove(inExec('heroic_strike', resource('atLeast', hs, 'rage')), inExec('shield_block_cast'), inExec('revenge'), inExec(slam), inExec('thunder_clap')) },
    { label: `exec: Block, Revenge, ${slam}, Execute only at >=30 rage`, apply: chain(execAbove(inExec('shield_block_cast'), inExec('revenge'), inExec(slam)), regate('execute', all(EXECUTE_PHASE, resource('atLeast', 30, 'rage')))) },
    { label: `exec: Block, Revenge, ${slam}; Execute removed (whole list runs to the end)`, apply: chain(execAbove(inExec('shield_block_cast'), inExec('revenge'), inExec(slam)), removeEntry('execute')) },
    { label: `exec: Block, Revenge, ${slam}, HS ${hs}, Sunder; Execute below at the bottom`, apply: chain(execAbove(inExec('shield_block_cast'), inExec('revenge'), inExec(slam), inExec('heroic_strike', resource('atLeast', hs, 'rage'))), moveToBottomFirst('execute')) },
  ];
};
const moveToBottomFirst = (id: string): Apply => apl((list) => {
  const at = entryAt(list, id);
  const [e] = list.splice(at, 1);
  list.push(e);
  return list;
});

/* ============================================================== MULTI TARGET (5T / 60 s) */

const cleaveAt = (rage: number, tank = false): Apply =>
  apl((entries) => {
    const at = entryAt(entries, 'cleave');
    const c = resource('atLeast', rage, 'rage');
    entries[at] = { ...entries[at], condition: tank ? outsideExecute(c) : c };
    return entries;
  });

const armsAoe: Variant[] = [
  control('2H Arms Multi'),
  { label: 'Cleave at 40 (shipped 60)', apply: inMulti(cleaveAt(40)) },
  { label: 'Cleave at 50', apply: inMulti(cleaveAt(50)) },
  { label: 'Cleave at 70', apply: inMulti(cleaveAt(70)) },
  { label: 'Cleave at 80', apply: inMulti(cleaveAt(80)) },
  { label: 'Sweeping at 15 (shipped 30)', apply: inMulti(regate('sweeping_strikes', resource('atLeast', 15, 'rage'))) },
  { label: 'Sweeping at 50', apply: inMulti(regate('sweeping_strikes', resource('atLeast', 50, 'rage'))) },
  { label: 'Whirlwind at the top', apply: inMulti(moveAbove('whirlwind', 'sweeping_strikes')) },
  { label: 'Whirlwind above Overpower', apply: inMulti(moveAbove('whirlwind', 'overpower')) },
  { label: 'Sweeping above Whirlwind? (Sweeping above Cleave kept) WW above Sunder', apply: inMulti(moveAbove('whirlwind', 'sunder_armor_cast')) },
  { label: '- Rend', apply: inMulti(removeEntry('rend_cast')) },
  { label: '- Overpower', apply: inMulti(removeEntry('overpower')) },
  { label: '- Spearing Strike', apply: inMulti(removeEntry('spearing_strike')) },
  { label: '- Slam', apply: inMulti(removeEntry('slam')) },
  { label: '- Hamstring', apply: inMulti(removeEntry('hamstring')) },
  { label: 'Execute (exec) at the top', apply: inMulti(addTop({ abilityId: 'execute', condition: EXECUTE_PHASE })) },
  { label: 'Thunder Clap above Slam', apply: inMulti(addAbove({ abilityId: 'thunder_clap' }, 'slam')) },
  { label: 'Thunder Clap above Hamstring, 8+ targets', apply: inMulti(addAbove({ abilityId: 'thunder_clap', condition: targetCount('atLeast', 8) }, 'hamstring')) },
  { label: 'Demoralizing Shout? no -- Sweeping Strikes in opener 0s', apply: inMulti(addPrecombat(0, 'sweeping_strikes')) },
  { label: 'Recklessness on (owner eye)', apply: inMulti(enable('recklessness_cast')) },
];

const furyAoe: Variant[] = [
  control('DW Fury Multi'),
  { label: 'Cleave at 20 (shipped 42)', apply: inMulti(cleaveAt(20)) },
  { label: 'Cleave at 30', apply: inMulti(cleaveAt(30)) },
  { label: 'Cleave at 55', apply: inMulti(cleaveAt(55)) },
  { label: 'Cleave at 70', apply: inMulti(cleaveAt(70)) },
  { label: 'Whirlwind at the top', apply: inMulti(moveAbove('whirlwind', 'bloodrage_cast')) },
  { label: 'Whirlwind above Sunder', apply: inMulti(moveAbove('whirlwind', 'sunder_armor_cast')) },
  { label: 'Bloodthirst above Cleave', apply: inMulti(moveAbove('bloodthirst', 'cleave')) },
  { label: 'Bloodthirst below Whirlwind? WW above Execute kept; BT to bottom', apply: inMulti(moveAbove('bloodthirst', 'berserker_rage_cast')) },
  { label: 'Death Wish ungated', apply: inMulti(regate('death_wish', undefined)) },
  { label: 'Mighty Rage ungated', apply: inMulti(regate('mighty_rage_potion', undefined)) },
  { label: 'Mighty Rage at <=25s left', apply: inMulti(regate('mighty_rage_potion', fightRemaining('atMost', 25))) },
  { label: 'Death Wish + Mighty Rage in opener 0s', apply: inMulti(addPrecombat(0, 'death_wish', 'mighty_rage_potion')) },
  { label: 'Berserker Rage at <=40 rage', apply: inMulti(regate('berserker_rage_cast', resource('atMost', 40, 'rage'))) },
  { label: 'Thunder Clap (dance) above Bloodthirst, 8+ targets', apply: inMulti(addAbove({ abilityId: 'thunder_clap', condition: targetCount('atLeast', 8) }, 'bloodthirst')) },
  { label: 'Hamstring at 60 at the bottom', apply: inMulti(addEntry({ abilityId: 'hamstring', condition: resource('atLeast', 60, 'rage') })) },
  { label: 'Execute removed', apply: inMulti(removeEntry('execute')) },
  { label: 'Recklessness on (owner eye)', apply: inMulti(enable('recklessness_cast')) },
];

/** Lift the tank execute clause: drop `not(execute phase)` from every gate, and Execute itself. */
const NOT_EXEC = JSON.stringify(not(EXECUTE_PHASE));
const liftCondition = (c: AplCondition | undefined): AplCondition | undefined => {
  if (!c) return c;
  if (JSON.stringify(c) === NOT_EXEC) return undefined;
  if (c.kind === 'all') {
    const of = c.of.filter((x) => JSON.stringify(x) !== NOT_EXEC);
    return of.length === 0 ? undefined : of.length === 1 ? of[0] : { ...c, of };
  }
  return c;
};
const liftExecute = (keepExecute: boolean): Apply =>
  apl((list) =>
    list
      .filter((e) => keepExecute || e.abilityId !== 'execute')
      .map((e) => {
        const condition = liftCondition(e.condition);
        const { condition: _c, ...rest } = e;
        void _c;
        return condition ? { ...rest, condition } : rest;
      }),
  );
const tankAoe = (fury: boolean): Variant[] => {
  const shipped = fury ? 40 : 26;
  return [
    control(`${fury ? 'Fury Prot' : 'Prot Warr'} Multi`),
    ...[10, 20, 30, 40, 50, 65].filter((r) => r !== shipped).map((r) => ({ label: `Cleave at ${r} (shipped ${shipped})`, apply: inMulti(cleaveAt(r, true)) })),
    { label: 'Thunder Clap back above Rend', apply: inMulti(addAbove({ abilityId: 'thunder_clap', condition: outsideExecute() }, 'rend_cast')) },
    { label: 'Thunder Clap back above Revenge', apply: inMulti(addAbove({ abilityId: 'thunder_clap', condition: outsideExecute() }, 'revenge')) },
    { label: 'Thunder Clap above Cleave, 8+ targets', apply: inMulti(addAbove({ abilityId: 'thunder_clap', condition: all(targetCount('atLeast', 8), not(EXECUTE_PHASE)) }, 'cleave')) },
    { label: 'Demoralizing Shout back above Cleave', apply: inMulti(addAbove({ abilityId: 'demoralizing_shout_cast', condition: outsideExecute() }, 'cleave')) },
    { label: 'Rend multi-DoT 5', apply: inMulti(apl((e) => { const at = entryAt(e, 'rend_cast'); e[at] = { ...e[at], multiDot: 5 }; return e; })) },
    { label: '- Rend', apply: inMulti(removeEntry('rend_cast')) },
    { label: 'Sunder filler at the bottom', apply: inMulti(addEntry(SUNDER())) },
    { label: 'Execute removed (keep Cleave in execute)', apply: inMulti(removeEntry('execute')) },
    { label: 'Cleave allowed in execute too', apply: inMulti(apl((e) => { const at = entryAt(e, 'cleave'); e[at] = { ...e[at], condition: resource('atLeast', shipped, 'rage') }; return e; })) },
    { label: 'Shield Block removed', apply: inMulti(removeEntry('shield_block_cast')) },
    { label: 'execute clause lifted, Execute removed', apply: inMulti(liftExecute(false)) },
    { label: 'execute clause lifted, Execute kept at the bottom', apply: inMulti(liftExecute(true), moveToBottomFirst('execute')) },
    { label: 'Bloodrage ungated', apply: inMulti(regate('bloodrage_cast', undefined)) },
  ];
};

const rendMd = (n: number): Apply => apl((e) => { const at = entryAt(e, 'rend_cast'); e[at] = { ...e[at], multiDot: n }; return e; });
const tankAoe2 = (fury: boolean): Variant[] => {
  const shipped = fury ? 40 : 26;
  const L = liftExecute(false);
  return [
    control(`${fury ? 'Fury Prot' : 'Prot Warr'} Multi`),
    { label: 'LIFT: execute clause lifted, Execute removed', apply: inMulti(L) },
    { label: 'LIFT + Rend MD5', apply: inMulti(L, rendMd(5)) },
    { label: 'LIFT + Rend MD3', apply: inMulti(L, rendMd(3)) },
    { label: 'LIFT + Rend MD8', apply: inMulti(L, rendMd(8)) },
    { label: 'LIFT + Rend MD8, Rend above Cleave', apply: inMulti(L, rendMd(8), moveAbove('rend_cast', 'cleave')) },
    { label: 'LIFT + Rend MD8, Rend above Revenge', apply: inMulti(L, rendMd(8), moveAbove('rend_cast', 'revenge')) },
    ...[15, 40].map((r) => ({ label: `LIFT + Rend MD8 + Cleave ${r} (shipped ${shipped})`, apply: inMulti(L, rendMd(8), cleaveAt(r)) })),
    { label: 'LIFT + Rend MD8 + Thunder Clap at the bottom', apply: inMulti(L, rendMd(8), addEntry({ abilityId: 'thunder_clap' })) },
    { label: 'LIFT + Rend MD8 + Execute at the bottom', apply: inMulti(liftExecute(true), moveToBottomFirst('execute'), rendMd(8)) },
  ];
};

const armsAoe2: Variant[] = [
  control('2H Arms Multi'),
  { label: 'Rend MD3', apply: inMulti(rendMd(3)) },
  { label: 'Rend MD5', apply: inMulti(rendMd(5)) },
  { label: 'Rend MD8', apply: inMulti(rendMd(8)) },
  { label: 'Execute removed', apply: inMulti(removeEntry('execute')) },
  { label: 'Whirlwind below Slam', apply: inMulti(moveAbove('whirlwind', 'mortal_strike'), moveAbove('slam', 'whirlwind')) },
  { label: 'Sweeping ungated', apply: inMulti(regate('sweeping_strikes', undefined)) },
  { label: 'Hamstring at 40', apply: inMulti(regate('hamstring', resource('atLeast', 40, 'rage'))) },
  { label: 'Cleave at 60 and 3+ targets else HS 90 (HS kept above)', apply: inMulti(addAbove({ abilityId: 'heroic_strike', condition: all(targetCount('below', 3), resource('atLeast', 90, 'rage')) }, 'cleave')) },
];
const furyAoe2: Variant[] = [
  control('DW Fury Multi'),
  { label: 'Rend? no Rend in Fury -- Whirlwind above Execute kept; Execute removed', apply: inMulti(removeEntry('execute')) },
  { label: 'Cleave at 42, not in execute; Execute kept', apply: inMulti(cleaveAt(42), regate('cleave', all(resource('atLeast', 42, 'rage'), not(EXECUTE_PHASE)))) },
  { label: 'Sweeping? n/a -- Whirlwind at the top + Cleave 30', apply: inMulti(moveAbove('whirlwind', 'bloodrage_cast'), cleaveAt(30)) },
  { label: 'Berserker Rage at the top', apply: inMulti(moveAbove('berserker_rage_cast', 'bloodrage_cast')) },
];

const FURY_OPEN = addPrecombat(0, 'death_wish', 'mighty_rage_potion');
const furyAoe3: Variant[] = [
  control('DW Fury Multi'),
  { label: 'DW + MR opener', apply: inMulti(FURY_OPEN) },
  { label: 'DW + MR opener + BR <=40', apply: inMulti(FURY_OPEN, regate('berserker_rage_cast', resource('atMost', 40, 'rage'))) },
  { label: 'DW + MR opener + BR <=40 + BT above Cleave', apply: inMulti(FURY_OPEN, regate('berserker_rage_cast', resource('atMost', 40, 'rage')), moveAbove('bloodthirst', 'cleave')) },
  { label: 'DW opener only', apply: inMulti(addPrecombat(0, 'death_wish')) },
  { label: 'MR opener only', apply: inMulti(addPrecombat(0, 'mighty_rage_potion')) },
  { label: 'BR <=20', apply: inMulti(regate('berserker_rage_cast', resource('atMost', 20, 'rage'))) },
  { label: 'BR <=60', apply: inMulti(regate('berserker_rage_cast', resource('atMost', 60, 'rage'))) },
  { label: 'DW + MR opener + BR <=40 + Cleave 30', apply: inMulti(FURY_OPEN, regate('berserker_rage_cast', resource('atMost', 40, 'rage')), cleaveAt(30)) },
];

const furyPot: Variant[] = [
  control('DW Fury list'),
  { label: 'Mighty Rage ungated (pull)', apply: regate('mighty_rage_potion', undefined) },
  { label: 'Mighty Rage at <=50 rage', apply: regate('mighty_rage_potion', resource('atMost', 50, 'rage')) },
  { label: 'Mighty Rage at <=10 rage', apply: regate('mighty_rage_potion', resource('atMost', 10, 'rage')) },
];

const secondary: Variant[] = [
  control('consumables'),
  { label: 'Secondary Potion: Major Healing', apply: consumable('potion_secondary', 'secondary_major_healing_potion') },
  { label: 'Secondary Potion: Major Frenzy', apply: consumable('potion_secondary', 'secondary_major_frenzy_potion') },
];

/* Silence helpers kept for later passes. */
void any;
void fightElapsed;
void swapAbility;

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  w80DpsRace: dpsRaces,
  w80TankRace: tankRaces,
  w80ArmsTalents: armsTalents,
  w80FuryTalents: furyTalents,
  w80ProtTalents: protTalents,
  w80FpTalents: fpTalents,
  w80ArmsEnchants: dpsEnchants(true),
  w80FuryEnchants: dpsEnchants(false),
  w80TankEnchants: tankEnchants,
  w80TankEnchantsCombo: tankEnchantsCombo,
  w80FpCandidates: fpCandidates,
  w80TankCandidates: tankCandidates,
  w80TankEnchantsStr: tankEnchantsStr,
  w80DpsConsumables: dpsConsumables,
  w80TankConsumables: tankConsumables,
  w80ArmsSt: armsSt,
  w80ArmsStOwner: armsStOwner,
  w80FurySt: furySt,
  w80FuryStOwner: furyStOwner,
  w80ProtSt: tankSt(false),
  w80ProtExec: tankExec(false),
  w80FpExec: tankExec(true),
  w80FpSt: tankSt(true),
  w80ProtStOwner: tankStOwner(false),
  w80FpStOwner: tankStOwner(true),
  w80ArmsAoe: armsAoe,
  w80ArmsAoe2: armsAoe2,
  w80FuryAoe2: furyAoe2,
  w80FuryAoe3: furyAoe3,
  w80FuryPot: furyPot,
  w80Secondary: secondary,
  w80FuryAoe: furyAoe,
  w80ProtAoe: tankAoe(false),
  w80FpAoe: tankAoe(true),
  w80ProtAoe2: tankAoe2(false),
  w80FpAoe2: tankAoe2(true),
};
