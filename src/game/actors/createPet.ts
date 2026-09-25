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
 * WHAT IS NOT STATED ANYWHERE: the pet's own base weapon damage and swing
 * speed. The wiki says only that "pets can have different base attack speeds"
 * and that "pet damage is currently not normalized by attack speed". So those
 * two are PLACEHOLDERS, named and surfaced, and they are the reason a Beast
 * Mastery figure is rougher than the other two Hunter profiles.
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
 * THE PET'S OWN BASE DPS, and it is the ONE remaining invented number here.
 *
 * ----------------------------------------------------------------------------
 * IT IS A DPS NOW AND NOT A PER-SWING DAMAGE, which is the shape both sources
 * state. The Forever Hunter wiki gives auto attack as
 *
 *     ((PetBaseDPS + AP / 14) x HappinessMod x FamilyMod x ...) x PetSwingSpeed
 *
 * and `powerCoefficient` is already `speed / 14`, so multiplying a base DPS
 * by the swing reproduces that line exactly.
 *
 * WHAT THAT BUYS IS THAT SWING SPEED NO LONGER CHANGES THE DAMAGE. It used to:
 * a flat 100 per swing meant a 1-second pet dealt twice a 2-second pet's DPS,
 * and both sources say the opposite in as many words -- the wiki that "faster
 * attack speed does not inherently increase the pet's base DPS", Petopia that
 * "faster pets may attack more frequently but they do proportionally less
 * damage per hit". So the remaining speed placeholder is now damage-neutral
 * and only decides how the same total is cut up.
 *
 * THE VALUE IS UNCHANGED ON PURPOSE. 100 damage every 2 seconds was 50 DPS, so
 * 50 it stays: the restructure above moves no number by itself, which leaves
 * the family and happiness modifiers below as the only measured change. Every
 * source states these as RELATIVE figures -- Cat 1.10, Bear 0.91 -- and none
 * of them states the absolute they are relative TO.
 *
 * WHAT WOULD SETTLE IT: one stated pet DPS or one stated damage range at
 * level 60, from the client, the owner, or a combat log. Everything else in
 * this file is now sourced.
 * ----------------------------------------------------------------------------
 */
export const PLACEHOLDER_PET_BASE_DPS = 50;

/**
 * The swing a pet takes, in seconds. STILL A PLACEHOLDER AND NO LONGER A
 * DAMAGE ONE.
 *
 * Attack speed belongs to the individual pet rather than the family -- Petopia
 * lists Cats from 1.0 to 1.6 seconds and Bears from 2.0 to 2.5 -- so there is
 * no per-family figure to read. It still decides how often the pet swings, and
 * therefore how lumpy its crits are, but not what it deals over a fight.
 */
export const PLACEHOLDER_PET_SWING_SECONDS = 2;

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
  'The pet’s BASE DPS is a PLACEHOLDER -- ' +
  `${PLACEHOLDER_PET_BASE_DPS} a second, assumed and unverified. Everything ` +
  'around it is sourced: the family modifiers are Petopia Classic’s and the ' +
  'Cat row matches the Forever Hunter wiki exactly, happiness is the wiki’s ' +
  '125% for a fed pet, and the scaling from the Hunter is 2 health a stamina, ' +
  '30% of armor, 10% of the highest attack power source and 100% of crit. ' +
  'Swing speed is also a placeholder and no longer affects the damage, ' +
  'because base DPS is multiplied by the swing rather than dealt per swing.';

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

  const attackPower = highestAttackPower(owner) * PET_ATTACK_POWER_SHARE;
  const health =
    stats.stamina *
    PET_HEALTH_PER_OWNER_STAMINA *
    definition.healthModifier *
    talents.healthMultiplier;

  /*
   * THE SWING, AND THE BASE DAMAGE IT CARRIES. `baseDamage` is a per-swing
   * figure, so a base DPS becomes one by multiplying by the swing -- which is
   * the wiki's `x PetSwingSpeed` and is what makes speed damage-neutral.
   */
  const swingSeconds = definition.swingSeconds ?? PLACEHOLDER_PET_SWING_SECONDS;
  const baseDamage = PLACEHOLDER_PET_BASE_DPS * swingSeconds;

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
        baseDamage,
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
      critChance: stats.critChance * PET_CRIT_SHARE + talents.critBonus,
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
