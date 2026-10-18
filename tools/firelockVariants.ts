/*
 * The variants `probe_build.ts` measures on the Firelock.
 *
 * ============================================================================
 * THE THEME (Step 0). These may not move:
 *
 *   class                 Warlock
 *   majority tree         Destruction, 5/11/35, and it stays the majority
 *   style                 caster, the E65 template, Firestone
 *   demons                none out; the Succubus sacrificed
 *   target swings back    no
 *
 * WHY THIS ROUND EXISTS: Life Tap stopped costing health (round 41), and the
 * build's long-fight curve moved more than any other profile's --
 *
 *    60s  921.2 -> 921.2     120s  655.7 -> 846.1
 *   180s  509.9 -> 828.9     300s  386.2 -> 809.5    (probe_clock, 40 fights)
 *
 * -- so every choice priced under the old limit is stale. It is no longer
 * mana-bound: headroom sits at 17-18% at every length, and the mana comes from
 * Life Tap, 33 taps in 300s, each a global cooldown. The question is now what
 * a global cooldown is worth, and what the twelve dead talent points could buy.
 *
 * THE BUILD AS READ (Step 1), USES=1, 60s, 934.6:
 *
 *   Incinerate 51.8%   Immolate 17.3%   Conflagrate 14.0%   Bane of Agony 8.8%
 *   Shadowburn 7.1%    Touch of the Grave 1.0%    Life Tap 2.3 casts
 *
 * CORRUPTION IS OUT BY THE OWNER'S INSTRUCTION and is priced here as a
 * question, not as a candidate to ship.
 * ============================================================================
 */
import {
  type Variant,
  treeFor,
  apl,
  removeEntry,
  addAbove,
  addPrecombat,
} from './buildVariants';
import {
  all,
  fightRemaining,
  resourceFraction,
  targetMissing,
  targetTime,
} from '../src/game/rotations/apl/shorthand';
import type { AplCondition } from '../src/game/rotations/apl';

const tree = treeFor('warlock');

const regate = (abilityId: string, condition: AplCondition | undefined) =>
  apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === abilityId);
    if (at < 0) throw new Error('no entry for ' + abilityId);
    const { condition: _drop, ...rest } = entries[at];
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

const lifeTapAt = (fraction: number) => regate('life_tap', resourceFraction('below', fraction, 'mana'));

/* ============================================================ the tree */

/*
 * THE SHIPPED 5/11/35. Dead points: Destructive Reach 2 (range), Intensity 3
 * (cast pushback, a permanent ruling), Demonic Embrace 5 and Demonic Aegis 2
 * (stamina and Demon Armor, neither read here). The Demonology seven hold
 * Demonic Sacrifice's tier and every alternative there is just as dead, so they
 * stay; the Destruction five can move.
 *
 * THIS IS THE ROUND-42 STARTING TREE, kept as written because every figure in
 * this file is a delta from it. Round 42 shipped Improved Life Tap 2 and
 * Aftermath 5/5 in place of Destructive Reach 2 and Intensity 3, so the
 * preset's control is that tree now and a re-run of these groups prices
 * against it.
 */
const BASE: Record<string, number> = {
  suppression: 5,
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
  destructive_reach: 2,
  bane: 5,
  cataclysm: 3,
  aftermath: 2,
  ruin: 5,
  shadowburn: 1,
  intensity: 3,
  agonizing_flames: 3,
  conflagrate: 1,
  bane_of_havoc: 1,
  fire_and_brimstone: 3,
  shadow_and_flame: 5,
  incinerate: 1,
};

const with_ = (changes: Record<string, number>) => {
  const out: Record<string, number> = { ...BASE, ...changes };
  for (const [k, v] of Object.entries(out)) if (v === 0) delete out[k];
  return tree(out);
};

const FL_TALENTS: readonly Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  // Destructive Reach is range; Improved Life Tap is +20% on 33 taps.
  { label: 'Destructive Reach 2 -> Improved Life Tap 2', apply: with_({ destructive_reach: 0, improved_life_tap: 2 }) },
  // Intensity is cast pushback, which nothing here can do.
  { label: 'Intensity 3 -> Aftermath 5/5', apply: with_({ intensity: 0, aftermath: 5 }) },
  {
    label: 'both: Improved Life Tap 2 + Aftermath 5/5',
    apply: with_({ destructive_reach: 0, improved_life_tap: 2, intensity: 0, aftermath: 5 }),
  },
  // Cataclysm priced on its own: 10% off Destruction mana on a build that taps for it.
  { label: 'Cataclysm 3 -> Molten Skin 3 (dead)', apply: with_({ cataclysm: 0, molten_skin: 3 }) },
];

/* ============================================================ the list */

const FL_APL: readonly Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'no Bane of Agony', apply: removeEntry('bane_of_agony') },
  {
    label: 'Bane of Agony floor 12s (was 25s)',
    apply: regate('bane_of_agony', all(targetMissing('bane_of_agony'), fightRemaining('atLeast', 12))),
  },
  {
    label: 'Immolate floor 6s (was 3s)',
    apply: regate('immolate', all(targetTime('atMost', 1.5, 'immolate'), fightRemaining('atLeast', 6))),
  },
  {
    label: 'Immolate "if not active" instead of the 1.5s window',
    apply: regate('immolate', all(targetMissing('immolate'), fightRemaining('atLeast', 3))),
  },
  {
    label: 'QUESTION ONLY: + Corruption above Life Tap',
    apply: addAbove(
      { abilityId: 'corruption', condition: all(targetMissing('corruption'), fightRemaining('atLeast', 19)) },
      'life_tap',
    ),
  },
];

/* ============================================================ Life Tap */

const FL_LIFE_TAP: readonly Variant[] = [
  { label: 'the shipped gate -- the control', apply: (p) => p },
  { label: 'Life Tap below 2%', apply: lifeTapAt(0.02) },
  { label: 'Life Tap below 10%', apply: lifeTapAt(0.1) },
  { label: 'Life Tap below 15%', apply: lifeTapAt(0.15) },
  { label: 'Life Tap below 25%', apply: lifeTapAt(0.25) },
];

/* ============================================================ pre-combat */

const FL_PRECOMBAT: readonly Variant[] = [
  { label: 'the shipped opener -- the control', apply: (p) => p },
  // A pure DoT at a 0s lead deals nothing before the pull.
  { label: '+ Bane of Agony at 0s', apply: addPrecombat(0, 'bane_of_agony') },
];

/* ============================================================ combined */

const FL_WINNING_TREE = with_({ destructive_reach: 0, improved_life_tap: 2, intensity: 0, aftermath: 5 });
const FL_BANE_OPENER = addPrecombat(0, 'bane_of_agony');

const FL_COMBINED: readonly Variant[] = [
  { label: 'the shipped profile -- the control', apply: (p) => p },
  { label: 'tree + Bane opener', apply: (p) => FL_BANE_OPENER(FL_WINNING_TREE(p)) },
  { label: 'tree + Bane opener + Life Tap below 10%', apply: (p) => lifeTapAt(0.1)(FL_BANE_OPENER(FL_WINNING_TREE(p))) },
  { label: 'tree + Bane opener + Life Tap below 3%', apply: (p) => lifeTapAt(0.03)(FL_BANE_OPENER(FL_WINNING_TREE(p))) },
];

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  flCombined: FL_COMBINED,
  flTalents: FL_TALENTS,
  flApl: FL_APL,
  flLifeTap: FL_LIFE_TAP,
  flPrecombat: FL_PRECOMBAT,
};

