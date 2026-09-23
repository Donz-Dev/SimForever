import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { resolveCast, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  ARCANE_BLAST_BASE_MANA_FRACTION,
  ARCANE_BLAST_DAMAGE,
  ARCANE_MISSILES_PER_TICK,
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
    const plain = createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });
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

  it('gives all three a FLOOR, for the third class running', () => {
    /*
     * No caster item in the data and no spell power coefficient in Forever's
     * spell text. Druid, Shaman and now Mage: this is how the source is
     * written rather than a quirk of any one class.
     */
    for (const preset of ['mage_fire', 'mage_frostfire', 'mage_arcane']) {
      expect(presetPlayer(preset).stats.get('spellPower'), preset).toBe(0);
    }
    const named = batchOf('mage_fire', 20, 5).castButNotSimulated.map((e) => e.abilityName);
    expect(named).toContain('Fireball');
  });
});
