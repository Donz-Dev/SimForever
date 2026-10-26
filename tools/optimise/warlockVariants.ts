/*
 * ============================================================================
 * ROUND 78: THE FOUR WARLOCK PRESETS, optimised for the full report's
 * encounters -- 1 target for 120s (Single Target section) and 5 targets for
 * 60s (Multi Target section, reused at 3/60s and 8/30s).
 *
 *   PRESET=warlock_firelock FILE=tools/optimise/warlockVariants.ts \
 *     VARIANTS=wlFlApl DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=warlock_firelock FILE=tools/optimise/warlockVariants.ts \
 *     VARIANTS=wlFlAoe TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE THEME (Step 0). These may not move, on any of the four:
 *
 *   class               Warlock
 *   majority tree       SM/DS Affliction 35/11/5; Firelock Destruction 7/11/33;
 *                       Sbolt Spam Affliction 22/11/18; Fire Demo Demonology
 *                       2/31/18 -- each stays the majority
 *   style               caster, the E65 template; only `enchantId` may change
 *   demons              SM/DS Imp sacrificed, Firelock and Sbolt sacrificed
 *                       with none out, Fire Demo Succubus sacrificed + Imp out
 *   target swings back  no, on all four
 *
 * EVERY GROUP CARRIES ITS OWN CONTROL, labelled "the shipped X": `(p) => p`
 * is whatever the preset ships at the moment the group is run.
 *
 * OWNER LINES. All four Single Target lists are the owner's; Sbolt Spam's two
 * mana gates are theirs by name. A variant that rewrites an owner line's
 * CONDITION is labelled "QUESTION ONLY" and is priced, never shipped. The Life
 * Tap gates on SM/DS, Firelock and Fire Demo are this project's sweeps under
 * the owner's ruling that a tap is "based on the warlock's current mana", so
 * their THRESHOLDS are tunable.
 *
 * THE BUILDS AS READ (Step 1), probe_clock at 120s, 40 fights:
 *
 *   SM/DS     764.5  Wrack 22.0 casts, Bane 5.5, Corruption 7.0, SB 4.4;
 *                    2.0 taps, 10.0% mana headroom (30.1% at 60s)
 *   Firelock  860.8  Incinerate 33.0, Conflagrate 10.5, Shadowburn 7.9;
 *                    11.0 taps, 18.1% headroom -- Life Tap-fed, GCD-bound
 *   Sbolt     834.1  Shadow Bolt 35.9, Corruption 6.9, Bane 5.2; 12.5 taps,
 *                    4.0% headroom -- the one genuinely mana-bound build
 *   Fire Demo 1016.4 Searing Pain 47.0, Imp Firebolt 50.8, Soul Fire 6.3;
 *                    9.0 taps, 16.5% headroom
 *
 * Hit sits exactly on the 17% spell cap on all four, so no Suppression point
 * can move. `triggersGcd`: Amplify Curse is the Warlock's one cooldown-shaped
 * ability and is already off it.
 *
 * WHAT SHIPPED (round 78), and every group's figure, is in
 * `docs/handoff/warlock.md`. Group names carry a `wl` prefix because the
 * older `firelockVariants.ts` / `demoVariants.ts` registered `flApl` etc.
 * first, and the built-in registry wins a name collision with `FILE=`.
 * ============================================================================
 */
import {
  type Variant,
  type Apply,
  WARLOCK_TREE as tree,
  apl,
  addAbove,
  addEntry,
  chain,
  consumable,
  multiList,
  addPrecombat,
  inMulti,
  enchant,
} from '../buildVariants';
import { foreverEnchantId } from '../../src/game/items/foreverEnchants';
import {
  all,
  fightRemaining,
  resource,
  resourceFraction,
  selfHas,
  targetCount,
  targetMissing,
  targetTime,
  not,
  targetHas,
} from '../../src/game/rotations/apl/shorthand';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import { RACIAL_COOLDOWNS } from '../../src/game/rotations/racialCooldowns';
import {
  buffPotionCooldown,
  consumableCooldowns,
  CONSUMABLE_HEALS,
} from '../../src/game/rotations/consumableCooldowns';
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

const lifeTapBelow = (fraction: number) => regate('life_tap', resourceFraction('below', fraction, 'mana'));

const race =
  (r: string): Apply =>
  (p: CharacterProfile) => ({ ...p, character: { ...p.character, race: r as CharacterProfile['character']['race'] } });

const stone =
  (s: string): Apply =>
  (p: CharacterProfile) => ({ ...p, warlockStone: s as CharacterProfile['warlockStone'] });

const RACES = (shipped: string): Variant[] =>
  ['human', 'gnome', 'orc', 'undead', 'troll']
    .filter((r) => r !== shipped)
    .map((r) => ({ label: `race ${shipped} -> ${r}`, apply: race(r) }));

const tapFloor = (fraction: number, seconds: number) =>
  regate('life_tap', all(resourceFraction('below', fraction, 'mana'), fightRemaining('atLeast', seconds)));

const HELLFIRE: AplEntry = { abilityId: 'hellfire' };
const tapForHellfire = (mana = 1300): AplEntry => ({ abilityId: 'life_tap', condition: resource('below', mana, 'mana') });

/* ============================================================ SM/DS */

const SMDS_BASE: Record<string, number> = {
  suppression: 4,
  amplify_curse: 1,
  improved_corruption: 5,
  improved_drains: 3,
  improved_bane_of_agony: 2,
  pandemic: 3,
  malevolence: 5,
  nightfall: 2,
  siphon_life: 1,
  soul_siphon: 3,
  shadow_mastery: 5,
  wrack: 1,
  bane: 5,
  demonic_embrace: 5,
  demonic_aegis: 2,
  fel_vitality: 3,
  demonic_sacrifice: 1,
};
const smdsTree = (changes: Record<string, number>) => {
  const out: Record<string, number> = { ...SMDS_BASE, ...changes };
  for (const [k, v] of Object.entries(out)) if (v === 0) delete out[k];
  return tree(out);
};

const SMDS_TALENTS: Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  // Bane only shortens a CAST Shadow Bolt, and SM/DS casts almost none: the
  // filler is under an ungated Wrack and the rest are Nightfall instants.
  { label: 'Bane 5 -> Improved Shadow Bolt 5', apply: smdsTree({ bane: 0, improved_shadow_bolt: 5 }) },
  { label: 'Bane 5 -> Improved Life Tap 2 + Bane 3', apply: smdsTree({ bane: 3, improved_life_tap: 2 }) },
  {
    label: 'Bane 5 -> Improved Life Tap 2 + Improved Shadow Bolt 3',
    apply: smdsTree({ bane: 0, improved_life_tap: 2, improved_shadow_bolt: 3 }),
  },
];

const SMDS_APL: Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'Life Tap below 15% (written out)', apply: lifeTapBelow(0.15) },
  { label: 'Life Tap below 5%', apply: lifeTapBelow(0.05) },
  { label: 'Life Tap below 10%', apply: lifeTapBelow(0.1) },
  { label: 'Life Tap below 25%', apply: lifeTapBelow(0.25) },
  { label: 'Life Tap below 15%, fight floor 10s', apply: tapFloor(0.15, 10) },
  {
    label: '+ Siphon Life interrupts Wrack',
    apply: apl((es) => es.map((e) => (e.abilityId === 'siphon_life' ? { ...e, interruptsChannel: true } : e))),
  },
  {
    label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain',
    apply: chain(
      regate('bane_of_agony', all(targetMissing('bane_of_agony'), targetMissing('bane_of_doom'))),
      addAbove(
        {
          abilityId: 'bane_of_doom',
          condition: all(targetMissing('bane_of_doom'), fightRemaining('atLeast', 61)),
        },
        'bane_of_agony',
      ),
    ),
  },
];

const SMDS_CONSUMABLES: Variant[] = [
  { label: 'the shipped consumables -- the control', apply: (p) => p },
  { label: 'potion -> Spellblasting (written out)', apply: consumable('potion', 'major_spellblasting_potion') },
  { label: 'potion: Spellblasting -> Major Mana Potion', apply: consumable('potion', 'major_mana_potion') },
  { label: 'other: Demonic Rune -> Healthstone', apply: consumable('other', 'healthstone') },
  {
    label: 'potion Mana + other Healthstone',
    apply: chain(consumable('potion', 'major_mana_potion'), consumable('other', 'healthstone')),
  },
];

const SMDS_STONE: Variant[] = [
  { label: 'the shipped stone -- the control', apply: (p) => p },
  { label: 'stone -> Firestone', apply: stone('firestone') },
  { label: 'stone -> none', apply: stone('none') },
];

/* ============================================================ Firelock */

const FL_TALENTS: Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  // Cataclysm's 3 hold Shadow and Flame's tier; Intensity is the only other
  // home and is cast pushback, a permanent ruling -- so this prices Cataclysm.
  {
    label: 'Cataclysm 3 -> Intensity 3 (prices Cataclysm)',
    apply: tree({
      improved_life_tap: 2,
      suppression: 5,
      demonic_embrace: 5,
      demonic_aegis: 2,
      fel_vitality: 3,
      demonic_sacrifice: 1,
      bane: 5,
      intensity: 3,
      aftermath: 5,
      ruin: 5,
      shadowburn: 1,
      agonizing_flames: 3,
      conflagrate: 1,
      bane_of_havoc: 1,
      fire_and_brimstone: 3,
      shadow_and_flame: 5,
      incinerate: 1,
    }),
  },
];

const FL_APL: Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'Life Tap below 5% (written out)', apply: lifeTapBelow(0.05) },
  { label: 'Life Tap below 3%', apply: lifeTapBelow(0.03) },
  { label: 'Life Tap below 8%', apply: lifeTapBelow(0.08) },
  { label: 'Life Tap below 12%', apply: lifeTapBelow(0.12) },
  { label: 'Life Tap below 20%', apply: lifeTapBelow(0.2) },
  { label: 'Life Tap below 5%, fight floor 6s', apply: tapFloor(0.05, 6) },
  { label: 'Life Tap below 5%, fight floor 12s', apply: tapFloor(0.05, 12) },
  {
    label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain',
    apply: chain(
      regate(
        'bane_of_agony',
        all(targetMissing('bane_of_agony'), targetMissing('bane_of_doom'), fightRemaining('atLeast', 25)),
      ),
      addAbove(
        {
          abilityId: 'bane_of_doom',
          condition: all(targetMissing('bane_of_doom'), fightRemaining('atLeast', 61)),
        },
        'bane_of_agony',
      ),
    ),
  },
];

const FL_CONSUMABLES: Variant[] = [
  { label: 'the shipped consumables -- the control', apply: (p) => p },
  { label: 'potion -> Spellblasting (written out)', apply: consumable('potion', 'major_spellblasting_potion') },
  { label: 'potion: Spellblasting -> Major Mana Potion', apply: consumable('potion', 'major_mana_potion') },
  { label: 'other: Demonic Rune -> Healthstone', apply: consumable('other', 'healthstone') },
];

const FL_STONE: Variant[] = [
  { label: 'the shipped stone -- the control', apply: (p) => p },
  { label: 'stone -> Spellstone', apply: stone('spellstone') },
  { label: 'stone -> none', apply: stone('none') },
];

/* ============================================================ Sbolt Spam */

const SB_TALENTS: Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  // Improved Voidwalker does nothing with no demon out; Fel Vitality is +15%
  // maximum mana on a build that ends a 120s fight with 4% headroom.
  {
    label: 'Improved Voidwalker 3 -> Fel Vitality 3',
    apply: tree({
      suppression: 5,
      improved_corruption: 5,
      improved_bane_of_agony: 2,
      amplify_curse: 1,
      pandemic: 3,
      malevolence: 4,
      nightfall: 2,
      demonic_embrace: 5,
      demonic_aegis: 2,
      fel_vitality: 3,
      demonic_sacrifice: 1,
      improved_shadow_bolt: 5,
      bane: 5,
      ruin: 5,
      agonizing_flames: 3,
    }),
  },
];

const SB_APL: Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  // The owner's sequence needs Amplify Curse (3 min), so it fires once; a
  // second Spellblasting comes back at 2 min and nothing drinks it.
  {
    label: '+ standalone Spellblasting Potion after the sequence',
    apply: apl((es) => {
      const at = es.findIndex((e) => e.sequence !== undefined);
      es.splice(at + 1, 0, buffPotionCooldown('major_spellblasting_potion'));
      return es;
    }),
  },
  {
    label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain',
    apply: chain(
      regate('bane_of_agony', all(targetMissing('bane_of_agony'), targetMissing('bane_of_doom'))),
      addAbove(
        {
          abilityId: 'bane_of_doom',
          condition: all(targetMissing('bane_of_doom'), fightRemaining('atLeast', 61)),
        },
        'bane_of_agony',
      ),
    ),
  },
];

const SB_CONSUMABLES: Variant[] = [
  { label: 'the shipped consumables -- the control', apply: (p) => p },
  { label: 'QUESTION ONLY: school Fire -> Shadow', apply: consumable('school_spell_power', 'school_shadow') },
  { label: 'other: Demonic Rune -> Healthstone', apply: consumable('other', 'healthstone') },
];

const SB_STONE: Variant[] = [
  { label: 'the shipped stone -- the control', apply: (p) => p },
  { label: 'QUESTION ONLY: stone -> Spellstone', apply: stone('spellstone') },
  { label: 'stone -> none', apply: stone('none') },
];

/* ============================================================ Fire Demo */

const DEMO_TALENTS: Variant[] = [
  { label: 'the shipped tree -- the control', apply: (p) => p },
  {
    label: 'Aftermath 5 -> Cataclysm 3 + Aftermath 2',
    apply: tree({
      suppression: 2,
      unholy_power: 5,
      improved_imp: 3,
      demonic_embrace: 4,
      fel_vitality: 3,
      demonic_sacrifice: 1,
      demonic_brand: 3,
      decimation: 2,
      soul_link: 1,
      demonic_knowledge: 3,
      master_demonologist: 5,
      demonic_pact: 1,
      bane: 5,
      cataclysm: 3,
      aftermath: 2,
      ruin: 5,
      agonizing_flames: 3,
    }),
  },
];

const DEMO_APL: Variant[] = [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'Life Tap below 5% (written out)', apply: lifeTapBelow(0.05) },
  { label: 'Life Tap below 3%', apply: lifeTapBelow(0.03) },
  { label: 'Life Tap below 10%', apply: lifeTapBelow(0.1) },
  { label: 'Life Tap below 15%', apply: lifeTapBelow(0.15) },
  { label: 'Life Tap below 5%, fight floor 8s', apply: tapFloor(0.05, 8) },
  {
    label: 'no Corruption (the project added it, round 41)',
    apply: apl((es) => es.filter((e) => e.abilityId !== 'corruption')),
  },
  {
    label: 'QUESTION ONLY: Bane of Doom above Bane of Agony while 61s+ remain',
    apply: chain(
      regate(
        'bane_of_agony',
        all(targetMissing('bane_of_agony'), targetMissing('bane_of_doom'), fightRemaining('atLeast', 25)),
      ),
      addAbove(
        {
          abilityId: 'bane_of_doom',
          condition: all(targetMissing('bane_of_doom'), fightRemaining('atLeast', 61)),
        },
        'bane_of_agony',
      ),
    ),
  },
];

const DEMO_CONSUMABLES: Variant[] = [
  { label: 'the shipped consumables -- the control', apply: (p) => p },
  { label: 'potion -> Spellblasting (written out)', apply: consumable('potion', 'major_spellblasting_potion') },
  { label: 'potion: Spellblasting -> Major Mana Potion', apply: consumable('potion', 'major_mana_potion') },
  { label: 'other: Demonic Rune -> Healthstone', apply: consumable('other', 'healthstone') },
];

const DEMO_STONE: Variant[] = [
  { label: 'the shipped stone -- the control', apply: (p) => p },
  { label: 'stone -> Spellstone', apply: stone('spellstone') },
  { label: 'stone -> none', apply: stone('none') },
];

/* ============================================================ Multi Target */

const POTION = buffPotionCooldown('major_spellblasting_potion');
const OTHER_CONSUMABLES = [...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }), ...CONSUMABLE_HEALS];
const HAVOC: AplEntry = { abilityId: 'bane_of_havoc', condition: targetCount('atLeast', 2) };

/* -- Firelock -- */
const dot = (id: string, n: number, floor = 0): AplEntry => ({
  abilityId: id,
  condition: floor > 0 ? all(targetMissing(id), fightRemaining('atLeast', floor)) : targetMissing(id),
  ...(n > 1 ? { multiDot: n } : {}),
});
const FL_IMMOLATE: AplEntry = {
  abilityId: 'immolate',
  condition: all(targetTime('atMost', 1.5, 'immolate'), fightRemaining('atLeast', 3)),
};
const FL_PREFIX: AplEntry[] = [POTION, ...RACIAL_COOLDOWNS, HAVOC];

const FEW = targetCount('atMost', 4);
const gate = (entry: AplEntry): AplEntry => ({
  ...entry,
  condition: entry.condition ? all(FEW, entry.condition) : FEW,
});
export const FL_AOE_GATED: AplEntry[] = [
  ...FL_PREFIX,
  { abilityId: 'shadowburn' },
  gate(FL_IMMOLATE),
  gate({ abilityId: 'conflagrate' }),
  gate(dot('bane_of_agony', 1, 25)),
  ...OTHER_CONSUMABLES,
  tapForHellfire(),
  HELLFIRE,
  { abilityId: 'incinerate' },
];

const FL_AOE: Variant[] = [
  { label: 'the shipped Multi Target section -- the control', apply: (p) => p },
  {
    label: 'Hellfire only (+ Havoc, tap below 1300)',
    apply: multiList('Firelock AoE', [...FL_PREFIX, ...OTHER_CONSUMABLES, tapForHellfire(), HELLFIRE, { abilityId: 'incinerate' }]),
  },
  {
    label: 'Immolate + Conflagrate on the boss, then Hellfire',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      FL_IMMOLATE,
      { abilityId: 'conflagrate' },
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Shadowburn + Immolate + Conflagrate, then Hellfire',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      { abilityId: 'shadowburn' },
      FL_IMMOLATE,
      { abilityId: 'conflagrate' },
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Shadowburn; Immolate + Conflagrate + Bane (boss) only below 5 targets; Hellfire',
    apply: multiList('Firelock AoE', FL_AOE_GATED),
  },
  {
    label: 'Shadowburn, then Hellfire',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      { abilityId: 'shadowburn' },
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Shadowburn + Immolate + Conflagrate + Bane of Agony (boss), then Hellfire',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      { abilityId: 'shadowburn' },
      FL_IMMOLATE,
      { abilityId: 'conflagrate' },
      dot('bane_of_agony', 1, 25),
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Shadowburn + Immolate + Conflagrate, then Hellfire, tap below 2000',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      { abilityId: 'shadowburn' },
      FL_IMMOLATE,
      { abilityId: 'conflagrate' },
      ...OTHER_CONSUMABLES,
      tapForHellfire(2000),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Immolate on 5 (multi-DoT) + Conflagrate, then Hellfire',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      { ...FL_IMMOLATE, multiDot: 5 },
      { abilityId: 'conflagrate' },
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'incinerate' },
    ]),
  },
  {
    label: 'Rain of Fire only (+ Havoc, tap below 1185)',
    apply: multiList('Firelock AoE', [
      ...FL_PREFIX,
      ...OTHER_CONSUMABLES,
      tapForHellfire(1185),
      { abilityId: 'rain_of_fire' },
      { abilityId: 'incinerate' },
    ]),
  },
];

/* -- SM/DS -- */
const SM_PREFIX: AplEntry[] = [{ abilityId: 'amplify_curse' }, ...RACIAL_COOLDOWNS, POTION, ...OTHER_CONSUMABLES];
const SM_TRANCE: AplEntry = { abilityId: 'shadow_bolt', condition: selfHas('shadow_trance') };

const UP_TO_FIVE = targetCount('atMost', 5);
const upTo5 = (entry: AplEntry): AplEntry => ({
  ...entry,
  condition: entry.condition ? all(UP_TO_FIVE, entry.condition) : UP_TO_FIVE,
});
export const SMDS_AOE_GATED: AplEntry[] = [
  ...SM_PREFIX,
  SM_TRANCE,
  upTo5(dot('bane_of_agony', 5, 12)),
  upTo5(dot('corruption', 5, 10)),
  dot('bane_of_agony', 1, 12),
  dot('corruption', 1, 10),
  tapForHellfire(),
  HELLFIRE,
  { abilityId: 'wrack' },
];

const SM_AOE: Variant[] = [
  { label: 'the shipped Multi Target section -- the control', apply: (p) => p },
  {
    label: 'Hellfire only (tap below 1300)',
    apply: multiList('SM/DS AoE', [...SM_PREFIX, tapForHellfire(), HELLFIRE, { abilityId: 'wrack' }]),
  },
  {
    label: 'Corruption + Bane on the boss, then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 1),
      dot('corruption', 1),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Corruption on 5, Bane on the boss, then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 1),
      dot('corruption', 5, 10),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Corruption + Bane on 5, then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 5, 12),
      dot('corruption', 5, 10),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Corruption + Bane on 5 up to 5 targets, on the boss above that; Hellfire',
    apply: multiList('SM/DS AoE', SMDS_AOE_GATED),
  },
  {
    label: 'Corruption + Bane on 5 with full-duration floors (18s/24s), then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 5, 24),
      dot('corruption', 5, 18),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Bane + Corruption on the boss; on 5 with floors 18s/24s; then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 1),
      dot('corruption', 1),
      dot('bane_of_agony', 5, 24),
      dot('corruption', 5, 18),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Corruption + Bane on 5, Hellfire only at 4+ targets, Wrack below',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 5, 12),
      dot('corruption', 5, 10),
      tapForHellfire(),
      { abilityId: 'hellfire', condition: targetCount('atLeast', 4) },
      { abilityId: 'life_tap', condition: resourceFraction('below', 0.15, 'mana') },
      { abilityId: 'wrack' },
    ]),
  },
  {
    label: 'Corruption + Bane + Siphon on 5, then Hellfire',
    apply: multiList('SM/DS AoE', [
      ...SM_PREFIX,
      SM_TRANCE,
      dot('bane_of_agony', 5, 12),
      dot('corruption', 5, 10),
      dot('siphon_life', 5, 12),
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'wrack' },
    ]),
  },
];

/* -- Sbolt Spam -- */
const SB_PREFIX = (p: CharacterProfile): AplEntry[] => {
  const seq = p.rotation.entries.find((e) => e.sequence !== undefined);
  if (!seq) throw new Error('no sequence');
  return [seq, ...RACIAL_COOLDOWNS.filter((e) => e.abilityId !== 'blood_fury')];
};
const SB_RUNE: AplEntry = { abilityId: 'demonic_rune', condition: resourceFraction('below', 0.15, 'mana') };
const sbList =
  (label: string, body: AplEntry[]): Apply =>
  (p) =>
    multiList(label, [...SB_PREFIX(p), ...body])(p);

export const SB_AOE_GATED_BODY: AplEntry[] = [
  SM_TRANCE,
  upTo5(dot('corruption', 5, 10)),
  upTo5(dot('bane_of_agony', 5, 12)),
  dot('corruption', 1, 10),
  dot('bane_of_agony', 1, 12),
  SB_RUNE,
  tapForHellfire(),
  HELLFIRE,
  { abilityId: 'shadow_bolt' },
];

const SB_AOE: Variant[] = [
  { label: 'the shipped Multi Target section -- the control', apply: (p) => p },
  {
    label: 'Hellfire only (tap below 1300)',
    apply: sbList('Sbolt Spam AoE', [SB_RUNE, tapForHellfire(), HELLFIRE, { abilityId: 'shadow_bolt' }]),
  },
  {
    label: 'Corruption + Bane on the boss, then Hellfire',
    apply: sbList('Sbolt Spam AoE', [
      SM_TRANCE,
      dot('corruption', 1),
      dot('bane_of_agony', 1),
      SB_RUNE,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'shadow_bolt' },
    ]),
  },
  {
    label: 'Corruption on 5, Bane on the boss, then Hellfire',
    apply: sbList('Sbolt Spam AoE', [
      SM_TRANCE,
      dot('corruption', 5, 10),
      dot('bane_of_agony', 1),
      SB_RUNE,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'shadow_bolt' },
    ]),
  },
  {
    label: 'Corruption + Bane on 5 up to 5 targets, on the boss above that; Hellfire',
    apply: sbList('Sbolt Spam AoE', SB_AOE_GATED_BODY),
  },
  {
    label: 'Corruption + Bane on 5, then Hellfire',
    apply: sbList('Sbolt Spam AoE', [
      SM_TRANCE,
      dot('corruption', 5, 10),
      dot('bane_of_agony', 5, 12),
      SB_RUNE,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'shadow_bolt' },
    ]),
  },
];

/* -- Fire Demo -- */
const DM_PREFIX: AplEntry[] = [POTION, ...RACIAL_COOLDOWNS];
const DM_SOUL_FIRE: AplEntry = { abilityId: 'soul_fire', condition: selfHas('decimation') };
export const DEMO_AOE_GATED: AplEntry[] = [
  ...DM_PREFIX,
  DM_SOUL_FIRE,
  gate({ ...FL_IMMOLATE, multiDot: 5 }),
  ...OTHER_CONSUMABLES,
  tapForHellfire(),
  HELLFIRE,
  { abilityId: 'searing_pain' },
];
const DM_AOE: Variant[] = [
  { label: 'the shipped Multi Target section -- the control', apply: (p) => p },
  {
    label: 'Hellfire only (tap below 1300)',
    apply: multiList('Fire Demo AoE', [...DM_PREFIX, DM_SOUL_FIRE, ...OTHER_CONSUMABLES, tapForHellfire(), HELLFIRE, { abilityId: 'searing_pain' }]),
  },
  {
    label: 'Immolate on every target below 5 targets, then Hellfire',
    apply: multiList('Fire Demo AoE', DEMO_AOE_GATED),
  },
  {
    label: 'Immolate + Corruption on every target below 5 targets, then Hellfire',
    apply: multiList('Fire Demo AoE', [
      ...DM_PREFIX,
      DM_SOUL_FIRE,
      gate({ ...FL_IMMOLATE, multiDot: 5 }),
      gate(dot('corruption', 5, 10)),
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'searing_pain' },
    ]),
  },
  {
    label: 'Immolate on the boss, then Hellfire',
    apply: multiList('Fire Demo AoE', [
      ...DM_PREFIX,
      DM_SOUL_FIRE,
      FL_IMMOLATE,
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'searing_pain' },
    ]),
  },
  {
    label: 'Immolate on 5, then Hellfire',
    apply: multiList('Fire Demo AoE', [
      ...DM_PREFIX,
      DM_SOUL_FIRE,
      { ...FL_IMMOLATE, multiDot: 5 },
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'searing_pain' },
    ]),
  },
  {
    label: 'Immolate + Bane + Corruption on the boss, then Hellfire',
    apply: multiList('Fire Demo AoE', [
      ...DM_PREFIX,
      DM_SOUL_FIRE,
      FL_IMMOLATE,
      dot('bane_of_agony', 1, 25),
      dot('corruption', 1, 19),
      ...OTHER_CONSUMABLES,
      tapForHellfire(),
      HELLFIRE,
      { abilityId: 'searing_pain' },
    ]),
  },
];

/* ============================================================ registry */

export const VARIANT_GROUPS: Record<string, Variant[]> = {
  wlSmdsTalents: SMDS_TALENTS,
  wlSmdsApl: SMDS_APL,
  wlSmdsConsumables: SMDS_CONSUMABLES,
  wlSmdsStone: SMDS_STONE,
  wlSmdsRace: [{ label: 'the shipped race -- the control', apply: (p) => p }, ...RACES('undead')],
  wlSmdsAoe: SM_AOE,
  wlFlTalents: FL_TALENTS,
  wlFlApl: FL_APL,
  wlFlConsumables: FL_CONSUMABLES,
  wlFlStone: FL_STONE,
  wlFlRace: [{ label: 'the shipped race -- the control', apply: (p) => p }, ...RACES('undead')],
  wlFlAoe: FL_AOE,
  wlSbTalents: SB_TALENTS,
  wlSbApl: SB_APL,
  wlSbConsumables: SB_CONSUMABLES,
  wlSbStone: SB_STONE,
  wlSbRace: [{ label: 'the shipped race -- the control', apply: (p) => p }, ...RACES('orc')],
  wlSbAoe: SB_AOE,
  wlDemoTalents: DEMO_TALENTS,
  wlDemoApl: DEMO_APL,
  wlDemoConsumables: DEMO_CONSUMABLES,
  wlDemoStone: DEMO_STONE,
  wlDemoRace: [{ label: 'the shipped race -- the control', apply: (p) => p }, ...RACES('undead')],
  wlDemoAoe: DM_AOE,
};

// Imported for variants that may be added in later passes.
void addEntry;
void not;
void targetHas;

/* ============================================================ Combined */

const smdsMt = multiList('SM/DS AoE', SMDS_AOE_GATED);
const smdsIsb = smdsTree({ bane: 0, improved_shadow_bolt: 5 });
const flMt = multiList('Firelock AoE', FL_AOE_GATED);
const dmMt = multiList('Fire Demo AoE', DEMO_AOE_GATED);
const manaPot = consumable('potion', 'major_mana_potion');

VARIANT_GROUPS.wlSmdsCombined = [
  { label: 'the shipped preset -- the control', apply: (p) => p },
  { label: 'MT list', apply: smdsMt },
  { label: 'MT + ISB 5', apply: chain(smdsMt, smdsIsb) },
  { label: 'MT + ISB 5 + tap 5%', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.05)) },
  { label: 'MT + ISB 5 + tap 3%', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.03)) },
  { label: 'MT + ISB 5 + tap 7%', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.07)) },
  { label: 'MT + ISB 5 + tap 5% + mana potion', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.05), manaPot) },
  { label: 'MT + ISB 5 + tap 5% + human', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.05), race('human')) },
  { label: 'MT + ISB 5 + tap 5% + orc', apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.05), race('orc')) },
  {
    label: 'MT + ISB 5 + tap 5% + mana potion + human',
    apply: chain(smdsMt, smdsIsb, lifeTapBelow(0.05), manaPot, race('human')),
  },
];

VARIANT_GROUPS.wlFlCombined = [
  { label: 'the shipped preset -- the control', apply: (p) => p },
  { label: 'MT list', apply: flMt },
  { label: 'MT + mana potion', apply: chain(flMt, manaPot) },
  { label: 'MT + human', apply: chain(flMt, race('human')) },
  { label: 'MT + gnome', apply: chain(flMt, race('gnome')) },
  { label: 'MT + orc', apply: chain(flMt, race('orc')) },
  { label: 'MT + mana potion + human', apply: chain(flMt, manaPot, race('human')) },
  { label: 'MT + mana potion + gnome', apply: chain(flMt, manaPot, race('gnome')) },
];

VARIANT_GROUPS.wlDemoCombined = [
  { label: 'the shipped preset -- the control', apply: (p) => p },
  { label: 'MT list', apply: dmMt },
  { label: 'MT + mana potion', apply: chain(dmMt, manaPot) },
  { label: 'MT + human', apply: chain(dmMt, race('human')) },
  { label: 'MT + gnome', apply: chain(dmMt, race('gnome')) },
  { label: 'MT + mana potion + human', apply: chain(dmMt, manaPot, race('human')) },
  { label: 'MT + mana potion + gnome', apply: chain(dmMt, manaPot, race('gnome')) },
  { label: 'MT + mana potion + human + tap 10%', apply: chain(dmMt, manaPot, race('human'), lifeTapBelow(0.1)) },
];

/* ============================================================ Pre-combat */

/*
 * GATE B: each opener keeps the owner's one damaging cast as the pull; every
 * addition is a pure DoT, a curse or an off-GCD buff at a 0s lead, which the
 * gate's table makes legal -- the first tick is after the pull.
 */
const smdsBase = chain(smdsMt, smdsIsb, lifeTapBelow(0.05), race('human'));
VARIANT_GROUPS.wlSmdsPrecombat = [
  { label: 'the round-78 build, shipped opener -- the control', apply: smdsBase },
  { label: '+ Corruption at 0s', apply: chain(addPrecombat(0, 'corruption'), smdsBase) },
  { label: '+ Amplify Curse, Bane of Agony at 0s', apply: chain(addPrecombat(0, 'amplify_curse', 'bane_of_agony'), smdsBase) },
  {
    label: '+ Amplify Curse, Bane of Agony, Corruption at 0s',
    apply: chain(addPrecombat(0, 'amplify_curse', 'bane_of_agony', 'corruption'), smdsBase),
  },
  {
    label: '+ Amplify Curse, Bane of Agony, Corruption, Siphon Life at 0s',
    apply: chain(addPrecombat(0, 'amplify_curse', 'bane_of_agony', 'corruption', 'siphon_life'), smdsBase),
  },
];
VARIANT_GROUPS.wlSbPrecombat = [
  { label: 'the shipped opener -- the control', apply: (p) => p },
  { label: '+ Corruption at 0s', apply: addPrecombat(0, 'corruption') },
];
const flBase = chain(flMt, manaPot, race('human'));
VARIANT_GROUPS.wlFlPrecombat = [
  { label: 'the round-78 build, shipped opener -- the control', apply: flBase },
  {
    label: 'MT opener + Bane of Havoc at 0s',
    apply: chain(flBase, inMulti(addPrecombat(0, 'bane_of_havoc'))),
  },
];

/* ============================================================ Enchants */

/*
 * EVERY OTHER SLOT IS SETTLED BY ARITHMETIC (stat_weights, DURATION=120): the
 * gloves, wrists and neck offer spell power or nothing a Warlock reads, and on
 * head and legs +1% Haste (3.2 to 6.7 DPS a point) beats +8 Intellect (1.5 to
 * 2.7) and +8 Spirit (0.1 to 1.4) on all four. Revelation is a proc, so it is
 * the one that needs a fight; +8 Intellect is fought as the arithmetic's check.
 */
VARIANT_GROUPS.wlEnchants = [
  { label: 'the shipped enchants -- the control', apply: (p) => p },
  { label: 'staff: +65 Spell Power -> Revelation', apply: enchant('twoHand', foreverEnchantId('Revelation')) },
  { label: 'head: +1% Haste -> +8 Intellect', apply: enchant('head', foreverEnchantId('+8 Intellect')) },
];
