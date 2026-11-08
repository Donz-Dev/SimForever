import { describe, expect, it } from 'vitest';
import { Simulation, castAbility } from '../../src/engine';
import { AIMED_SHOT, MULTI_SHOT, SNIPER_SHOT } from '../../src/game/abilities/hunter';
import { PRESETS_BY_ID } from '../../src/profiles';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ============================================================================
 * ROUND 92: "Aimed Shot cooldown starts AFTER cast completion", and the same of
 * Sniper Shot -- the owner's. The charge is still spent when the cast starts,
 * so the shot cannot be cast twice; what moves is when the cooldown RUNS FROM.
 * Asserted on a built LW Ranged Hunter, whose casts are hasted, so the
 * deferral has to be the cast actually taken rather than the declared one.
 * ============================================================================
 */

function hunterMidFight() {
  const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
  const simulation = new Simulation({ ...trainingDummyEncounter(profile), seed: 7 });
  simulation.begin();
  const hunter = simulation.combatants.find((actor) => actor.kind === 'player')!;
  return { simulation, hunter };
}

describe('a cooldown that starts on completion', () => {
  it('is declared on Aimed Shot and Sniper Shot, and not on the instant Multi-Shot', () => {
    expect(AIMED_SHOT.cooldownStartsOnCompletion).toBe(true);
    expect(SNIPER_SHOT.cooldownStartsOnCompletion).toBe(true);
    expect(MULTI_SHOT.cooldownStartsOnCompletion).toBeUndefined();
  });

  it.each([
    ['aimed_shot', AIMED_SHOT],
    ['sniper_shot', SNIPER_SHOT],
  ] as const)('runs %s from the end of the cast', (id, declared) => {
    const { simulation, hunter } = hunterMidFight();
    // Past the opener's cooldowns, so the shot is ready.
    simulation.advanceTo(20_000);
    hunter.abilities.resetCooldown(id);
    hunter.gcdReadyAt = 0;
    hunter.castEndsAt = 0;
    const now = simulation.clock.now();
    const target = simulation.defaultTargetFor(hunter)!;
    const result = castAbility(simulation, hunter, hunter.abilities.get(id)!, target);
    expect(result.ok, id).toBe(true);

    const castEnds = hunter.castEndsAt;
    expect(castEnds).toBeGreaterThan(now);
    // Cannot be cast again during its own cast, and the clock reads the full
    // cooldown from the END of it.
    expect(hunter.abilities.cooldownRemaining(id, now)).toBe(castEnds - now + declared.cooldownMs!);
  });

  it('moves the shared Multi-Shot lock with Aimed Shot', () => {
    const { simulation, hunter } = hunterMidFight();
    simulation.advanceTo(20_000);
    hunter.abilities.resetCooldown('aimed_shot');
    hunter.gcdReadyAt = 0;
    hunter.castEndsAt = 0;
    const now = simulation.clock.now();
    castAbility(simulation, hunter, hunter.abilities.get('aimed_shot')!, simulation.defaultTargetFor(hunter)!);
    if (!hunter.abilities.get('multi_shot')) return;
    expect(hunter.abilities.cooldownRemaining('multi_shot', now)).toBe(
      hunter.castEndsAt - now + AIMED_SHOT.cooldownMs!,
    );
  });
});
