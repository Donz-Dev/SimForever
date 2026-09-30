import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfile, runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { TelemetryEvent } from '../../src/engine';
import { ALL_ABILITIES, resolveCast, seconds } from '../../src/engine';
import { manaPerTick } from '../../src/game/combat/resourceRules';
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
  ICE_LANCE,
  ICE_LANCE_DAMAGE,
  MAGE_ARMOR_ABILITY,
  ICE_LANCE_FROZEN_MULTIPLIER,
  MAGE_ABILITIES,
  MAGE_BASE_MANA,
  PYROBLAST_DAMAGE,
  SCORCH_DAMAGE,
} from '../../src/game/abilities/mage';
import {
  ARCANE_BLAST,
  ARCANE_BLAST_COST_INCREASE_PER_STACK,
  ARCANE_BLAST_DAMAGE_PER_STACK,
  ARCANE_BLAST_MAX_STACKS,
  ARCANE_POWER,
  ARCANE_POWER_COST_INCREASE,
  MAGE_COSTED_SPELL_IDS,
  WINTERS_CHILL_CRIT_PER_STACK,
  WINTERS_CHILL_DURATION_MS,
  wintersChillAura,
  COMBUSTION,
  COMBUSTION_CRITS_TO_END,
  COMBUSTION_CRIT_PER_STACK,
  COMBUSTION_STACK_CAP,
  FIRE_SPELL_IDS,
  FINGERS_OF_FROST,
  FINGERS_OF_FROST_PROC_CHANCE,
  fingersOfFrostAura,
  HOT_STREAK,
  HOT_STREAK_MAX_STACKS,
  HOT_STREAK_REDUCTION_PER_STACK,
  IMPROVED_SCORCH_MAX_STACKS,
  MAGE_ARMOR,
  MAGE_ARMOR_REGEN_BYPASS,
  PYROBLAST_COEFFICIENTS,
  igniteAura,
  fireVulnerabilityAura,
} from '../../src/game/auras/mage';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import {
  CHILL_ABILITY_IDS,
  MAGE_TALENT_REACTIONS,
  arcaneBlastSpender,
  fingersOfFrost,
  fingersOfFrostSpender,
} from '../../src/game/reactions/mageTalents';
import { talentNumber, talentNumbers } from '../../src/game/talents/talentValues';
import { castAbility } from '../../src/engine';
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
    // Figures that follow foreverchanges.pro where it and our own capture
    // disagree, by the ruleset owner's standing rule. Written out by hand
    // from the source and carrying the ruling, not only the number. See
    // docs/source-cross-checks.md.
    expect(FIREBALL_DAMAGE).toBe(483);
    expect(FROSTBOLT_DAMAGE).toBe(475);
    expect(SCORCH_DAMAGE).toBe(178);
    expect(PYROBLAST_DAMAGE).toBe(583);
    expect(ARCANE_BLAST_DAMAGE).toBe(394);
    expect(ICE_LANCE_DAMAGE).toBe(145);
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

  it('takes both of Pyroblast’s halves from the sheet, not from its cast time', () => {
    /*
     * 0.91 on the hit and 15% a tick, transcribed by hand from
     * WoWSimWorksheet.xlsx rather than read back out of the table under test.
     *
     * PYROBLAST USED TO BE THE ONE SPELL THAT REACHED THE CAST CLAMP. Six
     * seconds over 3.5 is 1.714, clamped to 1.0, then shared with its burn --
     * three derivation steps and a borrowed Classic rule, replaced by two
     * stated numbers. There is no clamp left for anything to reach.
     */
    expect(PYROBLAST_COEFFICIENTS.direct).toBeCloseTo(0.91, 10);
    expect(PYROBLAST_COEFFICIENTS.perTick).toBeCloseTo(0.15, 10);

    // And it is NOT what the old derivation gave, which is the point.
    expect(PYROBLAST_COEFFICIENTS.direct).not.toBeCloseTo(1 / 1.8, 3);
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

  it('gives Arcane Missiles 28.6% a missile, from the sheet', () => {
    /*
     * 28.6% PER TICK, hand-transcribed from WoWSimWorksheet.xlsx. Five
     * missiles make 1.43 in total, which is still the largest coefficient in
     * the project.
     *
     * The derived channel rule happened to give the same figure -- five
     * seconds over 3.5, shared five ways -- so this one number did not move.
     * It is asserted against the SHEET rather than against that arithmetic,
     * because the agreement is a coincidence of this spell and not a rule.
     */
    expect(ARCANE_MISSILES_TICK_COEFFICIENT).toBeCloseTo(0.286, 10);
    expect(ARCANE_MISSILES_TICK_COEFFICIENT * ARCANE_MISSILES_TICKS).toBeGreaterThan(1);
  });
});

describe('Mage Armor, whose whole worth is the five second rule', () => {
  /*
   * --------------------------------------------------------------------------
   * "Increases your resistance to all magic by 15 and allows 50% of your mana
   * regeneration to continue while casting."
   *
   * The second clause is the one that pays, and the engine already had the
   * rule waiting for it: `manaPerTick` suppresses regeneration for five
   * seconds after mana is spent and lets through whatever fraction
   * `manaRegenBypass` names. A Mage casting continuously never leaves that
   * lockout, so this is the difference between half its regeneration and none.
   *
   * ASSERTED ON THE MECHANISM rather than on a profile's DPS, because a mana
   * effect is worth nothing to a build that never runs dry -- and two of the
   * three Mage builds might not. What has to be true is that the stat arrives
   * and that the rule reads it.
   * --------------------------------------------------------------------------
   */
  const caster = (bypassFromTalents = 0) =>
    makeAttacker({
      autoAttack: 'none',
      stats: { manaPer5: 100, manaRegenBypass: bypassFromTalents },
      resources: [{ type: 'mana', maximum: 10_000 }],
    });

  it('grants a flat 50 into the same pool a talent feeds', () => {
    expect(MAGE_ARMOR_REGEN_BYPASS).toBe(50);
    expect(MAGE_ARMOR.statModifiers).toEqual([
      { stat: 'manaRegenBypass', operation: 'flat', value: 50 },
    ]);
    // No duration: thirty minutes outlasts every fight here thirty times over.
    expect(MAGE_ARMOR.durationMs).toBe(0);
  });

  it('lets half the regeneration through while the lockout is running', () => {
    const actor = caster();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();

    const full = manaPerTick(actor, 0);
    expect(full).toBeGreaterThan(0);

    // Spend, so the five second rule is biting.
    actor.recordResourceSpend('mana', 0);
    const during = manaPerTick(actor, seconds(1));

    simulation.applyAura(actor, MAGE_ARMOR, actor.id);
    const withArmor = manaPerTick(actor, seconds(1));

    expect(during).toBeLessThan(full);
    expect(withArmor).toBeCloseTo(full * 0.5, 6);
    expect(withArmor).toBeGreaterThan(during);
  });

  it('stacks ADDITIVELY with a talent granting the same thing, clamped at 100', () => {
    /*
     * Arcane Meditation grants the same stat, so a Mage that takes it and
     * casts this is not getting 50% of 50% -- it is getting the sum. The clamp
     * lives in the rule rather than in the aura, so neither source has to know
     * about the other.
     */
    const actor = caster(60);
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    simulation.applyAura(actor, MAGE_ARMOR, actor.id);

    actor.recordResourceSpend('mana', 0);

    // 60 + 50 is 110, clamped to 100: the whole tick comes through.
    expect(manaPerTick(actor, seconds(1))).toBeCloseTo(manaPerTick(actor, seconds(10)), 6);
  });

  it('is in every Mage build, and is cast once', () => {
    for (const preset of ['mage_fire', 'mage_frostfire', 'mage_arcane']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const book = abilitiesForClass('mage', 'caster', built.talents).map((a) => a.id);
      expect(book, preset).toContain('mage_armor');
    }

    // `canCast` refuses it once the aura is up, so an ungated entry at the top
    // of a list costs one global cooldown for the whole fight and no more.
    const actor = caster();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const context = { simulation, caster: actor, target: undefined, ability: MAGE_ARMOR_ABILITY };
    expect(MAGE_ARMOR_ABILITY.canCast?.(context)).toBe(true);
    simulation.applyAura(actor, MAGE_ARMOR, actor.id);
    expect(MAGE_ARMOR_ABILITY.canCast?.(context)).toBe(false);
  });
});

describe('Fingers of Frost, the one Frozen talent that is not inert', () => {
  /*
   * --------------------------------------------------------------------------
   * "Gives your Chill effects a 15% chance to grant you the Fingers of Frost
   * effect, which treats your next 2 spells cast as if the target were Frozen.
   * Lasts 15 sec."
   *
   * EVERY OTHER FROZEN EFFECT IN THIS CLASS IS INERT BECAUSE OF THE TARGET --
   * nothing freezes a raid boss, which is a durable claim. This talent does
   * not freeze anything: it puts a state on the MAGE, and that is reachable
   * exactly as written.
   * --------------------------------------------------------------------------
   */
  const frostMage = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: [ICE_LANCE],
      stats: { spellPower: 1000 },
      resources: [{ type: 'mana', maximum: 50_000 }],
    });

  it('keeps the chance as a constant the values file still agrees with', () => {
    /*
     * ITS RANK SCALES THE CHARGES, NOT THE CHANCE, which is the opposite of
     * nearly every other proc talent here. A constant standing in for a
     * per-rank value is how a rank change goes unnoticed, so this asserts the
     * constant against BOTH ranks rather than trusting it.
     */
    expect(talentNumber('mage', 'fingers_of_frost', 1, 0)).toBe(FINGERS_OF_FROST_PROC_CHANCE);
    expect(talentNumber('mage', 'fingers_of_frost', 2, 0)).toBe(FINGERS_OF_FROST_PROC_CHANCE);
    // And the charges DO scale.
    expect(talentNumber('mage', 'fingers_of_frost', 1, 1)).toBe(1);
    expect(talentNumber('mage', 'fingers_of_frost', 2, 1)).toBe(2);
  });

  it('procs only off a Chill effect, which has to be declared rather than detected', () => {
    // Frostbolt and Frostfire Bolt both "slow movement speed by 40%", and
    // nothing here has movement -- so the slow cannot be detected and the ids
    // are named instead.
    expect([...CHILL_ABILITY_IDS].sort()).toEqual(['frostbolt', 'frostfire_bolt']);

    const reaction = fingersOfFrost(2);
    const actor = frostMage();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const fires = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(fires('scorch')).toBe(false);
    expect(fires('pyroblast')).toBe(false);
  });

  it('quadruples ALL of Ice Lance, the coefficient as well as the base', () => {
    /*
     * TIMES FOUR by the owner's ruling -- "increased BY 300%" is base plus
     * three times itself, where "deals 300% damage" would be three and is also
     * what Classic does.
     *
     * AND IT REACHES THE COEFFICIENT. Applying the multiplier to `baseAmount`
     * alone would leave a spell-power-heavy Mage's Ice Lance barely improved
     * and would look entirely reasonable, so the ratio is asserted at a
     * thousand spell power where the coefficient dominates.
     */
    expect(ICE_LANCE_FROZEN_MULTIPLIER).toBe(4);

    const actor = frostMage();
    const target = makeTarget({ maxHealth: 1_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    const damageOf = () => {
      const hit = events.filter((e) => e.type === 'damage' && e.abilityId === 'ice_lance').pop();
      return hit && hit.type === 'damage' ? hit.amount : 0;
    };

    castAbility(simulation, actor, ICE_LANCE, target);
    const plain = damageOf();
    expect(plain).toBeGreaterThan(0);

    simulation.advanceTo(seconds(5));
    simulation.applyAura(actor, fingersOfFrostAura(2), actor.id);
    simulation.advanceTo(seconds(6));
    castAbility(simulation, actor, ICE_LANCE, target);
    const frozen = damageOf();

    // The combat table can crit either one, so this is a floor rather than an
    // equality: four times the base must be well clear of an uncrit hit.
    expect(frozen).toBeGreaterThan(plain * 2);
  });

  it('does not let the cast that procced it spend a charge', () => {
    /*
     * Cast reactions run AFTER `onCast`, so the Frostbolt whose damage applied
     * the aura would otherwise immediately eat one of its own charges. "Your
     * NEXT 2 spells" is what rules that out.
     */
    const actor = frostMage();
    const simulation = buildSimulation([actor, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const spender = fingersOfFrostSpender();
    simulation.applyAura(actor, fingersOfFrostAura(2), actor.id);
    expect(spender.canTrigger?.(simulation, actor, {} as never)).toBe(false);

    simulation.advanceTo(seconds(1));
    expect(spender.canTrigger?.(simulation, actor, {} as never)).toBe(true);

    // Two charges, two casts.
    spender.onTrigger(simulation, actor, {} as never);
    expect(actor.auras.stacksOf('fingers_of_frost')).toBe(1);
    spender.onTrigger(simulation, actor, {} as never);
    expect(actor.auras.has('fingers_of_frost')).toBe(false);
  });

  /*
   * THIS REPLACES A TEST THAT PINNED THE GAP. It asserted Shatter was still
   * unmodelled and that its reason named Fingers of Frost -- correct on the day
   * and exactly the shape CLAUDE.md warns about, a test enforcing a temporary
   * limitation instead of catching it. The limitation is gone, so the test
   * asserts the MECHANISM instead.
   */
  it('gives Shatter the Fingers of Frost window, and names the aura it reads', () => {
    /*
     * THE ID IS A STRING AND NOTHING TYPECHECKS IT. Renaming the aura would
     * leave Shatter pointing at nothing, paying nothing, with no compile error
     * and no failing assertion anywhere else -- so this asserts the LINK rather
     * than the two ids separately.
     */
    const shatter = MAGE_TALENT_EFFECTS.shatter;
    expect(shatter).toHaveLength(1);
    const effect = shatter[0]!;
    expect(effect.kind).toBe('critWhileAura');
    if (effect.kind !== 'critWhileAura') throw new Error('unreachable');
    expect(effect.auraId).toBe(FINGERS_OF_FROST.id);
    // "all your spells", and every ability in the Mage's book is one.
    expect(effect.abilityId).toBe(ALL_ABILITIES);
  });

  it('is 17, 33 and 50 percent by rank, which is what the capture says', () => {
    /*
     * Written out by hand from `values/mage.json`, which states
     * "Increases the critical strike chance of all your spells against Frozen
     * targets by {0}%." at [17, 33, 50]. THREE RANKS, not Classic's five --
     * reading a Classic 10/20/30/40/50 here would be wrong in both the count
     * and every value.
     */
    expect(talentNumber('mage', 'shatter', 1, 0)).toBe(17);
    expect(talentNumber('mage', 'shatter', 2, 0)).toBe(33);
    expect(talentNumber('mage', 'shatter', 3, 0)).toBe(50);
  });

  it('pays only while the aura is up, and reaches every spell', () => {
    /*
     * THE MECHANISM, not a DPS delta: the resolved crit bonus on a named spell,
     * read off the combatant's own funnel before and after the aura lands.
     *
     * A profile's DPS moving is not the test that a talent works -- and this
     * one is a window worth about two casts per proc, which is small enough to
     * sit inside the noise of any batch.
     */
    const mage = presetPlayer('mage_frostfire');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const critFor = (abilityId: string) => mage.abilityModifierFor(abilityId).critBonus ?? 0;

    /*
     * BASELINES FIRST, and per ability, because this build already has
     * per-ability crit from other talents -- Incineration names four spells.
     * The claim is the DIFFERENCE the window makes, not the absolute.
     */
    const frostboltBefore = critFor('frostbolt');
    const fireballBefore = critFor('fireball');

    simulation.applyAura(mage, fingersOfFrostAura(2), mage.id);
    expect(critFor('frostbolt') - frostboltBefore).toBeCloseTo(50, 10);
    // "ALL your spells", so a Fire spell in the same build gets the same 50.
    expect(critFor('fireball') - fireballBefore).toBeCloseTo(50, 10);

    mage.auras.remove(simulation, FINGERS_OF_FROST.id);
    expect(critFor('frostbolt')).toBeCloseTo(frostboltBefore, 10);
    expect(critFor('fireball')).toBeCloseTo(fireballBefore, 10);
  });

  it('does not reach an auto attack, which carries no ability id', () => {
    /*
     * "All your SPELLS". A swing has no `abilityId`, so nothing keyed to one
     * touches it -- including `ALL_ABILITIES`. Asserted because the catch-all
     * key is exactly the shape that would leak into swings if the funnel ever
     * stopped short-circuiting on `undefined`.
     */
    const mage = presetPlayer('mage_frostfire');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, fingersOfFrostAura(2), mage.id);

    expect(mage.abilityModifierFor(undefined).critBonus ?? 0).toBe(0);
  });
});

describe('Combustion, whose end condition is four crits rather than a clock', () => {
  /*
   * --------------------------------------------------------------------------
   * "When activated, this spell causes each of your Fire damage spell hits to
   * increase your critical strike chance with Fire damage spells by 10%. This
   * effect lasts until you have caused 4 non-periodic critical strikes with
   * Fire spells."
   *
   * IT HAD NO TEST AT ALL BEFORE THIS, which is how three separate errors
   * survived in one aura: the ability applied ten stacks by writing
   * `instance.stacks` directly, the crit was `spellCritChance` -- every school
   * rather than Fire -- and the window was a placeholder thirty seconds.
   *
   * AND THE FIRST OF THOSE CANCELLED THE OTHER TWO. `applyStatModifiers` runs
   * inside `apply` at ONE stack, and only `refresh` re-applies -- so writing
   * the field afterwards left the aura REPORTING ten stacks and PAYING one.
   * The caveat beside it said the effect was generous; it was worth +10% crit
   * for thirty seconds, and the profile was understated by 38.9 DPS.
   *
   * Every assertion below is on the MECHANISM, because a talent working and a
   * talent mattering are different questions.
   * --------------------------------------------------------------------------
   */
  const fireMage = () => {
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    return makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('mage', 'caster', built.talents),
      reactions: [MAGE_TALENT_REACTIONS.combustion(talentNumber('mage', 'combustion', 1, 0)!)],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
  };

  it('reads its 10 from the values file rather than from a constant', () => {
    // Hand-filled per `src/data/talents/values/README.md`: a single-rank talent
    // has no `{0}` for the importer to identify, and an effect that reads no
    // value is DROPPED rather than reported.
    expect(talentNumber('mage', 'combustion', 1, 0)).toBe(COMBUSTION_CRIT_PER_STACK);
  });

  it('raises Fire spells only, and by a stack at a time', () => {
    const mage = fireMage();
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(120) });
    simulation.begin();

    const critOf = (abilityId: string) => mage.abilityModifierFor(abilityId).critBonus ?? 0;
    expect(critOf('fireball')).toBe(0);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    expect(critOf('fireball')).toBe(COMBUSTION_CRIT_PER_STACK);
    // An Arcane spell in the same book gets nothing: the old shape moved
    // `spellCritChance`, which is every school at once.
    expect(critOf('arcane_missiles')).toBe(0);
    expect(critOf('frostbolt')).toBe(0);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    simulation.applyAura(mage, COMBUSTION, mage.id);
    expect(mage.auras.stacksOf('combustion')).toBe(3);
    // THREE stacks is three times the bonus. `modifiersScaleWithStacks` did not
    // reach `abilityModifiers` until this aura wanted it.
    expect(critOf('fireball')).toBe(3 * COMBUSTION_CRIT_PER_STACK);
  });

  it('covers every Fire spell in the Mage book and nothing else', () => {
    /*
     * THE SCHOOL IS WRITTEN OUT AS IDS, so a new Fire spell has to be added to
     * `FIRE_SPELL_IDS` by hand. This is the test that says so the day one is
     * not -- the same argument `PRESENCE_OF_MIND_SPELLS` rests on, which is
     * also a list standing in for a property of the ability.
     */
    const fire = MAGE_ABILITIES.filter((ability) =>
      // Every Mage ability that deals Fire damage, found from its own source.
      ['fireball', 'scorch', 'pyroblast', 'fire_blast', 'blast_wave', 'frostfire_bolt'].includes(
        ability.id,
      ),
    ).map((ability) => ability.id);
    expect([...FIRE_SPELL_IDS].sort()).toEqual([...fire].sort());
  });

  it('ends on the fourth non-periodic Fire crit, not on a timer', () => {
    /*
     * THE AURA IS PERMANENT -- `durationMs: 0` -- because the source states no
     * duration. `PLACEHOLDER_COMBUSTION_DURATION_MS` is deleted with this, and
     * a run that reached `COMBUSTION_STACK_CAP` would mean the counter below
     * had stopped working rather than that the cap is a ruleset figure.
     */
    expect(COMBUSTION.durationMs).toBe(0);
    expect(COMBUSTION.maxStacks).toBe(COMBUSTION_STACK_CAP);

    const mage = fireMage();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const simulation = buildSimulation([mage, target], { durationMs: seconds(120) });
    simulation.begin();
    simulation.applyAura(mage, COMBUSTION, mage.id);

    const reaction = mage.reactions.find((r) => r.id === 'combustion')!;
    const fire = (outcome: 'hit' | 'crit') => {
      const attack = { attacker: mage, defender: target, outcome, abilityId: 'fireball',
        abilityName: 'Fireball', amount: 100, weaponSlot: undefined, critical: outcome === 'crit' };
      if (reaction.canTrigger?.(simulation, mage, attack as never) === false) return;
      reaction.onTrigger(simulation, mage, attack as never);
    };

    // Three hits: three more stacks, and the aura still up.
    fire('hit');
    fire('hit');
    fire('hit');
    expect(mage.auras.stacksOf('combustion')).toBe(4);

    fire('crit');
    fire('crit');
    fire('crit');
    expect(mage.auras.has('combustion')).toBe(true);
    fire('crit');
    expect(mage.auras.has('combustion')).toBe(false);
  });

  it('starts a second window from zero crits', () => {
    /*
     * THE COUNTER IS A CLOSURE, per character, keyed on the aura's `appliedAt`.
     * Without the key a second Combustion would inherit the first's count and
     * end on its first crit -- which is a shorter window and no error.
     */
    const mage = fireMage();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const simulation = buildSimulation([mage, target], { durationMs: seconds(400) });
    simulation.begin();

    const reaction = mage.reactions.find((r) => r.id === 'combustion')!;
    const crit = () =>
      reaction.onTrigger(simulation, mage, { attacker: mage, defender: target, outcome: 'crit',
        abilityId: 'fireball', abilityName: 'Fireball', amount: 100, weaponSlot: undefined,
        critical: true } as never);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    for (let i = 0; i < COMBUSTION_CRITS_TO_END; i += 1) crit();
    expect(mage.auras.has('combustion')).toBe(false);

    simulation.advanceTo(seconds(200));
    simulation.applyAura(mage, COMBUSTION, mage.id);
    for (let i = 0; i < COMBUSTION_CRITS_TO_END - 1; i += 1) crit();
    expect(mage.auras.has('combustion')).toBe(true);
    crit();
    expect(mage.auras.has('combustion')).toBe(false);
  });
});

describe('Arcane Blast, whose damage half is the Arcane rotation', () => {
  /*
   * --------------------------------------------------------------------------
   * "Each time you cast Arcane Blast, the damage of all your other spells is
   * increased by 10% and the mana cost of Arcane Blast is increased by 175%.
   * Effect stacks up to 4 times and lasts 8 sec or until any other damage
   * spell is cast."
   *
   * THE DAMAGE HALF WAS UNMODELLED AND IT IS 60% OF THIS PROFILE. The caveat
   * said `damageDoneMultiplier` is every spell INCLUDING Arcane Blast and
   * there is no "everything except this one" -- true of that field, and not of
   * `abilityModifiers`, where "everything except this one" is a list with one
   * name left out.
   *
   * WHEN IT ENDS IS AN INTERPRETATION. Read literally, the bonus is destroyed
   * by the only thing that could ever collect it. The reading taken is that
   * the other spell TAKES the bonus and the stacks then go, which is the rule
   * for a specification that would otherwise disable itself -- and it is the
   * shape of the owner's own Arcane list.
   * --------------------------------------------------------------------------
   */
  it('reads its 10 from the values file rather than from a constant', () => {
    expect(talentNumber('mage', 'arcane_blast', 1, 0)).toBe(ARCANE_BLAST_DAMAGE_PER_STACK);
  });

  it('raises every other damage spell and never itself', () => {
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, ARCANE_BLAST, mage.id);

    const damageOf = (abilityId: string) =>
      mage.abilityModifierFor(abilityId).damageMultiplier ?? 1;

    expect(damageOf('arcane_missiles')).toBeCloseTo(1.1, 10);
    expect(damageOf('fireball')).toBeCloseTo(1.1, 10);
    // "All your OTHER spells". The one name left out of the list.
    expect(damageOf('arcane_blast')).toBeCloseTo(1, 10);
  });

  it('compounds its stacks, which is the convention every other stacking multiplier uses', () => {
    /*
     * 1.1 CUBED, NOT 1.3. `modifiersScaleWithStacks` raises a damage
     * multiplier to the POWER of the stack count everywhere else it is read --
     * `damageTakenMultiplierFor` says so in its own comment about Improved
     * Scorch. A second convention for one flag would be worth more trouble
     * than the six percent it buys at four stacks.
     */
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, ARCANE_BLAST, mage.id);
    simulation.applyAura(mage, ARCANE_BLAST, mage.id);
    simulation.applyAura(mage, ARCANE_BLAST, mage.id);

    expect(mage.auras.stacksOf('arcane_blast')).toBe(3);
    expect(mage.abilityModifierFor('arcane_missiles').damageMultiplier).toBeCloseTo(1.1 ** 3, 10);
  });

  it('survives every missile of a channel and goes on the last one', () => {
    /*
     * `cast.final` IS WHAT THIS ASSERTS. A cast reaction fires once per
     * `channelTicks`, so without it the first of five missiles would end the
     * window and the other four would fire unbuffed -- a smaller number, no
     * error, and the opposite of what the owner's Arcane list is built to do.
     */
    const spender = arcaneBlastSpender();
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, ARCANE_BLAST, mage.id);

    const missiles = mage.abilities.get('arcane_missiles')!;
    const cast = (ability: typeof missiles, final: boolean) =>
      spender.canTrigger?.(simulation, mage, { ability, final, spent: {} } as never) ?? true;

    expect(cast(missiles, false)).toBe(false);
    expect(cast(missiles, true)).toBe(true);
    // And the spell that BUILT the stacks never spends them.
    expect(cast(mage.abilities.get('arcane_blast')!, true)).toBe(false);
  });

  it('is built to four stacks and spent by the Arcane list, in a real fight', () => {
    /*
     * THE MECHANISM IN A REAL FIGHT, because the two halves above could both
     * be right while the list never reached four stacks -- which is the shape
     * the owner's Arcane list is written around and the reason its Arcane
     * Power entry waits for three.
     *
     * READ OFF THE EVENT STREAM, not off a DPS delta: what is asserted is that
     * the window builds to the cap and that something takes it away, which is
     * the mechanism. Whether it is worth anything is a different question.
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const run = runProfile(built, 4242);

    const rows = run.timeline.filter(
      (event) => 'auraId' in event && event.auraId === 'arcane_blast',
    );
    const highest = Math.max(...rows.map((event) => ('stacks' in event ? event.stacks : 0)));
    expect(highest).toBe(ARCANE_BLAST_MAX_STACKS);
    // And it goes away for a reason other than its own eight seconds.
    expect(rows.some((event) => event.type === 'aura_removed')).toBe(true);
  });
});

describe('Arcane Power, whose cost half is no longer dropped', () => {
  it('charges 30% more for every spell that costs mana', () => {
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const missiles = mage.abilities.get('arcane_missiles')!;
    const before = resolveCast(mage, missiles).costAmount;
    expect(before).toBeGreaterThan(0);

    simulation.applyAura(mage, ARCANE_POWER, mage.id);
    expect(resolveCast(mage, missiles).costAmount).toBeCloseTo(
      before * (1 + ARCANE_POWER_COST_INCREASE),
      6,
    );
  });

  it('names every costed spell in the book, and a test is what keeps it in step', () => {
    /*
     * THE LIST IS THE THING THAT ROTS. `MAGE_COSTED_SPELL_IDS` stands in for a
     * property of the ability -- "does it cost mana" -- and a new spell added
     * to the book without being added here would quietly escape Arcane Power's
     * cost clause. Derived from `MAGE_ABILITIES` here so that is a failure
     * rather than a silence.
     */
    const costed = MAGE_ABILITIES.filter((ability) => (ability.cost?.amount ?? 0) > 0)
      .map((ability) => ability.id)
      .sort();
    expect([...MAGE_COSTED_SPELL_IDS].sort()).toEqual(costed);
  });
});

describe("Winter's Chill, a crit debuff the TARGET carries", () => {
  /*
   * --------------------------------------------------------------------------
   * "Gives your Frost damage spells a {0}% chance to apply the Winter's Chill
   * effect, which increases the chance your Ice Lance and Frostbolt spells
   * will critically hit the target by 2% for 15 sec. Stacks up to {3} times."
   *
   * THE ONE SHAPE THIS ENGINE DID NOT HAVE, and its `unmodelled` reason named
   * both halves: `abilityCrit` is registered on the CASTER, and an ordinary
   * aura reaches every ability or none. `attackerAbilityModifiers` names
   * abilities and is read off the DEFENDER.
   *
   * IT IS THE MIRROR OF `critWhileAura`, built for Shatter one PR earlier.
   * Same shape, other side of the attack.
   *
   * NO MAGE PROFILE TAKES IT -- the Frostfire build is 0/29/22 and this sits
   * deeper than that in Frost -- so the baseline does not move and these
   * assertions are on the MECHANISM, which is the only thing that would tell
   * a working talent from an inert one here.
   * --------------------------------------------------------------------------
   */
  const buildFor = (rank: number) =>
    MAGE_TALENT_REACTIONS.winter_s_chill(
      talentNumber('mage', 'winter_s_chill', rank, 0)!,
      talentNumbers('mage', 'winter_s_chill', rank),
    );

  it('keeps its per-stack 2 and its 15 seconds as constants the file still agrees with', () => {
    for (let rank = 1; rank <= 5; rank += 1) {
      expect(talentNumber('mage', 'winter_s_chill', rank, 1)).toBe(WINTERS_CHILL_CRIT_PER_STACK);
      expect(talentNumber('mage', 'winter_s_chill', rank, 2)).toBe(
        WINTERS_CHILL_DURATION_MS / 1000,
      );
    }
  });

  it('scales its stack cap by rank, which is a SECOND number the rank moves', () => {
    /*
     * NOTHING ELSE IN THIS TREE DOES. `valueIndex` picks one number, so the
     * builder takes the whole row -- and this is the test that the row is read
     * at the right index. A cap silently stuck at 1 is a fifth of the talent
     * and no error.
     */
    for (const [rank, cap] of [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]] as const) {
      const actor = makeAttacker({ autoAttack: 'none' });
      const target = makeTarget();
      const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
      simulation.begin();

      buildFor(rank).onTrigger(simulation, actor, {
        attacker: actor, defender: target, outcome: 'hit', abilityId: 'frostbolt',
        abilityName: 'Frostbolt', amount: 100, weaponSlot: undefined, critical: false,
      } as never);
      expect(target.auras.get('winters_chill')!.maxStacks, `rank ${rank}`).toBe(cap);
    }
  });

  it('is applied by any Frost spell and benefits only the two it names', () => {
    /*
     * TWO DIFFERENT SETS, and the tooltip says so. Frostfire Bolt applies it,
     * because it "counts as both Frost and Fire damage", and does NOT crit
     * more for it -- the sentence names Ice Lance and Frostbolt and stops.
     * That asymmetry is the kind a reader assumes away.
     */
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    const reaction = buildFor(5);
    const applies = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(applies('frostbolt')).toBe(true);
    expect(applies('ice_lance')).toBe(true);
    // Frost by its own spellbook entry, even though it is DEALT as Fire.
    expect(applies('frostfire_bolt')).toBe(true);
    expect(applies('pyroblast')).toBe(false);
    expect(applies('arcane_missiles')).toBe(false);

    simulation.applyAura(target, wintersChillAura(5), actor.id);
    const critAgainst = (abilityId: string) =>
      target.abilityModifierAgainst(abilityId).critBonus ?? 0;
    expect(critAgainst('ice_lance')).toBe(WINTERS_CHILL_CRIT_PER_STACK);
    expect(critAgainst('frostbolt')).toBe(WINTERS_CHILL_CRIT_PER_STACK);
    expect(critAgainst('frostfire_bolt')).toBe(0);
  });

  it('stacks its crit bonus, and belongs to the target rather than the caster', () => {
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    for (let i = 0; i < 5; i += 1) simulation.applyAura(target, wintersChillAura(5), actor.id);
    expect(target.auras.stacksOf('winters_chill')).toBe(5);
    expect(target.abilityModifierAgainst('ice_lance').critBonus).toBe(
      5 * WINTERS_CHILL_CRIT_PER_STACK,
    );

    // ON THE TARGET. The caster's own funnel knows nothing about it, which is
    // the whole reason a new field was needed.
    expect(actor.abilityModifierFor('ice_lance').critBonus ?? 0).toBe(0);
    expect(actor.abilityModifierAgainst('ice_lance').critBonus ?? 0).toBe(0);
  });

  it('raises the crit chance an Ice Lance actually rolls against', () => {
    /*
     * THE END OF THE WIRE, not the registry. A modifier that is registered and
     * never reaches `rollTable` is the failure `AuraCollection.abilityModifierFor`
     * had for as long as `ALL_ABILITIES` was looked up exactly -- it compiled,
     * it applied, and nothing it said changed a cast.
     */
    const actor = makeAttacker({ autoAttack: 'none', stats: { spellCritChance: 10 } });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    const critOf = () =>
      simulation.attackChances('spell', actor, target).crit / 100 +
      (target.abilityModifierAgainst('ice_lance').critBonus ?? 0);

    const before = critOf();
    for (let i = 0; i < 5; i += 1) simulation.applyAura(target, wintersChillAura(5), actor.id);
    expect(critOf() - before).toBeCloseTo(5 * WINTERS_CHILL_CRIT_PER_STACK, 10);
  });
});
