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

/**
 * How much of a fight an aura was up for.
 *
 * ----------------------------------------------------------------------------
 * WHY UPTIME AND NOT A COUNT.
 *
 * "Flurry procced 34 times" is not the question. Flurry is worth what it is
 * worth for as long as it is up, and 34 procs that overlap heavily are worth
 * far less than 34 that do not. The same goes for the debuffs: a Sunder Armor
 * that falls off for eight seconds every minute is a different fight from one
 * that never does, and no cast count distinguishes them.
 *
 * Averaged across the batch, not read off one iteration, for the reason every
 * other figure here is.
 * ----------------------------------------------------------------------------
 */
export interface BatchAuraUptime {
  readonly auraId: string;
  readonly auraName: string;
  /** 0 to 1, mean across every iteration. */
  readonly uptime: number;
  /** Mean applications per iteration, refreshes included. */
  readonly applications: number;
  readonly isDebuff: boolean;
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

interface UptimeAccumulator {
  name: string;
  isDebuff: boolean;
  /** Milliseconds up, summed over every iteration that has finished. */
  totalMs: number;
  applications: number;
  /** When the current window opened, or undefined if it is not up. */
  openedAt?: number;
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
  private readonly uptime = new Map<string, Map<string, UptimeAccumulator>>();
  private iterations = 0;
  private totalDurationMs = 0;

  /**
   * Call once per completed iteration, so means divide by the right number.
   *
   * The iteration's LENGTH is needed too, and not just to divide by: an aura
   * that is still up when the fight ends never emits a removal, so its final
   * window has no closing timestamp. Closing them here is the difference
   * between Battle Shout reading 100% and reading 0% -- it is applied once,
   * lasts three minutes, and in a sixty second fight it is never removed at
   * all.
   */
  finishIteration(durationMs: number): void {
    this.iterations += 1;
    this.totalDurationMs += durationMs;

    for (const perActor of this.uptime.values()) {
      for (const entry of perActor.values()) {
        if (entry.openedAt === undefined) continue;
        entry.totalMs += Math.max(0, durationMs - entry.openedAt);
        entry.openedAt = undefined;
      }
    }
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

    if (
      event.type === 'aura_applied' ||
      event.type === 'aura_refreshed' ||
      event.type === 'aura_removed'
    ) {
      this.recordAura(event);
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

  private recordAura(event: Extract<TelemetryEvent, { type: `aura_${string}` }>): void {
    /*
     * Keyed on WHO IS CARRYING IT, not on who applied it. A debuff belongs to
     * the target and a buff to the player, and the panel asks for each
     * separately -- keying on the caster would file Sunder Armor under the
     * warrior and make "uptime on the target" unanswerable.
     */
    const perActor = mapFor(this.uptime, event.targetId);
    const entry = perActor.get(event.auraId) ?? {
      name: event.auraName,
      isDebuff: event.isDebuff,
      totalMs: 0,
      applications: 0,
    };

    if (event.type === 'aura_removed') {
      if (entry.openedAt !== undefined) {
        entry.totalMs += Math.max(0, event.timestamp - entry.openedAt);
        entry.openedAt = undefined;
      }
    } else {
      entry.applications += 1;
      /*
       * A REFRESH DOES NOT REOPEN THE WINDOW. It extends the one already
       * running, so closing and reopening here would lose nothing but would
       * also count nothing -- the window is continuous either way. What it
       * must not do is overwrite `openedAt`, which would silently discard
       * every millisecond since the aura first went up.
       */
      if (entry.openedAt === undefined) entry.openedAt = event.timestamp;
    }

    perActor.set(event.auraId, entry);
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

  /**
   * Aura uptime on one actor, longest first.
   *
   * Divided by the batch's TOTAL fight time rather than by iterations times a
   * nominal length, because fights vary in length by FIGHT_DURATION_VARIANCE
   * and a three-second difference is a five percent error on a sixty second
   * fight.
   *
   * Clamped to 1. An aura cannot be up for more than the fight, and a figure
   * over 100% would be a bug in this accounting rather than a finding -- but
   * it should not be shown as one either.
   */
  auraUptime(actorId: string, kind: 'buff' | 'debuff'): readonly BatchAuraUptime[] {
    const perActor = this.uptime.get(actorId);
    if (!perActor || this.totalDurationMs <= 0) return [];

    return [...perActor.entries()]
      .filter(([, entry]) => entry.isDebuff === (kind === 'debuff'))
      .map(([auraId, entry]) => ({
        auraId,
        auraName: entry.name,
        uptime: Math.min(1, entry.totalMs / this.totalDurationMs),
        applications: this.per(entry.applications),
        isDebuff: entry.isDebuff,
      }))
      .filter((entry) => entry.uptime > 0)
      .sort((a, b) => b.uptime - a.uptime);
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
