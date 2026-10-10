/*
 * ============================================================================
 * WHICH MID-FIGHT CONSUMABLE EACH PRESET SHOULD CARRY, MEASURED.
 *
 *   npx vite-node tools/probe_consumable_choice.ts
 *   PROFILES=druid_cat,prot_warr npx vite-node tools/probe_consumable_choice.ts
 *   SEEDS=30 ITERATIONS=10 npx vite-node tools/probe_consumable_choice.ts
 *
 * ----------------------------------------------------------------------------
 * THE OWNER ASKED FOR "a sensible one" PER PRESET, and the twelve categories
 * that came before these follow ONE WRITTEN RULE rather than taste: "take every
 * category the build can actually read, choosing within a category by what the
 * build scales with, and leave empty only what is worth literally nothing."
 *
 * THE DIFFERENCE IS THAT THESE CANNOT BE READ OFF A CONVERSION TABLE. The
 * existing rows were derived -- the conversion table decides Blasted Lands, the
 * measured damage school decides School Spell Power -- and a potion is a
 * decision about a POOL and a WINDOW. "Forty attack power for thirty seconds"
 * against "sixty strength for twenty" against "2250 mana" is not an arithmetic
 * question, and "measure a list, do not reason about it" is this project's rule
 * for exactly this shape.
 *
 * SO EVERY CANDIDATE IS RUN. For each preset, this measures its current figure
 * and then the figure with each legal Potion and each legal Other substituted
 * in, and prints the delta with its interval. A difference inside the interval
 * is not a difference.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is pick. Two candidates inside each other's
 * intervals are a tie that a reader resolves on the written rule, and a tool
 * that printed one winner would hide that.
 * ----------------------------------------------------------------------------
 * AND IT PRINTS THE CASTS, WHICH IS THE HALF A DPS FIGURE CANNOT SAY. A potion
 * selected and never drunk measures as a tie with drinking nothing -- the entry
 * is gated, and a gate that never opens looks exactly like a potion that is
 * worth nothing. `casts` separates them.
 * ============================================================================
 */
import { runProfileBatch } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { syncDefaultRotation } from '../src/profiles/rotation';
import {
  CONSUMABLE_CATEGORIES_BY_ID,
  consumableAllowsClass,
} from '../src/game/buffs/consumables';

const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const FILTERS = (process.env.PROFILES ?? '')
  .split(',')
  .map((part) => part.trim().toLowerCase())
  .filter((part) => part.length > 0);

interface Measurement {
  readonly mean: number;
  readonly interval: number;
  /** Mean casts of the candidate per fight, which is the other half. */
  readonly casts: number;
  readonly deaths: number;
}

/**
 * Mean DPS over SEEDS batches, plus how often the candidate actually fired.
 *
 * Mirrors `measure_profiles.ts` exactly -- same seeds, same iterations, same
 * interval -- so a figure here is comparable with a figure there rather than
 * being a second, differently-shaped measurement of the same thing.
 */
function measure(profile: CharacterProfile, candidateName: string | undefined): Measurement {
  const samples: number[] = [];
  let casts = 0;
  let deaths = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, seed, iterations: ITERATIONS },
    });
    samples.push(batch.dps.mean);
    const deathSamples = batch.deathSamples;
    deaths +=
      deathSamples.length > 0
        ? deathSamples.reduce((a, b) => a + b, 0) / deathSamples.length
        : 0;
    if (candidateName) {
      casts += batch.abilities.find((row) => row.abilityName === candidateName)?.uses ?? 0;
    }
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.length < 2
      ? 0
      : samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return {
    mean,
    interval: samples.length < 2 ? NaN : 2 * Math.sqrt(variance / samples.length),
    casts: casts / SEEDS,
    deaths: deaths / SEEDS,
  };
}

/** The profile with one category set to one option, list re-derived. */
function withChoice(
  profile: CharacterProfile,
  categoryId: string,
  optionId: string | undefined,
): CharacterProfile {
  const consumables: Record<string, string> = { ...profile.consumables };
  if (optionId) consumables[categoryId] = optionId;
  else delete consumables[categoryId];
  /*
   * RE-DERIVED, because the ENTRY is half of what is being measured. A profile
   * carrying the potion with no line in its list drinks nothing, which would
   * measure every candidate as a tie -- and `syncDefaultRotation` is what the
   * app itself runs on the same change.
   */
  return syncDefaultRotation({ ...profile, consumables });
}

const presets = PROFILE_PRESETS.filter(
  (preset) => FILTERS.length === 0 || FILTERS.some((part) => preset.id.includes(part)),
);

console.log(`SEEDS=${SEEDS} ITERATIONS=${ITERATIONS}  (${SEEDS * ITERATIONS} fights per cell)\n`);

for (const preset of presets) {
  const base = preset.build();
  const characterClass = base.character.characterClass;
  const baseline = measure(withChoice(withChoice(base, 'potion', undefined), 'other', undefined), undefined);

  console.log(`${preset.label}  (${preset.id})`);
  console.log(`  nothing selected         ${baseline.mean.toFixed(1)} +/- ${baseline.interval.toFixed(1)}`);

  for (const categoryId of ['potion', 'other'] as const) {
    const category = CONSUMABLE_CATEGORIES_BY_ID.get(categoryId)!;
    for (const option of category.options) {
      if (!consumableAllowsClass(option, characterClass)) continue;
      const candidate = withChoice(
        withChoice(withChoice(base, 'potion', undefined), 'other', undefined),
        categoryId,
        option.id,
      );
      const result = measure(candidate, option.ability?.name);
      const delta = result.mean - baseline.mean;
      const real = Math.abs(delta) > result.interval + baseline.interval ? 'REAL ' : 'noise';
      /*
       * DEATHS AS WELL AS DPS, AND FOR A TANK THAT IS THE FIGURE THAT DECIDES.
       *
       * "Avoid death" is treated as a stat in the owner's own framing, and the
       * two heals are worth nothing at all in damage: a healing potion on the
       * Protection warrior measured -1.9 DPS, which is the cost of the poll and
       * says nothing about whether it kept the tank alive. Printed as a DELTA
       * with the sign flipped, so more is better in both columns -- the same
       * convention `survivalWeightsFrom` applies once for the same reason.
       */
      const avoided = baseline.deaths - result.deaths;
      console.log(
        '  %s %s +/- %s   %s%s  %s  casts %s%s%s',
        `${categoryId}/${option.id}`.padEnd(24),
        result.mean.toFixed(1).padStart(7),
        result.interval.toFixed(1).padStart(4),
        delta >= 0 ? '+' : '',
        delta.toFixed(1).padStart(6),
        real,
        result.casts.toFixed(2).padStart(5),
        baseline.deaths > 0
          ? `  deaths ${result.deaths.toFixed(2).padStart(5)} (${avoided >= 0 ? '+' : ''}${avoided.toFixed(2)} avoided)`
          : '',
        result.casts === 0 ? '  <-- NEVER DRUNK' : '',
      );
    }
  }
  if (baseline.deaths > 0) {
    console.log(`  (a tank: ${baseline.deaths.toFixed(2)} deaths a fight with nothing selected)`);
  }
  console.log('');
}
