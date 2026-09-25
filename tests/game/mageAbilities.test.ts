import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { directSpellCoefficient } from '../../src/game/combat/spellCoefficient';
import type { TelemetryEvent } from '../../src/engine';
import { resolveCast, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  ARCANE_BLAST_BASE_MANA_FRACTION,
  ARCANE_BLAST_DAMAGE,
  ARCANE_MISSILES_PER_TICK,
  ARCANE_MISSILES_TICK_COEFFICIENT,
  ARCANE_MISSILES_TICKS,
  FIREBALL_DAMAGE,
  FROSTBOLT_DAMAGE,
  ICE_LANCE_DAMAGE,
  MAGE_BASE_MANA,
  PYROBLAST_DAMAGE,
  SCORCH_DAMAGE,
} from '../../src/game/abilities/mage';
import {
  ARCANE_BLAST,
  ARCANE_BLAST_COST_INCREASE_PER_STACK,
  HOT_STREAK,
  HOT_STREAK_MAX_STACKS,
  HOT_STREAK_REDUCTION_PER_STACK,
  IMPROVED_SCORCH_MAX_STACKS,
  PYROBLAST_COEFFICIENTS,
  igniteAura,
  fireVulnerabilityAura,
} from '../../src/game/auras/mage';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { mageRotation } from '../../src/game/rotations/mage';
import { baseManaFor } from '../../src/game/character/baseStatLookup';
import { RACE_IDS } from '../../src/game/character/ids';

/*
 * The Mage's numbers, written out by hand from the beta client's spellbook.
 * Three profiles, all `caster`, told apart by where their points went.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

const presetPlayer = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'gnome',
    characterClass: 'mage',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
};

/** A Mage with the real book and no rotation of its own, so casts are ours. */
const bareMage = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass('mage', 'caster', built.talents),
    resources: [{ type: 'mana', maximum: 100_000 }],
  });
};

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    expect(FIREBALL_DAMAGE).toBe(483);
    expect(FROSTBOLT_DAMAGE).toBe(475);
    expect(SCORCH_DAMAGE).toBe(181);
    expect(PYROBLAST_DAMAGE).toBe(583);
    expect(ARCANE_BLAST_DAMAGE).toBe(394);
    expect(ICE_LANCE_DAMAGE).toBe(148);
  });

  it('reads Pyroblast at rank 8, not the rank 1 its talent tooltip shows', () => {
    // The Fire talent says "101 to 131"; a level 60 trains rank 8 at
    // "520 to 646". The rank-1 rule, for the fifth time in this project.
    expect(PYROBLAST_DAMAGE).toBeGreaterThan((101 + 131) / 2);
  });

  it('treats base mana as a CLASS constant, which is what a % cost is of', () => {
    /*
     * "15% of base mana" is the only cost in the project that is not a plain
     * number. Base mana is the same for every race, which is what lets the
     * cost be resolved once rather than per character -- asserted rather than
     * assumed, because the whole shortcut rests on it.
     */
    // A race that cannot be a Mage reports 0 rather than undefined, and is
    // skipped -- the claim is about the races that CAN be one.
    const mageRaces = RACE_IDS.filter((race) => baseManaFor(race, 'mage') > 0);
    expect(mageRaces.length).toBeGreaterThan(2);
    for (const race of mageRaces) expect(baseManaFor(race, 'mage'), race).toBe(MAGE_BASE_MANA);
    expect(ARCANE_BLAST_BASE_MANA_FRACTION).toBe(0.15);
  });

  it('declares an effect for every one of the 54 talents', () => {
    expect(Object.keys(MAGE_TALENT_EFFECTS)).toHaveLength(54);
  });
});

describe('which list a Mage runs', () => {
  it('counts ALL THREE trees, which the first version did not', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUG THIS CAUGHT. The first selector compared Arcane against Frost
     * and never looked at Fire, so the owner's 10/39/2 FIRE build -- ten
     * Arcane points against two Frost -- came back as ARCANE. It ran a list
     * built around Arcane Missiles and Arcane Blast, produced a perfectly
     * ordinary 143.9 DPS, and cast neither Fireball nor Pyroblast once.
     *
     * A rotation that is merely the WRONG one for the build is the worst kind
     * of wrong here: nothing errors, nothing is missing, and the number looks
     * like a number.
     * ------------------------------------------------------------------------
     */
    expect(batchOf('mage_fire', 1, 1).rotationName).toContain('Fire');
    expect(batchOf('mage_frostfire', 1, 1).rotationName).toContain('Frostfire');
    expect(batchOf('mage_arcane', 1, 1).rotationName).toContain('Arcane');
  });

  it('gives a talentless Mage a list rather than nothing at all', () => {
    // A `caster` has no auto-attack, so no rotation means no damage at all --
    // and a Mage with no talents still has a trainer's Fireball in hand.
    expect(mageRotation({})).toBeDefined();
  });
});

describe('the talents that needed a school', () => {
  it('raises Fire for a Fire mage and leaves Frost and Arcane alone', () => {
    // Fire Power 5/5 is +10% Fire damage, and Critical Mass 3/3 is +6% Fire
    // crit. Neither had any declaration before `SchoolModifiers`.
    const fire = presetPlayer('mage_fire');
    expect(fire.schoolModifiers.for('fire').damageMultiplier).toBeCloseTo(1.1, 6);
    expect(fire.schoolModifiers.for('fire').critBonus).toBe(6);
    expect(fire.schoolModifiers.for('frost').damageMultiplier ?? 1).toBe(1);
    expect(fire.schoolModifiers.for('arcane').damageMultiplier ?? 1).toBe(1);
  });

  it('gives the Frostfire build both halves, which is the point of it', () => {
    /*
     * 0/29/22 with no capstone in either tree. Fire Power raises Frostfire
     * Bolt because it is dealt as Fire; Ice Shards raises its Frost crits at
     * +100% of a spell crit's 0.5 bonus. The build exists for that overlap.
     */
    const frostfire = presetPlayer('mage_frostfire');
    expect(frostfire.schoolModifiers.for('fire').damageMultiplier).toBeCloseTo(1.08, 6);
    expect(frostfire.schoolModifiers.for('frost').critMultiplierBonus).toBeCloseTo(0.5, 6);
  });

  it('does NOT multiply intellect by eleven', () => {
    /*
     * ------------------------------------------------------------------------
     * THE `scale` BUG, PINNED WHERE IT HURT MOST. `percentAdd` wants a
     * FRACTION and a talent states a PERCENTAGE, so Arcane Mind's "+10%
     * intellect" arrived as +1000%: 139 base intellect read back as 1,529 and
     * spell crit as 28.9% against a true 5.8%.
     *
     * The Druid and the Shaman shipped with the same mistake. There is a
     * structural test in `classRegistration.test.ts` that fails for ANY
     * unscaled percentage effect; this one pins the number a person would
     * actually look at.
     * ------------------------------------------------------------------------
     */
    /*
     * THE COMPARISON HAS TO WEAR THE SAME GEAR. It used to be a naked
     * character, which worked only because the Warrior plate the Mage borrowed
     * had no intellect on it at all -- 175 points of Arcanist intellect later,
     * `base * 1.1` was comparing two different characters. Same items, no
     * talents, so the only difference left is the talent under test.
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const plain = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      equipment: built.equipment,
    });
    const arcane = presetPlayer('mage_arcane');

    const base = plain.stats.get('intellect');
    expect(arcane.stats.get('intellect')).toBeCloseTo(base * 1.1, 6);
  });
});

describe('the cast modifiers this class is full of', () => {
  it('shortens Pyroblast by a quarter a Hot Streak stack, and is NOT consumed', () => {
    /*
     * The difference from Maelstrom Weapon. Hot Streak says "reduces the cast
     * time of Pyroblast", not "of your NEXT Pyroblast" -- so it is a duration
     * buff and every Pyroblast inside the fifteen seconds is faster.
     */
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const pyroblast = actor.abilities.get('pyroblast')!;
    const base = pyroblast.castTimeMs!;

    simulation.applyAura(actor, HOT_STREAK, actor.id);
    actor.auras.get('hot_streak')!.stacks = HOT_STREAK_MAX_STACKS;

    const reduction = HOT_STREAK_REDUCTION_PER_STACK * HOT_STREAK_MAX_STACKS;
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(Math.round(base * (1 - reduction)));

    // Three stacks of 25% is exactly 75%, so six seconds becomes one and a half.
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(seconds(1.5));
  });

  it('RAISES Arcane Blast’s cost per stack, which is a negative fraction', () => {
    /*
     * The one cast modifier in the project that makes something WORSE, and the
     * field takes it without a special case. 175% a stack on a 140-mana spell:
     * one stack is 385, two is 630, four is 1,120 -- which is what makes
     * Arcane Blast a burst spell rather than a filler, and what the priority
     * list's stack limit is reading.
     */
    const actor = bareMage('mage_arcane');
    const simulation = buildSimulation([actor, makeTarget()]);
    const blast = actor.abilities.get('arcane_blast')!;
    const base = blast.cost!.amount;

    expect(base).toBe(Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION));
    expect(ARCANE_BLAST_COST_INCREASE_PER_STACK).toBe(1.75);

    simulation.applyAura(actor, ARCANE_BLAST, actor.id);
    for (const stacks of [1, 2, 4]) {
      actor.auras.get('arcane_blast')!.stacks = stacks;
      expect(resolveCast(actor, blast).costAmount, `${stacks} stacks`).toBeCloseTo(
        base * (1 + ARCANE_BLAST_COST_INCREASE_PER_STACK * stacks),
        6,
      );
    }
  });

  it('applies the stack AFTER the cast that paid the old price', () => {
    /*
     * "Each time you cast Arcane Blast, the mana cost is increased" -- so the
     * first cast is 140 and the SECOND is 385. Applying the stack before the
     * damage would charge the opener for a debuff it did not have.
     */
    const actor = bareMage('mage_arcane');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const blast = actor.abilities.get('arcane_blast')!;

    expect(resolveCast(actor, blast).costAmount).toBe(blast.cost!.amount);
    blast.onCast({ simulation, caster: actor, target, ability: blast });
    expect(actor.auras.stacksOf('arcane_blast')).toBe(1);
    expect(resolveCast(actor, blast).costAmount).toBeGreaterThan(blast.cost!.amount);
  });
});

describe('the three fights', () => {
  it('Fire opens with Scorch until the vulnerability caps, then stops', () => {
    const batch = batchOf('mage_fire', 40, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;

    /*
     * ENOUGH SCORCHES TO CAP FIVE STACKS, AND THEN AGAIN. The vulnerability
     * lasts thirty seconds against a sixty-second fight, so a Fire mage stacks
     * it twice -- which is why this is "more than five" rather than "exactly
     * five", and why the condition reads the STACKS rather than counting casts.
     */
    expect(used('Scorch')).toBeGreaterThan(IMPROVED_SCORCH_MAX_STACKS);

    /*
     * PYROBLAST IS CAST, WHICH IS THE WHOLE OF HOT STREAK. Six seconds of cast
     * time is never worth it unshortened; every one of these is a Hot Streak
     * Pyroblast, because the entry's condition allows no other kind.
     */
    expect(used('Pyroblast')).toBeGreaterThan(1);

    // And Fireball is the filler underneath all of it -- thin, because this
    // build runs out of mana rather than out of global cooldowns.
    expect(used('Fireball')).toBeGreaterThan(0);
  });

  it('stacks the Fire vulnerability on the TARGET and scales with it', () => {
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    simulation.applyAura(target, fireVulnerabilityAura(3), actor.id);
    target.auras.get('fire_vulnerability')!.stacks = IMPROVED_SCORCH_MAX_STACKS;

    // Compounding, matching every other damage multiplier in the engine.
    expect(target.damageTakenMultiplierFor('fire')).toBeCloseTo(1.03 ** 5, 6);
    expect(target.damageTakenMultiplierFor('frost')).toBeCloseTo(1, 6);
  });

  it('Arcane channels Arcane Missiles, which is the first channel in the project', () => {
    const batch = batchOf('mage_arcane', 40, 5);
    const missiles = batch.abilities.find((a) => a.abilityName === 'Arcane Missiles');
    expect(missiles?.uses ?? 0).toBeGreaterThan(2);
    // Five ticks a cast, each rolling the table on its own, so a channel lands
    // far more "hits" than it has casts.
    expect(ARCANE_MISSILES_TICKS).toBe(5);
    expect(ARCANE_MISSILES_PER_TICK).toBe(209);
  });

  it('NO LONGER GIVES THEM A FLOOR: both halves of it have expired', () => {
    /*
     * --------------------------------------------------------------------------
     * TWO REASONS, BOTH GONE, AND NEITHER WAS A DATA CHANGE IN THE END.
     *
     * The gear half went first: all three wear Arcanist and read 452 spell
     * power -- 422 off the items and 30 off the staff enchant -- where the
     * Warrior shell gave none.
     *
     * The coefficient half has gone now. The spell TEXT still states a flat
     * range and no coefficient, exactly as before; what arrived is the RULE,
     * supplied by the ruleset owner as universal, so it never needed stating
     * per spell. Nothing was invented and nothing was read from Classic.
     * --------------------------------------------------------------------------
     */
    for (const preset of ['mage_fire', 'mage_frostfire', 'mage_arcane']) {
      expect(presetPlayer(preset).stats.get('spellPower'), preset).toBe(452);
    }
    const named = batchOf('mage_fire', 20, 5).castButNotSimulated.map((e) => e.abilityName);
    expect(named).not.toContain('Fireball');
  });

  it('CLAMPS PYROBLAST, which is the only spell here that reaches the cap', () => {
    /*
     * Six seconds over 3.5 is 1.714, and Classic clamps the cast at 3.5 so it
     * is 1.0 instead -- the ruleset owner's ruling when asked, and the single
     * largest judgement call in this feature. On a Mage's 452 spell power it
     * is the difference between +775 and +452 on the direct half.
     *
     * Pyroblast is also a HYBRID, so the 1.0 is then shared with its burn.
     * Both steps are asserted, because either alone would look reasonable.
     */
    expect(directSpellCoefficient(seconds(6))).toBeCloseTo(1, 10);
    expect(directSpellCoefficient(seconds(6))).not.toBeCloseTo(6 / 3.5, 3);

    // The pair, after the clamp: 1.0 direct against 0.8 for a 12-second DoT.
    expect(PYROBLAST_COEFFICIENTS.direct).toBeCloseTo(1 / (1 + 0.8), 6);
    expect(PYROBLAST_COEFFICIENTS.perTick * 4).toBeCloseTo(0.8 * (0.8 / 1.8), 6);
  });

  it('gives IGNITE no coefficient, because its size is already scaled', () => {
    /*
     * --------------------------------------------------------------------------
     * THE ONE MAGICAL EFFECT IN THE PROJECT THAT DELIBERATELY DOES NOT SCALE.
     *
     * Ignite is "an additional N% of your spell's damage over 4 sec", so its
     * magnitude is a SHARE OF THE CRIT THAT CAUSED IT -- and that hit already
     * had its own coefficient applied. Giving Ignite one as well would apply
     * spell power twice to the same damage, at a number that would look
     * entirely reasonable.
     *
     * The rule is general: any effect whose size is derived from another hit
     * takes no coefficient of its own. Asserted here because
     * `everySpellScales.test.ts` cannot reach Ignite -- it is an aura with no
     * ability behind it, so nothing casts it.
     * --------------------------------------------------------------------------
     */
    const events: TelemetryEvent[] = [];
    const actor = makeAttacker({
      autoAttack: 'none',
      stats: { spellPower: 5000 },
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(30) }, {
      emit: (event) => events.push(event),
    });

    // A fixed 400 of "spell damage that crit", which is what the reaction hands
    // the aura. The ticks must total exactly that, untouched by the 5000.
    const IGNITED = 400;
    simulation.applyAura(target, igniteAura(IGNITED), actor.id);
    simulation.advanceTo(seconds(10));

    const total = events
      .filter((e) => e.type === 'damage' && e.abilityId === 'ignite')
      .reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0);

    expect(total).toBeCloseTo(IGNITED, 6);
  });

  it('gives Arcane Missiles the CHANNEL rule, not five instants', () => {
    /*
     * The whole five-second channel is the cast: 1.429 shared across five
     * missiles, 0.286 each. Treating each missile as its own instant would
     * give 0.4286 each and 2.143 in total -- half as much again, on the
     * Arcane build's core spender.
     *
     * AND IT IS NOT CLAMPED, unlike a six-second Pyroblast. A channel pays
     * for its scaling in time, which is what the clamp on a single cast
     * exists to prevent.
     */
    expect(ARCANE_MISSILES_TICK_COEFFICIENT).toBeCloseTo(5 / 3.5 / 5, 10);
    expect(ARCANE_MISSILES_TICK_COEFFICIENT * ARCANE_MISSILES_TICKS).toBeGreaterThan(1);
    expect(ARCANE_MISSILES_TICK_COEFFICIENT).not.toBeCloseTo(1.5 / 3.5, 3);
  });
});
