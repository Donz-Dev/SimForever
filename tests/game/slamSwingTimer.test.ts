import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { EventPriority, createEvent, seconds } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentsForClass } from '../../src/game/talents/talentData';
import { builtinCondition } from '../../src/game/rotations/apl/builtins';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * A WARRIOR AUTO-ATTACKS DURING A SLAM, AND IMPROVED SLAM IS WHAT BUYS IT.
 *
 * The ruleset owner: "the warrior is able to auto-attack during a slam cast
 * without it being suspended or paused but only if rank 1 or rank 2 improved
 * slam talent is taken." The same ruling the Hunter's three cast shots got,
 * reached through a TALENT rather than through the ability -- so without the
 * talent Slam still interrupts the swing and resets the timer.
 *
 * `hold` IS THE NEAR MISS AND IT IS WHAT WAS THERE. It stops the cast throwing
 * the swing away and then makes a swing that comes due DURING the cast wait for
 * the cast to end -- so the two modes agree on every cast shorter than what is
 * left of the swing cycle and differ exactly when a swing falls inside the
 * window. The client's own tooltip distinguishes them in two verbs: "Slam no
 * longer interrupts **or delays** your melee swing".
 * ==============================================================================
 */

const SLAM = 'slam';

/**
 * A two-handed Arms warrior, with the given Improved Slam rank.
 *
 * ------------------------------------------------------------------------------
 * `legalise` IS LOAD-BEARING. Improved Slam sits deep in Arms, so
 * `{ improved_slam: 1 }` is an ILLEGAL allocation -- and `createPlayer` strips
 * one of those in SILENCE, which reads as "the talent is worth nothing" rather
 * than as a broken fixture. Both rank cases came back `undefined` before this,
 * which is indistinguishable from the ruling not being implemented.
 * ------------------------------------------------------------------------------
 */
const warriorWith = (rank: number): Combatant =>
  createPlayer({
    race: 'orc',
    characterClass: 'warrior',
    combatStyle: 'two_hander',
    stance: 'battle',
    ...(rank > 0 ? { talents: legalise({ improved_slam: rank }) } : {}),
  });

describe('Improved Slam and the melee swing', () => {
  it('grants `continue` rather than `hold`', () => {
    const effects = WARRIOR_TALENT_EFFECTS.improved_slam.filter(
      (effect) => effect.kind === 'abilitySwingTimer',
    );
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ abilityId: SLAM, mode: 'continue' });
  });

  /*
   * THE OWNER SAID "RANK 1 OR RANK 2", WHICH IS THE WHOLE TALENT ONLY BECAUSE IT
   * HAS EXACTLY TWO RANKS. That equivalence is a fact about the TREE and not
   * about the ruling, and the effect is rank-blind on the strength of it -- so
   * if Forever ever adds a third rank, this fails and somebody has to ask
   * whether rank 3 grants it too rather than assuming.
   */
  it('has exactly two ranks, which is what makes the ruling rank-blind', () => {
    expect(talentsForClass('warrior')?.byId.get('improved_slam')?.ranks).toBe(2);
  });

  it('applies at BOTH ranks and at neither without the talent', () => {
    expect(warriorWith(0).abilities.get(SLAM)?.swingTimer).toBeUndefined();
    expect(warriorWith(1).abilities.get(SLAM)?.swingTimer).toBe('continue');
    expect(warriorWith(2).abilities.get(SLAM)?.swingTimer).toBe('continue');
  });

  it('reaches the 2H Arms preset, which is the one build that takes it', () => {
    const arms = characterAtCombatStart(PRESETS_BY_ID.get('two_hand_arms')!.build())!;
    expect(arms.abilities.get(SLAM)?.swingTimer).toBe('continue');
  });

  /*
   * ==========================================================================
   * THE APL BUILTIN THE ARMS LIST GATES SLAM ON, which asked `=== 'hold'` and
   * is named `ability_holds_swing_timer` with the description "does not cost a
   * swing". Against the narrow test this would have gone FALSE for the only
   * build that takes the talent and 2H Arms would have stopped casting Slam
   * entirely -- a DPS loss with nothing on the results page to explain it.
   * ==========================================================================
   */
  describe('the condition the Arms list gates Slam on', () => {
    const holdsSwing = (actor: Combatant): boolean =>
      builtinCondition('ability_holds_swing_timer', [SLAM])({} as never, actor, undefined);

    it('is true with the talent and false without it', () => {
      expect(holdsSwing(warriorWith(2))).toBe(true);
      expect(holdsSwing(warriorWith(0))).toBe(false);
    });

    it('answers the CONCEPT, so a `hold` ability would satisfy it too', () => {
      /*
       * Nothing declares `hold` today. Asserted anyway, because this condition
       * exists to ask "does the cast cost a swing" rather than "is it this one
       * mode" -- and a future talent granting hold must not read as resetting.
       */
      const plain = warriorWith(0);
      const slam = plain.abilities.get(SLAM)!;
      const held = { ...slam, swingTimer: 'hold' as const };
      expect(holdsSwing({ abilities: { get: () => held } } as unknown as Combatant)).toBe(true);
    });
  });

  /*
   * ==========================================================================
   * THE TIMINGS, END TO END. A scripted Slam at a moment chosen so a swing
   * comes due inside the cast, with and without the talent.
   *
   * THE CAST TIME DIFFERS BETWEEN THE ARMS, which is the trap in comparing
   * them: the same talent takes 0.5s off a 1.5s cast at rank 2. So the two
   * arms are NOT the same cast, and what is compared is each against its own
   * no-cast baseline rather than against each other.
   * ==========================================================================
   */
  describe('a fight with one scripted Slam', () => {
    /** When the main hand landed, with a Slam cast at `castAt` or not at all. */
    const swingTimes = (rank: number, castAt: number | null): number[] => {
      const warrior = warriorWith(rank);
      // NO ROTATION: a built combatant carries its list, and Slam is IN it.
      (warrior as { rotation?: unknown }).rotation = undefined;
      const simulation = buildSimulation([warrior, makeTarget()], {
        durationMs: seconds(12),
      });

      if (castAt !== null) {
        simulation.events.schedule(
          castAt,
          createEvent('slam', EventPriority.Decision, (ctx) => {
            // Rage: a warrior opens on an empty bar and Slam costs 15.
            warrior.resources.require('rage').gain(100);
            ctx.cast(warrior, warrior.abilities.get(SLAM)!, ctx.defaultTargetFor(warrior));
          }),
        );
      }

      const run = simulation.run();
      return run.telemetry
        .filter(
          (event: TelemetryEvent) =>
            event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack',
        )
        .map((event: TelemetryEvent) => event.timestamp);
    };

    /** A cast started so the next swing falls in the middle of it. */
    const castStartFor = (rank: number): number => {
      const warrior = warriorWith(rank);
      const cycle = warrior.weapons.mainHand!.swingTimerMs;
      return cycle - warrior.abilities.get(SLAM)!.castTimeMs! / 2;
    };

    it('casts the Slam in both arms, so neither comparison is vacuous', () => {
      for (const rank of [0, 2]) {
        const warrior = warriorWith(rank);
        (warrior as { rotation?: unknown }).rotation = undefined;
        const simulation = buildSimulation([warrior, makeTarget()], {
          durationMs: seconds(12),
        });
        simulation.events.schedule(
          castStartFor(rank),
          createEvent('slam', EventPriority.Decision, (ctx) => {
            warrior.resources.require('rage').gain(100);
            ctx.cast(warrior, warrior.abilities.get(SLAM)!, ctx.defaultTargetFor(warrior));
          }),
        );
        const casts = simulation
          .run()
          .telemetry.filter(
            (event: TelemetryEvent) => event.type === 'cast' && event.abilityId === SLAM,
          );
        expect(casts, `rank ${rank}`).toHaveLength(1);
      }
    });

    it('leaves the swing rhythm untouched WITH the talent', () => {
      expect(swingTimes(2, castStartFor(2))).toEqual(swingTimes(2, null));
    });

    it('costs a swing WITHOUT the talent, which is the control', () => {
      const without = swingTimes(0, null);
      const during = swingTimes(0, castStartFor(0));
      expect(during).not.toEqual(without);
      // The swing that was coming is pushed later, not merely reordered.
      expect(during[1]).toBeGreaterThan(without[1]!);
    });

    it('puts a swing inside the cast window, or the first case proves nothing', () => {
      const start = castStartFor(2);
      const end = start + warriorWith(2).abilities.get(SLAM)!.castTimeMs!;
      const inside = swingTimes(2, start).filter((at) => at > start && at < end);
      expect(inside).toHaveLength(1);
    });
  });
});
