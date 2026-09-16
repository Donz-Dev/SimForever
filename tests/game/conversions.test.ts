import { describe, expect, it } from 'vitest';
import { StatBlock, makeStats, percent } from '../../src/engine';
import { bindModifiers } from '../../src/engine';
import {
  CLASS_IDS,
  baseStatsFor,
  conversionsFor,
  deriveFromPrimaries,
  statDerivationFor,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';

/**
 * The worked examples given alongside the conversion table.
 *
 * These are the ground truth for the whole system: if any of them breaks, the
 * conversions are wrong no matter what the rest of the suite says.
 */
describe('worked examples from the conversion table', () => {
  it('Troll Shaman has 2060 hit points', () => {
    // 1100 base + 96 stamina * 10
    const player = createPlayer({ race: 'troll', characterClass: 'shaman' });
    expect(player.health.maximum).toBe(2060);
  });

  it('Night Elf Druid in Bear Form has 3233 hit points', () => {
    // 2543 bear-form base + 69 stamina * 10
    const player = createPlayer({
      race: 'night_elf',
      characterClass: 'druid',
      form: 'bear',
    });
    expect(player.health.maximum).toBe(3233);
  });

  it('Tauren Druid in Caster Form has 104 attack power', () => {
    // -36 base + 70 strength * 2. The negative base is real.
    const player = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      form: 'caster',
    });
    expect(player.stats.get('attackPower')).toBe(104);
  });

  it('Orc Hunter has about 0.77% crit chance', () => {
    // -1.53 base + 122 agility / 53. Negative base, positive result.
    const player = createPlayer({ race: 'orc', characterClass: 'hunter' });
    expect(player.stats.get('critChance')).toBeCloseTo(0.77, 2);
  });
});

describe('conversion table', () => {
  it('gives every class a set of conversions', () => {
    for (const id of CLASS_IDS) {
      expect(conversionsFor(id), id).toBeDefined();
    }
  });

  describe('attack power', () => {
    it('gives Warriors 2 per strength and none from agility', () => {
      const c = conversionsFor('warrior');
      expect(c.attackPowerPerStrength).toBe(2);
      expect(c.attackPowerPerAgility).toBe(0);
    });

    it('gives Rogues 1 per strength and 1 per agility', () => {
      const c = conversionsFor('rogue');
      expect(c.attackPowerPerStrength).toBe(1);
      expect(c.attackPowerPerAgility).toBe(1);
    });

    it('gives Hunters ranged attack power from agility', () => {
      const c = conversionsFor('hunter');
      expect(c.attackPowerPerStrength).toBe(1);
      expect(c.attackPowerPerAgility).toBe(1);
      expect(c.rangedAttackPowerPerAgility).toBe(2);
    });

    it('gives pure casters no attack power from strength at all', () => {
      for (const id of ['mage', 'priest', 'warlock'] as const) {
        expect(conversionsFor(id).attackPowerPerStrength, id).toBe(0);
      }
    });
  });

  describe('crit from agility', () => {
    it('varies by class', () => {
      expect(conversionsFor('warrior').agilityPerCritPercent).toBe(20);
      expect(conversionsFor('rogue').agilityPerCritPercent).toBe(29);
      expect(conversionsFor('hunter').agilityPerCritPercent).toBe(53);
    });

    it('does not exist for pure casters', () => {
      // Distinct from "a very small amount": a Mage gets no crit from agility.
      for (const id of ['mage', 'priest', 'warlock'] as const) {
        expect(conversionsFor(id).agilityPerCritPercent, id).toBeNull();
      }
    });

    it('still gives pure casters dodge from agility', () => {
      for (const id of ['mage', 'priest', 'warlock'] as const) {
        expect(conversionsFor(id).agilityPerDodgePercent, id).toBe(20);
      }
    });
  });

  describe('spell crit from intellect', () => {
    it('differs per class', () => {
      expect(conversionsFor('paladin').intellectPerSpellCritPercent).toBe(54);
      expect(conversionsFor('shaman').intellectPerSpellCritPercent).toBe(59.5);
      expect(conversionsFor('mage').intellectPerSpellCritPercent).toBe(59.5);
      expect(conversionsFor('priest').intellectPerSpellCritPercent).toBe(59.5);
      expect(conversionsFor('warlock').intellectPerSpellCritPercent).toBe(60.6);
      expect(conversionsFor('druid', 'caster').intellectPerSpellCritPercent).toBe(61);
    });

    it('does not exist for Hunters, Warriors or Rogues', () => {
      for (const id of ['hunter', 'warrior', 'rogue'] as const) {
        expect(conversionsFor(id).intellectPerSpellCritPercent, id).toBeNull();
      }
    });
  });

  describe('mana regen from spirit', () => {
    it('gives 2-spirit classes 0.5 MP5 per point', () => {
      for (const id of ['shaman', 'paladin', 'hunter'] as const) {
        expect(conversionsFor(id).manaPer5PerSpirit, id).toBe(0.5);
      }
    });

    it('gives pure casters 5 MP5 per 8 spirit', () => {
      for (const id of ['mage', 'priest', 'warlock'] as const) {
        expect(conversionsFor(id).manaPer5PerSpirit, id).toBeCloseTo(0.625, 10);
      }
    });

    it('gives mana-less classes none', () => {
      for (const id of ['warrior', 'rogue'] as const) {
        expect(conversionsFor(id).manaPer5PerSpirit, id).toBe(0);
        expect(conversionsFor(id).manaPerIntellect, id).toBe(0);
      }
    });
  });

  describe('Druid forms', () => {
    it('shares one set between Caster, Moonkin and Tree of Life', () => {
      expect(conversionsFor('druid', 'moonkin')).toEqual(conversionsFor('druid', 'caster'));
      expect(conversionsFor('druid', 'tree')).toEqual(conversionsFor('druid', 'caster'));
    });

    it('drops spell crit in Bear and Cat Form', () => {
      expect(conversionsFor('druid', 'bear').intellectPerSpellCritPercent).toBeNull();
      expect(conversionsFor('druid', 'cat').intellectPerSpellCritPercent).toBeNull();
      expect(conversionsFor('druid', 'caster').intellectPerSpellCritPercent).toBe(61);
    });

    it('gives attack power from agility only in Cat Form', () => {
      expect(conversionsFor('druid', 'cat').attackPowerPerAgility).toBe(1);
      expect(conversionsFor('druid', 'bear').attackPowerPerAgility).toBe(0);
      expect(conversionsFor('druid', 'caster').attackPowerPerAgility).toBe(0);
    });

    it('keeps mana from intellect in every form', () => {
      // A bear is not spending mana, but intellect still sizes the pool.
      for (const form of ['caster', 'moonkin', 'tree', 'bear', 'cat'] as const) {
        expect(conversionsFor('druid', form).manaPerIntellect, form).toBe(15);
      }
    });

    it('treats a formless Druid as being in caster form', () => {
      expect(conversionsFor('druid')).toEqual(conversionsFor('druid', 'caster'));
    });
  });
});

describe('deriveFromPrimaries', () => {
  it('produces only what the conversions add, not the totals', () => {
    const primary = makeStats({ strength: 100, agility: 50, stamina: 10, intellect: 0, spirit: 0 });
    const derived = deriveFromPrimaries(primary, conversionsFor('warrior'));

    expect(derived.attackPower).toBe(200); // 100 * 2, base AP not included
    expect(derived.armor).toBe(100); // 50 * 2
    expect(derived.hitPoints).toBe(100); // 10 * 10
    expect(derived.critChance).toBe(2.5); // 50 / 20
  });

  it('returns zero for conversions a class does not have', () => {
    const primary = makeStats({ strength: 100, agility: 100, intellect: 100, spirit: 100 });
    const derived = deriveFromPrimaries(primary, conversionsFor('mage'));

    expect(derived.attackPower).toBe(0);
    expect(derived.critChance).toBe(0); // no agility-to-crit for a Mage
    expect(derived.spellCritChance).toBeCloseTo(100 / 59.5, 10);
  });
});

describe('derivation re-runs when primary stats change', () => {
  it('raises attack power when a buff raises strength', () => {
    // The reason derivation is a function on the stat block rather than a value
    // computed once: a +10% strength buff has to move attack power with it.
    const stats = new StatBlock(
      { strength: 100, attackPower: 160 },
      statDerivationFor('warrior'),
    );

    expect(stats.get('strength')).toBe(100);
    expect(stats.get('attackPower')).toBe(360); // 160 + 100 * 2

    stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'blessing'));

    // Percentage modifiers produce floats (100 * 1.1 is 110.00000000000001),
    // so stats are compared approximately. Rounding happens at display time,
    // not in the engine, where it would compound across a long fight.
    expect(stats.get('strength')).toBeCloseTo(110, 10);
    expect(stats.get('attackPower')).toBeCloseTo(380, 10); // 160 + 110 * 2
  });

  it('restores the original values when the buff is removed', () => {
    const stats = new StatBlock(
      { strength: 100, attackPower: 160 },
      statDerivationFor('warrior'),
    );
    stats.addModifiers(bindModifiers([percent('strength', 0.5)], 'buff'));
    expect(stats.get('attackPower')).toBeCloseTo(460, 10);

    stats.removeModifiersFrom('buff');
    expect(stats.get('attackPower')).toBe(360);
  });

  it('raises crit when a buff raises agility', () => {
    const stats = new StatBlock(
      { agility: 100, critChance: 1.14 },
      statDerivationFor('warrior'),
    );
    expect(stats.get('critChance')).toBeCloseTo(6.14, 10); // 1.14 + 100/20

    stats.addModifiers(bindModifiers([percent('agility', 1)], 'buff'));
    expect(stats.get('critChance')).toBeCloseTo(11.14, 10); // 1.14 + 200/20
  });

  it('leaves a stat block with no derivation unchanged', () => {
    const stats = new StatBlock({ strength: 100, attackPower: 160 });
    expect(stats.get('attackPower')).toBe(160);
  });
});

describe('conversions applied across every combination', () => {
  it('never produces a negative hit point total', () => {
    for (const race of ['human', 'tauren', 'troll', 'gnome'] as const) {
      for (const characterClass of CLASS_IDS) {
        if (!baseStatsFor(race, characterClass)) continue;
        const player = createPlayer({ race, characterClass });
        expect(player.health.maximum, `${race} ${characterClass}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives mana-using classes a pool larger than their base mana', () => {
    const player = createPlayer({ race: 'gnome', characterClass: 'mage' });
    // 933 base + 139 intellect * 15.
    expect(player.resources.require('mana').maximum).toBe(933 + 139 * 15);
  });

  it('gives Warriors and Rogues no mana pool despite having intellect', () => {
    for (const characterClass of ['warrior', 'rogue'] as const) {
      const player = createPlayer({ race: 'human', characterClass });
      expect(player.resources.has('mana'), characterClass).toBe(false);
    }
  });
});
