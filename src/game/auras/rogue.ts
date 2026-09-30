import type { AuraDefinition } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';
import {
  DEADLY_POISON_TICK_AP_COEFFICIENT,
  RUPTURE_TICK_AP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Rogue auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-rogue-spellbook.json` by
 * `tools/import_forever_spells.mjs`, at MAX RANK only -- the rank a level 60
 * trains, which is the one thing this data set makes easy to get wrong.
 *
 * ----------------------------------------------------------------------------
 * EVERYTHING HERE SCALES WITH COMBO POINTS, which is what makes the Rogue
 * different in shape from the Warrior rather than only in numbers. A finisher
 * is not one effect with one magnitude; it is five, chosen by what the builder
 * phase produced. The source states all five, so none of them is interpolated.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Slice and Dice
// ---------------------------------------------------------------------------

/**
 * "Finishing move that increases melee attack speed by 30%. Lasts longer per
 * combo point: 9 / 12 / 15 / 18 / 21 seconds."
 *
 * THE MAGNITUDE DOES NOT SCALE AND THE DURATION DOES, which is the opposite of
 * Eviscerate and worth reading twice. Thirty percent at one combo point is the
 * same thirty percent as at five; what five buys is twenty-one seconds of it
 * instead of nine.
 *
 * Carried as HASTE RATING, because the engine's swing timer is divided by a
 * haste multiplier and "+30% attack speed" is exactly that multiplier. Derived
 * from the same constant `hasteMultiplierFrom` divides by, so the round trip
 * is exact rather than approximately 30%.
 */
export const SLICE_AND_DICE_ATTACK_SPEED = 0.3;
export const SLICE_AND_DICE_HASTE_RATING =
  SLICE_AND_DICE_ATTACK_SPEED * 100 * RATING_PER_PERCENT.haste;

/** Seconds at 1..5 combo points, from the source. Index 0 is one point. */
export const SLICE_AND_DICE_DURATIONS_MS: readonly number[] = [
  seconds(9),
  seconds(12),
  seconds(15),
  seconds(18),
  seconds(21),
];

export function sliceAndDiceAura(
  comboPoints: number,
  durationMultiplier = 1,
): AuraDefinition {
  return {
    id: 'slice_and_dice',
    name: 'Slice and Dice',
    // Rounded to a whole millisecond: time is integer milliseconds below the
    // UI, and a 45% bonus on nine seconds is not one.
    durationMs: Math.round(
      durationFor(SLICE_AND_DICE_DURATIONS_MS, comboPoints) * durationMultiplier,
    ),
    // Recasting replaces rather than extends: one buff, whatever its length.
    refreshBehaviour: 'reset',
    statModifiers: [flat('hasteRating', SLICE_AND_DICE_HASTE_RATING)],
  };
}

// ---------------------------------------------------------------------------
// Rupture
// ---------------------------------------------------------------------------

/**
 * "Finishing move that causes damage over time, increased by your Attack
 * Power. Lasts longer per combo point."
 *
 *     1 point : 159 damage over 8 secs      4 points: 377 over 14
 *     2 points: 222 over 10                 5 points: 469 over 16
 *     3 points: 295 over 12
 *
 * BOTH HALVES SCALE, unlike Slice and Dice. The total and the duration move
 * together, and the source states each pair, so the per-tick figure is
 * division rather than interpolation.
 *
 * TICKS EVERY TWO SECONDS, which every pair divides by exactly -- 8, 10, 12,
 * 14 and 16 are all even, and that is the reading that reproduces the stated
 * totals. A three-second cadence would leave a partial final tick on four of
 * the five.
 *
 * A BLEED: physical, and armor does NOT reduce it. That is the Forever rule
 * for every damage-over-time effect and it is not Classic's -- see CLAUDE.md.
 * It crits at the crit chance of the kind of event that applied it, which for
 * a finisher is a melee special.
 */
export const RUPTURE_TICK_INTERVAL_MS = seconds(2);

/** Total damage and duration at 1..5 combo points, from the source. */
export const RUPTURE_BY_COMBO_POINT: readonly { damage: number; durationMs: number }[] = [
  { damage: 159, durationMs: seconds(8) },
  { damage: 222, durationMs: seconds(10) },
  { damage: 295, durationMs: seconds(12) },
  { damage: 377, durationMs: seconds(14) },
  { damage: 469, durationMs: seconds(16) },
];

export function ruptureAura(comboPoints: number): AuraDefinition {
  const entry = RUPTURE_BY_COMBO_POINT[clampIndex(comboPoints)];
  const ticks = entry.durationMs / RUPTURE_TICK_INTERVAL_MS;
  const perTick = entry.damage / ticks;

  return {
    id: 'rupture',
    name: 'Rupture',
    durationMs: entry.durationMs,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: RUPTURE_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: 'physical',
          // The flat per-tick figure, which the coefficient adds to.
          baseAmount: perTick,
          /*
           * "Increased by your Attack Power" WITH NO STATED COEFFICIENT, so
           * none is invented. The flat total is real and the scaling is not
           * modelled; `RUPTURE_UNMODELLED` says so where it is cast.
           */
          /*
           * 3% OF ATTACK POWER PER TICK, flat across combo points.
           *
           * NOT PER COMBO POINT, unlike Eviscerate and Rip -- the sheet states
           * Rupture as a plain "3% per tick" where the other two read
           * "%*combo point spent". More points still buy more, by buying more
           * TICKS: the duration steps from eight seconds to sixteen.
           */
          powerCoefficient: RUPTURE_TICK_AP_COEFFICIENT,
          periodic: true,
          critFrom: 'melee-special',
          appliesArmor: false,
        });
      },
    },
  };
}

/** What Rupture does not do, printed beside it on the results page. */
export const RUPTURE_UNMODELLED =
  'The stated damage lands in full. Its "increased by your Attack Power" ' +
  'clause does NOT: the source gives no coefficient, so none is invented and ' +
  'a geared Rogue understates this bleed rather than guessing at it.';

// ---------------------------------------------------------------------------
// Expose Armor
// ---------------------------------------------------------------------------

/**
 * "Finishing move that exposes the target for 30 sec, reducing armor per combo
 * point: 450 / 900 / 1,350 / 1,800 / 2,250."
 *
 * EXACTLY SUNDER ARMOR'S FIVE STACKS, in one cast, and they do not stack with
 * each other -- a raid carries one or the other. Five points is 2,250, which
 * is the same number the Warrior's five Sunders produce.
 *
 * Applied as ONE aura with the whole reduction rather than as stacks, because
 * the source states a single total per cast and nothing about it accumulates.
 */
export const EXPOSE_ARMOR_DURATION_MS = seconds(30);
export const EXPOSE_ARMOR_PER_COMBO_POINT = 450;

export function exposeArmorAura(comboPoints: number): AuraDefinition {
  const armor = EXPOSE_ARMOR_PER_COMBO_POINT * clamp(comboPoints);
  return {
    id: 'expose_armor',
    name: 'Expose Armor',
    durationMs: EXPOSE_ARMOR_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    statModifiers: [flat('armor', -armor)],
  };
}

// ---------------------------------------------------------------------------
// Cooldowns and states
// ---------------------------------------------------------------------------

/**
 * "Increases your Energy regeneration rate by 100% for 15 sec."
 *
 * NOT MODELLED AS A STAT, because energy regeneration is a fixed batch on a
 * timer -- twenty every two seconds -- and nothing reads a multiplier on it.
 * The aura is applied so its uptime is visible and so a talent can find it;
 * what it does is nothing, and `ADRENALINE_RUSH_UNMODELLED` says so.
 */
export const ADRENALINE_RUSH_DURATION_MS = seconds(15);

export const ADRENALINE_RUSH: AuraDefinition = {
  id: 'adrenaline_rush',
  name: 'Adrenaline Rush',
  durationMs: ADRENALINE_RUSH_DURATION_MS,
};

export const ADRENALINE_RUSH_UNMODELLED =
  'Doubles energy regeneration, and the engine has no multiplier on it: ' +
  'energy arrives as a fixed batch on a timer. Cast at full cost for no ' +
  'extra energy. Needs a rate multiplier on ResourceRegen.';

/**
 * "Increases your melee attack speed by 20% and your melee attacks strike an
 * additional nearby opponent. Lasts 15 sec."
 *
 * THE HASTE IS REAL AND THE CLEAVE IS NOT, and only because every encounter
 * here has one enemy. The second target is not a missing number; it is a
 * missing opponent.
 */
export const BLADE_FLURRY_ATTACK_SPEED = 0.2;
export const BLADE_FLURRY_DURATION_MS = seconds(15);

export const BLADE_FLURRY: AuraDefinition = {
  id: 'blade_flurry',
  name: 'Blade Flurry',
  durationMs: BLADE_FLURRY_DURATION_MS,
  statModifiers: [
    flat('hasteRating', BLADE_FLURRY_ATTACK_SPEED * 100 * RATING_PER_PERCENT.haste),
  ],
};

export const BLADE_FLURRY_UNMODELLED =
  'The 20% attack speed applies. Striking an additional nearby opponent does ' +
  'not, because every encounter here has exactly one enemy -- a missing ' +
  'opponent rather than a missing number.';

/**
 * "Increases the critical strike chance of your next Sinister Strike,
 * Backstab, Ambush, Eviscerate, or Mutilate by 100%."
 *
 * ONE ABILITY, THEN GONE. `consumedBySwing` is the wrong hook -- it is spent
 * by the next qualifying CAST rather than the next swing -- so the abilities
 * that qualify remove it themselves. Listing them here keeps the five names in
 * one place instead of five.
 */
export const COLD_BLOOD_CRIT_BONUS = 100;

export const COLD_BLOOD: AuraDefinition = {
  id: 'cold_blood',
  name: 'Cold Blood',
  // Until it is spent. Nothing in the source expires it.
  durationMs: seconds(3600),
  statModifiers: [flat('critChance', COLD_BLOOD_CRIT_BONUS)],
};

/** The five abilities Cold Blood applies to, by id. */
export const COLD_BLOOD_ABILITIES: ReadonlySet<string> = new Set([
  'sinister_strike',
  'backstab',
  'ambush',
  'eviscerate',
  'mutilate',
]);

/**
 * Ghostly Strike's dodge, which is defensive and therefore inert on a target
 * that does not swing back.
 */
export const GHOSTLY_STRIKE_DODGE = 15;
export const GHOSTLY_STRIKE_DURATION_MS = seconds(7);

export const GHOSTLY_STRIKE_DODGE_AURA: AuraDefinition = {
  id: 'ghostly_strike_dodge',
  name: 'Ghostly Strike',
  durationMs: GHOSTLY_STRIKE_DURATION_MS,
  statModifiers: [flat('dodgeChance', GHOSTLY_STRIKE_DODGE)],
};

/**
 * Hemorrhage's debuff: "causes the target to take 15% increased Rupture damage
 * from the Rogue. Lasts 15 sec."
 *
 * NOT MODELLED. `damageTakenMultiplier` is per school and this is per ABILITY
 * on the target, which the engine has no form for -- `AbilityModifiers` lives
 * on the attacker. A target-side per-ability multiplier is the engine change
 * it would need, and it is wanted by more than this one debuff.
 */
export const HEMORRHAGE_RUPTURE_BONUS = 15;
export const HEMORRHAGE_DURATION_MS = seconds(15);

export const HEMORRHAGE_DEBUFF: AuraDefinition = {
  id: 'hemorrhage',
  name: 'Hemorrhage',
  durationMs: HEMORRHAGE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
};

export const HEMORRHAGE_UNMODELLED =
  'The strike lands in full. Its "+15% Rupture damage taken" does not: the ' +
  'engine has damage-taken multipliers per SCHOOL, and this is per ABILITY on ' +
  'the target, which has no form yet.';

// ---------------------------------------------------------------------------

/** 1..5 combo points, clamped, as an index into a five-entry table. */
function clampIndex(comboPoints: number): number {
  return clamp(comboPoints) - 1;
}

function clamp(comboPoints: number): number {
  return Math.max(1, Math.min(5, Math.floor(comboPoints)));
}

function durationFor(table: readonly number[], comboPoints: number): number {
  return table[clampIndex(comboPoints)];
}

export const ROGUE_AURAS: readonly AuraDefinition[] = [
  ADRENALINE_RUSH,
  BLADE_FLURRY,
  COLD_BLOOD,
  GHOSTLY_STRIKE_DODGE_AURA,
  HEMORRHAGE_DEBUFF,
];

// ---------------------------------------------------------------------------
// Poisons
// ---------------------------------------------------------------------------

/*
 * ============================================================================
 * DEADLY POISON, the stacking half of the poison system.
 *
 * "Each strike has a 30% chance of poisoning the enemy for 92 Nature damage
 * over 12 sec. Stacks up to 5 times on a single target." -- rank 6, and the
 * capture marks it `versusClassic: "changed"`, so Classic's figures would be
 * the wrong ones.
 *
 * THE RULESET OWNER'S READING OF THE STACK, given when asked: 92 x 5 = 460
 * damage over twelve seconds at full stacks, ticking every three seconds for
 * 115 -- so a stack is 23 a tick and the tooltip's 92 is ONE stack's whole
 * duration. The alternative reading, where 92 is the total and stacks only
 * refresh it, is five times smaller and equally consistent with the wording.
 * ============================================================================
 */

export const DEADLY_POISON_DAMAGE_PER_STACK = 92;
export const DEADLY_POISON_MAX_STACKS = 5;
export const DEADLY_POISON_DURATION_MS = seconds(12);
export const DEADLY_POISON_TICK_INTERVAL_MS = seconds(3);

/** Four ticks in twelve seconds, so one stack is 23 of the tooltip's 92. */
export const DEADLY_POISON_TICKS =
  DEADLY_POISON_DURATION_MS / DEADLY_POISON_TICK_INTERVAL_MS;

/**
 * Deadly Poison, at whatever damage bonus the character's talents give.
 *
 * `damageMultiplier` is Vile Poisons, which is a per-character number and
 * therefore cannot live on a shared aura constant -- the same reason Rupture
 * is a function of its combo points rather than five exported auras.
 */
export function deadlyPoisonAura(damageMultiplier = 1): AuraDefinition {
  const perStackPerTick = (DEADLY_POISON_DAMAGE_PER_STACK / DEADLY_POISON_TICKS) * damageMultiplier;

  return {
    id: 'deadly_poison',
    name: 'Deadly Poison',
    durationMs: DEADLY_POISON_DURATION_MS,
    isDebuff: true,
    maxStacks: DEADLY_POISON_MAX_STACKS,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: DEADLY_POISON_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: 'nature',
          /*
           * PER STACK, read off the aura at tick time rather than baked in
           * when it was applied -- a sixth strike lands while the first tick
           * is still pending, and the tick must pay at the stack count it
           * actually finds.
           */
          baseAmount: perStackPerTick * aura.stacks,
          /*
           * THE COEFFICIENT IS FLAT PER TICK AND NOT PER STACK, which is the
           * owner's own phrasing: a full-stack tick is "115 damage + 0.45% of
           * attack power". 115 is the five-stack figure and the 0.45% is
           * stated beside it once.
           */
          powerCoefficient: DEADLY_POISON_TICK_AP_COEFFICIENT,
          periodic: true,
          /*
           * MELEE CRIT, because a melee strike applied it. That is the
           * standing `critFrom` rule, and Malice settles which table: "your
           * critical strike chance with all attacks AND POISONS", granted as
           * `critChance`, which is the melee stat.
           */
          critFrom: 'melee-special',
        });
      },
    },
  };
}

/*
 * ============================================================================
 * VENOM: a finisher whose whole effect is on poisons.
 *
 * "Finishing move that increases the damage of your Poisons by 30% and your
 * chance to apply Poisons by 10%." 25 energy, instant, 9 to 21 seconds by
 * combo points -- the SAME five durations Slice and Dice uses, which is why
 * `SLICE_AND_DICE_DURATIONS_MS` is shared rather than transcribed twice.
 *
 * A FOREVER ADDITION. The capture marks it `versusClassic: "new"`, so there is
 * no Classic behaviour to fall back on and nothing to cross-check it against.
 *
 * ----------------------------------------------------------------------------
 * IT STACKS ADDITIVELY WITH THE POISON TALENTS, on the ruleset owner's ruling.
 * With Vile Poisons at 5/5 a poison deals 1 + 0.20 + 0.30 = 1.5x, NOT
 * 1.2 x 1.3 = 1.56x; and with Improved Poisons the apply chance gains twenty
 * percentage points rather than ten of each applied in turn.
 *
 * Both readings produce a plausible number four points apart, which is exactly
 * the shape this project writes a test for -- and it is the same additive rule
 * `resolveCast` already uses for two cost reductions on one ability.
 * ----------------------------------------------------------------------------
 */

/** Added to the poison multiplier, not multiplied into it. */
export const VENOM_POISON_DAMAGE_BONUS = 0.3;

/** Added to the apply chance in percentage POINTS: 20% becomes 30%. */
export const VENOM_POISON_CHANCE_BONUS = 0.1;

export const VENOM_AURA_ID = 'venom';

export function venomAura(comboPoints: number): AuraDefinition {
  return {
    id: VENOM_AURA_ID,
    name: 'Venom',
    durationMs: durationFor(SLICE_AND_DICE_DURATIONS_MS, comboPoints),
    // Recasting replaces rather than extends, as every finisher buff here does.
    refreshBehaviour: 'reset',
  };
}
