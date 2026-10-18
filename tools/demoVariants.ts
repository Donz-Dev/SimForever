/*
 * The variants `probe_build.ts` measures on the Demonology Warlock.
 *
 * ============================================================================
 * THE THEME, WRITTEN DOWN BEFORE ANYTHING (Step 0). These may not move:
 *
 *   class                 Warlock
 *   majority tree         Demonology -- at least 31, the owner's floor, with
 *                         Suppression 5/5 and Ruin 5/5 fixed beside it
 *   style                 caster, the Firelock's E65 template, enchants,
 *                         stone and consumables (the owner: "everything else
 *                         except the APL will be the same as the Firelock")
 *   demons                the Imp summoned, the Succubus sacrificed, Master
 *                         Demonologist read off the Imp
 *   target swings back    no
 *
 * SO THREE DIMENSIONS ARE OPEN AND TWO ARE CLOSED BY THE OWNER. Talents beyond
 * the named ones, the combat list and the pre-combat list are measured here;
 * enchants and consumables are the Firelock's and are not.
 *
 * THE BUILD AS READ (Step 1), the first list, 60s:
 *
 *   Searing Pain 46.8%   Immolate 16.8%   Firebolt (Imp) 11.6%   Soul Fire 11.3%
 *   Bane of Agony 8.2%   Demonic Brand 4.4%   Touch of the Grave 0.9%
 *
 *   AND IT IS MANA-BOUND PAST A MINUTE, which decides most of the APL pass:
 *
 *     60s  945.8   headroom 24.6%   Soul Fire 3.35 casts
 *    120s  896.4            14.7%             5.55
 *    180s  717.2             4.0%             1.65
 *    300s  559.0             1.8%             0.78
 *
 *   Soul Fire FALLS at 180s and 300s although its window GROWS: it needs 335
 *   mana to cast, and by the last 35% of a long fight there is none. The
 *   Firelock goes the same way and further -- 921 / 656 / 510 / 386.
 * ============================================================================
 */
import {
  type Variant,
  treeFor,
  apl,
  chain,
  removeEntry,
  addAbove,
  addPrecombat,
  removePrecombat,
} from './buildVariants';
import { all, fightRemaining, resourceFraction, targetMissing, targetTime } from '../src/game/rotations/apl/shorthand';
import type { AplCondition } from '../src/game/rotations/apl';
import { DECIMATION_PHASE } from '../src/game/rotations/warlock';

const tree = treeFor('warlock');

/** Replace one entry's condition, refusing an id the list does not carry. */
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
 * THE SHIPPED 5/31/15. Movable: the five Destruction points under Ruin besides
 * Bane, and Demonology's four dead points plus Fel Vitality's three. Everything
 * else is the owner's or is forced by Demonic Pact's tier.
 */
const BASE: Record<string, number> = {
  suppression: 5,
  unholy_power: 5,
  improved_imp: 3,
  demonic_embrace: 4,
  fel_vitality: 3,
  demonic_sacrifice: 1,
  demonic_brand: 3,
  decimation: 2,
  soul_link: 1,
  demonic_knowledge: 3,
  master_demonologist: 5,
  demonic_pact: 1,
  bane: 5,
  cataclysm: 3,
  aftermath: 2,
  ruin: 5,
};

const with_ = (changes: Record<string, number>) => {
  const out: Record<string, number> = { ...BASE, ...changes };
  for (const [k, v] of Object.entries(out)) if (v === 0) delete out[k];
  return tree(out);
};

const DEMO_TALENTS: readonly Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  // The five Destruction points under Ruin, besides Bane.
  { label: 'Aftermath 5/5, no Cataclysm', apply: with_({ cataclysm: 0, aftermath: 5 }) },
  { label: 'Cataclysm 3/3 + Aftermath 0, Improved Shadow Bolt 2 (dead)', apply: with_({ aftermath: 0, improved_shadow_bolt: 2 }) },
  { label: 'Aftermath 2 + 3 dead (Molten Skin), no Cataclysm', apply: with_({ cataclysm: 0, molten_skin: 3 }) },
  // Bane against the field, priced: without it Soul Fire is 4.0 x 0.6 = 3.6s.
  // Tier 0 still needs five points to open Cataclysm and Aftermath, and the
  // only other tier-0 sinks are Improved Shadow Bolt and Destructive Reach.
  { label: 'Bane 0, Improved Shadow Bolt 5 (dead) in its place', apply: with_({ bane: 0, improved_shadow_bolt: 5 }) },
  // Fel Vitality is the one live mana talent in reach.
  { label: 'Fel Vitality 0, Demonic Embrace 5 + Health Funnel 2 (dead)', apply: with_({ fel_vitality: 0, demonic_embrace: 5, improved_health_funnel: 2 }) },
];

/* ============================================================ pre-combat */

const DEMO_PRECOMBAT: readonly Variant[] = [
  { label: 'the shipped opener -- the control', apply: (p) => p },
  { label: 'Immolate at 1.5s instead of Searing Pain', apply: chain(removePrecombat('searing_pain'), addPrecombat(1.5, 'immolate')) },
  // A pure DoT at a 0s lead is legal: its first tick is after the pull.
  { label: '+ Bane of Agony at 0s', apply: addPrecombat(0, 'bane_of_agony') },
  { label: 'Immolate 1.5s + Bane of Agony 0s', apply: chain(removePrecombat('searing_pain'), addPrecombat(1.5, 'immolate'), addPrecombat(0, 'bane_of_agony')) },
  { label: 'no opener', apply: removePrecombat('searing_pain') },
];

/* ============================================================ the list */

const DEMO_APL: readonly Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'no Bane of Agony', apply: removeEntry('bane_of_agony') },
  { label: 'no Immolate', apply: removeEntry('immolate') },
  {
    label: 'Immolate "if not active" instead of the 1.5s window',
    apply: regate('immolate', all(targetMissing('immolate'), fightRemaining('atLeast', 3))),
  },
  {
    label: 'Shadow Bolt filler, Searing Pain only to keep the brand up',
    apply: chain(
      addAbove({ abilityId: 'searing_pain', condition: targetTime('atMost', 1.5, 'demonic_brand') }, 'immolate'),
      apl((entries) => {
        const last = entries.length - 1;
        if (entries[last].abilityId !== 'searing_pain') throw new Error('filler moved');
        entries[last] = { abilityId: 'shadow_bolt' };
        return entries;
      }),
    ),
  },
  {
    label: '+ Corruption above the filler',
    apply: addAbove(
      { abilityId: 'corruption', condition: all(targetMissing('corruption'), fightRemaining('atLeast', 19)) },
      'life_tap',
    ),
  },
  {
    label: '+ Soul Fire BEFORE the window too (a shard, 4.0s cast)',
    apply: addAbove({ abilityId: 'soul_fire' }, 'life_tap'),
  },
  {
    label: 'Soul Fire below Immolate and Bane in the window',
    apply: chain(removeEntry('soul_fire'), addAbove({ abilityId: 'soul_fire', condition: DECIMATION_PHASE }, 'life_tap')),
  },
];

/* ============================================================ Life Tap */

/*
 * THE FIRELOCK'S 5% GATE, BORROWED, and this project's own rule is not to
 * normalise a threshold across two lists of one class -- so swept rather than
 * assumed. Mana-bound past a minute, so the sweep is read at 180s too.
 */
const DEMO_LIFE_TAP: readonly Variant[] = [
  { label: 'the shipped gate -- the control', apply: (p) => p },
  { label: 'Life Tap below 1%', apply: lifeTapAt(0.01) },
  { label: 'Life Tap below 10%', apply: lifeTapAt(0.1) },
  { label: 'Life Tap below 15%', apply: lifeTapAt(0.15) },
  { label: 'Life Tap below 25%', apply: lifeTapAt(0.25) },
  { label: 'Life Tap below 40%', apply: lifeTapAt(0.4) },
];

/* ============================================================ combined */

/*
 * PASS ONE'S CANDIDATES TOGETHER, which is the knock-on check: each was
 * measured against the first list alone, and two winners need not add.
 */
const SOUL_FIRE_EARLY = addAbove({ abilityId: 'soul_fire' }, 'life_tap');
const SOUL_FIRE_EARLY_ABOVE_DOTS = addAbove({ abilityId: 'soul_fire' }, 'immolate');
const SOUL_FIRE_WINDOW_BELOW_DOTS = chain(
  removeEntry('soul_fire'),
  addAbove({ abilityId: 'soul_fire', condition: DECIMATION_PHASE }, 'life_tap'),
);
const BANE_OPENER = addPrecombat(0, 'bane_of_agony');

const DEMO_COMBINED: readonly Variant[] = [
  { label: 'the shipped profile -- the control', apply: (p) => p },
  { label: 'Soul Fire early', apply: SOUL_FIRE_EARLY },
  { label: 'Soul Fire early + Bane opener', apply: chain(SOUL_FIRE_EARLY, BANE_OPENER) },
  {
    label: 'Soul Fire early + Bane opener + window Soul Fire below the DoTs',
    apply: chain(SOUL_FIRE_WINDOW_BELOW_DOTS, SOUL_FIRE_EARLY, BANE_OPENER),
  },
  {
    label: 'Soul Fire early ABOVE the DoTs + Bane opener',
    apply: chain(SOUL_FIRE_EARLY_ABOVE_DOTS, BANE_OPENER),
  },
  {
    label: 'Soul Fire early + Bane opener + Aftermath 5/no Cataclysm',
    apply: chain(SOUL_FIRE_EARLY, BANE_OPENER, with_({ cataclysm: 0, aftermath: 5 })),
  },
  {
    label: 'Soul Fire early + Bane opener + Corruption',
    apply: chain(
      SOUL_FIRE_EARLY,
      BANE_OPENER,
      addAbove(
        { abilityId: 'corruption', condition: all(targetMissing('corruption'), fightRemaining('atLeast', 19)) },
        'life_tap',
      ),
    ),
  },
  {
    label: 'Soul Fire early + Bane opener + Life Tap below 15%',
    apply: chain(SOUL_FIRE_EARLY, BANE_OPENER, lifeTapAt(0.15)),
  },
];

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  demoCombined: DEMO_COMBINED,
  demoTalents: DEMO_TALENTS,
  demoPrecombat: DEMO_PRECOMBAT,
  demoApl: DEMO_APL,
  demoLifeTap: DEMO_LIFE_TAP,
};
