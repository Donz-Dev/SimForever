import { describe, expect, it } from 'vitest';
import type { WeaponProfile } from '../../src/engine';
import { weaponDamageFor } from '../../src/engine/combat/damage';
import {
  NORMALIZED_SPEED_SECONDS,
  normalizedPowerCoefficientFor,
  normalizedSpeedSecondsFor,
} from '../../src/game/combat/weaponDamage';
import { bearPaw, catPaw } from '../../src/game/actors/weapons';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * NORMALISATION, AND THE DRUID CLAUSE THAT REPLACES IT.
 *
 * Both supplied by the ruleset owner on 2026-09-30. The speeds and the paw
 * formula are written out again here by hand, because a test that read them
 * from the table under test would pass whatever the table said.
 * ==============================================================================
 */

const weapon = (over: Partial<WeaponProfile> = {}): WeaponProfile => ({
  name: 'Test',
  swingTimerMs: 3600,
  baseDamage: 100,
  school: 'physical',
  ...over,
});

describe('the normalised speeds', () => {
  it('is 3.3 two-handed, 2.8 ranged, 2.4 one-handed and 1.7 for a dagger', () => {
    expect(NORMALIZED_SPEED_SECONDS.twoHand).toBe(3.3);
    expect(NORMALIZED_SPEED_SECONDS.ranged).toBe(2.8);
    expect(NORMALIZED_SPEED_SECONDS.oneHand).toBe(2.4);
    expect(NORMALIZED_SPEED_SECONDS.dagger).toBe(1.7);
  });

  it('picks by weapon KIND and not by how fast the weapon actually is', () => {
    // A 1.8-second sword and a 2.9-second mace both normalise to 2.4, which is
    // the entire point of the rule.
    expect(normalizedSpeedSecondsFor({ weaponType: 'sword' })).toBe(2.4);
    expect(normalizedSpeedSecondsFor({ weaponType: 'mace' })).toBe(2.4);
    expect(normalizedSpeedSecondsFor({ weaponType: 'dagger' })).toBe(1.7);
    expect(normalizedSpeedSecondsFor({ weaponType: 'axe', twoHanded: true })).toBe(3.3);
  });

  it('CHECKS RANGED BEFORE TWO-HANDED, because a bow is both', () => {
    /*
     * A bow, a gun and a crossbow are all two-handed items. Reading
     * `twoHanded` first would normalise every one of them to 3.3 instead of
     * 2.8 and quietly inflate every Hunter shot by 18%.
     */
    for (const weaponType of ['bow', 'gun', 'crossbow'] as const) {
      expect(normalizedSpeedSecondsFor({ weaponType, twoHanded: true })).toBe(2.8);
    }
  });

  it('falls back to the one-handed figure for anything unrecognised', () => {
    // A fist weapon, or an item whose subclass did not parse. The commoner
    // case, and not the best one.
    expect(normalizedSpeedSecondsFor({})).toBe(2.4);
    expect(normalizedSpeedSecondsFor({ weaponType: 'unknown' })).toBe(2.4);
  });
});

describe('what normalisation does to the damage', () => {
  const attacker = (attackPower: number) =>
    makeAttacker({
      stats: { attackPower },
      weapons: {
        mainHand: weapon({
          weaponType: 'axe',
          twoHanded: true,
          // A SLOW two-hander: 3.6 seconds against a normalised 3.3.
          swingTimerMs: 3600,
          powerCoefficient: 3.6 / 14,
          normalizedPowerCoefficient: normalizedPowerCoefficientFor({
            weaponType: 'axe',
            twoHanded: true,
          }),
        }),
      },
    });

  const request = (normalized: boolean) => ({
    source: attacker(1400),
    target: makeTarget(),
    abilityName: 'Test',
    school: 'physical' as const,
    baseAmount: 0,
    weaponScaling: { slot: 'mainHand' as const, ...(normalized ? { normalized } : {}) },
  });

  it('replaces the SPEED in the attack power term and nothing else', () => {
    /*
     * 1400 attack power on a 3.6-second weapon with 100 base damage:
     *   un-normalised  100 + 3.6 / 14 x 1400 = 460
     *   normalised     100 + 3.3 / 14 x 1400 = 430
     *
     * The 100 is IDENTICAL in both, which is the assertion that matters: a
     * normalised ability still rolls the weapon's real damage.
     */
    expect(weaponDamageFor(request(false), 1)).toBeCloseTo(100 + (3.6 / 14) * 1400, 6);
    expect(weaponDamageFor(request(true), 1)).toBeCloseTo(100 + (3.3 / 14) * 1400, 6);
  });

  it('is worth NOTHING at zero attack power, because it only touches that term', () => {
    const noPower = { ...request(true), source: attacker(0) };
    const noPowerPlain = { ...request(false), source: attacker(0) };
    expect(weaponDamageFor(noPower, 1)).toBe(weaponDamageFor(noPowerPlain, 1));
  });

  it('falls back to the weapon’s own speed when it carries no normalised figure', () => {
    /*
     * A paw, or a placeholder. Falling back to ZERO instead would make a
     * normalised ability contribute no attack power at all, which reads as a
     * very bad weapon rather than as a missing field.
     */
    const bare = {
      ...request(true),
      source: makeAttacker({
        stats: { attackPower: 1400 },
        weapons: { mainHand: weapon({ powerCoefficient: 3.6 / 14 }) },
      }),
    };
    expect(weaponDamageFor(bare, 1)).toBeCloseTo(100 + (3.6 / 14) * 1400, 6);
  });
});

describe('a Druid paw, which is normalised by being a paw', () => {
  /*
   * The owner's formula, written out again:
   *
   *   Cat  = (BaseCatPaw  + weaponDPS x speed x 1   + AP x 1   / 14 x speed) x rand
   *   Bear = (BaseBearPaw + weaponDPS x speed x 2.5 + AP x 2.5 / 14 x speed) x rand
   *
   * `speed` is the HELD weapon's base swing time and `weaponDPS` its dps, both
   * confirmed by the owner. A paw's `baseDamage` carries the first two terms
   * and its `powerCoefficient` carries the third.
   */
  const held = { dps: 53, speedSeconds: 3.6 };

  it('builds the Cat’s paw from what is held, at a multiplier of 1', () => {
    const paw = catPaw(held);
    expect(paw.baseDamage).toBeCloseTo(50 + 53 * 3.6 * 1, 6);
    expect(paw.powerCoefficient).toBeCloseTo((1 * 3.6) / 14, 6);
  });

  it('builds the Bear’s at 2.5, on both weapon terms', () => {
    const paw = bearPaw(held);
    expect(paw.baseDamage).toBeCloseTo(100 + 53 * 3.6 * 2.5, 6);
    expect(paw.powerCoefficient).toBeCloseTo((2.5 * 3.6) / 14, 6);
  });

  it('keeps the FORM’s swing time, not the held weapon’s', () => {
    /*
     * The held weapon's speed feeds the DAMAGE and never the cadence. Reading
     * it as the cadence too would make a slow weapon a third of a cat's attack
     * rate, which is the opposite of what a form is.
     */
    expect(catPaw(held).swingTimerMs).toBe(1000);
    expect(bearPaw(held).swingTimerMs).toBe(2500);
  });

  it('rolls plus or minus 20%, which is the formula’s random(0.8, 1.2)', () => {
    expect(catPaw(held).damageVariance).toBe(0.2);
    expect(bearPaw(held).damageVariance).toBe(0.2);
  });

  it('holding NOTHING leaves the base paw and no weapon terms', () => {
    /*
     * Every weapon term is multiplied by a speed that does not exist, so all
     * of them are zero. Asserted rather than left to chance, because inventing
     * a default weapon here would be inventing game data.
     */
    expect(catPaw(undefined).baseDamage).toBe(50);
    expect(catPaw(undefined).powerCoefficient).toBe(0);
    expect(bearPaw(undefined).baseDamage).toBe(100);
  });

  it('CARRIES NO NORMALISED COEFFICIENT, which is why Druids are exempt', () => {
    /*
     * The owner: "Normalization doesn't exist for druids because they're
     * effectively already normalized to using their paw to attack." A paw with
     * no normalised figure falls back to its own coefficient, so even a Druid
     * ability that wrongly asked for normalisation would get the paw's real
     * scaling rather than a one-handed 2.4.
     */
    expect(catPaw(held).normalizedPowerCoefficient).toBeUndefined();
    expect(bearPaw(held).normalizedPowerCoefficient).toBeUndefined();
  });
});
