/*
 * ============================================================================
 * ROUND 80 -- THE FOUR DRUID PRESETS, second run of "Optimize, Update, and
 * Report all Profiles" under the owner's round 79 rules (talents on the
 * WEIGHTED score, Horde/Windshaper races only, legal enchants, a Primary and a
 * Secondary Potion with APL logic, and go deeper).
 *
 *   PRESET=druid_moonkin FILE=tools/optimise/druidVariants80.ts VARIANTS=w80moonRace WEIGHTED=1 npx vite-node tools/probe_build.ts
 *   PRESET=druid_cat     FILE=tools/optimise/druidVariants80.ts VARIANTS=w80catSt DURATION=120 npx vite-node tools/probe_build.ts
 *
 * THE THEMES (Step 0), which no variant here may move:
 *
 * | preset | class | majority tree | style / form | target swings back |
 * | --- | --- | --- | --- | --- |
 * | druid_moonkin | druid | Balance 38 (38/0/13) | Moonkin Form, staff | no |
 * | druid_cat | druid | Feral 34 (9/34/8) | Cat Form, stat stick | no |
 * | druid_bear | druid | Feral 42 (9/42/0) | Bear Form, stat stick | YES -- figure is TPS |
 * | druid_resto | druid | Resto 40 (11/0/40) | caster, staff | healer -- figure is HPS |
 *
 * Druids may be only Tauren or Windshaper Skyborne (round 79). EVERY GROUP
 * STARTS WITH ITS CONTROL, labelled "the shipped ..." -- `(p) => p` is whatever
 * the preset carries now. The figures are in docs/handoff/druid.md, round 80.
 * ============================================================================
 */
import {
  type Apply,
  type Variant,
  DRUID_TREE as tree,
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
  comboPoints,
  fightElapsed,
  fightRemaining,
  not,
  onCooldown,
  ready,
  resource,
  resourceFraction,
  selfHas,
  selfStacks,
  targetCount,
  targetExpired,
  targetHas,
  targetTime,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character';

/* ---------------------------------------------------------------- helpers */

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

const race =
  (id: RaceId): Apply =>
  (profile) => ({ ...profile, character: { ...profile.character, race: id } });

/** Replace the condition of the `nth` entry casting `id` (0 = the first). */
const setCondition = (id: string, condition: AplCondition | undefined, nth = 0): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    const { condition: _old, ...rest } = entries[at];
    entries[at] = condition === undefined ? rest : { ...rest, condition };
    return entries;
  });

const removeNth = (id: string, nth: number): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    entries.splice(at, 1);
    return entries;
  });

/** Insert `entry` immediately above the `nth` entry casting `beforeId`. */
const addAboveNth = (entry: AplEntry, beforeId: string, nth: number): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === beforeId && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${beforeId}`);
    entries.splice(at, 0, entry);
    return entries;
  });

const manaAtMost = (f: number) => resourceFraction('atMost', f, 'mana');
const manaAtLeast = (f: number) => resourceFraction('atLeast', f, 'mana');
const energy = (compare: 'atLeast' | 'atMost' | 'below' | 'above', n: number) => resource(compare, n, 'energy');
const ripLeft = (compare: 'atLeast' | 'atMost', s: number) => targetTime(compare, s, 'rip');

/* ---------------------------------------------------------------- trees */

const MOONKIN_BALANCE_NO_GENESIS = {
  improved_wrath: 5,
  moonglow: 3,
  improved_moonfire: 2,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  nature_s_splendor: 1,
  insect_swarm: 1,
  vengeance: 5,
  improved_starfire: 5,
  nature_s_grace: 1,
  eclipse: 3,
  moonfury: 5,
  moonkin_form: 1,
};
const MOON_RESTO_BASE = { nature_s_focus: 5, naturalist: 5 };
const moonTree = (genesis: number, reflection: number, extra: Record<string, number> = {}) =>
  tree({ ...MOONKIN_BALANCE_NO_GENESIS, genesis, ...MOON_RESTO_BASE, ...(reflection ? { reflection } : {}), ...extra });

const CAT_BASE = {
  genesis: 5,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  ferocity: 3,
  heart_of_the_wild: 5,
  feral_swiftness: 2,
  shredding_attacks: 3,
  savage_fury: 2,
  sharpened_claws: 2,
  shifting_power: 1,
  predatory_strikes: 3,
  blood_frenzy: 2,
  improved_shifting_power: 2,
  leader_of_the_pack: 1,
  natural_instinct: 2,
  rend_and_tear: 5,
  berserk: 1,
  furor: 5,
  naturalist: 3,
};

const BEAR_BASE = {
  genesis: 5,
  nature_s_majesty: 2,
  nature_s_reach: 2,
  ferocity: 4,
  heart_of_the_wild: 5,
  feral_swiftness: 2,
  feral_instinct: 3,
  thick_hide: 3,
  savage_fury: 2,
  feral_charge: 1,
  sharpened_claws: 2,
  primal_bite: 1,
  predatory_strikes: 3,
  blood_frenzy: 2,
  natural_instinct: 2,
  leader_of_the_pack: 1,
  natural_reaction: 5,
  rend_and_tear: 5,
  berserk: 1,
};

const RESTO_BASE = {
  genesis: 5,
  improved_moonfire: 2,
  nature_s_majesty: 2,
  nature_s_reach: 1,
  nature_s_splendor: 1,
  nature_s_focus: 5,
  naturalist: 5,
  subtlety: 3,
  reflection: 3,
  gift_of_nature: 5,
  gift_of_the_earthmother: 1,
  tranquil_spirit: 4,
  improved_rejuvenation: 3,
  swiftmend: 1,
  nature_s_swiftness: 1,
  living_spirit: 3,
  improved_regrowth: 5,
  wild_growth: 1,
};

/** Talent edit as a delta on a full base, still checked whole by `tree`. */
const delta = (base: Record<string, number>, edits: Record<string, number>): Apply => {
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(edits)) {
    if (v === 0) delete out[k];
    else out[k] = v;
  }
  return tree(out);
};

/* ---------------------------------------------------- the potion logic */

/**
 * The two-potion shape for a mana user: the MANA potion when mana is low, and
 * the DAMAGE potion only late in the fight, when the mana potion has not been
 * needed. They share the two-minute potion cooldown, so whichever goes first
 * locks out the other.
 */
const potionPair = (opts: {
  damage: string;
  manaFraction: number;
  manaAfter: number;
  damageInLast: number;
}): Apply =>
  apl((entries) => {
    const ids = new Set(['major_mana_potion', opts.damage]);
    const rest = entries.filter((e) => !ids.has(e.abilityId));
    const potions: AplEntry[] = [
      {
        abilityId: 'major_mana_potion',
        condition: all(manaAtMost(opts.manaFraction), fightElapsed('atLeast', opts.manaAfter)),
      },
      { abilityId: opts.damage, condition: fightRemaining('atMost', opts.damageInLast) },
    ];
    return [...potions, ...rest];
  });

/** The Cat: Ferocious Bite instead of a Rip that would outlast the fight. */
const CAT_END_BITE = (t: number): Apply =>
  chain(
    setCondition('rip', all(comboPoints('atLeast', 5), targetExpired('rip'), fightRemaining('atLeast', t))),
    addAbove({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), fightRemaining('below', t)) }, 'rip'),
  );
/** The Cat: no Rake in the last `t` seconds. */
const CAT_RAKE_END = (t: number): Apply => setCondition('rake', all(targetExpired('rake'), fightRemaining('atLeast', t)));

const CAT_ADD_END_BITE: Apply = addAbove({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), fightRemaining('below', 8)) }, 'rip');
const CAT_ADD_RAKE_END: Apply = addAbove({ abilityId: 'shred', condition: all(targetExpired('rake'), fightRemaining('below', 6)) }, 'rake');
const CAT_ADD_BITE: Apply = addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 4)) }, 'shred', 2);

const targetStacksBelow = (auraId: string, n: number): AplCondition => ({ kind: 'auraStacks', on: 'target', auraId, compare: 'below', stacks: n }) as AplCondition;
/** Berserk at the pull, inserted ahead of the owner's Primal Bite so it bites under it. */
const BEAR_BERSERK_OPENER: Apply = (profile) => {
  const pre = [...(profile.precombat ?? [])];
  const at = pre.findIndex((a) => a.abilityId === 'mangle');
  pre.splice(at < 0 ? pre.length : at, 0, { abilityId: 'berserk', secondsBefore: 0 });
  return { ...profile, precombat: pre };
};

const SMART: Apply = (p) => ({ ...p, rotation: { ...p.rotation, source: 'custom', smartHealing: true } });
const atSpread = (entry: AplEntry): Apply =>
  apl((e) => {
    const at = e.findIndex((x) => x.abilityId === 'rejuvenation' && x.target?.kind === 'lowestHealth');
    if (at < 0) throw new Error('no Rejuvenation spread');
    e.splice(at, 0, entry);
    return e;
  });
const RAID_REGROWTH = (f: number): Apply =>
  atSpread({ abilityId: 'regrowth', target: { kind: 'lowestHealth', withoutAura: 'regrowth' }, condition: { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition });
const RAID_HT = (f: number): Apply =>
  atSpread({ abilityId: 'healing_touch', target: { kind: 'lowestHealth' }, condition: { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition });
const RAID_SWIFTMEND = (f: number): Apply =>
  apl((e) => {
    const at = e.findIndex((x) => x.abilityId === 'swiftmend');
    e.splice(at + 1, 0, {
      abilityId: 'swiftmend',
      target: { kind: 'withAura', auraId: 'rejuvenation' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition,
    });
    return e;
  });

/* ------------------------------------------------------------ the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ======================================================== MOONKIN */

  w80moonRace: [
    control('race (High Order Skyborne, no longer allowed)'),
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],

  /* WEIGHTED, on Windshaper Skyborne (the race fix applied first). */
  w80moonTalents: [
    { label: 'Windshaper, the shipped 38/0/13 (Genesis 2, Reflection 3) -- the control', apply: race('windshaper_skyborne') },
    { label: 'Windshaper, Genesis 5, no Reflection (41/0/10)', apply: chain(race('windshaper_skyborne'), moonTree(5, 0)) },
    { label: 'Windshaper, Genesis 4, Reflection 1', apply: chain(race('windshaper_skyborne'), moonTree(4, 1)) },
    { label: 'Windshaper, Genesis 3, Reflection 2', apply: chain(race('windshaper_skyborne'), moonTree(3, 2)) },
    {
      label: 'Windshaper, Moonglow 0, Genesis 5, Reflection 3',
      apply: chain(race('windshaper_skyborne'), tree({ ...MOONKIN_BALANCE_NO_GENESIS, moonglow: 0, genesis: 5, ...MOON_RESTO_BASE, reflection: 3 })),
    },
    {
      label: 'Windshaper, Moonglow 1, Genesis 5, Reflection 2',
      apply: chain(race('windshaper_skyborne'), tree({ ...MOONKIN_BALANCE_NO_GENESIS, moonglow: 1, genesis: 5, ...MOON_RESTO_BASE, reflection: 2 })),
    },
  ],

  /* From here on the Moonkin's baseline is Windshaper, 41/0/10 (shipped). */
  w80moonEnch: [
    control('enchants (head and legs +1% Haste)'),
    { label: 'head and legs +8 Intellect', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head and legs +8 Spirit', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'head +8 Intellect, legs +1% Haste', apply: enchant('head', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  w80moonCons: [
    control('consumables (Arcane school power, Intellect Blasted Lands, Spell Power food)'),
    { label: 'school +40 Nature (was Arcane)', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'other: none (was Demonic Rune)', apply: (p) => {
        const { other: _o, ...rest } = p.consumables;
        return { ...p, consumables: rest };
      },
    },
  ],

  /* Single Target, at 1 target / 120 s. */
  w80moonPotion: [
    control('potion (Spellblasting at the pull)'),
    {
      label: 'secondary Major Mana, the stock entry (mana <= 30%)',
      apply: consumable('potion_secondary', 'secondary_major_mana_potion'),
    },
    ...[
      [0.5, 60, 30],
      [0.3, 60, 30],
      [0.5, 30, 30],
      [0.4, 45, 30],
      [0.5, 60, 45],
    ].map(([m, after, last]) => ({
      label: `Major Mana at mana <= ${m * 100}% after ${after}s, else Spellblasting in the last ${last}s`,
      apply: chain(
        consumable('potion_secondary', 'secondary_major_mana_potion'),
        potionPair({ damage: 'major_spellblasting_potion', manaFraction: m, manaAfter: after, damageInLast: last }),
      ),
    })),
  ],

  /* The pair for fights past one potion cooldown: priced at 180 s and 120 s. */
  w80moonPotion2: [
    control('potion (Spellblasting at the pull, no secondary)'),
    { label: 'secondary Major Mana, stock entry (Spellblasting ungated above it)', apply: consumable('potion_secondary', 'secondary_major_mana_potion') },
    ...[0.5, 0.3].map((m) => ({
      label: `Spellblasting while mana > ${m * 100}%, Major Mana at <= ${m * 100}% after 60s`,
      apply: chain(
        consumable('potion_secondary', 'secondary_major_mana_potion'),
        apl((entries) => {
          const rest = entries.filter((e) => e.abilityId !== 'major_mana_potion' && e.abilityId !== 'major_spellblasting_potion');
          return [
            { abilityId: 'major_mana_potion', condition: all(manaAtMost(m), fightElapsed('atLeast', 60)) },
            { abilityId: 'major_spellblasting_potion', condition: resourceFraction('above', m, 'mana') },
            ...rest,
          ];
        }),
      ),
    })),
  ],

  w80moonDotEnd: [
    control('Single Target list (DoTs refreshed to the end)'),
    ...[4, 8, 12].map((t) => ({
      label: `Moonfire and Insect Swarm only with >= ${t}s of fight left`,
      apply: chain(
        setCondition('moonfire', all(targetExpired('moonfire'), fightRemaining('atLeast', t))),
        setCondition('insect_swarm', all(targetExpired('insect_swarm'), fightRemaining('atLeast', t))),
      ),
    })),
  ],

  /* Round two of the Multi Target list: each shape gated on the target count. */
  w80moonAoe2: [
    control('Multi Target list (Hurricane at >= 4 targets)'),
    ...[2, 3, 5].map((n) => ({
      label: `Moonfire multi-DoT ${n} above Hurricane at 4-7 targets`,
      apply: inMulti(addAbove({ abilityId: 'moonfire', multiDot: n, condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire')) }, 'hurricane')),
    })),
    {
      label: 'Moonfire and Insect Swarm multi-DoT on every target below 4 targets',
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'moonfire' || x.abilityId === 'insect_swarm' ? { ...x, multiDot: 5 } : x)))),
    },
    {
      label: 'both: MF multi-DoT 3 above Hurricane at 4-7, all-target DoTs below',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'moonfire' || x.abilityId === 'insect_swarm' ? { ...x, multiDot: 5 } : x))),
        addAbove({ abilityId: 'moonfire', multiDot: 3, condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire')) }, 'hurricane'),
      ),
    },
    {
      label: 'both, with the DoT walk only at fight left >= 8s',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'moonfire' || x.abilityId === 'insect_swarm' ? { ...x, multiDot: 5, condition: all(targetExpired(x.abilityId), fightRemaining('atLeast', 8)) } : x))),
        addAbove({ abilityId: 'moonfire', multiDot: 3, condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire'), fightRemaining('atLeast', 8)) }, 'hurricane'),
      ),
    },
  ],

  w80moonAoe3: [
    control('Multi Target list (Hurricane at >= 4 targets)'),
    {
      label: 'Moonfire on the boss only (multi-DoT 1) above Hurricane at 4-7',
      apply: inMulti(addAbove({ abilityId: 'moonfire', condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire')) }, 'hurricane')),
    },
    {
      label: 'MF multi-DoT 2 + Insect Swarm on the boss above Hurricane at 4-7',
      apply: inMulti(
        addAbove({ abilityId: 'moonfire', multiDot: 2, condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire')) }, 'hurricane'),
        addAbove({ abilityId: 'insect_swarm', condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('insect_swarm')) }, 'hurricane'),
      ),
    },
    ...[5, 10, 12].map((t) => ({
      label: `MF multi-DoT 2 at 4-7, all-target DoT walk below at fight left >= ${t}s`,
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'moonfire' || x.abilityId === 'insect_swarm' ? { ...x, multiDot: 5, condition: all(targetExpired(x.abilityId), fightRemaining('atLeast', t)) } : x))),
        addAbove({ abilityId: 'moonfire', multiDot: 2, condition: all(targetCount('atLeast', 4), targetCount('atMost', 7), targetExpired('moonfire'), fightRemaining('atLeast', t)) }, 'hurricane'),
      ),
    })),
  ],

  /* ============================================================ CAT */

  w80catRace: [
    control('race (Tauren)'),
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],

  w80catTalents: [
    control('9/34/8'),
    { label: 'Feral Swiftness 2 -> Ferocity 5 (Rake 2 energy cheaper)', apply: delta(CAT_BASE, { feral_swiftness: 0, ferocity: 5 }) },
    { label: 'Feral Swiftness 2 -> Ferocity 4, Thick Hide 1', apply: delta(CAT_BASE, { feral_swiftness: 0, ferocity: 4, thick_hide: 1 }) },
    { label: 'Natural Instinct 2 -> Thick Hide 2 (crit damage out)', apply: delta(CAT_BASE, { natural_instinct: 0, thick_hide: 2 }) },
    { label: 'Genesis 5 -> Improved Wrath 5 (periodic out)', apply: delta(CAT_BASE, { genesis: 0, improved_wrath: 5 }) },
    { label: 'Furor 5 -> Natural Shapeshifter 3 + Nature Focus 2 (inert for inert: a check)', apply: delta(CAT_BASE, { furor: 0, natural_shapeshifter: 3, nature_s_focus: 2, naturalist: 3 }) },
  ],

  w80catSt: [
    control('Single Target list'),
    ...[4, 6, 8, 10].map((t) => ({
      label: `+ Ferocious Bite at 5 points while Rip has >= ${t}s, above the Shred filler`,
      apply: addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', t)) }, 'shred', 1),
    })),
    ...[45, 60].map((e) => ({
      label: `+ Ferocious Bite at 5 points, Rip >= 6s, energy <= ${e}, above the Shred filler`,
      apply: addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 6), energy('atMost', e)) }, 'shred', 1),
    })),
    {
      label: '+ Ferocious Bite at 5 points while Berserk is up and Rip has >= 4s',
      apply: addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), selfHas('berserk'), ripLeft('atLeast', 4)) }, 'shred', 1),
    },
    ...[6, 8, 10].map((t) => ({
      label: `end of fight: Ferocious Bite instead of Rip with < ${t}s left (5 points)`,
      apply: chain(
        setCondition('rip', all(comboPoints('atLeast', 5), targetExpired('rip'), fightRemaining('atLeast', t))),
        addAbove({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), fightRemaining('below', t)) }, 'rip'),
      ),
    })),
    ...[4, 6, 8].map((t) => ({
      label: `Rake not refreshed with < ${t}s of fight left`,
      apply: setCondition('rake', all(targetExpired('rake'), fightRemaining('atLeast', t))),
    })),
    { label: 'Rip at 4 points while Berserk is up (5 otherwise)', apply: setCondition('rip', all(any(comboPoints('atLeast', 5), all(comboPoints('atLeast', 4), selfHas('berserk'))), targetExpired('rip'))) },
    { label: 'Rip above Rake', apply: moveAbove('rip', 'rake') },
    { label: 'Clearcasting Shred below Rake and Rip', apply: chain(removeNth('shred', 0), addAboveNth({ abilityId: 'shred', condition: selfHas('clearcasting') }, 'shred', 0)) },
    { label: '+ Claw at the bottom', apply: addEntry({ abilityId: 'claw' }) },
    ...[0.3, 0.5].map((f) => ({
      label: `+ Innervate at mana <= ${f * 100}%`,
      apply: addAbove({ abilityId: 'innervate', condition: manaAtMost(f) }, 'berserk'),
    })),
  ],

  w80catShift: [
    control('Shifting Power at energy <= 50 (the owner)'),
    ...[30, 40, 60].map((e) => ({
      label: `Shifting Power at energy <= ${e}`,
      apply: setCondition('shifting_power', energy('atMost', e)),
    })),
    ...[5, 15, 20].map((e) => ({
      label: `Thistle Tea at energy <= ${e} (owner 10)`,
      apply: setCondition('thistle_tea', energy('atMost', e)),
    })),
  ],

  /* The second potion cooldown, priced at 180 s (and 120 s, where one potion fits). */
  w80catPotion: [
    control('potion (Frenzy at the pull, no secondary)'),
    {
      label: 'secondary Mighty Rage: Frenzy at the pull, Mighty Rage on the second cooldown',
      apply: chain(
        consumable('potion_secondary', 'secondary_mighty_rage_potion'),
        setCondition('major_frenzy_potion', fightElapsed('below', 60)),
      ),
    },
    {
      label: 'secondary Major Mana at mana <= 50% after 60s, Frenzy otherwise',
      apply: chain(
        consumable('potion_secondary', 'secondary_major_mana_potion'),
        apl((entries) => {
          const rest = entries.filter((e) => e.abilityId !== 'major_mana_potion');
          return [{ abilityId: 'major_mana_potion', condition: all(manaAtMost(0.5), fightElapsed('atLeast', 60)) }, ...rest];
        }),
      ),
    },
  ],

  w80catPotion2: [
    control('potion (Frenzy at the pull, no secondary)'),
    {
      label: 'secondary Mighty Rage on the second cooldown (Frenzy before 60s)',
      apply: chain(
        consumable('potion_secondary', 'secondary_mighty_rage_potion'),
        setCondition('major_frenzy_potion', fightElapsed('below', 60)),
        addAbove({ abilityId: 'mighty_rage_potion', condition: fightElapsed('atLeast', 60) }, 'major_frenzy_potion'),
      ),
    },
  ],

  w80catCombo: [
    control('Single Target list'),
    { label: 'end-of-fight Bite (< 8s) + Rake end gate (6s)', apply: chain(CAT_END_BITE(8), CAT_RAKE_END(6)) },
    { label: 'end-of-fight Bite (< 6s) + Rake end gate (6s)', apply: chain(CAT_END_BITE(6), CAT_RAKE_END(6)) },
    {
      label: 'end Bite 8 + Rake 6 + Bite at 5 points while Rip >= 4s',
      apply: chain(CAT_END_BITE(8), CAT_RAKE_END(6), addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 4)) }, 'shred', 1)),
    },
    {
      label: 'end Bite 8 + Rake 6 + Bite at 5 points while Rip >= 3s',
      apply: chain(CAT_END_BITE(8), CAT_RAKE_END(6), addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 3)) }, 'shred', 1)),
    },
    {
      label: 'end Bite 8 + Rake 6 + Bite at 5 points while Rip >= 5s',
      apply: chain(CAT_END_BITE(8), CAT_RAKE_END(6), addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 5)) }, 'shred', 1)),
    },
  ],

  /* The same three ideas written as ADDITIONS only, leaving the owner's Rake and Rip lines as they are. */
  w80catAdd: [
    control('Single Target list'),
    { label: 'A: + Bite at 5 points above Rip with < 8s left', apply: CAT_ADD_END_BITE },
    { label: 'A + B: + Shred above Rake with < 6s left', apply: chain(CAT_ADD_END_BITE, CAT_ADD_RAKE_END) },
    { label: 'A + B + C: + Bite at 5 points while Rip >= 4s above the filler', apply: chain(CAT_ADD_END_BITE, CAT_ADD_RAKE_END, CAT_ADD_BITE) },
    { label: 'A + C', apply: chain(CAT_ADD_END_BITE, CAT_ADD_BITE) },
    { label: 'the rewritten form (end Bite 8 + Rake 6 + Bite Rip >= 4), for comparison', apply: chain(CAT_END_BITE(8), CAT_RAKE_END(6), addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 4)) }, 'shred', 1)) },
  ],

  /* NOT SHIPPABLE: Prowl in combat is refused by the game and allowed by the engine. Priced for the owner. */
  w80catProwl: [
    control('Single Target list'),
    {
      label: 'Prowl then Ravage in combat, above the Shred filler (engine allows it)',
      apply: chain(
        addAboveNth({ abilityId: 'ravage' }, 'shred', 1),
        addAboveNth({ abilityId: 'prowl', condition: energy('atLeast', 60) }, 'ravage', 0),
      ),
    },
  ],

  w80catPrecombat: [
    control('opener (Cat Form 2s, Prowl 1s, Berserk + Ravage 0s -- the owner)'),
    { label: '+ Frenzy Potion at 0s, after Ravage', apply: addPrecombat(0, 'major_frenzy_potion') },
    { label: '+ Shifting Power at 0s, after Ravage', apply: addPrecombat(0, 'shifting_power') },
  ],

  w80catAoe: [
    control('Multi Target section (the Single Target list)'),
    {
      label: 'Rake on a second and third target when no points are banked',
      apply: inMulti(addAboveNth({ abilityId: 'rake', multiDot: 3, condition: all(comboPoints('atMost', 0), targetExpired('rake')) }, 'shred', 1)),
    },
    {
      label: '+ Ferocious Bite at 5 points while Rip has >= 6s',
      apply: inMulti(addAboveNth({ abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), ripLeft('atLeast', 6)) }, 'shred', 1)),
    },
  ],

  /* =========================================================== BEAR (TPS) */

  w80bearRace: [
    control('race (Tauren)'),
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],

  w80bearEnch: [
    control('enchants (head/legs +1% Dodge, gloves +2% Threat)'),
    { label: 'head and legs +8 Strength', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'head and legs +8 Agility', apply: chain(enchant('head', 900003), enchant('legs', 900003)) },
    { label: 'head and legs +1% Haste', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'neck +5 Strength (was +5 Agility)', apply: enchant('neck', 900008) },
    { label: 'wrists +9 Strength (was +9 Agility)', apply: enchant('wrists', 900017) },
    { label: 'gloves +15 Strength (was +2% Threat)', apply: enchant('gloves', 900021) },
    { label: 'cloak +5 Agility (was +1% Dodge)', apply: enchant('cloak', 900011) },
    { label: 'two-hand +25 Agility (was Crusader)', apply: enchant('twoHand', 900031) },
  ],

  w80bearCons: [
    control('consumables (Agility Blasted Lands and food)'),
    { label: 'blasted lands +25 Strength', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'food +20 Strength', apply: consumable('food', 'food_strength') },
    { label: 'both Strength', apply: chain(consumable('blasted_lands', 'blasted_strength'), consumable('food', 'food_strength')) },
    { label: 'flask +150 Spell Power (was +1200 HP)', apply: consumable('flask', 'flask_spell_power') },
  ],

  w80bearTalents: [
    control('9/42/0'),
    { label: 'Feral Charge 1 -> Ferocity 5', apply: delta(BEAR_BASE, { feral_charge: 0, ferocity: 5 }) },
    { label: 'Feral Swiftness 2 -> Ferocity 5, Brutal Impact 1', apply: delta(BEAR_BASE, { feral_swiftness: 0, ferocity: 5, brutal_impact: 1 }) },
    { label: 'Thick Hide 3 -> Ferocity 5, Brutal Impact 2', apply: delta(BEAR_BASE, { thick_hide: 0, ferocity: 5, brutal_impact: 2 }) },
    { label: 'Genesis 5 -> Improved Wrath 5', apply: delta(BEAR_BASE, { genesis: 0, improved_wrath: 5 }) },
  ],

  w80bearPick: [
    control('Bear'),
    { label: 'Ferocity 5 (Feral Charge out)', apply: delta(BEAR_BASE, { feral_charge: 0, ferocity: 5 }) },
    { label: 'Ferocity 5 + head/legs +8 Agility', apply: chain(delta(BEAR_BASE, { feral_charge: 0, ferocity: 5 }), enchant('head', 900003), enchant('legs', 900003)) },
    { label: 'Ferocity 5 + head/legs +8 Agility + Windshaper', apply: chain(delta(BEAR_BASE, { feral_charge: 0, ferocity: 5 }), enchant('head', 900003), enchant('legs', 900003), race('windshaper_skyborne')) },
  ],

  /* The owner's "queue Maul if rage >= 42", priced for them on both lists at once. */
  w80bearMaul: [
    control('Maul at rage >= 42 (the owner)'),
    ...[15, 20, 25, 30, 35].map((r) => ({
      label: `Maul at rage >= ${r}, both lists`,
      apply: chain(setCondition('maul', resource('atLeast', r, 'rage')), inMulti(setCondition('maul', resource('atLeast', r, 'rage')))),
    })),
  ],

  w80bearAoe2: [
    control('Multi Target list'),
    { label: 'Berserk at the pull (Multi opener, before Primal Bite)', apply: inMulti(BEAR_BERSERK_OPENER) },
    { label: 'Swipe above the Berserk Primal Bite', apply: inMulti(moveAbove('swipe', 'mangle')) },
    { label: '+ Swipe above Maul while Berserk is down and rage >= 80', apply: inMulti(addAbove({ abilityId: 'swipe', condition: all(not(selfHas('berserk')), resource('atLeast', 80, 'rage')) }, 'maul')) },
    { label: 'Faerie Fire removed (Multi)', apply: inMulti(removeEntry('faerie_fire')) },
  ],

  w80bearPotion: [
    control('potion (Mighty Rage at the pull, no secondary)'),
    {
      label: 'secondary Major Healing Potion (stock: at 50% health)',
      apply: consumable('potion_secondary', 'secondary_major_healing_potion'),
    },
    {
      label: 'secondary Major Frenzy Potion on the second cooldown',
      apply: chain(consumable('potion_secondary', 'secondary_major_frenzy_potion'), addAbove({ abilityId: 'major_frenzy_potion', condition: fightElapsed('atLeast', 60) }, 'mighty_rage_potion')),
    },
  ],

  w80bearSt: [
    control('Single Target list'),
    ...[30, 35, 50, 60].map((r) => ({
      label: `Maul at rage >= ${r} (was 42)`,
      apply: setCondition('maul', resource('atLeast', r, 'rage')),
    })),
    { label: 'Lacerate above Primal Bite', apply: moveAbove('lacerate', 'mangle') },
    { label: 'Faerie Fire removed', apply: removeEntry('faerie_fire') },
    { label: 'Demoralizing Roar removed', apply: removeEntry('demoralizing_roar') },
    { label: '+ Swipe above Faerie Fire', apply: addAbove({ abilityId: 'swipe' }, 'faerie_fire') },
    { label: 'Lacerate only below 5 stacks or with < 3s left', apply: setCondition('lacerate', any(targetStacksBelow('lacerate', 5), targetTime('atMost', 3, 'lacerate'))) },
    { label: 'Berserk moved to the opener at 0s (before Primal Bite)', apply: chain(removeEntry('berserk'), BEAR_BERSERK_OPENER) },
  ],

  w80bearAoe: [
    control('Multi Target list'),
    ...[30, 55].map((r) => ({
      label: `Maul at rage >= ${r} in the Multi list`,
      apply: inMulti(setCondition('maul', resource('atLeast', r, 'rage'))),
    })),
    { label: 'Swipe above Maul while rage >= 60', apply: inMulti(addAbove({ abilityId: 'swipe', condition: resource('atLeast', 60, 'rage') }, 'maul')) },
    { label: 'Demoralizing Roar removed', apply: inMulti(removeEntry('demoralizing_roar')) },
    { label: 'Lacerate removed', apply: inMulti(removeEntry('lacerate')) },
    { label: 'Swipe gated at >= 3 targets', apply: inMulti(setCondition('swipe', targetCount('atLeast', 3))) },
  ],

  /* =========================================================== RESTO (HPS) */

  w80restoRace: [
    control('race (Night Elf, no longer allowed)'),
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],

  /* WEIGHTED (half tank fight, half raid fight), on Windshaper (applied first). */
  w80restoTalents: [
    { label: 'Windshaper, the shipped 11/0/40 -- the control', apply: race('windshaper_skyborne') },
    { label: 'Windshaper, Subtlety 3 -> Tranquil Spirit 5 + Natural Shapeshifter 2', apply: chain(race('windshaper_skyborne'), delta(RESTO_BASE, { subtlety: 0, tranquil_spirit: 5, natural_shapeshifter: 2 })) },
    { label: 'Windshaper, Improved Moonfire 2 + Reach 1 -> Moonglow 3 (all dead; a check)', apply: chain(race('windshaper_skyborne'), delta(RESTO_BASE, { improved_moonfire: 0, nature_s_reach: 0, moonglow: 3 })) },
    { label: 'Windshaper, Nature’s Majesty 2 -> Improved Wrath 2', apply: chain(race('windshaper_skyborne'), delta(RESTO_BASE, { nature_s_majesty: 0, nature_s_splendor: 0, improved_wrath: 3 })) },
  ],

  /* From here the Resto baseline is Windshaper (shipped). Tank fight, 120 s. */
  w80restoTank: [
    control('list, tank healer fight'),
    ...[0.3, 0.4, 0.6].map((f) => ({
      label: `Innervate at mana <= ${f * 100}% (ours: 50%)`,
      apply: setCondition('innervate', manaAtMost(f)),
    })),
    ...[0.5, 0.25].map((f) => ({
      label: `Nature’s Swiftness at tank < ${f * 100}% (ours: 35%)`,
      apply: setCondition('natures_swiftness', { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: f } as AplCondition),
    })),
    ...[0.6, 0.8].map((f) => ({
      label: `Swiftmend on the tank under ${f * 100}% (ours: 70%)`,
      apply: setCondition('swiftmend', { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition),
    })),
    {
      label: '+ Regrowth on the tank under 50% even with Regrowth up, above Rejuvenation',
      apply: addAbove({ abilityId: 'regrowth', target: { kind: 'tank' }, condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.5 } as AplCondition }, 'rejuvenation'),
    },
  ],

  /* Both fights: the mana potion's gate. */
  w80restoPotion: [
    control('potion (Major Mana at <= 30% mana, Demonic Rune at 10%)'),
    ...[[0.5, 60], [0.4, 0], [0.5, 0], [0.2, 0]].map(([m, after]) => ({
      label: `Major Mana at mana <= ${m * 100}%${after ? ` after ${after}s` : ''}`,
      apply: setCondition('major_mana_potion', after ? all(manaAtMost(m), fightElapsed('atLeast', after)) : manaAtMost(m)),
    })),
    ...[0.2, 0.3].map((m) => ({
      label: `Demonic Rune at mana <= ${m * 100}%`,
      apply: setCondition('demonic_rune', manaAtMost(m)),
    })),
  ],

  /* The raid fight, 60 s: a Multi Target section of our own, the owner's lines kept. */
  w80restoRaid: [
    control('raid fight (the Single Target list)'),
    { label: 'smart healing on (list-wide)', apply: inMulti(SMART) },
    {
      label: '+ Wild Growth above Innervate (on cooldown first)',
      apply: inMulti(addAbove({ abilityId: 'wild_growth', target: { kind: 'lowestParty' }, condition: { kind: 'raidSize', compare: 'atLeast', count: 6 } as AplCondition }, 'innervate')),
    },
    {
      label: '+ Regrowth on the lowest under 60% without it, above the Rejuvenation spread',
      apply: inMulti(RAID_REGROWTH(0.6)),
    },
    {
      label: '+ Swiftmend on whoever carries Rejuvenation under 60%',
      apply: inMulti(RAID_SWIFTMEND(0.6)),
    },
    {
      label: '+ Healing Touch on the lowest under 50%, above the Rejuvenation spread',
      apply: inMulti(RAID_HT(0.5)),
    },
    {
      label: '+ Rejuvenation spread above the tank Rejuvenation',
      apply: inMulti(addAbove({ abilityId: 'rejuvenation', target: { kind: 'lowestHealth', withoutAura: 'rejuvenation' }, condition: { kind: 'health', on: 'target', compare: 'below', fraction: 1 } as AplCondition }, 'rejuvenation')),
    },
    { label: 'NOT SHIPPABLE: the owner’s tank Healing Touch pre-cast removed', apply: inMulti(removeNth('healing_touch', 1)) },
  ],

  /* The raid fight, round two: everything inside the Multi Target section. */
  w80restoRaid2: [
    control('raid fight'),
    ...[[0.5, 60], [0.5, 0], [0.4, 0], [0.2, 0]].map(([m, after]) => ({
      label: `Major Mana at mana <= ${m * 100}%${after ? ` after ${after}s` : ''}`,
      apply: inMulti(setCondition('major_mana_potion', after ? all(manaAtMost(m), fightElapsed('atLeast', after)) : manaAtMost(m))),
    })),
    ...[0.2, 0.3].map((m) => ({ label: `Demonic Rune at mana <= ${m * 100}%`, apply: inMulti(setCondition('demonic_rune', manaAtMost(m))) })),
    ...[0.3, 0.7].map((f) => ({ label: `Innervate at mana <= ${f * 100}% (ours 50%)`, apply: inMulti(setCondition('innervate', manaAtMost(f))) })),
    ...[0.9, 0.8, 0.7].map((f) => ({
      label: `NEEDS THE OWNER: Rejuvenation spread under ${f * 100}% (owner: 100%)`,
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'rejuvenation' && x.target?.kind === 'lowestHealth' ? { ...x, condition: { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition } : x)))),
    })),
    { label: 'Wild Growth above Innervate', apply: inMulti(moveAbove('wild_growth', 'innervate')) },
  ],

  w80restoRaid3: [
    control('raid fight'),
    ...[0.6, 0.7, 0.8].map((f) => ({
      label: `Innervate below Wild Growth, at mana <= ${f * 100}%`,
      apply: inMulti(setCondition('innervate', manaAtMost(f)), moveAbove('innervate', 'rejuvenation')),
    })),
    { label: 'Innervate at 70%, where it is', apply: inMulti(setCondition('innervate', manaAtMost(0.7))) },
    { label: 'Innervate below Wild Growth, at 50%', apply: inMulti(moveAbove('innervate', 'rejuvenation')) },
  ],

  /* The knock-on check, on the finished round 80 Moonkin. */
  w80moonTalents2: [
    control('41/0/10 (Genesis 5)'),
    { label: 'Genesis 2, Reflection 3 (the round 78 tree)', apply: moonTree(2, 3) },
    { label: 'Genesis 4, Reflection 1', apply: moonTree(4, 1) },
    { label: 'Genesis 3, Reflection 2', apply: moonTree(3, 2) },
  ],

  w80moonPrecombat: [
    control('opener (Moonkin Form 3s, Wrath 1.5s -- the owner)'),
    { label: '+ Insect Swarm at 0s (a pure DoT, after the Wrath)', apply: addPrecombat(0, 'insect_swarm') },
    { label: '+ Spellblasting Potion at 0s', apply: addPrecombat(0, 'major_spellblasting_potion') },
  ],

  w80moonSt: [
    control('Single Target list'),
    ...[0.05, 0.2, 0.35].map((f) => ({
      label: `Innervate at mana <= ${f * 100}% (shipped 10%)`,
      apply: setCondition('innervate', manaAtMost(f)),
    })),
    { label: 'Innervate removed', apply: removeEntry('innervate') },
    { label: 'Moonfire removed', apply: removeEntry('moonfire') },
    { label: 'Insect Swarm removed', apply: removeEntry('insect_swarm') },
    { label: 'Moonfire above Insect Swarm', apply: moveAbove('moonfire', 'insect_swarm') },
    { label: 'Starfire on any Eclipse stack (no NG Grace needed)', apply: setCondition('starfire', selfStacks('atLeast', 1, 'eclipse'), 1) },
    { label: 'Starfire at Eclipse >= 2 (was 3)', apply: setCondition('starfire', selfStacks('atLeast', 2, 'eclipse'), 0) },
    { label: 'Starfire at Eclipse >= 4 (was 3)', apply: setCondition('starfire', selfStacks('atLeast', 4, 'eclipse'), 0) },
    { label: 'Starfire ungated (Starfire filler, Wrath never)', apply: chain(setCondition('starfire', undefined, 0)) },
    { label: 'second Starfire entry removed (only at 3 Eclipse)', apply: removeNth('starfire', 1) },
    {
      label: 'Moonfire only while NG is down',
      apply: setCondition('moonfire', all(targetExpired('moonfire'), not(selfHas('natures_grace')))),
    },
    { label: '+ Hurricane above Wrath (single target)', apply: addAbove({ abilityId: 'hurricane' }, 'wrath') },
  ],

  /* Multi Target, at 5 targets / 60 s (re-checked at 3 and 8). */
  w80moonAoe: [
    control('Multi Target list (Hurricane at >= 4 targets)'),
    { label: 'Hurricane at >= 3 targets', apply: inMulti(setCondition('hurricane', targetCount('atLeast', 3))) },
    { label: 'Hurricane at >= 2 targets', apply: inMulti(setCondition('hurricane', targetCount('atLeast', 2))) },
    {
      label: 'Moonfire multi-DoT 3 above Hurricane',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'moonfire' ? { ...x, multiDot: 3 } : x))),
        moveAbove('moonfire', 'hurricane'),
      ),
    },
    {
      label: 'Insect Swarm multi-DoT 3 above Hurricane',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'insect_swarm' ? { ...x, multiDot: 3 } : x))),
        moveAbove('insect_swarm', 'hurricane'),
      ),
    },
    {
      label: 'Moonfire and Insect Swarm multi-DoT 5, below Hurricane',
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'moonfire' || x.abilityId === 'insect_swarm' ? { ...x, multiDot: 5 } : x)))),
    },
    {
      label: 'Starfire entries above Hurricane',
      apply: inMulti(moveAbove('starfire', 'hurricane')),
    },
    { label: 'Innervate at 35% in the Multi list', apply: inMulti(setCondition('innervate', manaAtMost(0.35))) },
    { label: 'Innervate above Hurricane at 50%', apply: inMulti(setCondition('innervate', manaAtMost(0.5)), moveAbove('innervate', 'hurricane')) },
  ],
};

void any;
void not;
void onCooldown;
void ready;
void targetCount;
void targetExpired;
void targetHas;
void selfHas;
void selfStacks;
void comboPoints;
void energy;
void ripLeft;
void manaAtLeast;
void addAbove;
void addAboveNth;
void addEntry;
void addPrecombat;
void consumable;
void enchant;
void inMulti;
void moveAbove;
void removeEntry;
void removePrecombat;
void setCondition;
void removeNth;
void delta;
void potionPair;
void CAT_BASE;
void BEAR_BASE;
void RESTO_BASE;
