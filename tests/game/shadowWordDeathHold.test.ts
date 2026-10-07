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
   * THE BAND IS ONE COOLDOWN WIDE, which is why it is 35 and not some other
   * number. A cast let through at 34% remaining would still be on cooldown when
   * the window opened -- the exact thing the hold exists to prevent. The two
   * numbers look independent and are not, so moving the cooldown fails here
   * rather than silently putting the hold in the wrong place.
   */
  it('is one Shadow Word: Death cooldown wide against a 100-second fight', () => {
    const bandFraction = SHADOW_WORD_DEATH_HOLD_FRACTION - EARLY_DEMISE_FRACTION;
    expect(bandFraction * seconds(100)).toBeCloseTo(SHADOW_WORD_DEATH.cooldownMs!, 6);
  });

  it('is in the list, ungated except for the hold', () => {
    const entry = PRIEST_SHADOW.find((e) => e.abilityId === 'shadow_word_death');
    expect(entry).toBeDefined();
    expect(entry!.condition).toBeDefined();
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

  it('NEVER casts it inside the hold band', () => {
    const inBand = all.filter(
      (remaining) =>
        remaining <= SHADOW_WORD_DEATH_HOLD_FRACTION && remaining > EARLY_DEMISE_FRACTION,
    );
    expect(inBand).toEqual([]);
  });

  /*
   * AND THE HOLD IS NOT A BAN. The entry must still fire inside the window it
   * was held for, or the condition has turned a cast into nothing -- which
   * would read on the results page as a slightly worse list and nothing else.
   */
  it('fires inside the window it was held for', () => {
    const inWindow = all.filter((remaining) => remaining <= EARLY_DEMISE_FRACTION);
    expect(inWindow.length).toBeGreaterThanOrEqual(SEEDS);
  });

  it('still fires freely before the band', () => {
    const early = all.filter((remaining) => remaining > SHADOW_WORD_DEATH_HOLD_FRACTION);
    expect(early.length).toBeGreaterThan(SEEDS);
  });
});
