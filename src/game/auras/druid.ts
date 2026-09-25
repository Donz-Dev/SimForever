import type { AuraDefinition } from '../../engine';
import { dealDamage, flat, seconds } from '../../engine';
import {
  hybridSpellCoefficients,
  periodicTickCoefficient,
} from '../combat/spellCoefficient';

/**
 * Druid auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-druid-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * THREE SPECS AND THREE RESOURCES, which is what makes the Druid the widest
 * class in the project. Moonkin casts on mana, Cat builds combo points on
 * energy, Bear earns rage -- and all three already existed:
 *
 *   forms          `combatStyles.ts` has caster, moonkin, tree, bear and cat,
 *                  each with its own primary resource
 *   combo points   `game/combat/comboPoints.ts`, built for the Rogue
 *   bear rage      `RAGE_FROM_BEAR_PAW` in `resourceRules.ts`, which the
 *                  ruleset owner's rage formula names directly
 *
 * A FORM IS FIXED AT CREATION rather than shifted mid-fight, the same way a
 * Warrior's stance is. Each profile is one form, so nothing here needs to
 * model the shift; a Druid who weaved forms would.
 * ----------------------------------------------------------------------------
 */

const ARCANE = 'arcane' as const;
const NATURE = 'nature' as const;
const PHYSICAL = 'physical' as const;

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/**
 * Moonfire's bleed half: "an additional 240 Arcane damage over 12 sec".
 *
 * ARCANE, AND THEREFORE NOT REDUCED BY ARMOR -- which is true of every magical
 * school and not a special case. It still crits, at the crit chance of the
 * event that applied it: a spell, so spell crit.
 */
export const MOONFIRE_DOT_TOTAL = 240;
export const MOONFIRE_DOT_DURATION_MS = seconds(12);
export const MOONFIRE_TICK_INTERVAL_MS = seconds(3);

/**
 * Moonfire is a HYBRID: an instant hit plus a 12-second burn, sharing one
 * spell's scaling. Its pair is the cross-check for the whole normalisation --
 * it comes out at 0.15 and 0.52, which is exactly what Classic publishes for
 * this spell. See `hybridSpellCoefficients`.
 */
export const MOONFIRE_COEFFICIENTS = hybridSpellCoefficients(
  0,
  MOONFIRE_DOT_DURATION_MS,
  MOONFIRE_DOT_DURATION_MS / MOONFIRE_TICK_INTERVAL_MS,
);

export const MOONFIRE_DOT: AuraDefinition = {
  id: 'moonfire',
  name: 'Moonfire',
  durationMs: MOONFIRE_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: MOONFIRE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        MOONFIRE_DOT_TOTAL / (MOONFIRE_DOT_DURATION_MS / MOONFIRE_TICK_INTERVAL_MS),
        ARCANE,
        'spell',
        MOONFIRE_COEFFICIENTS.perTick,
      );
    },
  },
};

/**
 * Insect Swarm: "decreasing their chance to hit with attacks by 2% and causing
 * 186 Nature damage over 12 sec".
 *
 * THE HIT REDUCTION IS A DEFENSIVE EFFECT and does nothing on a target that
 * does not swing back, which every Balance profile faces. It is applied anyway,
 * as a negative `hitChance` on the target, so the day an encounter hits back it
 * works without anyone remembering.
 */
export const INSECT_SWARM_TOTAL = 186;
export const INSECT_SWARM_DURATION_MS = seconds(12);
export const INSECT_SWARM_TICK_INTERVAL_MS = seconds(2);
export const INSECT_SWARM_HIT_REDUCTION = 2;

/**
 * Insect Swarm is a PURE DoT -- the cast deals no damage of its own -- so it
 * takes the whole periodic coefficient rather than a share of one.
 */
export const INSECT_SWARM_TICK_COEFFICIENT = periodicTickCoefficient(
  INSECT_SWARM_DURATION_MS,
  INSECT_SWARM_DURATION_MS / INSECT_SWARM_TICK_INTERVAL_MS,
);

export const INSECT_SWARM: AuraDefinition = {
  id: 'insect_swarm',
  name: 'Insect Swarm',
  durationMs: INSECT_SWARM_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [flat('hitChance', -INSECT_SWARM_HIT_REDUCTION)],
  periodic: {
    intervalMs: INSECT_SWARM_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        INSECT_SWARM_TOTAL / (INSECT_SWARM_DURATION_MS / INSECT_SWARM_TICK_INTERVAL_MS),
        NATURE,
        'spell',
        INSECT_SWARM_TICK_COEFFICIENT,
      );
    },
  },
};

/**
 * Eclipse: "Your Wrath spell reduces the cast time of your next 2 Starfire
 * spells by 0.5 sec. Stores up to 4 charges. Lasts 15 sec."
 *
 * ----------------------------------------------------------------------------
 * LIVE NOW, AND IT WAS THE FIRST TALENT TO ASK FOR THE RULE. It spent the
 * Druid PR tracked and inert, and said so: cast time is resolved by the engine
 * before `onCast` runs, so unlike Cold Blood's crit -- which the Rogue solved
 * by having the five named abilities remove the aura themselves -- no amount
 * of content could reach it. `CastModifier` on the aura is the engine rule
 * that does, and Maelstrom Weapon on the Shaman wanted the same one.
 *
 * A CHARGE PER STARFIRE, NOT A MAGNITUDE PER STACK. `scalesWithStacks` is
 * deliberately off: four charges is four half-second Starfires, not one
 * two-second discount. Maelstrom Weapon is the other arrangement, and the two
 * are worth reading together.
 *
 * TWO CHARGES A WRATH, capped at four -- so a Moonkin alternating Wrath and
 * Starfire banks them faster than it spends them, and the cap is what stops
 * the filler paying for the whole fight. Granted as two applications rather
 * than by setting `stacks`, because `applyAura` already adds one and caps at
 * `maxStacks`; reaching in to set it would duplicate that rule and be the copy
 * that goes stale.
 *
 * THE HALF SECOND IS THE RANK 3 VALUE. Ranks 1 and 2 are 0.17 and 0.33, and
 * the aura is built from the rank rather than from a constant for that reason.
 * ----------------------------------------------------------------------------
 */
export const ECLIPSE_MAX_CHARGES = 4;
export const ECLIPSE_CHARGES_PER_WRATH = 2;
export const ECLIPSE_DURATION_MS = seconds(15);
/** The maximum rank, for the catalogue below. Ranks 1 and 2 are 0.17 and 0.33. */
export const ECLIPSE_RANK_3_SECONDS = 0.5;

export function eclipseAura(reductionSeconds: number): AuraDefinition {
  return {
    id: 'eclipse',
    name: 'Eclipse',
    durationMs: ECLIPSE_DURATION_MS,
    maxStacks: ECLIPSE_MAX_CHARGES,
    refreshBehaviour: 'reset',
    castModifier: {
      abilityIds: ['starfire'],
      castTimeReductionMs: seconds(reductionSeconds),
      consumedByCast: 'stack',
      /*
       * Starfire always has a cast time, so this changes nothing today. It is
       * set because the charge is FOR a cast: an instant Starfire from some
       * future effect must not silently eat one.
       */
      requiresCastTime: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Feral: Cat
// ---------------------------------------------------------------------------

/**
 * Rake's bleed: "61 damage and an additional 102 damage over 9 sec".
 *
 * Nine seconds at a three-second cadence is three ticks, which divides evenly
 * -- the reading that reproduces the stated total.
 */
export const RAKE_DOT_TOTAL = 102;
export const RAKE_DOT_DURATION_MS = seconds(9);
export const RAKE_TICK_INTERVAL_MS = seconds(3);

export const RAKE_DOT: AuraDefinition = {
  id: 'rake',
  name: 'Rake',
  durationMs: RAKE_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: RAKE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        RAKE_DOT_TOTAL / (RAKE_DOT_DURATION_MS / RAKE_TICK_INTERVAL_MS),
        PHYSICAL,
        'melee-special',
      );
    },
  },
};

/**
 * Rip, the Cat finisher: damage scaling with combo points over a FIXED twelve
 * seconds.
 *
 *     1 point  243        4 points  702
 *     2 points 396        5 points  855
 *     3 points 549
 *
 * THE DURATION DOES NOT SCALE, unlike the Rogue's Rupture, whose duration and
 * damage both did. Every step here is exactly 153 apart, which is the kind of
 * regularity that makes a transcription easy to check.
 */
export const RIP_DURATION_MS = seconds(12);
export const RIP_TICK_INTERVAL_MS = seconds(2);
export const RIP_BY_COMBO_POINT: readonly number[] = [243, 396, 549, 702, 855];

export function ripAura(comboPoints: number): AuraDefinition {
  const total = RIP_BY_COMBO_POINT[clampIndex(comboPoints)];
  const perTick = total / (RIP_DURATION_MS / RIP_TICK_INTERVAL_MS);

  return {
    id: 'rip',
    name: 'Rip',
    durationMs: RIP_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: RIP_TICK_INTERVAL_MS,
      onTick: (context, aura) => tick(context, aura, perTick, PHYSICAL, 'melee-special'),
    },
  };
}

/** "Increases Physical damage done by 15% for 6 sec." */
export const TIGERS_FURY_DAMAGE = 1.15;
export const TIGERS_FURY_DURATION_MS = seconds(6);

export const TIGERS_FURY: AuraDefinition = {
  id: 'tigers_fury',
  name: "Tiger's Fury",
  durationMs: TIGERS_FURY_DURATION_MS,
  damageDoneMultiplier: TIGERS_FURY_DAMAGE,
};

// ---------------------------------------------------------------------------
// Feral: Bear
// ---------------------------------------------------------------------------

/**
 * Lacerate: "75 damage over 15 sec plus 10% weapon damage per existing
 * application", stacking.
 *
 * THE STACKING HALF IS NOT MODELLED. `modifiersScaleWithStacks` scales a STAT
 * modifier by the stack count and there is no equivalent for a periodic tick,
 * so the bleed applies its flat total and the per-application weapon damage
 * does not. Stacks are still tracked, so the day a periodic can read them the
 * number is already there.
 */
export const LACERATE_TOTAL = 75;
export const LACERATE_DURATION_MS = seconds(15);
export const LACERATE_TICK_INTERVAL_MS = seconds(3);
export const LACERATE_MAX_STACKS = 5;

export const LACERATE: AuraDefinition = {
  id: 'lacerate',
  name: 'Lacerate',
  durationMs: LACERATE_DURATION_MS,
  isDebuff: true,
  maxStacks: LACERATE_MAX_STACKS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: LACERATE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        LACERATE_TOTAL / (LACERATE_DURATION_MS / LACERATE_TICK_INTERVAL_MS),
        PHYSICAL,
        'melee-special',
      );
    },
  },
};

export const LACERATE_UNMODELLED =
  'Its flat bleed applies. The "plus 10% weapon damage per existing ' +
  'application" does not: a periodic tick cannot read its own stack count, ' +
  'which is the one thing `modifiersScaleWithStacks` does for a stat and has ' +
  'no equivalent for.';

/** "Decreasing nearby enemies' melee attack power by 204. Lasts 30 sec." */
export const DEMORALIZING_ROAR_ATTACK_POWER = 204;
export const DEMORALIZING_ROAR_DURATION_MS = seconds(30);

export const DEMORALIZING_ROAR: AuraDefinition = {
  id: 'demoralizing_roar',
  name: 'Demoralizing Roar',
  durationMs: DEMORALIZING_ROAR_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [flat('attackPower', -DEMORALIZING_ROAR_ATTACK_POWER)],
};

/**
 * Maul: "increases the druid's next attack by 128 damage".
 *
 * ON THE NEXT SWING, exactly like the Warrior's Heroic Strike, which is why it
 * is an `onNextSwing` ability rather than an aura. Named here only so the
 * figure sits beside the rest.
 */
export const MAUL_BONUS_DAMAGE = 128;

// ---------------------------------------------------------------------------

function tick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  amount: number,
  school: typeof ARCANE | typeof NATURE | typeof PHYSICAL,
  critFrom: 'spell' | 'melee-special' = 'spell',
  powerCoefficient = 0,
): void {
  const source = context.combatant(aura.sourceId);
  const target = context.combatant(aura.targetId);
  if (!source || !target || !target.isAlive) return;

  dealDamage(context, {
    source,
    target,
    abilityId: aura.id,
    abilityName: aura.name,
    school,
    baseAmount: amount,
    /*
     * DEFAULTS TO NONE, AND THE BLEEDS KEEP THAT.
     *
     * Rake, Rip and Lacerate are PHYSICAL and say "increased by your Attack
     * Power" without stating a number, so none is invented -- the same
     * decision Rupture and Rend carry, and the spell coefficient rule does
     * not reach them because they are not spells.
     *
     * The two SPELL effects here, Moonfire's burn and Insect Swarm, are
     * passed one.
     */
    powerCoefficient,
    periodic: true,
    critFrom,
    // A bleed is physical and still ignores armor; a magical tick is not
    // reduced by armor in the first place.
    appliesArmor: false,
  });
}

function clampIndex(comboPoints: number): number {
  return Math.max(1, Math.min(5, Math.floor(comboPoints))) - 1;
}

export const DRUID_AURAS: readonly AuraDefinition[] = [
  MOONFIRE_DOT,
  INSECT_SWARM,
  // Eclipse is built from its rank, so the list carries the rank-3 shape --
  // this is a catalogue of the auras that exist, not a source of live ones.
  eclipseAura(ECLIPSE_RANK_3_SECONDS),
  RAKE_DOT,
  TIGERS_FURY,
  LACERATE,
  DEMORALIZING_ROAR,
];
