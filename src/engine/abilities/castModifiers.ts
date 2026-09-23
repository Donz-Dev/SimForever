import type { Combatant } from '../actors/Combatant';
import type { AuraInstance } from '../effects/Aura';
import type { Milliseconds } from '../time';
import type { Ability } from './Ability';

/**
 * What a caster's auras do to one cast, resolved BEFORE the cast starts.
 *
 * ------------------------------------------------------------------------------
 * PURE, AND THAT IS THE WHOLE DESIGN. `checkCast` has to be side-effect free --
 * a rotation calls it on every candidate before committing to any of them --
 * and `castAbility` has to see exactly the same numbers a moment later. So
 * resolving and CONSUMING are two separate steps: this function answers what a
 * cast would cost, and `AuraCollection.consumeCastCharges` is called once, by
 * the cast that actually happens.
 *
 * Splitting them is not tidiness. A rotation that checked the FULL mana cost
 * would refuse a spell the character can afford, and would do it silently --
 * the priority list simply moves on to the next entry and nothing reports a
 * spell it declined to consider.
 *
 * ORDER: the flat reduction first, then the fraction, then haste. Haste last
 * because it scales whatever is left, which is what makes a 20%-shorter cast
 * 20% shorter at every gear level rather than only at none.
 * ------------------------------------------------------------------------------
 */
export interface ResolvedCast {
  /** Cast time before haste, after every modifier. Never below zero. */
  readonly baseCastTimeMs: Milliseconds;
  /** What the declared cost actually comes to. Never below zero. */
  readonly costAmount: number;
  /** True when at least one aura changed something. */
  readonly modified: boolean;
}

/** Does this modifier apply to this ability at all? */
function matches(instance: AuraInstance, ability: Ability): boolean {
  const modifier = instance.definition.castModifier;
  if (!modifier) return false;
  if (!modifier.abilityIds.includes(ability.id)) return false;
  // An instant must not eat a charge meant for a cast.
  if (modifier.requiresCastTime && (ability.castTimeMs ?? 0) <= 0) return false;
  return true;
}

/**
 * Every aura on the caster that changes this cast.
 *
 * Exported because consumption needs the same answer resolution used, and
 * deriving it twice from two copies of the rule is how the two drift apart.
 */
export function castModifiersFor(
  caster: Combatant,
  ability: Ability,
): readonly AuraInstance[] {
  return caster.auras.active.filter((instance) => matches(instance, ability));
}

/**
 * Apply the caster's cast modifiers to one ability.
 *
 * Returns the ability's own numbers unchanged when nothing matches, which is
 * the overwhelmingly common case and costs one array filter.
 */
export function resolveCast(caster: Combatant, ability: Ability): ResolvedCast {
  const baseCast = ability.castTimeMs ?? 0;
  const baseCost = ability.cost?.amount ?? 0;

  const matching = castModifiersFor(caster, ability);
  if (matching.length === 0) {
    return { baseCastTimeMs: baseCast, costAmount: baseCost, modified: false };
  }

  let castMs = baseCast;
  let cost = baseCost;

  for (const instance of matching) {
    const modifier = instance.definition.castModifier!;
    /*
     * STACKS MULTIPLY THE MAGNITUDE, NOT THE NUMBER OF APPLICATIONS.
     *
     * Maelstrom Weapon is 20% a stack: five stacks is one 100% reduction, not
     * five 20% ones compounding to 67%. Eclipse is the other arrangement -- a
     * flat half second, one CHARGE spent per Starfire -- so it leaves
     * `scalesWithStacks` off and its stacks only count how many casts are
     * still owed.
     */
    const scale = modifier.scalesWithStacks ? instance.stacks : 1;

    if (modifier.castTimeReductionMs) {
      castMs -= modifier.castTimeReductionMs * scale;
    }
    if (modifier.castTimeFraction) {
      castMs -= baseCast * Math.min(1, modifier.castTimeFraction * scale);
    }
    if (modifier.costFraction) {
      cost -= baseCost * Math.min(1, modifier.costFraction * scale);
    }
  }

  /*
   * ROUNDED, BECAUSE TIME IS INTEGER MILLISECONDS BELOW THE UI.
   *
   * A fraction is not a rounding nicety here: 3000 less 60% is
   * 1199.9999999999998 in binary floating point, and an event scheduled at a
   * fractional timestamp sorts against integer ones in a way nothing else in
   * this engine does. `applyHaste` rounds for the same reason and this matches
   * it, so a cast that passes through both lands on a whole millisecond
   * whichever order they apply in.
   *
   * The COST is not rounded. Resources are not integers here -- rage arrives
   * as 3.46 x a weapon speed -- so rounding it would be inventing a rule that
   * does not exist.
   */
  return {
    baseCastTimeMs: Math.round(Math.max(0, castMs)),
    costAmount: Math.max(0, cost),
    modified: true,
  };
}
