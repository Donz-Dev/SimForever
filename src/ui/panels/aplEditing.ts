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
 * Copy an entry and put the copy DIRECTLY BELOW the original.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S ASK, and the reason is the one `setDisabled` already answers from
 * the other side: a condition, a note and an interrupt flag are expensive to
 * retype. "Mortal Strike, but at five stacks instead of four" is one dropdown
 * away from an entry that already exists and was a whole line to build.
 *
 * BELOW RATHER THAN ABOVE, AND THAT IS WHAT MAKES IT SAFE TO INSERT IN THE
 * MIDDLE. Every other insertion in this file goes at the BOTTOM, because an
 * unconditional entry anywhere else is a floor under everything beneath it. A
 * copy placed immediately under its own original is the one exception that
 * cannot be: the original is checked FIRST and the two are identical, so
 * whenever the copy would be castable the original already was, and the list
 * walks past the copy to exactly where it went before. It starts inert by
 * construction and becomes a decision only once somebody edits it.
 *
 * ABOVE would be the opposite -- the copy would take every cast the original
 * was making, which is a no-op today and a silent reordering the moment the
 * entry above it is the one that gets edited.
 * ----------------------------------------------------------------------------
 */
export function duplicateEntry(
  entries: readonly AplEntry[],
  index: number,
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  const next = [...entries];
  // A shallow copy, so the two rows are not the same object -- everything
  // inside an entry is immutable, so sharing a condition is safe and sharing
  // the entry itself would make a later `{ ...entry, abilityId }` ambiguous to
  // read even though it would still behave.
  next.splice(index + 1, 0, { ...entries[index] });
  return next;
}

/**
 * Point an entry at a different ability, KEEPING everything else about it.
 *
 * ----------------------------------------------------------------------------
 * THE ABILITY WAS THE ONE FIELD OF AN ENTRY THAT COULD NOT BE CHANGED. Its
 * condition, its note, its interrupt flag and its position were all editable,
 * so "the same rule, on Bloodthirst instead of Mortal Strike" meant deleting
 * the line, adding a new one at the bottom, rebuilding the condition and
 * walking it back up -- four chances to produce a list nobody meant.
 *
 * THE CONDITION IS KEPT RATHER THAN CLEARED, which is the decision here and is
 * the whole point of the control: the condition is the expensive part. A
 * condition that names the OLD ability -- "Mortal Strike is ready" on an entry
 * now casting Slam -- is a legal rule rather than an error, and one somebody
 * writes on purpose; clearing it would throw away work to guard against an
 * edit the panel can show and the reader can see.
 *
 * AN EMPTY ID IS A NO-OP, the rule `addEntry` already follows: the dropdown has
 * to be able to hold "(choose)" without that selection emptying an entry.
 * ----------------------------------------------------------------------------
 */
export function setAbility(
  entries: readonly AplEntry[],
  index: number,
  abilityId: string,
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  if (abilityId.length === 0) return entries;
  return entries.map((entry, at) => (at === index ? { ...entry, abilityId } : entry));
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
/**
 * Set or clear an entry's pre-cast cancel check (round 53). Cleared is DROPPED
 * rather than stored empty, the rule `interruptsChannel` follows, so a list
 * edited back to where it was still compares equal to the stock one.
 */
export function setCancel(
  entries: readonly AplEntry[],
  index: number,
  cancel: AplEntry['cancel'],
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { cancel: _dropped, ...rest } = entry;
    return cancel ? { ...rest, cancel } : rest;
  });
}

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
 * Set, extend or clear the chain of abilities an entry casts as ONE action.
 *
 * ==============================================================================
 * THE OWNER'S "combine abilities into one action", and the editor's whole job
 * here is to keep it one choice rather than two entries.
 *
 * AN EMPTY CHAIN IS DROPPED RATHER THAN STORED AS `[]`, which is the rule
 * `disabled` and `interruptsChannel` already follow: `JSON.stringify` writes
 * `"sequence": []` and omits an absent key, so an entry that gained a step and
 * lost it again would no longer compare equal to the stock one it came from --
 * and `syncDefaultRotation` compares stored lists BY VALUE.
 *
 * A STEP WITH NO ABILITY CHOSEN IS DROPPED TOO. The panel's "(choose)" option
 * is the empty string, and a chain containing one would make the whole
 * sequence abandon on its first decision -- which reads as the sequence simply
 * not working, with nothing on screen to say why.
 * ==============================================================================
 */
export function setSequence(
  entries: readonly AplEntry[],
  index: number,
  sequence: readonly string[],
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  const kept = sequence.filter((abilityId) => abilityId.length > 0);
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { sequence: _dropped, ...rest } = entry;
    return kept.length > 0 ? { ...rest, sequence: kept } : rest;
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
export type ClauseKind = 'buff' | 'resource' | 'cooldown' | 'fight' | 'health' | 'swing';

/** Which weapon's swing timer a `swing` clause reads. */
export type SwingSlot = 'mainHand' | 'offHand' | 'ranged';

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

/**
 * THE THREE COOLDOWN TESTS, and the third is the owner's ask -- "I want the
 * cooldown condition to have a 'seconds left' controller just like
 * buff/debuff does."
 *
 * ----------------------------------------------------------------------------
 * `secondsLeft` IS A DIFFERENT CONDITION KIND, not a different reading of the
 * same one, which is why this is a three-way test rather than a boolean plus a
 * number. `cooldown` answers a yes/no about an ability that EXISTS -- an
 * absent one is neither ready nor on cooldown -- and `cooldownTime` answers a
 * duration, where an absent ability reads zero. Collapsing them would have to
 * pick one absent case for both.
 *
 * IT MIRRORS `BuffTest` DELIBERATELY. A buff clause already offers "is up",
 * "has run out" and "expiring within Ns" off one dropdown, and this is the
 * same shape on the other side of the panel -- which is what the owner meant
 * by "just like buff/debuff does".
 * ----------------------------------------------------------------------------
 */
export type CooldownTest = 'ready' | 'onCooldown' | 'secondsLeft';

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
  /** cooldown: which ability, and which of the three tests. */
  readonly abilityId?: string;
  readonly cooldownTest?: CooldownTest;
  /** Every numeric kind. Seconds, stacks, points, a percentage or an amount. */
  readonly compare?: ClauseCompare;
  readonly value?: number;
  /** fight: which side of the clock, and in what unit. */
  readonly unit?: FightUnit;
  /** swing: whose timer. The value is SECONDS until it swings, shown with decimals. */
  readonly slot?: SwingSlot;
  /**
   * health: WHOSE (round 55) -- you, the entry's target, the tank, or the mean
   * of your party or the raid. The last three are `friendlyHealth`; absent is
   * `self`, which is every list written before healing existed.
   */
  readonly who?: HealthOf;
}

/** Whose health a `health` clause reads. See `Clause.who`. */
export type HealthOf = 'self' | 'target' | 'tank' | 'party' | 'raid';

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
        cooldownTest: condition.state === 'ready' ? 'ready' : 'onCooldown',
      };
    case 'cooldownTime':
      return {
        kind: 'cooldown',
        abilityId: condition.abilityId,
        cooldownTest: 'secondsLeft',
        compare: condition.compare,
        value: condition.seconds,
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
       * YOURS OR THE TARGET'S (round 55). It was self only, on the argument
       * that the target is a damage sink that never drops -- true of a DPS
       * fight and false of a healer's, where the target is the person being
       * healed and every one of the Holy Pal's lines reads it. A pet's stays a
       * fixed leaf, since nothing heals one.
       */
      if (condition.on === 'pet') return undefined;
      return {
        kind: 'health',
        who: condition.on,
        compare: condition.compare,
        value: percentOf(condition.fraction),
      };
    case 'friendlyHealth':
      return {
        kind: 'health',
        who: condition.of,
        compare: condition.compare,
        value: percentOf(condition.fraction),
      };
    case 'swingIn':
      /*
       * THE SWING TIMER, EDITABLE SINCE ROUND 51 -- the owner: "if there is X
       * amount of time left in the main-hand / ranged / off-hand auto-attack
       * swing timer then do Y". The condition and its compiler already existed
       * (the Warrior's Slam reads it); what was missing was a control, so a
       * swing-timer read showed as a fixed sentence nobody could write.
       *
       * SHOWN IN SECONDS AND STORED IN MILLISECONDS, like every other clock in
       * the panel -- and rounded back on the way out, so a stock 300ms survives
       * the trip as 300 rather than 300.00000000000006.
       */
      return {
        kind: 'swing',
        slot: condition.slot,
        compare: condition.compare,
        value: condition.milliseconds / 1000,
      };
    default:
      // `builtin`, `swungWithin`, `hasReaction`, `castsInstantly`.
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
      if (clause.cooldownTest === 'secondsLeft') {
        return { kind: 'cooldownTime', abilityId: clause.abilityId ?? '', compare, seconds: value };
      }
      return {
        kind: 'cooldown',
        abilityId: clause.abilityId ?? '',
        state: clause.cooldownTest === 'onCooldown' ? 'onCooldown' : 'ready',
      };
    case 'fight':
      if (clause.unit === 'secondsElapsed') {
        return { kind: 'fightElapsed', compare, seconds: value };
      }
      return clause.unit === 'secondsLeft'
        ? { kind: 'fightRemaining', compare, seconds: value }
        : { kind: 'fightRemaining', compare, fraction: value / 100 };
    case 'health': {
      const who = clause.who ?? 'self';
      return who === 'self' || who === 'target'
        ? { kind: 'health', on: who, compare, fraction: value / 100 }
        : { kind: 'friendlyHealth', of: who, compare, fraction: value / 100 };
    }
    case 'swing':
      return {
        kind: 'swingIn',
        slot: clause.slot ?? 'mainHand',
        compare,
        milliseconds: Math.round(value * 1000),
      };
  }
}

/**
 * A stored fraction as the percentage the panel shows, to a tenth -- so 0.95
 * reads 95 and an owner's 0.655 is not rounded away. It goes back as `/ 100`,
 * which returns the stored figure exactly for every value a person types.
 */
function percentOf(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

/**
 * Set or clear who an entry is cast at (round 55). Cleared is DROPPED, the
 * rule `interruptsChannel` follows, so an entry put back compares equal.
 */
export function setTarget(
  entries: readonly AplEntry[],
  index: number,
  target: AplEntry['target'],
): readonly AplEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((entry, at) => {
    if (at !== index) return entry;
    const { target: _dropped, ...rest } = entry;
    return target ? { ...rest, target } : rest;
  });
}

/** A new clause of each kind, for the "add a condition" control. */
export function blankClause(kind: ClauseKind): Clause {
  switch (kind) {
    case 'buff':
      return { kind: 'buff', on: 'target', auraId: '', test: 'down' };
    case 'resource':
      return { kind: 'resource', resource: 'rage', compare: 'atLeast', value: 0 };
    case 'cooldown':
      return { kind: 'cooldown', abilityId: '', cooldownTest: 'ready' };
    case 'fight':
      return { kind: 'fight', compare: 'atMost', value: 20, unit: 'percentLeft' };
    case 'health':
      return { kind: 'health', compare: 'atMost', value: 35 };
    case 'swing':
      // "Main hand swings within half a second": a weave or a hold point.
      return { kind: 'swing', slot: 'mainHand', compare: 'atMost', value: 0.5 };
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
