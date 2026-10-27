/*
 * ==============================================================================
 * ROUND 80: THE FOUR MAGE PRESETS, SECOND PASS UNDER THE OWNER'S ROUND 79 RULES.
 *
 *   PRESET=mage_arcane FILE=tools/optimise/mageVariants80.ts VARIANTS=m80RaceArc WEIGHTED=1 \
 *     npx vite-node tools/probe_build.ts
 *
 * THE THEME (Step 0), which no variant here may move:
 *
 *   profile          class  majority tree        style   stance  target swings
 *   mage_frostfire   mage   Fire 29 / Frost 22   caster  -       no
 *   mage_arcane      mage   Arcane 48 / Fire 3   caster  -       no
 *   mage_fire        mage   Fire 34 / Arcane 14  caster  -       no
 *   mage_frost       mage   Frost 34 / Arcane 14 caster  -       no
 *
 * E65 gear, untouched; only `enchantId` moves. The owner's opener and list lines
 * stay -- a variant may ADD to them.
 *
 * THE BEFORE FIGURES (full_report, 300 fights a cell, round 79 main):
 *
 *   Frostfire  t1  979.4 +/- 9.7   t3 1240.1  t5 1740.5  t8 2915.7  weighted 1482.3 +/- 6.1
 *   Arcane     t1  944.3 +/- 7.6   t3 1270.1  t5 2146.4  t8 3872.1  weighted 1701.8 +/- 4.8
 *   Fire       t1 1033.7 +/- 6.8   t3 1376.3  t5 2190.9  t8 3528.7  weighted 1712.8 +/- 4.5
 *   Frost      t1  945.9            t3 1106.6  t5 1844.7  t8 3018.1  weighted 1478.3
 * ==============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplEntry, AplCondition } from '../../src/game/rotations/apl';
import {
  all,
  any,
  fightElapsed,
  fightRemaining,
  onCooldown,
  resourceFraction,
  selfHas,
  selfMissing,
  selfStacks,
  selfTime,
  targetCount,
  targetMissing,
  targetStacks,
  targetTime,
  hasReaction,
} from '../../src/game/rotations/apl';
import { racialsForRace } from '../../src/game/rotations/racialCooldowns';
import { setSection, withSection } from '../../src/profiles/aplSections';
import type { RaceId } from '../../src/game/character';
import type { Apply, Variant } from '../buildVariants';
import { MAGE_TREE as tree, apl, chain, consumable, enchant, inMulti, addPrecombat, removePrecombat } from '../buildVariants';

const control: Variant = { label: 'the shipped profile -- the control', apply: (p) => p };

// ---------------------------------------------------------------------------
// Race: both sections re-narrowed, so the new race's cooldown is switched on in
// the Single Target AND the Multi Target list.
// ---------------------------------------------------------------------------
const MAGE_RACES: readonly RaceId[] = ['orc', 'undead', 'troll', 'windshaper_skyborne'];

const narrowEntries = (entries: readonly AplEntry[], race: RaceId) =>
  racialsForRace({ entries }, race, 'mage').entries;

export const race =
  (id: RaceId): Apply =>
  (p) => {
    const raced: CharacterProfile = {
      ...p,
      character: { ...p.character, race: id },
      rotation: { ...p.rotation, entries: narrowEntries(p.rotation.entries, id) },
    };
    if (!raced.multiTarget) return raced;
    const multi = withSection(raced, 'multi');
    return setSection(raced, 'multi', {
      ...multi,
      rotation: { ...multi.rotation, entries: narrowEntries(multi.rotation.entries, id) },
    });
  };

const raceGroup = (current: string): Variant[] => [
  control,
  ...MAGE_RACES.filter((r) => r !== current).map((r) => ({ label: `race ${r}`, apply: race(r) })),
];

// ---------------------------------------------------------------------------
// List helpers.
// ---------------------------------------------------------------------------
const at = (entries: readonly AplEntry[], id: string, nth = 0) => {
  let seen = -1;
  const i = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
  if (i < 0) throw new Error(`no entry ${id}#${nth}`);
  return i;
};
/** Insert entries immediately above the `nth` entry for `id`, in both sections when `both`. */
const insertAbove = (entries: readonly AplEntry[], id: string, add: readonly AplEntry[], nth = 0): AplEntry[] => {
  const i = at(entries, id, nth);
  return [...entries.slice(0, i), ...add, ...entries.slice(i)];
};
const above = (id: string, add: readonly AplEntry[], nth = 0): Apply => apl((e) => insertAbove(e, id, add, nth));
const setCond = (id: string, cond: AplCondition | undefined, nth = 0): Apply =>
  apl((entries) => {
    const i = at(entries, id, nth);
    const { condition: _c, ...rest } = entries[i];
    entries[i] = cond ? { ...rest, condition: cond } : rest;
    return entries;
  });
const drop = (id: string, nth = 0): Apply =>
  apl((entries) => {
    entries.splice(at(entries, id, nth), 1);
    return entries;
  });
const both = (f: Apply): Apply => chain(f, inMulti(f));

// ---------------------------------------------------------------------------
// ARCANE: FIRE BLAST INTO HEATING UP INTO PYROBLAST (the owner's named miss).
//
// The 48/3/0 build carries SIXTEEN points that cannot do anything here --
// Wand Specialization 1, Improved Channeling 5 (cast pushback), Magic
// Absorption 2 (resistances, full resists), Arcane Resilience 2 (armor),
// Arcane Geometry 2 (range), Arcane Shielding 2 (Mana Shield, Mage Armor
// resistances) and Improved Counterspell 2 (a silence). The 32 live Arcane
// points still reach Arcane Power: 31 below tier 30.
//
// So 19 points are free for the Fire tree, and Heating Up is tier 15 behind
// Pyroblast -- 15 Fire points below it. Arcane stays the majority, 32 to 19.
// ---------------------------------------------------------------------------
const ARC_CORE = {
  arcane_focus: 5, missile_barrage: 2, arcane_subtlety: 2, arcane_concentration: 5, arcane_impact: 3,
  arcane_blast: 1, arcane_meditation: 3, arcane_wrath: 1, presence_of_mind: 1, arcane_mind: 5,
  arcane_instability: 3, arcane_power: 1,
};
const ARC_SHIPPED = {
  ...ARC_CORE, wand_specialization: 1, improved_channeling: 5, magic_absorption: 2, arcane_resilience: 2,
  arcane_geometry: 2, arcane_shielding: 2, improved_counterspell: 2, incineration: 3,
};
const ARC_FIRE_BASE = { improved_fire_blast: 2, incineration: 3, ignite: 5, improved_flamestrike: 3, pyroblast: 1 };
/** 32 / 19 / 0: Heating Up and Master of Elements. Burning Soul 1 is tier tax. */
export const ARC_HU_MOE = { ...ARC_CORE, ...ARC_FIRE_BASE, burning_soul: 1, heating_up: 1, master_of_elements: 3 };
/** 32 / 16 / 3: Heating Up, and Elemental Precision for the Fire spells' hit. */
export const ARC_HU_EP = { ...ARC_CORE, ...ARC_FIRE_BASE, burning_soul: 1, heating_up: 1, elemental_precision: 3 };
/** 32 / 16 / 3 with the Burning Soul tax in Improved Fireball (equally dead). */
/** 33 / 14 / 3 + 1: Pyroblast without Heating Up -- a Presence of Mind Pyroblast only. */
export const ARC_PYRO_EP = { ...ARC_CORE, ...ARC_FIRE_BASE, elemental_precision: 3, improved_channeling: 2 };
/** The shipped build with the dead points moved into Improved Flamestrike's tier -- illegal, kept out. */

const HU3 = selfStacks('exactly', 3, 'heating_up');
const PYRO_HU: AplEntry = { abilityId: 'pyroblast', condition: HU3, note: 'At three Heating Up stacks: a 1.5 second Pyroblast.' };
const FIRE_BLAST: AplEntry = { abilityId: 'fire_blast', note: 'On cooldown: a Heating Up stack every cast, two on a crit.' };
const AB_CAPPED = selfStacks('exactly', 4, 'arcane_blast');

/** The Arcane Power stack with Presence of Mind spent on a Pyroblast in Arcane Wrath's place. */
const pomPyroStack: Apply = apl((entries) =>
  entries.map((e) =>
    e.abilityId === 'arcane_power' && (e.sequence ?? []).includes('arcane_wrath')
      ? { ...e, sequence: ['presence_of_mind', 'pyroblast'] }
      : e.abilityId === 'major_spellblasting_potion' && (e.sequence ?? []).includes('arcane_wrath')
        ? { ...e, sequence: ['arcane_power', 'presence_of_mind', 'pyroblast'] }
        : e,
  ),
);

/** ST chain A: Pyroblast at 3 Heating Up and Fire Blast on cooldown, both above the first Arcane Missiles. */
const arcChainTop: Apply = above('arcane_missiles', [PYRO_HU, FIRE_BLAST]);
/** ST chain B: Pyroblast on top, Fire Blast below Arcane Wrath (above the capped Missiles). */
const arcChainMid: Apply = chain(above('arcane_missiles', [PYRO_HU]), above('arcane_missiles', [FIRE_BLAST], 1));
/** ST chain C: both only while Arcane Blast is capped. */
const arcChainCapped: Apply = above('arcane_missiles', [
  { ...PYRO_HU, condition: all(HU3, AB_CAPPED) },
  { ...FIRE_BLAST, condition: AB_CAPPED },
]);

const arcTalents = (): Variant[] => [
  control,
  { label: 'ARC_SHIPPED via tree (identity check)', apply: tree(ARC_SHIPPED) },
  { label: 'ARC_HU_MOE 32/19/0, no list change', apply: tree(ARC_HU_MOE) },
  { label: 'ARC_HU_MOE + chain top', apply: chain(tree(ARC_HU_MOE), arcChainTop) },
  { label: 'ARC_HU_MOE + chain top + PoM Pyro stack', apply: chain(tree(ARC_HU_MOE), arcChainTop, pomPyroStack) },
  { label: 'ARC_HU_EP 32/16/3 + chain top', apply: chain(tree(ARC_HU_EP), arcChainTop) },
  { label: 'ARC_HU_EP + chain top + PoM Pyro stack', apply: chain(tree(ARC_HU_EP), arcChainTop, pomPyroStack) },
  { label: 'ARC_PYRO_EP 33/14/3 + PoM Pyro stack only', apply: chain(tree(ARC_PYRO_EP), pomPyroStack) },
  { label: 'ARC_PYRO_EP + PoM Pyro stack + Fire Blast top', apply: chain(tree(ARC_PYRO_EP), pomPyroStack, above('arcane_missiles', [FIRE_BLAST])) },
];

const arcChains = (t: Record<string, number>): Variant[] => [
  control,
  { label: 'tree only', apply: tree(t) },
  { label: 'chain top', apply: chain(tree(t), arcChainTop) },
  { label: 'chain mid (FB below Wrath)', apply: chain(tree(t), arcChainMid) },
  { label: 'chain only while AB capped', apply: chain(tree(t), arcChainCapped) },
  { label: 'chain top + PoM Pyro', apply: chain(tree(t), arcChainTop, pomPyroStack) },
  { label: 'chain mid + PoM Pyro', apply: chain(tree(t), arcChainMid, pomPyroStack) },
  { label: 'Pyro top, FB at the bottom', apply: chain(tree(t), above('arcane_missiles', [PYRO_HU]), apl((e) => [...e, FIRE_BLAST])) },
];

const ARC_NEW: Apply = chain(tree(ARC_HU_EP), arcChainTop);
const arcNew = (...f: Apply[]): Apply => chain(tree(ARC_HU_EP), ...f);
const PYRO_SALVAGE: AplEntry = {
  abilityId: 'pyroblast',
  condition: all(selfStacks('exactly', 2, 'heating_up'), selfTime('atMost', 3.5, 'heating_up')),
};
const arcSt = (): Variant[] => [
  control,
  { label: 'NEW (EP tree + chain top)', apply: ARC_NEW },
  { label: 'NEW, Fire Blast above Pyroblast', apply: arcNew(above('arcane_missiles', [FIRE_BLAST, PYRO_HU])) },
  { label: 'NEW + Pyro salvage at 2 stacks, 3.5s left', apply: arcNew(above('arcane_missiles', [PYRO_HU, PYRO_SALVAGE, FIRE_BLAST])) },
  { label: 'NEW, Pyro at >= 2 stacks', apply: arcNew(above('arcane_missiles', [{ ...PYRO_HU, condition: selfStacks('atLeast', 2, 'heating_up') }, FIRE_BLAST])) },
  { label: 'NEW, FB only at <= 2 stacks', apply: arcNew(above('arcane_missiles', [PYRO_HU, { ...FIRE_BLAST, condition: any(selfMissing('heating_up'), selfStacks('atMost', 2, 'heating_up')) }])) },
  { label: 'NEW, FB above 20% mana', apply: arcNew(above('arcane_missiles', [PYRO_HU, { ...FIRE_BLAST, condition: resourceFraction('atLeast', 0.2, 'mana') }])) },
  { label: 'NEW, chain above the cooldown stack', apply: arcNew(above('arcane_power', [PYRO_HU, FIRE_BLAST])) },
  { label: 'NEW, chain above evocation', apply: arcNew(above('evocation', [PYRO_HU, FIRE_BLAST])) },
  { label: 'NEW, Arcane Wrath (capped) above the chain', apply: arcNew(above('arcane_missiles', [PYRO_HU, FIRE_BLAST], 0), apl((e) => { const w = e.findIndex((x) => x.abilityId === 'arcane_wrath' && !x.sequence); const [we] = e.splice(w, 1); const i = e.findIndex((x) => x.abilityId === 'pyroblast'); e.splice(i, 0, we); return e; })) },
];

const arcTalW = (): Variant[] => [
  control,
  { label: 'EP tree, chain in ST only', apply: chain(tree(ARC_HU_EP), arcChainTop) },
  { label: 'EP tree, chain in both lists', apply: chain(tree(ARC_HU_EP), both(arcChainTop)) },
  { label: 'MoE tree, chain in ST only', apply: chain(tree(ARC_HU_MOE), arcChainTop) },
  { label: 'MoE tree, chain in both lists', apply: chain(tree(ARC_HU_MOE), both(arcChainTop)) },
  { label: 'shipped tree, nothing else (MT reference)', apply: (p) => p },
];

const tc = (n: number) => targetCount('atLeast', n);
const FS = (n: number): AplEntry => ({ abilityId: 'flamestrike', condition: tc(n) });
const ARC_NEW_BOTH: Apply = chain(tree(ARC_HU_EP), both(arcChainTop));
const arcMt = (...f: Apply[]): Apply => chain(ARC_NEW_BOTH, inMulti(...f));
const arcMtGroup = (): Variant[] => [
  control,
  { label: 'NEW (both lists)', apply: ARC_NEW_BOTH },
  { label: 'NEW + FS spam (>=5) above AE', apply: arcMt(above('arcane_explosion', [FS(5)])) },
  { label: 'NEW + FS spam (>=3) above AE', apply: arcMt(above('arcane_explosion', [FS(3)])) },
  { label: 'NEW + Pyro@3HU and FB above AE (>=3)', apply: arcMt(above('arcane_explosion', [{ ...PYRO_HU, condition: all(tc(3), HU3) }, { ...FIRE_BLAST, condition: tc(3) }])) },
  { label: 'NEW + FB above AE (>=3)', apply: arcMt(above('arcane_explosion', [{ ...FIRE_BLAST, condition: tc(3) }])) },
  { label: 'NEW + Pyro@3HU, FB above AE (<=4 targets)', apply: arcMt(above('arcane_explosion', [{ ...PYRO_HU, condition: all(targetCount('atMost', 4), HU3) }, { ...FIRE_BLAST, condition: targetCount('atMost', 4) }])) },
  { label: 'NEW + AE only at >=5 (ST below)', apply: arcMt(setCond('arcane_explosion', tc(5))) },
  { label: 'NEW + FS spam (>=5) + Pyro/FB (<=4)', apply: arcMt(above('arcane_explosion', [FS(5), { ...PYRO_HU, condition: all(targetCount('atMost', 4), HU3) }, { ...FIRE_BLAST, condition: targetCount('atMost', 4) }])) },
];

// ---------------------------------------------------------------------------
// POTIONS (round 79): a Primary and a Secondary row sharing the potion cooldown.
// The ABILITY ids are the potion's own in either row, so the list names
// `major_mana_potion` and `major_spellblasting_potion` whichever row holds them.
//
// `withPotions` sets the pair and replaces every potion entry in ONE section
// with `entries`, at the position of the first one it removed. A potion that is
// the HEAD of a cooldown-stack sequence keeps the stack: the head is dropped and
// the rest of the sequence stays, unless an identical potion-less stack exists.
// ---------------------------------------------------------------------------
const POTIONS = new Set(['major_mana_potion', 'major_spellblasting_potion']);
const MP = 'major_mana_potion';
const SB = 'major_spellblasting_potion';
const sameStack = (a: AplEntry, b: AplEntry) =>
  a.abilityId === b.abilityId && JSON.stringify(a.sequence ?? []) === JSON.stringify(b.sequence ?? []) &&
  JSON.stringify(a.condition ?? null) === JSON.stringify(b.condition ?? null);
const replacePotions = (entries: readonly AplEntry[], add: readonly AplEntry[]): AplEntry[] => {
  const out: AplEntry[] = [];
  let insertAt = -1;
  for (const e of entries) {
    if (!POTIONS.has(e.abilityId)) {
      out.push(e);
      continue;
    }
    if (insertAt < 0) insertAt = out.length;
    if (e.sequence && e.sequence.length > 0) {
      const [head, ...rest] = e.sequence;
      const { sequence: _s, note: _n, ...base } = e;
      const tail: AplEntry = { ...base, abilityId: head, ...(rest.length > 0 ? { sequence: rest } : {}) };
      if (!entries.some((x) => sameStack(x, tail))) out.push(tail);
    }
  }
  if (insertAt < 0) insertAt = out.findIndex((e) => e.abilityId === 'demonic_rune');
  if (insertAt < 0) throw new Error('no potion entry and no Demonic Rune to anchor on');
  return [...out.slice(0, insertAt), ...add, ...out.slice(insertAt)];
};
const potionsIn = (add: readonly AplEntry[]): Apply => apl((e) => replacePotions(e, add));
/** Set the pair; `st` and `mt` are the potion entries for each section. */
const withPotions = (primary: string, secondary: string | undefined, st: readonly AplEntry[], mt: readonly AplEntry[]): Apply =>
  chain(
    (p) => {
      const { potion_secondary: _x, ...rest } = p.consumables as Record<string, string>;
      return {
        ...p,
        consumables: { ...rest, potion: primary, ...(secondary ? { potion_secondary: `secondary_${secondary}` } : {}) },
      };
    },
    potionsIn(st),
    inMulti(potionsIn(mt)),
  );
const mana = (frac: number, afterSec?: number): AplEntry => ({
  abilityId: MP,
  condition: afterSec === undefined
    ? resourceFraction('atMost', frac, 'mana')
    : all(resourceFraction('atMost', frac, 'mana'), fightElapsed('atLeast', afterSec)),
});
const blastWhen = (condition?: AplCondition): AplEntry => ({ abilityId: SB, ...(condition ? { condition } : {}) });

/** Potion logic candidates for one class: `cd` is the aura the damage potion is lined up with. */
const potionGroup = (baseline: Apply, cd: string): Variant[] => {
  const pair = (label: string, entries: readonly AplEntry[]): Variant => ({
    label,
    apply: chain(baseline, withPotions(MP, SB, entries, entries)),
  });
  const inCd = selfHas(cd);
  return [
    control,
    { label: 'baseline of this group', apply: baseline },
    { label: 'mana only, <= 30% (as shipped, re-written)', apply: chain(baseline, withPotions(MP, undefined, [mana(0.3)], [mana(0.3)])) },
    { label: 'spellblasting only, inside the cooldown', apply: chain(baseline, withPotions(SB, undefined, [blastWhen(inCd)], [blastWhen(inCd)])) },
    { label: 'spellblasting only, ungated', apply: chain(baseline, withPotions(SB, undefined, [blastWhen()], [blastWhen()])) },
    pair('pair: mana <= 30%, spellblast in last 30s', [mana(0.3), blastWhen(fightRemaining('atMost', 30))]),
    pair('pair: mana <= 50% after 60s, spellblast in last 30s', [mana(0.5, 60), blastWhen(fightRemaining('atMost', 30))]),
    pair('pair: mana <= 40%, spellblast in last 20s', [mana(0.4), blastWhen(fightRemaining('atMost', 20))]),
    pair('pair: mana <= 20%, spellblast in last 30s', [mana(0.2), blastWhen(fightRemaining('atMost', 30))]),
    pair('pair: spellblast in cd if <= 75s left, mana <= 30%', [blastWhen(all(inCd, fightRemaining('atMost', 75))), mana(0.3)]),
    pair('pair: spellblast in cd if <= 75s left, mana <= 30%, spellblast last 25s', [blastWhen(all(inCd, fightRemaining('atMost', 75))), mana(0.3), blastWhen(fightRemaining('atMost', 25))]),
  ];
};

const POT_PAIR = [mana(0.3), blastWhen(fightRemaining('atMost', 30))];
const potPair: Apply = withPotions(MP, SB, POT_PAIR, POT_PAIR);
const ARC_FULL: Apply = chain(ARC_NEW_BOTH, potPair);

/** A racial cooldown gated on an aura, in one section or both. */
const gateRacial = (id: string, cond: AplCondition | undefined): Apply => setCond(id, cond);
const raceTuned = (base: Apply, cd: string): Variant[] => {
  const v: Variant[] = [control, { label: 'baseline of this group', apply: base }];
  for (const r of MAGE_RACES) {
    v.push({ label: `race ${r}`, apply: chain(base, race(r)) });
    const active = r === 'orc' ? 'blood_fury' : r === 'troll' ? 'berserking' : undefined;
    if (active) {
      v.push({ label: `race ${r}, racial inside ${cd} (ST)`, apply: chain(base, race(r), gateRacial(active, selfHas(cd))) });
      v.push({ label: `race ${r}, racial inside ${cd} (both)`, apply: chain(base, race(r), both(gateRacial(active, selfHas(cd)))) });
    }
  }
  return v;
};

// ---------------------------------------------------------------------------
// FIRE.
// ---------------------------------------------------------------------------
const FIRE_SHIPPED = {
  arcane_focus: 5, missile_barrage: 2, arcane_subtlety: 2, arcane_concentration: 5,
  improved_fire_blast: 2, incineration: 3, improved_fireball: 5, ignite: 5, pyroblast: 1, improved_flamestrike: 3,
  improved_scorch: 3, heating_up: 1, master_of_elements: 2, critical_mass: 5, fire_power: 3, combustion: 1,
  elemental_precision: 3,
};
const FV_COND = all(targetStacks('atLeast', 5, 'fire_vulnerability'), targetTime('atLeast', 10, 'fire_vulnerability'));
/** A potion-less Combustion after the potion stack, so a build that drinks something else keeps it. */
const COMBUSTION_FALLBACK: AplEntry = { abilityId: 'combustion', condition: FV_COND };
const fireFallback: Apply = both(above('fire_blast', [COMBUSTION_FALLBACK]));
const fireScorch = (n: number) =>
  all(hasReaction('improved_scorch'), any(targetStacks('below', 5, 'fire_vulnerability'), targetTime('atMost', n, 'fire_vulnerability')));
const HU_LE1 = any(selfMissing('heating_up'), selfStacks('atMost', 1, 'heating_up'));

const fireSt = (): Variant[] => [
  control,
  { label: 'Combustion fallback (no-op while Spellblasting is drunk)', apply: fireFallback },
  { label: 'Pyro salvage at 2 HU, 3.5s left', apply: above('fire_blast', [PYRO_SALVAGE]) },
  { label: 'Fire Blast only at <= 1 HU stack', apply: setCond('fire_blast', HU_LE1) },
  { label: 'Fire Blast only at <= 2 HU stacks', apply: setCond('fire_blast', any(selfMissing('heating_up'), selfStacks('atMost', 2, 'heating_up'))) },
  { label: 'Arcane Missiles (barrage) above Pyroblast', apply: chain(drop('arcane_missiles'), above('pyroblast', [{ abilityId: 'arcane_missiles', condition: selfStacks('atLeast', 1, 'missile_barrage') }])) },
  { label: 'Fire Blast above Pyroblast', apply: chain(drop('fire_blast'), above('pyroblast', [{ abilityId: 'fire_blast' }])) },
  { label: 'Fire Blast above Scorch', apply: chain(drop('fire_blast'), above('scorch', [{ abilityId: 'fire_blast' }])) },
  { label: 'Pyroblast hard-cast under Clearcasting', apply: above('fireball', [{ abilityId: 'pyroblast', condition: selfHas('clearcasting') }]) },
  { label: 'Cone of Cold above Fireball', apply: above('fireball', [{ abilityId: 'cone_of_cold' }]) },
  { label: 'Scorch filler instead of Fireball', apply: apl((e) => [...e.filter((x) => x.abilityId !== 'fireball'), { abilityId: 'scorch' }]) },
];
const fireScorchSweep = (): Variant[] => [
  control,
  ...[2, 3, 4, 6, 7, 8].map((n) => ({ label: `Scorch window 5s -> ${n}s`, apply: setCond('scorch', fireScorch(n)) })),
];
const fireCombGate = (): Variant[] => [
  control,
  ...[0, 5, 15, 20, 25].map((n) => ({
    label: `Combustion stack at FV 5 with >= ${n}s left (was 10)`,
    apply: setCond('major_spellblasting_potion', all(targetStacks('atLeast', 5, 'fire_vulnerability'), targetTime('atLeast', n, 'fire_vulnerability'))),
  })),
  { label: 'Combustion stack at FV >= 3', apply: setCond('major_spellblasting_potion', targetStacks('atLeast', 3, 'fire_vulnerability')) },
  { label: 'Combustion stack ungated (pull)', apply: setCond('major_spellblasting_potion', undefined) },
  { label: 'Combustion stack at FV 5 and 3 HU', apply: setCond('major_spellblasting_potion', all(FV_COND, HU3)) },
];
const FIRE_BW_A = { ...FIRE_SHIPPED, master_of_elements: 1, blast_wave: 1 };
const FIRE_BW_B = { ...FIRE_SHIPPED, arcane_subtlety: 0, master_of_elements: 3, blast_wave: 1 };
const FIRE_MOE3 = { ...FIRE_SHIPPED, arcane_subtlety: 1, master_of_elements: 3 };
const BW = (n: number): AplEntry => ({ abilityId: 'blast_wave', condition: tc(n) });
const fireTal = (): Variant[] => [
  control,
  { label: 'FIRE_SHIPPED via tree (identity)', apply: tree(FIRE_SHIPPED) },
  { label: 'MoE 1 -> Blast Wave, BW (>=3) top of MT area', apply: chain(tree(FIRE_BW_A), inMulti(above('flamestrike', [BW(3)]))) },
  { label: 'Subtlety 2 -> BW + MoE 3, BW (>=3) in MT', apply: chain(tree(FIRE_BW_B), inMulti(above('flamestrike', [BW(3)]))) },
  { label: 'Subtlety 1 -> MoE 3', apply: tree(FIRE_MOE3) },
  { label: 'MoE 1 -> BW, BW (>=3) MT and BW in ST list bottom', apply: chain(tree(FIRE_BW_A), inMulti(above('flamestrike', [BW(3)]))) },
];

const bwFrom = (from: Record<string, number>, mt: Apply): Apply => chain(tree({ ...FIRE_SHIPPED, ...from, blast_wave: 1 }), inMulti(mt));
const BW_TOP3 = above('flamestrike', [BW(3)]);
const BW_TOP5 = above('flamestrike', [BW(5)]);
const BW_AFTER_DOT = above('flamestrike', [BW(3)], 1);
const fireBw = (): Variant[] => [
  control,
  { label: 'MoE 1 -> BW, BW >=3 top', apply: bwFrom({ master_of_elements: 1 }, BW_TOP3) },
  { label: 'MoE 1 -> BW, BW >=5 top', apply: bwFrom({ master_of_elements: 1 }, BW_TOP5) },
  { label: 'MoE 1 -> BW, BW >=3 after FS-on-dot', apply: bwFrom({ master_of_elements: 1 }, BW_AFTER_DOT) },
  { label: 'IFS 1 -> BW, BW >=3 top', apply: bwFrom({ improved_flamestrike: 2 }, BW_TOP3) },
  { label: 'Incineration 1 -> BW, BW >=3 top', apply: bwFrom({ incineration: 2 }, BW_TOP3) },
  { label: 'Critical Mass 1 -> BW, BW >=3 top', apply: bwFrom({ critical_mass: 4 }, BW_TOP3) },
  { label: 'Imp Fire Blast 1 -> BW, BW >=3 top', apply: bwFrom({ improved_fire_blast: 1 }, BW_TOP3) },
];

const fireBw2 = (): Variant[] => [
  control,
  { label: 'Incineration 1 -> BW (reference)', apply: bwFrom({ incineration: 2 }, BW_TOP3) },
  { label: 'Clearcasting 1 -> BW', apply: bwFrom({ arcane_concentration: 4 }, BW_TOP3) },
  { label: 'Clearcasting 2 -> BW + MoE 3', apply: bwFrom({ arcane_concentration: 3, master_of_elements: 3 }, BW_TOP3) },
  { label: 'Arcane Subtlety 1 -> BW', apply: bwFrom({ arcane_subtlety: 1 }, BW_TOP3) },
  { label: 'Improved Fireball 1 -> BW', apply: bwFrom({ improved_fireball: 4 }, BW_TOP3) },
  { label: 'Missile Barrage 1 -> BW', apply: bwFrom({ missile_barrage: 1 }, BW_TOP3) },
];

const fireBw3 = (): Variant[] => [
  control,
  { label: 'Clearcasting 3: BW + MoE 3 (reference)', apply: bwFrom({ arcane_concentration: 3, master_of_elements: 3 }, BW_TOP3) },
  { label: 'Clearcasting 2: BW + MoE 3 + Burning Soul 1', apply: bwFrom({ arcane_concentration: 2, master_of_elements: 3, burning_soul: 1 }, BW_TOP3) },
  { label: 'Clearcasting 0: BW + MoE 3 + Burning Soul 3', apply: bwFrom({ arcane_concentration: 0, master_of_elements: 3, burning_soul: 3 }, BW_TOP3) },
  { label: 'Clearcasting 3: BW + MoE 3, BW >= 3 after FS-on-dot', apply: bwFrom({ arcane_concentration: 3, master_of_elements: 3 }, BW_AFTER_DOT) },
  { label: 'Clearcasting 3: BW + MoE 3, BW >= 4 top', apply: bwFrom({ arcane_concentration: 3, master_of_elements: 3 }, above('flamestrike', [BW(4)])) },
  { label: 'Clearcasting 3: MoE 3 + Burning Soul 1, no BW', apply: tree({ ...FIRE_SHIPPED, arcane_concentration: 3, master_of_elements: 3, burning_soul: 1 }) },
];

const FIRE_T: Apply = bwFrom({ arcane_concentration: 3, master_of_elements: 3 }, BW_TOP3);
const fireMtOn = (...f: Apply[]): Apply => chain(FIRE_T, inMulti(...f));
const fireMt = (): Variant[] => [
  control,
  { label: 'FIRE_T (new talents, BW >=3 top)', apply: FIRE_T },
  { label: 'FIRE_T, FS spam at >=4', apply: fireMtOn(setCond('flamestrike', tc(4), 1)) },
  { label: 'FIRE_T, FS spam at >=3', apply: fireMtOn(setCond('flamestrike', tc(3), 1)) },
  { label: 'FIRE_T, Fire Blast above FS spam (>=3)', apply: fireMtOn(above('flamestrike', [{ ...FIRE_BLAST, condition: tc(3) }], 1)) },
  { label: 'FIRE_T, Pyro@3HU above FS spam (>=3)', apply: fireMtOn(above('flamestrike', [{ ...PYRO_HU, condition: all(tc(3), HU3) }], 1)) },
  { label: 'FIRE_T, AE filler (>=5) under FS', apply: fireMtOn(above('scorch', [{ abilityId: 'arcane_explosion', condition: tc(5) }])) },
  { label: 'FIRE_T, stack copy at >=3 (was 5)', apply: fireMtOn(setCond('major_spellblasting_potion', tc(3))) },
  { label: 'FIRE_T, no stack copy (ST gate only)', apply: fireMtOn(drop('major_spellblasting_potion')) },
];

const FIRE_FULL: Apply = chain(FIRE_T, fireFallback, consumable('potion_secondary', 'secondary_major_mana_potion'));

// ---------------------------------------------------------------------------
// FROSTFIRE.
// ---------------------------------------------------------------------------
const FF_SHIPPED = {
  improved_fire_blast: 2, incineration: 3, improved_fireball: 5, ignite: 5, pyroblast: 1, improved_scorch: 3,
  heating_up: 1, master_of_elements: 3, critical_mass: 3, fire_power: 3,
  frost_warding: 2, improved_frostbolt: 2, elemental_precision: 3, ice_shards: 5, frost_channeling: 3,
  ice_lance: 1, ice_block: 1, shatter: 3, fingers_of_frost: 2,
};
const FOF = selfHas('fingers_of_frost');
const ffSt = (): Variant[] => [
  control,
  { label: 'Fire Blast ungated', apply: setCond('fire_blast', undefined) },
  { label: 'Fire Blast at <= 2 HU, mana >= 10%', apply: setCond('fire_blast', all(resourceFraction('atLeast', 0.1, 'mana'), any(selfMissing('heating_up'), selfStacks('atMost', 2, 'heating_up')))) },
  { label: 'Fire Blast mana floor 10% -> 5%', apply: setCond('fire_blast', all(resourceFraction('atLeast', 0.05, 'mana'), HU_LE1)) },
  { label: 'Ice Lance on Fingers above Frostfire Bolt', apply: above('frostfire_bolt', [{ abilityId: 'ice_lance', condition: FOF }]) },
  { label: 'Cone of Cold above Frostfire Bolt', apply: above('frostfire_bolt', [{ abilityId: 'cone_of_cold' }]) },
  { label: 'Cone of Cold on Fingers above Frostfire Bolt', apply: above('frostfire_bolt', [{ abilityId: 'cone_of_cold', condition: FOF }]) },
  { label: 'Fireball filler instead of Frostfire Bolt', apply: apl((e) => [...e.filter((x) => x.abilityId !== 'frostfire_bolt'), { abilityId: 'fireball' }]) },
  { label: 'Pyroblast salvage removed', apply: drop('pyroblast', 1) },
  { label: 'Ice Barrier entry removed', apply: drop('ice_barrier') },
];
const ffScorch = (): Variant[] => [
  control,
  ...[5, 6, 8, 9, 10].map((n) => ({ label: `Scorch window 7s -> ${n}s`, apply: setCond('scorch', fireScorch(n)) })),
];
const ffTal = (): Variant[] => [
  control,
  { label: 'FF_SHIPPED via tree (identity)', apply: tree(FF_SHIPPED) },
  { label: 'Critical Mass 3 -> Improved Flamestrike 3', apply: tree({ ...FF_SHIPPED, critical_mass: 0, improved_flamestrike: 3 }) },
  { label: 'Master of Elements 3 -> Improved Flamestrike 3', apply: tree({ ...FF_SHIPPED, master_of_elements: 0, improved_flamestrike: 3 }) },
  { label: 'Imp Scorch 3 -> Improved Flamestrike 3', apply: tree({ ...FF_SHIPPED, improved_scorch: 0, improved_flamestrike: 3 }) },
  { label: 'Frost Warding 2 + Ice Block 1 -> Improved Blizzard 3', apply: tree({ ...FF_SHIPPED, frost_warding: 0, ice_block: 0, improved_blizzard: 3 }) },
  { label: 'Incineration 3 -> Improved Flamestrike 3', apply: tree({ ...FF_SHIPPED, incineration: 0, improved_flamestrike: 3 }) },
];
const ffMt = (): Variant[] => [
  control,
  { label: 'FS spam at >=4', apply: inMulti(setCond('flamestrike', tc(4), 1)) },
  { label: 'FS spam at >=3', apply: inMulti(setCond('flamestrike', tc(3), 1)) },
  { label: 'Pyro@3HU above FS spam', apply: inMulti(above('flamestrike', [{ ...PYRO_HU, condition: all(tc(3), HU3) }], 1)) },
  { label: 'Fire Blast above FS spam (>=3)', apply: inMulti(above('flamestrike', [{ ...FIRE_BLAST, condition: tc(3) }], 1)) },
  { label: 'Ice Lance on Fingers above FS spam (>=3)', apply: inMulti(above('flamestrike', [{ abilityId: 'ice_lance', condition: all(tc(3), FOF) }], 1)) },
  { label: 'Blizzard (>=5) below FS on dot, FS spam dropped', apply: inMulti(drop('flamestrike', 1), above('scorch', [{ abilityId: 'blizzard', condition: tc(5) }])) },
  { label: 'AE (>=5) under FS spam', apply: inMulti(above('scorch', [{ abilityId: 'arcane_explosion', condition: tc(5) }])) },
];

// ---------------------------------------------------------------------------
// FROST.
// ---------------------------------------------------------------------------
const FROST_SHIPPED = {
  arcane_focus: 5, arcane_concentration: 5, arcane_subtlety: 2, missile_barrage: 2, incineration: 3,
  improved_frostbolt: 5, elemental_precision: 3, ice_shards: 5, frost_channeling: 3, ice_lance: 1,
  improved_blizzard: 1, ice_block: 1, shatter: 3, improved_cone_of_cold: 3, cold_snap: 1, fingers_of_frost: 2,
  winter_s_chill: 5, ice_barrier: 1,
};
const frostSt = (): Variant[] => [
  control,
  { label: 'Fire Blast above Frostbolt', apply: above('frostbolt', [{ abilityId: 'fire_blast' }]) },
  { label: 'Fire Blast above Frostbolt, mana >= 30%', apply: above('frostbolt', [{ abilityId: 'fire_blast', condition: resourceFraction('atLeast', 0.3, 'mana') }]) },
  { label: 'Cone of Cold ungated (on cooldown)', apply: setCond('cone_of_cold', undefined) },
  { label: 'Cone of Cold at >= 3 Winters Chill', apply: setCond('cone_of_cold', any(targetStacks('atLeast', 3, 'winters_chill'), fightRemaining('atMost', 1.5))) },
  { label: 'Cone of Cold on Fingers or 5 WC', apply: setCond('cone_of_cold', any(targetStacks('atLeast', 5, 'winters_chill'), FOF, fightRemaining('atMost', 1.5))) },
  { label: 'Ice Lance on Fingers removed', apply: drop('ice_lance') },
  { label: 'Arcane Missiles (barrage) below Ice Lance', apply: chain(drop('arcane_missiles'), above('ice_barrier', [{ abilityId: 'arcane_missiles', condition: selfHas('missile_barrage') }])) },
  { label: 'Cold Snap after Cone of Cold (in list)', apply: above('ice_lance', [{ abilityId: 'cold_snap', condition: onCooldown('cone_of_cold') }]) },
  { label: 'Fireball filler instead of Frostbolt', apply: apl((e) => [...e.filter((x) => x.abilityId !== 'frostbolt'), { abilityId: 'fireball' }]) },
];
const frostTal = (): Variant[] => [
  control,
  { label: 'FROST_SHIPPED via tree (identity)', apply: tree(FROST_SHIPPED) },
  { label: 'Ice Block 1 -> Improved Blizzard 2', apply: tree({ ...FROST_SHIPPED, ice_block: 0, improved_blizzard: 2 }) },
  { label: 'Subtlety 2 -> Improved Blizzard 3', apply: tree({ ...FROST_SHIPPED, arcane_subtlety: 0, improved_blizzard: 3 }) },
  { label: 'Ice Block 1 + Subtlety 1 -> Improved Blizzard 3', apply: tree({ ...FROST_SHIPPED, ice_block: 0, arcane_subtlety: 1, improved_blizzard: 3 }) },
];
const frostMt = (): Variant[] => [
  control,
  { label: 'Blizzard at >=3', apply: inMulti(setCond('blizzard', tc(3))) },
  { label: 'Blizzard at >=4', apply: inMulti(setCond('blizzard', tc(4))) },
  { label: 'FS spam (>=5) in Blizzards place', apply: inMulti(setCond('blizzard', tc(99)), above('blizzard', [FS(5)])) },
  { label: 'FS spam (>=5) above Blizzard', apply: inMulti(above('blizzard', [FS(5)])) },
  { label: 'Cone of Cold (>=3) above Blizzard', apply: inMulti(above('blizzard', [{ abilityId: 'cone_of_cold', condition: tc(3) }])) },
  { label: 'AE (>=3) below Blizzard', apply: inMulti(above('arcane_missiles', [{ abilityId: 'arcane_explosion', condition: tc(3) }])) },
];

const ffTal2 = (): Variant[] => [
  control,
  { label: 'Incineration 3 -> IFS 3 (reference)', apply: tree({ ...FF_SHIPPED, incineration: 0, improved_flamestrike: 3 }) },
  { label: 'Incineration 2 + Imp Fire Blast 1 -> IFS 3', apply: tree({ ...FF_SHIPPED, incineration: 1, improved_fire_blast: 1, improved_flamestrike: 3 }) },
  { label: 'Incineration 1 + Imp Fire Blast 2 -> IFS 3', apply: tree({ ...FF_SHIPPED, incineration: 2, improved_fire_blast: 0, improved_flamestrike: 3 }) },
  { label: 'Incineration 2 -> IFS 2', apply: tree({ ...FF_SHIPPED, incineration: 1, improved_flamestrike: 2 }) },
  { label: 'Incineration 3 -> IFS 3, FS spam at >= 4', apply: chain(tree({ ...FF_SHIPPED, incineration: 0, improved_flamestrike: 3 }), inMulti(setCond('flamestrike', tc(4), 1))) },
  { label: 'Incineration 3 -> IFS 3, FS spam at >= 3', apply: chain(tree({ ...FF_SHIPPED, incineration: 0, improved_flamestrike: 3 }), inMulti(setCond('flamestrike', tc(3), 1))) },
];

const FF_NEW = { ...FF_SHIPPED, incineration: 2, improved_fire_blast: 0, improved_flamestrike: 3 };
const FF_T: Apply = tree(FF_NEW);
const ffMtOn = (...f: Apply[]): Apply => chain(FF_T, inMulti(...f));
const ffMt2 = (): Variant[] => [
  control,
  { label: 'FF_T (IFB 2 + Inc 1 -> IFS 3)', apply: FF_T },
  { label: 'FF_T, Pyro@3HU above FS spam', apply: ffMtOn(above('flamestrike', [{ ...PYRO_HU, condition: all(tc(3), HU3) }], 1)) },
  { label: 'FF_T, Fire Blast above FS spam (>=3)', apply: ffMtOn(above('flamestrike', [{ ...FIRE_BLAST, condition: tc(3) }], 1)) },
  { label: 'FF_T, FS on dot gate 3 -> 4', apply: ffMtOn(setCond('flamestrike', all(tc(4), targetMissing('flamestrike')))) },
  { label: 'FF_T, AE (>=5) under FS spam', apply: ffMtOn(above('scorch', [{ abilityId: 'arcane_explosion', condition: tc(5) }])) },
  { label: 'FF_T, Blizzard (>=5) under FS spam', apply: ffMtOn(above('scorch', [{ abilityId: 'blizzard', condition: tc(5) }])) },
  { label: 'FF_T, Fire Blast owner gate lifted (MT only)', apply: ffMtOn(setCond('fire_blast', undefined)) },
];
const ffPot = (): Variant[] => potionGroup(FF_T, 'heating_up');

const COC_MID = (hi: number): AplEntry => ({ abilityId: 'cone_of_cold', condition: all(tc(3), targetCount('atMost', hi)) });
const frostMt2 = (): Variant[] => [
  control,
  { label: 'CoC (3-7 targets) above Blizzard', apply: inMulti(above('blizzard', [COC_MID(7)])) },
  { label: 'CoC (3-5 targets) above Blizzard', apply: inMulti(above('blizzard', [COC_MID(5)])) },
  { label: 'CoC (3-7) above Blizzard, Blizzard at >=3', apply: inMulti(above('blizzard', [COC_MID(7)]), setCond('blizzard', tc(3))) },
  { label: 'CoC (3-7) at 5 WC above Blizzard, Blizzard at >=3', apply: inMulti(above('blizzard', [{ abilityId: 'cone_of_cold', condition: all(tc(3), targetCount('atMost', 7), targetStacks('atLeast', 5, 'winters_chill')) }]), setCond('blizzard', tc(3))) },
  { label: 'Blizzard at >=3 only', apply: inMulti(setCond('blizzard', tc(3))) },
  { label: 'CoC (3-7) above FS-on-dot, Blizzard at >=3', apply: inMulti(above('flamestrike', [COC_MID(7)]), setCond('blizzard', tc(3))) },
];

const cocWc = (wc: number, hi?: number): AplEntry => ({
  abilityId: 'cone_of_cold',
  condition: all(tc(3), ...(hi ? [targetCount('atMost', hi)] : []), targetStacks('atLeast', wc, 'winters_chill')),
});
const BLIZ3 = setCond('blizzard', tc(3));
const frostMt3 = (): Variant[] => [
  control,
  { label: 'CoC at 5 WC (3-7) above Blizzard, Bliz >=3 (ref)', apply: inMulti(above('blizzard', [cocWc(5, 7)]), BLIZ3) },
  { label: 'CoC at 5 WC (any count) above Blizzard, Bliz >=3', apply: inMulti(above('blizzard', [cocWc(5)]), BLIZ3) },
  { label: 'CoC at 4 WC (3-7) above Blizzard, Bliz >=3', apply: inMulti(above('blizzard', [cocWc(4, 7)]), BLIZ3) },
  { label: 'CoC at 3 WC (3-7) above Blizzard, Bliz >=3', apply: inMulti(above('blizzard', [cocWc(3, 7)]), BLIZ3) },
  { label: 'CoC at 5 WC (any) above FS-on-dot, Bliz >=3', apply: inMulti(above('flamestrike', [cocWc(5)]), BLIZ3) },
  { label: 'CoC at 5 WC (any) + Ice Lance on Fingers (3-4) above Blizzard', apply: inMulti(above('blizzard', [cocWc(5), { abilityId: 'ice_lance', condition: all(tc(3), targetCount('atMost', 4), FOF) }]), BLIZ3) },
];

const frostPot = (): Variant[] => [
  ...potionGroup((p) => p, 'fingers_of_frost'),
  { label: 'secondary Spellblasting, lists untouched (owner line drinks it at the pull)', apply: consumable('potion_secondary', 'secondary_major_spellblasting_potion') },
  { label: 'secondary Spellblasting, MT list only gets mana<=30% + SB last 30s', apply: chain(consumable('potion_secondary', 'secondary_major_spellblasting_potion'), inMulti(potionsIn(POT_PAIR))) },
];

const FROST_FULL: Apply = inMulti(above('blizzard', [cocWc(5, 7)]), BLIZ3);
const FF_FULL: Apply = chain(FF_T, potPair);
const raceOnly = (base: Apply, extra: Variant[] = []): Variant[] => [
  control,
  { label: 'baseline of this group', apply: base },
  ...MAGE_RACES.map((r) => ({ label: `race ${r}`, apply: chain(base, race(r)) })),
  ...extra,
];

const enchGroup = (): Variant[] => [
  control,
  { label: 'two-hand Revelation (for +65 SP)', apply: enchant('twoHand', 900032) },
  { label: 'two-hand Enchant Weapon - Spell Power (for +65 SP)', apply: enchant('twoHand', 22749) },
  { label: 'head +8 Intellect (for +1% Haste)', apply: enchant('head', 900006) },
  { label: 'head and legs +8 Intellect', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
  { label: 'gloves +1% Haste (for +20 SP)', apply: enchant('gloves', 900002) },
  { label: 'head +8 Spirit (for +1% Haste)', apply: enchant('head', 900007) },
];

// ---------------------------------------------------------------------------
// COMBINED (Step 5's knock-on check): each shipped change reverted on its own
// against the finished profile. A positive row would mean a change no longer
// pays with the others in.
// ---------------------------------------------------------------------------
const noRevelation = enchant('twoHand', 900029);
const combinedArc = (): Variant[] => [
  control,
  { label: 'revert: staff +65 SP for Revelation', apply: noRevelation },
  { label: 'revert: gloves +20 SP for haste', apply: enchant('gloves', 900023) },
  { label: 'revert: race windshaper (HOS is no longer allowed)', apply: race('windshaper_skyborne') },
  { label: 'revert: Berserking ungated', apply: both(setCond('berserking', undefined)) },
  { label: 'revert: no Pyro/Fire Blast entries', apply: both(chain(drop('pyroblast'), drop('fire_blast'))) },
  { label: 'revert: no late Spellblasting', apply: both(drop('major_spellblasting_potion')) },
  { label: 'knock-on: Fire Blast only at <= 2 HU', apply: both(setCond('fire_blast', any(selfMissing('heating_up'), selfStacks('atMost', 2, 'heating_up')))) },
  { label: 'knock-on: PoM spent on Pyroblast', apply: both(pomPyroStack) },
];
const combinedFire = (): Variant[] => [
  control,
  { label: 'revert: race windshaper', apply: race('windshaper_skyborne') },
  { label: 'revert: Berserking ungated', apply: both(setCond('berserking', undefined)) },
  { label: 'revert: no Blast Wave entry', apply: inMulti(drop('blast_wave')) },
  { label: 'check: Revelation on the staff', apply: enchant('twoHand', 900032) },
];
const combinedFf = (): Variant[] => [
  control,
  { label: 'revert: staff +65 SP for Revelation', apply: noRevelation },
  { label: 'revert: race windshaper', apply: race('windshaper_skyborne') },
  { label: 'revert: no late Spellblasting', apply: both(drop('major_spellblasting_potion')) },
  { label: 'owner gate lifted: Fire Blast ungated (both lists)', apply: both(setCond('fire_blast', undefined)) },
];
const combinedFrost = (): Variant[] => [
  control,
  { label: 'revert: staff +65 SP for Revelation', apply: noRevelation },
  { label: 'revert: race windshaper', apply: race('windshaper_skyborne') },
  { label: 'revert: no Cone of Cold area entry', apply: inMulti(drop('cone_of_cold')) },
  { label: 'owner order: Arcane Missiles below Ice Lance', apply: chain(drop('arcane_missiles'), above('ice_barrier', [{ abilityId: 'arcane_missiles', condition: selfHas('missile_barrage') }])) },
  { label: 'owner line gated: SB secondary, its line in the last 30s', apply: chain(consumable('potion_secondary', 'secondary_major_spellblasting_potion'), setCond('major_spellblasting_potion', fightRemaining('atMost', 30)), inMulti(potionsIn([mana(0.3), blastWhen()]))) },
];

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  m80CombArc: combinedArc(),
  m80CombFire: combinedFire(),
  m80CombFf: combinedFf(),
  m80CombFrost: combinedFrost(),
  m80Ench: enchGroup(),
  m80FrostRace2: raceOnly(FROST_FULL, [
    { label: 'race troll, Berserking at 5 Winters Chill', apply: chain(FROST_FULL, race('troll'), both(setCond('berserking', targetStacks('atLeast', 5, 'winters_chill')))) },
  ]),
  m80FfRace2: raceTuned(FF_FULL, 'fingers_of_frost'),
  m80FireRaceFinal: [
    control,
    { label: 'FIRE_FULL (High Order Skyborne)', apply: FIRE_FULL },
    { label: 'FIRE_FULL, race windshaper', apply: chain(FIRE_FULL, race('windshaper_skyborne')) },
    { label: 'FIRE_FULL, race troll, Berserking in Combustion (both)', apply: chain(FIRE_FULL, race('troll'), both(setCond('berserking', selfHas('combustion')))) },
    { label: 'FIRE_FULL, race troll, ungated', apply: chain(FIRE_FULL, race('troll')) },
  ],
  m80FrostPot2: frostPot(),
  m80FrostMt3: frostMt3(),
  m80FrostMt2: frostMt2(),
  m80FfMt2: ffMt2(),
  m80FfPot2: ffPot(),
  m80FfTal2: ffTal2(),
  m80FfSt: ffSt(),
  m80FfScorch: ffScorch(),
  m80FfTal: ffTal(),
  m80FfMt: ffMt(),
  m80FfPot: potionGroup((p) => p, 'heating_up'),
  m80FrostSt: frostSt(),
  m80FrostTal: frostTal(),
  m80FrostMt: frostMt(),
  m80FrostPot: potionGroup((p) => p, 'fingers_of_frost'),
  m80FireRace2: raceTuned(FIRE_FULL, 'combustion'),
  m80FireMt: fireMt(),
  m80FireBw3: fireBw3(),
  m80FireBw2: fireBw2(),
  m80FireBw: fireBw(),
  m80FireSt: fireSt(),
  m80FireScorch: fireScorchSweep(),
  m80FireComb: fireCombGate(),
  m80FireTal: fireTal(),
  m80FirePot: potionGroup(chain(FIRE_T, fireFallback), 'combustion'),
  m80ArcRace2: raceTuned(ARC_FULL, 'arcane_power'),
  m80ArcPot: potionGroup(ARC_NEW_BOTH, 'arcane_power'),
  m80ArcMt: arcMtGroup(),
  m80ArcTalW: arcTalW(),
  m80ArcSt: arcSt(),
  m80ArcTal: arcTalents(),
  m80ArcChainMoe: arcChains(ARC_HU_MOE),
  m80ArcChainEp: arcChains(ARC_HU_EP),
  m80RaceArc: raceGroup('high_order_skyborne'),
  m80RaceFire: raceGroup('high_order_skyborne'),
  m80RaceFf: raceGroup('human'),
  m80RaceFrost: raceGroup('windshaper_skyborne'),
};

void [all, any, fightElapsed, fightRemaining, onCooldown, resourceFraction, selfHas, selfMissing, selfStacks,
  selfTime, targetCount, targetMissing, targetStacks, targetTime, hasReaction, tree, consumable, addPrecombat,
  removePrecombat, above, setCond, drop, both];
