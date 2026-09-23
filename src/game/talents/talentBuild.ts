import type {
  PartialStats,
  Reaction,
  ResourceType,
  StatModifierSpec,
  StatName,
  WeaponProfile,
} from '../../engine';
import type { WeaponSlot } from '../../engine';
import { ALL_ABILITIES, AbilityModifiers, seconds } from '../../engine';
import { COMBAT_CONSTANTS } from '../combat/attackChances';
import type { TalentReactionBuilder } from '../reactions/warriorTalents';
import { WARRIOR_TALENT_REACTIONS } from '../reactions/warriorTalents';
import type { ClassId, CombatStyleId } from '../character';
import type { Equipment } from '../items/Item';
import { armorFromItems, liveEquipment } from '../items/equipment';
import type { TalentAllocation } from './Talent';
import type {
  IllegalTalent,
  TalentEffects,
  UnmodelledTalent,
  WeaponRequirement,
} from './TalentEffect';
import { talentsForClass } from './talentData';
import { talentDescription, talentNumber } from './talentValues';
import { WARRIOR_TALENT_EFFECTS } from './warriorEffects';

/** Effect tables per class. Only the Warrior has one. */
const EFFECTS: Partial<Record<ClassId, Readonly<Record<string, TalentEffects>>>> = {
  warrior: WARRIOR_TALENT_EFFECTS,
};

/** Reaction builders per class, keyed by talent id. */
const REACTIONS: Partial<Record<ClassId, Readonly<Record<string, TalentReactionBuilder>>>> = {
  warrior: WARRIOR_TALENT_REACTIONS,
};

/**
 * Everything an allocation contributes, resolved once before the fight.
 *
 * Talents are decided when a character is built and do not change during
 * combat, so resolving them into plain data here keeps the engine unaware that
 * talents exist at all. Nothing below `createPlayer` ever sees a talent.
 */
export interface TalentBuild {
  /** Flat additions, applied on top of gear and profile stats. */
  readonly stats: PartialStats;
  /**
   * Percentage contributions, as modifiers rather than folded into `stats`.
   *
   * A talent reading "+2% Stamina" has to stay a modifier: stats are base plus
   * modifiers and derived values are produced by a function over them, so a
   * percentage kept as a modifier still composes correctly when a buff moves
   * the underlying stat. Folding it into a flat number at build time would
   * freeze it against the unbuffed value -- the same mistake that would leave
   * attack power stuck at its starting figure.
   */
  readonly statModifiers: readonly StatModifierSpec[];
  /** Resource caps to raise. */
  readonly resourceMaximums: Partial<Record<ResourceType, number>>;
  /** Abilities a talent grants, which the character otherwise would not have. */
  readonly grantedAbilities: ReadonlySet<string>;
  /**
   * Auras the character opens combat under, because a talent granted them.
   *
   * For passives that DO something rather than adding a number -- Anger
   * Management ticks rage, which no stat modifier can express.
   */
  readonly grantedAuras: ReadonlySet<string>;
  /**
   * What the off hand does, relative to untalented.
   *
   * Three multipliers and a flat hit bonus, because Dual Wield Specialization
   * moves three unrelated things at once and they land in three different
   * places: the weapon's damage, the weapon's rage rule, and the combat table.
   *
   * 1 and 0 mean "no talent", so a caller can apply them unconditionally.
   */
  readonly offHandDamageMultiplier: number;
  readonly offHandResourceMultiplier: number;
  /** Percentage POINTS of hit, on off-hand attacks only. */
  readonly offHandHitBonus: number;
  /** Resource cost to SUBTRACT from an ability, by ability id. */
  readonly abilityCostReduction: ReadonlyMap<string, number>;
  /**
   * Resource cost to SUBTRACT from every ability that rolls a combat table.
   *
   * Derived from `attackTable` rather than a list of ids, so an ability added
   * later is covered without anyone remembering to add it.
   */
  readonly attackAbilityCostReduction: number;
  /** Cooldown to SUBTRACT from an ability, in milliseconds, by ability id. */
  readonly abilityCooldownReductionMs: ReadonlyMap<string, number>;
  /** Per-ability crit, crit damage and damage scaling, for the combatant. */
  readonly abilityModifiers: AbilityModifiers;
  /** Reactions the talents grant, added to the ones every character has. */
  readonly reactions: readonly Reaction[];
  /**
   * A multiplier on ALL damage, from talents conditional on the weapon held.
   *
   * Separate from `abilityModifiers` because it covers auto attacks, which are
   * not abilities.
   */
  readonly damageMultiplier: number;
  /** Named numbers handed to a specific ability's `onCast`, by ability id. */
  readonly abilityBonuses: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /** Cast time to SUBTRACT from an ability, in milliseconds. */
  readonly abilityCastTimeReductionMs: ReadonlyMap<string, number>;
  /** Global cooldown to SUBTRACT from an ability, in milliseconds. */
  readonly abilityGcdReductionMs: ReadonlyMap<string, number>;
  /** Abilities whose cast lets the swing timer run on rather than resetting. */
  readonly abilitiesHoldingSwing: ReadonlySet<string>;
  /**
   * Extra stances a talent makes an ability usable in.
   *
   * Vanguard's Charge in Defensive Stance. Added to the ability's own list
   * rather than replacing it, so Battle Stance still works.
   */
  readonly abilityExtraStances: ReadonlyMap<string, readonly string[]>;
  /**
   * Talents with points in them that are doing nothing, and why.
   *
   * Shown to the person under "Chosen but not simulated", the same way the Gear
   * panel lists an item's unmodelled effects. A talent that silently did
   * nothing would be indistinguishable from one that worked.
   */
  readonly unmodelled: readonly UnmodelledTalent[];
  /**
   * Talents that were allocated points but whose requirements are not met, and
   * which therefore contributed nothing. Empty for any build made in the UI,
   * which will not let an illegal point be spent; not empty for a profile
   * loaded from JSON, which nothing else checks.
   */
  readonly illegal: readonly IllegalTalent[];
}

const EMPTY: TalentBuild = {
  stats: {},
  statModifiers: [],
  resourceMaximums: {},
  grantedAbilities: new Set(),
  grantedAuras: new Set(),
  offHandDamageMultiplier: 1,
  offHandResourceMultiplier: 1,
  offHandHitBonus: 0,
  abilityCostReduction: new Map(),
  attackAbilityCostReduction: 0,
  abilityCooldownReductionMs: new Map(),
  abilityModifiers: new AbilityModifiers(),
  reactions: [],
  damageMultiplier: 1,
  abilityBonuses: new Map(),
  abilityCastTimeReductionMs: new Map(),
  abilityGcdReductionMs: new Map(),
  abilitiesHoldingSwing: new Set(),
  abilityExtraStances: new Map(),
  unmodelled: [],
  illegal: [],
};

/**
 * Resolve an allocation into what it actually does.
 *
 * A talent contributes nothing unless it has a point in it, its class has an
 * effect table, and — for every effect that needs a number — the values file
 * has one for that rank. A MISSING VALUE IS NOT ZERO AND NOT EXTRAPOLATED: the
 * talent is reported as unmodelled, so a gap in the data looks like a gap
 * rather than like a talent that works and is worth nothing.
 */
/**
 * What the character is holding, for talents conditional on the weapon.
 *
 * Optional: a caller that does not supply it gets no conditional effects, and
 * the talents that need one are reported as unmodelled rather than silently
 * applying. That is the same rule as a missing value -- an effect that cannot
 * be evaluated must not quietly become nothing.
 */
export interface TalentBuildContext {
  readonly mainHand?: WeaponProfile;
  /** Whether a shield is equipped, for talents that ask. */
  readonly hasShield?: boolean;
  /** Armor the equipped items supply, for talents that scale it. */
  readonly itemArmor?: number;
  /**
   * The off hand, because a talent can care about EITHER weapon.
   *
   * Weaponmaster gives a different benefit per weapon family and a dual
   * wielder can hold two families at once -- a mace and a sword is a real
   * build, and judging it by the main hand alone silently drops the off
   * hand's clause.
   */
  readonly offHand?: WeaponProfile;
}

/** Whether the held weapon satisfies a conditional effect. */
function meets(
  requires: WeaponRequirement,
  weapon: WeaponProfile | undefined,
  hasShield = false,
): boolean {
  /*
   * A SHIELD CLAUSE IS ABOUT THE CHARACTER, not the weapon in a hand, so it is
   * checked before the weapon is even looked at. Bastion has no weapon clause
   * at all -- requiring one here would have made it never apply.
   */
  if (requires.shield !== undefined && requires.shield !== hasShield) return false;
  if (requires.weaponTypes === undefined && requires.twoHanded === undefined) return true;
  if (!weapon) return false;
  if (requires.twoHanded !== undefined && (weapon.twoHanded ?? false) !== requires.twoHanded) {
    return false;
  }
  if (requires.weaponTypes && !requires.weaponTypes.includes(weapon.weaponType ?? 'unknown')) {
    return false;
  }
  return true;
}

/**
 * WHAT THE CHARACTER IS HOLDING, from the equipment.
 *
 * ----------------------------------------------------------------------------
 * ONE PLACE, because two produced a real bug. `createPlayer` built this inline
 * and the Talent panel called `talentBuild` with NO context at all, so every
 * conditional talent reported "this character is not holding one" however the
 * character was geared. Toughness was the one that made it obvious -- it read
 * "no armor from items" on a warrior in a full set -- but Two-Handed Weapon
 * Specialization, Weaponmaster and Bastion had been saying the same thing for
 * as long as they had existed.
 *
 * A panel that describes a build has to build it the same way the fight does.
 * ----------------------------------------------------------------------------
 */
export function talentContextFor(
  equipment: Equipment,
  style: CombatStyleId,
  weapons: Partial<Record<WeaponSlot, WeaponProfile>>,
): TalentBuildContext {
  return {
    mainHand: weapons.mainHand,
    offHand: weapons.offHand,
    // A shield is not a weapon and does not appear in `weapons`, so it is
    // asked about separately. Bastion needs it and swings with nothing.
    hasShield: liveEquipment(equipment, style).shield !== undefined,
    // Armor from items ALONE, which is what Toughness scales. The character's
    // armor is this plus the class base, and a percentage of the total would
    // overstate the talent.
    itemArmor: armorFromItems(equipment, style),
  };
}

export function talentBuild(
  characterClass: ClassId,
  allocation: TalentAllocation | undefined,
  context: TalentBuildContext = {},
): TalentBuild {
  if (!allocation) return EMPTY;

  const effects = EFFECTS[characterClass];
  const talents = talentsForClass(characterClass);
  if (!effects || !talents) return EMPTY;

  const stats: Partial<Record<StatName, number>> = {};
  const statModifiers: StatModifierSpec[] = [];
  const resourceMaximums: Partial<Record<ResourceType, number>> = {};
  const grantedAbilities = new Set<string>();
  const grantedAuras = new Set<string>();
  let offHandDamageBonusPct = 0;
  let offHandResourceBonusPct = 0;
  let offHandHitBonus = 0;
  const abilityCostReduction = new Map<string, number>();
  let attackAbilityCostReduction = 0;
  const abilityCooldownReductionMs = new Map<string, number>();
  const abilityModifiers = new AbilityModifiers();
  const reactions: Reaction[] = [];
  const abilityBonuses = new Map<string, Record<string, number>>();
  const abilityCastTimeReductionMs = new Map<string, number>();
  const abilityGcdReductionMs = new Map<string, number>();
  const abilitiesHoldingSwing = new Set<string>();
  const abilityExtraStances = new Map<string, string[]>();
  let damageMultiplier = 1;
  const unmodelled: UnmodelledTalent[] = [];

  const report = (talentId: string, rank: number, reason: string) => {
    const talent = talents.byId.get(talentId);
    unmodelled.push({
      talentId,
      name: talent?.name ?? talentId,
      rank,
      text: talentDescription(characterClass, talentId, rank) ?? talent?.description ?? '',
      reason,
    });
  };

  for (const [talentId, rank] of Object.entries(allocation)) {
    if (rank <= 0) continue;

    const declared = effects[talentId];
    if (!declared) {
      // A talent the class's table does not mention. Not silently ignored: the
      // table is meant to cover every talent, so a gap is a mistake worth
      // seeing rather than a talent that quietly does nothing.
      report(talentId, rank, 'No effect is declared for this talent.');
      continue;
    }

    for (const effect of declared) {
      if (effect.kind === 'unmodelled') {
        report(talentId, rank, effect.reason);
        continue;
      }

      if (effect.kind === 'grantAbility') {
        grantedAbilities.add(effect.abilityId);
        continue;
      }

      /*
       * No rank value read. A granted aura is on or off -- the aura itself
       * carries its magnitude, the way a granted ability carries its damage.
       */
      if (effect.kind === 'grantAura') {
        grantedAuras.add(effect.auraId);
        continue;
      }

      /*
       * On or off, no magnitude -- so it must be handled BEFORE the value
       * lookup below, which would otherwise report the talent as having no
       * recorded value and drop it.
       */
      if (effect.kind === 'abilityFlag') {
        const existing = abilityBonuses.get(effect.abilityId) ?? {};
        abilityBonuses.set(effect.abilityId, { ...existing, [effect.key]: 1 });
        continue;
      }

      // Takes no value: the ability either holds the swing or it does not.
      if (effect.kind === 'abilityHoldsSwing') {
        abilitiesHoldingSwing.add(effect.abilityId);
        continue;
      }

      // Also value-free: the stance is named on the effect, not looked up.
      if (effect.kind === 'abilityStance') {
        const already = abilityExtraStances.get(effect.abilityId) ?? [];
        if (!already.includes(effect.stance)) {
          abilityExtraStances.set(effect.abilityId, [...already, effect.stance]);
        }
        continue;
      }

      const value = talentNumber(
        characterClass,
        talentId,
        rank,
        'valueIndex' in effect ? (effect.valueIndex ?? 0) : 0,
      );
      if (value === undefined) {
        report(
          talentId,
          rank,
          `No value is recorded for rank ${rank}. See src/data/talents/values/${characterClass}.json.`,
        );
        continue;
      }

      switch (effect.kind) {
        /*
         * All three are PERCENTAGES on top of the off hand's existing
         * behaviour, summed across ranks the way every other percentage
         * talent is, and turned into multipliers by the caller.
         */
        case 'offHandDamage':
          offHandDamageBonusPct += value;
          break;
        case 'offHandResourceGeneration':
          offHandResourceBonusPct += value;
          break;
        case 'offHandHit':
          offHandHitBonus += value;
          break;
        /*
         * A percentage of the armor ITEMS supply, contributed flat. Not a
         * modifier on `armor`, which would scale the class base too -- the
         * whole reason Toughness could not be modelled before.
         */
        case 'itemArmorPercent': {
          const itemArmor = context.itemArmor ?? 0;
          if (itemArmor > 0) {
            stats.armor = (stats.armor ?? 0) + (itemArmor * value) / 100;
          } else {
            report(
              talentId,
              rank,
              'Scales the armor equipped items supply, and this character has ' +
                'no armor from items. Not an error -- equip something and it works.',
            );
          }
          break;
        }
        case 'stat': {
          const amount = value * (effect.scale ?? 1);
          if (effect.operation === 'flat') {
            stats[effect.stat] = (stats[effect.stat] ?? 0) + amount;
          } else {
            statModifiers.push({ stat: effect.stat, operation: effect.operation, value: amount });
          }
          break;
        }
        case 'abilityCost':
          abilityCostReduction.set(
            effect.abilityId,
            (abilityCostReduction.get(effect.abilityId) ?? 0) + value,
          );
          break;
        case 'attackAbilityCost':
          attackAbilityCostReduction += value;
          break;
        case 'abilityCooldown':
          abilityCooldownReductionMs.set(
            effect.abilityId,
            (abilityCooldownReductionMs.get(effect.abilityId) ?? 0) +
              seconds(effect.unit === 'minutes' ? value * 60 : value),
          );
          break;
        case 'resourceMax':
          resourceMaximums[effect.resource] = (resourceMaximums[effect.resource] ?? 0) + value;
          break;
        case 'abilityCrit':
          abilityModifiers.add(effect.abilityId, { critBonus: value });
          break;
        case 'abilityDamage':
          abilityModifiers.add(effect.abilityId, { damageMultiplier: 1 + value / 100 });
          break;
        case 'reaction': {
          const build = REACTIONS[characterClass]?.[effect.reactionId];
          if (!build) {
            report(talentId, rank, `No reaction is registered as "${effect.reactionId}".`);
            break;
          }
          /*
           * GEAR-GATED AT BUILD TIME. A reaction cannot see the off hand when
           * it fires, so "while a shield is equipped" is checked once, here,
           * where the equipment is in scope. Not registering it at all is the
           * accurate outcome: the proc does not exist for this character.
           */
          if (effect.requires && !meets(effect.requires, context.mainHand, context.hasShield)) {
            report(
              talentId,
              rank,
              effect.requires.shield
                ? 'Its proc needs a shield equipped, and this character has none. ' +
                    'Not an error -- equip one and it works.'
                : 'Its proc needs a particular weapon, and this character is not ' +
                    'holding one. Not an error -- equip the right weapon and it works.',
            );
            break;
          }
          reactions.push(build(value));
          break;
        }
        case 'abilityCastTime':
          abilityCastTimeReductionMs.set(
            effect.abilityId,
            (abilityCastTimeReductionMs.get(effect.abilityId) ?? 0) + seconds(value),
          );
          break;
        case 'abilityGcd':
          abilityGcdReductionMs.set(
            effect.abilityId,
            (abilityGcdReductionMs.get(effect.abilityId) ?? 0) + seconds(value),
          );
          break;
        case 'abilityBonus': {
          const existing = abilityBonuses.get(effect.abilityId) ?? {};
          existing[effect.key] = (existing[effect.key] ?? 0) + value;
          abilityBonuses.set(effect.abilityId, existing);
          break;
        }
        case 'conditionalDamage':
          if (meets(effect.requires, context.mainHand, context.hasShield)) {
            damageMultiplier *= 1 + value / 100;
          } else {
            report(
              talentId,
              rank,
              effect.requires.shield
                ? 'Applies only while a shield is equipped, and this character ' +
                    'has none. Not an error -- equip one and it works.'
                : 'Applies only with a particular weapon, and this character is not ' +
                    'holding one. Not an error -- equip the right weapon and it works.',
            );
          }
          break;
        case 'conditionalCrit':
          /*
           * MAIN HAND ONLY, deliberately, and it is an interpretation.
           *
           * `critChance` is a whole-character stat: the engine has no per-slot
           * crit, so a bonus earned by the off hand would also apply to main
           * hand swings. Awarding it on the main hand is the reading that is
           * right for the hand doing most of the damage and wrong for the
           * other one, which beats being wrong for both.
           *
           * The Gear and Talent panels say which weapon it is reading.
           */
          if (meets(effect.requires, context.mainHand, context.hasShield)) {
            abilityModifiers.add(ALL_ABILITIES, { critBonus: value });
          } else {
            report(
              talentId,
              rank,
              'Applies only with a particular weapon, and this character is not ' +
                'holding one. Not an error -- equip the right weapon and it works.',
            );
          }
          break;
        case 'critDamageBonus':
          /*
           * The talent raises the BONUS half of the multiplier, not the whole
           * thing. A melee crit multiplies by 2, so the bonus is 1.0 and "+10%"
           * adds 0.1, giving 2.1. INTERPRETATION: the melee multiplier is used,
           * because every Warrior ability is melee. A class with spell crits
           * would need this per school.
           */
          abilityModifiers.add(ALL_ABILITIES, {
            critMultiplierBonus:
              (COMBAT_CONSTANTS.meleeCritMultiplier - 1) * (value / 100),
          });
          break;
      }
    }
  }

  return {
    stats,
    statModifiers,
    resourceMaximums,
    grantedAbilities,
    grantedAuras,
    offHandDamageMultiplier: 1 + offHandDamageBonusPct / 100,
    offHandResourceMultiplier: 1 + offHandResourceBonusPct / 100,
    offHandHitBonus,
    abilityCostReduction,
    attackAbilityCostReduction,
    abilityCooldownReductionMs,
    abilityModifiers,
    reactions,
    damageMultiplier,
    abilityBonuses,
    abilityCastTimeReductionMs,
    abilityGcdReductionMs,
    abilitiesHoldingSwing,
    abilityExtraStances,
    unmodelled,
    illegal: [],
  };
}
