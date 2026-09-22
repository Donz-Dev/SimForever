import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import {
  AbilityBook,
  DEFAULT_GCD_MS,
  MINIMUM_GCD_MS,
  castLength,
  dealDamage,
  gcdLength,
  seconds,
} from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

const SIMPLE_STRIKE: Ability = {
  id: 'simple_strike',
  name: 'Simple Strike',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 20 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'simple_strike',
      abilityName: 'Simple Strike',
      school: 'physical',
      baseAmount: 100,
    });
  },
};

const SLOW_BOLT: Ability = {
  id: 'slow_bolt',
  name: 'Slow Bolt',
  castTimeMs: seconds(2),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'slow_bolt',
      abilityName: 'Slow Bolt',
      school: 'fire',
      baseAmount: 500,
    });
  },
};

const TWO_CHARGES: Ability = {
  id: 'charged',
  name: 'Charged',
  cooldownMs: seconds(10),
  charges: 2,
  triggersGcd: false,
  requiresTarget: false,
  onCast: () => {
    /* no effect; this test is about charge accounting */
  },
};

function setUp(abilities: Ability[], rage = 100) {
  const attacker = makeAttacker({
    stats: { attackPower: 0 },
    resources: [{ type: 'rage', maximum: 100, initial: rage }],
    abilities,
  });
  const target = makeTarget({ maxHealth: 100_000 });
  const sim = buildSimulation([attacker, target], { durationMs: seconds(120) });
  sim.begin();
  return { attacker, target, sim };
}

describe('AbilityBook', () => {
  it('starts with every charge available', () => {
    const book = new AbilityBook([TWO_CHARGES]);
    expect(book.chargesAvailable('charged', 0)).toBe(2);
    expect(book.isReady('charged', 0)).toBe(true);
  });

  it('puts an ability on cooldown once used', () => {
    const book = new AbilityBook([SIMPLE_STRIKE]);
    expect(book.consumeCharge('simple_strike', 0)).toBe(true);

    expect(book.isReady('simple_strike', 0)).toBe(false);
    expect(book.cooldownRemaining('simple_strike', 0)).toBe(seconds(6));
    expect(book.cooldownRemaining('simple_strike', seconds(2))).toBe(seconds(4));
  });

  it('becomes ready again exactly when the cooldown elapses', () => {
    const book = new AbilityBook([SIMPLE_STRIKE]);
    book.consumeCharge('simple_strike', 0);

    expect(book.isReady('simple_strike', seconds(5.999))).toBe(false);
    expect(book.isReady('simple_strike', seconds(6))).toBe(true);
  });

  it('recharges charges one at a time', () => {
    const book = new AbilityBook([TWO_CHARGES]);

    book.consumeCharge('charged', 0);
    expect(book.chargesAvailable('charged', 0)).toBe(1);

    // Spending the second charge must not restart the first one's timer.
    book.consumeCharge('charged', seconds(2));
    expect(book.chargesAvailable('charged', seconds(2))).toBe(0);

    expect(book.chargesAvailable('charged', seconds(10))).toBe(1);
    expect(book.chargesAvailable('charged', seconds(20))).toBe(2);
  });

  it('refuses to consume a charge it does not have', () => {
    const book = new AbilityBook([SIMPLE_STRIKE]);
    book.consumeCharge('simple_strike', 0);
    expect(book.consumeCharge('simple_strike', seconds(1))).toBe(false);
  });

  it('resets a cooldown on demand', () => {
    const book = new AbilityBook([SIMPLE_STRIKE]);
    book.consumeCharge('simple_strike', 0);
    book.resetCooldown('simple_strike');
    expect(book.isReady('simple_strike', 0)).toBe(true);
  });

  it('treats an ability without a cooldown as always ready', () => {
    const book = new AbilityBook([{ id: 'free', name: 'Free', onCast: () => {} }]);
    book.consumeCharge('free', 0);
    expect(book.isReady('free', 0)).toBe(true);
  });
});

describe('haste applied to cast time, but NOT to the global cooldown', () => {
  it('leaves a cast unchanged without haste', () => {
    expect(castLength(SLOW_BOLT, 1)).toBe(seconds(2));
  });

  it('shortens a cast with haste', () => {
    expect(castLength(SLOW_BOLT, 1.25)).toBe(1600);
  });

  it('does not shorten the global cooldown with haste at all', () => {
    /*
     * The ruleset owner's ruling. `gcdLength` takes no haste multiplier now
     * -- its second argument is the CASTER'S base length -- so this is
     * asserted by the shape of the call as much as by the number.
     */
    expect(gcdLength(SIMPLE_STRIKE, DEFAULT_GCD_MS)).toBe(DEFAULT_GCD_MS);
    expect(gcdLength(SIMPLE_STRIKE)).toBe(DEFAULT_GCD_MS);
  });

  it('still has a floor, for a TALENT that shortens it', () => {
    // Not for haste, which no longer touches it. Improved Slam is the one
    // that reduces a global cooldown, and it needs something to stop at.
    expect(MINIMUM_GCD_MS).toBe(750);
  });

  it('reports an instant ability as zero cast time', () => {
    expect(castLength(SIMPLE_STRIKE, 1)).toBe(0);
  });
});

describe('casting', () => {
  it('pays the resource cost and deals damage', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE], 50);
    const health = target.health.current;

    const result = sim.cast(attacker, SIMPLE_STRIKE, target);

    expect(result.ok).toBe(true);
    expect(attacker.resources.require('rage').current).toBe(30);
    expect(target.health.current).toBe(health - 100);
  });

  it('starts the global cooldown', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE]);
    sim.cast(attacker, SIMPLE_STRIKE, target);
    expect(attacker.gcdReadyAt).toBe(DEFAULT_GCD_MS);
    expect(attacker.isOnGcd(0)).toBe(true);
    expect(attacker.isOnGcd(DEFAULT_GCD_MS)).toBe(false);
  });

  it('refuses when on cooldown', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE]);
    sim.cast(attacker, SIMPLE_STRIKE, target);
    sim.advanceTo(seconds(2));

    const result = sim.cast(attacker, SIMPLE_STRIKE, target);
    expect(result).toEqual({ ok: false, reason: 'on_cooldown' });
  });

  it('refuses when the resource is short, without spending anything', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE], 10);
    const result = sim.cast(attacker, SIMPLE_STRIKE, target);

    expect(result).toEqual({ ok: false, reason: 'not_enough_resource' });
    expect(attacker.resources.require('rage').current).toBe(10);
  });

  it('refuses while on the global cooldown', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE, TWO_CHARGES]);
    sim.cast(attacker, SIMPLE_STRIKE, target);

    const second: import('../../src/engine').Ability = { ...TWO_CHARGES, triggersGcd: true };
    attacker.abilities.add(second);
    expect(sim.cast(attacker, second, target)).toEqual({ ok: false, reason: 'on_gcd' });
  });

  it('refuses without a living target', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE]);
    expect(sim.cast(attacker, SIMPLE_STRIKE, undefined)).toEqual({
      ok: false,
      reason: 'invalid_target',
    });

    target.markDead();
    expect(sim.cast(attacker, SIMPLE_STRIKE, target)).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('honours an ability-specific condition', () => {
    const conditional: Ability = {
      ...SIMPLE_STRIKE,
      id: 'execute',
      name: 'Execute',
      cost: undefined,
      cooldownMs: 0,
      canCast: ({ target }) => (target?.health.fraction ?? 1) < 0.2,
    };
    const { attacker, target, sim } = setUp([conditional]);

    expect(sim.cast(attacker, conditional, target)).toEqual({
      ok: false,
      reason: 'condition_failed',
    });

    target.health.set(target.health.maximum * 0.1);
    expect(sim.cast(attacker, conditional, target).ok).toBe(true);
  });

  it('does not let a GCD-free ability start the GCD', () => {
    const { attacker, sim } = setUp([TWO_CHARGES]);
    sim.cast(attacker, TWO_CHARGES, undefined);
    expect(attacker.gcdReadyAt).toBe(0);
  });

  describe('with a cast time', () => {
    it('lands the effect only when the cast completes', () => {
      const { attacker, target, sim } = setUp([SLOW_BOLT]);
      const health = target.health.current;

      sim.cast(attacker, SLOW_BOLT, target);
      expect(target.health.current).toBe(health);
      expect(attacker.isCasting(0)).toBe(true);

      sim.advanceTo(seconds(1));
      expect(target.health.current).toBe(health);

      sim.advanceTo(seconds(2));
      expect(target.health.current).toBe(health - 500);
      expect(attacker.isCasting(seconds(2))).toBe(false);
    });

    it('refuses a second cast while one is in progress', () => {
      const { attacker, target, sim } = setUp([SLOW_BOLT]);
      sim.cast(attacker, SLOW_BOLT, target);
      sim.advanceTo(seconds(1));

      expect(sim.cast(attacker, SLOW_BOLT, target)).toEqual({
        ok: false,
        reason: 'already_casting',
      });
    });
  });

  it('emits cast and resource telemetry', () => {
    const { attacker, target, sim } = setUp([SIMPLE_STRIKE]);
    sim.cast(attacker, SIMPLE_STRIKE, target);

    expect(sim.recordedTelemetry).toContainEqual(
      expect.objectContaining({ type: 'cast', abilityId: 'simple_strike' }),
    );
    expect(sim.recordedTelemetry).toContainEqual(
      expect.objectContaining({ type: 'resource_spent', resource: 'rage', amount: 20 }),
    );
  });
});
