/*
 * ==============================================================================
 * ROUND 78: THE FOUR MAGE PRESETS, OPTIMISED FOR THE FULL REPORT'S ENCOUNTERS.
 *
 *   PRESET=mage_fire FILE=tools/optimise/mageVariants.ts VARIANTS=fireCons DURATION=120 \
 *     npx vite-node tools/probe_build.ts
 *   PRESET=mage_fire FILE=tools/optimise/mageVariants.ts VARIANTS=fireAoe TARGETS=5 DURATION=60 \
 *     npx vite-node tools/probe_build.ts
 *
 * ------------------------------------------------------------------------------
 * THE THEME (Step 0), which no variant here may move:
 *
 *   profile          class  majority tree        style   stance  target swings
 *   mage_frostfire   mage   Fire 29 / Frost 22   caster  -       no
 *   mage_arcane      mage   Arcane 48 / Fire 3   caster  -       no
 *   mage_fire        mage   Fire 34 / Arcane 14  caster  -       no
 *   mage_frost       mage   Frost 34 / Arcane 14 caster  -       no
 *
 * E65 gear, untouched; only `enchantId` moves. The owner's opener lines and
 * list lines stay -- a variant may ADD to them.
 *
 * ------------------------------------------------------------------------------
 * THE OBJECTIVES: Single Target is 1 target at 120s; Multi Target is 5 targets at
 * 60s, the list reused at 3 targets/60s and 8 targets/30s. Talents, enchants,
 * consumables and race are shared by both.
 *
 * THE BEFORE FIGURES (full_report, 300 fights a cell):
 *
 *   Frostfire  t1  971.1 +/- 10.6   t3 1059.1   t5 1059.1   t8 1040.5
 *   Arcane     t1  938.8 +/-  6.4   t3 1066.0   t5 1066.0   t8 1196.1
 *   Fire       t1 1024.2 +/-  7.0   t3 1131.0   t5 1131.0   t8 1213.8
 *   Frost      t1  924.0 +/-  6.1   t3  983.7   t5  983.7   t8  996.5
 *
 * t3 = t5 because no Mage had a Multi Target list: every multi-target fight ran
 * the Single Target list against the boss alone.
 * ==============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplEntry } from '../../src/game/rotations/apl';
import {
  all,
  any,
  hasReaction,
  resourceFraction,
  selfHas,
  selfMissing,
  selfStacks,
  selfTime,
  targetCount,
  targetMissing,
  targetStacks,
  targetTime,
} from '../../src/game/rotations/apl';
import { foreverEnchantId } from '../../src/game/items/foreverEnchants';
import type { Apply, Variant } from '../buildVariants';
import { MAGE_TREE as tree, apl, chain, consumable, enchant, moveAbove, multiList } from '../buildVariants';

const control: Variant = { label: 'the shipped profile -- the control', apply: (p) => p };

// ---------------------------------------------------------------------------
// Race. Gear stays; the racial's own list entry is switched on if the list
// carries it switched off.
// ---------------------------------------------------------------------------
const RACIAL_ACTIVES: Record<string, string> = { orc: 'blood_fury', troll: 'berserking', gnome: 'eureka' };
const MAGE_RACES = ['human', 'gnome', 'high_order_skyborne', 'orc', 'undead', 'troll', 'windshaper_skyborne'];

const race =
  (id: string): Apply =>
  (p) => {
    const active = RACIAL_ACTIVES[id];
    const enable = (entries: readonly AplEntry[]) =>
      entries.map((e) => {
        if (e.abilityId !== active || !e.disabled) return e;
        const { disabled: _d, ...rest } = e;
        return rest;
      });
    return {
      ...p,
      character: { ...p.character, race: id as CharacterProfile['character']['race'] },
      rotation: { ...p.rotation, source: 'custom', entries: enable(p.rotation.entries) },
    };
  };

const raceGroup = (current: string): Variant[] => [
  control,
  ...MAGE_RACES.filter((r) => r !== current).map((r) => ({ label: `race ${r}`, apply: race(r) })),
];

// ---------------------------------------------------------------------------
// Consumables. The potion entry is a SEQUENCE head on Fire and Arcane (the
// cooldown stack), so swapping the potion has to keep the rest of the stack.
// ---------------------------------------------------------------------------
const MANA_POTION: AplEntry = {
  abilityId: 'major_mana_potion',
  condition: resourceFraction('atMost', 0.3, 'mana'),
};

/** Spellblasting out, the Major Mana Potion in at 30% mana, the cooldown stack kept. */
const manaPotion: Apply = chain(
  consumable('potion', 'major_mana_potion'),
  apl((entries) => {
    const out: AplEntry[] = [];
    for (const e of entries) {
      if (e.abilityId !== 'major_spellblasting_potion') {
        out.push(e);
        continue;
      }
      if (e.sequence && e.sequence.length > 0) {
        const [head, ...rest] = e.sequence;
        const { sequence: _s, ...base } = e;
        out.push({ ...base, abilityId: head, ...(rest.length > 0 ? { sequence: rest } : {}) });
      }
    }
    const at = out.findIndex((e) => e.abilityId === 'demonic_rune');
    out.splice(at < 0 ? 0 : at, 0, MANA_POTION);
    return out;
  }),
);

const consGroup = (): Variant[] => [
  control,
  { label: 'potion: Major Mana Potion (30%)', apply: manaPotion },
  { label: 'blasted lands: +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
  { label: 'other: none (no Demonic Rune)', apply: (p) => ({ ...p, consumables: { ...p.consumables, other: undefined } as never }) },
];

// ---------------------------------------------------------------------------
// Enchants (ids are the 900,000 block, by position in foreverEnchants.ts).
// ---------------------------------------------------------------------------
const E = {
  haste: foreverEnchantId('+1% Haste'),
  int8: foreverEnchantId('+8 Intellect'),
  spirit8: foreverEnchantId('+8 Spirit'),
};
const enchGroup = (): Variant[] => [
  control,
  { label: 'gloves +1% Haste (for +20 SP)', apply: enchant('gloves', E.haste) },
  { label: 'head +8 Intellect (for +1% Haste)', apply: enchant('head', E.int8) },
  { label: 'head and legs +8 Intellect', apply: chain(enchant('head', E.int8), enchant('legs', E.int8)) },
];

// ---------------------------------------------------------------------------
// Multi Target. AoE entries gated on the number of targets, placed above the
// Single Target list's first damaging entry; the Single Target list is kept
// beneath as the fallback (it is what runs at a count below the gate).
// ---------------------------------------------------------------------------
const DAMAGE = new Set([
  'scorch', 'pyroblast', 'fire_blast', 'frostfire_bolt', 'fireball', 'arcane_missiles', 'arcane_wrath',
  'arcane_blast', 'cone_of_cold', 'ice_lance', 'frostbolt', 'ice_barrier',
]);
const tc = (n: number) => targetCount('atLeast', n);
export const AE = (n: number): AplEntry => ({ abilityId: 'arcane_explosion', condition: tc(n) });
export const FS = (n: number): AplEntry => ({ abilityId: 'flamestrike', condition: tc(n) });
export const FS_DOT = (n: number): AplEntry => ({
  abilityId: 'flamestrike',
  condition: all(tc(n), targetMissing('flamestrike')),
});
export const BLIZ = (n: number): AplEntry => ({ abilityId: 'blizzard', condition: tc(n) });

const withAoe = (entries: readonly AplEntry[], aoe: readonly AplEntry[], beforeId?: string): AplEntry[] => {
  const at = beforeId
    ? entries.findIndex((e) => e.abilityId === beforeId)
    : entries.findIndex((e) => DAMAGE.has(e.abilityId) || (e.sequence ?? []).some((s) => DAMAGE.has(s)));
  if (at < 0) throw new Error(`no insertion point ${beforeId ?? 'damage'}`);
  return [...entries.slice(0, at), ...aoe, ...entries.slice(at)];
};

const mt =
  (name: string, aoe: readonly AplEntry[], beforeId?: string): Apply =>
  (p) =>
    multiList(name, withAoe(p.rotation.entries, aoe, beforeId))(p);

/*
 * THE COOLDOWN STACK IS GATED ON A SINGLE-TARGET STATE -- five Fire
 * Vulnerability stacks, or four Arcane Blast stacks -- that an AoE list never
 * builds, so beneath an AoE entry it can never fire. Hoisted: the stack's entry
 * goes above the AoE entries with its condition replaced by the target count.
 */
const hoisted =
  (name: string, aoe: readonly AplEntry[], gate: number): Apply =>
  (p) => {
    const entries = p.rotation.entries;
    const stack = entries.find(
      (e) => e.abilityId === 'major_spellblasting_potion' && (e.sequence ?? []).length > 0,
    );
    if (!stack) throw new Error('no cooldown stack');
    const rest = entries.filter((e) => e !== stack);
    const lifted: AplEntry = { ...stack, condition: tc(gate) };
    return multiList(name, withAoe(rest, [lifted, ...aoe]))(p);
  };

/** A gated copy of the stack above the AoE entries, the original kept where it was. */
const hoistedKeep =
  (name: string, aoe: readonly AplEntry[], gate: number): Apply =>
  (p) => {
    const stack = p.rotation.entries.find(
      (e) => e.abilityId === 'major_spellblasting_potion' && (e.sequence ?? []).length > 0,
    );
    if (!stack) throw new Error('no cooldown stack');
    return multiList(name, withAoe(p.rotation.entries, [{ ...stack, condition: tc(gate) }, ...aoe]))(p);
  };

/*
 * THE ARCANE STACK WITH FLAMESTRIKE IN ARCANE WRATH'S PLACE: Presence of Mind
 * makes the three-second Flamestrike instant inside Arcane Power. `keep` leaves
 * the Single Target stack where it was (the copy only fires at `gate` targets).
 */
const pomStack =
  (gate: number, keep: boolean, aoe: readonly AplEntry[]): Apply =>
  (p) => {
    const entries = p.rotation.entries;
    const stack = entries.find(
      (e) => e.abilityId === 'major_spellblasting_potion' && (e.sequence ?? []).length > 0,
    );
    if (!stack) throw new Error('no cooldown stack');
    const base = keep ? entries : entries.filter((e) => e !== stack);
    const lifted: AplEntry = {
      ...stack,
      sequence: ['arcane_power', 'presence_of_mind', 'flamestrike'],
      condition: tc(gate),
    };
    return multiList('AoE', withAoe(base, [lifted, ...aoe]))(p);
  };

const stackGroup = (prefix: string): Variant[] => [
  control,
  { label: `${prefix}: FS on dot, then AE (>=3)`, apply: mt('AoE', [FS_DOT(3), AE(3)]) },
  { label: `${prefix}: stack hoisted, FS on dot, then AE`, apply: hoisted('AoE', [FS_DOT(3), AE(3)], 3) },
  { label: `${prefix}: stack hoisted, AE spam`, apply: hoisted('AoE', [AE(3)], 3) },
  { label: `${prefix}: stack hoisted, FS spam`, apply: hoisted('AoE', [FS(3)], 3) },
];

const aoeGroup = (prefix: string): Variant[] => [
  control,
  { label: `${prefix}: AE spam (>=3)`, apply: mt('AoE', [AE(3)]) },
  { label: `${prefix}: FS on dot, then AE (>=3)`, apply: mt('AoE', [FS_DOT(3), AE(3)]) },
  { label: `${prefix}: FS on dot, then ST (>=3)`, apply: mt('AoE', [FS_DOT(3)]) },
  { label: `${prefix}: FS spam (>=3)`, apply: mt('AoE', [FS(3)]) },
  { label: `${prefix}: Blizzard spam (>=3)`, apply: mt('AoE', [BLIZ(3)]) },
  { label: `${prefix}: FS on dot, Blizzard (>=3)`, apply: mt('AoE', [FS_DOT(3), BLIZ(3)]) },
];

// ---------------------------------------------------------------------------
// Single Target APL edits.
// ---------------------------------------------------------------------------
/** Replace the condition on the `nth` entry (0-based) for `id`. */
const setCond = (id: string, cond: AplEntry['condition'], nth = 0): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${id}#${nth}`);
    const { condition: _c, ...rest } = entries[at];
    entries[at] = cond ? { ...rest, condition: cond } : rest;
    return entries;
  });

const ffScorch = (seconds: number) =>
  all(
    hasReaction('improved_scorch'),
    any(targetStacks('below', 5, 'fire_vulnerability'), targetTime('atMost', seconds, 'fire_vulnerability')),
  );
const heatingUpAtMostOne = any(selfMissing('heating_up'), selfStacks('atMost', 1, 'heating_up'));
const ffFireBlast = (floor: number) =>
  all(resourceFraction('atLeast', floor, 'mana'), heatingUpAtMostOne);

// ---------------------------------------------------------------------------
// Talents.
// ---------------------------------------------------------------------------
const FIRE_SHIPPED = {
  arcane_focus: 5, missile_barrage: 2, arcane_subtlety: 2, arcane_concentration: 5,
  improved_fire_blast: 2, incineration: 3, improved_fireball: 5, ignite: 5, burning_soul: 2, pyroblast: 1,
  improved_scorch: 3, heating_up: 1, master_of_elements: 3, critical_mass: 5, fire_power: 3, combustion: 1,
  elemental_precision: 3,
};
const FF_SHIPPED = {
  improved_fire_blast: 2, incineration: 3, improved_fireball: 5, ignite: 5, pyroblast: 1, improved_scorch: 3,
  heating_up: 1, master_of_elements: 3, critical_mass: 3, fire_power: 3,
  frost_warding: 2, improved_frostbolt: 2, elemental_precision: 3, ice_shards: 5, frost_channeling: 3,
  ice_lance: 1, ice_block: 1, shatter: 3, fingers_of_frost: 2,
};

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  fireRace: raceGroup('gnome'),
  ffRace: raceGroup('gnome'),
  arcRace: raceGroup('gnome'),
  frostRace: raceGroup('windshaper_skyborne'),

  fireCons: consGroup(),
  ffCons: consGroup(),
  arcCons: consGroup(),
  frostCons: consGroup(),

  fireEnch: enchGroup(),
  ffEnch: enchGroup(),
  arcEnch: enchGroup(),
  frostEnch: enchGroup(),

  fireAoe: aoeGroup('fire'),
  ffAoe: aoeGroup('ff'),
  arcAoe: aoeGroup('arc'),
  frostAoe: aoeGroup('frost'),
  fireStack: stackGroup('fire'),
  arcStack: stackGroup('arc'),

  fireMt: [
    control,
    { label: 'stack hoisted, FS spam', apply: hoisted('AoE', [FS(3)], 3) },
    {
      label: 'stack hoisted, Pyroblast@3 Heating Up, FS spam',
      apply: hoisted('AoE', [{ abilityId: 'pyroblast', condition: selfStacks('exactly', 3, 'heating_up') }, FS(3)], 3),
    },
    {
      label: 'stack hoisted, FS spam, gate 4',
      apply: hoisted('AoE', [FS(4)], 4),
    },
    {
      label: 'stack hoisted, FS spam, AE under 30% mana',
      apply: hoisted('AoE', [{ abilityId: 'flamestrike', condition: all(tc(3), resourceFraction('atLeast', 0.3, 'mana')) }, AE(3), FS(3)], 3),
    },
    {
      label: 'stack hoisted, FS spam, Fire Blast above FS',
      apply: hoisted('AoE', [{ abilityId: 'fire_blast', condition: tc(3) }, FS(3)], 3),
    },
  ],
  fireMt3: [
    control,
    { label: 'stack hoisted, FS spam', apply: hoisted('AoE', [FS(3)], 3) },
    {
      label: 'stack, Fire Blast (<=4 targets), FS spam',
      apply: hoisted('AoE', [{ abilityId: 'fire_blast', condition: targetCount('atMost', 4) }, FS(3)], 3),
    },
    {
      label: 'stack, Fire Blast (<=4), Pyro@3 (<=4), FS spam',
      apply: hoisted(
        'AoE',
        [
          { abilityId: 'pyroblast', condition: all(targetCount('atMost', 4), selfStacks('exactly', 3, 'heating_up')) },
          { abilityId: 'fire_blast', condition: targetCount('atMost', 4) },
          FS(3),
        ],
        3,
      ),
    },
    { label: 'stack hoisted, FS on dot, then ST', apply: hoisted('AoE', [FS_DOT(3)], 3) },
    {
      label: 'stack, FS on dot (<=4) else FS spam',
      apply: hoisted('AoE', [FS_DOT(3), { abilityId: 'flamestrike', condition: tc(5) }], 3),
    },
  ],
  fireMtFinal: [
    control,
    { label: 'FS on dot (>=3), FS spam (>=5), stack not hoisted', apply: mt('AoE', [FS_DOT(3), FS(5)]) },
    { label: 'stack, FS on dot (>=3), FS spam (>=5)', apply: hoisted('AoE', [FS_DOT(3), FS(5)], 3) },
    { label: 'stack (>=5 only), FS on dot (>=3), FS spam (>=5)', apply: (p) => hoistedKeep('AoE', [FS_DOT(3), FS(5)], 5)(p) },
  ],
  ffMt: [
    control,
    { label: 'FS spam (>=3)', apply: mt('AoE', [FS(3)]) },
    { label: 'FS on dot (>=3), FS spam (>=5)', apply: mt('AoE', [FS_DOT(3), FS(5)]) },
    {
      label: 'Pyro@3 HU, FS spam (>=3)',
      apply: mt('AoE', [{ abilityId: 'pyroblast', condition: selfStacks('exactly', 3, 'heating_up') }, FS(3)]),
    },
    {
      label: 'FS on dot (>=3), Pyro@3 (<=4), FS spam (>=5)',
      apply: mt('AoE', [
        FS_DOT(3),
        { abilityId: 'pyroblast', condition: all(targetCount('atMost', 4), selfStacks('exactly', 3, 'heating_up')) },
        FS(5),
      ]),
    },
    { label: 'FS on dot (>=3), AE (>=5)', apply: mt('AoE', [FS_DOT(3), AE(5)]) },
  ],
  arcMt: [
    control,
    { label: 'stack hoisted, FS on dot, then AE', apply: hoisted('AoE', [FS_DOT(3), AE(3)], 3) },
    { label: 'stack (>=5 copy), FS on dot, then AE', apply: hoistedKeep('AoE', [FS_DOT(3), AE(3)], 5) },
    {
      label: 'stack hoisted, FS on dot, AB kept at 4, AE',
      apply: hoisted(
        'AoE',
        [
          FS_DOT(3),
          {
            abilityId: 'arcane_blast',
            condition: all(tc(3), any(selfStacks('below', 4, 'arcane_blast'), selfTime('atMost', 3, 'arcane_blast'))),
          },
          AE(3),
        ],
        3,
      ),
    },
    {
      label: 'stack with Flamestrike under PoM, FS on dot, AE',
      apply: (p) => {
        const entries = p.rotation.entries;
        const stack = entries.find((e) => e.abilityId === 'major_spellblasting_potion' && (e.sequence ?? []).length > 0)!;
        const rest = entries.filter((e) => e !== stack);
        const lifted: AplEntry = { ...stack, sequence: ['arcane_power', 'presence_of_mind', 'flamestrike'], condition: tc(3) };
        return multiList('AoE', withAoe(rest, [lifted, FS_DOT(3), AE(3)]))(p);
      },
    },
  ],
  frostMt: [
    control,
    { label: 'FS on dot, Blizzard (>=3)', apply: mt('AoE', [FS_DOT(3), BLIZ(3)]) },
    {
      label: 'FS on dot, Ice Lance on Fingers, Blizzard',
      apply: mt('AoE', [FS_DOT(3), { abilityId: 'ice_lance', condition: all(tc(3), selfHas('fingers_of_frost')) }, BLIZ(3)]),
    },
    {
      label: 'FS on dot, Ice Lance on Fingers (interrupts), Blizzard',
      apply: mt('AoE', [
        FS_DOT(3),
        { abilityId: 'ice_lance', condition: all(tc(3), selfHas('fingers_of_frost')), interruptsChannel: true },
        BLIZ(3),
      ]),
    },
    { label: 'Blizzard, FS on dot (FS below)', apply: mt('AoE', [BLIZ(3), FS_DOT(3)]) },
    { label: 'FS on dot, Blizzard (>=5), AE (>=3)', apply: mt('AoE', [FS_DOT(3), BLIZ(5), AE(3)]) },
  ],
  ffMtFinal: [
    control,
    { label: 'FS spam (>=3)', apply: mt('AoE', [FS(3)]) },
    { label: 'FS on dot (>=3), FS spam (>=5)', apply: mt('AoE', [FS_DOT(3), FS(5)]) },
    { label: 'FS on dot (>=3), Blizzard (>=3)', apply: mt('AoE', [FS_DOT(3), BLIZ(3)]) },
  ],
  arcMtFinal: [
    control,
    { label: 'PoM-FS stack (>=3), FS on dot, AE (>=3)', apply: pomStack(3, false, [FS_DOT(3), AE(3)]) },
    { label: 'PoM-FS stack (>=3), FS on dot, AE (>=5)', apply: pomStack(3, false, [FS_DOT(3), AE(5)]) },
    { label: 'PoM-FS stack copy (>=5), FS on dot, AE (>=5)', apply: pomStack(5, true, [FS_DOT(3), AE(5)]) },
    { label: 'PoM-FS stack copy (>=5), FS on dot, AE (>=3)', apply: pomStack(5, true, [FS_DOT(3), AE(3)]) },
    { label: 'no stack edit, FS on dot, AE (>=5)', apply: mt('AoE', [FS_DOT(3), AE(5)]) },
  ],
  frostMtFinal: [
    control,
    { label: 'FS on dot, Blizzard (>=3)', apply: mt('AoE', [FS_DOT(3), BLIZ(3)]) },
    { label: 'FS on dot (>=3), Blizzard (>=5)', apply: mt('AoE', [FS_DOT(3), BLIZ(5)]) },
    { label: 'FS on dot, Blizzard (>=4)', apply: mt('AoE', [FS_DOT(4), BLIZ(4)]) },
  ],
  ffApl: [
    control,
    { label: 'Fire Blast mana floor 10% -> 20%', apply: setCond('fire_blast', ffFireBlast(0.2)) },
    { label: 'Fire Blast mana floor 10% -> 35%', apply: setCond('fire_blast', ffFireBlast(0.35)) },
    { label: 'Fire Blast mana floor 10% -> 50%', apply: setCond('fire_blast', ffFireBlast(0.5)) },
    { label: 'Scorch window 3s -> 2s', apply: setCond('scorch', ffScorch(2)) },
    { label: 'Scorch window 3s -> 5s', apply: setCond('scorch', ffScorch(5)) },
  ],
  fireApl: [
    control,
    { label: 'Scorch window 5s -> 3s', apply: setCond('scorch', ffScorch(3)) },
    { label: 'Scorch window 5s -> 7s', apply: setCond('scorch', ffScorch(7)) },
    { label: 'Arcane Missiles (barrage) above Fire Blast', apply: moveAbove('arcane_missiles', 'fire_blast') },
  ],
  arcApl: [
    control,
    {
      label: 'capped Arcane Missiles needs 3s of Arcane Blast (was 2s)',
      apply: setCond('arcane_missiles', all(selfStacks('exactly', 4, 'arcane_blast'), selfTime('atLeast', 3, 'arcane_blast')), 1),
    },
    { label: 'Mana Ruby at 40% (was 25%)', apply: setCond('mana_ruby', resourceFraction('atMost', 0.4, 'mana')) },
  ],
  frostApl: [
    control,
    { label: 'Ice Lance (Fingers) above Cone of Cold', apply: moveAbove('ice_lance', 'cone_of_cold') },
    { label: 'Mana Ruby at 40% (was 25%)', apply: setCond('mana_ruby', resourceFraction('atMost', 0.4, 'mana')) },
  ],

  fireTalents: [
    control,
    { label: 'Burning Soul 2 -> Improved Flamestrike 2', apply: tree({ ...FIRE_SHIPPED, burning_soul: 0, improved_flamestrike: 2 }) },
  ],
  ffTalents: [
    control,
    { label: 'Frost Warding 2 -> Improved Blizzard 2', apply: tree({ ...FF_SHIPPED, frost_warding: 0, improved_blizzard: 2 }) },
  ],
};
