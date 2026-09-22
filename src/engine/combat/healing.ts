import type { Combatant } from '../actors/Combatant';
import type { RNG } from '../rng';
import type { SimulationContext } from '../simulation/SimulationContext';
import { spellCritChanceFrom, versatilityMultiplierFrom } from './ratings';

/** Healing crits for this much. Matches the spell crit multiplier. */
const HEALING_CRIT_MULTIPLIER = 1.5;

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
  /**
   * The heal comes from a caster that is not in the fight, so NOTHING about
   * the nominal source scales it. `baseAmount` is the whole answer.
   *
   * A heal needs a source -- telemetry is attributed and a request with no
   * source could not be reported at all -- but an encounter that assumes a
   * healer has nobody to name. Handing it the character being healed is the
   * least-wrong stand-in, and without this flag that stand-in would quietly
   * scale the incoming heal by the TANK's healing done and versatility. A
   * warrior has neither today, so the bug would be worth exactly zero until
   * the day something granted one.
   */
  readonly external?: boolean;
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

  // Healing does not miss, so it rolls crit directly rather than going through
  // a combat table.
  const critical =
    (request.canCrit ?? true) && rng.rollChance(spellCritChanceFrom(source.stats.effective));
  const afterCrit = critical ? scaled * HEALING_CRIT_MULTIPLIER : scaled;

  const raw = request.external
    ? afterCrit
    : afterCrit *
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
