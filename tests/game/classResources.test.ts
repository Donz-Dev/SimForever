import { describe, expect, it } from 'vitest';
import type { ResourceType } from '../../src/engine';
import type { ClassId } from '../../src/game/character';
import {
  CLASSES,
  CLASS_IDS,
  PLACEHOLDER_MAX_MANA,
  activeResourceFor,
  classUsesResource,
  fixedMaximumFor,
  formsFor,
  resourceSpecsFor,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';

/**
 * The resource each class runs on, written out independently of the source
 * data so that a change to the data has to be a deliberate change here too.
 */
const EXPECTED_PRIMARY: Record<ClassId, ResourceType> = {
  warrior: 'rage',
  rogue: 'energy',
  mage: 'mana',
  warlock: 'mana',
  shaman: 'mana',
  paladin: 'mana',
  priest: 'mana',
  hunter: 'mana',
  druid: 'mana', // caster form; see the Druid tests below
};

describe('class resources', () => {
  it('gives every class its primary resource', () => {
    for (const definition of CLASSES) {
      expect(definition.primaryResource, definition.name).toBe(
        EXPECTED_PRIMARY[definition.id],
      );
    }
  });

  it('gives every class at least one resource', () => {
    for (const id of CLASS_IDS) {
      expect(resourceSpecsFor(id).length, id).toBeGreaterThan(0);
    }
  });

  it('never lists health as a class resource', () => {
    // Health is on every Combatant already; repeating it per class would give
    // it two sources of truth.
    for (const definition of CLASSES) {
      expect(definition.resources, definition.name).not.toContain('health');
    }
  });

  it('always includes the primary resource in the pool list', () => {
    for (const definition of CLASSES) {
      expect(definition.resources, definition.name).toContain(definition.primaryResource);
    }
  });

  describe('fixed maximums', () => {
    it('caps rage and energy at 100', () => {
      expect(fixedMaximumFor('rage')).toBe(100);
      expect(fixedMaximumFor('energy')).toBe(100);
    });

    it('has no fixed maximum for mana', () => {
      // Mana scales with intellect and level, so a constant here would be an
      // invented number rather than a ruleset fact.
      expect(fixedMaximumFor('mana')).toBeUndefined();
    });
  });

  describe('starting values', () => {
    it('starts a warrior with no rage', () => {
      const rage = resourceSpecsFor('warrior').find((spec) => spec.type === 'rage');
      expect(rage).toMatchObject({ maximum: 100, initial: 0 });
    });

    it('starts a rogue with full energy', () => {
      const energy = resourceSpecsFor('rogue').find((spec) => spec.type === 'energy');
      expect(energy).toMatchObject({ maximum: 100, initial: 100 });
    });

    it('starts a mage with full mana', () => {
      const mana = resourceSpecsFor('mage').find((spec) => spec.type === 'mana');
      expect(mana).toMatchObject({
        maximum: PLACEHOLDER_MAX_MANA,
        initial: PLACEHOLDER_MAX_MANA,
      });
    });

    it('accepts an explicit mana maximum', () => {
      const mana = resourceSpecsFor('mage', 7500).find((spec) => spec.type === 'mana');
      expect(mana).toMatchObject({ maximum: 7500, initial: 7500 });
    });
  });

  describe('the Druid', () => {
    it('owns all three pools at once', () => {
      // A bear still has a mana pool it is not using. Creating the rage pool
      // only on shapeshift would mean conjuring state mid-fight.
      const types = resourceSpecsFor('druid').map((spec) => spec.type).sort();
      expect(types).toEqual(['energy', 'mana', 'rage']);
    });

    it('maps each form to its resource', () => {
      expect(activeResourceFor('druid', 'caster')).toBe('mana');
      expect(activeResourceFor('druid', 'moonkin')).toBe('mana');
      expect(activeResourceFor('druid', 'bear')).toBe('rage');
      expect(activeResourceFor('druid', 'cat')).toBe('energy');
    });

    it('defaults to mana with no form given', () => {
      expect(activeResourceFor('druid')).toBe('mana');
    });

    it('declares four forms', () => {
      expect(formsFor('druid').map((form) => form.id)).toEqual([
        'caster',
        'moonkin',
        'bear',
        'cat',
      ]);
    });

    it('starts with rage empty but mana and energy full', () => {
      const specs = resourceSpecsFor('druid');
      const byType = new Map(specs.map((spec) => [spec.type, spec]));

      expect(byType.get('rage')).toMatchObject({ initial: 0 });
      expect(byType.get('energy')).toMatchObject({ initial: 100 });
      expect(byType.get('mana')?.initial).toBe(PLACEHOLDER_MAX_MANA);
    });
  });

  describe('classes without forms', () => {
    it('ignores a form they do not have', () => {
      expect(activeResourceFor('warrior', 'bear')).toBe('rage');
      expect(activeResourceFor('mage', 'cat')).toBe('mana');
    });

    it('declares no forms', () => {
      for (const id of CLASS_IDS) {
        if (id === 'druid') continue;
        expect(formsFor(id), id).toHaveLength(0);
      }
    });
  });

  describe('classUsesResource', () => {
    it('answers per class', () => {
      expect(classUsesResource('warrior', 'rage')).toBe(true);
      expect(classUsesResource('warrior', 'mana')).toBe(false);
      expect(classUsesResource('druid', 'rage')).toBe(true);
      expect(classUsesResource('druid', 'energy')).toBe(true);
      expect(classUsesResource('rogue', 'rage')).toBe(false);
    });
  });
});

describe('createPlayer', () => {
  it('gives each class the right pools', () => {
    expect(createPlayer({ characterClass: 'warrior' }).resources.types).toEqual(['rage']);
    expect(createPlayer({ characterClass: 'rogue' }).resources.types).toEqual(['energy']);
    expect(createPlayer({ characterClass: 'mage' }).resources.types).toEqual(['mana']);
    // Copied before sorting: `types` is readonly, and sorting in place would
    // reorder the combatant's own resource list.
    expect([...createPlayer({ characterClass: 'druid' }).resources.types].sort()).toEqual([
      'energy',
      'mana',
      'rage',
    ]);
  });

  it('no longer hands a rage bar to everyone', () => {
    // Regression: createPlayer used to hard-code rage regardless of class.
    for (const id of CLASS_IDS) {
      const player = createPlayer({ characterClass: id });
      const expectsRage = id === 'warrior' || id === 'druid';
      expect(player.resources.has('rage'), id).toBe(expectsRage);
    }
  });

  it('gives every class health', () => {
    for (const id of CLASS_IDS) {
      const player = createPlayer({ characterClass: id });
      expect(player.health.maximum, id).toBeGreaterThan(0);
      expect(player.health.current, id).toBe(player.health.maximum);
    }
  });

  it('only gives the warrior abilities and a rotation for now', () => {
    const warrior = createPlayer({ characterClass: 'warrior' });
    expect(warrior.abilities.all.length).toBeGreaterThan(0);
    expect(warrior.rotation).toBeDefined();

    for (const id of CLASS_IDS) {
      if (id === 'warrior') continue;
      const player = createPlayer({ characterClass: id });
      expect(player.abilities.all, id).toHaveLength(0);
      expect(player.rotation, id).toBeUndefined();
    }
  });
});
