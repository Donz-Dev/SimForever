import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { PREDATORY_DISCIPLINE_AURA_ID } from '../../src/game/auras/druid';
import { CAT_BITE_POOL_ENERGY } from '../../src/game/rotations/druid';
import type { AplEntry } from '../../src/game/rotations/apl';
import { all, comboPoints, not, resource } from '../../src/game/rotations/apl/shorthand';
import type { CharacterProfile } from '../../src/profiles';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { type BatchResult, runBatch } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * THE CAT'S TWO FINISHER QUESTIONS, ASKED OF THE WHOLE PROFILE (1.60.1.70707).
 *
 * 1. RIP UPTIME AGAINST FEROCIOUS BITE. The shipped list holds Rip up and
 *    spends the five-point finishers Rip does not need on a pooled bite. The
 *    alternative is the obvious one now that Predatory Discipline makes a bite
 *    cheap: no Rip at all, and EVERY five-point finisher a pooled bite.
 *    Holding Rip up reads +89.8 +/- 18.2 here, at 40 fights of 120 s; the
 *    sweep in tools/optimise/catBite84.ts priced its pool-90 sibling at -68.6
 *    over 400.
 *
 * 2. PREDATORY DISCIPLINE, ON THAT MAXIMUM-BITE LIST. The talent keeps the 65
 *    energy above the bite's cost and still pays 2.7 a point for it, so the
 *    same list with it should bite as hard and Shred more: +96.5 +/- 16.7
 *    here. With the strip below made a no-op, this test fails -- that check
 *    is what shows the comparison reaches the talent.
 *
 * PAIRED, ITERATION BY ITERATION, at one base seed: each fight's duration is
 * rolled first, so the two batches fight the same clocks and the difference is
 * far tighter than two independent means. A CLAUDE.md rule, and the only
 * reason forty fights is enough.
 *
 * THE MECHANISM IS ASSERTED BESIDE THE DPS, because a DPS gap with nothing
 * behind it reads exactly like a patch that did not apply: Rip's uptime and
 * the bite count for the first, the energy the bites leave and the Shreds it
 * buys for the second.
 * ==============================================================================
 */

const ITERATIONS = 40;
const DURATION_SECONDS = 120;
// Two 40-fight batches per comparison against a full preset.
const SIMULATES_A_BATCH_MS = 60_000;

function catProfile(): CharacterProfile {
  const preset = PRESETS_BY_ID.get('druid_cat')!.build();
  return {
    ...preset,
    simulation: { ...preset.simulation, iterations: ITERATIONS, durationSeconds: DURATION_SECONDS },
  };
}

/** The same edit `tools/buildVariants.ts`' `apl` makes, without importing a tool. */
function withEntries(profile: CharacterProfile, edit: (entries: AplEntry[]) => AplEntry[]): CharacterProfile {
  return {
    ...profile,
    rotation: { ...profile.rotation, source: 'custom', entries: edit([...profile.rotation.entries]) },
  };
}

/** The `nth` entry for `abilityId`, counting from zero. */
function nthIndex(entries: readonly AplEntry[], abilityId: string, nth: number): number {
  let seen = -1;
  const at = entries.findIndex((e) => e.abilityId === abilityId && ++seen === nth);
  if (at < 0) throw new Error(`no entry ${nth} for ${abilityId}`);
  return at;
}

/*
 * MAXIMUM FEROCIOUS BITE: the Rip entry gone, and the pooled bite (the SECOND
 * `ferocious_bite` -- the first is the last-eight-seconds one) and its held
 * Shred filler (the THIRD `shred` -- Clearcasting, end of fight, filler) no
 * longer ask about Rip. So every five-point finisher waits for a full bar and
 * is a bite, which is `cat84Rip`'s "no Rip at all" variant.
 */
function maximumBite(profile: CharacterProfile): CharacterProfile {
  const five = comboPoints('atLeast', 5);
  return withEntries(profile, (entries) => {
    entries.splice(nthIndex(entries, 'rip', 0), 1);
    const bite = nthIndex(entries, 'ferocious_bite', 1);
    entries[bite] = { ...entries[bite], condition: all(five, resource('atLeast', CAT_BITE_POOL_ENERGY, 'energy')) };
    const shred = nthIndex(entries, 'shred', 2);
    entries[shred] = {
      ...entries[shred],
      condition: not(all(five, resource('below', CAT_BITE_POOL_ENERGY, 'energy'))),
    };
    return entries;
  });
}

/*
 * WITHOUT PREDATORY DISCIPLINE, BY TAKING THE MARKER AURA OFF THE CHARACTER
 * RATHER THAN THE POINT OFF THE TREE. Shifting Power requires Predatory
 * Discipline 1/1, so a talent swap strips the capstone with it and measures
 * two talents. The aura is the talent's entire effect -- `ferociousBite` asks
 * `caster.auras.has` and nothing else reads it -- so removing it from the
 * opening auras is the talent absent and everything else identical.
 */
function batch(profile: CharacterProfile, withoutDiscipline = false): BatchResult {
  const config = trainingDummyEncounter(profile);
  const strip = (actor: Combatant): Combatant => {
    if (withoutDiscipline && actor.openingAuras.some((a) => a.id === PREDATORY_DISCIPLINE_AURA_ID)) {
      (actor as { openingAuras: Combatant['openingAuras'] }).openingAuras = actor.openingAuras.filter(
        (a) => a.id !== PREDATORY_DISCIPLINE_AURA_ID,
      );
    }
    return actor;
  };
  return runBatch(
    { ...config, createCombatants: () => config.createCombatants().map(strip) },
    { iterations: profile.simulation.iterations, baseSeed: profile.simulation.seed },
  );
}

/** Mean and a 95% interval of `a - b`, iteration by iteration. */
function paired(a: BatchResult, b: BatchResult): { mean: number; interval: number } {
  expect(a.dpsSamples.length).toBe(b.dpsSamples.length);
  const d = a.dpsSamples.map((x, i) => x - b.dpsSamples[i]!);
  const mean = d.reduce((s, x) => s + x, 0) / d.length;
  const variance = d.reduce((s, x) => s + (x - mean) ** 2, 0) / (d.length - 1);
  return { mean, interval: 1.96 * Math.sqrt(variance / d.length) };
}

const uses = (b: BatchResult, name: string) => b.abilities.find((row) => row.abilityName === name)?.uses ?? 0;
const ripUptime = (b: BatchResult) => b.debuffUptime.find((row) => row.auraId === 'rip')?.uptime ?? 0;

describe('the Cat: Rip uptime against maximum Ferocious Bite', () => {
  it(
    'holds Rip up, and beats spending every five-point finisher on a pooled bite',
    () => {
      const profile = catProfile();
      const shipped = batch(profile);
      const biteOnly = batch(maximumBite(profile));

      // The two lists did what they say: one keeps Rip up, the other never
      // casts it and bites far more often.
      expect(uses(shipped, 'Rip')).toBeGreaterThan(0);
      expect(ripUptime(shipped)).toBeGreaterThan(0.7);
      expect(uses(biteOnly, 'Rip')).toBe(0);
      expect(ripUptime(biteOnly)).toBe(0);
      expect(uses(biteOnly, 'Ferocious Bite')).toBeGreaterThan(uses(shipped, 'Ferocious Bite') * 1.5);

      // And holding Rip up is worth more than every bite it displaces.
      const gain = paired(shipped, biteOnly);
      expect(gain.mean - gain.interval, JSON.stringify(gain)).toBeGreaterThan(0);
    },
    SIMULATES_A_BATCH_MS,
  );
});

describe('the Cat: maximum Ferocious Bite with and without Predatory Discipline', () => {
  it(
    'keeps the bar after every bite, Shreds more for it, and deals more damage',
    () => {
      const biteOnly = maximumBite(catProfile());
      const kept = batch(biteOnly);
      const spent = batch(biteOnly, true);

      // The talent arrives on one character and not the other, and nothing
      // else about the build moved: Shifting Power is cast either way.
      expect(kept.buffUptime.some((row) => row.auraId === PREDATORY_DISCIPLINE_AURA_ID)).toBe(true);
      expect(spent.buffUptime.some((row) => row.auraId === PREDATORY_DISCIPLINE_AURA_ID)).toBe(false);
      expect(uses(spent, 'Shifting Power')).toBeGreaterThan(0);

      // The energy a bite would have burned buys Shreds.
      expect(uses(kept, 'Shred')).toBeGreaterThan(uses(spent, 'Shred'));

      const gain = paired(kept, spent);
      expect(gain.mean - gain.interval, JSON.stringify(gain)).toBeGreaterThan(0);
    },
    SIMULATES_A_BATCH_MS,
  );
});
