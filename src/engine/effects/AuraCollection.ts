import type { Combatant } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { bindModifiers } from '../stats';
import type { Milliseconds } from '../time';
import type { AuraDefinition } from './Aura';
import { AuraInstance } from './Aura';

/**
 * The auras currently on one combatant.
 *
 * Holds at most one instance per aura definition. Tracking a separate instance
 * per caster (so two warlocks can each have their own copy of a debuff on a
 * boss) is a real requirement for raid simulation, but it changes the key from
 * `auraId` to `auraId + casterId` and nothing else about this class, so it is
 * deliberately left for when raid content needs it.
 *
 * This class owns the whole lifecycle: applying stat modifiers, scheduling the
 * expiry and tick events, cleaning those up on early removal, and emitting
 * telemetry for each transition.
 */
export class AuraCollection {
  private readonly auras = new Map<string, AuraInstance>();

  constructor(private readonly owner: Combatant) {}

  has(auraId: string): boolean {
    return this.auras.has(auraId);
  }

  get(auraId: string): AuraInstance | undefined {
    return this.auras.get(auraId);
  }

  get active(): readonly AuraInstance[] {
    return [...this.auras.values()];
  }

  get size(): number {
    return this.auras.size;
  }

  /** Stacks of an aura, or 0 if absent. */
  stacksOf(auraId: string): number {
    return this.auras.get(auraId)?.stacks ?? 0;
  }

  /** Time left on an aura, 0 if absent, Infinity if permanent. */
  remainingMs(auraId: string, now: Milliseconds): Milliseconds {
    return this.auras.get(auraId)?.remainingMs(now) ?? 0;
  }

  /**
   * Apply an aura, or refresh/stack it if already present.
   *
   * Returns the live instance either way.
   */
  apply(
    context: SimulationContext,
    definition: AuraDefinition,
    sourceId: string,
  ): AuraInstance {
    const existing = this.auras.get(definition.id);
    if (existing) {
      return this.refresh(context, existing);
    }

    const instance = new AuraInstance(definition, sourceId, this.owner.id, context.clock.now());
    this.auras.set(definition.id, instance);

    this.applyStatModifiers(instance);
    this.scheduleExpiration(context, instance);
    // `true`: this is the aura's FIRST tick, the only one a periodic effect
    // is allowed to place anywhere but one whole interval away.
    this.schedulePeriodicTick(context, instance, true);

    context.telemetry.emit({
      type: 'aura_applied',
      timestamp: context.clock.now(),
      sourceId,
      targetId: this.owner.id,
      auraId: instance.id,
      auraName: instance.name,
      stacks: instance.stacks,
      isDebuff: instance.isDebuff,
    });

    definition.onApply?.(context, instance);
    return instance;
  }

  /** Remove an aura before it expires. No-op if it is not present. */
  /**
   * Spend one stack of every aura that a swing consumes, dropping any that run
   * out.
   *
   * Called by the auto-attack, which is the only thing that knows a swing just
   * happened. The engine does not know what Flurry is; it knows that some auras
   * are counted in swings.
   */
  consumeSwingCharges(context: SimulationContext): void {
    for (const instance of [...this.auras.values()]) {
      if (!instance.definition.consumedBySwing) continue;
      if (instance.stacks > 1) {
        instance.stacks -= 1;
      } else {
        this.remove(context, instance.id);
      }
    }
  }

  remove(context: SimulationContext, auraId: string): void {
    const instance = this.auras.get(auraId);
    if (!instance) return;
    this.expire(context, instance);
  }

  /** Remove every aura. Used when a combatant dies or combat ends. */
  removeAll(context: SimulationContext): void {
    for (const instance of [...this.auras.values()]) {
      this.expire(context, instance);
    }
  }

  private refresh(context: SimulationContext, instance: AuraInstance): AuraInstance {
    const now = context.clock.now();
    const definition = instance.definition;
    const behaviour = definition.refreshBehaviour ?? 'reset';

    const gainedStack = instance.stacks < instance.maxStacks;
    if (gainedStack) {
      instance.stacks++;
      if (definition.modifiersScaleWithStacks) {
        this.reapplyStatModifiers(instance);
      }
    }

    if (behaviour !== 'ignore' && !instance.isPermanent) {
      const remaining = instance.remainingMs(now);
      instance.expiresAt =
        behaviour === 'extend'
          ? now + remaining + definition.durationMs
          : now + definition.durationMs;
      instance.appliedAt = now;

      context.events.cancel(instance.expirationHandle);
      this.scheduleExpiration(context, instance);
    }

    context.telemetry.emit({
      type: gainedStack ? 'aura_stacks_changed' : 'aura_refreshed',
      timestamp: now,
      sourceId: instance.sourceId,
      targetId: this.owner.id,
      auraId: instance.id,
      auraName: instance.name,
      stacks: instance.stacks,
      isDebuff: instance.isDebuff,
    });

    return instance;
  }

  private expire(context: SimulationContext, instance: AuraInstance): void {
    this.auras.delete(instance.id);

    context.events.cancel(instance.expirationHandle);
    context.events.cancel(instance.tickHandle);
    instance.expirationHandle = null;
    instance.tickHandle = null;

    this.owner.stats.removeModifiersFrom(instance.modifierSourceId);

    context.telemetry.emit({
      type: 'aura_removed',
      timestamp: context.clock.now(),
      sourceId: instance.sourceId,
      targetId: this.owner.id,
      auraId: instance.id,
      auraName: instance.name,
      stacks: instance.stacks,
      isDebuff: instance.isDebuff,
    });

    instance.definition.onExpire?.(context, instance);
  }

  private applyStatModifiers(instance: AuraInstance): void {
    const specs = instance.definition.statModifiers;
    if (!specs || specs.length === 0) return;

    const scale = instance.definition.modifiersScaleWithStacks ? instance.stacks : 1;
    const scaled = specs.map((spec) => ({ ...spec, value: spec.value * scale }));
    this.owner.stats.addModifiers(bindModifiers(scaled, instance.modifierSourceId));
  }

  private reapplyStatModifiers(instance: AuraInstance): void {
    this.owner.stats.removeModifiersFrom(instance.modifierSourceId);
    this.applyStatModifiers(instance);
  }

  private scheduleExpiration(context: SimulationContext, instance: AuraInstance): void {
    if (instance.isPermanent) return;

    instance.expirationHandle = context.events.schedule(
      instance.expiresAt,
      createEvent(`aura-expire:${instance.id}`, EventPriority.AuraExpiration, (ctx) => {
        // Guard against a stale handle: the aura may have been refreshed to a
        // later time, or removed and reapplied, since this was scheduled.
        const current = this.auras.get(instance.id);
        if (current !== instance) return;
        if (ctx.clock.now() < instance.expiresAt) return;
        this.expire(ctx, instance);
      }),
    );
  }

  private schedulePeriodicTick(
    context: SimulationContext,
    instance: AuraInstance,
    isFirst = false,
  ): void {
    const periodic = instance.definition.periodic;
    if (!periodic) return;

    const delay =
      isFirst && periodic.firstTickDelay
        ? periodic.firstTickDelay(context)
        : periodic.intervalMs;
    const nextTick = context.clock.now() + delay;
    if (nextTick > instance.expiresAt) return;

    instance.tickHandle = context.events.schedule(
      nextTick,
      createEvent(`aura-tick:${instance.id}`, EventPriority.Periodic, (ctx) => {
        const current = this.auras.get(instance.id);
        if (current !== instance) return;

        periodic.onTick(ctx, instance);

        // Ticks chain themselves rather than being scheduled up front, so a
        // refresh that extends the duration automatically gets more ticks.
        const following = ctx.clock.now() + periodic.intervalMs;
        if (following <= instance.expiresAt) {
          this.schedulePeriodicTick(ctx, instance);
        }
      }),
    );
  }
}
