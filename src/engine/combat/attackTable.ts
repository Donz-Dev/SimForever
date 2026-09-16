import type { Combatant, WeaponSlot } from '../actors/Combatant';
import type { RNG } from '../rng';

/**
 * Combat resolution runs on an integer die from 1 to 10000, where 10000 is
 * 100%. Every chance is converted into these units before any comparison.
 *
 * Integers rather than floats because the outcome of an attack must be exactly
 * reproducible. Comparing accumulated floating-point percentages would make the
 * result depend on the order they were added in, and a 0.0001% drift at a table
 * boundary is the kind of bug that shows up as an unexplained 0.1% DPS
 * difference three months later.
 */
export const ROLL_MAX = 10000;

/** Chances live in this range: 0 means never, 10000 means always. */
export type RollUnits = number;

/**
 * Convert a percentage into roll units, TRUNCATING rather than rounding.
 *
 * 25.7891% becomes 2578, not 2579. Truncation is the stated rule, and it
 * matters: rounding would hand out a fraction of a percent of free crit across
 * thousands of iterations.
 */
export function toRollUnits(percent: number): RollUnits {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(ROLL_MAX, Math.trunc(percent * 100));
}

/** Convert roll units back to a percentage, for display. */
export function toPercent(units: RollUnits): number {
  return units / 100;
}

/**
 * The six combat tables.
 *
 * Which outcomes are possible, in what order they are checked, and whether one
 * roll or two are used all depend on this.
 */
export type AttackTableKind =
  | 'melee-auto'
  | 'ranged-auto'
  | 'melee-special'
  | 'ranged-special'
  | 'spell'
  | 'melee-received';

export type AttackOutcome =
  | 'miss'
  | 'dodge'
  | 'parry'
  | 'glance'
  | 'crush'
  | 'crit'
  | 'hit';

/** Outcomes where the attack does not land at all. */
export const AVOIDED_OUTCOMES: ReadonlySet<AttackOutcome> = new Set<AttackOutcome>([
  'miss',
  'dodge',
  'parry',
]);

/**
 * Every chance a table might consult, in roll units, plus the multipliers that
 * apply when the corresponding outcome comes up.
 *
 * A table ignores the entries it does not use: the spell table never looks at
 * `dodge`, so a provider may leave it at zero without that meaning anything.
 */
export interface AttackChances {
  readonly miss: RollUnits;
  readonly dodge: RollUnits;
  readonly parry: RollUnits;
  readonly glance: RollUnits;
  readonly crush: RollUnits;
  readonly crit: RollUnits;
  /**
   * Damage multiplier range for a glancing blow, rolled uniformly.
   *
   * A range rather than a single value because the penalty is genuinely
   * variable: at a 15-point skill deficit a glance lands somewhere between 55%
   * and 75% of normal damage. Set both ends the same for a fixed penalty.
   */
  readonly glanceMultiplierMin: number;
  readonly glanceMultiplierMax: number;
  /** Damage multiplier on a critical strike. */
  readonly critMultiplier: number;
  /** Damage multiplier on a crushing blow. */
  readonly crushMultiplier: number;
}

export const NO_CHANCES: AttackChances = {
  miss: 0,
  dodge: 0,
  parry: 0,
  glance: 0,
  crush: 0,
  crit: 0,
  glanceMultiplierMin: 1,
  glanceMultiplierMax: 1,
  critMultiplier: 1,
  crushMultiplier: 1,
};

/**
 * Supplies the chances for an attack.
 *
 * The table STRUCTURE is engine mechanics; the NUMBERS are ruleset content, so
 * they are injected. A simulation without a provider falls back to
 * `defaultAttackChances`, which only rolls crit.
 */
/**
 * Extra context an attack carries beyond who is hitting whom.
 *
 * The weapon slot matters because a dual-wielder's hands are not equivalent:
 * the off-hand carries its own miss penalty and may have a different weapon
 * skill, so it needs its own chances.
 */
export interface AttackContext {
  readonly slot?: WeaponSlot;
}

export type AttackChanceProvider = (
  kind: AttackTableKind,
  source: Combatant,
  target: Combatant,
  context?: AttackContext,
) => AttackChances;

export interface AttackResolution {
  readonly outcome: AttackOutcome;
  /** 0 for an avoided attack, the glance or crit multiplier otherwise. */
  readonly damageMultiplier: number;
  /** True when the attack did not land. */
  readonly avoided: boolean;
  /** The rolls that produced this, in order. One or two depending on the table. */
  readonly rolls: readonly number[];
}

/**
 * The order each table checks outcomes in, and whether the crit check shares
 * the first roll or gets its own.
 *
 * Single-roll tables walk one die down a cumulative range: miss occupies
 * 1..miss, dodge the next slice, and so on, so a large miss chance genuinely
 * crowds out crit. Two-roll tables spend the first die on avoidance only and
 * then roll again for crit, so avoidance and crit do not compete.
 */
interface TableShape {
  /** Checked against the first roll, in order. */
  readonly firstRoll: readonly AttackOutcome[];
  /** Checked against the second roll. Empty means a single-roll table. */
  readonly secondRoll: readonly AttackOutcome[];
}

const TABLES: Record<AttackTableKind, TableShape> = {
  // 1. Melee auto-attack: everything on one roll, including crit.
  'melee-auto': {
    firstRoll: ['miss', 'dodge', 'parry', 'glance', 'crit'],
    secondRoll: [],
  },
  // 2. Ranged auto-attack: no dodge, parry or glance.
  'ranged-auto': {
    firstRoll: ['miss', 'crit'],
    secondRoll: [],
  },
  // 3. Melee special: avoidance first, then a separate crit roll.
  'melee-special': {
    firstRoll: ['miss', 'dodge', 'parry'],
    secondRoll: ['crit'],
  },
  // 4. Ranged special: only miss can avoid it.
  'ranged-special': {
    firstRoll: ['miss'],
    secondRoll: ['crit'],
  },
  // 5. Spell: miss here means resisted.
  spell: {
    firstRoll: ['miss'],
    secondRoll: ['crit'],
  },
  // 6. Melee attacks received by the player, including crushing blows.
  'melee-received': {
    firstRoll: ['miss', 'dodge', 'parry', 'crush', 'crit'],
    secondRoll: [],
  },
};

/** Which outcomes a table can produce. For validation and documentation. */
export function outcomesFor(kind: AttackTableKind): readonly AttackOutcome[] {
  const shape = TABLES[kind];
  return [...shape.firstRoll, ...shape.secondRoll, 'hit'];
}

/** Whether a table spends two rolls rather than one. */
export function isTwoRoll(kind: AttackTableKind): boolean {
  return TABLES[kind].secondRoll.length > 0;
}

/**
 * Resolve an attack against its table.
 *
 * Consumes one RNG roll for a single-roll table, and two for a two-roll table
 * BUT ONLY IF the first roll did not avoid the attack. A missed special attack
 * never rolls for crit, which keeps the RNG stream aligned with what actually
 * happened.
 */
export function resolveAttackTable(
  kind: AttackTableKind,
  chances: AttackChances,
  rng: RNG,
): AttackResolution {
  const shape = TABLES[kind];
  const rolls: number[] = [];

  const first = rng.nextInt(1, ROLL_MAX);
  rolls.push(first);

  const firstOutcome = walk(shape.firstRoll, chances, first);
  if (firstOutcome !== null) {
    return finish(firstOutcome, chances, rolls, rng);
  }

  if (shape.secondRoll.length === 0) {
    return finish('hit', chances, rolls, rng);
  }

  const second = rng.nextInt(1, ROLL_MAX);
  rolls.push(second);

  const secondOutcome = walk(shape.secondRoll, chances, second);
  return finish(secondOutcome ?? 'hit', chances, rolls, rng);
}

/**
 * Walk a cumulative range, returning the outcome the roll landed in.
 *
 * Returns null when the roll fell past every slice, which means "keep going":
 * either to the second roll, or to a plain hit.
 */
function walk(
  order: readonly AttackOutcome[],
  chances: AttackChances,
  roll: number,
): AttackOutcome | null {
  let ceiling = 0;
  for (const outcome of order) {
    ceiling += chanceFor(outcome, chances);
    if (roll <= ceiling) return outcome;
  }
  return null;
}

function chanceFor(outcome: AttackOutcome, chances: AttackChances): RollUnits {
  switch (outcome) {
    case 'miss':
      return chances.miss;
    case 'dodge':
      return chances.dodge;
    case 'parry':
      return chances.parry;
    case 'glance':
      return chances.glance;
    case 'crush':
      return chances.crush;
    case 'crit':
      return chances.crit;
    case 'hit':
      return 0;
  }
}

function finish(
  outcome: AttackOutcome,
  chances: AttackChances,
  rolls: number[],
  rng: RNG,
): AttackResolution {
  const avoided = AVOIDED_OUTCOMES.has(outcome);
  return {
    outcome,
    avoided,
    damageMultiplier: multiplierFor(outcome, chances, rng),
    rolls,
  };
}

function multiplierFor(
  outcome: AttackOutcome,
  chances: AttackChances,
  rng: RNG,
): number {
  switch (outcome) {
    case 'miss':
    case 'dodge':
    case 'parry':
      return 0;
    case 'glance':
      return rollGlanceMultiplier(chances, rng);
    case 'crush':
      return chances.crushMultiplier;
    case 'crit':
      return chances.critMultiplier;
    case 'hit':
      return 1;
  }
}

/**
 * A glancing blow's damage, rolled uniformly within its range.
 *
 * Rolled in whole percentage points, matching how the bounds are derived: both
 * ends are floored to integers, so a finer roll would imply a precision the
 * inputs do not have.
 *
 * Consumes an RNG draw only when the range is actually a range, so a fixed
 * penalty does not silently shift the random stream.
 */
function rollGlanceMultiplier(chances: AttackChances, rng: RNG): number {
  const min = Math.round(chances.glanceMultiplierMin * 100);
  const max = Math.round(chances.glanceMultiplierMax * 100);
  if (max <= min) return chances.glanceMultiplierMin;
  return rng.nextInt(min, max) / 100;
}

/**
 * Fallback chances when a simulation has no provider configured: crit only,
 * taken from the attacker's stats.
 *
 * This is what low-level engine tests get. It is deliberately not the Forever
 * ruleset, which lives in game content.
 */
export function defaultAttackChances(
  kind: AttackTableKind,
  source: Combatant,
): AttackChances {
  const stats = source.stats.effective;
  const isSpell = kind === 'spell';

  return {
    ...NO_CHANCES,
    crit: toRollUnits(isSpell ? stats.spellCritChance : stats.critChance),
    critMultiplier: isSpell ? 1.5 : 2,
  };
}
