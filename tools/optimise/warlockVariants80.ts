/*
 * ============================================================================
 * ROUND 80: THE FOUR WARLOCK PRESETS, second pass under the owner's round 79
 * rules -- talents and race on the WEIGHTED score (49% 1 target/120s, 17% each
 * 3/60s, 5/60s, 8/30s), Single and Multi Target lists tuned on their own
 * encounters, a Primary and a Secondary Potion with APL logic, Horde races only
 * (Orc, Undead, Troll for a Warlock).
 *
 *   PRESET=warlock_smds FILE=tools/optimise/warlockVariants80.ts \
 *     VARIANTS=w80SmRace WEIGHTED=1 ITER=300 npx vite-node tools/probe_build.ts
 *
 * THE THEME (Step 0), unchanged from round 78 and not moved here:
 *   SM/DS Affliction 35/11/5, Imp sacrificed; Firelock Destruction 7/11/33,
 *   Succubus sacrificed; Sbolt Spam 22/11/18, Imp sacrificed; Fire Demo
 *   Demonology 2/31/18, Succubus sacrificed + Imp out. Caster, E65, standing
 *   target. Every group carries its own control, `(p) => p`.
 *
 * OWNER LINES: all four Single Target lists are the owner's (the Life Tap
 * THRESHOLDS on SM/DS, Firelock and Fire Demo are this project's sweeps under
 * the owner's mana ruling). A variant labelled "QUESTION ONLY" rewrites or
 * reorders an owner line and is priced, never shipped.
 * ============================================================================
 */
import {
  type Variant,
  type Apply,
  WARLOCK_TREE as tree,
  apl,
  addAbove,
  chain,
  consumable,
  removePrecombat,
  inMulti,
  enchant,
} from '../buildVariants';
import {
  all,
  fightElapsed,
  fightRemaining,
  resource,
  resourceFraction,
  selfHas,
  targetCount,
  targetMissing,
  targetTime,
  targetHas,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import { RACIAL_COOLDOWNS } from '../../src/game/rotations/racialCooldowns';
import type { CharacterProfile } from '../../src/profiles';

/* ------------------------------------------------------------ helpers */

/** Re-gate the Nth entry for `abilityId` (0 = the first). */
const regate = (abilityId: string, condition: AplCondition | undefined, nth = 0): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === abilityId && ++seen === nth);
    if (at < 0) throw new Error('no entry for ' + abilityId);
    const { condition: _drop, ...rest } = entries[at];
    entries[at] = condition ? { ...rest, condition } : rest;
    return entries;
  });

const dropAll = (abilityId: string): Apply => apl((es) => es.filter((e) => e.abilityId !== abilityId));

const lifeTapBelow = (fraction: number) => regate('life_tap', resourceFraction('below', fraction, 'mana'));

const setRace =
  (r: string): Apply =>
  (p: CharacterProfile) => ({ ...p, character: { ...p.character, race: r as CharacterProfile['character']['race'] } });

/**
 * A race swap reaches the Single Target list by `syncDefaultRotation` (it is a
 * `default` list narrowed by race); the Multi Target list is stored `custom`
 * and carries no racial row, so the race's cooldown is put in it by hand --
 * after its first entry, which is where the Single Target lists hold them.
 */
const raceSwap = (r: string, mtAt = 0): Apply =>
  chain(
    setRace(r),
    inMulti(
      apl((es) => {
        const racials = RACIAL_COOLDOWNS.filter(
          (e) => !es.some((x) => x.abilityId === e.abilityId || x.sequence?.includes(e.abilityId)),
        );
        es.splice(mtAt, 0, ...racials);
        return es;
      }),
    ),
  );

const stone =
  (s: string): Apply =>
  (p: CharacterProfile) => ({ ...p, warlockStone: s as CharacterProfile['warlockStone'] });

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

const RACES = (shipped: string, mtAt = 0): Variant[] => [
  control('race (' + shipped + ')'),
  ...['orc', 'undead', 'troll']
    .filter((r) => r !== shipped)
    .map((r) => ({ label: `race ${shipped} -> ${r}`, apply: raceSwap(r, mtAt) })),
];

/* ============================================================ race */

export const VARIANT_GROUPS: Record<string, Variant[]> = {
  w80SmRace: RACES('human', 1),
  w80FlRace: RACES('human', 1),
  w80SbRace: RACES('orc', 1),
  w80DemoRace: RACES('human', 0),
};

/* ============================================================ talents (WEIGHTED) */

const SM: Record<string, number> = {
  suppression: 4, amplify_curse: 1, improved_corruption: 5, improved_drains: 3, improved_bane_of_agony: 2,
  pandemic: 3, malevolence: 5, nightfall: 2, siphon_life: 1, soul_siphon: 3, shadow_mastery: 5, wrack: 1,
  improved_shadow_bolt: 5, demonic_embrace: 5, demonic_aegis: 2, fel_vitality: 3, demonic_sacrifice: 1,
};
const FL: Record<string, number> = {
  improved_life_tap: 2, suppression: 5, demonic_embrace: 5, demonic_aegis: 2, fel_vitality: 3,
  demonic_sacrifice: 1, bane: 5, cataclysm: 3, aftermath: 5, ruin: 5, shadowburn: 1, agonizing_flames: 3,
  conflagrate: 1, bane_of_havoc: 1, fire_and_brimstone: 3, shadow_and_flame: 5, incinerate: 1,
};
const SB: Record<string, number> = {
  suppression: 5, improved_corruption: 5, improved_bane_of_agony: 2, amplify_curse: 1, pandemic: 3,
  malevolence: 4, nightfall: 2, demonic_embrace: 5, demonic_aegis: 2, improved_voidwalker: 3,
  demonic_sacrifice: 1, improved_shadow_bolt: 5, bane: 5, ruin: 5, agonizing_flames: 3,
};
const DEMO: Record<string, number> = {
  suppression: 2, unholy_power: 5, improved_imp: 3, demonic_embrace: 4, fel_vitality: 3, demonic_sacrifice: 1,
  demonic_brand: 3, decimation: 2, soul_link: 1, demonic_knowledge: 3, master_demonologist: 5, demonic_pact: 1,
  bane: 5, aftermath: 5, ruin: 5, agonizing_flames: 3,
};
const from = (base: Record<string, number>) => (changes: Record<string, number>) => {
  const out: Record<string, number> = { ...base, ...changes };
  for (const [k, v] of Object.entries(out)) if (v === 0) delete out[k];
  return tree(out);
};
const sm = from(SM);
const fl = from(FL);
const sb = from(SB);
const demo = from(DEMO);

VARIANT_GROUPS.w80SmTal = [
  control('tree'),
  { label: 'ISB 5 -> Bane 5', apply: sm({ improved_shadow_bolt: 0, bane: 5 }) },
  { label: 'Improved Drains 3 -> Improved Life Tap 2 + Grim Reach 1', apply: sm({ improved_drains: 0, improved_life_tap: 2, grim_reach: 1 }) },
  { label: 'Improved Bane of Agony 2 -> Improved Life Tap 2', apply: sm({ improved_bane_of_agony: 0, improved_life_tap: 2 }) },
  { label: 'Soul Siphon 3 -> Fel Concentration 3 (prices Soul Siphon)', apply: sm({ soul_siphon: 0, fel_concentration: 3 }) },
  { label: 'Demonic Aegis 2 -> Demonic Energies 2', apply: sm({ demonic_aegis: 0, demonic_energies: 2 }) },
  { label: 'Pandemic 3 -> Improved Life Tap 2 + Grim Reach 1', apply: sm({ pandemic: 0, improved_life_tap: 2, grim_reach: 1 }) },
];
VARIANT_GROUPS.w80FlTal = [
  control('tree'),
  { label: 'Improved Life Tap 2 -> Improved Corruption 2', apply: fl({ improved_life_tap: 0, improved_corruption: 2 }) },
  { label: 'Cataclysm 3 -> Molten Skin 3 (prices Cataclysm)', apply: fl({ cataclysm: 0, molten_skin: 3 }) },
  { label: 'Fire and Brimstone 3 -> Intensity 3 (prices F&B)', apply: fl({ fire_and_brimstone: 0, intensity: 3 }) },
  { label: 'Aftermath 5 -> Molten Skin 5 (prices Aftermath)', apply: fl({ aftermath: 0, molten_skin: 5 }) },
];
VARIANT_GROUPS.w80SbTal = [
  control('tree'),
  { label: 'NEEDS OWNER: Improved Voidwalker 3 -> Fel Vitality 3', apply: sb({ improved_voidwalker: 0, fel_vitality: 3 }) },
  { label: 'NEEDS OWNER: Agonizing Flames 3 -> Cataclysm 3', apply: sb({ agonizing_flames: 0, cataclysm: 3 }) },
];
VARIANT_GROUPS.w80DemoTal = [
  control('tree'),
  { label: 'Aftermath 5 -> Cataclysm 3 + Aftermath 2', apply: demo({ aftermath: 2, cataclysm: 3 }) },
  { label: 'Aftermath 5 -> Cataclysm 3 + Shadowburn 1 + Aftermath 1', apply: demo({ aftermath: 1, cataclysm: 3, shadowburn: 1 }) },
  { label: 'Demonic Embrace 4 -> Demonic Energies 2 + Demonic Aegis 2', apply: demo({ demonic_embrace: 0, demonic_energies: 2, demonic_aegis: 2 }) },
  { label: 'Suppression 2 -> Improved Life Tap 2 (hit -2)', apply: demo({ suppression: 0, improved_life_tap: 2 }) },
];

/* ============================================================ potions (Primary + Secondary) */

const POTS = ['major_mana_potion', 'major_spellblasting_potion'];
const MANA = (fraction: number, elapsed?: number): AplEntry => ({
  abilityId: 'major_mana_potion',
  condition:
    elapsed === undefined
      ? resourceFraction('below', fraction, 'mana')
      : all(resourceFraction('below', fraction, 'mana'), fightElapsed('atLeast', elapsed)),
});
const BLAST = (condition?: AplCondition): AplEntry => ({
  abilityId: 'major_spellblasting_potion',
  ...(condition ? { condition } : {}),
});
const LAST30 = fightRemaining('atMost', 30);

/** Select a Primary and a Secondary Potion and replace the list's potion rows with `entries`. */
const potionLogic = (primary: string, secondary: string, entries: readonly AplEntry[], inMt = false): Apply =>
  chain(
    consumable('potion', primary),
    consumable('potion_secondary', 'secondary_' + secondary),
    // the selection is the profile's and shared by both sections; only the
    // list edit goes inside `inMulti`, which writes back the lists alone
    (inMt ? inMulti : (a: Apply) => a)(apl((es) => {
      let at = es.findIndex((e) => POTS.includes(e.abilityId) && e.sequence === undefined);
      const kept = es.filter((e) => !(POTS.includes(e.abilityId) && e.sequence === undefined));
      if (at < 0) at = 0;
      at = Math.min(at, kept.length);
      kept.splice(at, 0, ...entries);
      return kept;
    })),
  );

const potionGroup = (inMt: boolean): Variant[] => {
  const B = 'major_spellblasting_potion';
  const M = 'major_mana_potion';
  return [
    control('potions'),
    { label: 'Blast + Mana: mana <50% after 60s, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.5, 60), BLAST(LAST30)], inMt) },
    { label: 'Blast + Mana: mana <50% after 30s, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.5, 30), BLAST(LAST30)], inMt) },
    { label: 'Blast + Mana: mana <30%, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.3), BLAST(LAST30)], inMt) },
    { label: 'Blast + Mana: mana <50%, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.5), BLAST(LAST30)], inMt) },
    { label: 'Blast + Mana: mana <20%, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.2), BLAST(LAST30)], inMt) },
    { label: 'Blast + Mana: mana <70%, else Blast in the last 30s', apply: potionLogic(B, M, [MANA(0.7), BLAST(LAST30)], inMt) },
    { label: 'Blast at the pull (Mana secondary, never reached)', apply: potionLogic(B, M, [BLAST(), MANA(0.5, 60)], inMt) },
    { label: 'Mana only, under 30%', apply: potionLogic(M, B, [MANA(0.3)], inMt) },
    { label: 'Blast held to the last 30s only', apply: potionLogic(B, M, [BLAST(LAST30)], inMt) },
  ];
};

VARIANT_GROUPS.w80PotST = potionGroup(false);
VARIANT_GROUPS.w80PotMT = potionGroup(true);

/* ============================================================ Single Target lists */

const shards = (compare: 'atLeast' | 'atMost', n: number) => resource(compare, n, 'soulShards');
const BOD_ABOVE_BOA = (boaFloor?: number): Apply =>
  chain(
    regate(
      'bane_of_agony',
      all(
        targetMissing('bane_of_agony'),
        targetMissing('bane_of_doom'),
        ...(boaFloor ? [fightRemaining('atLeast', boaFloor)] : []),
      ),
    ),
    addAbove({ abilityId: 'bane_of_doom', condition: all(targetMissing('bane_of_doom'), fightRemaining('atLeast', 61)) }, 'bane_of_agony'),
  );

VARIANT_GROUPS.w80SmST = [
  control('list'),
  { label: 'Life Tap below 3%', apply: lifeTapBelow(0.03) },
  { label: 'Life Tap below 8%', apply: lifeTapBelow(0.08) },
  { label: 'Life Tap below 12%', apply: lifeTapBelow(0.12) },
  {
    label: '+ Siphon Life interrupts Wrack',
    apply: apl((es) => es.map((e) => (e.abilityId === 'siphon_life' ? { ...e, interruptsChannel: true } : e))),
  },
  { label: 'Berserking held for a Wrack (only while Corruption + Bane up)', apply: regate('berserking', all(targetHas('corruption'), targetHas('bane_of_agony'))) },
  { label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain', apply: BOD_ABOVE_BOA() },
  { label: 'QUESTION ONLY: Shadow Bolt filler above Wrack', apply: apl((es) => { const i = es.findIndex((e) => e.abilityId === 'wrack'); es.splice(i, 0, { abilityId: 'shadow_bolt' }); return es; }) },
  { label: 'QUESTION ONLY: no Siphon Life', apply: dropAll('siphon_life') },
];

const conflagWhenImmolateAtMost = (s: number) => regate('conflagrate', targetTime('atMost', s, 'immolate'));
VARIANT_GROUPS.w80FlST = [
  control('list'),
  { label: 'Life Tap below 3%', apply: lifeTapBelow(0.03) },
  { label: 'Life Tap below 8%', apply: lifeTapBelow(0.08) },
  { label: 'QUESTION ONLY: Conflagrate only with Immolate <= 12s left', apply: conflagWhenImmolateAtMost(12) },
  { label: 'QUESTION ONLY: Conflagrate only with Immolate <= 9s left', apply: conflagWhenImmolateAtMost(9) },
  { label: 'QUESTION ONLY: Conflagrate only with Immolate <= 6s left', apply: conflagWhenImmolateAtMost(6) },
  { label: 'QUESTION ONLY: Conflagrate only with Immolate <= 3s left', apply: conflagWhenImmolateAtMost(3) },
  { label: '+ Soul Fire above Incinerate', apply: addAbove({ abilityId: 'soul_fire' }, 'incinerate') },
  { label: '+ Soul Fire above Incinerate, shards >= 3', apply: addAbove({ abilityId: 'soul_fire', condition: shards('atLeast', 3) }, 'incinerate') },
  { label: '+ Soul Fire above Incinerate, last 30s', apply: addAbove({ abilityId: 'soul_fire', condition: LAST30 }, 'incinerate') },
  { label: '+ Searing Pain above Incinerate (QUESTION: replaces the filler)', apply: addAbove({ abilityId: 'searing_pain' }, 'incinerate') },
  { label: '+ Shadow Bolt above Incinerate while Shadow and Flame (Shadow) is up', apply: addAbove({ abilityId: 'shadow_bolt', condition: selfHas('shadow_and_flame_shadow') }, 'incinerate') },
  { label: '+ Corruption (once, 19s floor) above Life Tap', apply: addAbove({ abilityId: 'corruption', condition: all(targetMissing('corruption'), fightRemaining('atLeast', 19)) }, 'life_tap') },
  { label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain', apply: BOD_ABOVE_BOA(25) },
];

VARIANT_GROUPS.w80DemoST = [
  control('list'),
  { label: 'Life Tap below 3%', apply: lifeTapBelow(0.03) },
  { label: 'Life Tap below 10%', apply: lifeTapBelow(0.1) },
  { label: 'no Corruption (the project added it)', apply: dropAll('corruption') },
  { label: '+ Soul Fire outside Decimation above Searing Pain, shards >= 6', apply: addAbove({ abilityId: 'soul_fire', condition: shards('atLeast', 6) }, 'searing_pain') },
  { label: '+ Shadow Bolt above Searing Pain in the Decimation phase', apply: addAbove({ abilityId: 'shadow_bolt', condition: fightRemaining('atMost', 42) }, 'searing_pain') },
  { label: '+ Immolate refresh at 0s (missing) instead of 1.5s -- QUESTION', apply: regate('immolate', all(targetMissing('immolate'), fightRemaining('atLeast', 3))) },
  { label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain', apply: BOD_ABOVE_BOA(25) },
];

VARIANT_GROUPS.w80SbST = [
  control('list'),
  { label: 'QUESTION ONLY: Life Tap below 5% (owner 10%)', apply: lifeTapBelow(0.05) },
  { label: 'QUESTION ONLY: Life Tap below 15% (owner 10%)', apply: lifeTapBelow(0.15) },
  { label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain', apply: BOD_ABOVE_BOA() },
];

/* ============================================================ Multi Target lists */

const mt = (...a: Apply[]): Apply => inMulti(...a);
const berserkBeforeHellfire: Apply = mt(dropAll('berserking'), addAbove({ abilityId: 'berserking' }, 'hellfire'));
const reDot = (id: string, n: number, floor: number, extra?: AplCondition): AplEntry => ({
  abilityId: id,
  condition: all(targetMissing(id), fightRemaining('atLeast', floor), ...(extra ? [extra] : [])),
  ...(n > 1 ? { multiDot: n } : {}),
});
const UP_TO = (n: number) => targetCount('atMost', n);
const interruptHellfire = (ids: string[]): Apply =>
  mt(apl((es) => es.map((e) => (ids.includes(e.abilityId) ? { ...e, interruptsChannel: true } : e))));
const tapAt = (mana: number): Apply => mt(regate('life_tap', resource('below', mana, 'mana')));

VARIANT_GROUPS.w80SmMT = [
  control('Multi Target list'),
  { label: 'Berserking just above Hellfire', apply: berserkBeforeHellfire },
  { label: 'DoT entries interrupt Hellfire', apply: interruptHellfire(['bane_of_agony', 'corruption']) },
  { label: '+ Siphon Life on the boss above the tap', apply: mt(addAbove(reDot('siphon_life', 1, 15), 'life_tap')) },
  { label: 'spread DoTs to 3 targets (not 5)', apply: mt(apl((es) => es.map((e) => (e.multiDot === 5 ? { ...e, multiDot: 3 } : e)))) },
  { label: 'spread DoTs at up to 8 targets too', apply: mt(apl((es) => es.map((e) => (e.multiDot === 5 ? { ...e, condition: all(targetMissing(e.abilityId), fightRemaining('atLeast', e.abilityId === 'corruption' ? 10 : 12)) } : e)))) },
  { label: 'Life Tap below 2000 mana', apply: tapAt(2000) },
  { label: 'Life Tap below 1000 mana', apply: tapAt(1000) },
  { label: 'no Amplify Curse', apply: mt(dropAll('amplify_curse')) },
  { label: '+ Rain of Fire above Hellfire at exactly 3 targets', apply: mt(addAbove({ abilityId: 'rain_of_fire', condition: targetCount('atMost', 3) }, 'life_tap')) },
];

VARIANT_GROUPS.w80FlMT = [
  control('Multi Target list'),
  { label: 'Berserking just above Hellfire', apply: berserkBeforeHellfire },
  { label: 'Immolate on up to 3 targets at <= 4 targets', apply: mt(apl((es) => es.map((e) => (e.abilityId === 'immolate' ? { ...e, multiDot: 3 } : e)))) },
  { label: '+ Bane of Agony walked over 3 targets at <= 4', apply: mt(addAbove({ ...reDot('bane_of_agony', 3, 12), condition: all(UP_TO(4), targetMissing('bane_of_agony'), fightRemaining('atLeast', 12)) }, 'life_tap')) },
  { label: '+ Corruption on the boss (S&F Shadow) above the tap', apply: mt(addAbove(reDot('corruption', 1, 10), 'life_tap')) },
  { label: 'no Shadowburn', apply: mt(dropAll('shadowburn')) },
  { label: 'Life Tap below 2000 mana', apply: tapAt(2000) },
  { label: 'no Havoc (and none in the opener)', apply: chain(mt(dropAll('bane_of_havoc')), mt(removePrecombat('bane_of_havoc'))) },
  { label: 'Immolate+Conflag+Bane only at <= 3 targets', apply: mt(apl((es) => es.map((e) => (['immolate', 'conflagrate', 'bane_of_agony'].includes(e.abilityId) && e.condition ? { ...e, condition: { ...(e.condition as any), of: (e.condition as any).of.map((c: any) => (c.kind === 'targetCount' ? targetCount('atMost', 3) : c)) } } : e)))) },
];

VARIANT_GROUPS.w80DemoMT = [
  control('Multi Target list'),
  { label: 'Berserking just above Hellfire', apply: berserkBeforeHellfire },
  { label: 'Immolate on up to 3 targets (not 5)', apply: mt(apl((es) => es.map((e) => (e.abilityId === 'immolate' ? { ...e, multiDot: 3 } : e)))) },
  { label: '+ Bane of Agony on the boss above the tap', apply: mt(addAbove(reDot('bane_of_agony', 1, 12), 'life_tap')) },
  { label: '+ Corruption on the boss above the tap', apply: mt(addAbove(reDot('corruption', 1, 10), 'life_tap')) },
  { label: 'Life Tap below 2000 mana', apply: tapAt(2000) },
  { label: 'Immolate also at 5 targets (up to 5)', apply: mt(apl((es) => es.map((e) => (e.abilityId === 'immolate' ? { ...e, condition: all(UP_TO(5), targetTime('atMost', 1.5, 'immolate'), fightRemaining('atLeast', 3)) } : e)))) },
];

VARIANT_GROUPS.w80SbMT = [
  control('Multi Target list'),
  { label: 'DoT entries interrupt Hellfire', apply: interruptHellfire(['bane_of_agony', 'corruption']) },
  { label: 'spread DoTs to 3 targets (not 5)', apply: mt(apl((es) => es.map((e) => (e.multiDot === 5 ? { ...e, multiDot: 3 } : e)))) },
  { label: 'Life Tap below 2000 mana', apply: tapAt(2000) },
  { label: 'Life Tap below 1000 mana', apply: tapAt(1000) },
];

/* ============================================================ stones and other consumables (WEIGHTED) */

VARIANT_GROUPS.w80Stone = [
  control('stone'),
  { label: 'stone -> Spellstone', apply: stone('spellstone') },
  { label: 'stone -> Firestone', apply: stone('firestone') },
  { label: 'stone -> none', apply: stone('none') },
];
VARIANT_GROUPS.w80Other = [
  control('consumables'),
  { label: 'other: Demonic Rune -> Healthstone', apply: consumable('other', 'healthstone') },
  { label: 'school spell power -> Shadow', apply: consumable('school_spell_power', 'school_shadow') },
  { label: 'school spell power -> Fire', apply: consumable('school_spell_power', 'school_fire') },
];

/* Sbolt Spam: the owner's sequence opens with the Spellblasting Potion, so a
 * Secondary Potion goes BELOW it and can only be reached after two minutes. */
const afterSequence = (...entries: AplEntry[]): Apply =>
  apl((es) => {
    const at = es.findIndex((e) => e.sequence !== undefined);
    es.splice(at + 1, 0, ...entries);
    return es;
  });
const sbPotions = (inMt: boolean): Variant[] => {
  const wrap = (a: Apply): Apply => (inMt ? inMulti(a) : a);
  const secondary = chain(consumable('potion_secondary', 'secondary_major_mana_potion'));
  return [
    control('potions'),
    { label: '+ Mana secondary under 50% after 60s, below the sequence', apply: chain(secondary, wrap(afterSequence(MANA(0.5, 60)))) },
    {
      label: 'QUESTION ONLY: sequence without its potion; Mana <30%, else Blast in the last 30s',
      apply: chain(
        secondary,
        wrap(
          apl((es) => {
            const at = es.findIndex((e) => e.sequence !== undefined);
            const seq = es[at];
            es[at] = { ...seq, abilityId: seq.sequence![0], sequence: seq.sequence!.slice(1) };
            es.splice(at + 1, 0, MANA(0.3), BLAST(LAST30));
            return es;
          }),
        ),
      ),
    },
  ];
};
VARIANT_GROUPS.w80SbPotST = sbPotions(false);
VARIANT_GROUPS.w80SbPotMT = sbPotions(true);

/* ============================================================ enchants (WEIGHTED, legal for the slot) */
VARIANT_GROUPS.w80Ench = [
  control('enchants'),
  { label: 'head +1% Haste -> +8 Intellect', apply: enchant('head', 900006) },
  { label: 'head +1% Haste -> +8 Spirit', apply: enchant('head', 900007) },
  { label: 'legs +1% Haste -> +8 Intellect', apply: enchant('legs', 900006) },
  { label: 'gloves +20 Spell Power -> +1% Haste', apply: enchant('gloves', 900002) },
  { label: 'feet Minor Speed -> +7 Stamina', apply: enchant('feet', 900027) },
  { label: 'cloak -2% Threat -> +5 Agility', apply: enchant('cloak', 900011) },
  { label: 'weapon +65 Spell Power -> Enchant Weapon - Spell Power', apply: enchant('twoHand', 22749) },
];

const corr = (floor: number): AplEntry => ({ abilityId: 'corruption', condition: all(targetMissing('corruption'), fightRemaining('atLeast', floor)) });
VARIANT_GROUPS.w80FlST2 = [
  control('list'),
  { label: '+ Corruption (19s floor) above Life Tap', apply: addAbove(corr(19), 'life_tap') },
  { label: '+ Corruption (10s floor) above Life Tap', apply: addAbove(corr(10), 'life_tap') },
  { label: '+ Corruption (30s floor) above Life Tap', apply: addAbove(corr(30), 'life_tap') },
  { label: '+ Corruption (19s floor) above Bane of Havoc (below the consumables)', apply: addAbove(corr(19), 'bane_of_havoc') },
  { label: '+ Corruption (19s floor) only while S&F Shadow is up', apply: addAbove({ ...corr(19), condition: all(targetMissing('corruption'), fightRemaining('atLeast', 19), selfHas('shadow_and_flame_shadow')) }, 'life_tap') },
  { label: 'QUESTION ONLY: pull with Immolate (1.5s) instead of Incinerate', apply: chain(removePrecombat('incinerate'), (p) => ({ ...p, precombat: [{ abilityId: 'immolate', secondsBefore: 1.5 }, ...(p.precombat ?? [])] })) },
  { label: '+ Corruption (19s) and QUESTION: Bane of Doom above Bane of Agony', apply: chain(addAbove(corr(19), 'life_tap'), BOD_ABOVE_BOA(25)) },
];
VARIANT_GROUPS.w80DemoST2 = [
  control('list'),
  { label: 'QUESTION ONLY: pull with Immolate (1.5s) instead of Searing Pain', apply: chain(removePrecombat('searing_pain'), (p) => ({ ...p, precombat: [{ abilityId: 'immolate', secondsBefore: 1.5 }, ...(p.precombat ?? [])] })) },
  { label: 'Corruption floor 19s -> 10s', apply: regate('corruption', all(targetMissing('corruption'), fightRemaining('atLeast', 10))) },
  { label: 'Corruption floor 19s -> 30s', apply: regate('corruption', all(targetMissing('corruption'), fightRemaining('atLeast', 30))) },
  { label: 'Soul Fire under Decimation only with shards >= 2 (keep one)', apply: regate('soul_fire', all(selfHas('decimation'), shards('atLeast', 2))) },
];

const immolateMulti = (n: number): Apply => mt(apl((es) => es.map((e) => (e.abilityId === 'immolate' ? { ...e, multiDot: n } : e))));
VARIANT_GROUPS.w80FlMT2 = [
  control('Multi Target list'),
  { label: 'Immolate on up to 2 targets at <= 4', apply: immolateMulti(2) },
  { label: 'Immolate on up to 3 targets at <= 4', apply: immolateMulti(3) },
  { label: 'Immolate on up to 4 targets at <= 4', apply: immolateMulti(4) },
  {
    label: 'Immolate on 3 at <= 4, and Conflagrate walked too',
    apply: chain(immolateMulti(3), mt(apl((es) => es.map((e) => (e.abilityId === 'conflagrate' ? { ...e, multiDot: 3 } : e))))),
  },
  {
    label: 'Immolate on 3 at <= 4, Conflagrate only with Immolate <= 3s',
    apply: chain(immolateMulti(3), mt(regate('conflagrate', all(targetCount('atMost', 4), targetTime('atMost', 3, 'immolate'))))),
  },
];
VARIANT_GROUPS.w80DemoMT2 = [
  control('Multi Target list'),
  { label: '+ Bane of Agony on the boss at <= 4 targets', apply: mt(addAbove({ ...reDot('bane_of_agony', 1, 12, UP_TO(4)) }, 'life_tap')) },
];

/* ============================================================ Needs the owner: race and demon */
const seqSwap = (from: string, to: string): Apply =>
  apl((es) => es.map((e) => (e.sequence?.includes(from) ? { ...e, sequence: e.sequence.map((x) => (x === from ? to : x)) } : e)));
VARIANT_GROUPS.w80SbTroll = [
  control('race (orc)'),
  { label: 'NEEDS OWNER: Troll, Berserking in the sequence for Blood Fury', apply: chain(setRace('troll'), seqSwap('blood_fury', 'berserking'), inMulti(seqSwap('blood_fury', 'berserking'))) },
  { label: 'NEEDS OWNER: Undead, the sequence without Blood Fury', apply: chain(setRace('undead'), apl((es) => es.map((e) => (e.sequence?.includes('blood_fury') ? { ...e, sequence: e.sequence.filter((x) => x !== 'blood_fury') } : e))), inMulti(apl((es) => es.map((e) => (e.sequence?.includes('blood_fury') ? { ...e, sequence: e.sequence.filter((x) => x !== 'blood_fury') } : e))))) },
];
VARIANT_GROUPS.w80DemoDemon = [
  control('demons'),
  {
    label: 'summon the Succubus, sacrifice the Imp',
    apply: (p) => ({ ...p, character: { ...p.character, petFamily: 'imp', summonedDemon: 'succubus' } }),
  },
];
VARIANT_GROUPS.w80SbOwnerPackage = [
  control('Sbolt build'),
  {
    label: 'NEEDS OWNER: school Shadow + Spellstone + Fel Vitality 3',
    apply: chain(consumable('school_spell_power', 'school_shadow'), stone('spellstone'), sb({ improved_voidwalker: 0, fel_vitality: 3 })),
  },
  {
    label: 'NEEDS OWNER: the above + Troll (Berserking in the sequence)',
    apply: chain(consumable('school_spell_power', 'school_shadow'), stone('spellstone'), sb({ improved_voidwalker: 0, fel_vitality: 3 }), setRace('troll'), seqSwap('blood_fury', 'berserking'), inMulti(seqSwap('blood_fury', 'berserking'))),
  },
];
VARIANT_GROUPS.w80DemoCheck = [
  control('round 80 Fire Demo'),
  { label: 'back to Human (old race)', apply: setRace('human') },
  { label: 'back to mana-only under 30% (old potion)', apply: potionLogic('major_mana_potion', 'major_spellblasting_potion', [MANA(0.3)]) },
  { label: 'both back', apply: chain(setRace('human'), potionLogic('major_mana_potion', 'major_spellblasting_potion', [MANA(0.3)])) },
];
VARIANT_GROUPS.w80BerserkST = [
  control('Berserking at the pull'),
  { label: 'Berserking after 30s', apply: regate('berserking', fightElapsed('atLeast', 30)) },
  { label: 'Berserking after 60s', apply: regate('berserking', fightElapsed('atLeast', 60)) },
  { label: 'Berserking in the last 42s (Decimation phase)', apply: regate('berserking', fightRemaining('atMost', 42)) },
  { label: 'Berserking in the last 30s (with the Blast window)', apply: regate('berserking', fightRemaining('atMost', 30)) },
  { label: 'Berserking in the last 12s', apply: regate('berserking', fightRemaining('atMost', 12)) },
];
