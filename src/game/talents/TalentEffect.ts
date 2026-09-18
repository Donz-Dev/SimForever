import type { StatModifierOperation, StatName } from '../../engine';
import type { ResourceType } from '../../engine';

/**
 * What a talent does.
 *
 * DECISION: a closed union of declared effects, not a function per talent.
 *
 * This is the third time the codebase makes this choice. `AuraDefinition` is
 * data — `statModifiers`, `damageDoneMultiplier`, `periodic` — with hooks for
 * what data cannot say. `Ability` is declared `cost`, `cooldownMs` and
 * `attackTable`, plus `onCast`. A talent is the same shape: what it does is
 * data, and a talent whose effect does not fit is `unmodelled` rather than a
 * bespoke function nothing else can read.
 *
 * Declared effects buy three things a function would not:
 *
 *   1. The UI can say what a build changes without running a fight.
 *   2. A test can check an effect without executing it.
 *   3. An effect that CANNOT be expressed is visible as such, instead of being
 *      a function that quietly does nothing.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Not from here. An effect says what a talent does with its number; the number
 * itself lives in `src/data/talents/values/<class>.json`, per rank, and is
 * hand-editable for balance changes. That is the same split as "rules go in
 * `engine`, numbers go in `game`", one level further down — and it is why
 * changing what Flurry grants never means touching TypeScript.
 *
 * A talent with no value for its rank contributes NOTHING and says so. It is
 * never extrapolated from a lower rank: three of the Warrior's own talents
 * break the linear assumption, so a guess would be wrong about 7% of the time
 * in a way no result could reveal.
 */
export type TalentEffect =
  /**
   * Adds to a stat, exactly as a buff or an item does.
   *
   * `scale` converts the talent's stated number into what the stat expects.
   * Crit and hit are held in percentage POINTS, so Cruelty's "+1%" is a flat
   * +1 and needs no scaling; a `percentAdd` modifier wants a FRACTION, so a
   * talent reading "+2%" passes 0.02 and scales by 0.01.
   */
  | {
      readonly kind: 'stat';
      readonly stat: StatName;
      readonly operation: StatModifierOperation;
      readonly scale?: number;
    }

  /** Reduces an ability's resource cost by the talent's value. */
  | { readonly kind: 'abilityCost'; readonly abilityId: string }

  /**
   * Reduces an ability's cooldown by the talent's value.
   *
   * The unit is declared because the source states some in seconds and some in
   * minutes, and the values file keeps the source's own number rather than
   * silently normalising it.
   */
  | {
      readonly kind: 'abilityCooldown';
      readonly abilityId: string;
      readonly unit: 'seconds' | 'minutes';
    }

  /**
   * Grants an ability the character does not otherwise have.
   *
   * Takes no value: a talent either gives you Mortal Strike or it does not.
   */
  | { readonly kind: 'grantAbility'; readonly abilityId: string }

  /** Raises a resource cap by the talent's value. */
  | { readonly kind: 'resourceMax'; readonly resource: ResourceType }

  /**
   * Adds to ONE ability's crit chance, in percentage points.
   *
   * Improved Overpower's "+25% critical strike chance of your Overpower".
   * Distinct from a `stat` effect on `critChance`, which would raise crit for
   * everything the character does.
   */
  | { readonly kind: 'abilityCrit'; readonly abilityId: string }

  /**
   * Multiplies ONE ability's damage. The talent's value is a PERCENTAGE, so 12
   * becomes x1.12.
   *
   * The ability id can be an aura's, because a periodic tick carries the aura's
   * id -- which is how Improved Rend scales a bleed rather than a cast.
   */
  | { readonly kind: 'abilityDamage'; readonly abilityId: string }

  /**
   * Raises the critical strike damage BONUS for every ability, as a percentage
   * of the bonus rather than of the total.
   *
   * Impale's "+10% critical strike damage bonus" on a x2 melee crit gives
   * 1 + (2 - 1) x 1.1 = x2.1, not x2.2. Auto attacks are not abilities and are
   * untouched.
   */
  | { readonly kind: 'critDamageBonus' }

  /**
   * Grants a reaction: something that happens in response to an attack result.
   *
   * The reaction itself is built by a per-class registry, from the talent's
   * value at the character's rank, because a proc is genuinely code — a chance
   * roll, a condition on the attack, an aura to apply. This is the escape hatch
   * the design allows for, kept narrow: the TABLE stays declarative and says
   * WHICH reaction, while the registry says what it does.
   */
  | { readonly kind: 'reaction'; readonly reactionId: string }

  /**
   * The talent's effect cannot be modelled, and this says why.
   *
   * NOT a gap in this list waiting to be filled in — a first-class outcome, and
   * the most important variant here. Items already work this way: each carries
   * the source's exact wording plus one line on why it does nothing, and the
   * Gear panel prints every one under "Equipped but not simulated". That is
   * what kept Crusader granting nothing until its real proc rate arrived,
   * rather than quietly inheriting a plausible one.
   *
   * A talent listed here is visibly inert. A talent given a guessed effect
   * would be invisibly wrong, and this project would rather be the first.
   */
  | { readonly kind: 'unmodelled'; readonly reason: string };

/** Every effect a talent has. Most have one; some have several. */
export type TalentEffects = readonly TalentEffect[];

/** A talent that is doing nothing, and the reason, for showing to a person. */
export interface UnmodelledTalent {
  readonly talentId: string;
  readonly name: string;
  readonly rank: number;
  /** The source's own words for what it should do. */
  readonly text: string;
  readonly reason: string;
}
