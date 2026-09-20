import type { Ability } from '../abilities/Ability';
import type { CastCheck } from '../abilities/casting';
import { castAbility, checkCast } from '../abilities/casting';
import type { Combatant, WeaponSlot } from '../actors/Combatant';
import { extraAttack, startAutoAttack } from '../combat/autoAttack';
import { startResourceRegeneration } from '../resources';
import type {
  AttackChanceProvider,
  AttackChances,
  AttackContext,
  AttackResolution,
  AttackTableKind,
} from '../combat/attackTable';
import { defaultAttackChances, resolveAttackTable } from '../combat/attackTable';
import type { AuraDefinition, AuraInstance } from '../effects';
import type { CombatEvent, ScheduledEvent } from '../events';
import { EventPriority, EventQueue, createEvent } from '../events';
import type { CombatEndReason, TelemetryEvent, TelemetrySink } from '../logging';
import { TelemetryRecorder } from '../logging';
import type { ResourceType, ResourceSource } from '../resources';
import type { RNG } from '../rng';
import { SeededRNG } from '../rng';
import type { Milliseconds } from '../time';
import type { SimulationConfig } from './SimulationConfig';
import { MutableSimulationClock } from './SimulationClock';
import type { SimulationContext } from './SimulationContext';
import type { ActorSnapshot, SimulationRun } from './SimulationRun';
import type { CastRejection } from '../abilities/casting';

/**
 * How often an idle actor re-checks its rotation.
 *
 * When an actor is on the global cooldown or casting, it wakes exactly when
 * that ends. When it is free but has nothing castable (starved for resources,
 * everything on cooldown), it has no event to wait for, so it polls. 100ms is
 * fine enough not to distort results and coarse enough to stay cheap.
 *
 * It is also the guard against an infinite loop: without a minimum interval, a
 * free actor with nothing to do would reschedule itself at the current
 * timestamp forever.
 */
const ROTATION_POLL_MS = 100;

/**
 * A safety valve. A correct simulation of a 10-minute fight processes tens of
 * thousands of events; a million means something is scheduling itself in a
 * loop, and hanging the browser is a worse failure than throwing.
 */
const MAX_EVENTS = 1_000_000;

/**
 * One fight.
 *
 * Construct it, call `run()` once, read the result. A Simulation is not
 * reusable: Monte Carlo builds a fresh one per iteration, which is what keeps
 * iterations independent.
 *
 * The class implements SimulationContext itself, so the thing that owns the
 * queue and the thing that events talk to are the same object, with no extra
 * indirection to keep in sync.
 */
export class Simulation implements SimulationContext {
  readonly clock = new MutableSimulationClock();
  readonly rng: RNG;
  readonly events = new EventQueue();
  readonly telemetry: TelemetrySink;

  private readonly config: SimulationConfig;
  private readonly recorder: TelemetryRecorder | null;
  private readonly actors: Combatant[];
  private readonly actorsById = new Map<string, Combatant>();

  private readonly plannedDurationMs: Milliseconds;
  private readonly chanceProvider: AttackChanceProvider;
  private endReason: CombatEndReason | null = null;
  private eventsProcessed = 0;
  private started = false;

  /**
   * @param config    the fight to run
   * @param telemetry where events go. Defaults to a recorder that keeps them
   *                  all; a Monte Carlo batch passes a sink that discards.
   */
  constructor(config: SimulationConfig, telemetry?: TelemetrySink) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);

    if (telemetry) {
      this.telemetry = telemetry;
      this.recorder = telemetry instanceof TelemetryRecorder ? telemetry : null;
    } else {
      this.recorder = new TelemetryRecorder();
      this.telemetry = this.recorder;
    }

    // Duration variance is rolled before anything else, so that for a given
    // seed the fight length is fixed regardless of what happens during it.
    this.plannedDurationMs = rollDuration(config, this.rng);
    this.chanceProvider = config.attackChances ?? defaultAttackChances;

    this.actors = config.createCombatants();
    for (const actor of this.actors) {
      if (this.actorsById.has(actor.id)) {
        throw new Error(`Duplicate combatant id: ${actor.id}`);
      }
      this.actorsById.set(actor.id, actor);
    }
  }

  get combatants(): readonly Combatant[] {
    return this.actors;
  }

  get hasEnded(): boolean {
    return this.endReason !== null;
  }

  /** Telemetry recorded so far, if this simulation is recording. */
  get recordedTelemetry(): readonly TelemetryEvent[] {
    return this.recorder ? this.recorder.all : [];
  }

  /**
   * Set combat up without running it: create the opening events, apply opening
   * buffs, start swing timers. Idempotent, and called automatically by both
   * `run` and `advanceTo`.
   */
  begin(): void {
    if (this.started) return;
    this.started = true;
    this.setUpCombat();
  }

  /**
   * Run the fight to completion.
   *
   * This is the heart of the engine, and it is deliberately tiny: pull the
   * earliest event, move the clock to it, execute it. Everything else in the
   * simulation is an event that schedules further events.
   */
  run(): SimulationRun {
    this.begin();

    while (!this.hasEnded) {
      const scheduled = this.events.pop();

      if (!scheduled) {
        // Nothing left to happen. Only reachable if every actor has stopped
        // scheduling, which in practice means everyone is dead.
        this.end('no_events');
        break;
      }

      this.executeNext(scheduled.timestamp, scheduled.event);
    }

    return this.buildRun();
  }

  /**
   * Execute every event up to and including `timestamp`, then park the clock
   * there.
   *
   * Lets a caller step through a fight instead of running it to the end, which
   * is how the tests inspect state mid-combat and how a step-through debugging
   * view would drive the engine.
   */
  advanceTo(timestamp: Milliseconds): void {
    this.begin();

    while (!this.hasEnded) {
      const next = this.events.peek();
      if (!next || next.timestamp > timestamp) break;

      this.events.pop();
      this.executeNext(next.timestamp, next.event);
    }

    if (!this.hasEnded) {
      this.clock.advanceTo(timestamp);
    }
  }

  /** Move the clock and run one event, with the runaway-loop guard. */
  private executeNext(timestamp: Milliseconds, event: CombatEvent): void {
    this.clock.advanceTo(timestamp);
    event.execute(this);

    if (++this.eventsProcessed > MAX_EVENTS) {
      throw new Error(
        `Simulation exceeded ${MAX_EVENTS} events at ${this.clock.now()}ms. ` +
          'This almost always means an event is rescheduling itself without advancing time.',
      );
    }
  }

  // --- SimulationContext -------------------------------------------------

  combatant(id: string): Combatant | undefined {
    return this.actorsById.get(id);
  }

  enemiesOf(actor: Combatant): Combatant[] {
    return this.actors.filter((other) => other.isAlive && other.isHostileTo(actor));
  }

  alliesOf(actor: Combatant): Combatant[] {
    return this.actors.filter((other) => other.isAlive && !other.isHostileTo(actor));
  }

  defaultTargetFor(actor: Combatant): Combatant | undefined {
    return this.actors.find((other) => other.isAlive && other.isHostileTo(actor));
  }

  schedule(delayMs: Milliseconds, event: CombatEvent): ScheduledEvent {
    return this.events.schedule(this.clock.now() + delayMs, event);
  }

  scheduleAt(timestamp: Milliseconds, event: CombatEvent): ScheduledEvent {
    return this.events.schedule(timestamp, event);
  }

  canCast(actor: Combatant, ability: Ability, target: Combatant | undefined): boolean {
    return checkCast(this, actor, ability, target).ok;
  }

  castRejection(
    actor: Combatant,
    ability: Ability,
    target: Combatant | undefined,
  ): CastRejection | undefined {
    const check = checkCast(this, actor, ability, target);
    return check.ok ? undefined : check.reason;
  }

  cast(actor: Combatant, ability: Ability, target: Combatant | undefined): CastCheck {
    return castAbility(this, actor, ability, target);
  }

  applyAura(target: Combatant, definition: AuraDefinition, sourceId: string): AuraInstance {
    return target.auras.apply(this, definition, sourceId);
  }

  grantResource(
    actor: Combatant,
    resource: ResourceType,
    amount: number,
    source?: ResourceSource,
  ): void {
    const pool = actor.resources.get(resource);
    if (!pool || amount <= 0) return;

    const { gained, wasted } = pool.gain(amount);
    this.telemetry.emit({
      type: 'resource_gained',
      timestamp: this.clock.now(),
      actorId: actor.id,
      resource,
      amount: gained,
      wasted,
      current: pool.current,
      source: source?.id,
      sourceName: source?.name,
    });
  }

  attackChances(
    kind: AttackTableKind,
    source: Combatant,
    target: Combatant,
    context?: AttackContext,
  ): AttackChances {
    return this.chanceProvider(kind, source, target, context);
  }

  rollAttack(
    kind: AttackTableKind,
    source: Combatant,
    target: Combatant,
    context?: AttackContext,
  ): AttackResolution {
    return resolveAttackTable(
      kind,
      this.attackChances(kind, source, target, context),
      this.rng,
    );
  }

  extraAttack(actor: Combatant, slot: WeaponSlot): void {
    extraAttack(this, actor, slot);
  }

  killCombatant(target: Combatant, killer?: Combatant): void {
    // Two lethal hits landing in the same instant must not kill twice.
    if (target.isDeathProcessed) return;

    target.markDead();
    target.auras.removeAll(this);

    this.telemetry.emit({
      type: 'death',
      timestamp: this.clock.now(),
      actorId: target.id,
      killerId: killer?.id,
    });

    if (!this.actors.some((actor) => actor.isAlive && actor.faction === 'hostile')) {
      this.end('all_enemies_dead');
    } else if (!this.actors.some((actor) => actor.isAlive && actor.faction === 'friendly')) {
      this.end('all_players_dead');
    }
  }

  end(reason: CombatEndReason): void {
    if (this.endReason !== null) return;
    this.endReason = reason;
    this.telemetry.emit({
      type: 'combat_end',
      timestamp: this.clock.now(),
      reason,
    });
  }

  // --- setup -------------------------------------------------------------

  private setUpCombat(): void {
    this.telemetry.emit({
      type: 'combat_start',
      timestamp: 0,
      seed: this.config.seed,
    });

    // The end-of-fight event is what guarantees termination: actors reschedule
    // themselves indefinitely, so something has to stop the clock.
    this.events.schedule(
      this.plannedDurationMs,
      createEvent('combat-end', EventPriority.Boundary, (ctx) => {
        ctx.end('duration_expired');
      }),
    );

    this.config.onCombatStart?.(this);

    /*
     * States a combatant is simply always in, applied before anything swings.
     *
     * Before `onCombatStart`, so an encounter's opening buffs can still replace
     * one -- and before auto attack, so the first swing already has them.
     */
    for (const actor of this.actors) {
      if (!actor.isAlive) continue;
      for (const aura of actor.openingAuras) this.applyAura(actor, aura, actor.id);
    }

    for (const actor of this.actors) {
      if (!actor.isAlive) continue;
      startAutoAttack(this, actor);
      startResourceRegeneration(this, actor);
      if (actor.rotation) {
        this.scheduleDecision(actor, 0);
      }
    }
  }

  /**
   * Wake an actor at `timestamp` to pick its next action.
   *
   * Each decision schedules the next one, so an actor drives itself for the
   * whole fight from a single initial event.
   */
  private scheduleDecision(actor: Combatant, timestamp: Milliseconds): void {
    this.events.schedule(
      timestamp,
      createEvent(`decision:${actor.id}`, EventPriority.Decision, (ctx) => {
        if (ctx.hasEnded || !actor.isAlive || !actor.rotation) return;

        const decision = actor.rotation.selectAction(ctx, actor);
        if (decision) {
          ctx.cast(actor, decision.ability, decision.target);
        }

        this.scheduleDecision(actor, this.nextDecisionTime(actor));
      }),
    );
  }

  /**
   * When an actor should next consider acting.
   *
   * If it is busy, that is the moment it stops being busy. If it is free and
   * simply had nothing to do, it polls; see ROTATION_POLL_MS.
   */
  private nextDecisionTime(actor: Combatant): Milliseconds {
    const now = this.clock.now();
    const busyUntil = Math.max(actor.gcdReadyAt, actor.castEndsAt);
    return busyUntil > now ? busyUntil : now + ROTATION_POLL_MS;
  }

  private buildRun(): SimulationRun {
    const telemetry: readonly TelemetryEvent[] = this.recorder ? this.recorder.all : [];

    const actors: ActorSnapshot[] = this.actors.map((actor) => ({
      id: actor.id,
      name: actor.name,
      kind: actor.kind,
      faction: actor.faction,
      maxHealth: actor.health.maximum,
      finalHealth: actor.health.current,
      isAlive: actor.isAlive,
    }));

    return {
      seed: this.config.seed,
      plannedDurationMs: this.plannedDurationMs,
      elapsedMs: this.clock.now(),
      endReason: this.endReason ?? 'no_events',
      actors,
      telemetry,
      eventsProcessed: this.eventsProcessed,
    };
  }
}

function rollDuration(config: SimulationConfig, rng: RNG): Milliseconds {
  const variance = config.durationVariance ?? 0;
  if (variance <= 0) return config.durationMs;
  const factor = rng.nextFloat(1 - variance, 1 + variance);
  return Math.max(1, Math.round(config.durationMs * factor));
}
