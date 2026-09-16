import { describe, expect, it } from 'vitest';
import { STAT_NAMES } from '../../src/engine';
import {
  CLASS_IDS,
  RACE_IDS,
  allBaseStatEntries,
  baseHitPointsFor,
  baseManaFor,
  baseStatsFor,
  baseStatsToEngineStats,
  classesForRace,
  formsFor,
  isValidCombination,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';

/**
 * Spot values transcribed by hand from WoWForeverBaseStats.xlsx.
 *
 * The data file is generated from that spreadsheet, so a test that read the
 * generated file to build its expectations would prove nothing. These are read
 * off the sheet independently and will fail if the generator misreads a column,
 * shifts a row, or silently drops an entry.
 */
describe('generated base stats match the spreadsheet', () => {
  it('reads a simple row correctly (Human Warrior)', () => {
    expect(baseStatsFor('human', 'warrior')).toEqual({
      hitPoints: 1509,
      mana: 0,
      strength: 120,
      agility: 80,
      stamina: 110,
      intellect: 30,
      spirit: 49,
      attackPower: 160,
      rangedAttackPower: 0,
      critChance: 1.14,
      spellCritChance: 0,
    });
  });

  it('reads a caster row correctly (Gnome Mage)', () => {
    expect(baseStatsFor('gnome', 'mage')).toEqual({
      hitPoints: 1190,
      mana: 933,
      strength: 25,
      agility: 38,
      stamina: 44,
      intellect: 139,
      spirit: 120,
      attackPower: 0,
      rangedAttackPower: 0,
      critChance: 0,
      spellCritChance: 0.2,
    });
  });

  it('reads a ranged row correctly (Tauren Hunter)', () => {
    const stats = baseStatsFor('tauren', 'hunter');
    expect(stats).toMatchObject({
      hitPoints: 1287,
      mana: 1440,
      agility: 120,
      rangedAttackPower: 110,
      critChance: -1.53,
      spellCritChance: 4.66,
    });
  });

  it('keeps race-specific differences rather than flattening them', () => {
    // Tauren Warriors have more strength and less agility than Night Elf ones.
    expect(baseStatsFor('tauren', 'warrior')?.strength).toBe(125);
    expect(baseStatsFor('night_elf', 'warrior')?.strength).toBe(117);
    expect(baseStatsFor('tauren', 'warrior')?.agility).toBe(75);
    expect(baseStatsFor('night_elf', 'warrior')?.agility).toBe(85);
  });

  it('rounds the percentage columns rather than carrying spreadsheet noise', () => {
    // The sheet stores 1.1399999999999997 for warrior crit.
    expect(baseStatsFor('human', 'warrior')?.critChance).toBe(1.14);
    expect(baseStatsFor('dwarf', 'warrior')?.critChance).toBe(1.14);
  });

  it('preserves negative values', () => {
    // A Hunter's base crit constant really is negative, and a caster-form
    // Druid's attack power really is below zero.
    expect(baseStatsFor('human', 'hunter')?.critChance).toBe(-1.53);
    expect(baseStatsFor('night_elf', 'druid', 'caster')?.attackPower).toBe(-20);
    expect(baseStatsFor('tauren', 'druid', 'caster')?.attackPower).toBe(-36);
  });

  it('contains one entry per legal combination, plus the extra Druid forms', () => {
    const entries = allBaseStatEntries();

    // 65 rows in the spreadsheet: one per race/class, with Druid counted three
    // times for its three form rows.
    expect(entries).toHaveLength(65);
  });
});

describe('base stats coverage', () => {
  it('has stats for every legal race and class combination', () => {
    for (const race of RACE_IDS) {
      for (const characterClass of classesForRace(race)) {
        expect(
          baseStatsFor(race, characterClass.id),
          `${race} ${characterClass.id}`,
        ).toBeDefined();
      }
    }
  });

  it('has no stats for illegal combinations', () => {
    expect(baseStatsFor('tauren', 'mage')).toBeUndefined();
    expect(baseStatsFor('night_elf', 'paladin')).toBeUndefined();
    expect(baseStatsFor('gnome', 'druid')).toBeUndefined();
  });

  it('never contradicts the combination table', () => {
    for (const race of RACE_IDS) {
      for (const characterClass of CLASS_IDS) {
        const hasStats = baseStatsFor(race, characterClass) !== undefined;
        expect(hasStats, `${race} ${characterClass}`).toBe(
          isValidCombination(race, characterClass),
        );
      }
    }
  });

  it('gives every entry positive hit points', () => {
    for (const entry of allBaseStatEntries()) {
      expect(entry.stats.hitPoints, `${entry.race} ${entry.characterClass}`).toBeGreaterThan(0);
    }
  });

  it('gives mana only to classes that use it', () => {
    for (const entry of allBaseStatEntries()) {
      if (entry.characterClass === 'warrior' || entry.characterClass === 'rogue') {
        expect(entry.stats.mana, entry.characterClass).toBe(0);
      }
    }
  });
});

describe('Druid forms', () => {
  it('changes hit points and attack power between forms', () => {
    const caster = baseStatsFor('night_elf', 'druid', 'caster');
    const bear = baseStatsFor('night_elf', 'druid', 'bear');
    const cat = baseStatsFor('night_elf', 'druid', 'cat');

    expect(caster?.hitPoints).toBe(1303);
    expect(bear?.hitPoints).toBe(2543); // bear form is the tanking form
    expect(cat?.hitPoints).toBe(1303);

    expect(caster?.attackPower).toBe(-20);
    expect(bear?.attackPower).toBe(160);
    expect(cat?.attackPower).toBe(100);
  });

  it('keeps primary stats identical across forms', () => {
    const forms = ['caster', 'bear', 'cat'] as const;
    const primaries = forms.map((form) => {
      const stats = baseStatsFor('tauren', 'druid', form);
      return [stats?.strength, stats?.agility, stats?.stamina, stats?.intellect, stats?.spirit];
    });

    expect(primaries[1]).toEqual(primaries[0]);
    expect(primaries[2]).toEqual(primaries[0]);
  });

  describe('Moonkin Form', () => {
    // INTERPRETATION, not data: the spreadsheet has no Moonkin row, so it
    // borrows Caster Form's numbers. If Moonkin should differ, the sheet needs
    // a row and this behaviour should change with it.
    it('borrows Caster Form stats', () => {
      expect(baseStatsFor('night_elf', 'druid', 'moonkin')).toEqual(
        baseStatsFor('night_elf', 'druid', 'caster'),
      );
    });

    it('is still declared as a form the Druid has', () => {
      expect(formsFor('druid').map((form) => form.id)).toContain('moonkin');
    });
  });

  describe('mana across forms', () => {
    // The sheet lists Mana 0 for Bear and Cat. That means mana is not the
    // resource those forms use, not that the pool disappears.
    it('sizes the pool from Caster Form regardless of current form', () => {
      expect(baseManaFor('night_elf', 'druid')).toBe(964);
      expect(baseManaFor('tauren', 'druid')).toBe(964);
    });

    it('keeps a mana pool on a bear-form Druid', () => {
      const bear = createPlayer({ race: 'tauren', characterClass: 'druid', form: 'bear' });
      expect(bear.resources.has('mana')).toBe(true);
      // 964 base mana + 95 intellect * 15.
      expect(bear.resources.require('mana').maximum).toBe(2389);
    });
  });
});

describe('baseStatsToEngineStats', () => {
  it('maps every base stat the engine knows about', () => {
    const base = baseStatsFor('human', 'hunter');
    expect(base).toBeDefined();
    if (!base) return;

    expect(baseStatsToEngineStats(base)).toEqual({
      strength: 57,
      agility: 121,
      stamina: 93,
      intellect: 64,
      spirit: 69,
      attackPower: 100,
      rangedAttackPower: 110,
      // The crit constants are carried through as the base they are; the
      // conversion table adds the agility and intellect contributions on top.
      critChance: -1.53,
      spellCritChance: 4.66,
    });
  });

  it('leaves out hit points and mana', () => {
    // They are resource maximums, not stats, so the stat block has nowhere to
    // put them.
    const base = baseStatsFor('human', 'warrior');
    if (!base) return;
    const mapped = baseStatsToEngineStats(base) as Record<string, number>;

    expect(mapped.hitPoints).toBeUndefined();
    expect(mapped.mana).toBeUndefined();
  });

  it('only produces names the engine recognises', () => {
    const base = baseStatsFor('human', 'warrior');
    if (!base) return;
    for (const name of Object.keys(baseStatsToEngineStats(base))) {
      expect(STAT_NAMES).toContain(name);
    }
  });
});

describe('createPlayer uses base stats', () => {
  it('builds a Tauren Warrior, conversions applied', () => {
    const player = createPlayer({ race: 'tauren', characterClass: 'warrior' });

    // Primary stats are the raw base values.
    expect(player.stats.get('strength')).toBe(125);
    expect(player.stats.get('agility')).toBe(75);

    // Everything else is base plus what the conversions add.
    expect(player.health.maximum).toBe(2629); // 1509 + 112 stamina * 10
    expect(player.stats.get('attackPower')).toBe(410); // 160 + 125 str * 2
    expect(player.stats.get('armor')).toBe(150); // 75 agi * 2
    expect(player.stats.get('critChance')).toBeCloseTo(4.89, 6); // 1.14 + 75/20
  });

  it('adds bonus stats to the base before converting, not after', () => {
    const player = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      bonusStats: { strength: 200, attackPower: 500 },
    });

    expect(player.stats.get('strength')).toBe(325); // 125 base + 200 gear
    // 160 base AP + 500 gear AP + 325 total strength * 2. Gear strength has to
    // be converted too, which is the whole point of deriving from the total.
    expect(player.stats.get('attackPower')).toBe(1310);
  });

  it('gives a bear-form Druid its form hit points and attack power', () => {
    const caster = createPlayer({ race: 'tauren', characterClass: 'druid', form: 'caster' });
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', form: 'bear' });

    // Both add 72 stamina * 10 on top of their form's base hit points.
    expect(caster.health.maximum).toBe(2023); // 1303 + 720
    expect(bear.health.maximum).toBe(3263); // 2543 + 720

    // 70 strength * 2 on top of the form's base attack power.
    expect(caster.stats.get('attackPower')).toBe(104); // -36 + 140
    expect(bear.stats.get('attackPower')).toBe(300); // 160 + 140
  });

  it('refuses an illegal combination rather than inventing stats', () => {
    expect(() => createPlayer({ race: 'tauren', characterClass: 'mage' })).toThrow(
      /No base stats/,
    );
  });

  it('gives every legal combination a usable character', () => {
    for (const race of RACE_IDS) {
      for (const characterClass of classesForRace(race)) {
        const player = createPlayer({ race, characterClass: characterClass.id });
        const stats = baseStatsFor(race, characterClass.id);
        expect(player.health.maximum, `${race} ${characterClass.id}`).toBe(
          baseHitPointsFor(race, characterClass.id) + (stats?.stamina ?? 0) * 10,
        );
      }
    }
  });
});
