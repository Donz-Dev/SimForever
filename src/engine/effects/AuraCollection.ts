import type { Combatant } from '../actors/Combatant';
import type { AbilityModifier } from '../combat/abilityModifiers';
import { combineAbilityModifiers, pick, scaleByStacks } from '../combat/abilityModifiers';
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

  /**
   * Whether ANY aura on this combatant is tagged a bleed.
   *
   * Asked on every hit by a character carrying a "while the target is
   * bleeding" modifier, and by nobody else -- `bleedingTargetModifiers.isEmpty`
   * is checked first, so a character without one never walks this at all.
   */
  get isBleeding(): boolean {
    for (const instance of this.auras.values()) {
      if (instance.definition.isBleed) return true;
    }
    return false;
  }

  get(auraId: string): AuraInstance | undefined {
    return this.auras.get(auraId);
  }

  get active(): readonly AuraInstance[] {
    return [...this.auras.values()];
  }

  /**
   * The same set, WITHOUT the copy.
   *
   * `active` allocates an array every call, which is fine for a panel and not
   * fine on the damage path: `abilityDamageTakenMultiplierFor` is asked on
   * every damage event of every fight, and almost always finds nothing. A
   * caller that only iterates and never keeps the result takes this instead.
   */
  get activeIterable(): Iterable<AuraInstance> {
    return this.auras.values();
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
   * The per-ability modifier every active aura contributes to one ability,
   * or `undefined` when none does.
   *
   * `undefined` rather than an empty object so the damage path can skip the
   * combine entirely in the overwhelmingly common case -- this is asked on
   * every damage event of every fight.
   *
   * THE `ALL_ABILITIES` KEY COUNTS HERE TOO, which it did not until an aura
   * wanted one. This looked up the ability id exactly, so an aura declaring
   * `{ '*': ... }` was a silent no-op: it compiled, the aura applied, and
   * nothing it said ever reached a cast. `pick` is the same fold the standing
   * registry uses, shared rather than written out twice, which is what stops
   * the two drifting apart again.
   *
   * AND `modifiersScaleWithStacks` COUNTS HERE TOO, which it did not until
   * Combustion wanted it. That flag was read by `statModifiers` and by
   * `damageTakenBySchool` and silently ignored by this one collection -- so an
   * aura declaring both stacked visibly, reported its stack count, and paid a
   * single stack's worth. Combustion is "each of your Fire damage spell hits
   * increases your critical strike chance with Fire spells by 10%", which is
   * one entry per Fire spell and a stack per hit, and at ten stacks it was
   * worth ten percent.
   */
  abilityModifierFor(abilityId: string | undefined): AbilityModifier | undefined {
    return this.foldAbilityModifiers(abilityId, (definition) => definition.abilityModifiers);
  }

  /**
   * The same fold, over the modifiers an aura applies to attacks made AGAINST
   * its carrier.
   *
   * ONE IMPLEMENTATION AND TWO FIELD SELECTORS, because the two differ in
   * nothing but which side of the attack carries them -- and the `pick` fold,
   * the stack scaling and the double-count guard all have to behave the same
   * on both. A second copy of this loop is how `AuraCollection` came to ignore
   * `ALL_ABILITIES` while the standing registry honoured it.
   */
  attackerAbilityModifierFor(abilityId: string | undefined): AbilityModifier | undefined {
    return this.foldAbilityModifiers(
      abilityId,
      (definition) => definition.attackerAbilityModifiers,
    );
  }

  private foldAbilityModifiers(
    abilityId: string | undefined,
    select: (definition: AuraDefinition) => Readonly<Record<string, AbilityModifier>> | undefined,
  ): AbilityModifier | undefined {
    if (abilityId === undefined) return undefined;
    let combined: AbilityModifier | undefined;
    for (const instance of this.auras.values()) {
      const byAbility = select(instance.definition);
      if (!byAbility) continue;
      const found = pick(byAbility, abilityId);
      if (!found) continue;
      const own = instance.definition.modifiersScaleWithStacks
        ? scaleByStacks(found, instance.stacks)
        : found;
      combined = combined ? combineAbilityModifiers(combined, own) : own;
    }
    return combined;
  }

  /** Whether any active aura suppresses this ability's cooldown. */
  suppressesCooldownOf(abilityId: string): boolean {
    for (const instance of this.auras.values()) {
      if (instance.definition.suppressesCooldownOf?.includes(abilityId)) return true;
    }
    return false;
  }

  /**
   * Damage every active absorb shield on this combatant could still soak.
   *
   * A READ, and deliberately so: `resolveDamage` applies nothing, so it asks
   * how much WOULD be absorbed and `dealDamage` spends it afterwards. That is
   * the arrangement a block charge already has, and for the same reason -- an
   * ability can resolve a hit without the hit happening.
   */
  absorbAvailable(): number {
    let total = 0;
    for (const instance of this.auras.values()) total += instance.absorbRemaining;
    return total;
  }

  /**
   * Spend an absorbed amount across the shields, removing any that run out.
   *
   * IN INSERTION ORDER, which is the order they were applied. Nothing in this
   * ruleset stacks two shields yet, so the order is a decision rather than a
   * rule -- said here so that the day two do, somebody chooses on purpose.
   */
  consumeAbsorb(context: SimulationContext, amount: number): void {
    let left = amount;
    for (const instance of [...this.auras.values()]) {
      if (left <= 0) break;
      if (instance.absorbRemaining <= 0) continue;
      const taken = Math.min(instance.absorbRemaining, left);
      instance.absorbRemaining -= taken;
      left -= taken;
      /*
       * A SPENT SHIELD ENDS, which is what every absorb in the game does and
       * what stops an exhausted one sitting on the character reporting uptime
       * it is not providing.
       */
      if (instance.absorbRemaining <= 0) this.remove(context, instance.id);
    }
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

    const instance = new AuraInstance(
      definition,
      sourceId,
      this.owner.id,
      context.clock.now(),
      // A charge effect starts full rather than building to its cap.
      definition.chargesOnApply ?? 1,
    );
    // Evaluated ONCE, here, for the reason on `AuraDefinition.absorb`: every
    // absorb in this ruleset is a share of something, and a shield that grew
    // with a buff landing after it would be the wrong number.
    instance.absorbRemaining = definition.absorb?.(this.owner) ?? 0;
    this.auras.set(definition.id, instance);

    // BEFORE the first tick is scheduled below, so a pool can never be drawn
    // from while it is still zero.
    this.addToPool(context, instance);

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

  /**
   * Spend one stack of every aura a BLOCK consumes, dropping any that run out.
   *
   * Called by the damage pipeline when this combatant blocks. The mirror of
   * `consumeSwingCharges`, which fires when it swings.
   */
  consumeBlockCharges(context: SimulationContext): void {
    for (const instance of [...this.auras.values()]) {
      if (!instance.definition.consumedByBlock) continue;
      if (instance.stacks > 1) {
        instance.stacks -= 1;
        // The stat modifiers do not scale with stacks here -- the charge is a
        // count of uses, not a magnitude -- so nothing needs reapplying.
      } else {
        this.remove(context, instance.id);
      }
    }
  }

  /**
   * Spend one stack of every aura a CAST consumes, dropping any that run out.
   *
   * Called by `castAbility` with the auras `resolveCast` already matched, so
   * the cast that is shortened is the cast that pays -- and so the rule that
   * decides what applies lives in one place rather than being re-derived here
   * and drifting.
   *
   * The third of these, after swings and blocks. Each spends a charge on a
   * different event, and all three exist because "your next 2 Starfires" is a
   * count rather than a duration.
   */
  consumeCastCharges(context: SimulationContext, matched: readonly AuraInstance[]): void {
    for (const instance of matched) {
      const spends = instance.definition.castModifier?.consumedByCast;
      if (!spends) continue;
      // `all` drops the aura whatever it held: one cast, every stack.
      if (spends === 'stack' && instance.stacks > 1) {
        instance.stacks -= 1;
      } else {
        this.remove(context, instance.id);
      }
    }
  }

  /**
   * The multiplier every active aura applies to this combatant's global
   * cooldown, or 1 when none does.
   *
   * MULTIPLIED rather than added, which is the same reading two independent
   * damage multipliers take: two 10% reductions leave 81%, not 80%. Nothing
   * stacks two today, so this is a decision rather than an observation -- said
   * here so the day something does, somebody chose on purpose.
   */
  gcdMultiplier(): number {
    let multiplier = 1;
    for (const instance of this.auras.values()) {
      const fraction = instance.definition.gcdFraction;
      if (fraction) multiplier *= 1 - fraction;
    }
    return multiplier;
  }

  /**
   * Spend one stack of an aura, removing it when the last one goes.
   *
   * ----------------------------------------------------------------------------
   * `consumeCastCharges` does this for an aura whose charges are spent by the
   * CAST MODIFIER it carries -- Eclipse, Maelstrom Weapon, Missile Barrage.
   * Fingers of Frost has no cast modifier at all: it changes no cast time and
   * no cost, it changes what the DAMAGE sees, and its charges are still spent
   * by casting.
   *
   * So the mechanism is offered on its own rather than being reached by giving
   * the aura a cast modifier that modifies nothing -- which would work, and
   * would leave the next reader looking for the modification.
   * ----------------------------------------------------------------------------
   */
  consumeStack(context: SimulationContext, auraId: string): void {
    const instance = this.auras.get(auraId);
    if (!instance) return;
    if (instance.stacks > 1) {
      instance.stacks -= 1;
      return;
    }
    this.expire(context, instance);
  }

  remove(context: SimulationContext, auraId: string): void {
    const instance = this.auras.get(auraId);
    if (!instance) return;
    this.expire(context, instance);
  }

  /**
   * Remove only the auras that a death takes with it.
   *
   * For a combatant who dies and is stood back up: everything else carries on,
   * because the run is measuring a fight through a death rather than a death
   * and a rebuff. See `removedOnDeath` for which effects qualify and why.
   */
  removeOnDeath(context: SimulationContext): void {
    for (const instance of [...this.auras.values()]) {
      if (instance.definition.removedOnDeath) this.expire(context, instance);
    }
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

    /*
     * RESTORED TO FULL, OR CLIMBING BY ONE. See
     * `AuraDefinition.refreshRestoresCharges`: "your next 3 swings" is a window
     * being re-opened rather than a stack being added, so a crit landing on a
     * one-charge Flurry gives three.
     *
     * Both paths go through `instance.stacks` HERE rather than being done by the
     * caller, which is the point of the field. Flurry used to write
     * `instance.stacks = 3` from its reaction immediately after `applyAura`
     * returned -- a bare mutation the telemetry below had already run past, so
     * every event reported 1 or 2 while the engine held 3.
     */
    const full = definition.chargesOnApply ?? instance.maxStacks;
    const gainedStack = definition.refreshRestoresCharges
      ? instance.stacks < full
      : instance.stacks < instance.maxStacks;
    if (gainedStack) {
      instance.stacks = definition.refreshRestoresCharges ? full : instance.stacks + 1;
      if (definition.modifiersScaleWithStacks) {
        this.reapplyStatModifiers(instance);
      }
    }

    /*
     * A REFRESHED SHIELD IS A NEW SHIELD, re-evaluated exactly as it was on the
     * first application.
     *
     * Seal of Fury is why: "each attack also grants an absorb shield equal to 50%
     * of the Holy damage dealt" is granted every swing, and a refresh that left
     * the old pool alone would cap the shield at one swing's worth for the whole
     * thirty seconds. Skipped for `ignore`, which is the behaviour that says this
     * application does not count.
     */
    if (behaviour !== 'ignore' && definition.absorb) {
      instance.absorbRemaining = definition.absorb(this.owner);
    }

    /*
     * A REFRESHED POOL IS ROLLED FORWARD, WHICH IS THE OPPOSITE OF A SHIELD.
     *
     * The lines above REPLACE an absorb, because a new shield is a new shield;
     * this ADDS, because the ruleset owner's Deep Wounds carries the undelivered
     * remainder into the new total. Same shape, opposite rule, and they sit
     * together so the difference is visible rather than inferred.
     *
     * `ignore` declines the application, so it contributes nothing either.
     */
    if (behaviour !== 'ignore') {
      this.addToPool(context, instance);
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

  /**
   * Add one application's worth to a pooling periodic, and re-split the share.
   *
   * ----------------------------------------------------------------------------
   * CALLED FROM BOTH `apply` AND `refresh`, which is what makes a first
   * application and a roll-over the same arithmetic: `poolRemaining` starts at
   * zero, so the first call is a roll-over onto nothing. Writing the two cases
   * separately is how they come to disagree.
   *
   * THE SHARE IS RE-SPLIT OVER A WHOLE DURATION every time. A refresh resets the
   * clock, so the pool as it now stands has a full `durationMs` to be delivered
   * in -- the same number of ticks as a fresh application, each drawing a larger
   * share. That is the ruleset owner's "the next 1/6th damage tick pulls from
   * the new total pool".
   * ----------------------------------------------------------------------------
   */
  private addToPool(context: SimulationContext, instance: AuraInstance): void {
    const periodic = instance.definition.periodic;
    if (!periodic?.pool) return;

    instance.poolRemaining += periodic.pool(context, instance);

    /*
     * DERIVED, not declared -- see `PeriodicEffect.pool`. A permanent aura has
     * no duration to divide, so it draws the whole pool on its first tick, which
     * is the only reading that delivers it at all.
     */
    if (instance.definition.durationMs > 0) {
      const ticks = Math.max(
        1,
        Math.round(instance.definition.durationMs / periodic.intervalMs),
      );
      instance.poolPerTick = instance.poolRemaining / ticks;
    } else {
      instance.poolPerTick = instance.poolRemaining;
    }
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
