import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES, AbilityModifiers } from '../../src/engine';

describe('AbilityModifiers', () => {
  it('returns nothing for an ability with no modifier', () => {
    expect(new AbilityModifiers().for('mortal_strike')).toEqual({});
  });

  it('returns nothing for an auto attack, which has no ability id', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add(ALL_ABILITIES, { critBonus: 10 });
    // A swing carries no abilityId, so "all abilities" must not reach it.
    expect(modifiers.for(undefined)).toEqual({});
  });

  it('applies an ALL_ABILITIES modifier to any named ability', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add(ALL_ABILITIES, { critMultiplierBonus: 0.1 });
    expect(modifiers.for('execute').critMultiplierBonus).toBe(0.1);
  });

  it('adds chances and multiplies damage when two sources overlap', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add('rend', { critBonus: 5, damageMultiplier: 1.1 });
    modifiers.add('rend', { critBonus: 5, damageMultiplier: 1.1 });
    const combined = modifiers.for('rend');
    // Two "+5%" crit sources give +10%, the additive bucket.
    expect(combined.critBonus).toBe(10);
    // Two independent "+10% damage" give +21%, not +20%.
    expect(combined.damageMultiplier).toBeCloseTo(1.21, 10);
  });

  it('combines the all-abilities modifier with an ability-specific one', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add(ALL_ABILITIES, { critMultiplierBonus: 0.1 });
    modifiers.add('overpower', { critBonus: 25 });
    const combined = modifiers.for('overpower');
    expect(combined.critBonus).toBe(25);
    expect(combined.critMultiplierBonus).toBe(0.1);
  });

  it('leaves other abilities alone', () => {
    const modifiers = new AbilityModifiers();
    modifiers.add('overpower', { critBonus: 25 });
    expect(modifiers.for('mortal_strike')).toEqual({});
  });
});
