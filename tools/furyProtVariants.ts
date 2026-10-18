/*
 * The variants `probe_build.ts` measures on Fury Prot.
 *
 * ============================================================================
 * THE THEME, WRITTEN DOWN BEFORE ANYTHING (Step 0). These may not move:
 *
 *   class                 Warrior
 *   majority tree         Fury -- 5/31/15 as given, and it stays the majority
 *   style and weapons     one-hander and shield, the E65 template
 *   stance                Defensive
 *   target swings back    yes -- so the figure of merit is the DEATH COUNT
 *                         first and DPS second, and `probe_build` prints both
 *
 * THE BUILD AS READ (Step 1), 60s, before any of this:
 *
 *   Main Hand Auto-Attack   10508   Execute 7837 (7.1 casts)   Revenge 7009
 *   Heroic Strike 5557 (9.7)  Ret Aura 2347  Thorns 2280  Bloodthirst 1709 (2.2)
 *
 *   RAGE-BOUND AT THE PUBLISHED CLOCK AND LESS SO AT A LONGER ONE. Rage comes
 *   from damage taken and the boss ramps, so DPS goes 656 / 684 / 691 / 714 at
 *   60 / 120 / 180 / 300s, and Bloodthirst 2.2 / 8.7 / 15.4 / 28.6 casts.
 *   At 60s Bloodthirst -- 30 rage, sitting BELOW Heroic Strike at 26 -- is
 *   starved: one of its 2.2 casts is the opener.
 * ============================================================================
 */
import { type Variant, treeFor, apl, chain, consumable, enchant, moveAbove } from './buildVariants';
import { all, not, resource } from '../src/game/rotations/apl/shorthand';
import type { AplCondition } from '../src/game/rotations/apl';
import { TANK_EXECUTE_PHASE } from '../src/game/rotations/warrior';

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

/** Heroic Strike at a rage floor, still switched off in the Execute window. */
const heroicStrikeAt = (rage: number) =>
  regate('heroic_strike', all(resource('atLeast', rage, 'rage'), not(TANK_EXECUTE_PHASE)));

/* ============================================================ the tree */

/*
 * THE OWNER'S 5/31/15. What is movable is decided by what is DEAD:
 *
 *   IMPROVED BERSERKER RAGE 2   Berserker Rage is in no list, and putting it in
 *                               one would drag a Defensive tank into Berserker
 *                               Stance on every cast. Its rage clause is never
 *                               reached.
 *   DEFIANCE 3                  threat, which is out of scope.
 *   BOOMING VOICE 5             a cost cut on two shouts -- Battle Shout is cast
 *                               once before the pull and Demoralizing Shout
 *                               twice a fight -- plus a radius clause.
 *
 * THE ONLY LIVE SINK IN FURY ROWS 0-4 IS UNBRIDLED WRATH (rage from swings);
 * everything else there is dual-wield, control or out-of-combat. Points must
 * stay in rows 0-4, or Flurry and Bloodthirst lose their tier.
 */
const OWNER: Record<string, number> = {
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

const without = (allocation: Record<string, number>, ...ids: string[]) => {
  const copy = { ...allocation };
  for (const id of ids) delete copy[id];
  return copy;
};

/** Improved Berserker Rage's two dead points into Unbridled Wrath, 4/5. */
const UW4 = { ...without(OWNER, 'improved_berserker_rage'), unbridled_wrath: 4 };
/** And one more from Booming Voice, Unbridled Wrath 5/5. */
const UW5 = { ...UW4, booming_voice: 4, unbridled_wrath: 5 };
/** Defiance's three threat points into Anticipation 5/5 and Improved Bloodrage 1. */
const NO_DEFIANCE = {
  ...without(OWNER, 'defiance'),
  anticipation: 5,
  improved_bloodrage: 1,
};
/** The same, Improved Thunder Clap 1 in place of Improved Bloodrage. */
const NO_DEFIANCE_TC = {
  ...without(OWNER, 'defiance'),
  anticipation: 5,
  improved_thunder_clap: 1,
};

export const FP_TALENTS: readonly Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  { label: 'Imp. Berserker Rage 2 -> Unbridled Wrath 4/5', apply: tree(UW4) },
  { label: '... and 1 Booming Voice -> Unbridled Wrath 5/5', apply: tree(UW5) },
  { label: 'Defiance 3 -> Anticipation 5/5 + Imp. Bloodrage 1', apply: tree(NO_DEFIANCE) },
  { label: 'Defiance 3 -> Anticipation 5/5 + Imp. Thunder Clap 1', apply: tree(NO_DEFIANCE_TC) },
  {
    label: 'UW 5/5 and Defiance -> Anticipation + Imp. Bloodrage',
    apply: tree({ ...without(UW5, 'defiance'), anticipation: 5, improved_bloodrage: 1 }),
  },
];

/* ============================================================ the list */

export const FP_APL: readonly Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'Bloodthirst above Heroic Strike', apply: moveAbove('bloodthirst', 'heroic_strike') },
  { label: 'Bloodthirst above Shield Block', apply: moveAbove('bloodthirst', 'shield_block_cast') },
  { label: 'Bloodthirst above Revenge', apply: moveAbove('bloodthirst', 'revenge') },
  { label: 'Heroic Strike at 26 -- written out', apply: heroicStrikeAt(26) },
  { label: 'Heroic Strike at 40', apply: heroicStrikeAt(40) },
  { label: 'Heroic Strike at 55', apply: heroicStrikeAt(55) },
  { label: 'Heroic Strike at 70', apply: heroicStrikeAt(70) },
  {
    label: 'BT above HS, and HS at 40',
    apply: chain(moveAbove('bloodthirst', 'heroic_strike'), heroicStrikeAt(40)),
  },
  {
    label: 'BT above HS, and HS at 55',
    apply: chain(moveAbove('bloodthirst', 'heroic_strike'), heroicStrikeAt(55)),
  },
];

/* ============================================================ enchants */

/*
 * PROT WARR'S LOADOUT, copied by the owner's word -- and two of its slots are
 * worth nothing here: +2% Threat (threat is out of scope) and Minor Speed
 * (positioning). Priced rather than changed, since the copy was the owner's.
 */
export const FP_ENCHANTS: readonly Variant[] = [
  { label: 'the shipped enchants -- the control', apply: (p) => p },
  { label: 'gloves: +2% Threat -> +15 Strength', apply: enchant('gloves', 900021) },
  { label: 'gloves: +2% Threat -> +15 Agility', apply: enchant('gloves', 900022) },
  { label: 'gloves: +2% Threat -> +4 Defense Skill', apply: enchant('gloves', 900016) },
  { label: 'feet: Minor Speed -> +7 Agility', apply: enchant('feet', 900026) },
  { label: 'feet: Minor Speed -> +7 Stamina', apply: enchant('feet', 900027) },
  { label: 'feet: Minor Speed -> +4 Defense Skill', apply: enchant('feet', 900016) },
];

/* ============================================================ consumables */

export const FP_CONSUMABLES: readonly Variant[] = [
  { label: 'the shipped consumables -- the control', apply: (p) => p },
  { label: 'food: +20 Stamina -> +20 Strength', apply: consumable('food', 'food_strength') },
  {
    label: 'MH: Dense Sharpening Stone',
    apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand'),
  },
];

/*
 * HEROIC STRIKE'S FLOOR, SWEPT. It is the one lever the first pass found --
 * +47.8 at 55 against the shipped 26 -- and a two-point comparison cannot see a
 * peak, so every step is here, at both clocks.
 */
export const FP_HS_SWEEP: readonly Variant[] = [
  { label: 'the shipped Heroic Strike floor -- the control', apply: (p) => p },
  ...[35, 45, 50, 55, 60, 65, 70, 80, 90].map((rage) => ({
    label: `Heroic Strike at ${rage}`,
    apply: heroicStrikeAt(rage),
  })),
];

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  fpHsSweep: FP_HS_SWEEP,
  fpTalents: FP_TALENTS,
  fpApl: FP_APL,
  fpEnchants: FP_ENCHANTS,
  fpConsumables: FP_CONSUMABLES,
};
