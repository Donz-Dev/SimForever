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
   * Seconds left on an ability's cooldown -- the owner's ask: "I want the
   * cooldown condition to have a 'seconds left' controller just like
   * buff/debuff does."
   *
   * --------------------------------------------------------------------------
   * `auraTime` IS THE MODEL AND THE ABSENT CASE IS THE SAME CHOICE AGAIN. An
   * absent aura reads as ZERO seconds left, so `auraTime atMost 0` is the
   * idiom nine files wrote as "expired"; an ability that is READY likewise has
   * zero left, so `cooldownTime atMost 0` is "is ready".
   *
   * AN ABILITY THE BUILD DOES NOT HAVE READS ZERO TOO, which is deliberately
   * NOT what `cooldown` does -- that one is false in both directions, because
   * "ready" and "on cooldown" are each a positive claim about an ability that
   * exists. A DURATION has no such pair: the honest answer to "how long until
   * Cold Blood" for a character without it is not a number at all, and zero is
   * the reading that keeps `atMost` behaving like the `cooldown` kind's
   * `ready` -- which is the one the panel's dropdown produces.
   *
   * SECONDS, LIKE `auraTime`, because the panel's control is in seconds and
   * everything below the UI is integer milliseconds. The conversion is here
   * rather than in the editor, so a hand-written list reads the same way.
   * --------------------------------------------------------------------------
   */
  | {
      readonly kind: 'cooldownTime';
      readonly abilityId: string;
      readonly compare: AplCompare;
      readonly seconds: number;
    }
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
  /**
   * How many targets the fight holds (round 57) -- the owner's "condition for
   * number of targets, so it can prioritize AoE actions that aren't normally
   * cast on single target encounters". Living enemies, which is the
   * encounter's Number of Targets for the whole fight: no dummy dies.
   */
  | { readonly kind: 'targetCount'; readonly compare: AplCompare; readonly count: number }
  | {
      readonly kind: 'health';
      readonly on: AplSubject;
      readonly compare: AplCompare;
      readonly fraction: number;
    }
  /**
   * A FRIENDLY's health as a fraction of maximum (round 52): the tank's, the
   * mean of the entry target's party, or the mean of the whole raid. The
   * entry's own target is `health` with `on: 'target'`, which already existed.
   * With no raid in the fight every subject reads full.
   *
   * `lowestParty` (round 61) is the mean of whichever party has the LOWEST
   * mean -- the owner's "average party hit points %, where lowest can be
   * selected", for the Holy Pal's Light's Vigil chain.
   */
  | {
      readonly kind: 'friendlyHealth';
      readonly of: 'tank' | 'party' | 'raid' | 'lowestParty';
      readonly compare: AplCompare;
      readonly fraction: number;
    }
  /**
   * HOW MANY NEED HEALING (round 60): members of the entry target's PARTY, or
   * of the whole raid, below `below` of their health. The Piss Beam list's
   * "if 2+ people need healing in a group" -- and the party is the TARGET's,
   * because that is the group a Chain Heal on that target can jump through.
   */
  | {
      readonly kind: 'injuredCount';
      readonly of: 'targetParty' | 'raid';
      readonly below: number;
      readonly compare: AplCompare;
      readonly count: number;
    }
  /**
   * HOW MANY THERE ARE TO HEAL (round 61): the raid members in the fight, the
   * tank included and the healer not. One in the tank healer fight, twenty in
   * the raid healer fight and none in a damage fight -- so "at least 6" is the
   * owner's "only used for Raid Healer", said as a number a panel can edit.
   */
  | { readonly kind: 'raidSize'; readonly compare: AplCompare; readonly count: number }
  /**
   * Whether ANY raid member carries one of YOUR auras (round 61). The Holy
   * Pal's Light's Vigil goes out only when none of its own is up, which is
   * what makes the owner's chain one party at a time.
   */
  | { readonly kind: 'raidAura'; readonly auraId: string; readonly present: boolean }
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
/**
 * Who an entry casts at, when it is not the default enemy (round 52).
 *
 * `tank` is the raid's tank; `lowestHealth` the raid member with the least
 * health as a fraction, optionally leaving the tank out -- which is "all other
 * raid members get individual Flash of Light casts". A condition reading
 * `health` on `target` then asks about whoever this picked.
 */
export type AplTarget =
  | { readonly kind: 'tank' }
  | { readonly kind: 'lowestHealth'; readonly excludeTank?: boolean }
  /**
   * The raid member carrying one of YOUR auras (round 60) -- the lowest health
   * of them when several do. The Piss Beam list's Chain Heal "on the target
   * that has Riptide". Nobody, when nobody carries it, so the entry waits.
   */
  | { readonly kind: 'withAura'; readonly auraId: string }
  /**
   * The lowest-health member of the party with the lowest AVERAGE health
   * (round 61), optionally skipping any party where a member already carries
   * one of YOUR `withoutAura` -- Light's Vigil's one-per-party rule. Ties go to
   * the lower party, so at full health it is the tank in party one.
   */
  | { readonly kind: 'lowestParty'; readonly withoutAura?: string };

/** When to ask whether to cancel a cast, and what to ask. See `AplEntry.cancel`. */
export interface AplCastCancel {
  /** How far through the cast, from 0 to 1. */
  readonly atFraction: number;
  /** True cancels the cast. */
  readonly condition: AplCondition;
}

export interface AplEntry {
  readonly abilityId: string;
  readonly condition?: AplCondition;
  /**
   * A MELEE WEAVE's actions (round 65): what the Hunter does in melee before it
   * runs back, in order, and also the weave's gate -- it begins only when every
   * one of them can be cast. Absent is the owner's three. Only meaningful on a
   * `melee_weave` entry. See `abilities/meleeWeave.ts`.
   */
  readonly weave?: readonly string[];
  /** Who it is cast at. Absent is the default enemy. */
  readonly target?: AplTarget;
  /**
   * MULTI-DOT (round 57): the entry may be cast at any of the first X enemies,
   * the boss first, and goes to the first whose condition holds. X above the
   * fight's Number of Targets is the number of targets. DROPPED rather than
   * stored when cleared, so an entry put back compares equal. See
   * `PriorityEntry.multiDot`.
   */
  readonly multiDot?: number;
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
   * A PRE-CAST (round 53): ask `condition` at `atFraction` of the way through
   * this entry's cast, and cancel the cast if it holds. The condition reads
   * the entry's own target -- `health on target above 0.95` on a Holy Light
   * aimed at the tank is "the tank is still topped up". A cancelled cast costs
   * nothing; see `CastCancelCheck` in the engine.
   */
  readonly cancel?: AplCastCancel;
  /**
   * A note from whoever wrote the entry, shown in the panel.
   *
   * The nine class files are full of measured figures and owner rulings
   * attached to particular lines -- "worth +37.7 and the gate on it is worth
   * -4.9". A comment in TypeScript reaches nobody running the app, and this is
   * the field that lets that reasoning travel with the list it is about.
   */
  readonly note?: string;
  /**
   * Switched OFF: kept in the list, and never offered to the rotation.
   *
   * ==========================================================================
   * SO THAT TRYING SOMETHING DOES NOT COST THE LINE. Removing an entry to see
   * what it is worth and adding it back afterwards means retyping its
   * condition, its note and its interrupt flag -- and `aplEditing.ts` exists
   * because a condition that cannot be redrawn exactly is a rotation that
   * changed with nothing on screen to say so. Switching it off keeps every
   * byte of it.
   *
   * IT IS DROPPED RATHER THAN STORED AS `false`, the rule `interruptsChannel`
   * already follows: `JSON.stringify` writes `"disabled": false` and omits an
   * absent key, so a list that was switched off and on again would no longer
   * compare equal to the stock one it came from -- and `syncDefaultRotation`
   * compares stored lists by value.
   *
   * ABSENT MEANS ACTIVE, which is what makes this need no migration: every
   * profile saved before the field existed has no `disabled` key and behaves
   * exactly as it did. See `compileRotation` for where it is honoured.
   * ==========================================================================
   */
  readonly disabled?: boolean;
  /**
   * Further abilities cast after this entry's, in order, with nothing between.
   *
   * ==========================================================================
   * "A WAY TO COMBINE ABILITIES INTO ONE ACTION", the owner's ask, and their
   * own example is "5 combo points is reached + 35 energy is reached -> use
   * Cold Blood and then Eviscerate".
   *
   * THE CONDITION IS THE ENTRY'S, NOT THE STEP'S, which is what makes it one
   * action: the gate is checked once, the whole sequence is then resolved as a
   * unit, and nothing may be cast between the steps. Two ordinary entries
   * cannot do that -- Cold Blood is free and off the global cooldown, so the
   * instant it goes out the list is re-read and anything affordable below it
   * wins the gap.
   *
   * ABSENT MEANS ONE ABILITY, so this needs no migration and leaves every
   * existing entry byte-identical. It is the rule `disabled` and
   * `interruptsChannel` already follow, and it matters for the same reason:
   * `syncDefaultRotation` compares a stored list to the stock one BY VALUE.
   *
   * SEE `PriorityEntry.sequence` for what the engine does with it -- including
   * that a sequence ABANDONS rather than blocking when a step becomes
   * uncastable, which is the alternative to an actor that stops acting.
   * ==========================================================================
   */
  readonly sequence?: readonly string[];
}

/** A whole list: what it is called, and what is in it. */
export interface AplList {
  readonly name: string;
  readonly entries: readonly AplEntry[];
  /**
   * SMART HEALING (round 54), one switch for the whole list: every entry that
   * aims at a friendly -- the tank, or the lowest-health member -- aims at
   * whoever has the lowest health PERCENTAGE instead, the tank included, and
   * its conditions read that target. Entries aimed at the enemy are untouched.
   *
   * ABSENT MEANS OFF, and off is dropped rather than stored as `false`, the
   * rule `disabled` follows, so a list toggled back compares equal.
   */
  readonly smartHealing?: boolean;
}
