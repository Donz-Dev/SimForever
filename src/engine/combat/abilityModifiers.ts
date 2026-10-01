import type { DamageSchool } from './DamageSchool';
import type { AttackTableKind } from './attackTable';

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
  /**
   * Taken off the MISS chance, in percentage POINTS. 5 is "+5% chance to hit".
   *
   * ----------------------------------------------------------------------------
   * "THE TABLE DECIDES HIT BEFORE ANY PER-SCHOOL MODIFIER IS CONSULTED" WAS THE
   * REASON FIVE TALENTS ACROSS THREE CLASSES WERE INERT, and it was not true.
   * `rollTable` folds the ability's modifier, the school's and the table's into
   * one and hands the result to `resolveAttackTable` -- so the school was in hand
   * at the roll all along. What was missing was a FIELD, not a route to one.
   * Arcane Focus and Elemental Precision on the Mage, Shadow Focus and Holy
   * Precision on the Priest, and Divine Precision on the Paladin all read
   * "improves your chance to hit with <school> spells".
   *
   * SUBTRACTED FROM MISS RATHER THAN ADDED TO HIT, because no table carries a hit
   * chance: `hit` is the remainder after the walk falls past every other slice.
   * Shrinking miss grows that remainder, which is what "more of your casts land"
   * means on a cumulative table. Floored at zero -- a negative miss chance would
   * shift every band below it and silently hand out dodges.
   *
   * ON THE SHARED INTERFACE, unlike `spellPower` below, and for the opposite
   * reason: all three scopes reach the same roll, so a hit bonus does something
   * wherever it is hung. "Improves your chance to hit with your Fireball" and
   * "with your melee abilities" are both real wordings and both would work.
   *
   * ON THE SHARED INTERFACE, unlike `spellPower` below. A school-scoped spell
   * power hung off an ABILITY would be read by nothing; this is read wherever it
   * is hung, because all three scopes reach the same roll.
   *
   * TWO DIVES WROTE THIS FIELD INDEPENDENTLY, the Mage/Paladin one and the
   * Priest one, and they agreed on the semantics down to subtracting from miss.
   * Reassuring rather than wasteful -- but it is the second time in this round
   * that two contexts built the same capability, so check whether one exists
   * before adding the next.
   * ----------------------------------------------------------------------------
   */
  readonly hitBonus?: number;
}

/**
 * A SCHOOL's modifier: the three above, plus a flat power term.
 *
 * ------------------------------------------------------------------------------
 * WHY THE EXTRA FIELD IS HERE AND NOT ON `AbilityModifier`. "Increases damage
 * done by Shadow spells and effects by up to 39" is a SPELL POWER that only one
 * school may read, and `dealDamage` consults it in exactly one place -- the
 * coefficient term in `scaleByPower`, beside the character's school-blind
 * `spellPower`. Putting it on the shared interface would let a talent hang one
 * off an ABILITY or an ATTACK TABLE, where nothing reads it and it would do
 * nothing at all without saying so. The type is the guard: only a school can
 * carry one.
 *
 * IT IS NOT A STAT, deliberately. `STAT_NAMES` is a closed flat set and a keyed
 * stat does not fit in it, which is the whole reason this lives here.
 * ------------------------------------------------------------------------------
 */
export interface SchoolModifier extends AbilityModifier {
  /**
   * Spell power that only this school's damage reads, ADDED to the character's
   * school-blind `spellPower`.
   *
   * DAMAGE ONLY. The item wording is "increases DAMAGE done by Shadow spells",
   * while the school-blind line says "damage AND HEALING" -- so `applyHealing`
   * deliberately does not consult this, and a Holy-scoped 161 on a Paladin
   * raises its seal and not its heal.
   */
  readonly spellPower?: number;
}

/** Key meaning "every ability", for a modifier that is not ability-specific. */
export const ALL_ABILITIES = '*';

const NONE: SchoolModifier = {};

/**
 * A combatant's per-ability modifiers.
 *
 * Built once when the character is, and not mutated during a fight — a talent
 * or a set bonus is decided before the pull. An effect that comes and goes
 * during combat belongs in an aura, which has the lifecycle for it.
 */
export class AbilityModifiers {
  private readonly byAbility = new Map<string, AbilityModifier>();
  /**
   * Modifiers that only apply while a named aura is on the character, keyed
   * `auraId -> abilityId -> modifier`.
   *
   * ----------------------------------------------------------------------------
   * THE REGISTRY IS STILL BUILT ONCE; IT IS THE CONDITION THAT IS READ LATE.
   * Everything above is decided before the pull and this is no different -- the
   * talent and its rank are fixed. What cannot be fixed at build time is
   * whether the aura is up, so `forWhileAura` takes the test as an argument and
   * the caller supplies it from the live combatant.
   *
   * WHY NOT ON THE AURA, which is where an effect with a lifecycle normally
   * goes. Shatter is the first caller and its number lives on a DIFFERENT
   * TALENT from the aura that switches it on: Fingers of Frost builds the aura
   * from its own rank, and Shatter's 17/33/50 is not in scope there. Writing it
   * onto the aura would mean one talent reaching another talent's value during
   * the build, which is only correct as long as the two are visited in the
   * right order -- and talent iteration order is not a guarantee this project
   * wants a crit chance resting on. Keyed by aura id here, the two talents
   * never have to meet: Shatter names the aura, Fingers of Frost applies it,
   * and neither reads the other.
   * ----------------------------------------------------------------------------
   */
  private readonly whileAura = new Map<string, Map<string, AbilityModifier>>();

  /**
   * Modifiers that only apply once the fight has reached its final fraction,
   * keyed `fraction -> abilityId -> modifier`.
   *
   * ----------------------------------------------------------------------------
   * THE THIRD CONDITION SHAPE, AND THE FIRST ONE THE COMBATANT CANNOT ANSWER BY
   * ITSELF. `addWhileAura` above asks the character ("is this aura up"); this
   * asks the FIGHT ("how much of it is left"), and a combatant holds no clock.
   * So the reader is handed the answer rather than looking it up, exactly as
   * `forWhileAura` is handed its predicate.
   *
   * A FRACTION OF THE PLANNED DURATION, NOT A TARGET'S HEALTH. That is the
   * ruleset owner's ruling and it is not the engine's to make -- the engine
   * knows only that some modifiers switch on late in a fight. What counts as
   * late arrives as a number, and `game/combat/executePhase.ts` is where the
   * project writes down why a stated health threshold is read this way.
   *
   * KEYED BY THE FRACTION so two talents with different windows never meet: the
   * Priest's Early Demise opens at 0.2 and the Rogue's Quietus at 0.35, and a
   * character carrying both would otherwise need one of them to know the
   * other's number.
   * ----------------------------------------------------------------------------
   */
  private readonly whileFinalFraction = new Map<number, Map<string, AbilityModifier>>();

  /** Add a modifier, combining with anything already registered for that id. */
  add(abilityId: string, modifier: AbilityModifier): void {
    const existing = this.byAbility.get(abilityId);
    this.byAbility.set(abilityId, existing ? combine(existing, modifier) : modifier);
  }

  /**
   * Add a modifier that applies only while `auraId` is active.
   *
   * Kept out of `add` deliberately. Combining a conditional modifier into the
   * unconditional bucket would lose the condition, and the result -- a talent
   * that pays all the time instead of during its window -- is a bigger number
   * and no error.
   */
  addWhileAura(auraId: string, abilityId: string, modifier: AbilityModifier): void {
    let byAbility = this.whileAura.get(auraId);
    if (!byAbility) {
      byAbility = new Map<string, AbilityModifier>();
      this.whileAura.set(auraId, byAbility);
    }
    const existing = byAbility.get(abilityId);
    byAbility.set(abilityId, existing ? combine(existing, modifier) : modifier);
  }

  /**
   * The modifiers whose aura is currently active, combined, or `undefined`.
   *
   * `undefined` rather than an empty object for the same reason
   * `AuraCollection.abilityModifierFor` does it: this is asked on every damage
   * event, and almost every character has nothing registered here at all.
   */
  forWhileAura(
    abilityId: string | undefined,
    isAuraActive: (auraId: string) => boolean,
  ): AbilityModifier | undefined {
    if (abilityId === undefined || this.whileAura.size === 0) return undefined;
    let combined: AbilityModifier | undefined;
    for (const [auraId, byAbility] of this.whileAura) {
      if (!isAuraActive(auraId)) continue;
      const contribution = pick(byAbility, abilityId);
      if (!contribution) continue;
      combined = combined ? combine(combined, contribution) : contribution;
    }
    return combined;
  }

  /**
   * Add a modifier that applies only in the fight's final `fraction`.
   *
   * `fraction` is of the PLANNED duration: 0.2 is the last fifth. Kept out of
   * `add` for the same reason `addWhileAura` is -- combining a conditional
   * modifier into the unconditional bucket loses the condition, and a talent
   * that pays all fight instead of during its window is a bigger number and no
   * error.
   */
  addWhileFinalFraction(fraction: number, abilityId: string, modifier: AbilityModifier): void {
    let byAbility = this.whileFinalFraction.get(fraction);
    if (!byAbility) {
      byAbility = new Map<string, AbilityModifier>();
      this.whileFinalFraction.set(fraction, byAbility);
    }
    const existing = byAbility.get(abilityId);
    byAbility.set(abilityId, existing ? combine(existing, modifier) : modifier);
  }

  /**
   * The modifiers whose window the fight has reached, combined, or `undefined`.
   *
   * ----------------------------------------------------------------------------
   * IT THROWS RATHER THAN SKIPPING when a caller has no clock to offer AND this
   * character has one of these registered. That asymmetry is the whole point.
   *
   * The alternative -- treat a missing `remainingFraction` as "not in the
   * window" -- is the failure this project keeps paying for: a talent that is
   * declared, reports itself modelled, shows up in the Talent panel and
   * contributes nothing, with every figure around it self-consistent and too
   * low. A reader that forgot to thread the clock through would produce exactly
   * that, and nothing would say so.
   *
   * It costs nothing for the characters that have none registered, which is all
   * but two talents in the project -- the check is a `size === 0` on a map.
   * ----------------------------------------------------------------------------
   */
  forWhileFinalFraction(
    abilityId: string | undefined,
    remainingFraction: number | undefined,
  ): AbilityModifier | undefined {
    if (this.whileFinalFraction.size === 0) return undefined;
    if (remainingFraction === undefined) {
      throw new Error(
        'abilityModifierFor was asked for a character carrying modifiers conditional ' +
          'on the fight clock, without being given one. Pass the simulation through: ' +
          'silently dropping them would leave the talent inert and say nothing.',
      );
    }
    if (abilityId === undefined) return undefined;
    let combined: AbilityModifier | undefined;
    for (const [fraction, byAbility] of this.whileFinalFraction) {
      if (remainingFraction > fraction) continue;
      const contribution = pick(byAbility, abilityId);
      if (!contribution) continue;
      combined = combined ? combine(combined, contribution) : contribution;
    }
    return combined;
  }

  /**
   * The modifier that applies to an ability, including the `ALL_ABILITIES` one.
   *
   * An absent `abilityId` — an auto attack — gets nothing at all.
   */
  for(abilityId: string | undefined): AbilityModifier {
    if (abilityId === undefined) return NONE;
    return pick(this.byAbility, abilityId) ?? NONE;
  }

  get isEmpty(): boolean {
    return (
      this.byAbility.size === 0 &&
      this.whileAura.size === 0 &&
      this.whileFinalFraction.size === 0
    );
  }
}

/**
 * One ability's entry out of a keyed set, folding in the `ALL_ABILITIES` one.
 *
 * ------------------------------------------------------------------------------
 * ASKING FOR THE CATCH-ALL KEY RETURNS IT ONCE, not twice.
 *
 * Without this, a lookup of `ALL_ABILITIES` found the all-abilities entry as
 * both `all` and `own` and combined it with itself, so a talent granting +20%
 * crit damage to everything read back as +40%. Every per-ability lookup was
 * correct, which is why it survived: nothing in the damage pipeline queries the
 * catch-all key, and a test written to check Impale's "your abilities" wording
 * was the first thing that did.
 *
 * SHARED BY ALL THREE SETS THAT HAVE THIS SHAPE -- the standing registry above,
 * the conditional one beside it, and the one an aura definition carries. It was
 * written out per site before, which is how `AuraCollection` came to look up the
 * ability id exactly and silently ignore `ALL_ABILITIES` altogether.
 * ------------------------------------------------------------------------------
 */
export function pick(
  byAbility: ReadonlyMap<string, AbilityModifier> | Readonly<Record<string, AbilityModifier>>,
  abilityId: string,
): AbilityModifier | undefined {
  const get = (key: string): AbilityModifier | undefined =>
    byAbility instanceof Map ? byAbility.get(key) : (byAbility as Record<string, AbilityModifier>)[key];
  const all = get(ALL_ABILITIES);
  if (abilityId === ALL_ABILITIES) return all;
  const own = get(abilityId);
  if (!all) return own;
  if (!own) return all;
  return combine(all, own);
}

/**
 * Combine two modifiers for the same ability.
 *
 * Chances and crit multiplier bonuses ADD; damage multipliers MULTIPLY. That
 * follows the same reasoning as the stat modifier buckets: two sources of "+5%
 * crit" give +10%, while two independent "+10% damage" effects give +21%.
 *
 * SPELL POWER ADDS, which is the only reading a flat power term has: eight
 * pieces of Lawbringer each saying "up to N Holy" are one pool of Holy power,
 * exactly as eight pieces each saying "+N Strength" are one pool of strength.
 */
/**
 * Combine two modifiers for the same ability.
 *
 * Exported because an aura carries these too now, and the aura layer must
 * combine them by the SAME rule -- chances add, damage multiplies. Two copies
 * of that rule would be one too many: the failure of them disagreeing is a
 * number that is plausible either way.
 */
export function combineAbilityModifiers(a: SchoolModifier, b: SchoolModifier): SchoolModifier {
  return combine(a, b);
}

function combine(a: SchoolModifier, b: SchoolModifier): SchoolModifier {
  return {
    critBonus: (a.critBonus ?? 0) + (b.critBonus ?? 0),
    critMultiplierBonus: (a.critMultiplierBonus ?? 0) + (b.critMultiplierBonus ?? 0),
    damageMultiplier: (a.damageMultiplier ?? 1) * (b.damageMultiplier ?? 1),
    spellPower: (a.spellPower ?? 0) + (b.spellPower ?? 0),
    /*
     * HIT ADDS, like every other chance here. Left out when the field was
     * introduced, and a test of TWO sources is what found it -- one source
     * worked perfectly, because  only combines when something is already
     * registered for the key. Two talents raising the same school's hit would
     * have ended up with neither, which is a smaller number and no error.
     */
    hitBonus: (a.hitBonus ?? 0) + (b.hitBonus ?? 0),
  };
}

/**
 * One modifier at N stacks, for an aura whose `modifiersScaleWithStacks` is set.
 *
 * ------------------------------------------------------------------------------
 * IT IS `combine` APPLIED TO ITSELF N TIMES, and it has to be, or a stacking
 * aura's crit and its damage would follow two different conventions. Chances
 * ADD, so they multiply by the count; damage MULTIPLIES, so it goes to the
 * POWER of the count -- which is exactly what `damageTakenMultiplierFor`
 * already does for `damageTakenBySchool` and what `bindModifiers` does for
 * `statModifiers`. Writing "x stacks" for both would give a five-stack 1.03
 * a 1.15 where every other reader of that flag gives 1.159.
 *
 * `spellPower` is left out on purpose: it is a SCHOOL field, and no aura
 * carries a school modifier. The day one does, it adds like the chances.
 * ------------------------------------------------------------------------------
 */
export function scaleByStacks(modifier: AbilityModifier, stacks: number): AbilityModifier {
  if (stacks === 1) return modifier;
  return {
    critBonus: (modifier.critBonus ?? 0) * stacks,
    critMultiplierBonus: (modifier.critMultiplierBonus ?? 0) * stacks,
    damageMultiplier: (modifier.damageMultiplier ?? 1) ** stacks,
  };
}

/**
 * The same three modifiers, keyed by SCHOOL rather than by ability.
 *
 * ------------------------------------------------------------------------------
 * WHY IT IS THE SAME SHAPE AND NOT A NEW ONE. "Increases the damage done by
 * your Fire spells by 10%" and "increases the damage done by your Revenge by
 * 20%" differ only in what they select. Giving the school version its own
 * fields would mean two `combine` rules that have to agree about whether crit
 * chances add and damage multiplies -- and they do, for the same reason.
 *
 * WHO ASKED FOR IT, and it is not only the Mage:
 *
 *   Mage      Fire Power, Piercing Ice, Critical Mass, Arcane Impact,
 *             Ice Shards and Arcane Mind -- six talents, and the last two are
 *             +100% crit DAMAGE each
 *   Druid     Moonfury and Vengeance, both `unmodelled` since the Druid landed
 *   Shaman    Elemental Fury, which was applied WHOLE-CHARACTER with a written
 *             caveat because there was nowhere else to put it
 *
 * A SCHOOL IS NOT OPTIONAL THE WAY AN ABILITY ID IS. Every `DamageRequest`
 * carries one, including an auto attack, which is `physical` -- so unlike
 * `AbilityModifiers`, nothing here is skipped for a swing. That is correct:
 * "your Fire spells" simply never matches a physical hit, and a talent that
 * genuinely raised physical damage would want to reach swings.
 *
 * AND IT CARRIES ONE FIELD THE OTHER TWO DO NOT: a flat `spellPower` scoped to
 * the school, which is what seventeen lines of Priest and Paladin gear say.
 * Talents were the first caller of the other three; GEAR is the first caller of
 * this one, and `createPlayer` folds the equipped set's into the build's.
 * ------------------------------------------------------------------------------
 */
export class SchoolModifiers {
  private readonly bySchool = new Map<DamageSchool, SchoolModifier>();

  add(school: DamageSchool, modifier: SchoolModifier): void {
    const existing = this.bySchool.get(school);
    this.bySchool.set(school, existing ? combine(existing, modifier) : modifier);
  }

  for(school: DamageSchool): SchoolModifier {
    return this.bySchool.get(school) ?? NONE;
  }

  /**
   * Fold another set into this one, school by school, by the same `combine`
   * two sources of one school already use.
   *
   * It exists so a caller with TWO sources -- the talent build and the
   * equipped gear -- can produce one set without mutating either. Adding the
   * gear's entries to `build.schoolModifiers` directly would work exactly
   * once: a `TalentBuild` is a value, and a batch that reused one would hand
   * the second character the first character's gear on top of its own.
   */
  merge(other: SchoolModifiers): void {
    for (const [school, modifier] of other.bySchool) this.add(school, modifier);
  }

  get isEmpty(): boolean {
    return this.bySchool.size === 0;
  }
}

/**
 * The same three modifiers again, keyed by ATTACK TABLE.
 *
 * ------------------------------------------------------------------------------
 * THE MISSING MIDDLE BETWEEN "one ability" AND "the whole character", on the
 * other axis from `SchoolModifiers`. A school separates fire from frost; this
 * separates MELEE from RANGED, and a swing from a special.
 *
 * Four Hunter talents asked for it and each wanted a different subset:
 *
 *   Savage Strikes     "the critical strike chance of all your MELEE
 *                      ABILITIES" -- specials only, not swings
 *   Ranged Weapon Spec "the damage you deal with RANGED WEAPONS" -- the
 *                      weapon, so Auto Shot counts
 *   Mortal Shots       "the critical strike damage bonus on all RANGED
 *                      ABILITIES" -- specials only again
 *   Predator's Edge    "your MELEE critical strike damage" -- not restricted
 *                      to abilities, so swings count
 *
 * Two of them were left inert and two were applied WHOLE-CHARACTER with a
 * written caveat, because `critDamageBonus` has no table and `critChance` is
 * every attack a character makes. That is the same pair of bad options the
 * Druid's Moonfury and the Shaman's Elemental Fury had before schools existed.
 *
 * IT KEYS ON THE TABLE ITSELF RATHER THAN ON A 'melee' | 'ranged' SPLIT, and
 * the difference is the whole reason it works. The four talents above divide
 * on TWO axes at once -- melee/ranged and ability/swing -- so a two-value
 * enum could express none of them without a second flag. `AttackTableKind`
 * already draws both lines, so each talent lists exactly the tables it covers
 * and says so in the data rather than in a comment.
 *
 * THE OVERLOADED TABLE IS THE TRAP HERE. Thunder Clap, Intercept and Charge
 * are MELEE Warrior abilities that declare `ranged-special`, because that
 * table has no dodge or parry and because it is how `isWeaponUse` tells them
 * apart. Nothing is wrong today -- these modifiers are per character and no
 * Warrior carries a Hunter talent -- but a class whose own melee ability sits
 * on a ranged table WOULD be selected wrongly. Check the abilities, not just
 * the table name, before scoping a new talent this way.
 * ------------------------------------------------------------------------------
 */
export class AttackTableModifiers {
  private readonly byTable = new Map<AttackTableKind, AbilityModifier>();

  add(table: AttackTableKind, modifier: AbilityModifier): void {
    const existing = this.byTable.get(table);
    this.byTable.set(table, existing ? combine(existing, modifier) : modifier);
  }

  /**
   * The modifier for a table, or nothing.
   *
   * An absent table is a damage-over-time tick, whose landing was settled when
   * the effect was applied -- the caller passes `critFrom` for those, which is
   * the same table the tick already takes its crit chance from.
   */
  for(table: AttackTableKind | undefined): AbilityModifier {
    if (table === undefined) return NONE;
    return this.byTable.get(table) ?? NONE;
  }

  get isEmpty(): boolean {
    return this.byTable.size === 0;
  }
}
