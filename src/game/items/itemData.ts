import type { PartialStats } from '../../engine';
import type { Enchant, EquipmentSlot, Item, ItemWeapon, UnmodelledEffect } from './Item';
import raw from '../../data/items/classic-warrior.json';

/**
 * Items, from Wowhead's Classic tooltip data.
 *
 * Source: `https://nether.wowhead.com/classic/tooltip/item/<id>`, scraped once
 * into `src/data/items/classic-warrior.json` and hash-checked on the way in.
 * That file is the record; this one turns it into what the simulator uses.
 *
 * RULESET NOTE, and it matters. These are WoW CLASSIC items — the Tier 1
 * Unstoppable Might set is Season of Discovery — while everything else in this
 * project is World of Warcraft: Forever. They were chosen deliberately, to get
 * real weapon numbers in place of the invented placeholders, but a Forever item
 * of the same name may not have the same values. Nothing here should be taken
 * as Forever data.
 *
 * WHAT IS AND IS NOT CARRIED OVER. An item's stats, armor, attack power, hit
 * and crit all map onto engine stats and are applied. Anything else -- a
 * chance-on-hit proc, an extra attack, a resistance -- is recorded verbatim in
 * `unmodelled` and does NOTHING. A character wearing these is therefore weaker
 * than the same character in the real game, in ways the UI lists rather than
 * hides.
 */

interface RawEffect {
  readonly kind: string;
  readonly text: string;
}

interface RawItem {
  readonly id: number;
  readonly name: string;
  readonly quality: number;
  readonly icon: string;
  readonly source: string;
  readonly itemLevel: number;
  readonly inventoryType: string;
  readonly subclass: string | null;
  readonly armor: number | null;
  readonly weapon: {
    readonly minDamage: number;
    readonly maxDamage: number;
    readonly speed: number;
    readonly dps: number;
  } | null;
  readonly stats: Readonly<Record<string, number>>;
  readonly resistances: Readonly<Record<string, number>>;
  readonly effects: readonly RawEffect[];
  readonly tooltip: string;
}

interface RawData {
  readonly items: readonly RawItem[];
  readonly enchants: readonly {
    readonly id: number;
    readonly name: string;
    readonly icon: string;
    readonly source: string;
    readonly tooltip: string;
  }[];
}

/** Wowhead's inventory type to the slots it can occupy. */
const SLOTS_BY_INVENTORY_TYPE: Readonly<Record<string, readonly EquipmentSlot[]>> = {
  Head: ['head'],
  Neck: ['neck'],
  Shoulder: ['shoulders'],
  Back: ['cloak'],
  Chest: ['chest'],
  Wrist: ['wrists'],
  Hands: ['gloves'],
  Waist: ['waist'],
  Legs: ['legs'],
  Feet: ['feet'],
  // A ring or trinket fits either of its two slots.
  Finger: ['ring1', 'ring2'],
  Trinket: ['trinket1', 'trinket2'],
  'One-Hand': ['mainHand', 'offHand'],
  'Main Hand': ['mainHand'],
  'Two-Hand': ['twoHand'],
  // Reached through the SUBCLASS rather than the inventory type: Wowhead calls
  // a shield's slot "Off Hand", which is also a held off-hand item's. See
  // `buildItem`.
  Shield: ['shield'],
  'Off Hand': ['offHand'],
  Ranged: ['ranged'],
};

/*
 * Effect text to engine stat.
 *
 * Every pattern below is matched against the source's own wording. Anything
 * that matches nothing is preserved as unmodelled rather than guessed at, so
 * adding a pattern is how an effect becomes real -- never by editing a number.
 */
interface EffectRule {
  readonly pattern: RegExp;
  readonly apply: (value: number, into: Record<string, number>) => void;
}

const EFFECT_RULES: readonly EffectRule[] = [
  {
    // A shield's "44 Block" -- its block CHANCE, in percentage points.
    pattern: /^(\d+) Block$/,
    apply: (value, into) => {
      into.blockChance = (into.blockChance ?? 0) + value;
    },
  },
  {
    // A shield's "+27 Block Value" -- flat damage a block removes, and the
    // amount Shield Slam adds to its own damage.
    pattern: /^\+(\d+) Block Value$/,
    apply: (value, into) => {
      into.blockValue = (into.blockValue ?? 0) + value;
    },
  },
  {
    // "+20 Attack Power."
    pattern: /^\+(\d+) Attack Power\.?$/,
    apply: (value, into) => {
      into.attackPower = (into.attackPower ?? 0) + value;
    },
  },
  {
    // "Improves your chance to hit by 1%." and the "with all spells and
    // attacks" wording, which for a warrior come to the same thing.
    pattern: /^Improves your chance to hit(?: with all spells and attacks)? by (\d+)%\.?$/,
    apply: (value, into) => {
      into.hitChance = (into.hitChance ?? 0) + value;
    },
  },
  {
    // "Improves your chance to get a critical strike by 2%."
    pattern:
      /^Improves your chance to get a critical strike(?: with all spells and attacks)? by (\d+)%\.?$/,
    apply: (value, into) => {
      into.critChance = (into.critChance ?? 0) + value;
    },
  },
];

/** Bonus weapon skill, which is a weapon property rather than a stat. */
const WEAPON_SKILL_PATTERN = /^Increased ([\w\- ]+) \+(\d+)\.?$/;

/**
 * Effects implemented as reactions in `procs.ts` rather than as stats.
 *
 * They are neither a stat nor unmodelled: a proc is behaviour, so it lives with
 * the other behaviour and is listed here only so it stops being reported as
 * missing. The ruleset owner supplied the rates the tooltips do not give.
 */
const MODELLED_AS_PROCS: readonly RegExp[] = [
  /Delivers a fatal wound for \d+ damage/,
  /chance on melee hit to gain 1 extra attack/,
];

/** Why a given effect is not modelled. Keyed by the kind, with a default. */
function reasonFor(kind: string, text: string): string {
  if (/chance on hit/i.test(kind)) {
    return 'The engine has a reaction hook, but the proc RATE is not stated anywhere on the item.';
  }
  if (/extra attack/i.test(text)) {
    return 'The engine has no extra-attack mechanic.';
  }
  if (/Resistance/i.test(text)) {
    return 'Resistances are not a stat the engine has.';
  }
  return 'No engine mechanic for this yet.';
}

function buildStats(item: RawItem): {
  stats: PartialStats;
  unmodelled: UnmodelledEffect[];
  bonusSkill: number;
} {
  const stats: Record<string, number> = {};
  const unmodelled: UnmodelledEffect[] = [];
  let bonusSkill = 0;

  for (const [name, value] of Object.entries(item.stats)) stats[name] = value;
  if (item.armor) stats.armor = item.armor;

  for (const [school, value] of Object.entries(item.resistances)) {
    // The scrape lowercases the school for use as a key; the display text puts
    // it back the way the tooltip reads.
    const named = school.charAt(0).toUpperCase() + school.slice(1);
    unmodelled.push({
      kind: 'Equip',
      text: `+${value} ${named} Resistance`,
      reason: reasonFor('Equip', 'Resistance'),
    });
  }

  for (const effect of item.effects) {
    if (MODELLED_AS_PROCS.some((pattern) => pattern.test(effect.text))) continue;

    const skill = effect.text.match(WEAPON_SKILL_PATTERN);
    if (skill) {
      bonusSkill += Number(skill[2]);
      continue;
    }

    const rule = EFFECT_RULES.find((candidate) => candidate.pattern.test(effect.text));
    if (rule) {
      const match = effect.text.match(rule.pattern);
      if (match) {
        rule.apply(Number(match[1]), stats);
        continue;
      }
    }

    unmodelled.push({
      kind: effect.kind,
      text: effect.text,
      reason: reasonFor(effect.kind, effect.text),
    });
  }

  return { stats: stats as PartialStats, unmodelled, bonusSkill };
}

function buildItem(item: RawItem): Item {
  /*
   * A SHIELD is resolved by its subclass, not its inventory type.
   *
   * Wowhead gives a shield the inventory type "Off Hand", the same as a held
   * off-hand trinket, and only the subclass says it is a shield. Mapping on the
   * inventory type alone would put The Immovable Object in the off-hand WEAPON
   * slot, where a dual-wielder could equip it and swing it.
   */
  const slots =
    item.subclass === 'Shield'
      ? SLOTS_BY_INVENTORY_TYPE.Shield
      : SLOTS_BY_INVENTORY_TYPE[item.inventoryType];
  if (!slots) {
    throw new Error(`${item.name}: no slot mapping for inventory type "${item.inventoryType}"`);
  }

  const { stats, unmodelled, bonusSkill } = buildStats(item);
  // Carried through for display. Still in `unmodelled` too: the sheet shows
  // the total and the Gear panel says it does nothing, and both are true.
  const resistances = { ...item.resistances };

  let weapon: ItemWeapon | undefined;
  if (item.weapon) {
    const { minDamage, maxDamage, speed, dps } = item.weapon;
    // The tooltip states damage, speed AND dps. They are redundant, so they
    // are checked against each other: a scrape that dropped a digit shows up
    // here rather than as a quietly wrong weapon.
    const derived = (minDamage + maxDamage) / 2 / speed;
    if (Math.abs(derived - dps) > 0.05) {
      throw new Error(
        `${item.name}: damage ${minDamage}-${maxDamage} at ${speed}s gives ${derived.toFixed(2)} dps, tooltip says ${dps}`,
      );
    }
    weapon = { minDamage, maxDamage, speed, dps, subclass: item.subclass ?? 'Unknown', bonusSkill };
  }

  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    source: item.source,
    itemLevel: item.itemLevel,
    quality: item.quality,
    slots,
    stats,
    ...(weapon ? { weapon } : {}),
    unmodelled,
    resistances,
    tooltip: item.tooltip,
  };
}

const data = raw as unknown as RawData;

export const ITEMS: readonly Item[] = data.items.map(buildItem);

export const ITEMS_BY_ID: ReadonlyMap<number, Item> = new Map(
  ITEMS.map((item) => [item.id, item] as const),
);

/**
 * Enchant Weapon - Crusader.
 *
 * Its effect is a PROC, and the tooltip rates it only as "often". The ruleset
 * owner supplied the missing number: 1.1 procs per minute, which on a 2.5
 * second weapon is a 4.58% chance per attack. That is implemented in
 * `procs.ts`, so nothing is unmodelled here any more.
 *
 * The HEAL is still not modelled, and is listed. Nothing damages the player, so
 * it would restore nothing even if it were.
 */
export const CRUSADER: Enchant = {
  id: data.enchants[0].id,
  name: data.enchants[0].name,
  icon: data.enchants[0].icon,
  source: data.enchants[0].source,
  // Melee weapons only. The ranged slot is excluded deliberately.
  slots: ['mainHand', 'offHand', 'twoHand'],
  stats: {},
  unmodelled: [
    {
      kind: 'Enchant',
      text: 'Heals for 75 to 125 on proc.',
      reason: 'Nothing damages the player, so a heal would restore nothing.',
    },
  ],
  tooltip: data.enchants[0].tooltip,
};

export const ENCHANTS: readonly Enchant[] = [CRUSADER];

export const ENCHANTS_BY_ID: ReadonlyMap<number, Enchant> = new Map(
  ENCHANTS.map((enchant) => [enchant.id, enchant] as const),
);

/** Items that can go in a slot. */
export function itemsForSlot(slot: EquipmentSlot): readonly Item[] {
  return ITEMS.filter((item) => item.slots.includes(slot));
}

/** Enchants that can go on a slot. */
export function enchantsForSlot(slot: EquipmentSlot): readonly Enchant[] {
  return ENCHANTS.filter((enchant) => enchant.slots.includes(slot));
}
