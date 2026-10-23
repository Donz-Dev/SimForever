import type { StatName } from '../../engine';
import type { BenchStat } from './benchmarkGear';
import {
  BENCHMARK_TEMPLATES,
  BENCHMARK_TEMPLATES_BY_LABEL,
  BENCHMARK_TEMPLATES_BY_PRESET,
} from './benchmarkSets';
import type { StatValuation } from './itemValue';

/**
 * THE STAT VALUATION A PROFILE OPENS WITH.
 *
 * ==============================================================================
 * EVERY PREFERRED STAT AT 1.00, BY THE OWNER'S INSTRUCTION -- "I'll provide
 * the stat valuation after this feature is fully implemented. For now just
 * make all the preferred stats valued at 1.00."
 *
 * So this file invents no magnitude at all. **Which stats a build prefers is
 * the owner's own data** -- `BenchmarkTemplate.preferred`, the column their
 * spreadsheet supplies in descending order of importance -- and the only thing
 * added here is a flat 1.00 against each, which the owner specified.
 *
 * WHAT THAT COSTS, SAID PLAINLY: at 1.00 each, the ORDER the owner wrote is
 * discarded. A build whose first preference is Crit and whose fifth is Stamina
 * values them identically, so the sort is "how much preferred stat is on this
 * item" rather than "how good is this item". That is what was asked for, it is
 * one record away from being right, and `StatValuationPanel` is where a real
 * run overwrites it.
 *
 * ------------------------------------------------------------------------------
 * A BUILD WITH NO TEMPLATE GETS AN EMPTY VALUATION AND SAYS SO.
 *
 * The 25 templates are the owner's; a character somebody built by hand has no
 * row in that spreadsheet and there is nothing to derive. An empty valuation
 * scores every item zero, and the panel sorts by ITEM LEVEL when that happens
 * and labels the column so -- rather than printing a column of 0.0 that reads
 * like every item being worthless.
 * ==============================================================================
 */

/**
 * The owner's column heading to the engine stat the item parser produces.
 *
 * ------------------------------------------------------------------------------
 * TWO ENTRIES ARE NOT THE OBVIOUS ONE AND BOTH ARE THE PARSER'S DOING:
 *
 *   "Expertise" is `dodgeParryReduction`, because `+N Expertise Rating`
 *   reduces the chance to be dodged or parried and this project keeps that
 *   apart from hit -- they come off different slices of the table.
 *
 *   "Block" is `blockChance` and NOT `blockValue`, although both exist and a
 *   tank cares more about the second. `+N Block Rating` -- the line the
 *   benchmark generator writes for this preference -- is a CHANCE. Block
 *   VALUE is flat damage, in the forties on a real shield, and pricing it at
 *   1.00 beside stats measured in points and percentage points would make one
 *   line of one item outweigh everything else in the slot. It is left at zero
 *   for the owner's valuation to set deliberately.
 * ------------------------------------------------------------------------------
 */
export const STAT_FOR_BENCH_STAT: Readonly<Record<BenchStat, StatName>> = {
  Crit: 'critRating',
  Hit: 'hitChance',
  Expertise: 'dodgeParryReduction',
  Strength: 'strength',
  Agility: 'agility',
  Stamina: 'stamina',
  Intellect: 'intellect',
  Spirit: 'spirit',
  'Attack Power': 'attackPower',
  'Spell Power': 'spellPower',
  Defense: 'defenseSkill',
  Parry: 'parryChance',
  Block: 'blockChance',
  Dodge: 'dodgeChance',
  'Bonus Armor': 'armor',
  'Healing Power': 'healingPower',
};

/** The weight every preferred stat gets until the owner supplies a valuation. */
export const PLACEHOLDER_PREFERRED_WEIGHT = 1;

function valuationFrom(preferred: readonly BenchStat[], carriesBow: boolean): StatValuation {
  const valuation: Partial<Record<StatName, number>> = {};
  for (const stat of preferred) {
    valuation[STAT_FOR_BENCH_STAT[stat]] = PLACEHOLDER_PREFERRED_WEIGHT;
    /*
     * A BUILD THAT CARRIES A BOW PRICES THE RANGED POOL TOO.
     *
     * The owner's column says "Attack Power" and the item data has two fields,
     * because a bare "+40 Attack Power" line reaches both pools by their
     * ruling and a "+36 Ranged Attack Power" line reaches only one. Pricing
     * both here does NOT double anything -- `scoreStats` treats the pair as
     * one purchase -- and it is what makes a Hunter's own bow lines count.
     */
    if (stat === 'Attack Power' && carriesBow) {
      valuation.rangedAttackPower = PLACEHOLDER_PREFERRED_WEIGHT;
    }
  }
  return valuation;
}

const BY_PRESET: ReadonlyMap<string, StatValuation> = new Map(
  BENCHMARK_TEMPLATES.map(
    (t) => [t.presetId, valuationFrom(t.preferred, t.weapons.ranged === true)] as const,
  ),
);

/** The opening valuation for a preset, or an empty one for a build with no template. */
export function defaultValuationForPreset(presetId: string | undefined): StatValuation {
  if (presetId === undefined) return {};
  return BY_PRESET.get(presetId) ?? {};
}

/**
 * The same, found by the character's NAME.
 *
 * The name join is `BENCHMARK_TEMPLATES_BY_LABEL`'s, kept because a profile
 * loaded from a file written before the template id was stored has nothing
 * else to go on. See `templateIdFor`.
 */
export function defaultValuationForName(characterName: string): StatValuation {
  const template = BENCHMARK_TEMPLATES_BY_LABEL.get(characterName);
  return template ? defaultValuationForPreset(template.presetId) : {};
}

/**
 * Which template a profile belongs to: the stored id first, then the name.
 *
 * ------------------------------------------------------------------------------
 * THE STORED ID IS WHY `benchmarkTemplateId` EXISTS. The name join is a join
 * on a string a user can edit, so renaming the character took the four test
 * set buttons away -- a visible failure rather than a wrong one, and still a
 * failure. A preset now writes its template id onto the profile, and the name
 * is the FALLBACK for every file saved before it did.
 *
 * BOTH ARE CHECKED AGAINST THE TEMPLATE TABLE, so a stored id this build no
 * longer carries falls through to the name rather than returning an id that
 * resolves to nothing.
 * ------------------------------------------------------------------------------
 */
export function templateIdFor(
  storedTemplateId: string | undefined,
  characterName: string,
): string | undefined {
  if (storedTemplateId !== undefined && BENCHMARK_TEMPLATES_BY_PRESET.has(storedTemplateId)) {
    return storedTemplateId;
  }
  return BENCHMARK_TEMPLATES_BY_LABEL.get(characterName)?.presetId;
}
