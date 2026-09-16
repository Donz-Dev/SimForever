import type { StatName } from './Stats';

/**
 * How a modifier combines with everything else affecting the same stat.
 *
 * - `flat`       adds a raw amount:            +200 strength
 * - `percentAdd` joins an additive pool:       +10% and +10% together give +20%
 * - `percentMul` multiplies independently:     +10% and +10% together give +21%
 *
 * WoW uses both percentage kinds depending on the effect, so the engine has to
 * support both rather than picking one. Which bucket a given buff belongs in is
 * game content, not engine policy, so it is declared per modifier.
 */
export type StatModifierOperation = 'flat' | 'percentAdd' | 'percentMul';

/**
 * One contribution to a stat, owned by whatever applied it.
 *
 * Modifiers are never folded into base stats. A buff applies a modifier and
 * removes it on expiry, so the underlying character data is never corrupted by
 * a buff that came and went. See StatBlock for how they are combined.
 */
export interface StatModifier {
  /**
   * Identifies the source so it can be removed again. Every modifier applied
   * by one aura instance shares that instance's id.
   */
  readonly sourceId: string;
  readonly stat: StatName;
  readonly operation: StatModifierOperation;
  /** Raw amount for `flat`; a fraction for the percentage kinds (0.1 = +10%). */
  readonly value: number;
}

/** A modifier declaration that has not yet been bound to a source. */
export type StatModifierSpec = Omit<StatModifier, 'sourceId'>;

/** Bind a set of specs to a source id, producing removable modifiers. */
export function bindModifiers(
  specs: readonly StatModifierSpec[],
  sourceId: string,
): StatModifier[] {
  return specs.map((spec) => ({ ...spec, sourceId }));
}

/** Shorthand for a flat modifier spec. */
export function flat(stat: StatName, value: number): StatModifierSpec {
  return { stat, operation: 'flat', value };
}

/** Shorthand for an additive percentage spec. `percent('strength', 0.1)` is +10%. */
export function percent(stat: StatName, value: number): StatModifierSpec {
  return { stat, operation: 'percentAdd', value };
}

/** Shorthand for an independently multiplicative percentage spec. */
export function percentMultiplicative(stat: StatName, value: number): StatModifierSpec {
  return { stat, operation: 'percentMul', value };
}
