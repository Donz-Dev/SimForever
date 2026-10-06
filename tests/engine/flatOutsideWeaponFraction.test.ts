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

/*
 * ==============================================================================
 * AN ABILITY'S FLAT DAMAGE IS ADDED OUTSIDE ITS WEAPON PERCENTAGE.
 *
 * "75% weapon damage plus an additional 50 with each weapon" is
 *
 *     weapon x 0.75 + 50
 *
 * and NOT `(weapon + 50) x 0.75`. The ruleset owner's reading of their own
 * tooltips, which is where this ends: they gave the other reading for Mutilate
 * and for every ability of that shape, it was built that way, and they then
 * CORRECTED IT BACK. So this file is the same rule the project always had, now
 * with a test under it.
 *
 * ------------------------------------------------------------------------------
 * THE WHOLE SUITE PASSED WHEN THE FORMULA CHANGED, AND PASSED AGAIN WHEN IT
 * CHANGED BACK. That is the only reason this file exists, and it is the real
 * finding of the whole episode: nothing pinned the damage of any ability whose
 * weapon fraction is not 1, so FIVE of them could switch formula in either
 * direction in total silence. The two readings differ by 6% on Mutilate and 47%
 * on Ambush -- not a rounding difference, and not one any test noticed.
 *
 * A REVERT IS THE MOMENT THAT HOLE WOULD NORMALLY REOPEN, because the test that
 * caught it was written FOR the reverted rule and goes out with it. This is that
 * test inverted rather than deleted. Every expectation is written out from the
 * formula by hand.
 * ------------------------------------------------------------------------------
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

  it('adds the flat damage WHOLE, outside the weapon fraction', () => {
    /*
     * `weaponDamage` arrives already fractioned -- `weaponDamageFor` applies the
     * percentage to the weapon half -- so the only question this function
     * answers is whether the flat amount is multiplied too. It is not.
     *
     * 200 of fractioned weapon damage plus a flat 50 at 75%:
     *   200 + 50 = 250,  and not  200 + 50 x 0.75 = 237.5
     */
    expect(scaleByPower(request(50, 0.75), 200)).toBeCloseTo(250, 10);
    expect(scaleByPower(request(50, 0.75), 200)).not.toBeCloseTo(237.5, 1);
  });

  it('does not raise it when the fraction is above 1 either', () => {
    // Ambush's shape: 290 flat at 250% stays 290, not 725.
    expect(scaleByPower(request(290, 2.5), 0)).toBeCloseTo(290, 10);
    expect(scaleByPower(request(290, 2.5), 0)).not.toBeCloseTo(725, 1);
  });

  it('is the same arithmetic at a fraction of exactly 1', () => {
    /*
     * TWELVE OF THE SEVENTEEN ABILITIES OF THIS SHAPE ARE THIS CASE, which is
     * why the formula could change twice without any profile but three moving:
     * Heroic Strike, Overpower, Mortal Strike, Cleave, Slam, Sniper Shot, Aimed
     * Shot, Raptor Strike, Mongoose Bite, Sinister Strike, Maul and Primal Bite
     * are all 100% weapon damage, so both readings agree on all of them.
     *
     * THE CORROLLARY IS THE TRAP: a change to this formula is invisible in
     * twelve of the seventeen places it applies, so "the profiles did not move"
     * is not evidence that it is right.
     */
    expect(scaleByPower(request(160, 1), 300)).toBeCloseTo(460, 10);
    expect(scaleByPower(request(160, 1), 300)).toBeCloseTo(
      scaleByPower(request(160, undefined), 300),
      10,
    );
  });

  it('leaves an ability with no weapon scaling alone', () => {
    // Eviscerate and every pure-flat finisher: no fraction to be outside of.
    expect(scaleByPower(request(958, undefined), 0)).toBeCloseTo(958, 10);
  });

  it('treats a PERIODIC tick with a weapon fraction the same way', () => {
    /*
     * LACERATE. There is nothing special about it under this rule, and that is
     * worth pinning: under the other reading it needed an exclusion, because its
     * fraction is "10% weapon damage PER EXISTING APPLICATION" -- a per-stack
     * rider on a bleed rather than a percentage its own damage is quoted in --
     * and multiplying its flat tick by 0.1 cost the Bear 2.5 DPS. With the flat
     * outside, a direct strike and a bleed need no telling apart.
     */
    const periodic = {
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'Lacerate',
      school: 'physical' as const,
      baseAmount: 100,
      weaponScaling: { slot: 'mainHand' as const, fraction: 0.1 },
      periodic: true,
    } as never;
    expect(scaleByPower(periodic, 25)).toBeCloseTo(125, 10);
  });

  it('needs no opt-out for a folded spell power coefficient', () => {
    /*
     * HOLY STRIKE AND SEAL OF COMMAND, which both pass a compound `baseAmount`:
     * flat damage plus the sheet's SPELL POWER coefficient, folded together
     * because `scaleByPower` picks one power pool from the school and a spell
     * coefficient on a physical request would be read against attack power.
     *
     * Under the other reading the weapon fraction would have halved that folded
     * coefficient as a side effect of an implementation detail, so both had to
     * opt out explicitly -- and Seal of Command was found only by a containment
     * check noticing the Ret Paladin moving 10.2 when it should not have. With
     * the flat outside, the folding is invisible to this function again and
     * neither needs to say anything.
     */
    const folded = {
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'Holy Strike',
      school: 'physical' as const,
      // 93 is flat Holy damage plus a folded spell power term, at 50% weapon.
      baseAmount: 93,
      weaponScaling: { slot: 'mainHand' as const, fraction: 0.5 },
    } as never;
    expect(scaleByPower(folded, 200)).toBeCloseTo(293, 10);
    expect(scaleByPower(folded, 200)).not.toBeCloseTo(246.5, 1);
  });
});

describe('the five abilities a change to this formula would move', () => {
  /*
   * THE ONLY FIVE, pinned by VALUE so the list cannot silently grow or shrink.
   * Any ability whose fraction is 1 is immune to this question entirely, so
   * these five are the whole blast radius -- and they were the three profiles
   * that moved in both directions: Cat (Shred, Claw), Rupture (Backstab,
   * Ambush) and Venom (Mutilate).
   */
  it('states each fraction, and that it is not 1', () => {
    expect(MUTILATE_WEAPON_FRACTION).toBe(0.75);
    expect(CLAW_WEAPON_FRACTION).toBe(1.1);
    expect(BACKSTAB_WEAPON_FRACTION).toBe(1.5);
    expect(SHRED_WEAPON_FRACTION).toBe(1.55);
    expect(AMBUSH_WEAPON_FRACTION).toBe(2.5);
  });
});

describe('end to end, through the real pipeline', () => {
  const HIT = { outcome: 'hit' as const, avoided: false, damageMultiplier: 1, rolls: [] };

  /** The whole formula, by hand: the flat amount is added after the fraction. */
  const byHand = (base: number, ap: number, flat: number, fraction: number, hand: number) =>
    ((base + (1.7 / 14) * ap) * fraction + flat) * hand;

  const landed = (
    flat: number,
    fraction: number,
    weapon: WeaponProfile,
    slot: 'mainHand' | 'offHand',
  ) => {
    const attacker = makeAttacker({
      id: `fo-${flat}-${fraction}-${slot}`,
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

  it('resolves Mutilate’s shape with the 50 outside the 75%', () => {
    const weapon = dagger(111.5);
    // (111.5 + 1.7/14 x 1000) x 0.75 + 50 = 226.0446...
    expect(landed(MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, weapon, 'mainHand')).toBeCloseTo(
      byHand(111.5, 1000, MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, 1),
      6,
    );
    // Strictly ABOVE the reading this reverts, because 0.75 is below 1.
    const insideReading =
      (111.5 + (1.7 / 14) * 1000 + MUTILATE_BASE_DAMAGE) * MUTILATE_WEAPON_FRACTION;
    expect(
      landed(MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, weapon, 'mainHand'),
    ).toBeGreaterThan(insideReading);
  });

  it('resolves Backstab’s shape, where the direction is the other way', () => {
    /*
     * BOTH DIRECTIONS ARE PINNED, because the two readings differ by the sign of
     * `fraction - 1` and a mistake here would look entirely plausible either
     * way. Backstab is 150%, so flat-outside is the SMALLER number -- the
     * opposite of Mutilate above.
     */
    const weapon = dagger(111.5);
    expect(landed(BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, weapon, 'mainHand')).toBeCloseTo(
      byHand(111.5, 1000, BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, 1),
      6,
    );
    const insideReading =
      (111.5 + (1.7 / 14) * 1000 + BACKSTAB_BASE_DAMAGE) * BACKSTAB_WEAPON_FRACTION;
    expect(landed(BACKSTAB_BASE_DAMAGE, BACKSTAB_WEAPON_FRACTION, weapon, 'mainHand')).toBeLessThan(
      insideReading,
    );
  });

  it('resolves Ambush’s shape, the largest gap between the two readings', () => {
    // 250%: `(w + 290) x 2.5` against `w x 2.5 + 290` is a 47% difference.
    const weapon = dagger(111.5);
    expect(landed(AMBUSH_BASE_DAMAGE, AMBUSH_WEAPON_FRACTION, weapon, 'mainHand')).toBeCloseTo(
      byHand(111.5, 1000, AMBUSH_BASE_DAMAGE, AMBUSH_WEAPON_FRACTION, 1),
      6,
    );
  });

  it('applies the off-hand penalty ONCE, to the hand’s finished total', () => {
    /*
     * `(weapon x fraction + flat) x 0.5`, and the halving is still the LAST
     * thing that happens -- the project's standing rule, and the reason the
     * off-hand is checked separately: it is a multiplier on a different axis
     * from the weapon fraction and the two have been confused before.
     */
    const oh = dagger(68.5, 0.5);
    expect(landed(MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, oh, 'offHand')).toBeCloseTo(
      byHand(68.5, 1000, MUTILATE_BASE_DAMAGE, MUTILATE_WEAPON_FRACTION, 0.5),
      6,
    );
  });
});
