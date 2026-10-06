import type { Milliseconds } from '../time';
import type { AttackOutcome } from '../combat/attackTable';
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
  /**
   * What the combat table produced: hit, crit, glance, miss, dodge, parry or
   * crush. `hit` for damage that never rolled a table, such as a DoT tick.
   */
  readonly outcome: AttackOutcome;
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
  /**
   * WHAT moved the resource: an ability id for a spend, and for a gain the
   * mechanism that produced it -- an auto attack, damage taken, a proc, a
   * regeneration tick.
   *
   * Without this a rage economy cannot be audited at all. "83 rage spent" says
   * nothing about whether Improved Heroic Strike is working; "Heroic Strike, 12
   * uses, 156 rage" says it directly. The analyzers build both rage breakdowns
   * out of this one field.
   *
   * Optional only so that a caller with genuinely nothing to say can omit it,
   * and those show as "unattributed" rather than being folded into something
   * that looks accounted for.
   */
  readonly source?: string;
  /** Human-readable form of `source`, for a breakdown a person reads. */
  readonly sourceName?: string;
}

/**
 * What the character's stats WERE at one instant.
 *
 * ------------------------------------------------------------------------------
 * A STAT IS A STEP FUNCTION OVER A FIGHT, so an average over one needs the
 * steps. Attack power, spell power and haste all move when a buff lands and
 * move back when it drops -- Slice and Dice, Flurry, Rapid Fire, a trinket proc,
 * a raid buff -- and the character sheet shows only the value at the pull,
 * before the character's own opener has landed.
 *
 * EMITTED ON CHANGE, NOT ON A TIMER, which is what makes it exact and cheap.
 * A fixed cadence would need to be fine enough to catch a short proc and would
 * then cost thousands of events a fight; emitting only when a sampled value
 * actually moves costs one event per buff edge, and the analyzer integrates
 * value x duration between them. `BatchTotals` closes the final window at the
 * end of the iteration, exactly as it already does for aura uptime -- a buff
 * still up when the fight ends never emits a removal.
 *
 * EVERY IN-FIGHT STAT CHANGE COMES FROM AN AURA. Equipment and talents are
 * settled before the pull and `statFromStat` conversions are re-derived from
 * primaries that only an aura moves, so sampling at every aura edge is complete
 * rather than approximate. A future effect that moves a stat by some other
 * route must sample too, or it will be averaged as though it never happened.
 * ------------------------------------------------------------------------------
 */
export interface StatSampleEvent extends TelemetryBase {
  readonly type: 'stat_sample';
  readonly actorId: string;
  readonly attackPower: number;
  readonly rangedAttackPower: number;
  /** School-BLIND spell power, which is what the character sheet's row shows. */
  readonly spellPower: number;
  /**
   * The swing-speed multiplier, not the rating: 1.3 is "30% faster".
   *
   * Derived through `hasteMultiplierFrom`, the one function the swing timer
   * divides by -- so every attack-speed effect in the game layer is in here by
   * construction, because they are all `hasteRating` modifiers. Reporting the
   * rating instead would be a number nobody can read.
   */
  readonly hasteMultiplier: number;
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
  | StatSampleEvent
  | DeathTelemetryEvent;

export type TelemetryEventType = TelemetryEvent['type'];
