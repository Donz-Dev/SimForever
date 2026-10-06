import { describe, expect, it } from 'vitest';
import { resolveDamage, scaleByPower } from '../../src/engine';
import type { WeaponProfile } from '../../src/engine';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';
import {
  MUTILATE_BASE_DAMAGE,
  MUTILATE_WEAPON_FRACTION,
  BACKSTAB_BASE_DAMAGE,
  BACKSTAB_WEAPON_FRACTION,
  AMBUSH_BASE_DAMAGE,
  AMBUSH_WEAPON_FRACTION,
} from '../../src/game/abilities/rogue';
import { SHRED_WEAPON_FRACTION, CLAW_WEAPON_FRACTION } from '../../src/game/abilities/druid';
import { HOLY_STRIKE_WEAPON_FRACTION } from '../../src/game/abilities/paladin';

/*
 * ==============================================================================
 * AN ABILITY'S FLAT DAMAGE IS INSIDE ITS WEAPON PERCENTAGE.
 *
 * The ruleset owner's reading of their own tooltips: "75% weapon damage plus an
 * additional 50 with each weapon" is `(weapon + 50) x 0.75`, not
 * `weapon x 0.75 + 50`.
 *
 * THE WHOLE SUITE PASSED WHEN THIS CHANGED, which is why this file exists.
 * Nothing pinned the damage of any ability whose weapon fraction is not 1, so
 * six abilities could switch formula in silence -- and the two readings differ
 * by -6% on Mutilate's off hand and +47% on Ambush, which is not a rounding
 * difference.
 *
 * Every expectation below is written out from the formula by hand.
 * ==============================================================================
 */

const dagger = (baseDamage: number, hand = 1): WeaponProfile =>
  ({
    name: 'Test dagger',
    baseDamage,
    swingTimerMs: 1800,
    weaponType: 'dagger',
    skill: 300,
    powerCoefficient: 1.8 / 14,
    normalizedPowerCoefficient: 1.7 / 14,
    damageMultiplier: hand,
  }) as WeaponProfile;

describe('the rule, on scaleByPower alone', () => {
  const request = (baseAmount: number, fraction?: number) =>
    ({
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'Probe',
      school: 'physical' as const,
      baseAmount,
      ...(fraction === undefined
        ? {}
        : { weaponScaling: { slot: 'mainHand' as const, fraction } }),
    }) as never;

  it('multiplies the flat damage by the weapon fraction', () => {
    // 200 of rolled weapon damage (already fractioned) plus a flat 50 at 75%:
    //   50 x 0.75 + 200 = 237.5
    // The old reading was 50 + 200 = 250.
    expect(scaleByPower(request(50, 0.75), 200)).toBeCloseTo(237.5, 10);
    expect(scaleByPower(request(50, 0.75), 200)).not.toBeCloseTo(250, 1);
  });

  it('raises it when the fraction is above 1', () => {
    // Ambush's shape: 290 flat at 250%.
    expect(scaleByPower(request(290, 2.5), 0)).toBeCloseTo(725, 10);
  });

  it('changes nothing at a fraction of exactly 1', () => {
    /*
     * TWELVE OF THE EIGHTEEN NAMED ABILITIES ARE THIS CASE, which is the
     * useful half of the rule: Heroic Strike, Overpower, Mortal Strike,
     * Cleave, Slam, Sniper Shot, Aimed Shot, Raptor Strike, Mongoose Bite,
     * Sinister Strike, Maul and Primal Bite are all 100% weapon damage, so
     * both readings are the same arithmetic and none of them moved.
     */
    expect(scaleByPower(request(160, 1), 300)).toBeCloseTo(460, 10);
    expect(scaleByPower(request(160, 1), 300)).toBeCloseTo(
      scaleByPower(request(160, undefined), 300),
      10,
    );
  });

  it('leaves an ability with no weapon scaling alone', () => {
    // Eviscerate and every pure-flat finisher: no fraction to be inside of.
    expect(scaleByPower(request(958, undefined), 0)).toBeCloseTo(958, 10);
  });

  /*
   * LACERATE IS THE REASON THIS CLAUSE EXISTS, and a measurement is what found
   * it. Its fraction is "10% weapon damage PER EXISTING APPLICATION" -- a
   * per-stack rider on a bleed, not a percentage its own damage is quoted in --
   * so putting its flat tick inside 0.1 cut the Bear by 2.5 DPS. It is not one
   * of the eighteen abilities the rule names, and every one of those IS a
   * direct strike, so `periodic` separates the two with no list to maintain.
   */
  /*
   * TWO ABILITIES OPT OUT, and neither is on the owner's list: Holy Strike,
   * withdrawn by them after being named with the others, and Seal of Command.
   * Both pass a folded SPELL POWER coefficient as `baseAmount` rather than flat
   * damage, so the rule would have halved a sheet coefficient as a side effect
   * of that folding.
   *
   * THE DEFAULT IS THE RULE AND THE OPT-OUT IS EXPLICIT, which is the safe
   * direction: an ability that declares nothing gets the rule, and only a
   * genuine exception has to say so.
   */
  it('honours an explicit opt-out', () => {
    const optedOut = {
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'Holy Strike',
      school: 'physical' as const,
      baseAmount: 93,
      weaponScaling: {
        slot: 'mainHand' as const,
        fraction: HOLY_STRIKE_WEAPON_FRACTION,
        flatInsideFraction: false,
      },
    } as never;
    // The flat 93 survives whole beside 200 of already-fractioned weapon.
    expect(scaleByPower(optedOut, 200)).toBeCloseTo(293, 10);
    // And the rule would have made it 246.5, which is what it is opting out of.
    expect(scaleByPower(optedOut, 200)).not.toBeCloseTo(246.5, 1);
  });

  it('is still Holy Strike’s declared fraction', () => {
    expect(HOLY_STRIKE_WEAPON_FRACTION).toBe(0.5);
  });

  it('leaves a PERIODIC tick alone even when it carries a weapon fraction', () => {
    const periodic = {
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'Lacerate',
      school: 'physical' as const,
      baseAmount: 100,
      weaponScaling: { slot: 'mainHand' as const, fraction: 0.1 },
      periodic: true,
    } as never;
    // The flat 100 survives intact; only the weapon share was ever fractioned.
    expect(scaleByPower(periodic, 25)).toBeCloseTo(125, 10);
    expect(scaleByPower(periodic, 25)).not.toBeCloseTo(35, 1);
  });
});

describe('the five abilities the rule moves', () => {
  /*
   * These are the only ones the rule moves. Pinned by VALUE, so a change to any
   * of them is visible rather than absorbed -- and the direction is pinned too,
   * because the rule cuts both ways and a sign error would look plausible.
   */
  it('states each fraction, and that it is not 1', () => {
    expect(MUTILATE_WEAPON_FRACTION).toBe(0.75);
    expect(CLAW_WEAPON_FRACTION).toBe(1.1);
    expect(BACKSTAB_WEAPON_FRACTION).toBe(1.5);
    expect(SHRED_WEAPON_FRACTION).toBe(1.55);
    expect(AMBUSH_WEAPON_FRACTION).toBe(2.5);
  });

  it('loses damage below 1 and gains above it', () => {
    const weapon = 400; // already fractioned, so the same for both readings
    const below = { flat: MUTILATE_BASE_DAMAGE, fraction: MUTILATE_WEAPON_FRACTION };
    const above = { flat: AMBUSH_BASE_DAMAGE, fraction: AMBUSH_WEAPON_FRACTION };

    const oldReading = (f: { flat: number; fraction: number }) => weapon + f.flat;
    const newReading = (f: { flat: number; fraction: number }) => weapon + f.flat * f.fraction;

    expect(newReading(below)).toBeLessThan(oldReading(below));
    expect(newReading(above)).toBeGreaterThan(oldReading(above));
  });
});

describe('end to end, through the real pipeline', () => {
  const HIT = { outcome: 'hit' as const, avoided: false, damageMultiplier: 1, rolls: [] };

  /** The whole formula, by hand, at an average weapon roll. */
  const byHand = (base: number, ap: number, flat: number, fraction: number, hand: number) =>
    (base + (1.7 / 14) * ap + flat) * fraction * hand;

  const landed = (flat: number, fraction: number, weapon: WeaponProfile, slot: 'mainHand') => {
    const attacker = makeAttacker({
      id: `fw-${flat}-${fraction}`,
      stats: { attackPower: 1000 },
      weapons: { [slot]: weapon },
    });
    const target = makeTarget({ level: 63, stats: { armor: 0 } });
    buildSimulation([attacker, target]);
    const rolled = (weapon.baseDamage + (1.7 / 14) * 1000) * fraction;
    return resolveDamage(
      {
        source: attacker,
        target,
        abilityName: 'Probe',
        school: 'physical',
        baseAmount: flat,
        weaponScaling: { slot, fraction, normalized: true },
      },
      HIT,
      rolled,
    ).amount;
  };

  it('resolves Mutilate’s shape to the new reading, which is LOWER', () => {
    const weapon = dagger(111.5);
    // (111.5 + 1.7/14 x 1000 + 50) x 0.75 = 212.6339...
    expect(landed(MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, weapon, 'mainHand')).toBeCloseTo(
      byHand(111.5, 1000, MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, 1),
      6,
    );
    // And strictly below the reading it replaced.
    const oldReading = (111.5 + (1.7 / 14) * 1000) * MUTILATE_WEAPON_FRACTION + MUTILATE_BASE_DAMAGE;
    expect(landed(MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, weapon, 'mainHand')).toBeLessThan(
      oldReading,
    );
  });

  it('resolves Backstab’s shape to the new reading, which is HIGHER', () => {
    const weapon = dagger(111.5);
    expect(landed(BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, weapon, 'mainHand')).toBeCloseTo(
      byHand(111.5, 1000, BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, 1),
      6,
    );
    const oldReading = (111.5 + (1.7 / 14) * 1000) * BACKSTAB_WEAPON_FRACTION + BACKSTAB_BASE_DAMAGE;
    expect(
      landed(BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, weapon, 'mainHand'),
    ).toBeGreaterThan(oldReading);
  });

  it('keeps the off-hand penalty OUTSIDE the fraction, applied once to the total', () => {
    /*
     * `(weapon + power + flat) x fraction x 0.5`, and the halving is still the
     * LAST thing that happens to the hand's own total -- the project's standing
     * rule. Putting the flat inside the fraction does not move the off-hand
     * penalty, which is a separate multiplier on a separate axis.
     */
    const oh = dagger(68.5, 0.5);
    const expected = byHand(68.5, 1000, MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, 0.5);
    const attacker = makeAttacker({
      id: 'oh-probe',
      stats: { attackPower: 1000 },
      weapons: { offHand: oh },
    });
    const target = makeTarget({ level: 63, stats: { armor: 0 } });
    buildSimulation([attacker, target]);
    const rolled = (68.5 + (1.7 / 14) * 1000) * MUTILATE_WEAPON_FRACTION;
    const amount = resolveDamage(
      {
        source: attacker,
        target,
        abilityName: 'Probe',
        school: 'physical',
        baseAmount: MUTILATE_BASE_DAMAGE,
        weaponScaling: { slot: 'offHand', fraction: MUTILATE_WEAPON_FRACTION, normalized: true },
      },
      HIT,
      rolled,
    ).amount;
    expect(amount).toBeCloseTo(expected, 6);
  });
});
