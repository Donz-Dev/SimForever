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
 * EVERYTHING HERE RETURNS A NEW VALUE. Nothing mutates an entry, a node or an
 * array in place, which is what lets the profile stay the immutable value the
 * rest of the app treats it as -- and what stops an edit to one profile
 * reaching a preset's own entries, which are module constants.
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

/**
 * Turn an entry's channel interrupt on or off.
 *
 * ----------------------------------------------------------------------------
 * IT WAS BAKED INTO THREE WARLOCK ENTRIES AND NOBODY COULD CHANGE IT. The flag
 * is half of a pair -- a channel declares `interruptibleChannel` and an entry
 * declares this, and nothing is cancelled unless BOTH do -- so it was a real
 * rotation decision expressed only in TypeScript.
 *
 * THE FLAG IS DROPPED RATHER THAN STORED AS `false`, which keeps a saved list
 * byte-identical to the stock one it came from: `JSON.stringify` writes
 * `"interruptsChannel": false` and omits an absent key, and the two would
 * compare as different lists.
 * ----------------------------------------------------------------------------
 */
export function setInterrupts(
  entries: readonly AplEntry[],
  index: number,
  interrupts: boolean,
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { interruptsChannel: _dropped, ...rest } = entry;
    return interrupts ? { ...rest, interruptsChannel: true } : rest;
  });
}

/**
 * Switch an entry off, or back on.
 *
 * THE FLAG IS DROPPED RATHER THAN STORED AS `false`, which is `setInterrupts`'
 * rule above and matters for the same reason: a stored list is compared to the
 * stock one BY VALUE, so an entry switched off and on again has to come back
 * byte-identical or the list stops matching the build it came from.
 */
export function setDisabled(
  entries: readonly AplEntry[],
  index: number,
  disabled: boolean,
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { disabled: _dropped, ...rest } = entry;
    return disabled ? { ...rest, disabled: true } : rest;
  });
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

// --- a condition, as an editable tree --------------------------------------

/**
 * How a number is compared. The same five the data model has.
 *
 * `below` AND `above` ARE HERE AND WERE NOT AT FIRST, which locked every
 * condition using one out of the editor -- the Warrior's Sunder refresh
 * ("under 5 stacks"), the Mage's Scorch cap and the Warlock's Life Tap were
 * all read-only for that reason alone. They are strict and the others are not,
 * which matters at exactly the value a stack count or a resource lands on.
 */
export type ClauseCompare = 'atLeast' | 'atMost' | 'exactly' | 'below' | 'above';

/** The kinds of clause the panel can draw controls for. */
export type ClauseKind = 'buff' | 'resource' | 'cooldown' | 'fight' | 'health';

/**
 * THE FIVE BUFF TESTS, AND `absent` IS NOT `down`.
 *
 * ----------------------------------------------------------------------------
 * `absent` is `!auras.has(id)` and `down` is `remainingMs(id) <= 0`, and the
 * two differ on an aura that is PRESENT WITH NOTHING LEFT. The stock lists
 * write both and mean both -- the Shaman's Windfury Weapon entry is the first
 * and five classes' `expired` helpers are the second.
 *
 * THEY WERE ONE OPTION IN THE FIRST DRAFT, and the round-trip test caught it:
 * opening the Enhancement list and touching nothing would have rewritten
 * `withoutAura('windfury_weapon')` into a reading of the clock. That is the
 * shape of edit that produces a perfectly ordinary DPS figure and no error.
 * ----------------------------------------------------------------------------
 */
export type BuffTest = 'up' | 'absent' | 'down' | 'expiring' | 'stacks';

/** Which side of the clock a `fight` clause reads. */
export type FightUnit = 'percentLeft' | 'secondsLeft' | 'secondsElapsed';

export interface Clause {
  readonly kind: ClauseKind;
  /** buff: whose, and which. `pet` can only be asked `up` or `absent`. */
  readonly on?: 'self' | 'target' | 'pet';
  readonly auraId?: string;
  readonly test?: BuffTest;
  /** resource: which pool. `combo` is combo points, which are not a pool. */
  readonly resource?: ResourceType | 'combo';
  /** resource: compare against a SHARE of the maximum rather than an amount. */
  readonly asPercent?: boolean;
  /** cooldown: which ability, and which way round. */
  readonly abilityId?: string;
  readonly ready?: boolean;
  /** Every numeric kind. Seconds, stacks, points, a percentage or an amount. */
  readonly compare?: ClauseCompare;
  readonly value?: number;
  /** fight: which side of the clock, and in what unit. */
  readonly unit?: FightUnit;
}

/**
 * A condition as a TREE the panel can walk.
 *
 * ============================================================================
 * IT WAS A FLAT LIST OF `all` CLAUSES AND THAT LOCKED 51 OF 132 CONDITIONS.
 *
 * The first editor decomposed a condition into clauses joined by AND, and
 * returned nothing at all for anything else -- so one `not` anywhere, or an
 * `any`, made the WHOLE condition read-only. Twelve `not`s and eight `any`s
 * across the stock lists, and every condition containing one was untouchable:
 * the Rogue's pooling gates, the Paladin's entire seal twist, the Mage's
 * Scorch, the Priest's hold band.
 *
 * A TREE HAS A SECOND, LARGER BENEFIT: a leaf the panel cannot draw no longer
 * poisons its whole condition. A builtin or a `swungWithin` becomes ONE fixed
 * row inside a tree that is otherwise fully editable, where before it made
 * everything around it read-only too.
 *
 * `not` IS A FLAG RATHER THAN A NODE, because that is what a checkbox is and
 * because `not(not(x))` is not a thing any list writes. A double negation that
 * did arrive is kept WHOLE as a fixed leaf rather than collapsed, so it still
 * round-trips exactly.
 * ============================================================================
 */
export type ConditionNode =
  | { readonly kind: 'clause'; readonly clause: Clause; readonly negated: boolean }
  | {
      readonly kind: 'group';
      readonly op: 'all' | 'any';
      readonly children: readonly ConditionNode[];
      readonly negated: boolean;
    }
  /**
   * A condition the panel has no controls for: a builtin, a swing-timer read,
   * `hasReaction`, `castsInstantly`, or a double negation.
   *
   * SHOWN AS ITS SENTENCE AND KEPT EXACTLY. It can be negated, moved with its
   * group, or removed -- what it cannot be is rewritten, and saying so is the
   * honest answer. An editor that silently simplified one would change what the
   * rotation does with nothing on screen to say so.
   */
  | { readonly kind: 'fixed'; readonly condition: AplCondition; readonly negated: boolean };

export interface GroupNode {
  readonly kind: 'group';
  readonly op: 'all' | 'any';
  readonly children: readonly ConditionNode[];
  readonly negated: boolean;
}

/** Where a node sits: the child index at each level, from the root down. */
export type NodePath = readonly number[];

// --- parsing and emitting ---------------------------------------------------

function parseNode(condition: AplCondition): ConditionNode {
  if (condition.kind === 'not') {
    const inner = parseNode(condition.of);
    /*
     * A FLAG CANNOT HOLD TWO NEGATIONS, so `not(not(x))` is kept whole rather
     * than collapsed to `x`. The two mean the same thing and are not the same
     * DATA, and this editor's one promise is that opening a condition and
     * changing nothing leaves it byte-identical.
     */
    if (inner.negated) return { kind: 'fixed', condition, negated: false };
    return { ...inner, negated: true };
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    return {
      kind: 'group',
      op: condition.kind,
      children: condition.of.map(parseNode),
      negated: false,
    };
  }
  const clause = toClause(condition);
  return clause
    ? { kind: 'clause', clause, negated: false }
    : { kind: 'fixed', condition, negated: false };
}

/**
 * A condition as the tree's ROOT, which is always a group.
 *
 * A single clause becomes a one-child `all`, so the panel has somewhere to put
 * the "+ condition" control; `conditionOf` unwraps it again, so a condition
 * that was one clause stays one clause.
 */
export function rootOf(condition: AplCondition | undefined): GroupNode {
  if (!condition) return { kind: 'group', op: 'all', children: [], negated: false };
  const node = parseNode(condition);
  if (node.kind === 'group' && !node.negated) return node;
  return { kind: 'group', op: 'all', children: [node], negated: false };
}

function bareCondition(node: ConditionNode): AplCondition {
  if (node.kind === 'clause') return fromClause(node.clause);
  if (node.kind === 'fixed') return node.condition;
  return { kind: node.op, of: node.children.map(nodeToCondition) };
}

export function nodeToCondition(node: ConditionNode): AplCondition {
  const condition = bareCondition(node);
  return node.negated ? { kind: 'not', of: condition } : condition;
}

/**
 * The root back into a condition. No children is NO CONDITION.
 *
 * An empty `all` is TRUE for every actor, so emitting one would turn a gated
 * entry into an unconditional floor under everything below it.
 */
export function conditionOf(root: GroupNode): AplCondition | undefined {
  if (root.children.length === 0) return undefined;
  // One child and no negation is just that child -- `all([x])` and `x` are the
  // same condition, and the shorter one is what the lists are written in.
  if (root.children.length === 1 && !root.negated) return nodeToCondition(root.children[0]);
  return nodeToCondition(root);
}

// --- walking and changing the tree ------------------------------------------

/** The node at a path, or undefined. */
export function nodeAt(root: ConditionNode, path: NodePath): ConditionNode | undefined {
  let node: ConditionNode | undefined = root;
  for (const index of path) {
    if (!node || node.kind !== 'group') return undefined;
    node = node.children[index];
  }
  return node;
}

/** Replace the node at a path. An empty path replaces the root itself. */
export function replaceAt(
  root: ConditionNode,
  path: NodePath,
  replacement: ConditionNode,
): ConditionNode {
  if (path.length === 0) return replacement;
  if (root.kind !== 'group') return root;
  const [index, ...rest] = path;
  if (index < 0 || index >= root.children.length) return root;
  return {
    ...root,
    children: root.children.map((child, at) =>
      at === index ? replaceAt(child, rest, replacement) : child,
    ),
  };
}

/** Remove the node at a path. The root cannot be removed. */
export function removeAt(root: ConditionNode, path: NodePath): ConditionNode {
  if (path.length === 0 || root.kind !== 'group') return root;
  const [index, ...rest] = path;
  if (index < 0 || index >= root.children.length) return root;
  if (rest.length === 0) {
    return { ...root, children: root.children.filter((_child, at) => at !== index) };
  }
  return {
    ...root,
    children: root.children.map((child, at) => (at === index ? removeAt(child, rest) : child)),
  };
}

/** Append a node to the GROUP at a path. A non-group path is a no-op. */
export function appendTo(
  root: ConditionNode,
  path: NodePath,
  addition: ConditionNode,
): ConditionNode {
  const target = nodeAt(root, path);
  if (!target || target.kind !== 'group') return root;
  return replaceAt(root, path, { ...target, children: [...target.children, addition] });
}

/** Flip a node's `not`. */
export function toggleNegated(root: ConditionNode, path: NodePath): ConditionNode {
  const target = nodeAt(root, path);
  if (!target) return root;
  return replaceAt(root, path, { ...target, negated: !target.negated });
}

/** Switch a group between "all of" and "any of". */
export function setGroupOp(
  root: ConditionNode,
  path: NodePath,
  op: 'all' | 'any',
): ConditionNode {
  const target = nodeAt(root, path);
  if (!target || target.kind !== 'group') return root;
  return replaceAt(root, path, { ...target, op });
}

// --- one clause, to and from a condition ------------------------------------

function toClause(condition: AplCondition): Clause | undefined {
  switch (condition.kind) {
    case 'aura':
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
      return {
        kind: 'buff',
        on: condition.on,
        auraId: condition.auraId,
        test: 'expiring',
        compare: condition.compare,
        value: condition.seconds,
      };
    case 'auraStacks':
      return {
        kind: 'buff',
        on: condition.on,
        auraId: condition.auraId,
        test: 'stacks',
        compare: condition.compare,
        value: condition.stacks,
      };
    case 'resource':
      return {
        kind: 'resource',
        resource: condition.resource,
        compare: condition.compare,
        value: condition.amount,
      };
    case 'resourceFraction':
      return {
        kind: 'resource',
        resource: condition.resource,
        compare: condition.compare,
        // Stored 0 to 1, shown as a percentage -- nobody types 0.15.
        value: Math.round(condition.fraction * 100),
        asPercent: true,
      };
    case 'comboPoints':
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
      return condition.fraction !== undefined
        ? {
            kind: 'fight',
            compare: condition.compare,
            value: Math.round(condition.fraction * 100),
            unit: 'percentLeft',
          }
        : {
            kind: 'fight',
            compare: condition.compare,
            value: condition.seconds ?? 0,
            unit: 'secondsLeft',
          };
    case 'fightElapsed':
      return {
        kind: 'fight',
        compare: condition.compare,
        value: condition.seconds,
        unit: 'secondsElapsed',
      };
    case 'health':
      /*
       * SELF ONLY in the editor, which is every stock use of it. A `health`
       * condition about the TARGET is expressible in the data model and is
       * meaningless against this encounter -- the target is a damage sink that
       * never drops -- so a control for it would offer a rotation rule that
       * cannot fire. One naming the target stays a fixed leaf.
       */
      if (condition.on !== 'self') return undefined;
      return {
        kind: 'health',
        compare: condition.compare,
        value: Math.round(condition.fraction * 100),
      };
    default:
      // `builtin`, `swingIn`, `swungWithin`, `hasReaction`, `castsInstantly`.
      // Shown as a sentence, kept exactly, not drawn with controls.
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
      /*
       * A PET CAN ONLY BE ASKED WHETHER AN AURA IS THERE. `auraTime` and
       * `auraStacks` read `self` or `target` and nothing else -- the data
       * model says so -- so a pet clause falls back to the presence test
       * rather than emitting something the types do not allow.
       */
      if (on === 'pet') return { kind: 'aura', on, auraId, present: true };
      if (clause.test === 'stacks') return { kind: 'auraStacks', on, auraId, compare, stacks: value };
      if (clause.test === 'expiring') {
        return { kind: 'auraTime', on, auraId, compare, seconds: value };
      }
      // "has run out" -- the CLOCK, which is what five classes' `expired`
      // helpers mean. `absent` above is the other one. See `BuffTest`.
      return { kind: 'auraTime', on, auraId, compare: 'atMost', seconds: 0 };
    }
    case 'resource':
      if (clause.resource === 'combo') return { kind: 'comboPoints', compare, points: value };
      return clause.asPercent
        ? {
            kind: 'resourceFraction',
            resource: clause.resource ?? 'mana',
            compare,
            fraction: value / 100,
          }
        : { kind: 'resource', resource: clause.resource ?? 'rage', compare, amount: value };
    case 'cooldown':
      return {
        kind: 'cooldown',
        abilityId: clause.abilityId ?? '',
        state: clause.ready ? 'ready' : 'onCooldown',
      };
    case 'fight':
      if (clause.unit === 'secondsElapsed') {
        return { kind: 'fightElapsed', compare, seconds: value };
      }
      return clause.unit === 'secondsLeft'
        ? { kind: 'fightRemaining', compare, seconds: value }
        : { kind: 'fightRemaining', compare, fraction: value / 100 };
    case 'health':
      return { kind: 'health', on: 'self', compare, fraction: value / 100 };
  }
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
      return { kind: 'fight', compare: 'atMost', value: 20, unit: 'percentLeft' };
    case 'health':
      return { kind: 'health', compare: 'atMost', value: 35 };
  }
}

/** A new clause node, and a new empty group, for the panel's add controls. */
export function blankClauseNode(kind: ClauseKind): ConditionNode {
  return { kind: 'clause', clause: blankClause(kind), negated: false };
}

export function blankGroup(op: 'all' | 'any' = 'any'): ConditionNode {
  /*
   * A NEW GROUP DEFAULTS TO `any`, which is the opposite of the root's `all`
   * and is the point of adding one: a nested group whose operator matched its
   * parent's would do nothing a flat list of clauses does not already do.
   */
  return { kind: 'group', op, children: [], negated: false };
}
