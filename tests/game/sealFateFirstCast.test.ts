import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { NO_CHANCES, ROLL_MAX, Simulation, castAbility, seconds } from '../../src/engine';
import type { AttackChances, Combatant } from '../../src/engine';
import { makeTarget } from '../helpers/actors';
import { comboPointsOn } from '../../src/game/combat/comboPoints';
import { MUTILATE, SINISTER_STRIKE } from '../../src/game/abilities/rogue';

/*
 * ==============================================================================
 * A BUILDER'S OWN POINTS MUST NOT WIPE THE ONES SEAL FATE JUST BANKED.
 *
 * `awardComboPoint` discards the pool when it is held against a DIFFERENT
 * target -- combo points live on the victim, so five on one enemy are worth
 * nothing the moment a builder lands on another. That rule is right, and it
 * reads `comboPointTargetId`, which only `awardComboPoint` ever sets.
 *
 * SEAL FATE FIRES FROM INSIDE `dealDamage`, so it banks its point BEFORE the
 * builder that critted has awarded its own -- and it used to bank through
 * `grantResource`, which does not claim the target. On the FIRST builder of a
 * fight nothing had claimed it yet, so the builder's own `awardComboPoint` saw
 * a mismatch and reset the pool to zero, taking Seal Fate's point with it.
 *
 * MUTILATE IS WHERE IT SHOWS WORST, because it crits twice and awards two: the
 * answer should be four and was two. Every builder lost one the same way.
 *
 * IT IS WORTH NO MEASURABLE DPS -- once a fight, and only when Seal Fate procs
 * on that first cast. That is exactly why it needed a test rather than a
 * measurement: the suite is the only thing that can see it.
 * ==============================================================================
 */

/** Every attack is a critical strike, so both hands of Mutilate crit. */
const alwaysCrit = (): AttackChances => ({ ...NO_CHANCES, crit: ROLL_MAX, critMultiplier: 2 });

function castWith(
  ability: typeof MUTILATE,
  claimTarget: boolean,
): { gained: number; onTarget: number } {
  const rogue = characterAtCombatStart(PRESETS_BY_ID.get('rogue_venom')!.build() as never)!;
  const target = makeTarget({ level: 63, stats: { armor: 0 } });

  const simulation = new Simulation({
    durationMs: seconds(60),
    seed: 1,
    createCombatants: () => [rogue, target],
    attackChances: alwaysCrit as never,
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

describe('Seal Fate on a builder that crits', () => {
  it('gives Mutilate FOUR points when both hands crit: two of its own, two from Seal Fate', () => {
    /*
     * The headline claim. Mutilate declares `comboPointsAwarded: 2` and deals
     * TWO damage events, so a double crit is two Seal Fate triggers.
     */
    expect(MUTILATE.comboPointsAwarded).toBe(2);
    expect(castWith(MUTILATE, true).gained).toBe(4);
  });

  it('gives four on the FIRST cast of the fight too, which it did not', () => {
    /*
     * THE REGRESSION THIS FILE EXISTS FOR. With nothing having claimed the
     * target yet, the builder's own award used to reset the pool and discard
     * both of Seal Fate's points -- four became two, once per fight, silently.
     */
    expect(castWith(MUTILATE, false).gained).toBe(4);
  });

  it('banks them ON THE TARGET, so a finisher can spend them', () => {
    /*
     * Points held against nobody read as zero to `comboPointsOn`, and every
     * finisher checks that -- so the failure mode is not "fewer points" but "a
     * finisher that refuses to fire and looks like it lost its damage".
     */
    expect(castWith(MUTILATE, false).onTarget).toBe(4);
    expect(castWith(MUTILATE, true).onTarget).toBe(4);
  });

  it('is not Mutilate-specific: a single-hit builder gets two', () => {
    // One of its own plus one from Seal Fate, first cast or not.
    expect(SINISTER_STRIKE.comboPointsAwarded).toBe(1);
    expect(castWith(SINISTER_STRIKE, false).gained).toBe(2);
    expect(castWith(SINISTER_STRIKE, true).gained).toBe(2);
  });
});
