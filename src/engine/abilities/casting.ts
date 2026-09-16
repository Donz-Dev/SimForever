import type { Combatant } from '../actors/Combatant';
import { applyHaste, hasteMultiplierFrom } from '../combat/ratings';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';
import type { Ability, AbilityContext } from './Ability';
import { DEFAULT_GCD_MS, MINIMUM_GCD_MS } from './Ability';

/** Why an ability could not be used. Useful for debugging a stuck rotation. */
export type CastRejection =
  | 'caster_dead'
  | 'on_gcd'
  | 'already_casting'
  | 'on_cooldown'
  | 'not_enough_resource'
  | 'invalid_target'
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

  if ((ability.triggersGcd ?? true) && caster.isOnGcd(now)) {
    return { ok: false, reason: 'on_gcd' };
  }

  if (!caster.abilities.isReady(ability.id, now)) {
    return { ok: false, reason: 'on_cooldown' };
  }

  if (ability.cost && !caster.resources.canAfford(ability.cost.resource, ability.cost.amount)) {
    return { ok: false, reason: 'not_enough_resource' };
  }

  if ((ability.requiresTarget ?? true) && (!target || !target.isAlive)) {
    return { ok: false, reason: 'invalid_target' };
  }

  const abilityContext: AbilityContext = { simulation: context, caster, target };
  if (ability.canCast && !ability.canCast(abilityContext)) {
    return { ok: false, reason: 'condition_failed' };
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

  caster.abilities.consumeCharge(ability.id, now);

  if (ability.cost) {
    const pool = caster.resources.require(ability.cost.resource);
    pool.spend(ability.cost.amount);
    context.telemetry.emit({
      type: 'resource_spent',
      timestamp: now,
      actorId: caster.id,
      resource: ability.cost.resource,
      amount: ability.cost.amount,
      wasted: 0,
      current: pool.current,
    });
  }

  if (ability.triggersGcd ?? true) {
    caster.gcdReadyAt = now + gcdLength(ability, haste);
  }

  context.telemetry.emit({
    type: 'cast',
    timestamp: now,
    sourceId: caster.id,
    targetId: target?.id,
    abilityId: ability.id,
    abilityName: ability.name,
  });

  const castTime = castLength(ability, haste);
  const abilityContext: AbilityContext = { simulation: context, caster, target };

  if (castTime <= 0) {
    ability.onCast(abilityContext);
    return { ok: true };
  }

  caster.castEndsAt = now + castTime;
  context.events.schedule(
    caster.castEndsAt,
    createEvent(`cast-complete:${ability.id}`, EventPriority.CastComplete, (ctx) => {
      caster.castEndsAt = 0;
      if (!caster.isAlive) return;
      ability.onCast({ simulation: ctx, caster, target });
    }),
  );

  return { ok: true };
}

/** Hasted cast time, or 0 for an instant ability. */
export function castLength(ability: Ability, hasteMultiplier: number): Milliseconds {
  const base = ability.castTimeMs ?? 0;
  if (base <= 0) return 0;
  return (ability.affectedByHaste ?? true) ? applyHaste(base, hasteMultiplier) : base;
}

/** Hasted global cooldown, floored at MINIMUM_GCD_MS. */
export function gcdLength(ability: Ability, hasteMultiplier: number): Milliseconds {
  const base = ability.gcdMs ?? DEFAULT_GCD_MS;
  if (!(ability.affectedByHaste ?? true)) return base;
  return Math.max(MINIMUM_GCD_MS, applyHaste(base, hasteMultiplier));
}
