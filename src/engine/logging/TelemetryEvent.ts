import type { Milliseconds } from '../time';
import type { DamageSchool } from '../combat/DamageSchool';
import type { ResourceType } from '../resources';

/**
 * The machine-readable record of everything that happened in a fight.
 *
 * This is the single source of truth for analysis. Nothing in the engine keeps
 * a private running total of damage or buff uptime; it emits an event here and
 * the analysis layer derives every statistic from the stream. That rule is
 * what stops "the DPS number" and "the damage breakdown" from disagreeing.
 *
 * The events form a discriminated union on `type`. Narrowing on that field
 * gives full type safety in a switch, so adding a new event type surfaces
 * every place that needs updating.
 */

interface TelemetryBase {
  /** Engine time, in milliseconds. */
  readonly timestamp: Milliseconds;
}

export interface CombatStartEvent extends TelemetryBase {
  readonly type: 'combat_start';
  readonly seed: number;
}

export interface CombatEndEvent extends TelemetryBase {
  readonly type: 'combat_end';
  readonly reason: CombatEndReason;
}

export type CombatEndReason = 'duration_expired' | 'all_enemies_dead' | 'all_players_dead' | 'no_events';

export interface CastEvent extends TelemetryBase {
  readonly type: 'cast';
  readonly sourceId: string;
  readonly targetId?: string;
  readonly abilityId: string;
  readonly abilityName: string;
}

export interface DamageTelemetryEvent extends TelemetryBase {
  readonly type: 'damage';
  readonly sourceId: string;
  readonly targetId: string;
  readonly abilityId?: string;
  readonly abilityName: string;
  readonly school: DamageSchool;
  /** Damage actually applied to the target's health. */
  readonly amount: number;
  readonly critical: boolean;
  /** Removed by armor or resistance before absorbs. */
  readonly mitigated: number;
  /** Removed by shields. */
  readonly absorbed: number;
  /** Portion of `amount` that exceeded the target's remaining health. */
  readonly overkill: number;
  /** True for periodic (damage-over-time) ticks. */
  readonly periodic: boolean;
}

export interface HealTelemetryEvent extends TelemetryBase {
  readonly type: 'heal';
  readonly sourceId: string;
  readonly targetId: string;
  readonly abilityId?: string;
  readonly abilityName: string;
  /** Healing that actually restored health. */
  readonly amount: number;
  readonly critical: boolean;
  /** Portion that exceeded the target's missing health. */
  readonly overhealing: number;
  readonly periodic: boolean;
}

export interface AuraTelemetryEvent extends TelemetryBase {
  readonly type: 'aura_applied' | 'aura_refreshed' | 'aura_stacks_changed' | 'aura_removed';
  readonly sourceId: string;
  readonly targetId: string;
  readonly auraId: string;
  readonly auraName: string;
  readonly stacks: number;
  readonly isDebuff: boolean;
}

export interface ResourceTelemetryEvent extends TelemetryBase {
  readonly type: 'resource_spent' | 'resource_gained';
  readonly actorId: string;
  readonly resource: ResourceType;
  readonly amount: number;
  /** Amount lost to the cap on a gain. Always 0 for a spend. */
  readonly wasted: number;
  readonly current: number;
}

export interface DeathTelemetryEvent extends TelemetryBase {
  readonly type: 'death';
  readonly actorId: string;
  readonly killerId?: string;
}

export type TelemetryEvent =
  | CombatStartEvent
  | CombatEndEvent
  | CastEvent
  | DamageTelemetryEvent
  | HealTelemetryEvent
  | AuraTelemetryEvent
  | ResourceTelemetryEvent
  | DeathTelemetryEvent;

export type TelemetryEventType = TelemetryEvent['type'];
