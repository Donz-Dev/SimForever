import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { TelemetryEvent } from '../../src/engine';
import { castAbility, resolveCast, seconds, spellPowerFor } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  PRIEST_BASE_MANA,
  MIND_BLAST_DAMAGE,
  MIND_FLAY_ESCALATION_BONUS,
  MIND_FLAY_TICKS,
  MIND_FLAY_TOTAL,
  SHADOW_WORD_DEATH_BACKLASH_FRACTION,
  SHADOW_WORD_DEATH_DAMAGE,
  SWP_EXTRA_SECONDS_BONUS,
} from '../../src/game/abilities/priest';
import {
  INNER_FOCUS,
  INNER_FOCUS_CRIT_BONUS,
  POWER_INFUSION,
  POWER_INFUSION_DAMAGE,
  SHADOWFORM,
  SHADOWFORM_MANA_REDUCTION,
  SHADOW_WEAVING_MAX_STACKS,
  SHADOW_WORD_PAIN_DURATION_MS,
  SHADOW_WORD_PAIN_TOTAL,
  shadowWordPainAura,
} from '../../src/game/auras/priest';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { innerFocusSpender } from '../../src/game/reactions/priestTalents';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentNumber } from '../../src/game/talents/talentValues';
import { legalise } from '../helpers/legalTalents';

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
  /*
   * TWO OF THESE THREE FOLLOW foreverchanges.pro AGAINST OUR OWN CAPTURE, by the
   * ruleset owner's standing rule that it wins a disagreement. Both sources were
   * read at build 1.60.1.70009 and disagree by five on Mind Blast (472-498
   * against 477-503) and by ten on Shadow Word: Death (434-462 against 444-472).
   * Shadow Word: Pain's 762 they agree on. See docs/source-cross-checks.md.
   *
   * Written out by hand from the source, as every number here is, and carrying
   * the ruling rather than only the figure.
   */
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    expect(MIND_BLAST_DAMAGE).toBe(485);
    expect(SHADOW_WORD_DEATH_DAMAGE).toBe(448);
    expect(SHADOW_WORD_PAIN_TOTAL).toBe(762);
  });

  it('splits Mind Flay into three ticks, one a second', () => {
    // 390 over 3 sec, channelled -- the second channel in the project after
    // the Mage's Arcane Missiles, and it needed nothing new.
    expect(MIND_FLAY_TICKS).toBe(3);
    expect(MIND_FLAY_TOTAL / MIND_FLAY_TICKS).toBe(130);
  });

  it('declares an effect for every one of the 52 talents', () => {
    /*
     * 52: TWO OUT AND ONE IN at client build 1.60.1.70425. Shadow Affinity and
     * Improved Fade were removed and DARK INSPIRATION took Improved Fade's slot
     * -- so a net fall of one, where the count alone reads as a single removal.
     *
     * AND THE SHADOW TREE TRADED A DEAD TALENT FOR A LIVE ONE. Shadow Affinity
     * was a `threat` ruling, and Dark Inspiration is a Spirit buff off Mind
     * Blast and a fully channeled Mind Flay -- mana RETURN, which is explicitly
     * not out of scope. The Shadow Priest spread moved its three points across.
     */
    expect(Object.keys(PRIEST_TALENT_EFFECTS)).toHaveLength(52);
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

describe('Improved Mind Flay, which now compounds across the channel', () => {
  /*
   * ==========================================================================
   * IT READ THE YARDS ONCE, AND IT HAS NOW BEEN REDESIGNED. BOTH FACTS MATTER
   * AND THEY ARE DIFFERENT KINDS OF CHANGE.
   *
   * THE OLD BUG: "Your Mind Flay now deals {0}% more damage, gains {1} yards
   * increased range, but slows the target's movement speed by {2}%" -- three
   * numbers in one row, and the effect declared `valueIndex: 1`, the RANGE. At
   * 2/2 the values are [20, 10, 20], so it gave 10% where the talent grants
   * 20% -- and 10 is both a plausible damage percentage AND exactly what rank 1
   * correctly grants, so the talent read as one rank behind itself.
   *
   * THE REDESIGN: "Improved Mind Flay changes to: Each instance of damage of
   * Mind Flay deals 10/20% more damage than its previous instance of damage."
   * The FIGURES are untouched -- still 10 and 20 at index 0 -- so this is not a
   * values override and reading it as one would have been a no-op claiming to
   * be a change. What moved is the SHAPE: a flat per-ability multiplier became
   * a compounding one, so the number had to leave `abilityModifiers` (which is
   * on the combatant and cannot see which tick is running) and be handed to the
   * ability as an `abilityBonus`.
   *
   * SO THESE TESTS ASSERT THE DAMAGE OF EACH TICK rather than a multiplier on
   * the build. The old ones read `abilityModifiers.for('mind_flay')`, which no
   * longer carries anything -- and a test that had been loosened to "the
   * multiplier is gone" would have asserted nothing at all about the escalation
   * that replaced it.
   * ==========================================================================
   */
  it('reads a row that is now ONE number, where it used to be three', () => {
    /*
     * ========================================================================
     * THE RANGE AND THE SLOW LEFT THE ROW AT CLIENT BUILD 1.60.1.70425, and
     * this assertion is kept rather than deleted because of what it used to
     * catch.
     *
     * The row was `[damage%, yards, slow%]` -- `[[10,10,20],[20,10,20]]` -- and
     * this talent is the one CLAUDE.md names for having declared `valueIndex:
     * 1` against it, applying the RANGE as a damage multiplier for its whole
     * life: 10 where the talent grants 20, on the biggest damage source in the
     * build, worth +18.2 DPS when corrected. **The plausible wrong value was
     * another rank's right one**, which is why nothing looked odd.
     *
     * IT IS `[10, 20]` NOW, a bare per-rank number, so that whole class of
     * mistake is unreachable on this talent: index 1 is `undefined` and an
     * effect that reads no value is DROPPED rather than applied. Asserting the
     * absence is the point -- **a row getting shorter turns a wrong-index bug
     * from a wrong number into no number**, which fails loudly where the old
     * shape failed silently, and the declaration's `valueIndex: 0` is right in
     * both shapes.
     * ========================================================================
     */
    expect(talentNumber('priest', 'improved_mind_flay', 2, 0)).toBe(20);
    expect(talentNumber('priest', 'improved_mind_flay', 2, 1)).toBeUndefined();
    expect(talentNumber('priest', 'improved_mind_flay', 2, 2)).toBeUndefined();

    const build = talentBuild('priest', legalise({ improved_mind_flay: 2 }, 'priest'));
    expect(build.abilityBonuses.get('mind_flay')?.[MIND_FLAY_ESCALATION_BONUS]).toBe(20);

    /*
     * AND IT IS NO LONGER A FLAT MULTIPLIER, which is the half that would rot
     * quietly: leaving the old `abilityDamage` effect in beside the new bonus
     * would apply the 20% twice -- once flat on every tick and once
     * compounding -- a bigger number and no error.
     */
    expect(build.abilityModifiers.for('mind_flay').damageMultiplier ?? 1).toBe(1);
  });

  it('is worth half as much at one rank, so the two ranks differ', () => {
    /*
     * NOT THE RANK-1 FIGURE, which is the specific wrong answer the old index
     * produced. Asserting 20 alone would also pass a build that had silently
     * dropped to rank 1.
     */
    const one = talentBuild('priest', legalise({ improved_mind_flay: 1 }, 'priest'));
    expect(one.abilityBonuses.get('mind_flay')?.[MIND_FLAY_ESCALATION_BONUS]).toBe(10);
  });

  it('is 2/2 in the profile, so the profile gets the full 20%', () => {
    const build = talentBuild('priest', shadowBuild().talents);
    expect(build.abilityBonuses.get('mind_flay')?.[MIND_FLAY_ESCALATION_BONUS]).toBe(20);
  });

  it('leaves the FIRST tick alone and raises each one after it', () => {
    /*
     * ========================================================================
     * THE MECHANISM, DRIVEN THROUGH A REAL CHANNEL.
     *
     * "More than its PREVIOUS instance" means the first instance is
     * unmultiplied and each one after it is the one before times `1 + p`. The
     * exponent is therefore the tick INDEX and not the tick COUNT:
     * `recordChannelTick` runs before `runCast`, so the first tick already
     * reads `channelTicksDelivered === 1` and the escalation is
     * `(1 + p)^(delivered - 1)`. Using the count directly would raise every
     * tick including the first -- a bigger number and no error.
     *
     * DRIVEN RATHER THAN COMPUTED, because the join between the talent and the
     * ability is the half that can be missing: an `abilityBonus` whose key the
     * ability does not read leaves the talent reporting itself modelled and
     * doing nothing, which is `lone_wolf`'s failure exactly.
     *
     * THE RATIO IS ASSERTED AND NOT THE ABSOLUTE DAMAGE, so this survives a
     * coefficient, a spell power or a base damage change -- and the spell table
     * is given enough hit that no tick can miss, because a missed tick deals
     * nothing and would read as a suppressed multiplier.
     * ========================================================================
     */
    const ticksFor = (ranks: number): number[] => {
      const caster = createPlayer({
        race: 'undead',
        characterClass: 'priest',
        /*
         * MIND FLAY IS ITSELF A TALENT, so the allocation has to spend a point
         * on it or the character does not know the ability at all -- which is
         * the "check the book before the list" case, met here as a thrown
         * error rather than as a silently empty event stream.
         */
        talents: legalise({ mind_flay: 1, improved_mind_flay: ranks }, 'priest'),
        bonusStats: { hitChance: 100, critChance: -100, spellCritChance: -100 },
      });
      const target = makeTarget({ maxHealth: 1_000_000, stats: { armor: 0 } });
      const events: TelemetryEvent[] = [];
      const simulation = buildSimulation([caster, target], { durationMs: seconds(30) }, {
        emit: (event) => events.push(event),
      });
      simulation.begin();
      /*
       * THE CHARACTER'S OWN COPY OF THE ABILITY, NOT THE MODULE CONSTANT.
       *
       * `abilityBonus` attaches its number to the ability `abilitiesForBuild`
       * puts in the character's book, so casting the exported `MIND_FLAY`
       * declaration reads `bonuses` as undefined and every tick comes back the
       * same size -- which is what the first version of this test did, and it
       * reported the talent as inert. The same lesson as reading a COST off
       * the declaration rather than off the built character.
       */
      const mindFlay = caster.abilities.get('mind_flay');
      if (!mindFlay) throw new Error('the Priest does not know Mind Flay');
      castAbility(simulation, caster, mindFlay, target);
      simulation.advanceTo(seconds(5));
      return events
        .filter((e) => e.type === 'damage' && e.abilityId === 'mind_flay')
        .map((e) => (e.type === 'damage' ? e.amount : 0));
    };

    // Without the talent every instance is the same size.
    const flat = ticksFor(0);
    expect(flat).toHaveLength(MIND_FLAY_TICKS);
    for (const amount of flat) expect(amount).toBeCloseTo(flat[0], 6);

    // With it at 2/2 each instance is 1.20 times the one before.
    const escalating = ticksFor(2);
    expect(escalating).toHaveLength(MIND_FLAY_TICKS);
    for (let index = 1; index < escalating.length; index += 1) {
      expect(escalating[index] / escalating[index - 1], `tick ${index + 1}`).toBeCloseTo(1.2, 4);
    }
    // And the FIRST instance is untouched, which is what "previous" requires.
    expect(escalating[0]).toBeCloseTo(flat[0], 6);
  });

  it('is worth almost exactly what the flat version was, over three ticks', () => {
    /*
     * ========================================================================
     * A REDESIGN THAT READS AS A BUFF AND MEASURES AS NOISE, WRITTEN DOWN SO
     * NOBODY LATER "FIXES" IT.
     *
     * Over Mind Flay's three ticks at 2/2 the multipliers are 1, 1.20 and 1.44
     * -- a mean of 1.2133 against the flat 1.20 it replaced, so about +1.1% on
     * the ability. Mind Flay is roughly half the Shadow profile's damage, so
     * expect well under a percent on the row.
     *
     * ASSERTED AS A BAND rather than an exact figure, because the claim is
     * "these two readings are close" and that is what makes a near-zero
     * measurement correct rather than suspicious.
     * ========================================================================
     */
    const escalation = 20 / 100;
    let total = 0;
    for (let index = 0; index < MIND_FLAY_TICKS; index += 1) {
      total += (1 + escalation) ** index;
    }
    const mean = total / MIND_FLAY_TICKS;
    expect(mean).toBeCloseTo(1.2133, 4);
    // Within a couple of percent of the flat 1.20 it replaced.
    expect(Math.abs(mean - 1.2)).toBeLessThan(0.02);
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

  it('stacks Shadow Weaving on the TARGET, which the owner has now ruled', () => {
    /*
     * ========================================================================
     * THIS TEST USED TO ASSERT THE OPPOSITE, AND ITS NAME SAID SO: "stacks
     * Shadow Weaving on the CASTER, which is a Forever change". Its reasoning
     * was that Classic's is a shared debuff and Forever's "is a personal buff
     * -- so it is worth the same in a raid of one as in a raid of five".
     *
     * TRUE WHEN WRITTEN AND NOW REVERSED BY THE OWNER: "Shadow Weaving is now
     * a debuff, where the target takes more shadow damage from me." The client
     * says the same in its own words -- "the Shadow damage the target takes
     * from you" where it read "the Shadow damage you deal".
     *
     * SO IT IS `debuffUptime` AND NOT `buffUptime`, which is the whole
     * observable difference and is why the old assertion FAILED rather than
     * quietly passing: the buff table reads friendly actors and the debuff
     * table reads the enemy, so an aura that changes sides vanishes from one
     * and appears in the other. **A reporting split is doing the work of a
     * test here** -- had both tables read every actor, this would have passed
     * on the wrong side.
     *
     * AND IT IS WORTH THE SAME TO THIS BUILD EITHER WAY, which is why no
     * figure moves: one Priest, one target, and `damageTakenBySchool`
     * compounds across stacks exactly as the caster-side multiplier did. What
     * changed is who holds it, which matters the day a second Shadow caster
     * exists -- and the "from me" half of the ruling is not expressible, since
     * a debuff here raises that school for every attacker.
     * ========================================================================
     */
    const uptime = batchOf('shadow_priest', 30, 5).debuffUptime.find(
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

  it('gives it a FLOOR, and ONE of its two shortfalls has cleared', () => {
    /*
     * ------------------------------------------------------------------------
     * IT HAD TWO SHORTFALLS AT ONCE, AND NOW HAS ONE.
     *
     * The one that CLEARED belonged to this set alone. Almost every spell
     * power line in Vestments of Prophecy names a SCHOOL -- "Increases damage
     * done by Shadow spells and effects by up to 39" -- and `spellPower` was
     * one school-blind number, so ~293 of a stated 497 was carried as
     * unmodelled text. `SchoolModifiers` now carries a spell power per school
     * and `spellPowerFor` reads it, so the whole 497 arrives: 204 on the stat
     * block, 293 scoped to Shadow, and NOTHING extra on Holy or Arcane.
     *
     * The one that REMAINS is the usual one, and it is why this test asserts a
     * STAT ARRIVING rather than a DPS delta: Forever's Priest spells state
     * FLAT damage with no spell power coefficient, so all 497 points multiply
     * nothing and the Shadow Priest's DPS did not move by so much as a tenth.
     * A test written against its damage would have passed identically before
     * the feature existed.
     * ------------------------------------------------------------------------
     */
    const actor = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: shadowBuild().talents,
      equipment: shadowBuild().equipment,
    });

    /*
     * The school-blind half, still the only thing on the stat block -- a keyed
     * stat deliberately cannot go there.
     *
     * 246 NOW, because the owner's caster enchant row is SCHOOL-BLIND: +6 on
     * the neck, +16 on the bracer, +20 on the gloves. It is named once and used
     * by every assertion below, which is the point of this test -- a figure that
     * reaches one school and not another has to be the one that MOVES between
     * them, and the blind pool must move all three together or none.
     */
    /*
     * ------------------------------------------------------------------------
     * THE POOL IS MEASURED AND THE SCOPING IS ASSERTED, which is the half this
     * test is actually for.
     *
     * The blind pool was written out as `204 + 6 + 16 + 20` -- the Classic
     * Vestments plus the owner's caster enchant row -- and the Shadow Priest
     * wears the E65 benchmark set now. A fourth literal would be a fourth
     * thing to rewrite, and the figure was never the claim.
     *
     * AND THE SCOPED HALF IS GONE WITH THE SET THAT CARRIED IT. Nine Priest
     * pieces named Shadow and Anathema carried Forever's +64; the benchmark
     * gear is school-BLIND, so Shadow reads exactly the blind pool and so do
     * Holy and Arcane. That is the distinction still being tested, from the
     * other side: all three agreeing is what says nothing scoped is leaking
     * into the blind stat.
     * ------------------------------------------------------------------------
     */
    const blindPool = actor.stats.get('spellPower');
    expect(blindPool).toBeGreaterThan(6 + 16 + 20);

    expect(spellPowerFor(actor, 'shadow')).toBe(blindPool);
    expect(spellPowerFor(actor, 'holy')).toBe(blindPool);
    expect(spellPowerFor(actor, 'arcane')).toBe(blindPool);

    /*
     * AND A SCOPED LINE STILL LANDS WHERE IT SHOULD, on a hand-built set,
     * because that is the rule the benchmark gear can no longer exercise.
     * Elemental Mage Staff is +36 Fire and +36 Frost and nothing blind.
     */
    const scoped = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: shadowBuild().talents,
      equipment: { twoHand: { itemId: 944 } },
    });
    expect(spellPowerFor(scoped, 'fire') - spellPowerFor(scoped, 'shadow')).toBe(36);
  });
});


/*
 * ============================================================================
 * THE TWO DISCIPLINE ACTIVES, neither of which the one Shadow profile takes.
 *
 * Both were live gaps and both were expressible, which is the whole reason
 * they are here: "no build reaches it" is a fact about a BUILD and the census
 * is a claim about the CLASS. Nothing below is a DPS assertion, because
 * neither talent can move one -- the Shadow build spends 16 points in
 * Discipline and these sit above that.
 * ============================================================================
 */
describe('Inner Focus, whose two halves are spent at different moments', () => {
  const withInnerFocus = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('priest', 'caster', legalise({ inner_focus: 1 }, 'priest')),
      resources: [{ type: 'mana', maximum: 100_000 }],
    });

  it('is granted by the talent and by nothing else', () => {
    expect(barePriest().abilities.get('inner_focus')).toBeUndefined();
    expect(withInnerFocus().abilities.get('inner_focus')).toBeDefined();
  });

  it('makes the next spell free', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);
    const blast = actor.abilities.get('mind_blast')!;

    expect(resolveCast(actor, blast).costAmount).toBe(blast.cost!.amount);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);
    expect(resolveCast(actor, blast).costAmount).toBe(0);
  });

  /*
   * THE CRIT HALF, WHICH ITS REASON SAID NOTHING COULD CARRY. `CastModifier`
   * carries cast time and cost and no crit -- and an AURA carries per-ability
   * modifiers, which is where this lives.
   */
  it('adds 25% crit to the spells that can crit', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);

    expect(actor.abilityModifierFor('mind_blast').critBonus ?? 0).toBe(0);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);
    expect(actor.abilityModifierFor('mind_blast').critBonus).toBe(INNER_FOCUS_CRIT_BONUS);
    expect(actor.abilityModifierFor('mind_flay').critBonus).toBe(INNER_FOCUS_CRIT_BONUS);
  });

  /*
   * "IF IT IS CAPABLE OF A CRITICAL EFFECT" -- the tooltip's own clause, and
   * the two damage-over-time casts are not. They roll no table when applied,
   * and leaving them out is also what stops a TICK of one collecting the 25%
   * during the window, since a periodic tick carries its aura's id.
   */
  it('gives no crit to the two spells that apply auras', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);

    expect(actor.abilityModifierFor('shadow_word_pain').critBonus ?? 0).toBe(0);
    expect(actor.abilityModifierFor('devouring_plague').critBonus ?? 0).toBe(0);
  });

  it('still makes those two free, because the COST half is every spell', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);

    const pain = actor.abilities.get('shadow_word_pain')!;
    expect(resolveCast(actor, pain).costAmount).toBe(0);
  });

  /*
   * NOT `consumedByCast`, AND THIS IS THE TEST OF WHY. That field spends the
   * aura at cast START -- before a 1.5-second Mind Blast has rolled anything
   * -- so the crit would never be read and the talent would report itself
   * fully modelled while being half of one.
   */
  it('is spent by a cast reaction rather than at cast start', () => {
    expect(INNER_FOCUS.castModifier?.consumedByCast).toBeUndefined();

    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);
    const spender = innerFocusSpender();

    // The cast that APPLIED it does not spend it: same timestamp.
    expect(spender.canTrigger!(simulation, actor, undefined as never)).toBe(false);

    simulation.clock.advanceTo(1);
    expect(spender.canTrigger!(simulation, actor, undefined as never)).toBe(true);
    spender.onTrigger(simulation, actor, undefined as never);
    expect(actor.auras.has('inner_focus')).toBe(false);
  });

  it('refuses itself while its own charge is unspent', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);
    const focus = actor.abilities.get('inner_focus')!;

    const context = { simulation, caster: actor, target: undefined, ability: focus };
    expect(focus.canCast!(context)).toBe(true);
    simulation.applyAura(actor, INNER_FOCUS, actor.id);
    expect(focus.canCast!(context)).toBe(false);
  });

  /*
   * ==========================================================================
   * AND THE ONE THAT WAS MISSING: DOES THE TALENT ACTUALLY REGISTER THE
   * SPENDER.
   *
   * THREE TESTS ABOVE EXERCISE THE SPENDER AND NONE OF THEM COULD SEE THE BUG,
   * because every one of them builds it by hand -- `innerFocusSpender()` --
   * which is CLAUDE.md's "a test that reconstructs the thing under test will
   * reproduce its mistakes". The reaction was always correct. What was wrong
   * was that `talentBuild` threw it away: Inner Focus is SINGLE RANK, so its
   * values entry is `null`, and an effect that reads no value is dropped
   * without a `valueless: true` beside it.
   *
   * WHAT THAT COST: the ability was still granted, so the aura applied, showed
   * its uptime and never came off -- +25% crit on Mind Blast, Mind Flay and
   * Shadow Word: Death for its whole sixty seconds. The owner found it by
   * reading the result, not from anything here.
   *
   * SO THIS ASKS THE BUILD, NOT THE REACTION. It is the same assertion
   * `hunterFiveFixes.test.ts` makes about a `grantAura` resolving: a lookup
   * that misses is not an error, so something has to ask whether it missed.
   * ==========================================================================
   */
  it('registers its spender on the BUILT character, which is what was broken', () => {
    const build = talentBuild('priest', { inner_focus: 1 });

    expect(build.castReactions.map((reaction) => reaction.id)).toContain('inner_focus_spend');
    // And it is not quietly reported as a gap instead.
    expect(build.unmodelled.filter((entry) => entry.talentId === 'inner_focus')).toEqual([]);
  });

  it('comes off after one spell on a character built the real way', () => {
    /*
     * ------------------------------------------------------------------------
     * `createPlayer`, NOT `makeAttacker`, AND THAT IS THE WHOLE TEST.
     *
     * The three tests above hand-build the spender and hand-build the actor,
     * so neither end of the join is the one a fight uses. `createPlayer` is
     * what collects `talentBuild`'s `castReactions` onto the combatant -- the
     * step that was silently producing an empty list -- and driving the real
     * cast path is what proves the charge is spent by a SPELL rather than by a
     * test calling `onTrigger`.
     *
     * It also pins the ordering: `runCast` runs `onCast` before the cast
     * reactions, so the Mind Blast still rolled its crit inside the window.
     * ------------------------------------------------------------------------
     */
    const actor = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: legalise({ inner_focus: 1 }, 'priest'),
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    simulation.cast(actor, actor.abilities.get('inner_focus')!, undefined);
    expect(actor.auras.has('inner_focus'), 'the charge is up').toBe(true);

    simulation.advanceTo(simulation.clock.now() + 1);
    simulation.cast(actor, actor.abilities.get('mind_blast')!, target);
    simulation.advanceTo(simulation.clock.now() + 5_000);

    expect(actor.auras.has('inner_focus'), 'and one spell spent it').toBe(false);
  });

  /*
   * OFF THE GLOBAL COOLDOWN, the owner's instruction.
   *
   * ASSERTED ON `gcdReadyAt` RATHER THAN ON THE FLAG, because the rule is
   * DERIVED -- `triggersGcd ?? onNextSwing === undefined` -- so reading the
   * field back would only check that somebody typed it. What matters is that
   * the spell being set up can follow immediately.
   */
  it('starts no global cooldown, so the spell it is cast for can follow', () => {
    const actor = withInnerFocus();
    const simulation = buildSimulation([actor, makeTarget()]);

    expect(actor.isOnGcd(simulation.clock.now())).toBe(false);
    simulation.cast(actor, actor.abilities.get('inner_focus')!, undefined);
    expect(actor.isOnGcd(simulation.clock.now())).toBe(false);

    // A spell that DOES take one, as the control: the assertion above is only
    // meaningful if this fixture can produce a running GCD at all.
    simulation.cast(actor, actor.abilities.get('mind_blast')!, simulation.combatants[1]);
    expect(actor.isOnGcd(simulation.clock.now())).toBe(true);
  });
});

describe('Power Infusion, on a target that for one character is itself', () => {
  const withPowerInfusion = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('priest', 'caster', legalise({ power_infusion: 1 }, 'priest')),
      resources: [{ type: 'mana', maximum: 100_000 }],
    });

  /*
   * `abilityModifiers` RATHER THAN `damageDoneMultiplier`, which is the one
   * decision in it: a whole-character multiplier would raise PHYSICAL damage
   * too, and "spell damage" does not. `ALL_ABILITIES` on an aura reaches every
   * ability and no auto attack, and a Priest owns no physical ability -- so
   * the two readings are the same set here and would not be on a hybrid.
   */
  it('raises every spell by 20% and no auto attack at all', () => {
    const actor = withPowerInfusion();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, POWER_INFUSION, actor.id);

    expect(actor.abilityModifierFor('mind_blast').damageMultiplier).toBeCloseTo(
      POWER_INFUSION_DAMAGE,
      6,
    );
    // A swing carries no ability id, and nothing here reaches one.
    expect(actor.abilityModifierFor(undefined).damageMultiplier ?? 1).toBe(1);
    // And it is NOT a whole-character multiplier, which is the thing it would
    // have been if the caveat had been accepted instead.
    expect(actor.damageDoneMultiplier).toBe(1);
  });

  it('reaches a damage-over-time tick, which is also spell damage', () => {
    const actor = withPowerInfusion();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, POWER_INFUSION, actor.id);

    // A tick carries its aura's id, and `pick` folds in the catch-all.
    expect(actor.abilityModifierFor('shadow_word_pain').damageMultiplier).toBeCloseTo(
      POWER_INFUSION_DAMAGE,
      6,
    );
  });

  it('costs 20% of base mana, which is the capture\'s own figure', () => {
    const actor = withPowerInfusion();
    const infusion = actor.abilities.get('power_infusion')!;
    expect(infusion.cost!.amount).toBe(Math.round(PRIEST_BASE_MANA * 0.2));
  });
});
