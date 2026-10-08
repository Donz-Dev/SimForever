import type { Combatant, CostRefundRule, ResourceGeneration, ResourceRegen } from '../../engine';
import { seconds } from '../../engine';
import type { ClassId, CombatStyleId } from '../character/ids';

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

/*
 * ============================================================================
 * A CRITICAL SWING PAYS MORE RAGE, and by how much is a CLASS property.
 *
 * Forever's 1.60.1.70170 notes state two figures and nothing else:
 *
 *   Warrior  "Players now generate 100% increased Rage when landing a critical
 *            strike with a basic attack."
 *   Druid    "Bear Form and Dire Bear Form now generate 75% increased Rage when
 *            landing a Critical Strike."
 *
 * SO TWO MULTIPLIERS AND NOT ONE WITH AN EXCEPTION. The Warrior's sits under
 * the Warrior heading and the Bear's names its own forms, and the owner has
 * confirmed reading them as independent figures -- not the Bear's stacking on
 * top of a class-wide one, which the word "Players" invites.
 *
 * ----------------------------------------------------------------------------
 * AND THE TWO NOW AGREE, WHICH IS A COINCIDENCE AND NOT A SIMPLIFICATION. The
 * Bear went 75% to 100% in a later patch -- "Additional Rage generated from
 * landing Critical Strikes increased to 100% increased Rage (Was 75%)" -- so
 * both constants are 2.0 and the function below has two branches returning the
 * same number.
 *
 * THEY STAY SEPARATE. They are two statements by the owner about two classes,
 * and collapsing them into one constant would mean the next patch that moves
 * either one has to split them back apart -- after somebody has worked out that
 * they were ever different. This is the arrangement Early Demise's 20 and
 * `EXECUTE_PHASE_FRACTION` already have for the same reason, and a test pins
 * that each is independently right rather than that they are equal.
 * ----------------------------------------------------------------------------
 *
 * IT IS THE FIRST THING IN THIS FILE THAT MAKES HASTE RAISE RAGE INCOME, and
 * only indirectly: `rageFromSwing` cancels speed exactly, so income is R per
 * second whatever the weapon -- but a crit RATE is per swing, so a faster
 * weapon crits more often and collects this more often. The cancellation that
 * section argues for is about the base award and still holds.
 *
 * AND IT IS WHY CRIT IS NOW A RAGE STAT FOR A WARRIOR. At a 2.0 multiplier a
 * build at 30% crit earns 1.3x the rage it used to, which is a change to the
 * rage economy of every Warrior and Bear list in the project rather than a
 * damage change -- so a figure that moves here moves because the character
 * could AFFORD more, not because anything hit harder.
 * ============================================================================
 */
export const WARRIOR_CRIT_RAGE_MULTIPLIER = 2.0;
/**
 * 1.75 until the owner raised it: "Additional Rage generated from landing
 * Critical Strikes increased to 100% increased Rage (Was 75%)."
 *
 * The same figure as the Warrior's now, and a different fact -- see above.
 */
export const BEAR_FORM_CRIT_RAGE_MULTIPLIER = 2.0;

/**
 * What a critical swing multiplies this character's flat rage award by.
 *
 * Shaped like `globalCooldownFor` deliberately: one function, dispatching on
 * class and style, so a reader looking for "which classes have a special
 * number here" finds every answer in one place rather than in `createPlayer`.
 *
 * A BEAR AND A DIRE BEAR ARE ONE STYLE in this engine, which is why `bear`
 * covers both of the forms the note names. A Cat or a Moonkin gets 1 -- they
 * own a rage pool and have nothing that fills it from a swing, and Forever
 * states the increase for the bear forms only.
 *
 * THE TWO BRANCHES RETURN THE SAME NUMBER TODAY and are still two branches,
 * because they answer to two separate owner statements. A reader tempted to
 * fold them should read the note on the constants first.
 */
export function critRageMultiplierFor(
  characterClass: ClassId,
  style: CombatStyleId | undefined,
): number {
  if (characterClass === 'warrior') return WARRIOR_CRIT_RAGE_MULTIPLIER;
  if (characterClass === 'druid' && style === 'bear') return BEAR_FORM_CRIT_RAGE_MULTIPLIER;
  return 1;
}

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

/* --- Smooth regeneration --- */

/*
 * ============================================================================
 * ENERGY, MANA AND FOCUS ALL TICK TWENTY TIMES A SECOND.
 *
 * The ruleset owner's change: "smooth" regeneration, which no event-driven
 * engine can make genuinely continuous, modelled as a fine cadence instead.
 * Fifty milliseconds is fine enough that a Rogue never waits a visible moment
 * for the two energy that would let it act.
 *
 * IT IS A RESPONSIVENESS CHANGE AND NOT ONLY A COSMETIC ONE. Under a
 * two-second batch a rotation could be idle for most of two seconds with 58 of
 * a 60-energy cost banked; at twenty ticks a second it waits at most fifty
 * milliseconds. The RATE is what decides income; the CADENCE decides how much
 * of it is wasted waiting.
 * ============================================================================
 */
export const SMOOTH_TICKS_PER_SECOND = 20;
export const SMOOTH_TICK_INTERVAL_MS = seconds(1) / SMOOTH_TICKS_PER_SECOND;

/* --- Energy --- */

/*
 * HALF AN ENERGY, TWENTY TIMES A SECOND -- ten a second, which is exactly what
 * the old 20-every-2-seconds delivered. The change is CADENCE, not rate.
 *
 * IT WAS BUILT AT ONE A TICK FIRST, because that is what the instruction said
 * literally, and measuring it is what settled the question: twenty a second
 * doubled every energy build -- Cat +52.6%, Combat +50.5%, Rupture +42.1%,
 * Venom +35.3% -- and made a Cat Druid the highest damage in the project. The
 * owner confirmed that smoothing, not a buff, was the intent. Recorded because
 * "1 energy 20 times a second" reads as deliberate, and the only thing that
 * distinguished it from a slip was the size of what it did.
 */
export const ENERGY_PER_SMOOTH_TICK = 0.5;
export const ENERGY_PER_SECOND = ENERGY_PER_SMOOTH_TICK * SMOOTH_TICKS_PER_SECOND;
export const ENERGY_TICK_INTERVAL_MS = SMOOTH_TICK_INTERVAL_MS;

/*
 * THE TICK READS THE ACTOR NOW, for Adrenaline Rush and anything like it.
 *
 * `amountPerTick` has always been `(actor, context) => number` -- `createPet`
 * multiplies a pet's focus through the same signature -- so this is a rule
 * finding its hook rather than a new capability. The multiplier itself is data
 * on the aura, which keeps a Rogue cooldown out of a rule that a Cat Druid also
 * uses.
 */
export const ENERGY_REGEN: ResourceRegen = {
  resource: 'energy',
  intervalMs: ENERGY_TICK_INTERVAL_MS,
  amountPerTick: (actor) => ENERGY_PER_SMOOTH_TICK * actor.regenMultiplierFor('energy'),
};

/* --- Focus --- */

/**
 * A pet's focus: "Pets regenerate 100 Focus over 10 sec, or 10 Focus per
 * second", from the Forever Hunter wiki.
 *
 * ----------------------------------------------------------------------------
 * THE WIKI STATES TWO RATES AND THEY DISAGREE. It says "about 25.5 Focus every
 * 5.2 sec" -- which is 4.9 a second -- and then "100 Focus over 10 sec, or 10
 * Focus per second". The second is written as the conclusion and is followed
 * by "this is roughly double the Classic Focus regeneration rate", which
 * Classic's ~5 a second makes true of 10 and false of 4.9.
 *
 * So ten is used, and the disagreement is recorded here rather than resolved
 * silently. It is one constant, so flipping it is one edit.
 *
 * TICKED ONCE A SECOND rather than continuously. The wiki calls the new
 * behaviour "continuous", which no event-driven engine can be; a one-second
 * tick is the finest cadence that costs nothing and it delivers the stated
 * rate exactly.
 * ----------------------------------------------------------------------------
 */
export const FOCUS_PER_SMOOTH_TICK = 0.5;
export const FOCUS_PER_SECOND = FOCUS_PER_SMOOTH_TICK * SMOOTH_TICKS_PER_SECOND;
export const FOCUS_TICK_INTERVAL_MS = SMOOTH_TICK_INTERVAL_MS;

/*
 * SMOOTH, AND AT THE SAME RATE IT ALREADY HAD. Half a focus twenty times a
 * second is ten a second, which is exactly what the one-second tick delivered
 * -- so this change is cadence only and moves no Hunter's damage except
 * through the pet acting sooner. Energy's figure was NOT rate-preserving; the
 * two were given separately and differ on purpose.
 */
export const FOCUS_REGEN: ResourceRegen = {
  resource: 'focus',
  intervalMs: FOCUS_TICK_INTERVAL_MS,
  // Through `regenMultiplierFor` like the other two, so the three rules agree.
  // Nothing multiplies focus today and the product is 1 when nothing does.
  amountPerTick: (actor) => FOCUS_PER_SMOOTH_TICK * actor.regenMultiplierFor('focus'),
};

/* --- Mana --- */

/** Mana ticks on the same smooth cadence as energy and focus. */
export const MANA_TICK_INTERVAL_MS = SMOOTH_TICK_INTERVAL_MS;

/**
 * Fraction of the five-second mana figure that arrives on each tick.
 *
 * DERIVED FROM THE INTERVAL rather than written down, so the rate cannot drift
 * from the cadence: at fifty milliseconds it is 1/100, and a character still
 * regenerates exactly its stated MP5 over any five quiet seconds. That was
 * true of the old two-second tick at 2/5 and stays true here by construction.
 *
 * SMOOTHING MANA CHANGES WHEN THE FIVE SECOND RULE BITES, which is the only
 * reason it is not purely cosmetic: regeneration now resumes within fifty
 * milliseconds of the window clearing rather than waiting for the next
 * two-second boundary, so a caster recovers a little more between casts.
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

/**
 * Mana granted by one tick, given when mana was last spent.
 *
 * ----------------------------------------------------------------------------
 * `regenMultiplierFor` REACHES MANA NOW, AND IT REACHED ONLY ENERGY BEFORE.
 * The method was written for Adrenaline Rush, documented on the aura field as
 * "multiplies the carrier's REGENERATION of a resource", and wired into one of
 * the three rules -- so an aura declaring `{ mana: 16 }` compiled, applied,
 * reported its uptime and changed nothing at all. Evocation is the first
 * caller for mana and measured a ratio of exactly 1.0000.
 *
 * THAT IS THE SAME FAILURE `modifiersScaleWithStacks` HAD: a general field read
 * by some of the collections that should read it, where the one that does not
 * is silent rather than wrong. The three regeneration rules all go through it
 * now, including focus, which nothing multiplies today.
 *
 * THE MULTIPLIER IS OUTSIDE THE BYPASS, deliberately. The five second rule
 * decides what FRACTION of the rate gets through and this multiplies the rate
 * itself, so Evocation's two clauses compose instead of fighting: it sets the
 * bypass to 100 and multiplies by 16, which is "your out-of-combat rate, times
 * sixteen" exactly as the owner stated it.
 * ----------------------------------------------------------------------------
 */
export function manaPerTick(actor: Combatant, now: number): number {
  const full =
    actor.stats.get('manaPer5') * MANA_TICK_FRACTION * actor.regenMultiplierFor('mana');
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
  if (resources.includes('focus')) regen.push(FOCUS_REGEN);
  if (resources.includes('mana')) regen.push(MANA_REGEN);
  return regen;
}

/* --- Refunds --- */

/*
 * ============================================================================
 * AN ABILITY THAT DOES NOT CONNECT HANDS 80% OF ITS COST BACK.
 *
 * The ruleset owner's rule, and it applies to RAGE AND ENERGY only -- a mana
 * spell that resists refunds nothing.
 *
 * "Miss or otherwise don't connect through a block/dodge/parry" is the owner's
 * wording. For an ABILITY the block clause has no case to cover: this engine's
 * `melee-special` table offers miss, dodge and parry and no block at all, and
 * an auto-attack that IS blocked costs nothing to refund. So the rule reduces
 * exactly to `AVOIDED_OUTCOMES`.
 *
 * TWO ABILITIES ARE EXEMPT AND ALWAYS DEPLETE THE POOL -- Ferocious Bite and
 * Execute -- and they say so on themselves with `refundsCostOnMiss: false`.
 * Everything else gets the rule by DERIVATION rather than declaration, so a
 * new rage or energy ability cannot forget it.
 * ============================================================================
 */
export const COST_REFUND_FRACTION = 0.8;

/** Rage and energy refund; mana, focus, combo points and shards do not. */
export const COST_REFUND_RESOURCES = ['rage', 'energy'] as const;

export const COST_REFUND_ON_MISS: CostRefundRule = {
  fraction: COST_REFUND_FRACTION,
  resources: COST_REFUND_RESOURCES,
};
