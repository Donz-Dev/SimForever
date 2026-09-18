/**
 * Per-ability modifiers: crit chance, crit damage and damage, for ONE ability
 * rather than for the whole character.
 *
 * WHY THIS IS AN ENGINE CONCEPT AND NOT A TALENT ONE
 *
 * Talents are only the first caller. "This ability specifically hits harder or
 * crits more often" is a rule WoW uses everywhere — set bonuses, trinkets,
 * debuffs on the target, glyphs. Before this existed the only damage
 * multipliers were whole-character, carried by auras, and the only crit chance
 * was the character's own from the stat block. Anything that wanted to change
 * one ability had nowhere to put it, which is why Improved Overpower, Improved
 * Rend, Improved Revenge and Impale were all unmodelled at once.
 *
 * Modifiers are held on the combatant and consulted by `dealDamage`, so an
 * ability's `onCast` needs no changes to respect them. That matters: otherwise
 * every ability would have to remember to look them up, and the one that forgot
 * would be quietly wrong.
 *
 * AUTO ATTACKS ARE NOT ABILITIES. A swing carries no `abilityId`, so nothing
 * here applies to it — including `ALL_ABILITIES`, which is what a talent
 * reading "your abilities" means.
 */

/** What can be changed about one ability. All optional; all additive. */
export interface AbilityModifier {
  /**
   * Added to the ability's crit chance, in percentage POINTS, matching
   * `critChance` on the stat block. 25 is "+25% chance to crit".
   */
  readonly critBonus?: number;
  /**
   * Added to the crit damage MULTIPLIER, not to the bonus damage.
   *
   * A melee crit multiplies by 2. "Increases the critical strike damage bonus
   * by 10%" raises the BONUS half — the part above 1 — so it becomes
   * 1 + (2 - 1) x 1.1 = 2.1, and this field holds the resulting 0.1. Reading it
   * as "multiply the whole thing by 1.1" would give 2.2 and overstate every
   * crit in the game.
   */
  readonly critMultiplierBonus?: number;
  /** Multiplies the ability's final damage. 1.2 is +20%. */
  readonly damageMultiplier?: number;
}

/** Key meaning "every ability", for a modifier that is not ability-specific. */
export const ALL_ABILITIES = '*';

const NONE: AbilityModifier = {};

/**
 * A combatant's per-ability modifiers.
 *
 * Built once when the character is, and not mutated during a fight — a talent
 * or a set bonus is decided before the pull. An effect that comes and goes
 * during combat belongs in an aura, which has the lifecycle for it.
 */
export class AbilityModifiers {
  private readonly byAbility = new Map<string, AbilityModifier>();

  /** Add a modifier, combining with anything already registered for that id. */
  add(abilityId: string, modifier: AbilityModifier): void {
    const existing = this.byAbility.get(abilityId);
    this.byAbility.set(abilityId, existing ? combine(existing, modifier) : modifier);
  }

  /**
   * The modifier that applies to an ability, including the `ALL_ABILITIES` one.
   *
   * An absent `abilityId` — an auto attack — gets nothing at all.
   */
  for(abilityId: string | undefined): AbilityModifier {
    if (abilityId === undefined) return NONE;
    const all = this.byAbility.get(ALL_ABILITIES);
    const own = this.byAbility.get(abilityId);
    if (!all) return own ?? NONE;
    if (!own) return all;
    return combine(all, own);
  }

  get isEmpty(): boolean {
    return this.byAbility.size === 0;
  }
}

/**
 * Combine two modifiers for the same ability.
 *
 * Chances and crit multiplier bonuses ADD; damage multipliers MULTIPLY. That
 * follows the same reasoning as the stat modifier buckets: two sources of "+5%
 * crit" give +10%, while two independent "+10% damage" effects give +21%.
 */
function combine(a: AbilityModifier, b: AbilityModifier): AbilityModifier {
  return {
    critBonus: (a.critBonus ?? 0) + (b.critBonus ?? 0),
    critMultiplierBonus: (a.critMultiplierBonus ?? 0) + (b.critMultiplierBonus ?? 0),
    damageMultiplier: (a.damageMultiplier ?? 1) * (b.damageMultiplier ?? 1),
  };
}
