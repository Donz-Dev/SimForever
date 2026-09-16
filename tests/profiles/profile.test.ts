import { describe, expect, it } from 'vitest';
import exampleWarrior from '../../src/data/profiles/example-warrior.json';
import { MAX_CHARACTER_LEVEL } from '../../src/game/character';
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
        // Dwarf Paladin is legal in Forever, as it was in Classic.
        race: 'dwarf' as const,
        characterClass: 'paladin' as const,
        level: 60,
      },
      stats: { strength: 1234, attackPower: 5678, critRating: 900, hasteRating: 450 },
      simulation: {
        durationSeconds: 300,
        durationVariance: 0.2,
        iterations: 500,
        seed: 987654,
      },
      encounter: {
        targetName: 'Boss',
        targetHealth: 5_000_000,
        targetArmor: 3731,
        targetLevel: 63,
      },
    };

    const result = parseProfile(serializeProfile(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual(original);
  });

  it('writes readable, indented JSON', () => {
    const json = serializeProfile(createDefaultProfile());
    expect(json).toContain('\n');
    expect(json).toContain(`  "version": ${CURRENT_PROFILE_VERSION}`);
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

  describe('race and class', () => {
    const base = createDefaultProfile();
    const withCharacter = (race: string, characterClass: string) => ({
      ...base,
      character: { ...base.character, race, characterClass },
    });

    it('accepts a legal combination', () => {
      expect(validateProfile(withCharacter('troll', 'warlock')).ok).toBe(true);
    });

    it('rejects an illegal combination with a readable message', () => {
      const result = validateProfile(withCharacter('tauren', 'mage'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: 'character.characterClass',
          message: expect.stringContaining('Tauren cannot be a Mage'),
        }),
      );
    });

    it('rejects an unknown race or class', () => {
      expect(validateProfile(withCharacter('murloc', 'warrior')).ok).toBe(false);
      expect(validateProfile(withCharacter('human', 'death_knight')).ok).toBe(false);
    });

    it('rejects display names, which are not ids', () => {
      // Profiles store `night_elf`, never `Night Elf`.
      expect(validateProfile(withCharacter('Night Elf', 'Druid')).ok).toBe(false);
    });

    it('does not pile a combination error on top of an unknown id', () => {
      const result = validateProfile(withCharacter('orc', 'frobnicator'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toMatch(/Unknown class/);
    });

    it('accepts the Forever-specific combinations', () => {
      expect(validateProfile(withCharacter('undead', 'paladin')).ok).toBe(true);
      expect(validateProfile(withCharacter('dwarf', 'shaman')).ok).toBe(true);
      expect(validateProfile(withCharacter('high_order_skyborne', 'druid')).ok).toBe(true);
      expect(validateProfile(withCharacter('windshaper_skyborne', 'shaman')).ok).toBe(true);
    });
  });

  describe('level', () => {
    const base = createDefaultProfile();
    const atLevel = (level: unknown) => ({
      ...base,
      character: { ...base.character, level },
    });

    it('accepts the range 1 to 60', () => {
      expect(validateProfile(atLevel(1)).ok).toBe(true);
      expect(validateProfile(atLevel(30)).ok).toBe(true);
      expect(validateProfile(atLevel(MAX_CHARACTER_LEVEL)).ok).toBe(true);
    });

    it('rejects anything above the cap', () => {
      // 80 was the old placeholder default and is Wrath-era, not Forever.
      const result = validateProfile(atLevel(61));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: 'character.level',
          message: expect.stringContaining('between 1 and 60'),
        }),
      );
      expect(validateProfile(atLevel(80)).ok).toBe(false);
    });

    it('rejects zero, negatives and fractions', () => {
      expect(validateProfile(atLevel(0)).ok).toBe(false);
      expect(validateProfile(atLevel(-1)).ok).toBe(false);
      expect(validateProfile(atLevel(59.5)).ok).toBe(false);
    });

    it('caps at 60, matching Classic', () => {
      expect(MAX_CHARACTER_LEVEL).toBe(60);
    });
  });

  it('rejects an unknown stat name', () => {
    // `spirit` used to be the example here and is now a real stat, which is
    // exactly the drift this test exists to catch.
    const profile = { ...createDefaultProfile(), stats: { strength: 100, cunning: 50 } };
    const result = validateProfile(profile);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'stats.cunning' }),
    );
  });

  it('accepts the stats added with the base stats table', () => {
    const profile = {
      ...createDefaultProfile(),
      stats: { spirit: 50, rangedAttackPower: 110 },
    };
    expect(validateProfile(profile).ok).toBe(true);
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

  it('migrates a version 1 profile, renaming form to combatStyle', () => {
    // Version 2 replaced the Druid-only `form` with `combatStyle`. The values
    // carry over unchanged, because a Druid's forms became its styles.
    const legacy = {
      version: 1,
      character: {
        name: 'Old Bear',
        race: 'tauren',
        characterClass: 'druid',
        level: 60,
        form: 'bear',
      },
      stats: {},
      simulation: {
        durationSeconds: 100,
        durationVariance: 0,
        iterations: 1,
        seed: 1,
      },
      encounter: { targetName: 'Dummy', targetHealth: 1000, targetArmor: 0 },
    };

    const result = loadProfile(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.migrated).toBe(true);
    expect(result.profile.version).toBe(CURRENT_PROFILE_VERSION);
    expect(result.profile.character.combatStyle).toBe('bear');
    expect(result.profile.character).not.toHaveProperty('form');
  });

  it('migrates a version 1 profile that had no form', () => {
    const legacy = {
      ...createDefaultProfile(),
      version: 1,
      character: { name: 'Old Warrior', race: 'orc', characterClass: 'warrior', level: 60 },
    };

    const result = loadProfile(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No style stored means "use the class default" rather than an error.
    expect(result.profile.character.combatStyle).toBeUndefined();
  });

  it('reports a current-version profile as not migrated', () => {
    const result = loadProfile(createDefaultProfile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
  });
});
