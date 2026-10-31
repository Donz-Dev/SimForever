import type { AplEntry } from '../../game/rotations/apl';
import {
  PALADIN_HOLY,
  PALADIN_PROTECTION,
  PALADIN_PROTRIBUTION,
  PALADIN_RETRIBUTION,
  PALADIN_SHOCKADIN,
} from '../../game/rotations/paladin';
import type { MultiTargetDefaults } from './types';

/**
 * The Paladin presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 *
 * ==============================================================================
 * CONSECRATION IS THE PALADIN'S ONLY AREA ABILITY, so every list here is its
 * Single Target list with Consecration moved up -- built FROM the stock list
 * rather than written out, so a change to the stock list reaches these too.
 * Measured paired over 400 fights (`tools/optimise/paladinVariants.ts`):
 *
 *                     3 targets/60s     5 targets/60s     8 targets/30s
 *   Seal Twist Ret    +13.91 +/- 12.29  +23.20 +/- 11.73  +42.29 +/- 16.53
 *   Shockadin         +4.55 +/- 7.38    +6.58 +/- 6.53    +38.59 +/- 9.94
 *   Shockadin 2H      +3.70 +/- 8.43    +6.81 +/- 7.45    +36.65 +/- 11.26
 *   Prot Pally (TPS)  -4.60 +/- 9.81    +10.75 +/- 10.47  +89.61 +/- 15.65
 *
 * THE PROT ROW AT 3 TARGETS IS NOISE, NOT A LOSS, so it is not gated on
 * `targetCount`; the gain grows with the count.
 *
 * HOLY PAL'S raid healer fight always runs this section. Its list is the
 * owner's with ONE addition, Divine Favor above the Holy Light line: the fight
 * is mana-bound and a guaranteed crit is an Illumination refund -- +8.40 HPS on
 * top of the Intellect enchants (+57.24 against +48.84 for those alone).
 * ==============================================================================
 */

const find = (entries: readonly AplEntry[], test: (e: AplEntry) => boolean, what: string) => {
  const at = entries.findIndex(test);
  if (at < 0) throw new Error(`Paladin Multi Target: no ${what}`);
  return at;
};

/** `entries` with `id` moved immediately above `aboveId`. */
const moveAbove = (entries: readonly AplEntry[], id: string, aboveId: string): AplEntry[] => {
  const moved = entries[find(entries, (e) => e.abilityId === id, id)];
  const rest = entries.filter((e) => e !== moved);
  const at = find(rest, (e) => e.abilityId === aboveId, aboveId);
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
};

/*
 * Consecration, Holy Strike, Judgement, then Hammer of Wrath -- the order that
 * was measured. The Single Target list puts Hammer of Wrath above Judgement
 * (round 78), and this list keeps it below, where it was priced.
 */
const RET_AOE = moveAbove(
  moveAbove(
    moveAbove(PALADIN_RETRIBUTION.entries, 'hammer_of_wrath', 'consecration'),
    'consecration',
    'judgement',
  ),
  'holy_strike',
  'judgement',
);

/*
 * ROUND 80: SPELLBLASTING AT THE PULL, which is the Multi Target half of the
 * potion pair. The Single Target lists hold it for the end of a 120 s fight
 * (or drink the mana potion); at 60 s and 30 s nobody runs dry, so the window
 * is worth most at once -- Seal Twist Ret +3.49 / +2.38 / +17.00 at 5 / 3 / 8
 * targets over 400 paired fights. The Shockadins were already drinking it at
 * the pull here and are unchanged.
 */
const spellblastingAtThePull = (entries: readonly AplEntry[]): AplEntry[] =>
  entries.map((e) =>
    e.abilityId === 'major_spellblasting_potion'
      ? { abilityId: e.abilityId, note: '40 spell power for 30s, at the pull: a 60 s or 30 s fight never runs dry.' }
      : e,
  );

const SHOCKADIN_AOE = moveAbove(
  moveAbove(PALADIN_SHOCKADIN.entries, 'consecration', 'judgement'),
  'holy_strike',
  'holy_shock',
);

/*
 * ROUND 80: THE OWNER'S OPENER PLUS CONSECRATION AT 0s, Multi Target only. It
 * is the pure-DoT row of Gate B -- it deals nothing when cast and its first
 * tick lands after the pull -- so the owner's Judgement stays the one damaging
 * action, and the ground effect is down for the first global cooldown of an
 * AoE fight instead of the second. Paired over 400 fights: shield build +4.78
 * / +3.43 / +12.91 at 5 / 3 / 8 targets, two-hander +5.89 / +4.51 / +13.51.
 * Single target it is +0.5 noise, so the Single Target opener is unchanged.
 */
const SHOCKADIN_AOE_PRECOMBAT = [
  { abilityId: 'seal_of_righteousness', secondsBefore: 1.5 },
  { abilityId: 'judgement', secondsBefore: 0 },
  { abilityId: 'consecration', secondsBefore: 0 },
] as const;

/*
 * ROUND 80: THE OWNER'S PROTECTION OPENER PLUS CONSECRATION AT 0s, Multi Target
 * only, with Spellblasting at the pull: +23.20 / +23.87 / +23.43 TPS at 5 / 3 /
 * 8 targets over 600 paired fights, deaths +0.11 / +0.05 / +0.06 (noise).
 * Spellblasting alone is +11.64 / +8.83 / +28.37.
 */
const PROTECTION_AOE_PRECOMBAT = [
  { abilityId: 'righteous_fury', secondsBefore: 4.5 },
  // Seal of Fury since round 90, as the Single Target opener.
  { abilityId: 'seal_of_fury', secondsBefore: 3 },
  { abilityId: 'holy_shield', secondsBefore: 1.5 },
  { abilityId: 'judgement', secondsBefore: 0 },
  { abilityId: 'consecration', secondsBefore: 0 },
] as const;

/** Straight after Holy Shield, above Templar's Bulwark and the heals. */
const PROTECTION_AOE = moveAbove(PALADIN_PROTECTION.entries, 'consecration', 'templars_bulwark');

const holyLight = find(
  PALADIN_HOLY.entries,
  (e) => e.abilityId === 'holy_light' && e.target?.kind === 'tank' && !e.cancel,
  "the tank's Holy Light",
);
/*
 * ROUND 80: THE RAID LIST LEAVES OUT TWO SINGLE TARGET ENTRIES -- Spellblasting
 * (this fight is mana-bound: -99.79 +/- 7.04 at the pull) and the tank fight's
 * mana-conserving Flash of Light (-6.76, noise, in this fight).
 */
const raidOnly = (e: AplEntry) =>
  e.abilityId !== 'major_spellblasting_potion' &&
  !(e.abilityId === 'flash_of_light' && e.condition?.kind === 'all');
const HOLY_RAID: AplEntry[] = [
  ...PALADIN_HOLY.entries.slice(0, holyLight).filter(raidOnly),
  { abilityId: 'divine_favor', note: 'Round 78: a guaranteed crit is an Illumination refund.' },
  ...PALADIN_HOLY.entries.slice(holyLight).filter(raidOnly),
];

export const PALADIN_MULTI_TARGET: MultiTargetDefaults = {
  pally_ret: { name: 'Paladin (Seal Twist Ret, AoE)', entries: spellblastingAtThePull(RET_AOE) },
  pally_shockadin_2h: {
    name: 'Paladin (Shockadin, AoE)',
    entries: spellblastingAtThePull(SHOCKADIN_AOE),
    precombat: SHOCKADIN_AOE_PRECOMBAT,
  },
  prot_pally: {
    name: 'Paladin (Protection, AoE)',
    entries: spellblastingAtThePull(PROTECTION_AOE),
    precombat: PROTECTION_AOE_PRECOMBAT,
  },
  // Protribution: Prot Pally's AoE list, with its own Hammer of Wrath above Judgement.
  protribution: {
    name: 'Paladin (Protribution, AoE)',
    entries: spellblastingAtThePull(
      moveAbove(PALADIN_PROTRIBUTION.entries, 'consecration', 'templars_bulwark'),
    ),
    precombat: PROTECTION_AOE_PRECOMBAT,
  },
  holy_pal: {
    name: 'Paladin (Holy, raid)',
    entries: HOLY_RAID,
    ...(PALADIN_HOLY.smartHealing ? { smartHealing: true } : {}),
  },
};
