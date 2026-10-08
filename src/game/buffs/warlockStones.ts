import type { DamageSchool } from '../../engine';
import type { PartialStats } from '../../engine';
import { RATING_PER_PERCENT } from '../../engine';

/**
 * A Warlock's temporary weapon enchant: a Firestone or a Spellstone.
 *
 * ----------------------------------------------------------------------------
 * THE SAME SHAPE AS A ROGUE'S POISONS, and chosen for the same reason: it is a
 * consumable the player applies before the pull, so it is a PROFILE FIELD with
 * a control in the Gear panel rather than a constant or an in-fight cast. The
 * ruleset owner asked for it in those terms -- "similar to rogue poisons where
 * I can select Firestone or Spellstone".
 *
 * IT STACKS WITH THE WEAPON'S ENCHANT, by the owner's ruling, which is why
 * nothing here touches `equipment` or the enchant fields. A stone is an extra
 * stat source layered on the character; selecting one does not displace
 * Enchant Weapon - Spell Power or anything else.
 *
 * A CASTER HOLDS A WEAPON TO ENCHANT. `combatStyles.ts` gives the `caster`
 * style a `stat-stick` in each hand -- kept for its stats, never swung -- so
 * "enchant your weapon" is coherent here rather than a fiction, and no slot
 * check is needed.
 *
 * NOT A REACTION, which is the one way it differs from a poison. A poison is a
 * proc and lives in `game/reactions`; a stone is a flat stat bundle, so it
 * lives beside the raid buffs, which is the other place this project keeps
 * "a thing the player selects before the fight that grants stats".
 * ----------------------------------------------------------------------------
 */
export type WarlockStoneId = 'none' | 'firestone' | 'spellstone';

/** What the GUI dropdown shows, and what it iterates to build itself. */
export const WARLOCK_STONE_NAMES: Readonly<Record<WarlockStoneId, string>> = {
  none: 'None',
  firestone: 'Firestone',
  spellstone: 'Spellstone',
};

/**
 * NO STONE BY DEFAULT, and that is deliberately the opposite of the poison
 * default.
 *
 * ----------------------------------------------------------------------------
 * Version 10 gave every Rogue the owner's stated pairing and said outright that
 * it changed old results, because "a saved ROGUE was not choosing to fight
 * without poisons". The owner has NOT stated which stone a Warlock carries --
 * the request was for a control to choose with -- so picking one here would
 * invent a build decision and move a published baseline on no authority.
 *
 * So the default grants nothing, both Warlock presets keep their measured
 * figures, and what each stone is WORTH is measured and reported for the owner
 * to choose from. A selected stone is one dropdown away.
 * ----------------------------------------------------------------------------
 */
export const DEFAULT_WARLOCK_STONE: WarlockStoneId = 'none';

/** "increasing your spell critical strike chance by 2%" -- percentage POINTS. */
export const FIRESTONE_SPELL_CRIT = 2;
/** "increasing your spell haste by 2%". */
export const SPELLSTONE_SPELL_HASTE_PERCENT = 2;
/**
 * "the damage done by your Fire spells by up to 21", and the Spellstone's
 * Shadow equivalent.
 *
 * ----------------------------------------------------------------------------
 * IT IS SCHOOL-SCOPED SPELL POWER, NOT FLAT DAMAGE PER CAST, and that is not a
 * guess: this project already parses the identical wording on SEVENTEEN item
 * lines. `SCHOOL_SPELL_POWER_PATTERN` in `items/itemData.ts` matches
 * "Increases damage done by (school) spells and effects by up to (N)" and sends
 * it to `SchoolModifiers.spellPower`, which `spellPowerFor` adds to the
 * school-blind pool at the point of use.
 *
 * The stones say "the damage done by your Fire spells by up to 21" -- same
 * idiom, same "up to", so the same reading. Reading it as +21 flat on every
 * cast instead would be worth several times as much to a fast spell and
 * nothing to a slow one, and would not scale with anything.
 * ----------------------------------------------------------------------------
 */
export const WARLOCK_STONE_SCHOOL_POWER = 21;

/** What a stone grants, as the two things a character layer can take. */
export interface WarlockStoneEffect {
  /** Flat stats, added exactly as a piece of gear's are. */
  readonly stats: PartialStats;
  /** Spell power only this school's damage reads. */
  readonly schoolPower: Readonly<Partial<Record<DamageSchool, number>>>;
}

/**
 * `hasteRating` IS SPELL HASTE FOR A WARLOCK, AND THAT IS AN INTERPRETATION
 * WORTH READING BEFORE TRUSTING IT ELSEWHERE.
 *
 * ----------------------------------------------------------------------------
 * `STAT_NAMES` is a closed flat set and has ONE haste member, `hasteRating`,
 * which drives melee swing speed and cast speed through the same multiplier --
 * unlike crit, which the set splits into `critChance` and `spellCritChance`.
 * So there is no spell-only haste to grant.
 *
 * IT IS EXACT HERE RATHER THAN APPROXIMATE, because of who can hold a stone: a
 * Warlock is `combatStyle: 'caster'` and `autoAttack: 'none'`, so it never
 * swings and the only thing `hasteRating` can reach is its cast time. The
 * reading would be GENEROUS for a class that swings, and no such class can
 * carry a Spellstone.
 *
 * ADDING A `spellHasteRating` STAT WAS THE ALTERNATIVE and is the wrong trade
 * today: the set is closed on purpose, every haste consumer would have to learn
 * about the second member, and the one that forgot would be silently wrong.
 * **If a melee class ever gets a spell-haste effect, this is the note to come
 * back to** -- that is the day the stat has to be split, the way crit already
 * is.
 *
 * 2% IS 340 RATING, from `RATING_PER_PERCENT.haste` of 170, computed rather
 * than written out so a ruleset change to the conversion carries the stone with
 * it.
 * ----------------------------------------------------------------------------
 */
export const WARLOCK_STONE_EFFECTS: Readonly<Record<WarlockStoneId, WarlockStoneEffect>> = {
  none: { stats: {}, schoolPower: {} },
  firestone: {
    stats: { spellCritChance: FIRESTONE_SPELL_CRIT },
    schoolPower: { fire: WARLOCK_STONE_SCHOOL_POWER },
  },
  spellstone: {
    stats: { hasteRating: SPELLSTONE_SPELL_HASTE_PERCENT * RATING_PER_PERCENT.haste },
    schoolPower: { shadow: WARLOCK_STONE_SCHOOL_POWER },
  },
};

/**
 * What this stone grants, or nothing at all.
 *
 * GATED ON THE CLASS BY THE CALLER, not here: `createPlayer` checks it, the
 * same way it double-gates poisons on the option being present AND the class
 * being a Rogue. A stone id on a Mage is a profile that should not have one
 * rather than an effect to apply.
 */
export function warlockStoneEffect(stone: WarlockStoneId | undefined): WarlockStoneEffect {
  return WARLOCK_STONE_EFFECTS[stone ?? 'none'] ?? WARLOCK_STONE_EFFECTS.none;
}

/** Whether an arbitrary string is a stone id, for validating pasted JSON. */
export function isWarlockStoneId(value: unknown): value is WarlockStoneId {
  return typeof value === 'string' && value in WARLOCK_STONE_NAMES;
}

/**
 * The source's own words, for the Gear panel to print.
 *
 * Both sources agree on both stones, which is this class's confidence measure:
 * `forever-warlock-spellbook.json` and the ruleset owner's message state the
 * same two numbers for each.
 */
export const WARLOCK_STONE_TOOLTIPS: Readonly<Record<WarlockStoneId, string>> = {
  none: 'No temporary weapon enchant.',
  firestone:
    `Increases your spell critical strike chance by ${FIRESTONE_SPELL_CRIT}% and the ` +
    `damage done by your Fire spells by up to ${WARLOCK_STONE_SCHOOL_POWER}.`,
  spellstone:
    `Increases your spell haste by ${SPELLSTONE_SPELL_HASTE_PERCENT}% and the ` +
    `damage done by your Shadow spells by up to ${WARLOCK_STONE_SCHOOL_POWER}.`,
};
