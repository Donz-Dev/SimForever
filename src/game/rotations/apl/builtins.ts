import type { Combatant, SimulationContext } from '../../../engine';
import { HAWK_MAX_ACTIVE, activeHawks } from '../../auras/hunter';

type Condition = (
  context: SimulationContext,
  actor: Combatant,
  target: Combatant | undefined,
) => boolean;

/**
 * The three conditions that are class MACHINERY rather than a rule anybody
 * would write in a panel.
 *
 * ============================================================================
 * EVERY OTHER CONDITION IN ALL TWENTY-SIX LISTS IS DECLARATIVE. These three
 * resisted, and each for the same reason: what they ask is not a comparison
 * against a number the character carries, it is a small calculation with a
 * rule of its own.
 *
 * THEY ARE STILL DATA. `{ kind: 'builtin', id, args }` serialises, survives a
 * save and a load, and describes itself, so an entry carrying one can be
 * reordered, removed, or given further conditions beside it. What it cannot be
 * is REWRITTEN in the panel -- and the panel says so, rather than offering an
 * editor that would quietly drop the half it cannot express.
 *
 * THE REGISTRY THROWS ON AN UNKNOWN ID, which is the opposite of how
 * `TALENT_AURAS` handles a miss. That one drops silently on purpose, so a typo
 * shows up as a talent that visibly does nothing rather than a character that
 * cannot be built. Here the right failure is loud: a list naming a builtin
 * this version does not have is a list that would run with a condition
 * MISSING, and an entry that loses its gate fires far more often than it
 * should -- a bigger number and no error. Loading a profile checks these ids
 * before the fight rather than throwing mid-combat.
 * ============================================================================
 */

/** Every builtin id, so a loader can check one before a fight starts. */
export const BUILTIN_CONDITION_IDS = [
  'spendable_rage_at_least',
  'charge_stance_allowed',
  'hawks_below_cap',
  'ability_holds_swing_timer',
] as const;

export type BuiltinConditionId = (typeof BUILTIN_CONDITION_IDS)[number];

export function isBuiltinConditionId(value: unknown): value is BuiltinConditionId {
  return typeof value === 'string' && (BUILTIN_CONDITION_IDS as readonly string[]).includes(value);
}

/**
 * Rage the Warrior may spend on something OTHER than Mortal Strike.
 *
 * Shared by every entry below Mortal Strike in the Arms list, so the pooling
 * rule is stated once rather than repeated per line -- and only reserved while
 * Mortal Strike is actually off cooldown, because pooling against an ability
 * that is five seconds away just wastes rage to the cap.
 */
const MORTAL_STRIKE_RAGE_RESERVE = 30;
const RESERVED_ABILITY_ID = 'mortal_strike';

function spendableRage(context: SimulationContext, actor: Combatant): number {
  const rage = actor.resources.get('rage')?.current ?? 0;
  if (!actor.abilities.has(RESERVED_ABILITY_ID)) return rage;
  const reserved = actor.abilities.isReady(RESERVED_ABILITY_ID, context.clock.now())
    ? MORTAL_STRIKE_RAGE_RESERVE
    : 0;
  return rage - reserved;
}

const BUILTINS: Record<BuiltinConditionId, (args: readonly (string | number)[]) => Condition> = {
  /**
   * "Can this be paid for out of spare rage", the Arms list's pooling rule.
   *
   * Not a `resource` condition, because the amount it compares against is not
   * the rage bar -- it is the bar minus a reserve that appears and disappears
   * with another ability's cooldown.
   */
  spendable_rage_at_least: (args) => {
    const cost = Number(args[0] ?? 0);
    return (context, actor) => spendableRage(context, actor) >= cost;
  },

  /**
   * "Charge, but NEVER by changing stance to reach it."
   *
   * `PriorityRotation` treats a wrong stance as "not yet, and here is how" and
   * will cast a stance change to unblock an entry. Right for Revenge, wrong
   * here: Charge in the Protection list sent the tank into Battle Stance at the
   * pull, which is a different character. A condition is checked BEFORE the
   * swap is considered, so refusing here refuses the swap too.
   *
   * IT IS ALSO THE VANGUARD GATE, with no talent named: Charge allows Battle
   * Stance and Vanguard adds Defensive to the character's own copy of it, so
   * reading the ABILITY's stance list means the rule cannot drift from the
   * talent that grants it.
   */
  charge_stance_allowed: () => (_context, actor) => {
    const charge = actor.abilities.get('charge');
    if (!charge?.stances) return true;
    return charge.stances.some((stanceId) => actor.auras.has(stanceId));
  },

  /**
   * Whether the Hunter may summon another Hawk.
   *
   * `activeHawks` IS IMPORTED RATHER THAN REIMPLEMENTED HERE, and the first
   * draft of this file did reimplement it against two invented aura ids. It
   * counts two separate auras with separate clocks -- `hawk_1` and `hawk_2` --
   * rather than reading a stack count, which is the whole point of that model,
   * and a second copy of that knowledge is a second thing to get wrong.
   */
  hawks_below_cap: () => (_context, actor) => activeHawks(actor) < HAWK_MAX_ACTIVE,

  /**
   * Whether an ability lets the swing timer run on behind its cast.
   *
   * A question about the character's own copy of the ability rather than about
   * the moment: `Ability.swingTimer: 'hold'` is what a talent sets, so the Arms
   * list casts Slam only in a build where Slam does not throw a swing away.
   * Constant for a whole fight, like `hasReaction`.
   */
  ability_holds_swing_timer: (args) => {
    const abilityId = String(args[0] ?? '');
    return (_context, actor) => actor.abilities.get(abilityId)?.swingTimer === 'hold';
  },
};

/** What each builtin says, for the panel. */
export const BUILTIN_DESCRIPTIONS: Record<BuiltinConditionId, (args: readonly (string | number)[]) => string> = {
  spendable_rage_at_least: (args) => `${args[0] ?? 0} rage to spare after pooling for Mortal Strike`,
  charge_stance_allowed: () => 'already in a stance that allows Charge',
  hawks_below_cap: () => `fewer than ${HAWK_MAX_ACTIVE} Hawks active`,
  ability_holds_swing_timer: (args) => `${args[0] ?? 'it'} does not cost a swing`,
};

export function builtinCondition(id: string, args: readonly (string | number)[]): Condition {
  const builtin = isBuiltinConditionId(id) ? BUILTINS[id] : undefined;
  if (!builtin) {
    throw new Error(
      `Unknown priority-list condition "${id}". ` +
        `Known: ${BUILTIN_CONDITION_IDS.join(', ')}.`,
    );
  }
  return builtin(args);
}
