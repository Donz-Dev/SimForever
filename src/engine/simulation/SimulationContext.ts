import type { Ability } from '../abilities/Ability';
import type { CastCheck } from '../abilities/casting';
import type { CastRejection } from '../abilities/casting';
import type { Combatant, WeaponSlot } from '../actors/Combatant';
import type {
  AttackChances,
  AttackContext,
  AttackResolution,
  AttackTableKind,
} from '../combat/attackTable';
import type { AuraDefinition, AuraInstance } from '../effects';
import type { CombatEvent, ScheduledEvent } from '../events';
import type { CombatEndReason, TelemetrySink } from '../logging';
import type { ResourceSource, ResourceType } from '../resources';
import type { RNG } from '../rng';
import type { Milliseconds } from '../time';
import type { SimulationClock } from './SimulationClock';

/**
 * Everything running inside a simulation can reach, and the only thing they
 * are given.
 *
 * Events, abilities and auras receive this and nothing else. There is no
 * module-level state anywhere in the engine, which is what allows several
 * simulations to run at once (in a Web Worker, or across a Monte Carlo batch)
 * without interfering, and what makes any piece testable by handing it a
 * purpose-built context.
 */
export interface SimulationContext {
  readonly clock: SimulationClock;
  readonly rng: RNG;
  readonly telemetry: TelemetrySink;

  /** The event queue. Prefer `schedule`/`scheduleAt` over touching it. */
  readonly events: {
    schedule(timestamp: Milliseconds, event: CombatEvent): ScheduledEvent;
    cancel(handle: ScheduledEvent | null | undefined): void;
  };

  /** Every combatant in the fight, living or dead. */
  readonly combatants: readonly Combatant[];

  /** True once combat has ended; long-running effects should check this. */
  readonly hasEnded: boolean;
  /**
   * How long this fight is scheduled to last, in milliseconds.
   *
   * Rolled once at the start from the configured duration and its variance, so
   * it is the length of THIS iteration rather than the configured average. A
   * rotation timing something to the end of the fight has to read this rather
   * than the profile, or a run with duration variance aims at the wrong
   * moment.
   *
   * It is knowledge a real player does not have, and that is a deliberate
   * simulator convention rather than an oversight: an execute phase and a
   * saved cooldown are both decisions about the end of the fight, and a sim
   * that cannot express them cannot model a rotation anyone actually uses.
   */
  readonly plannedDurationMs: Milliseconds;

  combatant(id: string): Combatant | undefined;

  /** Living combatants on the opposing faction. */
  enemiesOf(actor: Combatant): Combatant[];

  /** Living combatants on the same faction, including the actor. */
  alliesOf(actor: Combatant): Combatant[];

  /**
   * The target an actor attacks when nothing else says otherwise. Currently
   * the first living enemy; real target priority is encounter logic and will
   * replace this.
   */
  defaultTargetFor(actor: Combatant): Combatant | undefined;

  /** Schedule an event `delayMs` from now. */
  schedule(delayMs: Milliseconds, event: CombatEvent): ScheduledEvent;

  /** Schedule an event at an absolute timestamp. */
  scheduleAt(timestamp: Milliseconds, event: CombatEvent): ScheduledEvent;

  /** Side-effect-free castability check. */
  canCast(actor: Combatant, ability: Ability, target: Combatant | undefined): boolean;
  /**
   * Why an ability cannot be cast, or undefined when it can.
   *
   * `canCast` answers yes or no; a rotation sometimes needs to know WHICH rule
   * refused, because one of them -- the wrong stance -- is fixable on the spot.
   */
  castRejection(
    actor: Combatant,
    ability: Ability,
    target: Combatant | undefined,
  ): CastRejection | undefined;

  /** Use an ability, paying costs and starting cooldowns. */
  cast(actor: Combatant, ability: Ability, target: Combatant | undefined): CastCheck;

  /** Apply a buff or debuff, refreshing or stacking if already present. */
  applyAura(target: Combatant, definition: AuraDefinition, sourceId: string): AuraInstance;

  /** Give an actor a resource and record it in telemetry. */
  /**
   * Grant a resource, recording WHAT granted it.
   *
   * `source` is optional so an existing caller keeps compiling, and anything
   * that omits it shows up as unattributed in a rage breakdown rather than
   * disappearing into a total. Every caller in this repository passes one.
   */
  grantResource(
    actor: Combatant,
    resource: ResourceType,
    amount: number,
    source?: ResourceSource,
  ): void;

  /**
   * The chances for an attack, from the ruleset's provider.
   *
   * The table structure is engine mechanics; these numbers are content.
   */
  attackChances(
    kind: AttackTableKind,
    source: Combatant,
    target: Combatant,
    context?: AttackContext,
  ): AttackChances;

  /**
   * Roll an attack against its combat table without dealing damage.
   *
   * For effects whose landing is decided separately from their damage: a
   * damage-over-time spell rolls the spell table once to see whether it was
   * resisted, then ticks unconditionally.
   */
  rollAttack(
    kind: AttackTableKind,
    source: Combatant,
    target: Combatant,
    context?: AttackContext,
  ): AttackResolution;

  /**
   * Complete a weapon's swing immediately and restart its timer.
   *
   * What an "extra attack" is. Content asks for it rather than reaching into
   * the auto-attack scheduler, so the swing goes through the same path as any
   * other -- a queued Heroic Strike is consumed by it exactly as it would be by
   * a normal swing.
   */
  extraAttack(actor: Combatant, slot: WeaponSlot): void;

  /** Kill a combatant, clear its auras, and end combat if that was the last one. */
  killCombatant(target: Combatant, killer?: Combatant): void;

  /** End the fight. The first call wins; later ones are ignored. */
  end(reason: CombatEndReason): void;
}
