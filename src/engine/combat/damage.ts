import type { Combatant } from '../actors/Combatant';
import type { RNG } from '../rng';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { DamageSchool } from './DamageSchool';
import { isPhysical } from './DamageSchool';
import {
  ARMOR_CONSTANT,
  CRITICAL_STRIKE_MULTIPLIER,
  MAX_ARMOR_REDUCTION,
  critChanceFrom,
  versatilityMultiplierFrom,
} from './ratings';

/**
 * A request to deal damage, as an ability describes it.
 *
 * The ability says what it is trying to do; the pipeline below decides what
 * actually lands. Abilities never compute final numbers themselves, which is
 * what keeps crit, armor and buff handling from being copy-pasted per spell.
 */
export interface DamageRequest {
  readonly source: Combatant;
  readonly target: Combatant;
  readonly abilityId?: string;
  readonly abilityName: string;
  readonly school: DamageSchool;
  /** Flat damage before any scaling. */
  readonly baseAmount: number;
  /**
   * Multiplied by the source's attack power (physical) or spell power
   * (magical) and added to `baseAmount`.
   */
  readonly powerCoefficient?: number;
  /** Defaults to true. Periodic ticks in some games cannot crit. */
  readonly canCrit?: boolean;
  /** True for damage-over-time ticks. Recorded in telemetry. */
  readonly periodic?: boolean;
}

/** The fully resolved outcome of a damage request. */
export interface DamageResolution {
  /** Damage before mitigation and absorbs, after power scaling and crit. */
  readonly raw: number;
  /** Removed by armor or resistance. */
  readonly mitigated: number;
  /** Removed by shields. */
  readonly absorbed: number;
  /** What reached the target's health, including the overkill portion. */
  readonly amount: number;
  readonly critical: boolean;
}

/*
 * The pipeline, in order:
 *
 *   base + power scaling  ->  critical strike  ->  attacker modifiers
 *   ->  target modifiers  ->  armor / resistance  ->  absorbs  ->  final
 *
 * Each step below is a pure function of its inputs. They are exported
 * individually so a formula change can be unit-tested in isolation, without
 * standing up a whole simulation.
 */

/** Flat damage plus the attacker's power contribution. */
export function scaleByPower(request: DamageRequest): number {
  const coefficient = request.powerCoefficient ?? 0;
  if (coefficient === 0) return request.baseAmount;

  const stats = request.source.stats.effective;
  const power = isPhysical(request.school) ? stats.attackPower : stats.spellPower;
  return request.baseAmount + coefficient * power;
}

/** Whether this hit crits, given the attacker's stats and the shared RNG. */
export function rollCritical(source: Combatant, rng: RNG, canCrit: boolean): boolean {
  if (!canCrit) return false;
  return rng.rollChance(critChanceFrom(source.stats.effective));
}

export function applyCriticalMultiplier(amount: number, critical: boolean): number {
  return critical ? amount * CRITICAL_STRIKE_MULTIPLIER : amount;
}

/**
 * Fraction of a physical hit removed by armor.
 *
 * Diminishing by construction: doubling armor does not halve damage again.
 * Magical schools return 0 here until resistances are implemented.
 */
export function armorReduction(armor: number, school: DamageSchool): number {
  if (!isPhysical(school) || armor <= 0) return 0;
  const reduction = armor / (armor + ARMOR_CONSTANT);
  return Math.min(MAX_ARMOR_REDUCTION, reduction);
}

/**
 * Run a damage request through the whole pipeline without applying it.
 *
 * Pure apart from consuming one RNG roll, which makes it safe to call from
 * tests and from a future "what would this hit for?" tooltip.
 */
export function resolveDamage(request: DamageRequest, rng: RNG): DamageResolution {
  const { source, target, school } = request;

  const scaled = scaleByPower(request);
  const critical = rollCritical(source, rng, request.canCrit ?? true);
  const afterCrit = applyCriticalMultiplier(scaled, critical);

  const attackerMultiplier =
    source.damageDoneMultiplier * versatilityMultiplierFrom(source.stats.effective);
  const afterAttacker = afterCrit * attackerMultiplier;

  const afterTarget = afterAttacker * target.damageTakenMultiplier;

  const reduction = armorReduction(target.stats.get('armor'), school);
  const mitigated = afterTarget * reduction;
  const afterMitigation = afterTarget - mitigated;

  // Absorb shields are not implemented yet; the field exists so that adding
  // them later does not change this function's shape or its telemetry.
  const absorbed = 0;

  const amount = Math.max(0, afterMitigation - absorbed);

  return {
    raw: afterTarget,
    mitigated,
    absorbed,
    amount,
    critical,
  };
}

/**
 * Resolve a damage request, apply it to the target, and emit telemetry.
 *
 * This is the only function that reduces health from damage. Everything about
 * a hit, including the death that may follow, flows through here.
 */
export function dealDamage(
  context: SimulationContext,
  request: DamageRequest,
): DamageResolution {
  const resolution = resolveDamage(request, context.rng);
  const { target, source } = request;

  const healthBefore = target.health.current;
  target.health.drain(resolution.amount);

  // Computed from the health that was there, not from the difference the drain
  // reported. Subtracting two large floats leaves residue, which showed up as a
  // fraction of a point of "overkill" on a target at full health.
  const overkill = Math.max(0, resolution.amount - healthBefore);

  context.telemetry.emit({
    type: 'damage',
    timestamp: context.clock.now(),
    sourceId: source.id,
    targetId: target.id,
    abilityId: request.abilityId,
    abilityName: request.abilityName,
    school: request.school,
    amount: resolution.amount,
    critical: resolution.critical,
    mitigated: resolution.mitigated,
    absorbed: resolution.absorbed,
    overkill,
    periodic: request.periodic ?? false,
  });

  if (healthBefore > 0 && target.health.isEmpty) {
    context.killCombatant(target, source);
  }

  return resolution;
}
