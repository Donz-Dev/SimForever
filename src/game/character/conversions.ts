import type {
  PartialStats,
  PrimaryStatName,
  StatDerivation,
  StatName,
  Stats,
} from '../../engine';
import type { ClassId, CombatStyleId } from './ids';

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
  /** Strength needed for one point of block value. */
  readonly strengthPerBlockValue: number;
  /**
   * Parry chance the class simply has, in percentage points.
   *
   * NOT derived from a primary, which is why it sits here rather than in the
   * conversion table proper: it is a flat class baseline, like base crit,
   * except that the base stats spreadsheet does not carry it. The ruleset
   * owner states 5% for the Warrior.
   *
   * Defaults to 0 through `COMMON`, so a class nobody has given a figure for
   * parries nothing rather than inheriting the Warrior's.
   */
  readonly baseParryPercent: number;
}

/** Shared by every class: the conversions that never vary. */
const COMMON = {
  armorPerAgility: 2,
  hitPointsPerStamina: 10,
  /*
   * Twenty strength is a point of block value, for everyone.
   *
   * Stated by the ruleset owner. Derived rather than folded in, so it follows
   * TOTAL strength -- a Crusader proc is a hundred strength and therefore five
   * more block value for its fifteen seconds, which a number computed once at
   * character creation would miss.
   */
  strengthPerBlockValue: 20,
  // No parry unless a class says otherwise. A number nobody supplied is zero
  // here rather than a plausible guess.
  baseParryPercent: 0,
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
  // Stated by the ruleset owner: a Warrior parries 5% before any talent.
  baseParryPercent: 5,
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

const DRUID_BY_FORM: Partial<Record<CombatStyleId, StatConversions>> = {
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
  form?: CombatStyleId,
): StatConversions {
  if (characterClass === 'druid') {
    // A style the Druid does not have (or none given) means caster form.
    return DRUID_BY_FORM[form ?? 'caster'] ?? DRUID_CASTER;
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
    /*
     * Flat, and it ignores every primary. It rides along here because this is
     * the one function that owns the whole per-class table, and the caller
     * already folds what this returns on top of the base stats.
     */
    parryChance: conversions.baseParryPercent,
    blockValue: ratio(strength, conversions.strengthPerBlockValue),
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
  form?: CombatStyleId,
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

/**
 * One stat worth a fraction of another, on top of the class table.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS IS NOT A NEW ENGINE RULE.
 *
 * `StatBlock` takes its derivation as an injected function, because which
 * primary makes which secondary is game content rather than engine policy --
 * a Warrior gets 2 attack power per strength and a Rogue gets 1. Careful Aim's
 * "100% of your Intellect" is one more term in exactly that function, so the
 * rule it needs already exists: the block resolves in two passes so a derived
 * stat sees FULLY BUFFED primaries, which is what makes a strength blessing
 * raise attack power. A conversion added here inherits that for free.
 *
 * `fraction`, not a percentage: 1.0 is all of it. The talents state
 * percentages and `talentBuild` divides once, so nothing downstream has to
 * remember which it is holding.
 * ----------------------------------------------------------------------------
 */
export interface StatFromStat {
  readonly from: PrimaryStatName;
  readonly to: StatName;
  readonly fraction: number;
}

/**
 * A derivation with extra conversions folded in after the class table.
 *
 * ADDED TO whatever the class already derives rather than replacing it: the
 * Shaman's Mental Dexterity is attack power from intellect ON TOP OF the
 * attack power it already gets from strength and agility, and a conversion
 * that overwrote would silently delete the larger of the two.
 *
 * Returns the base derivation unchanged when there is nothing to add, so a
 * character with no such talent allocates nothing and behaves identically.
 */
export function withStatConversions(
  base: StatDerivation,
  conversions: readonly StatFromStat[],
): StatDerivation {
  if (conversions.length === 0) return base;

  return (primary) => {
    const derived: PartialStats = { ...base(primary) };
    for (const conversion of conversions) {
      derived[conversion.to] =
        (derived[conversion.to] ?? 0) + primary[conversion.from] * conversion.fraction;
    }
    return derived;
  };
}

/** `amount / per` as a percentage, or 0 when the conversion does not exist. */
function ratio(amount: number, per: number | null): number {
  if (per === null || per === 0) return 0;
  return amount / per;
}
