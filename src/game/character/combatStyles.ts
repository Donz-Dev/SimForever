import type { AutoAttackMode } from '../../engine';
import type { ClassId, CombatStyleId } from './ids';

/**
 * How a combat style equips a slot.
 *
 * `stat-stick` means an item can go there but contributes nothing but its
 * stats: a Hunter's melee weapons while shooting, or a Druid's weapon while in
 * bear form.
 */
export type MainHandRule = 'two-hand' | 'one-hand' | 'stat-stick' | 'none';
export type OffHandRule = 'weapon' | 'shield' | 'stat-stick' | 'none';
export type RangedRule = 'required' | 'stat-stick' | 'none';

/**
 * A way of fighting: which weapons are used, what auto-attacks, and which
 * action priority list applies.
 *
 * Combat style and Druid form are the same concept. A Druid's styles are its
 * forms, and its stat conversions key off them; every other class has styles
 * that are weapon configurations instead. Keeping them as one selector avoids
 * two overlapping ideas that would have to agree with each other.
 */
export interface CombatStyleDefinition {
  readonly id: CombatStyleId;
  readonly name: string;
  readonly autoAttack: AutoAttackMode;
  /**
   * Where auto-attack damage comes from. `natural` means the style has its own
   * damage (bear and cat paws) and ignores whatever is equipped.
   */
  readonly damageSource: 'equipped' | 'natural';
  readonly mainHand: MainHandRule;
  readonly offHand: OffHandRule;
  readonly rangedSlot: RangedRule;
  /** One line for the UI, explaining what the style does. */
  readonly summary: string;
}

const STYLE_LIST: readonly CombatStyleDefinition[] = [
  {
    id: 'two_hander',
    name: 'Two-Hander',
    autoAttack: 'main-hand',
    damageSource: 'equipped',
    mainHand: 'two-hand',
    offHand: 'none',
    rangedSlot: 'none',
    summary: 'Auto-attacks with the main hand only. No off-hand slot.',
  },
  {
    id: 'one_hand_shield',
    name: '1H & Shield',
    autoAttack: 'main-hand',
    damageSource: 'equipped',
    mainHand: 'one-hand',
    offHand: 'shield',
    rangedSlot: 'none',
    summary: 'Auto-attacks with the main hand only. A shield goes off-hand.',
  },
  {
    id: 'dual_wield',
    name: 'Dual-Wield',
    autoAttack: 'dual-wield',
    damageSource: 'equipped',
    mainHand: 'one-hand',
    offHand: 'weapon',
    rangedSlot: 'none',
    summary: 'Auto-attacks with both hands. Needs two weapons.',
  },
  {
    id: 'ranged',
    name: 'Ranged',
    autoAttack: 'ranged',
    damageSource: 'equipped',
    // Melee weapons may be equipped but never swing.
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'required',
    summary: 'Ranged auto-attacks. Melee weapons are stat sticks only.',
  },
  {
    id: 'caster',
    name: 'Caster',
    autoAttack: 'none',
    damageSource: 'equipped',
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'none',
    summary: 'No auto-attacks at all.',
  },
  {
    id: 'moonkin',
    name: 'Moonkin',
    autoAttack: 'none',
    damageSource: 'equipped',
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'none',
    summary: 'No auto-attacks at all.',
  },
  {
    id: 'tree',
    name: 'Tree of Life',
    autoAttack: 'none',
    damageSource: 'equipped',
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'none',
    summary: 'No auto-attacks at all.',
  },
  {
    id: 'bear',
    name: 'Bear',
    autoAttack: 'main-hand',
    damageSource: 'natural',
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'none',
    summary: 'Auto-attacks with bear paws. Equipped weapons are stat sticks.',
  },
  {
    id: 'cat',
    name: 'Cat',
    autoAttack: 'main-hand',
    damageSource: 'natural',
    mainHand: 'stat-stick',
    offHand: 'stat-stick',
    rangedSlot: 'none',
    summary: 'Auto-attacks with cat paws. Equipped weapons are stat sticks.',
  },
];

const STYLE_BY_ID = new Map<CombatStyleId, CombatStyleDefinition>(
  STYLE_LIST.map((style) => [style.id, style]),
);

export const COMBAT_STYLES: readonly CombatStyleDefinition[] = STYLE_LIST;

/**
 * The styles each class can use, in display order.
 *
 * The FIRST entry is the default. That ordering is load-bearing, so the tests
 * pin both the order and the default explicitly.
 */
const CLASS_STYLES: Record<ClassId, readonly CombatStyleId[]> = {
  // Defaults, per the source: Warrior dual-wields, Paladin uses 1H & shield,
  // Shaman casts, Hunter shoots, Druid is a cat.
  warrior: ['dual_wield', 'two_hander', 'one_hand_shield'],
  rogue: ['dual_wield'],
  shaman: ['caster', 'two_hander'],
  paladin: ['one_hand_shield', 'two_hander', 'caster'],
  hunter: ['ranged', 'two_hander', 'dual_wield'],
  mage: ['caster'],
  warlock: ['caster'],
  priest: ['caster'],
  druid: ['cat', 'caster', 'bear', 'tree', 'moonkin'],
};

export function getCombatStyle(id: CombatStyleId): CombatStyleDefinition | undefined {
  return STYLE_BY_ID.get(id);
}

/** Styles available to a class. The first is the default. */
export function combatStylesFor(characterClass: ClassId): readonly CombatStyleDefinition[] {
  return CLASS_STYLES[characterClass]
    .map((id) => STYLE_BY_ID.get(id))
    .filter((style): style is CombatStyleDefinition => style !== undefined);
}

/** The style a class uses when nothing else is chosen. */
export function defaultCombatStyleFor(characterClass: ClassId): CombatStyleId {
  return CLASS_STYLES[characterClass][0];
}

/** Whether a class can use a style. */
export function classHasCombatStyle(
  characterClass: ClassId,
  style: CombatStyleId,
): boolean {
  return CLASS_STYLES[characterClass].includes(style);
}

/**
 * The style to actually use: the requested one if the class has it, otherwise
 * the class default.
 *
 * Every lookup goes through here, so a profile carrying a stale style (a
 * Warrior that used to be a Druid in bear form) resolves to something legal
 * rather than failing.
 */
export function resolveCombatStyle(
  characterClass: ClassId,
  requested: CombatStyleId | undefined,
): CombatStyleId {
  if (requested !== undefined && classHasCombatStyle(characterClass, requested)) {
    return requested;
  }
  return defaultCombatStyleFor(characterClass);
}
