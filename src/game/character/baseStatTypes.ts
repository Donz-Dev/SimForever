import type { CombatStyleId } from './ids';

/**
 * A character's stats at level 60 with no gear, buffs or talents.
 *
 * These are **constants**, not calculated results. They are the floor that
 * everything else is added to, not the answer to "what are my stats".
 *
 * Every value is exactly as the base stats spreadsheet gives it. Nothing here
 * is derived, rounded or inferred.
 */
export interface BaseStatBlock {
  /** Maximum health with no stamina contribution applied on top. */
  readonly hitPoints: number;
  /** Maximum mana. 0 for classes that do not use it. */
  readonly mana: number;

  readonly strength: number;
  readonly agility: number;
  readonly stamina: number;
  readonly intellect: number;
  readonly spirit: number;

  readonly attackPower: number;
  readonly rangedAttackPower: number;

  /**
   * Base crit chance in PERCENTAGE POINTS, not a fraction: 1.14 means 1.14%.
   *
   * These are class constants that other contributions are added to, and some
   * are negative (a Hunter's is -1.53). They are therefore NOT a character's
   * actual crit chance, and the engine does not currently use them: the
   * agility-to-crit conversion that completes the formula does not exist yet.
   */
  readonly critChance: number;
  /** Base spell crit chance in percentage points. Same caveat as `critChance`. */
  readonly spellCritChance: number;
}

/**
 * One row of the base stats table.
 *
 * `form` is null for the eight classes that have none. The Druid has a variant
 * per form, because bear form changes hit points and attack power.
 */
export interface BaseStatVariant {
  readonly form: CombatStyleId | null;
  readonly stats: BaseStatBlock;
}
