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

describe('a modifier conditional on an aura', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE REGISTRY IS STILL BUILT ONCE AND THE CONDITION IS READ LATE, which is
   * the only thing that separates these from the ones above. Shatter is the
   * first caller: its crit belongs to the Mage and its window belongs to a
   * DIFFERENT talent's aura, so the two are joined by an aura id rather than by
   * one talent reading the other's rank during the build.
   * ----------------------------------------------------------------------------
   */
  const always = () => true;
  const never = () => false;

  it('pays nothing while the aura is absent', () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.forWhileAura('frostbolt', never)).toBeUndefined();
  });

  it('pays while the aura is present', () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.forWhileAura('frostbolt', always)?.critBonus).toBe(50);
  });

  it('never reaches an auto attack, which has no ability id', () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.forWhileAura(undefined, always)).toBeUndefined();
  });

  it('is kept OUT of the unconditional bucket', () => {
    /*
     * THE FAILURE THIS GUARDS is a conditional modifier combined into the
     * standing one, which loses the condition and pays all fight instead of
     * during its window -- a bigger number and no error.
     */
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.for('frostbolt').critBonus ?? 0).toBe(0);
  });

  it('reports itself non-empty, so nothing skips the lookup', () => {
    const modifiers = new AbilityModifiers();
    expect(modifiers.isEmpty).toBe(true);
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.isEmpty).toBe(false);
  });

  it('only pays for the aura that is actually up', () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    modifiers.addWhileAura('some_other_aura', ALL_ABILITIES, { critBonus: 7 });
    const active = (auraId: string) => auraId === 'fingers_of_frost';
    expect(modifiers.forWhileAura('frostbolt', active)?.critBonus).toBe(50);
  });

  it('returns the catch-all ONCE when asked for the catch-all key', () => {
    // The same double-count trap `for` carries: looked up as both `all` and
    // `own`, +50 read back as +100.
    const modifiers = new AbilityModifiers();
    modifiers.addWhileAura('fingers_of_frost', ALL_ABILITIES, { critBonus: 50 });
    expect(modifiers.forWhileAura(ALL_ABILITIES, always)?.critBonus).toBe(50);
  });
});
