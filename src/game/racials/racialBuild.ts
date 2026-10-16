import type {
  AttackTableKind,
  CastReaction,
  PartialStats,
  Reaction,
  ResourceType,
  StatModifierSpec,
  WeaponType,
} from '../../engine';
import { AttackTableModifiers } from '../../engine';
import { COMBAT_CONSTANTS } from '../combat/attackChances';
import type { ClassId, CombatStyleId, RaceId } from '../character';
import type { Equipment } from '../items/Item';
import { weaponTypeFor } from '../items/equipment';
import { ITEMS_BY_ID } from '../items/itemData';
import type { RacialBuild, RacialRequirement, RacialTrait } from './Racial';
import { RACIALS } from './racialEffects';
import { touchOfTheGrave } from './reactions';

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

/**
 * The five tables a character's OWN attacks resolve on.
 *
 * `melee-received` is deliberately absent: it is the attacks-received table,
 * so anything registered against it describes what happens TO the character.
 * Written out rather than derived from `AttackTableKind`, so a table added to
 * that union is a compile question rather than a silent sixth entry here.
 */
const OFFENSIVE_TABLES: readonly AttackTableKind[] = [
  'melee-auto',
  'melee-special',
  'ranged-auto',
  'ranged-special',
  'spell',
];

/**
 * The BONUS half of a crit multiplier for one attack table.
 *
 * A SECOND COPY OF `talentBuild`'S OWN PRIVATE HELPER, and the duplication is
 * the lesser evil: that one is not exported, and exporting it would make a
 * racial depend on the talent layer's internals for no reason beyond six
 * lines. What matters is that BOTH read `COMBAT_CONSTANTS` -- the shared
 * ruleset numbers in `game/combat` -- rather than writing 1.0 and 0.5 out, so
 * the two cannot drift: a ruleset that separates ranged crits from melee
 * changes the constant and both follow.
 */
function critBonusHalfFor(table: AttackTableKind): number {
  if (table === 'spell') return COMBAT_CONSTANTS.spellCritMultiplier - 1;
  if (table === 'ranged-auto' || table === 'ranged-special') {
    return COMBAT_CONSTANTS.rangedCritMultiplier - 1;
  }
  return COMBAT_CONSTANTS.meleeCritMultiplier - 1;
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
  const attackTableModifiers = new AttackTableModifiers();

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
        case 'critDamageBonus':
          /*
           * THE BONUS HALF, PER TABLE, WHICH IS A DIFFERENT NUMBER ON EACH.
           *
           * A melee or ranged crit multiplies by 2 and a spell crit by 1.5, so
           * "2% increased critical damage" adds 0.02 on the physical tables and
           * 0.01 on the spell one. Both races carrying this can be casters -- a
           * Dwarf Priest, a Tauren Moonkin -- so reading the melee figure for
           * everything would double what every spell they cast collects.
           *
           * `melee-received` IS EXCLUDED, and it is the one table that would be
           * actively wrong rather than merely unused: that is the
           * attacks-RECEIVED table, so a crit damage bonus registered there
           * would raise the damage the BOSS crits the character for. A Tauren
           * Warrior tanking would have paid its own racial.
           */
          for (const table of OFFENSIVE_TABLES) {
            attackTableModifiers.add(table, {
              critMultiplierBonus: critBonusHalfFor(table) * (effect.percent / 100),
            });
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
          {
            /*
             * THREE REACTIONS AND A CAST REACTION, all sharing one internal
             * cooldown and one "already rolled for this action" clock -- which
             * is why they are built together and must not be built separately.
             */
            const built = touchOfTheGrave(characterClass);
            reactions.push(...built.reactions);
            castReactions.push(...built.casts);
          }
          break;
        case 'unmodelled':
          // Declared so the census can count it. Nothing to apply.
          break;
      }
    }
  }

  /*
   * EUREKA! USED TO NEED A REACTION PAIR HERE AND NO LONGER DOES.
   *
   * It was "your next 3 damaging abilities", and the three charges were spent
   * by a `dealt` marker plus a `final` cast reaction -- derived from the
   * granted ability rather than declared on the trait, so the two could not
   * disagree. The racial patch made it an 8 second buff with no charges, so
   * there is nothing to spend and `eurekaReactions` is gone. See `EUREKA`.
   */

  return {
    stats: stats as PartialStats,
    statModifiers,
    healthMultiplier,
    resourceMaxMultipliers,
    grantedAbilities,
    reactions,
    castReactions,
    attackTableModifiers,
    openingAuras: [],
  };
}

/** The traits a race has, for the UI and the census. */
export function traitsFor(race: RaceId): readonly RacialTrait[] {
  return RACIALS[race].traits;
}
