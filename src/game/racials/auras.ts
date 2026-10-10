import type { AuraDefinition } from '../../engine';
import { ALL_ABILITIES, RATING_PER_PERCENT, flat, percent, seconds } from '../../engine';

/**
 * The auras the five active racials apply.
 *
 * Numbers are the beta client's own, from `talentsforever.com/racials.js`, and
 * cross-checked against the ruleset owner's statement of the same five. Where
 * the two differ the owner's is used and the difference is recorded at the
 * constant -- which happened once, on Blood Fury.
 */

// ---------------------------------------------------------------------------
// Dwarf: Stoneform
// ---------------------------------------------------------------------------

export const STONEFORM_DURATION_MS = seconds(8);
export const STONEFORM_COOLDOWN_MS = seconds(180);
/** "Reduces physical damage taken by 10%", so 0.9 of it lands. */
export const STONEFORM_PHYSICAL_TAKEN = 0.9;

/**
 * Stoneform: ten percent less physical damage for eight seconds.
 *
 * ----------------------------------------------------------------------------
 * `damageTakenBySchool` RATHER THAN `damageTakenMultiplier`, and the school is
 * the whole point: the client's wording is "reduces all PHYSICAL damage taken",
 * and the blanket field would also soften the magic the encounter does not
 * currently deal -- worth nothing today and wrong the day an encounter has a
 * spell, in the direction that reads as a slightly better tank.
 *
 * ITS OTHER CLAUSE IS OUT OF SCOPE. "Instantly removes and grants immunity to
 * all Bleed, Poison, and Disease effects" is `dispel`, and the Dwarf trait
 * declares it rather than leaving it unsaid.
 * ----------------------------------------------------------------------------
 */
export const STONEFORM: AuraDefinition = {
  id: 'stoneform',
  name: 'Stoneform',
  durationMs: STONEFORM_DURATION_MS,
  damageTakenBySchool: { physical: STONEFORM_PHYSICAL_TAKEN },
};

// ---------------------------------------------------------------------------
// Night Elf: Elune's Light
// ---------------------------------------------------------------------------

export const ELUNES_LIGHT_DURATION_MS = seconds(15);
export const ELUNES_LIGHT_COOLDOWN_MS = seconds(180);
/** Percentage POINTS, on both crit stats. */
export const ELUNES_LIGHT_CRIT = 10;

/**
 * Elune's Light: ten points of crit on everything, for fifteen seconds.
 *
 * TWO STATS, because `critChance` and `spellCritChance` are read by separate
 * tables -- the same reading sixty-two item lines saying "with all spells and
 * attacks" already take. The owner's wording adds "and ranged attack", which
 * `critChance` already covers: `critChanceFrom` is the one crit function and
 * both the melee and the ranged tables read it.
 */
export const ELUNES_LIGHT: AuraDefinition = {
  id: 'elunes_light',
  name: "Elune's Light",
  durationMs: ELUNES_LIGHT_DURATION_MS,
  statModifiers: [flat('critChance', ELUNES_LIGHT_CRIT), flat('spellCritChance', ELUNES_LIGHT_CRIT)],
};

// ---------------------------------------------------------------------------
// Orc: Blood Fury
// ---------------------------------------------------------------------------

export const BLOOD_FURY_DURATION_MS = seconds(15);
export const BLOOD_FURY_COOLDOWN_MS = seconds(120);
/** A fraction, because these are `percentAdd` modifiers. */
export const BLOOD_FURY_POWER = 0.1;

/**
 * Blood Fury: ten percent more attack power, ranged attack power and spell
 * power for fifteen seconds.
 *
 * ----------------------------------------------------------------------------
 * RANGED ATTACK POWER IS THE OWNER'S ADDITION AND IT IS NOT IN THE CLIENT.
 * `racials.js` reads "Increases Attack Power and Spell Power by 10%"; the owner
 * states "Attack Power, Ranged Attack Power, and Spell Power". A later and more
 * specific statement wins, and this is the same question Careful Aim raised and
 * the owner answered the same way -- bare "Attack Power" reaches both pools.
 *
 * It matters: four of the seven Orc presets are Hunters, whose damage is almost
 * entirely ranged. The melee-only reading would have made Blood Fury worth
 * close to nothing on them while reading as a working cooldown.
 *
 * `percentAdd` ON A DERIVED STAT, WHICH IS WHY IT IS A MODIFIER AND NOT A FLAT
 * NUMBER. `StatBlock.computeEffective` resolves in two passes and applies
 * modifiers AFTER the derivation, so +10% here scales the whole derived pool --
 * the strength conversion, the gear, Blessing of Might and all. A flat figure
 * taken at build time would scale the unbuffed pool and be wrong all fight.
 * ----------------------------------------------------------------------------
 */
export const BLOOD_FURY: AuraDefinition = {
  id: 'blood_fury',
  name: 'Blood Fury',
  durationMs: BLOOD_FURY_DURATION_MS,
  statModifiers: [
    percent('attackPower', BLOOD_FURY_POWER),
    percent('rangedAttackPower', BLOOD_FURY_POWER),
    percent('spellPower', BLOOD_FURY_POWER),
  ],
};

// ---------------------------------------------------------------------------
// Troll: Berserking
// ---------------------------------------------------------------------------

export const BERSERKING_DURATION_MS = seconds(10);
export const BERSERKING_COOLDOWN_MS = seconds(180);
/** Percentage points of haste. */
export const BERSERKING_HASTE_PERCENT = 10;

/**
 * Berserking: ten percent spell and attack speed for ten seconds.
 *
 * `hasteRating` through `RATING_PER_PERCENT.haste`, the idiom Seal of the
 * Crusader, Nature's Grace, Flurry, Blade Flurry and the "+1% Haste" enchant
 * already share: `hasteMultiplierFrom` divides by the same constant, so ten
 * points in is exactly 1.10 out and the placeholder conversion moving cannot
 * change what this is worth. It reaches cast speed, melee swing speed and
 * ranged swing speed, which is all three things the tooltip names.
 */
export const BERSERKING: AuraDefinition = {
  id: 'berserking',
  name: 'Berserking',
  durationMs: BERSERKING_DURATION_MS,
  statModifiers: [flat('hasteRating', BERSERKING_HASTE_PERCENT * RATING_PER_PERCENT.haste)],
};

// ---------------------------------------------------------------------------
// Gnome: Eureka!
// ---------------------------------------------------------------------------

export const EUREKA_COOLDOWN_MS = seconds(120);
/** "Your next 3 ..." */
export const EUREKA_CHARGES = 3;
/** "... cost 10% less ..." as a fraction of the base cost. */
export const EUREKA_COST_FRACTION = 0.1;
/** "... and deal 10% more damage." */
export const EUREKA_DAMAGE_MULTIPLIER = 1.1;

/**
 * Eureka!: the next three damaging abilities cost a tenth less and hit a tenth
 * harder.
 *
 * ============================================================================
 * THE TWO HALVES ARE SPENT BY DIFFERENT MACHINERY, AND THAT IS NOT TIDINESS.
 *
 * `consumeCastCharges` runs BEFORE `onCast` -- `casting.ts` spends the charge
 * on the cast that benefits, and at one stack `consumedByCast` REMOVES the
 * aura. So an aura carrying both the cost reduction and the damage bonus with
 * `consumedByCast: 'stack'` would give the THIRD ability its discount and no
 * damage bonus at all, because the aura is gone by the time `dealDamage` looks.
 * That is Holy Shield's bug exactly: an ability quietly worth two thirds of
 * itself, with nothing on the results page to say so.
 *
 * So the cast modifier carries NO `consumedByCast`, and the charge is spent by
 * a reaction pair AFTER the damage has landed. `AuraCollection.consumeStack`
 * exists for precisely this and says so: "Fingers of Frost has no cast modifier
 * at all ... and its charges are still spent by casting."
 *
 * WHY A PAIR RATHER THAN ONE CAST REACTION. "Non-periodic DAMAGING abilities"
 * cannot be answered from the ability declaration, and the two counter-examples
 * are in the project already: Rupture and Serpent Sting both declare an attack
 * table -- they roll it to decide whether the bleed lands -- and neither deals
 * a point of direct damage. `requiresAttackTable` would have spent a charge on
 * both. So a DAMAGE reaction observes that a non-periodic damage event happened
 * and marks the cast; a CAST reaction on `cast.final` spends the stack. See
 * `eurekaReactions`.
 *
 * ONE CHARGE PER CAST, WHICH IS THE OWNER'S RULING AND IS WHAT `cast.final`
 * BUYS. `runCast` runs once per channel tick, so without it the first of five
 * Arcane Missiles would spend a charge and the last two would fire unbuffed.
 * The cost is paid once per channel, so the charge is too, and every missile
 * gets the bonus.
 *
 * `nonPeriodicDamageMultiplier` RATHER THAN `abilityModifiers`, because the
 * clause is "periodic effects get nothing from it" and `abilityModifierFor` is
 * not told whether the damage is a tick. An `abilityModifiers: { '*': ... }`
 * entry would raise Ignite, Pyroblast's burn and every Corruption tick inside
 * the window -- a bigger number and no error. See the field's own comment.
 * ============================================================================
 */
export const EUREKA: AuraDefinition = {
  id: 'eureka',
  name: 'Eureka!',
  /*
   * UNTIL IT IS SPENT. The client states no duration for the buff -- only the
   * two minute cooldown -- so none is invented. Three charges at ten percent
   * will be gone within a few global cooldowns on any build that has the
   * ability at all, which is what makes the absence cheap rather than
   * generous.
   */
  durationMs: 0,
  maxStacks: EUREKA_CHARGES,
  chargesOnApply: EUREKA_CHARGES,
  castModifier: {
    /*
     * "Damaging abilities" is not a list and never will be, so the catch-all,
     * narrowed by the one clause that stops a charge being thrown away: an
     * ability that costs nothing cannot take a discount.
     *
     * NO `requiresAttackTable` HERE, deliberately. The CAST side only decides
     * which casts get the discount, and an ability with no table deals no
     * direct damage, so it has nothing to discount either -- but Rupture and
     * Serpent Sting HAVE a table and deal no damage, so the table is the wrong
     * question on both sides. What keeps the discount honest is that the charge
     * is not spent here: a cast that turns out not to be damaging keeps its
     * discount for this once and the stack stays, which is the generous
     * rounding of an ambiguous clause rather than a free charge.
     */
    abilityIds: [ALL_ABILITIES],
    requiresCost: true,
    costFraction: EUREKA_COST_FRACTION,
  },
  nonPeriodicDamageMultiplier: EUREKA_DAMAGE_MULTIPLIER,
};

/** Every aura an active racial applies, for the catalog and for tests. */
export const CATALOG_AURAS: readonly AuraDefinition[] = [
  STONEFORM,
  ELUNES_LIGHT,
  BLOOD_FURY,
  BERSERKING,
  EUREKA,
];
