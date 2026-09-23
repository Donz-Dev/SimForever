import type { Combatant, ResourceGeneration, ResourceRegen } from '../../engine';
import { seconds } from '../../engine';

/**
 * ----------------------------------------------------------------------------
 * THE OLD FORMULAS, KEPT BECAUSE THEY MIGHT COME BACK.
 *
 * Both sides of the rage economy were proportional to damage, scaled by a
 * level-dependent constant:
 *
 *     rage from dealing damage = damage / 230.6 * 7.5
 *     rage from taking damage  = damage / 230.6 * 2.5
 *
 * Commented out rather than deleted, on the ruleset owner's instruction. They
 * are the Classic formulas and the ones this project ran on until Forever
 * replaced them.
 *
 * export const RAGE_CONVERSION_FACTOR = 230.6;
 * export const RAGE_PER_DAMAGE_DEALT = 7.5 / RAGE_CONVERSION_FACTOR;
 * export const RAGE_PER_DAMAGE_TAKEN = 2.5 / RAGE_CONVERSION_FACTOR;
 * ----------------------------------------------------------------------------
 */

/**
 * Rage from DEALING damage, as Forever states it.
 *
 *     rage = R x S
 *
 *     R   a constant from the weapon's handedness
 *     S   the weapon's BASE speed, before any modifier
 *
 * ----------------------------------------------------------------------------
 * IT NO LONGER DEPENDS ON DAMAGE AT ALL, and that is the whole change. A swing
 * is worth the same rage whether it crits for eight hundred or glances for
 * ninety. What it depends on instead is how long the character waited for it.
 *
 * WHICH MAKES IT A RATE. R x S rage every S seconds is R rage per second, so
 * the handedness constant IS the income and the weapon's speed cancels out:
 * a 2H warrior earns 4.5 rage a second and a 1H warrior 3.46, whatever they
 * are holding. Two consequences follow, and neither is obvious from the
 * formula as written:
 *
 *   - a FAST weapon is no longer better for rage. It was, under the old rule
 *     only through damage per second; now speed is exactly cancelled.
 *   - a DUAL-WIELDER earns 3.46 a second PER HAND, because each hand swings on
 *     its own timer and each swing pays R x S for that hand.
 *
 * HASTE DOES NOT RAISE IT. "The base speed of the weapon before any modifiers"
 * is the item's own number, so a hasted warrior swings more often for less
 * rage each time and ends exactly where they started. That is the opposite of
 * the old rule, where haste raised damage and damage was rage.
 *
 * A MISS STILL EARNS NOTHING. The rule is rage from damage DEALT, so the award
 * is flat but conditional -- `requiresDamage` is what expresses that, and
 * without it a flat award would pay out on a swing that never landed.
 * ----------------------------------------------------------------------------
 */
export const RAGE_PER_SECOND_ONE_HAND = 3.46;
export const RAGE_PER_SECOND_TWO_HAND = 4.5;

/** Druid Bear paw attacks use the one-hand constant at a fixed 2.5 speed. */
export const RAGE_PER_SECOND_BEAR_FORM = RAGE_PER_SECOND_ONE_HAND;
export const BEAR_FORM_BASE_SPEED_SECONDS = 2.5;

/**
 * The rage one landed swing of this weapon is worth.
 *
 * `baseSpeedSeconds` is the ITEM's speed and not the swing timer, which haste
 * shortens. Passing the hasted timer would make haste generate rage, which is
 * exactly what this formula stopped doing.
 */
export function rageFromSwing(baseSpeedSeconds: number, twoHanded: boolean): ResourceGeneration {
  const perSecond = twoHanded ? RAGE_PER_SECOND_TWO_HAND : RAGE_PER_SECOND_ONE_HAND;
  return {
    resource: 'rage',
    flat: perSecond * baseSpeedSeconds,
    // Rage from damage DEALT: a swing that missed dealt none.
    requiresDamage: true,
  };
}

/** Bear form, whose paws are not an item and have a stated speed. */
export const RAGE_FROM_BEAR_PAW: ResourceGeneration = rageFromSwing(
  BEAR_FORM_BASE_SPEED_SECONDS,
  false,
);

/**
 * Rage from TAKING damage, as Forever states it.
 *
 *     rage = D x 10 / H
 *
 *     D   pre-armor damage to be dealt
 *     H   maximum hit points
 *
 * ----------------------------------------------------------------------------
 * A FRACTION OF THE CHARACTER RATHER THAN A FIXED RATE. Ten percent of maximum
 * health taken is ten rage, on any character, at any gear level. The old rule
 * paid the same rage for the same damage however large the character was, so
 * stamina quietly cost rage; this one is flat in that respect.
 *
 * "PRE-ARMOR" IS `resolution.raw` MINUS THE BLOCK, and the two halves of that
 * come from two separate rulings that pull against each other on the same
 * pipeline step:
 *
 *   Defensive Stance -10%   DOES reduce the rage. It reduces the damage to be
 *                           dealt, before any of this.
 *   Armor                   does NOT. That is what "pre-armor" means.
 *   A block                 DOES, by its flat value -- "blocked hits give the
 *                           rage of the unblocked amount".
 *
 * ARMOR AND A BLOCK ARE ONE STEP IN THIS ENGINE and had to be told apart for
 * that, which is why `DamageResolution` now carries `blocked` beside
 * `mitigated`. Reading `mitigated` would take armor off as well and leave a
 * tank earning a fraction of what it should.
 *
 * WHICH MAKES A BLOCK WORTH MORE THAN IT LOOKS to a Protection warrior: it
 * removes damage AND the rage that damage would have paid, so block value
 * trades throughput for survival rather than being free mitigation.
 * ----------------------------------------------------------------------------
 */
export const RAGE_PER_MAXIMUM_HEALTH_TAKEN = 10;

/**
 * Built per character, because H is that character's maximum health.
 *
 * Read ONCE, when the combatant is built, from the pool the raid buffs already
 * sized -- the same snapshot health and mana are computed from. A buff landing
 * mid-fight does not resize the pool and so does not move this either.
 */
export function rageFromDamageTaken(maximumHealth: number): ResourceGeneration | undefined {
  if (!Number.isFinite(maximumHealth) || maximumHealth <= 0) return undefined;
  return {
    resource: 'rage',
    perDamage: RAGE_PER_MAXIMUM_HEALTH_TAKEN / maximumHealth,
  };
}

/* --- Energy --- */

/** Energy arrives in fixed batches rather than scaling with anything. */
export const ENERGY_PER_TICK = 20;
export const ENERGY_TICK_INTERVAL_MS = seconds(2);

export const ENERGY_REGEN: ResourceRegen = {
  resource: 'energy',
  intervalMs: ENERGY_TICK_INTERVAL_MS,
  amountPerTick: () => ENERGY_PER_TICK,
};

/* --- Mana --- */

/** Mana ticks on the same two-second cadence as energy. */
export const MANA_TICK_INTERVAL_MS = seconds(2);

/**
 * Fraction of the five-second mana figure that arrives on each two-second tick.
 *
 * 0.4 is exactly 2/5, so MP5 prorated to the tick interval. The two numbers
 * agree by construction rather than by coincidence, and a character regenerates
 * exactly its stated MP5 over any five seconds of uninterrupted ticking.
 */
export const MANA_TICK_FRACTION = MANA_TICK_INTERVAL_MS / seconds(5);

/**
 * How long spending mana suppresses regeneration.
 *
 * The "five second rule": after spending mana, regeneration stops until five
 * seconds have passed without spending again.
 */
export const MANA_REGEN_LOCKOUT_MS = seconds(5);

/**
 * Mana regeneration, including the five second rule.
 *
 * While inside the lockout, a character regenerates only the fraction its
 * `manaRegenBypass` stat allows — the stat that reads "allows X% of your mana
 * regeneration to continue while casting". With no such stat, the answer is
 * zero and the tick does nothing.
 *
 * The tick still fires during the lockout rather than being cancelled, so
 * regeneration resumes by itself the moment five quiet seconds pass.
 */
export const MANA_REGEN: ResourceRegen = {
  resource: 'mana',
  intervalMs: MANA_TICK_INTERVAL_MS,
  amountPerTick: (actor, context) => manaPerTick(actor, context.clock.now()),
};

/** Mana granted by one tick, given when mana was last spent. */
export function manaPerTick(actor: Combatant, now: number): number {
  const full = actor.stats.get('manaPer5') * MANA_TICK_FRACTION;
  if (full <= 0) return 0;

  const casting = actor.spentWithin('mana', now, MANA_REGEN_LOCKOUT_MS);
  if (!casting) return full;

  const bypass = clampPercent(actor.stats.get('manaRegenBypass')) / 100;
  return full * bypass;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, value);
}

/**
 * The regeneration timers a character has, by the resources it owns.
 *
 * Rage is absent on purpose: it does not regenerate on a timer, it is earned by
 * fighting.
 */
export function regenerationFor(resources: readonly string[]): ResourceRegen[] {
  const regen: ResourceRegen[] = [];
  if (resources.includes('energy')) regen.push(ENERGY_REGEN);
  if (resources.includes('mana')) regen.push(MANA_REGEN);
  return regen;
}
