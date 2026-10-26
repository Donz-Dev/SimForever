/*
 * ============================================================================
 * ROUND 78 -- THE FIVE PALADIN PRESETS, optimised for the full report.
 *
 *   PRESET=pally_ret FILE=tools/optimise/paladinVariants.ts VARIANTS=retApl DURATION=120 \
 *     npx vite-node tools/probe_build.ts
 *   PRESET=pally_ret FILE=tools/optimise/paladinVariants.ts VARIANTS=retAoe TARGETS=5 DURATION=60 \
 *     npx vite-node tools/probe_build.ts
 *
 * Objectives (the owner's): DPS at 1 target / 120 s (Single Target section) and
 * at 5 targets / 60 s (Multi Target, reused at 3/60 and 8/30); a tank's TPS at
 * the same; a healer's HPS in the tank healer fight (120 s, Single Target) and
 * the raid healer fight (60 s, Multi Target).
 *
 * THE THEME, which no variant here may move (Step 0):
 *
 *   preset              class    majority tree      style            stance   hit back
 *   pally_ret           paladin  Retribution 36     two-hander       battle   no
 *   pally_shockadin     paladin  Retribution 28     1H + shield      battle   no
 *   pally_shockadin_2h  paladin  Retribution 28     two-hander       battle   no
 *   prot_pally          paladin  Protection 34      1H + shield      battle   YES
 *   holy_pal            paladin  Holy 31            caster           battle   no (healer)
 *
 * GEAR IS E65 AND FIXED; only `enchantId` moves. Race may move (gear stays).
 *
 * WHAT SHIPPED (round 78), so the controls below are the post-ship presets:
 * Ret Reverence 3, Major Mana, wrists SP, Hammer above Judgement; Prot Major
 * Mana, Intellect Blasted Lands, threat gloves, SP wrists; Holy Pal Intellect
 * head and legs; a Multi Target list for all five. See docs/handoff/paladin.md.
 *
 * EVERY GROUP CARRIES ITS OWN CONTROL, labelled "the shipped X": `(p) => p` is
 * whatever the preset is on this branch, not what it was when a row was written.
 * ============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  not,
  resourceFraction,
  selfHas,
  targetCount,
} from '../../src/game/rotations/apl/shorthand';
import {
  PALADIN_RETRIBUTION,
  PALADIN_SHOCKADIN,
  PALADIN_PROTECTION,
} from '../../src/game/rotations/paladin';
import {
  type Apply,
  type Variant,
  PALADIN_TREE as tree,
  addAbove,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  moveToBottom,
  multiList,
  removeEntry,
} from '../buildVariants';

const CONTROL: Variant = { label: 'the shipped preset -- the control', apply: (p) => p };

/** A race swap, holding gear, talents, enchants, consumables and list fixed. */
const race =
  (r: CharacterProfile['character']['race']): Apply =>
  (p) => ({ ...p, character: { ...p.character, race: r } });

/** Replace one entry's condition, refusing when the id is absent or ambiguous. */
const gate = (abilityId: string, condition: AplEntry['condition']): Apply =>
  apl((entries) => {
    const hits = entries.filter((e) => e.abilityId === abilityId);
    if (hits.length !== 1) throw new Error(`${abilityId}: ${hits.length} entries`);
    return entries.map((e) => (e.abilityId === abilityId ? { ...e, condition } : e));
  });

/** Clear one consumable category. */
const withoutConsumable =
  (category: string): Apply =>
  (p) => {
    const { [category]: _gone, ...rest } = p.consumables as Record<string, string>;
    void _gone;
    return { ...p, consumables: rest as typeof p.consumables };
  };

const manaAtLeast = (f: number) => resourceFraction('atLeast', f, 'mana');

/* ----------------------------------------------------------------- talents */

/** Seal Twist Ret, as shipped: 15 Holy / 36 Retribution. */
const RET = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  reverence: 2,
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  seal_of_command: 1,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  two_handed_weapon_specialization: 3,
  vengeance: 3,
  champion_of_the_light: 3,
  instrument_of_law: 2,
  twist_of_light: 1,
};

/** The Shockadins' forced twenty below Holy tier 20, as `presets.ts` builds it. */
const SHOCK_HOLY_BELOW_20 = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  reverence: 3,
  healing_light: 3,
  divine_favor: 1,
};
const SHOCK_RET_BELOW_20 = {
  improved_judgement: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  sacred_arbiter: 1,
  benediction: 5,
  holy_conduit: 1,
};
const SHOCK_RET_1H = {
  ...SHOCK_RET_BELOW_20,
  holy_conduit: 2,
  pursuit_of_justice: 1,
  vengeance: 3,
  champion_of_the_light: 3,
};
const SHOCK_RET_2H = {
  ...SHOCK_RET_BELOW_20,
  vengeance: 3,
  two_handed_weapon_specialization: 2,
  champion_of_the_light: 3,
};

/** Prot Pally, as shipped: 8 Holy / 34 Protection / 9 Retribution. */
const PROT = {
  divine_strength: 5,
  improved_seals: 3,
  redoubt: 5,
  precision: 3,
  anticipation: 2,
  improved_seal_of_fury: 1,
  improved_righteous_fury: 3,
  shield_specialization: 3,
  sacred_duty: 2,
  swift_judgement: 1,
  one_handed_weapon_specialization: 3,
  templar_s_bulwark: 1,
  reckoning: 4,
  iron_creed: 5,
  holy_shield: 1,
  deflection: 5,
  improved_judgement: 2,
  holy_conduit: 2,
};

/** Holy Pal, as shipped: 31 Holy / 13 Protection / 7 Retribution. */
const HOLY = {
  divine_intellect: 5,
  healing_light: 3,
  spiritual_focus: 2,
  unyielding_faith: 2,
  voice_of_truth: 1,
  reverence: 3,
  infusion_of_light: 2,
  illumination: 5,
  divine_favor: 1,
  holy_shock: 1,
  holy_power: 5,
  light_s_vigil: 1,
  toughness: 5,
  anticipation: 5,
  improved_seal_of_fury: 1,
  sacred_duty: 2,
  benediction: 5,
  holy_conduit: 2,
};

const PROT_WIN_BASE: Apply = chain(
  consumable('potion', 'major_mana_potion'),
  consumable('blasted_lands', 'blasted_intellect'),
  enchant('gloves', 900024),
);

const HOLY_WIN_BASE: Apply = chain(enchant('head', 900006), enchant('legs', 900006));

/** One of the Holy list's entries, found by ability, target kind and whether it has a cancel. */
const holyIndex = (entries: readonly AplEntry[], abilityId: string, targetKind: string, cancel = false) => {
  const hits = entries
    .map((e, i) => [e, i] as const)
    .filter(([e]) => e.abilityId === abilityId && e.target?.kind === targetKind && !!e.cancel === cancel);
  if (hits.length !== 1) throw new Error(`${abilityId}/${targetKind}: ${hits.length} entries`);
  return hits[0][1];
};

const withHealthFraction = (entry: AplEntry, fraction: number): AplEntry => {
  if (entry.condition?.kind !== 'health') throw new Error(`${entry.abilityId}: not a health gate`);
  return { ...entry, condition: { ...entry.condition, fraction } };
};

const holyInsertAboveHolyLight = (entry: AplEntry): Apply =>
  apl((entries) => {
    entries.splice(holyIndex(entries, 'holy_light', 'tank'), 0, entry);
    return entries;
  });

const holyRaidFlashAt = (fraction: number): Apply =>
  apl((entries) => {
    const i = holyIndex(entries, 'flash_of_light', 'lowestHealth');
    entries[i] = withHealthFraction(entries[i], fraction);
    return entries;
  });

const holyTankFlashAt = (fraction: number): Apply =>
  apl((entries) => {
    const i = holyIndex(entries, 'flash_of_light', 'tank');
    entries[i] = withHealthFraction(entries[i], fraction);
    return entries;
  });

const holyTankHolyLightAt = (fraction: number): Apply =>
  apl((entries) => {
    const i = holyIndex(entries, 'holy_light', 'tank');
    entries[i] = withHealthFraction(entries[i], fraction);
    return entries;
  });

const RET_WIN_BASE: Apply = chain(
  tree({ ...RET, pursuit_of_justice: 1, reverence: 3 }),
  consumable('potion', 'major_mana_potion'),
  enchant('wrists', 900018),
);

/* ------------------------------------------------------- multi-target lists */

/** A stock list's entries with Consecration hoisted to the top of the real abilities. */
const consecrationFirst = (entries: readonly AplEntry[], aboveId: string): AplEntry[] => {
  const rest = entries.filter((e) => e.abilityId !== 'consecration');
  const at = rest.findIndex((e) => e.abilityId === aboveId);
  if (at < 0) throw new Error(`no ${aboveId}`);
  const cons = entries.find((e) => e.abilityId === 'consecration');
  if (!cons) throw new Error('no consecration');
  return [...rest.slice(0, at), { abilityId: 'consecration' }, ...rest.slice(at)];
};

export const RET_MULTI_ENTRIES = consecrationFirst(PALADIN_RETRIBUTION.entries, 'judgement');
export const SHOCK_MULTI_ENTRIES = consecrationFirst(PALADIN_SHOCKADIN.entries, 'judgement');
export const PROT_MULTI_ENTRIES = PALADIN_PROTECTION.entries;

/* ------------------------------------------------------------------ groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ======================== Seal Twist Ret, Single Target, 120 s ========== */
  retTalents: [
    CONTROL,
    {
      label: 'Pursuit of Justice 2 -> Reverence 3 + PoJ 1',
      apply: tree({ ...RET, pursuit_of_justice: 1, reverence: 3 }),
    },
    {
      label: 'Instrument of Law 2 -> Reverence 3 + PoJ... (IoL 0, Repentance 1)',
      apply: tree({ ...RET, instrument_of_law: 0, reverence: 3, repentance: 1 }),
    },
  ],

  retApl: [
    CONTROL,
    { label: 'Consecration only at mana >= 30%', apply: gate('consecration', manaAtLeast(0.3)) },
    { label: 'Consecration only at mana >= 50%', apply: gate('consecration', manaAtLeast(0.5)) },
    { label: 'Consecration only at mana >= 70%', apply: gate('consecration', manaAtLeast(0.7)) },
    { label: 'Consecration removed', apply: removeEntry('consecration') },
    { label: 'Consecration to the bottom (below the twist)', apply: moveToBottom('consecration') },
    { label: 'Holy Strike above Judgement', apply: moveAbove('holy_strike', 'judgement') },
    {
      label: 'Hammer of Wrath above Judgement',
      apply: moveAbove('hammer_of_wrath', 'judgement'),
    },
  ],

  retConsumables: [
    CONTROL,
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'blasted lands +25 Intellect (was Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    {
      label: 'weapon effect spell crit + 36 SP (was +2% melee crit)',
      apply: consumable('weapon_effect_main_hand', 'weapon_spell_crit_main_hand'),
    },
    {
      label: 'weapon effect Dense Sharpening Stone',
      apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand'),
    },
    {
      label: 'Major Mana + blasted Intellect',
      apply: chain(consumable('potion', 'major_mana_potion'), consumable('blasted_lands', 'blasted_intellect')),
    },
  ],

  retEnchants: [
    CONTROL,
    { label: 'wrists +16 Spell Power (was +9 Strength)', apply: enchant('wrists', 900018) },
    {
      label: 'head + legs +8 Intellect (was 1% Haste)',
      apply: chain(enchant('head', 900006), enchant('legs', 900006)),
    },
    { label: '2H Crusader (was +65 Spell Power)', apply: enchant('twoHand', 20034) },
    { label: '2H Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
  ],

  retRace: [
    CONTROL,
    { label: 'Dwarf (was Human)', apply: race('dwarf') },
    { label: 'Undead (was Human)', apply: race('undead') },
  ],

  retCombined: [
    CONTROL,
    { label: 'R: Reverence 3 + Major Mana + wrists SP', apply: RET_WIN_BASE },
    {
      label: 'R + Consecration at mana >= 30%',
      apply: chain(RET_WIN_BASE, gate('consecration', manaAtLeast(0.3))),
    },
    {
      label: 'R + Consecration at mana >= 15%',
      apply: chain(RET_WIN_BASE, gate('consecration', manaAtLeast(0.15))),
    },
    {
      label: 'R + Consecration at mana >= 50%',
      apply: chain(RET_WIN_BASE, gate('consecration', manaAtLeast(0.5))),
    },
    {
      label: 'R + blasted Intellect',
      apply: chain(RET_WIN_BASE, consumable('blasted_lands', 'blasted_intellect')),
    },
    {
      label: 'R + Consecration at 30% + MT Consecration first',
      apply: chain(
        RET_WIN_BASE,
        gate('consecration', manaAtLeast(0.3)),
        multiList('Paladin (Seal Twist Ret, AoE)', RET_MULTI_ENTRIES),
        inMulti(moveAbove('holy_strike', 'judgement')),
      ),
    },
  ],

  /*
   * CONSECRATION AT A 0s LEAD is the pure-DoT row of Gate B: it deals nothing
   * when cast, its first tick lands after the pull, and it saves the global
   * cooldown the fight would otherwise pay for it.
   */
  retPrecombat: [
    CONTROL,
    { label: 'add Consecration at 0s (after Judgement)', apply: addPrecombat(0, 'consecration') },
  ],

  /* ============ the two Shockadins (shared Single Target list), 120 s ===== */
  shockTalents: [
    CONTROL,
    {
      label: '1H: Divine Precision 2 (was Consecrated Ground 2)',
      apply: tree({ ...SHOCK_HOLY_BELOW_20, holy_shock: 1, divine_precision: 2, ...SHOCK_RET_1H }),
    },
    {
      label: '1H: Benediction 5 -> Deflection 5 (Benediction is the mana filler)',
      apply: tree({
        ...SHOCK_HOLY_BELOW_20,
        holy_shock: 1,
        consecrated_ground: 2,
        ...SHOCK_RET_1H,
        benediction: 0,
        deflection: 5,
      }),
    },
    {
      label: '2H: Divine Precision 1 + CG 1 (was CG 2)',
      apply: tree({
        ...SHOCK_HOLY_BELOW_20,
        holy_shock: 1,
        consecrated_ground: 1,
        divine_precision: 1,
        ...SHOCK_RET_2H,
      }),
    },
    {
      label: '2H: 2H Weapon Spec 3, CG 1 (was 2HWS 2, CG 2)',
      apply: tree({
        ...SHOCK_HOLY_BELOW_20,
        holy_shock: 1,
        consecrated_ground: 1,
        ...SHOCK_RET_2H,
        two_handed_weapon_specialization: 3,
      }),
    },
  ],

  shockApl: [
    CONTROL,
    { label: 'Holy Strike above Holy Shock', apply: moveAbove('holy_strike', 'holy_shock') },
    { label: 'Holy Shock above Consecration', apply: moveAbove('holy_shock', 'consecration') },
    { label: 'Hammer of Wrath ungated', apply: gate('hammer_of_wrath', undefined) },
    { label: 'Hammer of Wrath removed', apply: removeEntry('hammer_of_wrath') },
    { label: 'Consecration only at mana >= 20%', apply: gate('consecration', manaAtLeast(0.2)) },
    { label: 'Divine Favor removed', apply: removeEntry('divine_favor') },
  ],

  shockConsumables: [
    CONTROL,
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    {
      label: 'weapon effect spell crit + 36 SP (was Frost Oil)',
      apply: consumable('weapon_effect_main_hand', 'weapon_spell_crit_main_hand'),
    },
    { label: 'blasted lands +25 Strength (was Intellect)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'other: none (was Demonic Rune)', apply: withoutConsumable('other') },
  ],

  shockEnchants: [
    CONTROL,
    {
      label: 'head + legs +8 Intellect (was 1% Haste)',
      apply: chain(enchant('head', 900006), enchant('legs', 900006)),
    },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'neck +5 Strength (was +6 Spell Power)', apply: enchant('neck', 900008) },
  ],

  shockRace: [
    CONTROL,
    { label: 'Dwarf (was Human)', apply: race('dwarf') },
    { label: 'Undead (was Human)', apply: race('undead') },
  ],

  shockAoe: [
    CONTROL,
    { label: 'MT: Consecration first', apply: multiList('Paladin (Shockadin, AoE)', SHOCK_MULTI_ENTRIES) },
    {
      label: 'MT: Consecration first, Holy Strike above Holy Shock',
      apply: chain(
        multiList('Paladin (Shockadin, AoE)', SHOCK_MULTI_ENTRIES),
        inMulti(moveAbove('holy_strike', 'holy_shock')),
      ),
    },
    {
      label: 'MT: Consecration first, no Hammer of Wrath',
      apply: chain(
        multiList('Paladin (Shockadin, AoE)', SHOCK_MULTI_ENTRIES),
        inMulti(removeEntry('hammer_of_wrath')),
      ),
    },
  ],

  /* ================== Prot Pally, TPS at 1 target / 120 s ================ */
  protTalents: [
    CONTROL,
    { label: 'Deflection 5 -> Benediction 5', apply: tree({ ...PROT, deflection: 0, benediction: 5 }) },
    { label: 'Holy Conduit 2 -> Conviction 2', apply: tree({ ...PROT, holy_conduit: 0, conviction: 2 }) },
    {
      label: 'Improved Judgement 2 + Holy Conduit 2 -> Conviction 4',
      apply: tree({ ...PROT, holy_conduit: 0, improved_judgement: 0, conviction: 4 }),
    },
    { label: 'Precision 3 -> Anticipation 5', apply: tree({ ...PROT, precision: 0, anticipation: 5 }) },
    {
      label: 'Divine Strength 5 -> Divine Intellect 5',
      apply: tree({ ...PROT, divine_strength: 0, divine_intellect: 5 }),
    },
  ],

  protApl: [
    CONTROL,
    { label: 'Consecration above Holy Strike', apply: moveAbove('consecration', 'holy_strike') },
    { label: 'Holy Strike above Judgement', apply: moveAbove('holy_strike', 'judgement') },
    { label: 'Consecration above Judgement', apply: moveAbove('consecration', 'judgement') },
    { label: 'Swift Judgement removed', apply: removeEntry('swift_judgement') },
    {
      label: "Templar's Bulwark at 50% (was 35%)",
      apply: gate('templars_bulwark', { kind: 'health', on: 'self', compare: 'atMost', fraction: 0.5 }),
    },
  ],

  protConsumables: [
    CONTROL,
    { label: 'flask +150 Spell Power (was +1200 Hit Points)', apply: consumable('flask', 'flask_spell_power') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'other Demonic Rune (was Healthstone)', apply: consumable('other', 'demonic_rune') },
    { label: 'blasted lands +25 Intellect (was Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    {
      label: 'weapon effect Frost Oil (was spell crit)',
      apply: consumable('weapon_effect_main_hand', 'frost_oil_main_hand'),
    },
  ],

  protEnchants: [
    CONTROL,
    {
      label: 'head + legs +1% Haste (was +1% Dodge)',
      apply: chain(enchant('head', 900002), enchant('legs', 900002)),
    },
    { label: 'gloves +2% Threat (was +20 Spell Power)', apply: enchant('gloves', 900024) },
    { label: 'cloak +60 Armor (was +1% Dodge)', apply: enchant('cloak', 900013) },
    { label: 'neck +6 Spell Power (was +5 Defense)', apply: enchant('neck', 900009) },
    { label: 'wrists +16 Spell Power (was +4 Defense)', apply: enchant('wrists', 900018) },
  ],

  protRace: [
    CONTROL,
    { label: 'Dwarf (was Human)', apply: race('dwarf') },
    { label: 'Undead (was Human)', apply: race('undead') },
  ],

  protCombined: [
    CONTROL,
    { label: 'P: Major Mana + blasted Int + gloves +2% Threat', apply: PROT_WIN_BASE },
    { label: 'P + wrists +16 SP', apply: chain(PROT_WIN_BASE, enchant('wrists', 900018)) },
    {
      label: 'P + wrists +16 SP + neck +6 SP',
      apply: chain(PROT_WIN_BASE, enchant('wrists', 900018), enchant('neck', 900009)),
    },
    {
      label: 'P + Deflection 5 -> Benediction 5',
      apply: chain(PROT_WIN_BASE, tree({ ...PROT, deflection: 0, benediction: 5 })),
    },
    {
      label: 'P + flask +150 SP (owner gave this build the food, not the flask)',
      apply: chain(PROT_WIN_BASE, consumable('flask', 'flask_spell_power')),
    },
    {
      label: 'P + Demonic Rune (owner ruled tanks take the Healthstone)',
      apply: chain(PROT_WIN_BASE, consumable('other', 'demonic_rune')),
    },
    {
      label: 'P + MT Consecration above Templar\'s Bulwark',
      apply: chain(PROT_WIN_BASE, inMulti(moveAbove('consecration', 'templars_bulwark'))),
    },
  ],

  protAoe: [
    CONTROL,
    {
      label: 'MT: Consecration above Judgement',
      apply: inMulti(moveAbove('consecration', 'judgement')),
    },
    {
      label: 'MT: Consecration above Holy Strike',
      apply: inMulti(moveAbove('consecration', 'holy_strike')),
    },
    {
      label: 'MT: Consecration above Templar\'s Bulwark (after Holy Shield)',
      apply: inMulti(moveAbove('consecration', 'templars_bulwark')),
    },
  ],

  /* ===================== Holy Pal, HPS (tank 120 s / raid 60 s) =========== */
  holyConsumables: [
    CONTROL,
    { label: 'potion Spellblasting (was Major Mana)', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'other none (was Demonic Rune)', apply: withoutConsumable('other') },
    { label: 'food +28 Spell Power (was +44 Healing)', apply: consumable('food', 'food_spell_power') },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
  ],

  holyEnchants: [
    CONTROL,
    {
      label: 'head + legs +8 Intellect (was 1% Haste)',
      apply: chain(enchant('head', 900006), enchant('legs', 900006)),
    },
    {
      label: 'head + legs +8 Spirit (was 1% Haste)',
      apply: chain(enchant('head', 900007), enchant('legs', 900007)),
    },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'mainHand Revelation (was +30 Spell Power)', apply: enchant('mainHand', 900032) },
  ],

  holyRevert: [
    CONTROL,
    {
      label: 'head + legs back to +1% Haste (the round 78 Intellect reverted)',
      apply: chain(enchant('head', 900002), enchant('legs', 900002)),
    },
  ],

  holyRace: [
    CONTROL,
    { label: 'Dwarf (was Human)', apply: race('dwarf') },
    { label: 'Undead (was Human)', apply: race('undead') },
  ],

  holyApl: [
    CONTROL,
    {
      label: 'Holy Shock on the tank below 30% ABOVE Holy Light',
      apply: apl((entries) => {
        const i = entries.findIndex((e) => e.abilityId === 'holy_light' && e.condition);
        const j = entries.findIndex(
          (e, k) => k > i && e.abilityId === 'holy_shock' && e.target?.kind === 'tank',
        );
        if (i < 0 || j < 0) throw new Error('holy list shape');
        const [shock] = entries.splice(j, 1);
        entries.splice(i, 0, shock);
        return entries;
      }),
    },
    {
      label: 'add Divine Favor (on the tank below 50%) above Holy Light',
      apply: apl((entries) => {
        const i = entries.findIndex((e) => e.abilityId === 'holy_light' && e.condition);
        entries.splice(i, 0, {
          abilityId: 'divine_favor',
          condition: { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.5 } as AplEntry['condition'],
        });
        return entries;
      }),
    },
    {
      label: 'add Divine Favor unconditional, near the top',
      apply: apl((entries) => {
        const i = entries.findIndex((e) => e.abilityId === 'holy_light' && e.condition);
        entries.splice(i, 0, { abilityId: 'divine_favor' });
        return entries;
      }),
    },
  ],

  /*
   * THE RAID HEALER FIGHT RUNS THE MULTI TARGET SECTION, so every list edit
   * here goes through `inMulti`. The fight is MANA-BOUND at 60 s.
   */
  holyRaid: [
    CONTROL,
    { label: 'H: head + legs +8 Intellect', apply: HOLY_WIN_BASE },
    {
      label: 'H + MT Divine Favor unconditional, above the Holy Light line',
      apply: chain(HOLY_WIN_BASE, inMulti(holyInsertAboveHolyLight({ abilityId: 'divine_favor' }))),
    },
    {
      label: 'H + MT pre-cast Holy Light removed',
      apply: chain(
        HOLY_WIN_BASE,
        inMulti(apl((entries) => entries.filter((e) => !(e.abilityId === 'holy_light' && e.cancel)))),
      ),
    },
    {
      label: 'H + MT raid Flash of Light at 80% (was 70%)',
      apply: chain(HOLY_WIN_BASE, inMulti(holyRaidFlashAt(0.8))),
    },
    {
      label: 'H + MT raid Flash of Light at 60% (was 70%)',
      apply: chain(HOLY_WIN_BASE, inMulti(holyRaidFlashAt(0.6))),
    },
    {
      label: 'H + MT tank Holy Light at 50% (was 65%)',
      apply: chain(HOLY_WIN_BASE, inMulti(holyTankHolyLightAt(0.5))),
    },
    {
      label: 'H + MT tank Flash of Light at 90% (was 100%)',
      apply: chain(HOLY_WIN_BASE, inMulti(holyTankFlashAt(0.9))),
    },
  ],

  retAoe: [
    CONTROL,
    {
      label: 'MT: Consecration first + Consecration at 0s in the MT opener',
      apply: chain(
        multiList('Paladin (Seal Twist Ret, AoE)', RET_MULTI_ENTRIES),
        inMulti(moveAbove('holy_strike', 'judgement'), addPrecombat(0, 'consecration')),
      ),
    },
    { label: 'MT: Consecration first', apply: multiList('Paladin (Seal Twist Ret, AoE)', RET_MULTI_ENTRIES) },
    {
      label: 'MT: Consecration first, Holy Strike above Judgement',
      apply: chain(
        multiList('Paladin (Seal Twist Ret, AoE)', RET_MULTI_ENTRIES),
        inMulti(moveAbove('holy_strike', 'judgement')),
      ),
    },
    {
      label: 'MT: Consecration first, no Hammer of Wrath',
      apply: chain(
        multiList('Paladin (Seal Twist Ret, AoE)', RET_MULTI_ENTRIES),
        inMulti(removeEntry('hammer_of_wrath')),
      ),
    },
  ],
};

// Referenced so an unused-import lint does not flag helpers kept for later groups.
void [HOLY, all, not, selfHas, targetCount, addAbove, addPrecombat, PROT_MULTI_ENTRIES, SHOCK_MULTI_ENTRIES];
