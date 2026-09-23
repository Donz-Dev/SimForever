import type { Combatant } from '../actors/Combatant';
import { applyHaste, hasteMultiplierFrom } from '../combat/ratings';
import { runCastReactions } from '../combat/reactions';
import type { ResourceType } from '../resources/Resource';
import { resetSwingTimers } from '../combat/autoAttack';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';
import type { Ability, AbilityContext } from './Ability';
import { DEFAULT_GCD_MS } from './Ability';
import { castModifiersFor, resolveCast } from './castModifiers';

/** Why an ability could not be used. Useful for debugging a stuck rotation. */
export type CastRejection =
  | 'caster_dead'
  | 'on_gcd'
  | 'already_casting'
  | 'on_cooldown'
  | 'not_enough_resource'
  | 'invalid_target'
  | 'already_queued'
  | 'wrong_stance'
  | 'condition_failed';

export type CastCheck = { ok: true } | { ok: false; reason: CastRejection };

/**
 * Can this ability be used right now?
 *
 * Checks every rule the engine owns, in a fixed order, then defers to the
 * ability's own `canCast` for anything specific to it. Rotations call this
 * before committing, so the checks have to be side-effect free.
 */
export function checkCast(
  context: SimulationContext,
  caster: Combatant,
  ability: Ability,
  target: Combatant | undefined,
): CastCheck {
  const now = context.clock.now();

  if (!caster.isAlive) return { ok: false, reason: 'caster_dead' };
  if (caster.isCasting(now)) return { ok: false, reason: 'already_casting' };

  /*
   * A RUNNING GLOBAL COOLDOWN BLOCKS EVERYTHING, including abilities that do
   * not start one.
   *
   * The ruleset owner's ruling, and it is the narrower of the two readings:
   * "off the global cooldown" here means an ability does not SPEND one, not
   * that it ignores one already running. So Shield Block is free in the sense
   * that the strike after it is not delayed -- and it still has to wait for
   * the current global cooldown to finish before it goes out.
   */
  if (caster.isOnGcd(now)) {
    return { ok: false, reason: 'on_gcd' };
  }

  if (!caster.abilities.isReady(ability.id, now)) {
    return { ok: false, reason: 'on_cooldown' };
  }

  /*
   * THE MODIFIED COST, not the printed one. Maelstrom Weapon takes 20% a stack
   * off a Lightning Bolt's mana, and a rotation that checked the full 220
   * would refuse a cast the character could afford -- silently, because a
   * priority list simply moves to the next entry and nothing reports a spell
   * it declined to consider.
   *
   * `resolveCast` is pure, which is what lets this check stay side-effect
   * free; the charge is spent in `castAbility` by the cast that happens.
   */
  if (
    ability.cost &&
    !caster.resources.canAfford(ability.cost.resource, resolveCast(caster, ability).costAmount)
  ) {
    return { ok: false, reason: 'not_enough_resource' };
  }

  if ((ability.requiresTarget ?? true) && (!target || !target.isAlive)) {
    return { ok: false, reason: 'invalid_target' };
  }

  // Already armed and waiting for the swing. Without this a priority list would
  // re-arm it every time it was evaluated and pay the cost again each time.
  if (ability.onNextSwing && caster.queuedSwing(ability.onNextSwing) === ability.id) {
    return { ok: false, reason: 'already_queued' };
  }

  const abilityContext: AbilityContext = { simulation: context, caster, target, ability };
  if (ability.canCast && !ability.canCast(abilityContext)) {
    return { ok: false, reason: 'condition_failed' };
  }

  /*
   * Stance gating, and it is deliberately THE LAST CHECK.
   *
   * An empty or absent list means any stance, which is what most of the
   * Warrior's abilities genuinely are. Expressed as "one of these auras must be
   * up" rather than as a stance concept, so the engine keeps knowing nothing
   * about warriors: a stance is an aura that lasts until another replaces it.
   *
   * LAST, because a rotation acts on this rejection rather than skipping it --
   * `wrong_stance` is the one refusal that says "not yet, and here is how". If
   * it were checked before the ability's own `canCast`, a Revenge whose window
   * is shut would report the stance as the problem, and the rotation would
   * spend a stance change reaching for something it still could not cast. It
   * did: 81 of 140 casts in a sampled fight were stance swaps and Revenge was
   * never cast once.
   *
   * So the rule is: report the wrong stance only when the stance is genuinely
   * the only thing in the way.
   */
  if (ability.stances && ability.stances.length > 0) {
    const inOne = ability.stances.some((id) => caster.auras.has(id));
    if (!inOne) return { ok: false, reason: 'wrong_stance' };
  }

  return { ok: true };
}

/**
 * Use an ability.
 *
 * Costs are paid, the cooldown starts and the global cooldown starts at cast
 * *start*; the effect lands at cast *end*. For an instant ability those are the
 * same moment, so the effect runs inline; otherwise the effect is scheduled and
 * the caster is locked out until then.
 *
 * Returns the rejection reason if the ability could not be used.
 */
export function castAbility(
  context: SimulationContext,
  caster: Combatant,
  ability: Ability,
  target: Combatant | undefined,
): CastCheck {
  const check = checkCast(context, caster, ability, target);
  if (!check.ok) return check;

  const now = context.clock.now();
  const haste = hasteMultiplierFrom(caster.stats.effective);

  /*
   * RESOLVED ONCE AND USED FOR BOTH HALVES, then the charges are spent.
   *
   * Resolving twice would be a bug waiting for a stack to change between the
   * two reads; spending before resolving would charge the cast a stack it
   * never got the benefit of.
   */
  const resolved = resolveCast(caster, ability);
  const matchedModifiers = resolved.modified ? castModifiersFor(caster, ability) : [];

  caster.abilities.consumeCharge(ability.id, now);

  if (ability.cost) {
    const pool = caster.resources.require(ability.cost.resource);
    pool.spend(resolved.costAmount);
    // Recorded so rules keyed on recent spending work: mana regeneration stops
    // for a few seconds after a cast.
    caster.recordResourceSpend(ability.cost.resource, now);
    context.telemetry.emit({
      type: 'resource_spent',
      timestamp: now,
      actorId: caster.id,
      resource: ability.cost.resource,
      // What it ACTUALLY cost. The rage and mana panels are audit trails for
      // exactly this kind of reduction, so reporting the printed cost would
      // hide the talent that is doing the work.
      amount: resolved.costAmount,
      wasted: 0,
      current: pool.current,
      // Which ability spent it. This is what turns "83 rage spent" into a
      // breakdown a person can audit a cost-reduction talent against.
      source: ability.id,
      sourceName: ability.name,
    });
  }

  if (triggersGcd(ability)) {
    caster.gcdReadyAt = now + gcdLength(ability, caster.baseGcdMs);
  }

  context.telemetry.emit({
    type: 'cast',
    timestamp: now,
    sourceId: caster.id,
    targetId: target?.id,
    abilityId: ability.id,
    abilityName: ability.name,
  });

  // Spent here, on the cast that benefits, and AFTER the cost was paid from
  // the same resolution. An ability that turns out to be on-next-swing below
  // has still had its charge: it is a cast, and Eclipse counts casts.
  caster.auras.consumeCastCharges(context, matchedModifiers);

  const castTime = castLength(ability, haste, resolved.baseCastTimeMs);
  const abilityContext: AbilityContext = { simulation: context, caster, target, ability };

  // An on-next-swing ability is paid for and armed here; the auto-attack that
  // follows runs its effect. Nothing lands now, so it returns before the cast
  // path below.
  if (ability.onNextSwing) {
    caster.queueNextSwing(ability.onNextSwing, ability.id);
    return { ok: true };
  }

  if (castTime <= 0) {
    runCast(context, abilityContext);
    return { ok: true };
  }

  /*
   * Starting a cast interrupts the swing in progress unless the ability says
   * otherwise. Done BEFORE `castEndsAt` is set, so the reset schedules a full
   * swing from now rather than being held behind the cast that caused it.
   */
  if ((ability.swingTimer ?? 'reset') === 'reset') {
    resetSwingTimers(context, caster);
  }

  caster.castEndsAt = now + castTime;
  context.events.schedule(
    caster.castEndsAt,
    createEvent(`cast-complete:${ability.id}`, EventPriority.CastComplete, (ctx) => {
      caster.castEndsAt = 0;
      if (!caster.isAlive) return;
      runCast(ctx, { simulation: ctx, caster, target, ability });
    }),
  );

  return { ok: true };
}


/**
 * Run an ability's effect and tell the caster's cast reactions what it spent.
 *
 * ----------------------------------------------------------------------------
 * THE SPEND IS MEASURED BY SNAPSHOT, before and after, across every pool the
 * caster owns. That covers the declared `cost`, which the engine took, AND
 * anything the ability drained itself -- Execute emptying the rage bar, a
 * Rogue finisher emptying its combo points.
 *
 * Measuring rather than declaring is deliberate. Asking each ability to report
 * what it spent would put the burden on every ability to remember, and the one
 * that forgot would be silently inert -- the exact failure mode this project
 * keeps meeting. Nothing has to opt in.
 *
 * A POOL THAT GAINED reports nothing rather than a negative: Bloodrage grants
 * rage inside its own `onCast`, and "spent -10 rage" is not a thing a reaction
 * should have to reason about.
 * ----------------------------------------------------------------------------
 */
function runCast(context: SimulationContext, abilityContext: AbilityContext): void {
  const { caster, ability, target } = abilityContext;

  if (caster.castReactions.length === 0) {
    // Nothing is listening, so nothing needs measuring.
    ability.onCast(abilityContext);
    return;
  }

  const before = new Map<ResourceType, number>();
  for (const type of caster.resources.types) {
    before.set(type, caster.resources.get(type)?.current ?? 0);
  }

  ability.onCast(abilityContext);

  const spent: Partial<Record<ResourceType, number>> = {};
  for (const [type, had] of before) {
    const now = caster.resources.get(type)?.current ?? 0;
    const difference = had - now;
    if (difference > 0) spent[type] = difference;
  }

  runCastReactions(context, caster, { caster, target, ability, spent });
}

/** Hasted cast time, or 0 for an instant ability. */
export function castLength(
  ability: Ability,
  hasteMultiplier: number,
  /*
   * The cast time AFTER the caster's cast modifiers, when there are any.
   * Defaulted to the ability's own so every existing caller is unchanged --
   * and so a caller that forgets is merely un-helped rather than wrong.
   */
  resolvedBaseMs?: Milliseconds,
): Milliseconds {
  const base = resolvedBaseMs ?? ability.castTimeMs ?? 0;
  if (base <= 0) return 0;
  // HASTE LAST, so it scales whatever the modifiers left: a 20%-shorter cast
  // is 20% shorter at every gear level rather than only at none.
  return (ability.affectedByHaste ?? true) ? applyHaste(base, hasteMultiplier) : base;
}

/**
 * Whether using this ability starts a global cooldown.
 *
 * ----------------------------------------------------------------------------
 * ON-NEXT-SWING ABILITIES ARE OFF THE GLOBAL COOLDOWN, and that is derived
 * here rather than written on each one.
 *
 * Heroic Strike and Cleave are not cast: they are ARMED, and replace the next
 * swing when it lands. Nothing is spent from the character's action budget to
 * arm one, which is exactly what makes them the place surplus rage goes.
 *
 * Deriving it from `onNextSwing` rather than setting `triggersGcd: false` on
 * each means a new on-next-swing ability gets the rule for free instead of
 * needing someone to remember it. An ability that genuinely wants both can
 * still say `triggersGcd: true`.
 * ----------------------------------------------------------------------------
 */
export function triggersGcd(ability: Ability): boolean {
  return ability.triggersGcd ?? ability.onNextSwing === undefined;
}

/**
 * How long a global cooldown lasts. HASTE DOES NOT TOUCH IT.
 *
 * The ruleset owner's ruling, and it is why this takes no haste multiplier at
 * all rather than taking one and ignoring it: a parameter nothing reads is an
 * invitation to start reading it. `affectedByHaste` still governs CAST TIME,
 * which is a different question with a different answer.
 *
 * With no hasting there is no floor to apply here either. `MINIMUM_GCD_MS`
 * still exists and is still used, but by the TALENT path -- a talent that
 * shortens the global cooldown, like Improved Slam, needs something to stop
 * it reaching zero. Haste no longer has anything to be floored.
 *
 * `baseGcdMs` is the CASTER'S, because how long a global cooldown lasts is a
 * property of the class rather than of the ability -- a Rogue's is 1.0 seconds
 * and a Warrior's is 1.5, for the same Sinister Strike-shaped ability. An
 * ability may still override it with `gcdMs`.
 */
export function gcdLength(
  ability: Ability,
  baseGcdMs: Milliseconds = DEFAULT_GCD_MS,
): Milliseconds {
  return ability.gcdMs ?? baseGcdMs;
}
