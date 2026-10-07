import type { TalentEffects } from './TalentEffect';

/**
 * Which of the four buckets a talent falls in, and the nine classes' tables.
 *
 * ------------------------------------------------------------------------------
 * ONE IMPLEMENTATION OF THE RULE, because there were two and they disagreed.
 *
 * `tools/class_audit.ts` has carried this classification since the census became
 * derivable, and `tools/census.ts` was later written with its own copy -- which
 * left out `appliedElsewhere` and therefore called two working Rogue poison
 * talents RULED OUT the moment one of their clauses was scoped. Two tools, one
 * rule, two answers, and the published census would have been whichever was run
 * last. That is the `isWeaponUse` failure in a different file: a rule that lives
 * privately in one place while another re-derives it.
 *
 * THE FOUR BUCKETS ARE EXHAUSTIVE AND DISJOINT, which the first version of this
 * was not: a talent with an effect AND only-scoped reasons matched none of them,
 * so the rows did not sum to the talent count and `partly` read low for six
 * classes. `assertAccountsForEveryTalent` is what stops that returning.
 * ------------------------------------------------------------------------------
 */
export type TalentBucket = 'fully' | 'partly' | 'ruledOut' | 'liveGap';

export interface TalentClassification {
  readonly id: string;
  readonly bucket: TalentBucket;
  readonly reasons: readonly string[];
  /** The `scope` on each unmodelled entry that carries one. */
  readonly scopes: readonly string[];
}

interface UnmodelledEntry {
  readonly kind: 'unmodelled';
  readonly reason: string;
  readonly scope?: string;
  readonly appliedElsewhere?: string;
}

/**
 * Classify one talent from its declared effects.
 *
 * `appliedElsewhere` COUNTS AS A WORKING EFFECT, because it says the talent IS
 * applied -- just by a module the effect table cannot express, which is what the
 * two Rogue poison talents are. Before the field existed both were counted as
 * live gaps while working perfectly, and their reasons saying "APPLIES in full"
 * in capitals could not reach a census that counts effects rather than
 * adjectives.
 *
 * SCOPE DECIDES RULED OUT VERSUS LIVE GAP ONLY ONCE A TALENT HAS NO WORKING
 * EFFECT AT ALL. A talent that does something and also has a ruled-out clause is
 * PARTLY modelled either way.
 */
export function classifyTalent(id: string, effects: TalentEffects): TalentClassification {
  const unmodelled = effects.filter((effect) => effect.kind === 'unmodelled') as UnmodelledEntry[];
  const elsewhere = unmodelled.filter((entry) => entry.appliedElsewhere !== undefined).length;
  const others = effects.length - unmodelled.length + elsewhere;
  const scopes = unmodelled
    .map((entry) => entry.scope)
    .filter((scope): scope is string => scope !== undefined);

  const working = others > 0;
  const allScoped = unmodelled.length > 0 && scopes.length === unmodelled.length;

  const bucket: TalentBucket =
    unmodelled.length === 0
      ? 'fully'
      : working
        ? 'partly'
        : allScoped
          ? 'ruledOut'
          : 'liveGap';

  return { id, bucket, reasons: unmodelled.map((entry) => entry.reason), scopes };
}

export interface CensusCounts {
  talents: number;
  fully: number;
  partly: number;
  ruledOut: number;
  liveGap: number;
}

/** Count one class's table into the four buckets. */
export function censusOf(table: Readonly<Record<string, TalentEffects>>): CensusCounts {
  const counts: CensusCounts = { talents: 0, fully: 0, partly: 0, ruledOut: 0, liveGap: 0 };
  for (const [id, effects] of Object.entries(table)) {
    counts.talents += 1;
    counts[classifyTalent(id, effects).bucket] += 1;
  }
  return counts;
}

/**
 * Throw unless the four buckets account for every talent.
 *
 * The check that makes the census derivable rather than believed: a hand-kept
 * total in HANDOVER.md can drift, and a clean merge of two branches that each
 * moved it by one from the same base produces a number neither wrote.
 */
export function assertAccountsForEveryTalent(name: string, counts: CensusCounts): void {
  const summed = counts.fully + counts.partly + counts.ruledOut + counts.liveGap;
  if (summed !== counts.talents) {
    throw new Error(`${name}: buckets ${summed} do not account for ${counts.talents} talents`);
  }
}

/** Every `scope` used across a class's table, for the per-member tally. */
export function scopesOf(table: Readonly<Record<string, TalentEffects>>): string[] {
  const out: string[] = [];
  for (const [id, effects] of Object.entries(table)) out.push(...classifyTalent(id, effects).scopes);
  return out;
}
