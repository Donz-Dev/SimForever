import type { Combatant } from '../actors/Combatant';
import type { ResourceTelemetryEvent, TelemetryEvent } from '../logging/TelemetryEvent';
import type { TelemetrySink } from '../logging/Telemetry';
import type { ResourceType } from '../resources/Resource';
import type { DamageSchool } from './DamageSchool';
import type { AttackTableKind } from './attackTable';
import { AVOIDED_OUTCOMES } from './attackTable';

/*
 * ==============================================================================
 * THREAT. One point of damage is one point of threat, scaled by everything the
 * character carries that says otherwise, plus a flat amount some abilities add.
 * (Round 47, the owner's feature; the numbers are `game/combat/threat.ts`.)
 *
 *   threat = (damage x ability multiplier + ability flat) x every modifier
 *
 * EVERY MODIFIER MULTIPLIES, by the owner's ruling -- a stance, a form, a
 * talent, an enchant and Salvation are each a factor, never summed. The flat
 * part sits INSIDE the modifiers, which is how both Forever simulators fold it:
 * Defensive Stance raises a Heroic Strike's flat threat as well as its damage.
 *
 * ONLY A LANDED ATTACK THREATENS. A miss, a dodge and a parry deal nothing and
 * add no flat either. The damage is the amount applied, after armor and
 * resistance -- post-mitigation, as both simulators read it.
 *
 * DERIVED FROM THE TELEMETRY STREAM, not threaded through combat code. The
 * engine already emits every damage and resource event; `ThreatTracker` sits
 * between the engine and its sink, reads each one as it is emitted -- when the
 * carrier's stance, auras and stats are exactly what produced it -- and emits a
 * `threat` event after it. It holds no totals: the analyzers sum, as they do
 * for damage. And it draws no random number, so turning threat on cannot
 * change a single decision in a fight.
 * ==============================================================================
 */

/**
 * What a threat modifier is asked about.
 *
 * `table` is the attack table that resolved the damage, or for a tick the one
 * that applied it -- so "your spells" includes a Corruption tick.
 */
export interface ThreatContext {
  readonly school?: DamageSchool;
  readonly table?: AttackTableKind;
  readonly abilityId?: string;
  /** Threat that is not from damage: a resource gain or a debuff's flat. */
  readonly kind: 'damage' | 'ability' | 'resource' | 'healing';
}

/**
 * One multiplicative factor on a combatant's threat.
 *
 * Every clause narrows it; an unscoped one is "all threat you generate". A
 * RESOURCE gain names no school, table or ability, so only an unscoped
 * modifier reaches it -- a stance does, Righteous Fury's Holy clause does not.
 */
export interface ThreatModifier {
  /** 1.3 for +30%, 0.7 for -30%. */
  readonly multiplier: number;
  readonly schools?: readonly DamageSchool[];
  readonly tables?: readonly AttackTableKind[];
  readonly abilityIds?: readonly string[];
  /** Only while the carrier has this aura. */
  readonly whileAura?: string;
  /** Only while the carrier does NOT have this aura. */
  readonly whileNotAura?: string;
}

function applies(modifier: ThreatModifier, carrier: Combatant, context: ThreatContext): boolean {
  if (modifier.schools && (!context.school || !modifier.schools.includes(context.school))) {
    return false;
  }
  if (modifier.tables && (!context.table || !modifier.tables.includes(context.table))) {
    return false;
  }
  if (
    modifier.abilityIds &&
    (!context.abilityId || !modifier.abilityIds.includes(context.abilityId))
  ) {
    return false;
  }
  if (modifier.whileAura && !carrier.auras.has(modifier.whileAura)) return false;
  if (modifier.whileNotAura && carrier.auras.has(modifier.whileNotAura)) return false;
  return true;
}

/** The product of every modifier the carrier has, from itself and its auras. */
export function threatMultiplierFor(carrier: Combatant, context: ThreatContext): number {
  let product = 1;
  for (const modifier of carrier.threatModifiers) {
    if (applies(modifier, carrier, context)) product *= modifier.multiplier;
  }
  for (const aura of carrier.auras.active) {
    for (const modifier of aura.definition.threatModifiers ?? []) {
      if (applies(modifier, carrier, context)) product *= modifier.multiplier;
    }
  }
  return product;
}

/** An ability's own threat: a multiplier on its damage and a flat addition. */
export interface AbilityThreat {
  readonly multiplier?: number;
  /** Added once per landed, non-periodic hit. */
  readonly flat?: number;
}

/** How a resource gain threatens. */
export interface ResourceThreat {
  readonly perPoint: number;
  /** Mana: 0.5 a point, untouched by stance, form or talent. */
  readonly ignoresModifiers?: boolean;
}

/**
 * The ruleset's numbers, injected the way `attackChances` is. Absent means the
 * fight tracks no threat at all, which is what an engine test wants.
 */
export interface ThreatRules {
  /** An ability's own threat, by the id on its damage event. */
  readonly ability?: (abilityId: string, source: Combatant) => AbilityThreat | undefined;
  /** Threat per point of a resource gained from the named source, if any. */
  readonly resource?: (
    resource: ResourceType,
    sourceId: string | undefined,
  ) => ResourceThreat | undefined;
  /**
   * Threat per point of EFFECTIVE healing -- overhealing threatens nothing --
   * split across every enemy in the fight, and scaled by the healer's threat
   * modifiers (round 52). Absent means a heal threatens nothing.
   */
  readonly healingPerPoint?: number;
}

/**
 * Reads every event on its way to the sink and emits the threat it carries.
 *
 * It needs the LIVE combatants, because a modifier is a question about the
 * carrier at the instant of the event -- whether Defensive Stance is up,
 * whether Righteous Fury is. So it is built by `Simulation` with a lookup.
 */
export class ThreatTracker implements TelemetrySink {
  constructor(
    private readonly sink: TelemetrySink,
    private readonly rules: ThreatRules,
    private readonly combatant: (id: string) => Combatant | undefined,
    private readonly enemiesOf: (actor: Combatant) => readonly Combatant[],
  ) {}

  emit(event: TelemetryEvent): void {
    this.sink.emit(event);
    if (event.type === 'damage') this.fromDamage(event);
    else if (event.type === 'resource_gained') this.fromResource(event);
    else if (event.type === 'heal') this.fromHeal(event);
  }

  /** Threat that is not from damage, granted by content -- Sunder Armor's flat. */
  generate(
    timestamp: number,
    source: Combatant,
    target: Combatant,
    amount: number,
    abilityId: string | undefined,
    abilityName: string,
  ): void {
    if (amount === 0) return;
    const scaled = amount * threatMultiplierFor(source, { kind: 'ability', abilityId });
    this.send(timestamp, source.id, target.id, scaled, 'ability', abilityId, abilityName);
  }

  private fromDamage(event: Extract<TelemetryEvent, { type: 'damage' }>): void {
    if (AVOIDED_OUTCOMES.has(event.outcome)) return;
    if (event.noThreat) return;
    const source = this.combatant(event.sourceId);
    if (!source) return;
    const own = event.abilityId ? this.rules.ability?.(event.abilityId, source) : undefined;
    const flat = event.periodic ? 0 : (own?.flat ?? 0);
    const base = event.amount * (own?.multiplier ?? 1) + flat;
    if (base === 0) return;
    const multiplier = threatMultiplierFor(source, {
      kind: 'damage',
      school: event.school,
      table: event.attackTable,
      abilityId: event.abilityId,
    });
    this.send(
      event.timestamp,
      source.id,
      event.targetId,
      base * multiplier,
      'damage',
      event.abilityId,
      event.abilityName,
    );
  }

  private fromResource(event: ResourceTelemetryEvent): void {
    if (event.amount <= 0) return;
    const rule = this.rules.resource?.(event.resource, event.source);
    if (!rule || rule.perPoint === 0) return;
    const actor = this.combatant(event.actorId);
    if (!actor) return;
    const enemies = this.enemiesOf(actor);
    if (enemies.length === 0) return;
    const multiplier = rule.ignoresModifiers
      ? 1
      : threatMultiplierFor(actor, { kind: 'resource' });
    // Split across every enemy in the fight, as both simulators do.
    const each = (event.amount * rule.perPoint * multiplier) / enemies.length;
    for (const enemy of enemies) {
      this.send(event.timestamp, actor.id, enemy.id, each, 'resource', event.source, event.sourceName ?? event.resource);
    }
  }

  /** A heal's threat, split across the healer's enemies like a resource gain's. */
  private fromHeal(event: Extract<TelemetryEvent, { type: 'heal' }>): void {
    const perPoint = this.rules.healingPerPoint ?? 0;
    // Opt-in: only a healer's spells threaten. See `HealRequest.threatens`.
    if (perPoint === 0 || event.amount <= 0 || !event.threatens) return;
    const healer = this.combatant(event.sourceId);
    if (!healer || healer.kind !== 'player') return;
    const enemies = this.enemiesOf(healer);
    if (enemies.length === 0) return;
    const each =
      (event.amount * perPoint * threatMultiplierFor(healer, { kind: 'healing', abilityId: event.abilityId })) /
      enemies.length;
    for (const enemy of enemies) {
      this.send(event.timestamp, healer.id, enemy.id, each, 'healing', event.abilityId, event.abilityName);
    }
  }

  private send(
    timestamp: number,
    sourceId: string,
    targetId: string,
    amount: number,
    cause: 'damage' | 'ability' | 'resource' | 'healing',
    abilityId: string | undefined,
    abilityName: string,
  ): void {
    this.sink.emit({
      type: 'threat',
      timestamp,
      sourceId,
      targetId,
      amount,
      cause,
      ...(abilityId !== undefined ? { abilityId } : {}),
      abilityName,
    });
  }
}
