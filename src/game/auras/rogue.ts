import type { AuraDefinition } from '../../engine';
import { poisedAura } from './poised';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';
import {
  DEADLY_POISON_TICK_AP_COEFFICIENT,
  ruptureTickApCoefficient,
  GARROTE_TICK_AP_COEFFICIENT,
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
/*
 * ============================================================================
 * STEALTH, AND IT IS A GATE ON AMBUSH AND NOTHING ELSE.
 *
 * Being stealthed is out of scope and stays out: there is no detection, no
 * movement, and nothing in this engine has a position for any of it to matter
 * to. What the ruleset owner has ruled IN is the one consequence that changes a
 * damage profile -- "we don't need stealth to properly function, it just needs
 * to enable Ambush."
 *
 * SO THIS IS THE SAME SHAPE CUTTHROAT HAD, and deliberately the same id-as-gate
 * pattern: an aura Ambush reads in `canCast`. Two routes to the same gate, one
 * from the pull or a Vanish and -- since 1.60.1.70755, in Cutthroat's place --
 * one from Ghostly Strike, which is why Ambush checks for EITHER rather than
 * being given a second condition.
 *
 * ----------------------------------------------------------------------------
 * AND THE SECOND THING RULED IN IS THAT IT **ENDS**, WHICH THIS NOTE USED TO
 * SAY IT DID NOT. It read "there is no break-on-damage", true on the day and
 * since answered: "Almost every completed cast or attack breaks stealth/prowl,
 * and for the purposes of this simulation the only thing that doesn't is a
 * rogue's premeditation." `brokenByAction` below is that, and it is the whole
 * of it -- taking damage still does nothing, because nothing attacks a Rogue
 * here, so the rule is about the Rogue's OWN actions and not about the fight's.
 *
 * IT IS STILL NOT A STEALTH SYSTEM. There is one aura with one gate and one
 * way to lose it; what changed is that losing it is now the engine's rule
 * rather than a line inside Ambush.
 *
 * ----------------------------------------------------------------------------
 * ONE DURATION FOR BOTH ROUTES, AND THE SOURCE ONLY STATES IT FOR VANISH.
 * "Entering an improved stealth mode for 10 sec" is Vanish's own line. Plain
 * Stealth at the pull has no stated duration at all -- it lasts until something
 * breaks it, and what breaks it is now `brokenByAction` above.
 *
 * The opener reuses Vanish's ten seconds rather than being given an invented
 * number or an unbounded one, and THE CHOICE IS LESS LOAD-BEARING THAN IT WAS
 * RATHER THAN MORE: the duration was only ever reached by a window nothing
 * spent, and the owner's rule means the FIRST action takes it -- a cast or a
 * swing, well inside ten seconds on every build. It is named once so there is a
 * single place to change if the owner states a figure for plain Stealth.
 * ----------------------------------------------------------------------------
 * ============================================================================
 */
export const STEALTH_DURATION_MS = seconds(10);

export const STEALTH: AuraDefinition = {
  /*
   * ANY COMPLETED CAST OR ATTACK ENDS IT, which is the owner's general rule and
   * replaces Ambush removing this by hand: "almost every completed cast or
   * attack breaks stealth/prowl, and for the purposes of this simulation the
   * only thing that doesn't is a rogue's premeditation." See
   * `AuraDefinition.brokenByAction`.
   */
  brokenByAction: true,
  id: 'stealth',
  name: 'Stealth',
  durationMs: STEALTH_DURATION_MS,
  /*
   * RESET, for the same reason Cutthroat resets: a Vanish during an unspent
   * opening window starts a fresh ten seconds rather than stacking them.
   */
  refreshBehaviour: 'reset',
};

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
    // Swing speed only, not haste (round 75): it reaches no cast and no global cooldown.
    statModifiers: [flat('attackSpeedRating', SLICE_AND_DICE_HASTE_RATING)],
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

/*
 * THOUSAND CUTS IS GONE at 1.60.1.70755 -- removed from the Subtlety tree with
 * Quietus and Cutthroat, Death Mark and Boot Knife in their places. It was a
 * Rupture tick applying an energy discount on the next Hemorrhage or Backstab.
 */

/**
 * Garrote's bleed: "552 damage over 18 sec, increased by your Attack Power" --
 * 92 every 3 seconds, six ticks, plus 7% of attack power a tick (the owner's
 * figure). A bleed like Rupture: physical, ignores armor, and every tick can
 * crit at the melee special crit chance, a Forever rule for every DoT.
 */
export const GARROTE_TICK_DAMAGE = 92;
export const GARROTE_TICK_INTERVAL_MS = seconds(3);
export const GARROTE_DURATION_MS = seconds(18);

/**
 * BLOOD SPLATTER (1.60.1.70755) lengthens both bleeds: "Increases the duration
 * of your Rupture ability by 6 sec and your Garrote ability by 9 sec." More
 * TICKS at the same per-tick figure -- the duration is what is stated, not the
 * total -- so a Garrote gains three and a Rupture three.
 */
export const BLOOD_SPLATTER_RUPTURE_MS = seconds(6);
export const BLOOD_SPLATTER_GARROTE_MS = seconds(9);
/** The `abilityFlag` key Blood Splatter sets on Rupture and Garrote. */
export const BLOOD_SPLATTER_FLAG = 'bloodSplatter';

export function garroteAura(extraDurationMs = 0): AuraDefinition {
  return { ...GARROTE, durationMs: GARROTE_DURATION_MS + extraDurationMs };
}

export const GARROTE: AuraDefinition = {
  id: 'garrote',
  name: 'Garrote',
  durationMs: GARROTE_DURATION_MS,
  isDebuff: true,
  isBleed: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: GARROTE_TICK_INTERVAL_MS,
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
        baseAmount: GARROTE_TICK_DAMAGE,
        powerCoefficient: GARROTE_TICK_AP_COEFFICIENT,
        periodic: true,
        critFrom: 'melee-special',
        appliesArmor: false,
      });
    },
  },
};

/**
 * Rupture's bleed. `extraDurationMs` is Blood Splatter's six seconds, which add
 * ticks at the same per-tick figure.
 */
export function ruptureAura(comboPoints: number, extraDurationMs = 0): AuraDefinition {
  const entry = RUPTURE_BY_COMBO_POINT[clampIndex(comboPoints)];
  const ticks = entry.durationMs / RUPTURE_TICK_INTERVAL_MS;
  const perTick = entry.damage / ticks;
  const tickCoefficient = ruptureTickApCoefficient(clamp(comboPoints));

  return {
    id: 'rupture',
    name: 'Rupture',
    durationMs: entry.durationMs + extraDurationMs,
    isDebuff: true,
    isBleed: true,
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
           * 1% OF ATTACK POWER PER TICK PER COMBO POINT, CAPPED AT 3%, by the
           * owner's ruling. It replaced a flat 3% read off the sheet, which
           * paid a one-point Rupture three times its figure. Past three
           * points more points buy only more TICKS: the duration steps from
           * eight seconds to sixteen.
           */
          powerCoefficient: tickCoefficient,
          periodic: true,
          critFrom: 'melee-special',
          appliesArmor: false,
        });

      },
    },
  };
}

/*
 * ----------------------------------------------------------------------------
 * RUPTURE'S `unmodelled` REASON HAD EXPIRED, AND IT WAS THE LOUD KIND.
 *
 * It read: "Its 'increased by your Attack Power' clause does NOT [land]: the
 * source gives no coefficient, so none is invented." That was true the day it
 * was written and stopped being true when `WoWSimWorksheet.xlsx` arrived --
 * the coefficient is `ruptureTickApCoefficient`, it is applied four lines
 * above in this same file, and the comment beside it explains the 3% a tick at
 * length. So the ability was fully scaling while printing a caveat on the
 * results page saying it could not.
 *
 * The fourth time an expired reason has been caught this way, and the second
 * where the code disproving it was in the same file.
 *
 * NOTHING IS LEFT OUTSTANDING, which is why the constant is gone rather than
 * reworded. Hemorrhage's "+15% Rupture damage taken" now applies as well, so
 * `RUPTURE` declares no `unmodelled` at all -- and an ability with nothing to
 * disclose must say nothing rather than say something reassuring.
 * ----------------------------------------------------------------------------
 */


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
 * ----------------------------------------------------------------------------
 * IT DOES SOMETHING NOW, AND ITS OLD REASON WAS WRONG ABOUT THE ENGINE RATHER
 * THAN MERELY STALE. It read: "energy arrives as a fixed batch on a timer ...
 * Needs a rate multiplier on ResourceRegen." `ResourceRegen.amountPerTick` has
 * been `(actor, context) => number` since it was written, and `createPet` has
 * multiplied a pet's focus through that exact signature for as long as pets
 * have existed. The hook was there; nothing was pointed at it.
 *
 * SO THE ABILITY WAS CAST, SPENT ITS COOLDOWN, APPLIED ITS AURA, REPORTED 24.9%
 * UPTIME -- and delivered no energy. An inert buff with visible uptime is the
 * hardest kind to notice, because the results page shows it working.
 *
 * +100% IS THE RATE AND NOT THE CADENCE. Ten more energy a second, not forty
 * ticks a second. The project has already read a rate instruction as a cadence
 * one once, which doubled every energy build before the owner confirmed what
 * was meant -- see `SMOOTH_TICKS_PER_SECOND`.
 * ----------------------------------------------------------------------------
 */
export const ADRENALINE_RUSH_DURATION_MS = seconds(15);
export const ADRENALINE_RUSH_ENERGY_MULTIPLIER = 2;

export const ADRENALINE_RUSH: AuraDefinition = {
  id: 'adrenaline_rush',
  name: 'Adrenaline Rush',
  durationMs: ADRENALINE_RUSH_DURATION_MS,
  resourceRegenMultiplier: { energy: ADRENALINE_RUSH_ENERGY_MULTIPLIER },
};

/**
 * "Increases your melee attack speed by 20% and your melee attacks strike an
 * additional nearby opponent. Lasts 15 sec."
 *
 * THE HASTE APPLIES ALWAYS AND THE CLEAVE ONLY WITH ADDS (round 57): the strike
 * on a second opponent is `BLADE_FLURRY_EXTRA_OPPONENT` in
 * `reactions/reactionsForClass.ts`, and at one target there is nobody to strike.
 */
export const BLADE_FLURRY_ATTACK_SPEED = 0.2;
export const BLADE_FLURRY_DURATION_MS = seconds(15);

export const BLADE_FLURRY: AuraDefinition = {
  id: 'blade_flurry',
  name: 'Blade Flurry',
  durationMs: BLADE_FLURRY_DURATION_MS,
  statModifiers: [
    // Swing speed only, not haste (round 75): it reaches no cast and no global cooldown.
    flat('attackSpeedRating', BLADE_FLURRY_ATTACK_SPEED * 100 * RATING_PER_PERCENT.haste),
  ],
};


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
 * ----------------------------------------------------------------------------
 * APPLIED, AND IT IS THE WHOLE POINT OF THE SUBTLETY BUILD. Its old reason was
 * an accurate statement about the engine -- "the engine has damage-taken
 * multipliers per SCHOOL, and this is per ABILITY on the target" --
 * and `AuraDefinition.abilityDamageTaken` is the form that was missing.
 *
 * NOT A SCHOOL MULTIPLIER, which was the available wrong answer. Rupture is
 * physical, so a +15% physical debuff would raise every swing, every Backstab
 * and every other bleed the Rogue lands -- several times the real effect, and
 * plausible enough that no result would have shown it.
 *
 * "FROM THE ROGUE" IS NOT CHECKED. The pipeline reads the target's auras
 * without asking who applied them, so with two Rogues on one target both would
 * benefit from either's Hemorrhage. Every encounter here has one attacker, so
 * the two readings are identical today.
 * ----------------------------------------------------------------------------
 */
export const HEMORRHAGE_RUPTURE_BONUS = 15;
export const HEMORRHAGE_DURATION_MS = seconds(15);

export const HEMORRHAGE_DEBUFF: AuraDefinition = {
  id: 'hemorrhage',
  name: 'Hemorrhage',
  durationMs: HEMORRHAGE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  // `attackerAbilityModifiers` is main's name for this: a debuff the TARGET

  // carries that raises what ONE named ability does to it. Same concept,

  // and the Mage dive landed it first for Winter's Chill.

  /*
   * RUPTURE AND GARROTE since 1.60.1.70755 -- "causes the target to take 15%
   * increased Rupture and Garrote damage from the Rogue". A bleed's tick carries
   * its aura's id, so the ids reach the ticks.
   */
  attackerAbilityModifiers: {
    rupture: { damageMultiplier: 1 + HEMORRHAGE_RUPTURE_BONUS / 100 },
    garrote: { damageMultiplier: 1 + HEMORRHAGE_RUPTURE_BONUS / 100 },
  },
};




/*
 * ============================================================================
 * GHOSTLY STRIKE'S OPENER WINDOW, which took Cutthroat's job (1.60.1.70755).
 *
 * "...and causes your next Ambush or Garrote cast within 7 sec to not require
 * Stealth." Cutthroat, the Backstab proc that used to do this for Ambush, is
 * removed in the same patch. The window is a gate both abilities read in
 * `canCast` beside STEALTH, and the one that is cast spends it -- "your NEXT
 * Ambush or Garrote".
 *
 * NOT `brokenByAction`: it is a proc window an ability spends, not a state an
 * attack ends, which is the distinction Cutthroat drew against STEALTH.
 * ============================================================================
 */
export const GHOSTLY_STRIKE_OPENER_DURATION_MS = seconds(7);

export const GHOSTLY_STRIKE_OPENER: AuraDefinition = {
  id: 'ghostly_strike_opener',
  name: 'Ghostly Strike',
  durationMs: GHOSTLY_STRIKE_OPENER_DURATION_MS,
  refreshBehaviour: 'reset',
};

/*
 * ============================================================================
 * DEATH MARK, the Subtlety capstone at 1.60.1.70755.
 *
 * "Finishing move that marks the target, storing a portion of the damage dealt
 * by your attacks per Combo Point. Garrote and Rupture damage is stored at
 * twice the rate. After 6 sec, the stored damage is dealt, up to a maximum
 * increased by Attack Power and Critical Strike chance" -- at rank 4, the
 * spellbook's max:
 *
 *     1 point : 12% stored,  401 + 4% of attack power cap
 *     ...
 *     5 points: 60% stored, 1381 + 20% of attack power cap
 *
 * ----------------------------------------------------------------------------
 * THE STORE LIVES ON THE CAST'S OWN AURA DEFINITION. Each cast builds a fresh
 * definition carrying a mutable `DeathMarkState`; the Rogue's reaction finds it
 * through the target's aura instance (`instance.definition`) and adds to it,
 * and the aura's single periodic tick -- due at six seconds, the moment it
 * falls off, which a periodic tick still lands -- deals what was stored, capped.
 * Nothing is shared between casts or characters, so there is no module state.
 *
 * WHAT IS NOT MODELLED, said rather than guessed:
 *   - "AND CRITICAL STRIKE CHANCE": the cap rises with crit chance by an amount
 *     no source states, so the cap is the AP figure alone.
 *   - THE BURST CANNOT CRIT AND IGNORES ARMOR: it is damage already dealt once,
 *     so a crit or armor on it would count those twice. A reading, flagged.
 *   - IT IS A CURSE AND ROLLS NOTHING: a finisher with a twenty-yard range and
 *     no table stated, so it always lands.
 * ============================================================================
 */
export const DEATH_MARK_ID = 'death_mark';
export const DEATH_MARK_DURATION_MS = seconds(6);
/** Share of damage stored per combo point. */
export const DEATH_MARK_STORED_PER_POINT = 0.12;
/** Garrote and Rupture store at twice the rate. */
export const DEATH_MARK_BLEED_MULTIPLIER = 2;
export const DEATH_MARK_BLEED_IDS: ReadonlySet<string> = new Set(['garrote', 'rupture']);
/** The cap's flat part at 1..5 points, from the rank 4 tooltip. */
export const DEATH_MARK_CAP_BY_COMBO_POINT: readonly number[] = [401, 646, 891, 1136, 1381];
/** The cap's attack power part: 4% per point. */
export const DEATH_MARK_CAP_AP_PER_POINT = 0.04;

export interface DeathMarkState {
  /** Damage stored so far, before the cap. */
  stored: number;
  /** Fraction of a non-bleed hit stored, Coup de Grace included. */
  readonly rate: number;
  /** The most the burst may deal. */
  readonly cap: number;
}

/** A Death Mark aura: an ordinary definition that also carries its store. */
export interface DeathMarkAura extends AuraDefinition {
  readonly deathMark: DeathMarkState;
}

export function isDeathMarkAura(definition: AuraDefinition): definition is DeathMarkAura {
  return (definition as Partial<DeathMarkAura>).deathMark !== undefined;
}

export function deathMarkAura(state: DeathMarkState): DeathMarkAura {
  return {
    id: DEATH_MARK_ID,
    name: 'Death Mark',
    durationMs: DEATH_MARK_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    deathMark: state,
    periodic: {
      intervalMs: DEATH_MARK_DURATION_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;
        const amount = Math.min(state.stored, state.cap);
        if (amount <= 0) return;
        dealDamage(context, {
          source,
          target,
          abilityId: DEATH_MARK_ID,
          abilityName: 'Death Mark',
          school: 'physical',
          baseAmount: amount,
          appliesArmor: false,
          cannotCrit: true,
        });
      },
    },
  };
}

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
  GHOSTLY_STRIKE_OPENER,
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
/*
 * ============================================================================
 * "POISONED" IS THIS AURA, AND MUTILATE'S 20% IS CARRIED BY IT.
 *
 * Mutilate reads "Damage increased by 20% against Poisoned targets", and the
 * bonus lives on the debuff rather than in Mutilate's own `onCast` for the
 * standing reason: per-ability damage goes through a modifier the pipeline
 * consults, so the ability respects it without knowing it exists. It is a
 * property of the TARGET's state, so it is the target-side field --
 * `abilityDamageTaken` -- and not one of the three attacker-side scopes.
 *
 * DEADLY POISON IS THE ONLY THING THAT MAKES A TARGET POISONED HERE, and that
 * is correct rather than a shortfall: Instant Poison deals its damage and
 * leaves nothing behind, so it never poisons anybody in the sense the tooltip
 * means. The three crowd-control poisons would also qualify and are not
 * modelled, which costs nothing -- no Rogue profile would coat a weapon with
 * one over Instant or Deadly.
 *
 * ITS REASON EXPIRED WITHOUT ANYBODY TOUCHING MUTILATE. The clause read "does
 * nothing: poisons are not implemented" for as long as that was true, and the
 * poison system landing made it a live 20% on the signature ability of the
 * build that takes it -- unread for a whole release. That is the failure mode
 * this project keeps meeting from the other direction.
 * ============================================================================
 */
export const MUTILATE_POISONED_BONUS = 0.2;

export function deadlyPoisonAura(damageMultiplier = 1): AuraDefinition {
  const perStackPerTick = (DEADLY_POISON_DAMAGE_PER_STACK / DEADLY_POISON_TICKS) * damageMultiplier;

  return {
    id: 'deadly_poison',
    name: 'Deadly Poison',
    durationMs: DEADLY_POISON_DURATION_MS,
    isDebuff: true,
    maxStacks: DEADLY_POISON_MAX_STACKS,
    refreshBehaviour: 'reset',
    /*
     * FLAT, NOT PER STACK. `modifiersScaleWithStacks` is absent on this aura,
     * so the 20% is the same at one stack and at five -- which is what
     * "against Poisoned targets" says. A poisoned target is poisoned.
     */
    // `attackerAbilityModifiers` is main's name for this: a debuff the TARGET

    // carries that raises what ONE named ability does to it. Same concept,

    // and the Mage dive landed it first for Winter's Chill.

    attackerAbilityModifiers: { mutilate: { damageMultiplier: 1 + MUTILATE_POISONED_BONUS } },
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
 * VENOM, A PASSIVE ON SHANK SINCE 1.60.1.70755.
 *
 * "Causes your Shank ability to increase your Poison damage by 30% and your
 * chance to apply Poisons by 20% for 6 sec." It was a finisher -- "increases
 * the damage of your Poisons by 30% and your chance to apply Poisons by 10%",
 * nine to twenty-one seconds by combo points -- and the patch moved it to row
 * 5, made it passive and doubled the chance.
 *
 * ----------------------------------------------------------------------------
 * IT STACKS ADDITIVELY WITH THE POISON TALENTS, on the ruleset owner's ruling
 * about the finisher, kept: with Vile Poisons at 5/5 a poison deals
 * 1 + 0.20 + 0.30 = 1.5x, NOT 1.2 x 1.3; and the apply chance gains the points
 * rather than being multiplied.
 * ----------------------------------------------------------------------------
 */

/** Added to the poison multiplier, not multiplied into it. */
export const VENOM_POISON_DAMAGE_BONUS = 0.3;

/** Added to the apply chance in percentage POINTS: 20% becomes 40%. */
export const VENOM_POISON_CHANCE_BONUS = 0.2;

export const VENOM_AURA_ID = 'venom';
export const VENOM_DURATION_MS = seconds(6);

export const VENOM: AuraDefinition = {
  id: VENOM_AURA_ID,
  name: 'Venom',
  durationMs: VENOM_DURATION_MS,
  // A fresh Shank restarts the six seconds.
  refreshBehaviour: 'reset',
};

/*
 * ----------------------------------------------------------------------------
 * THE AURAS THIS MODULE BUILDS WITH A FACTORY, LISTED SO THE PANEL CAN OFFER
 * THEM.
 *
 * `auraCatalog` finds an aura by walking a module's exports and keeping
 * whatever looks like an `AuraDefinition`. That finds every aura declared as a
 * constant and NONE built by a function -- which silently cost the dropdowns 20
 * auras across nine classes, Rip and Deep Wounds and Ignite among them. Rip is
 * how it was noticed: a Druid could not gate Rip on Rip already being up, which
 * is the single most ordinary thing a feral rotation does.
 *
 * THE ARGUMENT IS REPRESENTATIVE AND ONLY THE ID, NAME AND `isDebuff` ARE READ,
 * none of which depends on it. It lives here rather than in the catalog because
 * what a sensible argument IS belongs next to the factory -- the catalog would
 * otherwise be guessing, and a factory that gained a required argument would
 * break it from a distance.
 * ----------------------------------------------------------------------------
 */
export const CATALOG_AURAS: readonly AuraDefinition[] = [
  // Poised (1.60.1.70755), a Rogue and Druid passive declared in `poised.ts`.
  poisedAura(),
  /*
   * ADDED BY THE AURA-CATALOGUE AUDIT, which found these reachable ONLY through
   * `aurasForClass`'s stock-list safety net -- "anything a stock list names must
   * be choosable, wherever its definition lives". The id was offered with a name
   * derived from it and nothing else, where a listed definition carries the
   * aura's own name and `isDebuff`. A SAFETY NET MASKS THE THING IT IS A NET
   * FOR, which is why the audit asks the modules rather than the catalogue.
   */
  ruptureAura(0),
  exposeArmorAura(0),
  deadlyPoisonAura(),
];
