import type { MultiTargetDefaults } from './types';
import type { AplEntry } from '../../game/rotations/apl';
import { selfStacks, targetExpired, targetHas, targetTime } from '../../game/rotations/apl';
import { RACIAL_COOLDOWNS } from '../../game/rotations/racialCooldowns';
import { SHAMAN_ELEMENTAL, SHAMAN_ENHANCEMENT, SHAMAN_RESTORATION } from '../../game/rotations/shaman';
import { MAELSTROM_WEAPON_MAX_STACKS } from '../../game/auras/shaman';

/** Everything a stock list holds above its first ability entry: consumables, racials, heals. */
const headOf = (entries: readonly AplEntry[], firstAbility: string): readonly AplEntry[] =>
  entries.slice(0, entries.findIndex((entry) => entry.abilityId === firstAbility));

/*
 * ==============================================================================
 * ELEMENTAL ON SEVERAL TARGETS (round 78). Measured at 5 targets / 60 s against
 * the Single Target list run on five targets, 400 paired fights: **+826.9 +/-
 * 6.1**, which more than doubles the build (773.8 -> ~1,600).
 *
 *   MAGMA TOTEM for Searing: one fire totem at a time, and Magma pulses every
 *   target -- 73 + 2.55% SP every 2 s for 40 s with Trial by Fire. Searing in
 *   its place is -306.
 *   FIRE NOVA on cooldown, above everything but the totem it needs: every
 *   target, a 6 s cooldown with Trial by Fire. Below Chain Lightning is -50.
 *   FLAME SHOCK, "if not active", MULTI-DOT 5: walked across the targets on
 *   the shock cooldown. +51 over one target, +6 over three.
 *   CHAIN LIGHTNING above Lava Burst and the bolt: three targets at x0.7 a jump,
 *   no cooldown under Elemental Mastery (pre-cast at the pull).
 *   LAVA BURST and LIGHTNING BOLT stay, as in the Single Target list.
 *
 * The opener is the Single Target one with Magma Totem in Searing Totem's place,
 * at a 0 s lead: a totem placed earlier only ages, since a pre-pull tick is never
 * delivered. Flame Shock at 0 s is the one damaging action (Gate B).
 * ==============================================================================
 */
const ELEMENTAL_AOE: readonly AplEntry[] = [
  ...headOf(SHAMAN_ELEMENTAL.entries, 'searing_totem'),
  // Refreshed with under 2 s left rather than on expiry: +5.06 +/- 3.84.
  { abilityId: 'magma_totem', condition: targetTime('below', 2, 'magma_totem') },
  { abilityId: 'fire_nova' },
  { abilityId: 'flame_shock', condition: targetExpired('flame_shock'), multiDot: 5 },
  ...RACIAL_COOLDOWNS,
  { abilityId: 'elemental_mastery' },
  { abilityId: 'chain_lightning' },
  { abilityId: 'lava_burst', condition: targetHas('flame_shock') },
  { abilityId: 'lightning_bolt' },
];

/*
 * ==============================================================================
 * ENHANCEMENT ON SEVERAL TARGETS (round 78). +305.1 +/- 9.6 at 5 targets / 60 s
 * over the Single Target list on five targets.
 *
 * The Single Target list with three changes: MAGMA TOTEM for Searing Totem,
 * FIRE NOVA from the bottom to just under it (on cooldown), and FLAME SHOCK
 * MULTI-DOT 5 -- which takes every shock charge at five targets, so the Earth
 * Shock entry reads zero there and stays for fewer targets.
 *
 * The owner's opener lines are kept whole -- Flametongue at 3 s, Searing Totem
 * at 1.5 s, Flame Shock at 0 s -- and Magma Totem is ADDED at 0 s, which takes
 * the Searing Totem down. Replacing the Searing line instead measured -0.3
 * (noise), so the owner's line costs nothing to keep.
 * ==============================================================================
 */
const ENHANCEMENT_AOE: readonly AplEntry[] = [
  ...headOf(SHAMAN_ENHANCEMENT.entries, 'stormstrike'),
  { abilityId: 'magma_totem', condition: targetExpired('magma_totem') },
  { abilityId: 'fire_nova' },
  { abilityId: 'stormstrike' },
  { abilityId: 'flame_shock', condition: targetExpired('flame_shock'), multiDot: 5 },
  { abilityId: 'rage_of_the_farseer' },
  { abilityId: 'earth_shock', condition: targetTime('atLeast', 3, 'flame_shock') },
  /*
   * CHAIN LIGHTNING, ungated, under everything but the Maelstrom bolt: at the
   * bottom it was +33.05 +/- 8.72 once the round's spell power enchants and
   * food were in (-10.11 before them), and above the bolt a further +12.10 at
   * 5 targets and +10.90 at 3 (-6.78 at 8 / 30 s, where the reuse rule says
   * the 5-target answer stands). A 2 s cast resets the swing timer, which is
   * why it sits below every instant.
   */
  { abilityId: 'chain_lightning' },
  {
    abilityId: 'lightning_bolt',
    condition: selfStacks('atLeast', MAELSTROM_WEAPON_MAX_STACKS, 'maelstrom_weapon'),
  },
];

/*
 * ==============================================================================
 * PISS BEAM IN THE RAID HEALER FIGHT (round 78), which always runs this section:
 * the Single Target list without MANA TIDE TOTEM and NATURE'S SWIFTNESS.
 * **+34.49 +/- 7.04 HPS** at 60 s over the Single Target list, with the change
 * below and the round's other Piss Beam changes in place.
 *
 * THE RAID FIGHT IS CAST-BOUND, NOT MANA-BOUND: the build ends 60 s with about
 * 5,000 mana unspent, so the totem's global cooldown is a Chain Heal's worth of
 * casting thrown away (+24.85 for it alone), and Nature's Swiftness gated on the
 * tank is spent on a heal it barely shortens (+5.50 more).
 * ==============================================================================
 */
/*
 * AND THE TANK LIST'S HEALING WAVE IS LEFT OUT TOO: with Chain Heal firing at one
 * injured it read 0.00 uses here, and without it the list measured +1.54 (noise).
 */
const RAID_DROPS: readonly string[] = ['mana_tide_totem', 'nature_s_swiftness', 'healing_wave'];

const RESTORATION_RAID: readonly AplEntry[] = SHAMAN_RESTORATION.entries
  .filter((entry) => !RAID_DROPS.includes(entry.abilityId))
  /*
   * AND CHAIN HEAL WHEN ONE OR MORE IN THE RIPTIDE TARGET'S PARTY IS UNDER 90%,
   * not two: +3.46 +/- 2.08 on top. It jumps only to the injured, so with one
   * hurt it is a 2.5 s single heal -- and the raid is rarely that whole.
   */
  .map((entry) =>
    entry.abilityId === 'chain_heal'
      ? {
          ...entry,
          condition: { kind: 'injuredCount', of: 'targetParty', below: 0.9, compare: 'atLeast', count: 1 },
          note: 'On the Riptide target, when 1 or more in its party is under 90% (round 78, raid list).',
        }
      : entry,
  );

/**
 * The Shaman presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 */
export const SHAMAN_MULTI_TARGET: MultiTargetDefaults = {
  shaman_elemental: {
    name: 'Shaman (Elemental, AoE)',
    entries: ELEMENTAL_AOE,
    precombat: [
      { abilityId: 'magma_totem', secondsBefore: 0 },
      { abilityId: 'elemental_mastery', secondsBefore: 0 },
      { abilityId: 'flame_shock', secondsBefore: 0 },
    ],
  },
  shaman_enhancement: {
    name: 'Shaman (Enhancement, AoE)',
    entries: ENHANCEMENT_AOE,
    precombat: [
      { abilityId: 'flametongue_weapon', secondsBefore: 3 },
      { abilityId: 'searing_totem', secondsBefore: 1.5 },
      { abilityId: 'magma_totem', secondsBefore: 0 },
      { abilityId: 'flame_shock', secondsBefore: 0 },
      { abilityId: 'rage_of_the_farseer', secondsBefore: 0 },
    ],
  },
  shaman_resto: {
    name: 'Shaman (Restoration, raid)',
    entries: RESTORATION_RAID,
  },
};
