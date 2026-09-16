import type { PartialStats, StatName, Stats } from './Stats';
import { STAT_NAMES, makeStats } from './Stats';
import type { StatModifier } from './StatModifier';

/**
 * A character's stats: an immutable base plus a live set of modifiers.
 *
 *     effective = (base + sum(flat))
 *               * (1 + sum(percentAdd))
 *               * product(1 + each percentMul)
 *
 * The ordering above is fixed and applies to every stat. Flat bonuses land
 * before percentages, so a +200 strength trinket is amplified by a +10%
 * strength buff, which is the behaviour players expect.
 *
 * Base stats are never mutated. A buff adds modifiers and removes them on
 * expiry, so the character is always exactly one `clearModifiers()` away from
 * its unbuffed state. Recomputation is lazy and cached: reading a stat between
 * two buff applications costs nothing.
 */
export class StatBlock {
  private readonly base: Stats;
  private readonly modifiers: StatModifier[] = [];
  private cache: Stats | null = null;

  constructor(base: PartialStats = {}) {
    this.base = makeStats(base);
  }

  /** The unmodified stats this character was built with. */
  get baseStats(): Readonly<Stats> {
    return this.base;
  }

  /** Stats after every active modifier. Cached until modifiers change. */
  get effective(): Readonly<Stats> {
    if (this.cache === null) {
      this.cache = this.computeEffective();
    }
    return this.cache;
  }

  /** Effective value of a single stat. */
  get(stat: StatName): number {
    return this.effective[stat];
  }

  addModifiers(modifiers: readonly StatModifier[]): void {
    if (modifiers.length === 0) return;
    this.modifiers.push(...modifiers);
    this.cache = null;
  }

  addModifier(modifier: StatModifier): void {
    this.modifiers.push(modifier);
    this.cache = null;
  }

  /** Remove every modifier applied by one source. */
  removeModifiersFrom(sourceId: string): void {
    let removed = 0;
    for (let i = this.modifiers.length - 1; i >= 0; i--) {
      if (this.modifiers[i].sourceId === sourceId) {
        this.modifiers.splice(i, 1);
        removed++;
      }
    }
    if (removed > 0) this.cache = null;
  }

  clearModifiers(): void {
    if (this.modifiers.length === 0) return;
    this.modifiers.length = 0;
    this.cache = null;
  }

  /** Active modifiers, for inspection and tests. */
  get activeModifiers(): readonly StatModifier[] {
    return this.modifiers;
  }

  private computeEffective(): Stats {
    const result = makeStats();

    for (const stat of STAT_NAMES) {
      let flatTotal = this.base[stat];
      let percentAddTotal = 0;
      let percentMulProduct = 1;

      for (const modifier of this.modifiers) {
        if (modifier.stat !== stat) continue;
        switch (modifier.operation) {
          case 'flat':
            flatTotal += modifier.value;
            break;
          case 'percentAdd':
            percentAddTotal += modifier.value;
            break;
          case 'percentMul':
            percentMulProduct *= 1 + modifier.value;
            break;
        }
      }

      result[stat] = flatTotal * (1 + percentAddTotal) * percentMulProduct;
    }

    return result;
  }
}
