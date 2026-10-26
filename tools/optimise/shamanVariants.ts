/*
 * ==============================================================================
 * ROUND 78 -- THE THREE SHAMAN PRESETS, OPTIMISED FOR THE FULL REPORT'S
 * ENCOUNTERS. Measured with:
 *
 *   PRESET=shaman_elemental FILE=tools/optimise/shamanVariants.ts VARIANTS=eleTalents DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=shaman_elemental FILE=tools/optimise/shamanVariants.ts VARIANTS=eleAoe TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *   PRESET=shaman_resto FILE=tools/optimise/shamanVariants.ts VARIANTS=restoRaid FIGHT=raid DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE THEME, WHICH DOES NOT MOVE (Step 0):
 *
 *   | preset              | class  | majority tree        | style            | stance | target swings |
 *   | shaman_elemental    | shaman | Elemental 32         | caster, mace+shield | battle | no |
 *   | shaman_enhancement  | shaman | Enhancement 32       | two-hander       | battle | no |
 *   | shaman_resto        | shaman | Restoration 39       | caster, mace+shield | battle | no (healer) |
 *
 * THE OBJECTIVES: Ele and Enh -- DPS at 1 target / 120 s (the Single Target
 * section) and at 5 targets / 60 s (the Multi Target section, reused at 3 / 60
 * and 8 / 30). Piss Beam -- HPS in the tank healer fight at 120 s (Single
 * Target) and the raid healer fight at 60 s (Multi Target).
 *
 * STEP 1, AT 120 s (`probe_clock`): BOTH DAMAGE BUILDS ARE MANA-BOUND THERE.
 * Ele 691 DPS with 121 mana of headroom (1.0%), Enh 799 with 139 (1.2%). At 60 s
 * Ele had 14% and Enh ~16% spare. So every mana answer on these two profiles that
 * was settled at 60 s is re-asked here. Piss Beam's raid fight ends with ~5,000
 * mana UNSPENT at 60 s: it is cast-time bound there, not mana-bound.
 *
 * STAT WEIGHTS AT 120 s (stat_weights.ts DURATION=120):
 *   Ele  crit 5.63/1%, haste 1.32/1% (+-1.26), int 0.875, sp 0.601, mp5 0.553, spi 0.320
 *   Enh  crit 7.29/1%, haste 4.74/1% (+-2.23), hit 2.64/1% (spells miss 9%),
 *        int 0.710, str 0.306, sp 0.280, agi 0.276, mp5 0.215, ap 0.139
 *
 * WHAT SHIPPED (so the controls below are the NEW builds, and every group
 * measured before a ship is a figure about the build it was taken in):
 *   Ele   Orc; Major Mana Potion; the AoE list (magma, nova, FS multi-DoT 5, CL)
 *   Enh   Orc; Major Mana Potion, +25 Int, +28 SP food; +65 SP two-hand; SP on
 *         neck/wrists/gloves, Int on head/legs; the AoE list (+ CL above LB5)
 *   Resto Windshaper Skyborne; gloves +1% Haste; tank list +Healing Wave <90%,
 *         Mana Tide at 90%; raid list without Mana Tide, NS and Healing Wave,
 *         Chain Heal at 1 injured
 * The `*Combined` groups re-price each against the finished build.
 *
 * THE triggersGcd READ: Elemental Mastery, Rage of the Farseer and Mana Tide
 * Totem take a global cooldown; Nature's Swiftness does not. All three are
 * pre-cast or once-a-fight here, so none is priced -- flagged as questions.
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
  multiList,
  precombatLead,
  removeEntry,
  removePrecombat,
} from '../buildVariants';
import type { CharacterProfile } from '../../src/profiles';
import type { AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  not,
  resourceFraction,
  selfHas,
  selfStacks,
  targetCount,
  targetExpired,
  targetHas,
  targetTime,
} from '../../src/game/rotations/apl';
import { SHAMAN_ELEMENTAL, SHAMAN_ENHANCEMENT, SHAMAN_RESTORATION } from '../../src/game/rotations/shaman';
import { RACIAL_COOLDOWNS } from '../../src/game/rotations/racialCooldowns';
import { SHAMAN_MULTI_TARGET } from '../../src/profiles/multiTarget/shaman';

/** The Single Target list and opener, put back into the Multi Target section. */
const stInMulti = (profile: CharacterProfile): CharacterProfile =>
  multiList('single target list', profile.rotation.entries, profile.precombat)(profile);
const ST_IN_MULTI_ELE = stInMulti;
const ST_IN_MULTI_ENH = stInMulti;
const addEntryAtBottom = (entry: AplEntry) => apl((entries: AplEntry[]) => [...entries, entry]);

const race =
  (id: string) =>
  (profile: CharacterProfile): CharacterProfile => ({
    ...profile,
    character: { ...profile.character, race: id as CharacterProfile['character']['race'] },
  });

/** Replace one entry's condition (or drop it), keeping its place. */
const regate = (abilityId: string, condition: AplEntry['condition'] | undefined, nth = 0) =>
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

const pre = (secondsBefore: number, ...ids: string[]) => ids.map((abilityId) => ({ abilityId, secondsBefore }));

/* ============================================================== ELEMENTAL */

/** The shipped Elemental spread, 32 / 11 / 8. */
const ELE_SHIPPED = {
  concussion: 5, convection: 5, elemental_warding: 3, call_of_flame: 3,
  elemental_focus: 1, elemental_alacrity: 3, trial_by_fire: 2,
  elemental_mastery: 1, lightning_overload: 3, elemental_fury: 5, lava_burst: 1,
  thundering_strikes: 5, ancestral_knowledge: 5, shamanistic_focus: 1,
  tidal_focus: 5, mindfulness: 3,
};
/** The one slack point: Elemental Warding is dead (nothing attacks a caster). */
const ELE_TOTEMIC_1 = { ...ELE_SHIPPED, elemental_warding: 2, totemic_focus: 1 };
const ELE_EYE_1 = { ...ELE_SHIPPED, elemental_warding: 2, elemental_devastation: 1 };

/** The Elemental head of list: consumables and heals, everything before Searing Totem. */
const ELE_HEAD = SHAMAN_ELEMENTAL.entries.slice(
  0,
  SHAMAN_ELEMENTAL.entries.findIndex((entry) => entry.abilityId === 'searing_totem'),
);

const eleAoe = (options: {
  readonly flameShockDots?: number;
  readonly novaAfterChain?: boolean;
  readonly noLavaBurst?: boolean;
  readonly noFlameShock?: boolean;
  readonly chainAboveShock?: boolean;
  readonly magmaGate?: number;
  readonly noMagma?: boolean;
}): AplEntry[] => {
  const magma: AplEntry[] = options.noMagma
    ? [{ abilityId: 'searing_totem', condition: targetExpired('searing_totem') }]
    : [
        {
          abilityId: 'magma_totem',
          condition:
            options.magmaGate === undefined
              ? targetExpired('magma_totem')
              : all(targetExpired('magma_totem'), targetCount('atLeast', options.magmaGate)),
        },
        ...(options.magmaGate === undefined
          ? []
          : [{ abilityId: 'searing_totem', condition: all(targetExpired('searing_totem'), targetExpired('magma_totem')) }]),
      ];
  const nova: AplEntry = { abilityId: 'fire_nova' };
  const shock: AplEntry[] = options.noFlameShock
    ? []
    : [
        {
          abilityId: 'flame_shock',
          condition: targetExpired('flame_shock'),
          ...(options.flameShockDots && options.flameShockDots > 1 ? { multiDot: options.flameShockDots } : {}),
        },
      ];
  const chainL: AplEntry = { abilityId: 'chain_lightning' };
  return [
    ...ELE_HEAD,
    ...magma,
    ...(options.novaAfterChain ? [] : [nova]),
    ...(options.chainAboveShock ? [chainL] : []),
    ...shock,
    ...RACIAL_COOLDOWNS,
    { abilityId: 'elemental_mastery' },
    ...(options.chainAboveShock ? [] : [chainL]),
    ...(options.novaAfterChain ? [nova] : []),
    ...(options.noLavaBurst ? [] : [{ abilityId: 'lava_burst', condition: targetHas('flame_shock') }]),
    { abilityId: 'lightning_bolt' },
  ];
};

const ELE_AOE_OPENER = [...pre(0, 'magma_totem', 'elemental_mastery', 'flame_shock')];
const eleMulti = (opts: Parameters<typeof eleAoe>[0], precombat = ELE_AOE_OPENER) =>
  multiList('Shaman (Elemental, AoE)', eleAoe(opts), precombat);

/* ============================================================ ENHANCEMENT */

const ENH_SHIPPED = {
  concussion: 5, call_of_flame: 3, elemental_devastation: 3, reverberation: 5,
  elemental_focus: 1, trial_by_fire: 2,
  thundering_strikes: 5, ancestral_knowledge: 4, mental_dexterity: 3, elemental_weapons: 3,
  shamanistic_focus: 1, flurry: 5, stormstrike: 1, mental_quickness: 2,
  improved_stormstrike: 2, maelstrom_weapon: 5, rage_of_the_farseer: 1,
};
const ENH_REVERB_TO_CONVECTION = { ...ENH_SHIPPED, reverberation: 0, convection: 5 };
const ENH_REVERB3_CONVECTION2 = { ...ENH_SHIPPED, reverberation: 3, convection: 2 };
const ENH_REVERB2_CONVECTION3 = { ...ENH_SHIPPED, reverberation: 2, convection: 3 };

const ENH_HEAD = SHAMAN_ENHANCEMENT.entries.slice(
  0,
  SHAMAN_ENHANCEMENT.entries.findIndex((entry) => entry.abilityId === 'stormstrike'),
);

const enhAoe = (options: {
  readonly flameShockDots?: number;
  readonly novaBelowStorm?: boolean;
  readonly novaBottom?: boolean;
  readonly noEarthShock?: boolean;
  readonly chainAt5?: boolean;
  readonly searing?: boolean;
}): AplEntry[] => {
  const nova: AplEntry = { abilityId: 'fire_nova' };
  const novaTop = !options.novaBelowStorm && !options.novaBottom;
  return [
    ...ENH_HEAD,
    options.searing
      ? { abilityId: 'searing_totem', condition: targetExpired('searing_totem') }
      : { abilityId: 'magma_totem', condition: targetExpired('magma_totem') },
    ...(novaTop ? [nova] : []),
    { abilityId: 'stormstrike' },
    ...(options.novaBelowStorm ? [nova] : []),
    {
      abilityId: 'flame_shock',
      condition: targetExpired('flame_shock'),
      ...(options.flameShockDots && options.flameShockDots > 1 ? { multiDot: options.flameShockDots } : {}),
    },
    { abilityId: 'rage_of_the_farseer' },
    ...(options.noEarthShock ? [] : [{ abilityId: 'earth_shock', condition: targetTime('atLeast', 3, 'flame_shock') }]),
    { abilityId: 'lightning_bolt', condition: selfStacks('atLeast', 5, 'maelstrom_weapon') },
    ...(options.chainAt5 ? [{ abilityId: 'chain_lightning', condition: targetCount('atLeast', 5) }] : []),
    ...(options.novaBottom ? [nova] : []),
  ];
};

const ENH_AOE_OPENER_ADD = [
  ...pre(3, 'flametongue_weapon'),
  ...pre(1.5, 'searing_totem'),
  ...pre(0, 'magma_totem', 'flame_shock', 'rage_of_the_farseer'),
];
const ENH_AOE_OPENER_REPLACE = [
  ...pre(3, 'flametongue_weapon'),
  ...pre(0, 'magma_totem', 'flame_shock', 'rage_of_the_farseer'),
];
const enhMulti = (opts: Parameters<typeof enhAoe>[0], precombat = ENH_AOE_OPENER_ADD) =>
  multiList('Shaman (Enhancement, AoE)', enhAoe(opts), precombat);

/* ================================================================ RESTO */

const RESTO_SHIPPED = {
  thundering_strikes: 5, ancestral_knowledge: 5, improved_ghost_wolf: 2,
  improved_healing_wave: 5, tidal_focus: 3, mindfulness: 3, natural_grace: 3,
  improved_reincarnation: 2, ancestral_healing: 3, healing_focus: 3, water_shield: 1,
  tidal_mastery: 5, mana_tide_totem: 1, healing_way: 3, nature_s_swiftness: 1,
  purification: 5, riptide: 1,
};
/** Improved Ghost Wolf (positioning) -> Tidal Focus 5: 2% more off every heal. */
const RESTO_TIDAL_5 = { ...RESTO_SHIPPED, improved_ghost_wolf: 0, tidal_focus: 5 };
/** And Natural Grace (threat) -> Totemic Focus 3 is dead too; three dead points
 * cannot go anywhere live -- this prices the move of ghost wolf alone. */

const lowest = { kind: 'lowestHealth' } as const;
const hw = (below: number): AplEntry => ({
  abilityId: 'healing_wave',
  target: lowest,
  condition: { kind: 'health', on: 'target', compare: 'below', fraction: below },
});
const injuredParty = (count: number, below = 0.9) =>
  ({ kind: 'injuredCount', of: 'targetParty', below, compare: 'atLeast', count }) as const;

/** The shipped Resto list's entries, for the raid list's starting point. */
const RESTO = SHAMAN_RESTORATION.entries;
const restoWithout = (ids: string[]) => RESTO.filter((e) => !ids.includes(e.abilityId));

const restoRaid = (options: {
  readonly chainCount?: number;
  readonly chainBelow?: number;
  readonly swiftnessOnCooldown?: boolean;
  readonly healingWave?: boolean;
  readonly chainAboveRiptide?: boolean;
  readonly chainOnLowest?: boolean;
  readonly noManaTide?: boolean;
  readonly noSwiftness?: boolean;
  readonly riptideBelow?: number;
  readonly noFallback?: boolean;
}): AplEntry[] => {
  const head = RESTO.slice(0, RESTO.findIndex((e) => e.abilityId === 'mana_tide_totem') + 1).filter(
    (e) => !(options.noManaTide && e.abilityId === 'mana_tide_totem'),
  );
  const swiftness: AplEntry = options.swiftnessOnCooldown
    ? { abilityId: 'nature_s_swiftness' }
    : RESTO.find((e) => e.abilityId === 'nature_s_swiftness')!;
  const shippedRiptide = RESTO.find((e) => e.abilityId === 'riptide')!;
  const riptide: AplEntry = options.riptideBelow === undefined
    ? shippedRiptide
    : { ...shippedRiptide, condition: { kind: 'health', on: 'target', compare: 'below', fraction: options.riptideBelow } };
  const chainHeal: AplEntry = {
    abilityId: 'chain_heal',
    target: options.chainOnLowest ? lowest : { kind: 'withAura', auraId: 'riptide' },
    condition: injuredParty(options.chainCount ?? 2, options.chainBelow ?? 0.9),
  };
  const chainFallback: AplEntry = {
    abilityId: 'chain_heal',
    target: lowest,
    condition: injuredParty(options.chainCount ?? 2, options.chainBelow ?? 0.9),
  };
  return [
    ...head,
    ...(options.noSwiftness ? [] : [swiftness]),
    ...(options.chainAboveRiptide ? [chainHeal, riptide] : [riptide, chainHeal]),
    ...(options.chainOnLowest || options.noFallback ? [] : [chainFallback]),
    ...(options.healingWave
      ? [{ abilityId: 'healing_wave', target: lowest, condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.6 } } as AplEntry]
      : []),
    RESTO.find((e) => e.abilityId === 'lesser_healing_wave')!,
  ];
};
const restoMulti = (opts: Parameters<typeof restoRaid>[0]) => multiList('Shaman (Restoration, raid)', restoRaid(opts));

/* ============================================================== GROUPS */

const CONTROL = (what: string): Variant => ({ label: `the shipped ${what} -- the control`, apply: (p) => p });

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  /* ---------------------------------------------------------- Elemental */
  eleTalents: [
    CONTROL('spread'),
    { label: 'warding 3 -> 2, totemic_focus 1 (5% off Searing)', apply: tree(ELE_TOTEMIC_1) },
    { label: 'warding 3 -> 2, elemental_devastation 1 (inert -- the dead-point check)', apply: tree(ELE_EYE_1) },
  ],
  eleConsumables: [
    CONTROL('consumables'),
    { label: 'potion: Major Mana Potion (for Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'other: none (no Demonic Rune)', apply: consumable('other', 'healthstone') },
    { label: 'blasted lands: +25 Spirit (for Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'school: +40 Fire (for Nature)', apply: consumable('school_spell_power', 'school_fire') },
    { label: 'food: +44 healing power (inert check)', apply: consumable('food', 'food_healing_power') },
  ],
  eleEnchants: [
    CONTROL('enchants'),
    { label: 'head AND legs +8 Intellect (for +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head +8 Intellect only', apply: enchant('head', 900006) },
    { label: 'gloves +1% Haste (for +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'main hand Revelation (for Weapon Spell Power)', apply: enchant('mainHand', 900032) },
    { label: 'chest +4 Defense (inert check)', apply: enchant('chest', 900016) },
  ],
  eleRace: [
    CONTROL('race (Troll)'),
    { label: 'Orc', apply: race('orc') },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Dwarf', apply: race('dwarf') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],
  elePrecombat: [
    CONTROL('opener'),
    { label: 'no pre-combat searing_totem (ours)', apply: removePrecombat('searing_totem') },
    { label: 'searing_totem lead 1.5 -> 0s', apply: precombatLead('searing_totem', 0) },
    { label: 'no pre-combat elemental_mastery (ours)', apply: removePrecombat('elemental_mastery') },
  ],
  eleSt: [
    CONTROL('list'),
    { label: 'racials above searing_totem', apply: moveAbove('berserking', 'searing_totem') },
    { label: 'chain_lightning on Clearcasting, above lava_burst', apply: addAbove({ abilityId: 'chain_lightning', condition: selfHas('elemental_focus') }, 'lava_burst') },
    { label: 'lava_burst on Clearcasting only above bolt (no)', apply: addAbove({ abilityId: 'lava_burst', condition: all(targetHas('flame_shock'), selfHas('elemental_focus')) }, 'searing_totem') },
    { label: 'flame_shock refreshed at <2s (for "if not active")', apply: regate('flame_shock', targetTime('below', 2, 'flame_shock')) },
    { label: 'spellblasting potion below the maintenance entries', apply: moveAbove('major_spellblasting_potion', 'berserking') },
  ],
  eleAoe: [
    CONTROL('list (the Single Target list on several targets)'),
    { label: 'AoE list: magma, nova, FS x1, CL, LvB, LB', apply: eleMulti({}) },
    { label: 'AoE list, FS multi-DoT 3', apply: eleMulti({ flameShockDots: 3 }) },
    { label: 'AoE list, FS multi-DoT 5', apply: eleMulti({ flameShockDots: 5 }) },
    { label: 'AoE list, no flame_shock', apply: eleMulti({ noFlameShock: true }) },
    { label: 'AoE list, CL above flame_shock', apply: eleMulti({ chainAboveShock: true }) },
    { label: 'AoE list, nova below CL', apply: eleMulti({ novaAfterChain: true }) },
    { label: 'AoE list, no lava_burst', apply: eleMulti({ noLavaBurst: true }) },
    { label: 'AoE list, searing not magma', apply: eleMulti({ noMagma: true }, [...pre(1.5, 'searing_totem'), ...pre(0, 'elemental_mastery', 'flame_shock')]) },
    { label: 'AoE list with the Single Target opener (searing)', apply: eleMulti({}, [...pre(1.5, 'searing_totem'), ...pre(0, 'elemental_mastery', 'flame_shock')]) },
  ],

  /* -------------------------------------------------------- Enhancement */
  enhTalents: [
    CONTROL('spread'),
    { label: 'reverberation 5 -> convection 5', apply: tree(ENH_REVERB_TO_CONVECTION) },
    { label: 'reverberation 3 + convection 2', apply: tree(ENH_REVERB3_CONVECTION2) },
    { label: 'reverberation 2 + convection 3', apply: tree(ENH_REVERB2_CONVECTION3) },
  ],
  enhConsumables: [
    CONTROL('consumables'),
    { label: 'potion: Major Mana Potion (for Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'other: Healthstone (no Demonic Rune)', apply: consumable('other', 'healthstone') },
    { label: 'blasted lands: +25 Intellect (for Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'food: +28 Spell Power (for +20 Strength)', apply: consumable('food', 'food_spell_power') },
    { label: 'school: +40 Nature (for Fire)', apply: consumable('school_spell_power', 'school_nature') },
  ],
  enhEnchants: [
    CONTROL('enchants'),
    { label: 'head AND legs +8 Intellect (for +8 Strength)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head AND legs +1% Haste (for +8 Strength)', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'wrists +16 Spell Power (for +9 Strength)', apply: enchant('wrists', 900018) },
    { label: 'gloves +20 Spell Power (for +15 Strength)', apply: enchant('gloves', 900023) },
    { label: 'gloves +1% Haste (for +15 Strength)', apply: enchant('gloves', 900002) },
    { label: 'neck +6 Spell Power (for +5 Strength)', apply: enchant('neck', 900009) },
    { label: 'two-hand +65 Spell Power (for Crusader)', apply: enchant('twoHand', 900029) },
    { label: 'two-hand Revelation (for Crusader)', apply: enchant('twoHand', 900032) },
    { label: 'two-hand +25 Agility (for Crusader)', apply: enchant('twoHand', 900031) },
  ],
  enhRace: [
    CONTROL('race (Tauren)'),
    { label: 'Orc', apply: race('orc') },
    { label: 'Troll', apply: race('troll') },
    { label: 'Dwarf', apply: race('dwarf') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],
  enhPrecombat: [
    CONTROL('opener'),
    { label: 'no pre-combat rage_of_the_farseer (ours)', apply: removePrecombat('rage_of_the_farseer') },
    { label: 'searing_totem lead 1.5 -> 0s', apply: precombatLead('searing_totem', 0) },
  ],
  enhSt: [
    CONTROL('list'),
    { label: 'fire_nova only above 30% mana', apply: regate('fire_nova', resourceFraction('atLeast', 0.3, 'mana')) },
    { label: 'fire_nova only above 50% mana', apply: regate('fire_nova', resourceFraction('atLeast', 0.5, 'mana')) },
    { label: 'fire_nova only above 70% mana', apply: regate('fire_nova', resourceFraction('atLeast', 0.7, 'mana')) },
    { label: 'fire_nova above earth_shock', apply: moveAbove('fire_nova', 'earth_shock') },
    { label: 'earth_shock only above 20% mana', apply: regate('earth_shock', all(targetTime('atLeast', 3, 'flame_shock'), resourceFraction('atLeast', 0.2, 'mana'))) },
    { label: 'stormstrike below flame_shock', apply: moveAbove('flame_shock', 'stormstrike') },
  ],
  enhAoe: [
    CONTROL('list (the Single Target list on several targets)'),
    { label: 'AoE list: magma, nova, SS, FS x1, ES, LB5', apply: enhMulti({}) },
    { label: 'AoE list, FS multi-DoT 3', apply: enhMulti({ flameShockDots: 3 }) },
    { label: 'AoE list, FS multi-DoT 5', apply: enhMulti({ flameShockDots: 5 }) },
    { label: 'AoE list, FS multi-DoT 5, no earth_shock', apply: enhMulti({ flameShockDots: 5, noEarthShock: true }) },
    { label: 'AoE list, nova below stormstrike', apply: enhMulti({ novaBelowStorm: true }) },
    { label: 'AoE list, nova at the bottom', apply: enhMulti({ novaBottom: true }) },
    { label: 'AoE list, searing not magma', apply: enhMulti({ searing: true }) },
    { label: 'AoE list, opener replaces searing with magma', apply: enhMulti({}, ENH_AOE_OPENER_REPLACE) },
  ],

  /* ------------------------------------- second pass, on the shipped AoE lists */
  eleAoe2: [
    CONTROL('AoE list'),
    { label: 'the Single Target list instead (the old default)', apply: ST_IN_MULTI_ELE },
    { label: 'CL above flame_shock', apply: inMulti(moveAbove('chain_lightning', 'flame_shock')) },
    { label: 'CL above fire_nova', apply: inMulti(moveAbove('chain_lightning', 'fire_nova')) },
    { label: 'no lava_burst', apply: inMulti(removeEntry('lava_burst')) },
    { label: 'FS multi-DoT 4', apply: inMulti(setEntry('flame_shock', { multiDot: 4 })) },
    { label: 'FS multi-DoT 3', apply: inMulti(setEntry('flame_shock', { multiDot: 3 })) },
    { label: 'magma refreshed under 2s', apply: inMulti(regate('magma_totem', targetTime('below', 2, 'magma_totem'))) },
    { label: 'racials above magma', apply: inMulti(moveAbove('berserking', 'magma_totem')) },
  ],
  eleShared5: [
    CONTROL('build'),
    { label: 'potion: Major Mana Potion', apply: consumable('potion', 'major_mana_potion') },
    { label: 'head AND legs +8 Intellect', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'Orc', apply: race('orc') },
    { label: 'Dwarf', apply: race('dwarf') },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'warding 3 -> 2, totemic_focus 1', apply: tree(ELE_TOTEMIC_1) },
    { label: 'school: +40 Fire (for Nature)', apply: consumable('school_spell_power', 'school_fire') },
  ],
  enhAoe2: [
    CONTROL('AoE list'),
    { label: 'the Single Target list instead (the old default)', apply: ST_IN_MULTI_ENH },
    { label: 'no earth_shock', apply: inMulti(removeEntry('earth_shock')) },
    { label: 'FS multi-DoT 3', apply: inMulti(setEntry('flame_shock', { multiDot: 3 })) },
    { label: 'FS multi-DoT 4', apply: inMulti(setEntry('flame_shock', { multiDot: 4 })) },
    { label: 'FS above stormstrike', apply: inMulti(moveAbove('flame_shock', 'stormstrike')) },
    { label: 'stormstrike above fire_nova', apply: inMulti(moveAbove('stormstrike', 'fire_nova')) },
    { label: 'chain_lightning ungated at the bottom', apply: inMulti(addEntryAtBottom({ abilityId: 'chain_lightning' })) },
    { label: 'magma refreshed under 2s', apply: inMulti(regate('magma_totem', targetTime('below', 2, 'magma_totem'))) },
  ],
  enhShared5: [
    CONTROL('build'),
    { label: 'potion: Major Mana Potion', apply: consumable('potion', 'major_mana_potion') },
    { label: 'blasted lands: +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'food: +28 Spell Power', apply: consumable('food', 'food_spell_power') },
    { label: 'two-hand +65 Spell Power', apply: enchant('twoHand', 900029) },
    { label: 'head AND legs +8 Intellect', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'wrists, gloves, neck: Spell Power', apply: chain(enchant('wrists', 900018), enchant('gloves', 900023), enchant('neck', 900009)) },
    { label: 'Orc', apply: race('orc') },
    { label: 'school: +40 Nature (for Fire)', apply: consumable('school_spell_power', 'school_nature') },
  ],

  /* -------------------------------------------------------------- Resto */
  restoTalents: [
    CONTROL('spread'),
    { label: 'improved_ghost_wolf 2 -> tidal_focus 5', apply: tree(RESTO_TIDAL_5) },
  ],
  restoConsumables: [
    CONTROL('consumables'),
    { label: 'potion: Major Menders (unmodelled -- prices the mana potion)', apply: consumable('potion', 'major_menders_potion') },
    { label: 'other: Healthstone (no Demonic Rune)', apply: consumable('other', 'healthstone') },
    { label: 'food: +28 Spell Power (for +44 Healing)', apply: consumable('food', 'food_spell_power') },
    { label: 'blasted lands: +25 Spirit (for Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
  ],
  restoEnchants: [
    CONTROL('enchants'),
    { label: 'head AND legs +8 Intellect (for +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head AND legs +8 Spirit (for +1% Haste)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'neck +6 Spell Power (for +11 Healing)', apply: enchant('neck', 900009) },
    { label: 'wrists +16 Spell Power (for +16 Healing)', apply: enchant('wrists', 900018) },
    { label: 'gloves +1% Haste (for +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'main hand +25 Agility (does Weapon Spell Power heal?)', apply: enchant('mainHand', 900031) },
  ],
  restoRace: [
    CONTROL('race (Troll)'),
    { label: 'Orc', apply: race('orc') },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Dwarf', apply: race('dwarf') },
    { label: 'Windshaper Skyborne', apply: race('windshaper_skyborne') },
  ],
  restoTank: [
    CONTROL('list'),
    { label: "nature's swiftness at tank < 50%", apply: regate('nature_s_swiftness', { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.5 }) },
    { label: "nature's swiftness at tank < 25%", apply: regate('nature_s_swiftness', { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.25 }) },
    { label: 'mana tide at 50% mana', apply: regate('mana_tide_totem', resourceFraction('atMost', 0.5, 'mana')) },
    { label: 'mana tide at 90% mana', apply: regate('mana_tide_totem', resourceFraction('atMost', 0.9, 'mana')) },
    { label: 'healing wave on the lowest under 50%, above LHW', apply: addAbove({ abilityId: 'healing_wave', target: lowest, condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.5 } }, 'lesser_healing_wave') },
    { label: 'healing wave for LHW entirely', apply: setEntry('lesser_healing_wave', { abilityId: 'healing_wave' }) },
    { label: 'LHW only under 90%', apply: regate('lesser_healing_wave', { kind: 'health', on: 'target', compare: 'below', fraction: 0.9 }) },
    { label: 'riptide only under 90%', apply: regate('riptide', { kind: 'health', on: 'target', compare: 'below', fraction: 0.9 }) },
  ],
  restoTank2: [
    CONTROL('list'),
    { label: 'healing wave for LHW entirely (rewrites the owner line)', apply: setEntry('lesser_healing_wave', { abilityId: 'healing_wave' }) },
    { label: 'HW above LHW, lowest under 100%', apply: addAbove(hw(1), 'lesser_healing_wave') },
    { label: 'HW above LHW, lowest under 90%', apply: addAbove(hw(0.9), 'lesser_healing_wave') },
    { label: 'HW above LHW, lowest under 80%', apply: addAbove(hw(0.8), 'lesser_healing_wave') },
    { label: 'HW above LHW, lowest under 70%', apply: addAbove(hw(0.7), 'lesser_healing_wave') },
    { label: 'HW above riptide, lowest under 80%', apply: addAbove(hw(0.8), 'riptide') },
    { label: 'mana tide ungated', apply: regate('mana_tide_totem', undefined) },
    { label: 'mana tide at 80% mana', apply: regate('mana_tide_totem', resourceFraction('atMost', 0.8, 'mana')) },
    { label: 'mana tide at 90% mana', apply: regate('mana_tide_totem', resourceFraction('atMost', 0.9, 'mana')) },
  ],
  restoRaid2: [
    CONTROL('list (the Single Target list in the raid)'),
    { label: 'raid list: as shipped, no mana tide', apply: restoMulti({ noManaTide: true }) },
    { label: 'raid list: no mana tide, CH at 1 injured', apply: restoMulti({ noManaTide: true, chainCount: 1 }) },
    { label: 'raid list: no mana tide, no NS', apply: restoMulti({ noManaTide: true, noSwiftness: true }) },
    { label: 'raid list: no mana tide, riptide on the lowest under 90%', apply: restoMulti({ noManaTide: true, riptideBelow: 0.9 }) },
    { label: 'raid list: no mana tide, HW under 60%', apply: restoMulti({ noManaTide: true, healingWave: true }) },
    { label: 'raid list: no mana tide, no CH fallback', apply: restoMulti({ noManaTide: true, noFallback: true }) },
  ],
  restoRaid3: [
    CONTROL('raid list'),
    { label: 'no healing_wave entry', apply: inMulti(removeEntry('healing_wave')) },
    { label: 'healing_wave under 60%', apply: inMulti(setEntry('healing_wave', { condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.6 } })) },
    { label: 'chain heal at 1 injured', apply: inMulti(setEntry('chain_heal', { condition: injuredParty(1) })) },
    { label: 'the Single Target list instead', apply: ST_IN_MULTI_ELE },
  ],
  restoCombined: [
    CONTROL('build'),
    { label: 'REVERT race to Troll', apply: race('troll') },
    { label: 'REVERT gloves to +20 Spell Power', apply: enchant('gloves', 900023) },
    { label: 'REVERT the tank list (HW, MTT 70%)', apply: chain(removeEntry('healing_wave'), regate('mana_tide_totem', resourceFraction('atMost', 0.7, 'mana'))) },
  ],
  eleCombined: [
    CONTROL('build'),
    { label: 'REVERT race to Troll', apply: race('troll') },
    { label: 'REVERT potion to Spellblasting', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'REVERT head and legs to +1% Haste', apply: chain(enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'REVERT talents', apply: tree({ ...ELE_SHIPPED }) },
      ],
  enhCombined: [
    CONTROL('build'),
    { label: 'REVERT race to Tauren', apply: race('tauren') },
    { label: 'REVERT potion to Spellblasting', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'REVERT blasted to Strength, food to Strength', apply: chain(consumable('blasted_lands', 'blasted_strength'), consumable('food', 'food_strength')) },
    { label: 'REVERT two-hand to Crusader', apply: enchant('twoHand', 20034) },
    { label: 'REVERT the six stat enchants', apply: chain(enchant('head', 900005), enchant('legs', 900005), enchant('neck', 900008), enchant('wrists', 900017), enchant('gloves', 900021)) },
  ],
  enhAoe3: [
    CONTROL('AoE list'),
    { label: 'CL above the maelstrom bolt', apply: inMulti(moveAbove('chain_lightning', 'lightning_bolt')) },
    { label: 'CL above earth_shock', apply: inMulti(moveAbove('chain_lightning', 'earth_shock')) },
    { label: 'CL above stormstrike', apply: inMulti(moveAbove('chain_lightning', 'stormstrike')) },
    { label: 'CL only at 4+ targets', apply: inMulti(setEntry('chain_lightning', { condition: targetCount('atLeast', 4) })) },
    { label: 'CL only above 30% mana', apply: inMulti(setEntry('chain_lightning', { condition: resourceFraction('atLeast', 0.3, 'mana') })) },
    { label: 'no earth_shock', apply: inMulti(removeEntry('earth_shock')) },
    { label: 'the Single Target list instead', apply: ST_IN_MULTI_ENH },
  ],
  enhSt2: [
    CONTROL('list'),
    { label: 'earth_shock gate flame_shock >= 1s', apply: regate('earth_shock', targetTime('atLeast', 1, 'flame_shock')) },
    { label: 'earth_shock gate flame_shock >= 5s', apply: regate('earth_shock', targetTime('atLeast', 5, 'flame_shock')) },
    { label: 'earth_shock gate flame_shock >= 8s', apply: regate('earth_shock', targetTime('atLeast', 8, 'flame_shock')) },
    { label: 'lightning_bolt at 4 maelstrom', apply: regate('lightning_bolt', selfStacks('atLeast', 4, 'maelstrom_weapon')) },
    { label: 'searing_totem refreshed under 2s', apply: regate('searing_totem', targetTime('below', 2, 'searing_totem')) },
    { label: 'fire_nova below stormstrike', apply: moveAbove('fire_nova', 'flame_shock') },
  ],
  eleSt2: [
    CONTROL('list'),
    { label: 'searing_totem refreshed under 2s', apply: regate('searing_totem', targetTime('below', 2, 'searing_totem')) },
    { label: 'searing_totem refreshed under 5s', apply: regate('searing_totem', targetTime('below', 5, 'searing_totem')) },
    { label: 'lava_burst above flame_shock', apply: moveAbove('lava_burst', 'flame_shock') },
  ],
  restoRaid: [
    CONTROL('list (the Single Target list in the raid)'),
    { label: 'raid list: as shipped + CH fallback on the lowest', apply: restoMulti({}) },
    { label: 'raid list: CH at 1 injured', apply: restoMulti({ chainCount: 1 }) },
    { label: 'raid list: CH at 3 injured', apply: restoMulti({ chainCount: 3 }) },
    { label: 'raid list: CH at <80%', apply: restoMulti({ chainBelow: 0.8 }) },
    { label: 'raid list: CH on the lowest, not the Riptide target', apply: restoMulti({ chainOnLowest: true }) },
    { label: "raid list: nature's swiftness on cooldown", apply: restoMulti({ swiftnessOnCooldown: true }) },
    { label: 'raid list: CH above riptide', apply: restoMulti({ chainAboveRiptide: true }) },
    { label: 'raid list: healing wave under 60% above LHW', apply: restoMulti({ healingWave: true }) },
  ],
};

// Keep references some groups may not use, so a later pass can reach them.
void inMulti;
void not;
void addPrecombat;
void restoWithout;
void SHAMAN_MULTI_TARGET;
