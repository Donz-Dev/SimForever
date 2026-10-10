import type {
  CastReaction,
  PartialStats,
  Reaction,
  ResourceType,
  StatModifierSpec,
  WeaponType,
} from '../../engine';
import type { ClassId, CombatStyleId, RaceId } from '../character';
import type { Equipment } from '../items/Item';
import { weaponTypeFor } from '../items/equipment';
import { ITEMS_BY_ID } from '../items/itemData';
import type { RacialBuild, RacialRequirement, RacialTrait } from './Racial';
import { RACIALS } from './racialEffects';
import { eurekaReactions, touchOfTheGrave } from './reactions';

/** What a racial can ask about the character, resolved before the pull. */
export interface RacialBuildContext {
  readonly characterClass: ClassId;
  /**
   * What is EQUIPPED, already narrowed to the slots this style actually holds.
   *
   * `liveEquipment` rather than the raw profile equipment, so a two-hander a
   * one-handed style cannot hold is already gone -- and so a RANGED Hunter's
   * stat-stick axe is still here, which is the whole point. See
   * `RacialRequirement`.
   */
  readonly equipment: Equipment;
  readonly style: CombatStyleId;
}

/** The weapon types held, in any hand. */
function heldWeaponTypes(equipment: Equipment): ReadonlySet<WeaponType> {
  const held = new Set<WeaponType>();
  /*
   * EVERY HAND, INCLUDING THE TWO-HAND SLOT, which is three questions and one
   * answer: "a sword or two-handed sword" is one `WeaponType` in this engine,
   * because `twoHanded` is a separate field on the profile. So a two-handed
   * sword in `twoHand` and a one-hander in `mainHand` both answer `sword`.
   *
   * THE RANGED SLOT IS NOT ASKED. No racial names a bow, a gun or a crossbow,
   * and including it would make a Hunter's Rhok'delar answer a question nobody
   * posed -- harmless today and wrong the day Forever adds a Bow
   * Specialization, in the direction of a bonus nobody granted.
   */
  for (const slot of ['mainHand', 'offHand', 'twoHand'] as const) {
    const equipped = equipment[slot];
    if (!equipped) continue;
    const weapon = ITEMS_BY_ID.get(equipped.itemId)?.weapon;
    if (weapon) held.add(weaponTypeFor(weapon.subclass));
  }
  return held;
}

/** Whether the character satisfies a trait's condition. */
function meets(
  requires: RacialRequirement | undefined,
  characterClass: ClassId,
  held: ReadonlySet<WeaponType>,
): boolean {
  if (!requires) return true;
  if (requires.classes && !requires.classes.includes(characterClass)) return false;
  if (requires.weaponTypes && !requires.weaponTypes.some((type) => held.has(type))) return false;
  return true;
}

/**
 * Turn a race into plain data, once, before the fight.
 *
 * ============================================================================
 * THE SAME SHAPE AS `talentBuild`, AND FOR THE SAME REASON: racials are settled
 * before the pull and never change during it, so they resolve here into a value
 * and nothing below `createPlayer` knows that races exist.
 *
 * IT IS DELIBERATELY NOT PART OF `talentBuild`. A `TalentBuild` carries
 * nineteen fields because a talent can reach nineteen places; a racial reaches
 * seven, and three of those -- a health multiplier, a resource cap multiplier
 * and a weapon-conditional stat read off the EQUIPMENT rather than the weapon
 * profile -- are things no talent has ever needed. Merging them would have
 * meant widening `TalentBuild` and `meets` for a caller with different rules,
 * and the first thing to go wrong would have been `valueIndex`: every talent
 * effect kind carries one and a racial has no values row to index into.
 * ============================================================================
 */
export function racialBuild(race: RaceId, context: RacialBuildContext): RacialBuild {
  const held = heldWeaponTypes(context.equipment);
  const { characterClass } = context;

  /*
   * ACCUMULATED AS A MUTABLE PARTIAL rather than through `addStats`, which
   * takes a FULL `Stats` as its first argument and would mean materialising a
   * zeroed block here only for `createPlayer` to add it to another one.
   */
  const stats: Record<string, number> = {};
  const statModifiers: StatModifierSpec[] = [];
  let healthMultiplier = 1;
  const resourceMaxMultipliers: Partial<Record<ResourceType, number>> = {};
  const grantedAbilities = new Set<string>();
  const reactions: Reaction[] = [];
  const castReactions: CastReaction[] = [];

  for (const trait of RACIALS[race].traits) {
    for (const effect of trait.effects) {
      switch (effect.kind) {
        case 'stat':
          if (meets(effect.requires, characterClass, held)) {
            for (const [name, value] of Object.entries(effect.stats)) {
              if (value !== undefined) stats[name] = (stats[name] ?? 0) + value;
            }
          }
          break;
        case 'statPercent':
          if (meets(effect.requires, characterClass, held)) {
            statModifiers.push(...effect.modifiers);
          }
          break;
        case 'healthPercent':
          healthMultiplier *= 1 + effect.percent;
          break;
        case 'resourceMaxPercent':
          for (const resource of effect.resources) {
            resourceMaxMultipliers[resource] =
              (resourceMaxMultipliers[resource] ?? 1) * (1 + effect.percent);
          }
          break;
        case 'grantAbility':
          grantedAbilities.add(effect.abilityId);
          break;
        case 'reaction':
          /*
           * BUILT HERE, PER CHARACTER, which is what makes Touch of the Grave's
           * internal cooldown and Eureka!'s per-cast latch safe to keep in a
           * closure. One shared closure is what silently stopped Windfury
           * proccing after the first iteration of a batch.
           */
          reactions.push(...touchOfTheGrave(characterClass));
          break;
        case 'unmodelled':
          // Declared so the census can count it. Nothing to apply.
          break;
      }
    }
  }

  /*
   * EUREKA!'S REACTION PAIR FOLLOWS ITS ABILITY RATHER THAN BEING DECLARED.
   *
   * The two reactions exist only to spend the aura's charges, so they belong to
   * the ability and not to the trait -- a `reaction` effect beside the
   * `grantAbility` would be two declarations that must agree, and the one that
   * drifted would leave Eureka! spending no charges at all: three permanent
   * charges, +10% damage all fight, and a buff-uptime row saying it was up.
   *
   * Derived from the granted ability so the two cannot disagree.
   */
  if (grantedAbilities.has('eureka')) {
    const { marker, spender } = eurekaReactions();
    reactions.push(marker);
    castReactions.push(spender);
  }

  return {
    stats: stats as PartialStats,
    statModifiers,
    healthMultiplier,
    resourceMaxMultipliers,
    grantedAbilities,
    reactions,
    castReactions,
    openingAuras: [],
  };
}

/** The traits a race has, for the UI and the census. */
export function traitsFor(race: RaceId): readonly RacialTrait[] {
  return RACIALS[race].traits;
}
