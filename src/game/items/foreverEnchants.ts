import type { PartialStats } from '../../engine';
import { RATING_PER_PERCENT } from '../../engine';
import type { Enchant, EquipmentSlot, UnmodelledEffect } from './Item';

/**
 * THE ARMOUR ENCHANTS, SUPPLIED BY THE RULESET OWNER.
 *
 * ----------------------------------------------------------------------------
 * A spreadsheet of ten columns -- one per enchantable slot -- listing every
 * enchant that slot may carry, plus the loadout each of the 25 profiles opens
 * with. That table is the WHOLE source: it is the owner's own, it is Forever
 * data, and nothing here is derived from Classic, from Wowhead or from a
 * plausible reading of a name.
 *
 * WHY THEY ARE DECLARED BY HAND AND THE OTHER TWO ARE NOT. `ENCHANT_RULES` in
 * `itemData.ts` interprets enchants that were SCRAPED -- Crusader and Weapon
 * Spell Power both have a Wowhead spell id, an icon and a tooltip, and the rule
 * beside each one says what the simulator does with the words. These have none
 * of that: the owner gave an effect and a slot and no spell at all. So there is
 * nothing to scrape, nothing to `--verify` against, and a JSON file pretending
 * otherwise would be the invented provenance this project keeps warning about.
 *
 * THE IDS ARE THE SIMULATOR'S, NOT THE GAME'S, and that is the one thing to
 * know before reading them. `EquippedSlot.enchantId` is a number and a saved
 * profile stores it, so each of these needs a stable key -- they are allocated
 * from a block well above any real item or spell id and the block is asserted
 * disjoint from both. Reading one as a WoW spell id would be reading a
 * fabricated number as game data, which is exactly why they are a long way from
 * the range a real one lives in.
 *
 * ONE ENCHANT PER DISTINCT EFFECT, LISTING EVERY SLOT IT IS OFFERED ON. "+8
 * Strength" is the helmet's and the legs' entry and it is ONE enchant with two
 * slots, the arrangement Crusader already uses for its three weapon slots.
 * Splitting it per slot would mean two ids for one thing and two places for a
 * number to drift.
 *
 * THE OWNER'S WORDING IS KEPT AS THE NAME, with one normalisation: the chest
 * column writes "4 Defense Skill" where every other column writes "+4 Defense
 * Skill", and it is the same enchant, so it carries the "+" everywhere. A label
 * is not a number; nothing else about any entry is adjusted.
 *
 * THE SHOULDER COLUMN IS "None" AND NOTHING ELSE, so no enchant lists
 * `shoulders` and the Gear panel shows that slot a dash. That is the honest
 * rendering of a column with no options rather than an omission.
 * ----------------------------------------------------------------------------
 */

/**
 * Where this block of ids starts.
 *
 * Above every item id in `src/data/items` (the largest is in the 228,000s) and
 * above every enchant spell id (20034, 22749), and `itemData.ts` asserts the
 * whole block is disjoint from both rather than trusting the arithmetic.
 */
export const FOREVER_ENCHANT_ID_BASE = 900_000;

/** Percentage points of haste, in the `hasteRating` the engine converts back. */
const haste = (percent: number): PartialStats => ({
  // THE PROJECT'S ONE IDIOM FOR "N% HASTE", shared with Seal of the Crusader,
  // Nature's Grace, Flurry and Blade Flurry. `hasteMultiplierFrom` divides by
  // the same constant, so 1% in is 1.01 out exactly.
  hasteRating: percent * RATING_PER_PERCENT.haste,
});

/**
 * An effect the simulator does not model, in the owner's own words.
 *
 * All four are kept SELECTABLE on purpose -- the owner asked for them to stay
 * visible -- so a loadout that names one is still the loadout that was
 * specified, and what it is worth is zero and says so.
 */
const inert = (text: string, reason: string): UnmodelledEffect[] => [
  { kind: 'Enchant', text, reason },
];

interface Declared {
  readonly name: string;
  readonly slots: readonly EquipmentSlot[];
  readonly stats?: PartialStats;
  readonly attackTableModifiers?: Enchant['attackTableModifiers'];
  readonly threatMultiplier?: number;
  readonly unmodelled?: readonly UnmodelledEffect[];
  /**
   * The source's own words, for an entry that HAS any.
   *
   * Every row of the owner's spreadsheet is a bare effect -- "+8 Strength" --
   * so for those the name IS the tooltip and writing one would be inventing
   * prose Forever has not written. Revelation came later and in a sentence, so
   * it carries that sentence instead of repeating its name.
   */
  readonly tooltip?: string;
}

/**
 * Every enchant in the owner's table, in the order the columns list them.
 *
 * The declaration order is the order each slot's dropdown shows, so a slot
 * whose options were all introduced in its own column reads exactly like the
 * spreadsheet. A slot sharing an option with an earlier column sees it in the
 * earlier position, which is cosmetic and left alone.
 */
const DECLARED: readonly Declared[] = [
  // ---- Helmet -------------------------------------------------------------
  // Also the legs' first two, and the gloves' "+1% Haste".
  { name: '+1% Dodge', slots: ['head', 'cloak', 'legs'], stats: { dodgeChance: 1 } },
  { name: '+1% Haste', slots: ['head', 'gloves', 'legs'], stats: haste(1) },
  { name: '+8 Agility', slots: ['head', 'legs'], stats: { agility: 8 } },
  { name: '+8 Stamina', slots: ['head', 'legs'], stats: { stamina: 8 } },
  { name: '+8 Strength', slots: ['head', 'legs'], stats: { strength: 8 } },
  { name: '+8 Intellect', slots: ['head', 'legs'], stats: { intellect: 8 } },
  { name: '+8 Spirit', slots: ['head', 'legs'], stats: { spirit: 8 } },

  // ---- Neck ---------------------------------------------------------------
  { name: '+5 Strength', slots: ['neck'], stats: { strength: 5 } },
  { name: '+6 Spell Power', slots: ['neck'], stats: { spellPower: 6, healingPower: 6 } },
  // A stat since round 52, when healing became a feature: `healingPower`.
  { name: '+11 Healing Power', slots: ['neck'], stats: { healingPower: 11 } },
  { name: '+5 Agility', slots: ['neck', 'cloak'], stats: { agility: 5 } },
  { name: '+5 Defense Skill', slots: ['neck'], stats: { defenseSkill: 5 } },

  // ---- Back ---------------------------------------------------------------
  {
    name: '+60 Armor',
    slots: ['cloak'],
    /*
     * NOT "ARMOR FROM ITEMS", by the owner's ruling, which is the whole reason
     * `armorFromItems` counts items and not enchants. Toughness and Thick Hide
     * scale the armor an item supplies; sixty points added by an enchant is not
     * that, so it lands on the character and is not multiplied.
     */
    stats: { armor: 60 },
  },
  {
    name: '-2% Threat',
    slots: ['cloak'],
    // Live since round 47, when threat stopped being out of scope.
    threatMultiplier: 0.98,
  },

  // ---- Chest --------------------------------------------------------------
  {
    name: '+4 Stats',
    slots: ['chest'],
    // All five primaries, which is what "Stats" means: stamina, strength,
    // agility, intellect AND spirit, four each.
    stats: { strength: 4, agility: 4, stamina: 4, intellect: 4, spirit: 4 },
  },
  {
    // The chest column writes this without the "+". Same enchant as the bracer,
    // glove, leg and boot entry, so it carries one name and one id.
    name: '+4 Defense Skill',
    slots: ['chest', 'wrists', 'gloves', 'legs', 'feet'],
    stats: { defenseSkill: 4 },
  },

  // ---- Bracer -------------------------------------------------------------
  { name: '+9 Strength', slots: ['wrists'], stats: { strength: 9 } },
  { name: '+16 Spell Power', slots: ['wrists'], stats: { spellPower: 16, healingPower: 16 } },
  { name: '+9 Agility', slots: ['wrists'], stats: { agility: 9 } },
  { name: '+16 Healing Power', slots: ['wrists'], stats: { healingPower: 16 } },

  // ---- Gloves -------------------------------------------------------------
  { name: '+15 Strength', slots: ['gloves'], stats: { strength: 15 } },
  /*
   * AND THE ONE-HANDED WEAPON AGILITY ENCHANT (round 79): "+15 agi (or
   * Crusader) NOT +25 agi" on a one-hander, the owner's. One enchant, two kinds
   * of slot, which is "+8 Strength" on a helmet and legs again.
   */
  { name: '+15 Agility', slots: ['gloves', 'mainHand', 'offHand'], stats: { agility: 15 } },
  { name: '+20 Spell Power', slots: ['gloves'], stats: { spellPower: 20, healingPower: 20 } },
  {
    name: '+2% Threat',
    slots: ['gloves'],
    threatMultiplier: 1.02,
  },

  // ---- Boots --------------------------------------------------------------
  {
    name: 'Minor Speed',
    slots: ['feet'],
    unmodelled: inert(
      'Minor Speed',
      'Movement speed. The engine has no positions and nothing in a fight moves, which is ' +
        'the same permanent ruling that covers every talent naming a range or a radius.',
    ),
  },
  { name: '+7 Agility', slots: ['feet'], stats: { agility: 7 } },
  { name: '+7 Stamina', slots: ['feet'], stats: { stamina: 7 } },

  // ---- Ranged -------------------------------------------------------------
  {
    name: '+2% Crit Chance',
    slots: ['ranged'],
    /*
     * RANGED ATTACKS ONLY, which is the owner's ruling and is why this is not
     * `critChance`.
     *
     * ------------------------------------------------------------------------
     * `critChance` is the character's crit for everything they swing, so two
     * points of it would reach a Hunter's melee weapons as well -- and the melee
     * Hunter wears this set. `AttackTableModifiers` is the scope that separates
     * ranged from melee, and `ranged-auto` plus `ranged-special` is every ranged
     * attack there is: Auto Shot on the first and every shot on the second.
     *
     * AND THE PET DOES NOT GET IT, which falls out rather than needing a guard.
     * These modifiers live on the combatant that carries them; `createPet`
     * builds its own and inherits the owner's `critChance` STAT, which this
     * deliberately is not. A pet inheriting the bow's enchant would be the
     * generous-and-no-error kind of wrong.
     * ------------------------------------------------------------------------
     */
    attackTableModifiers: {
      'ranged-auto': { critBonus: 2 },
      'ranged-special': { critBonus: 2 },
    },
  },

  /* ==========================================================================
   * THREE THE OWNER ADDED LATER, AND THEY GO ON THE END.
   *
   * The ids are allocated BY POSITION from the 900,000 block, so an entry may
   * never be reordered or removed once a profile has been saved against it --
   * a new one goes last or somebody's helmet enchant moves onto their boots.
   * These are 900,029 to 900,031.
   *
   * WHY EACH EXISTS:
   *
   *   +65 Spell Power  "The two-handed staff caster enchant (+65 Spell Power)
   *                    is different from the 1H caster enchant (+30 Spell
   *                    Power)." The 1H one is the SCRAPED Enchant Weapon -
   *                    Spell Power (22749), which is "+30 damage to spells";
   *                    the two-hand figure is the owner's and had no entry.
   *
   *   +9 Stamina       The shield default, and the FIRST enchant in the table
   *                    to name the shield slot at all -- the owner's original
   *                    column list had none, so four builds carrying a shield
   *                    had an unenchantable slot.
   *
   *   +25 Agility      The melee-weapon default for the two bow Hunters, whose
   *                    two-hander is a stat stick they never swing.
   * ========================================================================== */
  { name: '+65 Spell Power', slots: ['twoHand'], stats: { spellPower: 65, healingPower: 65 } },
  { name: '+9 Stamina', slots: ['shield'], stats: { stamina: 9 } },
  // TWO-HANDED ONLY (round 79): a one-hander takes +15 Agility or Crusader.
  { name: '+25 Agility', slots: ['twoHand'], stats: { agility: 25 } },

  /*
   * ==========================================================================
   * ENCHANT WEAPON - REVELATION, which is a PROC and the first one here.
   *
   * APPENDED AND NOT SLOTTED IN, which this file's id contract requires: ids
   * are allocated BY POSITION, so an entry inserted anywhere else would move
   * every enchant after it onto somebody's saved profile.
   *
   * IT IS THE OWNER'S THIRD WEAPON ENCHANT AND THE FIRST WITH NO WOWHEAD PAGE.
   * Crusader and Weapon Spell Power are SCRAPED -- a spell id, an icon, a
   * tooltip -- and `ENCHANT_RULES` in `itemData.ts` says what the simulator
   * does with their words. This one was given as a sentence and a formula and
   * nothing else, which is exactly what the rest of this table is, so it
   * belongs here rather than in a JSON file with invented provenance.
   *
   * WHAT IT DOES IS IN `procs.ts`, keyed by this id the way Crusader is keyed
   * by 20034. `stats` is empty because none of it is a stat: the chance is
   * rolled per spell and the effect is an aura. See `revelationReaction`.
   * ==========================================================================
   */
  {
    name: 'Revelation',
    slots: ['mainHand', 'offHand', 'twoHand'],
    tooltip:
      'Permanently enchant a Melee Weapon to have a chance to trigger ' +
      'Revelation when a non-periodic spell fails to critically strike. ' +
      'Revelation grants 100% increased critical strike chance to the next ' +
      "spell cast. Revelation's chance to trigger is diminished as your " +
      'critical strike chance increases.',
  },
];

/**
 * The enchants, with their ids allocated from the block.
 *
 * ALLOCATED BY POSITION, so an entry must not be reordered or removed once a
 * profile has been saved against it -- a new one goes on the end. That is the
 * same contract `tools/item-sets.json` has with the files it builds, and the
 * test that pins each name to its id is what makes a reorder fail loudly rather
 * than silently move somebody's helmet enchant onto their boots.
 */
export const FOREVER_ENCHANTS: readonly Enchant[] = DECLARED.map((declared, index) => ({
  id: FOREVER_ENCHANT_ID_BASE + index + 1,
  name: declared.name,
  // No icon and no Wowhead page: the owner supplied an effect and a slot. An
  // invented icon id would be the smallest possible piece of invented data and
  // still invented.
  icon: '',
  source: "Ruleset owner's enchant table, supplied 2026-10-07",
  slots: declared.slots,
  stats: declared.stats ?? {},
  ...(declared.attackTableModifiers ? { attackTableModifiers: declared.attackTableModifiers } : {}),
  ...(declared.threatMultiplier !== undefined ? { threatMultiplier: declared.threatMultiplier } : {}),
  unmodelled: declared.unmodelled ?? [],
  // The owner's table states the effect and nothing more, so for those rows
  // the "tooltip" IS the effect. Saying more would be writing a tooltip
  // Forever has not written. An entry that came with prose carries it.
  tooltip: declared.tooltip ?? declared.name,
}));

/** Looked up by the name the owner's table uses, for the preset loadouts. */
export const FOREVER_ENCHANTS_BY_NAME: ReadonlyMap<string, Enchant> = new Map(
  FOREVER_ENCHANTS.map((enchant) => [enchant.name, enchant] as const),
);

/**
 * The id of an enchant by the owner's own name for it.
 *
 * THROWS ON A NAME THAT IS NOT IN THE TABLE, because the alternative is a
 * loadout with a hole in it: `startingEquipmentFor` already skips an item id the
 * data no longer has, and an enchant quietly dropped the same way would be a
 * profile silently missing a stat. A typo here is a build failure.
 */
export function foreverEnchantId(name: string): number {
  const enchant = FOREVER_ENCHANTS_BY_NAME.get(name);
  if (!enchant) throw new Error(`No Forever enchant named "${name}"`);
  return enchant.id;
}

/**
 * Revelation's id, for the one place that has to recognise it.
 *
 * BY NAME THROUGH `foreverEnchantId`, which THROWS on a name the table does not
 * carry -- so renaming the entry is a build failure rather than a proc that
 * silently stops firing. That is the half `ITEM_PROCS` had to learn twice: Hand
 * of Justice was keyed to one item id while five sets named another, and it
 * read as fully simulated while firing never.
 */
export const REVELATION_ENCHANT_ID = foreverEnchantId('Revelation');
