import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { NO_CHANCES, ROLL_MAX, Simulation, castAbility, seconds } from '../../src/engine';
import type { AttackChances, AttackContext, Combatant, WeaponSlot } from '../../src/engine';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { comboPointsOn } from '../../src/game/combat/comboPoints';
import { MUTILATE, SINISTER_STRIKE } from '../../src/game/abilities/rogue';

/*
 * ==============================================================================
 * SEAL FATE ADDS AT MOST ONE POINT PER ABILITY *USE*, NOT PER HIT.
 *
 * The ruleset owner's ruling after Mutilate was changed: "with Seal Fate it can
 * now NO LONGER give 4 combo points. If either hand crits, Mutilate gives 3."
 *
 * So a Mutilate is 2 of its own plus at most 1, whether one hand crits or both.
 * Mutilate is the only ability in the project that deals TWO damage events and
 * awards combo points, so it is the only one the cap is visible on -- which is
 * also why the single-hit case below is asserted beside it.
 *
 * ------------------------------------------------------------------------------
 * AND THE SECOND HALF OF THIS FILE IS OLDER AND STILL LOAD-BEARING: A BUILDER'S
 * OWN POINTS MUST NOT WIPE THE ONE SEAL FATE JUST BANKED.
 *
 * `awardComboPoint` discards the pool when it is held against a DIFFERENT target
 * -- combo points live on the victim -- and that rule reads `comboPointTargetId`,
 * which only `awardComboPoint` ever sets. Seal Fate fires from inside
 * `dealDamage`, so it banks BEFORE the builder that critted awards its own, and
 * it used to bank through `grantResource`, which does not claim the target. On
 * the FIRST builder of a fight nothing had claimed it yet, so the builder's own
 * award saw a mismatch and reset the pool to zero, taking Seal Fate's point with
 * it.
 *
 * IT IS WORTH NO MEASURABLE DPS -- once a fight, and only when Seal Fate procs
 * on that first cast. That is exactly why it needed a test rather than a
 * measurement: the suite is the only thing that can see it.
 * ==============================================================================
 */

/** Every attack is a critical strike, so both hands of Mutilate crit. */
const alwaysCrit = (): AttackChances => ({ ...NO_CHANCES, crit: ROLL_MAX, critMultiplier: 2 });

/** Only the named hand crits; the other lands as an ordinary hit. */
const critOnly =
  (critting: WeaponSlot) =>
  (
    _kind: unknown,
    _source: unknown,
    _target: unknown,
    context?: AttackContext,
  ): AttackChances =>
    context?.slot === critting
      ? { ...NO_CHANCES, crit: ROLL_MAX, critMultiplier: 2 }
      : { ...NO_CHANCES };

function castWith(
  ability: typeof MUTILATE,
  claimTarget: boolean,
  chances: unknown = alwaysCrit,
): { gained: number; onTarget: number } {
  const rogue = characterAtCombatStart(PRESETS_BY_ID.get('rogue_venom')!.build() as never)!;
  const target = makeTarget({ level: 63, stats: { armor: 0 } });

  const simulation = new Simulation({
    durationMs: seconds(60),
    seed: 1,
    createCombatants: () => [rogue, target],
    attackChances: chances as never,
  });

  /*
   * Seal Fate's chance roll always wins, so what is measured is the AWARD and
   * not the luck. DELEGATED rather than spread: the RNG is a class instance, so
   * `{...rng}` copies none of its prototype methods and the weapon damage roll
   * would find `nextFloat` undefined.
   */
  const real = simulation.rng;
  (simulation as unknown as { rng: unknown }).rng = {
    next: () => real.next(),
    nextInt: (a: number, b: number) => real.nextInt(a, b),
    nextFloat: (a: number, b: number) => real.nextFloat(a, b),
    nextDuration: (a: number, b: number) => real.nextDuration(a, b),
    pick: <T,>(items: readonly T[]) => real.pick(items),
    rollChance: () => true,
  };

  if (claimTarget) (rogue as Combatant).comboPointTargetId = target.id;

  const before = rogue.resources.get('comboPoints')!.current;
  castAbility(simulation as never, rogue, ability, target);
  return {
    gained: rogue.resources.get('comboPoints')!.current - before,
    onTarget: comboPointsOn(rogue, target),
  };
}

describe('Mutilate can no longer reach four combo points', () => {
  it('gives THREE when both hands crit: two of its own and one from Seal Fate', () => {
    /*
     * THE HEADLINE, AND THIS FILE USED TO ASSERT FOUR. Mutilate declares
     * `comboPointsAwarded: 2` and deals two damage events, so Seal Fate used to
     * trigger twice -- the cap is the change, not the award.
     */
    expect(MUTILATE.comboPointsAwarded).toBe(2);
    expect(castWith(MUTILATE, true).gained).toBe(3);
  });

  it('gives the same THREE when only the main hand crits', () => {
    /*
     * "IF EITHER HAND CRITS, MUTILATE GIVES 3" -- so the two cases are the same
     * number, and that is the assertion the cap actually needs. Checking only the
     * double crit would pass against a rule that awarded one point per crit and
     * happened to cap the TOTAL somewhere else.
     */
    expect(castWith(MUTILATE, true, critOnly('mainHand')).gained).toBe(3);
  });

  it('gives the same THREE when only the OFF hand crits', () => {
    /*
     * The off hand resolves SECOND, so this is the case that fails if the latch
     * is keyed on the hand rather than on the use.
     */
    expect(castWith(MUTILATE, true, critOnly('offHand')).gained).toBe(3);
  });

  it('gives TWO when neither hand crits, so the cap is not a floor', () => {
    const neverCrit = (): AttackChances => ({ ...NO_CHANCES });
    expect(castWith(MUTILATE, true, neverCrit).gained).toBe(2);
  });

  it('is a cap per USE, so a second Mutilate gets its own point', () => {
    /*
     * THE HALF A LATCH GETS WRONG. Suppressing the second hit must not suppress
     * the next CAST -- a latch that was never cleared would make Seal Fate fire
     * once a fight, which is a smaller number and no error. The counter is what
     * makes this work: `recordCast` moves it, so the comparison stops matching.
     */
    const rogue = characterAtCombatStart(PRESETS_BY_ID.get('rogue_venom')!.build() as never)!;
    const target = makeTarget({ level: 63, stats: { armor: 0 } });
    const simulation = new Simulation({
      durationMs: seconds(60),
      seed: 1,
      createCombatants: () => [rogue, target],
      attackChances: alwaysCrit as never,
    });
    const real = simulation.rng;
    (simulation as unknown as { rng: unknown }).rng = {
      next: () => real.next(),
      nextInt: (a: number, b: number) => real.nextInt(a, b),
      nextFloat: (a: number, b: number) => real.nextFloat(a, b),
      nextDuration: (a: number, b: number) => real.nextDuration(a, b),
      pick: <T,>(items: readonly T[]) => real.pick(items),
      rollChance: () => true,
    };
    const pool = rogue.resources.get('comboPoints')!;
    const energy = rogue.resources.get('energy')!;

    /*
     * THREE THINGS HAVE TO BE CLEARED BETWEEN THE TWO CASTS, and each of them
     * refuses the second Mutilate in a way that looks exactly like a latch that
     * never released:
     *
     *   the ENERGY -- Mutilate is 60 of a 100 pool, so there is not a second
     *     cast's worth without refilling it;
     *   the GLOBAL COOLDOWN -- both casts happen at time 0 and the first starts
     *     a one-second GCD, which is what actually failed the first draft of
     *     this test;
     *   the COMBO POOL, so the second award is measured from zero.
     *
     * Advancing the clock instead would run the whole fight -- auto-attacks, the
     * priority list, poisons -- and the pool would no longer be measuring this
     * ability. Clearing the three directly is what keeps the subject the latch.
     */
    pool.spend(pool.current);
    (rogue as Combatant).comboPointTargetId = target.id;

    castAbility(simulation as never, rogue, MUTILATE, target);
    const afterFirst = pool.current;

    pool.spend(pool.current);
    energy.gain(energy.maximum - energy.current);
    (rogue as Combatant).gcdReadyAt = 0;
    castAbility(simulation as never, rogue, MUTILATE, target);

    expect(afterFirst).toBe(3);
    expect(rogue.castSequence).toBe(2);
    expect(pool.current).toBe(3);
  });

  it('counts every cast, including on a character with no cast reactions', () => {
    /*
     * `runCast` RETURNS EARLY when nothing is listening for a cast, and the stamp
     * has to happen BEFORE that branch -- otherwise the counter freezes for every
     * character on that path and the latch above would never release.
     *
     * A BARE COMBATANT, BECAUSE NO PRESET TAKES THAT PATH ANY MORE. The first
     * draft named DW Fury and the second searched all 24 presets; every one of
     * them has at least one cast reaction, so a preset-based test would have
     * asserted its own premise and said nothing about the branch. `makeAttacker`
     * has no reactions at all, which is exactly the shape the branch is for.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [MUTILATE],
      weapons: {
        mainHand: { name: 'Dagger', weaponType: 'dagger', baseDamage: 100, swingTimerMs: 1800 },
        offHand: { name: 'Dagger', weaponType: 'dagger', baseDamage: 80, swingTimerMs: 1800 },
      },
      resources: [
        { type: 'energy', maximum: 100, initial: 100 },
        { type: 'comboPoints', maximum: 5 },
      ],
    });
    expect(actor.castReactions.length).toBe(0);

    const target = makeTarget({ level: 63, stats: { armor: 0 } });
    const simulation = new Simulation({
      durationMs: seconds(60),
      seed: 1,
      createCombatants: () => [actor, target],
    });
    const before = actor.castSequence;
    castAbility(simulation as never, actor, MUTILATE, target);
    expect(actor.castSequence).toBe(before + 1);
  });
});

describe('a single-hit builder is unaffected by the cap', () => {
  it('gives Sinister Strike two: one of its own and one from Seal Fate', () => {
    expect(SINISTER_STRIKE.comboPointsAwarded).toBe(1);
    expect(castWith(SINISTER_STRIKE, false).gained).toBe(2);
    expect(castWith(SINISTER_STRIKE, true).gained).toBe(2);
  });
});

describe('Seal Fate banks its point on the TARGET', () => {
  it('still gives three on the FIRST cast of the fight, which it once did not', () => {
    /*
     * THE REGRESSION THIS FILE WAS ORIGINALLY WRITTEN FOR, now at three rather
     * than four. With nothing having claimed the target yet, the builder's own
     * award used to reset the pool and discard Seal Fate's point.
     */
    expect(castWith(MUTILATE, false).gained).toBe(3);
  });

  it('banks them where a finisher can spend them', () => {
    /*
     * Points held against nobody read as zero to `comboPointsOn`, and every
     * finisher checks that -- so the failure mode is not "fewer points" but "a
     * finisher that refuses to fire and looks like it lost its damage".
     */
    expect(castWith(MUTILATE, false).onTarget).toBe(3);
    expect(castWith(MUTILATE, true).onTarget).toBe(3);
  });
});
