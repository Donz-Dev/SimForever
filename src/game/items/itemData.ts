import type { DamageSchool, PartialStats } from '../../engine';
import { DAMAGE_SCHOOLS } from '../../engine';
import type { Enchant, EquipmentSlot, Item, ItemWeapon, UnmodelledEffect } from './Item';
import warriorItems from '../../data/items/classic-warrior.json';
import hunterItems from '../../data/items/sod-hunter.json';
import rogueItems from '../../data/items/sod-rogue.json';
import druidItems from '../../data/items/sod-druid.json';
import shamanItems from '../../data/items/sod-shaman.json';
import mageItems from '../../data/items/sod-mage.json';
import paladinItems from '../../data/items/sod-paladin.json';
import warlockItems from '../../data/items/sod-warlock.json';
import priestItems from '../../data/items/sod-priest.json';

/**
 * Items, from Wowhead's Classic tooltip data.
 *
 * Source: `https://nether.wowhead.com/classic/tooltip/item/<id>`, scraped into
 * `src/data/items/*.json` -- `classic-warrior.json` first and hash-checked on
 * the way in, `sod-hunter.json` afterwards through `tools/import_item.mjs`.
 * Those files are the record; this one turns them into what the simulator
 * uses.
 *
 * ONE FILE PER SET, so "where did this number come from" has a per-file
 * answer: each carries its own `source` and the set it was taken from. They
 * are concatenated here and nothing downstream knows there were two.
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
  // A caster off-hand item: held, never swung. Wowhead's own words for the
  // inventory type, and the same engine slot a shield uses.
  'Held In Off-hand': ['offHand'],
  Ranged: ['ranged'],
  /*
   * An idol, libram or totem.
   *
   * Seven of them arrived with the Druid, Paladin and Shaman sets, and without
   * a slot `buildItem` threw on the first one. Almost everything they do is
   * ability-specific -- "the damage of your Moonfire spell", "the rage cost of
   * Maul and Swipe" -- so most of a relic lands in `unmodelled` and is listed
   * rather than applied. The slot exists so the item is VISIBLE: a set piece
   * with nowhere to go is worse than one that visibly does nothing.
   */
  Relic: ['relic'],
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
    /*
     * A shield's "44 Block" is its INHERENT BLOCK VALUE, not a block chance.
     *
     * This was read as chance, which gave The Immovable Object a 44% chance to
     * block and a block value of 27 -- both wrong, and wrong in a way that
     * looked plausible on a tank. A shield's own line and its "+27 Block
     * Value" bonus are the same kind of number and they add: 44 + 27 = 71.
     *
     * Block CHANCE comes from the base 5% every shield user has, from talents,
     * from defense skill and from Shield Block. No item in this data grants
     * any.
     */
    pattern: /^(\d+) Block$/,
    apply: (value, into) => {
      into.blockValue = (into.blockValue ?? 0) + value;
    },
  },
  {
    // "+27 Block Value" -- flat damage a block removes, and the amount Shield
    // Slam adds to its own damage. Found on shields and on other slots alike.
    pattern: /^\+(\d+) Block Value$/,
    apply: (value, into) => {
      into.blockValue = (into.blockValue ?? 0) + value;
    },
  },
  {
    // A percentage chance, which is the other thing "block" can mean. Nothing
    // in the current data matches; the rule exists so a future item is read
    // rather than reported as unmodelled.
    pattern: /^\+?(\d+)% (?:Chance to Block|Block Chance)$/,
    apply: (value, into) => {
      into.blockChance = (into.blockChance ?? 0) + value;
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
    /*
     * "+48 ranged Attack Power." -- the RANGED pool, which is a different
     * stat and not a subset of the one above.
     *
     * It has to be matched BEFORE nothing, and it is listed after the plain
     * rule only because that rule is anchored and cannot swallow it. A
     * Hunter's gear says this on a trinket and on the bow itself, and
     * without a rule the words fell through to `unmodelled` and 65 ranged
     * attack power went quietly missing -- honest, because the Gear panel
     * prints every unmodelled line, but wrong when the stat exists and the
     * source names it unambiguously.
     */
    pattern: /^\+(\d+) ranged Attack Power\.?$/,
    apply: (value, into) => {
      into.rangedAttackPower = (into.rangedAttackPower ?? 0) + value;
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
    // "Improves your chance to get a critical strike by 2%." Physical only:
    // the wording names no spells, so it reaches no spell.
    pattern: /^Improves your chance to get a critical strike by (\d+)%\.?$/,
    apply: (value, into) => {
      into.critChance = (into.critChance ?? 0) + value;
    },
  },
  {
    /*
     * "...with all spells and attacks" IS TWO STATS, and it was one.
     *
     * `critChance` and `spellCritChance` are separate stats read by separate
     * tables -- the melee tables use the first, `kind === 'spell'` uses the
     * second -- so a line that says "all spells and attacks" has to grant
     * both, exactly as the raid buffs that say it already do. This rule used
     * to fold the qualified wording into the unqualified one and grant only
     * the melee half, which was invisible for as long as nothing in the item
     * data was caster gear: sixty-two lines across these files say it, and
     * four caster profiles would have read a spell crit chance of whatever
     * intellect alone gives them while wearing gear that says otherwise.
     *
     * Not double counting. One number, two stats, one of which each table
     * reads.
     */
    pattern:
      /^Improves your chance to get a critical strike with all spells and attacks by (\d+)%\.?$/,
    apply: (value, into) => {
      into.critChance = (into.critChance ?? 0) + value;
      into.spellCritChance = (into.spellCritChance ?? 0) + value;
    },
  },
  {
    // "Improves your chance to get a critical strike with spells by 2%."
    // Spells only, and the mirror of the unqualified rule above.
    pattern: /^Improves your chance to get a critical strike with spells by (\d+)%\.?$/,
    apply: (value, into) => {
      into.spellCritChance = (into.spellCritChance ?? 0) + value;
    },
  },
  {
    /*
     * "Increases damage and healing done by magical spells and effects by up
     * to 47." -- SPELL POWER, and the only wording in this data that grants
     * the school-blind kind.
     *
     * `dealDamage` has read `spellPower` for every non-physical school since
     * before any caster existed; what was missing was gear that granted it.
     * Forty-two lines across these files do.
     *
     * A SCHOOL-SPECIFIC LINE IS NOT THIS, and it is no longer unmodelled
     * either. "Increases damage done by Shadow spells and effects by up to 39"
     * says SHADOW, so it goes to `SCHOOL_SPELL_POWER_PATTERN` below and onto
     * that school alone. The two must not be folded together in either
     * direction: a Shadow bonus in `spellPower` would raise the same
     * character's Holy and Arcane spells, and a generic bonus on one school
     * would be lost by the other six.
     */
    pattern:
      /^Increases damage and healing done by magical spells and effects by up to (\d+)\.?$/,
    apply: (value, into) => {
      into.spellPower = (into.spellPower ?? 0) + value;
    },
  },
  {
    /*
     * "Increased Defense +10." -- DEFENSE SKILL, seventeen lines of it across
     * the tank and feral sets.
     *
     * It has to be matched here and before the weapon-skill pattern, which is
     * `Increased <anything> +N` and was swallowing it. Worse than unmodelled:
     * a weapon's `bonusSkill` on a piece of PLATE is dropped on the floor,
     * because only a weapon carries one. `defenseSkill` is the surplus above
     * the level baseline, which is exactly what a piece of gear grants, and it
     * moves five separate numbers on the attacks-received table.
     */
    pattern: /^Increased Defense \+(\d+)\.?$/,
    apply: (value, into) => {
      into.defenseSkill = (into.defenseSkill ?? 0) + value;
    },
  },
  {
    // "Increases the block value of your shield by 27." The Classic wording for
    // what the Forever tooltip states as "+27 Block Value"; The Immovable
    // Object says it one way and eight Lawbringer pieces say it the other.
    pattern: /^Increases the block value of your shield by (\d+)\.?$/,
    apply: (value, into) => {
      into.blockValue = (into.blockValue ?? 0) + value;
    },
  },
];

/** Bonus weapon skill, which is a weapon property rather than a stat. */
const WEAPON_SKILL_PATTERN = /^Increased ([\w\- ]+) \+(\d+)\.?$/;

/**
 * "Increases damage done by Shadow spells and effects by up to 39."
 *
 * ----------------------------------------------------------------------------
 * SPELL POWER SCOPED TO ONE SCHOOL, and it is handled HERE rather than in
 * `EFFECT_RULES` for the same reason weapon skill is: it does not land in
 * `stats`. `STAT_NAMES` is a deliberately closed flat set, so there is no
 * `shadowSpellPower` to add and there should not be -- it goes on
 * `SchoolModifiers`, beside the crit and damage that are already keyed by
 * school, and `spellPowerFor` reads it.
 *
 * Seventeen lines across two sets say this: eight Lawbringer pieces naming
 * Holy and nine Priest pieces naming Shadow, Anathema's 75 and Skul's 14 among
 * them. They were the largest known shortfall in the item data.
 *
 * AN UNKNOWN SCHOOL FALLS THROUGH TO UNMODELLED rather than being invented.
 * The capture is validated against `DAMAGE_SCHOOLS`, so a wording naming
 * something the engine has no school for is reported instead of being dropped
 * into a school that happens to sort first.
 * ----------------------------------------------------------------------------
 */
const SCHOOL_SPELL_POWER_PATTERN =
  /^Increases damage done by (\w+) spells and effects by up to (\d+)\.?$/;

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
  if (kind === 'Set') {
    return 'A set bonus counts pieces across the whole set, which nothing here tracks.';
  }
  if (/chance on hit/i.test(kind)) {
    return 'The engine has a reaction hook, but the proc RATE is not stated anywhere on the item.';
  }
  if (/extra attack/i.test(text)) {
    return 'The engine has no extra-attack mechanic.';
  }
  /*
   * THE SCHOOL-SPELL-POWER REASON IS GONE, because the blocker it named has
   * cleared: `SchoolModifiers` carries a `spellPower` per school and
   * `SCHOOL_SPELL_POWER_PATTERN` fills it. The wording only reaches this
   * function now when the SCHOOL is one the engine does not have, which is a
   * different claim and says so.
   */
  if (/^Increases damage done by \w+ spells and effects by up to \d+/.test(text)) {
    return 'The school named is not one the engine has, so there is nowhere to put it.';
  }
  if (/forms only\.?$/.test(text)) {
    return 'An item stat cannot be conditional on the combat style, so this is listed rather than applied.';
  }
  return 'No engine mechanic for this yet.';
}

function buildStats(item: RawItem): {
  stats: PartialStats;
  schoolPower: Partial<Record<DamageSchool, number>>;
  unmodelled: UnmodelledEffect[];
  bonusSkill: number;
} {
  const stats: Record<string, number> = {};
  const schoolPower: Partial<Record<DamageSchool, number>> = {};
  const unmodelled: UnmodelledEffect[] = [];
  let bonusSkill = 0;

  for (const [name, value] of Object.entries(item.stats)) stats[name] = value;
  if (item.armor) stats.armor = item.armor;

  /*
   * RESISTANCES ARE NOT LISTED AS UNMODELLED ANY MORE.
   *
   * They are carried on the item and totalled on the character sheet, which
   * is what the ruleset owner asked for. Repeating every piece under
   * "Equipped but not simulated" was accurate and useless -- nineteen slots
   * of plate produce a wall of rows that says the same thing nineteen times
   * and buries the effects that are genuinely missing a mechanic.
   */
  for (const effect of item.effects) {
    if (MODELLED_AS_PROCS.some((pattern) => pattern.test(effect.text))) continue;

    /*
     * THE RULES COME FIRST, and the order is load-bearing.
     *
     * `WEAPON_SKILL_PATTERN` is `Increased <anything> +N`, so it also matches
     * "Increased Defense +10" -- and a weapon's bonus skill on a breastplate
     * is silently discarded, because only a weapon carries one. Trying the
     * named rules first lets the defense rule claim it, and "Increased
     * Two-handed Swords +3" still falls through to the weapon skill it is.
     */
    const rule = EFFECT_RULES.find((candidate) => candidate.pattern.test(effect.text));
    if (rule) {
      const match = effect.text.match(rule.pattern);
      if (match) {
        rule.apply(Number(match[1]), stats);
        continue;
      }
    }

    const skill = effect.text.match(WEAPON_SKILL_PATTERN);
    if (skill) {
      bonusSkill += Number(skill[2]);
      continue;
    }

    /*
     * Spell power for one school. Tried after the named rules and after
     * weapon skill, alongside them rather than in `EFFECT_RULES`, because
     * like weapon skill it is not a flat stat and has nowhere to land in
     * `stats`.
     */
    const scoped = effect.text.match(SCHOOL_SPELL_POWER_PATTERN);
    if (scoped) {
      const school = scoped[1].toLowerCase() as DamageSchool;
      // Validated, not assumed: an unrecognised school is reported rather
      // than silently credited to whichever one the cast happens to be.
      if (DAMAGE_SCHOOLS.includes(school)) {
        schoolPower[school] = (schoolPower[school] ?? 0) + Number(scoped[2]);
        continue;
      }
    }

    unmodelled.push({
      kind: effect.kind,
      text: effect.text,
      reason: reasonFor(effect.kind, effect.text),
    });
  }

  return { stats: stats as PartialStats, schoolPower, unmodelled, bonusSkill };
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

  const { stats, schoolPower, unmodelled, bonusSkill } = buildStats(item);
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
    schoolPower,
    ...(weapon ? { weapon } : {}),
    unmodelled,
    resistances,
    tooltip: item.tooltip,
  };
}

const data = warriorItems as unknown as RawData;

/*
 * EVERY item file, in the same order as `tools/item-sets.json`.
 *
 * That order is what decides which file OWNS a shared piece, and twenty-two of
 * these are worn by more than one set -- Choker of the Fire Lord by five of
 * them. An id lands in the first file that asks for it and is omitted from
 * every later one, so this throws rather than silently keeping one of two
 * entries for the same item.
 */
const ITEM_FILES: readonly RawData[] = [
  warriorItems,
  hunterItems,
  rogueItems,
  druidItems,
  shamanItems,
  mageItems,
  paladinItems,
  warlockItems,
  priestItems,
] as unknown as readonly RawData[];

const RAW_ITEMS = ITEM_FILES.flatMap((file) => file.items);

const duplicates = RAW_ITEMS.map((item) => item.id).filter(
  (id, index, all) => all.indexOf(id) !== index,
);
if (duplicates.length > 0) {
  throw new Error(`Duplicate item ids across the item files: ${duplicates.join(', ')}`);
}

export const ITEMS: readonly Item[] = RAW_ITEMS.map(buildItem);

export const ITEMS_BY_ID: ReadonlyMap<number, Item> = new Map(
  ITEMS.map((item) => [item.id, item] as const),
);

/**
 * Which slots an enchant may go on, and what it grants, by spell id.
 *
 * The data file carries the enchant's NAME, ICON and TOOLTIP from the source.
 * What it DOES is decided here, because a tooltip states an effect in prose and
 * an enchant is either a stat or a proc -- the same split every item makes.
 */
const ENCHANT_RULES: Readonly<
  Record<number, { slots: readonly EquipmentSlot[]; stats: PartialStats; unmodelled: UnmodelledEffect[] }>
> = {
  /*
   * Enchant Weapon - Crusader.
   *
   * Its effect is a PROC, and the tooltip rates it only as "often". The ruleset
   * owner supplied the missing number: 1.1 procs per minute, which on a 2.5
   * second weapon is a 4.58% chance per attack. That is implemented in
   * `procs.ts`, so nothing is unmodelled here.
   *
   * The HEAL is modelled too, since the encounter grew a healer and a character
   * who can die. Its old reason -- "Nothing damages the player, so a heal would
   * restore nothing" -- was true when written and expired the day the target
   * started killing people.
   */
  20034: {
    // Melee weapons only. The ranged slot is excluded deliberately.
    slots: ['mainHand', 'offHand', 'twoHand'],
    stats: {},
    // Empty, not absent: every part of this enchant is simulated.
    unmodelled: [],
  },
  /*
   * Enchant Weapon - Spell Power: "add up to 30 damage to spells".
   *
   * A flat stat rather than a proc, and the five caster sets all carry it --
   * the sixtyupgrades sets name it on the staff or dagger in as many words.
   * Leaving it out would have left every caster thirty spell power short of
   * the planner it was validated against, which the primary-stat check does
   * not look at.
   */
  22749: {
    slots: ['mainHand', 'offHand', 'twoHand'],
    stats: { spellPower: 30 },
    unmodelled: [],
  },
};

export const ENCHANTS: readonly Enchant[] = data.enchants.map((enchant) => {
  const rule = ENCHANT_RULES[enchant.id];
  if (!rule) throw new Error(`${enchant.name}: no enchant rule for spell ${enchant.id}`);
  return {
    id: enchant.id,
    name: enchant.name,
    icon: enchant.icon,
    source: enchant.source,
    slots: rule.slots,
    stats: rule.stats,
    unmodelled: rule.unmodelled,
    tooltip: enchant.tooltip,
  };
});

/** Enchant Weapon - Crusader, named because presets reference it directly. */
export const CRUSADER: Enchant = ENCHANTS[0];

/** Enchant Weapon - Spell Power, the caster sets' weapon enchant. */
export const SPELL_POWER_ENCHANT: Enchant = ENCHANTS[1];

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
