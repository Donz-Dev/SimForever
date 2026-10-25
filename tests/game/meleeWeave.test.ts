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
 * THE HUNTER'S MELEE WEAVE (round 65), run end to end on the LW Ranged preset
 * with a list of two entries: the weave, and Arcane Shot under it -- so "nothing
 * else is cast while the weave runs" has something to refuse.
 *
 * Raptor Strike and Wing Clip are the weave's actions here rather than the
 * owner's default three, because Strider Kick is a Survival talent and Mongoose
 * Bite needs Expose Prey's window, and a Marksmanship build has neither: with
 * the default three it would never weave, which is the gate working (asserted
 * below). Wing Clip is the useful second action -- it is ON the global
 * cooldown where Raptor Strike rides a swing, so the routine has to wait.
 * ==============================================================================
 */

const ACTIONS = ['raptor_strike', 'wing_clip'] as const;

function weaving(actions?: readonly string[]): CharacterProfile {
  const preset = PRESETS_BY_ID.get('lw_ranged')!.build();
  return {
    ...preset,
    rotation: {
      source: 'custom',
      name: 'Weave test',
      entries: [
        { abilityId: MELEE_WEAVE_ID, ...(actions ? { weave: actions } : {}) },
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

function run(profile: CharacterProfile, durationSeconds = 30): Run {
  const events: TelemetryEvent[] = [];
  const restartTimers = new Map<number, number>();
  const simulation = new Simulation(trainingDummyEncounter(profile, 4242), { emit: (event) => events.push(event) });
  simulation.begin();
  const player = simulation.combatants.find((actor) => actor.kind === 'player') as Combatant;
  const runMs = player.abilities.get(MELEE_WEAVE_ID)!.castTimeMs!;
  for (let at = 0; at <= seconds(durationSeconds); at += 50) {
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

describe('the Melee Weave', () => {
  const { events, restartTimers } = run(weaving(ACTIONS));
  const weaves = casts(events, MELEE_WEAVE_ID);
  const returns = casts(events, RETURN_TO_RANGE_ID);
  const shots = hits(events, 'Ranged Auto-Attack');
  const runMs = meleeWeaveRunMs(false);
  /** The weaves whose run back also finished inside the fight. */
  const complete = weaves.filter((_start, index) => returns[index] !== undefined && returns[index]! + runMs < seconds(30));

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

  it('happens, and only just after a ranged shot', () => {
    expect(weaves.length).toBeGreaterThan(1);
    for (const at of weaves) {
      const last = shots.filter((shot) => shot <= at).at(-1);
      expect(last, `weave at ${at}`).toBeDefined();
      expect(at - last!, `weave at ${at}`).toBeLessThanOrEqual(MELEE_WEAVE_SHOT_WINDOW_MS);
    }
  });

  it('delivers Raptor Strike on the swing that lands as the run ends', () => {
    const raptors = hits(events, 'Raptor Strike');
    for (const at of complete) expect(raptors, `weave at ${at}`).toContain(at + runMs);
  });

  it('casts every action, then runs back, and nothing else is cast meanwhile', () => {
    expect(returns.length).toBeGreaterThanOrEqual(weaves.length - 1);
    weaves.forEach((start, index) => {
      const back = returns[index];
      if (back === undefined) return;
      const inside = events.filter(
        // After the cast that began it, so the pre-combat casts at 0 are not counted.
        (event) => event.type === 'cast' && event.timestamp > start && event.timestamp < back + runMs,
      );
      const ids = inside.map((event) => (event as { abilityId: string }).abilityId);
      expect(ids, `weave at ${start}`).toEqual(expect.arrayContaining([...ACTIONS]));
      expect(ids, `weave at ${start}`).not.toContain('arcane_shot');
    });
  });

  it('swings no melee weapon once back at range, and fires no shot while away', () => {
    weaves.forEach((start, index) => {
      const back = returns[index];
      if (back === undefined) return;
      const away = shots.filter((shot) => shot > start && shot < back + runMs);
      expect(away, `weave at ${start}`).toEqual([]);
    });
  });

  it('restarts the bow a full ranged swing plus half a second after the run back', () => {
    expect(restartTimers.size).toBeGreaterThan(0);
    for (const [end, timer] of restartTimers) {
      const next = shots.find((shot) => shot >= end);
      expect(next, `back at ${end}`).toBe(end + timer + RANGED_RESTART_DELAY_MS);
    }
  });

  it("never begins with the owner's three on a build that cannot Mongoose Bite", () => {
    expect(casts(run(weaving(), 20).events, MELEE_WEAVE_ID)).toEqual([]);
  });
});
