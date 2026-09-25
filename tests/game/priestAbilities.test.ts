import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { resolveCast } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  MIND_BLAST_DAMAGE,
  MIND_FLAY_TICKS,
  MIND_FLAY_TOTAL,
  SHADOW_WORD_DEATH_BACKLASH_FRACTION,
  SHADOW_WORD_DEATH_DAMAGE,
  SWP_EXTRA_SECONDS_BONUS,
} from '../../src/game/abilities/priest';
import {
  SHADOWFORM,
  SHADOWFORM_MANA_REDUCTION,
  SHADOW_WEAVING_MAX_STACKS,
  SHADOW_WORD_PAIN_DURATION_MS,
  SHADOW_WORD_PAIN_TOTAL,
  shadowWordPainAura,
} from '../../src/game/auras/priest';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';

/*
 * The Priest's numbers, written out by hand from the beta client's spellbook.
 * The ninth and last class, and the twenty-first profile.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

const shadowBuild = () => PRESETS_BY_ID.get('shadow_priest')!.build();

/** A Priest with the real book and no rotation, so casts are ours. */
const barePriest = () =>
  makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass('priest', 'caster', shadowBuild().talents),
    resources: [{ type: 'mana', maximum: 100_000 }],
  });

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    expect(MIND_BLAST_DAMAGE).toBe(490);
    expect(SHADOW_WORD_DEATH_DAMAGE).toBe(458);
    expect(SHADOW_WORD_PAIN_TOTAL).toBe(762);
  });

  it('splits Mind Flay into three ticks, one a second', () => {
    // 390 over 3 sec, channelled -- the second channel in the project after
    // the Mage's Arcane Missiles, and it needed nothing new.
    expect(MIND_FLAY_TICKS).toBe(3);
    expect(MIND_FLAY_TOTAL / MIND_FLAY_TICKS).toBe(130);
  });

  it('declares an effect for every one of the 53 talents', () => {
    expect(Object.keys(PRIEST_TALENT_EFFECTS)).toHaveLength(53);
  });
});

describe('Shadowform, the capstone whose clauses land in three places', () => {
  it('halves the mana cost of every Shadow spell', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FIRST PERCENTAGE MANA REDUCTION EVER EXPRESSED IN THIS PROJECT.
     *
     * "Reduces the mana cost of all Shadow spells by 50%" is a FRACTION OF THE
     * COST, which is exactly what `CastModifier.costFraction` is.
     * `abilityCost` subtracts a flat amount, and that mismatch is the single
     * most common unmodelled reason across the other eight classes -- Frost
     * Channeling, Convection, Benediction, Efficiency, Cataclysm and more.
     *
     * Not consumed by the cast, so it holds for the whole fight.
     * ------------------------------------------------------------------------
     */
    const actor = barePriest();
    const simulation = buildSimulation([actor, makeTarget()]);
    const blast = actor.abilities.get('mind_blast')!;
    const full = blast.cost!.amount;

    expect(resolveCast(actor, blast).costAmount).toBe(full);
    simulation.applyAura(actor, SHADOWFORM, actor.id);
    expect(resolveCast(actor, blast).costAmount).toBeCloseTo(
      full * (1 - SHADOWFORM_MANA_REDUCTION),
      6,
    );
  });

  it('puts its crit damage on the TALENT, because an aura has no school', () => {
    /*
     * `SchoolModifiers` is built once when the character is and cannot come
     * and go, so the form's "+100% crit damage bonus of your Shadow spells"
     * cannot live on the aura. It lives on the talent that grants the aura.
     *
     * A hundred percent of a spell crit's 0.5 bonus takes a Shadow crit from
     * 1.5x to 2.0x, which is the largest single number in this build.
     */
    const build = talentBuild('priest', shadowBuild().talents);
    expect(build.schoolModifiers.for('shadow').critMultiplierBonus).toBeCloseTo(0.5, 6);
    expect(build.schoolModifiers.for('holy').critMultiplierBonus ?? 0).toBe(0);
  });

  it('raises Shadow damage through Darkness as well, which IS per-school', () => {
    // Darkness 5/5 is "+10% Shadow damage done", and unlike the form's own
    // multiplier it is a talent -- so it can be per-school and is.
    const build = talentBuild('priest', shadowBuild().talents);
    expect(build.schoolModifiers.for('shadow').damageMultiplier).toBeCloseTo(1.1, 6);
    expect(build.schoolModifiers.for('physical').damageMultiplier ?? 1).toBe(1);
  });

  it('is cast once and then refuses itself', () => {
    const batch = batchOf('shadow_priest', 30, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Shadowform')?.uses ?? 0)
      .toBeCloseTo(1, 1);

    const uptime = batch.buffUptime.find((b) => b.auraName === 'Shadowform');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.9);
  });
});

describe('Improved Shadow Word: Pain, which is duration and therefore damage', () => {
  it('lengthens the bleed rather than thinning it', () => {
    /*
     * THE TOOLTIP'S 762 IS THE TOTAL OVER THE BASE EIGHTEEN SECONDS, so six
     * more seconds is two more ticks of the SAME size -- extra damage, not the
     * same damage spread thinner. Reading it the other way would make a
     * duration talent worth nothing, which is how it would have been written
     * if the aura carried a fixed total.
     */
    const base = shadowWordPainAura(0);
    const talented = shadowWordPainAura(6);

    expect(base.durationMs).toBe(SHADOW_WORD_PAIN_DURATION_MS);
    expect(talented.durationMs).toBe(SHADOW_WORD_PAIN_DURATION_MS + 6000);
  });

  it('hands the extra seconds to the ability as a named number', () => {
    const built = shadowBuild();
    const book = new Map(
      abilitiesForClass('priest', 'caster', built.talents).map((a) => [a.id, a]),
    );
    // 2/2 is six seconds.
    expect(book.get('shadow_word_pain')?.bonuses?.[SWP_EXTRA_SECONDS_BONUS]).toBe(6);
  });
});

describe('the fight', () => {
  it('holds both bleeds up and fills with a channel', () => {
    const batch = batchOf('shadow_priest', 30, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;

    expect(used('Shadow Word: Pain')).toBeGreaterThan(1);
    expect(used('Devouring Plague')).toBeGreaterThan(0.5);
    // Mind Flay is the filler and is cast more than anything else.
    expect(used('Mind Flay')).toBeGreaterThan(used('Mind Blast'));
  });

  it('stacks Shadow Weaving on the CASTER, which is a Forever change', () => {
    /*
     * Classic's Shadow Weaving is a debuff every shadow priest in a raid
     * shares and fights over. Forever's is a personal buff -- so it is worth
     * the same in a raid of one as in a raid of five, and there is nobody to
     * collide with.
     */
    const uptime = batchOf('shadow_priest', 30, 5).buffUptime.find(
      (b) => b.auraName === 'Shadow Weaving',
    );
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.5);
    expect(SHADOW_WEAVING_MAX_STACKS).toBe(5);
  });

  it('makes Shadow Word: Death hurt, because the target never dies', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BACKLASH ALWAYS LANDS and it is not a modelling choice -- it is what
     * the encounter is. The target is a damage sink that survives every fight
     * by design, so "if your target is not killed" is always true.
     *
     * A tenth of the Priest's health every fifteen seconds, with no healer.
     * Asserted as health actually LOST, because the ability takes it from the
     * pool directly and it does not appear in the damage-taken panel -- which
     * the ability says.
     * ------------------------------------------------------------------------
     */
    expect(SHADOW_WORD_DEATH_BACKLASH_FRACTION).toBe(0.1);

    const actor = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: shadowBuild().talents,
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const before = actor.health.current;

    const death = actor.abilities.get('shadow_word_death')!;
    death.onCast({ simulation, caster: actor, target, ability: death });

    expect(actor.health.current).toBeCloseTo(
      before - actor.health.maximum * SHADOW_WORD_DEATH_BACKLASH_FRACTION,
      6,
    );
  });

  it('gives it a FLOOR, and this set is the worst case of it', () => {
    /*
     * ------------------------------------------------------------------------
     * TWO SHORTFALLS AT ONCE, WHICH NO OTHER PROFILE HAS.
     *
     * The first is the usual one: Forever's Priest spells state FLAT damage
     * with no spell power coefficient, so spell power multiplies nothing.
     *
     * The second belongs to this set alone. Almost every spell power line in
     * Vestments of Prophecy names a SCHOOL -- "Increases damage done by Shadow
     * spells and effects by up to 39" -- and `spellPower` here is school-blind.
     * Applying a Shadow-only bonus to it would make the Priest's Holy and
     * Arcane spells hit harder, so those lines stay unmodelled and the Gear
     * panel prints all eleven of them.
     *
     * The planner reads 204 generic and 497 Shadow. This is the 204.
     * ------------------------------------------------------------------------
     */
    const actor = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: shadowBuild().talents,
      equipment: shadowBuild().equipment,
    });
    expect(actor.stats.get('spellPower')).toBe(204);
  });
});
