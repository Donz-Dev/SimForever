import type { ResourceType } from '../../../engine';
import type { AplCompare, AplCondition } from './AplCondition';

/**
 * Short ways to write the conditions the nine class lists actually use.
 *
 * ============================================================================
 * ONE SET OF BUILDERS, WHERE THERE WERE NINE SETS OF CLOSURES.
 *
 * Every class file had grown its own helpers for the same handful of ideas,
 * and the duplication was not harmless: `expired` meant the TARGET's aura in
 * five files and the Hunter wrote `selfExpired` beside it for its own;
 * `missing`, `missingOn`, `withoutAura`, `selfLacks` and `actorHas` were four
 * names and two different tests. Reading a list meant first finding out which
 * dialect its file spoke.
 *
 * SO EVERY NAME HERE SAYS WHOSE AURA IT IS, in the name itself. `selfExpired`
 * and `targetExpired` are different functions rather than one function whose
 * meaning depends on the file it is called in -- which is the one mistake that
 * would convert silently, because both compile and both produce a perfectly
 * ordinary rotation.
 *
 * AND `has` IS KEPT APART FROM `expired`, which are the same question only if
 * an aura cannot be present with nothing left. The class files wrote both and
 * meant both: `!auras.has(id)` and `auras.remainingMs(id) <= 0`.
 * ============================================================================
 */

// --- auras on yourself -----------------------------------------------------

/** "the buff is up" -- `auras.has`, not a reading of the clock. */
export const selfHas = (auraId: string): AplCondition => ({
  kind: 'aura',
  on: 'self',
  auraId,
  present: true,
});

/** "the buff is not up". */
export const selfMissing = (auraId: string): AplCondition => ({
  kind: 'aura',
  on: 'self',
  auraId,
  present: false,
});

/** "the buff has run out", which is the clock and not `has`. */
export const selfExpired = (auraId: string): AplCondition =>
  selfTime('atMost', 0, auraId);

export const selfTime = (
  compare: AplCompare,
  seconds: number,
  auraId: string,
): AplCondition => ({ kind: 'auraTime', on: 'self', auraId, compare, seconds });

export const selfStacks = (
  compare: AplCompare,
  stacks: number,
  auraId: string,
): AplCondition => ({ kind: 'auraStacks', on: 'self', auraId, compare, stacks });

// --- auras on the target ---------------------------------------------------

export const targetHas = (auraId: string): AplCondition => ({
  kind: 'aura',
  on: 'target',
  auraId,
  present: true,
});

export const targetMissing = (auraId: string): AplCondition => ({
  kind: 'aura',
  on: 'target',
  auraId,
  present: false,
});

/** "the debuff has run out", the `if not active` five class files wrote. */
export const targetExpired = (auraId: string): AplCondition =>
  targetTime('atMost', 0, auraId);

export const targetTime = (
  compare: AplCompare,
  seconds: number,
  auraId: string,
): AplCondition => ({ kind: 'auraTime', on: 'target', auraId, compare, seconds });

export const targetStacks = (
  compare: AplCompare,
  stacks: number,
  auraId: string,
): AplCondition => ({ kind: 'auraStacks', on: 'target', auraId, compare, stacks });

export const petHas = (auraId: string): AplCondition => ({
  kind: 'aura',
  on: 'pet',
  auraId,
  present: true,
});

// --- resources -------------------------------------------------------------

export const resource = (
  compare: AplCompare,
  amount: number,
  which: ResourceType,
): AplCondition => ({ kind: 'resource', resource: which, compare, amount });

export const resourceFraction = (
  compare: AplCompare,
  fraction: number,
  which: ResourceType,
): AplCondition => ({ kind: 'resourceFraction', resource: which, compare, fraction });

/** Points held ON THE CURRENT TARGET. See the `comboPoints` kind for why. */
export const comboPoints = (compare: AplCompare, points: number): AplCondition => ({
  kind: 'comboPoints',
  compare,
  points,
});

// --- cooldowns, the clock, and health --------------------------------------

export const ready = (abilityId: string): AplCondition => ({
  kind: 'cooldown',
  abilityId,
  state: 'ready',
});

export const onCooldown = (abilityId: string): AplCondition => ({
  kind: 'cooldown',
  abilityId,
  state: 'onCooldown',
});

/** Seconds of fight left. */
export const fightRemaining = (compare: AplCompare, seconds: number): AplCondition => ({
  kind: 'fightRemaining',
  compare,
  seconds,
});

/**
 * A SHARE of the fight left, which is what an execute window is here.
 *
 * `inExecutePhase(context, f)` compares exactly these two numbers the same
 * way, so a list using it converts with no approximation.
 */
export const fightRemainingFraction = (
  compare: AplCompare,
  fraction: number,
): AplCondition => ({ kind: 'fightRemaining', compare, fraction });

/** Seconds since the pull. `('exactly', 0)` is the opener. */
export const fightElapsed = (compare: AplCompare, seconds: number): AplCondition => ({
  kind: 'fightElapsed',
  compare,
  seconds,
});

export const selfHealth = (compare: AplCompare, fraction: number): AplCondition => ({
  kind: 'health',
  on: 'self',
  compare,
  fraction,
});

// --- combinators -----------------------------------------------------------

/**
 * Every condition must hold.
 *
 * FLATTENS A NESTED `all`, which keeps the data readable in a saved file and
 * the sentence readable in the panel -- `a and (b and c)` is `a and b and c`,
 * and the conversion produced the nested shape wherever a class file composed
 * one helper out of another.
 */
export const all = (...of: readonly AplCondition[]): AplCondition => ({
  kind: 'all',
  of: of.flatMap((part) => (part.kind === 'all' ? part.of : [part])),
});

export const any = (...of: readonly AplCondition[]): AplCondition => ({
  kind: 'any',
  of: of.flatMap((part) => (part.kind === 'any' ? part.of : [part])),
});

export const not = (of: AplCondition): AplCondition => ({ kind: 'not', of });

// --- the three that are not declarative ------------------------------------

export const hasReaction = (reactionId: string): AplCondition => ({
  kind: 'hasReaction',
  reactionId,
});

export const castsInstantly = (abilityId: string): AplCondition => ({
  kind: 'castsInstantly',
  abilityId,
});

export const swungWithin = (
  slot: 'mainHand' | 'offHand' | 'ranged',
  withinMs: number,
): AplCondition => ({ kind: 'swungWithin', slot, withinMs });

export const swingIn = (
  compare: AplCompare,
  milliseconds: number,
  slot: 'mainHand' | 'offHand' | 'ranged' = 'mainHand',
): AplCondition => ({ kind: 'swingIn', slot, compare, milliseconds });

export const builtin = (
  id: string,
  ...args: readonly (string | number)[]
): AplCondition => ({ kind: 'builtin', id, ...(args.length > 0 ? { args } : {}) });
