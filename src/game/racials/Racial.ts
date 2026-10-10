import type {
  AuraDefinition,
  CastReaction,
  PartialStats,
  Reaction,
  ResourceType,
  StatModifierSpec,
  WeaponType,
} from '../../engine';
import type { ClassId, RaceId } from '../character';
import type { OutOfScope } from '../talents/TalentEffect';

/**
 * What a race contributes to a character, declared as data.
 *
 * ----------------------------------------------------------------------------
 * A RACIAL IS NOT A TALENT, AND THE DIFFERENCE IS THE RANK.
 *
 * `TalentEffect` is a large union because a talent has RANKS and its numbers
 * live in a generated values file -- so every effect kind there needs a
 * `valueIndex`, and four talents have been found reading the wrong number off a
 * multi-value row. A racial has no ranks and no values file: the number is
 * stated in the tooltip and written here beside it. So this is a much smaller
 * vocabulary, and **nothing here takes a `valueIndex`** -- there is no row to
 * index into, which removes the single commonest failure mode in the talent
 * layer by construction rather than by care.
 *
 * It is also not a raid buff. A raid buff is SELECTED and nothing is on by
 * default, because a buff that applied itself would move every figure ever
 * recorded. A racial is not selectable: race is already a required field on
 * every profile and base stats already vary by it, so a racial applies for the
 * same reason a Tauren's base strength does. That it moves every published
 * figure is a consequence of the feature, not a reason to make it optional.
 * ----------------------------------------------------------------------------
 */
export type RacialEffect =
  /**
   * A flat stat, optionally conditional on what is EQUIPPED.
   *
   * "+2% Global Crit Chance from all sources if holding a sword or two-handed
   * sword" is two stats and one condition: `critChance` and `spellCritChance`
   * are read by separate tables, so "all spells and attacks" is both.
   */
  | {
      readonly kind: 'stat';
      readonly stats: PartialStats;
      readonly requires?: RacialRequirement;
    }

  /**
   * A stat as a PERCENTAGE of itself, kept as a modifier.
   *
   * The Human Spirit is "+5% Spirit", which has to stay a modifier for the
   * reason every percentage talent does: stats are base plus modifiers and
   * derived values are a function over them, so a percentage folded into a
   * flat number at build time freezes against the unbuffed stat.
   */
  | {
      readonly kind: 'statPercent';
      readonly modifiers: readonly StatModifierSpec[];
      readonly requires?: RacialRequirement;
    }

  /**
   * MAXIMUM HEALTH, as a multiplier. Tauren Endurance's "+5%".
   *
   * Not a stat: `STAT_NAMES` has no `hitPoints` and health is a maximum derived
   * from stamina, so a percentage of it has nowhere else to go. The same reason
   * the "+1200 Hit Points" consumable needed its own route.
   *
   * IT ALSO CHANGES RAGE, which is the formula doing what it says rather than a
   * side effect to correct: Forever's rage from damage taken is `D x 10 / H`,
   * so a bigger pool makes each point of damage taken worth less. A Tauren
   * Warrior therefore earns slightly less rage per hit and survives slightly
   * longer, and both follow from the one number.
   */
  | { readonly kind: 'healthPercent'; readonly percent: number }

  /**
   * A RESOURCE CAP, as a multiplier. Gnome Expansive Mind's "+5%".
   *
   * "Maximum Mana, Rage or Energy increased by 5%, whichever your class uses",
   * so all three are named and whichever pools exist are scaled. A multiplier
   * rather than an override because two of the three are the flat 100 every
   * class shares and mana is derived from intellect, so there is no single
   * number to state.
   *
   * COMBO POINTS AND SOUL SHARDS ARE NOT NAMED and must not be: a Gnome Rogue
   * has energy and combo points, and raising the combo point cap would change
   * what a finisher can spend. Declaring the three explicitly is what makes
   * that true rather than relying on a rule.
   */
  | {
      readonly kind: 'resourceMaxPercent';
      readonly resources: readonly ResourceType[];
      readonly percent: number;
    }

  /** An active ability the race grants. Its id must be in `RACIAL_ABILITIES`. */
  | { readonly kind: 'grantAbility'; readonly abilityId: string }

  /** A proc. Built per character, like every other reaction in this project. */
  | { readonly kind: 'reaction'; readonly reaction: RacialReactionId }

  /**
   * Something the race does that this simulator does not model.
   *
   * A `scope` means the owner has RULED the effect out and it is permanent;
   * nothing means it is a live gap. That is the whole difference between a
   * decision and a gap, and prose cannot carry it -- which is why this field
   * exists on the talent side and why racials reuse the same union rather than
   * inventing a second one.
   */
  | {
      readonly kind: 'unmodelled';
      readonly text: string;
      readonly reason: string;
      readonly scope?: OutOfScope;
    };

/**
 * A condition on what the character IS or HOLDS, answered before the pull.
 *
 * ----------------------------------------------------------------------------
 * `weaponTypes` ASKS THE EQUIPMENT, NOT THE WEAPON PROFILE, and that is the
 * owner's ruling: "holding" means equipped.
 *
 * The distinction is real and it decides two profiles. `weaponsForEquipment`
 * refuses to build a `WeaponProfile` for a hand the style marks `stat-stick`,
 * so a RANGED Hunter holding Dreadforge Retaliator has no main-hand weapon
 * profile at all -- while `liveEquipment` keeps the axe, because it is held and
 * contributing its stats. Reading the profile would have made Axe
 * Specialization live for the two melee Hunters and silently inert for the two
 * ranged ones, which is a plausible difference nobody asked for.
 *
 * EITHER HAND SATISFIES IT, also the owner's ruling. A dual-wielder holding one
 * sword is holding a sword.
 * ----------------------------------------------------------------------------
 */
export interface RacialRequirement {
  /** Any one of these, in either hand or the two-hand slot, satisfies it. */
  readonly weaponTypes?: readonly WeaponType[];
  /** Classes the effect applies to. Any one of them satisfies it. */
  readonly classes?: readonly ClassId[];
}

/**
 * Procs a race grants, by id rather than by closure.
 *
 * ONE MEMBER, and it is named rather than inlined so that the declaration stays
 * plain data: a closure in `RACIALS` could not be compared, printed or counted,
 * and the racial census reads this table the way the talent census reads the
 * effect tables.
 */
export type RacialReactionId = 'touch_of_the_grave';

/** A race's whole contribution. */
export interface RacialDefinition {
  readonly race: RaceId;
  /** The client's own name for each trait, for the UI and for the census. */
  readonly traits: readonly RacialTrait[];
}

/**
 * One named trait, with its effects.
 *
 * Grouped by TRAIT rather than flattened into one effect list because the
 * client names them -- "Sword Specialization", "The Human Spirit" -- and a
 * reader checking a tooltip against the code needs the name to find the line.
 * It is also what lets the Race panel list them and what lets a census say
 * which TRAIT is unmodelled rather than which effect.
 */
export interface RacialTrait {
  readonly id: string;
  readonly name: string;
  /** The client's own text, verbatim. */
  readonly text: string;
  readonly effects: readonly RacialEffect[];
}

/** Whether a trait does anything at all in this simulator. */
export function isModelled(trait: RacialTrait): boolean {
  return trait.effects.some((effect) => effect.kind !== 'unmodelled');
}

/** Whether every one of a trait's unmodelled effects carries a scope ruling. */
export function isRuledOut(trait: RacialTrait): boolean {
  return (
    !isModelled(trait) &&
    trait.effects.every((effect) => effect.kind === 'unmodelled' && effect.scope !== undefined)
  );
}

/** Auras and reactions a racial build produced, for `createPlayer`. */
export interface RacialBuild {
  readonly stats: PartialStats;
  readonly statModifiers: readonly StatModifierSpec[];
  /** 1 when nothing raises it. */
  readonly healthMultiplier: number;
  /** Per resource, 1 when nothing raises it. */
  readonly resourceMaxMultipliers: Partial<Record<ResourceType, number>>;
  readonly grantedAbilities: ReadonlySet<string>;
  readonly reactions: readonly Reaction[];
  readonly castReactions: readonly CastReaction[];
  /** Auras the character opens combat under. None today; here for symmetry. */
  readonly openingAuras: readonly AuraDefinition[];
}
