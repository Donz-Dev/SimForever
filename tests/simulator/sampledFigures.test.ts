import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles';
import type { CharacterProfile } from '../../src/profiles';
import { HEALER_PROFILE_IDS, TANK_PROFILE_IDS, presetRole } from '../../src/profiles/presetRoles';
import { healerSamples, profileSamples } from '../../src/simulator/iterationSamples';
import { runHealerBatch, runProfileBatch } from '../../src/simulator/runBatch';
import { MULTI_TARGET_DEFAULTS, narrowedEntries, withMultiTargetDefault } from '../../src/profiles/multiTarget';
import { sectionOf } from '../../src/profiles/aplSections';

/*
 * ==============================================================================
 * ROUND 78: THE PAIRED SAMPLES CARRY A TANK'S TPS AND A HEALER'S HPS, so the
 * optimisation harness can difference the figure each role is judged on. The
 * check that they are the same figures the results page shows is that they
 * reproduce the batch's own mean on the same seeds.
 * ==============================================================================
 */

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const short = (profile: CharacterProfile, iterations: number, seed: number): CharacterProfile => ({
  ...profile,
  simulation: { ...profile.simulation, iterations, seed },
});

describe('the sampled figures', () => {
  it("reproduce a tank's batch TPS", () => {
    const profile = short(PRESETS_BY_ID.get('prot_warr')!.build(), 6, 4242);
    const batch = runProfileBatch(profile);
    const samples = profileSamples(profile, 4242, { from: 0, to: 6 });
    expect(mean(samples.tps)).toBeGreaterThan(0);
    expect(mean(samples.tps)).toBeCloseTo(batch.tps.mean, 6);
  });

  it("reproduce a healer's batch HPS in both fights", () => {
    const profile = short(PRESETS_BY_ID.get('holy_pal')!.build(), 4, 777);
    for (const fight of ['tank', 'raid'] as const) {
      const batch = runHealerBatch(profile, fight);
      const samples = healerSamples(profile, fight, 777, { from: 0, to: 4 });
      expect(mean(samples.hps)).toBeGreaterThan(0);
      expect(mean(samples.hps)).toBeCloseTo(batch.hps.mean, 6);
    }
  });

  it('leave a DPS fight with no healing and no threat it did not cause', () => {
    const profile = short(PRESETS_BY_ID.get('dw_fury')!.build(), 3, 99);
    const samples = profileSamples(profile, 99, { from: 0, to: 3 });
    expect(mean(samples.hps)).toBe(0);
    expect(mean(samples.dps)).toBeGreaterThan(0);
  });
});

describe('the preset roles', () => {
  it('name presets that exist', () => {
    const ids = new Set(PROFILE_PRESETS.map((preset) => preset.id));
    for (const id of [...TANK_PROFILE_IDS, ...HEALER_PROFILE_IDS]) expect(ids.has(id)).toBe(true);
  });

  it('call everything else DPS', () => {
    expect(presetRole('dw_fury')).toBe('dps');
    expect(presetRole('prot_warr')).toBe('tank');
    expect(presetRole('priest_disc')).toBe('healer');
  });
});

describe('a preset Multi Target default', () => {
  it('leaves a preset that has none exactly as it was', () => {
    const base = PRESETS_BY_ID.get('dw_fury')!.build();
    expect(withMultiTargetDefault('no_such_preset', base)).toBe(base);
  });

  it('is what every preset that has one actually builds with', () => {
    for (const [id, list] of Object.entries(MULTI_TARGET_DEFAULTS)) {
      const built = PRESETS_BY_ID.get(id)!.build();
      const multi = sectionOf(built, 'multi');
      expect(multi.rotation.source).toBe('custom');
      expect(multi.rotation.entries).toEqual(narrowedEntries(list, built));
    }
  });
});
