/*
 * ============================================================================
 * WHAT MANA SHOULD A WARLOCK LIFE TAP AT?
 *
 *   npx vite-node tools/probe_life_tap_gate.ts
 *   PRESET=warlock_smds npx vite-node tools/probe_life_tap_gate.ts
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S RULING: "Spending life tap on global cooldowns should only be
 * based on the warlock's current mana."
 *
 * The SM/DS list already does that -- `manaBelowFraction(0.15)`, with a comment
 * recording that an UNGATED Life Tap "fired five times a fight, each one a
 * global cooldown that dealt nothing". The FIRELOCK list was left ungated, so
 * the lesson was applied to one of the two lists that needed it.
 *
 * WHAT UNGATED ACTUALLY MEANS, because it is not "always": Life Tap's own
 * `canCast` refuses unless there is health to spend AND the mana pool has room
 * for the 840 it grants. Room in the pool is a LEGALITY check and belongs on
 * the ability; "is the mana wanted" is a POLICY question and belongs in the
 * list. Ungated, the policy was "whenever the pool is 840 below full", which on
 * a 4,000-mana caster is most of the fight.
 *
 * AND IT IS WHY HEALING THE FIRELOCK COST IT 28 DPS. A healing potion gave it
 * more health to tap with, and an entry gated on health-via-`canCast` rather
 * than on mana spent the extra health on global cooldowns. Gating on mana
 * should make a heal worth about zero rather than negative, which is the
 * owner's "this should never be the case".
 *
 * SWEPT RATHER THAN COPIED FROM SM/DS, because the two builds have different
 * mana economies -- Firelock takes no Life Tap talents and spends on a
 * different spell -- and "sweep the parameter rather than comparing the two
 * readings somebody already wrote down" is this project's rule for a threshold.
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch, resourceFlowOf } from '../src/simulator';
import type { CharacterProfile } from '../src/profiles';
import type { AplEntry } from '../src/game/rotations/apl';
import { resourceFraction } from '../src/game/rotations/apl';

const PRESET = process.env.PRESET ?? 'warlock_firelock';
const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);

/** The fractions to try, plus `undefined` for the ungated reading. */
const GATES: readonly (number | undefined)[] = (process.env.GATES ?? '0.05,0.1,0.15,0.2,0.3,0.4,0.5')
  .split(',')
  .map((part) => Number(part.trim()));

const base = PRESETS_BY_ID.get(PRESET)!.build();

/**
 * The profile with Life Tap's entry gated at one fraction.
 *
 * SLICED BY ENTRY rather than by a string replace, which is this project's own
 * rule: the entry text is identical across lists, and a one-shot replace hit
 * the wrong list the last time somebody tried it. Here the list is already data
 * on the profile, so the entry can be addressed directly -- and the count is
 * asserted, because an edit that matched nothing would measure the same build
 * eight times and read as a threshold that does not matter.
 */
function withGate(fraction: number | undefined): CharacterProfile {
  const entries: AplEntry[] = [];
  let found = 0;
  for (const entry of base.rotation.entries) {
    if (entry.abilityId !== 'life_tap') {
      entries.push(entry);
      continue;
    }
    found += 1;
    const { condition, ...rest } = entry;
    void condition;
    entries.push(
      fraction === undefined
        ? rest
        : { ...rest, condition: resourceFraction('below', fraction, 'mana') },
    );
  }
  if (found !== 1) throw new Error(`expected one life_tap entry, found ${found}`);
  // `custom`, so nothing re-derives the list out from under the measurement.
  return { ...base, rotation: { source: 'custom', name: base.rotation.name, entries } };
}

interface Row {
  readonly mean: number;
  readonly interval: number;
  readonly taps: number;
  readonly manaGained: number;
  readonly manaWasted: number;
}

function measure(profile: CharacterProfile): Row {
  const samples: number[] = [];
  let taps = 0;
  let manaGained = 0;
  let manaWasted = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, seed, iterations: ITERATIONS },
    });
    samples.push(batch.dps.mean);
    taps += batch.abilities.find((row) => row.abilityName === 'Life Tap')?.uses ?? 0;
    const mana = resourceFlowOf(batch, 'mana');
    manaGained += mana.totalGained;
    manaWasted += mana.totalWasted;
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return {
    mean,
    interval: 2 * Math.sqrt(variance / samples.length),
    taps: taps / SEEDS,
    manaGained: manaGained / SEEDS,
    manaWasted: manaWasted / SEEDS,
  };
}

console.log(`${PRESET}  SEEDS=${SEEDS} ITERATIONS=${ITERATIONS}\n`);
console.log('%-10s %9s %7s %7s %10s %10s', 'gate', 'dps', '+/-', 'taps', 'mana gain', 'wasted');

const ungated = measure(withGate(undefined));
for (const gate of [undefined, ...GATES]) {
  const row = gate === undefined ? ungated : measure(withGate(gate));
  const delta = row.mean - ungated.mean;
  console.log(
    '%-10s %9s %7s %7s %10s %10s   %s',
    gate === undefined ? 'ungated' : `below ${(gate * 100).toFixed(0)}%`,
    row.mean.toFixed(1),
    row.interval.toFixed(1),
    row.taps.toFixed(2),
    row.manaGained.toFixed(0),
    row.manaWasted.toFixed(0),
    gate === undefined ? '' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`,
  );
}
