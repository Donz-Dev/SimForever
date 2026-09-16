import type { Combatant } from '../actors/Combatant';
import type { RNG } from '../rng';
import type { SimulationContext } from '../simulation/SimulationContext';
import { applyCriticalMultiplier, rollCritical } from './damage';
import { versatilityMultiplierFrom } from './ratings';

/**
 * Healing mirrors damage deliberately: same request/resolve/apply shape, same
 * crit roll, same telemetry discipline. Where damage has armor and overkill,
 * healing has overhealing; absorbs will slot in the same way shields do on the
 * damage side.
 *
 * The foundation is here; no content uses it yet.
 */
export interface HealRequest {
  readonly source: Combatant;
  readonly target: Combatant;
  readonly abilityId?: string;
  readonly abilityName: string;
  readonly baseAmount: number;
  /** Multiplied by the source's spell power and added to `baseAmount`. */
  readonly powerCoefficient?: number;
  readonly canCrit?: boolean;
  readonly periodic?: boolean;
}

export interface HealResolution {
  /** Healing before the target's missing-health cap. */
  readonly raw: number;
  /** Healing that actually restored health. */
  readonly amount: number;
  /** Healing wasted because the target was already at full. */
  readonly overhealing: number;
  readonly critical: boolean;
}

/** Run a heal request through the pipeline without applying it. */
export function resolveHealing(request: HealRequest, rng: RNG): HealResolution {
  const { source, target } = request;

  const coefficient = request.powerCoefficient ?? 0;
  const scaled = request.baseAmount + coefficient * source.stats.get('spellPower');

  const critical = rollCritical(source, rng, request.canCrit ?? true);
  const afterCrit = applyCriticalMultiplier(scaled, critical);

  const raw =
    afterCrit *
    source.healingDoneMultiplier *
    versatilityMultiplierFrom(source.stats.effective);

  const amount = Math.min(raw, target.health.deficit);

  return {
    raw,
    amount,
    overhealing: raw - amount,
    critical,
  };
}

/**
 * Resolve a heal, apply it, and emit telemetry. The only function that
 * restores health.
 */
export function applyHealing(
  context: SimulationContext,
  request: HealRequest,
): HealResolution {
  const resolution = resolveHealing(request, context.rng);

  // Dead combatants are not healed back to life; resurrection is its own
  // mechanic and will need its own event.
  if (request.target.isAlive) {
    request.target.health.gain(resolution.amount);
  }

  context.telemetry.emit({
    type: 'heal',
    timestamp: context.clock.now(),
    sourceId: request.source.id,
    targetId: request.target.id,
    abilityId: request.abilityId,
    abilityName: request.abilityName,
    amount: resolution.amount,
    critical: resolution.critical,
    overhealing: resolution.overhealing,
    periodic: request.periodic ?? false,
  });

  return resolution;
}
