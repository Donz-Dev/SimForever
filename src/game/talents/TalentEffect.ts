import type { StatModifierOperation, StatName } from '../../engine';
import type { ResourceType, WeaponType } from '../../engine';

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
      readonly valueIndex?: number;
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
  /**
   * An aura the character is simply always under, applied when combat begins.
   *
   * For a passive that DOES something on a timer rather than adding a number.
   * Anger Management is the first: a stat modifier cannot express "a rage
   * every three seconds", and an ability cannot either because nothing casts
   * it. The aura already has a periodic; this is the wiring that puts one on
   * a character because a talent point was spent.
   */
  | { readonly kind: 'grantAura'; readonly auraId: string }
  /**
   * A PERCENTAGE added to what the off hand already does.
   *
   * Three separate kinds rather than one, because the three land in three
   * different places: damage is a property of the weapon, rage generation is
   * a property of the weapon's resource rule, and hit is read by the combat
   * table when a swing resolves. Dual Wield Specialization moves all three at
   * once, which is exactly why it went unmodelled for so long -- a single
   * effect kind could only ever have done a third of it.
   *
   * Each reads its own slot out of the talent's rank values, hence
   * `valueIndex`.
   */
  | {
      readonly kind: 'offHandDamage';
      readonly valueIndex?: number;
    }
  | {
      readonly kind: 'offHandResourceGeneration';
      readonly valueIndex?: number;
    }
  /** Percentage POINTS of hit, on off-hand attacks only. */
  | {
      readonly kind: 'offHandHit';
      readonly valueIndex?: number;
    }

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
  | {
      readonly kind: 'reaction';
      readonly reactionId: string;
      readonly valueIndex?: number;
    }

  /**
   * A named number handed to ONE ability, read by that ability's own `onCast`.
   *
   * For a value that lives inside an ability's body rather than in a declared
   * field: the rage Charge generates, say. The ability names the key it reads,
   * and the talent names the same key here.
   */
  | { readonly kind: 'abilityBonus'; readonly abilityId: string; readonly key: string }
  /**
   * A named bonus on an ability that is ON or OFF, with no magnitude.
   *
   * `abilityBonus` reads a per-rank number, and a single-rank talent whose
   * effect is "also do this" has no number to read -- Raging Blows gives
   * Whirlwind an off-hand strike, and there is no quantity involved. Routed
   * past the value lookup for the same reason `grantAbility` is, rather than
   * inventing a 1 for the values file to carry.
   */
  | { readonly kind: 'abilityFlag'; readonly abilityId: string; readonly key: string }

  /** Reduces an ability's cast time by the talent's value, in SECONDS. */
  | { readonly kind: 'abilityCastTime'; readonly abilityId: string }

  /** Reduces an ability's global cooldown by the talent's value, in SECONDS. */
  | { readonly kind: 'abilityGcd'; readonly abilityId: string }

  /**
   * Stops an ability's cast from resetting the melee swing timer.
   *
   * Takes no value: Improved Slam either lets the swing run behind the cast or
   * it does not. Both ranks grant it, which is why it is separate from the cast
   * time reduction that does scale.
   */
  | { readonly kind: 'abilityHoldsSwing'; readonly abilityId: string }

  /**
   * Multiplies ALL damage, but only while the character is holding the right
   * weapon. The talent's value is a PERCENTAGE, so 3 becomes x1.03.
   *
   * Unlike `abilityDamage` this covers auto attacks too, which is what "damage
   * you deal with two-handed weapons" means. The condition is evaluated when
   * the character is built, because that is when the weapons are known — a
   * character does not swap weapons mid-fight here.
   */
  | {
      readonly kind: 'conditionalDamage';
      readonly requires: WeaponRequirement;
    }

  /**
   * Adds crit chance to every ability, but only with the right weapon.
   *
   * Weaponmaster's axe and polearm clause.
   */
  | {
      readonly kind: 'conditionalCrit';
      readonly requires: WeaponRequirement;
    }

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

/**
 * What a character must be holding for a conditional effect to apply.
 *
 * Checked against the MAIN HAND, which is what "the weapon you are using"
 * means for a talent; an off-hand of a different type is a case no Warrior
 * talent here distinguishes.
 */
export interface WeaponRequirement {
  /** Any one of these types satisfies it. */
  readonly weaponTypes?: readonly WeaponType[];
  /** Whether the weapon must be two-handed. */
  readonly twoHanded?: boolean;
}

/**
 * Which of a talent's values an effect reads, when the talent varies several.
 *
 * Defaults to the first. Shield Specialization's block chance is value 0 and
 * its rage proc chance is value 1, and an effect that took the wrong one would
 * be quietly wrong rather than visibly broken.
 */

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

/**
 * A talent that was allocated points but whose own requirements are not met.
 *
 * DISTINCT FROM `UnmodelledTalent`, and the difference matters to a reader: an
 * unmodelled talent is one the simulator cannot express, while an illegal one
 * is not really the character's at all. Showing them in the same list would
 * tell someone their build is missing features when it is actually invalid.
 */
export interface IllegalTalent {
  readonly talentId: string;
  readonly name: string;
  readonly rank: number;
  readonly reason: string;
}
