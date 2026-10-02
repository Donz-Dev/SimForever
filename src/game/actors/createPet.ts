import type { Ability, Combatant as CombatantType } from '../../engine';
import { Combatant, seconds } from '../../engine';
import { regenerationFor } from '../combat/resourceRules';
import type { PetModifiers } from '../talents/talentBuild';
import { NO_PET_MODIFIERS } from '../talents/talentBuild';
import { attackPowerCoefficientFor } from '../combat/weaponDamage';
import type { PetFamilyId } from '../character/petFamilies';
import { PET_FAMILIES, abilitiesForFamily } from '../character/petFamilies';
import { PET_ABILITIES } from '../abilities/pet';
import { PET_ROTATION } from '../rotations/pet';

/**
 * A Hunter's pet, built from its owner.
 *
 * ------------------------------------------------------------------------------
 * THE SCALING IS WOW FOREVER'S, and it is not Classic's. From the Forever
 * Hunter wiki, which the ruleset owner named as the source for exactly this:
 *
 *     Stamina        1 player Stamina gives the pet 2 Health
 *     Armor          the pet gains 30% of player Armor
 *     Attack Power   the pet gains 10% of the player's HIGHEST attack power
 *                    source
 *     Crit           the pet gains 100% of the player's crit chance
 *
 * "THE PLAYER'S HIGHEST ATTACK POWER SOURCE" is the phrase that matters and is
 * the reason this reads both: a Hunter's ranged attack power is normally its
 * larger one, but a Lone Wolf melee build has no pet at all and a Beast Mastery
 * hunter in Aspect of the Beast could in principle flip which is bigger. Taking
 * the max is what the wiki says, so taking the max is what this does.
 *
 * ONE HUNDRED PERCENT OF THE PLAYER'S CRIT, which makes a pet far more
 * sensitive to the owner's gear than a Classic pet ever was -- and means every
 * crit talent the Hunter takes is worth something twice.
 *
 * AND THE PET'S OWN NUMBERS ARE THE OWNER'S NOW. The wiki never stated a pet's
 * base weapon damage, its base stats or the absolute its family modifiers are
 * relative to; the ruleset owner supplied all three on 2026-10-01, as a
 * complete model. THERE IS NO LONGER A PLACEHOLDER IN THIS FILE.
 *
 * THE OWNER'S MODEL AND THE WIKI'S FORMULA ARE THE SAME SHAPE, which is worth
 * saying because the project recorded them as disagreeing about a UNIT. The
 * wiki gives
 *
 *     ((PetBaseDPS + AP / 14) x mods) x PetSwingSpeed
 *
 * and the owner gives
 *
 *     (random(36.34, 55.32) + 2 / 14 x PetAP) x 1.375
 *
 * Multiply the wiki's line out and `PetBaseDPS x PetSwingSpeed` is a per-swing
 * base damage and `AP / 14 x PetSwingSpeed` is `swing / 14 x AP`. They are one
 * formula. The owner's states the swing (2.0 seconds) and the absolute, which
 * is exactly what the wiki never did -- so the old note here claiming a pet's
 * base "is a DPS, not a per-swing damage" was answering a question that only
 * existed while the swing was unknown.
 * ------------------------------------------------------------------------------
 */

/** 1 player stamina is 2 pet health. */
export const PET_HEALTH_PER_OWNER_STAMINA = 2;
/** The pet gains 30% of the owner's armor. */
export const PET_ARMOR_SHARE = 0.3;
/** The pet gains 10% of the owner's highest attack power source. */
export const PET_ATTACK_POWER_SHARE = 0.1;
/** The pet gains 100% of the owner's crit chance. */
export const PET_CRIT_SHARE = 1;

/** A pet's focus pool. The regeneration rate lives in `resourceRules.ts`. */
export const PET_FOCUS_MAXIMUM = 100;

/**
 * THE PET'S OWN WEAPON DAMAGE, per swing at its base speed.
 *
 * ----------------------------------------------------------------------------
 * SUPPLIED BY THE RULESET OWNER, 2026-10-01, and it replaces
 * `PLACEHOLDER_PET_BASE_DPS` -- which was 50, then 150, and was the largest
 * invented number in the class for as long as pets existed. **Every pet figure
 * recorded before this date was measured against a guess.**
 *
 * THE RANGE IS EXACTLY SYMMETRIC ABOUT ITS MIDPOINT, and that is what lets the
 * engine express it without a new mechanism: 36.34 and 55.32 are both 9.49
 * from 45.83. `weapon.damageVariance` is already a fraction either side of
 * `baseDamage`, so the midpoint and the fraction below reproduce
 * `random(36.34, 55.32)` exactly rather than approximately.
 *
 * BOTH ARE DERIVED FROM THE STATED PAIR rather than written out, so the two
 * numbers in this file are the two numbers the owner gave. A midpoint
 * transcribed by hand is a third number that can disagree with them.
 * ----------------------------------------------------------------------------
 */
export const PET_BASE_DAMAGE_MIN = 36.34;
export const PET_BASE_DAMAGE_MAX = 55.32;

/** The midpoint the engine rolls around. */
export const PET_BASE_DAMAGE = (PET_BASE_DAMAGE_MIN + PET_BASE_DAMAGE_MAX) / 2;
/** The spread either side of it, as a fraction of the midpoint. */
export const PET_BASE_DAMAGE_VARIANCE =
  (PET_BASE_DAMAGE_MAX - PET_BASE_DAMAGE_MIN) / (PET_BASE_DAMAGE_MAX + PET_BASE_DAMAGE_MIN);

/**
 * THE PET'S OWN BASE STATS, before anything it inherits from its owner.
 *
 * ----------------------------------------------------------------------------
 * The owner's figures, and the two formulas they feed:
 *
 *     Pet Attack Power = -20 + PetStrength x 2 + 0.1 x max(MeleeAP, RangedAP)
 *     Pet Crit Chance  = Agility / 20 + HunterCritChance
 *
 * SO A PET STARTS WITH 252 ATTACK POWER OF ITS OWN -- -20 plus 136 strength at
 * two apiece -- which it did not have before this model arrived. The 10% share
 * of the Hunter's larger pool is on top, and for the Beast Mastery preset that
 * share is about a third of the total rather than all of it.
 *
 * AND FIVE PERCENTAGE POINTS OF CRIT FROM ITS OWN AGILITY, on top of the 100%
 * of the owner's it already inherited.
 *
 * STORED AS STATS AS WELL AS READ AS CONSTANTS, deliberately. A pet has no
 * `statDerivation`, so nothing converts its strength into attack power behind
 * this file's back and there is no double count; setting them means the pet
 * carries the inputs to its own formulas rather than only their answers.
 * Nothing moves them -- a pet receives no raid buffs, which is a Forever rule.
 * ----------------------------------------------------------------------------
 */
export const PET_BASE_STRENGTH = 136;
export const PET_BASE_AGILITY = 100;
export const PET_BASE_ATTACK_POWER = -20;
/** Strength is worth two attack power to a pet. */
export const PET_ATTACK_POWER_PER_STRENGTH = 2;
/** Twenty agility is worth one percentage point of crit. */
export const PET_AGILITY_PER_CRIT = 20;

/**
 * The pet's base swing, in seconds. STATED, and no longer a placeholder.
 *
 * The owner's model names it outright -- "Base Swing Time = 2.0 seconds" -- and
 * it is the speed the `2 / 14` in their damage formula is the coefficient for,
 * so the two have to agree or the attack power term is wrong.
 *
 * NO FAMILY DECLARES ONE, so every pet here swings at this speed. It matters
 * more than it used to: with the base damage stated PER SWING, a faster pet
 * with the same base would deal more, where under the old base-DPS reading
 * speed was damage-neutral. Nothing exercises that today, and a family that
 * ever gets its own speed needs the owner to say which way it cuts.
 */
export const PET_SWING_SECONDS = 2;

/**
 * A fed pet is a HAPPY one, and a happy pet deals 125%.
 *
 * The wiki's three levels are Happy 125%, Content 100%, Unhappy 75%. Happy is
 * an assumption about the PLAYER rather than about the engine -- nothing here
 * tracks feeding -- and it is the same kind of assumption Improved Tracking
 * already makes, so it is stated rather than hidden. It is true of any real
 * raid pull and false of a pet nobody looks after.
 */
export const PET_HAPPY_DAMAGE_MULTIPLIER = 1.25;

export const PET_UNMODELLED =
  'Every number in the pet model is now sourced, and the base damage is the ' +
  `ruleset owner’s: ${PET_BASE_DAMAGE_MIN} to ${PET_BASE_DAMAGE_MAX} a swing ` +
  `at ${PET_SWING_SECONDS} seconds, from base stats of ${PET_BASE_STRENGTH} ` +
  `strength and ${PET_BASE_AGILITY} agility. The scaling from the Hunter is 2 ` +
  'health a stamina, 30% of armor, 10% of the highest attack power source and ' +
  '100% of crit. The family modifiers are Petopia Classic’s and happiness is ' +
  'the wiki’s 125% for a fed pet — which for a Cat multiply to the 1.375 the ' +
  'owner states as the pet damage multiplier. HAPPINESS IS THE ONE ' +
  'ASSUMPTION LEFT: nothing here tracks feeding, so the pet is assumed fed.';

export interface PetOptions {
  readonly owner: CombatantType;
  readonly family: PetFamilyId;
  readonly name?: string;
  /**
   * What the OWNER'S TALENTS do to this pet, resolved by `talentBuild`.
   *
   * ----------------------------------------------------------------------
   * SIX HUNTER TALENTS WERE INERT WITHOUT THIS, and they are most of what a
   * Beast Mastery build spends its points on: Endurance Training, Focused
   * Fire's pet half, Unleashed Fury, Ferocity, Frenzy and Bestial Discipline.
   * Each said so in its own `unmodelled` reason, which is how they were found
   * -- the reasons are written specifically enough to check.
   *
   * Handed over already resolved, so nothing here does arithmetic on a talent
   * rank. `createPet` applies what it is given.
   * ----------------------------------------------------------------------
   */
  readonly talents?: PetModifiers;
  readonly extraAbilities?: readonly Ability[];
}

/** The owner's larger attack power source, which is what the pet reads. */
export function highestAttackPower(owner: CombatantType): number {
  const stats = owner.stats.effective;
  return Math.max(stats.attackPower, stats.rangedAttackPower);
}

export function createPet(options: PetOptions): CombatantType {
  const { owner, family } = options;
  const talents = options.talents ?? NO_PET_MODIFIERS;
  const stats = owner.stats.effective;
  const definition = PET_FAMILIES[family];

  /*
   * THE OWNER'S FORMULA, TERM FOR TERM:
   *   -20 + PetStrength x 2 + 0.1 x max(HunterMeleeAP, HunterRangedAP)
   */
  const attackPower =
    PET_BASE_ATTACK_POWER +
    PET_BASE_STRENGTH * PET_ATTACK_POWER_PER_STRENGTH +
    highestAttackPower(owner) * PET_ATTACK_POWER_SHARE;
  const health =
    stats.stamina *
    PET_HEALTH_PER_OWNER_STAMINA *
    definition.healthModifier *
    talents.healthMultiplier;

  // The owner states the base damage PER SWING at this speed, so there is
  // nothing to convert: `baseDamage` is already the unit the engine wants.
  const swingSeconds = definition.swingSeconds ?? PET_SWING_SECONDS;

  const known = abilitiesForFamily(family, PET_ABILITIES);

  return new Combatant({
    id: `${owner.id}_pet`,
    name: options.name ?? definition.name,
    kind: 'pet',
    faction: owner.faction,
    /*
     * THE OWNER LINK. `ownerId` has been on `Combatant` since before any pet
     * existed; this is the first thing to set it. A talent that reaches the
     * pet -- Bestial Wrath, Frenzy -- finds it through this.
     */
    ownerId: owner.id,
    level: owner.level,
    maxHealth: Math.max(1, Math.round(health)),
    autoAttack: 'main-hand',
    weapons: {
      mainHand: {
        name: `${definition.name} claws`,
        baseDamage: PET_BASE_DAMAGE,
        /*
         * WHAT MAKES THE ROLL THE OWNER'S RANGE RATHER THAN THE ENGINE'S
         * DEFAULT. `DEFAULT_DAMAGE_VARIANCE` is 15% and this range is 20.7%,
         * so leaving it out would narrow every pet swing -- mean-correct and
         * wrong in the tails, which is the kind of error a DPS figure hides
         * and a 5th-percentile figure does not.
         */
        damageVariance: PET_BASE_DAMAGE_VARIANCE,
        swingTimerMs: seconds(swingSeconds),
        /*
         * THE UNIVERSAL FORMULA, speed over fourteen -- the same one every
         * weapon in the project uses. The wiki notes that "pet damage is
         * currently not normalized by attack speed", which may mean Forever
         * does something else here; that is recorded and not acted on,
         * because a sentence saying a rule may differ is not a rule.
         */
        powerCoefficient: attackPowerCoefficientFor(seconds(swingSeconds)),
        // `fist`, which is the nearest thing the engine has to claws and
        // teeth. Nothing keys on it for a pet -- no weapon specialisation
        // reaches one -- so it is a label rather than a rule.
        weaponType: 'fist',
      },
    },
    stats: {
      attackPower,
      armor: stats.armor * PET_ARMOR_SHARE * definition.armorModifier * talents.armorMultiplier,
      // ONE HUNDRED PERCENT of the owner's, which is the wiki's figure and is
      // what makes a Hunter's crit gear worth double.
      /*
       * A HUNDRED PERCENT OF THE OWNER'S, PLUS FEROCITY ON TOP. The wiki's
       * figure is the inheritance; the talent is a further bonus and says so
       * -- "increases the critical strike chance of your pets and hawks".
       */
      /*
       * "Pet Crit Chance = Agility / 20 + HunterCritChance", plus Ferocity on
       * top -- the talent is a further bonus and says so.
       */
      critChance:
        PET_BASE_AGILITY / PET_AGILITY_PER_CRIT +
        stats.critChance * PET_CRIT_SHARE +
        talents.critBonus,
      strength: PET_BASE_STRENGTH,
      agility: PET_BASE_AGILITY,
    },
    resources: [{ type: 'focus', maximum: PET_FOCUS_MAXIMUM }],
    /*
     * BESTIAL DISCIPLINE RAISES FOCUS REGENERATION, so the rate is scaled
     * rather than taken from the table directly. At 2/2 that is +20% on ten a
     * second, which is one more Claw every few seconds.
     */
    regeneration: regenerationFor(['focus']).map((regen) => ({
      ...regen,
      amountPerTick: (actor, context) =>
        regen.amountPerTick(actor, context) * talents.focusRegenMultiplier,
    })),
    abilities: [...known, ...(options.extraAbilities ?? [])],
    rotation: PET_ROTATION,
    /*
     * THE FAMILY AND HAPPINESS MODIFIERS, alongside the talents'.
     *
     * The wiki puts both INSIDE the bracket that the swing multiplies, and it
     * puts the same two on Claw and Bite -- so they belong on the pet's whole
     * damage rather than on its weapon, which is exactly what
     * `damageMultiplier` is. A Cat is 1.10 and a fed pet is 1.25, so the Beast
     * Mastery preset's pet deals 37.5% more than a neutral one.
     */
    damageMultiplier:
      talents.damageMultiplier * definition.damageModifier * PET_HAPPY_DAMAGE_MULTIPLIER,
    // Frenzy, which fires on the PET'S crit and buffs the PET.
    reactions: talents.reactions,
  });
}
