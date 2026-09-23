import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  FEROCIOUS_BITE_BY_COMBO_POINT,
  MOONFIRE_DIRECT,
  STARFIRE_DAMAGE,
  WRATH_DAMAGE,
} from '../../src/game/abilities/druid';
import {
  INSECT_SWARM_TOTAL,
  MOONFIRE_DOT_TOTAL,
  RIP_BY_COMBO_POINT,
  RIP_DURATION_MS,
  ripAura,
} from '../../src/game/auras/druid';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { baseManaFor } from '../../src/game/character/baseStatLookup';
import { conversionsFor } from '../../src/game/character/conversions';

/** The ruleset owner's figure, read from the table rather than repeated. */
const MANA_PER_INTELLECT = conversionsFor('druid', 'moonkin').manaPerIntellect;

/*
 * The Druid's numbers, written out by hand from the beta client's spellbook.
 * The first class in the project with three specs on three resources.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('three forms, three resources, and all of them already existed', () => {
  it('gives each form its own primary resource', () => {
    const forms = [
      ['moonkin', 'mana'],
      ['cat', 'energy'],
      ['bear', 'rage'],
    ] as const;

    for (const [style, resource] of forms) {
      const player = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: style });
      expect(player.resources.has(resource), style).toBe(true);
      expect(player.rotation, style).toBeDefined();
    }
  });

  it('owns every pool in every form, so shifting conjures nothing', () => {
    // A bear still has a mana pool it is not using, and a cat still has combo
    // points before it has built one.
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });
    for (const type of ['mana', 'rage', 'energy', 'comboPoints'] as const) {
      expect(bear.resources.has(type), type).toBe(true);
    }
  });

  it('picks the list from the FORM, which is the combat style', () => {
    // The Warrior's arrangement, not the Rogue's: a Druid's three specs differ
    // by style, so nothing has to read the talents.
    expect(batchOf('druid_moonkin', 1, 1).rotationName).toContain('Moonkin');
    expect(batchOf('druid_cat', 1, 1).rotationName).toContain('Cat');
    expect(batchOf('druid_bear', 1, 1).rotationName).toContain('Bear');
  });

  it('declares an effect for every one of the 51 talents', () => {
    expect(Object.keys(DRUID_TALENT_EFFECTS)).toHaveLength(51);
  });
});

describe('the numbers', () => {
  it('takes the midpoint of each stated range', () => {
    // "62 to 68", "350 to 412", "128 to 150". The combat table supplies the
    // spread a real cast shows.
    expect(WRATH_DAMAGE).toBe(65);
    expect(STARFIRE_DAMAGE).toBe(381);
    expect(MOONFIRE_DIRECT).toBe(139);
  });

  it('divides each bleed evenly by its cadence', () => {
    /*
     * Moonfire is 240 over 12 seconds at 3, Insect Swarm 186 over 12 at 2.
     * Both divide exactly, which is the reading that reproduces the stated
     * totals; an uneven cadence would leave a partial final tick.
     */
    expect(MOONFIRE_DOT_TOTAL % 4).toBe(0);
    expect(INSECT_SWARM_TOTAL % 6).toBe(0);
  });

  it('scales Rip by combo point but NOT its duration, unlike the Rogue Rupture', () => {
    /*
     * Twelve seconds at every rank, and the damage steps by exactly 153. The
     * Rogue's Rupture scaled both halves, which is the kind of difference that
     * gets assumed away.
     */
    expect(RIP_BY_COMBO_POINT).toEqual([243, 396, 549, 702, 855]);
    for (let i = 1; i < RIP_BY_COMBO_POINT.length; i += 1) {
      expect(RIP_BY_COMBO_POINT[i] - RIP_BY_COMBO_POINT[i - 1]).toBe(153);
    }
    for (const points of [1, 3, 5]) {
      expect(ripAura(points).durationMs).toBe(RIP_DURATION_MS);
    }
  });

  it('steps Ferocious Bite by 147 a point', () => {
    expect(FEROCIOUS_BITE_BY_COMBO_POINT).toEqual([229, 376, 523, 670, 817]);
    for (let i = 1; i < FEROCIOUS_BITE_BY_COMBO_POINT.length; i += 1) {
      expect(FEROCIOUS_BITE_BY_COMBO_POINT[i] - FEROCIOUS_BITE_BY_COMBO_POINT[i - 1]).toBe(147);
    }
  });
});

describe('the three builds run', () => {
  it('Cat builds combo points and spends them on Rip', () => {
    const batch = batchOf('druid_cat', 40, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Shred')?.uses ?? 0).toBeGreaterThan(2);
    expect(batch.abilities.find((a) => a.abilityName === 'Rip')?.uses ?? 0).toBeGreaterThan(0.5);
  });

  it('Bear earns rage from BOTH directions, which is why it is hit back', () => {
    /*
     * The only Druid profile with `targetAttacks: true`, and the reason is the
     * resource: Forever's rage comes from dealing damage AND from taking it,
     * and Bear Form is the one build that does both.
     */
    const batch = batchOf('druid_bear', 40, 5);
    const sources = batch.rage.gained.map((row) => row.sourceId);
    expect(sources).toContain('damage_taken');
    expect(batch.abilities.find((a) => a.abilityName === 'Mangle')?.uses ?? 0).toBeGreaterThan(3);
  });

  it('Moonkin casts, and its damage does not scale with gear at all', () => {
    /*
     * --------------------------------------------------------------------------
     * THE FIRST CASTER, AND ITS NUMBER IS A FLOOR RATHER THAN AN ESTIMATE.
     *
     * Two things make it so, and neither is inventable:
     *
     *   - every Druid spell states FLAT damage and no spell power coefficient,
     *     so gear cannot scale it
     *   - the item data is nineteen Classic stand-ins curated for a Warrior,
     *     so a Moonkin's spellPower reads zero
     *
     * Asserted rather than described, so that the day a coefficient or a
     * caster item arrives, this fails and the figure is re-read.
     *
     * RESISTANCE IS NOT ONE OF THEM. The ruleset owner ruled that resistances
     * on enemy targets have no impact on damage for now, so a spell landing
     * for full is correct.
     * --------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const player = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'moonkin',
      talents: built.talents,
      equipment: built.equipment,
    });
    expect(player.stats.get('spellPower')).toBe(0);

    const batch = batchOf('druid_moonkin', 40, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Starfire')?.uses ?? 0).toBeGreaterThan(1);

    // Every nuke says so on the results page.
    const named = batch.castButNotSimulated.map((entry) => entry.abilityName);
    expect(named).toContain('Starfire');
    expect(named).toContain('Wrath');
  });

  it('gives the Moonkin a mana pool that DOES include intellect', () => {
    /*
     * The engine gap survey recorded this as missing, on the strength of a
     * stale comment in `resources.ts`. The code was already doing it:
     * `manaPerIntellect` is 15, the ruleset owner's own figure.
     */
    const player = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'moonkin',
    });
    const pool = player.resources.require('mana').maximum;
    const base = baseManaFor('tauren', 'druid');
    const intellect = player.stats.get('intellect');

    // Fifteen mana a point, on top of the base. Asserted as the relationship
    // rather than as a number, so it survives a base stat table refresh.
    expect(intellect).toBeGreaterThan(0);
    expect(pool).toBeCloseTo(base + intellect * MANA_PER_INTELLECT, 6);
    expect(pool).toBeGreaterThan(base);
  });
});
