import { describe, expect, it } from 'vitest';
import type { TelemetryEvent, WeaponProfile } from '../../src/engine';
import { RATING_PER_PERCENT, castAbility, seconds } from '../../src/engine';
import { VOLLEY, VOLLEY_TICKS } from '../../src/game/abilities/hunter';
import { QUIVER_RANGED_SPEED_DIVISOR } from '../../src/game/character/hunterRanged';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * THE OWNER'S 2026-11-15 RULING: "Ensure the Hunter skill Volley is not
 * affected by modifiers to haste. It's always a 6-sec channel that ticks every
 * 1 seconds for a total of 6 times."
 *
 * Driven on a Hunter carrying a lot of haste AND swing speed AND a quiver, so
 * a channel that any of them reached would end early and its ticks would
 * bunch up.
 */
const bow: WeaponProfile = {
  name: 'Bow',
  swingTimerMs: Math.round(3000 / QUIVER_RANGED_SPEED_DIVISOR),
  baseDamage: 100,
  speedMultiplier: QUIVER_RANGED_SPEED_DIVISOR,
};

describe('Volley ignores haste', () => {
  it('channels six seconds and ticks once a second, six times, however hasted', () => {
    const events: TelemetryEvent[] = [];
    const caster = makeAttacker({
      autoAttack: 'none',
      abilities: [VOLLEY],
      stats: {
        hasteRating: 30 * RATING_PER_PERCENT.haste,
        attackSpeedRating: 40 * RATING_PER_PERCENT.haste,
      },
      resources: [{ type: 'mana', maximum: 10_000 }],
      weapons: { ranged: bow },
    });
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('volley')!, target);
    expect(caster.castEndsAt).toBe(seconds(6));
    simulation.advanceTo(seconds(10));

    const ticks = events
      .filter((e) => e.type === 'damage' && e.abilityId === 'volley')
      .map((e) => e.timestamp);
    expect(VOLLEY_TICKS).toBe(6);
    expect(ticks).toEqual([1, 2, 3, 4, 5, 6].map((s) => seconds(s)));
  });
});
