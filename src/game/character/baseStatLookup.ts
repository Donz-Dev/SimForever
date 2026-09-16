import type { PartialStats } from '../../engine';
import { BASE_STATS } from './baseStats';
import type { BaseStatBlock } from './baseStatTypes';
import type { ClassId, CombatStyleId, RaceId } from './ids';

/**
 * Forms that have no row of their own and borrow another form's stats.
 *
 * Moonkin Form and Tree of Life Form are both declared Druid forms with no row
 * in the base stats spreadsheet. Since the Druid's forms differ only in hit
 * points and attack power, and both share Caster Form's stat conversions, they
 * borrow Caster Form's numbers.
 *
 * These are INTERPRETATIONS, not data. If either form should have its own hit
 * points or attack power, it needs a row in the spreadsheet and its entry here
 * should go away.
 */
const FORM_STAT_FALLBACKS: Partial<Record<CombatStyleId, CombatStyleId>> = {
  moonkin: 'caster',
  tree: 'caster',
};

/**
 * The form whose mana pool a class carries regardless of its current form.
 *
 * The spreadsheet lists Mana as 0 for Bear and Cat Form. That means mana is not
 * the resource those forms run on, not that the pool ceases to exist — a bear
 * still has mana it simply is not spending. So the pool is always sized from
 * Caster Form.
 *
 * Also an interpretation. It matters because a Druid shifting to bear form
 * mid-fight must not silently lose its mana.
 */
const MANA_REFERENCE_FORM: CombatStyleId = 'caster';

/**
 * Base stats for a race, class and form at level 60.
 *
 * Returns undefined for a combination the ruleset does not allow, which is the
 * same answer `isValidCombination` gives.
 */
export function baseStatsFor(
  race: RaceId,
  characterClass: ClassId,
  form?: CombatStyleId,
): BaseStatBlock | undefined {
  const variants = BASE_STATS[race]?.[characterClass];
  if (!variants || variants.length === 0) return undefined;

  // Classes without forms have a single variant tagged `null`.
  if (form === undefined) {
    return (variants.find((variant) => variant.form === null) ?? variants[0]).stats;
  }

  const direct = variants.find((variant) => variant.form === form);
  if (direct) return direct.stats;

  const fallback = FORM_STAT_FALLBACKS[form];
  if (fallback) {
    const borrowed = variants.find((variant) => variant.form === fallback);
    if (borrowed) return borrowed.stats;
  }

  // A form this class does not have: fall back to its default row.
  return (variants.find((variant) => variant.form === null) ?? variants[0]).stats;
}

/**
 * Maximum mana for a race and class.
 *
 * Always taken from the reference form, so a Druid keeps its mana pool in bear
 * and cat form. 0 for classes that do not use mana.
 */
export function baseManaFor(race: RaceId, characterClass: ClassId): number {
  const variants = BASE_STATS[race]?.[characterClass];
  if (!variants || variants.length === 0) return 0;

  const hasForms = variants.some((variant) => variant.form !== null);
  const reference = hasForms
    ? variants.find((variant) => variant.form === MANA_REFERENCE_FORM)
    : variants.find((variant) => variant.form === null);

  return (reference ?? variants[0]).stats.mana;
}

/** Maximum health for a race, class and form. */
export function baseHitPointsFor(
  race: RaceId,
  characterClass: ClassId,
  form?: CombatStyleId,
): number {
  return baseStatsFor(race, characterClass, form)?.hitPoints ?? 0;
}

/**
 * Convert base stats into the engine's stat block.
 *
 * Hit points and mana are deliberately left out: they are resource maximums,
 * not stats, and live on the combatant's `health` and mana pools instead.
 *
 * The crit values ARE included, as the base constants they are. They can be
 * negative — a Hunter's is -1.53 — and the class conversion table adds the
 * contribution from agility and intellect on top.
 */
export function baseStatsToEngineStats(base: BaseStatBlock): PartialStats {
  return {
    strength: base.strength,
    agility: base.agility,
    stamina: base.stamina,
    intellect: base.intellect,
    spirit: base.spirit,
    attackPower: base.attackPower,
    rangedAttackPower: base.rangedAttackPower,
    critChance: base.critChance,
    spellCritChance: base.spellCritChance,
  };
}

/** Every base stat row, for tests and tooling. */
export function allBaseStatEntries(): {
  race: RaceId;
  characterClass: ClassId;
  form: CombatStyleId | null;
  stats: BaseStatBlock;
}[] {
  const entries: {
    race: RaceId;
    characterClass: ClassId;
    form: CombatStyleId | null;
    stats: BaseStatBlock;
  }[] = [];

  for (const [race, classes] of Object.entries(BASE_STATS) as [
    RaceId,
    Partial<Record<ClassId, readonly { form: CombatStyleId | null; stats: BaseStatBlock }[]>>,
  ][]) {
    for (const [characterClass, variants] of Object.entries(classes) as [
      ClassId,
      readonly { form: CombatStyleId | null; stats: BaseStatBlock }[],
    ][]) {
      for (const variant of variants) {
        entries.push({ race, characterClass, form: variant.form, stats: variant.stats });
      }
    }
  }

  return entries;
}
