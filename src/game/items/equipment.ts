import type { PartialStats, WeaponProfile, WeaponSlot, WeaponType } from '../../engine';
import type { CombatStyleId } from '../character';
import { getCombatStyle } from '../character';
import { attackPowerCoefficientFor } from '../combat/weaponDamage';
import { rageFromSwing } from '../combat/resourceRules';
import { OFF_HAND_DAMAGE_MULTIPLIER } from '../actors/weapons';
import type { Equipment, EquipmentSlot, Item, UnmodelledEffect } from './Item';
import { weaponSlotFor } from './Item';
import { ENCHANTS_BY_ID, ITEMS_BY_ID } from './itemData';

/**
 * Turning equipment into what the simulation needs.
 *
 * Two things come out of a set of equipped items: the stats they add, and the
 * weapons that swing. Everything else an item does is unmodelled and is
 * reported rather than applied.
 */

/** Every stat the equipped items and their enchants add together. */
export function statsFromEquipment(equipment: Equipment): PartialStats {
  const total: Record<string, number> = {};

  const add = (stats: PartialStats) => {
    for (const [name, value] of Object.entries(stats)) {
      if (typeof value !== 'number') continue;
      total[name] = (total[name] ?? 0) + value;
    }
  };

  for (const [slot, equipped] of Object.entries(equipment)) {
    if (!equipped) continue;

    // A two-hander and a one-hander cannot both be swinging. The style decides
    // which slot is live, and `weaponsForEquipment` honours that; stats follow
    // the same rule so a character cannot wear both and bank both sets.
    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (item) add(item.stats);

    if (equipped.enchantId !== undefined) {
      const enchant = ENCHANTS_BY_ID.get(equipped.enchantId);
      if (enchant) add(enchant.stats);
    }

    void slot;
  }

  return total as PartialStats;
}

/**
 * The same, but honouring which weapon slots a style actually uses.
 *
 * A dual-wielder wearing a two-hander should not get the two-hander's strength,
 * so the weapon slots the style does not use contribute nothing.
 */
export function statsForStyle(equipment: Equipment, style: CombatStyleId): PartialStats {
  const live = liveEquipment(equipment, style);
  return statsFromEquipment(live);
}

/**
 * Armor contributed BY EQUIPPED ITEMS, on its own.
 *
 * Toughness raises "your Armor value from items", and a character's armor is
 * items plus everything else -- the class base, and in time buffs and consumables
 * that are not worn. One combined number cannot express the talent: a
 * percentage of it would scale the base too and overstate what Toughness does.
 *
 * Derived from the same `liveEquipment` the stats are, so the two can never
 * disagree about which slots this style actually fills. Reading the equipment
 * map directly would count a two-hander's armor on a shield build.
 */
/**
 * Resistance by school across the equipped set, FOR DISPLAY ONLY.
 *
 * Nothing in the engine reads this. There is no resistance stat and Forever
 * states no formula for magic mitigation, so a resistance cannot change a
 * fight -- the ruleset owner asked for a total to look at, and that is all
 * this is. The Gear panel still lists every one under "Equipped but not
 * simulated", which is what stops a number on screen from implying a
 * mechanic behind it.
 *
 * Off the same `liveEquipment` as everything else, so a two-hander's
 * resistance is not counted on a shield build.
 */
export function resistancesFromItems(
  equipment: Equipment,
  style: CombatStyleId,
): Readonly<Record<string, number>> {
  const total: Record<string, number> = {};
  for (const equipped of Object.values(liveEquipment(equipment, style))) {
    if (!equipped) continue;
    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (!item) continue;
    for (const [school, value] of Object.entries(item.resistances)) {
      total[school] = (total[school] ?? 0) + value;
    }
  }
  return total;
}

export function armorFromItems(equipment: Equipment, style: CombatStyleId): number {
  return statsFromEquipment(liveEquipment(equipment, style)).armor ?? 0;
}

/**
 * The equipped set with the slots this style cannot physically fill removed.
 *
 * Only genuine conflicts are dropped, and there are two:
 *
 *   - A two-hander and a one-hander both want the main hand, so a style takes
 *     one or the other and the loser contributes nothing.
 *   - A style with no off-hand weapon cannot hold one.
 *
 * THE RANGED SLOT IS NOT A CONFLICT. A bow sits alongside a sword; it simply
 * does not swing while the character is meleeing. Stripping it here discarded
 * Striker's Mark's +22 attack power and +1% hit from every melee warrior, which
 * is the kind of missing stat that looks like nothing at all. Whether the bow
 * SWINGS is decided separately, in `weaponsForEquipment`, off the style's own
 * ranged rule.
 */
export function liveEquipment(equipment: Equipment, style: CombatStyleId): Equipment {
  const definition = getCombatStyle(style);
  const next: Record<string, Equipment[EquipmentSlot]> = { ...equipment };

  const usesTwoHand = definition?.mainHand === 'two-hand';
  const usesOffHandWeapon = definition?.offHand === 'weapon';
  const usesShield = definition?.offHand === 'shield';

  /*
   * A STAT-STICK MAIN HAND IS NOT A CHOICE BETWEEN THE TWO, it is "whatever
   * is held, held".
   *
   * `mainHand: 'stat-stick'` says in as many words that melee weapons may be
   * equipped and never swing, and both the Ranged and Caster styles use it --
   * but this read "not two-hand" as "one-hand" and deleted the two-hander, so
   * a Hunter holding Dreadforge Retaliator as a stat stick lost its 12
   * agility and 30 attack power, and a caster holding a STAFF would lose the
   * lot. That is the same mistake the ranged-slot comment above records, in
   * the other direction: stripping a slot the style can actually fill.
   *
   * A character still cannot hold a one-hander and a two-hander at once, so
   * when both are equipped the two-hander yields -- the same loser the
   * swinging styles pick.
   */
  if (usesTwoHand) delete next.mainHand;
  else if (definition?.mainHand === 'one-hand' || next.mainHand) delete next.twoHand;

  // The off hand holds a weapon or a shield, never both and never either
  // unless the style says so.
  if (!usesOffHandWeapon) delete next.offHand;
  if (!usesShield) delete next.shield;

  return next as Equipment;
}

/**
 * Weapon profiles from the equipped weapons, for a style.
 *
 * The damage a swing rolls comes from the item's own range rather than from a
 * base value and a variance fraction: the engine rolls `baseDamage * roll`
 * within `damageVariance`, so the midpoint and the half-spread reproduce the
 * item's stated range exactly.
 *
 * The attack power coefficient is derived from the weapon's speed by Forever's
 * universal formula, exactly as the placeholder weapons were.
 */
export function weaponsForEquipment(
  equipment: Equipment,
  style: CombatStyleId,
  options: { readonly offHandDamageMultiplier?: number } = {},
): Partial<Record<WeaponSlot, WeaponProfile>> {
  const live = liveEquipment(equipment, style);
  const weapons: Partial<Record<WeaponSlot, WeaponProfile>> = {};

  // A bow contributes its stats whatever the style, but only SWINGS when the
  // style says the ranged slot is in use.
  const definition = getCombatStyle(style);
  const rangedSwings = definition?.rangedSlot === 'required';

  /*
   * A STAT STICK IS HELD AND NEVER SWUNG, which is the whole meaning of the
   * rule and has to be enforced HERE rather than by not equipping it.
   *
   * `createPlayer` merges these over the style's own weapons -- for a Cat that
   * is `{ mainHand: CAT_PAW }` -- so anything returned for a stat-stick hand
   * REPLACES the form's natural weapon. A Druid in Cat form was swinging an
   * Obsidian Edged Blade: base 234 every 3.6 seconds instead of a paw's 50
   * every 1.0, which read as a 62% damage increase and as a working feature.
   *
   * The stats are unaffected and still apply -- `statsForStyle` reads
   * `liveEquipment`, not this -- so a stat stick goes on doing exactly what
   * its name says.
   */
  const handIsStatStick = {
    mainHand: definition?.mainHand === 'stat-stick',
    offHand: definition?.offHand === 'stat-stick',
  };

  for (const [slotName, equipped] of Object.entries(live)) {
    if (!equipped) continue;
    const slot = slotName as EquipmentSlot;
    if (slot === 'ranged' && !rangedSwings) continue;

    const weaponSlot = weaponSlotFor(slot);
    if (!weaponSlot) continue;
    if (weaponSlot !== 'ranged' && handIsStatStick[weaponSlot]) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (!item?.weapon) continue;

    weapons[weaponSlot] = toWeaponProfile(item, weaponSlot, options.offHandDamageMultiplier);
  }

  return weapons;
}

/** Base weapon skill: five times level, which a level 60 has maxed at 300. */
export const BASE_WEAPON_SKILL = 300;

/**
 * The item data's `subclass` string, as the engine's weapon type.
 *
 * Wowhead's wording, lowercased. An unrecognised subclass becomes `unknown`
 * rather than throwing: a weapon whose type nothing keys off still swings
 * perfectly well, and failing to load a whole item over a naming change would
 * be worse than the talent that cares about it not applying.
 */
const WEAPON_TYPES: Readonly<Record<string, WeaponType>> = {
  sword: 'sword',
  axe: 'axe',
  mace: 'mace',
  polearm: 'polearm',
  staff: 'staff',
  dagger: 'dagger',
  'fist weapon': 'fist',
  bow: 'bow',
  gun: 'gun',
  crossbow: 'crossbow',
  thrown: 'thrown',
  wand: 'wand',
};

export function weaponTypeFor(subclass: string | undefined): WeaponType {
  return WEAPON_TYPES[(subclass ?? '').toLowerCase()] ?? 'unknown';
}

function toWeaponProfile(
  item: Item,
  slot: WeaponSlot,
  offHandDamageMultiplier?: number,
): WeaponProfile {
  const weapon = item.weapon;
  if (!weapon) throw new Error(`${item.name} is not a weapon`);

  const swingTimerMs = Math.round(weapon.speed * 1000);
  // A two-hander is the item that can go in the two-hand slot.
  const twoHanded = item.slots.includes('twoHand');
  const midpoint = (weapon.minDamage + weapon.maxDamage) / 2;
  // Half the spread, as a fraction of the midpoint. 100-187 around 143.5 is
  // +/-30.3%, which the engine rolls uniformly to reproduce the same range.
  const variance = midpoint > 0 ? (weapon.maxDamage - midpoint) / midpoint : 0;

  return {
    name: item.name,
    weaponType: weaponTypeFor(weapon.subclass),
    twoHanded,
    swingTimerMs,
    baseDamage: midpoint,
    damageVariance: variance,
    powerCoefficient: attackPowerCoefficientFor(swingTimerMs),
    school: 'physical',
    skill: BASE_WEAPON_SKILL + weapon.bonusSkill,
    // The dual-wield penalty DEFAULTS rather than only applying when a caller
    // passes one. Leaving it off unless overridden silently gave an equipped
    // off-hand full damage, which the placeholder off-hand never did.
    ...(slot === 'offHand'
      ? { damageMultiplier: offHandDamageMultiplier ?? OFF_HAND_DAMAGE_MULTIPLIER }
      : {}),
    /*
     * Only melee weapons build rage. A bow never does.
     *
     * `weapon.speed` is the ITEM's base speed, which is exactly the S in
     * Forever's `rage = R x S` -- not `swingTimerMs`, which is the same number
     * until haste shortens it. Handing over the hasted timer would make haste
     * generate rage, which this formula specifically stopped doing.
     */
    ...(slot === 'ranged' ? {} : { generates: rageFromSwing(weapon.speed, twoHanded) }),
  };
}

/** Everything the equipped set does that the simulation does not model. */
export function unmodelledEffects(
  equipment: Equipment,
  style: CombatStyleId,
): readonly (UnmodelledEffect & { readonly itemName: string })[] {
  const live = liveEquipment(equipment, style);
  const out: (UnmodelledEffect & { itemName: string })[] = [];
  // Crusader on both hands is two enchants but one gap; listing it twice reads
  // as two different things being missing.
  const seen = new Set<string>();
  const push = (effect: UnmodelledEffect, itemName: string) => {
    const key = `${itemName}::${effect.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...effect, itemName });
  };

  for (const equipped of Object.values(live)) {
    if (!equipped) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (item) {
      for (const effect of item.unmodelled) push(effect, item.name);
    }

    if (equipped.enchantId !== undefined) {
      const enchant = ENCHANTS_BY_ID.get(equipped.enchantId);
      if (enchant) {
        for (const effect of enchant.unmodelled) push(effect, enchant.name);
      }
    }
  }

  return out;
}
