/*
 * ============================================================================
 * ROUND 78 -- THE FOUR DRUID PRESETS, optimised for the full report's
 * encounters. Measured with `tools/probe_build.ts`:
 *
 *   PRESET=druid_moonkin FILE=tools/optimise/druidVariants.ts VARIANTS=moon78St DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=druid_moonkin FILE=tools/optimise/druidVariants.ts VARIANTS=moon78Aoe TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *   PRESET=druid_resto   FILE=tools/optimise/druidVariants.ts VARIANTS=resto78Raid FIGHT=raid DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE THEMES (Step 0), which no variant here may move:
 *
 * | preset | class | majority tree | style / form | target swings back |
 * | --- | --- | --- | --- | --- |
 * | druid_moonkin | druid | Balance 41 / Resto 10 | Moonkin Form, staff | no |
 * | druid_cat | druid | Feral 34 (9/34/8) | Cat Form, stat stick | no |
 * | druid_bear | druid | Feral 42 (9/42/0) | Bear Form, stat stick | YES -- figure is TPS |
 * | druid_resto | druid | Resto 40 (11/0/40) | caster, staff | healer -- figure is HPS |
 *
 * Group names are prefixed `moon78`, `cat78`, `bear78`, `resto78` because the
 * older `tools/druidVariants.ts` already owns `moonkin*` and `cat*`.
 *
 * EVERY GROUP STARTS WITH ITS CONTROL, labelled "the shipped ..." -- `(p) => p`
 * is whatever the preset carries now, never the value it had when written.
 * The figures each group produced are in docs/handoff/druid.md, round 78.
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
  multiList,
  removeEntry,
} from '../buildVariants';
import {
  all,
  any,
  comboPoints,
  not,
  resource,
  resourceFraction,
  selfHas,
  selfStacks,
  targetCount,
  targetExpired,
  targetHas,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character';

/* ---------------------------------------------------------------- helpers */

const control = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

/** Swap the race, holding gear, talents, enchants, consumables and buffs. */
const race =
  (id: RaceId): Apply =>
  (profile) => ({ ...profile, character: { ...profile.character, race: id } });

/**
 * Replace the condition of the `nth` entry casting `id` (0 = the first), and
 * refuse an id that is not there.
 */
const setCondition = (id: string, condition: AplCondition | undefined, nth = 0): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    const { condition: _old, ...rest } = entries[at];
    entries[at] = condition === undefined ? rest : { ...rest, condition };
    return entries;
  });

/** Remove the `nth` entry casting `id`. */
const removeNth = (id: string, nth: number): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    entries.splice(at, 1);
    return entries;
  });

const manaAtMost = (f: number) => resourceFraction('atMost', f, 'mana');
const manaAtLeast = (f: number) => resourceFraction('atLeast', f, 'mana');

/* ---------------------------------------------------------------- trees */

const MOONKIN_BALANCE = {
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

const BEAR_FERAL = {
  heart_of_the_wild: 5,
  feral_swiftness: 2,
  feral_instinct: 3,
  thick_hide: 3,
  savage_fury: 2,
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
const BEAR_BALANCE = { genesis: 5, nature_s_majesty: 2, nature_s_reach: 2 };

const RESTO_BALANCE = {
  genesis: 5,
  improved_moonfire: 2,
  nature_s_majesty: 2,
  nature_s_reach: 1,
  nature_s_splendor: 1,
};
const RESTO_CORE = {
  nature_s_focus: 5,
  naturalist: 5,
  reflection: 3,
  gift_of_nature: 5,
  gift_of_the_earthmother: 1,
  improved_rejuvenation: 3,
  swiftmend: 1,
  nature_s_swiftness: 1,
  living_spirit: 3,
  improved_regrowth: 5,
  wild_growth: 1,
};

/* ------------------------------------------------- the Multi Target lists */

/*
 * The Moonkin's AoE candidates. Hurricane is a ten second channel hitting
 * every target; Moonfire and Insect Swarm can be walked across several
 * targets with `multiDot`.
 */
const MOON_CORE_TAIL: AplEntry[] = [
  { abilityId: 'starfire', condition: selfStacks('atLeast', 3, 'eclipse') },
  { abilityId: 'starfire', condition: all(selfStacks('atLeast', 1, 'eclipse'), selfHas('natures_grace')) },
  { abilityId: 'wrath' },
];

const MOON_REFLECTION: Apply = tree({ ...MOONKIN_BALANCE, genesis: 2, nature_s_focus: 5, naturalist: 5, reflection: 3 });
const MOON_INNERVATE: Apply = addAbove({ abilityId: 'innervate', condition: manaAtMost(0.35) }, 'insect_swarm');

const BEAR_SWIPE: AplEntry = { abilityId: 'swipe', condition: targetCount('atLeast', 2) };
/** The Bear's AoE shape: Primal Bite first while Berserk is up, Swipe above Lacerate. */
const BEAR_AOE: readonly Apply[] = [
  addAbove(BEAR_SWIPE, 'lacerate'),
  addAbove({ abilityId: 'mangle', condition: selfHas('berserk') }, 'mangle'),
];

/* ------------------------------------------------------------ the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ======================================================== MOONKIN */

  /*
   * At 120s the Moonkin is MANA-bound (headroom 71 of 9,364, 0.8%), where at
   * 60s it had 20.6% spare -- so the mana talents are re-asked at 120s.
   */
  moon78Talents: [
    control('41/0/10 (Genesis 5, no Reflection)'),
    {
      label: 'Genesis 5 -> 2, Reflection 3',
      apply: tree({ ...MOONKIN_BALANCE, genesis: 2, nature_s_focus: 5, naturalist: 5, reflection: 3 }),
    },
    {
      label: 'Genesis 5 -> 3, Reflection 2',
      apply: tree({ ...MOONKIN_BALANCE, genesis: 3, nature_s_focus: 5, naturalist: 5, reflection: 2 }),
    },
    {
      label: 'Genesis 5 -> 4, Reflection 1',
      apply: tree({ ...MOONKIN_BALANCE, genesis: 4, nature_s_focus: 5, naturalist: 5, reflection: 1 }),
    },
  ],

  moon78Precombat: [
    control('opener (Moonkin Form 3s, Wrath 1.5s)'),
    { label: '+ Insect Swarm at 0s (a pure DoT, after the Wrath)', apply: addPrecombat(0, 'insect_swarm') },
  ],

  moon78St: [
    control('Single Target list'),
    ...[0.2, 0.35, 0.5].map((f) => ({
      label: `+ Innervate at mana <= ${f * 100}%, after the consumables`,
      apply: addAbove({ abilityId: 'innervate', condition: manaAtMost(f) }, 'insect_swarm'),
    })),
    { label: 'Moonfire removed', apply: removeEntry('moonfire') },
    { label: 'Moonfire only at mana >= 40%', apply: setCondition('moonfire', all(targetExpired('moonfire'), manaAtLeast(0.4))) },
    { label: 'Starfire on Nature\'s Grace (eclipse >= 1) removed', apply: removeNth('starfire', 1) },
    {
      label: 'both Starfires need mana >= 25%',
      apply: chain(
        setCondition('starfire', all(selfStacks('atLeast', 3, 'eclipse'), manaAtLeast(0.25)), 0),
        setCondition('starfire', all(selfStacks('atLeast', 1, 'eclipse'), selfHas('natures_grace'), manaAtLeast(0.25)), 1),
      ),
    },
    {
      label: 'Starfire on any eclipse stack (no Nature\'s Grace needed)',
      apply: setCondition('starfire', selfStacks('atLeast', 1, 'eclipse'), 1),
    },
  ],

  moon78Cons: [
    control('consumables (Spellblasting, Demonic Rune)'),
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'other: none (was Demonic Rune)', apply: (p) => {
        const { other: _o, ...rest } = p.consumables;
        return { ...p, consumables: rest };
      },
    },
  ],

  moon78Ench: [
    control('enchants (head and legs +1% Haste)'),
    { label: 'head +8 Intellect', apply: enchant('head', 900006) },
    { label: 'head +8 Spirit', apply: enchant('head', 900007) },
    { label: 'head and legs +8 Intellect', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  moon78Race: [
    control('race (Tauren)'),
    { label: 'Night Elf', apply: race('night_elf') },
    { label: 'High Order Skyborne', apply: race('high_order_skyborne') },
  ],

  moon78Aoe: [
    control('Multi Target section (the Single Target list)'),
    {
      label: 'Hurricane first, then the Single Target list',
      apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'insect_swarm')),
    },
    {
      label: 'Moonfire and Insect Swarm multi-DoT 5, then Hurricane, then the list',
      apply: inMulti(
        setCondition('insect_swarm', targetExpired('insect_swarm')),
        apl((e) => e.map((x) => (x.abilityId === 'insect_swarm' || x.abilityId === 'moonfire' ? { ...x, multiDot: 5 } : x))),
        addAbove({ abilityId: 'hurricane' }, 'starfire'),
      ),
    },
    {
      label: 'Hurricane first, Moonfire multi-DoT 5 after it',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'moonfire' ? { ...x, multiDot: 5 } : x))),
        addAbove({ abilityId: 'hurricane' }, 'insect_swarm'),
      ),
    },
    {
      label: 'Hurricane first, Insect Swarm and Moonfire dropped',
      apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'insect_swarm'), removeEntry('insect_swarm'), removeEntry('moonfire')),
    },
    {
      label: 'Hurricane while mana >= 30%, else the list',
      apply: inMulti(addAbove({ abilityId: 'hurricane', condition: manaAtLeast(0.3) }, 'insect_swarm')),
    },
  ],

  moon78Combined: [
    control('Moonkin'),
    { label: 'Reflection 3 (Genesis 2)', apply: MOON_REFLECTION },
    { label: 'Reflection + Innervate 35%', apply: chain(MOON_REFLECTION, MOON_INNERVATE) },
    { label: 'Reflection + Major Mana', apply: chain(MOON_REFLECTION, consumable('potion', 'major_mana_potion')) },
    { label: 'Reflection + Innervate + Major Mana', apply: chain(MOON_REFLECTION, MOON_INNERVATE, consumable('potion', 'major_mana_potion')) },
    { label: 'Innervate + Major Mana (no talent change)', apply: chain(MOON_INNERVATE, consumable('potion', 'major_mana_potion')) },
    { label: 'all three + Skyborne', apply: chain(MOON_REFLECTION, MOON_INNERVATE, consumable('potion', 'major_mana_potion'), race('high_order_skyborne')) },
    { label: 'all three + Skyborne + head/legs +8 Int', apply: chain(MOON_REFLECTION, MOON_INNERVATE, consumable('potion', 'major_mana_potion'), race('high_order_skyborne'), enchant('head', 900006), enchant('legs', 900006)) },
  ],

  moon78Combined2: [
    control('Moonkin'),
    { label: 'Reflection 3 (Genesis 2)', apply: MOON_REFLECTION },
    ...[0.05, 0.1, 0.2].map((f) => ({
      label: `Reflection + Innervate at mana <= ${f * 100}%`,
      apply: chain(MOON_REFLECTION, addAbove({ abilityId: 'innervate', condition: manaAtMost(f) }, 'insect_swarm')),
    })),
    { label: 'Reflection + Skyborne', apply: chain(MOON_REFLECTION, race('high_order_skyborne')) },
    { label: 'Reflection + Night Elf', apply: chain(MOON_REFLECTION, race('night_elf')) },
    {
      label: 'Reflection + Skyborne + Innervate at 10%',
      apply: chain(MOON_REFLECTION, race('high_order_skyborne'), addAbove({ abilityId: 'innervate', condition: manaAtMost(0.1) }, 'insect_swarm')),
    },
  ],

  moon78Aoe2: [
    control('Multi Target section (the Single Target list)'),
    { label: 'Hurricane first', apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'innervate')) },
    { label: 'Insect Swarm + Moonfire (boss), then Hurricane', apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'starfire')) },
    {
      label: 'Hurricane first, Innervate at 30%',
      apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'innervate'), setCondition('innervate', manaAtMost(0.3))),
    },
    {
      label: 'Hurricane first, then potion row',
      apply: inMulti(addAbove({ abilityId: 'hurricane' }, 'insect_swarm')),
    },
  ],

  /* ============================================================ CAT */

  cat78St: [
    control('Single Target list'),
    ...[0.2, 0.4].map((f) => ({
      label: `+ Innervate at mana <= ${f * 100}%, second`,
      apply: addAbove({ abilityId: 'innervate', condition: manaAtMost(f) }, 'berserk'),
    })),
    {
      label: '+ Ferocious Bite at 5 points while Rip has >= 6s, above the last Shred',
      apply: apl((e) => {
        const at = e.map((x) => x.abilityId).lastIndexOf('shred');
        e.splice(at, 0, { abilityId: 'ferocious_bite', condition: all(comboPoints('atLeast', 5), { kind: 'auraTime', on: 'target', auraId: 'rip', compare: 'atLeast', seconds: 6 } as AplCondition) });
        return e;
      }),
    },
    { label: '+ Ferocious Bite at 5 points, at the bottom', apply: addEntry({ abilityId: 'ferocious_bite', condition: comboPoints('atLeast', 5) }) },
  ],

  cat78Precombat: [
    control('opener (owner: Cat Form 2s, Prowl 1s, Berserk + Ravage 0s)'),
    { label: '+ Shifting Power at 0s, after Ravage', apply: addPrecombat(0, 'shifting_power') },
  ],

  cat78Cons: [
    control('consumables (Frenzy, Thistle Tea -- both the owner\'s)'),
    { label: 'potion Major Mana (was Frenzy) -- for Shifting Power', apply: consumable('potion', 'major_mana_potion') },
    { label: 'potion Mighty Rage (was Frenzy)', apply: consumable('potion', 'mighty_rage_potion') },
    { label: 'other Demonic Rune (was Thistle Tea)', apply: consumable('other', 'demonic_rune') },
  ],

  cat78Ench: [
    control('enchants (all agility)'),
    { label: 'head and legs +8 Strength', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'gloves +15 Strength', apply: enchant('gloves', 900021) },
    { label: 'gloves +1% Haste', apply: enchant('gloves', 900002) },
    { label: 'head and legs +1% Haste', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
  ],

  cat78Race: [
    control('race (Tauren)'),
    { label: 'Night Elf', apply: race('night_elf') },
    { label: 'High Order Skyborne', apply: race('high_order_skyborne') },
  ],

  cat78Aoe: [
    control('Multi Target section (the Single Target list)'),
    {
      label: 'Rake multi-DoT 3 (each target)',
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'rake' ? { ...x, multiDot: 3 } : x)))),
    },
    {
      label: 'Rake multi-DoT 5',
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'rake' ? { ...x, multiDot: 5 } : x)))),
    },
    {
      label: 'Rake multi-DoT 5, only at 0 combo points',
      apply: inMulti(
        apl((e) => e.map((x) => (x.abilityId === 'rake' ? { ...x, multiDot: 5 } : x))),
        addAbove({ abilityId: 'rake', multiDot: 5, condition: all(comboPoints('atMost', 0), targetExpired('rake')) }, 'rake'),
        removeNth('rake', 1),
        addAbove({ abilityId: 'rake', condition: targetExpired('rake') }, 'rip'),
      ),
    },
  ],

  /* =========================================================== BEAR (TPS) */

  bear78Talents: [
    control('9/42/0'),
    {
      label: 'Feral Charge 1 -> Ferocity 5',
      apply: tree({ ...BEAR_BALANCE, ...BEAR_FERAL, ferocity: 5 }),
    },
  ],

  bear78St: [
    control('Single Target list'),
    ...[30, 55, 70].map((r) => ({
      label: `Maul at rage >= ${r} (was 42)`,
      apply: setCondition('maul', resource('atLeast', r, 'rage')),
    })),
    { label: 'Lacerate above Primal Bite', apply: moveAbove('lacerate', 'mangle') },
    { label: 'Faerie Fire removed', apply: removeEntry('faerie_fire') },
    { label: 'Demoralizing Roar removed', apply: removeEntry('demoralizing_roar') },
    { label: '+ Swipe below Lacerate (single target)', apply: addAbove({ abilityId: 'swipe' }, 'faerie_fire') },
  ],

  bear78Ench: [
    control('enchants'),
    { label: 'gloves +2% Threat (was +15 Agility)', apply: enchant('gloves', 900024) },
    { label: 'feet +7 Agility (was Minor Speed)', apply: enchant('feet', 900026) },
    { label: 'feet +7 Stamina (was Minor Speed)', apply: enchant('feet', 900027) },
    { label: 'head and legs +8 Agility (was +1% Dodge)', apply: chain(enchant('head', 900003), enchant('legs', 900003)) },
    { label: 'head and legs +8 Strength (was +1% Dodge)', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'head and legs +1% Haste (was +1% Dodge)', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
  ],

  bear78Cons: [
    control('consumables'),
    { label: 'blasted lands +25 Strength (was Agility)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'food +20 Strength (was Agility)', apply: consumable('food', 'food_strength') },
    { label: 'flask +150 Spell Power (was +1200 HP)', apply: consumable('flask', 'flask_spell_power') },
  ],

  bear78Race: [
    control('race (Tauren)'),
    { label: 'Night Elf', apply: race('night_elf') },
    { label: 'High Order Skyborne', apply: race('high_order_skyborne') },
  ],

  bear78Aoe: [
    control('Multi Target section (the Single Target list)'),
    { label: 'Swipe above Primal Bite', apply: inMulti(addAbove(BEAR_SWIPE, 'mangle')) },
    { label: 'Swipe above Lacerate', apply: inMulti(addAbove(BEAR_SWIPE, 'lacerate')) },
    { label: 'Swipe above Maul', apply: inMulti(addAbove(BEAR_SWIPE, 'maul')) },
    {
      label: 'Swipe above Primal Bite, Lacerate dropped',
      apply: inMulti(addAbove(BEAR_SWIPE, 'mangle'), removeEntry('lacerate')),
    },
    {
      label: 'Primal Bite first while Berserk is up, then Swipe above Primal Bite',
      apply: inMulti(
        addAbove(BEAR_SWIPE, 'mangle'),
        addAbove({ abilityId: 'mangle', condition: selfHas('berserk') }, 'swipe'),
      ),
    },
  ],

  bear78Aoe2: [
    control('Multi Target section'),
    { label: 'Berserk Primal Bite first, Swipe above Lacerate', apply: inMulti(...BEAR_AOE) },
    {
      label: 'Berserk Primal Bite first, Swipe above Primal Bite',
      apply: inMulti(addAbove(BEAR_SWIPE, 'mangle'), addAbove({ abilityId: 'mangle', condition: selfHas('berserk') }, 'swipe')),
    },
    {
      label: 'BEAR_AOE + Lacerate multi-DoT 3',
      apply: inMulti(...BEAR_AOE, apl((e) => e.map((x) => (x.abilityId === 'lacerate' ? { ...x, multiDot: 3 } : x)))),
    },
    ...[30, 60].map((r) => ({
      label: `BEAR_AOE + Maul at rage >= ${r}`,
      apply: inMulti(...BEAR_AOE, setCondition('maul', resource('atLeast', r, 'rage'))),
    })),
    {
      label: 'BEAR_AOE, Berserk moved above Enrage',
      apply: inMulti(...BEAR_AOE, moveAbove('berserk', 'enrage')),
    },
  ],

  /* =========================================================== RESTO (HPS) */

  resto78Talents: [
    control('owner\'s 11/0/40'),
    {
      label: 'Subtlety 3 -> Tranquil Spirit 5 (+1) and Natural Shapeshifter 2',
      apply: tree({ ...RESTO_BALANCE, ...RESTO_CORE, tranquil_spirit: 5, natural_shapeshifter: 2 }),
    },
  ],

  resto78Tank: [
    control('list, tank healer fight'),
    ...[0.3, 0.7].map((f) => ({
      label: `Innervate at mana <= ${f * 100}% (ours: 50%)`,
      apply: setCondition('innervate', manaAtMost(f)),
    })),
    ...[0.5, 0.2].map((f) => ({
      label: `Nature's Swiftness at tank < ${f * 100}% (ours: 35%)`,
      apply: setCondition('natures_swiftness', { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: f } as AplCondition),
    })),
    ...[0.7, 0.3].map((f) => ({
      label: `Swiftmend on the tank under ${f * 100}% (ours: 50%)`,
      apply: setCondition('swiftmend', { kind: 'health', on: 'target', compare: 'below', fraction: f } as AplCondition),
    })),
  ],

  resto78Cons: [
    control('consumables'),
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'flask +1200 HP? no -- school power none (dead for a healer)', apply: (p) => p },
    { label: 'food +28 Spell Power (was +44 Healing)', apply: consumable('food', 'food_spell_power') },
  ],

  resto78Ench: [
    control('enchants'),
    { label: 'head and legs +8 Intellect (was +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head and legs +8 Spirit (was +1% Haste)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'feet +7 Stamina (was +7 Agility)', apply: enchant('feet', 900027) },
  ],

  resto78Race: [
    control('race (Night Elf)'),
    { label: 'Tauren', apply: race('tauren') },
    { label: 'High Order Skyborne', apply: race('high_order_skyborne') },
  ],

  resto78Raid: [
    control('raid section (the Single Target list)'),
    {
      label: 'tank Healing Touch pre-cast removed',
      apply: inMulti(removeNth('healing_touch', 1)),
    },
    {
      label: '+ Healing Touch on the lowest under 50%, above the Rejuvenation spread',
      apply: inMulti(
        apl((e) => {
          const at = e.findIndex((x) => x.abilityId === 'rejuvenation' && x.target?.kind === 'lowestHealth');
          e.splice(at, 0, {
            abilityId: 'healing_touch',
            target: { kind: 'lowestHealth' },
            condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.5 },
          });
          return e;
        }),
      ),
    },
    {
      label: '+ Regrowth on the lowest under 70% without it, above the Rejuvenation spread',
      apply: inMulti(
        apl((e) => {
          const at = e.findIndex((x) => x.abilityId === 'rejuvenation' && x.target?.kind === 'lowestHealth');
          e.splice(at, 0, {
            abilityId: 'regrowth',
            target: { kind: 'lowestHealth', withoutAura: 'regrowth' },
            condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.7 },
          });
          return e;
        }),
      ),
    },
    {
      label: '+ Swiftmend on whoever carries Rejuvenation under 50%, below the tank Swiftmend',
      apply: inMulti(
        apl((e) => {
          const at = e.findIndex((x) => x.abilityId === 'swiftmend');
          e.splice(at + 1, 0, {
            abilityId: 'swiftmend',
            target: { kind: 'withAura', auraId: 'rejuvenation' },
            condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.5 },
          });
          return e;
        }),
      ),
    },
    {
      label: 'Wild Growth above Swiftmend',
      apply: inMulti(moveAbove('wild_growth', 'natures_swiftness')),
    },
    {
      label: 'Rejuvenation spread above the tank Rejuvenation',
      apply: inMulti(
        apl((e) => {
          const at = e.findIndex((x) => x.abilityId === 'rejuvenation' && x.target?.kind === 'lowestHealth');
          const [entry] = e.splice(at, 1);
          const tankAt = e.findIndex((x) => x.abilityId === 'rejuvenation');
          e.splice(tankAt, 0, entry);
          return e;
        }),
      ),
    },
  ],
};

// Silence unused-import lint for helpers kept for later groups.
void any;
void not;
void targetHas;
void MOON_CORE_TAIL;
void multiList;
