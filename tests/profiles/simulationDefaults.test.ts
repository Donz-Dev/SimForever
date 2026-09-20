import { describe, expect, it } from 'vitest';
import { toSeconds } from '../../src/engine';
import {
  CURRENT_PROFILE_VERSION,
  createDefaultProfile,
  migrateProfile,
  validateProfile,
} from '../../src/profiles';
import { FIGHT_DURATION_VARIANCE, runProfile, runProfileBatch } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * What a new profile starts at, and how long its fights run.
 *
 * All three figures are the project owner's, written out by hand here rather
 * than read back from the table that defines them.
 */

describe('a new profile', () => {
  const simulation = createDefaultProfile().simulation;

  it('runs sixty second fights', () => {
    expect(simulation.durationSeconds).toBe(60);
  });

  it('runs three thousand of them', () => {
    /*
     * It used to be one. A single fight is a sample, not a result, and the
     * app opening on one invited reading it as though it were a measurement.
     */
    expect(simulation.iterations).toBe(3000);
  });

  it('is format 8', () => {
    expect(CURRENT_PROFILE_VERSION).toBe(8);
    expect(createDefaultProfile().version).toBe(8);
  });

  it('has no variance field at all', () => {
    expect(simulation).not.toHaveProperty('durationVariance');
  });
});

describe('fight length varies by a fixed fraction', () => {
  it('is five percent either side', () => {
    expect(FIGHT_DURATION_VARIANCE).toBe(0.05);
  });

  it('is applied to every run, whatever the profile says', () => {
    /*
     * The profile cannot turn it off, which is the whole change. The field it
     * used to be shipped at zero, so the app's default was every iteration
     * exactly the same length.
     */
    const profile = createDefaultProfile();
    expect(trainingDummyEncounter(profile).durationVariance).toBe(FIGHT_DURATION_VARIANCE);

    // Even a profile still carrying the old field cannot override it.
    const stale = {
      ...profile,
      simulation: { ...profile.simulation, durationVariance: 0 },
    };
    expect(trainingDummyEncounter(stale).durationVariance).toBe(FIGHT_DURATION_VARIANCE);
  });

  it('actually gives two runs different lengths', () => {
    /*
     * Asserted on the OUTCOME rather than on the constant, because a constant
     * that nothing reads is exactly the failure mode this replaces.
     */
    const base = createDefaultProfile();
    const at = (seed: number) =>
      runProfile({
        ...base,
        simulation: { ...base.simulation, durationSeconds: 60, seed },
      }).durationMs;

    const lengths = new Set([at(1), at(2), at(3), at(4), at(5)]);
    expect(lengths.size).toBeGreaterThan(1);
    for (const ms of lengths) {
      expect(toSeconds(ms)).toBeGreaterThanOrEqual(57);
      expect(toSeconds(ms)).toBeLessThanOrEqual(63);
    }
  });

  it('stays inside the band on every iteration', () => {
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      simulation: { ...base.simulation, durationSeconds: 60, iterations: 200, seed: 5 },
    });
    // Nothing can run longer than +5% or shorter than -5% of what was asked.
    expect(toSeconds(batch.meanDurationMs)).toBeGreaterThanOrEqual(57);
    expect(toSeconds(batch.meanDurationMs)).toBeLessThanOrEqual(63);
  });
});

describe('an older profile loses its variance field', () => {
  it('is dropped by the version 8 migration', () => {
    const old = {
      ...createDefaultProfile(),
      version: 7,
      simulation: { durationSeconds: 100, durationVariance: 0, iterations: 1, seed: 1 },
    } as Record<string, unknown>;

    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const migrated = result.value as { version: number; simulation: Record<string, unknown> };
    expect(migrated.version).toBe(8);
    expect(migrated.simulation).not.toHaveProperty('durationVariance');
    // Everything else it chose is kept. Only the field that has nowhere left
    // to be read from goes.
    expect(migrated.simulation.durationSeconds).toBe(100);
    expect(migrated.simulation.iterations).toBe(1);
  });

  it('keeps its own duration and iteration count rather than taking the new defaults', () => {
    /*
     * A migration that pulled the new defaults forward would rewrite every
     * saved character's fight and every number they had already recorded.
     */
    const old = {
      ...createDefaultProfile(),
      version: 7,
      simulation: { durationSeconds: 300, durationVariance: 0.2, iterations: 50, seed: 7 },
    } as Record<string, unknown>;

    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validated = validateProfile(result.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.profile.simulation.durationSeconds).toBe(300);
    expect(validated.profile.simulation.iterations).toBe(50);
  });
});
