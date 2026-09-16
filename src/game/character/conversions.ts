import type { PartialStats, StatDerivation, Stats } from '../../engine';
import type { ClassId, FormId } from './ids';

/**
 * How one class turns primary stats into everything else.
 *
 * Every number is from the Forever stat conversion table. A value of `null`
 * means the conversion does not exist for that class — a Mage gets no crit from
 * agility at all, which is different from getting a very small amount.
 *
 * Ratios are stored the way the source states them. "20 is 1% Crit" is stored
 * as `agilityPerCritPercent: 20`, not as 0.05 crit per agility, so the table
 * can be checked against the source by eye.
 */
export interface StatConversions {
  readonly attackPowerPerStrength: number;
  readonly attackPowerPerAgility: number;
  readonly rangedAttackPowerPerAgility: number;
  readonly armorPerAgility: number;
  /** Agility needed for 1% melee/ranged crit. null if agility gives none. */
  readonly agilityPerCritPercent: number | null;
  /** Agility needed for 1% dodge. null if agility gives none. */
  readonly agilityPerDodgePercent: number | null;
  readonly hitPointsPerStamina: number;
  readonly manaPerIntellect: number;
  /** Intellect needed for 1% spell crit. null if intellect gives none. */
  readonly intellectPerSpellCritPercent: number | null;
  /** Mana per five seconds, per point of spirit. */
  readonly manaPer5PerSpirit: number;
}

/** Shared by every class: the conversions that never vary. */
const COMMON = {
  armorPerAgility: 2,
  hitPointsPerStamina: 10,
} as const;

/** No mana, no spell crit, no regen. Warriors and Rogues. */
const NO_MANA = {
  manaPerIntellect: 0,
  intellectPerSpellCritPercent: null,
  manaPer5PerSpirit: 0,
} as const;

/** The "2 Spirit = 1 MP5" classes. */
const SPIRIT_HALF = { manaPer5PerSpirit: 0.5 } as const;
/** The "8 Spirit = 5 MP5" classes: the pure casters. */
const SPIRIT_FIVE_EIGHTHS = { manaPer5PerSpirit: 5 / 8 } as const;

const WARRIOR: StatConversions = {
  ...COMMON,
  ...NO_MANA,
  attackPowerPerStrength: 2,
  attackPowerPerAgility: 0,
  rangedAttackPowerPerAgility: 0,
  agilityPerCritPercent: 20,
  agilityPerDodgePercent: 20,
};

const ROGUE: StatConversions = {
  ...COMMON,
  ...NO_MANA,
  attackPowerPerStrength: 1,
  attackPowerPerAgility: 1,
  rangedAttackPowerPerAgility: 0,
  agilityPerCritPercent: 29,
  agilityPerDodgePercent: 14.5,
};

const SHAMAN: StatConversions = {
  ...COMMON,
  ...SPIRIT_HALF,
  attackPowerPerStrength: 2,
  attackPowerPerAgility: 0,
  rangedAttackPowerPerAgility: 0,
  agilityPerCritPercent: 20,
  agilityPerDodgePercent: 20,
  manaPerIntellect: 15,
  intellectPerSpellCritPercent: 59.5,
};

const PALADIN: StatConversions = {
  ...COMMON,
  ...SPIRIT_HALF,
  attackPowerPerStrength: 2,
  attackPowerPerAgility: 0,
  rangedAttackPowerPerAgility: 0,
  agilityPerCritPercent: 20,
  agilityPerDodgePercent: 20,
  manaPerIntellect: 15,
  intellectPerSpellCritPercent: 54,
};

const HUNTER: StatConversions = {
  ...COMMON,
  ...SPIRIT_HALF,
  attackPowerPerStrength: 1,
  attackPowerPerAgility: 1,
  rangedAttackPowerPerAgility: 2,
  agilityPerCritPercent: 53,
  agilityPerDodgePercent: 53,
  manaPerIntellect: 15,
  // A Hunter gets no spell crit from intellect.
  intellectPerSpellCritPercent: null,
};

/** Mage, Priest and Warlock differ only in their spell crit ratio. */
function pureCaster(intellectPerSpellCritPercent: number): StatConversions {
  return {
    ...COMMON,
    ...SPIRIT_FIVE_EIGHTHS,
    // Strength does nothing at all for these three.
    attackPowerPerStrength: 0,
    attackPowerPerAgility: 0,
    rangedAttackPowerPerAgility: 0,
    // Agility gives them dodge but, unlike every other class, no crit.
    agilityPerCritPercent: null,
    agilityPerDodgePercent: 20,
    manaPerIntellect: 15,
    intellectPerSpellCritPercent,
  };
}

/**
 * Druid conversions vary by form.
 *
 * Caster, Moonkin and Tree of Life share one set. Bear differs only by losing
 * spell crit, and Cat additionally gains attack power from agility.
 */
const DRUID_CASTER: StatConversions = {
  ...COMMON,
  ...SPIRIT_HALF,
  attackPowerPerStrength: 2,
  attackPowerPerAgility: 0,
  rangedAttackPowerPerAgility: 0,
  agilityPerCritPercent: 20,
  agilityPerDodgePercent: 20,
  manaPerIntellect: 15,
  intellectPerSpellCritPercent: 61,
};

const DRUID_BEAR: StatConversions = {
  ...DRUID_CASTER,
  intellectPerSpellCritPercent: null,
};

const DRUID_CAT: StatConversions = {
  ...DRUID_BEAR,
  attackPowerPerAgility: 1,
};

const DRUID_BY_FORM: Record<FormId, StatConversions> = {
  caster: DRUID_CASTER,
  moonkin: DRUID_CASTER,
  tree: DRUID_CASTER,
  bear: DRUID_BEAR,
  cat: DRUID_CAT,
};

const BY_CLASS: Record<Exclude<ClassId, 'druid'>, StatConversions> = {
  warrior: WARRIOR,
  rogue: ROGUE,
  shaman: SHAMAN,
  paladin: PALADIN,
  hunter: HUNTER,
  mage: pureCaster(59.5),
  priest: pureCaster(59.5),
  warlock: pureCaster(60.6),
};

/**
 * Conversions for a class, and for a Druid the form it is in.
 *
 * A Druid with no form given is treated as being in caster form, matching the
 * class's default.
 */
export function conversionsFor(
  characterClass: ClassId,
  form?: FormId,
): StatConversions {
  if (characterClass === 'druid') {
    return DRUID_BY_FORM[form ?? 'caster'];
  }
  return BY_CLASS[characterClass];
}

/**
 * Apply the conversions to a set of resolved primary stats.
 *
 * Pure, and returns only what the conversions ADD. The caller folds it into the
 * stat block on top of the base values, which is how a Hunter's -1.53 base crit
 * and the crit from its agility end up in the same number.
 *
 * Hit points and mana are included here even though they end up as resource
 * maximums rather than stats, so that one function owns the whole table.
 */
export function deriveFromPrimaries(
  primary: Readonly<Stats>,
  conversions: StatConversions,
): PartialStats & { hitPoints: number; mana: number } {
  const { strength, agility, stamina, intellect, spirit } = primary;

  return {
    attackPower:
      strength * conversions.attackPowerPerStrength +
      agility * conversions.attackPowerPerAgility,
    rangedAttackPower: agility * conversions.rangedAttackPowerPerAgility,
    armor: agility * conversions.armorPerAgility,
    critChance: ratio(agility, conversions.agilityPerCritPercent),
    dodgeChance: ratio(agility, conversions.agilityPerDodgePercent),
    spellCritChance: ratio(intellect, conversions.intellectPerSpellCritPercent),
    manaPer5: spirit * conversions.manaPer5PerSpirit,
    hitPoints: stamina * conversions.hitPointsPerStamina,
    mana: intellect * conversions.manaPerIntellect,
  };
}

/**
 * A derivation function for a class and form, ready to hand to a StatBlock.
 *
 * Hit points and mana are stripped out: they are resource maximums, not stats,
 * and the stat block has nowhere to put them.
 */
export function statDerivationFor(
  characterClass: ClassId,
  form?: FormId,
): StatDerivation {
  const conversions = conversionsFor(characterClass, form);

  return (primary) => {
    const { hitPoints: _hitPoints, mana: _mana, ...stats } = deriveFromPrimaries(
      primary,
      conversions,
    );
    return stats;
  };
}

/** `amount / per` as a percentage, or 0 when the conversion does not exist. */
function ratio(amount: number, per: number | null): number {
  if (per === null || per === 0) return 0;
  return amount / per;
}
