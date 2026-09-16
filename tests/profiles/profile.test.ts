import { describe, expect, it } from 'vitest';
import exampleWarrior from '../../src/data/profiles/example-warrior.json';
import {
  CURRENT_PROFILE_VERSION,
  cloneProfile,
  createDefaultProfile,
  loadProfile,
  parseProfile,
  serializeProfile,
  validateProfile,
} from '../../src/profiles';

describe('profile serialization', () => {
  it('round-trips Profile -> JSON -> Profile without losing data', () => {
    const original = createDefaultProfile();
    const result = parseProfile(serializeProfile(original));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual(original);
  });

  it('round-trips a customised profile', () => {
    const original = {
      ...createDefaultProfile(),
      character: {
        name: 'Testbeard',
        race: 'Dwarf',
        characterClass: 'Paladin',
        level: 70,
      },
      stats: { strength: 1234, attackPower: 5678, critRating: 900, hasteRating: 450 },
      simulation: {
        durationSeconds: 300,
        durationVariance: 0.2,
        iterations: 500,
        seed: 987654,
      },
      encounter: { targetName: 'Boss', targetHealth: 5_000_000, targetArmor: 7390 },
    };

    const result = parseProfile(serializeProfile(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual(original);
  });

  it('writes readable, indented JSON', () => {
    const json = serializeProfile(createDefaultProfile());
    expect(json).toContain('\n');
    expect(json).toContain('  "version": 1');
  });

  it('stamps the current version', () => {
    expect(createDefaultProfile().version).toBe(CURRENT_PROFILE_VERSION);
  });

  it('reports invalid JSON rather than throwing', () => {
    const result = parseProfile('{ not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/Not valid JSON/);
  });
});

describe('shipped sample data', () => {
  it('loads the example warrior profile', () => {
    // Guards against the sample profiles in src/data drifting out of sync with
    // the format as it changes.
    const result = loadProfile(exampleWarrior);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.character.name).toBe('Thunderaxe');
    expect(result.profile.simulation.iterations).toBe(1000);
  });
});

describe('cloneProfile', () => {
  it('produces an equal but independent copy', () => {
    const original = createDefaultProfile();
    const copy = cloneProfile(original);

    expect(copy).toEqual(original);
    expect(copy.character).not.toBe(original.character);
    expect(copy.stats).not.toBe(original.stats);
  });
});

describe('validateProfile', () => {
  it('accepts a well-formed profile', () => {
    expect(validateProfile(createDefaultProfile()).ok).toBe(true);
  });

  it('rejects a non-object', () => {
    for (const value of [null, 42, 'profile', [1, 2, 3]]) {
      expect(validateProfile(value).ok).toBe(false);
    }
  });

  it('reports every missing section at once', () => {
    const result = validateProfile({ version: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toContain('character');
    expect(paths).toContain('stats');
    expect(paths).toContain('simulation');
    expect(paths).toContain('encounter');
  });

  it('rejects an unknown stat name', () => {
    const profile = { ...createDefaultProfile(), stats: { strength: 100, spirit: 50 } };
    const result = validateProfile(profile);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'stats.spirit' }),
    );
  });

  it('rejects a non-numeric stat', () => {
    const profile = { ...createDefaultProfile(), stats: { strength: 'lots' } };
    expect(validateProfile(profile).ok).toBe(false);
  });

  it('rejects an out-of-range duration variance', () => {
    const base = createDefaultProfile();
    const profile = {
      ...base,
      simulation: { ...base.simulation, durationVariance: 1.5 },
    };

    const result = validateProfile(profile);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].path).toBe('simulation.durationVariance');
  });

  it('rejects a non-positive duration and iteration count', () => {
    const base = createDefaultProfile();
    expect(
      validateProfile({ ...base, simulation: { ...base.simulation, durationSeconds: 0 } }).ok,
    ).toBe(false);
    expect(
      validateProfile({ ...base, simulation: { ...base.simulation, iterations: 0 } }).ok,
    ).toBe(false);
  });

  it('accepts zero target armor but not negative', () => {
    const base = createDefaultProfile();
    expect(
      validateProfile({ ...base, encounter: { ...base.encounter, targetArmor: 0 } }).ok,
    ).toBe(true);
    expect(
      validateProfile({ ...base, encounter: { ...base.encounter, targetArmor: -1 } }).ok,
    ).toBe(false);
  });

  it('drops unknown top-level keys instead of passing them through', () => {
    const result = validateProfile({ ...createDefaultProfile(), rogueField: 'surprise' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).not.toHaveProperty('rogueField');
  });
});

describe('versioning', () => {
  it('rejects a profile with no version', () => {
    const { version: _version, ...withoutVersion } = createDefaultProfile();
    const result = loadProfile(withoutVersion);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/version/i);
  });

  it('refuses a profile from a newer format with a clear message', () => {
    const result = loadProfile({
      ...createDefaultProfile(),
      version: CURRENT_PROFILE_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/newer version/i);
  });

  it('reports a current-version profile as not migrated', () => {
    const result = loadProfile(createDefaultProfile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
  });
});
