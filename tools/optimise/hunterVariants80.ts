/*
 * ==============================================================================
 * ROUND 80 -- THE FOUR HUNTER PRESETS, second run of "Optimize, Update, and
 * Report", under the owner's round 79 rules (weighted talents, Horde races,
 * two potions with APL logic, slot-legal enchants, go deeper).
 *
 *   PRESET=lw_melee FILE=tools/optimise/hunterVariants80.ts VARIANTS=h80lwmRace \
 *     WEIGHTED=1 ITER=300 npx vite-node tools/probe_build.ts
 *
 * THE THEME, which no variant here ships a change to (a variant that DOES move
 * one is labelled "(question)" and is priced for the owner only):
 *
 * | preset     | majority tree        | style / weapons          | target swings |
 * | ---------- | -------------------- | ------------------------ | ------------- |
 * | bm_hunter  | 31 Beast Mastery     | ranged, bow + Cat pet    | no            |
 * | lw_ranged  | 41 Marksmanship      | ranged, bow, no pet      | no            |
 * | lw_melee   | 33 Survival          | dual wield, no pet       | no            |
 * | hawk_melee | 24 Survival (16 BM)  | dual wield, no pet, hawk | no            |
 *
 * BEFORE (full_report ITER=300 at the start of the round):
 *   bm_hunter   t1 1015.7  t3 1412.9  t5 1668.6  t8 2609.8  weighted 1465.2
 *   lw_ranged   t1 1044.6  t3 1429.9  t5 1861.0  t8 3023.5  weighted 1585.3
 *   lw_melee    t1  876.2  t3 1045.1  t5 1173.2  t8 1465.5  weighted 1055.6
 *   hawk_melee  t1  941.0  t3 1087.1  t5 1216.2  t8 1523.6  weighted 1111.6
 *
 * THE MELEE WEAVE CANNOT RUN ON A DUAL-WIELD BUILD, and that is a property of
 * the STYLE rather than of a list: `melee_weave` is refused unless the ranged
 * auto-attack is the active one, `return_to_range` unless the character holds a
 * swinging bow -- and the `dual_wield` style makes the bow a stat stick
 * (`rangedSlot: 'none'`). So a "melee weave" for LW Melee or Hawk Melee means
 * the `ranged` style with the two axes held (which round 65 made swingable
 * during a weave). That is a WEAPON STYLE change and is priced as a question
 * (`h80lwmWeave`, `h80hwkWeave`).
 *
 * Every group carries a control labelled "the shipped ...". GROUPS UP TO THE
 * "fourth pass" WERE MEASURED AGAINST THE ROUND 79 PRESETS; the round 80 ones
 * ship their winners, so a "K" reference row re-applied today double-applies.
 * The results are in docs/handoff/hunter.md, round 80.
 * ==============================================================================
 */
import {
  type Apply,
  type Variant,
  HUNTER_TREE as tree,
  addAbove,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  multiList,
  addEntry,
  removeEntry,
} from '../buildVariants';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  fightElapsed,
  resource,
  resourceFraction,
  selfTime,
  targetCount,
  targetMissing,
  targetTime,
} from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character';
import type { CharacterProfile } from '../../src/profiles';
import { foreverEnchantId as ench } from '../../src/game/items/foreverEnchants';

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

/* ---------------------------------------------------------------- helpers */

const weave = (options: readonly string[]): AplEntry => ({ abilityId: 'melee_weave', weave: options });
const andCond = (e: AplEntry, c: AplCondition): AplEntry => ({ ...e, condition: e.condition ? all(e.condition, c) : c });

const insertAbove = (entries: readonly AplEntry[], entry: AplEntry, beforeId: string): AplEntry[] => {
  const at = entries.findIndex((e) => e.abilityId === beforeId);
  if (at < 0) throw new Error(`no entry for ${beforeId}`);
  return [...entries.slice(0, at), entry, ...entries.slice(at)];
};
const insertBelow = (entries: readonly AplEntry[], entry: AplEntry, afterId: string): AplEntry[] => {
  const at = entries.findIndex((e) => e.abilityId === afterId);
  if (at < 0) throw new Error(`no entry for ${afterId}`);
  return [...entries.slice(0, at + 1), entry, ...entries.slice(at + 1)];
};

/** An entry for `id`, edited in place; throws when the list has none. */
const editEntry = (id: string, edit: (entry: AplEntry) => AplEntry): Apply =>
  apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === id);
    if (at < 0) throw new Error(`no entry for ${id}`);
    entries[at] = edit(entries[at]);
    return entries;
  });

const race = (id: RaceId): Variant => ({
  label: `race ${id}`,
  apply: (p) => ({ ...p, character: { ...p.character, race: id } }),
});
const raceApply = (id: RaceId): Apply => race(id).apply;
const HORDE_HUNTER_RACES: readonly RaceId[] = ['orc', 'tauren', 'troll', 'windshaper_skyborne'];

/** Edit the Multi Target section's list in place. */
const multi = (edit: (entries: AplEntry[]) => AplEntry[]): Apply => inMulti(apl(edit));

/* ---------------------------------------------------------- the potions */

/*
 * THE TWO POTIONS (round 79's rule). The stock lists carry the shared
 * `major_mana_potion` entry at 30% mana; selecting the Secondary row puts it in
 * the book. `manaPotionGate` re-gates it: under `fraction` mana AND past
 * `elapsed` seconds. The frenzy potion is the head of the cooldown stack.
 */
const SECONDARY_MANA = consumable('potion_secondary', 'secondary_major_mana_potion');
const manaPotionGate = (fraction: number, elapsed: number): Apply => {
  const gate = (e: AplEntry): AplEntry => ({
    ...e,
    condition:
      elapsed > 0
        ? all(resourceFraction('below', fraction, 'mana'), fightElapsed('above', elapsed))
        : resourceFraction('below', fraction, 'mana'),
  });
  return apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === 'major_mana_potion');
    if (at >= 0) {
      entries[at] = gate(entries[at]);
      return entries;
    }
    // A narrowed stored list carries no entry: put one above the cooldown stack.
    const stack = entries.findIndex((e) => e.sequence !== undefined);
    const where = stack >= 0 ? stack : entries.findIndex((e) => e.abilityId === 'hunters_mark');
    if (where < 0) throw new Error('nowhere to put the mana potion');
    return [...entries.slice(0, where), gate({ abilityId: 'major_mana_potion' }), ...entries.slice(where)];
  });
};
const manaPotionGateMulti = (fraction: number, elapsed: number): Apply =>
  inMulti(manaPotionGate(fraction, elapsed));

/** Lead the cooldown stack by its first cooldown and drop the frenzy potion from it (one list). */
const stackWithoutFrenzy = apl((entries) =>
  entries.map((e) =>
    e.abilityId === 'major_frenzy_potion' && e.sequence
      ? { ...e, abilityId: e.sequence[0], sequence: e.sequence.slice(1) }
      : e,
  ),
);
/** The frenzy potion held until a mana potion can no longer be wanted -- the stack keeps the cooldowns. */
const stackFrenzyLast = apl((entries) => {
  const out: AplEntry[] = [];
  for (const e of entries) {
    if (e.abilityId === 'major_frenzy_potion' && e.sequence) {
      out.push({ ...e, abilityId: e.sequence[0], sequence: e.sequence.slice(1) });
    } else out.push(e);
  }
  return out;
});

/* -------------------------------------------------------------- the trees */

const BM = {
  deadly_aspects: 5,
  endurance_training: 3,
  focused_fire: 2,
  bestial_swiftness: 1,
  unleashed_fury: 5,
  ferocity: 5,
  summon_hawk: 1,
  intimidation: 1,
  bestial_discipline: 2,
  frenzy: 5,
  bestial_wrath: 1,
};
const BM_MM = { lethal_attacks: 5, improved_stings: 2, efficiency: 3, careful_aim: 5, mortal_shots: 5 };

const LWR_BASE = {
  deadly_aspects: 5,
  lethal_attacks: 5,
  careful_aim: 5,
  lone_wolf: 1,
  trueshot_aura: 1,
  mortal_shots: 5,
  ranged_weapon_specialization: 5,
  sniper_shot: 1,
  improved_tracking: 5,
};
// + improved_stings 3, efficiency 3, rapid_killing 2, improved_arcane_shot 5, rapid_recuperation 2, barrage 3

const LWM = {
  deadly_aspects: 5,
  lethal_attacks: 5,
  careful_aim: 5,
  lone_wolf: 1,
  improved_tracking: 5,
  savage_strikes: 2,
  surefooted: 3,
  deterrence: 1,
  predator_s_edge: 5,
  resourcefulness: 2,
  expose_prey: 2,
  clever_traps: 2,
  strider_kick: 1,
  lightning_reflexes: 5,
  lacerating_strikes: 1,
};
// + rapid_killing 2, survivalist 4

const HWK = {
  deadly_aspects: 5,
  improved_aspect_of_the_monkey: 3,
  pathfinding: 2,
  unleashed_fury: 5,
  summon_hawk: 1,
  lethal_attacks: 5,
  careful_aim: 5,
  lone_wolf: 1,
  improved_tracking: 5,
  savage_strikes: 2,
  survivalist: 3,
  clever_traps: 2,
  surefooted: 3,
  predator_s_edge: 5,
  expose_prey: 2,
  strider_kick: 1,
};
// + resourcefulness 1

/* -------------------------------------- the melee weave, in the ranged style */

/*
 * A MELEE BUILD AT RANGE, WEAVING IN. The style becomes `ranged` (the bow
 * swings, the two axes are held and swing during a weave); the pre-combat
 * Start Auto-attack becomes the ranged one; the combat list keeps everything
 * the stock list puts up to Hunter's Mark and then runs:
 *
 *   Melee Weave (options) > [extra ranged entries]
 *
 * (question) -- a weapon-style change.
 */
const rangedOpener = (aspect: string, precombat: CharacterProfile['precombat']) =>
  (precombat ?? [])
    .filter((a) => !a.abilityId.startsWith('start_auto_attack') && a.abilityId !== 'raptor_strike' && a.abilityId !== 'strider_kick')
    .map((a) => (a.abilityId === 'aspect_of_the_beast' ? { ...a, abilityId: aspect } : a))
    .concat([{ abilityId: 'start_auto_attack_ranged', secondsBefore: 0 }]);
const toRangedStyle = (aspect: 'aspect_of_the_hawk' | 'aspect_of_the_beast'): Apply => (p) => ({
  ...p,
  character: { ...p.character, combatStyle: 'ranged' },
  precombat: rangedOpener(aspect, p.precombat),
  ...(p.multiTarget
    ? { multiTarget: { ...p.multiTarget, precombat: rangedOpener(aspect, p.multiTarget.precombat ?? p.precombat) } }
    : {}),
});

const weaveList = (
  aspect: 'aspect_of_the_hawk' | 'aspect_of_the_beast',
  options: readonly string[],
  tail: readonly AplEntry[],
  head?: readonly AplEntry[],
): Apply =>
  apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === 'hunters_mark');
    if (at < 0) throw new Error('no hunters_mark');
    const top = entries
      .slice(0, at + 1)
      .map((e) => (e.abilityId === 'aspect_of_the_beast' ? { ...e, abilityId: aspect, condition: selfTime('atMost', 0, aspect) } : e));
    return [...top, ...(head ?? []), weave(options), ...tail];
  });

const ALL_OPTIONS = ['strider_kick', 'mongoose_bite', 'immolation_trap'];
const RANGED_FILL: readonly AplEntry[] = [
  { abilityId: 'serpent_sting', condition: targetMissing('serpent_sting') },
  { abilityId: 'arcane_shot' },
];

const weaveVariants = (who: string, hawk: boolean): Variant[] => {
  const hawkEntry: AplEntry[] = hawk ? [{ abilityId: 'summon_hawk', condition: { kind: 'builtin', id: 'hawks_below_cap' } as AplCondition }] : [];
  return [
    {
      label: `${who} (question): ranged style, Hawk, Weave(SK/MB/IT) > Sting > Arcane`,
      apply: chain(toRangedStyle('aspect_of_the_hawk'), weaveList('aspect_of_the_hawk', ALL_OPTIONS, [...RANGED_FILL, ...hawkEntry])),
    },
    {
      label: `${who} (question): ranged style, Beast, Weave(SK/MB/IT) > Sting > Arcane`,
      apply: chain(toRangedStyle('aspect_of_the_beast'), weaveList('aspect_of_the_beast', ALL_OPTIONS, [...RANGED_FILL, ...hawkEntry])),
    },
    {
      label: `${who} (question): ranged style, Hawk, Weave(SK/MB/IT) only`,
      apply: chain(toRangedStyle('aspect_of_the_hawk'), weaveList('aspect_of_the_hawk', ALL_OPTIONS, hawkEntry)),
    },
    {
      label: `${who} (question): ranged style, Hawk, Sting > Weave > Arcane`,
      apply: chain(
        toRangedStyle('aspect_of_the_hawk'),
        weaveList('aspect_of_the_hawk', ALL_OPTIONS, [{ abilityId: 'arcane_shot' }, ...hawkEntry], [RANGED_FILL[0]]),
      ),
    },
    {
      label: `${who} (control check): Melee Weave entry added to the dual-wield list`,
      apply: addAbove(weave(ALL_OPTIONS), 'raptor_strike'),
    },
  ];
};

/*
 * THE DUAL-WIELD MULTI TARGET LIST with Volley and the other AoE shots. The
 * shipped section is the Single Target list with Explosive Trap in Immolation
 * Trap's place, above Raptor Strike. Volley is a 6 s channel with NO cooldown,
 * so ungated it is a floor; Multi-Shot reads the ranged weapon, which the
 * dual-wield style does not swing.
 */
const STING: AplEntry = { abilityId: 'serpent_sting', condition: targetMissing('serpent_sting') };
const HAWK: AplEntry = { abilityId: 'summon_hawk', condition: { kind: 'builtin', id: 'hawks_below_cap' } as AplCondition };
const VOLLEY: AplEntry = { abilityId: 'volley' };
const volleyMana = (floor: number): AplEntry => ({ abilityId: 'volley', condition: resource('atLeast', floor, 'mana') });
const STING_MD3: AplEntry = { abilityId: 'serpent_sting', multiDot: 3 };
function meleeAoeVariants(who: string): Variant[] {
  return [
    control(`${who} Multi Target section`),
    { label: `${who}5: + Volley above Wing Clip`, apply: multi((e) => insertAbove(e, VOLLEY, 'wing_clip')) },
    { label: `${who}5: + Volley above Strider Kick`, apply: multi((e) => insertAbove(e, VOLLEY, 'strider_kick')) },
    { label: `${who}5: + Volley above Raptor Strike`, apply: multi((e) => insertAbove(e, VOLLEY, 'raptor_strike')) },
    { label: `${who}5: + Volley above Explosive Trap`, apply: multi((e) => insertAbove(e, VOLLEY, 'explosive_trap')) },
    { label: `${who}5: + Volley (mana >= 1500) above Explosive Trap`, apply: multi((e) => insertAbove(e, volleyMana(1500), 'explosive_trap')) },
    { label: `${who}5: + Multi-Shot above Raptor Strike`, apply: multi((e) => insertAbove(e, { abilityId: 'multi_shot' }, 'raptor_strike')) },
    { label: `${who}5: + Serpent Sting Multi-DoT 3 above Raptor Strike`, apply: multi((e) => insertAbove(e, STING_MD3, 'raptor_strike')) },
    { label: `${who}5 (question): + Immolation Trap below Explosive (both traps)`, apply: multi((e) => insertBelow(e, { abilityId: 'immolation_trap' }, 'explosive_trap')) },
  ];
}

/** Gate an entry on a mana floor, ANDed with whatever condition it had. */
const manaFloor = (id: string, floor: number): Apply =>
  editEntry(id, (e) => andCond(e, resource('atLeast', floor, 'mana')));

/*
 * THE RANGED MULTI TARGET LIST. Shipped (round 78): Weave(Explosive) >
 * Volley from six targets > Sting MD3 up to five / boss above > [hawk] >
 * Multi-Shot > Aimed > Arcane > Volley (BM) | Multi-Shot > Volley > Aimed >
 * Arcane > Sniper (LWR).
 */
function rangedAoeVariants(who: string): Variant[] {
  const volleyGate = (n: number): Apply =>
    multi((e) => e.map((x) => (x.abilityId === 'volley' && x.condition ? { ...x, condition: targetCount('atLeast', n) } : x)));
  return [
    control(`${who} Multi Target section`),
    { label: `${who}5: the early Volley from 4 targets`, apply: volleyGate(4) },
    { label: `${who}5: the early Volley from 5 targets`, apply: volleyGate(5) },
    { label: `${who}5: the early Volley from 7 targets`, apply: volleyGate(7) },
    { label: `${who}5: Multi-Shot above the sting`, apply: multi((e) => { const m = e.find((x) => x.abilityId === 'multi_shot')!; const rest = e.filter((x) => x !== m); return insertAbove(rest, m, 'serpent_sting'); }) },
    { label: `${who}5: Multi-Shot above the Weave`, apply: multi((e) => { const m = e.find((x) => x.abilityId === 'multi_shot')!; const rest = e.filter((x) => x !== m); return insertAbove(rest, m, 'melee_weave'); }) },
    { label: `${who}5 (question): Weave(Explosive, Immolation) -- both traps`, apply: multi((e) => e.map((x) => (x.abilityId === 'melee_weave' ? { ...x, weave: ['explosive_trap', 'immolation_trap'] } : x))) },
    { label: `${who}5: Sting Multi-DoT 5 up to five`, apply: multi((e) => e.map((x) => (x.abilityId === 'serpent_sting' && x.multiDot ? { ...x, multiDot: 5 } : x))) },
    { label: `${who}5: Sting Multi-DoT removed (boss only everywhere)`, apply: multi((e) => e.filter((x) => !(x.abilityId === 'serpent_sting' && x.multiDot)).map((x) => (x.abilityId === 'serpent_sting' ? { ...x, condition: targetMissing('serpent_sting') } : x))) },
  ];
}

/*
 * THE TWO POTIONS. P1/P2 put the mana potion on the Secondary row and keep the
 * frenzy at the pull in both lists; P3-P5 take the frenzy OUT of the Single
 * Target stack (so the potion cooldown is free for mana) and keep it in Multi.
 */
function potionVariants(who: string, ranged: boolean): Variant[] {
  const out: Variant[] = [
    control(`${who} potions (Frenzy only)`),
    { label: `${who}: + Secondary Major Mana Potion, stock 30% gate`, apply: SECONDARY_MANA },
    { label: `${who}: + Secondary Major Mana, <50% and >60 s, both lists`, apply: chain(SECONDARY_MANA, manaPotionGate(0.5, 60), manaPotionGateMulti(0.5, 60)) },
  ];
  if (ranged) {
    for (const [f, t] of [[0.5, 60], [0.3, 0], [0.4, 30], [0.5, 30], [0.6, 45], [0.2, 0]] as const) {
      out.push({
        label: `${who}: ST mana potion instead of frenzy, <${f * 100}% and >${t} s (Multi keeps frenzy)`,
        apply: chain(SECONDARY_MANA, stackWithoutFrenzy, manaPotionGate(f, t), manaPotionGateMulti(0.5, 60)),
      });
    }
  }
  return out;
}

/*
 * THE WEAVE SWEEPS (question rows -- a weapon-style change). The base is the
 * best first-pass shape: ranged style, Aspect of the Hawk, Weave(SK/MB/IT) >
 * Serpent Sting > Arcane Shot [> Summon Hawk].
 */
const weaveSt = (_who: string, hawk: boolean, options: readonly string[], tail?: readonly AplEntry[]): Apply => {
  const hawkEntry: AplEntry[] = hawk ? [HAWK] : [];
  return chain(toRangedStyle('aspect_of_the_hawk'), weaveList('aspect_of_the_hawk', options, tail ?? [...RANGED_FILL, ...hawkEntry]));
};
function weaveSweep(who: string, hawk: boolean): Variant[] {
  const h: AplEntry[] = hawk ? [HAWK] : [];
  const base = weaveSt(who, hawk, ALL_OPTIONS);
  return [
    control(`${who} dual-wield list`),
    { label: `${who}: W0 Weave(SK, MB, IT) > Sting > Arcane`, apply: base },
    { label: `${who}: W1 Weave(MB, SK, IT)`, apply: weaveSt(who, hawk, ['mongoose_bite', 'strider_kick', 'immolation_trap']) },
    { label: `${who}: W2 Weave(IT, SK, MB)`, apply: weaveSt(who, hawk, ['immolation_trap', 'strider_kick', 'mongoose_bite']) },
    { label: `${who}: W3 Weave(SK, MB) -- no trap`, apply: weaveSt(who, hawk, ['strider_kick', 'mongoose_bite']) },
    { label: `${who}: W4 W0 + Multi-Shot after Arcane`, apply: weaveSt(who, hawk, ALL_OPTIONS, [...RANGED_FILL, { abilityId: 'multi_shot' }, ...h]) },
    { label: `${who}: W5 W0 + Aimed Shot after Arcane`, apply: weaveSt(who, hawk, ALL_OPTIONS, [...RANGED_FILL, { abilityId: 'aimed_shot' }, ...h]) },
    { label: `${who}: W6 W0, Arcane above Sting`, apply: weaveSt(who, hawk, ALL_OPTIONS, [RANGED_FILL[1], RANGED_FILL[0], ...h]) },
    { label: `${who}: W7 W0 without the sting`, apply: weaveSt(who, hawk, ALL_OPTIONS, [RANGED_FILL[1], ...h]) },
    { label: `${who}: W8 W0 + Wing Clip as a fourth option`, apply: weaveSt(who, hawk, [...ALL_OPTIONS, 'wing_clip']) },
    ...(hawk ? [{ label: `${who}: W9 W0, Summon Hawk above the Weave`, apply: chain(base, moveAbove('summon_hawk', 'melee_weave')) }] : []),
  ];
}

/** The ranged-style melee Multi Target list: Weave(Explosive first) and the AoE shots. */
const weaveAoe = (hawk: boolean, body: readonly AplEntry[]): Apply =>
  (p) => {
    const st = weaveSt('', hawk, ALL_OPTIONS)(p);
    return inMulti(
      apl((entries) => {
        const at = entries.findIndex((e) => e.abilityId === 'hunters_mark');
        const top = entries
          .slice(0, at + 1)
          .map((e) => (e.abilityId === 'aspect_of_the_beast' ? { ...e, abilityId: 'aspect_of_the_hawk', condition: selfTime('atMost', 0, 'aspect_of_the_hawk') } : e));
        return [...top, ...body];
      }),
    )(st);
  };
function weaveAoeSweep(who: string, hawk: boolean): Variant[] {
  const h: AplEntry[] = hawk ? [HAWK] : [];
  const W: AplEntry = weave(['explosive_trap', 'strider_kick', 'mongoose_bite']);
  const md3: AplEntry = { abilityId: 'serpent_sting', multiDot: 3 };
  const MS: AplEntry = { abilityId: 'multi_shot' };
  const AR: AplEntry = { abilityId: 'arcane_shot' };
  return [
    control(`${who} dual-wield Multi Target section`),
    { label: `${who}5: A0 ST weave list only (no AoE changes)`, apply: weaveSt(who, hawk, ALL_OPTIONS) },
    { label: `${who}5: A1 Weave(ET,SK,MB) > Sting MD3 > Multi > Arcane > Volley`, apply: weaveAoe(hawk, [W, md3, ...h, MS, AR, VOLLEY]) },
    { label: `${who}5: A2 Weave > Sting MD3 > Multi > Volley > Arcane`, apply: weaveAoe(hawk, [W, md3, ...h, MS, VOLLEY, AR]) },
    { label: `${who}5: A3 Weave > Volley > Sting MD3 > Multi > Arcane`, apply: weaveAoe(hawk, [W, VOLLEY, md3, ...h, MS, AR]) },
    { label: `${who}5: A4 Volley > Weave > Sting MD3 > Multi > Arcane`, apply: weaveAoe(hawk, [VOLLEY, W, md3, ...h, MS, AR]) },
    { label: `${who}5: A5 Weave > Multi > Sting MD3 > Volley > Arcane`, apply: weaveAoe(hawk, [W, MS, md3, ...h, VOLLEY, AR]) },
    { label: `${who}5: A6 Weave > Sting MD3 > Multi > Volley (mana>=1000) > Arcane`, apply: weaveAoe(hawk, [W, md3, ...h, MS, volleyMana(1000), AR]) },
  ];
}

const ARCANE: AplEntry = { abilityId: 'arcane_shot' };
function meleeStCombos(who: string, hawk: boolean): Variant[] {
  const base = [
    control(`${who} Single Target list`),
    { label: `${who}: C1 Sting above Raptor + Arcane above Immolation Trap`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'immolation_trap')) },
    { label: `${who}: C2 Sting above Raptor + Arcane above Wing Clip`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'wing_clip')) },
    { label: `${who}: C3 Sting + Arcane above Wing Clip`, apply: chain(addAbove(STING, 'wing_clip'), addAbove(ARCANE, 'wing_clip')) },
    { label: `${who}: C4 Sting above Raptor + Arcane above Raptor`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'raptor_strike')) },
    { label: `${who}: C5 Sting + Arcane above Immolation Trap`, apply: chain(addAbove(STING, 'immolation_trap'), addAbove(ARCANE, 'immolation_trap')) },
    { label: `${who}: C6 C1 + Aimed Shot above Wing Clip`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'immolation_trap'), addAbove({ abilityId: 'aimed_shot' }, 'wing_clip')) },
    { label: `${who}: C7 C1 + Multi-Shot above Wing Clip`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'immolation_trap'), addAbove({ abilityId: 'multi_shot' }, 'wing_clip')) },
  ];
  if (hawk) {
    base.push({ label: `${who}: C8 C1 with Arcane above Summon Hawk`, apply: chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'summon_hawk')) });
  }
  return base;
}
function weaveCombos(who: string, hawk: boolean): Variant[] {
  const h: AplEntry[] = hawk ? [HAWK] : [];
  const AIM: AplEntry = { abilityId: 'aimed_shot' };
  const MS: AplEntry = { abilityId: 'multi_shot' };
  const O4 = [...ALL_OPTIONS, 'wing_clip'];
  return [
    control(`${who} dual-wield list`),
    { label: `${who}: X1 Weave(+WC) > Sting > Arcane > Aimed > Multi`, apply: weaveSt(who, hawk, O4, [...RANGED_FILL, AIM, MS, ...h]) },
    { label: `${who}: X2 Weave(+WC) > Arcane > Sting > Aimed > Multi`, apply: weaveSt(who, hawk, O4, [RANGED_FILL[1], RANGED_FILL[0], AIM, MS, ...h]) },
    { label: `${who}: X3 Weave(+WC) > Sting > Aimed > Arcane > Multi`, apply: weaveSt(who, hawk, O4, [RANGED_FILL[0], AIM, RANGED_FILL[1], MS, ...h]) },
    { label: `${who}: X4 Weave(+WC) > Sting > Arcane > Multi > Aimed`, apply: weaveSt(who, hawk, O4, [...RANGED_FILL, MS, AIM, ...h]) },
    { label: `${who}: X5 X1, hawk above the weave`, apply: weaveSt(who, hawk, O4, [...RANGED_FILL, AIM, MS, ...h]) },
    { label: `${who}: X6 Sting > Weave(+WC) > Arcane > Aimed > Multi`, apply: chain(toRangedStyle('aspect_of_the_hawk'), weaveList('aspect_of_the_hawk', O4, [RANGED_FILL[1], AIM, MS, ...h], [RANGED_FILL[0]])) },
  ].map((v, i) => (hawk && i === 5 ? { ...v, apply: chain(v.apply, moveAbove('summon_hawk', 'melee_weave')) } : v));
}

const LWR_MD = (n: number): Apply =>
  multi((e) => e.map((x) => (x.abilityId === 'serpent_sting' && x.multiDot ? { ...x, multiDot: n } : x)));
const LWR_MS_UP: Apply = multi((e) => {
  const m = e.find((x) => x.abilityId === 'multi_shot')!;
  return insertAbove(e.filter((x) => x !== m), m, 'serpent_sting');
});
/** Volley above Raptor Strike in the dual-wield Multi Target list, with what goes with it. */
const DW_VOLLEY = (v: AplEntry = VOLLEY): Apply => multi((e) => insertAbove(e, v, 'raptor_strike'));
function meleeAoe2(who: string): Variant[] {
  return [
    control(`${who} Multi Target section`),
    { label: `${who}5: V1 Volley above Raptor`, apply: DW_VOLLEY() },
    { label: `${who}5: V2 Volley above Mongoose (below Raptor)`, apply: multi((e) => insertAbove(e, VOLLEY, 'mongoose_bite')) },
    { label: `${who}5: V3 V1 + Arcane above Wing Clip`, apply: chain(DW_VOLLEY(), multi((e) => insertAbove(e, ARCANE, 'wing_clip'))) },
    { label: `${who}5: V4 V1 + Sting (boss) above Raptor`, apply: chain(DW_VOLLEY(), multi((e) => insertAbove(e, STING, 'raptor_strike'))) },
    { label: `${who}5: V5 V1 + Sting (boss) above Volley`, apply: chain(DW_VOLLEY(), multi((e) => insertAbove(e, STING, 'volley'))) },
    { label: `${who}5: V6 V1, Volley at mana >= 1000`, apply: DW_VOLLEY(volleyMana(1000)) },
    { label: `${who}5: V7 V1, Volley at mana >= 2000`, apply: DW_VOLLEY(volleyMana(2000)) },
    { label: `${who}5: V8 V1 + Arcane above Raptor (above Volley)`, apply: chain(DW_VOLLEY(), multi((e) => insertAbove(e, ARCANE, 'volley'))) },
    { label: `${who}5: V9 V3 + V4`, apply: chain(DW_VOLLEY(), multi((e) => insertAbove(e, ARCANE, 'wing_clip')), multi((e) => insertAbove(e, STING, 'raptor_strike'))) },
  ];
}

/* ------------------------------------------------- the round's candidates */
const BM_TREE = tree({ ...BM, ...BM_MM, improved_stings: 3, efficiency: 2 });
const BM_ST = chain(moveAbove('summon_hawk', 'melee_weave'), moveAbove('arcane_shot', 'aimed_shot'));
const LWR_TREE = tree({ ...LWR_BASE, improved_stings: 3, efficiency: 5, rapid_killing: 2, improved_arcane_shot: 3, rapid_recuperation: 2, barrage: 3 });
const LWR_ST = chain(manaFloor('sniper_shot', 2500), addAbove({ abilityId: 'multi_shot' }, 'sniper_shot'));
const LWR_AOE = chain(
  LWR_MD(5),
  multi((e) => insertAbove(e, { abilityId: 'multi_shot', condition: targetCount('atMost', 3) }, 'serpent_sting')),
);
const LWM_ST = chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'raptor_strike'));
const HWK_ST = chain(addAbove(STING, 'raptor_strike'), addAbove(ARCANE, 'wing_clip'));
const STING_UPTO3 = andCond(STING, targetCount('atMost', 3));
const VOLLEY_FROM4: AplEntry = { abilityId: 'volley', condition: targetCount('atLeast', 4) };
const LWM_AOE_A = chain(DW_VOLLEY(), multi((e) => insertAbove(e, STING_UPTO3, 'volley')));
const LWM_AOE_C = chain(DW_VOLLEY(), multi((e) => insertAbove(e, STING, 'volley')));
const LWM_AOE_D = chain(DW_VOLLEY(VOLLEY_FROM4), multi((e) => insertAbove(e, STING_UPTO3, 'volley')));
const HWK_AOE_A = DW_VOLLEY(VOLLEY_FROM4);
const HWK_AOE_B = chain(
  DW_VOLLEY(VOLLEY_FROM4),
  multi((e) => insertAbove(e, STING, 'raptor_strike')),
  multi((e) => insertAbove(e, ARCANE, 'wing_clip')),
);

const LWM_K = chain(LWM_ST, LWM_AOE_A);
const HWK_K = chain(HWK_ST, HWK_AOE_B);
/** The A3 weave Multi Target body, applied to the multi section of an already ranged-style profile. */
const weaveAoeBody = (hawk: boolean): Apply => {
  const h: AplEntry[] = hawk ? [HAWK] : [];
  const W: AplEntry = weave(['explosive_trap', 'strider_kick', 'mongoose_bite']);
  return inMulti(
    apl((entries) => {
      const at = entries.findIndex((e) => e.abilityId === 'hunters_mark');
      const top = entries
        .slice(0, at + 1)
        .map((e) => (e.abilityId === 'aspect_of_the_beast' ? { ...e, abilityId: 'aspect_of_the_hawk', condition: selfTime('atMost', 0, 'aspect_of_the_hawk') } : e));
      return [...top, W, VOLLEY, { abilityId: 'serpent_sting', multiDot: 3 }, ...h, { abilityId: 'multi_shot' }, ARCANE];
    }),
  );
};

/* ----------------------------------------------------------------- groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ------------------------------------------------------- the races */
  h80bmRace: [control('BM race (High Order Skyborne)'), ...HORDE_HUNTER_RACES.map(race)],
  h80lwrRace: [control('LW Ranged race (High Order Skyborne)'), ...HORDE_HUNTER_RACES.map(race)],
  h80lwmRace: [control('LW Melee race (Orc)'), ...HORDE_HUNTER_RACES.filter((r) => r !== 'orc').map(race)],
  h80hwkRace: [control('Hawk Melee race (Orc)'), ...HORDE_HUNTER_RACES.filter((r) => r !== 'orc').map(race)],

  /* -------------------------------------------------- the melee weave */
  h80lwmWeave: [control('LW Melee list (dual wield)'), ...weaveVariants('LWM', false)],
  h80hwkWeave: [control('Hawk Melee list (dual wield)'), ...weaveVariants('HWK', true)],

  /* ------------------------------------------------------- talents (WEIGHTED=1) */
  h80bmTalents: [
    control('BM tree'),
    { label: 'BM: Efficiency 3 + Stings 2 -> Improved Tracking 5', apply: tree({ ...BM, lethal_attacks: 5, careful_aim: 5, mortal_shots: 5, improved_tracking: 5 }) },
    { label: 'BM: Mortal Shots 5 -> Improved Tracking 5', apply: tree({ ...BM, ...BM_MM, mortal_shots: 0, improved_tracking: 5 }) },
    { label: 'BM: Stings 2 -> Improved Tracking 2', apply: tree({ ...BM, ...BM_MM, improved_stings: 0, improved_tracking: 2 }) },
    { label: 'BM: Efficiency 3 -> Improved Tracking 3', apply: tree({ ...BM, ...BM_MM, efficiency: 0, improved_tracking: 3 }) },
    { label: 'BM: Stings 2 + Efficiency 3 -> Stings 3 + Efficiency 2', apply: tree({ ...BM, ...BM_MM, improved_stings: 3, efficiency: 2 }) },
    { label: 'BM: Efficiency 3 -> Efficiency 5, Stings 0', apply: tree({ ...BM, ...BM_MM, improved_stings: 0, efficiency: 5 }) },
  ],
  h80lwrTalents: [
    control('LW Ranged tree'),
    { label: 'LWR: Imp Arcane 5 -> 3, Efficiency 3 -> 5', apply: tree({ ...LWR_BASE, improved_stings: 3, efficiency: 5, rapid_killing: 2, improved_arcane_shot: 3, rapid_recuperation: 2, barrage: 3 }) },
    { label: 'LWR: Stings 3 -> 1, Efficiency 3 -> 5', apply: tree({ ...LWR_BASE, improved_stings: 1, efficiency: 5, rapid_killing: 2, improved_arcane_shot: 5, rapid_recuperation: 2, barrage: 3 }) },
    { label: 'LWR: Barrage 3 -> 1, Efficiency 3 -> 5', apply: tree({ ...LWR_BASE, improved_stings: 3, efficiency: 5, rapid_killing: 2, improved_arcane_shot: 5, rapid_recuperation: 2, barrage: 1 }) },
    { label: 'LWR: Imp Arcane 5 -> 2, Efficiency 3 -> 5, + Hawk Eye 1', apply: tree({ ...LWR_BASE, improved_stings: 3, efficiency: 5, rapid_killing: 2, improved_arcane_shot: 2, rapid_recuperation: 2, barrage: 3, hawk_eye: 1 }) },
  ],
  h80lwmTalents: [
    control('LW Melee tree'),
    { label: 'LWM: Rapid Killing 2 -> Efficiency 2', apply: tree({ ...LWM, efficiency: 2, survivalist: 4 }) },
    { label: 'LWM: Rapid Killing 2 -> Improved Stings 2', apply: tree({ ...LWM, improved_stings: 2, survivalist: 4 }) },
    { label: 'LWM: Rapid Killing 2 -> Improved Arcane Shot 2', apply: tree({ ...LWM, improved_arcane_shot: 2, survivalist: 4 }) },
    { label: 'LWM: Rapid Killing 2 + Survivalist 2 -> Efficiency 4', apply: tree({ ...LWM, efficiency: 4, survivalist: 2 }) },
    { label: 'LWM: Rapid Killing 2 + Survivalist 2 -> Efficiency 2 + Stings 2', apply: tree({ ...LWM, efficiency: 2, improved_stings: 2, survivalist: 2 }) },
  ],
  h80hwkTalents: [
    control('Hawk Melee tree'),
    { label: 'HWK: Resourcefulness 1 -> Efficiency 1', apply: tree({ ...HWK, efficiency: 1 }) },
    { label: 'HWK: Resourcefulness 1 -> Improved Stings 1', apply: tree({ ...HWK, improved_stings: 1 }) },
  ],

  /* ------------------------------------------ Single Target, dual-wield melee */
  h80lwmApl: [
    control('LW Melee Single Target list'),
    { label: 'LWM: + Arcane Shot above Wing Clip', apply: addAbove({ abilityId: 'arcane_shot' }, 'wing_clip') },
    { label: 'LWM: + Arcane Shot above Immolation Trap', apply: addAbove({ abilityId: 'arcane_shot' }, 'immolation_trap') },
    { label: 'LWM: + Arcane Shot above Raptor Strike', apply: addAbove({ abilityId: 'arcane_shot' }, 'raptor_strike') },
    { label: 'LWM: + Serpent Sting above Wing Clip', apply: addAbove(STING, 'wing_clip') },
    { label: 'LWM: + Serpent Sting above Raptor Strike', apply: addAbove(STING, 'raptor_strike') },
    { label: 'LWM: + Serpent Sting and Arcane Shot above Wing Clip', apply: chain(addAbove(STING, 'wing_clip'), addAbove({ abilityId: 'arcane_shot' }, 'wing_clip')) },
  ],
  h80hwkApl: [
    control('Hawk Melee Single Target list'),
    { label: 'HWK: + Arcane Shot above Wing Clip', apply: addAbove({ abilityId: 'arcane_shot' }, 'wing_clip') },
    { label: 'HWK: + Arcane Shot above Summon Hawk', apply: addAbove({ abilityId: 'arcane_shot' }, 'summon_hawk') },
    { label: 'HWK: + Serpent Sting above Wing Clip', apply: addAbove(STING, 'wing_clip') },
    { label: 'HWK: + Serpent Sting above Raptor Strike', apply: addAbove(STING, 'raptor_strike') },
    { label: 'HWK (question): Summon Hawk above Raptor Strike', apply: moveAbove('summon_hawk', 'raptor_strike') },
    { label: 'HWK: + a second Summon Hawk entry above Raptor Strike', apply: addAbove(HAWK, 'raptor_strike') },
  ],

  /* ------------------------------------------ Multi Target, dual-wield melee */
  h80lwmAoe: meleeAoeVariants('LWM'),
  h80hwkAoe: meleeAoeVariants('HWK'),

  /* ------------------------------------------------- Single Target, ranged */
  h80bmApl: [
    control('BM Single Target list'),
    { label: 'BM: Weave(Explosive Trap) in place of Weave(Immolation)', apply: editEntry('melee_weave', (e) => ({ ...e, weave: ['explosive_trap'] })) },
    { label: 'BM (question): Weave(Immolation, Explosive) -- both traps', apply: editEntry('melee_weave', (e) => ({ ...e, weave: ['immolation_trap', 'explosive_trap'] })) },
    { label: 'BM: Arcane Shot above Aimed Shot', apply: moveAbove('arcane_shot', 'aimed_shot') },
    { label: 'BM: + Multi-Shot above Aimed Shot', apply: addAbove({ abilityId: 'multi_shot' }, 'aimed_shot') },
    { label: 'BM: Summon Hawk above Serpent Sting', apply: moveAbove('summon_hawk', 'serpent_sting') },
    { label: 'BM: Summon Hawk above the Weave', apply: moveAbove('summon_hawk', 'melee_weave') },
    { label: 'BM: Arcane Shot mana >= 1000', apply: manaFloor('arcane_shot', 1000) },
    { label: 'BM: Arcane Shot mana >= 2000', apply: manaFloor('arcane_shot', 2000) },
    { label: 'BM: Aimed Shot mana >= 1000', apply: manaFloor('aimed_shot', 1000) },
  ],
  h80lwrApl: [
    control('LW Ranged Single Target list'),
    { label: 'LWR: Weave(Explosive Trap) in place of Weave(Immolation)', apply: editEntry('melee_weave', (e) => ({ ...e, weave: ['explosive_trap'] })) },
    { label: 'LWR (question): Weave(Immolation, Explosive) -- both traps', apply: editEntry('melee_weave', (e) => ({ ...e, weave: ['immolation_trap', 'explosive_trap'] })) },
    { label: 'LWR: Aimed Shot above Arcane Shot', apply: moveAbove('aimed_shot', 'arcane_shot') },
    { label: 'LWR: Sniper Shot above Aimed Shot', apply: moveAbove('sniper_shot', 'aimed_shot') },
    { label: 'LWR: + Multi-Shot above Sniper Shot', apply: addAbove({ abilityId: 'multi_shot' }, 'sniper_shot') },
    { label: 'LWR: Sniper Shot mana >= 1000', apply: manaFloor('sniper_shot', 1000) },
    { label: 'LWR: Sniper Shot mana >= 2000', apply: manaFloor('sniper_shot', 2000) },
    { label: 'LWR: Arcane Shot mana >= 1000', apply: manaFloor('arcane_shot', 1000) },
    { label: 'LWR: Serpent Sting above the Weave', apply: moveAbove('serpent_sting', 'melee_weave') },
  ],

  /* ---------------------------------------------- Multi Target, ranged */
  h80bmAoe: rangedAoeVariants('BM'),
  h80lwrAoe: rangedAoeVariants('LWR'),

  /* ----------------------------------------------------------- the potions */
  h80bmPotion: potionVariants('BM', true),
  h80lwrPotion: potionVariants('LWR', true),
  h80lwmPotion: potionVariants('LWM', false),
  h80hwkPotion: potionVariants('HWK', false),

  /* ---------------------------------------------- enchants (WEIGHTED=1) */
  h80rangedEnchants: [
    control('enchants'),
    { label: 'head + legs +1% Haste', apply: chain(enchant('head', ench('+1% Haste')), enchant('legs', ench('+1% Haste'))) },
    { label: 'head + legs +8 Intellect', apply: chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect'))) },
    { label: 'head + legs +8 Agility', apply: chain(enchant('head', ench('+8 Agility')), enchant('legs', ench('+8 Agility'))) },
    { label: 'gloves +1% Haste', apply: enchant('gloves', ench('+1% Haste')) },
    { label: 'wrists +9 Agility -> (is it already?)', apply: enchant('wrists', ench('+9 Agility')) },
    { label: 'Blasted Lands +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'Blasted Lands +25 Agility', apply: consumable('blasted_lands', 'blasted_agility') },
  ],
  /* ------------- the melee weave in the ranged style: sweeps and a package */
  h80lwmWeaveSt: weaveSweep('LWM', false),
  h80hwkWeaveSt: weaveSweep('HWK', true),
  h80lwmWeaveAoe: weaveAoeSweep('LWM', false),
  h80hwkWeaveAoe: weaveAoeSweep('HWK', true),

  /* ----------------------------- second pass: Single Target combinations */
  h80lwmApl2: meleeStCombos('LWM', false),
  h80hwkApl2: meleeStCombos('HWK', true),
  h80lwmWeaveSt2: weaveCombos('LWM', false),
  h80hwkWeaveSt2: weaveCombos('HWK', true),
  h80bmApl2: [
    control('BM Single Target list'),
    { label: 'BM: Summon Hawk above the Weave + Arcane above Aimed', apply: chain(moveAbove('summon_hawk', 'melee_weave'), moveAbove('arcane_shot', 'aimed_shot')) },
    { label: 'BM: Summon Hawk above the Weave', apply: moveAbove('summon_hawk', 'melee_weave') },
    { label: 'BM: Summon Hawk above Hunter Mark (top of the damage)', apply: moveAbove('summon_hawk', 'hunters_mark') },
    { label: 'BM: Arcane above Aimed + Aimed mana >= 500', apply: chain(moveAbove('arcane_shot', 'aimed_shot'), manaFloor('aimed_shot', 500)) },
  ],
  h80lwrApl2: [
    control('LW Ranged Single Target list'),
    ...[1500, 2000, 2500, 3000, 3500].map((m) => ({ label: `LWR: Sniper Shot mana >= ${m}`, apply: manaFloor('sniper_shot', m) })),
    { label: 'LWR: Sniper >= 2500 + Multi-Shot above Sniper', apply: chain(manaFloor('sniper_shot', 2500), addAbove({ abilityId: 'multi_shot' }, 'sniper_shot')) },
    { label: 'LWR: Sniper >= 2500 + Multi-Shot (>= 2500) above Sniper', apply: chain(manaFloor('sniper_shot', 2500), addAbove({ abilityId: 'multi_shot', condition: resource('atLeast', 2500, 'mana') }, 'sniper_shot')) },
  ],

  /* ----------------------------- second pass: Multi Target combinations */
  h80lwmAoe2: meleeAoe2('LWM'),
  h80hwkAoe2: meleeAoe2('HWK'),
  h80lwrAoe2: [
    control('LW Ranged Multi Target section'),
    { label: 'LWR5: Sting MD5 + Multi-Shot above the sting', apply: chain(LWR_MD(5), LWR_MS_UP) },
    { label: 'LWR5: Sting MD4 + Multi-Shot above the sting', apply: chain(LWR_MD(4), LWR_MS_UP) },
    { label: 'LWR5: Sting MD5', apply: LWR_MD(5) },
    { label: 'LWR5: Sting MD4', apply: LWR_MD(4) },
  ],

  /* ------------------------------------------- Combined (WEIGHTED=1) */
  h80bmCombined: [
    control('BM build'),
    { label: 'BM K1: Stings 3 + Efficiency 2', apply: BM_TREE },
    { label: 'BM K2: K1 + ST (hawk above weave, arcane above aimed)', apply: chain(BM_TREE, BM_ST) },
    { label: 'BM K3: K2 + Troll', apply: chain(BM_TREE, BM_ST, raceApply('troll')) },
    { label: 'BM K4: K2 + Orc', apply: chain(BM_TREE, BM_ST, raceApply('orc')) },
  ],
  h80lwrCombined: [
    control('LW Ranged build'),
    { label: 'LWR K1: Imp Arcane 3 + Efficiency 5', apply: LWR_TREE },
    { label: 'LWR K2: K1 + ST (sniper >= 2500, multi above sniper)', apply: chain(LWR_TREE, LWR_ST) },
    { label: 'LWR K3: K2 + AoE (MD5, Multi above sting at <= 3)', apply: chain(LWR_TREE, LWR_ST, LWR_AOE) },
    { label: 'LWR K4: K3 + Troll', apply: chain(LWR_TREE, LWR_ST, LWR_AOE, raceApply('troll')) },
    { label: 'LWR K5: K3 + Orc', apply: chain(LWR_TREE, LWR_ST, LWR_AOE, raceApply('orc')) },
  ],
  h80lwmCombined: [
    control('LW Melee build'),
    { label: 'LWM K1: ST Sting + Arcane above Raptor', apply: LWM_ST },
    { label: 'LWM K2: K1 + AoE Sting(<=3) > Volley above Raptor', apply: chain(LWM_ST, LWM_AOE_A) },
    { label: 'LWM K3: K1 + AoE Sting > Volley above Raptor', apply: chain(LWM_ST, LWM_AOE_C) },
    { label: 'LWM K4: K1 + AoE Volley above Raptor', apply: chain(LWM_ST, DW_VOLLEY()) },
    { label: 'LWM K5: K2 + Volley only from 4 targets', apply: chain(LWM_ST, LWM_AOE_D) },
  ],
  h80hwkCombined: [
    control('Hawk Melee build'),
    { label: 'HWK K1: ST Sting above Raptor + Arcane above Wing Clip', apply: HWK_ST },
    { label: 'HWK K2: K1 + AoE Volley (>= 4 targets) above Raptor', apply: chain(HWK_ST, HWK_AOE_A) },
    { label: 'HWK K3: K2 + AoE sting above Raptor and Arcane above Wing Clip', apply: chain(HWK_ST, HWK_AOE_B) },
    { label: 'HWK K4: K1 + AoE Volley above Raptor (ungated)', apply: chain(HWK_ST, DW_VOLLEY()) },
    { label: 'HWK K5: K1 + AoE Sting(<=3) > Volley above Raptor', apply: chain(HWK_ST, LWM_AOE_A) },
  ],

  /* ------------------------------ third pass, on the round's candidates */
  h80lwrSt3: [
    { label: 'LWR: K1 tree -- the reference', apply: LWR_TREE },
    ...[1000, 2000, 2500, 3000].map((m) => ({ label: `LWR: K1 + Sniper mana >= ${m}`, apply: chain(LWR_TREE, manaFloor('sniper_shot', m)) })),
    { label: 'LWR: K1 + Multi-Shot above Sniper', apply: chain(LWR_TREE, addAbove({ abilityId: 'multi_shot' }, 'sniper_shot')) },
    { label: 'LWR: K1 + Multi-Shot above Aimed', apply: chain(LWR_TREE, addAbove({ abilityId: 'multi_shot' }, 'aimed_shot')) },
    { label: 'LWR: K1 + Aimed above Arcane', apply: chain(LWR_TREE, moveAbove('aimed_shot', 'arcane_shot')) },
    { label: 'LWR: K1 + Sniper above Arcane', apply: chain(LWR_TREE, moveAbove('sniper_shot', 'arcane_shot')) },
  ],
  h80bmRace2: [
    { label: 'BM: K2 (High Order Skyborne) -- the reference', apply: chain(BM_TREE, BM_ST) },
    { label: 'BM: K2 + Troll', apply: chain(BM_TREE, BM_ST, raceApply('troll')) },
    { label: 'BM: K2 + Orc', apply: chain(BM_TREE, BM_ST, raceApply('orc')) },
    { label: 'BM: K2 + Windshaper Skyborne', apply: chain(BM_TREE, BM_ST, raceApply('windshaper_skyborne')) },
  ],
  h80lwrRace2: [
    { label: 'LWR: K1 (High Order Skyborne) -- the reference', apply: chain(LWR_TREE, LWR_AOE) },
    { label: 'LWR: K1 + Troll', apply: chain(LWR_TREE, LWR_AOE, raceApply('troll')) },
    { label: 'LWR: K1 + Orc', apply: chain(LWR_TREE, LWR_AOE, raceApply('orc')) },
    { label: 'LWR: K1 + Windshaper Skyborne', apply: chain(LWR_TREE, LWR_AOE, raceApply('windshaper_skyborne')) },
  ],
  h80lwmTalents3: [
    { label: 'LWM: K2 -- the reference', apply: LWM_K },
    { label: 'LWM: K2 + Rapid Killing 2 -> Efficiency 2', apply: chain(LWM_K, tree({ ...LWM, efficiency: 2, survivalist: 4 })) },
    { label: 'LWM: K2 + Rapid Killing 2 -> Improved Stings 2', apply: chain(LWM_K, tree({ ...LWM, improved_stings: 2, survivalist: 4 })) },
    { label: 'LWM: K2 + Rapid Killing 2 -> Improved Arcane Shot 2', apply: chain(LWM_K, tree({ ...LWM, improved_arcane_shot: 2, survivalist: 4 })) },
    { label: 'LWM: K2 + Rapid Killing 2 -> Improved Stings 1 + Efficiency 1', apply: chain(LWM_K, tree({ ...LWM, improved_stings: 1, efficiency: 1, survivalist: 4 })) },
  ],
  h80hwkTalents3: [
    { label: 'HWK: K3 -- the reference', apply: HWK_K },
    { label: 'HWK: K3 + Resourcefulness 1 -> Efficiency 1', apply: chain(HWK_K, tree({ ...HWK, efficiency: 1 })) },
    { label: 'HWK: K3 + Resourcefulness 1 -> Improved Stings 1', apply: chain(HWK_K, tree({ ...HWK, improved_stings: 1 })) },
  ],
  h80lwmWeavePkg: [
    { label: 'LWM: K2 (dual wield) -- the reference', apply: LWM_K },
    { label: 'LWM (question): ranged-style weave package X6 + A3', apply: chain(toRangedStyle('aspect_of_the_hawk'), weaveList('aspect_of_the_hawk', [...ALL_OPTIONS, 'wing_clip'], [RANGED_FILL[1], { abilityId: 'aimed_shot' }, { abilityId: 'multi_shot' }], [RANGED_FILL[0]]), weaveAoeBody(false)) },
  ],
  h80hwkWeavePkg: [
    { label: 'HWK: K3 (dual wield) -- the reference', apply: HWK_K },
    { label: 'HWK (question): ranged-style weave package X5 + A3', apply: chain(weaveSt('', true, [...ALL_OPTIONS, 'wing_clip'], [...RANGED_FILL, { abilityId: 'aimed_shot' }, { abilityId: 'multi_shot' }, HAWK]), moveAbove('summon_hawk', 'melee_weave'), weaveAoeBody(true)) },
  ],

  h80bmApl4: [
    control('BM Single Target list'),
    { label: 'BM: the Weave below Summon Hawk (owner order kept) + Arcane above Aimed', apply: chain(BM_TREE, apl((e) => { const w = e.find((x) => x.abilityId === 'melee_weave')!; return insertBelow(e.filter((x) => x !== w), w, 'summon_hawk'); }), moveAbove('arcane_shot', 'aimed_shot')) },
    { label: 'BM: K2 (Summon Hawk above the Weave, reorders the owner sting/hawk)', apply: chain(BM_TREE, BM_ST) },
    { label: 'BM: K1 tree only', apply: BM_TREE },
  ],
  /* ------------------ fourth pass, against the shipped round-80 presets */
  h80meleeExtra: [
    control('round 80 melee build'),
    { label: 'melee: + Serpent Sting at 0s before the pull (pure DoT)', apply: addPrecombat(0, 'serpent_sting') },
    { label: 'melee: + Volley above Wing Clip in the Single Target list', apply: addAbove(VOLLEY, 'wing_clip') },
    { label: 'melee (question): + Explosive Trap above Immolation Trap in Single Target (both traps)', apply: addAbove({ abilityId: 'explosive_trap' }, 'immolation_trap') },
    { label: 'melee: Arcane Shot gated on mana >= 1500', apply: manaFloor('arcane_shot', 1500) },
    { label: 'melee: Serpent Sting refreshed at <= 2 s (instead of when missing)', apply: editEntry('serpent_sting', (e) => ({ ...e, condition: targetTime('atMost', 2, 'serpent_sting') })) },
    { label: 'melee: Wing Clip gated on mana >= 2000', apply: manaFloor('wing_clip', 2000) },
  ],
  h80rangedExtra: [
    control('round 80 ranged build'),
    { label: 'ranged: + Serpent Sting at 0s before the pull (pure DoT)', apply: addPrecombat(0, 'serpent_sting') },
    { label: 'ranged: Serpent Sting refreshed at <= 1 s', apply: editEntry('serpent_sting', (e) => ({ ...e, condition: targetTime('atMost', 1, 'serpent_sting') })) },
    { label: 'ranged: + Volley at the bottom of Single Target', apply: addEntry(VOLLEY) },
    { label: 'ranged: Demonic Rune at 20% mana (was 10%)', apply: editEntry('demonic_rune', (e) => ({ ...e, condition: resourceFraction('atMost', 0.2, 'mana') })) },
    { label: 'ranged: Demonic Rune at 5% mana', apply: editEntry('demonic_rune', (e) => ({ ...e, condition: resourceFraction('atMost', 0.05, 'mana') })) },
  ],
  h80bmFinal: [
    control('round 80 BM build'),
    { label: 'BM: head + legs +1% Haste', apply: chain(enchant('head', ench('+1% Haste')), enchant('legs', ench('+1% Haste'))) },
    { label: 'BM: head + legs +1% Haste + Serpent Sting at 0s', apply: chain(enchant('head', ench('+1% Haste')), enchant('legs', ench('+1% Haste')), addPrecombat(0, 'serpent_sting'), inMulti(addPrecombat(0, 'serpent_sting'))) },
  ],
  h80lwrFinal: [
    control('round 80 LW Ranged build'),
    { label: 'LWR: Blasted Lands +25 Agility', apply: consumable('blasted_lands', 'blasted_agility') },
    { label: 'LWR: Blasted +25 Agility + head/legs +8 Agility', apply: chain(consumable('blasted_lands', 'blasted_agility'), enchant('head', ench('+8 Agility')), enchant('legs', ench('+8 Agility'))) },
    { label: 'LWR: Blasted +25 Agility + Serpent Sting at 0s', apply: chain(consumable('blasted_lands', 'blasted_agility'), addPrecombat(0, 'serpent_sting'), inMulti(addPrecombat(0, 'serpent_sting'))) },
    { label: 'LWR: all three', apply: chain(consumable('blasted_lands', 'blasted_agility'), enchant('head', ench('+8 Agility')), enchant('legs', ench('+8 Agility')), addPrecombat(0, 'serpent_sting'), inMulti(addPrecombat(0, 'serpent_sting'))) },
  ],
  h80meleeFinal: [
    control('round 80 melee build'),
    { label: 'melee: main hand +15 Agility', apply: enchant('mainHand', ench('+15 Agility')) },
    { label: 'melee: main hand +15 Agility + food +20 Agility', apply: chain(enchant('mainHand', ench('+15 Agility')), consumable('food', 'food_agility')) },
  ],
  h80meleeEnchants: [
    control('enchants'),
    { label: 'main hand +15 Agility (was Crusader)', apply: enchant('mainHand', ench('+15 Agility')) },
    { label: 'off hand Crusader (was +15 Agility)', apply: enchant('offHand', 20034) },
    { label: 'head + legs +1% Haste', apply: chain(enchant('head', ench('+1% Haste')), enchant('legs', ench('+1% Haste'))) },
    { label: 'gloves +1% Haste', apply: enchant('gloves', ench('+1% Haste')) },
    { label: 'food +20 Agility (was +40 Attack Power)', apply: consumable('food', 'food_agility') },
  ],
};

// Re-exported so later groups in this file can use them without lint noise.
export const _unused = { raceApply, addPrecombat, consumable, enchant, moveAbove, multiList, removeEntry, resource, targetCount, targetTime, ench, BM, BM_MM, LWR_BASE, LWM, HWK, tree, insertBelow, multi, SECONDARY_MANA, manaPotionGate, manaPotionGateMulti, stackWithoutFrenzy, stackFrenzyLast };
export type _P = CharacterProfile;
