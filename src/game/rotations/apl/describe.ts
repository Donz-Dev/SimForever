import type { AplCompare, AplCondition } from './AplCondition';
import { BUILTIN_DESCRIPTIONS, isBuiltinConditionId } from './builtins';

/**
 * A condition, as a sentence.
 *
 * ----------------------------------------------------------------------------
 * THE PANEL'S HALF OF THE DATA MODEL. A list is only worth exposing if what it
 * says can be read, and `{ kind: 'auraTime', on: 'target', auraId: 'rend',
 * compare: 'atMost', seconds: 3 }` is not reading material.
 *
 * NAMES ARE RESOLVED BY THE CALLER, not here. This module is given a lookup
 * from aura and ability id to display name, because what an id is CALLED
 * belongs to the content -- `game/auras` and `game/abilities` -- and wiring
 * either into this file would make a formatter import half the game. An id
 * with no name resolves to the id itself, which is honest rather than blank.
 *
 * EVERY KIND IS COVERED AND THE COMPILER ENFORCES IT: the switch returns from
 * every branch of a union with no default, so a new kind of condition fails
 * the typecheck here until somebody writes its sentence. That is deliberate --
 * a kind nobody described would render as an empty gap in the panel, which
 * reads as an entry with NO condition rather than one that could not be shown,
 * and an entry that looks unconditional is an entry somebody reorders wrongly.
 * ----------------------------------------------------------------------------
 */

/** Turns an id into something to read. An unknown id is its own best answer. */
export type NameLookup = (id: string) => string;

const identity: NameLookup = (id) => id;

export interface DescribeNames {
  readonly aura?: NameLookup;
  readonly ability?: NameLookup;
}

/** "at least", "under", and so on -- in the direction a person would say it. */
function comparison(how: AplCompare): string {
  switch (how) {
    case 'atLeast':
      return 'at least';
    case 'atMost':
      return 'at most';
    case 'exactly':
      return 'exactly';
    case 'below':
      return 'under';
    case 'above':
      return 'over';
  }
}

/** `mainHand` is a field name, not something to put in front of somebody. */
function slotWord(slot: 'mainHand' | 'offHand' | 'ranged'): string {
  if (slot === 'mainHand') return 'main hand';
  if (slot === 'offHand') return 'off hand';
  return 'ranged';
}

function subjectWord(on: 'self' | 'target' | 'pet'): string {
  if (on === 'self') return 'you have';
  if (on === 'pet') return 'your pet has';
  return 'the target has';
}

export function describeCondition(condition: AplCondition, names: DescribeNames = {}): string {
  const auraName = names.aura ?? identity;
  const abilityName = names.ability ?? identity;

  switch (condition.kind) {
    case 'all':
      // Flattened with "and" rather than nested with brackets: a list's
      // conditions are overwhelmingly a flat conjunction, and bracketing every
      // one of them would make the common case read like an equation.
      return condition.of.map((part) => describeCondition(part, names)).join(' and ');
    case 'any':
      return condition.of.map((part) => describeCondition(part, names)).join(' or ');
    case 'not':
      return `not (${describeCondition(condition.of, names)})`;

    case 'aura':
      return condition.present
        ? `${subjectWord(condition.on)} ${auraName(condition.auraId)}`
        : `${subjectWord(condition.on)} no ${auraName(condition.auraId)}`;

    case 'auraTime': {
      const who = condition.on === 'self' ? 'your' : "the target's";
      // The idiom nine class files wrote as `expired`, said the way they meant
      // it rather than as "0 seconds or less left".
      if (condition.compare === 'atMost' && condition.seconds === 0) {
        return `${who} ${auraName(condition.auraId)} has run out`;
      }
      return `${who} ${auraName(condition.auraId)} has ${comparison(condition.compare)} ${condition.seconds}s left`;
    }

    case 'auraStacks': {
      const who = condition.on === 'self' ? 'your' : "the target's";
      const stacks = `${condition.stacks} ${condition.stacks === 1 ? 'stack' : 'stacks'}`;
      return `${who} ${auraName(condition.auraId)} is ${comparison(condition.compare)} ${stacks}`;
    }

    case 'resource':
      return `${condition.resource} is ${comparison(condition.compare)} ${condition.amount}`;

    case 'resourceFraction':
      return `${condition.resource} is ${comparison(condition.compare)} ${Math.round(condition.fraction * 100)}%`;

    case 'comboPoints':
      return `${comparison(condition.compare)} ${condition.points} combo ${condition.points === 1 ? 'point' : 'points'}`;

    case 'cooldown':
      return condition.state === 'ready'
        ? `${abilityName(condition.abilityId)} is ready`
        : `${abilityName(condition.abilityId)} is on cooldown`;

    case 'fightRemaining': {
      const left =
        condition.fraction !== undefined
          ? `${Math.round(condition.fraction * 100)}% of the fight`
          : `${condition.seconds}s`;
      return `${comparison(condition.compare)} ${left} remaining`;
    }

    case 'fightElapsed':
      // The idiom three Paladin lists use, said the way they mean it.
      if (condition.compare === 'exactly' && condition.seconds === 0) return 'at the pull';
      return `${comparison(condition.compare)} ${condition.seconds}s into the fight`;

    case 'health':
      return `${subjectWord(condition.on).replace(' have', '').replace(' has', '')} health is ${comparison(condition.compare)} ${Math.round(condition.fraction * 100)}%`;

    case 'swingIn':
      return `your ${slotWord(condition.slot)} swing is ${comparison(condition.compare)} ${condition.milliseconds}ms away`;

    case 'swungWithin':
      return `your ${slotWord(condition.slot)} swung in the last ${condition.withinMs}ms`;

    case 'hasReaction':
      return `your build has ${condition.reactionId.replace(/_/g, ' ')}`;

    case 'castsInstantly':
      return `${abilityName(condition.abilityId)} is instant`;

    case 'builtin':
      return isBuiltinConditionId(condition.id)
        ? BUILTIN_DESCRIPTIONS[condition.id](condition.args ?? [])
        : /*
           * AN UNKNOWN BUILTIN NAMES ITSELF RATHER THAN RENDERING BLANK. The
           * compiler THROWS on one, so this is only reachable while showing a
           * list that has not been compiled -- and a panel is exactly where
           * somebody should find out that their file names a condition this
           * version does not carry.
           */
          `an unknown condition (${condition.id})`;
  }
}
