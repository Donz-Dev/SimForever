import { describe, expect, it } from 'vitest';
import type { ResourceType } from '../../src/engine';
import type { ClassId, CombatStyleId } from '../../src/game/character';
import {
  CLASSES,
  CLASS_IDS,
  activeResourceFor,
  baseManaFor,
  classUsesResource,
  fixedMaximumFor,
  formsFor,
  racesForClass,
  resourceSpecsFor,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';

/** The first race that can play a class, so each class can be instantiated. */
function anyRaceFor(characterClass: ClassId) {
  const race = racesForClass(characterClass)[0];
  if (!race) throw new Error(`No race can play ${characterClass}`);
  return race.id;
}

/** Build a player of a class, on whichever race happens to allow it. */
function player(characterClass: ClassId, combatStyle?: CombatStyleId) {
  return createPlayer({ race: anyRaceFor(characterClass), characterClass, combatStyle });
}

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
      expect(resourceSpecsFor(id, baseManaFor(anyRaceFor(id), id)).length, id).toBeGreaterThan(0);
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
      const rage = resourceSpecsFor('warrior', baseManaFor(anyRaceFor('warrior'), 'warrior')).find((spec) => spec.type === 'rage');
      expect(rage).toMatchObject({ maximum: 100, initial: 0 });
    });

    it('starts a rogue with full energy', () => {
      const energy = resourceSpecsFor('rogue', baseManaFor(anyRaceFor('rogue'), 'rogue')).find((spec) => spec.type === 'energy');
      expect(energy).toMatchObject({ maximum: 100, initial: 100 });
    });

    it('starts a mage with full mana, from the base stats table', () => {
      // Human Mage base mana is 933 in the spreadsheet.
      const mana = resourceSpecsFor('mage', baseManaFor('human', 'mage')).find(
        (spec) => spec.type === 'mana',
      );
      expect(mana).toMatchObject({ maximum: 933, initial: 933 });
    });

    it('accepts an explicit mana maximum', () => {
      const mana = resourceSpecsFor('mage', 7500).find((spec) => spec.type === 'mana');
      expect(mana).toMatchObject({ maximum: 7500, initial: 7500 });
    });
  });

  describe('the Druid', () => {
    it('owns all four pools at once', () => {
      /*
       * A bear still has a mana pool it is not using. Creating the rage pool
       * only on shapeshift would mean conjuring state mid-fight, and the same
       * argument added COMBO POINTS: only Cat Form builds them, and a druid
       * who shifts into Cat must not have to grow the pool on the way in.
       */
      const types = resourceSpecsFor('druid', baseManaFor(anyRaceFor('druid'), 'druid')).map((spec) => spec.type).sort();
      expect(types).toEqual(['comboPoints', 'energy', 'mana', 'rage']);
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

    it('declares five forms', () => {
      // Tree of Life comes from the stat conversion table, which lists it
      // alongside Caster and Moonkin.
      expect(formsFor('druid').map((form) => form.id)).toEqual([
        'caster',
        'moonkin',
        'tree',
        'bear',
        'cat',
      ]);
    });

    it('starts with rage empty but mana and energy full', () => {
      const specs = resourceSpecsFor('druid', baseManaFor(anyRaceFor('druid'), 'druid'));
      const byType = new Map(specs.map((spec) => [spec.type, spec]));

      expect(byType.get('rage')).toMatchObject({ initial: 0 });
      expect(byType.get('energy')).toMatchObject({ initial: 100 });
      // Druid base mana is 964, taken from Caster Form.
      expect(byType.get('mana')?.initial).toBe(964);
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
    expect(player('warrior').resources.types).toEqual(['rage']);
    // Energy pays for the ability; combo points decide what the finisher is
    // worth. The one class with two pools and no form to explain it.
    expect(player('rogue').resources.types).toEqual(['energy', 'comboPoints']);
    expect(player('mage').resources.types).toEqual(['mana']);
    // Copied before sorting: `types` is readonly, and sorting in place would
    // reorder the combatant's own resource list.
    expect([...player('druid').resources.types].sort()).toEqual([
      'comboPoints',
      'energy',
      'mana',
      'rage',
    ]);
  });

  it('no longer hands a rage bar to everyone', () => {
    // Regression: createPlayer used to hard-code rage regardless of class.
    for (const id of CLASS_IDS) {
      const combatant = player(id);
      const expectsRage = id === 'warrior' || id === 'druid';
      expect(combatant.resources.has('rage'), id).toBe(expectsRage);
    }
  });

  it('gives every class health', () => {
    for (const id of CLASS_IDS) {
      const combatant = player(id);
      expect(combatant.health.maximum, id).toBeGreaterThan(0);
      expect(combatant.health.current, id).toBe(combatant.health.maximum);
    }
  });

  it('gives abilities and a rotation to the classes that have them', () => {
    /*
     * FOUR OF NINE, and the list grows one class at a time. A class with no
     * entry gets an empty book and no rotation rather than a stand-in, so an
     * unwritten class produces nothing instead of producing something wrong.
     */
    const implemented = new Set(['warrior', 'rogue', 'druid', 'shaman']);

    for (const id of CLASS_IDS) {
      const combatant = player(id);
      if (implemented.has(id)) {
        expect(combatant.abilities.all.length, id).toBeGreaterThan(0);
        expect(combatant.rotation, id).toBeDefined();
      } else {
        expect(combatant.abilities.all, id).toHaveLength(0);
        expect(combatant.rotation, id).toBeUndefined();
      }
    }
  });
});
