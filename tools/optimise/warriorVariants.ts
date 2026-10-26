/*
 * ============================================================================
 * ROUND 78: THE FOUR WARRIOR PRESETS, OPTIMISED FOR THE FULL REPORT.
 *
 *   PRESET=dw_fury FILE=tools/optimise/warriorVariants.ts VARIANTS=furySt DURATION=120 \
 *     npx vite-node tools/probe_build.ts
 *   PRESET=dw_fury FILE=tools/optimise/warriorVariants.ts VARIANTS=furyAoe TARGETS=5 DURATION=60 \
 *     npx vite-node tools/probe_build.ts
 *
 * THE THEME, WRITTEN DOWN BEFORE ANYTHING (Step 0). These may not move:
 *
 *   | preset        | tree      | style and weapons    | stance     | target swings back |
 *   | ------------- | --------- | -------------------- | ---------- | ------------------ |
 *   | two_hand_arms | 39/10/2   | two-hander (E65)     | Battle     | no  -> DPS         |
 *   | dw_fury       | 17/34/0   | dual-wield (E65)     | Berserker  | no  -> DPS         |
 *   | prot_warr     | 17/0/34   | one-hand and shield  | Defensive  | yes -> TPS         |
 *   | fury_prot     | 5/31/15   | one-hand and shield  | Defensive  | yes -> TPS         |
 *
 * Fury Prot DERIVES from Prot Warr's build: race, gear, enchants (its own row,
 * a copy), raid buffs, consumables and encounter -- and its STOCK LIST is the
 * Prot list mapped, so an edit to `WARRIOR_SHIELD_DEFENSIVE` reaches both.
 *
 * THE OBJECTIVES (round 78 brief): DPS at 1 target / 120s and 5 targets / 60s
 * (reused at 3/60 and 8/30) for the two damage builds; TPS at the same for the
 * two tanks, deaths as a secondary check.
 *
 * ALL FOUR SINGLE TARGET LISTS ARE THE OWNER'S, order and thresholds -- so an
 * edit there may ADD an entry or retune one this project added (Hamstring,
 * Berserker Rage, Recklessness, Fury Prot's Heroic Strike 65 and Death Wish),
 * and an owner line or number that measures as a loss is REPORTED, not moved.
 * The Multi Target lists are new this round and are this project's.
 *
 * BEFORE (full_report, ITER=300, seed 20261025):
 *
 *   2H Arms    DPS  t1 850.2 +/- 7.2   t3 873.1   t5 873.1   t8 901.7
 *   DW Fury    DPS  t1 991.9 +/- 7.5   t3 1221.5  t5 1306.4  t8 1486.1
 *   Prot Warr  TPS  t1 1149.8 +/- 9.4  t3 1410.5  t5 1660.9  t8 2040.8
 *   Fury Prot  TPS  t1 1224.4 +/- 11.3 t3 1665.0  t5 1995.1  t8 2645.8
 *
 * 2H Arms reads IDENTICALLY at 3 and 5 targets: its list holds nothing that
 * touches a second enemy, so the adds are free damage nobody collects.
 *
 * AFTER (same harness), what shipped:
 *
 *   2H Arms    DPS  t1 850.7 +/- 7.3   t3 1138.5  t5 1207.9  t8 1269.7
 *   DW Fury    DPS  t1 992.3 +/- 7.5   t3 1390.4  t5 1491.7  t8 1658.8
 *   Prot Warr  TPS  t1 1169.0 +/- 9.3  t3 1621.5  t5 1898.6  t8 2284.2
 *   Fury Prot  TPS  t1 1234.1 +/- 11.9 t3 1840.1  t5 2181.9  t8 2839.8
 *
 *   - Blood Fury at 0s on both damage openers (+0.60, +0.42 at 120s)
 *   - a Multi Target list for all four (src/profiles/multiTarget/warrior.ts)
 *   - Prot Warr: Improved Shield Wall 2 -> Cruelty 2 (+19.21 +/- 2.75 TPS)
 *   - Fury Prot: IBR 2 + Booming Voice 1 -> Unbridled Wrath 5/5 (+9.93 +/- 7.66)
 *   - both tanks: boots Minor Speed (inert) -> +7 Agility
 *
 * A PRIOR MEASUREMENT IS TRUE OF THE BUILD IT WAS TAKEN IN: every group's
 * figures below were taken against the PRE-ROUND presets, and the `*Combined`
 * groups are the knock-on check on what shipped.
 * ============================================================================
 */
import {
  type Apply,
  type Variant,
  WARRIOR_TREE as tree,
  apl,
  addAbove,
  addEntry,
  addPrecombat,
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
  fightRemaining,
  not,
  resource,
  selfHas,
  targetCount,
  targetTime,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import { TANK_EXECUTE_PHASE } from '../../src/game/rotations/warrior';
import { foreverEnchantId as ench } from '../../src/game/items/foreverEnchants';
import type { CharacterProfile } from '../../src/profiles';
import type { RaceId } from '../../src/game/character';

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

const entryAt = (entries: readonly AplEntry[], id: string) => {
  const at = entries.findIndex((e) => e.abilityId === id);
  if (at < 0) throw new Error('no entry for ' + id);
  return at;
};

/** Replace one entry's condition, refusing an id the list does not carry. */
const regate = (abilityId: string, condition: AplCondition | undefined): Apply =>
  apl((entries) => {
    const at = entryAt(entries, abilityId);
    const { condition: _drop, ...rest } = entries[at];
    void _drop;
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

/** Turn a `disabled` entry on. */
const enable = (abilityId: string): Apply =>
  apl((entries) => {
    const at = entryAt(entries, abilityId);
    const { disabled: _d, ...rest } = entries[at];
    void _d;
    entries[at] = rest;
    return entries;
  });

/** Swap one ability for another IN PLACE, keeping the condition unless one is given. */
const swapAbility = (from: string, to: string, condition?: AplCondition): Apply =>
  apl((entries) => {
    const at = entryAt(entries, from);
    entries[at] = { ...entries[at], abilityId: to, ...(condition ? { condition } : {}) };
    return entries;
  });

/** Put a copy of `id`'s entry, with a new ability, directly above it. */
const copyAbove = (id: string, to: string, condition?: AplCondition): Apply =>
  apl((entries) => {
    const at = entryAt(entries, id);
    entries.splice(at, 0, { ...entries[at], abilityId: to, ...(condition ? { condition } : {}) });
    return entries;
  });

const race =
  (r: RaceId): Apply =>
  (p: CharacterProfile) => ({ ...p, character: { ...p.character, race: r } });

const dropConsumable =
  (category: string): Apply =>
  (p) => {
    const { [category]: _gone, ...rest } = p.consumables as Record<string, string>;
    void _gone;
    return { ...p, consumables: rest };
  };

const outsideExecute = (c?: AplCondition): AplCondition =>
  c ? all(c, not(TANK_EXECUTE_PHASE)) : not(TANK_EXECUTE_PHASE);

/* ============================================================== 2H ARMS */

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
const without = (a: Record<string, number>, ...ids: string[]) => {
  const c = { ...a };
  for (const id of ids) delete c[id];
  return c;
};

/*
 * THE TREE IS FORCED (round 41 established it and nothing since has moved a
 * talent the build could reach): the only movable points are Improved
 * Bloodrage's two, and every destination they can reach is dead or near-dead.
 */
const armsTalents: Variant[] = [
  control('2H Arms tree (39/10/2)'),
  {
    label: 'Improved Bloodrage 2 -> Booming Voice 2 (shout cost)',
    apply: tree({ ...without(ARMS, 'improved_bloodrage'), booming_voice: 2 }),
  },
  {
    label: 'Improved Charge 2 -> Deflection 2 (both dead)',
    apply: tree({ ...without(ARMS, 'improved_charge'), deflection: 2 }),
  },
];

const armsOpener: Variant[] = [
  control('2H Arms opener'),
  { label: 'add Blood Fury at 0s', apply: addPrecombat(0, 'blood_fury') },
  { label: 'add Bloodrage again? -- move Bloodrage to 0s', apply: chain(removePrecombat('bloodrage_cast'), addPrecombat(0, 'bloodrage_cast')) },
];

const armsSt: Variant[] = [
  control('2H Arms list'),
  { label: 'OWNER NUMBER: Heroic Strike at 70 rage (owner 90)', apply: regate('heroic_strike', resource('atLeast', 70, 'rage')) },
  { label: 'OWNER NUMBER: Heroic Strike at 80 rage', apply: regate('heroic_strike', resource('atLeast', 80, 'rage')) },
  { label: 'OWNER NUMBER: Heroic Strike at 100 rage', apply: regate('heroic_strike', resource('atLeast', 100, 'rage')) },
  { label: 'Hamstring at 30 rage (shipped 20)', apply: regate('hamstring', resource('atLeast', 30, 'rage')) },
  { label: 'Hamstring at 40 rage', apply: regate('hamstring', resource('atLeast', 40, 'rage')) },
  { label: 'add Thunder Clap at the bottom, at 30 rage', apply: addAbove({ abilityId: 'thunder_clap', condition: resource('atLeast', 30, 'rage') }, 'recklessness_cast') },
  { label: 'OWNER EYE: Recklessness switched on (last)', apply: enable('recklessness_cast') },
  { label: 'OWNER LINE: Spearing Strike removed', apply: removeEntry('spearing_strike') },
];

/* The Multi Target section: every variant edits it (inMulti) from the ST list. */
const cleaveFor = (rage: number) => swapAbility('heroic_strike', 'cleave', resource('atLeast', rage, 'rage'));
const sweepingTop = (rage = 30) =>
  addAbove({ abilityId: 'sweeping_strikes', condition: resource('atLeast', rage, 'rage') }, 'heroic_strike');

const armsAoe: Variant[] = [
  control('2H Arms Multi Target (none: the ST list)'),
  { label: 'Cleave for Heroic Strike, at 90', apply: inMulti(cleaveFor(90)) },
  { label: 'Cleave for Heroic Strike, at 60', apply: inMulti(cleaveFor(60)) },
  { label: 'Cleave for Heroic Strike, at 40', apply: inMulti(cleaveFor(40)) },
  { label: 'Sweeping Strikes above Heroic Strike', apply: inMulti(sweepingTop()) },
  { label: 'Sweeping Strikes + Cleave at 60', apply: inMulti(sweepingTop(), cleaveFor(60)) },
  {
    label: 'Sweeping Strikes + Cleave 60 + Thunder Clap above Overpower',
    apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'thunder_clap' }, 'overpower')),
  },
  {
    label: 'Sweeping + Cleave 60 + Thunder Clap above Slam',
    apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'thunder_clap' }, 'slam')),
  },
  {
    label: 'Sweeping + Cleave 60 + Whirlwind (dance) above Overpower',
    apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'overpower')),
  },
  {
    label: 'Sweeping + Cleave 60 + Whirlwind (dance) above Mortal Strike',
    apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')),
  },
];

/*
 * PASS 2, built on pass 1's winner: Sweeping Strikes above Heroic Strike,
 * Cleave for Heroic Strike at 60, and Whirlwind -- a Berserker ability the list
 * DANCES for -- above Mortal Strike (+337.5 at 5 targets, 60s).
 */
const ARMS_AOE1 = [sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')] as const;
const armsAoe2: Variant[] = [
  control('2H Arms Multi Target (none: the ST list)'),
  { label: 'AOE1: Sweeping + Cleave 60 + WW above MS', apply: inMulti(...ARMS_AOE1) },
  { label: 'AOE1, Whirlwind above Sweeping (top of the spenders)', apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'sweeping_strikes')) },
  { label: 'AOE1, Whirlwind above Slam', apply: inMulti(sweepingTop(), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'slam')) },
  { label: 'AOE1 - Overpower', apply: inMulti(...ARMS_AOE1, removeEntry('overpower')) },
  { label: 'AOE1 - Rend', apply: inMulti(...ARMS_AOE1, removeEntry('rend_cast')) },
  { label: 'AOE1 - Overpower - Rend', apply: inMulti(...ARMS_AOE1, removeEntry('overpower'), removeEntry('rend_cast')) },
  { label: 'AOE1 - Sweeping', apply: inMulti(cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')) },
  { label: 'AOE1, Cleave at 40', apply: inMulti(sweepingTop(), cleaveFor(40), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')) },
  { label: 'AOE1, Cleave at 80', apply: inMulti(sweepingTop(), cleaveFor(80), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')) },
  { label: 'AOE1, Sweeping at 50 rage', apply: inMulti(sweepingTop(50), cleaveFor(60), addAbove({ abilityId: 'whirlwind' }, 'mortal_strike')) },
  { label: 'AOE1 + Thunder Clap above Slam', apply: inMulti(...ARMS_AOE1, addAbove({ abilityId: 'thunder_clap' }, 'slam')) },
  { label: 'AOE1 - Hamstring', apply: inMulti(...ARMS_AOE1, removeEntry('hamstring')) },
  { label: 'AOE1 + Recklessness on (owner eye)', apply: inMulti(...ARMS_AOE1, enable('recklessness_cast')) },
];

/* ============================================================== DW FURY */

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
  {
    label: 'Enrage 2 -> Booming Voice 2 (both dead: the target never swings)',
    apply: tree({ ...without(FURY, 'enrage'), booming_voice: 2 }),
  },
  {
    label: 'Improved Berserker Rage 2 -> Enrage 4 (the pre-round-41 spread)',
    apply: tree({ ...without(FURY, 'improved_berserker_rage'), enrage: 4 }),
  },
];

const furyOpener: Variant[] = [
  control('DW Fury opener'),
  { label: 'add Death Wish at 0s', apply: addPrecombat(0, 'death_wish') },
  { label: 'add Blood Fury at 0s', apply: addPrecombat(0, 'blood_fury') },
  { label: 'add Mighty Rage Potion at 0s', apply: addPrecombat(0, 'mighty_rage_potion') },
];

const furySt: Variant[] = [
  control('DW Fury list'),
  { label: 'OWNER LINE: Death Wish ungated', apply: regate('death_wish', undefined) },
  { label: 'OWNER LINE: Death Wish at 65s left', apply: regate('death_wish', fightRemaining('atMost', 65)) },
  { label: 'OWNER NUMBER: Heroic Strike at 36 (owner 42)', apply: regate('heroic_strike', resource('atLeast', 36, 'rage')) },
  { label: 'OWNER NUMBER: Heroic Strike at 50', apply: regate('heroic_strike', resource('atLeast', 50, 'rage')) },
  { label: 'OWNER LINE: Whirlwind above Bloodthirst', apply: moveAbove('whirlwind', 'bloodthirst') },
  { label: 'OWNER EYE: Recklessness switched on', apply: enable('recklessness_cast') },
  { label: 'Berserker Rage at 60 rage or less', apply: regate('berserker_rage_cast', resource('atMost', 60, 'rage')) },
];

const furyCleave = (rage: number) => swapAbility('heroic_strike', 'cleave', resource('atLeast', rage, 'rage'));
const furyAoe: Variant[] = [
  control('DW Fury Multi Target (none: the ST list)'),
  { label: 'Whirlwind above Bloodthirst', apply: inMulti(moveAbove('whirlwind', 'bloodthirst')) },
  { label: 'Whirlwind above Execute', apply: inMulti(moveAbove('whirlwind', 'execute')) },
  { label: 'Cleave for Heroic Strike, at 42', apply: inMulti(furyCleave(42)) },
  { label: 'Cleave for Heroic Strike, at 30', apply: inMulti(furyCleave(30)) },
  { label: 'Cleave for Heroic Strike, at 55', apply: inMulti(furyCleave(55)) },
  { label: 'WW above BT + Cleave 42', apply: inMulti(moveAbove('whirlwind', 'bloodthirst'), furyCleave(42)) },
  { label: 'WW above Execute + Cleave 42', apply: inMulti(moveAbove('whirlwind', 'execute'), furyCleave(42)) },
  {
    label: 'WW above BT + Cleave 42 + Death Wish ungated',
    apply: inMulti(moveAbove('whirlwind', 'bloodthirst'), furyCleave(42), regate('death_wish', undefined)),
  },
];

/* PASS 2 on pass 1's winner: Whirlwind above Execute, Cleave for Heroic Strike at 42 (+187.0). */
const FURY_AOE1 = [moveAbove('whirlwind', 'execute'), furyCleave(42)] as const;
const furyAoe2: Variant[] = [
  control('DW Fury Multi Target (none: the ST list)'),
  { label: 'AOE1: WW above Execute + Cleave 42', apply: inMulti(...FURY_AOE1) },
  { label: 'AOE1, WW above Sunder', apply: inMulti(moveAbove('whirlwind', 'sunder_armor_cast'), furyCleave(42)) },
  { label: 'AOE1, WW above Death Wish (top)', apply: inMulti(moveAbove('whirlwind', 'death_wish'), furyCleave(42)) },
  { label: 'AOE1, Cleave at 36', apply: inMulti(moveAbove('whirlwind', 'execute'), furyCleave(36)) },
  { label: 'AOE1, Cleave at 50', apply: inMulti(moveAbove('whirlwind', 'execute'), furyCleave(50)) },
  { label: 'AOE1, Cleave at 65', apply: inMulti(moveAbove('whirlwind', 'execute'), furyCleave(65)) },
  { label: 'AOE1, Bloodthirst above Cleave', apply: inMulti(...FURY_AOE1, moveAbove('bloodthirst', 'cleave')) },
  { label: 'AOE1, Death Wish ungated', apply: inMulti(...FURY_AOE1, regate('death_wish', undefined)) },
  { label: 'AOE1 + Thunder Clap (dance) above Bloodthirst', apply: inMulti(...FURY_AOE1, addAbove({ abilityId: 'thunder_clap' }, 'bloodthirst')) },
  { label: 'AOE1 + Recklessness on (owner eye)', apply: inMulti(...FURY_AOE1, enable('recklessness_cast')) },
  { label: 'AOE1 - Berserker Rage', apply: inMulti(...FURY_AOE1, removeEntry('berserker_rage_cast')) },
];

/* ============================================================== PROT WARR */

const PROT: Record<string, number> = {
  improved_heroic_strike: 3,
  deflection: 5,
  improved_rend: 3,
  improved_charge: 1,
  deep_wounds: 3,
  impale: 2,
  shield_specialization: 5,
  anticipation: 5,
  improved_revenge: 3,
  improved_thunder_clap: 2,
  last_stand: 1,
  master_of_defense: 2,
  defiance: 3,
  vanguard: 1,
  improved_shield_wall: 2,
  concussion_blow: 1,
  bastion: 5,
  focused_rage: 3,
  shield_slam: 1,
};

/*
 * IMPROVED SHIELD WALL 2 IS DEAD AT ANY FIGHT LENGTH THIS REPORT RUNS: Shield
 * Wall fires about 0.2 times a fight, so it is cast at most once either way.
 * Those two points are the free ones.
 */
/* Improved Charge is NOT free: it is the fifteenth Arms point below Impale's tier. */
const P_FREE = without(PROT, 'improved_shield_wall');
const protTalents: Variant[] = [
  control('Prot Warr tree (17/0/34)'),
  { label: 'ISW 2 -> Cruelty 2', apply: tree({ ...P_FREE, cruelty: 2 }) },
  { label: 'ISW 2 -> ITC 3/3 + Cruelty 1', apply: tree({ ...P_FREE, improved_thunder_clap: 3, cruelty: 1 }) },
  { label: 'ISW 2 -> ITC 3/3 + Improved Bloodrage 1', apply: tree({ ...P_FREE, improved_thunder_clap: 3, improved_bloodrage: 1 }) },
  { label: 'ISW 2 -> Improved Bloodrage 2', apply: tree({ ...P_FREE, improved_bloodrage: 2 }) },
  {
    label: 'Deflection 5 + ICharge 1 -> ITM 5 + Anger Management',
    apply: tree({ ...without(PROT, 'deflection', 'improved_charge'), improved_tactical_mastery: 5, anger_management: 1 }),
  },
  {
    label: 'AM build + ISW 2 -> Cruelty 2',
    apply: tree({
      ...without(PROT, 'deflection', 'improved_charge', 'improved_shield_wall'),
      improved_tactical_mastery: 5,
      anger_management: 1,
      cruelty: 2,
    }),
  },
];

const protOpener: Variant[] = [
  control('Prot Warr opener'),
  { label: 'add Demoralizing Shout? no -- add Thunder Clap at 0s', apply: addPrecombat(0, 'thunder_clap') },
];

const protSt: Variant[] = [
  control('Prot Warr list'),
  { label: 'OWNER NUMBER: Heroic Strike at 15 rage (owner 26)', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 15, 'rage'))) },
  { label: 'OWNER NUMBER: Heroic Strike at 40 rage', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 40, 'rage'))) },
  { label: 'OWNER NUMBER: Heroic Strike at 60 rage', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 60, 'rage'))) },
  { label: 'OWNER LINE: Shield Slam above Heroic Strike', apply: moveAbove('shield_slam', 'heroic_strike') },
  { label: 'OWNER LINE: Revenge above Heroic Strike', apply: moveAbove('revenge', 'heroic_strike') },
  { label: 'OWNER LINE: Shield Block removed', apply: removeEntry('shield_block_cast') },
  { label: 'OWNER LINE: Rend removed', apply: removeEntry('rend_cast') },
  { label: 'OWNER LINE: Demoralizing Shout removed', apply: removeEntry('demoralizing_shout_cast') },
  { label: 'OWNER LINE: Thunder Clap removed', apply: removeEntry('thunder_clap') },
];

const tankCleave = (rage: number) => swapAbility('heroic_strike', 'cleave', outsideExecute(resource('atLeast', rage, 'rage')));
const protAoe: Variant[] = [
  control('Prot Warr Multi Target (none: the ST list)'),
  { label: 'Thunder Clap above Heroic Strike', apply: inMulti(moveAbove('thunder_clap', 'heroic_strike')) },
  { label: 'Thunder Clap above Revenge', apply: inMulti(moveAbove('thunder_clap', 'revenge')) },
  { label: 'Cleave for Heroic Strike at 26', apply: inMulti(tankCleave(26)) },
  { label: 'Cleave for Heroic Strike at 40', apply: inMulti(tankCleave(40)) },
  { label: 'TC above HS + Cleave 26', apply: inMulti(moveAbove('thunder_clap', 'heroic_strike'), tankCleave(26)) },
  {
    label: 'TC above HS + Cleave 26 + Rend multi-DoT 5',
    apply: inMulti(
      moveAbove('thunder_clap', 'heroic_strike'),
      tankCleave(26),
      apl((e) => {
        const at = entryAt(e, 'rend_cast');
        e[at] = { ...e[at], multiDot: 5 };
        return e;
      }),
    ),
  },
  {
    label: 'TC above HS + Cleave 26 + Demo Shout removed',
    apply: inMulti(moveAbove('thunder_clap', 'heroic_strike'), tankCleave(26), removeEntry('demoralizing_shout_cast')),
  },
];

/* PASS 2 on pass 1's winner: Cleave for Heroic Strike at the owner's 26 (+159.2). */
const rendMultiDot = (n: number) =>
  apl((e) => {
    const at = entryAt(e, 'rend_cast');
    e[at] = { ...e[at], multiDot: n };
    return e;
  });
const PROT_AOE1 = [tankCleave(26)] as const;
const protAoe2: Variant[] = [
  control('Prot Warr Multi Target (none: the ST list)'),
  { label: 'AOE1: Cleave for Heroic Strike at 26', apply: inMulti(...PROT_AOE1) },
  { label: 'AOE1, Cleave at 15', apply: inMulti(tankCleave(15)) },
  { label: 'AOE1 - Demoralizing Shout', apply: inMulti(...PROT_AOE1, removeEntry('demoralizing_shout_cast')) },
  { label: 'AOE1 + Rend multi-DoT 5', apply: inMulti(...PROT_AOE1, rendMultiDot(5)) },
  { label: 'AOE1 - Thunder Clap', apply: inMulti(...PROT_AOE1, removeEntry('thunder_clap')) },
  { label: 'AOE1 - Rend', apply: inMulti(...PROT_AOE1, removeEntry('rend_cast')) },
  { label: 'AOE1, Thunder Clap above Shield Slam', apply: inMulti(...PROT_AOE1, moveAbove('thunder_clap', 'shield_slam')) },
  { label: 'AOE1, Heroic Strike kept below Cleave at 60', apply: inMulti(...PROT_AOE1, addAbove({ abilityId: 'heroic_strike', condition: outsideExecute(resource('atLeast', 60, 'rage')) }, 'shield_block_cast')) },
  { label: 'AOE1, Cleave above Demoralizing Shout', apply: inMulti(...PROT_AOE1, moveAbove('cleave', 'demoralizing_shout_cast')) },
];

/* ============================================================== FURY PROT */

const FP: Record<string, number> = {
  deflection: 5,
  booming_voice: 5,
  cruelty: 5,
  unbridled_wrath: 2,
  blood_craze: 3,
  enrage: 5,
  improved_execute: 2,
  improved_berserker_rage: 2,
  death_wish: 1,
  flurry: 5,
  bloodthirst: 1,
  shield_specialization: 5,
  anticipation: 3,
  improved_revenge: 3,
  last_stand: 1,
  defiance: 3,
};
const fpTalents: Variant[] = [
  control('Fury Prot tree (5/31/15)'),
  { label: 'Anticipation 3 -> Improved Thunder Clap 3', apply: tree({ ...without(FP, 'anticipation'), improved_thunder_clap: 3 }) },
  { label: 'Anticipation 3 -> Master of Defense 2 + ITC 1', apply: tree({ ...without(FP, 'anticipation'), master_of_defense: 2, improved_thunder_clap: 1 }) },
  { label: 'Booming Voice 5 -> BV 2 + Unbridled Wrath 5/5', apply: tree({ ...FP, booming_voice: 2, unbridled_wrath: 5 }) },
  { label: 'Improved Berserker Rage 2 -> Unbridled Wrath 4/5', apply: tree({ ...without(FP, 'improved_berserker_rage'), unbridled_wrath: 4 }) },
  {
    label: 'IBR 2 + BV 1 -> Unbridled Wrath 5/5',
    apply: tree({ ...without(FP, 'improved_berserker_rage'), booming_voice: 4, unbridled_wrath: 5 }),
  },
  {
    label: 'Deflection 5 -> ITC 3 + Master of Defense 2',
    apply: tree({ ...without(FP, 'deflection'), improved_thunder_clap: 3, master_of_defense: 2 }),
  },
];

const fpSt: Variant[] = [
  control('Fury Prot list'),
  { label: 'Heroic Strike at 50 rage (shipped 65)', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 50, 'rage'))) },
  { label: 'Heroic Strike at 40 rage', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 40, 'rage'))) },
  { label: 'Heroic Strike at 80 rage', apply: regate('heroic_strike', outsideExecute(resource('atLeast', 80, 'rage'))) },
  { label: 'Bloodthirst above Revenge', apply: moveAbove('bloodthirst', 'revenge') },
  { label: 'Bloodthirst above Heroic Strike', apply: moveAbove('bloodthirst', 'heroic_strike') },
  { label: 'Death Wish at the bottom', apply: chain(removeEntry('death_wish'), addEntry({ abilityId: 'death_wish' })) },
  { label: 'OWNER LINE: Thunder Clap removed', apply: removeEntry('thunder_clap') },
  { label: 'OWNER LINE: Rend removed', apply: removeEntry('rend_cast') },
];

const fpAoe: Variant[] = [
  control('Fury Prot Multi Target (none: the ST list)'),
  { label: 'Thunder Clap above Heroic Strike', apply: inMulti(moveAbove('thunder_clap', 'heroic_strike')) },
  { label: 'Thunder Clap above Revenge', apply: inMulti(moveAbove('thunder_clap', 'revenge')) },
  { label: 'Cleave for Heroic Strike at 65', apply: inMulti(tankCleave(65)) },
  { label: 'Cleave for Heroic Strike at 40', apply: inMulti(tankCleave(40)) },
  { label: 'TC above HS + Cleave 40', apply: inMulti(moveAbove('thunder_clap', 'heroic_strike'), tankCleave(40)) },
  { label: 'TC above HS + Cleave 65', apply: inMulti(moveAbove('thunder_clap', 'heroic_strike'), tankCleave(65)) },
];

/* PASS 2 on pass 1's winner: Cleave for Heroic Strike at 40 (+67.6). */
const FP_AOE1 = [tankCleave(40)] as const;
const fpAoe2: Variant[] = [
  control('Fury Prot Multi Target (none: the ST list)'),
  { label: 'AOE1: Cleave at 40', apply: inMulti(...FP_AOE1) },
  { label: 'AOE1, Cleave at 30', apply: inMulti(tankCleave(30)) },
  { label: 'AOE1, Cleave at 50', apply: inMulti(tankCleave(50)) },
  { label: 'AOE1 - Thunder Clap', apply: inMulti(...FP_AOE1, removeEntry('thunder_clap')) },
  { label: 'AOE1 - Demoralizing Shout', apply: inMulti(...FP_AOE1, removeEntry('demoralizing_shout_cast')) },
  { label: 'AOE1 + Rend multi-DoT 5', apply: inMulti(...FP_AOE1, rendMultiDot(5)) },
  { label: 'AOE1, Bloodthirst above Revenge', apply: inMulti(...FP_AOE1, moveAbove('bloodthirst', 'revenge')) },
  { label: 'AOE1, Cleave above Demoralizing Shout', apply: inMulti(...FP_AOE1, moveAbove('cleave', 'demoralizing_shout_cast')) },
];

/* ============================================================== shared: enchants, consumables, race */

const dpsEnchants = (twoHand: boolean): Variant[] => [
  control('enchants'),
  { label: 'head +8 Str -> +1% Haste', apply: enchant('head', ench('+1% Haste')) },
  { label: 'head +8 Str -> +8 Agility', apply: enchant('head', ench('+8 Agility')) },
  { label: 'gloves +15 Str -> +15 Agility', apply: enchant('gloves', ench('+15 Agility')) },
  { label: 'neck +5 Str -> +5 Agility', apply: enchant('neck', ench('+5 Agility')) },
  { label: 'feet +7 Agi -> +7 Stamina', apply: enchant('feet', ench('+7 Stamina')) },
  twoHand
    ? { label: 'two-hand Crusader -> +25 Agility', apply: enchant('twoHand', ench('+25 Agility')) }
    : { label: 'main hand Crusader -> +25 Agility', apply: enchant('mainHand', ench('+25 Agility')) },
];

const tankEnchants: Variant[] = [
  control('tank enchants'),
  { label: 'feet Minor Speed -> +7 Agility', apply: enchant('feet', ench('+7 Agility')) },
  { label: 'feet Minor Speed -> +4 Defense Skill', apply: enchant('feet', ench('+4 Defense Skill')) },
  { label: 'feet Minor Speed -> +7 Stamina', apply: enchant('feet', ench('+7 Stamina')) },
  { label: 'head +1% Dodge -> +8 Strength', apply: enchant('head', ench('+8 Strength')) },
  { label: 'head +1% Dodge -> +8 Agility', apply: enchant('head', ench('+8 Agility')) },
  { label: 'neck +5 Def -> +5 Strength', apply: enchant('neck', ench('+5 Strength')) },
  { label: 'wrists +4 Def -> +9 Strength', apply: enchant('wrists', ench('+9 Strength')) },
  { label: 'cloak +1% Dodge -> +5 Agility', apply: enchant('cloak', ench('+5 Agility')) },
  { label: 'main hand Crusader -> +25 Agility', apply: enchant('mainHand', ench('+25 Agility')) },
  { label: 'gloves +2% Threat -> +15 Strength', apply: enchant('gloves', ench('+15 Strength')) },
];

const dpsConsumables: Variant[] = [
  control('consumables'),
  { label: 'potion Mighty Rage -> Major Frenzy', apply: consumable('potion', 'major_frenzy_potion') },
  { label: 'blasted Strength -> Agility', apply: consumable('blasted_lands', 'blasted_agility') },
  { label: 'main stone: melee crit -> dense sharpening', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
];

const tankConsumables: Variant[] = [
  control('tank consumables'),
  { label: 'flask Hit Points -> Spell Power (worth nothing: a dead flask)', apply: consumable('flask', 'flask_spell_power') },
  { label: 'potion Mighty Rage -> Major Frenzy', apply: consumable('potion', 'major_frenzy_potion') },
  { label: 'hit_points elixir dropped', apply: dropConsumable('hit_points') },
  { label: 'armor elixir dropped', apply: dropConsumable('armor') },
  { label: 'main stone: melee crit -> dense sharpening', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
];

const races = (current: RaceId): Variant[] => [
  control(`race (${current})`),
  ...(['human', 'dwarf', 'night_elf', 'gnome', 'orc', 'undead', 'tauren', 'troll', 'high_order_skyborne'] as RaceId[])
    .filter((r) => r !== current)
    .map((r) => ({ label: `race -> ${r}`, apply: race(r) })),
];

/* ============================================================== COMBINED: the winners together */

const TANK_AOE_TRIM = [removeEntry('thunder_clap'), removeEntry('demoralizing_shout_cast')] as const;
const armsCombined: Variant[] = [
  control('2H Arms build'),
  { label: 'COMBINED: Blood Fury at 0s + Multi Target AOE1', apply: chain(addPrecombat(0, 'blood_fury'), inMulti(...ARMS_AOE1)) },
];
const furyCombined: Variant[] = [
  control('DW Fury build'),
  { label: 'COMBINED: Blood Fury at 0s + Multi Target AOE1', apply: chain(addPrecombat(0, 'blood_fury'), inMulti(...FURY_AOE1)) },
];
const protCombined: Variant[] = [
  control('Prot Warr build'),
  { label: 'ISW 2 -> Cruelty 2', apply: tree({ ...P_FREE, cruelty: 2 }) },
  { label: 'feet +7 Agility', apply: enchant('feet', ench('+7 Agility')) },
  {
    label: 'COMBINED: Cruelty 2 + feet +7 Agi + Multi (Cleave 26, no TC, no Demo)',
    apply: chain(tree({ ...P_FREE, cruelty: 2 }), enchant('feet', ench('+7 Agility')), inMulti(...PROT_AOE1, ...TANK_AOE_TRIM)),
  },
];
const FP_UW5 = { ...without(FP, 'improved_berserker_rage'), booming_voice: 4, unbridled_wrath: 5 };
const fpCombined: Variant[] = [
  control('Fury Prot build'),
  { label: 'IBR 2 + BV 1 -> Unbridled Wrath 5/5', apply: tree(FP_UW5) },
  { label: 'feet +7 Agility', apply: enchant('feet', ench('+7 Agility')) },
  {
    label: 'COMBINED: UW 5/5 + feet +7 Agi + Multi (Cleave 40, no TC, no Demo)',
    apply: chain(tree(FP_UW5), enchant('feet', ench('+7 Agility')), inMulti(...FP_AOE1, ...TANK_AOE_TRIM)),
  },
];

/* Silence unused-import complaints for helpers kept for later passes. */
void any;
void selfHas;
void targetCount;
void targetTime;
void copyAbove;

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  armsCombined,
  furyCombined,
  protCombined,
  fprotCombined: fpCombined,
  armsTalents,
  armsOpener,
  armsSt,
  armsAoe,
  armsAoe2,
  armsAoeOpener: [
    { label: 'AOE1 -- the reference for this group', apply: inMulti(...ARMS_AOE1) },
    { label: 'AOE1 + Sweeping Strikes at 0s (after the potion)', apply: inMulti(...ARMS_AOE1, addPrecombat(0, 'sweeping_strikes')) },
    { label: 'AOE1 + Blood Fury at 0s', apply: inMulti(...ARMS_AOE1, addPrecombat(0, 'blood_fury')) },
    { label: 'AOE1 + Sweeping + Blood Fury at 0s', apply: inMulti(...ARMS_AOE1, addPrecombat(0, 'sweeping_strikes', 'blood_fury')) },
  ],
  armsAoeCheck: [control('2H Arms Multi Target'), { label: 'AOE1', apply: inMulti(...ARMS_AOE1) }],
  armsEnchants: dpsEnchants(true),
  armsConsumables: dpsConsumables,
  armsRace: races('orc'),
  furyTalents,
  furyOpener,
  furySt,
  furyAoe,
  furyAoe2,
  furyAoeCheck: [control('DW Fury Multi Target'), { label: 'AOE1', apply: inMulti(...FURY_AOE1) }],
  furyEnchants: dpsEnchants(false),
  furyConsumables: dpsConsumables,
  furyRace: races('orc'),
  protTalents,
  protOpener,
  protSt,
  protAoe,
  protAoe2,
  protAoeCheck: [
    control('Prot Warr Multi Target'),
    { label: 'AOE1: Cleave at 26', apply: inMulti(...PROT_AOE1) },
    { label: 'AOE1 - Thunder Clap', apply: inMulti(...PROT_AOE1, removeEntry('thunder_clap')) },
  ],
  protAoe3: [
    { label: 'AOE1 -- the reference for this group', apply: inMulti(...PROT_AOE1) },
    { label: 'AOE1 + Rend multi-DoT 5', apply: inMulti(...PROT_AOE1, rendMultiDot(5)) },
    { label: 'AOE1 + Rend multi-DoT 3', apply: inMulti(...PROT_AOE1, rendMultiDot(3)) },
    { label: 'AOE1 + Rend MD5 - Demoralizing Shout', apply: inMulti(...PROT_AOE1, rendMultiDot(5), removeEntry('demoralizing_shout_cast')) },
    { label: 'AOE1 + Rend MD5 - Thunder Clap', apply: inMulti(...PROT_AOE1, rendMultiDot(5), removeEntry('thunder_clap')) },
    { label: 'AOE1 + Rend MD5, Cleave above Demo Shout', apply: inMulti(...PROT_AOE1, rendMultiDot(5), moveAbove('cleave', 'demoralizing_shout_cast')) },
  ],
  protEnchants: tankEnchants,
  protConsumables: tankConsumables,
  protRace: races('tauren'),
  fprotTalents: fpTalents,
  fprotSt: fpSt,
  fprotAoe: fpAoe,
  fprotAoe2: fpAoe2,
  fprotAoe3: [
    control('Fury Prot Multi Target'),
    { label: 'AOE1: Cleave at 40', apply: inMulti(...FP_AOE1) },
    { label: 'AOE1 - Thunder Clap', apply: inMulti(...FP_AOE1, removeEntry('thunder_clap')) },
    { label: 'AOE1 - Thunder Clap - Demoralizing Shout', apply: inMulti(...FP_AOE1, removeEntry('thunder_clap'), removeEntry('demoralizing_shout_cast')) },
  ],
  protAoe4: [
    control('Prot Warr Multi Target'),
    { label: 'AOE1 - Thunder Clap', apply: inMulti(...PROT_AOE1, removeEntry('thunder_clap')) },
    { label: 'AOE1 - Thunder Clap - Demoralizing Shout', apply: inMulti(...PROT_AOE1, removeEntry('thunder_clap'), removeEntry('demoralizing_shout_cast')) },
  ],
  fprotEnchants: tankEnchants,
  fprotConsumables: tankConsumables,
  fprotRace: races('tauren'),
  tankRaceTop: [control('race (tauren)'), ...(['undead', 'orc', 'human'] as RaceId[]).map((r) => ({ label: `race -> ${r}`, apply: race(r) }))],
};
