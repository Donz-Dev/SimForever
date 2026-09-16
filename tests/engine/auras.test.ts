import { describe, expect, it } from 'vitest';
import type { AuraDefinition } from '../../src/engine';
import { dealDamage, flat, percent, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

const MIGHT: AuraDefinition = {
  id: 'might',
  name: 'Might',
  durationMs: seconds(10),
  statModifiers: [flat('attackPower', 100), percent('strength', 0.1)],
};

const PERMANENT_STANCE: AuraDefinition = {
  id: 'stance',
  name: 'Stance',
  durationMs: 0,
  statModifiers: [percent('attackPower', 0.1)],
};

const STACKING_MARK: AuraDefinition = {
  id: 'mark',
  name: 'Mark',
  durationMs: seconds(10),
  maxStacks: 3,
  isDebuff: true,
  modifiersScaleWithStacks: true,
  statModifiers: [flat('armor', -100)],
};

const BLEED: AuraDefinition = {
  id: 'bleed',
  name: 'Bleed',
  durationMs: seconds(12),
  isDebuff: true,
  periodic: {
    intervalMs: seconds(3),
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target) return;
      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'physical',
        baseAmount: 10,
        periodic: true,
      });
    },
  },
};

function setUp() {
  const attacker = makeAttacker({ stats: { attackPower: 100, strength: 500 } });
  const target = makeTarget({ maxHealth: 100_000 });
  const sim = buildSimulation([attacker, target], { durationMs: seconds(120) });
  sim.begin();
  return { attacker, target, sim };
}

describe('AuraCollection', () => {
  describe('application', () => {
    it('applies stat modifiers on application', () => {
      const { attacker, sim } = setUp();
      expect(attacker.stats.get('attackPower')).toBe(100);

      sim.applyAura(attacker, MIGHT, attacker.id);

      expect(attacker.auras.has('might')).toBe(true);
      expect(attacker.stats.get('attackPower')).toBe(200);
      expect(attacker.stats.get('strength')).toBe(550);
    });

    it('emits an aura_applied event', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);
      expect(sim.recordedTelemetry).toContainEqual(
        expect.objectContaining({ type: 'aura_applied', auraId: 'might', stacks: 1 }),
      );
    });

    it('records the expected expiry time', () => {
      const { attacker, sim } = setUp();
      const aura = sim.applyAura(attacker, MIGHT, attacker.id);
      expect(aura.expiresAt).toBe(seconds(10));
      expect(aura.remainingMs(0)).toBe(seconds(10));
    });
  });

  describe('expiry', () => {
    it('removes stat modifiers when the aura falls off', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);

      sim.advanceTo(seconds(9));
      expect(attacker.stats.get('attackPower')).toBe(200);

      sim.advanceTo(seconds(11));
      expect(attacker.auras.has('might')).toBe(false);
      expect(attacker.stats.get('attackPower')).toBe(100);
      expect(attacker.stats.get('strength')).toBe(500);
    });

    it('emits an aura_removed event', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);
      sim.advanceTo(seconds(11));

      expect(sim.recordedTelemetry).toContainEqual(
        expect.objectContaining({ type: 'aura_removed', auraId: 'might' }),
      );
    });

    it('never expires a permanent aura', () => {
      const { attacker, sim } = setUp();
      const aura = sim.applyAura(attacker, PERMANENT_STANCE, attacker.id);
      expect(aura.isPermanent).toBe(true);

      sim.advanceTo(seconds(100));

      expect(attacker.auras.has('stance')).toBe(true);
      expect(attacker.stats.get('attackPower')).toBeCloseTo(110, 6);
    });

    it('can be removed early, cleaning up its modifiers', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);

      sim.advanceTo(seconds(2));
      attacker.auras.remove(sim, 'might');

      expect(attacker.auras.has('might')).toBe(false);
      expect(attacker.stats.get('attackPower')).toBe(100);

      // The cancelled expiry must not fire later and double-remove.
      sim.advanceTo(seconds(20));
      expect(attacker.stats.get('attackPower')).toBe(100);
    });
  });

  describe('refresh and stacks', () => {
    it('resets the duration on reapplication', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);

      sim.advanceTo(seconds(8));
      const refreshed = sim.applyAura(attacker, MIGHT, attacker.id);
      expect(refreshed.expiresAt).toBe(seconds(18));

      sim.advanceTo(seconds(12));
      expect(attacker.auras.has('might')).toBe(true);

      sim.advanceTo(seconds(19));
      expect(attacker.auras.has('might')).toBe(false);
    });

    it('does not duplicate stat modifiers on refresh', () => {
      const { attacker, sim } = setUp();
      sim.applyAura(attacker, MIGHT, attacker.id);
      sim.advanceTo(seconds(1));
      sim.applyAura(attacker, MIGHT, attacker.id);

      expect(attacker.stats.get('attackPower')).toBe(200);
    });

    it('stacks up to the maximum and scales modifiers with the stack count', () => {
      const { target, attacker, sim } = setUp();

      sim.applyAura(target, STACKING_MARK, attacker.id);
      expect(target.auras.stacksOf('mark')).toBe(1);
      expect(target.stats.get('armor')).toBe(-100);

      sim.applyAura(target, STACKING_MARK, attacker.id);
      expect(target.auras.stacksOf('mark')).toBe(2);
      expect(target.stats.get('armor')).toBe(-200);

      sim.applyAura(target, STACKING_MARK, attacker.id);
      sim.applyAura(target, STACKING_MARK, attacker.id);
      expect(target.auras.stacksOf('mark')).toBe(3); // capped
      expect(target.stats.get('armor')).toBe(-300);
    });

    it('reports zero stacks for an absent aura', () => {
      const { target } = setUp();
      expect(target.auras.stacksOf('mark')).toBe(0);
      expect(target.auras.remainingMs('mark', 0)).toBe(0);
    });
  });

  describe('periodic effects', () => {
    it('ticks on its interval', () => {
      const { attacker, target, sim } = setUp();
      sim.applyAura(target, BLEED, attacker.id);

      sim.advanceTo(seconds(2));
      expect(countTicks(sim)).toBe(0);

      sim.advanceTo(seconds(3));
      expect(countTicks(sim)).toBe(1);

      sim.advanceTo(seconds(9));
      expect(countTicks(sim)).toBe(3);
    });

    it('delivers the final tick at the moment it expires', () => {
      // 12s duration, 3s interval: ticks at 3, 6, 9 and 12. The 12s tick shares
      // a timestamp with the expiry and must not be swallowed by it.
      const { attacker, target, sim } = setUp();
      sim.applyAura(target, BLEED, attacker.id);

      sim.advanceTo(seconds(12));

      expect(countTicks(sim)).toBe(4);
      expect(target.auras.has('bleed')).toBe(false);
    });

    it('stops ticking after expiry', () => {
      const { attacker, target, sim } = setUp();
      sim.applyAura(target, BLEED, attacker.id);

      sim.advanceTo(seconds(30));
      expect(countTicks(sim)).toBe(4);
    });

    it('stops ticking when removed early', () => {
      const { attacker, target, sim } = setUp();
      sim.applyAura(target, BLEED, attacker.id);

      sim.advanceTo(seconds(4));
      expect(countTicks(sim)).toBe(1);

      target.auras.remove(sim, 'bleed');
      sim.advanceTo(seconds(30));

      expect(countTicks(sim)).toBe(1);
    });

    it('keeps ticking through a refresh that extends the duration', () => {
      const { attacker, target, sim } = setUp();
      sim.applyAura(target, BLEED, attacker.id);

      sim.advanceTo(seconds(6));
      sim.applyAura(target, BLEED, attacker.id); // resets to expire at 18s
      sim.advanceTo(seconds(18));

      // Ticks at 3, 6, then 9, 12, 15, 18 after the refresh.
      expect(countTicks(sim)).toBe(6);
    });

    it('reduces target health through its ticks', () => {
      const { attacker, target, sim } = setUp();
      const startingHealth = target.health.current;

      sim.applyAura(target, BLEED, attacker.id);
      sim.advanceTo(seconds(12));

      expect(target.health.current).toBe(startingHealth - 40);
    });
  });

  it('clears every aura when the carrier dies', () => {
    const { attacker, target, sim } = setUp();
    sim.applyAura(target, STACKING_MARK, attacker.id);
    expect(target.auras.size).toBe(1);

    dealDamage(sim, {
      source: attacker,
      target,
      abilityName: 'Finisher',
      school: 'physical',
      baseAmount: 1_000_000,
    });

    expect(target.auras.size).toBe(0);
  });
});

function countTicks(sim: ReturnType<typeof buildSimulation>): number {
  return sim.recordedTelemetry.filter(
    (event) => event.type === 'damage' && event.abilityId === 'bleed',
  ).length;
}
