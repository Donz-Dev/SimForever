import type {
  AbilityModifier,
  AttackTableKind,
  DamageSchool,
  PartialStats,
} from '../../engine';
import { AttackTableModifiers } from '../../engine';

/**
 * CONSUMABLES, FROM THE RULESET OWNER'S TABLE.
 *
 * ----------------------------------------------------------------------------
 * Twelve CATEGORIES, each offering one or more consumables, and **at most one
 * per category may be chosen**. That exclusivity is the whole shape of the
 * feature: a flask is a flask, and a character drinking two is not a character
 * anybody is trying to measure.
 *
 * THE EXCLUSIVITY IS STRUCTURAL RATHER THAN CHECKED. A selection is a map from
 * CATEGORY id to consumable id, so holding two from one category is not
 * representable -- the second write replaces the first. `RaidBuff.exclusiveWith`
 * is a selection RULE enforced by the panel, and this project has already
 * learned what that costs: the Moonkin's +3% crit went to +6% because the rule
 * lived in a chooser and a TALENT reached the same aura without passing through
 * it. A shape that cannot express the mistake needs no chooser to be honest.
 *
 * THEY ARE STATS, NOT AURAS, which is the other difference from a raid buff.
 * A raid buff is an aura because it has a lifecycle -- Windfury's window opens
 * and closes, Sunder Armor stacks. A consumable is drunk before the pull and
 * lasts the fight, so it is a layer of the starting stat block, and the
 * character sheet reads it for free. Nothing here needs an uptime row.
 *
 * NOTHING IS ON BY DEFAULT at the profile level, exactly as raid buffs are not:
 * a consumable that applied itself would move every figure ever recorded. What
 * the 24 PRESETS open with is a different question and is answered in
 * `presets.ts`.
 *
 * EVERY NUMBER IS THE OWNER'S, straight off their table. Nothing here is
 * Classic, nothing is scraped, and the ids are the simulator's own because the
 * table names an effect rather than an item -- the same arrangement
 * `foreverEnchants.ts` has, and for the same reason.
 * ----------------------------------------------------------------------------
 */

/** One consumable: a choice within its category. */
export interface Consumable {
  /**
   * Stable id. A saved profile stores it, so renaming one breaks saved
   * profiles -- the same contract `RaidBuff.id` has.
   */
  readonly id: string;
  /** The owner's own wording for the effect, which is all the table gives. */
  readonly name: string;
  /** What it adds to the starting stat block. */
  readonly stats?: PartialStats;
  /**
   * Spell power only ONE school's damage reads.
   *
   * `STAT_NAMES` is a closed flat set with no room for a keyed stat, so this
   * takes the route seventeen item lines already take: a `SchoolModifiers`
   * entry, which `spellPowerFor` adds to the school-blind pool at the point of
   * use. The six School Spell Power entries are the only callers.
   */
  readonly schoolPower?: Readonly<Partial<Record<DamageSchool, number>>>;
  /**
   * Flat maximum health, which is NOT a stat and cannot be one.
   *
   * ------------------------------------------------------------------------
   * `STAT_NAMES` has no `hitPoints`: health is a MAXIMUM computed once from a
   * stamina snapshot, `baseHitPointsFor(...) + derived.hitPoints`. "+1200 Hit
   * Points" is neither stamina nor a conversion of it, and turning it into
   * stamina at some rate would be inventing a number the owner did not give.
   *
   * So it arrives at `createPlayer` as its own term and is added to the
   * maximum. **IT ALSO CHANGES RAGE**, which is worth knowing rather than
   * discovering: Forever's rule is `D x 10 / H`, so a bigger pool makes each
   * point of damage taken worth less rage. That is the formula doing what it
   * says and not a side effect to correct.
   * ------------------------------------------------------------------------
   */
  readonly bonusHitPoints?: number;
  /**
   * Crit, crit damage, hit or damage scoped to ONE ATTACK TABLE.
   *
   * ------------------------------------------------------------------------
   * "+2% MELEE Crit Chance" is the only caller, and it is here rather than in
   * `stats` because `critChance` is not a melee stat. `critChanceFrom` is the
   * ONE crit function the engine has and both the melee and the ranged tables
   * read it -- so granting `critChance` would hand two points to every shot a
   * Hunter fires, from a line that says "Melee".
   *
   * WHAT SETTLES IT IS THE OWNER'S OWN PAIR OF LABELS. Their table writes
   * "+2% Melee Crit Chance" on this row and "+2% Crit Chance" on the Agility
   * row, and asked which the second one meant they said melee and ranged. Two
   * labels that both meant `critChance` would be the same label, so the first
   * one is narrower than the stat: `melee-auto` and `melee-special`, which is
   * every melee attack and no other kind.
   * ------------------------------------------------------------------------
   */
  readonly attackTableModifiers?: Readonly<Partial<Record<AttackTableKind, AbilityModifier>>>;
  /** What it does that the simulator does not, in the source's own words. */
  readonly unmodelled?: string;
}

/** A group of consumables, of which at most one may be chosen. */
export interface ConsumableCategory {
  readonly id: string;
  /** The owner's own name for the row. */
  readonly name: string;
  readonly options: readonly Consumable[];
}

/**
 * The table, row for row.
 *
 * The order is the owner's, and the ids are derived from the effect rather than
 * from the row, so a consumable that appears in two categories would be two
 * entries with two ids. Two do look alike and are deliberately separate:
 * "+25 Agility" in Blasted Lands is not the Agility row's "+25 Agility & +2%
 * Crit Chance", and "+40 Attack Power" appears as its own category AND as a
 * Food -- which is what lets a character take both.
 */
export const CONSUMABLE_CATEGORIES: readonly ConsumableCategory[] = [
  {
    id: 'flask',
    name: 'Flask',
    options: [
      { id: 'flask_hit_points', name: '+1200 Hit Points', bonusHitPoints: 1200 },
      { id: 'flask_spell_power', name: '+150 Spell Power', stats: { spellPower: 150 } },
    ],
  },
  {
    id: 'weapon_effect',
    name: 'Weapon Effect',
    options: [
      {
        /*
         * MELEE ALONE, AND THAT IS WHY IT IS NOT `critChance`.
         *
         * `critChance` is the engine's one melee-AND-ranged crit stat --
         * `critChanceFrom` is read by both tables -- so granting it would give
         * two points to every shot a Hunter fires from a line that says
         * "Melee". The owner's table says "+2% Melee Crit Chance" here and
         * "+2% Crit Chance" on the Agility row, and they ruled that the second
         * means melee AND ranged; two labels meaning the same stat would be
         * one label. See `attackTableModifiers`.
         */
        id: 'weapon_melee_crit',
        name: '+2% Melee Crit Chance',
        attackTableModifiers: {
          'melee-auto': { critBonus: 2 },
          'melee-special': { critBonus: 2 },
        },
      },
      {
        // The caster half of the same row, and it names its crit the other way.
        id: 'weapon_spell_crit',
        name: '+1% Spell Crit Chance & +36 Spell Power',
        stats: { spellCritChance: 1, spellPower: 36 },
      },
    ],
  },
  {
    id: 'strength',
    name: 'Strength',
    options: [{ id: 'elixir_strength', name: '+30 Strength', stats: { strength: 30 } }],
  },
  {
    id: 'agility',
    name: 'Agility',
    options: [
      {
        /*
         * THE CRIT HERE IS MELEE AND RANGED, NOT SPELL, and that is the owner's
         * ruling rather than a reading of the wording.
         *
         * The row says "+2% Crit Chance" where the Weapon Effect row above says
         * "+2% Melee Crit Chance", and the obvious reading of a difference like
         * that is that the second one is wider -- "with all spells and attacks"
         * is how sixty-two item lines in this project say exactly that, and it
         * would have been worth two points of crit to every caster profile.
         * Asked, the owner said melee and ranged. `critChance` is that stat and
         * `spellCritChance` is the other one.
         */
        id: 'elixir_agility',
        name: '+25 Agility & +2% Crit Chance',
        stats: { agility: 25, critChance: 2 },
      },
    ],
  },
  {
    id: 'attack_power',
    name: 'Attack Power',
    options: [
      {
        /*
         * BOTH POOLS, BY THE OWNER'S RULING: "+40 Attack Power is truly Melee
         * Attack AND Ranged attack power for this consumable."
         *
         * ------------------------------------------------------------------
         * IT SHIPPED THE OTHER WAY FOR ONE REVIEW, AND THE REASONING FOR THAT
         * WAS SOUND. Every item line in this project reads bare "Attack Power"
         * as `attackPower` and has a separate rule for "+48 ranged Attack
         * Power", so a consumable saying the same words looked like the same
         * thing; and the owner's ONE existing ruling the other way -- Careful
         * Aim's "Attack Power" feeds both pools -- is about a talent, and a
         * ruling covers what it says and is not extended by analogy. That is
         * the lesson Explosive Trap taught, where waiting was right and cost
         * nothing.
         *
         * WAITING WAS RIGHT HERE TOO AND THE ANSWER CAME BACK THE OTHER WAY,
         * which is worth recording rather than quietly correcting: the price of
         * asking was one review, and the price of guessing would have been two
         * Hunter profiles carrying an elixir worth nothing with nobody to
         * notice. **An item's wording and a consumable's are now known to mean
         * different things**, so neither settles the other.
         * ------------------------------------------------------------------
         */
        id: 'elixir_attack_power',
        name: '+40 Attack Power',
        stats: { attackPower: 40, rangedAttackPower: 40 },
      },
    ],
  },
  {
    id: 'blasted_lands',
    name: 'Blasted Lands',
    options: [
      { id: 'blasted_agility', name: '+25 Agility', stats: { agility: 25 } },
      { id: 'blasted_strength', name: '+25 Strength', stats: { strength: 25 } },
      { id: 'blasted_intellect', name: '+25 Intellect', stats: { intellect: 25 } },
      { id: 'blasted_spirit', name: '+25 Spirit', stats: { spirit: 25 } },
    ],
  },
  {
    id: 'mana_regen',
    name: 'Mana Regen',
    options: [
      {
        // `manaPer5` is exactly this quantity and the regeneration rule already
        // reads it -- Blessing of Wisdom grants 40 of the same stat.
        id: 'mana_regen_12',
        name: '+12 MP5',
        stats: { manaPer5: 12 },
      },
    ],
  },
  {
    id: 'hit_points',
    name: 'Hit Points',
    options: [{ id: 'hit_points_120', name: '+120 Hit Points', bonusHitPoints: 120 }],
  },
  {
    id: 'armor',
    name: 'Armor',
    options: [
      {
        /*
         * NOT "ARMOR FROM ITEMS", which is the ruling the owner gave for the
         * cloak enchant's +60 and applies here with more force rather than less:
         * a potion is not a worn item by any reading. So Toughness and Thick
         * Hide do not scale it. `armorFromItems` sums ITEM stats directly, so
         * this is already outside it and needs no exclusion of its own.
         */
        id: 'armor_450',
        name: '+450 Armor',
        stats: { armor: 450 },
      },
    ],
  },
  {
    id: 'spell_power',
    name: 'Spell Power',
    options: [{ id: 'spell_power_35', name: '+35 Spell Power', stats: { spellPower: 35 } }],
  },
  {
    id: 'school_spell_power',
    name: 'School Spell Power',
    options: [
      { id: 'school_fire', name: '+40 Fire Spell Power', schoolPower: { fire: 40 } },
      { id: 'school_shadow', name: '+40 Shadow Spell Power', schoolPower: { shadow: 40 } },
      { id: 'school_arcane', name: '+40 Arcane Spell Power', schoolPower: { arcane: 40 } },
      { id: 'school_frost', name: '+40 Frost Spell Power', schoolPower: { frost: 40 } },
      { id: 'school_nature', name: '+40 Nature Spell Power', schoolPower: { nature: 40 } },
      { id: 'school_holy', name: '+40 Holy Spell Power', schoolPower: { holy: 40 } },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    options: [
      {
        /*
         * THE SAME WORDS, SO THE SAME RULING. The owner's answer names "+40
         * Attack Power" and this row is "+40 Attack Power" -- treating two
         * identical effect texts differently would need a reason, and there is
         * none. It is still a separate entry with a separate id, which is what
         * lets a character take both and get eighty of each pool.
         *
         * IT CHANGES NO ROW TODAY. Every build that takes this food is melee,
         * where the ranged half is worth nothing; the two ranged Hunters take
         * "+20 Agility" instead, which a Hunter converts at 2 ranged attack
         * power a point -- the same 40, plus crit.
         */
        id: 'food_attack_power',
        name: '+40 Attack Power',
        stats: { attackPower: 40, rangedAttackPower: 40 },
      },
      { id: 'food_spell_power', name: '+33 Spell Power', stats: { spellPower: 33 } },
      {
        id: 'food_healing_power',
        name: '+44 Healing Power',
        unmodelled:
          'Healing power is not a stat the engine has: nothing a character does here heals ' +
          'anybody, so there is no throughput for it to scale. Selectable and worth nothing, ' +
          'the same as the two Healing Power armour enchants.',
      },
      { id: 'food_stamina', name: '+20 Stamina', stats: { stamina: 20 } },
      { id: 'food_strength', name: '+20 Strength', stats: { strength: 20 } },
      { id: 'food_agility', name: '+20 Agility', stats: { agility: 20 } },
    ],
  },
];

/**
 * What is drunk, by CATEGORY.
 *
 * Keyed by category rather than being a list of consumable ids, which is what
 * makes "one per category" a property of the type instead of a rule something
 * has to enforce. A category absent means nothing chosen.
 */
export type ConsumableSelection = Readonly<Record<string, string>>;

export const CONSUMABLES_BY_ID: ReadonlyMap<string, Consumable> = new Map(
  CONSUMABLE_CATEGORIES.flatMap((category) =>
    category.options.map((option) => [option.id, option] as const),
  ),
);

/** The category a consumable belongs to, for validating a selection. */
export const CATEGORY_BY_CONSUMABLE_ID: ReadonlyMap<string, string> = new Map(
  CONSUMABLE_CATEGORIES.flatMap((category) =>
    category.options.map((option) => [option.id, category.id] as const),
  ),
);

export const CONSUMABLE_CATEGORIES_BY_ID: ReadonlyMap<string, ConsumableCategory> = new Map(
  CONSUMABLE_CATEGORIES.map((category) => [category.id, category] as const),
);

/*
 * NO TWO CONSUMABLES MAY SHARE AN ID, because a saved profile stores one and
 * `CONSUMABLES_BY_ID` would silently resolve it to whichever was declared last.
 * Checked here rather than in a test so a duplicate cannot reach a running app
 * even once.
 */
{
  const declared = CONSUMABLE_CATEGORIES.flatMap((category) => category.options);
  if (declared.length !== CONSUMABLES_BY_ID.size) {
    throw new Error('Duplicate consumable id');
  }
}

/**
 * Everything the chosen consumables contribute, resolved once.
 *
 * ----------------------------------------------------------------------------
 * THREE OUTPUTS BECAUSE THEY TAKE THREE DIFFERENT ROUTES INTO A CHARACTER, and
 * returning them together is what stops a caller wiring up two of the three.
 * That is not hypothetical: `resourceRegenMultiplier` was wired into one of the
 * engine's three regeneration rules and silently did nothing for the other two,
 * and `modifiersScaleWithStacks` reached two collections of three.
 *
 *   stats                  a layer of the starting stat block
 *   schoolPower            a `SchoolModifiers` entry, beside the gear's
 *   attackTableModifiers   merged into the build's, beside the bow enchant's
 *   bonusHitPoints         added to the maximum, because health is not a stat
 *
 * AN UNKNOWN ID IS IGNORED rather than throwing. A saved profile naming a
 * consumable that no longer exists should load as a character without it, not
 * as a character that cannot be built -- which is the rule `startingEquipmentFor`
 * already follows for a stale item id. `validateProfile` is what reports it.
 * ----------------------------------------------------------------------------
 */
export interface ConsumableEffects {
  readonly stats: PartialStats;
  readonly schoolPower: Readonly<Partial<Record<DamageSchool, number>>>;
  readonly bonusHitPoints: number;
  readonly attackTableModifiers: AttackTableModifiers;
  /** The chosen consumables that do nothing, in their own words. */
  readonly unmodelled: readonly { readonly name: string; readonly reason: string }[];
}

export function consumableEffects(selection: ConsumableSelection | undefined): ConsumableEffects {
  const stats: Record<string, number> = {};
  const schoolPower: Partial<Record<DamageSchool, number>> = {};
  const attackTableModifiers = new AttackTableModifiers();
  const unmodelled: { name: string; reason: string }[] = [];
  let bonusHitPoints = 0;

  for (const consumable of selectedConsumables(selection)) {
    for (const [name, value] of Object.entries(consumable.stats ?? {})) {
      if (typeof value !== 'number') continue;
      stats[name] = (stats[name] ?? 0) + value;
    }
    for (const [school, value] of Object.entries(consumable.schoolPower ?? {})) {
      const key = school as DamageSchool;
      schoolPower[key] = (schoolPower[key] ?? 0) + value;
    }
    for (const [table, modifier] of Object.entries(consumable.attackTableModifiers ?? {})) {
      attackTableModifiers.add(table as AttackTableKind, modifier);
    }
    bonusHitPoints += consumable.bonusHitPoints ?? 0;
    if (consumable.unmodelled) {
      unmodelled.push({ name: consumable.name, reason: consumable.unmodelled });
    }
  }

  return {
    stats: stats as PartialStats,
    schoolPower,
    bonusHitPoints,
    attackTableModifiers,
    unmodelled,
  };
}

/**
 * The chosen consumables, in the table's own order.
 *
 * ITERATES THE CATEGORIES rather than the selection's own keys, so a selection
 * carrying a category that no longer exists contributes nothing and the order
 * is the owner's rather than whatever order the keys were written in. A
 * consumable id that does not belong to the category it is filed under is
 * REFUSED here as well as reported by `validateProfile` -- the map makes two
 * from one category unrepresentable, and this is what stops one from ANOTHER
 * category being smuggled in under a key it does not belong to.
 */
export function selectedConsumables(
  selection: ConsumableSelection | undefined,
): readonly Consumable[] {
  if (!selection) return [];
  const chosen: Consumable[] = [];
  for (const category of CONSUMABLE_CATEGORIES) {
    const id = selection[category.id];
    if (!id) continue;
    const consumable = category.options.find((option) => option.id === id);
    if (consumable) chosen.push(consumable);
  }
  return chosen;
}

/**
 * WHAT EACH KIND OF BUILD DRINKS.
 *
 * ----------------------------------------------------------------------------
 * THESE ARE CHOSEN, NOT STATED, which is the first thing to know about them.
 * The owner supplied the CATALOGUE above and no per-profile rows; asked whether
 * the 24 presets should open with anything, they said to give every profile a
 * sensible one. So the numbers are theirs and the selections are this
 * repository's, and **an owner table arriving later replaces these outright**
 * rather than being reconciled with them.
 *
 * THEY FOLLOW ONE RULE RATHER THAN TASTE, because twenty-four separate opinions
 * is not something a reader can check: **take every category the build can
 * actually read, choosing within a category by what the build scales with, and
 * leave empty only what is worth literally nothing.** Nothing competes across
 * categories -- one choice per category and no budget between them -- so there
 * is no trade-off to get wrong, and the only real decisions are the three
 * categories that offer a caster option against a melee one.
 *
 * WHERE THE ROWS CAME FROM, so each can be re-derived rather than trusted:
 *
 *   - the conversion table in `character/conversions.ts` decides Blasted Lands.
 *     A Warrior gets 2 attack power a strength and none from agility, so it
 *     takes strength; a Rogue gets 1 from each plus crit, so it takes agility.
 *     **A CAT DRUID TAKES STRENGTH AND A ROGUE DOES NOT**, which is the entry
 *     that is easy to assume: a Druid is 2 per strength against 1 per agility.
 *   - the measured damage SCHOOL of each profile decides School Spell Power,
 *     and it was measured rather than read off the class. The Moonkin is 71%
 *     arcane and 29% nature, the Frostfire Mage 62% fire and 38% frost, and the
 *     Elemental Shaman 56% nature and 44% fire -- three builds whose name does
 *     not give the answer.
 *   - whether the build has a MANA pool decides Mana Regen, and whether any of
 *     its damage carries a spell power coefficient decides Spell Power.
 *
 * THE EMPTY SLOTS ARE THE INTERESTING ONES. A ranged Hunter takes no Weapon
 * Effect at all, because one option is scoped to the melee tables and the other
 * is a spell crit it has no spells for; and no spell power of either kind,
 * because a Hunter shot carries no spell coefficient. A Rogue takes no Spell
 * Power either: its poisons are 19% of the Venom build's damage and they scale
 * with ATTACK power.
 * ----------------------------------------------------------------------------
 */

/** Everything a build with no mana and no spells can read. */
const MELEE_COMMON: ConsumableSelection = {
  weapon_effect: 'weapon_melee_crit',
  strength: 'elixir_strength',
  agility: 'elixir_agility',
  attack_power: 'elixir_attack_power',
  hit_points: 'hit_points_120',
  armor: 'armor_450',
  food: 'food_attack_power',
};

/**
 * Plate and fur: 2 attack power a strength, none from agility.
 *
 * The Warriors and both feral Druids. The Flask is Hit Points because the other
 * option is 150 spell power and these builds have no spell to put it on.
 */
export const STRENGTH_CONSUMABLES: ConsumableSelection = {
  ...MELEE_COMMON,
  flask: 'flask_hit_points',
  blasted_lands: 'blasted_strength',
};

/**
 * Leather: 1 attack power from each primary, and agility also buys crit.
 *
 * The four Rogues and the melee Hunter. The only difference from the row above
 * is Blasted Lands, and it is the whole reason the two are separate.
 */
export const AGILITY_CONSUMABLES: ConsumableSelection = {
  ...MELEE_COMMON,
  flask: 'flask_hit_points',
  blasted_lands: 'blasted_agility',
};

/**
 * A caster: every spell power there is, plus intellect and regen.
 *
 * SCHOOL SPELL POWER IS NOT IN HERE, because it is the one entry that differs
 * per profile -- each caster adds its own measured school.
 */
const CASTER_COMMON: ConsumableSelection = {
  flask: 'flask_spell_power',
  weapon_effect: 'weapon_spell_crit',
  // Intellect rather than Spirit: it buys mana AND spell crit, where spirit
  // buys regeneration alone and `Mana Regen` below is already covering that.
  blasted_lands: 'blasted_intellect',
  mana_regen: 'mana_regen_12',
  hit_points: 'hit_points_120',
  armor: 'armor_450',
  spell_power: 'spell_power_35',
  food: 'food_spell_power',
};

/** A caster's row, with the school its own damage actually uses. */
export function casterConsumables(school: string): ConsumableSelection {
  return { ...CASTER_COMMON, school_spell_power: school };
}

/**
 * A ranged Hunter, which is the row with the most gaps and every one of them
 * is a real one.
 *
 * NO WEAPON EFFECT: one option is scoped to the two melee tables -- the owner
 * confirmed it "should not apply to Hunter Ranged attacks" -- and the other is a
 * spell crit. NO SPELL POWER OF EITHER KIND: Forever removed Arcane Shot's
 * spell coefficient and gave it a ranged attack power one instead, so a Hunter
 * shot reads none.
 *
 * THE ATTACK POWER ELIXIR IS IN, AND IT WAS OUT. It shipped as melee-only on
 * the item precedent and the owner ruled it feeds BOTH pools, so a ranged
 * Hunter reads all forty of it. See the entry itself.
 *
 * THE FOOD IS STILL AGILITY RATHER THAN THAT SAME "+40 Attack Power", and the
 * ruling does not change it: a Hunter converts at 2 ranged attack power a
 * point, so "+20 Agility" is the same forty with crit on top.
 *
 * AND MANA REGEN IS NOT A COURTESY: the geared Hunter empties its mana pool
 * around the thirty-second mark and spends the rest of the fight on auto shot.
 */
export const RANGED_HUNTER_CONSUMABLES: ConsumableSelection = {
  flask: 'flask_hit_points',
  agility: 'elixir_agility',
  attack_power: 'elixir_attack_power',
  blasted_lands: 'blasted_agility',
  mana_regen: 'mana_regen_12',
  hit_points: 'hit_points_120',
  armor: 'armor_450',
  food: 'food_agility',
};

/**
 * A hybrid that swings a weapon AND casts: both Paladins' shield builds, the
 * Retribution Paladin and the Enhancement Shaman.
 *
 * THE WEAPON EFFECT IS THE ONE REAL DECISION HERE and it is taken on the
 * measured split. Retribution is 46% physical and the Enhancement Shaman 65%,
 * so both take the melee crit; the Shockadin is 74% Holy and the Protection
 * Paladin 58%, so both take the spell crit and its 36 spell power. The owner's
 * own enchant row for the Protection Paladin points the same way -- it spends
 * the glove slot on spell power where the Protection WARRIOR spends it on
 * threat.
 */
export function hybridConsumables(options: {
  readonly school: string;
  readonly meleeWeaponEffect: boolean;
  readonly blastedLands: string;
}): ConsumableSelection {
  return {
    flask: 'flask_hit_points',
    weapon_effect: options.meleeWeaponEffect ? 'weapon_melee_crit' : 'weapon_spell_crit',
    strength: 'elixir_strength',
    agility: 'elixir_agility',
    attack_power: 'elixir_attack_power',
    blasted_lands: options.blastedLands,
    mana_regen: 'mana_regen_12',
    hit_points: 'hit_points_120',
    armor: 'armor_450',
    spell_power: 'spell_power_35',
    school_spell_power: options.school,
    food: 'food_attack_power',
  };
}
