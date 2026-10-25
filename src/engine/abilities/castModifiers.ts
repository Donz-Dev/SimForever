import { ALL_ABILITIES } from '../combat/abilityModifiers';
import type { Combatant } from '../actors/Combatant';
import type { AuraInstance } from '../effects/Aura';
import type { Milliseconds } from '../time';
import type { Ability } from './Ability';
import { spreadsEffectAcrossCast } from './channelled';

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

/**
 * Does this modifier apply to this ability at all?
 *
 * TAKES THE CASTER, because one clause is about the caster rather than about
 * the ability: `exceptWhileAura` asks whether ANOTHER aura is up. Every other
 * clause here reads the ability alone, which is why the parameter was not
 * needed until Heating Up's "not consumed while Presence of Mind is active".
 */
function matches(caster: Combatant, instance: AuraInstance, ability: Ability): boolean {
  const modifier = instance.definition.castModifier;
  if (!modifier) return false;
  /*
   * NAMED, OR THE CATCH-ALL. Clearcasting names no spell -- "your next damage
   * or healing spell or offensive ability" -- and narrows with the three
   * clauses below instead. `'*'` is the key `AbilityModifiers` already uses.
   */
  if (
    !modifier.abilityIds.includes(ALL_ABILITIES) &&
    !modifier.abilityIds.includes(ability.id)
  ) {
    return false;
  }
  // "Not consumed by Wrath", which only an exclusion can say against a catch-all.
  if (modifier.exceptAbilityIds?.includes(ability.id)) return false;
  // An instant must not eat a charge meant for a cast.
  if (modifier.requiresCastTime && (ability.castTimeMs ?? 0) <= 0) return false;
  /*
   * NOR MUST A CHANNEL TAKE ONE THAT WOULD ZERO ITS CAST. "Your next
   * non-channeled, non-instant spell" is two clauses because a channel has a
   * cast time and satisfies the one above. See `spreadsEffectAcrossCast`.
   */
  if (modifier.excludesChannel && spreadsEffectAcrossCast(ability)) return false;
  // Nor must a free ability eat one meant for something that costs.
  if (modifier.requiresCost && (ability.cost?.amount ?? 0) <= 0) return false;
  /*
   * "OFFENSIVE" IS THE OWNER'S DEFINITION: processed through a combat table.
   * A Druid's Demoralizing Roar costs ten rage and rolls nothing, which is the
   * same reason Battle Shout is not offensive to Focused Rage.
   */
  if (modifier.requiresAttackTable && !ability.attackTable && !(modifier.healsCount && ability.heals)) return false;
  /*
   * AND NOT WHILE THE CASTER CARRIES A NAMED AURA. Heating Up is "no longer
   * consumed if the Mage also had Presence of Mind active for the Pyroblast
   * cast" -- and because this predicate decides BOTH what applies and what is
   * spent, refusing here is the whole of it. See `exceptWhileAura`.
   */
  if (modifier.exceptWhileAura && caster.auras.has(modifier.exceptWhileAura)) return false;
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
  return caster.auras.active.filter((instance) => matches(caster, instance, ability));
}

/**
 * Apply the caster's cast modifiers to one ability.
 *
 * Returns the ability's own numbers unchanged when nothing matches, which is
 * the overwhelmingly common case and costs one array filter.
 */
export function resolveCast(
  caster: Combatant,
  ability: Ability,
  /**
   * Leave these out, as though they were not up -- which is how a spent
   * charge's SAVING is measured: the cost without it, less the cost with it.
   */
  except?: ReadonlySet<AuraInstance>,
): ResolvedCast {
  const baseCast = ability.castTimeMs ?? 0;
  const printedCost = ability.cost?.amount ?? 0;

  const matching = castModifiersFor(caster, ability).filter((instance) => !except?.has(instance));
  if (matching.length === 0) {
    return { baseCastTimeMs: baseCast, costAmount: printedCost, modified: false };
  }

  /*
   * ============================================================================
   * COST INCREASES FIRST, AND EVERY REDUCTION IS A SHARE OF THE INCREASED COST
   * (round 55).
   *
   * Every fraction used to come off the PRINTED cost, so an increase and a
   * reduction simply added: Arcane Blast at four stacks is +700%, Clearcasting
   * is -100%, and the sum left the spell at SEVEN times its base where
   * Clearcasting says the next spell costs nothing. The rule is now that an
   * increase changes what the spell costs, and a reduction is a share of
   * THAT. Two reductions still add, exactly as before -- 50% and 25% make 75%
   * -- because they are both shares of one figure.
   *
   * IT MOVES ONLY A CAST CARRYING BOTH AN INCREASE AND A REDUCTION, which is
   * the Arcane Mage: Arcane Blast's stacks and Arcane Power are the two
   * increases in the project.
   * ============================================================================
   */
  let increase = 0;
  for (const instance of matching) {
    const modifier = instance.definition.castModifier!;
    const scale = modifier.scalesWithStacks ? instance.stacks : 1;
    if (modifier.costFraction && modifier.costFraction < 0) increase += -modifier.costFraction * scale;
  }
  const baseCost = printedCost * (1 + increase);

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
    // Flat first, then the fraction -- the order the header states, and the
    // same order the two cast-time terms above are applied in.
    if (modifier.costReduction) {
      cost -= modifier.costReduction * scale;
    }
    // Increases were taken above; only a reduction comes off here.
    if (modifier.costFraction && modifier.costFraction > 0) {
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

/**
 * The cast modifiers among these that a cast SPENDS -- the ones a saving is
 * measured without. See `resolveCast`'s `except`.
 */
export function chargesIn(instances: readonly AuraInstance[]): ReadonlySet<AuraInstance> {
  return new Set(instances.filter((instance) => instance.definition.castModifier?.consumedByCast));
}
