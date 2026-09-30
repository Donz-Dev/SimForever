import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch, resourceFlowOf } from '../../src/simulator';
import type { TelemetryEvent } from '../../src/engine';
import {
  RATING_PER_PERCENT,
  castAbility,
  checkCast,
  dealDamage,
  resolveCast,
  seconds,
} from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  BARKSKIN_ABILITY,
  BERSERK,
  ENRAGE_ABILITY,
  FRENZIED_REGENERATION_ABILITY,
  COMBO_POINT_GENERATORS,
  ECLIPSE_REDUCTION_BONUS,
  FEROCIOUS_BITE_BY_COMBO_POINT,
  MANGLE,
  MOONFIRE_DIRECT,
  STARFIRE_CAST_MS,
  STARFIRE_COEFFICIENT,
  STARFIRE_DAMAGE,
  WRATH_COEFFICIENT,
  WRATH_DAMAGE,
} from '../../src/game/abilities/druid';
import {
  BARKSKIN,
  BERSERK_CRIT_BONUS,
  ENRAGE_BEAR_ARMOR_REDUCTION,
  ENRAGE_INSTANT_RAGE,
  ENRAGE_RAGE_OVER_TIME,
  ENRAGE_RAGE_PER_TICK,
  FRENZIED_REGENERATION_HEALTH_PER_RAGE,
  berserkAura,
  NATURES_GRACE_DURATION_MS,
  NATURES_GRACE_PERCENT,
  naturesGraceAura,
  ECLIPSE_CHARGES_PER_WRATH,
  ECLIPSE_MAX_CHARGES,
  INSECT_SWARM_TOTAL,
  MOONFIRE_COEFFICIENTS,
  MOONFIRE_DOT_TOTAL,
  RIP_BY_COMBO_POINT,
  RIP_DURATION_MS,
  eclipseAura,
  ripAura,
} from '../../src/game/auras/druid';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { naturesGrace } from '../../src/game/reactions/druidTalents';
import { talentNumber } from '../../src/game/talents/talentValues';
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
    // "86 to 96", "350 to 412", "124 to 146". The combat table supplies the
    // spread a real cast shows.
    //
    // WRATH IS THE ONE THAT MOVED MOST, and not because anyone mistyped it:
    // 62 to 68 was right at build 1.60.1.69876 and the client buffed it. Both
    // current sources agree it gained about 40% and disagree on the figure.
    expect(WRATH_DAMAGE).toBe(91);
    expect(STARFIRE_DAMAGE).toBe(381);
    expect(MOONFIRE_DIRECT).toBe(135);
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
    const sources = resourceFlowOf(batch, 'rage').gained.map((row) => row.sourceId);
    expect(sources).toContain('damage_taken');
    /*
     * PRIMAL BITE, which Forever renamed from Mangle at build 1.60.1.70009.
     * The lookup is by DISPLAY NAME because that is what `BatchTotals`
     * aggregates by -- there is no ability id on a reported row -- so a rename
     * in content is a rename here too.
     */
    expect(
      batch.abilities.find((a) => a.abilityName === 'Primal Bite')?.uses ?? 0,
    ).toBeGreaterThan(3);
  });

  it('Moonkin casts, and its damage NOW SCALES with gear', () => {
    /*
     * --------------------------------------------------------------------------
     * BOTH REASONS FOR THE FLOOR ARE GONE, AND THE SECOND ONE WENT LAST.
     *
     * This test has been rewritten twice, which is the point of it. It first
     * asserted `spellPower === 0` -- no caster item existed. That expired when
     * the Moonkin got Cenarion Raiment and read 439. It then asserted that the
     * 439 multiplied NOTHING, because every Druid nuke states flat damage and
     * no coefficient.
     *
     * That second one has now expired too, and NOT because the data changed:
     * the spell text still states a flat range. The ruleset owner supplied the
     * coefficient as a universal RULE -- `castTime / 3.5` of spell power --
     * which does not need to be stated per spell. See
     * `game/combat/spellCoefficient.ts`.
     *
     * Asserted as SPELL POWER REACHING THE DAMAGE, by running the same spell
     * on two characters who differ only in that stat. A DPS figure would move
     * for a dozen reasons; this moves for one.
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
    // 409 off the items plus 30 from Enchant Weapon - Spell Power on the staff.
    expect(player.stats.get('spellPower')).toBe(439);

    const batch = batchOf('druid_moonkin', 40, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Starfire')?.uses ?? 0).toBeGreaterThan(1);

    /*
     * AND NEITHER NUKE IS LISTED AS UNSIMULATED ANY MORE. The reason they
     * carried named the missing coefficient specifically, which is what made
     * it findable the day the rule arrived.
     */
    const named = batch.castButNotSimulated.map((entry) => entry.abilityName);
    expect(named).not.toContain('Starfire');
    expect(named).not.toContain('Wrath');
  });

  it('takes Starfire and Wrath from the sheet, not from their cast times', () => {
    /*
     * 1.0 and 0.57, hand-transcribed from WoWSimWorksheet.xlsx.
     *
     * --------------------------------------------------------------------------
     * THE TRAP THE OLD RULE CARRIED IS GONE WITH IT, and is worth remembering
     * because the shape recurs. `ability.castTimeMs` on a BUILT ability is the
     * TALENT-REDUCED figure -- Improved Starfire and Eclipse both shorten it --
     * so a coefficient derived from it would have made a cast-time talent
     * quietly REDUCE the spell's scaling with gear. Backwards, and it would
     * have looked entirely ordinary.
     *
     * A STATED COEFFICIENT CANNOT DRIFT THAT WAY AT ALL, which is a quiet
     * argument for data over derivation. Starfire's 1.0 is also exactly what
     * `3.5 / 3.5` gave, so this spell alone would not have caught the bug --
     * Wrath's 0.57 against the old 0.571 is the one that says which source is
     * being read.
     * --------------------------------------------------------------------------
     */
    expect(STARFIRE_COEFFICIENT).toBeCloseTo(1, 10);
    expect(WRATH_COEFFICIENT).toBeCloseTo(0.57, 10);

    // The talented book really does carry a shorter cast, which is what makes
    // the distinction above load-bearing rather than theoretical.
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const book = new Map(
      abilitiesForClass('druid', 'moonkin', built.talents).map((a) => [a.id, a]),
    );
    expect(book.get('starfire')!.castTimeMs).toBeLessThan(STARFIRE_CAST_MS);
  });

  it("shares ONE coefficient between Moonfire's hit and its burn", () => {
    /*
     * Moonfire is the hybrid the whole normalisation is cross-checked against:
     * an instant plus a 12-second DoT comes out at 0.15 and 0.52, which is
     * exactly the pair Classic publishes for this spell.
     *
     * Neither half may keep its full value -- 0.4286 and 0.8 -- or one cast
     * would scale about twice as hard as a nuke costing the same global
     * cooldown.
     */
    expect(MOONFIRE_COEFFICIENTS.direct).toBeCloseTo(0.15, 2);
    expect(MOONFIRE_COEFFICIENTS.perTick * 4).toBeCloseTo(0.52, 2);
    expect(MOONFIRE_COEFFICIENTS.direct).toBeLessThan(1.5 / 3.5);
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

    /*
     * MANA, which is what this always meant. It read `batch.rage` and passed,
     * because the totals behind that field were never keyed by resource -- a
     * Moonkin has no rage at all, so the number it was checking was its mana
     * arriving under the wrong name.
     */
    const spent = resourceFlowOf(batch, 'mana').totalSpent;
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

describe('Berserk, one ability that gives each feral build a different half', () => {
  /*
   * --------------------------------------------------------------------------
   * "Causes your Primal Bite ability to strike up to 3 targets, removes its
   * cooldown, and increases the critical strike chance of your Combo
   * Point-generating abilities by 100%. Clears and grants immunity to Fear
   * effects for the duration. Lasts 15 sec."
   *
   * FOUR CLAUSES IN FOUR PLACES. The 3 targets are unmodelled; the cooldown
   * removal is the BEAR's half, because Primal Bite is a rage ability a Cat
   * never casts; the crit is the CAT's half, because a Bear has no combo point
   * generators at all; and the Fear immunity is crowd control and out of scope.
   *
   * +100 PERCENTAGE POINTS rather than a doubling, by the ruleset owner's
   * ruling. Both readings produce a plausible number and the wording carries
   * neither.
   * --------------------------------------------------------------------------
   */
  it('reads its generators off the abilities rather than naming them', () => {
    /*
     * `comboPointsAwarded` is already declared on every ability that awards
     * one, so a fourth generator is covered on the day it lands. Listing ids
     * by hand is how one gets missed, and a missed one looks exactly like an
     * ability that did not happen to crit.
     */
    expect([...COMBO_POINT_GENERATORS].sort()).toEqual(['claw', 'rake', 'shred']);

    const aura = berserkAura(COMBO_POINT_GENERATORS);
    for (const id of COMBO_POINT_GENERATORS) {
      expect(aura.abilityModifiers?.[id], id).toEqual({ critBonus: BERSERK_CRIT_BONUS });
    }
    expect(BERSERK_CRIT_BONUS).toBe(100);

    // And nothing that SPENDS points is in it.
    expect(aura.abilityModifiers?.ferocious_bite).toBeUndefined();
    expect(aura.abilityModifiers?.rip).toBeUndefined();
  });

  it('suppresses Primal Bite\'s cooldown while it is up, and not after', () => {
    /*
     * ASSERTED THROUGH `checkCast`, which is where the suppression lives, and
     * not on the aura field -- a field nothing reads is exactly the failure
     * this is guarding against.
     *
     * THE TIMER KEEPS RUNNING UNDERNEATH. Suppression hides the check; it does
     * not clear the cooldown. So when the aura drops the ability is on
     * whatever remains of its own six seconds rather than being handed a free
     * cast at the moment the buff ends.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [MANGLE, BERSERK],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    castAbility(simulation, actor, MANGLE, target);
    simulation.advanceTo(seconds(2));
    // Six second cooldown, two seconds in.
    expect(checkCast(simulation, actor, MANGLE, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });

    simulation.applyAura(actor, berserkAura(COMBO_POINT_GENERATORS), actor.id);
    expect(checkCast(simulation, actor, MANGLE, target)).toEqual({ ok: true });

    // The aura is 15 seconds; step past it and the ability is off cooldown by
    // its own timer, which is the point -- it was never given a free one.
    actor.auras.remove(simulation, 'berserk');
    expect(actor.auras.has('berserk')).toBe(false);
    simulation.advanceTo(seconds(3));
    expect(checkCast(simulation, actor, MANGLE, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
  });

  it('raises the crit chance of a generator through the damage pipeline', () => {
    /*
     * THE MECHANISM, NOT A DPS FIGURE. An aura-granted ability modifier has to
     * be read at BOTH points the standing one is -- the crit chance in
     * `rollTable` and the damage multiplier in `resolveDamage` -- or it is
     * quietly half an effect. `abilityModifierFor` is the single reader both
     * go through, so this asserts that it combines rather than replaces.
     */
    const actor = makeAttacker({ autoAttack: 'none' });
    actor.abilityModifiers.add('shred', { critBonus: 5 });

    expect(actor.abilityModifierFor('shred').critBonus).toBe(5);

    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    simulation.applyAura(actor, berserkAura(COMBO_POINT_GENERATORS), actor.id);

    // ADDITIVE with the standing modifier, which is the rule two standing
    // modifiers already follow.
    expect(actor.abilityModifierFor('shred').critBonus).toBe(105);
    // And an ability it does not name is untouched.
    expect(actor.abilityModifierFor('rip').critBonus ?? 0).toBe(0);
    // An auto attack carries no ability id and gets nothing at all.
    expect(actor.abilityModifierFor(undefined).critBonus ?? 0).toBe(0);
  });
});

describe("Nature's Grace, whose two clauses are two effects", () => {
  /*
   * --------------------------------------------------------------------------
   * "All non-periodic spell criticals grace you with a blessing of nature,
   * increasing your spellcasting speed and reducing your global cooldown by
   * 10% for 3 sec."
   *
   * FOREVER'S IS A THREE-SECOND WINDOW, NOT CLASSIC'S ONE-SHOT. Classic's
   * shortens the NEXT cast by half a second and wants the Eclipse rule; this
   * wants a reaction and an aura. The talent's own reason recorded that after
   * the mistake was caught once.
   *
   * THE HASTE HALF WAS REACHABLE ALL ALONG. The global cooldown half was not:
   * haste deliberately does not touch the global cooldown in this engine, and
   * `baseGcdMs` had no aura path to it.
   * --------------------------------------------------------------------------
   */
  it('has a value at all, which a single-rank talent does not get for free', () => {
    /*
     * ITS VALUES CAME BACK NULL from the importer, because the text states 10%
     * literally rather than through a `{0}` placeholder. An effect that reads
     * no value is DROPPED by `talentBuild` in silence -- the talent would have
     * read as unmodelled without ever saying so.
     */
    expect(talentNumber('druid', 'nature_s_grace', 1)).toBe(NATURES_GRACE_PERCENT);
    expect(NATURES_GRACE_PERCENT).toBe(10);
    expect(NATURES_GRACE_DURATION_MS).toBe(seconds(3));
  });

  it('shortens the global cooldown, which haste deliberately does not', () => {
    /*
     * Two effects in one sentence, and folding the second into a haste rating
     * would make EVERY haste source shorten the global cooldown -- a much
     * larger change wearing this talent's name.
     */
    const actor = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();

    expect(actor.auras.gcdMultiplier()).toBe(1);
    simulation.applyAura(actor, naturesGraceAura(NATURES_GRACE_PERCENT), actor.id);
    expect(actor.auras.gcdMultiplier()).toBeCloseTo(0.9, 6);

    // And the haste half is a RATING, converted with the same constant the
    // haste multiplier divides by, so the round trip is exact.
    expect(actor.stats.get('hasteRating')).toBeCloseTo(
      NATURES_GRACE_PERCENT * RATING_PER_PERCENT.haste,
      6,
    );
  });

  it('cannot be procced by a damage-over-time tick, and the engine is why', () => {
    /*
     * "Non-periodic" is guaranteed by `dealDamage`, which offers an attack to
     * reactions only when `attackTable && !periodic` -- so a tick is never
     * shown to one. Worth pinning: every DoT in Forever can crit, so a Moonkin
     * holding Moonfire and Insect Swarm up produces a stream of periodic
     * crits, and a reaction that DID see them would keep this buff up for most
     * of a fight off an effect the tooltip excludes.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      // A hundred percent, so the tick below DEFINITELY crits and this cannot
      // pass by the tick simply not critting.
      stats: { spellPower: 0, critChance: 100, spellCritChance: 100 },
      reactions: [naturesGrace(NATURES_GRACE_PERCENT)],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    dealDamage(simulation, {
      source: actor,
      target,
      abilityId: 'moonfire',
      abilityName: 'Moonfire',
      school: 'arcane',
      baseAmount: 100,
      periodic: true,
      critFrom: 'spell',
      appliesArmor: false,
    });

    // It really was a periodic CRIT...
    const tick = events.find((e) => e.type === 'damage' && e.abilityId === 'moonfire');
    expect(tick && tick.type === 'damage' && tick.periodic).toBe(true);
    expect(tick && tick.type === 'damage' && tick.critical).toBe(true);
    // ...and the reaction still never saw it.
    expect(actor.auras.has('natures_grace')).toBe(false);
  });
});

describe("the Bear's three cooldowns", () => {
  const bear = () =>
    makeAttacker({
      autoAttack: 'none',
      maxHealth: 10_000,
      stats: { armor: 5000 },
      abilities: [BARKSKIN_ABILITY, ENRAGE_ABILITY, FRENZIED_REGENERATION_ABILITY],
      resources: [{ type: 'rage', maximum: 100, initial: 0 }],
    });

  it('reduces PHYSICAL damage taken by 20%, and not every school', () => {
    /*
     * "Physical damage taken is reduced by 20%." A flat
     * `damageTakenMultiplier` would reduce everything, and this tooltip names
     * one school -- so the two are asserted apart rather than one standing in
     * for the other.
     */
    expect(BARKSKIN.damageTakenBySchool).toEqual({ physical: 0.8 });
    expect(BARKSKIN.damageTakenMultiplier).toBeUndefined();
    expect(BARKSKIN_ABILITY.cost).toBeUndefined();
    expect(BARKSKIN_ABILITY.cooldownMs).toBe(seconds(60));
  });

  it('gives Enrage 10 rage now and 20 over ten seconds, at a real armor cost', () => {
    const actor = bear();
    const simulation = buildSimulation([actor, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const armorBefore = actor.stats.get('armor');
    castAbility(simulation, actor, ENRAGE_ABILITY, undefined);

    // The instant ten is the ability's.
    expect(actor.resources.require('rage').current).toBe(ENRAGE_INSTANT_RAGE);
    // 27% off base armor, the Bear Form figure. `percentAdd`, so it is a
    // fraction and not a percentage -- a 27 here would be 2700%.
    expect(actor.stats.get('armor')).toBeCloseTo(
      armorBefore * (1 - ENRAGE_BEAR_ARMOR_REDUCTION),
      6,
    );

    // And the twenty arrives over ten seconds, two a tick.
    expect(ENRAGE_RAGE_PER_TICK).toBe(2);
    simulation.advanceTo(seconds(10));
    expect(actor.resources.require('rage').current).toBe(
      ENRAGE_INSTANT_RAGE + ENRAGE_RAGE_OVER_TIME,
    );
    // The armor comes back when it expires.
    expect(actor.stats.get('armor')).toBeCloseTo(armorBefore, 6);
  });

  it('converts only the rage that is THERE, and reports the spend', () => {
    /*
     * "Converts UP TO 10 Rage per second." A Bear at 30 rage converts 30 and
     * no more, so the tick reads the pool rather than assuming it -- a fixed
     * ten a second would heal for rage the character never had.
     *
     * AND THE DRAIN GOES THROUGH THE CONTEXT. Draining directly is invisible
     * to the resource panel, which this project has already been caught by:
     * combo points once reported 23 gained and none spent, and that looks
     * exactly like a rotation that never casts a finisher.
     */
    const actor = bear();
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, makeTarget()], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    actor.resources.require('rage').gain(30);
    // Wounded, so the heal lands rather than being wasted at full health.
    actor.health.spend(5000);
    expect(actor.health.current).toBe(5000);
    castAbility(simulation, actor, FRENZIED_REGENERATION_ABILITY, undefined);
    simulation.advanceTo(seconds(10));

    // Three full ticks of ten, then nothing left to convert.
    const spends = events.filter(
      (e) => e.type === 'resource_spent' && e.source === 'frenzied_regeneration',
    );
    expect(spends).toHaveLength(3);
    expect(actor.resources.require('rage').current).toBe(0);

    const heals = events.filter(
      (e) => e.type === 'heal' && e.abilityId === 'frenzied_regeneration',
    );
    expect(heals).toHaveLength(3);
    // 1% of maximum health per point of rage, ten points a tick.
    const first = heals[0];
    if (first.type === 'heal') {
      expect(first.amount).toBeCloseTo(
        actor.health.maximum * FRENZIED_REGENERATION_HEALTH_PER_RAGE * 10,
        6,
      );
    }
  });
});
