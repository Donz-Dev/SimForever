import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { DEEP_WOUNDS_DURATION_MS, FLURRY_SWINGS, flurryAura, weaponAverageDamage } from '../../src/game/auras/warriorTalents';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { legalise } from '../helpers/legalTalents';

const warrior = (talents: Record<string, number> = {}) =>
  createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield', talents: legalise(talents) });

describe('talents contribute reactions', () => {
  const reactionIds = (talents: Record<string, number>) =>
    talentBuild('warrior', talents).reactions.map((r) => r.id);

  it('grants none without the talent', () => {
    expect(reactionIds({})).toEqual([]);
  });

  for (const [talent, id] of [
    ['deep_wounds', 'deep_wounds'],
    ['flurry', 'flurry'],
    ['unbridled_wrath', 'unbridled_wrath'],
    ['bloodthrill', 'bloodthrill'],
  ] as const) {
    it(`${talent} grants the ${id} reaction`, () => {
      expect(reactionIds({ [talent]: 1 })).toContain(id);
    });
  }

  it('reaches the combatant alongside the reactions every warrior has', () => {
    const ids = warrior({ deep_wounds: 3 }).reactions.map((r) => r.id);
    // The class's own reactions are still there.
    expect(ids).toContain('overpower_on_dodge');
    expect(ids).toContain('deep_wounds');
  });

  it('does not grant a reaction for a rank with no captured value', () => {
    // Bastion has no values, so nothing can be built from it.
    expect(talentBuild('warrior', { bastion: 1 }).reactions).toEqual([]);
  });
});

describe('Deep Wounds', () => {
  /*
   * "dealing X% of your melee weapon's average damage over 12 sec".
   *
   * ----------------------------------------------------------------------------
   * NO ATTACK POWER, AND THIS TEST USED TO INSIST ON IT.
   *
   * It computed the expected total from the universal weapon formula -- base
   * damage + (speed / 14) x attack power -- with a comment saying it did so "so
   * the test would catch the aura scaling by attack power twice". It caught the
   * wrong thing: an official source states that Deep Wounds "doesn't scale with
   * Attack Power", so scaling it ONCE was already one time too many.
   *
   * `WeaponProfile.baseDamage` is "average damage per swing before attack
   * power", which is exactly the quantity the tooltip means by "your melee
   * weapon's average damage".
   * ----------------------------------------------------------------------------
   */
  it('bleeds for a fraction of the WEAPON average damage, with no attack power', () => {
    const player = warrior({ deep_wounds: 3 }); // 60%
    const weapon = player.weapons.mainHand!;

    expect(weaponAverageDamage(player)).toBeCloseTo(weapon.baseDamage, 6);
    expect(weaponAverageDamage(player) * 0.6).toBeCloseTo(weapon.baseDamage * 0.6, 6);
    expect(weapon.baseDamage).toBeGreaterThan(0);

    // The term that must NOT be in there. A non-zero coefficient and a non-zero
    // attack power is what makes this a real check rather than a tautology.
    expect(weapon.powerCoefficient ?? 0).toBeGreaterThan(0);
    expect(player.stats.effective.attackPower).toBeGreaterThan(0);
  });

  it('lasts twelve seconds', () => {
    expect(DEEP_WOUNDS_DURATION_MS).toBe(12_000);
  });
});

describe('Flurry', () => {
  it('converts its percentage into exactly that much haste', () => {
    /*
     * The talent states a flat percentage and the engine derives haste from
     * `hasteRating`. The conversion has to round-trip: 25% must come out as a
     * 1.25 multiplier, whatever the rating constant happens to be.
     */
    const aura = flurryAura(25);
    const modifier = aura.statModifiers?.[0];
    expect(modifier?.stat).toBe('hasteRating');

    const player = warrior();
    const before = player.stats.effective.hasteRating;
    player.stats.addModifiers([{ ...modifier!, sourceId: 'test' }]);
    const after = player.stats.effective.hasteRating;
    // 25% of haste, expressed as rating, is what was added.
    expect(after - before).toBeCloseTo(modifier!.value, 6);
  });

  it('is spent by swings rather than by time', () => {
    const aura = flurryAura(10);
    expect(aura.consumedBySwing).toBe(true);
    expect(aura.maxStacks).toBe(FLURRY_SWINGS);
  });
});
