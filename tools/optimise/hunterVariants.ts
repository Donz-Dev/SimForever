/*
 * ==============================================================================
 * ROUND 78 -- THE FOUR HUNTER PRESETS, optimised for the full report's
 * encounters: Single Target 120s (1 target) and Multi Target 60s (5 targets,
 * reused at 3 targets/60s and 8 targets/30s).
 *
 *   PRESET=bm_hunter FILE=tools/optimise/hunterVariants.ts VARIANTS=bmTalents \
 *     DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=bm_hunter FILE=tools/optimise/hunterVariants.ts VARIANTS=bmAoe \
 *     TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE THEME, five invariants per profile, which no variant here moves:
 *
 * | preset     | class  | majority tree        | style / weapons          | stance | target swings |
 * | ---------- | ------ | -------------------- | ------------------------ | ------ | ------------- |
 * | bm_hunter  | hunter | 31 Beast Mastery     | ranged, bow + Cat pet    | n/a    | no            |
 * | lw_ranged  | hunter | 41 Marksmanship      | ranged, bow, no pet      | n/a    | no            |
 * | lw_melee   | hunter | 33 Survival          | dual wield, no pet       | n/a    | no            |
 * | hawk_melee | hunter | 24 Survival (16 BM)  | dual wield, no pet, hawk | n/a    | no            |
 *
 * WHAT THE BUILDS ARE AT 120s (probe_clock, 40 fights, before this round):
 *
 *   bm_hunter   965.5  mana headroom 1.1%   -- MANA-BOUND. Ranged Auto 34%,
 *               Hawk 14%, Cat 13%, Aimed 15%, Serpent Sting 10%
 *   lw_ranged   936.9  mana headroom 0.8%   -- MANA-BOUND, and Serpent Sting's
 *               uptime falls 97.9% -> 79.7% between 60s and 120s
 *   lw_melee    852.8  mana headroom 47.8%  -- GCD/cooldown-bound
 *   hawk_melee  924.6  mana headroom 34.7%  -- GCD/cooldown-bound
 *
 * So the two ranged builds are a damage-per-MANA question at 120s, and the two
 * melee builds are not.
 *
 * Every group carries a control labelled "the shipped ...", which is whatever
 * is on the branch when the group runs.
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
} from '../buildVariants';
import type { AplEntry } from '../../src/game/rotations/apl';
import type { AplCondition } from '../../src/game/rotations/apl';
import { all, resource, targetCount, targetTime, any } from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character';
import { foreverEnchantId as ench } from '../../src/game/items/foreverEnchants';

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

/* ---------------------------------------------------------------- helpers */

/** An entry for `id`, edited in place; throws when the list has none. */
const editEntry = (id: string, edit: (entry: AplEntry) => AplEntry): Apply =>
  apl((entries) => {
    const at = entries.findIndex((e) => e.abilityId === id);
    if (at < 0) throw new Error(`no entry for ${id}`);
    entries[at] = edit(entries[at]);
    return entries;
  });

/** Gate an entry on a mana floor, ANDed with whatever condition it had. */
const manaFloor = (id: string, floor: number): Apply =>
  editEntry(id, (e) => ({
    ...e,
    condition: e.condition ? { kind: 'all', of: [e.condition, resource('atLeast', floor, 'mana')] } : resource('atLeast', floor, 'mana'),
  }));

/**
 * THE COOLDOWN STACK, LED BY A COOLDOWN RATHER THAN BY THE FRENZY POTION.
 * The stock stack's entry IS `major_frenzy_potion`, so any build that does not
 * carry that potion -- a Major Mana Potion in the slot, say -- has the whole
 * entry dropped by `withoutUnselectedConsumables` and loses Rapid Fire, Bestial
 * Wrath and the racial with it. Led by the first cooldown, the potion becomes a
 * step that is skipped when it is not in the book.
 */
const stackLedBy = (first: string): Apply =>
  apl((entries) =>
    entries.map((e) =>
      e.abilityId === 'major_frenzy_potion' && e.sequence
        ? {
            ...e,
            abilityId: first,
            sequence: ['major_frenzy_potion', ...e.sequence.filter((s) => s !== first)],
          }
        : e,
    ),
  );

const weave = (options: readonly string[]): AplEntry => ({ abilityId: 'melee_weave', weave: options });

const race = (id: RaceId): Variant => ({
  label: `race ${id}`,
  apply: (p) => ({ ...p, character: { ...p.character, race: id } }),
});
const HUNTER_RACES: readonly RaceId[] = [
  'human',
  'dwarf',
  'night_elf',
  'high_order_skyborne',
  'tauren',
  'troll',
  'windshaper_skyborne',
];

/* ------------------------------------------------------------- the trees */

const BM_BEAST_MASTERY = {
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

const LWR = {
  deadly_aspects: 5,
  lethal_attacks: 5,
  improved_stings: 3,
  careful_aim: 5,
  improved_arcane_shot: 5,
  lone_wolf: 1,
  trueshot_aura: 1,
  mortal_shots: 5,
  barrage: 3,
  ranged_weapon_specialization: 5,
  sniper_shot: 1,
  improved_tracking: 5,
};

const LWM = {
  deadly_aspects: 5,
  lethal_attacks: 5,
  careful_aim: 5,
  lone_wolf: 1,
  improved_tracking: 5,
  savage_strikes: 2,
  survivalist: 4,
  surefooted: 3,
  deterrence: 1,
  predator_s_edge: 5,
  resourcefulness: 2,
  expose_prey: 2,
  strider_kick: 1,
  lightning_reflexes: 5,
  lacerating_strikes: 1,
};

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
  surefooted: 3,
  predator_s_edge: 5,
  resourcefulness: 1,
  expose_prey: 2,
  strider_kick: 1,
};

/* --------------------------------------------------- the Multi Target lists */

/** Insert `entry` above `beforeId` in a plain entry array. */
const insertAbove = (entries: AplEntry[], entry: AplEntry, beforeId: string): AplEntry[] => {
  const at = entries.findIndex((e) => e.abilityId === beforeId);
  if (at < 0) throw new Error(`no entry for ${beforeId}`);
  return [...entries.slice(0, at), entry, ...entries.slice(at)];
};

/**
 * A Multi Target list built FROM the Single Target one, so the cooldown stack,
 * the racials and the consumables arrive in the positions the stock list puts
 * them and nothing is retyped.
 */
const aoeFrom =
  (name: string, edit: (entries: AplEntry[]) => AplEntry[]): Apply =>
  (p) =>
    multiList(name, edit([...p.rotation.entries]))(p);

/* ------------------------------------------------------------ the groups */

/* ------------------------------------------------ the first-pass winners */

const BM_TREE_WIN = tree({ ...BM_BEAST_MASTERY, lethal_attacks: 5, improved_stings: 2, efficiency: 3, careful_aim: 5, mortal_shots: 5 });
const LWR_TREE_WIN = tree({ ...LWR, efficiency: 3, rapid_killing: 2, rapid_recuperation: 2 });
const LWM_TREE_WIN = tree({ ...LWM, rapid_killing: 2, clever_traps: 2 });
const HWK_TREE_WIN = tree({ ...HWK, survivalist: 3, clever_traps: 2 });

const INT_HEAD_LEGS = chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect')));
const BLASTED_INT = consumable('blasted_lands', 'blasted_intellect');
const OH_AGI = enchant('offHand', ench('+25 Agility'));
const BOTH_AGI = chain(enchant('mainHand', ench('+25 Agility')), OH_AGI);

const stingReserve = chain(
  ...['aimed_shot', 'arcane_shot', 'sniper_shot'].map((id) =>
    editEntry(id, (e) => ({ ...e, condition: any(targetTime('atLeast', 3, 'serpent_sting'), resource('atLeast', 560, 'mana')) })),
  ),
);

/** The ranged AoE shape: Multi-Shot over Aimed, Volley, a trap weave, a Multi-DoT sting. */
const rangedAoe = (
  name: string,
  opts: { volleyAbove?: string; trap?: 'weave' | 'none'; multiDot?: number },
): Apply =>
  aoeFrom(name, (e) => {
    let out = insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot');
    if (opts.volleyAbove) out = insertAbove(out, { abilityId: 'volley' }, opts.volleyAbove);
    else out = [...out, { abilityId: 'volley' }];
    if (opts.trap === 'weave') out = insertAbove(out, weave(['explosive_trap']), 'serpent_sting');
    if (opts.multiDot) out = out.map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: opts.multiDot } : x));
    return out;
  });

const meleeAoe = (name: string, aboveRaptor: boolean): Apply =>
  aoeFrom(name, (e) =>
    aboveRaptor
      ? insertAbove(e.filter((x) => x.abilityId !== 'immolation_trap'), { abilityId: 'explosive_trap' }, 'raptor_strike')
      : e.map((x) => (x.abilityId === 'immolation_trap' ? { abilityId: 'explosive_trap' } : x)),
  );

const BM_WEAVE = addAbove(weave(['immolation_trap']), 'serpent_sting');
const LWR_LIST = chain(addAbove(weave(['immolation_trap']), 'serpent_sting'), moveAbove('arcane_shot', 'aimed_shot'), stingReserve);

/** LW Ranged at several targets: a trap weave, the sting, Multi-Shot, then Volley as the floor. */
const lwrAoeList = (multiDot: number | undefined): Apply =>
  aoeFrom('LW Ranged AoE', (e) => {
    let out = insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot');
    out = insertAbove(out, { abilityId: 'volley' }, 'aimed_shot');
    out = insertAbove(out, weave(['explosive_trap']), 'serpent_sting');
    return multiDot ? out.map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot } : x)) : out;
  });

/** AND a condition onto an entry's own. */
const andCond = (e: AplEntry, c: AplCondition): AplEntry => ({ ...e, condition: e.condition ? all(e.condition, c) : c });

/** Serpent Sting split by the count: Multi-DoT `md` up to five targets, the boss alone above that. */
const splitSting = (entries: AplEntry[], md: number): AplEntry[] =>
  entries.flatMap((x) =>
    x.abilityId === 'serpent_sting'
      ? [andCond({ ...x, multiDot: md }, targetCount('atMost', 5)), andCond(x, targetCount('atLeast', 6))]
      : [x],
  );

/** BM at several targets, with Volley lifted above the sting from six targets. */
const bmAoeGated = (volleyGate: boolean): Apply =>
  aoeFrom('BM AoE', (e) => {
    let out = insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot');
    out = [...out, { abilityId: 'volley' }];
    out = insertAbove(out, weave(['explosive_trap']), 'serpent_sting');
    if (volleyGate) out = insertAbove(out, { abilityId: 'volley', condition: targetCount('atLeast', 6) }, 'serpent_sting');
    return splitSting(out, 3);
  });

const lwrAoeGated = (volleyGate: boolean): Apply =>
  aoeFrom('LW Ranged AoE', (e) => {
    let out = insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot');
    out = insertAbove(out, { abilityId: 'volley' }, 'aimed_shot');
    out = insertAbove(out, weave(['explosive_trap']), 'serpent_sting');
    if (volleyGate) out = insertAbove(out, { abilityId: 'volley', condition: targetCount('atLeast', 6) }, 'serpent_sting');
    return splitSting(out, 3);
  });

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ======================================================== BM HUNTER */

  /*
   * BM's design space is two points below Marksmanship tier 15, plus Hawk
   * Eye's three -- range, and therefore dead -- which can move to any other
   * tier-0/5/10 Marksmanship talent without stranding Mortal Shots.
   */
  h78bmTalents: [
    control('BM tree'),
    {
      label: 'BM: Improved Stings 2 -> Efficiency 2',
      apply: tree({ ...BM_BEAST_MASTERY, hawk_eye: 3, lethal_attacks: 5, efficiency: 2, careful_aim: 5, mortal_shots: 5 }),
    },
    {
      label: 'BM: Hawk Eye 3 -> Efficiency 3 (Stings 2 kept)',
      apply: tree({ ...BM_BEAST_MASTERY, lethal_attacks: 5, improved_stings: 2, efficiency: 3, careful_aim: 5, mortal_shots: 5 }),
    },
    {
      label: 'BM: Hawk Eye 3 -> Improved Arcane Shot 3',
      apply: tree({
        ...BM_BEAST_MASTERY,
        lethal_attacks: 5,
        improved_stings: 2,
        careful_aim: 5,
        improved_arcane_shot: 3,
        mortal_shots: 5,
      }),
    },
    {
      label: 'BM: Hawk Eye 3 + Stings 2 -> Efficiency 5',
      apply: tree({ ...BM_BEAST_MASTERY, lethal_attacks: 5, efficiency: 5, careful_aim: 5, mortal_shots: 5 }),
    },
    {
      label: 'BM: Hawk Eye 3 -> Stings 3 + Efficiency 2',
      apply: tree({ ...BM_BEAST_MASTERY, lethal_attacks: 5, improved_stings: 3, efficiency: 2, careful_aim: 5, mortal_shots: 5 }),
    },
  ],

  h78bmPrecombat: [
    control('BM opener'),
    { label: 'BM: + Serpent Sting at 0s (pure DoT)', apply: addPrecombat(0, 'serpent_sting') },
    { label: 'BM: + Immolation Trap at 0s (pure DoT)', apply: addPrecombat(0, 'immolation_trap') },
  ],

  h78bmApl: [
    control('BM list'),
    { label: 'BM: + Melee Weave (Immolation Trap) above Serpent Sting', apply: addAbove(weave(['immolation_trap']), 'serpent_sting') },
    { label: 'BM: + Melee Weave (Immolation Trap) above Aimed Shot', apply: addAbove(weave(['immolation_trap']), 'aimed_shot') },
    { label: 'BM: + Melee Weave (Immolation Trap) at the bottom', apply: apl((e) => [...e, weave(['immolation_trap'])]) },
    { label: 'BM: Aimed Shot at mana >= 500', apply: manaFloor('aimed_shot', 500) },
    { label: 'BM: Aimed Shot at mana >= 750', apply: manaFloor('aimed_shot', 750) },
    { label: 'BM: Aimed + Arcane at mana >= 500', apply: chain(manaFloor('aimed_shot', 500), manaFloor('arcane_shot', 500)) },
    { label: 'BM: Arcane Shot above Aimed Shot', apply: moveAbove('arcane_shot', 'aimed_shot') },
    { label: 'BM: Summon Hawk above Serpent Sting', apply: moveAbove('summon_hawk', 'serpent_sting') },
  ],

  /*
   * BM AT FIVE TARGETS. Multi-Shot shares Aimed Shot's cooldown group, so
   * above it it REPLACES it. Traps go through the Melee Weave -- the owner's
   * model of a ranged Hunter trapping -- and are priced cast directly too.
   */
  h78bmAoe: [
    control('BM Multi Target section (the Single Target list)'),
    { label: 'BM5: Multi-Shot above Aimed', apply: aoeFrom('BM AoE', (e) => insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot')) },
    {
      label: 'BM5: Multi-Shot + Volley above it',
      apply: aoeFrom('BM AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot'),
      ),
    },
    {
      label: 'BM5: Multi-Shot + Volley at the bottom',
      apply: aoeFrom('BM AoE', (e) => [...insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }]),
    },
    {
      label: 'BM5: Multi-Shot + Weave(Explosive) above Sting',
      apply: aoeFrom('BM AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), weave(['explosive_trap']), 'serpent_sting'),
      ),
    },
    {
      label: 'BM5: Multi-Shot + Explosive Trap cast directly above Sting',
      apply: aoeFrom('BM AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'explosive_trap' }, 'serpent_sting'),
      ),
    },
    {
      label: 'BM5: Multi-Shot + Serpent Sting Multi-DoT 3',
      apply: aoeFrom('BM AoE', (e) =>
        insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot').map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: 3 } : x)),
      ),
    },
    {
      label: 'BM5: Multi-Shot + Serpent Sting Multi-DoT 5',
      apply: aoeFrom('BM AoE', (e) =>
        insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot').map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: 5 } : x)),
      ),
    },
  ],

  h78bmConsumables: [
    control('BM consumables'),
    { label: 'BM: stack led by Bestial Wrath (structure only)', apply: stackLedBy('bestial_wrath') },
    {
      label: 'BM: Major Mana Potion (was Frenzy), stack led by Bestial Wrath',
      apply: chain(consumable('potion', 'major_mana_potion'), stackLedBy('bestial_wrath')),
    },
    { label: 'BM: other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
    { label: 'BM: Blasted Lands +25 Intellect (was Agility)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'BM: food +40 Attack Power (was +20 Agility)', apply: consumable('food', 'food_attack_power') },
  ],

  /*
   * ENCHANTS, off stat_weights at DURATION=120 (800 paired iterations): BM
   * reads intellect at 0.703 a point against agility's 0.638 and 1% haste at
   * 2.51 -- so the head and legs +8 Intellect are about +0.5 each and the rest
   * stay agility. Only the pairs are fought.
   */
  h78bmEnchants: [
    control('BM enchants'),
    { label: 'BM: head + legs +8 Intellect (was +8 Agility)', apply: chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect'))) },
    {
      label: 'BM: head + legs +8 Intellect, Blasted Lands Intellect',
      apply: chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect')), consumable('blasted_lands', 'blasted_intellect')),
    },
  ],

  h78bmCombined: [
    control('BM build'),
    { label: 'BM C1: Efficiency 3 + Weave above Sting', apply: chain(BM_TREE_WIN, BM_WEAVE) },
    { label: 'BM C2: C1 + Intellect head/legs/Blasted Lands', apply: chain(BM_TREE_WIN, BM_WEAVE, INT_HEAD_LEGS, BLASTED_INT) },
    { label: 'BM C3: C1 + Human', apply: chain(BM_TREE_WIN, BM_WEAVE, race('human').apply) },
    { label: 'BM C4: C1 + High Order Skyborne', apply: chain(BM_TREE_WIN, BM_WEAVE, race('high_order_skyborne').apply) },
    { label: 'BM C5: Efficiency 3 only', apply: BM_TREE_WIN },
  ],

  h78bmAoeCombined: [
    control('BM Multi Target section'),
    { label: 'BM A1: Multi + Volley bottom + Weave(Explosive) + Sting MD5', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 5 })) },
    { label: 'BM A2: A1, Volley above Sting', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { volleyAbove: 'serpent_sting', trap: 'weave', multiDot: 5 })) },
    { label: 'BM A3: A1 without the trap', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { multiDot: 5 })) },
    { label: 'BM A4: A1 without Multi-DoT', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave' })) },
    { label: 'BM A5: A1, Multi-DoT 3', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 3 })) },
    { label: 'BM A6: A1, Volley above Multi-Shot', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { volleyAbove: 'multi_shot', trap: 'weave', multiDot: 5 })) },
  ],

  h78bmAoeRace: [
    control('BM build, Multi Target'),
    { label: 'BM A5 (Orc)', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 3 })) },
    { label: 'BM A5 + Human', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 3 }), race('human').apply) },
    { label: 'BM A5 + High Order Skyborne', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 3 }), race('high_order_skyborne').apply) },
  ],

  h78bmAoeGated: [
    control('BM Multi Target section'),
    { label: 'BM A5 (ungated)', apply: chain(BM_TREE_WIN, rangedAoe('BM AoE', { trap: 'weave', multiDot: 3 })) },
    { label: 'BM G0: A5, sting split by count', apply: chain(BM_TREE_WIN, bmAoeGated(false)) },
    { label: 'BM G1: G0 + Volley above Sting from 6 targets', apply: chain(BM_TREE_WIN, bmAoeGated(true)) },
  ],

  h78bmRace: [control('BM race (Orc)'), ...HUNTER_RACES.map(race)],

  /* ======================================================== LW RANGED */

  h78lwrTalents: [
    control('LW Ranged tree'),
    {
      label: 'LWR: Efficiency 4 -> Rapid Killing 2 + Rapid Recuperation 2',
      apply: tree({ ...LWR, hawk_eye: 3, rapid_killing: 2, rapid_recuperation: 2 }),
    },
    {
      label: 'LWR: ... and Hawk Eye 3 -> Efficiency 3',
      apply: tree({ ...LWR, efficiency: 3, rapid_killing: 2, rapid_recuperation: 2 }),
    },
    {
      label: 'LWR: Hawk Eye 3 -> Efficiency +1 and Rapid Killing 2',
      apply: tree({ ...LWR, efficiency: 5, rapid_killing: 2 }),
    },
  ],

  h78lwrPrecombat: [
    control('LW Ranged opener'),
    { label: 'LWR: + Serpent Sting at 0s (pure DoT)', apply: addPrecombat(0, 'serpent_sting') },
    { label: 'LWR: + Immolation Trap at 0s (pure DoT)', apply: addPrecombat(0, 'immolation_trap') },
  ],

  h78lwrApl: [
    control('LW Ranged list'),
    { label: 'LWR: + Melee Weave above Serpent Sting', apply: addAbove(weave(['immolation_trap']), 'serpent_sting') },
    { label: 'LWR: + Melee Weave above Aimed Shot', apply: addAbove(weave(['immolation_trap']), 'aimed_shot') },
    { label: 'LWR: + Melee Weave at the bottom', apply: apl((e) => [...e, weave(['immolation_trap'])]) },
    {
      label: 'LWR: Aimed/Arcane/Sniper at mana >= 500',
      apply: chain(manaFloor('aimed_shot', 500), manaFloor('arcane_shot', 500), manaFloor('sniper_shot', 500)),
    },
    {
      label: 'LWR: Aimed/Arcane/Sniper at mana >= 650',
      apply: chain(manaFloor('aimed_shot', 650), manaFloor('arcane_shot', 650), manaFloor('sniper_shot', 650)),
    },
    {
      label: 'LWR: Sniper only at mana >= 600',
      apply: manaFloor('sniper_shot', 600),
    },
    {
      label: 'LWR: shots wait for the sting (Sting > 3s left or mana >= 560)',
      apply: chain(
        ...['aimed_shot', 'arcane_shot', 'sniper_shot'].map((id) =>
          editEntry(id, (e) => ({ ...e, condition: any(targetTime('atLeast', 3, 'serpent_sting'), resource('atLeast', 560, 'mana')) })),
        ),
      ),
    },
    { label: 'LWR: Arcane Shot above Aimed Shot', apply: moveAbove('arcane_shot', 'aimed_shot') },
  ],

  h78lwrAoe: [
    control('LW Ranged Multi Target section (the Single Target list)'),
    { label: 'LWR5: Multi-Shot above Aimed', apply: aoeFrom('LW Ranged AoE', (e) => insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot')) },
    {
      label: 'LWR5: Multi-Shot + Volley above it',
      apply: aoeFrom('LW Ranged AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot'),
      ),
    },
    {
      label: 'LWR5: Multi-Shot + Volley above Serpent Sting',
      apply: aoeFrom('LW Ranged AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'serpent_sting'),
      ),
    },
    {
      label: 'LWR5: Multi-Shot + Volley at the bottom',
      apply: aoeFrom('LW Ranged AoE', (e) => [...insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }]),
    },
    {
      label: 'LWR5: Multi-Shot + Weave(Explosive) above Sting',
      apply: aoeFrom('LW Ranged AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), weave(['explosive_trap']), 'serpent_sting'),
      ),
    },
    {
      label: 'LWR5: Multi-Shot + Explosive Trap cast directly above Sting',
      apply: aoeFrom('LW Ranged AoE', (e) =>
        insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'explosive_trap' }, 'serpent_sting'),
      ),
    },
    {
      label: 'LWR5: Multi-Shot + Serpent Sting Multi-DoT 3',
      apply: aoeFrom('LW Ranged AoE', (e) =>
        insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot').map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: 3 } : x)),
      ),
    },
  ],

  h78lwrConsumables: [
    control('LW Ranged consumables'),
    { label: 'LWR: stack led by Rapid Fire (structure only)', apply: stackLedBy('rapid_fire') },
    {
      label: 'LWR: Major Mana Potion (was Frenzy), stack led by Rapid Fire',
      apply: chain(consumable('potion', 'major_mana_potion'), stackLedBy('rapid_fire')),
    },
    { label: 'LWR: other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
    { label: 'LWR: Blasted Lands +25 Intellect (was Agility)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'LWR: food +40 Attack Power (was +20 Agility)', apply: consumable('food', 'food_attack_power') },
  ],

  /*
   * LW Ranged reads intellect at 1.097 a point at 120s -- above agility's
   * 0.736 and above 1% haste's 7.11 per +8 slot -- because it is mana-bound
   * and Careful Aim turns intellect into attack power as well.
   */
  h78lwrEnchants: [
    control('LW Ranged enchants'),
    { label: 'LWR: head + legs +8 Intellect (was +8 Agility)', apply: chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect'))) },
    { label: 'LWR: head + legs +1% Haste', apply: chain(enchant('head', ench('+1% Haste')), enchant('legs', ench('+1% Haste'))) },
    {
      label: 'LWR: head + legs +8 Intellect, Blasted Lands Intellect',
      apply: chain(enchant('head', ench('+8 Intellect')), enchant('legs', ench('+8 Intellect')), consumable('blasted_lands', 'blasted_intellect')),
    },
  ],

  h78lwrCombined: [
    control('LW Ranged build'),
    { label: 'LWR C1: tree + Weave above Sting + Arcane above Aimed + sting reserve', apply: chain(LWR_TREE_WIN, LWR_LIST) },
    { label: 'LWR C2: C1 + Intellect head/legs/Blasted Lands', apply: chain(LWR_TREE_WIN, LWR_LIST, INT_HEAD_LEGS, BLASTED_INT) },
    {
      label: 'LWR C3: C2 + Immolation Trap at 0s',
      apply: chain(LWR_TREE_WIN, LWR_LIST, INT_HEAD_LEGS, BLASTED_INT, addPrecombat(0, 'immolation_trap')),
    },
    {
      label: 'LWR C4: C2 + High Order Skyborne',
      apply: chain(LWR_TREE_WIN, LWR_LIST, INT_HEAD_LEGS, BLASTED_INT, race('high_order_skyborne').apply),
    },
    {
      label: 'LWR C5: C2 without the sting reserve',
      apply: chain(LWR_TREE_WIN, addAbove(weave(['immolation_trap']), 'serpent_sting'), moveAbove('arcane_shot', 'aimed_shot'), INT_HEAD_LEGS, BLASTED_INT),
    },
    {
      label: 'LWR C6: C2 without Arcane above Aimed',
      apply: chain(LWR_TREE_WIN, addAbove(weave(['immolation_trap']), 'serpent_sting'), stingReserve, INT_HEAD_LEGS, BLASTED_INT),
    },
    { label: 'LWR C7: tree + Intellect only', apply: chain(LWR_TREE_WIN, INT_HEAD_LEGS, BLASTED_INT) },
  ],

  h78lwrAoeCombined: [
    control('LW Ranged Multi Target section'),
    { label: 'LWR A1: Multi + Volley above Sting + Weave(Explosive) + Sting MD3', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'serpent_sting', trap: 'weave', multiDot: 3 })) },
    { label: 'LWR A2: A1, Multi-DoT 5', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'serpent_sting', trap: 'weave', multiDot: 5 })) },
    { label: 'LWR A3: A1 without the trap', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'serpent_sting', multiDot: 3 })) },
    { label: 'LWR A4: A1 without Multi-DoT', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'serpent_sting', trap: 'weave' })) },
    { label: 'LWR A5: A1, Volley above Multi-Shot', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'multi_shot', trap: 'weave', multiDot: 3 })) },
    { label: 'LWR A6: A1, Volley above Hunter Mark', apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'hunters_mark', trap: 'weave', multiDot: 3 })) },
  ],

  /*
   * ROUND TWO OF THE LW RANGED AoE LIST. Volley has no cooldown, so anywhere
   * above Serpent Sting it is a FLOOR -- the first pass's A1 to A4 and A6 ran
   * identical fights, because nothing below the Volley was ever reached. These
   * put the other AoE pieces ABOVE it.
   */
  h78lwrAoe2: [
    control('LW Ranged Multi Target section'),
    {
      label: 'LWR B0: Volley above Sting (the first-pass winner)',
      apply: chain(LWR_TREE_WIN, rangedAoe('LW Ranged AoE', { volleyAbove: 'serpent_sting' })),
    },
    {
      label: 'LWR B1: Weave(Explosive) above Volley above Sting',
      apply: chain(
        LWR_TREE_WIN,
        aoeFrom('LW Ranged AoE', (e) =>
          insertAbove(insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'serpent_sting'), weave(['explosive_trap']), 'volley'),
        ),
      ),
    },
    {
      label: 'LWR B2: Sting Multi-DoT 3 above Volley',
      apply: chain(
        LWR_TREE_WIN,
        aoeFrom('LW Ranged AoE', (e) =>
          insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot').map((x) =>
            x.abilityId === 'serpent_sting' ? { ...x, multiDot: 3 } : x,
          ),
        ),
      ),
    },
    {
      label: 'LWR B3: Weave(Explosive) + Sting MD3 above Volley',
      apply: chain(
        LWR_TREE_WIN,
        aoeFrom('LW Ranged AoE', (e) =>
          insertAbove(
            insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot'),
            weave(['explosive_trap']),
            'serpent_sting',
          ).map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: 3 } : x)),
        ),
      ),
    },
    {
      label: 'LWR B4: B3 with Multi-Shot above Volley',
      apply: chain(
        LWR_TREE_WIN,
        aoeFrom('LW Ranged AoE', (e) =>
          insertAbove(
            insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot'),
            weave(['explosive_trap']),
            'serpent_sting',
          ).map((x) => (x.abilityId === 'serpent_sting' ? { ...x, multiDot: 3 } : x)),
        ),
        inMulti(moveAbove('multi_shot', 'volley')),
      ),
    },
    {
      label: 'LWR B5: B3 with Sting single-target',
      apply: chain(
        LWR_TREE_WIN,
        aoeFrom('LW Ranged AoE', (e) =>
          insertAbove(
            insertAbove(insertAbove(e, { abilityId: 'multi_shot' }, 'aimed_shot'), { abilityId: 'volley' }, 'multi_shot'),
            weave(['explosive_trap']),
            'serpent_sting',
          ),
        ),
      ),
    },
  ],

  h78lwrAoe3: [
    control('LW Ranged Multi Target section'),
    {
      label: 'LWR B4: Weave(Explosive) > Sting MD3 > Multi > Volley',
      apply: chain(LWR_TREE_WIN, lwrAoeList(3)),
    },
    {
      label: 'LWR B6: Weave(Explosive) > Sting > Multi > Volley',
      apply: chain(LWR_TREE_WIN, lwrAoeList(undefined)),
    },
    {
      label: 'LWR B7: B6 + High Order Skyborne',
      apply: chain(LWR_TREE_WIN, lwrAoeList(undefined), race('high_order_skyborne').apply),
    },
  ],

  h78lwrAoeGated: [
    control('LW Ranged Multi Target section'),
    { label: 'LWR B4 (ungated)', apply: chain(LWR_TREE_WIN, lwrAoeList(3)) },
    { label: 'LWR G0: B4, sting split by count', apply: chain(LWR_TREE_WIN, lwrAoeGated(false)) },
    { label: 'LWR G1: G0 + Volley above Sting from 6 targets', apply: chain(LWR_TREE_WIN, lwrAoeGated(true)) },
  ],

  h78lwrRace: [control('LW Ranged race (Orc)'), ...HUNTER_RACES.map(race)],

  /* ========================================================= LW MELEE */

  /*
   * NINE POINTS DO NOTHING AT 120s: Rapid Killing 2 (Rapid Fire 5 min -> 3,
   * both longer than the fight), Survivalist 4 (health), Deterrence 1 and
   * Survivalist's Discipline 2 (unmodelled -- an ENGINE gap that expires).
   * The one live talent they can buy is Clever Traps, +30% to the trap.
   */
  h78lwmTalents: [
    control('LW Melee tree'),
    {
      label: 'LWM: Rapid Killing 2 -> Clever Traps 2',
      apply: tree({ ...LWM, survivalist_s_discipline: 2, clever_traps: 2 }),
    },
    {
      label: "LWM: Survivalist's Discipline 2 -> Clever Traps 2",
      apply: tree({ ...LWM, rapid_killing: 2, clever_traps: 2 }),
    },
  ],

  h78lwmPrecombat: [
    control('LW Melee opener'),
    { label: 'LWM: + Immolation Trap at 0s (pure DoT)', apply: addPrecombat(0, 'immolation_trap') },
  ],

  h78lwmApl: [
    control('LW Melee list'),
    { label: 'LWM: Immolation Trap above Strider Kick', apply: moveAbove('immolation_trap', 'strider_kick') },
    { label: 'LWM: Immolation Trap above Raptor Strike', apply: moveAbove('immolation_trap', 'raptor_strike') },
    { label: 'LWM: Strider Kick above Mongoose Bite', apply: moveAbove('strider_kick', 'mongoose_bite') },
  ],

  /*
   * MELEE AT FIVE TARGETS. Explosive Trap REPLACES Immolation Trap rather than
   * joining it: "only one Fire trap can be active at a time" is not enforced by
   * the engine, and a list casting both would be collecting on that gap.
   * Volley and Multi-Shot are ranged and priced only as questions.
   */
  h78lwmAoe: [
    control('LW Melee Multi Target section (the Single Target list)'),
    {
      label: 'LWM5: Explosive Trap in Immolation Trap’s place',
      apply: aoeFrom('LW Melee AoE', (e) => e.map((x) => (x.abilityId === 'immolation_trap' ? { abilityId: 'explosive_trap' } : x))),
    },
    {
      label: 'LWM5: Explosive Trap in its place, above Raptor Strike',
      apply: aoeFrom('LW Melee AoE', (e) =>
        insertAbove(e.filter((x) => x.abilityId !== 'immolation_trap'), { abilityId: 'explosive_trap' }, 'raptor_strike'),
      ),
    },
    {
      label: 'LWM5 (question only): both traps',
      apply: aoeFrom('LW Melee AoE', (e) => insertAbove(e, { abilityId: 'explosive_trap' }, 'immolation_trap')),
    },
    {
      label: 'LWM5 (question only): Explosive + Volley above Wing Clip',
      apply: aoeFrom('LW Melee AoE', (e) =>
        insertAbove(e.map((x) => (x.abilityId === 'immolation_trap' ? { abilityId: 'explosive_trap' } : x)), { abilityId: 'volley' }, 'wing_clip'),
      ),
    },
  ],

  h78lwmConsumables: [
    control('LW Melee consumables'),
    { label: 'LWM: food +20 Agility (was +40 Attack Power)', apply: consumable('food', 'food_agility') },
    { label: 'LWM: food +20 Strength', apply: consumable('food', 'food_strength') },
    { label: 'LWM: Blasted Lands +25 Strength (was Agility)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'LWM: MH Dense Sharpening Stone (was +2% crit)', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
    { label: 'LWM: OH Dense Sharpening Stone (was +2% crit)', apply: consumable('weapon_effect_off_hand', 'dense_sharpening_stone_off_hand') },
    { label: 'LWM: other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  ],

  /*
   * The melee builds read agility at 0.539 against intellect and strength at
   * about 0.30 and 1% haste at 2.1 (inside its interval) -- every armour slot
   * stays agility. The weapon enchant is a proc and is fought.
   */
  h78lwmEnchants: [
    control('LW Melee enchants'),
    { label: 'LWM: both weapons +25 Agility (was Crusader)', apply: chain(enchant('mainHand', ench('+25 Agility')), enchant('offHand', ench('+25 Agility'))) },
    { label: 'LWM: off hand +25 Agility', apply: enchant('offHand', ench('+25 Agility')) },
  ],

  h78lwmCombined: [
    control('LW Melee build'),
    { label: 'LWM C1: Clever Traps (from Survivalist Discipline)', apply: LWM_TREE_WIN },
    { label: 'LWM C2: C1 + off hand +25 Agility', apply: chain(LWM_TREE_WIN, OH_AGI) },
    { label: 'LWM C3: C1 + both weapons +25 Agility', apply: chain(LWM_TREE_WIN, BOTH_AGI) },
    { label: 'LWM C4: off hand +25 Agility only', apply: OH_AGI },
  ],

  h78lwmAoeCombined: [
    control('LW Melee Multi Target section'),
    { label: 'LWM A1: Clever Traps + Explosive in Immolation place', apply: chain(LWM_TREE_WIN, meleeAoe('LW Melee AoE', false)) },
    { label: 'LWM A2: Clever Traps + Explosive above Raptor', apply: chain(LWM_TREE_WIN, meleeAoe('LW Melee AoE', true)) },
  ],

  h78lwmRace: [control('LW Melee race (Orc)'), ...HUNTER_RACES.map(race)],

  /* ======================================================== HAWK MELEE */

  h78hwkTalents: [
    control('Hawk Melee tree'),
    {
      label: 'HWK: Survivalist 5 -> Survivalist 3 + Clever Traps 2',
      apply: tree({ ...HWK, survivalist: 3, clever_traps: 2 }),
    },
  ],

  h78hwkPrecombat: [
    control('Hawk Melee opener'),
    { label: 'HWK: + Immolation Trap at 0s (pure DoT)', apply: addPrecombat(0, 'immolation_trap') },
  ],

  h78hwkApl: [
    control('Hawk Melee list'),
    { label: 'HWK: Summon Hawk above Strider Kick', apply: moveAbove('summon_hawk', 'strider_kick') },
    { label: 'HWK: Summon Hawk above Immolation Trap', apply: moveAbove('summon_hawk', 'immolation_trap') },
    { label: 'HWK: Summon Hawk above Raptor Strike', apply: moveAbove('summon_hawk', 'raptor_strike') },
    { label: 'HWK: Immolation Trap above Strider Kick', apply: moveAbove('immolation_trap', 'strider_kick') },
  ],

  h78hwkAoe: [
    control('Hawk Melee Multi Target section (the Single Target list)'),
    {
      label: 'HWK5: Explosive Trap in Immolation Trap’s place',
      apply: aoeFrom('Hawk Melee AoE', (e) => e.map((x) => (x.abilityId === 'immolation_trap' ? { abilityId: 'explosive_trap' } : x))),
    },
    {
      label: 'HWK5: Explosive Trap in its place, above Raptor Strike',
      apply: aoeFrom('Hawk Melee AoE', (e) =>
        insertAbove(e.filter((x) => x.abilityId !== 'immolation_trap'), { abilityId: 'explosive_trap' }, 'raptor_strike'),
      ),
    },
    {
      label: 'HWK5 (question only): both traps',
      apply: aoeFrom('Hawk Melee AoE', (e) => insertAbove(e, { abilityId: 'explosive_trap' }, 'immolation_trap')),
    },
    {
      label: 'HWK5 (question only): Explosive + Volley above Wing Clip',
      apply: aoeFrom('Hawk Melee AoE', (e) =>
        insertAbove(e.map((x) => (x.abilityId === 'immolation_trap' ? { abilityId: 'explosive_trap' } : x)), { abilityId: 'volley' }, 'wing_clip'),
      ),
    },
  ],

  h78hwkConsumables: [
    control('Hawk Melee consumables'),
    { label: 'HWK: food +20 Agility (was +40 Attack Power)', apply: consumable('food', 'food_agility') },
    { label: 'HWK: Blasted Lands +25 Strength (was Agility)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'HWK: MH Dense Sharpening Stone (was +2% crit)', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
    { label: 'HWK: OH Dense Sharpening Stone (was +2% crit)', apply: consumable('weapon_effect_off_hand', 'dense_sharpening_stone_off_hand') },
  ],

  h78hwkEnchants: [
    control('Hawk Melee enchants'),
    { label: 'HWK: both weapons +25 Agility (was Crusader)', apply: chain(enchant('mainHand', ench('+25 Agility')), enchant('offHand', ench('+25 Agility'))) },
    { label: 'HWK: off hand +25 Agility', apply: enchant('offHand', ench('+25 Agility')) },
  ],

  h78hwkCombined: [
    control('Hawk Melee build'),
    { label: 'HWK C1: Clever Traps', apply: HWK_TREE_WIN },
    { label: 'HWK C2: C1 + off hand +25 Agility', apply: chain(HWK_TREE_WIN, OH_AGI) },
    { label: 'HWK C3: C1 + both weapons +25 Agility', apply: chain(HWK_TREE_WIN, BOTH_AGI) },
    { label: 'HWK C4 (question): C1 + Summon Hawk above Raptor Strike', apply: chain(HWK_TREE_WIN, moveAbove('summon_hawk', 'raptor_strike')) },
  ],

  h78hwkAoeCombined: [
    control('Hawk Melee Multi Target section'),
    { label: 'HWK A1: Clever Traps + Explosive in Immolation place', apply: chain(HWK_TREE_WIN, meleeAoe('Hawk Melee AoE', false)) },
    { label: 'HWK A2: Clever Traps + Explosive above Raptor', apply: chain(HWK_TREE_WIN, meleeAoe('Hawk Melee AoE', true)) },
  ],

  h78hwkRace: [control('Hawk Melee race (Orc)'), ...HUNTER_RACES.map(race)],
};

