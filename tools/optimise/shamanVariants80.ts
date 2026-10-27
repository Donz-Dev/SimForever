/*
 * ==============================================================================
 * ROUND 80 -- THE THREE SHAMAN PRESETS, SECOND RUN OF THE OWNER'S PROCEDURE.
 *
 *   PRESET=shaman_elemental FILE=tools/optimise/shamanVariants80.ts VARIANTS=e80race WEIGHTED=1 npx vite-node tools/probe_build.ts
 *   PRESET=shaman_elemental FILE=tools/optimise/shamanVariants80.ts VARIANTS=e80st DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=shaman_elemental FILE=tools/optimise/shamanVariants80.ts VARIANTS=e80aoe TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *   PRESET=shaman_resto FILE=tools/optimise/shamanVariants80.ts VARIANTS=r80raid FIGHT=raid DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE THEME, WHICH DOES NOT MOVE (Step 0):
 *
 *   | preset              | class  | majority tree     | style               | target swings |
 *   | shaman_elemental    | shaman | Elemental 32      | caster, mace+shield | no |
 *   | shaman_enhancement  | shaman | Enhancement 32    | two-hander          | no |
 *   | shaman_resto        | shaman | Restoration 39    | caster, mace+shield | no (healer) |
 *
 * Every group carries a control. Talents, race, enchants and stat consumables
 * are measured with WEIGHTED=1 (49/17/17/17, or 50/50 for the healer); the
 * Single Target list at 1 target / 120 s; the Multi Target list at 5 / 60 s and
 * checked at 3 / 60 and 8 / 30.
 *
 * WHAT SHIPPED (so a group measured after a ship is about the NEW build):
 *   Ele   main hand Revelation (e80enchants); Spellblasting secondary -- last
 *         30 s on one target, at the pull in Multi (e80pot, e80aoe); Multi Flame
 *         Shock held while Revelation is up (e80revAoe2)
 *   Enh   Elemental Focus 1 + AK 1 -> Tidal Focus 2 (n80talents3); Spellblasting
 *         secondary, Multi only from 5 targets (n80aoe, n80aoeCheck)
 *   Resto raid Chain Heal ungated on the Riptide target (r80raid, r80raid2)
 * The `*combined` groups price each as a revert on the finished build.
 * docs/handoff/shaman.md round 80 has every figure.
 * ==============================================================================
 */
import {
  type Variant,
  SHAMAN_TREE as tree,
  addAbove,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  precombatLead,
  removeEntry,
  removePrecombat,
} from '../buildVariants';
import type { CharacterProfile } from '../../src/profiles';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  any,
  fightElapsed,
  fightRemaining,
  not,
  resourceFraction,
  selfHas,
  selfStacks,
  targetCount,
  targetExpired,
  targetHas,
  targetTime,
} from '../../src/game/rotations/apl';

const race =
  (id: string) =>
  (profile: CharacterProfile): CharacterProfile => ({
    ...profile,
    character: { ...profile.character, race: id as CharacterProfile['character']['race'] },
  });

/** Replace one entry's condition (or drop it), keeping its place. */
const regate = (abilityId: string, condition: AplCondition | undefined, nth = 0) =>
  apl((entries: AplEntry[]) => {
    let seen = -1;
    const at = entries.findIndex((entry) => entry.abilityId === abilityId && ++seen === nth);
    if (at < 0) throw new Error(`no entry for ${abilityId}`);
    const { condition: _replaced, ...rest } = entries[at];
    entries[at] = condition === undefined ? rest : { ...rest, condition };
    return entries;
  });

const setEntry = (abilityId: string, patch: Partial<AplEntry>) =>
  apl((entries: AplEntry[]) => {
    const at = entries.findIndex((entry) => entry.abilityId === abilityId);
    if (at < 0) throw new Error(`no entry for ${abilityId}`);
    entries[at] = { ...entries[at], ...patch };
    return entries;
  });

const addBottom = (entry: AplEntry) => apl((entries: AplEntry[]) => [...entries, entry]);
/** Add `entry` at the top of the list. */
const addTop = (entry: AplEntry) => apl((entries: AplEntry[]) => [entry, ...entries]);

/** A consumable row set to nothing. */
const noConsumable =
  (category: string) =>
  (profile: CharacterProfile): CharacterProfile => {
    const { [category]: _gone, ...rest } = profile.consumables ?? {};
    return { ...profile, consumables: rest };
  };

const CONTROL = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

const manaUnder = (f: number) => resourceFraction('atMost', f, 'mana');
/** A condition no fight satisfies: the entry stays, and never fires. */
const NEVER: AplCondition = fightElapsed('below', 0);

/* ==================================================== potions (both damage builds) */

/** Mana potion primary, Spellblasting secondary: both abilities in the book. */
const PAIR_MANA_SB = chain(consumable('potion', 'major_mana_potion'), consumable('potion_secondary', 'secondary_major_spellblasting_potion'));
/** Spellblasting primary, mana secondary. */
const PAIR_SB_MANA = chain(consumable('potion', 'major_spellblasting_potion'), consumable('potion_secondary', 'secondary_major_mana_potion'));

/**
 * THE STORED LIST IS NARROWED TO THE SELECTED CONSUMABLES, so selecting a second
 * potion means re-deriving the Single Target list (a `default`) before gating
 * its entry. The Multi Target list is `custom` and is given the entry by hand.
 */
const PAIR = (profile: CharacterProfile): CharacterProfile => syncDefaultRotation(PAIR_MANA_SB(profile));
const SB_ENTRY = (condition?: AplCondition): AplEntry => ({ abilityId: 'major_spellblasting_potion', ...(condition ? { condition } : {}) });
const multiSb = (condition?: AplCondition) => inMulti(addAbove(SB_ENTRY(condition), 'major_mana_potion'));

/** Both entries exist in the stock list head; these gate them. */
const potionLogic = (sb: AplCondition | undefined, mana: AplCondition | undefined, inMultiToo = false) => {
  const edit = chain(
    regate('major_spellblasting_potion', sb),
    regate('major_mana_potion', mana),
  );
  return inMultiToo ? chain(edit, inMulti(edit)) : edit;
};

/* ============================================================== ELEMENTAL */

const ELE = {
  concussion: 5, convection: 5, elemental_warding: 3, call_of_flame: 3,
  elemental_focus: 1, elemental_alacrity: 3, trial_by_fire: 2,
  elemental_mastery: 1, lightning_overload: 3, elemental_fury: 5, lava_burst: 1,
  thundering_strikes: 5, ancestral_knowledge: 5, shamanistic_focus: 1,
  tidal_focus: 5, mindfulness: 3,
};
const ELE_WARD_REVERB3 = { ...ELE, elemental_warding: 0, reverberation: 3 };
const ELE_WARD_REVERB1 = { ...ELE, elemental_warding: 2, reverberation: 1 };
const ELE_WARD_TOTEMIC1 = { ...ELE, elemental_warding: 2, totemic_focus: 1 };
const ELE_WARD_TOTEMIC3 = { ...ELE, elemental_warding: 0, totemic_focus: 3 };

/** Earth Shock as a filler between Flame Shocks: the two share one cooldown. */
const eleEarthShock = (fsLeft: number, above = 'lightning_bolt') =>
  addAbove({ abilityId: 'earth_shock', condition: targetTime('atLeast', fsLeft, 'flame_shock') }, above);

const ELE_AOE_EARTH = (fsLeft: number) =>
  inMulti(addAbove({ abilityId: 'earth_shock', condition: targetTime('atLeast', fsLeft, 'flame_shock') }, 'chain_lightning'));

/* ============================================================ ENHANCEMENT */

const ENH = {
  concussion: 5, call_of_flame: 3, elemental_devastation: 3, reverberation: 5,
  elemental_focus: 1, trial_by_fire: 2,
  thundering_strikes: 5, ancestral_knowledge: 4, mental_dexterity: 3, elemental_weapons: 3,
  shamanistic_focus: 1, flurry: 5, stormstrike: 1, mental_quickness: 2,
  improved_stormstrike: 2, maelstrom_weapon: 5, rage_of_the_farseer: 1,
};
/** What shipped in round 80 (n80talents3): Focus 1 and AK 1 into Tidal Focus 2. */
const ENH_80 = { ...ENH, elemental_focus: 0, ancestral_knowledge: 3, tidal_focus: 2 };
void ENH_80;
const ENH_DEV3_TIDAL3 = { ...ENH, elemental_devastation: 0, tidal_focus: 3 };
const ENH_DEV2_TIDAL2 = { ...ENH, elemental_devastation: 1, tidal_focus: 2 };
const ENH_CONC2_TIDAL2 = { ...ENH, concussion: 3, tidal_focus: 2 };
const ENH_AK1_TIDAL1 = { ...ENH, ancestral_knowledge: 3, tidal_focus: 1 };
const ENH_DEV2_AK1_TIDAL3 = { ...ENH, elemental_devastation: 1, ancestral_knowledge: 3, tidal_focus: 3 };
const ENH_DEV2_AK = { ...ENH, elemental_devastation: 1, ancestral_knowledge: 5 };
const ENH_COF3_TIDAL3 = { ...ENH, call_of_flame: 0, tidal_focus: 3 };

/* ================================================================ RESTO */

const RESTO = {
  thundering_strikes: 5, ancestral_knowledge: 5, improved_ghost_wolf: 2,
  improved_healing_wave: 5, tidal_focus: 3, mindfulness: 3, natural_grace: 3,
  improved_reincarnation: 2, ancestral_healing: 3, healing_focus: 3, water_shield: 1,
  tidal_mastery: 5, mana_tide_totem: 1, healing_way: 3, nature_s_swiftness: 1,
  purification: 5, riptide: 1,
};
const RESTO_WOLF_TIDAL = { ...RESTO, improved_ghost_wolf: 0, tidal_focus: 5 };
const RESTO_GRACE_TIDAL = { ...RESTO, natural_grace: 1, tidal_focus: 5 };

const lowest = { kind: 'lowestHealth' } as const;
const below = (fraction: number): AplCondition => ({ kind: 'health', on: 'target', compare: 'below', fraction });
const tankBelow = (fraction: number): AplCondition => ({ kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction });
const injured = (count: number, under = 0.9): AplCondition => ({ kind: 'injuredCount', of: 'targetParty', below: under, compare: 'atLeast', count });

/* ============================================================== GROUPS */

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  /* ---------------------------------------------------------- Elemental */
  e80race: [
    CONTROL('race (Orc)'),
    { label: 'Troll', apply: race('troll') },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],
  e80talents: [
    CONTROL('spread'),
    { label: 'warding 3 -> reverberation 3', apply: tree(ELE_WARD_REVERB3) },
    { label: 'warding 1 -> reverberation 1', apply: tree(ELE_WARD_REVERB1) },
    { label: 'warding 1 -> totemic_focus 1', apply: tree(ELE_WARD_TOTEMIC1) },
    { label: 'warding 3 -> totemic_focus 3', apply: tree(ELE_WARD_TOTEMIC3) },
  ],
  e80st: [
    CONTROL('Single Target list'),
    { label: 'earth_shock above LB while FS >= 6s', apply: eleEarthShock(6) },
    { label: 'earth_shock above LB while FS >= 9s', apply: eleEarthShock(9) },
    { label: 'earth_shock above LB while FS >= 12s', apply: eleEarthShock(12) },
    { label: 'earth_shock above LvB while FS >= 9s', apply: eleEarthShock(9, 'lava_burst') },
    { label: 'frost_shock above LB while FS >= 9s', apply: addAbove({ abilityId: 'frost_shock', condition: targetTime('atLeast', 9, 'flame_shock') }, 'lightning_bolt') },
    { label: 'fire_nova above LB (searing is the fire totem)', apply: addAbove({ abilityId: 'fire_nova' }, 'lightning_bolt') },
    { label: 'fire_nova at the bottom', apply: addBottom({ abilityId: 'fire_nova' }) },
    { label: 'chain_lightning above LB inside Elemental Mastery', apply: addAbove({ abilityId: 'chain_lightning', condition: selfHas('elemental_mastery') }, 'lightning_bolt') },
    { label: 'chain_lightning above LB on Clearcasting', apply: addAbove({ abilityId: 'chain_lightning', condition: selfHas('elemental_focus') }, 'lightning_bolt') },
    { label: 'lava_burst above flame_shock', apply: moveAbove('lava_burst', 'flame_shock') },
    { label: 'flame_shock refreshed under 2s', apply: regate('flame_shock', targetTime('below', 2, 'flame_shock')) },
  ],
  e80st2: [
    CONTROL('Single Target list'),
    { label: 'earth_shock above LB while FS >= 3s', apply: eleEarthShock(3) },
    { label: 'earth_shock above LB while FS >= 15s', apply: eleEarthShock(15) },
    { label: 'earth_shock above LB, FS>=9s, mana >= 30%', apply: addAbove({ abilityId: 'earth_shock', condition: all(targetTime('atLeast', 9, 'flame_shock'), resourceFraction('atLeast', 0.3, 'mana')) }, 'lightning_bolt') },
    { label: 'earth_shock above LB, FS>=9s, mana >= 60%', apply: addAbove({ abilityId: 'earth_shock', condition: all(targetTime('atLeast', 9, 'flame_shock'), resourceFraction('atLeast', 0.6, 'mana')) }, 'lightning_bolt') },
    { label: 'earth_shock above LB, FS>=9s, on Clearcasting only', apply: addAbove({ abilityId: 'earth_shock', condition: all(targetTime('atLeast', 9, 'flame_shock'), selfHas('elemental_focus')) }, 'lightning_bolt') },
  ],
  e80pot: [
    CONTROL('potion (Major Mana alone, under 30%)'),
    { label: 'Spellblasting alone at the pull (the old row)', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'mana potion gate 20%', apply: regate('major_mana_potion', manaUnder(0.2)) },
    { label: 'mana potion gate 40%', apply: regate('major_mana_potion', manaUnder(0.4)) },
    { label: 'mana potion gate 50%', apply: regate('major_mana_potion', manaUnder(0.5)) },
    { label: 'mana potion gate 60%', apply: regate('major_mana_potion', manaUnder(0.6)) },
    { label: 'pair: mana <30%; Spellblasting in the last 30s', apply: chain(PAIR, potionLogic(fightRemaining('atMost', 30), manaUnder(0.3))) },
    { label: 'pair: mana <50% after 60s; Spellblasting in the last 30s', apply: chain(PAIR, potionLogic(fightRemaining('atMost', 30), all(manaUnder(0.5), fightElapsed('atLeast', 60)))) },
    { label: 'pair: Spellblasting pre-pull at 10s lead; mana <30%', apply: chain(PAIR, potionLogic(NEVER, manaUnder(0.3)), addPrecombat(10, 'major_spellblasting_potion')) },
    { label: 'pair: Spellblasting pre-pull at 20s lead; mana <30%', apply: chain(PAIR, potionLogic(NEVER, manaUnder(0.3)), addPrecombat(20, 'major_spellblasting_potion')) },
    { label: 'pair: Spellblasting pre-pull at 0s lead; mana <30% (never comes back)', apply: chain(PAIR, potionLogic(NEVER, manaUnder(0.3)), addPrecombat(0, 'major_spellblasting_potion')) },
    { label: 'demonic rune at 20% (the owner set 10%)', apply: regate('demonic_rune', manaUnder(0.2)) },
    { label: 'demonic rune at 30%', apply: regate('demonic_rune', manaUnder(0.3)) },
  ],
  e80aoe: [
    CONTROL('Multi Target list'),
    { label: 'potion: Spellblasting at the pull in Multi only (pair)', apply: chain(PAIR, regate('major_spellblasting_potion', fightRemaining('atMost', 30)), multiSb()) },
    { label: 'earth_shock above CL while FS >= 6s', apply: ELE_AOE_EARTH(6) },
    { label: 'chain_lightning above flame_shock', apply: inMulti(moveAbove('chain_lightning', 'flame_shock')) },
    { label: 'chain_lightning above fire_nova', apply: inMulti(moveAbove('chain_lightning', 'fire_nova')) },
    { label: 'no lava_burst', apply: inMulti(removeEntry('lava_burst')) },
    { label: 'FS multi-DoT 3', apply: inMulti(setEntry('flame_shock', { multiDot: 3 })) },
    { label: 'FS multi-DoT 8', apply: inMulti(setEntry('flame_shock', { multiDot: 8 })) },
    { label: 'magma refreshed on expiry', apply: inMulti(regate('magma_totem', targetExpired('magma_totem'))) },
    { label: 'magma refreshed under 4s', apply: inMulti(regate('magma_totem', targetTime('below', 4, 'magma_totem'))) },
    { label: 'fire_nova below CL', apply: inMulti(moveAbove('chain_lightning', 'fire_nova')) },
    { label: 'elemental_mastery above magma', apply: inMulti(moveAbove('elemental_mastery', 'magma_totem')) },
  ],

  /* -------------------------------------------------------- Enhancement */
  n80race: [
    CONTROL('race (Orc)'),
    { label: 'Troll', apply: race('troll') },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],
  n80talents: [
    CONTROL('spread'),
    { label: 'elemental_devastation 3 -> tidal_focus 3', apply: tree(ENH_DEV3_TIDAL3) },
    { label: 'elemental_devastation 2 -> tidal_focus 2', apply: tree(ENH_DEV2_TIDAL2) },
    { label: 'concussion 2 -> tidal_focus 2', apply: tree(ENH_CONC2_TIDAL2) },
    { label: 'ancestral_knowledge 1 -> tidal_focus 1', apply: tree(ENH_AK1_TIDAL1) },
    { label: 'devastation 2 + AK 1 -> tidal_focus 3', apply: tree(ENH_DEV2_AK1_TIDAL3) },
    { label: 'devastation 2 -> AK 5 (+1) and ... ', apply: tree(ENH_DEV2_AK) },
    { label: 'call_of_flame 3 -> tidal_focus 3', apply: tree(ENH_COF3_TIDAL3) },
  ],
  n80st: [
    CONTROL('Single Target list'),
    { label: 'chain_lightning at the bottom', apply: addBottom({ abilityId: 'chain_lightning' }) },
    { label: 'frost_shock below earth_shock (FS >= 3s)', apply: addAbove({ abilityId: 'frost_shock', condition: targetTime('atLeast', 3, 'flame_shock') }, 'lightning_bolt') },
    { label: 'fire_nova above lightning_bolt', apply: moveAbove('fire_nova', 'lightning_bolt') },
    { label: 'fire_nova above earth_shock', apply: moveAbove('fire_nova', 'earth_shock') },
    { label: 'fire_nova above stormstrike', apply: moveAbove('fire_nova', 'stormstrike') },
    { label: 'stormstrike below earth_shock', apply: moveAbove('earth_shock', 'stormstrike') },
    { label: 'lightning_bolt at 5 stacks above stormstrike', apply: moveAbove('lightning_bolt', 'stormstrike') },
    { label: 'searing refreshed under 3s', apply: regate('searing_totem', targetTime('below', 3, 'searing_totem')) },
    { label: 'magma_totem for searing in ST', apply: chain(setEntry('searing_totem', { abilityId: 'magma_totem', condition: targetExpired('magma_totem') }), removePrecombat('searing_totem'), addPrecombat(0, 'magma_totem')) },
    { label: 'flame_shock above stormstrike', apply: moveAbove('flame_shock', 'stormstrike') },
    { label: 'no searing pre-cast (cast at 0 in fight)', apply: removePrecombat('searing_totem') },
  ],
  n80imbue: [
    CONTROL('imbue (Flametongue, the owner opener)'),
    { label: 'Windfury Weapon for Flametongue (OWNER LINE)', apply: (p) => ({ ...p, precombat: (p.precombat ?? []).map((a) => (a.abilityId === 'flametongue_weapon' ? { ...a, abilityId: 'windfury_weapon' } : a)) }) },
    { label: 'Rockbiter Weapon for Flametongue (OWNER LINE)', apply: (p) => ({ ...p, precombat: (p.precombat ?? []).map((a) => (a.abilityId === 'flametongue_weapon' ? { ...a, abilityId: 'rockbiter_weapon' } : a)) }) },
  ],
  n80pot: [
    CONTROL('potion (Major Mana alone, under 30%)'),
    { label: 'Spellblasting alone at the pull', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'mana potion gate 20%', apply: regate('major_mana_potion', manaUnder(0.2)) },
    { label: 'mana potion gate 40%', apply: regate('major_mana_potion', manaUnder(0.4)) },
    { label: 'mana potion gate 50%', apply: regate('major_mana_potion', manaUnder(0.5)) },
    { label: 'pair: mana <30%; Spellblasting in the last 30s', apply: chain(PAIR, potionLogic(fightRemaining('atMost', 30), manaUnder(0.3))) },
    { label: 'pair: mana <50% after 60s; Spellblasting in the last 30s', apply: chain(PAIR, potionLogic(fightRemaining('atMost', 30), all(manaUnder(0.5), fightElapsed('atLeast', 60)))) },
    { label: 'pair: Spellblasting pre-pull at 10s; mana <30%', apply: chain(PAIR, potionLogic(NEVER, manaUnder(0.3)), addPrecombat(10, 'major_spellblasting_potion')) },
    { label: 'pair: Spellblasting pre-pull at 20s; mana <30%', apply: chain(PAIR, potionLogic(NEVER, manaUnder(0.3)), addPrecombat(20, 'major_spellblasting_potion')) },
    { label: 'Frenzy alone at the pull', apply: consumable('potion', 'major_frenzy_potion') },
    { label: 'demonic rune at 20% (the owner set 10%)', apply: regate('demonic_rune', manaUnder(0.2)) },
  ],
  n80aoe: [
    CONTROL('Multi Target list'),
    { label: 'potion: Spellblasting at the pull in Multi only (pair)', apply: chain(PAIR, regate('major_spellblasting_potion', fightRemaining('atMost', 30)), multiSb()) },
    { label: 'chain_lightning above earth_shock', apply: inMulti(moveAbove('chain_lightning', 'earth_shock')) },
    { label: 'chain_lightning above stormstrike', apply: inMulti(moveAbove('chain_lightning', 'stormstrike')) },
    { label: 'no earth_shock', apply: inMulti(removeEntry('earth_shock')) },
    { label: 'FS multi-DoT 8', apply: inMulti(setEntry('flame_shock', { multiDot: 8 })) },
    { label: 'FS multi-DoT 3', apply: inMulti(setEntry('flame_shock', { multiDot: 3 })) },
    { label: 'magma refreshed under 2s', apply: inMulti(regate('magma_totem', targetTime('below', 2, 'magma_totem'))) },
    { label: 'fire_nova below stormstrike', apply: inMulti(moveAbove('stormstrike', 'fire_nova')) },
    { label: 'LB at 5 stacks above CL', apply: inMulti(moveAbove('lightning_bolt', 'chain_lightning')) },
    { label: 'chain_lightning at 3+ maelstrom only? (no: CL is not Maelstrom) -- CL only above 40% mana', apply: inMulti(setEntry('chain_lightning', { condition: resourceFraction('atLeast', 0.4, 'mana') })) },
    { label: 'no searing pre-cast in Multi', apply: inMulti(removePrecombat('searing_totem')) },
  ],

  /* -------------------------------------------------------------- Resto */
  r80race: [
    CONTROL('race (Windshaper Skyborne)'),
    { label: 'Orc', apply: race('orc') },
    { label: 'Troll', apply: race('troll') },
    { label: 'Tauren', apply: race('tauren') },
  ],
  r80talents: [
    CONTROL('spread'),
    { label: 'improved_ghost_wolf 2 -> tidal_focus 5', apply: tree(RESTO_WOLF_TIDAL) },
    { label: 'natural_grace 2 -> tidal_focus 5', apply: tree(RESTO_GRACE_TIDAL) },
  ],
  r80tank: [
    CONTROL('Single Target (tank) list'),
    { label: 'HW gate 80%', apply: regate('healing_wave', below(0.8)) },
    { label: 'HW gate 95%', apply: regate('healing_wave', below(0.95)) },
    { label: 'HW ungated', apply: regate('healing_wave', below(1)) },
    { label: 'HW above riptide (lowest < 90%)', apply: moveAbove('healing_wave', 'riptide') },
    { label: 'mana tide at 70%', apply: regate('mana_tide_totem', manaUnder(0.7)) },
    { label: 'mana tide ungated (on cooldown)', apply: regate('mana_tide_totem', undefined) },
    { label: "NS at tank < 50%", apply: regate('nature_s_swiftness', tankBelow(0.5)) },
    { label: "NS at tank < 20%", apply: regate('nature_s_swiftness', tankBelow(0.2)) },
    { label: "NS on cooldown", apply: regate('nature_s_swiftness', undefined) },
    { label: 'riptide only under 90%', apply: regate('riptide', below(0.9)) },
    { label: 'LHW only under 90%', apply: regate('lesser_healing_wave', below(0.9)) },
    { label: 'no chain heal entry', apply: removeEntry('chain_heal') },
    { label: 'chain heal on the lowest at 1 injured, below HW', apply: addAbove({ abilityId: 'chain_heal', target: lowest, condition: injured(1) }, 'lesser_healing_wave') },
  ],
  r80pot: [
    CONTROL('potion (Major Mana under 30%)'),
    { label: 'mana potion gate 15%', apply: regate('major_mana_potion', manaUnder(0.15)) },
    { label: 'mana potion gate 50%', apply: regate('major_mana_potion', manaUnder(0.5)) },
    { label: 'mana potion gate 50% after 60s', apply: regate('major_mana_potion', all(manaUnder(0.5), fightElapsed('atLeast', 60))) },
    { label: 'demonic rune 20% (owner 10%)', apply: regate('demonic_rune', manaUnder(0.2)) },
    { label: 'demonic rune 40%', apply: regate('demonic_rune', manaUnder(0.4)) },
    { label: 'other: none', apply: noConsumable('other') },
  ],
  r80raid: [
    CONTROL('Multi Target (raid) list'),
    { label: 'NS back in, on cooldown', apply: inMulti(addAbove({ abilityId: 'nature_s_swiftness' }, 'riptide')) },
    { label: 'chain heal above riptide', apply: inMulti(moveAbove('chain_heal', 'riptide')) },
    { label: 'chain heal at 2 injured', apply: inMulti(setEntry('chain_heal', { condition: injured(2) })) },
    { label: 'chain heal at 1 injured under 95%', apply: inMulti(setEntry('chain_heal', { condition: injured(1, 0.95) })) },
    { label: 'chain heal on lowest (not riptide target)', apply: inMulti(setEntry('chain_heal', { target: lowest })) },
    { label: 'riptide only under 90%', apply: inMulti(regate('riptide', below(0.9))) },
    { label: 'riptide only under 80%', apply: inMulti(regate('riptide', below(0.8))) },
    { label: 'HW on lowest < 50% above LHW', apply: inMulti(addAbove({ abilityId: 'healing_wave', target: lowest, condition: below(0.5) }, 'lesser_healing_wave')) },
    { label: 'chain heal ungated on the riptide target', apply: inMulti(setEntry('chain_heal', { condition: undefined })) },
  ],
};

void any;
void not;
void selfStacks;
void targetCount;
void targetHas;
void enchant;
void precombatLead;
void addTop; void PAIR_SB_MANA;

const ELE_MULTI_POT = chain(PAIR, regate('major_spellblasting_potion', fightRemaining('atMost', 30)), multiSb());
Object.assign(VARIANT_GROUPS, {
  e80aoeCheck: [
    CONTROL('Multi Target list'),
    { label: 'potion: Spellblasting at the pull in Multi only (pair)', apply: ELE_MULTI_POT },
    { label: 'chain_lightning above flame_shock', apply: inMulti(moveAbove('chain_lightning', 'flame_shock')) },
    { label: 'magma refreshed under 4s', apply: inMulti(regate('magma_totem', targetTime('below', 4, 'magma_totem'))) },
  ],
});

const ENH_T = (patch: Record<string, number>) => tree({ ...ENH, ancestral_knowledge: 3, ...patch });
Object.assign(VARIANT_GROUPS, {
  n80talents2: [
    CONTROL('spread'),
    { label: 'AK 1 -> tidal 1', apply: ENH_T({ tidal_focus: 1 }) },
    { label: 'AK 1, CoF 2 -> tidal 3', apply: ENH_T({ call_of_flame: 1, tidal_focus: 3 }) },
    { label: 'AK 1, CoF 1 -> tidal 2', apply: ENH_T({ call_of_flame: 2, tidal_focus: 2 }) },
    { label: 'AK 1, reverb 2 -> tidal 3', apply: ENH_T({ reverberation: 3, tidal_focus: 3 }) },
    { label: 'AK 1, reverb 1 -> tidal 2', apply: ENH_T({ reverberation: 4, tidal_focus: 2 }) },
    { label: 'AK 1, devastation 1 -> tidal 2', apply: ENH_T({ elemental_devastation: 2, tidal_focus: 2 }) },
    { label: 'AK 1, focus 1 -> tidal 2', apply: ENH_T({ elemental_focus: 0, tidal_focus: 2 }) },
    { label: 'AK 1, trial 2 -> tidal 3', apply: ENH_T({ trial_by_fire: 0, tidal_focus: 3 }) },
    { label: 'AK 1, trial 1 -> tidal 2', apply: ENH_T({ trial_by_fire: 1, tidal_focus: 2 }) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  n80talents3: [
    CONTROL('spread'),
    { label: 'focus 1 -> tidal 1', apply: tree({ ...ENH, elemental_focus: 0, tidal_focus: 1 }) },
    { label: 'focus 1 -> AK 5', apply: tree({ ...ENH, elemental_focus: 0, ancestral_knowledge: 5 }) },
    { label: 'AK 1, focus 1 -> tidal 2', apply: ENH_T({ elemental_focus: 0, tidal_focus: 2 }) },
    { label: 'AK 1, focus 1, dev 1 -> tidal 3', apply: ENH_T({ elemental_focus: 0, elemental_devastation: 2, tidal_focus: 3 }) },
    { label: 'AK 1, focus 1, reverb 1 -> tidal 3', apply: ENH_T({ elemental_focus: 0, reverberation: 4, tidal_focus: 3 }) },
    { label: 'focus 1, reverb 1 -> tidal 2', apply: tree({ ...ENH, elemental_focus: 0, reverberation: 4, tidal_focus: 2 }) },
  ],
});

const ENH_MULTI_POT = chain(PAIR, regate('major_spellblasting_potion', fightRemaining('atMost', 30)), multiSb());
Object.assign(VARIANT_GROUPS, {
  n80aoeCheck: [
    CONTROL('Multi Target list'),
    { label: 'potion: Spellblasting at the pull in Multi only (pair)', apply: ENH_MULTI_POT },
  ],
});

const chUngated = inMulti(regate('chain_heal', undefined));
Object.assign(VARIANT_GROUPS, {
  r80raid2: [
    CONTROL('Multi Target (raid) list'),
    { label: 'chain heal ungated on the riptide target', apply: chUngated },
    { label: 'chain heal at 1 injured under 99%', apply: inMulti(regate('chain_heal', injured(1, 0.99))) },
    { label: 'chain heal at 1 injured under 100%', apply: inMulti(regate('chain_heal', injured(1, 1))) },
    { label: 'ungated + riptide on cooldown on lowest (not just injured)', apply: chain(chUngated, inMulti(regate('riptide', undefined))) },
    { label: 'ungated + NS on cooldown above riptide', apply: chain(chUngated, inMulti(addAbove({ abilityId: 'nature_s_swiftness' }, 'riptide'))) },
    { label: 'ungated + mana tide at 50%', apply: chain(chUngated, inMulti(addAbove({ abilityId: 'mana_tide_totem', condition: manaUnder(0.5) }, 'riptide'))) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  e80enchants: [
    CONTROL('enchants'),
    { label: 'head AND legs +8 Intellect (for +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head AND legs +8 Spirit (for +1% Haste)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'gloves +1% Haste (for +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'main hand Revelation (for Weapon Spell Power)', apply: enchant('mainHand', 900032) },
  ],
  n80enchants: [
    CONTROL('enchants'),
    { label: 'head AND legs +1% Haste (for +8 Intellect)', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'head AND legs +8 Strength (for +8 Intellect)', apply: chain(enchant('head', 900005), enchant('legs', 900005)) },
    { label: 'gloves +1% Haste (for +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'two-hand Crusader (for +65 Spell Power)', apply: enchant('twoHand', 20034) },
    { label: 'two-hand +25 Agility (for +65 Spell Power)', apply: enchant('twoHand', 900031) },
    { label: 'wrists +9 Strength (for +16 Spell Power)', apply: enchant('wrists', 900017) },
  ],
  r80enchants: [
    CONTROL('enchants'),
    { label: 'wrists +16 Spell Power (for +16 Healing)', apply: enchant('wrists', 900018) },
    { label: 'neck +6 Spell Power (for +11 Healing)', apply: enchant('neck', 900009) },
    { label: 'gloves +20 Spell Power (for +1% Haste)', apply: enchant('gloves', 900023) },
    { label: 'head AND legs +8 Intellect (for +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head AND legs +8 Spirit (for +1% Haste)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  n80rev: [
    CONTROL('enchants'),
    { label: 'two-hand Revelation (for +65 Spell Power)', apply: enchant('twoHand', 900032) },
  ],
  r80rev: [
    CONTROL('enchants'),
    { label: 'main hand Revelation (for Weapon Spell Power)', apply: enchant('mainHand', 900032) },
  ],
});

const REV = selfHas('revelation');
Object.assign(VARIANT_GROUPS, {
  e80revSt: [
    CONTROL('Single Target list, Revelation main hand'),
    { label: 'lava_burst on Revelation above searing', apply: addAbove({ abilityId: 'lava_burst', condition: all(REV, targetHas('flame_shock')) }, 'searing_totem') },
    { label: 'flame_shock held while Revelation is up', apply: regate('flame_shock', all(targetExpired('flame_shock'), not(REV))) },
    { label: 'both', apply: chain(addAbove({ abilityId: 'lava_burst', condition: all(REV, targetHas('flame_shock')) }, 'searing_totem'), regate('flame_shock', all(targetExpired('flame_shock'), not(REV)))) },
    { label: 'Weapon Spell Power back (the control of the enchant)', apply: enchant('mainHand', 22749) },
  ],
  e80revAoe: [
    CONTROL('Multi Target list, Revelation main hand'),
    { label: 'fire_nova on Revelation above magma', apply: inMulti(addAbove({ abilityId: 'fire_nova', condition: REV }, 'magma_totem')) },
    { label: 'chain_lightning on Revelation above flame_shock', apply: inMulti(addAbove({ abilityId: 'chain_lightning', condition: REV }, 'flame_shock')) },
    { label: 'flame_shock held while Revelation is up', apply: inMulti(regate('flame_shock', all(targetExpired('flame_shock'), not(REV)))) },
    { label: 'FN + CL on Revelation, FS held', apply: inMulti(addAbove({ abilityId: 'fire_nova', condition: REV }, 'magma_totem'), addAbove({ abilityId: 'chain_lightning', condition: REV }, 'magma_totem'), regate('flame_shock', all(targetExpired('flame_shock'), not(REV)))) },
    { label: 'chain_lightning above flame_shock', apply: inMulti(moveAbove('chain_lightning', 'flame_shock')) },
  ],
});

const FS_HELD = inMulti(regate('flame_shock', all(targetExpired('flame_shock'), not(REV))));
const CL_UP = inMulti(moveAbove('chain_lightning', 'flame_shock'));
Object.assign(VARIANT_GROUPS, {
  e80revAoe2: [
    CONTROL('Multi Target list'),
    { label: 'flame_shock held while Revelation is up', apply: FS_HELD },
    { label: 'chain_lightning above flame_shock', apply: CL_UP },
    { label: 'both', apply: chain(FS_HELD, CL_UP) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  n80rev2: [
    CONTROL('enchants'),
    { label: 'two-hand Revelation', apply: enchant('twoHand', 900032) },
    { label: 'two-hand Revelation + multi FS held on Revelation', apply: chain(enchant('twoHand', 900032), inMulti(regate('flame_shock', all(targetExpired('flame_shock'), not(REV))))) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  n80owner: [
    CONTROL('Single Target list'),
    { label: "earth_shock gate FS >= 1s (owner's 3s)", apply: regate('earth_shock', targetTime('atLeast', 1, 'flame_shock')) },
    { label: "earth_shock gate FS >= 0s, i.e. FS up", apply: regate('earth_shock', targetHas('flame_shock')) },
    { label: "earth_shock ungated (owner's 3s)", apply: regate('earth_shock', undefined) },
    { label: 'no flame_shock, earth_shock ungated (OWNER LINES)', apply: chain(removeEntry('flame_shock'), removePrecombat('flame_shock'), regate('earth_shock', undefined)) },
    { label: 'no fire_nova', apply: removeEntry('fire_nova') },
    { label: 'no searing_totem entry (pre-cast only)', apply: removeEntry('searing_totem') },
  ],
});

/* ---------------------------------------- the Combined groups: each ship reverted on the finished build */
Object.assign(VARIANT_GROUPS, {
  e80combined: [
    CONTROL('build'),
    { label: 'REVERT main hand to Weapon Spell Power', apply: enchant('mainHand', 22749) },
    { label: 'REVERT the secondary potion (mana alone)', apply: noConsumable('potion_secondary') },
    { label: 'REVERT the multi Flame Shock Revelation hold', apply: inMulti(regate('flame_shock', targetExpired('flame_shock'))) },
    { label: 'race Troll', apply: race('troll') },
    { label: 'race Windshaper Skyborne', apply: race('windshaper_skyborne') },
    { label: 'warding 3 -> reverberation 3', apply: tree(ELE_WARD_REVERB3) },
  ],
  n80combined: [
    CONTROL('build'),
    { label: 'REVERT talents (Focus and AK 4 back, no Tidal Focus)', apply: tree(ENH) },
    { label: 'REVERT the secondary potion (mana alone)', apply: noConsumable('potion_secondary') },
    { label: 'race Troll', apply: race('troll') },
    { label: 'race Windshaper Skyborne', apply: race('windshaper_skyborne') },
    { label: 'two-hand Revelation', apply: enchant('twoHand', 900032) },
  ],
  r80combined: [
    CONTROL('build'),
    { label: 'REVERT raid Chain Heal gate (1 injured under 90%)', apply: inMulti(regate('chain_heal', injured(1))) },
    { label: 'race Troll', apply: race('troll') },
    { label: 'improved_ghost_wolf 2 -> tidal_focus 5', apply: tree(RESTO_WOLF_TIDAL) },
  ],
});

Object.assign(VARIANT_GROUPS, {
  e80st3: [
    CONTROL('Single Target list'),
    { label: 'lava_burst without the Flame Shock clause', apply: regate('lava_burst', undefined) },
    { label: 'no lava_burst entry (OWNER LINE)', apply: removeEntry('lava_burst') },
    { label: 'no searing_totem entry (OWNER LINE)', apply: removeEntry('searing_totem') },
    { label: 'elemental_mastery pre-cast lead 2s', apply: precombatLead('elemental_mastery', 2) },
    { label: 'searing_totem pre-cast lead 0s', apply: precombatLead('searing_totem', 0) },
    { label: 'searing refreshed under 3s', apply: regate('searing_totem', targetTime('below', 3, 'searing_totem')) },
    { label: 'blood_fury above searing', apply: moveAbove('blood_fury', 'searing_totem') },
    { label: 'blood_fury pre-cast at 0s', apply: addPrecombat(0, 'blood_fury') },
  ],
  n80st3: [
    CONTROL('Single Target list'),
    { label: 'blood_fury pre-cast at 0s', apply: addPrecombat(0, 'blood_fury') },
    { label: 'blood_fury held for Rage of the Farseer window? (below stormstrike)', apply: moveAbove('blood_fury', 'flame_shock') },
    { label: 'lightning_bolt at 5 stacks also below fire_nova (bottom)', apply: moveAbove('fire_nova', 'lightning_bolt') },
    { label: 'stormstrike gated on no Stormstrike debuff', apply: regate('stormstrike', not(targetHas('stormstrike'))) },
  ],
});
