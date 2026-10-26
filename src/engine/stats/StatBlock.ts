import type { PartialStats, StatName, Stats } from './Stats';
import { STAT_NAMES, makeStats } from './Stats';
import type { StatModifier } from './StatModifier';
import { RATING_PER_PERCENT } from '../combat/ratings';

/**
 * THE STATS WHOSE SOURCES MULTIPLY RATHER THAN ADD (round 63), with the rating
 * that makes one whole multiplier step: 1,000 haste rating is +100%.
 *
 * ----------------------------------------------------------------------------
 * The owner's ruling: "All Haste effects are treated as individual sources and
 * are multiplied together." So 3% from a racial, three 1% enchants and a 25%
 * Flurry are `1.03 x 1.01 x 1.01 x 1.01 x 1.25 = 1.3265`, and NOT the 31% that
 * summing the ratings gave for the whole project.
 *
 * EACH FLAT MODIFIER IS ONE SOURCE, AND SO IS THE BASE. `createPlayer` puts
 * every item, enchant and racial in as a modifier of its own rather than
 * folding them into the base, so the base is normally nothing. The result is
 * written back as the EQUIVALENT rating -- `(product - 1) x 1000` -- so every
 * reader that turns the rating into a multiplier gets the compounded figure
 * without knowing any of this happened.
 * ----------------------------------------------------------------------------
 */
const COMPOUNDING_STATS: Partial<Record<StatName, number>> = {
  hasteRating: RATING_PER_PERCENT.haste * 100,
  // Swing speed compounds the same way, source by source (round 75).
  attackSpeedRating: RATING_PER_PERCENT.haste * 100,
};

/**
 * A character's stats: an immutable base plus a live set of modifiers.
 *
 *     effective = (base + sum(flat))
 *               * (1 + sum(percentAdd))
 *               * product(1 + each percentMul)
 *
 * except a stat in `COMPOUNDING_STATS` -- haste -- whose base and flat
 * modifiers each count as a source and MULTIPLY (round 63).
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
/**
 * Turns resolved primary stats into the secondary stats they produce.
 *
 * The conversion table is game content (a Warrior gets 2 attack power per
 * strength, a Rogue gets 1), so the engine takes it as a function rather than
 * knowing any of the numbers.
 */
export type StatDerivation = (primary: Readonly<Stats>) => PartialStats;

export class StatBlock {
  private readonly base: Stats;
  private readonly modifiers: StatModifier[] = [];
  private readonly derivation: StatDerivation | undefined;
  private cache: Stats | null = null;

  constructor(base: PartialStats = {}, derivation?: StatDerivation) {
    this.base = makeStats(base);
    this.derivation = derivation;
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

  /**
   * Effective stats, in two passes.
   *
   * Pass one resolves everything from base and modifiers. Pass two feeds the
   * resolved PRIMARY stats through the derivation and folds what comes back in
   * as extra flat contributions, then resolves again.
   *
   * Two passes rather than one because derivation has to see primary stats that
   * are already fully buffed: a +10% strength blessing must increase attack
   * power too, which it would not if attack power were derived from base
   * strength. Derivation never produces a primary stat, so the primaries are
   * identical in both passes and this terminates.
   */
  private computeEffective(): Stats {
    const firstPass = this.resolve({});
    if (!this.derivation) return firstPass;
    return this.resolve(this.derivation(firstPass));
  }

  private resolve(extra: PartialStats): Stats {
    const result = makeStats();

    for (const stat of STAT_NAMES) {
      let flatTotal = this.base[stat] + (extra[stat] ?? 0);
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

      const unit = COMPOUNDING_STATS[stat];
      if (unit !== undefined) {
        /*
         * EACH SOURCE A FACTOR OF ITS OWN (round 63). The base is one source
         * and every flat modifier another; the product goes back out as the
         * rating that would have produced it.
         */
        let product = 1 + (this.base[stat] + (extra[stat] ?? 0)) / unit;
        for (const modifier of this.modifiers) {
          if (modifier.stat === stat && modifier.operation === 'flat') product *= 1 + modifier.value / unit;
        }
        flatTotal = (product - 1) * unit;
      }

      result[stat] = flatTotal * (1 + percentAddTotal) * percentMulProduct;
    }

    return result;
  }
}
