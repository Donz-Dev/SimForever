import { describe, expect, it } from 'vitest';
import type { ClassId, RaceId } from '../../src/game/character';
import {
  CLASSES,
  CLASS_IDS,
  FACTIONS,
  RACES,
  RACE_IDS,
  applySelection,
  classesForFaction,
  classesForRace,
  defaultSelection,
  isClassId,
  isRaceId,
  isValidCombination,
  isValidSelection,
  racesForClass,
  racesForFaction,
} from '../../src/game/character';

/**
 * The authoritative race/class table for World of Warcraft: Forever, written
 * out independently of the source data.
 *
 * Duplicating it here is the point: a test that derived its expectations from
 * `RACES` would pass no matter what `RACES` said. This table is the spec, and
 * the test fails if the implementation drifts from it.
 */
const EXPECTED: Record<RaceId, readonly ClassId[]> = {
  // Alliance
  human: ['hunter', 'mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
  dwarf: ['hunter', 'paladin', 'priest', 'rogue', 'shaman', 'warrior'],
  night_elf: ['druid', 'hunter', 'priest', 'rogue', 'warrior'],
  gnome: ['mage', 'priest', 'rogue', 'warlock', 'warrior'],
  high_order_skyborne: ['druid', 'hunter', 'mage', 'rogue', 'warrior'],
  // Horde
  orc: ['hunter', 'mage', 'rogue', 'shaman', 'warlock', 'warrior'],
  undead: ['mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
  tauren: ['druid', 'hunter', 'shaman', 'warrior'],
  troll: ['hunter', 'mage', 'priest', 'rogue', 'shaman', 'warlock', 'warrior'],
  windshaper_skyborne: ['druid', 'hunter', 'mage', 'rogue', 'shaman', 'warrior'],
};

const ALLIANCE_RACES: RaceId[] = [
  'human',
  'dwarf',
  'night_elf',
  'gnome',
  'high_order_skyborne',
];
const HORDE_RACES: RaceId[] = ['orc', 'undead', 'tauren', 'troll', 'windshaper_skyborne'];

describe('race and class data', () => {
  it('matches the Forever combination table exactly', () => {
    for (const race of RACES) {
      expect(race.classes, `classes for ${race.name}`).toEqual(EXPECTED[race.id]);
    }
  });

  it('defines all ten races and nine classes', () => {
    expect(RACES).toHaveLength(10);
    expect(CLASSES).toHaveLength(9);
    expect(FACTIONS).toHaveLength(2);
  });

  it('assigns each race to the right faction', () => {
    expect(racesForFaction('alliance').map((race) => race.id)).toEqual(ALLIANCE_RACES);
    expect(racesForFaction('horde').map((race) => race.id)).toEqual(HORDE_RACES);
  });

  describe('Forever-specific rules', () => {
    // These break real Classic and are the entries most likely to be "fixed"
    // by mistake later. Pinning them down means that fails loudly.
    it('does not lock Paladin to the Alliance', () => {
      expect(isValidCombination('undead', 'paladin')).toBe(true);
    });

    it('does not lock Shaman to the Horde', () => {
      expect(isValidCombination('dwarf', 'shaman')).toBe(true);
    });

    it('allows combinations that Classic did not', () => {
      expect(isValidCombination('human', 'hunter')).toBe(true);
      expect(isValidCombination('gnome', 'priest')).toBe(true);
      expect(isValidCombination('orc', 'mage')).toBe(true);
      expect(isValidCombination('troll', 'warlock')).toBe(true);
    });

    it('gives both factions access to every class', () => {
      expect(classesForFaction('alliance')).toHaveLength(9);
      expect(classesForFaction('horde')).toHaveLength(9);
    });

    it('includes the two Skyborne races', () => {
      expect(isRaceId('high_order_skyborne')).toBe(true);
      expect(isRaceId('windshaper_skyborne')).toBe(true);
    });

    it('has no Death Knight', () => {
      expect(isClassId('death_knight')).toBe(false);
    });
  });

  describe('structural invariants', () => {
    it('gives every race at least one class', () => {
      for (const race of RACES) {
        expect(race.classes.length, race.name).toBeGreaterThan(0);
      }
    });

    it('lists only known classes', () => {
      for (const race of RACES) {
        for (const id of race.classes) {
          expect(CLASS_IDS, `${race.name} -> ${id}`).toContain(id);
        }
      }
    });

    it('never repeats a class within a race', () => {
      for (const race of RACES) {
        expect(new Set(race.classes).size, race.name).toBe(race.classes.length);
      }
    });

    it('uses every declared race and class id exactly once', () => {
      expect(RACES.map((race) => race.id).sort()).toEqual([...RACE_IDS].sort());
      expect(CLASSES.map((entry) => entry.id).sort()).toEqual([...CLASS_IDS].sort());
    });

    it('makes every class playable by at least one race', () => {
      for (const id of CLASS_IDS) {
        expect(racesForClass(id).length, id).toBeGreaterThan(0);
      }
    });
  });

  describe('queries', () => {
    it('returns classes for a race in display order', () => {
      expect(classesForRace('tauren').map((entry) => entry.id)).toEqual([
        'druid',
        'hunter',
        'shaman',
        'warrior',
      ]);
    });

    it('rejects illegal combinations', () => {
      expect(isValidCombination('tauren', 'mage')).toBe(false);
      expect(isValidCombination('night_elf', 'paladin')).toBe(false);
      expect(isValidCombination('gnome', 'druid')).toBe(false);
    });

    it('finds races for a class, optionally within one faction', () => {
      expect(racesForClass('paladin').map((race) => race.id)).toEqual([
        'human',
        'dwarf',
        'undead',
      ]);
      expect(racesForClass('paladin', 'horde').map((race) => race.id)).toEqual(['undead']);
    });

    it('returns nothing for an unknown race', () => {
      expect(classesForRace('not_a_race' as RaceId)).toEqual([]);
    });
  });
});

describe('character selection flow', () => {
  it('starts from a legal default', () => {
    const selection = defaultSelection();
    expect(isValidSelection(selection)).toBe(true);
  });

  it('accepts a legal selection and rejects contradictory ones', () => {
    expect(
      isValidSelection({ faction: 'horde', race: 'tauren', characterClass: 'druid' }),
    ).toBe(true);

    // Right race, wrong faction.
    expect(
      isValidSelection({ faction: 'alliance', race: 'tauren', characterClass: 'druid' }),
    ).toBe(false);

    // Right faction, class the race cannot play.
    expect(
      isValidSelection({ faction: 'horde', race: 'tauren', characterClass: 'mage' }),
    ).toBe(false);
  });

  describe('applySelection', () => {
    const orcWarrior = {
      faction: 'horde',
      race: 'orc',
      characterClass: 'warrior',
    } as const;

    it('keeps the class when switching to a race that can play it', () => {
      // The behaviour that matters for feel: browsing races must not silently
      // throw away the class the player actually chose.
      const result = applySelection({ race: 'tauren' }, orcWarrior);
      expect(result).toEqual({
        faction: 'horde',
        race: 'tauren',
        characterClass: 'warrior',
      });
    });

    it('falls back to the first available class when the current one is illegal', () => {
      const orcMage = { faction: 'horde', race: 'orc', characterClass: 'mage' } as const;
      const result = applySelection({ race: 'tauren' }, orcMage);
      expect(result.characterClass).toBe('druid'); // Tauren cannot be a Mage
      expect(isValidSelection(result)).toBe(true);
    });

    it('moves to the new faction when the race no longer fits', () => {
      const result = applySelection({ faction: 'alliance' }, orcWarrior);
      expect(result.faction).toBe('alliance');
      expect(result.race).toBe('human');
      expect(result.characterClass).toBe('warrior'); // Humans can be Warriors
      expect(isValidSelection(result)).toBe(true);
    });

    it('accepts an explicit class change', () => {
      const result = applySelection({ characterClass: 'shaman' }, orcWarrior);
      expect(result.characterClass).toBe('shaman');
    });

    it('ignores a class the race cannot play', () => {
      const result = applySelection({ characterClass: 'paladin' }, orcWarrior);
      expect(result.characterClass).not.toBe('paladin');
      expect(isValidSelection(result)).toBe(true);
    });

    it('repairs an unknown race', () => {
      const broken = {
        faction: 'horde',
        race: 'murloc' as RaceId,
        characterClass: 'warrior',
      } as const;
      expect(isValidSelection(applySelection({}, broken))).toBe(true);
    });

    it('always produces a legal selection, for every possible change', () => {
      // Exhaustive: every starting race crossed with every requested faction,
      // race and class. Any gap in the cascade shows up here.
      const start = defaultSelection();
      for (const race of RACE_IDS) {
        for (const characterClass of CLASS_IDS) {
          for (const faction of ['alliance', 'horde'] as const) {
            const result = applySelection({ faction, race, characterClass }, start);
            expect(
              isValidSelection(result),
              `${faction}/${race}/${characterClass} -> ${JSON.stringify(result)}`,
            ).toBe(true);
          }
        }
      }
    });
  });
});
