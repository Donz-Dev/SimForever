import type { AplCondition, AplEntry } from '../../game/rotations/apl';
import {
  all,
  fightRemaining,
  resource,
  resourceFraction,
  selfHas,
  targetCount,
  targetMissing,
  targetTime,
} from '../../game/rotations/apl';
import { buffPotionCooldown, consumableCooldown } from '../../game/rotations/consumableCooldowns';
import { WARLOCK_SBOLT, SBOLT_DEMONIC_RUNE_MANA } from '../../game/rotations/warlock';
import type { MultiTargetDefaults } from './types';

/**
 * ==============================================================================
 * THE WARLOCK PRESETS' MULTI TARGET LISTS (round 78), keyed by preset id.
 * Measured at 5 targets for 60s and checked at 3 targets/60s and 8 targets/30s
 * with `tools/optimise/warlockVariants.ts` (the `wl*Aoe` groups), 400 paired
 * fights a cell, each figure against the preset's Single Target list run on
 * the same targets.
 *
 * HELLFIRE IS WHAT EVERY ONE OF THEM IS BUILT AROUND. 210 a tick plus 2.2% of
 * spell power to EVERY enemy for fifteen seconds, its self-damage healed back
 * by the group, so at five targets it is several Single Target rotations at
 * once. Rain of Fire loses to it everywhere -- a quarter of the damage a
 * second for nearly the same mana -- and loses to the Single Target list at
 * three targets on the Firelock (-461).
 *
 * WHAT IS GATED ON THE TARGET COUNT IS WHAT THE THREE ENCOUNTERS DISAGREED
 * ABOUT, and nothing else: each list's single-target work earns its global
 * cooldowns at three targets and costs Hellfire uptime at five or eight.
 *
 * LIFE TAP BELOW 1300 MANA, WHICH IS HELLFIRE'S COST, so the tap comes the
 * moment the next channel is unaffordable rather than at a fraction of the
 * pool. Tapping below 2000 ran bit-identical fights on the Firelock.
 * ==============================================================================
 */

/** At most this many targets, the single-target work is still worth its GCDs. */
const FEW = targetCount('atMost', 4);
/** Up to this many, a DoT is worth walking across every target. */
const UP_TO_FIVE = targetCount('atMost', 5);

const when = (gate: AplCondition, entry: AplEntry): AplEntry => ({
  ...entry,
  condition: entry.condition ? all(gate, entry.condition) : gate,
});

/** "Not up on this target, and at least `floor` seconds of fight left", over N targets. */
const dot = (abilityId: string, targets: number, floor: number): AplEntry => ({
  abilityId,
  condition: all(targetMissing(abilityId), fightRemaining('atLeast', floor)),
  ...(targets > 1 ? { multiDot: targets } : {}),
});

const HELLFIRE: AplEntry = { abilityId: 'hellfire' };
const TAP_FOR_HELLFIRE: AplEntry = { abilityId: 'life_tap', condition: resource('below', 1300, 'mana') };
const SHADOW_TRANCE: AplEntry = { abilityId: 'shadow_bolt', condition: selfHas('shadow_trance') };
/** The Single Target lists' Immolate: a 1.5s window and a 3s fight floor. */
const IMMOLATE: AplEntry = {
  abilityId: 'immolate',
  condition: all(targetTime('atMost', 1.5, 'immolate'), fightRemaining('atLeast', 3)),
};

export const WARLOCK_MULTI_TARGET: MultiTargetDefaults = {
  /*
   * SM/DS: Bane of Agony and Corruption walked across five targets, then
   * Hellfire. +940 at 5 targets, +468 at 3, +1380 at 8. ABOVE FIVE TARGETS
   * THE DoTs GO ON THE BOSS ONLY -- in a 30 second fight with eight, spreading
   * them cost 42 against Hellfire time. Siphon Life spread as well measured
   * -15. Wrack is the filler under a Hellfire that is castable whenever the
   * tap has paid for it, so it rarely fires.
   */
  warlock_smds: {
    name: 'SM/DS AoE',
    entries: [
      { abilityId: 'amplify_curse' },
      buffPotionCooldown('major_spellblasting_potion'),
      consumableCooldown('demonic_rune'),
      SHADOW_TRANCE,
      when(UP_TO_FIVE, dot('bane_of_agony', 5, 12)),
      when(UP_TO_FIVE, dot('corruption', 5, 10)),
      dot('bane_of_agony', 1, 12),
      dot('corruption', 1, 10),
      TAP_FOR_HELLFIRE,
      HELLFIRE,
      { abilityId: 'wrack' },
    ],
  },
  /*
   * FIRELOCK: Shadowburn on cooldown, because Shadow and Flame makes each one
   * +10% FIRE damage for twenty seconds and Hellfire is Fire; then Hellfire.
   * Immolate, Conflagrate and Bane of Agony on the boss only at four targets
   * or fewer. +713 at 5, +160 at 3, +1620 at 8; Bane of Havoc at 0s in this
   * section's opener -- a curse with no damage, so free of Gate B -- adds +48
   * at 5 and +9 at 3.
   */
  warlock_firelock: {
    name: 'Firelock AoE',
    entries: [
      { abilityId: 'bane_of_havoc', condition: targetCount('atLeast', 2) },
      { abilityId: 'shadowburn' },
      when(FEW, IMMOLATE),
      when(FEW, { abilityId: 'conflagrate' }),
      when(FEW, dot('bane_of_agony', 1, 25)),
      consumableCooldown('major_mana_potion'),
      consumableCooldown('demonic_rune'),
      TAP_FOR_HELLFIRE,
      HELLFIRE,
      { abilityId: 'incinerate' },
    ],
    precombat: [
      { abilityId: 'incinerate', secondsBefore: 2 },
      { abilityId: 'bane_of_agony', secondsBefore: 0 },
      { abilityId: 'bane_of_havoc', secondsBefore: 0 },
    ],
  },
  /*
   * SBOLT SPAM: the owner's opening stack kept whole, then the Affliction
   * shape -- Corruption and Bane of Agony across five targets, on the boss
   * only above that -- and Hellfire. +602 at 5, +196 at 3, +1181 at 8.
   */
  warlock_sbolt: {
    name: 'Sbolt Spam AoE',
    entries: [
      WARLOCK_SBOLT.entries[0],
      SHADOW_TRANCE,
      when(UP_TO_FIVE, dot('corruption', 5, 10)),
      when(UP_TO_FIVE, dot('bane_of_agony', 5, 12)),
      dot('corruption', 1, 10),
      dot('bane_of_agony', 1, 12),
      { abilityId: 'demonic_rune', condition: resourceFraction('below', SBOLT_DEMONIC_RUNE_MANA, 'mana') },
      TAP_FOR_HELLFIRE,
      HELLFIRE,
      { abilityId: 'shadow_bolt' },
    ],
  },
  /*
   * FIRE DEMO: Soul Fire under Decimation, Immolate on every target at four
   * targets or fewer, then Hellfire, with the Imp on the boss throughout.
   * +793 at 5, +253 at 3, +1792 at 8. Corruption spread as well lost 77 at 3.
   */
  warlock_demonology: {
    name: 'Fire Demo AoE',
    entries: [
      { abilityId: 'soul_fire', condition: selfHas('decimation') },
      when(FEW, { ...IMMOLATE, multiDot: 5 }),
      consumableCooldown('major_mana_potion'),
      consumableCooldown('demonic_rune'),
      TAP_FOR_HELLFIRE,
      HELLFIRE,
      { abilityId: 'searing_pain' },
    ],
  },
};
