import type { Milliseconds } from '../time';
import type { AttackTableKind } from '../combat/attackTable';
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

/**
 * A channel cancelled part-way through, and what it was cancelled FOR.
 *
 * ----------------------------------------------------------------------------
 * WITHOUT THIS THE COMBAT LOG LIES BY OMISSION. A six-second Wrack that ends
 * after two seconds emits two ticks and then nothing, which reads identically
 * to a channel that was never started -- and telemetry is the single source of
 * truth here, so the thing that happened has to be in the stream rather than
 * inferable from a gap in it.
 *
 * `interruptedFor` IS THE HALF WORTH HAVING. "A channel was cut short" is a
 * curiosity; "a channel was cut short to cast Corruption" is what says the
 * rotation rule did the thing it was asked to do, and it is how the three cases
 * the ruleset owner named are counted rather than assumed.
 * ----------------------------------------------------------------------------
 */
export interface ChannelInterruptedEvent extends TelemetryBase {
  readonly type: 'channel_interrupted';
  readonly sourceId: string;
  readonly abilityId: string;
  readonly abilityName: string;
  /** The ability the rotation cancelled it for. */
  readonly interruptedFor: string;
  /** Ticks that had already landed, out of the channel's full count. */
  readonly ticksDelivered: number;
  readonly ticksTotal: number;
}

export interface DamageTelemetryEvent extends TelemetryBase {
  readonly type: 'damage';
  readonly sourceId: string;
  readonly targetId: string;
  readonly abilityId?: string;
  readonly abilityName: string;
  readonly school: DamageSchool;
  /**
   * The table that resolved it, or for a tick the one that applied it. Read by
   * threat, where "your spells" includes a DoT's ticks. Absent for damage that
   * names neither.
   */
  readonly attackTable?: AttackTableKind;
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
  /**
   * The signed share of the hit a partial resist took -- 0.2 resisted 20%,
   * -0.1 is 10% added by Spell Piercing. Absent when none was rolled.
   */
  readonly resistedShare?: number;
  /** Removed by shields. */
  readonly absorbed: number;
  /** Portion of `amount` that exceeded the target's remaining health. */
  readonly overkill: number;
  /**
   * The target's health straight after the hit, before any death is processed
   * (round 53). What the health timeline reads -- the same arrangement as a
   * resource event's `current`, so the line is the level that happened rather
   * than a sum of gains and losses.
   */
  readonly targetHealth?: number;
  /** True for periodic (damage-over-time) ticks. */
  readonly periodic: boolean;
  /**
   * The crit chance this attack rolled against, as a fraction.
   *
   * --------------------------------------------------------------------------
   * THE EFFECTIVE FIGURE, after the rating, the per-ability crit, the
   * per-school crit, the per-table crit and the target's contribution -- which
   * is the only version of it worth recording, and is NOT the stat block's.
   *
   * IT MAKES A CRIT RATE AUDITABLE, which nothing here could do before. The
   * Results panel prints crits over attempts and there was no expectation to
   * hold it against: the sheet's figure was both wrong and the wrong quantity.
   * `probe_revelation.ts` reads it to compute a proc's expected rate per
   * event, because the rate now varies by spell.
   *
   * ZERO FOR AN ATTACK THAT COULD NOT CRIT, which `cannotCrit` and a table
   * with no crit slice both produce.
   * --------------------------------------------------------------------------
   */
  readonly critChance?: number;
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
  /** The target's health straight after the heal (round 53). */
  readonly targetHealth?: number;
  readonly periodic: boolean;
  /**
   * The heal came from nobody in the fight -- the assumed tank healer, or a
   * heal the owner ruled scales with nothing about its source. Its `sourceId`
   * is a stand-in, so a reader that credits a healer must skip it (round 52).
   */
  readonly external?: boolean;
  /** Only a heal that says so threatens. See `HealRequest.threatens`. */
  readonly threatens?: boolean;
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

/**
 * A cast spent an aura's charge.
 *
 * ==============================================================================
 * WHAT IT IS FOR: "list in the resources section what clearcasting was used
 * on", the ruleset owner's ask for Elemental Focus, Arcane Concentration and
 * Omen of Clarity.
 *
 * NOTHING ELSE IN THE STREAM CAN ANSWER IT, which is why this exists rather
 * than being derived. A free cast spends nothing, so it emits NO
 * `resource_spent` event at all -- the saving is invisible by construction, and
 * an `aura_removed` says the charge went without saying what took it. Reading
 * the cast that happens to share the timestamp would be guessing, and it would
 * be wrong whenever two things land in one millisecond.
 *
 * `saved` IS THE POINT AND NOT A DECORATION. "Clearcasting was used on Shred
 * nine times" is a cast count; "and saved 378 energy" is the figure that says
 * whether the proc is worth anything, and it is the one a resource economy can
 * actually be audited against. It is the difference between what the ability
 * declares and what `resolveCast` worked out, so it is zero for a charge spent
 * on something free -- which is itself worth seeing, because it is a charge
 * thrown away.
 *
 * EMITTED FOR EVERY CAST-MODIFIER CHARGE, not only Clearcasting. Eclipse,
 * Maelstrom Weapon, Missile Barrage and Inner Focus all spend one, and a sink
 * that reported three of them and not the fourth would be the "general field
 * read by only some of its rules" failure in telemetry.
 * ==============================================================================
 */
export interface CastChargeEvent extends TelemetryBase {
  readonly type: 'cast_charge_spent';
  readonly actorId: string;
  readonly auraId: string;
  readonly auraName: string;
  readonly abilityId: string;
  readonly abilityName: string;
  /** The pool the saving came out of, absent when the ability costs nothing. */
  readonly resource?: ResourceType;
  /** What the charge saved: the declared cost less what was actually paid. */
  readonly saved: number;
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
  /** Healing power (round 52). */
  readonly healingPower: number;
  /**
   * Per school, for the schools that read MORE than the blind pool: the figure
   * `dealDamage` actually uses. Already includes the blind pool, and empty for
   * a character with no school-scoped spell power at all.
   */
  readonly spellPowerBySchool: Readonly<Partial<Record<DamageSchool, number>>>;
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
  /**
   * The combatant was stood back up at full health in the same instant (round
   * 53) -- `revivesOnDeath`. Absent for a death that stays dead.
   */
  readonly revived?: boolean;
}

/**
 * Threat a combatant generated against a target, derived by `ThreatTracker`
 * from the event that caused it. See `engine/combat/threat.ts`.
 */
export interface ThreatTelemetryEvent extends TelemetryBase {
  readonly type: 'threat';
  readonly sourceId: string;
  readonly targetId: string;
  /** After every modifier. Negative is threat removed. */
  readonly amount: number;
  /** Damage, an ability's flat amount without damage, or a resource gained. */
  readonly cause: 'damage' | 'ability' | 'resource' | 'healing';
  readonly abilityId?: string;
  readonly abilityName: string;
}

export type TelemetryEvent =
  | CombatStartEvent
  | CombatEndEvent
  | CastEvent
  | ChannelInterruptedEvent
  | DamageTelemetryEvent
  | HealTelemetryEvent
  | AuraTelemetryEvent
  | CastChargeEvent
  | ResourceTelemetryEvent
  | StatSampleEvent
  | DeathTelemetryEvent
  | ThreatTelemetryEvent;

export type TelemetryEventType = TelemetryEvent['type'];
