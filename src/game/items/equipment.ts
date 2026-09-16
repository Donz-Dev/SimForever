import type { PartialStats, WeaponProfile, WeaponSlot } from '../../engine';
import type { CombatStyleId } from '../character';
import { getCombatStyle } from '../character';
import { attackPowerCoefficientFor } from '../combat/weaponDamage';
import { RAGE_FROM_AUTO_ATTACK } from '../combat/resourceRules';
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
 * The equipped set with the weapon slots this style cannot use removed.
 *
 * Armour and jewellery are untouched; only the hands are in question.
 */
export function liveEquipment(equipment: Equipment, style: CombatStyleId): Equipment {
  const definition = getCombatStyle(style);
  const next: Record<string, Equipment[EquipmentSlot]> = { ...equipment };

  const usesTwoHand = definition?.mainHand === 'two-hand';
  const usesOffHandWeapon = definition?.offHand === 'weapon';
  const usesRanged = definition?.rangedSlot === 'required';

  if (usesTwoHand) delete next.mainHand;
  else delete next.twoHand;

  if (!usesOffHandWeapon) delete next.offHand;
  if (!usesRanged) delete next.ranged;

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

  for (const [slotName, equipped] of Object.entries(live)) {
    if (!equipped) continue;
    const slot = slotName as EquipmentSlot;
    const weaponSlot = weaponSlotFor(slot);
    if (!weaponSlot) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (!item?.weapon) continue;

    weapons[weaponSlot] = toWeaponProfile(item, weaponSlot, options.offHandDamageMultiplier);
  }

  return weapons;
}

/** Base weapon skill: five times level, which a level 60 has maxed at 300. */
export const BASE_WEAPON_SKILL = 300;

function toWeaponProfile(
  item: Item,
  slot: WeaponSlot,
  offHandDamageMultiplier?: number,
): WeaponProfile {
  const weapon = item.weapon;
  if (!weapon) throw new Error(`${item.name} is not a weapon`);

  const swingTimerMs = Math.round(weapon.speed * 1000);
  const midpoint = (weapon.minDamage + weapon.maxDamage) / 2;
  // Half the spread, as a fraction of the midpoint. 100-187 around 143.5 is
  // +/-30.3%, which the engine rolls uniformly to reproduce the same range.
  const variance = midpoint > 0 ? (weapon.maxDamage - midpoint) / midpoint : 0;

  return {
    name: item.name,
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
    // Only melee weapons build rage. A bow never does.
    ...(slot === 'ranged' ? {} : { generates: RAGE_FROM_AUTO_ATTACK }),
  };
}

/** Everything the equipped set does that the simulation does not model. */
export function unmodelledEffects(
  equipment: Equipment,
  style: CombatStyleId,
): readonly (UnmodelledEffect & { readonly itemName: string })[] {
  const live = liveEquipment(equipment, style);
  const out: (UnmodelledEffect & { itemName: string })[] = [];

  for (const equipped of Object.values(live)) {
    if (!equipped) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (item) {
      for (const effect of item.unmodelled) out.push({ ...effect, itemName: item.name });
    }

    if (equipped.enchantId !== undefined) {
      const enchant = ENCHANTS_BY_ID.get(equipped.enchantId);
      if (enchant) {
        for (const effect of enchant.unmodelled) out.push({ ...effect, itemName: enchant.name });
      }
    }
  }

  return out;
}
