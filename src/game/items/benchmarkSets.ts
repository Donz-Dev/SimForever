import type { Equipment, EquipmentSlot } from './Item';
import {
  ARMOUR_SLOTS,
  BENCHMARK_SETS,
  BUDGET_EXPONENT,
  CASTER_DPS_SHARE,
  COST,
  DPS_TO_BUDGET,
  LINE,
  RATING_SLOTS,
  SHARES,
  SLOT_MULTIPLIER,
  WEAPON_DPS,
  baseArmour,
  qualityBase,
  spreadRating,
  statsFor,
  type ArmourClass,
  type BenchStat,
  type BenchmarkSetId,
  type GeneratedItem,
} from './benchmarkGear';

/**
 * The 25 benchmark templates, from the ruleset owner's spreadsheet.
 *
 * ==============================================================================
 * HIT AND EXPERTISE ARE ABSOLUTE TOTALS FOR THE WHOLE SET, not per item, and
 * **they still cost budget** -- the owner's instruction. So a Rogue needing 120
 * hit spends 120 budget points on it before anything else is bought, which is
 * why a Rogue benchmark carries visibly less of everything else than a
 * Warrior's at the same item level. That is the ruleset, not a bug in the set.
 *
 * `preferred` IS IN DESCENDING ORDER OF IMPORTANCE and the allocator reads it
 * that way: the first stat takes the largest share of each slot's budget.
 * ==============================================================================
 */
export interface BenchmarkTemplate {
  readonly presetId: string;
  readonly label: string;
  /**
   * What the preset calls the CHARACTER, where that differs from the label.
   *
   * Four of the 25 do: the Mage presets are labelled "Frostfire", "Arcane" and
   * "Fire" and name their characters "Frostfire Mage" and so on. The UI joins
   * on the character's name because `game` cannot see `profiles`, so the
   * difference has to be written down rather than assumed away.
   */
  readonly characterName?: string;
  readonly hit: number;
  readonly expertise: number;
  readonly preferred: readonly BenchStat[];
  readonly armour: ArmourClass;
  readonly weapons: WeaponPlan;
}

/** What the character holds. `caster` trades damage for stats. */
export interface WeaponPlan {
  readonly kind: 'twoHand' | 'dualWield' | 'oneHandShield';
  readonly subclass: string;
  readonly offSubclass?: string;
  readonly caster?: boolean;
  /** A bow, for the four Hunter builds. */
  readonly ranged?: boolean;
  /** Shockadin's "Fast 2H Mace (2.0 attack speed)". */
  readonly speed?: number;
}

const MELEE: readonly BenchStat[] = ['Crit', 'Strength', 'Stamina', 'Agility', 'Attack Power'];
const ROGUE: readonly BenchStat[] = ['Crit', 'Agility', 'Attack Power', 'Strength', 'Stamina'];
const CASTER: readonly BenchStat[] = ['Crit', 'Spell Power', 'Intellect', 'Stamina', 'Spirit'];
const HUNTER: readonly BenchStat[] = ['Crit', 'Agility', 'Intellect', 'Attack Power', 'Stamina'];
const TANK: readonly BenchStat[] = ['Stamina', 'Strength', 'Agility', 'Defense', 'Parry', 'Block'];

export const BENCHMARK_TEMPLATES: readonly BenchmarkTemplate[] = [
  { presetId: 'two_hand_arms', label: '2H Arms', hit: 80, expertise: 10, preferred: MELEE, armour: 'Plate', weapons: { kind: 'twoHand', subclass: 'Axe' } },
  { presetId: 'dw_fury', label: 'DW Fury', hit: 80, expertise: 10, preferred: MELEE, armour: 'Plate', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe' } },
  { presetId: 'prot_warr', label: 'Prot Warr', hit: 70, expertise: 20, preferred: TANK, armour: 'Plate', weapons: { kind: 'oneHandShield', subclass: 'Sword' } },
  { presetId: 'rogue_venom', label: 'Venom', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' } },
  { presetId: 'rogue_combat', label: 'Combat', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Sword', offSubclass: 'Dagger' } },
  { presetId: 'rogue_rupture', label: 'Rupture', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Dagger', offSubclass: 'Dagger' } },
  { presetId: 'rogue_hemo', label: 'Hemo', hit: 120, expertise: 10, preferred: ROGUE, armour: 'Leather', weapons: { kind: 'dualWield', subclass: 'Mace', offSubclass: 'Dagger' } },
  { presetId: 'druid_moonkin', label: 'Moonkin', hit: 110, expertise: 0, preferred: CASTER, armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'druid_cat', label: 'Cat', hit: 30, expertise: 10, preferred: ['Strength', 'Agility', 'Crit', 'Stamina', 'Attack Power'], armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'druid_bear', label: 'Bear', hit: 30, expertise: 20, preferred: ['Stamina', 'Bonus Armor', 'Agility', 'Strength', 'Dodge', 'Defense'], armour: 'Leather', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'shaman_elemental', label: 'Ele Shaman', hit: 110, expertise: 0, preferred: CASTER, armour: 'Mail', weapons: { kind: 'oneHandShield', subclass: 'Mace', caster: true } },
  { presetId: 'shaman_enhancement', label: 'Enh Shaman', hit: 70, expertise: 10, preferred: ['Crit', 'Strength', 'Intellect', 'Agility', 'Stamina', 'Attack Power'], armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'mage_frostfire', label: 'Frostfire', characterName: 'Frostfire Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'mage_arcane', label: 'Arcane', characterName: 'Arcane Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'mage_fire', label: 'Fire', characterName: 'Fire Mage', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'pally_ret', label: 'Seal Twist Ret', hit: 80, expertise: 10, preferred: ['Crit', 'Strength', 'Spell Power', 'Agility', 'Intellect', 'Stamina', 'Attack Power'], armour: 'Plate', weapons: { kind: 'twoHand', subclass: 'Mace' } },
  { presetId: 'pally_shockadin', label: 'Shockadin', hit: 80, expertise: 0, preferred: ['Crit', 'Spell Power', 'Intellect', 'Strength', 'Stamina', 'Agility', 'Attack Power'], armour: 'Plate', weapons: { kind: 'twoHand', subclass: 'Mace', speed: 2.0 } },
  { presetId: 'prot_pally', label: 'Prot Pally', hit: 50, expertise: 20, preferred: TANK, armour: 'Plate', weapons: { kind: 'oneHandShield', subclass: 'Mace', caster: true } },
  { presetId: 'bm_hunter', label: 'BM Hunter', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Axe', ranged: true } },
  { presetId: 'lw_ranged', label: 'LW Ranged', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'twoHand', subclass: 'Axe', ranged: true } },
  { presetId: 'lw_melee', label: 'LW Melee', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe', ranged: true } },
  { presetId: 'hawk_melee', label: 'Hawk Melee', hit: 80, expertise: 0, preferred: HUNTER, armour: 'Mail', weapons: { kind: 'dualWield', subclass: 'Axe', offSubclass: 'Axe', ranged: true } },
  { presetId: 'warlock_smds', label: 'SM/DS', hit: 120, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'warlock_firelock', label: 'Firelock', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
  { presetId: 'shadow_priest', label: 'Shadow', characterName: 'Shadow Priest', hit: 110, expertise: 0, preferred: CASTER, armour: 'Cloth', weapons: { kind: 'twoHand', subclass: 'Staff', caster: true } },
];

export const BENCHMARK_TEMPLATES_BY_PRESET: ReadonlyMap<string, BenchmarkTemplate> = new Map(
  BENCHMARK_TEMPLATES.map((t) => [t.presetId, t] as const),
);

/* -------------------------------------------------------------------------- */
/* Generating a set                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Where the ids live.
 *
 * Two orders of magnitude clear of the highest real item on file (285,281), so
 * a benchmark id is recognisable on sight and can never collide with a capture.
 */
export const BENCHMARK_ID_BASE = 9_500_000;

export { BENCHMARK_SETS };
export type { BenchmarkSet, BenchmarkSetId } from './benchmarkGear';

const toLines = (
  fixed: ReadonlyMap<BenchStat, number>,
  shares: readonly BenchStat[],
  budget: number,
) => {
  const total = budget ** BUDGET_EXPONENT;
  const amounts = new Map<BenchStat, number>();
  let used = 0;
  for (const [stat, value] of fixed) {
    amounts.set(stat, value);
    used += (value * COST[stat]) ** BUDGET_EXPONENT;
  }
  const left = Math.max(0, total - used);
  const weights = SHARES[shares.length] ?? SHARES[4];
  shares.forEach((stat, index) => {
    /*
     * FLOOR, NOT ROUND. Rounding to NEAREST sends an item over its own budget
     * whenever the fractional part is above a half -- a B55 neck came out at
     * 18.8 against a budget of 18.3, which is a 2.7% overspend produced purely
     * by `13.7 -> 14`. Flooring costs under a point per stat and makes "fits
     * the budget" true by construction rather than true within a tolerance.
     */
    const points = (weights[index] * left) ** (1 / BUDGET_EXPONENT);
    const value = Math.floor(points / COST[stat]);
    if (value > 0) amounts.set(stat, (amounts.get(stat) ?? 0) + value);
  });

  const effects: { kind: string; text: string }[] = [];
  let spent = 0;
  for (const [stat, value] of amounts) {
    if (value <= 0) continue;
    spent += (value * COST[stat]) ** BUDGET_EXPONENT;
    const text = LINE[stat](value);
    effects.push(
      text.startsWith('Equip: ')
        ? { kind: 'Equip', text: text.slice(7) }
        : { kind: 'Stat', text },
    );
  }
  return { effects, spent: spent === 0 ? 0 : spent ** (1 / BUDGET_EXPONENT) };
};

function makeItem(
  id: number,
  name: string,
  set: (typeof BENCHMARK_SETS)[number],
  inventory: string,
  subclass: string | null,
  armor: number | null,
  weapon: GeneratedItem['weapon'],
  effects: readonly { kind: string; text: string }[],
  budget: number,
  spent: number,
): GeneratedItem {
  const head = [
    name,
    `Item Level ${set.itemLevel}`,
    'Binds when picked up',
    subclass ? `${inventory}\t${subclass}` : inventory,
  ];
  if (weapon) {
    head.push(`${weapon.minDamage} - ${weapon.maxDamage} Damage\tSpeed ${weapon.speed.toFixed(2)}`);
    head.push(`(${weapon.dps.toFixed(1)} damage per second)`);
  }
  if (armor) head.push(`${armor} Armor`);
  const body = effects.map((e) => (e.kind === 'Equip' ? `Equip: ${e.text}` : e.text));
  return {
    id,
    name,
    quality: set.quality,
    icon: 'inv_misc_questionmark',
    source: `SYNTHETIC benchmark gear generated from the itemization budget -- ${set.description}. Not a Forever item.`,
    itemLevel: set.itemLevel,
    inventoryType: inventory,
    subclass,
    armor,
    weapon,
    stats: {},
    resistances: {},
    effects: [...effects],
    tooltip: [...head, ...body].join('\n'),
    budget,
    spent,
  };
}

function weaponDamage(
  hand: 'oneHand' | 'twoHand' | 'ranged',
  quality: 3 | 4,
  itemLevel: number,
  speed: number,
  caster: boolean,
) {
  const line = WEAPON_DPS[`${hand}|${quality}`];
  const physical = line[0] * itemLevel + line[1];
  const dps = caster ? physical * (CASTER_DPS_SHARE[hand] ?? 1) : physical;
  /*
   * THE DAMAGE RANGE IS THE ITEM AND THE DPS IS DERIVED FROM IT, not the other
   * way round. Rounding min and max to integers moves the dps a little, and
   * `buildItem` cross-checks `(min + max) / 2 / speed` against the stated dps
   * to a tolerance of 0.05 -- so computing the two independently throws on the
   * rounding. Deriving it is also what a real tooltip does.
   */
  const mid = dps * speed;
  const minDamage = Math.round(mid * 0.8);
  const maxDamage = Math.round(mid * 1.2);
  return {
    minDamage,
    maxDamage,
    speed,
    dps: Number(((minDamage + maxDamage) / 2 / speed).toFixed(2)),
    forgone: physical - dps,
  };
}

/** Default swing speeds, which are a presentation choice and not a budget one. */
const SPEED: Readonly<Record<string, number>> = {
  twoHand: 3.6,
  Staff: 3.0,
  oneHand: 2.4,
  Dagger: 1.8,
  ranged: 2.8,
};

/** Every item in one profile's set at one item level. */
export function benchmarkItemsFor(
  template: BenchmarkTemplate,
  set: (typeof BENCHMARK_SETS)[number],
): readonly GeneratedItem[] {
  const base = qualityBase(set.itemLevel, set.quality);
  /*
   * A SLOT ONLY CARRIES A RATING IT CAN AFFORD.
   *
   * Hit costs budget -- the owner's instruction -- and the smallest slots have
   * the least. A neck at item level 55 has a budget of 18.3, so 20 hit rating
   * does not fit in it at all and the item came out 2% over. Filtering the
   * candidate slots by what the rating would cost keeps the set inside its
   * budget AND is the realistic answer: a small slot carries less.
   */
  const affords = (slot: EquipmentSlot, amount: number) => {
    const plan = ARMOUR_SLOTS.find((p) => p.slot === slot);
    return plan === undefined || amount <= base * SLOT_MULTIPLIER[plan.slotClass];
  };
  const hitSlots = RATING_SLOTS.filter((slot) => affords(slot, template.hit / 8));
  const hit = spreadRating(template.hit, hitSlots.filter((s) => affords(s, 25)));
  const expertise = spreadRating(
    template.expertise,
    [...RATING_SLOTS].reverse().filter((s) => affords(s, 25)),
  );

  // A stable id per (template, set, slot) so a set is the same every time.
  const templateIndex = BENCHMARK_TEMPLATES.indexOf(template);
  const setIndex = BENCHMARK_SETS.indexOf(set);
  let seq = 0;
  const nextId = () => BENCHMARK_ID_BASE + templateIndex * 400 + setIndex * 100 + seq++;

  const items: GeneratedItem[] = [];

  for (const plan of ARMOUR_SLOTS) {
    const budget = base * SLOT_MULTIPLIER[plan.slotClass];
    const fixed = new Map<BenchStat, number>();
    const h = hit.get(plan.slot);
    if (h) fixed.set('Hit', h);
    const e = expertise.get(plan.slot);
    if (e) fixed.set('Expertise', e);
    const { effects, spent } = toLines(fixed, statsFor(plan, template.preferred), budget);
    const armour = plan.noArmour ? null : baseArmour(plan.inventory, template.armour, set.itemLevel);
    items.push(
      makeItem(
        nextId(),
        `${set.id} ${plan.inventory}`,
        set,
        plan.inventory,
        plan.noArmour ? null : template.armour,
        armour,
        null,
        effects,
        budget,
        spent,
      ),
    );
  }

  // ---- weapons ----
  const w = template.weapons;
  const caster = w.caster === true;
  const addWeapon = (
    inventory: string,
    hand: 'oneHand' | 'twoHand' | 'ranged',
    slotClass: 'full' | 'oneHand' | 'ranged' | 'light',
    subclass: string,
    speed: number,
    label: string,
  ) => {
    const damage = weaponDamage(hand, set.quality, set.itemLevel, speed, caster && hand !== 'ranged');
    const budget =
      base * SLOT_MULTIPLIER[slotClass] + (caster && hand !== 'ranged' ? damage.forgone * DPS_TO_BUDGET : 0);
    const { effects, spent } = toLines(new Map(), template.preferred.slice(0, 3), budget);
    items.push(
      makeItem(
        nextId(),
        `${set.id} ${label}`,
        set,
        inventory,
        subclass,
        null,
        {
          minDamage: damage.minDamage,
          maxDamage: damage.maxDamage,
          speed: damage.speed,
          dps: damage.dps,
        },
        effects,
        budget,
        spent,
      ),
    );
  };

  if (w.kind === 'twoHand') {
    const speed = w.speed ?? (w.subclass === 'Staff' ? SPEED.Staff : SPEED.twoHand);
    addWeapon('Two-Hand', 'twoHand', 'full', w.subclass, speed, `Two-Hand ${w.subclass}`);
  } else if (w.kind === 'dualWield') {
    addWeapon('One-Hand', 'oneHand', 'oneHand', w.subclass, SPEED[w.subclass] ?? SPEED.oneHand, `Main-Hand ${w.subclass}`);
    addWeapon('One-Hand', 'oneHand', 'oneHand', w.offSubclass!, SPEED[w.offSubclass!] ?? SPEED.oneHand, `Off-Hand ${w.offSubclass}`);
  } else {
    addWeapon('One-Hand', 'oneHand', 'oneHand', w.subclass, SPEED.oneHand, `One-Hand ${w.subclass}`);
    // A shield: light slot, carrying block value on top of its base armour.
    const shieldBudget = base * SLOT_MULTIPLIER.light;
    const { effects, spent } = toLines(new Map(), ['Stamina', 'Block'] as BenchStat[], shieldBudget);
    items.push(
      makeItem(
        nextId(),
        `${set.id} Shield`,
        set,
        'Off Hand',
        'Shield',
        Math.round(baseArmour('Chest', template.armour, set.itemLevel) * 3.3),
        null,
        effects,
        shieldBudget,
        spent,
      ),
    );
  }

  if (w.ranged) {
    addWeapon('Ranged', 'ranged', 'ranged', 'Bow', SPEED.ranged, 'Bow');
  }

  return items;
}

/** Every benchmark item, for every template and set. */
export const BENCHMARK_ITEMS: readonly GeneratedItem[] = BENCHMARK_TEMPLATES.flatMap((template) =>
  BENCHMARK_SETS.flatMap((set) => benchmarkItemsFor(template, set)),
);

const BY_KEY = new Map<string, readonly GeneratedItem[]>();
for (const template of BENCHMARK_TEMPLATES) {
  for (const set of BENCHMARK_SETS) {
    BY_KEY.set(`${template.presetId}|${set.id}`, benchmarkItemsFor(template, set));
  }
}

/**
 * The equipment a button installs, or undefined if this profile has no template.
 *
 * SLOT BY SLOT FROM THE GENERATED ITEMS, so the Gear panel shows real rows that
 * can be inspected and swapped out one at a time -- the set is a starting
 * point, not a mode the character is in.
 */
export function benchmarkEquipmentFor(
  presetId: string,
  setId: BenchmarkSetId,
): Equipment | undefined {
  const items = BY_KEY.get(`${presetId}|${setId}`);
  if (!items) return undefined;
  const equipment: Record<string, { itemId: number }> = {};
  const template = BENCHMARK_TEMPLATES_BY_PRESET.get(presetId)!;
  let armourIndex = 0;
  for (const item of items) {
    if (armourIndex < ARMOUR_SLOTS.length) {
      equipment[ARMOUR_SLOTS[armourIndex].slot] = { itemId: item.id };
      armourIndex += 1;
      continue;
    }
    const w = template.weapons;
    if (item.inventoryType === 'Two-Hand') equipment.twoHand = { itemId: item.id };
    else if (item.inventoryType === 'Ranged') equipment.ranged = { itemId: item.id };
    else if (item.subclass === 'Shield') equipment.shield = { itemId: item.id };
    else if (!equipment.mainHand) equipment.mainHand = { itemId: item.id };
    else if (w.kind === 'dualWield') equipment.offHand = { itemId: item.id };
  }
  return equipment as Equipment;
}

export function hasBenchmarkGear(presetId: string | undefined): boolean {
  return presetId !== undefined && BENCHMARK_TEMPLATES_BY_PRESET.has(presetId);
}

/**
 * Templates by the LABEL the character carries, which is how the UI finds one.
 *
 * ----------------------------------------------------------------------------
 * `game` MAY NOT IMPORT FROM `profiles`, so this layer cannot look a preset up
 * and the panel has only the profile in front of it. Every preset sets
 * `character.name` to its own label -- "2H Arms", "Seal Twist Ret" -- and the
 * templates carry the same labels, so the name is the join.
 *
 * IT IS A JOIN ON A STRING A USER CAN EDIT, which is the honest weakness: rename
 * the character and the buttons stop offering a set. That is a visible failure
 * rather than a wrong one, and `benchmarkTemplates.test.ts` pins that all 25
 * labels still match so a renamed PRESET fails the suite instead of the panel.
 * ----------------------------------------------------------------------------
 */
export const BENCHMARK_TEMPLATES_BY_LABEL: ReadonlyMap<string, BenchmarkTemplate> = new Map(
  BENCHMARK_TEMPLATES.map((t) => [t.characterName ?? t.label, t] as const),
);

/** The equipment for a character by its name, or undefined if none matches. */
export function benchmarkEquipmentForName(
  characterName: string,
  setId: BenchmarkSetId,
): Equipment | undefined {
  const template = BENCHMARK_TEMPLATES_BY_LABEL.get(characterName);
  return template ? benchmarkEquipmentFor(template.presetId, setId) : undefined;
}

export type { EquipmentSlot };
