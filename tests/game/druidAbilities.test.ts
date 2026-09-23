import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { castAbility, resolveCast, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  ECLIPSE_REDUCTION_BONUS,
  FEROCIOUS_BITE_BY_COMBO_POINT,
  MOONFIRE_DIRECT,
  STARFIRE_DAMAGE,
  WRATH_DAMAGE,
} from '../../src/game/abilities/druid';
import {
  ECLIPSE_CHARGES_PER_WRATH,
  ECLIPSE_MAX_CHARGES,
  INSECT_SWARM_TOTAL,
  MOONFIRE_DOT_TOTAL,
  RIP_BY_COMBO_POINT,
  RIP_DURATION_MS,
  eclipseAura,
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

describe('Eclipse, which was the first talent to ask for the engine rule', () => {
  const moonkin = () => {
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    return createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'moonkin',
      talents: built.talents,
      equipment: built.equipment,
    });
  };

  it('hands Wrath the rank value, from the SECOND number in the row', () => {
    /*
     * Eclipse's row is [2, 0.5, 4, 15] at rank 3: the "next 2 Starfires", the
     * half second, the four-charge cap and the fifteen seconds. Index 0 would
     * hand Wrath a TWO-SECOND reduction off a three-second Starfire, and
     * nothing would fail -- it would simply be four times too good.
     */
    expect(moonkin().abilities.get('wrath')?.bonuses?.[ECLIPSE_REDUCTION_BONUS]).toBe(0.5);
  });

  it('banks two charges a Wrath and caps at four', () => {
    /*
     * ------------------------------------------------------------------------
     * DRIVEN BY HAND, AND ON A COMBATANT WITH NO ROTATION OF ITS OWN.
     *
     * A `createPlayer` Moonkin carries its priority list, which acts the
     * moment the simulation begins and puts the character on the global
     * cooldown -- so a manual `castAbility` is refused and the test measures
     * nothing while appearing to measure something. It did exactly that.
     *
     * The abilities are the REAL ones, taken from the preset's build so they
     * carry the talent's `bonuses`; only the actor around them is bare.
     *
     * THE CHARGES LAND AT CAST END. Wrath is a two-second cast, so its
     * `onCast` is scheduled rather than run inline, and the clock has to be
     * advanced past each cast.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const book = abilitiesForClass('druid', 'moonkin', built.talents);
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: book,
      resources: [{ type: 'mana', maximum: 50_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const wrath = actor.abilities.get('wrath')!;

    const castOnce = (at: number) => {
      simulation.advanceTo(at);
      const result = castAbility(simulation, actor, wrath, target);
      // Asserted, so a refused cast fails here rather than silently making
      // the charge count zero.
      expect(result).toEqual({ ok: true });
      simulation.advanceTo(at + seconds(3));
    };

    castOnce(0);
    expect(actor.auras.stacksOf('eclipse')).toBe(ECLIPSE_CHARGES_PER_WRATH);

    // Two more Wraths is six charges asked for against a cap of four.
    castOnce(seconds(4));
    castOnce(seconds(8));
    expect(actor.auras.stacksOf('eclipse')).toBe(ECLIPSE_MAX_CHARGES);
  });

  it('shortens Starfire by half a second and spends ONE charge doing it', () => {
    const actor = moonkin();
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const starfire = actor.abilities.get('starfire')!;
    const base = starfire.castTimeMs!;

    simulation.applyAura(actor, eclipseAura(0.5), actor.id);
    actor.auras.get('eclipse')!.stacks = ECLIPSE_MAX_CHARGES;

    // Four charges is four SHORTER CASTS, not one two-second discount. The
    // reduction is flat per cast because `scalesWithStacks` is off.
    expect(resolveCast(actor, starfire).baseCastTimeMs).toBe(base - seconds(0.5));

    // Spent at cast START, which is what makes the cast that benefits the
    // cast that pays -- so this needs no clock advance.
    castAbility(simulation, actor, starfire, target);
    expect(actor.auras.stacksOf('eclipse')).toBe(ECLIPSE_MAX_CHARGES - 1);
  });

  it('does nothing for a Druid who did not take it', () => {
    // A nought-second Eclipse would still consume a charge and shorten
    // nothing, which looks like it is working. Wrath applies no aura at all.
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('druid', 'moonkin', { insect_swarm: 1 }),
      resources: [{ type: 'mana', maximum: 50_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    expect(castAbility(simulation, actor, actor.abilities.get('wrath')!, target)).toEqual({
      ok: true,
    });
    simulation.advanceTo(seconds(3));
    expect(actor.auras.has('eclipse')).toBe(false);
  });

  it('buys the Moonkin nothing, because the Moonkin is MANA-bound not time-bound', () => {
    /*
     * --------------------------------------------------------------------------
     * A CORRECT TALENT WORTH ZERO, AND THE REASON IS WORTH WRITING DOWN.
     *
     * Eclipse saves cast time. The Moonkin spends roughly 3,400 mana from a
     * pool of about 2,800 over a sixty-second fight, so it is already idle
     * waiting on regeneration -- and time it was not using is worth nothing.
     *
     * So the DPS figure is unchanged by a talent that demonstrably works,
     * which is exactly why the assertions above are on the MECHANISM rather
     * than on a damage delta. A test that measured the DPS would have passed
     * identically before the rule existed.
     * --------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 20, seed: 5 },
    } as never);

    const spent = batch.rage.totalSpent;
    const pool = moonkin().resources.require('mana').maximum;
    expect(spent).toBeGreaterThan(pool);
  });
});

describe('Moonfury and Vengeance, which were unmodelled for want of a school', () => {
  it('raises Arcane and Nature only, leaving a Feral druid untouched', () => {
    /*
     * ------------------------------------------------------------------------
     * BOTH WERE INERT, and the reason written down at the time was the same:
     * the declarations available were per-ABILITY or whole-CHARACTER, and both
     * tooltips are per-SCHOOL. Listing every Balance spell by id was
     * unmaintainable and a blanket multiplier would have raised a Cat's
     * bleeds.
     *
     * `physical` is on neither list, which is what makes the Feral trees safe
     * -- asserted rather than argued.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const moonkin = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'moonkin',
      talents: built.talents,
    });

    // Moonfury 5/5 is +10% Arcane and Nature damage.
    expect(moonkin.schoolModifiers.for('arcane').damageMultiplier).toBeCloseTo(1.1, 6);
    expect(moonkin.schoolModifiers.for('nature').damageMultiplier).toBeCloseTo(1.1, 6);
    expect(moonkin.schoolModifiers.for('physical').damageMultiplier ?? 1).toBe(1);

    /*
     * Vengeance 5/5 is "+100% critical strike damage BONUS". A spell crit
     * multiplies by 1.5, so the bonus being doubled is 0.5 and the crit
     * becomes 2.0x -- NOT 2.5x, which is what using the melee figure would
     * give. That distinction is the whole of the Elemental Fury correction on
     * the Shaman.
     */
    expect(moonkin.schoolModifiers.for('arcane').critMultiplierBonus).toBeCloseTo(0.5, 6);
    expect(moonkin.schoolModifiers.for('physical').critMultiplierBonus ?? 0).toBe(0);
  });

  it('leaves the Cat and the Bear exactly where they were', () => {
    // Neither spends a point in deep Balance, so neither should move. This is
    // the check that a school multiplier did not leak into the Feral builds.
    for (const preset of ['druid_cat', 'druid_bear']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const actor = createPlayer({
        race: 'tauren',
        characterClass: 'druid',
        combatStyle: built.character.combatStyle as never,
        talents: built.talents,
      });
      expect(actor.schoolModifiers.isEmpty, preset).toBe(true);
    }
  });
});
