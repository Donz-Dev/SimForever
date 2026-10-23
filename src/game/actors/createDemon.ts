import type { Combatant as CombatantType, DamageSchool } from '../../engine';
import {
  AbilityModifiers,
  Combatant,
  SchoolModifiers,
  seconds,
  spellCritChanceFrom,
} from '../../engine';
import type { PetModifiers } from '../talents/talentBuild';
import { NO_PET_MODIFIERS } from '../talents/talentBuild';
import { attackPowerCoefficientFor } from '../combat/weaponDamage';
import type { SummonableDemon } from '../character/petFamilies';
import { IMP_FIREBOLT, LASH_OF_PAIN } from '../abilities/demon';
import { IMP_ROTATION, SUCCUBUS_ROTATION } from '../rotations/demon';
import { warlockDemonHit } from './petHit';

/*
 * ==============================================================================
 * A WARLOCK'S SUMMONED DEMON, built from its owner the way `createPet` builds a
 * Hunter's -- and deliberately a SEPARATE function, because almost nothing is
 * shared: a Hunter pet scales off ATTACK power and spends focus on two melee
 * abilities, and a demon scales off SPELL power and either casts or swings.
 *
 * EVERY FIGURE BELOW THAT THE OWNER DID NOT STATE IS FROM
 * mythicsim-forever-engine, `src/classes/warlock/prepare/pets.rs`, which the
 * owner pointed at for warlock pet scaling. It is a community engine reading
 * the beta client, and its own comment calls the inheritance "the client's
 * hidden Warlock Pet Scaling aura (416189)".
 * ==============================================================================
 */

/** Level 60 base stats, `fn base_stats`. The repository states no armor or health. */
const BASE: Readonly<
  Record<
    SummonableDemon,
    {
      readonly name: string;
      readonly strength: number;
      readonly agility: number;
      readonly stamina: number;
      readonly intellect: number;
    }
  >
> = {
  imp: { name: 'Imp', strength: 122, agility: 35, stamina: 86, intellect: 264 },
  succubus: { name: 'Succubus', strength: 129, agility: 85, stamina: 234, intellect: 70 },
};

/*
 * WHAT A DEMON INHERITS, `fn pet_stat_inheritance`:
 *   spell hit and spell crit, 100%, to the demon's spell AND physical tables;
 *   10% of the warlock's spell damage as spell damage;
 *   17% of the warlock's spell damage as ATTACK POWER.
 * Nothing else -- no stamina, intellect, armor or resistance.
 */
export const DEMON_SPELL_POWER_SHARE = 0.1;
export const DEMON_ATTACK_POWER_PER_OWNER_SPELL_POWER = 0.17;

/*
 * THE DEMONS' OWN CRIT, both read off the repository's conversions rather than
 * stated by it: the Imp's spell crit is its Intellect at the Mage rate (264 x
 * 0.0168 = 4.4352%), and the Succubus carries "its own base crit" of 6.2% on
 * spells -- "Lash of Pain crits about 6% whatever its master's crit" -- with
 * physical crit from Agility at a twentieth of a point each (85 / 20 = 4.25%),
 * the same rate the Hunter's pet uses.
 */
export const IMP_SPELL_CRIT_PER_INTELLECT = 0.0168;
export const SUCCUBUS_BASE_SPELL_CRIT = 6.2;
export const DEMON_AGILITY_PER_CRIT = 20;

/** Strength to attack power, `add_stat_dependency(Strength, AttackPower, 2.0)`. */
export const DEMON_ATTACK_POWER_PER_STRENGTH = 2;

/** `Summon::Succubus => Some((95.0, 131.0))`, `swing_speed: 2.0`. */
export const SUCCUBUS_SWING_MIN = 95;
export const SUCCUBUS_SWING_MAX = 131;
export const SUCCUBUS_SWING_SECONDS = 2;

/*
 * HEALTH IS NOT STATED BY ANY SOURCE, AND NOTHING READS IT: no encounter here
 * attacks a demon. Classic's ten health a point of stamina keeps a combatant
 * that cannot die of a rounding error, and the name says it is borrowed.
 */
export const PLACEHOLDER_DEMON_HEALTH_PER_STAMINA = 10;

export interface DemonOptions {
  readonly owner: CombatantType;
  readonly demon: SummonableDemon;
  /** What the owner's talents do to the demon, resolved by `talentBuild`. */
  readonly talents?: PetModifiers;
}

export function createDemon(options: DemonOptions): CombatantType {
  const { owner, demon } = options;
  const talents = options.talents ?? NO_PET_MODIFIERS;
  const base = BASE[demon];
  const ownerStats = owner.stats.effective;
  const demonHit = warlockDemonHit(ownerStats.hitChance);

  const ownerSpellCrit = spellCritChanceFrom(ownerStats) * 100;
  const ownSpellCrit =
    demon === 'imp' ? base.intellect * IMP_SPELL_CRIT_PER_INTELLECT : SUCCUBUS_BASE_SPELL_CRIT;
  const ownMeleeCrit = base.agility / DEMON_AGILITY_PER_CRIT;

  /*
   * TALENTS LAND AS MODIFIERS ON THE DEMON ITSELF, so every damage event the
   * demon deals passes through them on the ordinary path -- Improved Imp on
   * Firebolt, Improved Sayaad on Lash of Pain, Master Demonologist on a school.
   */
  const abilityModifiers = new AbilityModifiers();
  for (const [abilityId, multiplier] of Object.entries(talents.abilityDamage ?? {})) {
    abilityModifiers.add(abilityId, { damageMultiplier: multiplier });
  }
  const schoolModifiers = new SchoolModifiers();
  for (const [school, multiplier] of Object.entries(talents.schoolDamage ?? {})) {
    schoolModifiers.add(school as DamageSchool, { damageMultiplier: multiplier ?? 1 });
  }

  const succubusWeapon = {
    mainHand: {
      name: 'Succubus whip',
      baseDamage: (SUCCUBUS_SWING_MIN + SUCCUBUS_SWING_MAX) / 2,
      damageVariance:
        (SUCCUBUS_SWING_MAX - SUCCUBUS_SWING_MIN) / (SUCCUBUS_SWING_MAX + SUCCUBUS_SWING_MIN),
      swingTimerMs: seconds(SUCCUBUS_SWING_SECONDS),
      powerCoefficient: attackPowerCoefficientFor(seconds(SUCCUBUS_SWING_SECONDS)),
      weaponType: 'fist' as const,
    },
  };

  return new Combatant({
    // `_pet`, the Hunter pet's suffix, so an APL clause naming `on: 'pet'`
    // finds a demon by its owner exactly as it finds a Hunter's.
    id: `${owner.id}_pet`,
    name: base.name,
    kind: 'pet',
    faction: owner.faction,
    ownerId: owner.id,
    level: owner.level,
    maxHealth: Math.max(1, base.stamina * PLACEHOLDER_DEMON_HEALTH_PER_STAMINA),
    autoAttack: demon === 'succubus' ? 'main-hand' : 'none',
    ...(demon === 'succubus' ? { weapons: succubusWeapon } : {}),
    stats: {
      strength: base.strength,
      agility: base.agility,
      stamina: base.stamina,
      intellect: base.intellect,
      spellPower: ownerStats.spellPower * DEMON_SPELL_POWER_SHARE + (talents.spellPower ?? 0),
      attackPower:
        base.strength * DEMON_ATTACK_POWER_PER_STRENGTH +
        ownerStats.spellPower * DEMON_ATTACK_POWER_PER_OWNER_SPELL_POWER,
      /*
       * The owner's SPELL hit to the demon's spells and 8/17 of it to its
       * melee, by the round 51 rule in `petHit.ts` -- it was the full spell
       * figure on both tables, which handed a Succubus nine points of melee
       * hit it could not use. Crit still reaches both whole.
       */
      hitChance: demonHit.hitChance,
      spellCritChance: ownSpellCrit + ownerSpellCrit,
      critChance: ownMeleeCrit + ownerSpellCrit,
    },
    abilities: demon === 'imp' ? [IMP_FIREBOLT] : [LASH_OF_PAIN],
    rotation: demon === 'imp' ? IMP_ROTATION : SUCCUBUS_ROTATION,
    abilityModifiers,
    schoolModifiers,
    attackTableModifiers: demonHit.attackTableModifiers,
    // Unholy Power and Soul Link's demon half. No "happiness" multiplier: that
    // is the Hunter pet's, and the repository states none for a demon.
    damageMultiplier: talents.damageMultiplier,
    // Demonic Brand's strike, which fires on the DEMON's own landed attacks.
    reactions: talents.reactions,
  });
}
