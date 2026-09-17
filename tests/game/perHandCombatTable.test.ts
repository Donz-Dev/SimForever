import { describe, expect, it } from 'vitest';
import { Combatant, toPercent } from '../../src/engine';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';

/*
 * A dual-wielder has TWO combat tables, not one shown twice.
 *
 * Both hands carry the dual-wield miss penalty, so that is not what separates
 * them. WEAPON SKILL is: a sword in one hand and a mace in the other diverge
 * the moment anything grants skill with one and not the other, and miss and
 * enemy dodge both derive from it.
 *
 * With the items currently imported both hands hold swords at base skill, so
 * the two tables come out identical -- which is correct, and is exactly why
 * this test builds its own weapons rather than equipping any.
 */

const BASE_SKILL = 300;
const BOSS_DEFENSE = 63 * 5;

function wielder(mainHandSkill: number, offHandSkill: number): Combatant {
  const weapon = (name: string, skill: number) => ({
    name,
    swingTimerMs: 2600,
    baseDamage: 100,
    skill,
  });

  return new Combatant({
    id: 'p',
    name: 'P',
    kind: 'player',
    faction: 'friendly',
    maxHealth: 1000,
    level: 60,
    autoAttack: 'dual-wield',
    weapons: {
      mainHand: weapon('Sword', mainHandSkill),
      offHand: weapon('Mace', offHandSkill),
    },
  });
}

const dummy = createTrainingDummy({ level: 63 });
const chances = createForeverAttackChances(() => 'dual_wield');
const table = (player: Combatant, slot: 'mainHand' | 'offHand') =>
  chances('melee-auto', player, dummy, { slot });

describe('a dual-wielder has two combat tables', () => {
  it('reads weapon skill from the hand that swung', () => {
    const player = wielder(BASE_SKILL + 5, BASE_SKILL);

    expect(player.weaponSkill('mainHand')).toBe(305);
    expect(player.weaponSkill('offHand')).toBe(300);
    expect(dummy.defenseSkill).toBe(BOSS_DEFENSE);
  });

  it('gives the better-skilled hand a lower miss chance', () => {
    const player = wielder(BASE_SKILL + 5, BASE_SKILL);

    const mainHand = toPercent(table(player, 'mainHand').miss);
    const offHand = toPercent(table(player, 'offHand').miss);

    // Five points of skill against a 15-point deficit: the gap narrows to 10,
    // which is three percentage points of miss.
    expect(mainHand).toBeCloseTo(25, 6);
    expect(offHand).toBeCloseTo(28, 6);
    expect(offHand).toBeGreaterThan(mainHand);
  });

  it('gives the better-skilled hand a lower enemy dodge chance', () => {
    // Dodge derives from the same skill gap, which is why the sheet shows it
    // per hand as well. Reporting one figure for both would average away a
    // difference the fight does not average away.
    const player = wielder(BASE_SKILL + 5, BASE_SKILL);

    expect(toPercent(table(player, 'mainHand').dodge)).toBeCloseTo(6.0, 6);
    expect(toPercent(table(player, 'offHand').dodge)).toBeCloseTo(6.5, 6);
  });

  it('penalises BOTH hands for dual-wielding, so skill is what separates them', () => {
    const even = wielder(BASE_SKILL, BASE_SKILL);

    const mainHand = toPercent(table(even, 'mainHand').miss);
    const offHand = toPercent(table(even, 'offHand').miss);

    // Equal skill, equal miss -- and both far above the 9% a two-hander sees,
    // because the penalty lands on each hand rather than only on the off hand.
    expect(mainHand).toBeCloseTo(offHand, 6);
    expect(mainHand).toBeCloseTo(28, 6);
  });

  it('leaves glancing alone, which depends on the defender and not on skill', () => {
    const player = wielder(BASE_SKILL + 5, BASE_SKILL);

    expect(table(player, 'mainHand').glance).toBe(table(player, 'offHand').glance);
  });
});
