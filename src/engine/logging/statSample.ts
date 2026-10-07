import type { Combatant } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { DamageSchool } from '../combat/DamageSchool';
import { DAMAGE_SCHOOLS } from '../combat/DamageSchool';
import { spellPowerFor } from '../combat/damage';
import { hasteMultiplierFrom } from '../combat/ratings';

/**
 * The stats a results page averages over a fight.
 *
 * Three of the four are read straight off the block; haste is converted to the
 * MULTIPLIER the swing timer divides by, because a rating is not a number
 * anybody can read and because the conversion is the thing that makes Slice and
 * Dice, Flurry and Rapid Fire the same kind of quantity.
 */
export interface StatSampleValues {
  readonly attackPower: number;
  readonly rangedAttackPower: number;
  readonly spellPower: number;
  /**
   * What a SCHOOL's damage actually reads, for each school that reads more
   * than the blind pool above. Already includes the blind pool.
   *
   * --------------------------------------------------------------------------
   * THE BLIND FIGURE ALONE UNDERSTATES EVERY CASTER WHO OWNS SCHOOL-SCOPED
   * GEAR, and seventeen item lines say "damage done by Shadow spells" or
   * similar. A Shadow Priest reads its blind pool plus a Shadow-only pool on
   * every spell it casts, and the results page was reporting the blind half as
   * "Spell Power -- fight average". Nothing about that was visibly wrong: it is
   * a plausible number, it matched the character sheet's own blind row, and the
   * sheet listed the scoped pools in a DIFFERENT panel.
   *
   * IT GOES THROUGH `spellPowerFor`, which is the function `dealDamage` and the
   * Paladin's seal already use -- the same argument the character sheet's
   * `scopedSpellPowerRows` makes. A second expression of "blind plus the
   * school's" would be one too many, because the failure of the two disagreeing
   * is a number that is plausible either way.
   *
   * ONLY THE SCHOOLS THAT DIFFER are carried, so a Warrior's sample is an empty
   * object and a Mage's holds the one or two its gear names. `physical` is
   * excluded because physical damage reads attack power and never this.
   * --------------------------------------------------------------------------
   */
  readonly spellPowerBySchool: Readonly<Partial<Record<DamageSchool, number>>>;
  readonly hasteMultiplier: number;
}

/** What this combatant's sampled stats are right now. Pure; emits nothing. */
export function statSampleOf(actor: Combatant): StatSampleValues {
  const stats = actor.stats.effective;
  return {
    attackPower: stats.attackPower,
    rangedAttackPower: stats.rangedAttackPower,
    spellPower: stats.spellPower,
    spellPowerBySchool: scopedSpellPower(actor, stats.spellPower),
    hasteMultiplier: hasteMultiplierFrom(stats),
  };
}

function scopedSpellPower(
  actor: Combatant,
  blind: number,
): Readonly<Partial<Record<DamageSchool, number>>> {
  const scoped: Partial<Record<DamageSchool, number>> = {};
  for (const school of DAMAGE_SCHOOLS) {
    if (school === 'physical') continue;
    const total = spellPowerFor(actor, school);
    if (total > blind) scoped[school] = total;
  }
  return scoped;
}

/**
 * Emit a stat sample, unless nothing the sample carries has moved.
 *
 * ------------------------------------------------------------------------------
 * THE SKIP IS WHAT KEEPS THIS CHEAP ENOUGH TO CALL FROM EVERY AURA EDGE. Most
 * auras carry no stat modifiers at all -- a debuff on the target, a cooldown
 * marker, a proc window -- so calling this on every application and removal
 * would otherwise double the event stream to say nothing. Comparing against the
 * last sample costs four number comparisons against a cached stat block.
 *
 * `force` IS FOR THE TWO BOUNDARIES. Combat start must emit whatever the
 * character opened with, or the first window has no value; combat end must
 * emit so the last window has a length. Neither can be skipped on "nothing
 * changed", and the start one also re-bases the memo -- which matters because a
 * test may hand the SAME `Combatant` to two simulations in a row.
 * ------------------------------------------------------------------------------
 */
export function sampleStats(
  context: SimulationContext,
  actor: Combatant,
  force = false,
): void {
  const values = statSampleOf(actor);
  if (!force && unchanged(actor.lastStatSample, values)) return;

  actor.lastStatSample = values;
  context.telemetry.emit({
    type: 'stat_sample',
    timestamp: context.clock.now(),
    actorId: actor.id,
    ...values,
  });
}

function unchanged(
  previous: StatSampleValues | undefined,
  next: StatSampleValues,
): boolean {
  return (
    previous !== undefined &&
    previous.attackPower === next.attackPower &&
    previous.rangedAttackPower === next.rangedAttackPower &&
    previous.spellPower === next.spellPower &&
    previous.hasteMultiplier === next.hasteMultiplier &&
    sameSchools(previous.spellPowerBySchool, next.spellPowerBySchool)
  );
}

/*
 * THE SCOPED POOLS MOVE IN LOCKSTEP WITH THE BLIND ONE, because
 * `SchoolModifiers` is built once when the character is and the only thing that
 * moves during a fight is the blind pool it is added to. So this comparison
 * never decides anything on its own today -- it is here because the memo is the
 * reason a sample is SKIPPED, and a field the memo does not read is a field that
 * can change without being emitted. That is a silent averaging error, which is
 * the failure this whole file is written to avoid.
 */
function sameSchools(
  previous: Readonly<Partial<Record<DamageSchool, number>>>,
  next: Readonly<Partial<Record<DamageSchool, number>>>,
): boolean {
  const keys = Object.keys(next) as DamageSchool[];
  if (keys.length !== Object.keys(previous).length) return false;
  return keys.every((school) => previous[school] === next[school]);
}
