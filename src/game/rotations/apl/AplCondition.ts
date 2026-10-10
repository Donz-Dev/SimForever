import type { ResourceType } from '../../../engine';

/**
 * An Action Priority List, as DATA.
 *
 * ============================================================================
 * WHY THIS EXISTS AT ALL: A CONDITION USED TO BE A CLOSURE.
 *
 * `PriorityEntry.condition` is a function, which is the right shape for the
 * engine and the wrong shape for everything else. A function cannot be written
 * to a file, cannot be shown in a panel, and cannot be edited by somebody who
 * is not editing TypeScript -- so a priority list was the one part of a
 * character that could not be saved, loaded, or changed. These types are the
 * same conditions expressed as JSON-safe data; `compileCondition` turns them
 * back into the closure the engine wants, and `describeCondition` turns them
 * into a sentence a person can read.
 *
 * THE CLOSURE IS STILL WHAT RUNS. Nothing in the engine changed and nothing
 * about a fight changed: this is a representation the lists are WRITTEN in,
 * compiled once when a character is built. A list that compiles to the same
 * closures makes the same decisions, which is checkable -- see
 * `tools/rotation_fingerprint.ts`.
 * ============================================================================
 *
 * TWO RULES FOR ADDING A KIND, both learned from the conversion:
 *
 *   1. **MIRROR THE SOURCE'S COMPARISON EXACTLY, including strictness.** The
 *      nine class files had written `< cap` and `<= cap` and `!has()` and
 *      `remainingMs() <= 0` in different places, and the two in each pair are
 *      NOT the same test. `stacks < 5` and `stacks <= 5` differ on exactly the
 *      value that matters, and an aura that is present with nothing left
 *      answers `has()` and `remainingMs() <= 0` differently. Hence `below` and
 *      `above` sit beside `atLeast` and `atMost`, and `active` is a different
 *      test from `timeRemaining atMost 0`.
 *   2. **AN ABSENT TARGET IS FALSE, NEVER TRUE.** Every target-reading helper
 *      in all nine files began `target !== undefined &&`, and getting that
 *      backwards gives an entry that fires when there is nothing to fire at.
 */

/** How a number is compared. `below` and `above` are STRICT; the rest are not. */
export type AplCompare = 'atLeast' | 'atMost' | 'exactly' | 'below' | 'above';

/** Whose aura, health or swing timer is being read. */
export type AplSubject = 'self' | 'target' | 'pet';

export type AplCondition =
  /** "Is the buff up at all" -- `auras.has`, which is NOT the same as time left. */
  | { readonly kind: 'aura'; readonly on: AplSubject; readonly auraId: string; readonly present: boolean }
  /**
   * Seconds left on an aura. An ABSENT aura reads as zero, so
   * `timeRemaining atMost 0` is the idiom nine files wrote as `expired`.
   */
  | {
      readonly kind: 'auraTime';
      readonly on: Exclude<AplSubject, 'pet'>;
      readonly auraId: string;
      readonly compare: AplCompare;
      readonly seconds: number;
    }
  | {
      readonly kind: 'auraStacks';
      readonly on: Exclude<AplSubject, 'pet'>;
      readonly auraId: string;
      readonly compare: AplCompare;
      readonly stacks: number;
    }
  /** A flat amount of rage, energy, mana or focus. */
  | {
      readonly kind: 'resource';
      readonly resource: ResourceType;
      readonly compare: AplCompare;
      readonly amount: number;
    }
  /** A share of the pool's maximum, 0 to 1. What "Evocation under 10% mana" is. */
  | {
      readonly kind: 'resourceFraction';
      readonly resource: ResourceType;
      readonly compare: AplCompare;
      readonly fraction: number;
    }
  /**
   * COMBO POINTS ARE THEIR OWN KIND AND NOT A `resource`, because they belong
   * to a TARGET -- `comboPointsOn(actor, target)` discards points built on
   * somebody else. Reading the pool directly would quietly count them.
   */
  | { readonly kind: 'comboPoints'; readonly compare: AplCompare; readonly points: number }
  | { readonly kind: 'cooldown'; readonly abilityId: string; readonly state: 'ready' | 'onCooldown' }
  /**
   * How much fight is LEFT, which is how this project expresses "the target is
   * nearly dead" -- the target is a damage sink that never drops, so an execute
   * window is a clock. Either an absolute number of seconds or a fraction of
   * the planned duration; exactly one is set.
   */
  | {
      readonly kind: 'fightRemaining';
      readonly compare: AplCompare;
      readonly seconds?: number;
      readonly fraction?: number;
    }
  /**
   * How much fight has GONE, the mirror of `fightRemaining`.
   *
   * `elapsed exactly 0` is "at the pull", which three Paladin lists use to open
   * with a seal and never cast it again -- and it is worth being a kind rather
   * than a builtin because "only in the first N seconds" is a rotation rule
   * somebody would reasonably want to write.
   */
  | { readonly kind: 'fightElapsed'; readonly compare: AplCompare; readonly seconds: number }
  | {
      readonly kind: 'health';
      readonly on: AplSubject;
      readonly compare: AplCompare;
      readonly fraction: number;
    }
  /** Milliseconds until a weapon swings again. Zero when the slot is idle. */
  | {
      readonly kind: 'swingIn';
      readonly slot: 'mainHand' | 'offHand' | 'ranged';
      readonly compare: AplCompare;
      readonly milliseconds: number;
    }
  /** Whether a swing LANDED in the last N milliseconds. The Hunter's weave. */
  | {
      readonly kind: 'swungWithin';
      readonly slot: 'mainHand' | 'offHand' | 'ranged';
      readonly withinMs: number;
    }
  /**
   * Whether the BUILT character carries a reaction -- a question about the
   * build rather than about the moment, and constant for a whole fight.
   *
   * It reads the character's reactions rather than a talent id, which is the
   * arrangement Vanguard and Charge already use: the reaction is what the
   * talent leaves behind, so the rule cannot drift from the talent granting it.
   */
  | { readonly kind: 'hasReaction'; readonly reactionId: string }
  /** Whether an ability's cast time is zero -- a Paladin's Twist of Light. */
  | { readonly kind: 'castsInstantly'; readonly abilityId: string }
  | { readonly kind: 'all'; readonly of: readonly AplCondition[] }
  | { readonly kind: 'any'; readonly of: readonly AplCondition[] }
  | { readonly kind: 'not'; readonly of: AplCondition }
  /**
   * A NAMED CLOSURE FROM A REGISTRY, for the three conditions that are genuinely
   * class machinery rather than a rule anybody would write in a panel.
   *
   * ------------------------------------------------------------------------
   * IT IS AN HONEST ESCAPE HATCH RATHER THAN A GAP. The alternatives were both
   * worse: inventing a declarative kind per oddity would put "rage minus the
   * reserve held for Mortal Strike while Mortal Strike is off cooldown" in a
   * dropdown, and dropping them would have changed three lists' behaviour in a
   * commit whose whole promise is that nothing changed.
   *
   * IT SERIALISES, IT SURVIVES A SAVE AND A LOAD, AND IT DESCRIBES ITSELF, so
   * the entry carrying one can still be reordered, removed, or given extra
   * conditions. What it cannot do is be REWRITTEN in the panel, and the panel
   * says so rather than showing an editor that would silently drop it.
   *
   * `args` keeps them parameterised -- the rage reserve is per entry.
   * ------------------------------------------------------------------------
   */
  | { readonly kind: 'builtin'; readonly id: string; readonly args?: readonly (string | number)[] };

/** One line of a priority list, as data. */
export interface AplEntry {
  readonly abilityId: string;
  readonly condition?: AplCondition;
  /**
   * Whether this entry may cancel an interruptible channel in progress.
   *
   * BOTH HALVES STILL HAVE TO AGREE -- the channel declares
   * `interruptibleChannel` and the entry declares this. Carried through as
   * data so a saved list keeps it; see `PriorityEntry` for why it is not "any
   * entry above the channel".
   */
  readonly interruptsChannel?: boolean;
  /**
   * A note from whoever wrote the entry, shown in the panel.
   *
   * The nine class files are full of measured figures and owner rulings
   * attached to particular lines -- "worth +37.7 and the gate on it is worth
   * -4.9". A comment in TypeScript reaches nobody running the app, and this is
   * the field that lets that reasoning travel with the list it is about.
   */
  readonly note?: string;
}

/** A whole list: what it is called, and what is in it. */
export interface AplList {
  readonly name: string;
  readonly entries: readonly AplEntry[];
}
