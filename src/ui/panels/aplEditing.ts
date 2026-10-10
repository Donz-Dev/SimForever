import type { AplCondition, AplEntry } from '../../game/rotations/apl';
import type { ResourceType } from '../../engine';

/**
 * The edits the priority-list panel makes, as plain functions.
 *
 * ============================================================================
 * SEPARATE FROM THE COMPONENT BECAUSE THEY ARE THE PART THAT CAN BE WRONG.
 * Moving an entry past the end of the list, dropping a condition while
 * reordering, or turning an editable condition into one the engine reads
 * differently are all bugs that a render test cannot see and that a person
 * would discover as a rotation quietly doing something else.
 *
 * EVERYTHING HERE RETURNS A NEW LIST. Nothing mutates an entry or an array in
 * place, which is what lets the profile stay the immutable value the rest of
 * the app treats it as -- and what stops an edit to one profile reaching a
 * preset's own entries, which are module constants.
 * ============================================================================
 */

// --- reordering and membership ---------------------------------------------

/**
 * Move an entry up or down. Out of range is a NO-OP rather than a wrap.
 *
 * A list is read top to bottom and position IS priority, so wrapping the first
 * entry to the bottom on an up-arrow would be the most destructive possible
 * reading of a mis-click.
 */
export function moveEntry(
  entries: readonly AplEntry[],
  index: number,
  delta: number,
): readonly AplEntry[] {
  const target = index + delta;
  if (index < 0 || index >= entries.length) return entries;
  if (target < 0 || target >= entries.length) return entries;
  const next = [...entries];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function removeEntry(entries: readonly AplEntry[], index: number): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.filter((_entry, at) => at !== index);
}

/**
 * Add an ability at the BOTTOM, with no condition.
 *
 * At the bottom because that is the only position that cannot change what the
 * list already does: an unconditional entry anywhere else is a FLOOR under
 * everything below it, so inserting one at the top would silently make the
 * rest of the list unreachable.
 *
 * A DUPLICATE IS ALLOWED, deliberately. The Mage's Arcane Missiles and the
 * Warlock's Shadow Bolt are each in their list twice on purpose -- gated on a
 * proc above and ungated as the filler below -- and a test that said "no
 * ability twice" failed both correct lists the moment it was pointed at a
 * class other than the Warrior.
 */
export function addEntry(entries: readonly AplEntry[], abilityId: string): readonly AplEntry[] {
  if (abilityId.length === 0) return entries;
  return [...entries, { abilityId }];
}

export function setCondition(
  entries: readonly AplEntry[],
  index: number,
  condition: AplCondition | undefined,
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { condition: _dropped, ...rest } = entry;
    return condition ? { ...rest, condition } : rest;
  });
}

// --- conditions, as a flat list of clauses ---------------------------------

/**
 * The kinds the panel offers, which are the four the owner named plus buffs.
 *
 * BUFFS ARE IN EVEN THOUGH THEY WERE NOT ASKED FOR, because 60 of the 118
 * conditions in the stock lists are buff or debuff tests -- "Rip if Rip has
 * fallen off", "Pyroblast at 3 stacks". Without them an edited list could only
 * ever get simpler than the one it started from.
 */
export type ClauseKind = 'buff' | 'resource' | 'cooldown' | 'fight';

/**
 * THE FOUR BUFF TESTS, AND `absent` IS NOT `down`.
 *
 * ----------------------------------------------------------------------------
 * `absent` is `!auras.has(id)` and `down` is `remainingMs(id) <= 0`, and the
 * two differ on an aura that is PRESENT WITH NOTHING LEFT. The stock lists
 * write both and mean both -- the Shaman's Windfury Weapon entry is the first
 * and five classes' `expired` helpers are the second.
 *
 * THEY WERE ONE OPTION IN THE FIRST DRAFT OF THIS FILE, and the round-trip
 * test caught it: opening the Enhancement list and touching nothing would have
 * rewritten `withoutAura('windfury_weapon')` into a reading of the clock. That
 * is the shape of edit that produces a perfectly ordinary DPS figure and no
 * error, which is why the test compares conditions rather than behaviour.
 * ----------------------------------------------------------------------------
 */
export type BuffTest = 'up' | 'absent' | 'down' | 'expiring' | 'stacks';

export interface Clause {
  readonly kind: ClauseKind;
  /** buff: whose, and which. */
  readonly on?: 'self' | 'target';
  readonly auraId?: string;
  readonly test?: BuffTest;
  /** resource: which pool. `combo` is combo points, which are not a pool. */
  readonly resource?: ResourceType | 'combo';
  /** cooldown: which ability, and which way round. */
  readonly abilityId?: string;
  readonly ready?: boolean;
  /** Every numeric kind. Seconds, stacks, points or a flat amount. */
  readonly compare?: 'atLeast' | 'atMost' | 'exactly';
  readonly value?: number;
  /** fight: whether `value` is seconds or a percentage. */
  readonly asPercent?: boolean;
}

/**
 * Break a condition into clauses the panel can edit, or `undefined`.
 *
 * ----------------------------------------------------------------------------
 * A FLAT `all` IS THE ONLY SHAPE THIS HANDLES, and that is deliberate rather
 * than a gap: the overwhelming majority of the stock conditions are one clause
 * or an AND of two, and the rest are `any`, `not`, and the four builtins.
 *
 * ANYTHING ELSE RETURNS `undefined` AND THE PANEL SHOWS IT READ-ONLY. That is
 * the honest failure: an editor that silently simplified Rogue's
 * `not(poolingForAmbush)` into something it could draw would change what the
 * rotation does, and the person would have no way to know. Showing the
 * sentence and refusing to edit it says exactly what is going on.
 * ----------------------------------------------------------------------------
 */
export function clausesOf(condition: AplCondition | undefined): readonly Clause[] | undefined {
  if (!condition) return [];
  const parts = condition.kind === 'all' ? condition.of : [condition];
  const clauses: Clause[] = [];
  for (const part of parts) {
    const clause = toClause(part);
    if (!clause) return undefined;
    clauses.push(clause);
  }
  return clauses;
}

function toClause(condition: AplCondition): Clause | undefined {
  switch (condition.kind) {
    case 'aura':
      if (condition.on === 'pet') return undefined;
      return {
        kind: 'buff',
        on: condition.on,
        auraId: condition.auraId,
        // `absent`, NOT `down` -- see `BuffTest`. This is `has`, not the clock.
        test: condition.present ? 'up' : 'absent',
      };
    case 'auraTime':
      /*
       * `atMost 0` IS "has run out", which is a different clause from "has
       * under N seconds left" even though one is a special case of the other.
       * Five class files wrote it as its own helper and the panel offers it as
       * its own option, because "refresh at zero" and "refresh in a window"
       * are different rotation decisions -- a window CLIPS whatever is left,
       * which cost the Moonkin 14.9 DPS.
       */
      if (condition.compare === 'atMost' && condition.seconds === 0) {
        return { kind: 'buff', on: condition.on, auraId: condition.auraId, test: 'down' };
      }
      if (condition.compare !== 'atMost' && condition.compare !== 'atLeast') return undefined;
      return {
        kind: 'buff',
        on: condition.on,
        auraId: condition.auraId,
        test: 'expiring',
        compare: condition.compare,
        value: condition.seconds,
      };
    case 'auraStacks':
      if (condition.compare === 'below' || condition.compare === 'above') return undefined;
      return {
        kind: 'buff',
        on: condition.on,
        auraId: condition.auraId,
        test: 'stacks',
        compare: condition.compare,
        value: condition.stacks,
      };
    case 'resource':
      if (condition.compare === 'below' || condition.compare === 'above') return undefined;
      return {
        kind: 'resource',
        resource: condition.resource,
        compare: condition.compare,
        value: condition.amount,
      };
    case 'comboPoints':
      if (condition.compare === 'below' || condition.compare === 'above') return undefined;
      return {
        kind: 'resource',
        resource: 'combo',
        compare: condition.compare,
        value: condition.points,
      };
    case 'cooldown':
      return {
        kind: 'cooldown',
        abilityId: condition.abilityId,
        ready: condition.state === 'ready',
      };
    case 'fightRemaining':
      if (condition.compare !== 'atMost' && condition.compare !== 'atLeast') return undefined;
      return condition.fraction !== undefined
        ? {
            kind: 'fight',
            compare: condition.compare,
            value: Math.round(condition.fraction * 100),
            asPercent: true,
          }
        : { kind: 'fight', compare: condition.compare, value: condition.seconds ?? 0 };
    default:
      // `builtin`, `any`, `not`, a nested `all`, and the handful of kinds no
      // panel control exists for. Shown as a sentence, not edited.
      return undefined;
  }
}

/** A clause back into a condition. */
export function fromClause(clause: Clause): AplCondition {
  const compare = clause.compare ?? 'atLeast';
  const value = clause.value ?? 0;
  switch (clause.kind) {
    case 'buff': {
      const on = clause.on ?? 'self';
      const auraId = clause.auraId ?? '';
      if (clause.test === 'up') return { kind: 'aura', on, auraId, present: true };
      if (clause.test === 'absent') return { kind: 'aura', on, auraId, present: false };
      if (clause.test === 'stacks') return { kind: 'auraStacks', on, auraId, compare, stacks: value };
      if (clause.test === 'expiring') {
        return { kind: 'auraTime', on, auraId, compare, seconds: value };
      }
      // "has run out" -- the CLOCK, which is what five classes' `expired`
      // helpers mean. `absent` above is the other one. See `BuffTest`.
      return { kind: 'auraTime', on, auraId, compare: 'atMost', seconds: 0 };
    }
    case 'resource':
      return clause.resource === 'combo'
        ? { kind: 'comboPoints', compare, points: value }
        : { kind: 'resource', resource: clause.resource ?? 'rage', compare, amount: value };
    case 'cooldown':
      return {
        kind: 'cooldown',
        abilityId: clause.abilityId ?? '',
        state: clause.ready ? 'ready' : 'onCooldown',
      };
    case 'fight':
      return clause.asPercent
        ? { kind: 'fightRemaining', compare, fraction: value / 100 }
        : { kind: 'fightRemaining', compare, seconds: value };
  }
}

/** Clauses back into one condition. None is "no condition at all". */
export function conditionFromClauses(
  clauses: readonly Clause[],
): AplCondition | undefined {
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return fromClause(clauses[0]);
  return { kind: 'all', of: clauses.map(fromClause) };
}

/** A new clause of each kind, for the "add a condition" control. */
export function blankClause(kind: ClauseKind): Clause {
  switch (kind) {
    case 'buff':
      return { kind: 'buff', on: 'target', auraId: '', test: 'down' };
    case 'resource':
      return { kind: 'resource', resource: 'rage', compare: 'atLeast', value: 0 };
    case 'cooldown':
      return { kind: 'cooldown', abilityId: '', ready: true };
    case 'fight':
      return { kind: 'fight', compare: 'atMost', value: 20, asPercent: true };
  }
}
