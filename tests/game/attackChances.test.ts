import { describe, expect, it } from 'vitest';
import type { CombatStyleId } from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  RAID_BOSS_ARMOR,
  RAID_BOSS_LEVEL,
  createTrainingDummy,
} from '../../src/game/actors/createTrainingDummy';
import { MAX_WEAPON_SKILL_AT_60 } from '../../src/game/actors/weapons';
import {
  COMBAT_CONSTANTS,
  createForeverAttackChances,
  critSuppression,
  dodgeFromSkill,
  glanceChance,
  glanceMultiplierRange,
  missFromSkill,
} from '../../src/game/combat/attackChances';

const boss = () => createTrainingDummy();

function warrior(combatStyle: CombatStyleId) {
  return createPlayer({ race: 'orc', characterClass: 'warrior', combatStyle });
}

const providerFor = (style: CombatStyleId) => createForeverAttackChances(() => style);

/** A level 60 character at capped skill against a level 63 boss. */
const SKILL = MAX_WEAPON_SKILL_AT_60; // 300
const DEFENSE = RAID_BOSS_LEVEL * 5; // 315
const GAP = DEFENSE - SKILL; // 15

describe('the skill gap that shapes everything', () => {
  it('puts a capped level 60 character 15 points behind a level 63 boss', () => {
    expect(SKILL).toBe(300);
    expect(DEFENSE).toBe(315);
    expect(GAP).toBe(15);
  });

  it('reads defense skill off the target level', () => {
    expect(boss().defenseSkill).toBe(315);
    expect(createTrainingDummy({ level: 60 }).defenseSkill).toBe(300);
  });

  it('gives a maxed weapon its declared skill', () => {
    expect(warrior('two_hander').weaponSkill('mainHand')).toBe(300);
  });
});

describe('miss from weapon skill', () => {
  it('uses the steeper formula past a 10-point gap', () => {
    // 600 + 15 * 20 = 900
    expect(missFromSkill(300, 315, 0, 0)).toBe(900);
  });

  it('uses the shallower formula within 10 points', () => {
    // 500 + 5 * 10 = 550
    expect(missFromSkill(300, 305, 0, 0)).toBe(550);
  });

  it('switches regime exactly above a 10-point gap', () => {
    // A 10-point gap is still the shallow formula; 11 is not.
    expect(missFromSkill(300, 310, 0, 0)).toBe(600); // 500 + 10 * 10
    expect(missFromSkill(300, 311, 0, 0)).toBe(820); // 600 + 11 * 20
  });

  it('adds the full dual-wield penalty', () => {
    expect(missFromSkill(300, 315, 0, 1900)).toBe(2800);
  });

  it('subtracts hit', () => {
    expect(missFromSkill(300, 315, 300, 0)).toBe(600);
  });

  it('floors at zero rather than going negative', () => {
    expect(missFromSkill(300, 315, 99_999, 0)).toBe(0);
  });

  it('rewards weapon skill above the baseline', () => {
    // Skill from a talent or racial closes the gap and reduces miss.
    expect(missFromSkill(305, 315, 0, 0)).toBeLessThan(missFromSkill(300, 315, 0, 0));
  });
});

describe('dodge from weapon skill', () => {
  it('is 6.5% at a 15-point gap', () => {
    // 500 + 15 * 10 = 650. Matches the flat 6.5% stated earlier.
    expect(dodgeFromSkill(300, 315)).toBe(650);
  });

  it('falls as skill rises', () => {
    expect(dodgeFromSkill(310, 315)).toBe(550);
    expect(dodgeFromSkill(315, 315)).toBe(500);
  });
});

describe('glancing blows', () => {
  it('is 40% against a level 63 target', () => {
    // 1000 + (315 - 300) * 200 = 4000. Matches the flat 40% stated earlier.
    expect(glanceChance(315)).toBe(4000);
  });

  it('depends on the target, not on the attacker skill', () => {
    // Training weapon skill does not reduce glancing.
    expect(glanceChance(315)).toBe(4000);
    expect(glanceChance(300)).toBe(1000);
  });

  it('deals 55% to 75% at a 15-point gap', () => {
    const range = glanceMultiplierRange(300, 315);
    // floor((1.3 - 0.75) * 100) = 55, floor((1.2 - 0.45) * 100) = 75
    expect(range.min).toBeCloseTo(0.55, 10);
    expect(range.max).toBeCloseTo(0.75, 10);
  });

  it('caps the ends at 91% and 99%', () => {
    const range = glanceMultiplierRange(315, 315);
    expect(range.min).toBeCloseTo(0.91, 10);
    expect(range.max).toBeCloseTo(0.99, 10);
  });

  it('hurts more as the gap widens', () => {
    const near = glanceMultiplierRange(310, 315);
    const far = glanceMultiplierRange(290, 315);
    expect(far.min).toBeLessThan(near.min);
    expect(far.max).toBeLessThan(near.max);
  });
});

describe('crit suppression', () => {
  it('removes 4.8 percentage points against a level 63 boss', () => {
    // 180 + 3 * 100 = 480
    expect(critSuppression(60, 63)).toBe(480);
  });

  it('is nothing against an equal or lower level target', () => {
    expect(critSuppression(60, 60)).toBe(0);
    expect(critSuppression(60, 55)).toBe(0);
  });

  it('erases an ungeared character crit entirely', () => {
    // An Orc Warrior has about 4.99% crit, which is less than the 4.8 point
    // penalty leaves room for.
    const player = warrior('two_hander');
    const chances = providerFor('two_hander')('melee-auto', player, boss());
    expect(player.stats.get('critChance')).toBeLessThan(6);
    expect(chances.crit).toBeLessThan(50); // under 0.5%
  });

  it('never goes below zero', () => {
    const player = createPlayer({ race: 'gnome', characterClass: 'mage' });
    const chances = providerFor('caster')('spell', player, boss());
    expect(chances.crit).toBeGreaterThanOrEqual(0);
  });
});

describe('melee auto-attack chances', () => {
  it('derives the whole table from the skill gap', () => {
    const chances = providerFor('two_hander')('melee-auto', warrior('two_hander'), boss());

    expect(chances.miss).toBe(900); // 9%
    expect(chances.dodge).toBe(650); // 6.5%
    expect(chances.glance).toBe(4000); // 40%
    expect(chances.glanceMultiplierMin).toBeCloseTo(0.55, 10);
    expect(chances.glanceMultiplierMax).toBeCloseTo(0.75, 10);
  });

  it('adds the dual-wield penalty to the main hand too', () => {
    // Both weapons are penalised, not just the off-hand.
    const player = warrior('dual_wield');
    const provider = providerFor('dual_wield');

    expect(provider('melee-auto', player, boss(), { slot: 'mainHand' }).miss).toBe(2800);
    expect(provider('melee-auto', player, boss(), { slot: 'offHand' }).miss).toBe(2800);
  });

  it('leaves a two-hander unpenalised', () => {
    const provider = providerFor('two_hander');
    expect(provider('melee-auto', warrior('two_hander'), boss(), { slot: 'mainHand' }).miss).toBe(
      900,
    );
  });
});

describe('melee special attack chances', () => {
  it('never carries the dual-wield penalty', () => {
    // A special is one strike, not one per hand.
    const chances = providerFor('dual_wield')('melee-special', warrior('dual_wield'), boss());
    expect(chances.miss).toBe(900);
  });

  it('keeps dodge but drops glancing', () => {
    const chances = providerFor('two_hander')('melee-special', warrior('two_hander'), boss());
    expect(chances.dodge).toBe(650);
    expect(chances.glance).toBe(0);
  });
});

describe('enemy parry', () => {
  it('applies only to 1H & Shield', () => {
    expect(
      providerFor('one_hand_shield')('melee-auto', warrior('one_hand_shield'), boss()).parry,
    ).toBe(COMBAT_CONSTANTS.enemyParry);

    for (const style of ['two_hander', 'dual_wield'] as CombatStyleId[]) {
      expect(providerFor(style)('melee-auto', warrior(style), boss()).parry, style).toBe(0);
    }
  });
});

describe('spell chances', () => {
  const mage = () => createPlayer({ race: 'gnome', characterClass: 'mage' });

  it('misses on a flat 17%, unaffected by weapon skill', () => {
    expect(providerFor('caster')('spell', mage(), boss()).miss).toBe(1700);
  });

  it('crits for 1.5x', () => {
    expect(providerFor('caster')('spell', mage(), boss()).critMultiplier).toBe(1.5);
  });

  it('cannot be dodged, parried or glanced', () => {
    const chances = providerFor('caster')('spell', mage(), boss());
    expect(chances.dodge).toBe(0);
    expect(chances.parry).toBe(0);
    expect(chances.glance).toBe(0);
  });
});

describe('the raid boss target', () => {
  it('is level 63 with 3731 armor by default', () => {
    expect(RAID_BOSS_LEVEL).toBe(63);
    expect(RAID_BOSS_ARMOR).toBe(3731);

    const target = boss();
    expect(target.level).toBe(63);
    expect(target.stats.get('armor')).toBe(3731);
  });
});
