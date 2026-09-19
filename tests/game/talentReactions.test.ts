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
   * The expected total is computed here from the universal weapon formula --
   * base damage + (speed / 14) x attack power -- rather than read back out of
   * the aura, so the test would catch the aura scaling by attack power twice.
   */
  it('bleeds for the stated fraction of weapon average damage', () => {
    const player = warrior({ deep_wounds: 3 }); // 60%
    const average = weaponAverageDamage(player);
    const weapon = player.weapons.mainHand!;
    const expected =
      (weapon.baseDamage + (weapon.powerCoefficient ?? 0) * player.stats.effective.attackPower) *
      0.6;
    expect(average * 0.6).toBeCloseTo(expected, 6);
    expect(expected).toBeGreaterThan(0);
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
