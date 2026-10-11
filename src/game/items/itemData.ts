import type { DamageSchool, PartialStats } from '../../engine';
import type { CombatStyleId } from '../character/ids';
import { DAMAGE_SCHOOLS, RATING_PER_PERCENT } from '../../engine';
import type { Enchant, EquipmentSlot, Item, ItemWeapon, UnmodelledEffect } from './Item';
import { FOREVER_ENCHANTS, FOREVER_ENCHANT_ID_BASE } from './foreverEnchants';
import foreverNewEpics from '../../data/items/forever-new-epics.json';
import foreverChangedEpics from '../../data/items/forever-changed-epics.json';
import foreverNewRares from '../../data/items/forever-new-rares.json';
import foreverChangedRares from '../../data/items/forever-changed-rares.json';
import foreverSame from '../../data/items/forever-same.json';
import weaponEnchants from '../../data/items/weapon-enchants.json';
import { BENCHMARK_ITEMS } from './benchmarkSets';

/**
 * Items, from WoW: Forever's own client data.
 *
 * ==============================================================================
 * FIVE CAPTURES FROM `foreverchanges.pro`, imported into `src/data/items/*.json`
 * by `tools/import_forever_items.mjs` and hash-checked on the way in. Those
 * files are the record; this one turns them into what the simulator uses.
 *
 * ONE FILE PER POPULATION, so "where did this number come from" has a per-file
 * answer: each carries its own `source` and the capture it came from.
 *
 *   forever-new-epics      items Forever ADDED
 *   forever-new-rares
 *   forever-changed-epics  Classic items Forever ALTERED  (an override layer)
 *   forever-changed-rares
 *   forever-same           Classic items Forever KEPT, captured because "new
 *                          and changed" leaves out everything it did not touch
 *
 * THE CLASSIC AND SEASON OF DISCOVERY STAND-INS ARE GONE, on the ruleset
 * owner's instruction -- "they were just random templates of items that won't
 * exist 1-to-1 in Forever". The header this replaces warned at length that
 * nothing here should be taken as Forever data. Now all of it is.
 *
 * WHAT IS AND IS NOT CARRIED OVER. An item's stats, armour, attack power,
 * ratings and school-scoped spell power all map onto engine stats and are
 * applied. Anything else -- a chance-on-hit proc, an extra attack, a set
 * bonus, a resistance -- is recorded verbatim in `unmodelled` and does
 * NOTHING. A character wearing these is therefore weaker than the same
 * character in the real game, by exactly the amount `unmodelled` lists.
 *
 * AND AN UNREAD LINE IS NOT THE SAME AS AN UNREADABLE ONE.
 * `tools/item_vocabulary.ts` groups the unread lines by SHAPE, which is how
 * three rules were found missing at once: Forever writes "+94 Spell Power",
 * "+36 Ranged Attack Power", "+4 Mana Regeneration" and "+3 Daggers Skill"
 * where Classic wrote four different sentences. **Run it when a capture is
 * refreshed**: a shape with a large count is a missing rule, where a shape
 * with a count of one is usually a real proc.
 * ==============================================================================
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
   * A THROWN WEAPON, WHICH IS THE RANGED SLOT IN CLASSIC.
   *
   * The Arcanite Blacksmith Hammer is the first one in this data. It is a real
   * weapon with damage and a speed, and Classic equips it where a bow goes --
   * so it maps to `ranged` and `weaponSlotFor` resolves it the same way. The
   * capture keeps the source's own word "Thrown" in the tooltip; only the SLOT
   * is translated.
   */
  Thrown: ['ranged'],
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
export interface EffectRule {
  readonly pattern: RegExp;
  readonly apply: (value: number, into: Record<string, number>) => void;
}

/**
 * Exported SO A TEST CAN ASK WHICH RULES THE DATA ACTUALLY REACHES.
 *
 * ----------------------------------------------------------------------------
 * A RULE THAT MATCHES NOTHING READS EXACTLY LIKE ONE THAT SOMETIMES MATCHES,
 * and that is not hypothetical here: the ranged attack power rule was written
 * for Classic's "+48 ranged Attack Power." and every one of the twelve lines
 * in the Forever data says "+36 Ranged Attack Power" with a capital R. It
 * matched nothing, for the whole dataset, and a Hunter's own bow granted no
 * ranged attack power at all.
 *
 * `items.test.ts` walks every rule against every effect line and fails on an
 * unreachable one that is not on its stated list. Seven are expected to be
 * unreachable and each is a CLASSIC wording kept for an inherited tooltip --
 * the point of the list is that an EIGHTH has to be explained.
 * ----------------------------------------------------------------------------
 */
export const EFFECT_RULES: readonly EffectRule[] = [
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
  /*
   * ---------------------------------------------------------------------------
   * FOREVER GRANTS RATINGS WHERE CLASSIC GRANTS FLAT PERCENTAGES, and the eight
   * conversions below are the ruleset owner's own table. Classic's PvP cloth
   * says "+1% spell crit"; Forever's says "+7 Critical Strike Rating".
   *
   * WHICH SIDE OF THE CONVERSION A LINE LANDS ON IS DECIDED BY WHETHER
   * ANYTHING READS THE RATING. `critRating` and `hasteRating` have readers --
   * `critChanceFrom` and `hasteMultiplierFrom` divide by the same constants --
   * so those two are stored AS RATINGS and converted at the point of use,
   * which keeps them buffable. `dodgeRating`, `parryRating` and `blockRating`
   * are declared and READ BY NOTHING, and there is no hit, defense or
   * expertise rating stat at all, so those six are converted here into the
   * flat stat the engine does read. This project's own rule is that a stat is
   * not modelled until something reads it, and six unread stats dressed as
   * modelled would be worse than one honest asymmetry.
   *
   * THE DAY A BUFF GRANTS DODGE RATING, the fix is to give those three stats a
   * reader in the derivation rather than to convert here -- a buff cannot move
   * a number that was already folded away at parse time.
   *
   * All eight are implemented though only five occur in the data today, which
   * is the "wired for one caller" failure this file has been caught by before.
   * ---------------------------------------------------------------------------
   */
  {
    // Stored as a rating: `critChanceFrom` divides by the same constant.
    pattern: /^\+(\d+) Critical Strike Rating\.?$/,
    apply: (value, into) => {
      into.critRating = (into.critRating ?? 0) + value;
    },
  },
  {
    // Stored as a rating: `hasteMultiplierFrom` divides by the same constant.
    pattern: /^\+(\d+) Haste Rating\.?$/,
    apply: (value, into) => {
      into.hasteRating = (into.hasteRating ?? 0) + value;
    },
  },
  {
    pattern: /^\+(\d+) Hit Rating\.?$/,
    apply: (value, into) => {
      into.hitChance = (into.hitChance ?? 0) + value / RATING_PER_PERCENT.hit;
    },
  },
  {
    // "1 Rating = 1 Defense Skill" -- a SKILL POINT and not a percentage, so
    // this one divides by one and is still written as a division, because the
    // day the owner changes it there must be one place to change.
    pattern: /^\+(\d+) Defense Rating\.?$/,
    apply: (value, into) => {
      into.defenseSkill = (into.defenseSkill ?? 0) + value / RATING_PER_PERCENT.defense;
    },
  },
  {
    // Expertise reduces the chance to be DODGED OR PARRIED, which is its own
    // stat here and deliberately not hit -- they come off different slices of
    // the table and are worth different amounts.
    pattern: /^\+(\d+) Expertise Rating\.?$/,
    apply: (value, into) => {
      into.dodgeParryReduction =
        (into.dodgeParryReduction ?? 0) + value / RATING_PER_PERCENT.expertise;
    },
  },
  {
    pattern: /^\+(\d+) Dodge Rating\.?$/,
    apply: (value, into) => {
      into.dodgeChance = (into.dodgeChance ?? 0) + value / RATING_PER_PERCENT.dodge;
    },
  },
  {
    pattern: /^\+(\d+) Parry Rating\.?$/,
    apply: (value, into) => {
      into.parryChance = (into.parryChance ?? 0) + value / RATING_PER_PERCENT.parry;
    },
  },
  {
    pattern: /^\+(\d+) Block Rating\.?$/,
    apply: (value, into) => {
      into.blockChance = (into.blockChance ?? 0) + value / RATING_PER_PERCENT.block;
    },
  },
  {
    /*
     * "+20 Attack Power" -- BOTH POOLS, BY THE OWNER'S HARD RULING.
     *
     * ------------------------------------------------------------------------
     * "Attack Power always equals and reaches Melee & Ranged Attack Power. And
     * Melee Attack Power NEVER reaches Ranged Attack Power." That is a ruling
     * about the WORDING wherever it appears, and it reverses what this rule
     * did: 164 item lines in this data say plain "Attack Power" and every one
     * of them was melee-only.
     *
     * CLAUDE.md RECORDED THE OPPOSITE AND RECORDED IT CAREFULLY. The owner had
     * already ruled that a CONSUMABLE's "+40 Attack Power" feeds both pools,
     * and the note concluded that "an item's wording and a consumable's are
     * now known to mean different things, and neither settles the other" --
     * because every item line here read bare "Attack Power" as melee and had
     * a separate rule for "ranged Attack Power". The reasoning was sound and
     * the general ruling supersedes it.
     *
     * TWO LINES IN THIS DATA SAY "ranged Attack Power" and they keep their own
     * rule below: ranged-only is still expressible, it is just not what the
     * bare words mean.
     * ------------------------------------------------------------------------
     */
    pattern: /^\+(\d+) Attack Power\.?$/,
    apply: (value, into) => {
      into.attackPower = (into.attackPower ?? 0) + value;
      into.rangedAttackPower = (into.rangedAttackPower ?? 0) + value;
    },
  },
  /*
   * ---------------------------------------------------------------------------
   * A BARE PRIMARY LINE, AND IT IS THE BENCHMARK GEAR THAT NEEDS IT.
   *
   * A CAPTURED item never carries one as an EFFECT: the importer sorts "+32
   * Stamina" into the raw `stats` object and leaves `effects` for the Equip
   * lines, so zero of the 1,946 items on file match any of the six rules
   * below. The GENERATED benchmark gear is written as TOOLTIP TEXT on purpose --
   * so it reaches the engine down the same path a captured item does, rather
   * than through a second copy of this parser -- and text is all it has.
   *
   * WHICH MEANT EVERY BENCHMARK SET LOST ALL ITS PRIMARIES. A Warrior's E65 set
   * came out as 328 Critical Strike Rating and **no strength, stamina or
   * agility at all**, because "+19 Strength" matched no rule and went to
   * `unmodelled`. 23.4% crit from gear is a plausible-looking figure, every set
   * was internally consistent, and the first full measurement of E65 was taken
   * with it.
   *
   * AND THE TOOL THAT EXISTS TO FIND THIS SKIPPED THEM. `item_vocabulary.ts`
   * excluded ids above 9,500,000 on the reasoning that an unread line there is
   * a bug in the generator rather than a gap in the parser -- which is true,
   * and it was the generator's bug, and excluding it is what hid it for a
   * commit. It reports them in their own section now.
   * ---------------------------------------------------------------------------
   */
  ...(['Strength', 'Agility', 'Stamina', 'Intellect', 'Spirit'] as const).map((name) => ({
    pattern: new RegExp(`^\\+(\\d+) ${name}\\.?$`),
    apply: (value: number, into: Record<string, number>) => {
      const key = name.toLowerCase();
      into[key] = (into[key] ?? 0) + value;
    },
  })),
  {
    /*
     * "+70 Armor" -- BONUS armour, which is budgeted where base armour is free.
     *
     * A captured item has this folded into its raw `armor` field by the
     * importer, base and bonus together: Field Marshal's Headdress is 92 base
     * and +70 bonus and the capture states 162. The benchmark generator keeps
     * them apart, because only one of the two costs budget -- so the Bear's
     * "Bonus Armor" preference is written as a line and read here.
     */
    pattern: /^\+(\d+) Armor\.?$/,
    apply: (value, into) => {
      into.armor = (into.armor ?? 0) + value;
    },
  },
  {
    /*
     * "+36 Ranged Attack Power" -- the RANGED pool, which is a different
     * stat and not a subset of the one above.
     *
     * ------------------------------------------------------------------------
     * THIS PATTERN MATCHED NOTHING IN THE CURRENT DATA AND READ EXACTLY LIKE A
     * WORKING RULE. It was written for Classic's wording, "+48 ranged Attack
     * Power." with a lower-case r, and the comment it replaces said so: "a
     * Hunter's gear says this on a trinket and on the bow itself". It did --
     * on the Season of Discovery stand-ins, which are deleted. **Forever
     * writes a capital R and no full stop, and all TWELVE lines in the data
     * are Forever's**, so the rule was always false and every one of them fell
     * through to `unmodelled`.
     *
     * WHAT IT COST IS A HUNTER'S OWN BOW. Rhok'delar is +17, the two PvP bows
     * and both guns are +36, and the Zandalar bracers are +34 -- so the one
     * stat a ranged build cares about most was being dropped by the one rule
     * written to catch it. Found by `tools/item_vocabulary.ts`, which groups
     * unread lines by shape: twelve identical shapes is a missing RULE, where
     * one is usually a real proc.
     *
     * CASE-INSENSITIVE ON THAT ONE WORD, so Classic's wording still parses if
     * a Classic tooltip is ever read again -- a rule that covers both costs
     * nothing and the alternative is this bug a second time.
     * ------------------------------------------------------------------------
     */
    pattern: /^\+(\d+) [Rr]anged Attack Power\.?$/,
    apply: (value, into) => {
      into.rangedAttackPower = (into.rangedAttackPower ?? 0) + value;
    },
  },
  {
    /*
     * "+4 Mana Regeneration" -- MANA PER FIVE SECONDS, and the unit is
     * settled by the ruleset's own data rather than assumed.
     *
     * ------------------------------------------------------------------------
     * THE CONTROL GROUP ANSWERS IT. 252 of the changed items carry Classic's
     * own lines beside Forever's in `tools/data/forever-changed.capture.json`,
     * and Field Marshal's Headdress reads "Restores 4 mana per 5 sec." in
     * Classic and "+4 Mana Regeneration" in Forever. **The same number**, so
     * the compact rewrite keeps the per-five-seconds unit and `manaPer5` is
     * where it lands.
     *
     * A GUESS HERE WOULD HAVE BEEN FIVE TIMES OUT IN EITHER DIRECTION and
     * entirely plausible: "+4 Mana Regeneration" reads just as naturally as 4
     * mana a second. The pairs are what made it a fact.
     *
     * 160 LINES, every one of them a caster piece, and mana RETURN is
     * explicitly not out of scope -- it changes a damage profile's sustain.
     * ------------------------------------------------------------------------
     */
    pattern: /^\+(\d+) Mana Regeneration\.?$/,
    apply: (value, into) => {
      into.manaPer5 = (into.manaPer5 ?? 0) + value;
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
     * -------------------------------------------------------------------------
     * FOREVER'S OWN WORDING, AND 1,384 LINES WERE FALLING THROUGH THIS GAP.
     *
     * Classic writes "Increases damage and healing done by magical spells and
     * effects by up to 40" and Forever writes "+94 Spell Power". The rule above
     * only ever saw the Classic sentence, so EVERY Forever caster item in the
     * database granted zero spell power while stating it on the tooltip --
     * Premier High Warlord's War Staff reported +94 and delivered nothing.
     *
     * Invisible because no preset wears one: the Forever items were added as a
     * browsable database rather than as gear anything equips, so no published
     * figure moved and nothing failed. **An item in the database and in no
     * profile is the quietest place in this project for a stat to go missing**,
     * which is the `ability_audit` lesson wearing different clothes.
     *
     * "Spell Damage" IS THE SAME STAT HERE. Forever distinguishes Spell Power
     * (damage and healing) from Spell Damage (damage only) and the engine has
     * no healing stat at all, so both reach `spellPower` and the difference is
     * carried in the tooltip rather than in a number that does nothing.
     * -------------------------------------------------------------------------
     */
    pattern: /^\+(\d+) Spell (?:Power|Damage)\.?$/,
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

/**
 * Bonus weapon skill, which is a weapon property rather than a stat.
 *
 * ----------------------------------------------------------------------------
 * TWO WORDINGS FOR ONE THING, AND THE RULESET USES THE SECOND. Classic says
 * "Increased Daggers +3." and Forever says "+3 Daggers Skill" -- Death's Sting
 * and Frenzied Striker are the two items in the data that carry it, and
 * neither was read until `tools/item_vocabulary.ts` grouped the unread lines
 * by shape.
 *
 * SMALL, AND THE SAME CLASS OF MISTAKE AS THE 1,384 SPELL POWER LINES: a stat
 * the source names unambiguously, dropped because the parser knew only the
 * other era's sentence for it. Both are kept, because a Classic tooltip is
 * still read for an item Forever inherited.
 *
 * THE CLASSIC FORM MATCHES "Increased Defense +7" TOO, which is why the named
 * rules in `EFFECT_RULES` are tried first -- a weapon's bonus skill on a
 * breastplate is dropped on the floor, because only a weapon carries one. The
 * Forever form needs no such care: nothing says "Defense Skill".
 * ----------------------------------------------------------------------------
 */
const WEAPON_SKILL_PATTERNS: readonly RegExp[] = [
  /^Increased ([\w\- ]+) \+(\d+)\.?$/,
  /^\+(\d+) ([\w\- ]+) Skill\.?$/,
];

/** The skill points a weapon-skill line grants, or undefined if it is not one. */
function weaponSkillFrom(text: string): number | undefined {
  const classic = text.match(WEAPON_SKILL_PATTERNS[0]);
  if (classic) return Number(classic[2]);
  const forever = text.match(WEAPON_SKILL_PATTERNS[1]);
  if (forever) return Number(forever[1]);
  return undefined;
}

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
 * The same thing in Forever's words: "+36 Fire Spell Damage".
 *
 * Capture order is reversed from the Classic pattern -- the school comes
 * second there and first here -- so `schoolSpellPower` normalises both into
 * (school, amount) rather than either caller reading groups by position.
 */
const FOREVER_SCHOOL_SPELL_POWER_PATTERN =
  /^\+(\d+) (\w+) Spell (?:Damage|Power)\.?$/;

/** (school, amount) from either wording, or undefined. */
function schoolSpellPower(text: string): readonly [string, number] | undefined {
  const classic = SCHOOL_SPELL_POWER_PATTERN.exec(text);
  if (classic) return [classic[1], Number(classic[2])];
  const forever = FOREVER_SCHOOL_SPELL_POWER_PATTERN.exec(text);
  if (forever) return [forever[2], Number(forever[1])];
  return undefined;
}

/**
 * "+172 Attack Power in Cat, Bear, and Dire Bear forms only."
 *
 * ----------------------------------------------------------------------------
 * A STAT SCOPED TO A COMBAT STYLE, handled here for the same reason the two
 * patterns above are: it does not land in `stats`, because `stats` is
 * unconditional. It goes on `Item.styleStats`, which `statsForStyle` reads --
 * the one function that already knows which style the character is in.
 *
 * ONE ITEM LINE IN THE WHOLE DATA SAYS IT, the Glaive of Obsidian Fury, worn by
 * both feral Druid profiles. HANDOVER.md has listed those two figures as
 * understated by a known amount ever since, and this is that amount.
 *
 * THE FORM LIST IS MAPPED IN FULL OR NOT AT ALL. `FORM_STYLES` translates the
 * form names Forever uses into the styles the engine has -- Dire Bear is Bear,
 * because there is one bear style -- and a list containing anything unmapped
 * falls through to `unmodelled` rather than applying the part that matched. A
 * line naming Travel Form is reported, not half-credited.
 * ----------------------------------------------------------------------------
 */
const FORM_ATTACK_POWER_PATTERN = /^\+(\d+) Attack Power in ([\w, ]+?) forms? only\.?$/;

/** The form names Forever writes, and the combat style each one is. */
const FORM_STYLES: Readonly<Record<string, CombatStyleId>> = {
  cat: 'cat',
  bear: 'bear',
  'dire bear': 'bear',
  moonkin: 'moonkin',
};

/**
 * Every style a form list names, or `undefined` if any name is unmapped.
 *
 * "Cat, Bear, and Dire Bear" -- split on commas with a leading `and` dropped,
 * because the tooltip writes an Oxford list. Two names mapping to one style is
 * fine and happens: Bear and Dire Bear are both `bear`, and the set folds them.
 */
function stylesFromFormList(list: string): readonly CombatStyleId[] | undefined {
  const styles = new Set<CombatStyleId>();
  for (const part of list.split(',')) {
    const name = part.trim().replace(/^and /i, '').toLowerCase();
    if (name === '') continue;
    const style = FORM_STYLES[name];
    if (!style) return undefined;
    styles.add(style);
  }
  return styles.size > 0 ? [...styles] : undefined;
}

/**
 * Effects implemented as reactions in `procs.ts` rather than as stats.
 *
 * They are neither a stat nor unmodelled: a proc is behaviour, so it lives with
 * the other behaviour and is listed here only so it stops being reported as
 * missing. The ruleset owner supplied the rates the tooltips do not give.
 */
/**
 * The item procs the simulator implements, by the WORDING that names them.
 *
 * ==============================================================================
 * KEYED BY THE SOURCE'S OWN WORDS RATHER THAN BY ITEM ID, and that is a change
 * the real data forced. `procs.ts` used to install Vis'kag's Fatal Wound by
 * testing `item.id === 17075` and Hand of Justice's extra attack against a list
 * of two ids -- **and neither item is in Forever's data at all.** Both are in
 * `missing.json`: the ruleset removed them.
 *
 * SO THE BINDING WAS THREE DEAD IDS AND THE MECHANISMS WERE UNREACHABLE. Keyed
 * on the wording instead, an item Forever adds that says "Delivers a fatal
 * wound for 240 damage" gets the implementation for free -- which is the
 * arrangement `AuraDefinition.isBleed` already uses for the same reason: a
 * ruleset TAG the engine reads, rather than a list somebody has to remember to
 * extend.
 *
 * IT IS ALSO ONE SOURCE OF TRUTH FOR TWO QUESTIONS that have to agree. A line
 * is kept OUT of `unmodelled` because it is implemented, and the reaction is
 * INSTALLED because it is implemented -- and those were two separate lists.
 * `reasonFor` and `reactionsForEquipment` read this one.
 * ==============================================================================
 */
export const ITEM_PROCS = {
  /** Vis'kag the Bloodletter, and anything Forever gives the same line. */
  fatalWound: /Delivers a fatal wound for \d+ damage/,
  /** Hand of Justice. */
  extraAttack: /chance on melee hit to gain 1 extra attack/,
} as const;

const MODELLED_AS_PROCS: readonly RegExp[] = Object.values(ITEM_PROCS);

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
  /*
   * REACHED ONLY BY A FORM LIST `FORM_STYLES` CANNOT MAP, now that
   * `FORM_ATTACK_POWER_PATTERN` applies the ones it can. The old reason said
   * "an item stat cannot be conditional on the combat style", which was true
   * and is not -- `Item.styleStats` is that condition -- so this says what is
   * actually missing instead.
   */
  if (/forms? only\.?$/.test(text)) {
    return (
      'Names a form the engine has no combat style for, or a stat other than ' +
      'attack power, so the whole line is listed rather than half-applied.'
    );
  }
  return 'No engine mechanic for this yet.';
}

function buildStats(item: RawItem): {
  stats: PartialStats;
  schoolPower: Partial<Record<DamageSchool, number>>;
  styleStats: Partial<Record<CombatStyleId, PartialStats>>;
  unmodelled: UnmodelledEffect[];
  bonusSkill: number;
} {
  const stats: Record<string, number> = {};
  const schoolPower: Partial<Record<DamageSchool, number>> = {};
  const styleStats: Partial<Record<CombatStyleId, Record<string, number>>> = {};
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
     * `WEAPON_SKILL_PATTERNS` holds `Increased <anything> +N`, so it also matches
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

    const skill = weaponSkillFrom(effect.text);
    if (skill !== undefined) {
      bonusSkill += skill;
      continue;
    }

    /*
     * Spell power for one school. Tried after the named rules and after
     * weapon skill, alongside them rather than in `EFFECT_RULES`, because
     * like weapon skill it is not a flat stat and has nowhere to land in
     * `stats`.
     */
    const scoped = schoolSpellPower(effect.text);
    if (scoped) {
      const school = scoped[0].toLowerCase() as DamageSchool;
      // Validated, not assumed: an unrecognised school is reported rather
      // than silently credited to whichever one the cast happens to be.
      if (DAMAGE_SCHOOLS.includes(school)) {
        schoolPower[school] = (schoolPower[school] ?? 0) + scoped[1];
        continue;
      }
    }

    /*
     * Attack power that only one FORM reads. Tried with the two above and for
     * the same reason: it is a real stat, and what is unusual is the condition.
     */
    const scopedToForm = effect.text.match(FORM_ATTACK_POWER_PATTERN);
    if (scopedToForm) {
      const styles = stylesFromFormList(scopedToForm[2]);
      if (styles) {
        for (const style of styles) {
          const into = (styleStats[style] ??= {});
          into.attackPower = (into.attackPower ?? 0) + Number(scopedToForm[1]);
        }
        continue;
      }
    }

    unmodelled.push({
      kind: effect.kind,
      text: effect.text,
      reason: reasonFor(effect.kind, effect.text),
    });
  }

  return {
    stats: stats as PartialStats,
    schoolPower,
    styleStats: styleStats as Partial<Record<CombatStyleId, PartialStats>>,
    unmodelled,
    bonusSkill,
  };
}

/*
 * FOREVER_SPELL_POWER_BUFFS IS GONE, AND THE REAL DATA IS WHY.
 *
 * ==============================================================================
 * It carried the ruleset owner's +64 spell power on four caster weapons as a
 * hand-maintained layer over the Classic scrape -- Staff of Dominance,
 * Sorcerous Dagger, Azuresong Mageblade and Anathema. **Three of the four are
 * in Forever's own `missing.json`: the ruleset REMOVED those items.** The
 * fourth, Anathema, is in `changed.json` at id 18609 carrying Forever's own
 * wording, so the client states what the override used to assert.
 *
 * WHAT THE SHAPE WAS RIGHT ABOUT IS WORTH KEEPING. It was A DELTA AND NOT A
 * TOTAL on purpose: the owner gave +64 as a bonus, two of their four stated
 * bases disagreed with the scrape, and a bonus survives a re-scrape meaning
 * the same thing where a total silently reinstates whatever Classic says.
 * `ENCHANT_RULES` below is the same shape for the same reason.
 *
 * AND IT TAUGHT THAT AN OVERRIDE KEYED BY ID IS SILENT WHEN THE ID IS WRONG.
 * Two entries were first written with Classic ids where the data held Season
 * of Discovery ones -- 17103 and 18608 against 228269 and 228336. It
 * typechecked, the suite passed, and the buff reached nothing for half the
 * items it named. `forever-changed-*.json` is the override layer now:
 * generated, hashed, and matched by id with `FOREVER_OVERRIDDEN_IDS` exported
 * so a test can pin how many ids actually collide.
 * ==============================================================================
 */

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

  const { stats, schoolPower, styleStats, unmodelled, bonusSkill } = buildStats(item);

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
    ...(item.subclass ? { subclass: item.subclass } : {}),
    inventoryType: item.inventoryType,
    slots,
    stats,
    schoolPower,
    styleStats,
    ...(weapon ? { weapon } : {}),
    unmodelled,
    resistances,
    tooltip: item.tooltip,
  };
}

/*
 * EVERY item file, and they are ALL FOREVER'S OWN now.
 *
 * ----------------------------------------------------------------------------
 * The nine Classic and Season of Discovery files are gone on the ruleset
 * owner's instruction -- "random templates of items that won't exist 1-to-1 in
 * Forever" -- and with them `gearSets.ts`, `tools/item-sets.json` and the
 * importer that built them. What is left is what the beta client has:
 *
 *   forever-new-epics      items only Forever has
 *   forever-new-rares
 *   forever-changed-epics  Classic items Forever altered  (an override layer)
 *   forever-changed-rares
 *   forever-same           Classic items Forever KEPT, captured because "new
 *                          and changed" leaves out everything it did not touch
 *
 * The comment this replaces explained which file owned a shared piece, because
 * twenty-two items were worn by more than one stand-in set. Nothing is shared
 * any more: a Forever capture carries each id once.
 * ----------------------------------------------------------------------------
 */
const ITEM_FILES: readonly RawData[] = [
  foreverNewEpics,
  foreverNewRares,
  foreverSame,
] as unknown as readonly RawData[];

/**
 * CLASSIC ITEMS FOREVER CHANGED, and they OVERRIDE what is on file.
 *
 * ----------------------------------------------------------------------------
 * Kept out of `ITEM_FILES` on purpose, because its entries are allowed to
 * share an id with a stand-in and the duplicate check below must keep throwing
 * for everything else. The ruleset owner's ruling is that the Forever side is
 * definitive, so a Classic or Season of Discovery entry with the same id is
 * REPLACED rather than merged -- merged is how an item ends up with Classic's
 * flat "+1% crit" and Forever's "+14 Critical Strike Rating" both applied.
 *
 * NOTHING COLLIDES TODAY, AND THE LAYER STAYS ANYWAY. Three ids used to --
 * The Immovable Object, Don Julio's Band and The Unstoppable Force -- and all
 * three collisions were against the CLASSIC stand-ins, which are deleted.
 * Forever's own five captures carry each id exactly once.
 *
 * IT IS KEPT BECAUSE `same.json` AND `changed.json` ARE TWO READINGS OF ONE
 * CLIENT. A refreshed capture can legitimately list an item in both, and the
 * alternative to this layer is the duplicate check throwing -- or worse,
 * merging, which is how an item ends up carrying both wordings of the same 1%.
 * `FOREVER_OVERRIDDEN_IDS` is exported so a test can pin the count, and
 * `items.test.ts` asserts it is EMPTY: the day it is not, that says so.
 * ----------------------------------------------------------------------------
 */
const OVERRIDE_FILES = [foreverChangedEpics, foreverChangedRares] as unknown as readonly RawData[];
const OVERRIDE_ITEMS: readonly RawItem[] = OVERRIDE_FILES.flatMap((file) => file.items);

const BASE_ITEMS = ITEM_FILES.flatMap((file) => file.items);

const duplicates = BASE_ITEMS.map((item) => item.id).filter(
  (id, index, all) => all.indexOf(id) !== index,
);
if (duplicates.length > 0) {
  throw new Error(`Duplicate item ids across the item files: ${duplicates.join(', ')}`);
}

/**
 * How many stand-ins the Forever override replaces.
 *
 * Exported so a test can pin it: an override that silently stops matching --
 * because an id moved, or a file was renamed -- would leave the Classic
 * version in place and look like nothing at all.
 */
export const FOREVER_OVERRIDDEN_IDS: readonly number[] = OVERRIDE_ITEMS
  .map((item) => item.id)
  .filter((id) => BASE_ITEMS.some((item) => item.id === id))
  .sort((a, b) => a - b);

const overrideById = new Map(OVERRIDE_ITEMS.map((item) => [item.id, item] as const));

const RAW_ITEMS: readonly RawItem[] = [
  ...BASE_ITEMS.map((item) => overrideById.get(item.id) ?? item),
  ...OVERRIDE_ITEMS.filter((item) => !BASE_ITEMS.some((base) => base.id === item.id)),
];

const CAPTURED_ITEMS: readonly Item[] = RAW_ITEMS.map(buildItem);

/**
 * SYNTHETIC BENCHMARK GEAR, resolvable but NOT BROWSABLE.
 *
 * ----------------------------------------------------------------------------
 * Generated from the itemization budget rather than captured, so it is kept out
 * of `itemsForSlot` and no dropdown ever offers one -- a person browsing a slot
 * sees real items only. `ITEMS_BY_ID` resolves them, because that is what an
 * equipped set needs, and `ITEMS` carries them so the character sheet and the
 * Gear panel can describe what is equipped.
 *
 * `src/data/items/` stays captured data ONLY. These are built in code, named
 * for the set they belong to, and numbered from 9,500,000.
 * ----------------------------------------------------------------------------
 */
const BENCHMARK = BENCHMARK_ITEMS.map((item) => buildItem(item as unknown as RawItem));

export const ITEMS: readonly Item[] = [...CAPTURED_ITEMS, ...BENCHMARK];

/** Ids that `itemsForSlot` must not offer. */
const BENCHMARK_IDS: ReadonlySet<number> = new Set(BENCHMARK.map((item) => item.id));

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

/*
 * THE TWO SCRAPED ENCHANTS SURVIVED THE DELETION, in a file of their own.
 *
 * They used to ride along in `classic-warrior.json` beside its items, and that
 * file is gone -- but Crusader and Weapon Spell Power are not Classic
 * STAND-INS the way the items were. They have a real Wowhead spell id, an icon
 * and a tooltip, every preset still names one, and `foreverEnchants.ts` is
 * explicitly the owner's own table of the OTHER 28. Losing them with the items
 * would have silently unenchanted every weapon in the project.
 */
const SCRAPED_ENCHANTS: readonly Enchant[] = (
  weaponEnchants as unknown as RawData
).enchants.map((enchant) => {
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

/**
 * Every enchant: the two scraped WEAPON ones, then the owner's ARMOUR table.
 *
 * ----------------------------------------------------------------------------
 * TWO SOURCES AND THEY ARE NOT THE SAME KIND OF THING, which is why they are
 * built in two places and only joined here. Crusader and Weapon Spell Power
 * came out of Wowhead with a spell id, an icon and a tooltip, and
 * `ENCHANT_RULES` says what the simulator does with the words. The armour
 * enchants are the ruleset owner's own table -- an effect and a slot, no spell
 * behind either -- so they are declared outright in `foreverEnchants.ts` and
 * carry simulator-allocated ids.
 *
 * THE WEAPON ENCHANTS COME FIRST AND ARE UNTOUCHED, on purpose: they are the
 * ones every melee and caster gear set already names, and nothing about them
 * changes because a second source now sits beside them.
 * ----------------------------------------------------------------------------
 */
export const ENCHANTS: readonly Enchant[] = [...SCRAPED_ENCHANTS, ...FOREVER_ENCHANTS];

/*
 * THE TWO ID SPACES MUST NOT MEET.
 *
 * `enchantId` is a bare number in a saved profile and `ENCHANTS_BY_ID` is one
 * map, so a Forever enchant landing on a scraped spell id would silently
 * resolve to the wrong enchant. The block is chosen far clear of it; this is
 * what makes that a check rather than an assumption.
 *
 * ITEM IDS ARE CHECKED TOO, and that one is belt-and-braces rather than live:
 * an item and an enchant are looked up in different maps, so a shared number
 * costs nothing today. It is still the cheapest guard against a future reader
 * who sees one id space where there are two.
 */
{
  const ids = new Set<number>();
  for (const enchant of ENCHANTS) {
    if (ids.has(enchant.id)) throw new Error(`Duplicate enchant id ${enchant.id}`);
    ids.add(enchant.id);
  }
  for (const enchant of FOREVER_ENCHANTS) {
    if (enchant.id <= FOREVER_ENCHANT_ID_BASE) {
      throw new Error(`${enchant.name}: id ${enchant.id} is outside the Forever enchant block`);
    }
    if (ITEMS_BY_ID.has(enchant.id)) {
      throw new Error(`${enchant.name}: id ${enchant.id} is also an item id`);
    }
  }
}

/** Enchant Weapon - Crusader, named because presets reference it directly. */
export const CRUSADER: Enchant = SCRAPED_ENCHANTS[0];

/** Enchant Weapon - Spell Power, the caster sets' weapon enchant. */
export const SPELL_POWER_ENCHANT: Enchant = SCRAPED_ENCHANTS[1];

export const ENCHANTS_BY_ID: ReadonlyMap<number, Enchant> = new Map(
  ENCHANTS.map((enchant) => [enchant.id, enchant] as const),
);

/** Items that can go in a slot. */
export function itemsForSlot(slot: EquipmentSlot): readonly Item[] {
  // Benchmark gear is excluded: it is generated rather than captured, and a
  // dropdown that offered "E85 Chest" beside real loot would be the one place
  // somebody could mistake it for Forever data.
  return ITEMS.filter((item) => !BENCHMARK_IDS.has(item.id) && item.slots.includes(slot));
}

/** Enchants that can go on a slot. */
export function enchantsForSlot(slot: EquipmentSlot): readonly Enchant[] {
  return ENCHANTS.filter((enchant) => enchant.slots.includes(slot));
}
