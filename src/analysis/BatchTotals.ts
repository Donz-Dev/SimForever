import type { AttackOutcome, TelemetryEvent, TelemetrySink } from '../engine';

/**
 * A telemetry sink that accumulates EVERY iteration of a batch and keeps no
 * events.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS REPLACES READING THE REPRESENTATIVE ITERATION.
 *
 * A batch used to report its headline DPS as a mean over all iterations and
 * every other number -- the damage breakdown, the hit and crit rates, the
 * totals -- from ONE iteration, the one whose DPS landed nearest the median.
 *
 * That is a reasonable thing to show beside a combat log and a bad thing to
 * audit a talent with. A single hundred-second fight lands maybe forty main
 * hand swings, so its crit rate is a forty-sample estimate quoted to one
 * decimal place, and the difference a talent makes is smaller than the noise
 * between two neighbouring iterations. Someone comparing two builds at 2500
 * iterations was still reading two single fights.
 *
 * So this sums across all of them. Rates are POOLED -- total crits over total
 * attempts, across every iteration -- rather than averaged per iteration,
 * because an average of ratios weights a quiet fight the same as a busy one.
 * Counts and totals are per-iteration MEANS, which is what "what happens in a
 * fight" means.
 * ----------------------------------------------------------------------------
 */

/** Per-ability damage, pooled across a whole batch. */
export interface BatchAbilityTotals {
  readonly abilityName: string;
  /** Mean damage per iteration. */
  readonly damage: number;
  /** Mean attempts per iteration, landed or not. */
  readonly attempts: number;
  /** Mean landed hits per iteration. */
  readonly hits: number;
  /** Mean damage per LANDED hit, pooled over the batch. */
  readonly average: number;
  /** Share of the actor's total damage. */
  readonly share: number;
  readonly critRate: number;
  readonly glanceRate: number;
  readonly avoidRate: number;
}

/** Where a resource came from, or went. */
export interface BatchResourceTotals {
  readonly sourceId: string;
  readonly sourceName: string;
  /** Mean amount per iteration. */
  readonly amount: number;
  /** Mean number of events per iteration -- casts, procs, swings. */
  readonly count: number;
  /** Mean amount lost to the cap per iteration. Always 0 for a spend. */
  readonly wasted: number;
  readonly share: number;
}

export interface BatchResourceFlow {
  readonly gained: readonly BatchResourceTotals[];
  readonly spent: readonly BatchResourceTotals[];
  readonly totalGained: number;
  readonly totalSpent: number;
  /** Gained but lost to the cap. Rage capping is a real rotation failure. */
  readonly totalWasted: number;
}

/** Damage the actor RECEIVED, by what hit it and how it landed. */
export interface BatchDamageTaken {
  readonly sourceName: string;
  readonly damage: number;
  readonly attempts: number;
  readonly hits: number;
  readonly average: number;
  /** Outcome counts as a fraction of attempts, pooled over the batch. */
  readonly rates: Readonly<Record<AttackOutcome, number>>;
}

interface AbilityAccumulator {
  damage: number;
  attempts: number;
  hits: number;
  crits: number;
  glances: number;
  avoided: number;
}

interface ResourceAccumulator {
  name: string;
  amount: number;
  count: number;
  wasted: number;
}

interface TakenAccumulator {
  damage: number;
  attempts: number;
  hits: number;
  outcomes: Map<AttackOutcome, number>;
}

/** Outcomes that mean the attack did not land. */
const AVOIDED: ReadonlySet<AttackOutcome> = new Set(['miss', 'dodge', 'parry'] as AttackOutcome[]);

export class BatchTotals implements TelemetrySink {
  private readonly damageBySource = new Map<string, number>();
  private readonly abilities = new Map<string, Map<string, AbilityAccumulator>>();
  private readonly gained = new Map<string, Map<string, ResourceAccumulator>>();
  private readonly spent = new Map<string, Map<string, ResourceAccumulator>>();
  private readonly taken = new Map<string, Map<string, TakenAccumulator>>();
  private iterations = 0;

  /** Call once per completed iteration, so means divide by the right number. */
  finishIteration(): void {
    this.iterations += 1;
  }

  emit(event: TelemetryEvent): void {
    if (event.type === 'damage') {
      this.damageBySource.set(
        event.sourceId,
        (this.damageBySource.get(event.sourceId) ?? 0) + event.amount,
      );
      this.recordDealt(event);
      this.recordTaken(event);
      return;
    }

    if (event.type === 'resource_gained' || event.type === 'resource_spent') {
      const into = event.type === 'resource_gained' ? this.gained : this.spent;
      const perActor = mapFor(into, event.actorId);
      /*
       * An event with no source is kept and LABELLED, not dropped. A rage
       * breakdown whose parts do not add up to the total is worse than one with
       * an "unattributed" slice, because the reader cannot tell which.
       */
      const id = event.source ?? 'unattributed';
      const entry = perActor.get(id) ?? {
        name: event.sourceName ?? 'Unattributed',
        amount: 0,
        count: 0,
        wasted: 0,
      };
      entry.amount += event.amount;
      entry.count += 1;
      entry.wasted += event.wasted;
      perActor.set(id, entry);
    }
  }

  private recordDealt(event: Extract<TelemetryEvent, { type: 'damage' }>): void {
    const perActor = mapFor(this.abilities, event.sourceId);
    const entry = perActor.get(event.abilityName) ?? blankAbility();
    entry.damage += event.amount;
    entry.attempts += 1;
    if (AVOIDED.has(event.outcome)) entry.avoided += 1;
    else entry.hits += 1;
    if (event.critical) entry.crits += 1;
    if (event.outcome === 'glance') entry.glances += 1;
    perActor.set(event.abilityName, entry);
  }

  private recordTaken(event: Extract<TelemetryEvent, { type: 'damage' }>): void {
    const perActor = mapFor(this.taken, event.targetId);
    const entry = perActor.get(event.abilityName) ?? {
      damage: 0,
      attempts: 0,
      hits: 0,
      outcomes: new Map<AttackOutcome, number>(),
    };
    entry.damage += event.amount;
    entry.attempts += 1;
    if (!AVOIDED.has(event.outcome)) entry.hits += 1;
    entry.outcomes.set(event.outcome, (entry.outcomes.get(event.outcome) ?? 0) + 1);
    perActor.set(event.abilityName, entry);
  }

  /** Total damage dealt by any of the given actors, across every iteration. */
  totalForAny(sourceIds: Iterable<string>): number {
    let sum = 0;
    for (const id of sourceIds) sum += this.damageBySource.get(id) ?? 0;
    return sum;
  }

  /** Per-iteration mean damage dealt by one actor. */
  meanDamageFor(sourceId: string): number {
    return this.per(this.damageBySource.get(sourceId) ?? 0);
  }

  abilityBreakdown(sourceId: string): readonly BatchAbilityTotals[] {
    const perActor = this.abilities.get(sourceId);
    if (!perActor) return [];

    let total = 0;
    for (const entry of perActor.values()) total += entry.damage;

    return [...perActor.entries()]
      .map(([abilityName, e]) => ({
        abilityName,
        damage: this.per(e.damage),
        attempts: this.per(e.attempts),
        hits: this.per(e.hits),
        // POOLED, not a mean of per-iteration means: total damage over total
        // landed hits is the average hit, and stays right when iterations
        // differ in length.
        average: e.hits > 0 ? e.damage / e.hits : 0,
        share: total > 0 ? e.damage / total : 0,
        critRate: e.attempts > 0 ? e.crits / e.attempts : 0,
        glanceRate: e.attempts > 0 ? e.glances / e.attempts : 0,
        avoidRate: e.attempts > 0 ? e.avoided / e.attempts : 0,
      }))
      .sort((a, b) => b.damage - a.damage);
  }

  damageTaken(actorId: string): readonly BatchDamageTaken[] {
    const perActor = this.taken.get(actorId);
    if (!perActor) return [];

    return [...perActor.entries()]
      .map(([sourceName, e]) => {
        const rates = {} as Record<AttackOutcome, number>;
        for (const [outcome, count] of e.outcomes) {
          rates[outcome] = e.attempts > 0 ? count / e.attempts : 0;
        }
        return {
          sourceName,
          damage: this.per(e.damage),
          attempts: this.per(e.attempts),
          hits: this.per(e.hits),
          average: e.hits > 0 ? e.damage / e.hits : 0,
          rates,
        };
      })
      .sort((a, b) => b.damage - a.damage);
  }

  resourceFlow(actorId: string, resource: string): BatchResourceFlow {
    const gained = this.flowSide(this.gained.get(actorId));
    const spent = this.flowSide(this.spent.get(actorId));
    void resource;
    return {
      gained,
      spent,
      totalGained: gained.reduce((n, e) => n + e.amount, 0),
      totalSpent: spent.reduce((n, e) => n + e.amount, 0),
      totalWasted: gained.reduce((n, e) => n + e.wasted, 0),
    };
  }

  private flowSide(
    perActor: Map<string, ResourceAccumulator> | undefined,
  ): readonly BatchResourceTotals[] {
    if (!perActor) return [];
    let total = 0;
    for (const e of perActor.values()) total += e.amount;

    return [...perActor.entries()]
      .map(([sourceId, e]) => ({
        sourceId,
        sourceName: e.name,
        amount: this.per(e.amount),
        count: this.per(e.count),
        wasted: this.per(e.wasted),
        share: total > 0 ? e.amount / total : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /** A running total divided by the iterations that produced it. */
  private per(total: number): number {
    return this.iterations > 0 ? total / this.iterations : 0;
  }
}

function mapFor<T>(outer: Map<string, Map<string, T>>, key: string): Map<string, T> {
  let inner = outer.get(key);
  if (!inner) {
    inner = new Map<string, T>();
    outer.set(key, inner);
  }
  return inner;
}

function blankAbility(): AbilityAccumulator {
  return { damage: 0, attempts: 0, hits: 0, crits: 0, glances: 0, avoided: 0 };
}
