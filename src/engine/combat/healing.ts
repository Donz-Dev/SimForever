import type { Combatant } from '../actors/Combatant';
import type { RNG } from '../rng';
import type { SimulationContext } from '../simulation/SimulationContext';
import { spellCritChanceFrom, versatilityMultiplierFrom } from './ratings';
import { remainingFractionOf } from './damage';

/** Healing crits for this much. Matches the spell crit multiplier. */
const HEALING_CRIT_MULTIPLIER = 1.5;

/**
 * Healing mirrors damage deliberately: same request/resolve/apply shape, same
 * crit roll, same telemetry discipline. Where damage has armor and overkill,
 * healing has overhealing; absorbs will slot in the same way shields do on the
 * damage side.
 *
 * USED SINCE ROUND 52, when the owner made healing a feature: the Paladin's
 * Holy Light, Flash of Light and Holy Shock heal through here.
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
   *
   * THE SECOND CALLER USES IT FOR THE SENTENCE ABOVE RATHER THAN THE NAME.
   * Touch of the Grave heals the Undead for exactly what its drain dealt, and
   * the owner's ruling is that it "only scales off your Hit Points" -- so
   * "nothing about the source scales it" is precisely the contract wanted, even
   * though the source is very much in the fight. Said here because a reader who
   * knows only the first line would read that call as a mistake.
   */
  readonly external?: boolean;
  /**
   * Whether this heal generates threat (round 52). OPT-IN, so the self-heals
   * that existed before healing was a feature -- potions, Healthstones, Frenzied
   * Regeneration, Life Tap's heal-back -- leave every published TPS exactly
   * where it was. A healer's spells set it.
   */
  readonly threatens?: boolean;
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
export function resolveHealing(
  request: HealRequest,
  rng: RNG,
  /**
   * The fight clock's remaining fraction, for the ability modifiers conditional
   * on it -- Quietus, Early Demise. `applyHealing` always passes it; a caller
   * resolving a heal outside a fight has no clock and gets none of them.
   */
  remainingFraction?: number,
): HealResolution {
  const { source, target } = request;

  const coefficient = request.powerCoefficient ?? 0;
  /*
   * THE SCHOOL-BLIND POOL ONLY, and a heal has no school to scope it by
   * anyway. The gear wording draws the line itself: the school-blind line is
   * "increases damage AND HEALING done by magical spells", the scoped one is
   * "increases DAMAGE done by Shadow spells" -- so a Holy-scoped 161 on a
   * Paladin raises its Seal of Righteousness and not its Holy Light. See
   * `spellPowerFor`, which is the damage side of the same question.
   */
  /*
   * HEALING POWER, NOT SPELL POWER (round 52). Forever keeps the two apart --
   * "+73 Healing" beside "+25 Spell Damage" on one item -- and the item parser
   * writes "+N Spell Power" into BOTH stats, so this reads everything that
   * heals and nothing that only hurts. An external heal is not scaled at all,
   * so the stand-in source's healing power cannot leak into it.
   */
  const scaled =
    request.baseAmount + (request.external ? 0 : coefficient * source.stats.get('healingPower'));

  /*
   * THE ABILITY'S OWN MODIFIERS REACH A HEAL TOO: Holy Power's +15% crit on
   * Holy Shock, Divine Favor's guaranteed crit and Healing Light's +12% are
   * all keyed by ability id. Read through `abilityModifierFor`, the one funnel
   * every damage reader uses, so a conditional or aura-borne modifier arrives
   * the same way it does on the damage side.
   */
  const modifier =
    request.external || !request.abilityId
      ? undefined
      : source.abilityModifierFor(request.abilityId, remainingFraction);

  // Healing does not miss, so it rolls crit directly rather than going through
  // a combat table.
  /*
   * AND THE TARGET'S, for crit (round 73): Renewed Hope's "+10% critical strike
   * chance when cast on targets with Weakened Soul" is carried by the Weakened
   * Soul on the target, the way Winter's Chill carries a Mage's crit on a boss.
   */
  const againstModifier =
    request.external || !request.abilityId ? undefined : request.target.abilityModifierAgainst(request.abilityId);
  // Its heal-only half too: Oath of Light hands back Boundless Light's crit.
  const againstTarget = (againstModifier?.critBonus ?? 0) + (againstModifier?.healingCritBonus ?? 0);
  const critChance =
    spellCritChanceFrom(source.stats.effective) +
    ((modifier?.critBonus ?? 0) + (modifier?.healingCritBonus ?? 0) + againstTarget) / 100;
  const critical = (request.canCrit ?? true) && rng.rollChance(Math.min(1, critChance));
  const afterCrit = critical
    ? scaled * (HEALING_CRIT_MULTIPLIER + (modifier?.healingCritMultiplierBonus ?? 0))
    : scaled;

  const raw = request.external
    ? afterCrit
    : afterCrit *
      (modifier?.healingMultiplier ?? 1) *
      (request.periodic ? source.periodicHealingMultiplier : 1) *
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
  const resolution = resolveHealing(request, context.rng, remainingFractionOf(context));

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
    targetHealth: request.target.health.current,
    periodic: request.periodic ?? false,
    ...(request.external ? { external: true } : {}),
    ...(request.threatens && !request.external ? { threatens: true } : {}),
  });

  return resolution;
}
