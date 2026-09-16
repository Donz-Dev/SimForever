import { describe, expect, it } from 'vitest';
import {
  StatBlock,
  bindModifiers,
  flat,
  makeStats,
  percent,
  percentMultiplicative,
} from '../../src/engine';

describe('StatBlock', () => {
  it('reports base stats when nothing is modifying them', () => {
    const stats = new StatBlock({ strength: 500, attackPower: 100 });
    expect(stats.get('strength')).toBe(500);
    expect(stats.get('attackPower')).toBe(100);
    expect(stats.get('agility')).toBe(0);
  });

  describe('modifiers', () => {
    it('applies a flat bonus', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([flat('strength', 200)], 'trinket'));
      expect(stats.get('strength')).toBe(700);
    });

    it('applies a percentage bonus', () => {
      // The worked example from the design: 500 base, +10%, 550 effective.
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'buff'));
      expect(stats.get('strength')).toBe(550);
    });

    it('adds same-bucket percentages together, not multiplicatively', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'buff_a'));
      stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'buff_b'));
      expect(stats.get('strength')).toBe(600); // 500 * 1.20, not 500 * 1.1 * 1.1
    });

    it('multiplies independent percentages separately', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([percentMultiplicative('strength', 0.1)], 'a'));
      stats.addModifiers(bindModifiers([percentMultiplicative('strength', 0.1)], 'b'));
      expect(stats.get('strength')).toBeCloseTo(605, 6); // 500 * 1.1 * 1.1
    });

    it('applies flat bonuses before percentages', () => {
      // A +200 trinket must be amplified by a +10% buff, not added after it.
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([flat('strength', 200)], 'trinket'));
      stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'buff'));
      expect(stats.get('strength')).toBeCloseTo(770, 6); // (500 + 200) * 1.1
    });

    it('leaves other stats untouched', () => {
      const stats = new StatBlock({ strength: 500, agility: 300 });
      stats.addModifiers(bindModifiers([percent('strength', 0.5)], 'buff'));
      expect(stats.get('agility')).toBe(300);
    });
  });

  describe('removal', () => {
    it('restores the original value when a buff is removed', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'buff'));
      expect(stats.get('strength')).toBe(550);

      stats.removeModifiersFrom('buff');
      expect(stats.get('strength')).toBe(500);
    });

    it('removes every modifier from one source and only that source', () => {
      const stats = new StatBlock({ strength: 500, agility: 500 });
      stats.addModifiers(
        bindModifiers([percent('strength', 0.1), percent('agility', 0.1)], 'buff_a'),
      );
      stats.addModifiers(bindModifiers([percent('strength', 0.2)], 'buff_b'));

      stats.removeModifiersFrom('buff_a');

      expect(stats.get('strength')).toBe(600); // buff_b survives
      expect(stats.get('agility')).toBe(500);
    });

    it('never corrupts the base stats, however many buffs come and go', () => {
      const stats = new StatBlock({ strength: 500 });

      for (let i = 0; i < 100; i++) {
        stats.addModifiers(bindModifiers([percent('strength', 0.1), flat('strength', 50)], `buff_${i}`));
      }
      for (let i = 0; i < 100; i++) {
        stats.removeModifiersFrom(`buff_${i}`);
      }

      expect(stats.get('strength')).toBe(500);
      expect(stats.baseStats.strength).toBe(500);
    });

    it('ignores removal of an unknown source', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.removeModifiersFrom('never_applied');
      expect(stats.get('strength')).toBe(500);
    });

    it('clears everything at once', () => {
      const stats = new StatBlock({ strength: 500 });
      stats.addModifiers(bindModifiers([percent('strength', 1)], 'a'));
      stats.addModifiers(bindModifiers([percent('strength', 1)], 'b'));
      stats.clearModifiers();
      expect(stats.get('strength')).toBe(500);
      expect(stats.activeModifiers).toHaveLength(0);
    });
  });

  it('invalidates its cache when modifiers change', () => {
    const stats = new StatBlock({ strength: 100 });
    expect(stats.get('strength')).toBe(100); // populates the cache

    stats.addModifier({ sourceId: 'x', stat: 'strength', operation: 'flat', value: 50 });
    expect(stats.get('strength')).toBe(150);

    stats.removeModifiersFrom('x');
    expect(stats.get('strength')).toBe(100);
  });
});

describe('makeStats', () => {
  it('fills unspecified stats with zero', () => {
    const stats = makeStats({ strength: 10 });
    expect(stats.strength).toBe(10);
    expect(stats.intellect).toBe(0);
    expect(stats.armor).toBe(0);
  });
});
