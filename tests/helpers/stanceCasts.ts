import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { EXECUTE_PHASE_FRACTION } from '../../src/game/abilities/warrior';

const STANCE_CASTS = new Set(['battle_stance_cast', 'defensive_stance_cast', 'berserker_stance_cast']);

/**
 * Every STANCE CHANGE a profile casts IN THE FIGHT -- the pre-combat ones at the
 * pull are left out -- each with the share of the planned fight still left.
 *
 * ----------------------------------------------------------------------------
 * WHY A TIMESTAMP RATHER THAN A COUNT. The tank lists used to make no stance
 * change at all, and three tests said so by finding no `stance_change` rage row.
 * The owner's Execute clause makes them leave Defensive Stance on purpose in the
 * last 20% of the fight, so "none at all" is no longer the claim: the claim is
 * that every stance change is INSIDE that window. Only the event stream knows
 * where a cast landed.
 * ----------------------------------------------------------------------------
 */
export function inFightStanceCasts(
  profile: unknown,
  seed: number,
): readonly { readonly abilityId: string; readonly remainingFraction: number }[] {
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile as never, seed), {
    emit: (event) => events.push(event),
  });
  const run = simulation.run();
  const planned = run.plannedDurationMs;
  return events
    .filter(
      (event) =>
        event.type === 'cast' &&
        event.timestamp > 0 &&
        STANCE_CASTS.has((event as { abilityId: string }).abilityId),
    )
    .map((event) => ({
      abilityId: (event as { abilityId: string }).abilityId,
      remainingFraction: (planned - event.timestamp) / planned,
    }));
}

/** The stance changes cast BEFORE the tank execute window opened. */
export function stanceCastsOutsideExecute(profile: unknown, seeds: readonly number[]) {
  return seeds.flatMap((seed) =>
    inFightStanceCasts(profile, seed).filter(
      (cast) => cast.remainingFraction > EXECUTE_PHASE_FRACTION,
    ),
  );
}
