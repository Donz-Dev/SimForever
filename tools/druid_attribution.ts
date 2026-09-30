/*
 * ============================================================================
 * WHAT EACH PIECE OF THE DRUID WORK IS WORTH, ISOLATED.
 *
 *   npx vite-node tools/druid_attribution.ts
 *
 * The Cat moved +168.1 and is now the highest profile in the project, above
 * DW Fury. A number that large wants attributing rather than asserting, and
 * "ISOLATE A LOSS, DO NOT BLAME THE OBVIOUS SUSPECT" cuts both ways: a gain of
 * this size is three or four things, and guessing the split has been wrong
 * before.
 *
 * HOW IT ISOLATES. Each variant takes ONE talent back out of the allocation and
 * re-measures, so the figure is "what this talent is worth TO THIS BUILD".
 * Five of the six were completely inert before this work, so for them removing
 * the talent and reverting the change are the same thing. Heart of the Wild is
 * the exception -- its intellect clause always applied -- and the Glaive is not
 * a talent at all, so its own conditional stat is emptied instead.
 *
 * THE SAME 30 BATCHES OF 10 the baseline uses, so the intervals are comparable
 * and a difference inside one is not a difference. One profile at a time, which
 * is why this is affordable.
 *
 * AND IT REPORTS WHAT ELSE THE REMOVAL STRIPPED, which is the trap this kind of
 * probe walks into. Taking three points out of Feral Combat can put a deeper
 * talent under its tier gate or remove its prerequisite, and `createPlayer`
 * drops that one SILENTLY -- so "Predatory Strikes is worth +62.9" was really
 * Predatory Strikes plus Rend and Tear plus Berserk. A figure with a cascade
 * beside it is still useful; one without the cascade named is a rumour.
 *
 * NOT A TEST AND NOT A BASELINE. Its figures belong in a commit message.
 * ============================================================================
 */
import { runProfileBatch } from '../src/simulator';
import { PROFILE_PRESETS } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { ITEMS_BY_ID } from '../src/game/items/itemData';
import { talentsForClass } from '../src/game/talents/talentData';
import { legalAllocation } from '../src/game/talents/talentRules';

const DRUID_TREE = talentsForClass('druid')!;

const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const GLAIVE = 227833;

/** Mean and half-interval across `SEEDS` independent batches. */
function measure(profile: CharacterProfile): { dps: number; interval: number } {
  const figures: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, iterations: ITERATIONS, seed: seed * 7919 },
    } as never);
    figures.push(batch.dps.mean);
  }
  const mean = figures.reduce((a, b) => a + b, 0) / figures.length;
  const variance =
    figures.reduce((total, f) => total + (f - mean) ** 2, 0) / Math.max(1, figures.length - 1);
  return { dps: mean, interval: (1.96 * Math.sqrt(variance)) / Math.sqrt(figures.length) };
}

const without = (profile: CharacterProfile, talentId: string): CharacterProfile => {
  const talents = { ...profile.talents };
  delete talents[talentId];
  return { ...profile, talents };
};

/*
 * The Glaive is an ITEM, so its variant empties the conditional stat rather
 * than editing a build. Mutating the shared item is fine here and nowhere else:
 * this process measures one thing and exits.
 */
function stripGlaive(): void {
  const glaive = ITEMS_BY_ID.get(GLAIVE);
  if (!glaive) throw new Error('the Glaive of Obsidian Fury is not in the item data');
  (glaive as { styleStats: Record<string, unknown> }).styleStats = {};
}

const FERAL_TALENTS = [
  'predatory_strikes',
  'rend_and_tear',
  'genesis',
  'heart_of_the_wild',
  'king_of_the_jungle',
  'natural_reaction',
] as const;

const MOONKIN_TALENTS = ['nature_s_splendor', 'genesis', 'moonkin_form'] as const;

console.log(`SEEDS=${SEEDS} ITERATIONS=${ITERATIONS}\n`);

for (const [id, talents] of [
  ['druid_cat', FERAL_TALENTS],
  ['druid_bear', FERAL_TALENTS],
  ['druid_moonkin', MOONKIN_TALENTS],
] as const) {
  const preset = PROFILE_PRESETS.find((p) => p.id === id);
  if (!preset) continue;
  const full = measure(preset.build());
  console.log(`=== ${preset.label}  ${full.dps.toFixed(1)} DPS  +/- ${full.interval.toFixed(1)}`);

  for (const talentId of talents) {
    const rank = preset.build().talents[talentId];
    if (rank === undefined) continue;
    const variant = without(preset.build(), talentId);
    // What ELSE this removal costs the build, before the figure is believed.
    const cascade = legalAllocation(DRUID_TREE, variant.talents).dropped;
    const result = measure(variant);
    const worth = full.dps - result.dps;
    const real = Math.abs(worth) > full.interval + result.interval ? 'REAL' : 'noise';
    console.log(
      `  -${talentId.padEnd(22)} rank ${rank}  ${result.dps.toFixed(1)}  worth ${worth >= 0 ? '+' : ''}${worth.toFixed(1)}  ${real}` +
        (cascade.length ? `   ALSO DROPS ${cascade.join(', ')}` : ''),
    );
  }
}

// The Glaive last, because it is a one-way change to the shared item data.
stripGlaive();
for (const id of ['druid_cat', 'druid_bear'] as const) {
  const preset = PROFILE_PRESETS.find((p) => p.id === id);
  if (!preset) continue;
  const result = measure(preset.build());
  console.log(`=== ${preset.label} without the Glaive's form clause  ${result.dps.toFixed(1)} DPS`);
}
