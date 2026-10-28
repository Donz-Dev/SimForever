import { SPELLHANCE_MULTI } from '../ownerLists';
import type { MultiTargetDefaults } from './types';
import type { AplCondition, AplEntry } from '../../game/rotations/apl';
import { all, not, selfHas, selfStacks, targetCount, targetExpired, targetHas, targetTime } from '../../game/rotations/apl';
import { RACIAL_COOLDOWNS } from '../../game/rotations/racialCooldowns';
import { SHAMAN_ELEMENTAL, SHAMAN_ENHANCEMENT, SHAMAN_RESTORATION } from '../../game/rotations/shaman';
import { MAELSTROM_WEAPON_MAX_STACKS } from '../../game/auras/shaman';

/** Everything a stock list holds above its first ability entry: consumables, racials, heals. */
const headOf = (entries: readonly AplEntry[], firstAbility: string): readonly AplEntry[] =>
  entries.slice(0, entries.findIndex((entry) => entry.abilityId === firstAbility));

/*
 * THE SECONDARY POTION ON SEVERAL TARGETS (round 80). Both damage presets carry
 * the Major Mana Potion primary and Spellblasting secondary, sharing one
 * cooldown; the Single Target lists hold Spellblasting for the last 30 s. Here
 * the fight is short and the target count high, so the damage potion is worth
 * more at the pull. Paired, 400 fights a cell, against the mana potion alone:
 *
 *   Elemental     3 / 60 s  +2.89 +/- 4.05   5 / 60 s  +17.10 +/- 3.60   8 / 30 s  +51.21 +/- 0.26
 *   Enhancement   3 / 60 s  -11.99 +/- 5.11  4 / 60 s  -0.48 +/- 5.36   5 / 60 s  +11.52 +/- 4.74   8 / 30 s  +34.71 +/- 0.18
 *
 * So Elemental drinks it at the pull ungated, and Enhancement -- whose mana
 * still binds at three targets -- only from five targets up.
 */
const spellblastingAt = (entries: readonly AplEntry[], condition?: AplCondition): readonly AplEntry[] =>
  entries.map((entry) => {
    if (entry.abilityId !== 'major_spellblasting_potion') return entry;
    const { condition: _single, ...rest } = entry;
    return condition === undefined ? rest : { ...rest, condition };
  });

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
  ...spellblastingAt(headOf(SHAMAN_ELEMENTAL.entries, 'searing_totem')),
  // Refreshed with under 2 s left rather than on expiry: +5.06 +/- 3.84.
  { abilityId: 'magma_totem', condition: targetTime('below', 2, 'magma_totem') },
  { abilityId: 'fire_nova' },
  /*
   * NOT WHILE REVELATION IS UP (round 80). The main hand carries Revelation now,
   * and its guaranteed crit is spent by the next SPELL cast -- which on five
   * Flame Shock targets is mostly a Flame Shock, whose direct hit is the
   * smallest in the list. Holding the shock for one cast lets Chain Lightning
   * or Lava Burst take it: **+23.95 +/- 4.21** at 5 / 60 s, **+8.96** at 3,
   * **+35.33** at 8 (800 paired fights). Chain Lightning above Flame Shock as
   * well was +23.28, +10.80 and +25.04 -- the same at three and five, worse at
   * eight -- so the smaller edit ships.
   */
  {
    abilityId: 'flame_shock',
    condition: all(targetExpired('flame_shock'), not(selfHas('revelation'))),
    multiDot: 5,
  },
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
  ...spellblastingAt(headOf(SHAMAN_ENHANCEMENT.entries, 'stormstrike'), targetCount('atLeast', 5)),
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
   * AND CHAIN HEAL UNGATED ON THE RIPTIDE TARGET (round 80, was "1 or more in
   * its party under 90%", round 78): **+25.02 +/- 4.61 HPS** at 60 s, 800
   * paired fights. The party gate counts the Riptide target's own party, and
   * the bolt jumps to whoever is injured -- so a full party around the Riptide
   * target was refusing a heal that had somewhere to go. "1 injured under 100%"
   * is only +2.34, which is that reading. Ungated also beat Riptide on the
   * lowest whatever its health (+16.94), Nature's Swiftness on cooldown
   * (+7.07) and Mana Tide back in at 50% (+5.66); the raid fight is cast-bound.
   */
  .map((entry) => {
    if (entry.abilityId !== 'chain_heal') return entry;
    const { condition: _gate, ...rest } = entry;
    return { ...rest, note: 'On the Riptide target, ungated: it jumps to whoever is injured (round 80, raid list).' };
  });

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
  // The owner's saved build (round 82): its own Multi Target list, on the
  // Single Target opener, which is what the saved file carried in both.
  shaman_spellhance: {
    name: SPELLHANCE_MULTI.name,
    entries: SPELLHANCE_MULTI.entries,
  },
};
