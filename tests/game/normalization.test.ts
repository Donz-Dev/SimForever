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
   *   Cat  = (BaseCatPaw  + weaponDPS x 1   + AP x 1   / 14) x rand(0.8, 1.2)
   *   Bear = (BaseBearPaw + weaponDPS x 2.5 + AP x 2.5 / 14) x rand(0.8, 1.2)
   *
   * The 1 and the 2.5 are the FORM'S SWING TIME, which the formula also names
   * `BaseWeaponSwingTime` -- one number written twice, not two. A paw's
   * `baseDamage` carries the first two terms and its `powerCoefficient` the
   * third.
   *
   * BOTH BASES ARE 1, STATED BY THE OWNER, where they were assumed at 100 and
   * 50. Written out by hand below rather than imported, which is this project's
   * rule -- a test that reads the constant passes whatever the constant says,
   * and these three tests are exactly what caught the change reaching the paw.
   */
  const held = { dps: 53 };
  const CAT_BASE = 1;
  const BEAR_BASE = 1;

  it('builds the Cat’s paw from the held dps, at its own one-second swing', () => {
    const paw = catPaw(held);
    expect(paw.baseDamage).toBeCloseTo(CAT_BASE + 53 * 1, 6);
    expect(paw.powerCoefficient).toBeCloseTo(1 / 14, 6);
  });

  it('builds the Bear’s at 2.5, on both weapon terms', () => {
    const paw = bearPaw(held);
    expect(paw.baseDamage).toBeCloseTo(BEAR_BASE + 53 * 2.5, 6);
    expect(paw.powerCoefficient).toBeCloseTo(2.5 / 14, 6);
  });

  it('IGNORES THE HELD WEAPON’S SPEED, which is why this reading was chosen', () => {
    /*
     * The rejected reading took `BaseWeaponSwingTime` as the HELD weapon's
     * speed, which made paw damage proportional to how SLOW that weapon was --
     * at equal dps a 3.6-second weapon was worth 3.6x a one-second one, so the
     * best feral play became "hold the slowest thing you can find". Two weapons
     * of equal dps must give the same paw, and `HeldWeapon` carries no speed
     * at all so that they cannot do otherwise.
     */
    expect(catPaw({ dps: 53 }).baseDamage).toBe(catPaw({ dps: 53 }).baseDamage);
    expect(catPaw({ dps: 100 }).baseDamage).toBeGreaterThan(catPaw({ dps: 53 }).baseDamage);
  });

  it('swings on the FORM’s cadence', () => {
    // One second and two and a half, which is also the multiplier above.
    expect(catPaw(held).swingTimerMs).toBe(1000);
    expect(bearPaw(held).swingTimerMs).toBe(2500);
  });

  it('rolls plus or minus 20%, which is the formula’s random(0.8, 1.2)', () => {
    expect(catPaw(held).damageVariance).toBe(0.2);
    expect(bearPaw(held).damageVariance).toBe(0.2);
  });

  it('holding NOTHING drops the weapon term and KEEPS the attack power one', () => {
    /*
     * Only the `weaponDPS` term needs a weapon. The attack power term is
     * `formSwing / 14` and the form is always there, so an unarmed Druid still
     * scales with attack power -- which is the honest reading and also the
     * safe one: a paw whose coefficient fell to zero would read as a character
     * that gains nothing from gear at all.
     *
     * AND AT A BASE OF 1 THAT IS THE WHOLE OF AN UNARMED PAW'S FLAT DAMAGE,
     * which is worth stating rather than leaving as arithmetic: the form
     * contributes a cadence and essentially no damage, so an unarmed Druid is
     * its attack power and nothing else.
     */
    expect(catPaw(undefined).baseDamage).toBe(CAT_BASE);
    expect(catPaw(undefined).powerCoefficient).toBeCloseTo(1 / 14, 6);
    expect(bearPaw(undefined).baseDamage).toBe(BEAR_BASE);
    expect(bearPaw(undefined).powerCoefficient).toBeCloseTo(2.5 / 14, 6);
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
