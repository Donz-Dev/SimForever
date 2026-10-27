/*
 * ============================================================================
 * ROUND 80 -- THE FIVE PALADIN PRESETS, the second run of the owner's
 * "Optimize, Update, and Report all Profiles", under the round 79 rules.
 *
 *   PRESET=pally_ret FILE=tools/optimise/paladinVariants80.ts VARIANTS=p80RetTalents WEIGHTED=1 \
 *     npx vite-node tools/probe_build.ts
 *   PRESET=pally_ret FILE=tools/optimise/paladinVariants80.ts VARIANTS=p80RetApl DURATION=120 \
 *     npx vite-node tools/probe_build.ts
 *   PRESET=pally_ret FILE=tools/optimise/paladinVariants80.ts VARIANTS=p80RetAoe TARGETS=5 DURATION=60 \
 *     npx vite-node tools/probe_build.ts
 *
 * THE THEME, which no variant here may move (Step 0):
 *
 *   preset              class    majority tree      style            stance   hit back
 *   pally_ret           paladin  Retribution 35     two-hander       battle   no
 *   pally_shockadin     paladin  Retribution 28     1H + shield      battle   no
 *   pally_shockadin_2h  paladin  Retribution 28     two-hander       battle   no
 *   prot_pally          paladin  Protection 34      1H + shield      battle   YES
 *   holy_pal            paladin  Holy 31            caster           battle   no (healer)
 *
 * GEAR IS E65 AND FIXED; only `enchantId` moves. RACE: UNDEAD IS THE ONLY
 * ALLOWED PALADIN RACE (round 79), so every preset moved off Human first and
 * every other group below is measured on the Undead presets.
 *
 * EVERY GROUP CARRIES ITS OWN CONTROL, labelled "the shipped X": `(p) => p` is
 * whatever the preset is on this branch, not what it was when a row was written.
 * The figures are in docs/handoff/paladin.md, round 80.
 * ============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  any,
  fightElapsed,
  fightRemaining,
  not,
  resourceFraction,
  selfExpired,
  selfHas,
  swungWithin,
} from '../../src/game/rotations/apl/shorthand';
import {
  type Apply,
  type Variant,
  PALADIN_TREE as tree,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  moveToBottom,
  removeEntry,
  removePrecombat,
} from '../buildVariants';

const CONTROL: Variant = { label: 'the shipped preset -- the control', apply: (p) => p };

/** A race swap, holding gear, talents, enchants, consumables and list fixed. */
const race =
  (r: CharacterProfile['character']['race']): Apply =>
  (p) => ({ ...p, character: { ...p.character, race: r } });

/* ----------------------------------------------------------------- helpers */

const manaAtLeast = (f: number) => resourceFraction('atLeast', f, 'mana');
const manaAtMost = (f: number) => resourceFraction('atMost', f, 'mana');

/** Replace the ONE entry matching `test` (throws on 0 or 2+). */
const replaceWhere = (what: string, test: (e: AplEntry) => boolean, make: (old: AplEntry) => AplEntry): Apply =>
  apl((entries) => {
    const hits = entries.filter(test);
    if (hits.length !== 1) throw new Error(`${what}: ${hits.length} entries`);
    return entries.map((e) => (test(e) ? make(e) : e));
  });

const replaceEntry = (abilityId: string, make: (old: AplEntry) => AplEntry): Apply =>
  replaceWhere(abilityId, (e) => e.abilityId === abilityId, make);

const gate = (abilityId: string, condition: AplCondition | undefined): Apply =>
  replaceEntry(abilityId, (e) => {
    const { condition: _old, ...rest } = e;
    void _old;
    return condition ? { ...rest, condition } : rest;
  });

/** Clear one consumable category. */
const withoutConsumable =
  (category: string): Apply =>
  (p) => {
    const { [category]: _gone, ...rest } = p.consumables as Record<string, string>;
    void _gone;
    return { ...p, consumables: rest as typeof p.consumables };
  };

/**
 * THE POTION PAIR. Both rows selected; the list's two potion entries gated.
 * `manaGate` is the Major Mana Potion's condition, `blastGate` Spellblasting's
 * (undefined = ungated, i.e. drunk at the pull, which puts the mana potion on
 * the shared two-minute cooldown with it).
 */
const potionPair = (
  primary: 'major_mana_potion' | 'major_spellblasting_potion',
  manaGate: AplCondition | undefined,
  blastGate: AplCondition | undefined,
): Apply => {
  const secondary = primary === 'major_mana_potion' ? 'major_spellblasting_potion' : 'major_mana_potion';
  return chain(
    potionSelection(primary, secondary),
    potionGates(manaGate, blastGate),
  );
};

/** The two potion rows, which are SHARED by both sections (never inside `inMulti`). */
const potionSelection = (primary: string, secondary: string): Apply =>
  chain(consumable('potion', primary), consumable('potion_secondary', `secondary_${secondary}`));

/** The list half of the pair, for whichever section it is applied to. */
const potionGates = (manaGate: AplCondition | undefined, blastGate: AplCondition | undefined): Apply => {
  const entry = (abilityId: string, condition: AplCondition | undefined): AplEntry =>
    condition ? { abilityId, condition } : { abilityId };
  return chain(
    /*
     * A STORED LIST DROPS THE ENTRY OF A CONSUMABLE THAT IS NOT SELECTED, so
     * the two potion entries are UPSERTED where the shared group puts them:
     * the mana potion first, Spellblasting straight after it.
     */
    apl((entries) => {
      const rest = entries.filter(
        (e) => e.abilityId !== 'major_mana_potion' && e.abilityId !== 'major_spellblasting_potion',
      );
      const at = entries.findIndex(
        (e) => e.abilityId === 'major_mana_potion' || e.abilityId === 'major_spellblasting_potion',
      );
      if (at < 0) throw new Error('no potion entry to replace');
      const before = entries.slice(0, at).filter((e) => rest.includes(e));
      const after = rest.slice(before.length);
      return [
        ...before,
        entry('major_mana_potion', manaGate),
        entry('major_spellblasting_potion', blastGate),
        ...after,
      ];
    }),
  );
};

/** The Seal Twist: AND a clause onto the SWAP half of both seals, never the seed. */
const twistGated = (extra: AplCondition): Apply =>
  apl((entries) =>
    entries.map((e) => {
      if (e.abilityId === 'seal_of_righteousness') return { ...e, condition: all(e.condition!, extra) };
      if (e.abilityId === 'seal_of_command') {
        const c = e.condition!;
        if (c.kind !== 'any' || c.of.length !== 2) throw new Error('seal_of_command shape');
        return { ...e, condition: any(c.of[0], all(c.of[1], extra)) };
      }
      return e;
    }),
  );

/** Swap one seal for another: the list entry and the opener line. */
const sealSwap = (from: string, to: string): Apply =>
  chain(
    replaceEntry(from, (e) => ({ ...e, abilityId: to, condition: selfExpired(to) })),
    (p) => ({
      ...p,
      precombat: (p.precombat ?? []).map((a) => (a.abilityId === from ? { ...a, abilityId: to } : a)),
    }),
  );

/* ----------------------------------------------------------------- talents */

/** Seal Twist Ret, as shipped: 16 Holy / 35 Retribution. */
const RET = {
  divine_strength: 5, divine_intellect: 5, improved_seals: 3, reverence: 3,
  benediction: 5, improved_judgement: 2, holy_conduit: 2, conviction: 5, vindication: 3,
  sanctified_judgement: 3, seal_of_command: 1, pursuit_of_justice: 1, sacred_arbiter: 1,
  two_handed_weapon_specialization: 3, vengeance: 3, champion_of_the_light: 3,
  instrument_of_law: 2, twist_of_light: 1,
};

const SHOCK_HOLY = {
  divine_strength: 5, divine_intellect: 5, improved_seals: 3, reverence: 3, healing_light: 3,
  divine_favor: 1, holy_shock: 1, consecrated_ground: 2,
};
const SHOCK_RET_BELOW_20 = {
  improved_judgement: 2, conviction: 5, vindication: 3, sanctified_judgement: 3, sacred_arbiter: 1,
  benediction: 5, holy_conduit: 1,
};
const SHOCK_1H = {
  ...SHOCK_HOLY, ...SHOCK_RET_BELOW_20, holy_conduit: 2, pursuit_of_justice: 1, vengeance: 3, champion_of_the_light: 3,
};
const SHOCK_2H = {
  ...SHOCK_HOLY, ...SHOCK_RET_BELOW_20, vengeance: 3, two_handed_weapon_specialization: 2, champion_of_the_light: 3,
};

/** Prot Pally, as shipped: 8 Holy / 34 Protection / 9 Retribution. */
const PROT = {
  divine_strength: 5, improved_seals: 3, redoubt: 5, precision: 3, anticipation: 2,
  improved_seal_of_fury: 1, improved_righteous_fury: 3, shield_specialization: 3, sacred_duty: 2,
  swift_judgement: 1, one_handed_weapon_specialization: 3, templar_s_bulwark: 1, reckoning: 4,
  iron_creed: 5, holy_shield: 1, deflection: 5, improved_judgement: 2, holy_conduit: 2,
};

/* ---------------------------------------------------------- Holy Pal list */

type HealthCondition = Extract<AplCondition, { kind: 'health' }>;

/** One of the Holy list's entries, by ability, target kind and whether it has a cancel. */
const holyAt = (abilityId: string, targetKind: string, cancel = false) => (e: AplEntry) =>
  e.abilityId === abilityId && e.target?.kind === targetKind && !!e.cancel === cancel;

/** Set a health threshold, whether the entry's condition is a bare health or an all(...) holding one. */
const withHealth = (e: AplEntry, fraction: number): AplEntry => {
  const c = e.condition;
  if (c?.kind === 'health') return { ...e, condition: { ...c, fraction } };
  if (c?.kind === 'all') {
    return {
      ...e,
      condition: { ...c, of: c.of.map((x) => (x.kind === 'health' ? ({ ...x, fraction } as HealthCondition) : x)) },
    };
  }
  throw new Error(`${e.abilityId}: no health gate`);
};

const holyThreshold = (abilityId: string, targetKind: string, fraction: number): Apply =>
  replaceWhere(`${abilityId}/${targetKind}`, holyAt(abilityId, targetKind), (e) => withHealth(e, fraction));

const preCastCancel = (fraction: number, atFraction = 0.8): Apply =>
  replaceWhere('pre-cast holy light', holyAt('holy_light', 'tank', true), (e) => ({
    ...e,
    cancel: {
      atFraction,
      condition: { kind: 'health', on: 'target', compare: 'above', fraction },
    },
  }));

const smartHealing =
  (on: boolean): Apply =>
  (p) => {
    const { smartHealing: _s, ...rest } = p.rotation;
    void _s;
    return { ...p, rotation: { ...rest, source: 'custom', ...(on ? { smartHealing: true } : {}) } };
  };

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  p80Race: [CONTROL, { label: 'Undead (was Human) -- the only legal Paladin race', apply: race('undead') }],

  /* ============================ Seal Twist Ret ============================ */
  p80RetTalents: [
    CONTROL,
    { label: 'shipped tree written out (Gate A check)', apply: tree(RET) },
    { label: 'Pursuit of Justice 1 -> Deflection 1 (both dead)', apply: tree({ ...RET, pursuit_of_justice: 0, deflection: 1 }) },
    {
      label: 'Reverence 3 -> Unyielding Faith 2 + Voice of Truth 1',
      apply: tree({ ...RET, reverence: 0, unyielding_faith: 2, voice_of_truth: 1 }),
    },
    { label: 'Benediction 5 -> Deflection 5', apply: tree({ ...RET, benediction: 0, deflection: 5 }) },
    { label: 'Holy Conduit 2 -> Deflection 2', apply: tree({ ...RET, holy_conduit: 0, deflection: 2 }) },
    { label: 'Vindication 3 -> PoJ 1 + Eye for an Eye 2', apply: tree({ ...RET, vindication: 0, pursuit_of_justice: 2, eye_for_an_eye: 2 }) },
    { label: 'Improved Seals 3 -> Healing Light 3', apply: tree({ ...RET, improved_seals: 0, healing_light: 3 }) },
  ],

  p80RetPotion: [
    CONTROL,
    { label: 'pair: mana < 30% (shipped gate), Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.3), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 20%, Spellblasting last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 40%, Spellblasting last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.4), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 50%, Spellblasting last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.5), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 60%, Spellblasting last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.6), fightRemaining('atMost', 30)) },
    {
      label: 'pair: mana < 50% AND 60 s elapsed (the owner example), Spellblasting last 30 s',
      apply: potionPair('major_mana_potion', all(manaAtMost(0.5), fightElapsed('atLeast', 60)), fightRemaining('atMost', 30)),
    },
    { label: 'pair: Spellblasting at the pull, mana potion < 30%', apply: potionPair('major_spellblasting_potion', manaAtMost(0.3), undefined) },
    { label: 'Demonic Rune removed (other: none)', apply: withoutConsumable('other') },
  ],

  p80RetApl: [
    CONTROL,
    { label: 'Consecration only at mana >= 15%', apply: gate('consecration', manaAtLeast(0.15)) },
    { label: 'Consecration only at mana >= 30%', apply: gate('consecration', manaAtLeast(0.3)) },
    { label: 'Consecration removed', apply: removeEntry('consecration') },
    { label: 'Consecration above Holy Strike', apply: moveAbove('consecration', 'holy_strike') },
    { label: 'Consecration above Judgement', apply: moveAbove('consecration', 'judgement') },
    { label: 'Holy Strike above Judgement', apply: moveAbove('holy_strike', 'judgement') },
    { label: 'Holy Strike to the bottom (below the twist)', apply: moveToBottom('holy_strike') },
    { label: 'twist swaps only at mana >= 10%', apply: twistGated(manaAtLeast(0.1)) },
    { label: 'twist swaps only at mana >= 20%', apply: twistGated(manaAtLeast(0.2)) },
    { label: 'twist swaps only at mana >= 35%', apply: twistGated(manaAtLeast(0.35)) },
    { label: 'Hammer of Wrath below Holy Strike', apply: moveAbove('hammer_of_wrath', 'consecration') },
    {
      label: 'Righteousness is the seed seal (twist reversed)',
      apply: apl((entries) =>
        entries.map((e) => {
          if (e.abilityId === 'seal_of_command') {
            return { abilityId: 'seal_of_command', condition: all(selfHas('seal_of_righteousness'), not(selfHas('echo_seal_of_righteousness'))) };
          }
          if (e.abilityId === 'seal_of_righteousness') {
            return {
              abilityId: 'seal_of_righteousness',
              condition: any(
                all(not(selfHas('seal_of_command')), not(selfHas('seal_of_righteousness'))),
                all(selfHas('seal_of_command'), not(selfHas('echo_seal_of_command'))),
              ),
            };
          }
          return e;
        }),
      ),
    },
  ],

  /* THE TWIST'S SEALS ARE THE OWNER'S OPENER AND LIST LINES: a win is a question. */
  p80RetSeal: [
    CONTROL,
    {
      label: 'twist Command <-> FURY (Fury replaces Righteousness, opener too)',
      apply: chain(
        apl((entries) => JSON.parse(JSON.stringify(entries).replace(/seal_of_righteousness/g, 'seal_of_fury'))),
        (p) => ({ ...p, precombat: (p.precombat ?? []).map((a) => (a.abilityId === 'seal_of_righteousness' ? { ...a, abilityId: 'seal_of_fury' } : a)) }),
      ),
    },
    {
      label: 'twist Command <-> CRUSADER (40% faster swings; only Command can echo)',
      apply: chain(
        apl((entries) => JSON.parse(JSON.stringify(entries).replace(/seal_of_righteousness/g, 'seal_of_the_crusader'))),
        (p) => ({ ...p, precombat: (p.precombat ?? []).map((a) => (a.abilityId === 'seal_of_righteousness' ? { ...a, abilityId: 'seal_of_the_crusader' } : a)) }),
      ),
    },
    {
      label: 'no twist: Seal of Command only',
      apply: chain(removeEntry('seal_of_righteousness'), gate('seal_of_command', selfExpired('seal_of_command'))),
    },
    {
      label: 'no twist: Seal of Righteousness only',
      apply: chain(removeEntry('seal_of_command'), gate('seal_of_righteousness', selfExpired('seal_of_righteousness'))),
    },
  ],

  p80RetAoe: [
    CONTROL,
    { label: 'MT: Consecration at 0s in the MT opener (pure DoT, first tick after the pull)', apply: inMulti(addPrecombat(0, 'consecration')) },
    { label: 'MT: pair, Spellblasting at the pull, mana potion < 30%', apply: chain(potionSelection('major_mana_potion', 'major_spellblasting_potion'), inMulti(potionGates(manaAtMost(0.3), undefined))) },
    { label: 'MT: Judgement above Holy Strike', apply: inMulti(moveAbove('judgement', 'holy_strike')) },
    { label: 'MT: Hammer of Wrath to the top', apply: inMulti(moveAbove('hammer_of_wrath', 'consecration')) },
    { label: 'MT: twist swaps only at mana >= 20%', apply: inMulti(twistGated(manaAtLeast(0.2))) },
    { label: 'MT: Holy Strike removed', apply: inMulti(removeEntry('holy_strike')) },
  ],

  p80RetConsumables: [
    CONTROL,
    { label: 'blasted lands +25 Intellect (was Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'weapon effect spell crit + SP (was +2% melee crit)', apply: consumable('weapon_effect_main_hand', 'weapon_spell_crit_main_hand') },
    { label: 'weapon effect Dense Sharpening Stone', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
    { label: 'weapon effect Frost Oil', apply: consumable('weapon_effect_main_hand', 'frost_oil_main_hand') },
    { label: 'food +attack power (was spell power)', apply: consumable('food', 'food_attack_power') },
  ],

  p80RetEnchants: [
    CONTROL,
    { label: 'head + legs +8 Intellect (was 1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head + legs +8 Strength (was 1% Haste)', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'gloves +20 Spell Power (was 1% Haste)', apply: enchant('gloves', 900023) },
    { label: 'gloves +15 Strength (was 1% Haste)', apply: enchant('gloves', 900021) },
    { label: 'neck +6 Spell Power (was +5 Strength)', apply: enchant('neck', 900009) },
    { label: '2H Crusader (was +65 Spell Power)', apply: enchant('twoHand', 20034) },
    { label: '2H Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
    { label: '2H +25 Agility (was +65 Spell Power)', apply: enchant('twoHand', 900031) },
  ],

  /* ==================== the two Shockadins (one list) ==================== */
  p80ShockTalents: [
    CONTROL,
    { label: '1H: shipped tree written out (Gate A check)', apply: tree(SHOCK_1H) },
    { label: '1H: Reverence 3 -> Unyielding Faith 2 + Spiritual Focus 1', apply: tree({ ...SHOCK_1H, reverence: 0, unyielding_faith: 2, spiritual_focus: 1 }) },
    { label: '1H: Benediction 5 -> Deflection 5', apply: tree({ ...SHOCK_1H, benediction: 0, deflection: 5 }) },
    { label: '1H: Holy Conduit 2 -> 1, Pursuit of Justice 1 -> 2', apply: tree({ ...SHOCK_1H, holy_conduit: 1, pursuit_of_justice: 2 }) },
    { label: '1H: Divine Precision 1 out of Consecrated Ground 1', apply: tree({ ...SHOCK_1H, consecrated_ground: 1, divine_precision: 1 }) },
  ],

  p80Shock2hTalents: [
    CONTROL,
    { label: '2H: shipped tree written out (Gate A check)', apply: tree(SHOCK_2H) },
    { label: '2H: Reverence 3 -> Unyielding Faith 2 + Spiritual Focus 1', apply: tree({ ...SHOCK_2H, reverence: 0, unyielding_faith: 2, spiritual_focus: 1 }) },
    { label: '2H: Benediction 5 -> Deflection 5', apply: tree({ ...SHOCK_2H, benediction: 0, deflection: 5 }) },
    { label: '2H: 2HWS 2 -> 1, Pursuit of Justice 1', apply: tree({ ...SHOCK_2H, two_handed_weapon_specialization: 1, pursuit_of_justice: 1 }) },
    { label: '2H: Divine Precision 1 out of Consecrated Ground 1', apply: tree({ ...SHOCK_2H, consecrated_ground: 1, divine_precision: 1 }) },
  ],

  /* SEAL CHOICE IS THE OWNER'S OPENER LINE AND LIST LINE, so a win here is a question. */
  p80ShockSeal: [
    CONTROL,
    { label: 'Seal of Fury instead of Righteousness (opener + list)', apply: sealSwap('seal_of_righteousness', 'seal_of_fury') },
    { label: 'Seal of the Crusader instead of Righteousness', apply: sealSwap('seal_of_righteousness', 'seal_of_the_crusader') },
    {
      label: '1H: Seal of Command (PoJ 1 -> SoC 1) instead of Righteousness',
      apply: chain(tree({ ...SHOCK_1H, pursuit_of_justice: 0, seal_of_command: 1 }), sealSwap('seal_of_righteousness', 'seal_of_command')),
    },
    {
      label: '2H: Seal of Command (2HWS 2 -> 1, SoC 1) instead of Righteousness',
      apply: chain(tree({ ...SHOCK_2H, two_handed_weapon_specialization: 1, seal_of_command: 1 }), sealSwap('seal_of_righteousness', 'seal_of_command')),
    },
  ],

  p80ShockApl: [
    CONTROL,
    { label: 'Holy Strike above Holy Shock', apply: moveAbove('holy_strike', 'holy_shock') },
    { label: 'Holy Shock above Consecration', apply: moveAbove('holy_shock', 'consecration') },
    { label: 'Holy Shock above Judgement', apply: moveAbove('holy_shock', 'judgement') },
    { label: 'Consecration below Holy Strike', apply: moveAbove('holy_strike', 'consecration') },
    { label: 'Consecration removed', apply: removeEntry('consecration') },
    { label: 'Holy Strike removed', apply: removeEntry('holy_strike') },
    { label: 'Hammer of Wrath within 150 ms of a swing (was 300)', apply: replaceEntry('hammer_of_wrath', (e) => ({ ...e, condition: swungWithin('mainHand', 150) })) },
    { label: 'Hammer of Wrath within 600 ms of a swing (was 300)', apply: replaceEntry('hammer_of_wrath', (e) => ({ ...e, condition: swungWithin('mainHand', 600) })) },
    { label: 'Hammer of Wrath within 1000 ms of a swing (was 300)', apply: replaceEntry('hammer_of_wrath', (e) => ({ ...e, condition: swungWithin('mainHand', 1000) })) },
    { label: 'Hammer of Wrath above Holy Strike (gate kept)', apply: moveAbove('hammer_of_wrath', 'holy_strike') },
    { label: 'Divine Favor only with Holy Shock ready', apply: gate('divine_favor', { kind: 'cooldown', abilityId: 'holy_shock', state: 'ready' }) },
    { label: 'Divine Favor removed', apply: removeEntry('divine_favor') },
    { label: 'Consecration only at mana >= 20%', apply: gate('consecration', manaAtLeast(0.2)) },
  ],

  p80ShockPotion: [
    CONTROL,
    { label: 'pair: Spellblasting at the pull, mana potion < 30% (the secondary)', apply: potionPair('major_spellblasting_potion', manaAtMost(0.3), undefined) },
    { label: 'pair: mana potion < 30%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.3), fightRemaining('atMost', 30)) },
    { label: 'pair: mana potion < 20%, Spellblasting in the last 45 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 45)) },
    { label: 'pair: Spellblasting only after 5 s (Vengeance and Consecration up)', apply: potionPair('major_spellblasting_potion', manaAtMost(0.3), fightElapsed('atLeast', 5)) },
    { label: 'Demonic Rune removed', apply: withoutConsumable('other') },
  ],

  p80ShockPotion2: [
    CONTROL,
    { label: 'pair: mana < 20%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 20%, Spellblasting in the last 45 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 45)) },
    { label: 'pair: mana < 20%, Spellblasting in the last 60 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 60)) },
    { label: 'pair: mana < 20%, Spellblasting in the last 80 s', apply: potionPair('major_mana_potion', manaAtMost(0.2), fightRemaining('atMost', 80)) },
    { label: 'pair: mana < 10%, Spellblasting in the last 45 s', apply: potionPair('major_mana_potion', manaAtMost(0.1), fightRemaining('atMost', 45)) },
    { label: 'pair: mana < 5%, Spellblasting in the last 45 s', apply: potionPair('major_mana_potion', manaAtMost(0.05), fightRemaining('atMost', 45)) },
    { label: 'Spellblasting only, in the last 45 s (no secondary)', apply: gate('major_spellblasting_potion', fightRemaining('atMost', 45)) },
  ],

  p80ShockPrecombat: [
    CONTROL,
    { label: 'ST: Consecration at 0s, after the owner Judgement line', apply: addPrecombat(0, 'consecration') },
    { label: 'ST: Divine Favor at 0s (off the GCD)', apply: addPrecombat(0, 'divine_favor') },
  ],

  p80ShockAoe: [
    CONTROL,
    { label: 'MT: Consecration at 0s in the MT opener', apply: inMulti(addPrecombat(0, 'consecration')) },
    { label: 'MT: Holy Shock removed', apply: inMulti(removeEntry('holy_shock')) },
    { label: 'MT: Holy Strike above Judgement', apply: inMulti(moveAbove('holy_strike', 'judgement')) },
    { label: 'MT: Hammer of Wrath removed', apply: inMulti(removeEntry('hammer_of_wrath')) },
    { label: 'MT: Divine Favor removed', apply: inMulti(removeEntry('divine_favor')) },
    { label: 'MT: pair, Spellblasting at pull + mana potion < 30%', apply: chain(potionSelection('major_spellblasting_potion', 'major_mana_potion'), inMulti(potionGates(manaAtMost(0.3), undefined))) },
  ],

  p80ShockConsumables: [
    CONTROL,
    { label: 'weapon effect spell crit + SP (was Frost Oil)', apply: consumable('weapon_effect_main_hand', 'weapon_spell_crit_main_hand') },
    { label: 'weapon effect +2% melee crit (was Frost Oil)', apply: consumable('weapon_effect_main_hand', 'weapon_melee_crit_main_hand') },
    { label: 'weapon effect Dense Sharpening Stone (was Frost Oil)', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
    { label: 'blasted lands +25 Strength (was Intellect)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'food +attack power (was spell power)', apply: consumable('food', 'food_attack_power') },
  ],

  p80ShockEnchants: [
    CONTROL,
    { label: 'head + legs +8 Intellect (was 1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head + legs +8 Strength (was 1% Haste)', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'wrists +9 Strength (was +16 Spell Power)', apply: enchant('wrists', 900017) },
  ],

  p80Shock1hWeapon: [
    CONTROL,
    { label: 'mainHand Crusader (was +30 Spell Power)', apply: enchant('mainHand', 20034) },
    { label: 'mainHand Revelation (was +30 Spell Power)', apply: enchant('mainHand', 900032) },
    { label: 'mainHand +15 Agility (was +30 Spell Power)', apply: enchant('mainHand', 900022) },
  ],

  p80Shock2hWeapon: [
    CONTROL,
    { label: '2H Crusader (was +65 Spell Power)', apply: enchant('twoHand', 20034) },
    { label: '2H Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
    { label: '2H +25 Agility (was +65 Spell Power)', apply: enchant('twoHand', 900031) },
  ],

  /* =============================== Prot Pally ============================= */
  p80ProtTalents: [
    CONTROL,
    { label: 'shipped tree written out (Gate A check)', apply: tree(PROT) },
    { label: 'Deflection 5 -> Benediction 5', apply: tree({ ...PROT, deflection: 0, benediction: 5 }) },
    { label: 'Sacred Duty 2 -> Reckoning 5 + Anticipation 3', apply: tree({ ...PROT, sacred_duty: 0, reckoning: 5, anticipation: 3 }) },
    {
      label: 'Improved Righteous Fury 3 -> Conviction 3',
      apply: tree({ ...PROT, improved_righteous_fury: 0, conviction: 3 }),
    },
    {
      label: 'Improved RF 3 + Sacred Duty 2 -> Reckoning 5 + Conviction 4',
      apply: tree({ ...PROT, improved_righteous_fury: 0, sacred_duty: 0, reckoning: 5, conviction: 4 }),
    },
    { label: 'Anticipation 2 -> Conviction 2', apply: tree({ ...PROT, anticipation: 0, conviction: 2 }) },
    { label: 'Deflection 5 -> Benediction 5, Anticipation 2 -> Conviction 2', apply: tree({ ...PROT, deflection: 0, benediction: 5, anticipation: 0, conviction: 2 }) },
    { label: 'Divine Strength 5 -> Divine Intellect 5', apply: tree({ ...PROT, divine_strength: 0, divine_intellect: 5 }) },
  ],

  /*
   * BOTH ROUND-ONE WINNERS TOGETHER, which the tree does not allow as written:
   * Templar's Bulwark (tier 20) needs 20 Protection points strictly below it,
   * so taking Improved Righteous Fury AND Sacred Duty out leaves 19 unless
   * Anticipation goes to 4.
   */
  p80ProtTalents2: [
    CONTROL,
    { label: 'Improved Righteous Fury 3 -> Conviction 3', apply: tree({ ...PROT, improved_righteous_fury: 0, conviction: 3 }) },
    { label: 'Sacred Duty 2 -> Reckoning 5 + Anticipation 3', apply: tree({ ...PROT, sacred_duty: 0, reckoning: 5, anticipation: 3 }) },
    {
      label: 'IRF 3 + Sacred Duty 2 -> Reckoning 5, Anticipation 4, Conviction 2',
      apply: tree({ ...PROT, improved_righteous_fury: 0, sacred_duty: 0, reckoning: 5, anticipation: 4, conviction: 2 }),
    },
    {
      label: 'IRF 3 + Sacred Duty 2 -> Reckoning 5, Anticipation 3, Imp. Hammer of Justice 1, Conviction 2',
      apply: tree({ ...PROT, improved_righteous_fury: 0, sacred_duty: 0, reckoning: 5, anticipation: 3, improved_hammer_of_justice: 1, conviction: 2 }),
    },
  ],

  p80ProtConsumables: [
    CONTROL,
    { label: 'flask +150 Spell Power (owner gave this build the food, not the flask)', apply: consumable('flask', 'flask_spell_power') },
    { label: 'pair: mana < 30%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.3), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 50%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.5), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 15%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.15), fightRemaining('atMost', 30)) },
    { label: 'pair: Spellblasting at the pull, mana potion < 30%', apply: potionPair('major_spellblasting_potion', manaAtMost(0.3), undefined) },
    { label: 'other Demonic Rune (owner ruled tanks take the Healthstone)', apply: consumable('other', 'demonic_rune') },
    { label: 'weapon effect Frost Oil (was spell crit)', apply: consumable('weapon_effect_main_hand', 'frost_oil_main_hand') },
  ],

  p80ProtApl: [
    CONTROL,
    { label: 'Consecration above Holy Strike', apply: moveAbove('consecration', 'holy_strike') },
    { label: 'Consecration above Judgement', apply: moveAbove('consecration', 'judgement') },
    { label: 'Holy Strike above Judgement', apply: moveAbove('holy_strike', 'judgement') },
    { label: 'Consecration only at mana >= 20%', apply: gate('consecration', manaAtLeast(0.2)) },
    { label: 'Consecration only at mana >= 40%', apply: gate('consecration', manaAtLeast(0.4)) },
    { label: "Templar's Bulwark removed", apply: removeEntry('templars_bulwark') },
    { label: 'Seal of Fury instead of Righteousness (owner line)', apply: chain(sealSwap('seal_of_righteousness', 'seal_of_fury'), replaceEntry('swift_judgement', (e) => ({ ...e, condition: all({ kind: 'not', of: { kind: 'cooldown', abilityId: 'judgement', state: 'ready' } }, selfHas('seal_of_fury')) }))) },
  ],

  p80ProtAoe: [
    CONTROL,
    { label: 'MT: Consecration at 0s in the MT opener', apply: inMulti(addPrecombat(0, 'consecration')) },
    { label: 'MT: Holy Strike above Judgement', apply: inMulti(moveAbove('holy_strike', 'judgement')) },
    { label: 'MT: Consecration above Holy Shield', apply: inMulti(moveAbove('consecration', 'holy_shield')) },
    { label: 'MT: pair, Spellblasting at pull + mana potion < 30%', apply: chain(potionSelection('major_mana_potion', 'major_spellblasting_potion'), inMulti(potionGates(manaAtMost(0.3), undefined))) },
  ],

  p80ProtAoe2: [
    CONTROL,
    {
      label: 'MT: Spellblasting at pull',
      apply: chain(potionSelection('major_mana_potion', 'major_spellblasting_potion'), inMulti(potionGates(manaAtMost(0.3), undefined))),
    },
    {
      label: 'MT: Spellblasting at pull + Consecration at 0s',
      apply: chain(
        potionSelection('major_mana_potion', 'major_spellblasting_potion'),
        inMulti(potionGates(manaAtMost(0.3), undefined), addPrecombat(0, 'consecration')),
      ),
    },
    {
      label: 'MT: Spellblasting at pull + Consecration at 0s + Holy Strike above Judgement',
      apply: chain(
        potionSelection('major_mana_potion', 'major_spellblasting_potion'),
        inMulti(potionGates(manaAtMost(0.3), undefined), addPrecombat(0, 'consecration'), moveAbove('holy_strike', 'judgement')),
      ),
    },
    {
      label: 'MT: Spellblasting at pull + Holy Strike above Judgement',
      apply: chain(
        potionSelection('major_mana_potion', 'major_spellblasting_potion'),
        inMulti(potionGates(manaAtMost(0.3), undefined), moveAbove('holy_strike', 'judgement')),
      ),
    },
  ],

  p80ProtEnchants: [
    CONTROL,
    { label: 'head + legs +8 Intellect (was +1% Dodge)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head + legs +1% Haste (was +1% Dodge)', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'neck +6 Spell Power (was +5 Defense)', apply: enchant('neck', 900009) },
    { label: 'cloak +5 Agility (was +1% Dodge)', apply: enchant('cloak', 900011) },
    { label: 'feet +7 Agility (was +7 Stamina)', apply: enchant('feet', 900026) },
    { label: 'mainHand Crusader (was +30 Spell Power)', apply: enchant('mainHand', 20034) },
  ],

  /* ================================ Holy Pal ============================== */
  p80HolyPotion: [
    CONTROL,
    { label: 'pair: mana < 30%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.3), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 50%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.5), fightRemaining('atMost', 30)) },
    { label: 'pair: mana < 15%, Spellblasting in the last 30 s', apply: potionPair('major_mana_potion', manaAtMost(0.15), fightRemaining('atMost', 30)) },
    { label: 'pair: Spellblasting at the pull, mana potion < 30%', apply: potionPair('major_spellblasting_potion', manaAtMost(0.3), undefined) },
    { label: 'Demonic Rune removed', apply: withoutConsumable('other') },
  ],

  /* THE TANK HEALER FIGHT RUNS THE SINGLE TARGET LIST (FIGHT=tank, 120 s). */
  p80HolyTank: [
    CONTROL,
    { label: 'smart healing OFF (the owner default is on)', apply: smartHealing(false) },
    { label: 'Holy Light below 50% (was 65%)', apply: holyThreshold('holy_light', 'tank', 0.5) },
    { label: 'Holy Light below 80% (was 65%)', apply: holyThreshold('holy_light', 'tank', 0.8) },
    { label: 'Holy Light below 90% (was 65%)', apply: holyThreshold('holy_light', 'tank', 0.9) },
    { label: 'raid Flash of Light below 50% (was 70%)', apply: holyThreshold('flash_of_light', 'lowestHealth', 0.5) },
    { label: 'raid Flash of Light below 95% (was 70%)', apply: holyThreshold('flash_of_light', 'lowestHealth', 0.95) },
    { label: 'tank Flash of Light below 90% (was 100%)', apply: holyThreshold('flash_of_light', 'tank', 0.9) },
    { label: 'tank Flash of Light below 80% (was 100%)', apply: holyThreshold('flash_of_light', 'tank', 0.8) },
    { label: 'Holy Shock below 60% (was 30%)', apply: holyThreshold('holy_shock', 'tank', 0.6) },
    { label: 'pre-cast cancelled above 90% (was 95%)', apply: preCastCancel(0.9) },
    { label: 'pre-cast cancelled above 99% (was 95%)', apply: preCastCancel(0.99) },
    { label: 'pre-cast removed (owner line)', apply: apl((entries) => entries.filter((e) => !(e.abilityId === 'holy_light' && e.cancel))) },
    { label: 'add Divine Favor above the Holy Light line', apply: apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'divine_favor' }); return entries; }) },
  ],

  /* THE RAID HEALER FIGHT RUNS THE MULTI TARGET LIST (FIGHT=raid, 60 s). */
  p80HolyRaid: [
    CONTROL,
    { label: 'MT: smart healing OFF', apply: inMulti(smartHealing(false)) },
    { label: 'MT: pre-cast Holy Light removed (owner line)', apply: inMulti(apl((entries) => entries.filter((e) => !(e.abilityId === 'holy_light' && e.cancel)))) },
    { label: 'MT: pre-cast cancelled above 90% (was 95%)', apply: inMulti(preCastCancel(0.9)) },
    { label: 'MT: pre-cast cancelled above 99% (was 95%)', apply: inMulti(preCastCancel(0.99)) },
    { label: 'MT: pre-cast cancelled at 60% of the cast (was 80%)', apply: inMulti(preCastCancel(0.95, 0.6)) },
    { label: 'MT: Holy Light below 50% (was 65%)', apply: inMulti(holyThreshold('holy_light', 'tank', 0.5)) },
    { label: 'MT: Holy Light below 80% (was 65%)', apply: inMulti(holyThreshold('holy_light', 'tank', 0.8)) },
    { label: 'MT: raid Flash below 50% (was 70%)', apply: inMulti(holyThreshold('flash_of_light', 'lowestHealth', 0.5)) },
    { label: 'MT: tank Flash below 90% (was 100%)', apply: inMulti(holyThreshold('flash_of_light', 'tank', 0.9)) },
    { label: 'MT: tank Flash below 80% (was 100%)', apply: inMulti(holyThreshold('flash_of_light', 'tank', 0.8)) },
    { label: 'MT: Divine Favor removed', apply: inMulti(removeEntry('divine_favor')) },
  ],

  /* ADDITIONS ONLY (the owner's lines stay as written), raid fight, 60 s. */
  p80HolyRaid2: [
    CONTROL,
    {
      label: 'MT: pair, Spellblasting at the pull + mana potion < 30%',
      apply: chain(potionSelection('major_mana_potion', 'major_spellblasting_potion'), inMulti(potionGates(manaAtMost(0.3), undefined))),
    },
    { label: 'MT: mana potion under 50% (was 30%)', apply: inMulti(gate('major_mana_potion', manaAtMost(0.5))) },
    { label: 'MT: mana potion under 70% (was 30%)', apply: inMulti(gate('major_mana_potion', manaAtMost(0.7))) },
    { label: 'MT: mana potion under 90% (was 30%)', apply: inMulti(gate('major_mana_potion', manaAtMost(0.9))) },
    {
      label: 'MT: add Flash of Light (lowest) above the Holy Light line when mana < 40%',
      apply: inMulti(apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' }, condition: manaAtMost(0.4) }); return entries; })),
    },
    {
      label: 'MT: add Flash of Light (lowest) above the Holy Light line when mana < 70%',
      apply: inMulti(apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' }, condition: manaAtMost(0.7) }); return entries; })),
    },
    {
      label: 'MT: add Flash of Light (lowest) above the Holy Light line, always',
      apply: inMulti(apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' } }); return entries; })),
    },
  ],

  p80HolyTank2: [
    CONTROL,
    {
      label: 'add Flash of Light (lowest) above the Holy Light line when mana < 40%',
      apply: apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' }, condition: manaAtMost(0.4) }); return entries; }),
    },
    { label: 'mana potion under 50% (was 30%)', apply: gate('major_mana_potion', manaAtMost(0.5)) },
    { label: 'pre-cast cancelled above 80% (owner line)', apply: preCastCancel(0.8) },
    { label: 'pre-cast cancelled above 85% (owner line)', apply: preCastCancel(0.85) },
    { label: 'pre-cast cancelled above 90% (owner line)', apply: preCastCancel(0.9) },
    { label: 'pre-cast cancelled above 90% at 95% of the cast (owner line)', apply: preCastCancel(0.9, 0.95) },
    { label: 'add Divine Favor above the Holy Light line', apply: apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'divine_favor' }); return entries; }) },
  ],

  /* THE MANA-CONSERVING FLASH, swept (an ADDITION above the owner's four lines). */
  p80HolyTank3: [
    CONTROL,
    ...[0.2, 0.3, 0.4, 0.5, 0.6, 0.8].map((f) => ({
      label: `add Flash of Light (lowest) above the Holy Light line when mana < ${f * 100}%`,
      apply: apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' }, condition: manaAtMost(f) }); return entries; }),
    })),
    {
      label: 'add Flash of Light (lowest) above the Holy Light line, always',
      apply: apl((entries) => { const i = entries.findIndex(holyAt('holy_light', 'tank')); entries.splice(i, 0, { abilityId: 'flash_of_light', target: { kind: 'lowestHealth' } }); return entries; }),
    },
    ...[0.4, 0.6].map((f) => ({
      label: `add Flash of Light (lowest) above the Holy Light line when mana < ${f * 100}% AND the target is below 100%`,
      apply: apl((entries) => {
        const i = entries.findIndex(holyAt('holy_light', 'tank'));
        entries.splice(i, 0, {
          abilityId: 'flash_of_light',
          target: { kind: 'lowestHealth' },
          condition: all(manaAtMost(f), { kind: 'health', on: 'target', compare: 'below', fraction: 1 }),
        });
        return entries;
      }),
    })),
  ],

  p80HolyConsumables: [
    CONTROL,
    { label: 'food +28 Spell Power (was +44 Healing)', apply: consumable('food', 'food_spell_power') },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'flask +1200 Hit Points (was +150 SP)', apply: consumable('flask', 'flask_hit_points') },
  ],

  p80HolyEnchants: [
    CONTROL,
    { label: 'head + legs +8 Spirit (was +8 Intellect)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'head + legs +1% Haste (was +8 Intellect)', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'neck +6 Spell Power (was +11 Healing Power)', apply: enchant('neck', 900009) },
    { label: 'wrists +16 Spell Power (was +16 Healing Power)', apply: enchant('wrists', 900018) },
  ],
};

void [removePrecombat];
