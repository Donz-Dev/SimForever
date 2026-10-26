import type { AplEntry } from '../../game/rotations/apl';
import {
  PALADIN_HOLY,
  PALADIN_PROTECTION,
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

const RET_AOE = moveAbove(
  moveAbove(PALADIN_RETRIBUTION.entries, 'consecration', 'judgement'),
  'holy_strike',
  'judgement',
);

const SHOCKADIN_AOE = moveAbove(
  moveAbove(PALADIN_SHOCKADIN.entries, 'consecration', 'judgement'),
  'holy_strike',
  'holy_shock',
);

/** Straight after Holy Shield, above Templar's Bulwark and the heals. */
const PROTECTION_AOE = moveAbove(PALADIN_PROTECTION.entries, 'consecration', 'templars_bulwark');

const holyLight = find(
  PALADIN_HOLY.entries,
  (e) => e.abilityId === 'holy_light' && e.target?.kind === 'tank' && !e.cancel,
  "the tank's Holy Light",
);
const HOLY_RAID: AplEntry[] = [
  ...PALADIN_HOLY.entries.slice(0, holyLight),
  { abilityId: 'divine_favor', note: 'Round 78: a guaranteed crit is an Illumination refund.' },
  ...PALADIN_HOLY.entries.slice(holyLight),
];

export const PALADIN_MULTI_TARGET: MultiTargetDefaults = {
  pally_ret: { name: 'Paladin (Seal Twist Ret, AoE)', entries: RET_AOE },
  pally_shockadin: { name: 'Paladin (Shockadin, AoE)', entries: SHOCKADIN_AOE },
  pally_shockadin_2h: { name: 'Paladin (Shockadin, AoE)', entries: SHOCKADIN_AOE },
  prot_pally: { name: 'Paladin (Protection, AoE)', entries: PROTECTION_AOE },
  holy_pal: {
    name: 'Paladin (Holy, raid)',
    entries: HOLY_RAID,
    ...(PALADIN_HOLY.smartHealing ? { smartHealing: true } : {}),
  },
};
