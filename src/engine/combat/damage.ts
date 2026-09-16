import type { Combatant, ResourceGeneration } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { DamageSchool } from './DamageSchool';
import { isPhysical } from './DamageSchool';
import type { AttackOutcome, AttackResolution, AttackTableKind } from './attackTable';
import { resolveAttackTable } from './attackTable';
import {
  ARMOR_CONSTANT,
  MAX_ARMOR_REDUCTION,
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
  /**
   * Which combat table resolves this attack.
   *
   * Omitted means the damage lands unconditionally with no roll: a
   * damage-over-time tick, whose landing was already decided when the effect
   * was applied.
   */
  readonly attackTable?: AttackTableKind;
  /** True for damage-over-time ticks. Recorded in telemetry. */
  readonly periodic?: boolean;
}

/** The fully resolved outcome of a damage request. */
export interface DamageResolution {
  /** What the combat table produced. `hit` when no table was consulted. */
  readonly outcome: AttackOutcome;
  /** True when the attack was missed, dodged or parried. */
  readonly avoided: boolean;
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
 * The attack table result for a request, or a guaranteed hit when it has no
 * table.
 */
function rollTable(
  request: DamageRequest,
  context: SimulationContext,
): AttackResolution {
  if (!request.attackTable) {
    return { outcome: 'hit', avoided: false, damageMultiplier: 1, rolls: [] };
  }
  const chances = context.attackChances(request.attackTable, request.source, request.target);
  return resolveAttackTable(request.attackTable, chances, context.rng);
}

/**
 * Run a damage request through the whole pipeline without applying it.
 *
 * `attack` is the already-rolled combat table result, so the roll and the
 * damage calculation stay separable: an ability can roll the table once and use
 * the outcome for something other than damage.
 */
export function resolveDamage(
  request: DamageRequest,
  attack: AttackResolution,
): DamageResolution {
  const { source, target, school } = request;

  // A missed, dodged or parried attack does no damage and skips the rest of
  // the pipeline entirely.
  if (attack.avoided) {
    return {
      outcome: attack.outcome,
      avoided: true,
      raw: 0,
      mitigated: 0,
      absorbed: 0,
      amount: 0,
      critical: false,
    };
  }

  const scaled = scaleByPower(request);
  const critical = attack.outcome === 'crit';
  const afterCrit = scaled * attack.damageMultiplier;

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
    outcome: attack.outcome,
    avoided: false,
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
  const attack = rollTable(request, context);
  const resolution = resolveDamage(request, attack);
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
    outcome: resolution.outcome,
    critical: resolution.critical,
    mitigated: resolution.mitigated,
    absorbed: resolution.absorbed,
    overkill,
    periodic: request.periodic ?? false,
  });

  // Taking damage can generate resource: this is how a warrior builds rage
  // from being hit. Proportional to damage actually taken, so an avoided
  // attack generates nothing.
  grantGeneratedResource(context, target, target.resourceOnDamageTaken, resolution.amount);

  if (healthBefore > 0 && target.health.isEmpty) {
    context.killCombatant(target, source);
  }

  return resolution;
}

/**
 * Grant a resource generation award, flat and damage-proportional parts alike.
 *
 * Shared by damage dealt and damage taken. A zero or negative award is skipped
 * rather than emitting a telemetry event for nothing.
 */
export function grantGeneratedResource(
  context: SimulationContext,
  actor: Combatant,
  generation: ResourceGeneration | undefined,
  damage: number,
): void {
  if (!generation) return;

  const amount =
    (generation.flat ?? 0) + (generation.perDamage ?? 0) * Math.max(0, damage);
  if (amount <= 0) return;

  context.grantResource(actor, generation.resource, amount);
}
