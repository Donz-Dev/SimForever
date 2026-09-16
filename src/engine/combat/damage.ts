import type { Combatant, ResourceGeneration, WeaponSlot } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { DamageSchool } from './DamageSchool';
import { isPhysical } from './DamageSchool';
import type { AttackOutcome, AttackResolution, AttackTableKind } from './attackTable';
import { resolveAttackTable } from './attackTable';
import { armorConstantForLevel, versatilityMultiplierFrom } from './ratings';
import type { AttackEvent } from './reactions';
import { runReactions } from './reactions';

/** Damage varies this much either side of a weapon's base, unless overridden. */
export const DEFAULT_DAMAGE_VARIANCE = 0.15;

/**
 * An ability's scaling with the weapon actually equipped.
 *
 * A great many melee abilities are "a swing, plus something". Rather than every
 * one of them reaching for the weapon and reimplementing the roll, they declare
 * the slot and the pipeline supplies
 *
 *     weapon base damage (rolled) + weapon's power coefficient * attack power
 *
 * The coefficient lives on the weapon because it is derived from the weapon's
 * speed, and how it is derived is a ruleset number that belongs in `game`.
 *
 * The hand's damage multiplier — the dual-wield off-hand penalty — is applied
 * ONCE to the finished total, after the ability's own flat damage has been
 * added. Applying it to the weapon portion alone would leave an off-hand
 * Mortal Strike dealing full value for its 160, which is not how the ruleset
 * reads.
 */
export interface WeaponScaling {
  readonly slot: WeaponSlot;
  /**
   * Fraction of the weapon's damage this ability deals. Defaults to 1.
   *
   * Forever's Spearing Strike is 0.4.
   */
  readonly fraction?: number;
}

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
   * Scaling with the equipped weapon, for abilities that deal weapon damage.
   *
   * Added on top of `baseAmount`, so Mortal Strike is `baseAmount: 160` plus
   * full weapon scaling, exactly as the ruleset states it.
   */
  readonly weaponScaling?: WeaponScaling;
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
  /**
   * Which weapon produced this, when it matters.
   *
   * A dual-wielder's hands are not equivalent: the off-hand has its own
   * miss chance and weapon skill, so the combat table needs to know which
   * one swung.
   */
  readonly weaponSlot?: WeaponSlot;
  /**
   * Whether armor reduces this damage.
   *
   * Defaults to true for physical damage and false otherwise. Set it
   * explicitly for physical damage that ignores armor, such as a bleed:
   * armor applies to hit-based physical damage, and that is decided per
   * event rather than inferred from the school alone.
   */
  readonly appliesArmor?: boolean;
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

/**
 * The weapon's contribution to an ability that scales with it, before the
 * hand's damage multiplier.
 *
 * `roll` is the already-drawn damage variance multiplier, kept as a parameter
 * so this stays a pure function and can be checked against a hand-computed
 * number without an RNG.
 *
 * A slot holding no weapon contributes nothing rather than throwing: a style
 * whose ranged slot is empty can still cast an ability that would have used
 * it, and the missing damage is visible in the results.
 */
export function weaponDamageFor(request: DamageRequest, roll: number): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 0;

  const weapon = request.source.weapons[scaling.slot];
  if (!weapon) return 0;

  const attackPower = request.source.stats.effective.attackPower;
  const base = weapon.baseDamage * roll;
  const power = (weapon.powerCoefficient ?? 0) * attackPower;

  return (base + power) * (scaling.fraction ?? 1);
}

/**
 * The multiplier for the hand this ability swings with, or 1 when it does not
 * use a weapon at all.
 *
 * Read from the weapon rather than the request so that the off-hand penalty
 * cannot be forgotten at a call site.
 */
export function handMultiplier(request: DamageRequest): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 1;
  return request.source.weapons[scaling.slot]?.damageMultiplier ?? 1;
}

/**
 * Flat damage, the attacker's power contribution, and the weapon's damage.
 *
 * The hand's multiplier applies to the finished sum, not to the weapon portion
 * alone. See `WeaponScaling`.
 */
export function scaleByPower(request: DamageRequest, weaponDamage = 0): number {
  const coefficient = request.powerCoefficient ?? 0;

  let total = request.baseAmount + weaponDamage;
  if (coefficient !== 0) {
    const stats = request.source.stats.effective;
    const power = isPhysical(request.school) ? stats.attackPower : stats.spellPower;
    total += coefficient * power;
  }

  return total * handMultiplier(request);
}

/**
 * The fraction of damage that gets THROUGH armor:
 *
 *     multiplier = 1 - armor / (400 + 85 * level + armor)
 *
 * A 3731-armor level 63 target lets 60.67% through, which is the familiar
 * "just under 40% reduction" against a raid boss.
 *
 * Note the naming carefully. The source calls this expression
 * `Armor_Reduction`, but what it computes is the multiplier, not the amount
 * removed. Reading it as the reduction would turn a 39% reduction into a 61%
 * one, which is exactly the sort of error that produces plausible numbers.
 */
export function armorDamageMultiplier(armor: number, targetLevel: number): number {
  if (armor <= 0) return 1;
  return 1 - armor / (armorConstantForLevel(targetLevel) + armor);
}

/** The fraction of damage armor removes. The complement of the multiplier. */
export function armorReduction(armor: number, targetLevel: number): number {
  return 1 - armorDamageMultiplier(armor, targetLevel);
}

/** Whether armor applies to a request, defaulting to "yes if physical". */
export function appliesArmor(request: DamageRequest): boolean {
  return request.appliesArmor ?? isPhysical(request.school);
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
  const chances = context.attackChances(
    request.attackTable,
    request.source,
    request.target,
    { slot: request.weaponSlot },
  );
  return resolveAttackTable(request.attackTable, chances, context.rng);
}

/** Draw the weapon's damage variance and resolve its contribution. */
function rollWeaponDamage(
  request: DamageRequest,
  context: SimulationContext,
): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 0;

  const weapon = request.source.weapons[scaling.slot];
  if (!weapon) return 0;

  const variance = weapon.damageVariance ?? DEFAULT_DAMAGE_VARIANCE;
  const roll = context.rng.nextFloat(1 - variance, 1 + variance);
  return weaponDamageFor(request, roll);
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
  weaponDamage = 0,
): DamageResolution {
  const { source, target } = request;

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

  const scaled = scaleByPower(request, weaponDamage);
  const critical = attack.outcome === 'crit';
  const afterCrit = scaled * attack.damageMultiplier;

  const attackerMultiplier =
    source.damageDoneMultiplier * versatilityMultiplierFrom(source.stats.effective);
  const afterAttacker = afterCrit * attackerMultiplier;

  const afterTarget = afterAttacker * target.damageTakenMultiplier;

  const reduction = appliesArmor(request)
    ? armorReduction(target.stats.get('armor'), target.level)
    : 0;
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
  // Drawn BEFORE the table roll, and not drawn at all for an ability with no
  // weapon scaling. Both matter: the order fixes the RNG sequence for a seeded
  // run, and an ability that never touches the weapon must not consume a
  // number and shift every roll after it.
  const weaponDamage = rollWeaponDamage(request, context);
  const attack = rollTable(request, context);
  const resolution = resolveDamage(request, attack, weaponDamage);
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

  // Reactions run last, after the damage has landed, the telemetry has been
  // emitted and any death has been processed. A reaction therefore sees a
  // settled world rather than a half-applied one.
  //
  // Only attacks that consulted a combat table qualify: an outcome is what a
  // reaction keys off, and damage with no table has no meaningful outcome.
  // Periodic ticks are excluded too — a bleed ticking is not an attack anyone
  // parries.
  if (request.attackTable && !request.periodic) {
    const event: AttackEvent = {
      attacker: source,
      defender: target,
      outcome: resolution.outcome,
      abilityId: request.abilityId,
      abilityName: request.abilityName,
      amount: resolution.amount,
      weaponSlot: request.weaponSlot,
      critical: resolution.critical,
    };
    runReactions(context, source, 'dealt', event);
    runReactions(context, target, 'taken', event);
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
