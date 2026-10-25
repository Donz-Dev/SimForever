import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Simulation, applyHaste, hasteMultiplierFrom, seconds } from '../../src/engine';
import {
  MELEE_WEAVE_ID,
  MELEE_WEAVE_SHOT_WINDOW_MS,
  RANGED_RESTART_DELAY_MS,
  RETURN_TO_RANGE_ID,
  meleeWeaveRunMs,
} from '../../src/game/abilities/meleeWeave';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { foreverEnchantId } from '../../src/game/items/foreverEnchants';
import type { CharacterProfile } from '../../src/profiles/CharacterProfile';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * THE HUNTER'S MELEE WEAVE (round 65, revised in round 68), end to end on the
 * LW Ranged preset with a list of two entries: the weave, and Arcane Shot under
 * it -- so "nothing else is cast while the weave runs" has something to refuse.
 *
 * Round 68's process, the owner's: end of a ranged attack, run in, ANY ONE of
 * the options plus Raptor Strike if ready, run out, ranged restart half a
 * second before the shot -- with both swing timers cooling down while the
 * other kind runs.
 *
 * LW Ranged is Marksmanship, so of the owner's three options it knows only
 * Immolation Trap (a 30 second cooldown). Wing Clip, which has none, is what
 * the tests use where they want a weave on every shot.
 * ==============================================================================
 */

const DURATION_SECONDS = 60;

function weaving(options?: readonly string[]): CharacterProfile {
  const preset = PRESETS_BY_ID.get('lw_ranged')!.build();
  return {
    ...preset,
    rotation: {
      source: 'custom',
      name: 'Weave test',
      entries: [
        { abilityId: MELEE_WEAVE_ID, ...(options ? { weave: options } : {}) },
        { abilityId: 'arcane_shot' },
      ],
    },
  };
}

interface Run {
  readonly events: TelemetryEvent[];
  /** The ranged swing timer, hasted, as it stood when each Return to Range ended. */
  readonly restartTimers: Map<number, number>;
}

function run(profile: CharacterProfile): Run {
  const events: TelemetryEvent[] = [];
  const restartTimers = new Map<number, number>();
  const simulation = new Simulation(trainingDummyEncounter(profile, 4242), { emit: (event) => events.push(event) });
  simulation.begin();
  const player = simulation.combatants.find((actor) => actor.kind === 'player') as Combatant;
  const runMs = player.abilities.get(MELEE_WEAVE_ID)!.castTimeMs!;
  for (let at = 0; at <= seconds(DURATION_SECONDS); at += 50) {
    simulation.advanceTo(at);
    for (const event of events) {
      if (event.type !== 'cast' || event.abilityId !== RETURN_TO_RANGE_ID) continue;
      const end = event.timestamp + runMs;
      if (at === end && !restartTimers.has(end)) {
        const bow = player.weapons.ranged!;
        restartTimers.set(end, applyHaste(bow.swingTimerMs, hasteMultiplierFrom(player.stats.effective)));
      }
    }
  }
  return { events, restartTimers };
}

const casts = (events: readonly TelemetryEvent[], id: string) =>
  events.filter((event) => event.type === 'cast' && event.abilityId === id).map((event) => event.timestamp);
const hits = (events: readonly TelemetryEvent[], name: string) =>
  events
    .filter((event) => event.type === 'damage' && (event as { abilityName?: string }).abilityName === name)
    .map((event) => event.timestamp);

/** Each weave that also ran back inside the fight: start, return and its end. */
function weavesOf(events: readonly TelemetryEvent[]) {
  const runMs = meleeWeaveRunMs(false);
  const starts = casts(events, MELEE_WEAVE_ID);
  const returns = casts(events, RETURN_TO_RANGE_ID);
  return starts
    .map((start, index) => ({ start, back: returns[index], end: (returns[index] ?? Infinity) + runMs }))
    .filter((weave) => weave.back !== undefined && weave.end < seconds(DURATION_SECONDS));
}

/** The abilities cast between a weave's start and the end of its run back. */
function castInside(events: readonly TelemetryEvent[], weave: { start: number; end: number }): string[] {
  return events
    .filter((event) => event.type === 'cast' && event.timestamp > weave.start && event.timestamp < weave.end)
    .map((event) => (event as { abilityId: string }).abilityId);
}

describe('the Melee Weave', () => {
  const runMs = meleeWeaveRunMs(false);

  it('runs in one second, or 1 / 1.08 of one with Minor Speed on the boots', () => {
    expect(meleeWeaveRunMs(false)).toBe(1000);
    expect(meleeWeaveRunMs(true)).toBe(926);
    const preset = PRESETS_BY_ID.get('lw_ranged')!.build();
    const fast = createPlayer({
      ...preset.character,
      equipment: { ...preset.equipment, feet: { ...preset.equipment.feet!, enchantId: foreverEnchantId('Minor Speed') } },
    });
    expect(fast.abilities.get(MELEE_WEAVE_ID)!.castTimeMs).toBe(926);
    expect(fast.abilities.get(RETURN_TO_RANGE_ID)!.castTimeMs).toBe(926);
  });

  describe("with the owner's three, of which this build knows Immolation Trap", () => {
    const { events } = run(weaving());
    const weaves = weavesOf(events);
    const shots = hits(events, 'Ranged Auto-Attack');

    it('begins once ANY ONE option is ready, and only just after a ranged shot', () => {
      expect(weaves.length).toBeGreaterThan(0);
      for (const { start } of weaves) {
        const last = shots.filter((shot) => shot <= start).at(-1)!;
        expect(start - last, `weave at ${start}`).toBeLessThanOrEqual(MELEE_WEAVE_SHOT_WINDOW_MS);
      }
    });

    it('casts the option in melee and nothing else from the list', () => {
      for (const weave of weaves) {
        const ids = castInside(events, weave);
        expect(ids, `weave at ${weave.start}`).toContain('immolation_trap');
        expect(ids, `weave at ${weave.start}`).not.toContain('arcane_shot');
      }
    });
  });

  describe('with Wing Clip and Immolation Trap, both ready', () => {
    const { events, restartTimers } = run(weaving(['wing_clip', 'immolation_trap']));
    const weaves = weavesOf(events);
    const shots = hits(events, 'Ranged Auto-Attack');

    it('casts ONE option, the first that is ready', () => {
      expect(weaves.length).toBeGreaterThan(2);
      for (const weave of weaves) {
        const ids = castInside(events, weave);
        expect(ids.filter((id) => id === 'wing_clip'), `weave at ${weave.start}`).toHaveLength(1);
        expect(ids, `weave at ${weave.start}`).not.toContain('immolation_trap');
      }
    });

    it('delivers Raptor Strike on the arrival swing when it is ready', () => {
      const raptors = hits(events, 'Raptor Strike');
      expect(raptors).toContain(weaves[0]!.start + runMs);
      // Only in melee: every one inside a weave that finished in the fight.
      for (const at of raptors.filter((when) => when < weaves.at(-1)!.end)) {
        expect(weaves.some((weave) => at >= weave.start + runMs && at < weave.end), `Raptor Strike at ${at}`).toBe(true);
      }
    });

    it('runs back the instant the option and any Raptor Strike are done, not a global cooldown later', () => {
      const raptors = hits(events, 'Raptor Strike');
      const clips = casts(events, 'wing_clip');
      for (const weave of weaves) {
        const inside = (at: number) => at >= weave.start && at <= weave.back!;
        const done = Math.max(...clips.filter(inside), ...raptors.filter(inside));
        /*
         * WITHIN ONE POLL: a Raptor Strike waiting on a swing that lands mid-poll
         * is noticed at the next one, 100ms at most. A global cooldown would be
         * 1,500.
         */
        expect(weave.back! - done, `weave at ${weave.start}`).toBeGreaterThanOrEqual(0);
        expect(weave.back! - done, `weave at ${weave.start}`).toBeLessThan(100);
      }
    });

    it('fires no ranged shot while away', () => {
      for (const weave of weaves) {
        expect(shots.filter((shot) => shot > weave.start && shot < weave.end), `weave at ${weave.start}`).toEqual([]);
      }
    });

    it('restarts the bow half a second after the run back, or when its own timer has run out', () => {
      expect(restartTimers.size).toBeGreaterThan(2);
      for (const [end, timer] of restartTimers) {
        const last = shots.filter((shot) => shot < end).at(-1)!;
        const next = shots.find((shot) => shot >= end);
        expect(next, `back at ${end}`).toBe(Math.max(end + RANGED_RESTART_DELAY_MS, last + timer));
      }
    });

    it('is sooner than round 65 restart of a full swing plus half a second: the timer cooled while away', () => {
      const early = [...restartTimers].filter(([end, timer]) => {
        const next = shots.find((shot) => shot >= end)!;
        return next < end + timer + RANGED_RESTART_DELAY_MS;
      });
      expect(early.length).toBeGreaterThan(0);
    });
  });

  it('never begins when none of its options can be cast', () => {
    // Mongoose Bite needs Expose Prey's window, which a Marksmanship build never opens.
    expect(casts(run(weaving(['mongoose_bite'])).events, MELEE_WEAVE_ID)).toEqual([]);
  });

  it('begins when one option is ready though another never is', () => {
    expect(casts(run(weaving(['mongoose_bite', 'immolation_trap'])).events, MELEE_WEAVE_ID).length).toBeGreaterThan(0);
  });
});
