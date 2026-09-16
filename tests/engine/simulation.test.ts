import { describe, expect, it } from 'vitest';
import { EventPriority, createEvent, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

describe('Simulation', () => {
  it('runs to the configured duration and reports why it ended', () => {
    const sim = buildSimulation([makeAttacker(), makeTarget()], {
      durationMs: seconds(30),
    });

    const run = sim.run();

    expect(run.elapsedMs).toBe(seconds(30));
    expect(run.endReason).toBe('duration_expired');
  });

  it('brackets the fight with combat_start and combat_end telemetry', () => {
    const sim = buildSimulation([makeAttacker(), makeTarget()], { durationMs: seconds(10) });
    const run = sim.run();

    expect(run.telemetry[0]).toMatchObject({ type: 'combat_start', timestamp: 0 });
    expect(run.telemetry[run.telemetry.length - 1]).toMatchObject({
      type: 'combat_end',
      timestamp: seconds(10),
    });
  });

  it('executes scheduled events in chronological order', () => {
    const order: number[] = [];
    const attacker = makeAttacker();
    const target = makeTarget();
    const sim = buildSimulation([attacker, target], {
      durationMs: seconds(20),
      onCombatStart: (context) => {
        for (const time of [seconds(7), seconds(1), seconds(12), seconds(3)]) {
          context.scheduleAt(
            time,
            createEvent('probe', EventPriority.CastComplete, (ctx) => {
              order.push(ctx.clock.now());
            }),
          );
        }
      },
    });

    sim.run();

    expect(order).toEqual([seconds(1), seconds(3), seconds(7), seconds(12)]);
  });

  it('stops as soon as the last enemy dies', () => {
    const attacker = makeAttacker();
    const target = makeTarget({ maxHealth: 100 });
    const sim = buildSimulation([attacker, target], {
      durationMs: seconds(300),
      onCombatStart: (context) => {
        context.scheduleAt(
          seconds(5),
          createEvent('execute', EventPriority.CastComplete, (ctx) => {
            ctx.killCombatant(target, attacker);
          }),
        );
      },
    });

    const run = sim.run();

    expect(run.endReason).toBe('all_enemies_dead');
    expect(run.elapsedMs).toBe(seconds(5));
  });

  it('applies opening buffs before any event fires', () => {
    const attacker = makeAttacker();
    const sim = buildSimulation([attacker, makeTarget()], {
      durationMs: seconds(5),
      onCombatStart: (context) => {
        context.applyAura(
          attacker,
          { id: 'opener', name: 'Opener', durationMs: 0 },
          attacker.id,
        );
      },
    });

    sim.run();

    expect(attacker.auras.has('opener')).toBe(true);
  });

  it('gives each combatant a snapshot in the result', () => {
    const sim = buildSimulation([makeAttacker(), makeTarget({ maxHealth: 5000 })], {
      durationMs: seconds(5),
    });

    const run = sim.run();

    expect(run.actors).toHaveLength(2);
    expect(run.actors[0]).toMatchObject({ id: 'attacker', kind: 'player', faction: 'friendly' });
    expect(run.actors[1]).toMatchObject({
      id: 'target',
      faction: 'hostile',
      maxHealth: 5000,
      isAlive: true,
    });
  });

  it('rejects duplicate combatant ids', () => {
    expect(() => buildSimulation([makeAttacker(), makeAttacker()])).toThrow(/Duplicate/);
  });

  describe('advanceTo', () => {
    it('stops at the requested time with the clock parked there', () => {
      const sim = buildSimulation([makeAttacker(), makeTarget()], {
        durationMs: seconds(60),
      });

      sim.advanceTo(seconds(10));
      expect(sim.clock.now()).toBe(seconds(10));
      expect(sim.hasEnded).toBe(false);
    });

    it('runs only the events up to that point', () => {
      const fired: number[] = [];
      const sim = buildSimulation([makeAttacker(), makeTarget()], {
        durationMs: seconds(60),
        onCombatStart: (context) => {
          for (const time of [seconds(5), seconds(15)]) {
            context.scheduleAt(
              time,
              createEvent('probe', EventPriority.CastComplete, (ctx) => {
                fired.push(ctx.clock.now());
              }),
            );
          }
        },
      });

      sim.advanceTo(seconds(10));
      expect(fired).toEqual([seconds(5)]);

      sim.advanceTo(seconds(20));
      expect(fired).toEqual([seconds(5), seconds(15)]);
    });
  });

  describe('determinism', () => {
    it('produces an identical telemetry stream for the same seed', () => {
      const run = (seed: number) =>
        buildSimulation(
          [
            makeAttacker({
              weapons: {
                mainHand: {
                  name: 'Test Weapon',
                  swingTimerMs: 2000,
                  baseDamage: 100,
                  damageVariance: 0.3,
                },
              },
              autoAttack: 'main-hand',
              stats: { attackPower: 100, critRating: 5000 },
            }),
            makeTarget({ maxHealth: 1_000_000 }),
          ],
          { durationMs: seconds(60), seed },
        ).run();

      expect(run(4242).telemetry).toEqual(run(4242).telemetry);
    });

    it('produces a different stream for a different seed', () => {
      const run = (seed: number) =>
        buildSimulation(
          [
            makeAttacker({
              weapons: {
                mainHand: { name: 'Test Weapon', swingTimerMs: 2000, baseDamage: 100 },
              },
              autoAttack: 'main-hand',
              stats: { attackPower: 100, critRating: 5000 },
            }),
            makeTarget({ maxHealth: 1_000_000 }),
          ],
          { durationMs: seconds(60), seed },
        ).run();

      expect(run(1).telemetry).not.toEqual(run(2).telemetry);
    });
  });

  describe('duration variance', () => {
    it('keeps the exact duration when variance is zero', () => {
      const sim = buildSimulation([makeAttacker(), makeTarget()], {
        durationMs: seconds(100),
        durationVariance: 0,
      });
      expect(sim.run().plannedDurationMs).toBe(seconds(100));
    });

    it('varies the duration within the configured band', () => {
      const durations = Array.from({ length: 50 }, (_unused, index) =>
        buildSimulation([makeAttacker(), makeTarget()], {
          durationMs: seconds(100),
          durationVariance: 0.1,
          seed: index + 1,
        }).run().plannedDurationMs,
      );

      for (const duration of durations) {
        expect(duration).toBeGreaterThanOrEqual(seconds(90));
        expect(duration).toBeLessThanOrEqual(seconds(110));
      }
      expect(new Set(durations).size).toBeGreaterThan(1);
    });
  });

  it('throws rather than hanging if an event reschedules itself without advancing time', () => {
    const sim = buildSimulation([makeAttacker(), makeTarget()], {
      durationMs: seconds(60),
      onCombatStart: (context) => {
        const loop = createEvent('runaway', EventPriority.CastComplete, (ctx) => {
          ctx.schedule(0, loop);
        });
        context.schedule(0, loop);
      },
    });

    expect(() => sim.run()).toThrow(/rescheduling itself/);
  });
});
