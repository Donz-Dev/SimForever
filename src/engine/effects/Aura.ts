import type { Milliseconds } from '../time';
import type { StatModifierSpec } from '../stats';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { ScheduledEvent } from '../events';

/**
 * What happens when an aura is applied to a target that already has it.
 *
 * - `reset`  restart the full duration (the WoW default)
 * - `extend` add the duration to whatever remains, up to a cap
 * - `ignore` leave the existing timer alone
 */
export type AuraRefreshBehaviour = 'reset' | 'extend' | 'ignore';

/** The periodic half of an aura: DoT ticks, HoT ticks, resource ticks. */
export interface PeriodicEffect {
  readonly intervalMs: Milliseconds;
  /** Runs on every tick, including one at the moment the aura expires. */
  onTick(context: SimulationContext, aura: AuraInstance): void;
  /**
   * When the FIRST tick lands, if not one whole interval from now.
   *
   * Takes the context so it can roll, which is the reason it exists: a
   * passive that ticks on its own timer did not start that timer when the
   * pull did. Anger Management generates a rage every three seconds whether
   * or not anyone is fighting, so a character entering combat is somewhere
   * random inside the current three seconds -- and every fight in a batch
   * starting its first tick at exactly 3000ms is a fiction that would show
   * up as an artificially tight distribution.
   *
   * Only the first tick. The rest chain at the plain interval.
   */
  firstTickDelay?(context: SimulationContext): Milliseconds;
}

/**
 * The static description of a buff or debuff. One definition, many instances:
 * this object is shared by every character carrying the effect, so it holds no
 * per-target state.
 *
 * Definitions are game content and live under `src/game`, never in the engine.
 */
export interface AuraDefinition {
  readonly id: string;
  readonly name: string;
  /** Lifetime in milliseconds. 0 means it lasts until explicitly removed. */
  readonly durationMs: Milliseconds;
  /** Defaults to 1. */
  readonly maxStacks?: number;
  /** Debuffs are shown and analysed separately from buffs. */
  readonly isDebuff?: boolean;
  /** Stat changes applied while active and removed on expiry. */
  readonly statModifiers?: readonly StatModifierSpec[];
  /** When true, stat modifiers are multiplied by the current stack count. */
  readonly modifiersScaleWithStacks?: boolean;
  /** Multiplies damage the carrier deals. 1.1 is +10%. */
  readonly damageDoneMultiplier?: number;
  /** Multiplies damage the carrier takes. */
  readonly damageTakenMultiplier?: number;
  /** Multiplies healing the carrier does. */
  readonly healingDoneMultiplier?: number;
  readonly periodic?: PeriodicEffect;
  /** Defaults to `reset`. */
  readonly refreshBehaviour?: AuraRefreshBehaviour;
  /**
   * Each auto-attack swing by the carrier consumes one stack, and the aura
   * falls off when the last one goes.
   *
   * WoW has a whole family of "for your next N swings" effects — Flurry,
   * Heroic Strike's queue, Sweeping Strikes — and an aura that expires on TIME
   * cannot express any of them. The charge is spent at the START of a swing, so
   * the swing that benefits is the swing that pays: an effect applied by a crit
   * mid-swing is not eaten by the swing that applied it.
   *
   * `durationMs` still applies as a backstop for a carrier who stops swinging.
   */
  readonly consumedBySwing?: boolean;
  readonly onApply?: (context: SimulationContext, aura: AuraInstance) => void;
  readonly onExpire?: (context: SimulationContext, aura: AuraInstance) => void;
}

/**
 * One live copy of an aura on one target.
 *
 * Holds the mutable state a definition cannot: when it was applied, how many
 * stacks it has, and the queue handles for its pending expiry and next tick.
 * Those handles are how an aura removed early cleans up after itself instead of
 * leaving a ghost tick in the queue.
 */
export class AuraInstance {
  stacks: number;
  appliedAt: Milliseconds;
  expiresAt: Milliseconds;

  /** Queue handle for the expiry event, so early removal can cancel it. */
  expirationHandle: ScheduledEvent | null = null;
  /** Queue handle for the next periodic tick. */
  tickHandle: ScheduledEvent | null = null;

  constructor(
    readonly definition: AuraDefinition,
    /** Id of the combatant that applied it. */
    readonly sourceId: string,
    /** Id of the combatant carrying it. */
    readonly targetId: string,
    appliedAt: Milliseconds,
    stacks: number = 1,
  ) {
    this.stacks = stacks;
    this.appliedAt = appliedAt;
    this.expiresAt = definition.durationMs > 0 ? appliedAt + definition.durationMs : Infinity;
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get isDebuff(): boolean {
    return this.definition.isDebuff ?? false;
  }

  get maxStacks(): number {
    return this.definition.maxStacks ?? 1;
  }

  get isPermanent(): boolean {
    return this.expiresAt === Infinity;
  }

  /**
   * A key unique to this aura on this target, used as the `sourceId` of the
   * stat modifiers it owns so they can all be removed together.
   */
  get modifierSourceId(): string {
    return `aura:${this.targetId}:${this.definition.id}`;
  }

  remainingMs(now: Milliseconds): Milliseconds {
    return this.isPermanent ? Infinity : Math.max(0, this.expiresAt - now);
  }
}
