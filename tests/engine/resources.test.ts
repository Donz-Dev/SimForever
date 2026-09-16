import { describe, expect, it } from 'vitest';
import { Resource, ResourceCollection } from '../../src/engine';

describe('Resource', () => {
  it('starts full unless told otherwise', () => {
    expect(new Resource('mana', 1000).current).toBe(1000);
    expect(new Resource('rage', 100, 0).current).toBe(0);
  });

  it('reports deficit, fraction and the empty/full flags', () => {
    const resource = new Resource('mana', 1000, 250);
    expect(resource.deficit).toBe(750);
    expect(resource.fraction).toBe(0.25);
    expect(resource.isEmpty).toBe(false);
    expect(resource.isFull).toBe(false);

    resource.fill();
    expect(resource.isFull).toBe(true);
  });

  describe('spend', () => {
    it('deducts when affordable', () => {
      const resource = new Resource('rage', 100, 50);
      expect(resource.spend(20)).toBe(true);
      expect(resource.current).toBe(30);
    });

    it('is all-or-nothing when unaffordable', () => {
      // A half-paid ability cost is never correct, so the pool must not move.
      const resource = new Resource('rage', 100, 10);
      expect(resource.spend(20)).toBe(false);
      expect(resource.current).toBe(10);
    });

    it('allows spending exactly the remaining amount', () => {
      const resource = new Resource('rage', 100, 20);
      expect(resource.spend(20)).toBe(true);
      expect(resource.current).toBe(0);
    });

    it('rejects a negative amount', () => {
      expect(() => new Resource('rage', 100).spend(-5)).toThrow();
    });
  });

  describe('gain', () => {
    it('adds and reports nothing wasted below the cap', () => {
      const resource = new Resource('rage', 100, 10);
      expect(resource.gain(20)).toEqual({ gained: 20, wasted: 0 });
      expect(resource.current).toBe(30);
    });

    it('clamps at the cap and reports the overflow', () => {
      // The wasted portion is how the analysis layer reports rage capping.
      const resource = new Resource('rage', 100, 90);
      expect(resource.gain(25)).toEqual({ gained: 10, wasted: 15 });
      expect(resource.current).toBe(100);
    });
  });

  describe('drain', () => {
    it('floors at zero and reports what was actually removed', () => {
      const resource = new Resource('health', 1000, 300);
      expect(resource.drain(500)).toBe(300);
      expect(resource.current).toBe(0);
    });
  });

  it('keeps the current value inside a lowered maximum', () => {
    const resource = new Resource('health', 1000);
    resource.setMaximum(400);
    expect(resource.current).toBe(400);
    expect(resource.maximum).toBe(400);
  });

  it('clamps an out-of-range set', () => {
    const resource = new Resource('rage', 100, 50);
    resource.set(500);
    expect(resource.current).toBe(100);
    resource.set(-10);
    expect(resource.current).toBe(0);
  });
});

describe('ResourceCollection', () => {
  it('holds several pools at once', () => {
    const resources = new ResourceCollection([
      { type: 'mana', maximum: 1000 },
      { type: 'energy', maximum: 100 },
      { type: 'comboPoints', maximum: 5, initial: 0 },
    ]);

    expect(resources.types).toHaveLength(3);
    expect(resources.require('mana').current).toBe(1000);
    expect(resources.require('comboPoints').current).toBe(0);
  });

  it('reports affordability without a pool present', () => {
    const resources = new ResourceCollection([{ type: 'rage', maximum: 100, initial: 30 }]);
    expect(resources.canAfford('rage', 20)).toBe(true);
    expect(resources.canAfford('rage', 50)).toBe(false);
    expect(resources.canAfford('mana', 1)).toBe(false);
  });

  it('throws on require for a missing pool', () => {
    // A warrior asked for mana means a content bug, not a runtime condition.
    const resources = new ResourceCollection([{ type: 'rage', maximum: 100 }]);
    expect(resources.get('mana')).toBeUndefined();
    expect(() => resources.require('mana')).toThrow(/mana/);
  });
});
