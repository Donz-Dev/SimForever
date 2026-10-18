import type {
  Ability,
  AbilityModifier,
  AttackTableKind,
  DamageSchool,
  MeleeWeaponSlot,
  PartialStats,
  Reaction,
} from '../../engine';
import { frostOilReaction } from './frostOil';
import { AttackTableModifiers } from '../../engine';
import {
  DEMONIC_RUNE_ABILITY,
  HEALTHSTONE_ABILITY,
  MAJOR_FRENZY_POTION_ABILITY,
  MAJOR_HEALING_POTION_ABILITY,
  MAJOR_MANA_POTION_ABILITY,
  MAJOR_MENDERS_POTION_ABILITY,
  MAJOR_MENDERS_POTION_UNMODELLED,
  MAJOR_SPELLBLASTING_POTION_ABILITY,
  MIGHTY_RAGE_POTION_ABILITY,
  THISTLE_TEA_ABILITY,
} from '../abilities/consumables';
import type { ClassId, CombatStyleId } from '../character';
import { getCombatStyle } from '../character';

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
 * (The field is now DECLARED BY NOTHING -- its one pair stopped being exclusive
 * -- so the comparison is to a mechanism rather than to a live rule. It is the
 * cleanest possible ending for it: the rule was removable precisely because
 * nothing had ever depended on the chooser to enforce it.)
 *
 * THEY ARE STATS, NOT AURAS, which is the other difference from a raid buff.
 * A raid buff is an aura because it has a lifecycle -- Windfury's window opens
 * and closes, Sunder Armor stacks. A consumable is drunk before the pull and
 * lasts the fight, so it is a layer of the starting stat block, and the
 * character sheet reads it for free. Nothing here needs an uptime row.
 *
 * ----------------------------------------------------------------------------
 * EXCEPT FOR THE LAST TWO CATEGORIES, WHICH ARE ACTIONS RATHER THAN STATS, AND
 * THE PARAGRAPH ABOVE IS WHY THEY NEEDED SAYING SEPARATELY.
 *
 * Potion and Other are used DURING a fight. The owner: they "must be treated
 * like a character ability and be exposed on the APL and consumable panels" --
 * so each carries an `ability`, joins the ability book when it is selected, and
 * gets an entry in the priority list. Everything the first twelve categories
 * say about themselves is false of these two: they contribute no starting
 * stats, they have a cooldown, they can be wasted, and WHEN to use one is a
 * decision.
 *
 * THE EXCLUSIVITY IS THE SAME MECHANISM DOING DOUBLE DUTY. The owner describes
 * the Potion rule as a shared two-minute cooldown that "effectively make[s] the
 * choice exclusive", and the Other rule as exclusive within its own category
 * and NOT with Potions. Both are one category keyed by category id -- so a
 * character may hold one Potion and one Other, and cannot hold two of either,
 * with nothing enforcing it. The shared cooldown is declared as well, on the
 * abilities, because a ruling written down where it is enforced is worth more
 * than one that is merely implied by a shape; see `POTION_COOLDOWN_GROUP`.
 * ----------------------------------------------------------------------------
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
  /**
   * The ability this consumable grants, for one USED DURING THE FIGHT.
   *
   * --------------------------------------------------------------------------
   * THE WHOLE OF WHAT MAKES A POTION DIFFERENT FROM A FLASK. A consumable with
   * this joins the ability book when it is selected and gets an entry in the
   * priority list; one without it is a layer of the starting stat block and is
   * over before the first swing.
   *
   * BY REFERENCE RATHER THAN BY ID, which is the one place this deliberately
   * differs from `grantAbility` on a talent or a racial. Those name an id and
   * resolve it through a registry that DROPS what it cannot find -- right for a
   * typo, and the reason `lone_wolf` left both Hunter profiles named after it
   * without its 20% damage for the life of the project, silently. A reference
   * cannot miss and needs no test to prove it did not.
   * --------------------------------------------------------------------------
   */
  readonly ability?: Ability;
  /**
   * The classes that may choose this, where only some may.
   *
   * --------------------------------------------------------------------------
   * ABSENT MEANS EVERY CLASS, which is true of thirty of the thirty-nine
   * entries here and of every one of the original twelve categories. Two say
   * otherwise and the owner's table says which: the Mighty Rage Potion is
   * "(Warrior, Druid)" and Thistle Tea is "(Rogue, Druid)".
   *
   * GATED IN TWO PLACES AND FOR TWO DIFFERENT REASONS, which is the arrangement
   * the Warlock's weapon stone already uses. The PANEL does not offer it, so
   * nobody can choose one their class cannot use; and `consumableAbilities`
   * refuses it, so a profile that carries one anyway -- hand-edited, or saved
   * before a class change -- gets a character without the ability rather than
   * one that cannot be built. "A profile CAN carry one, because the field is on
   * every profile and only the panel is class-gated."
   * --------------------------------------------------------------------------
   */
  readonly classes?: readonly ClassId[];
  /**
   * Flat damage added to the base damage of the weapon this is coated onto.
   *
   * --------------------------------------------------------------------------
   * THE DENSE SHARPENING STONE IS THE ONLY CALLER: "+8 base weapon damage to
   * the equipped weapon".
   *
   * IT IS NOT A STAT, AND THERE IS NO STAT IT COULD BE. Base weapon damage
   * belongs to a WEAPON -- a character holding two has two of them -- so this
   * is read per hand by `createPlayer` and added to `WeaponProfile.baseDamage`,
   * which is where a Hunter's ammunition already goes and for the same reason:
   * it is the term the damage roll varies and the term an ability's own flat
   * damage adds on top of.
   *
   * ONLY A ROW WITH A `hand` CAN CARRY ONE, which is what makes "the equipped
   * weapon" a well-defined thing to say. A flask has no hand to be coated on.
   * --------------------------------------------------------------------------
   */
  readonly weaponDamageBonus?: number;
  /**
   * A PROC that rides on the coated weapon, built once per character and per
   * hand -- Frost Oil is the one caller. A factory for the reason every proc
   * here is one: a reaction built once is shared by every combatant in a batch.
   * Read by `consumableReactions`, only for a row with a `hand`.
   */
  readonly weaponProc?: (hand: MeleeWeaponSlot) => Reaction;
  /** What it does that the simulator does not, in the source's own words. */
  readonly unmodelled?: string;
}

/** A group of consumables, of which at most one may be chosen. */
export interface ConsumableCategory {
  readonly id: string;
  /** The owner's own name for the row. */
  readonly name: string;
  readonly options: readonly Consumable[];
  /**
   * The WEAPON this row is coated onto, for the two rows that are.
   *
   * ==========================================================================
   * IT REPLACES `perWeapon`, AND THE RULING BEHIND BOTH IS THE SAME ONE: "Dual
   * wielding needs to trigger a second weapon effect consumable." A weapon
   * effect is coated onto a WEAPON rather than drunk, so somebody holding two
   * buys two.
   *
   * WHAT CHANGED IS THE CONTROL, not the rule. `perWeapon` applied ONE
   * selection to however many weapons swung, which cannot express "a Dense
   * Sharpening Stone on the main hand and an Elemental on the off hand" -- and
   * the owner asked for exactly that: "weapons stones need to be split out
   * into MH / OH to be able to control this precisely".
   *
   * `'offHand'` CONTRIBUTES NOTHING UNLESS A SECOND WEAPON SWINGS, which is
   * where the old flag's arithmetic went. `offHand: 'weapon'` in
   * `combatStyles.ts` is the test, not "two hands full": a shield, a held
   * off-hand item and a Hunter's melee stat stick are none of them a second
   * coated weapon.
   *
   * ABSENT MEANS "NOT COATED ON ANYTHING" -- a flask, an elixir and a piece of
   * food are worth the same whatever is in the character's hands, and
   * `consumables.test.ts` pins that these two rows are the only ones carrying
   * it so a third has to be deliberate.
   * ==========================================================================
   */
  readonly hand?: 'mainHand' | 'offHand';
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
/**
 * The three weapon effects, declared ONCE and offered per hand.
 *
 * ============================================================================
 * SPLIT INTO TWO CATEGORIES ON THE OWNER'S INSTRUCTION -- "weapons stones need
 * to be split out into MH / OH to be able to control this precisely".
 *
 * IT REPLACES `perWeapon`, WHICH WAS THE SAME RULING WITH NO CONTROL ON IT.
 * That flag applied ONE selection to however many weapons swung, which was
 * right for "a dual-wielder buys two" and could not express "a Dense
 * Sharpening Stone on the main hand and an Elemental on the off hand" -- which
 * is exactly the choice the owner now wants, because the new stone competes
 * with the crit one rather than dominating it.
 *
 * THE OPTIONS ARE BUILT FROM ONE TABLE SO THE TWO HANDS CANNOT DRIFT. Two
 * hand-written copies of three stones is six places for a number to be wrong
 * in, and the one that drifts is the one nobody measures.
 *
 * THE IDS CARRY THE HAND, which the file's own rule requires: "the ids are
 * derived from the effect rather than from the row, so a consumable that
 * appears in two categories would be two entries with two ids" -- and
 * `CONSUMABLES_BY_ID` throws on a duplicate at module load rather than
 * resolving a saved id to whichever was declared last.
 * ============================================================================
 */
const WEAPON_EFFECTS: readonly {
  readonly id: string;
  readonly name: string;
  readonly effect: Omit<Consumable, 'id' | 'name'>;
}[] = [
  {
    /*
     * MELEE ALONE, AND THAT IS WHY IT IS NOT `critChance`.
     *
     * `critChance` is the engine's one melee-AND-ranged crit stat --
     * `critChanceFrom` is read by both tables -- so granting it would give
     * two points to every shot a Hunter fires from a line that says "Melee".
     * The owner's table says "+2% Melee Crit Chance" here and "+2% Crit
     * Chance" on the Agility row, and they ruled that the second means melee
     * AND ranged; two labels meaning the same stat would be one label.
     */
    id: 'weapon_melee_crit',
    name: '+2% Melee Crit Chance',
    effect: {
      attackTableModifiers: {
        'melee-auto': { critBonus: 2 },
        'melee-special': { critBonus: 2 },
      },
    },
  },
  {
    // The caster half of the same row, and it names its crit the other way.
    id: 'weapon_spell_crit',
    name: '+1% Spell Crit Chance & +36 Spell Power',
    effect: { stats: { spellCritChance: 1, spellPower: 36 } },
  },
  {
    /*
     * ------------------------------------------------------------------------
     * THE DENSE SHARPENING STONE: "+8 base weapon damage to the equipped
     * weapon", the owner's own wording, and it "competes with +2% crit from
     * elemental sharpening stone".
     *
     * `weaponDamageBonus` AND NOT A STAT, because there is no stat for it:
     * base weapon damage belongs to a WEAPON rather than to a character, and
     * a character holding two weapons has two of them. That is the whole
     * reason this row needed the MH/OH split before it could exist -- under
     * `perWeapon` a single selection would have added eight to both hands and
     * there would have been no way to coat one.
     *
     * IT GOES WHERE AMMUNITION GOES. `WeaponProfile.baseDamage` is the term
     * the damage roll varies and the term every ability's own flat damage adds
     * on top of, which is what "base weapon damage" names. `powerCoefficient`
     * is deliberately untouched: that is `baseSpeed / 14` and a sharpening
     * stone does not change how fast the weapon swings.
     *
     * SO IT IS WORTH MORE TO A SLOW WEAPON, per swing, and the same per
     * second. Eight damage on a 3.6-second two-hander is 2.2 dps and on a
     * 1.8-second dagger is 4.4 -- which is the opposite of how the PPM
     * enchants here distribute, and is what a flat per-hit bonus always does.
     * Said because it reads like a bug the first time somebody compares the
     * two hands of a dual-wielder.
     * ------------------------------------------------------------------------
     */
    id: 'dense_sharpening_stone',
    name: '+8 Weapon Damage',
    effect: { weaponDamageBonus: 8 },
  },
  {
    /*
     * FROST OIL: a 10% chance on each hit of the coated weapon to cast a
     * Frostbolt for 28 to 32 Frost damage plus 27% of spell power, with no
     * internal cooldown. The proc is `frostOilReaction`; nothing here is a stat.
     */
    id: 'frost_oil',
    name: 'Frost Oil (Frostbolt proc)',
    effect: { weaponProc: frostOilReaction },
  },
];

/** One hand's worth of the table, with the hand in each id. */
const weaponEffectsFor = (hand: 'main_hand' | 'off_hand'): readonly Consumable[] =>
  WEAPON_EFFECTS.map((entry) => ({
    ...entry.effect,
    id: `${entry.id}_${hand}`,
    name: entry.name,
  }));

export const CONSUMABLE_CATEGORIES: readonly ConsumableCategory[] = [
  {
    id: 'flask',
    name: 'Flask',
    options: [
      { id: 'flask_hit_points', name: '+1200 Hit Points', bonusHitPoints: 1200 },
      { id: 'flask_spell_power', name: '+150 Spell Power', stats: { spellPower: 150 } },
    ],
  },
  /*
   * TWO ROWS WHERE THERE WAS ONE, and the ORDER is main hand then off hand so
   * the panel reads the way a character sheet does.
   */
  {
    id: 'weapon_effect_main_hand',
    name: 'Weapon Effect (Main Hand)',
    hand: 'mainHand',
    options: weaponEffectsFor('main_hand'),
  },
  {
    /*
     * OFFERED ALWAYS AND APPLIED ONLY WHEN A SECOND WEAPON SWINGS. A shield is
     * not a coated weapon, and neither is a held off-hand item nor a Hunter's
     * melee stat stick -- `offHand: 'weapon'` in `combatStyles.ts` is the one
     * rule that says a second one swings, and reading "two hands full" instead
     * would pay a Protection warrior for coating its shield.
     *
     * SHOWN RATHER THAN HIDDEN FOR A BUILD THAT CANNOT USE IT, which is the
     * Warlock stone's arrangement: a selection the character cannot read is
     * still what the file says, and a dropdown reading "None" would claim
     * nothing was chosen.
     */
    id: 'weapon_effect_off_hand',
    name: 'Weapon Effect (Off Hand)',
    hand: 'offHand',
    options: weaponEffectsFor('off_hand'),
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
      /*
       * 28, NOT 33, ON THE OWNER'S OWN REVISION -- "the best spell power food
       * consumable is no longer +33 spell power, it is now +28 spell power".
       *
       * THE ID DOES NOT MOVE AND THE NAME DOES. A profile stores the id, so
       * every saved caster keeps the food it chose and simply gets the current
       * figure for it; renaming the row would have silently emptied the Food
       * slot on four presets and every file anyone has saved. The NAME is what
       * a person reads, so it follows the number -- the same split a renamed
       * ability makes between its display name and its id.
       *
       * IT MOVES FOUR PUBLISHED ROWS and is meant to: Seal Twist Ret, the
       * Shockadin, Prot Pally and the Moonkin all take this row.
       */
      { id: 'food_spell_power', name: '+28 Spell Power', stats: { spellPower: 28 } },
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
  /*
   * ==========================================================================
   * AND THE TWO MID-FIGHT CATEGORIES, WHICH GO ON THE END.
   *
   * APPENDED RATHER THAN SLOTTED IN, which is the rule the Forever enchants
   * already follow for the reason that matters more here than it does there: a
   * saved profile keys its selection by CATEGORY id, so the order is a display
   * decision and nothing else -- but the hand-written table in
   * `consumables.test.ts` asserts the order row for row, so putting these in
   * the middle would be a diff across the whole file for no reader's benefit.
   *
   * THE NAMES ARE THE OWNER'S OWN -- "Potions" are "the primary category" and
   * "the 'Other' is the secondary category" -- and so is every figure in both.
   * ==========================================================================
   */
  {
    id: 'potion',
    name: 'Potion',
    options: [
      {
        id: 'major_healing_potion',
        name: 'Major Healing Potion',
        ability: MAJOR_HEALING_POTION_ABILITY,
      },
      { id: 'major_mana_potion', name: 'Major Mana Potion', ability: MAJOR_MANA_POTION_ABILITY },
      {
        /*
         * THE ONE POTION WITH A CLASS LIST, and the only one whose value is not
         * guessable from its name: a Cat Druid drinks it for the sixty strength
         * and the rage is worth nothing to it -- not because it has no rage pool
         * (it has one; pools are per class, not per form) but because nothing
         * ever fills or spends it. Measured. See the ability.
         */
        id: 'mighty_rage_potion',
        name: 'Mighty Rage Potion',
        classes: ['warrior', 'druid'],
        ability: MIGHTY_RAGE_POTION_ABILITY,
      },
      { id: 'major_frenzy_potion', name: 'Major Frenzy Potion', ability: MAJOR_FRENZY_POTION_ABILITY },
      {
        /*
         * SELECTABLE, CASTABLE AND WORTH NOTHING, and it says so where it is
         * chosen. The panel prints every `unmodelled` consumable beside the
         * dropdown, which is the discipline items, enchants and raid buffs all
         * follow -- and the reason is shared with the ability rather than
         * written twice, so the two cannot drift.
         */
        id: 'major_menders_potion',
        name: "Major Mender's Potion",
        ability: MAJOR_MENDERS_POTION_ABILITY,
        unmodelled: MAJOR_MENDERS_POTION_UNMODELLED,
      },
      {
        id: 'major_spellblasting_potion',
        name: 'Major Spellblasting Potion',
        ability: MAJOR_SPELLBLASTING_POTION_ABILITY,
      },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    options: [
      { id: 'thistle_tea', name: 'Thistle Tea', classes: ['rogue', 'druid'], ability: THISTLE_TEA_ABILITY },
      { id: 'demonic_rune', name: 'Demonic Rune', ability: DEMONIC_RUNE_ABILITY },
      { id: 'healthstone', name: 'Healthstone', ability: HEALTHSTONE_ABILITY },
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
 *
 * AND IT IS CLASS-BLIND, WHICH IS SAFE FOR EXACTLY ONE REASON: both
 * class-restricted consumables grant an ABILITY and no stats, so there is
 * nothing here for a Mage holding a hand-edited Mighty Rage Potion to collect.
 * `consumableAbilities` is where the class gate lives, because that is where
 * the only class-restricted effect goes.
 *
 * THAT IS A PROPERTY OF TODAY'S TABLE RATHER THAN OF THIS FUNCTION, so
 * `consumables.test.ts` asserts it: a class-restricted consumable carrying
 * `stats`, `schoolPower`, `bonusHitPoints` or `attackTableModifiers` fails,
 * which is what forces the class to be threaded through here on the day one
 * does. A silent "bonus being paid" is the failure that guard exists to stop.
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

/**
 * How many times a `perWeapon` consumable is applied, by combat style.
 *
 * ----------------------------------------------------------------------------
 * TWO FOR A DUAL-WIELDER AND ONE FOR EVERYBODY ELSE, which is the owner's
 * instruction read literally -- they named dual wielding and nothing else.
 *
 * A SHIELD IS NOT A SECOND COATED WEAPON, and neither is a held off-hand item
 * or the two-hander a Hunter carries as a stat stick: the question is how many
 * weapons SWING, and `offHand: 'weapon'` is the one rule in `combatStyles.ts`
 * that says a second one does. Reading "two hands full" instead would pay a
 * Protection warrior for coating its shield.
 * ----------------------------------------------------------------------------
 */
export function weaponEffectCount(style: CombatStyleId | undefined): number {
  if (style === undefined) return 1;
  return getCombatStyle(style)?.offHand === 'weapon' ? 2 : 1;
}

/**
 * Whether a category's choice reaches this character at all.
 *
 * ----------------------------------------------------------------------------
 * ONLY THE OFF-HAND ROW CAN BE REFUSED, and only because the character has no
 * second weapon to coat. That is where `perWeapon`'s arithmetic went: it used
 * to apply ONE selection twice for a dual-wielder, and now there are two
 * selections and the second simply does not land when nothing swings with it.
 *
 * `offHand: 'weapon'` IS THE TEST, not "two hands full" -- a shield, a held
 * off-hand item and a Hunter's melee stat stick are none of them a second
 * coated weapon, and reading it the other way would pay a Protection warrior
 * for coating its shield.
 *
 * ABSENT STYLE MEANS APPLY IT, which is the honest answer to a caller asking
 * what a selection is worth in the abstract rather than on a character.
 * ----------------------------------------------------------------------------
 */
export function consumableReachesCharacter(
  category: ConsumableCategory,
  style: CombatStyleId | undefined,
): boolean {
  if (category.hand !== 'offHand') return true;
  if (style === undefined) return true;
  return getCombatStyle(style)?.offHand === 'weapon';
}

export function consumableEffects(
  selection: ConsumableSelection | undefined,
  /**
   * How the character fights, for the two rows that are coated onto a weapon.
   *
   * OPTIONAL, AND ABSENT MEANS BOTH APPLY. Every caller that has a style
   * passes it; the ones that do not are asking what a selection is worth in
   * the abstract, and counting both stones is the honest answer to that.
   */
  style?: CombatStyleId,
): ConsumableEffects {
  const stats: Record<string, number> = {};
  const schoolPower: Partial<Record<DamageSchool, number>> = {};
  const attackTableModifiers = new AttackTableModifiers();
  const unmodelled: { name: string; reason: string }[] = [];
  let bonusHitPoints = 0;

  for (const [categoryId, consumable] of selectedConsumableEntries(selection)) {
    const category = CONSUMABLE_CATEGORIES_BY_ID.get(categoryId)!;
    /*
     * AN OFF-HAND STONE ON A CHARACTER WITH NO OFF-HAND WEAPON IS SKIPPED
     * ENTIRELY -- not applied at half, not applied once. There is no weapon
     * for it to be on.
     */
    if (!consumableReachesCharacter(category, style)) continue;

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

    /*
     * `weaponDamageBonus` IS NOT FOLDED IN HERE and that is deliberate. It is
     * not a character stat -- it belongs to ONE WEAPON -- so it is read per
     * hand by `weaponDamageBonusFor` where the weapons are built. Adding it to
     * `stats` would need a stat that does not exist, and inventing one is how
     * a per-weapon figure quietly becomes a per-character one.
     */

    // Reported ONCE however many were drunk: it is one caveat about one
    // choice, and printing it twice would read as two different problems.
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
 * The flat weapon damage a coated stone adds to ONE hand.
 *
 * ============================================================================
 * PER HAND, WHICH IS THE WHOLE POINT OF THE MH/OH SPLIT. The Dense Sharpening
 * Stone is "+8 base weapon damage to the equipped weapon", and under the old
 * `perWeapon` flag there was no way to ask about one weapon: a single
 * selection was applied N times to a character.
 *
 * IT DOES NOT ASK WHETHER THE WEAPON EXISTS, because the caller is building
 * that weapon and already knows. An off-hand stone on a character with no
 * off-hand weapon is never reached, which is the same answer
 * `consumableReachesCharacter` gives on the stats side -- two readers, one
 * rule, and the rule is "there is no weapon for it to be on".
 * ============================================================================
 */
export function weaponDamageBonusFor(
  selection: ConsumableSelection | undefined,
  hand: 'mainHand' | 'offHand',
): number {
  let total = 0;
  for (const [categoryId, consumable] of selectedConsumableEntries(selection)) {
    if (CONSUMABLE_CATEGORIES_BY_ID.get(categoryId)?.hand !== hand) continue;
    total += consumable.weaponDamageBonus ?? 0;
  }
  return total;
}

/**
 * The weapon procs the selection coats onto the character's weapons, one per
 * hand that holds one.
 *
 * THE SAME RULE AS THE STATS: an off-hand row on a character with no off-hand
 * weapon contributes nothing, because there is no weapon for it to be on.
 */
export function consumableReactions(
  selection: ConsumableSelection | undefined,
  style?: CombatStyleId,
): readonly Reaction[] {
  const reactions: Reaction[] = [];
  for (const [categoryId, consumable] of selectedConsumableEntries(selection)) {
    const category = CONSUMABLE_CATEGORIES_BY_ID.get(categoryId)!;
    if (!category.hand || !consumable.weaponProc) continue;
    if (!consumableReachesCharacter(category, style)) continue;
    reactions.push(consumable.weaponProc(category.hand));
  }
  return reactions;
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
  return selectedConsumableEntries(selection).map(([, consumable]) => consumable);
}

/**
 * The same, keeping the CATEGORY each choice came from.
 *
 * `consumableEffects` needs it, because `perWeapon` is a property of the row
 * rather than of the consumable -- and looking the category back up from the
 * consumable would be a second search keyed on something that is not a key.
 */
export function selectedConsumableEntries(
  selection: ConsumableSelection | undefined,
): readonly (readonly [string, Consumable])[] {
  if (!selection) return [];
  const chosen: (readonly [string, Consumable])[] = [];
  for (const category of CONSUMABLE_CATEGORIES) {
    const id = selection[category.id];
    if (!id) continue;
    const consumable = category.options.find((option) => option.id === id);
    if (consumable) chosen.push([category.id, consumable] as const);
  }
  return chosen;
}

/**
 * Whether a class may choose this consumable at all.
 *
 * NO LIST MEANS EVERY CLASS, which is the honest reading of a table that names
 * classes on two rows out of thirty-nine and says nothing on the rest.
 */
export function consumableAllowsClass(
  consumable: Consumable,
  characterClass: ClassId,
): boolean {
  return consumable.classes === undefined || consumable.classes.includes(characterClass);
}

/**
 * The consumables a class may choose from a category -- what the panel offers.
 *
 * Narrowed here rather than in the panel so that the panel and the ability book
 * cannot disagree about who may drink what: both ask this.
 */
export function consumableOptionsFor(
  category: ConsumableCategory,
  characterClass: ClassId,
): readonly Consumable[] {
  return category.options.filter((option) => consumableAllowsClass(option, characterClass));
}

/**
 * The abilities the chosen consumables grant -- the mid-fight ones.
 *
 * ============================================================================
 * WHAT TURNS A SELECTION INTO SOMETHING A PRIORITY LIST CAN NAME. `createPlayer`
 * appends these to the ability book and `abilityBookFor` appends the same ones
 * for the panel, so the dropdown offers exactly what the fight will carry.
 *
 * CLASS-GATED HERE, WHICH IS THE GATE THAT DECIDES ANYTHING. The panel already
 * refuses to offer a Mage the Mighty Rage Potion; this is what happens when a
 * profile carries one anyway, which it can -- a hand-edited file, or a profile
 * saved as a Warrior and loaded after a class change. The character is built
 * without the ability rather than refused, which is the rule
 * `startingEquipmentFor` follows for a stale item id and `warlockStoneEffect`
 * follows for a stone on a Mage.
 *
 * AND THE SAME ANSWER IS WHAT GATES THE *ENTRY*. `withoutUnselectedConsumables`
 * takes the stock list's entry for an ability this build does not carry back
 * out, so the panel does not show a line nobody can act on -- the engine never
 * needed that, because `PriorityRotation` skips an unknown ability in silence.
 * ============================================================================
 */
export function consumableAbilities(
  characterClass: ClassId,
  selection: ConsumableSelection | undefined,
): readonly Ability[] {
  return selectedConsumables(selection)
    .filter((consumable) => consumableAllowsClass(consumable, characterClass))
    .flatMap((consumable) => (consumable.ability ? [consumable.ability] : []));
}

/**
 * Every ability any consumable can grant, by id.
 *
 * DERIVED FROM THE CATALOGUE rather than written out, so it cannot name an
 * ability no consumable grants or miss one that is. It answers "is this entry a
 * mid-fight consumable" for `withoutUnselectedConsumables`, which is the same
 * question `ALL_RACIAL_ABILITY_IDS` answers for the racial entries.
 */
export const CONSUMABLE_ABILITY_IDS: ReadonlySet<string> = new Set(
  CONSUMABLE_CATEGORIES.flatMap((category) =>
    category.options.flatMap((option) => (option.ability ? [option.ability.id] : [])),
  ),
);

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
 *
 * ============================================================================
 * AND THE TWO MID-FIGHT ROWS FOLLOW THE SAME RULE, MEASURED RATHER THAN DERIVED.
 *
 * The twelve above could be read off a table: the conversion table decides
 * Blasted Lands, the measured damage school decides School Spell Power. A potion
 * cannot be -- "forty attack power for thirty seconds" against "sixty strength
 * for twenty" against "2,250 mana" is not an arithmetic question -- so every
 * candidate was run on every preset. `tools/probe_consumable_choice.ts`.
 *
 * WHAT CAME OUT IS ONE SENTENCE: **the Other slot takes the pool the build
 * actually runs out of, and the Potion slot takes the damage buff.** Because the
 * two categories are not exclusive with each other, no build has to choose
 * between sustain and damage -- which is why no mana potion is selected
 * anywhere: the Demonic Rune covers mana from the other category and leaves the
 * Potion slot free for something that hits.
 *
 *   POTION, by what the build's damage scales with:
 *     mighty_rage_potion         Warriors, Cat, Bear   +13.3 to +35.2
 *     major_frenzy_potion        Rogues, Hunters       +1.8 to +11.2
 *     major_spellblasting_potion every caster, both    +1.8 to +18.2
 *                                Paladin hybrids
 *
 *   OTHER, by which pool it empties:
 *     thistle_tea   the four Rogues and the Cat      +30.7 to +38.0
 *     healthstone   the three tanks                  health is the pool
 *     demonic_rune  every other build with mana      a safety net
 *     (nothing)     2H Arms and DW Fury              no pool to restore
 *
 * MIGHTY RAGE BEATS FRENZY WHEREVER IT IS LEGAL, AND NOT BY A LITTLE: sixty
 * strength is 120 attack power to a Warrior or a Druid against Frenzy's forty,
 * and it lasts twenty seconds against thirty -- 2,400 attack-power-seconds
 * against 1,200, plus the rage. Measured at +35.2 against +5.2 on DW Fury.
 *
 * NO MANA POTION AND NO MENDER'S POTION IS SELECTED ANYWHERE, and both are real
 * answers rather than oversights. The Mender's Potion does nothing at all. The
 * mana potion is never the best use of the slot, because the Rune is in the
 * other category -- and at sixty seconds most casters never reach its gate
 * anyway: it fires 0.00 times on the Shockadin and the Moonkin, 0.01 on the
 * Frostfire Mage and 1.00 on LW Ranged, which is the one build that genuinely
 * empties its pool.
 *
 * THE RUNE IS KEPT WHERE IT RARELY FIRES, which is the Evocation decision: the
 * owner ruled that an entry which almost never comes up is "intended" as a
 * safety net that costs nothing and pays out in a fight that goes differently
 * from the ones measured. A caster carries a Demonic Rune.
 *
 * AND NEITHER WARLOCK TAKES A HEAL, which is now true for the ordinary reason
 * rather than the interesting one. A healing potion measured **-28.4 DPS** on
 * the Firelock while its Life Tap entry was UNGATED -- restoring health bought
 * taps that cost global cooldowns -- and the owner ruled that "should never be
 * the case". Gated on mana, a heal is worth -0.1 there: nothing, like every
 * other build nothing attacks. See `CONSUMABLE_HEALS` and `rotations/warlock.ts`.
 *
 * THE FIRELOCK'S OWN PAIR WAS RE-MEASURED AFTER THAT FIX AND DID NOT CHANGE,
 * which is worth recording because the single-candidate figures INVERTED. Gating
 * Life Tap made the build genuinely mana-bound, so alone the Major Mana Potion
 * (+33.0) beat Spellblasting (+18.4) -- and PAIRED with the Demonic Rune, which
 * already restores mana, Spellblasting wins again: **+41.5 against +38.5**.
 * `tools/probe_firelock_pair.ts`. A category that is not exclusive with another
 * makes a second source of the same pool redundant, which is exactly why
 * "marginal values do not sum" has to be measured as a pair rather than added.
 * ============================================================================
 */

/** Everything a build with no mana and no spells can read. */
const MELEE_COMMON: ConsumableSelection = {
  /*
   * BOTH HANDS, WHICH IS WHAT THE OLD SINGLE ROW ALREADY DID. `perWeapon`
   * applied one selection to every weapon that swings, so writing the same
   * stone into both categories is the split expressed without moving a figure
   * -- and an off-hand entry on a two-hander build reaches nothing.
   */
  weapon_effect_main_hand: 'weapon_melee_crit_main_hand',
  weapon_effect_off_hand: 'weapon_melee_crit_off_hand',
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
  /*
   * AND THE POTION IS MIGHTY RAGE FOR ALL FIVE OF THEM, which is the one
   * mid-fight choice this archetype does not have to think about: sixty
   * strength is 120 attack power to a Warrior or a Druid against the Frenzy
   * Potion's forty, over twenty seconds against thirty, PLUS 45 to 75 rage.
   * Measured +26.8 on 2H Arms, +35.2 on DW Fury, +13.3 on Prot Warr, +15.7 on
   * the Cat and +24.6 on the Bear, against +2.0 to +5.2 for Frenzy.
   *
   * AND THE `other` SLOT IS THE HEALTHSTONE, BY THE OWNER'S RULING: "non-mana,
   * non-energy users and the three tank profiles (Prot Warr, Prot Pally, and
   * Bear) should use the Healthstone." Four of these five are exactly that set
   * -- the two damage Warriors have neither a mana nor an energy bar, and Prot
   * Warr and the Bear are two of the three named tanks -- so it belongs on the
   * shared row rather than on four preset overrides.
   *
   * THE CAT IS THE ONE THAT OVERRIDES IT, also by the owner's ruling:
   * "specifically cat druid should never use it in favor of Thistle Tea." It is
   * the only member of this row with an energy bar.
   *
   * THE TWO DAMAGE WARRIORS DRINK IT AND IT FIRES 0.00 TIMES, which is correct
   * and is a SELECTION rather than a measurement: nothing attacks them, so
   * health never leaves maximum. The owner asked for what a build would
   * actually carry, and a Warrior carries a Healthstone. It moves no figure.
   */
  potion: 'mighty_rage_potion',
  other: 'healthstone',
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
  /*
   * THE FRENZY POTION, because a Rogue may not drink Mighty Rage -- the owner's
   * table says "(Warrior, Druid)" -- and forty attack power is the only thing
   * in the category any of these six reads. Measured +1.8 to +11.2, which is
   * small and is the whole of what is on offer: the only other non-zero cell is
   * the Spellblasting Potion, and neither a Rogue nor a Hunter has a point of
   * spell-power-scaled damage for it to raise.
   *
   * THE `other` SLOT IS NOT HERE EITHER, and for this row the reason is a class
   * gate rather than a preference: Thistle Tea is "(Rogue, Druid)", so the four
   * Rogues take it and the two Hunters -- who share this row -- cannot.
   */
  potion: 'major_frenzy_potion',
};

/**
 * A caster: every spell power there is, plus intellect and regen.
 *
 * SCHOOL SPELL POWER IS NOT IN HERE, because it is the one entry that differs
 * per profile -- each caster adds its own measured school.
 */
const CASTER_COMMON: ConsumableSelection = {
  flask: 'flask_spell_power',
  weapon_effect_main_hand: 'weapon_spell_crit_main_hand',
  weapon_effect_off_hand: 'weapon_spell_crit_off_hand',
  // Intellect rather than Spirit: it buys mana AND spell crit, where spirit
  // buys regeneration alone and `Mana Regen` below is already covering that.
  blasted_lands: 'blasted_intellect',
  mana_regen: 'mana_regen_12',
  hit_points: 'hit_points_120',
  armor: 'armor_450',
  spell_power: 'spell_power_35',
  food: 'food_spell_power',
};

/**
 * A caster's row, with the school its own damage actually uses.
 *
 * ----------------------------------------------------------------------------
 * THE MID-FIGHT PAIR IS THE SAME FOR ALL NINE CASTERS and is the clearest
 * instance of the rule: the Potion slot takes the damage buff and the Other
 * slot takes the pool.
 *
 * SPELLBLASTING, measured +1.8 to +18.2 and the only candidate any of them can
 * read -- a Frenzy Potion's attack power reaches nothing a caster casts, and it
 * measured between -6.7 and +7.5, which is noise either side of zero.
 *
 * AND THE RUNE RATHER THAN THE MANA POTION, because the two categories are not
 * exclusive: the Rune covers mana from `other` and leaves `potion` free for
 * something that hits.
 *
 * AT THE OWNER'S 10% IT RARELY FIRES, and that is the point of the figure rather
 * than a cost of it. Of the fifteen presets that carry one, FOUR use it in a
 * sixty-second fight -- the Firelock 1.0 times, LW Ranged 0.5, the Enhancement
 * Shaman 0.4, Retribution a rounding -- and the other eleven never reach 10%
 * mana at all. Those four are the builds that genuinely run dry.
 *
 * IT IS KEPT ON THE ELEVEN ANYWAY, which is the Evocation decision: the owner
 * ruled an almost-never-fired safety net "intended", because it costs nothing
 * and pays out in a fight that goes differently from the ones measured.
 * ----------------------------------------------------------------------------
 */
export function casterConsumables(school: string): ConsumableSelection {
  return {
    ...CASTER_COMMON,
    school_spell_power: school,
    potion: 'major_spellblasting_potion',
    other: 'demonic_rune',
  };
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
  /*
   * THE FRENZY POTION AND THE RUNE, and the Rune is the one row in the project
   * where it genuinely earns its place rather than sitting there as a safety
   * net: LW Ranged drinks it ONCE A FIGHT, which is the sentence above about
   * emptying the pool by the thirty-second mark, measured.
   *
   * THE POTION SLOT IS STILL THE DAMAGE BUFF even on the build that runs dry,
   * because the Rune already covers the mana from a category the Potion is not
   * exclusive with. Frenzy measured +5.5 on BM and +5.3 on LW Ranged against
   * the mana potion's +3.4, and the two together are better than either.
   */
  potion: 'major_frenzy_potion',
  other: 'demonic_rune',
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
    /*
     * THE SPELLBLASTING POTION FOR ALL FOUR, which is NOT the split the Weapon
     * Effect above takes and is worth saying so. That row divides them on their
     * measured physical share -- Retribution and Enhancement take the melee
     * crit, the two shield Paladins take the spell crit -- and the potion does
     * not divide at all: +9.1 on Enhancement, +6.6 on Retribution, +7.1 on the
     * Shockadin and +5.6 on the Protection Paladin, against +1.7 to +8.8 for
     * Frenzy. Every one of the four prefers it or cannot tell, so one answer
     * serves them.
     *
     * AND THE RUNE, except on the Protection Paladin, which overrides it with a
     * Healthstone in `presets.ts`: it is the one of the four that is hit back,
     * so health is the pool it actually empties.
     */
    potion: 'major_spellblasting_potion',
    other: 'demonic_rune',
    weapon_effect_main_hand: options.meleeWeaponEffect
      ? 'weapon_melee_crit_main_hand'
      : 'weapon_spell_crit_main_hand',
    weapon_effect_off_hand: options.meleeWeaponEffect
      ? 'weapon_melee_crit_off_hand'
      : 'weapon_spell_crit_off_hand',
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
