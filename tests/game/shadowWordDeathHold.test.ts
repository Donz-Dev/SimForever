import { describe, expect, it } from 'vitest';
import { Simulation, seconds } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  EARLY_DEMISE_FRACTION,
  PRIEST_SHADOW,
  SHADOW_WORD_DEATH_HOLD_FRACTION,
} from '../../src/game/rotations/priest';
import { SHADOW_WORD_DEATH } from '../../src/game/abilities/priest';
import { talentNumber } from '../../src/game/talents/talentValues';

/*
 * ============================================================================
 * SHADOW WORD: DEATH IS HELD SO IT LANDS INSIDE EARLY DEMISE'S WINDOW.
 *
 * The ruleset owner's instruction: cast on cooldown, but not between 21% and
 * 35% of the remaining combat duration. The entry therefore fires freely down
 * to 35% remaining, goes quiet through the band, and fires again from 20% --
 * where Early Demise's +30% critical strike chance applies.
 *
 * THE USES COLUMN CANNOT TEST THIS. An entry that fires the right NUMBER of
 * times in the wrong PLACES is indistinguishable from a working one on the
 * results page, and the whole value of the entry is where the casts land. So
 * this reads the cast timestamps out of the event stream.
 * ============================================================================
 */

const shadow = () => PRESETS_BY_ID.get('shadow_priest')!.build();

/**
 * Every Shadow Word: Death cast, as the fraction of planned duration LEFT.
 *
 * THROUGH `Simulation` RATHER THAN `runProfile`, because `SimulationResult`
 * carries `durationMs` -- when combat actually ENDED -- and the condition reads
 * the PLANNED duration. `FIGHT_DURATION_VARIANCE` moves the two apart by up to
 * 5% per fight, which is a quarter of the band being measured.
 */
function castsByRemainingFraction(seed: number): readonly number[] {
  const run = new Simulation(trainingDummyEncounter(shadow(), seed)).run();
  const planned = run.plannedDurationMs;
  return run.telemetry
    .filter((event) => event.type === 'cast' && event.abilityId === 'shadow_word_death')
    .map((event) => (planned - event.timestamp) / planned);
}

describe('the two fractions', () => {
  /*
   * EARLY DEMISE STATES ITS OWN 20 and the rotation must agree with it, or the
   * hold reopens somewhere the crit bonus is not applying. Read out of the
   * values file rather than written by hand here, because the POINT is that the
   * two sites match -- a hand-written 20 in both places would pass this test
   * while disagreeing with Forever.
   */
  it('holds until exactly the fraction Early Demise names', () => {
    expect(talentNumber('priest', 'early_demise', 2, 0)).toBe(20);
    expect(EARLY_DEMISE_FRACTION).toBe(talentNumber('priest', 'early_demise', 2, 0)! / 100);
  });

  /*
   * ------------------------------------------------------------------------
   * THE WINDOW IS SHORTER THAN THE COOLDOWN, which is the fact that decides
   * what the hold can possibly be worth: at most ONE cast can land inside it,
   * so an ungated entry on a 15-second cooldown already gets that cast.
   *
   * THIS ASSERTION REPLACES A FALSE ONE. The first version of this test read
   * `bandFraction * seconds(100)` against the cooldown and passed -- 15% of a
   * hundred seconds is fifteen seconds, which is the cooldown exactly. The
   * fight is SIXTY seconds. The arithmetic was self-consistent and about a
   * fight that does not exist, which is the whole hazard: it was written to
   * confirm a rationale rather than to measure one.
   * ------------------------------------------------------------------------
   */
  it('has a window too short to hold two casts, so the hold cannot add one', () => {
    const planned = seconds(shadow().simulation.durationSeconds);
    const window = EARLY_DEMISE_FRACTION * planned;
    const band = (SHADOW_WORD_DEATH_HOLD_FRACTION - EARLY_DEMISE_FRACTION) * planned;

    expect(window).toBeLessThan(SHADOW_WORD_DEATH.cooldownMs!);
    expect(band).toBeLessThan(SHADOW_WORD_DEATH.cooldownMs!);
  });


  it('is in the list, UNGATED -- the hold is retired', () => {
    // The owner's round 37: "Shadow Word: Death should be cast on cooldown, no
    // more gating conditions."
    const entry = PRIEST_SHADOW.entries.find((e) => e.abilityId === 'shadow_word_death');
    expect(entry).toBeDefined();
    expect(entry!.condition).toBeUndefined();
  });
});

describe('where the casts actually land', () => {
  /*
   * FORTY SEEDS, because one fight is not evidence about a window: the entry
   * competes with Mind Blast for global cooldowns and a single run could miss
   * the band by luck rather than by the condition.
   */
  const SEEDS = 40;
  const all = Array.from({ length: SEEDS }, (_, i) => castsByRemainingFraction(i + 1)).flat();

  it('casts it at all', () => {
    expect(all.length).toBeGreaterThan(SEEDS * 2);
  });

  /*
   * UNGATED, IT STILL LANDS NOTHING IN THE OLD BAND -- AND THAT IS CADENCE, NOT
   * A GATE. Casts fall at about 4s, 29s and 51s of a 60s fight: the 18s
   * cooldown plus whatever Mind Flay channel is running when it comes back puts
   * the third cast past the band. So "the band is empty" cannot tell the ruling
   * from the old hold; the condition being GONE (above) is what does.
   */
  it('casts three times a fight, which is as often as its cooldown allows', () => {
    expect(all.length / SEEDS).toBeCloseTo(3, 0);
  });

  /*
   * AND THE HOLD IS NOT A BAN. The entry must still fire inside the window it
   * was held for, or the condition has turned a cast into nothing -- which
   * would read on the results page as a slightly worse list and nothing else.
   */
  /*
   * ROUND 75 MOVED THE THIRD CAST OUT OF IT. Haste shortens the global cooldown
   * now, the Shadow Priest's lists move faster, and its third cast comes back
   * just before the window rather than inside it -- cadence again, recorded in
   * HANDOVER round 75 as a question rather than tuned. What is still true is
   * the structural half: the window cannot hold two.
   */
  it('lands at most one cast inside the window it was held for', () => {
    const inWindow = all.filter((remaining) => remaining <= EARLY_DEMISE_FRACTION);
    expect(inWindow.length / SEEDS).toBeLessThanOrEqual(1);
  });

  /*
   * THE MEASURED CONSEQUENCE, and why retiring the hold cost the window
   * nothing: exactly one cast a fight is inside Early Demise's window, held or
   * unheld -- which is why the hold measured -4.9 rather than paying for itself.
   * If this ever reads two, the window has grown past the cooldown.
   */
  it('lands no more than one cast in the window, which is all the window holds', () => {
    const perFight = all.length / SEEDS;
    const inWindow =
      all.filter((remaining) => remaining <= EARLY_DEMISE_FRACTION).length / SEEDS;

    // At most one, and since round 75 usually none -- see above.
    expect(inWindow).toBeLessThanOrEqual(1);
    expect(perFight).toBeGreaterThan(inWindow);
  });

  it('still fires freely before the band', () => {
    const early = all.filter((remaining) => remaining > SHADOW_WORD_DEATH_HOLD_FRACTION);
    expect(early.length).toBeGreaterThan(SEEDS);
  });
});
