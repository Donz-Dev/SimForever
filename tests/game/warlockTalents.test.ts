import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import type { Ability, Combatant, TelemetryEvent } from '../../src/engine';
import { NO_CHANCES, castAbility, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import {
  WARLOCK_AFFLICTION_PERIODICS,
  WARLOCK_DESTRUCTION_SPELLS,
  WARLOCK_SOUL_SIPHON_EFFECTS,
  WRACK,
  WRACK_HASTED_EFFECTS,
  WRACK_SOUL_SIPHON_CAP,
  WRACK_SOUL_SIPHON_PER_EFFECT,
} from '../../src/game/abilities/warlock';
import {
  BANE_OF_AGONY,
  CORRUPTION,
  SIPHON_LIFE,
  IMMOLATE,
} from '../../src/game/auras/warlock';
import { COMBAT_CONSTANTS } from '../../src/game/combat/attackChances';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import type { TalentEffect } from '../../src/game/talents/TalentEffect';
import { legalise } from '../helpers/legalTalents';
import { talentNumber } from '../../src/game/talents/talentValues';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalAllocation } from '../../src/game/talents/talentRules';

/*
 * ============================================================================
 * THE WARLOCK TALENTS THAT SELECT A LIST OF ABILITIES, and the two that select
 * a TREE and were reading a SCHOOL instead.
 *
 * ASSERTING THE MECHANISM AND NOT A DPS DELTA, by the standing rule -- and
 * this file is the worked argument for that rule. Three of the five talents
 * here reach only Wrack, which was in no list when they were written, so all
 * three were worth EXACTLY ZERO and all three were correct. Wrack is in the
 * SM/DS list now and they are live, and NOT ONE ASSERTION HERE CHANGED. A test
 * written against a DPS delta would have had to be rewritten twice.
 *
 * THE BONUS HALF IS THE NUMBER TO GET RIGHT. A spell crit multiplies by 1.5, so
 * "+100% critical strike damage bonus" adds 0.5 and takes it to 2.0x. Reading
 * the melee figure would add 1.0 and give 2.5x -- a plausible number, and twice
 * the talent. It is written out from the constant here rather than hardcoded,
 * so a ruleset change moves the test and the code together.
 * ============================================================================
 */

const SPELL_CRIT_BONUS_HALF = COMBAT_CONSTANTS.spellCritMultiplier - 1;

const playerFor = (preset: string): Combatant => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
};

/**
 * The same character with its PRIORITY LIST taken away.
 *
 * ----------------------------------------------------------------------------
 * A `createPlayer` COMBATANT CARRIES A ROTATION, AND A TEST THAT RUNS THE CLOCK
 * IS THEREFORE TESTING THE LIST TOO. That is how the Soul Siphon test below
 * broke: it cast Wrack once, ran ten seconds, and summed every `wrack` damage
 * event -- and when Wrack entered the SM/DS list the ROTATION cast it again
 * inside the window. Worse, it did so ASYMMETRICALLY: the second cast is gated
 * on the three bleeds being up, so the "three bleeds" arm got ten ticks and the
 * "no bleeds" arm got six. The ratio read 2.27 against an expected 1.36 and
 * neither number was about Soul Siphon.
 *
 * IT WAS A LATENT FLAW THAT A LIST CHANGE EXPOSED, not a mechanism breaking:
 * the test was only ever correct while Wrack was in no list, and nothing said
 * so. Any test that advances the clock on a built character wants this.
 * ----------------------------------------------------------------------------
 */
const soloPlayerFor = (preset: string): Combatant => {
  const actor = playerFor(preset);
  (actor as { rotation?: unknown }).rotation = undefined;
  return actor;
};

describe('Pandemic, the first talent to reach critMultiplierBonus', () => {
  const smds = playerFor('warlock_smds');

  it('gives every DECLARED spell it names the spell-crit bonus half', () => {
    /*
     * ------------------------------------------------------------------------
     * "+100% CRITICAL STRIKE DAMAGE BONUS" at 3/3, over seven named spells.
     * `AbilityModifiers.critMultiplierBonus` had existed since Impale with no
     * talent effect reaching it, which is what the old `unmodelled` reason said
     * -- a missing DECLARATION rather than a missing rule, and the Rogue's
     * Lethality wanted the identical one.
     *
     * AN AURA ID IS AN ABILITY ID, which is the whole reason this is
     * expressible: a periodic tick carries its AURA's id and `rollPeriodicCrit`
     * applies the same modifier a cast gets.
     * ------------------------------------------------------------------------
     */
    for (const id of [...WARLOCK_AFFLICTION_PERIODICS, 'wrack']) {
      expect(smds.abilityModifiers.for(id).critMultiplierBonus, id).toBeCloseTo(
        SPELL_CRIT_BONUS_HALF,
        6,
      );
    }
  });

  it('does NOT reach Shadow Bolt, which it does not name', () => {
    /*
     * The containment check, and the one that separates this from the three
     * scopes that already existed. Shadow Bolt is 52% of this profile's damage
     * and is not in the talent's list; a whole-character or per-school reading
     * would have swept it up and produced a much larger and entirely plausible
     * number.
     */
    expect(smds.abilityModifiers.for('shadow_bolt').critMultiplierBonus ?? 0).toBe(0);
    expect(smds.schoolModifiers.for('shadow').critMultiplierBonus ?? 0).toBe(0);
  });

  it('is absent from the build that does not take it', () => {
    const firelock = playerFor('warlock_firelock');
    expect(firelock.abilityModifiers.for('corruption').critMultiplierBonus ?? 0).toBe(0);
  });
});

describe('Ruin and Agonizing Flames, which select a TREE and not a school', () => {
  const firelock = playerFor('warlock_firelock');

  it('Ruin reaches every declared Destruction spell', () => {
    // 5/5 is +100%, so the spell bonus half. Shadow Bolt is in the list
    // because the source's own spellbook puts it in the Destruction tab.
    for (const id of WARLOCK_DESTRUCTION_SPELLS) {
      expect(firelock.abilityModifiers.for(id).critMultiplierBonus, id).toBeCloseTo(
        SPELL_CRIT_BONUS_HALF,
        6,
      );
    }
    expect(WARLOCK_DESTRUCTION_SPELLS).toContain('shadow_bolt');
  });

  it('and stops at Corruption, which is an AFFLICTION spell', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUG THIS PAIR OF TALENTS CARRIED. Both were read as "Fire and Shadow"
     * -- the two schools a Warlock has, which is every spell it owns -- so both
     * also reached Corruption, Bane of Agony, Siphon Life and Wrack.
     *
     * CORRUPTION IS 13.5% OF THIS PROFILE'S DAMAGE and it was collecting +100%
     * crit damage and +10% damage from two Destruction talents. Worth -3.3 and
     * -4.8 DPS respectively, measured over 30 batches of 10.
     * ------------------------------------------------------------------------
     */
    expect(firelock.abilityModifiers.for('corruption').critMultiplierBonus ?? 0).toBe(0);
    expect(firelock.abilityModifiers.for('corruption').damageMultiplier ?? 1).toBe(1);
    // And the school scope they used to travel on is now empty.
    expect(firelock.schoolModifiers.for('shadow').critMultiplierBonus ?? 0).toBe(0);
  });

  it('Agonizing Flames gives its +10% to a Destruction spell and nothing else', () => {
    // 3/3 is 10%, and Incinerate is touched by no other damage talent here.
    expect(firelock.abilityModifiers.for('incinerate').damageMultiplier).toBeCloseTo(1.1, 6);
  });
});

describe('Improved Drains and Soul Siphon, and which of them still reaches Wrack', () => {
  const smds = playerFor('warlock_smds');

  it('Improved Drains no longer reaches Wrack, at 1.60.1.70755', () => {
    /*
     * "Now increases Drain Mana's amount of Mana drained but no longer
     * increases Wrack damage." It read 1.2, then 1.2 x 1.05 while Malediction
     * existed, then 1.2 again; now nothing reaches Wrack at all. The spells
     * it still names are undeclared, so the talent is inert and says so.
     */
    expect(smds.abilityModifiers.for('wrack').damageMultiplier ?? 1).toBe(1);
    expect(WARLOCK_TALENT_EFFECTS.improved_drains.every((e) => e.kind === 'unmodelled')).toBe(
      true,
    );
  });

  it('Soul Siphon hands Wrack its per-effect number and its cap', () => {
    const wrack = smds.abilities.get('wrack');
    expect(wrack?.bonuses?.[WRACK_SOUL_SIPHON_PER_EFFECT]).toBe(12);
    expect(wrack?.bonuses?.[WRACK_SOUL_SIPHON_CAP]).toBe(36);
  });

  it('and Soul Siphon is read per CAST, off what is on the target', () => {
    /*
     * ------------------------------------------------------------------------
     * "+12% PER EACH OF YOUR OTHER AFFLICTION EFFECTS ACTIVE ON THE TARGET, UP
     * TO 36%", which is why it is an `abilityBonus` read in `onCast` rather
     * than a standing modifier: its size depends on the target's state.
     *
     * SCRIPTED, NOT SAMPLED. `NO_CHANCES` with a large negative crit makes
     * every tick a clean non-critical hit, so the ratio is the talent and not
     * a seed.
     * ------------------------------------------------------------------------
     */
    const damageWith = (dots: number): number => {
      const events: TelemetryEvent[] = [];
      // NO ROTATION -- see `soloPlayerFor`. With one, the list casts Wrack a
      // second time inside the window and only when the bleeds are up.
      const caster = soloPlayerFor('warlock_smds');
      const target = makeTarget({ maxHealth: 100_000_000 });
      const simulation = buildSimulation(
        [caster, target],
        {
          durationMs: seconds(30),
          attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1.5 }),
        },
        { emit: (event) => events.push(event) },
      );
      for (const aura of [CORRUPTION, BANE_OF_AGONY, SIPHON_LIFE].slice(0, dots)) {
        simulation.applyAura(target, aura, caster.id);
      }
      /*
       * NOTE WHAT IS *NOT* HERE: Curse of the Elements. The owner has ruled it
       * counts for Soul Siphon, and in a real fight it arrives from the preset
       * raid buffs and is up for the hour -- so a profile reaches the 36% cap on
       * Corruption, Curse of the Elements and Bane of Agony alone. This test
       * builds the target by hand precisely so the count is the three it
       * applies and not whatever the raid turned up with.
       */

      castAbility(simulation, caster, caster.abilities.get('wrack') as Ability, target);
      simulation.advanceTo(seconds(10));

      let total = 0;
      for (const event of events) {
        if (event.type === 'damage' && event.abilityId === 'wrack') total += event.amount;
      }
      return total;
    };

    // No other Affliction effect up: the bonus is 1.0 and the ticks are plain.
    const bare = damageWith(0);
    // Three up: 3 x 12% = 36%, which is exactly the cap.
    const loaded = damageWith(3);
    expect(loaded / bare).toBeCloseTo(1.36, 3);
    // Two up is 24%, under the cap, so it scales rather than jumping to it.
    expect(damageWith(2) / bare).toBeCloseTo(1.24, 3);
  });
});

describe('Wrack, which speeds three DoTs up while it is channelled (1.60.1.70888)', () => {
  /*
   * ============================================================================
   * THE REDESIGN: "While channeling, your Siphon Life, Corruption, and Bane of
   * Agony effects on the target deal their periodic damage 100% faster" -- and
   * "Wrack no longer increases the damage of the Warlock's periodic effects".
   * The developers' note is the spec for the clock: "if you channel Wrack for 1
   * second during a 3-second Corruption tick, Corruption advances 2 seconds
   * instead of 1, so its next tick lands 1 second later instead of 2, even if
   * you stopped channeling Wrack."
   *
   * ASSERTED ON TICK TIMESTAMPS, which is the mechanism, rather than on DPS.
   * ============================================================================
   */
  const fight = () => {
    const events: TelemetryEvent[] = [];
    // NO ROTATION -- see `soloPlayerFor` -- so every cast here is the test's.
    const caster = soloPlayerFor('warlock_smds');
    const target = makeTarget({ maxHealth: 100_000_000 });
    const simulation = buildSimulation(
      [caster, target],
      {
        durationMs: seconds(60),
        attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1.5 }),
      },
      { emit: (event) => events.push(event) },
    );
    const ticksOf = (abilityId: string): number[] =>
      events
        .filter((event) => event.type === 'damage' && event.abilityId === abilityId)
        .map((event) => event.timestamp);
    return { events, caster, target, simulation, ticksOf };
  };

  it('names exactly the three effects the tooltip names', () => {
    expect([...WRACK_HASTED_EFFECTS].sort()).toEqual(['bane_of_agony', 'corruption', 'siphon_life']);
    expect(WRACK.interruptibleChannel).toBe(true);
  });

  it('doubles a Corruption tick rate for the channel and leaves its duration alone', () => {
    const { caster, target, simulation, ticksOf } = fight();
    simulation.applyAura(target, CORRUPTION, caster.id);
    const wrack = caster.abilities.get('wrack') as Ability;
    castAbility(simulation, caster, wrack, target);
    simulation.advanceTo(seconds(30));

    /*
     * A 3 s tick at x2 lands every 1.5 s while the channel runs: 1.5, 3 and
     * 4.5. The channel ends at T -- six seconds less this character's spell
     * haste, read off Wrack's own last tick rather than assumed -- with
     * `2 x (T - 4.5)` of the next tick's 3 s already done, so the remainder
     * lands at x1 at `T + 3 - 2(T - 4.5) = 12 - T`, and every tick after it is
     * 3 s apart until the 18 s Corruption ends -- "not how long they last".
     */
    const channelEnd = Math.max(...ticksOf('wrack'));
    expect(channelEnd).toBeGreaterThan(seconds(4.5));
    expect(channelEnd).toBeLessThanOrEqual(seconds(6));
    const expected = [seconds(1.5), seconds(3), seconds(4.5)];
    for (let at = seconds(12) - channelEnd; at <= seconds(18); at += seconds(3)) expected.push(at);
    expect(ticksOf('corruption')).toEqual(expected);
    // Three of them at x2 and the rest at x1: more ticks than the plain six.
    expect(expected.length).toBeGreaterThan(6);
  });

  it('keeps the progress it skipped after the channel is interrupted', () => {
    /*
     * The developers' own example. Corruption goes up at t=0; Wrack starts at
     * t=1 and is cut off just before t=2, so the 3 s tick has 1 s (at x1) plus
     * 0.999 s (at x2) of progress -- 2 ms short, paid at x1, so it lands at
     * 2.001 where it would have landed at 3. Then 3 s apart again.
     */
    const { caster, target, simulation, ticksOf } = fight();
    simulation.applyAura(target, CORRUPTION, caster.id);
    simulation.advanceTo(seconds(1));
    castAbility(simulation, caster, caster.abilities.get('wrack') as Ability, target);
    simulation.advanceTo(seconds(2) - 1);
    caster.interruptChannel(simulation);
    simulation.advanceTo(seconds(9));

    const ticks = ticksOf('corruption');
    expect(ticks[0]).toBe(seconds(2) + 1);
    expect(ticks[1]).toBe(ticks[0]! + seconds(3));
  });

  it('speeds up nothing it does not name, and amplifies nothing', () => {
    const run = (withWrack: boolean) => {
      const f = fight();
      f.simulation.applyAura(f.target, CORRUPTION, f.caster.id);
      f.simulation.applyAura(f.target, IMMOLATE, f.caster.id);
      if (withWrack) castAbility(f.simulation, f.caster, f.caster.abilities.get('wrack') as Ability, f.target);
      f.simulation.advanceTo(seconds(4));
      return f;
    };
    const plain = run(false);
    const wracked = run(true);

    // Immolate is periodic and not named, so its clock does not move.
    expect(wracked.ticksOf('immolate')).toEqual(plain.ticksOf('immolate'));
    // Corruption ticks more often, and each tick is the SAME SIZE: the old
    // +10% to Shadow DoTs is gone.
    const firstCorruption = (events: TelemetryEvent[]) =>
      (events.find((e) => e.type === 'damage' && e.abilityId === 'corruption') as { amount: number })
        .amount;
    expect(wracked.ticksOf('corruption').length).toBeGreaterThan(plain.ticksOf('corruption').length);
    expect(firstCorruption(wracked.events)).toBeCloseTo(firstCorruption(plain.events), 6);
  });
});

describe('Two lists, and conflating them would have been the bug', () => {
  /*
   * ============================================================================
   * PANDEMIC SELECTS PERIODIC SPELLS BY NAME. SOUL SIPHON COUNTS "AFFLICTION
   * EFFECTS". They overlap and they are not the same set, and the ruleset owner
   * has ruled that Soul Siphon's includes CURSE OF THE ELEMENTS -- a raid
   * debuff, which is neither periodic nor one of the seven spells Pandemic
   * lists.
   *
   * SO ADDING IT TO ONE SHARED LIST WOULD HAVE HANDED A CRIT DAMAGE BONUS TO A
   * RAID DEBUFF, which is the sort of thing that produces a slightly larger
   * number and no error anywhere.
   * ============================================================================
   */
  it('Soul Siphon counts exactly Corruption, Siphon Life and Bane of Agony now', () => {
    // The owner's 2026-11-11 note: "per each of your Corruption, Siphon Life,
    // and Bane of Agony spells ... (was any Affliction spell)". Curse of the
    // Elements counted under the earlier ruling and does not any more.
    expect([...WARLOCK_SOUL_SIPHON_EFFECTS].sort()).toEqual([
      'bane_of_agony',
      'corruption',
      'siphon_life',
    ]);
    expect(WARLOCK_AFFLICTION_PERIODICS).not.toContain('curse_of_the_elements');

    // And the modifier really does stop at the spells Pandemic names.
    const smds = playerFor('warlock_smds');
    expect(
      smds.abilityModifiers.for('curse_of_the_elements').critMultiplierBonus ?? 0,
    ).toBe(0);
  });

  it('counts three effects to the cap, and the three are the bleeds', () => {
    /*
     * The three named effects reach the cap exactly: 3 x 12% = 36%. Since the
     * 2026-11-11 note they are the ONLY three that count.
     */
    const smds = playerFor('warlock_smds');
    const wrack = smds.abilities.get('wrack');
    const perEffect = wrack?.bonuses?.[WRACK_SOUL_SIPHON_PER_EFFECT] ?? 0;
    const cap = wrack?.bonuses?.[WRACK_SOUL_SIPHON_CAP] ?? 0;
    expect(perEffect * 3).toBe(cap);
  });

  it('Malediction is GONE, and Grim Reach is what took its slot', () => {
    /*
     * ========================================================================
     * THE TALENT THIS PAIR OF TESTS WAS WRITTEN FOR NO LONGER EXISTS.
     *
     * Malediction was five ranks of +% to every periodic effect a Warlock
     * owns -- the single largest talent on this project's most DoT-heavy
     * profile -- and client build 1.60.1.70425 removed it, putting GRIM REACH
     * in Affliction row 1 at two ranks. Grim Reach is range, so it is
     * `positioning` and worth nothing here.
     *
     * WHAT REPLACED IT REPLACES NOTHING, and that is the ruleset's decision
     * rather than a hole for this repository to fill. Recorded as an assertion
     * instead of as prose because **a deleted talent leaves no zero anywhere**:
     * `WARLOCK_TALENT_EFFECTS.malediction` being absent is not an error, a
     * spread naming it is stripped in silence, and the profile simply does less
     * damage. The one thing that notices is a test that says so.
     *
     * THE SPREAD MOVED ITS FIVE POINTS TO BANE, and `presets.ts` carries the
     * argument: the owner's own 2.5 second Shadow Bolt lead is a 3.0 second
     * cast with Bane 5/5 on it.
     * ========================================================================
     */
    expect(WARLOCK_TALENT_EFFECTS.malediction).toBeUndefined();
    expect(WARLOCK_TALENT_EFFECTS.grim_reach).toBeDefined();

    // Grim Reach is ruled out rather than unfinished, so it carries a scope.
    const scopes = WARLOCK_TALENT_EFFECTS.grim_reach
      .filter((e: TalentEffect) => e.kind === 'unmodelled')
      .map((e: TalentEffect) => (e as { scope?: string }).scope);
    expect(scopes).toEqual(['positioning']);

    /*
     * AND NOTHING ELSE INHERITED ITS FOUR AURA IDS. Malediction reached
     * Corruption, Bane of Agony, Siphon Life, Immolate and Wrack by naming each
     * one -- the route a tick takes, because a tick carries its AURA's id -- so
     * a reader meeting that pattern in some other talent should know it is not
     * this one come back under a new name.
     */
    for (const effects of Object.values(WARLOCK_TALENT_EFFECTS)) {
      const ids = effects
        .filter((e: TalentEffect) => e.kind === 'abilityDamage')
        .map((e: TalentEffect) => (e as { abilityId: string }).abilityId);
      expect(ids).not.toEqual(
        expect.arrayContaining(['corruption', 'bane_of_agony', 'siphon_life', 'immolate']),
      );
    }
  });

  it('Amplify Curse grants its ability and reports only the curses it cannot reach', () => {
    const effects = WARLOCK_TALENT_EFFECTS.amplify_curse;
    expect(effects.some((e: TalentEffect) => e.kind === 'grantAbility')).toBe(true);
    // Its old reason asked for a one-shot per-ability DAMAGE modifier and was
    // wrong about the mechanism; nothing should still claim that.
    for (const effect of effects) {
      if (effect.kind === 'unmodelled') {
        expect(effect.reason).not.toContain('CastModifier');
      }
    }
  });
});

/* -------------------------------------------------------------------------- */

describe('Aftermath, which read a movement speed as a damage bonus', () => {
  /*
   * ==========================================================================
   * THE WRONG-INDEX BUG CLAUDE.md NAMED BEFORE IT COULD BITE: "The Warlock's
   * Aftermath has the same mistake and escapes it only because at 5/5 the two
   * numbers coincide."
   *
   * The row is "Increases the initial damage of your Immolate spell by {0}%
   * and your Conflagrate spell has a {1}% chance to Daze the target, reducing
   * the target's movement speed by {2}% for {3} sec", and `abilityDamage`
   * declared `valueIndex: 2` -- the MOVEMENT SPEED, which is a constant 50 at
   * every rank. At 5/5 the correct figure is also 50, so it was correct by
   * coincidence for the whole life of the talent.
   *
   * WHAT MADE IT LIVE WAS A TALENT CHANGE, NOT A CODE CHANGE. The owner's
   * respecification takes Firelock to 2/5, where the right answer is 20 and
   * index 2 still reads 50 -- two and a half times the talent, on the
   * profile's second-largest damage source.
   *
   * SO THIS ASSERTS THE RANK SCALING RATHER THAN ONE VALUE, which is the only
   * shape that could have caught it: any single-rank check at 5/5 passes
   * against both the right index and the wrong one. **"Assert the MECHANISM"
   * means the SIZE of the mechanism**, and here it means its SLOPE.
   * ==========================================================================
   */
  const immolateMultiplier = (rank: number) =>
    createPlayer({
      race: 'undead',
      characterClass: 'warlock',
      combatStyle: 'caster',
      talents: legalise({ aftermath: rank }, 'warlock'),
    }).abilityModifierFor('immolate').directDamageMultiplier ?? 1;

  it('scales with rank rather than reading a constant', () => {
    // {0} by rank: 10 / 20 / 30 / 40 / 50.
    for (const [rank, expected] of [[1, 1.1], [2, 1.2], [3, 1.3], [4, 1.4], [5, 1.5]] as const) {
      expect(immolateMultiplier(rank), `rank ${rank}`).toBeCloseTo(expected, 10);
    }
  });

  it('is not the constant index 2 would have produced', () => {
    /*
     * THE MIRROR ASSERTION, and it is the one that expires usefully: index 2
     * is 50 at EVERY rank, so the wrong reading is a flat 1.5. Rank 5 cannot
     * tell the two apart, which is exactly why it hid -- so the check is that
     * the low ranks differ from it.
     */
    expect(immolateMultiplier(2)).not.toBeCloseTo(1.5, 10);
    expect(talentNumber('warlock', 'aftermath', 2, 2)).toBe(50);
    expect(talentNumber('warlock', 'aftermath', 2, 0)).toBe(20);
    // And the coincidence that hid it, stated outright.
    expect(talentNumber('warlock', 'aftermath', 5, 0)).toBe(
      talentNumber('warlock', 'aftermath', 5, 2),
    );
  });

  it('contributes exactly its own rank on the Firelock preset', () => {
    /*
     * ========================================================================
     * MEASURED AS A RATIO AGAINST THE SAME BUILD WITHOUT IT, because the
     * ABSOLUTE figure is not Aftermath's. The preset reads **1.32** on
     * Immolate, which is `1.20 x 1.10` -- Agonizing Flames raises every
     * Destruction spell on top, and this file's own test one screen up is
     * about that talent selecting a TREE.
     *
     * The first version of this assertion expected 1.20 and failed at 1.32.
     * **The code was right and the assertion was wrong**, which is the hazard
     * a per-ability multiplier carries: several talents land on one id and
     * multiply, so an absolute expectation silently becomes a claim about
     * every one of them.
     * ========================================================================
     */
    /*
     * AT 2/5 ON PURPOSE, which is no longer the preset's rank: round 42 took
     * the Firelock to 5/5, where the old wrong index and the right one both
     * read 50 and this test could not tell them apart. The bug only shows at a
     * rank below five, so the allocation pins that rank itself.
     */
    const talents: Record<string, number> = {
      ...PRESETS_BY_ID.get('warlock_firelock')!.build().talents,
      aftermath: 2,
      // The three Aftermath points the preset spends above 2/5, parked on a
      // talent nothing here reads so every tier above keeps its count.
      molten_skin: 3,
    };

    /*
     * AND ITS LAST TWO POINTS GO TO MOLTEN SKIN TOO, RATHER THAN NOWHERE, because round 42
     * also took Destructive Reach out: without a stand-in, the rows under Ruin
     * hold eight points and Ruin's tier -- and everything above it -- would
     * leave with Aftermath. Molten Skin is damage taken, which nothing here
     * reaches, so the ratio is still Aftermath's alone.
     */
    const { aftermath: _aftermath, ...rest } = talents;
    const without: Record<string, number> = { ...rest, molten_skin: 5 };
    const multiplierFor = (allocation: Record<string, number>) =>
      createPlayer({
        race: 'undead',
        characterClass: 'warlock',
        combatStyle: 'caster',
        talents: allocation,
      }).abilityModifierFor('immolate').directDamageMultiplier ?? 1;

    /*
     * AND THE CASCADE IS NAMED RATHER THAN ASSUMED -- "an isolation probe has
     * to print `dropped` beside every figure". Destruction keeps its
     * total, so nothing else leaves with it.
     */
    expect(legalAllocation(talentsForClass('warlock')!, talents).dropped).toEqual([]);
    expect(legalAllocation(talentsForClass('warlock')!, without).dropped).toEqual([]);

    expect(multiplierFor(talents) / multiplierFor(without)).toBeCloseTo(1.2, 10);
  });
});
