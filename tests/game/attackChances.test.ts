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

/*
 * A provider for a STANDING target. Enemy parry is the only thing the
 * encounter decides, and a standing target does not parry -- so every table
 * below reads the same whichever style the character fights in, which is the
 * point: the style stopped being an input when the owner tied parry to whether
 * the target swings back.
 */
const providerFor = (_style: CombatStyleId) => createForeverAttackChances();

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
  /*
   * ==========================================================================
   * EIGHT PERCENT AGAINST A LEVEL 63 TARGET, NOT NINE, by the ruleset owner:
   * "The new melee and ranged attack miss chance against a level 63 target is
   * now 8% not 9%."
   *
   * WRITTEN OUT FROM THE RULE RATHER THAN READ OFF THE CONSTANTS, which is this
   * project's convention for a spec table and matters more than usual here --
   * the figure these tests used to assert was produced by the code and agreed
   * with nothing else. `BASE_CHANCES` originally carried `meleeMiss: 8` from the
   * owner's own combat table, and the commit deriving the table from weapon
   * skill raised it to 9% while recording in the docs that it had: "only miss
   * moves, from 8% to 9%". A test reading the constants passes either way.
   * ==========================================================================
   */
  it('is 8% at the 15-point gap every profile faces', () => {
    // 5% base + 15 points x 0.2% = 8%. The owner's figure, stated directly.
    expect(missFromSkill(300, 315, 0, 0)).toBe(800);
  });

  it('uses the shallower formula within 10 points', () => {
    // 500 + 5 * 10 = 550
    expect(missFromSkill(300, 305, 0, 0)).toBe(550);
  });

  it('changes only the PER-POINT rate at the regime boundary, not the base', () => {
    /*
     * THE BASE IS 5% ON BOTH SIDES and only the slope doubles, which is what
     * produces the owner's 8% rather than the 9% a second, higher base did.
     *
     * IT IS ALSO MONOTONIC NOW. The old pair jumped 6% to 8.2% across the
     * threshold; it goes 6% to 7.2%. Nothing in this project measures that --
     * no item grants weapon skill, so every character sits at a 15-point gap --
     * which is exactly why it is asserted here rather than left to a profile.
     */
    expect(missFromSkill(300, 310, 0, 0)).toBe(600); // 500 + 10 * 10
    expect(missFromSkill(300, 311, 0, 0)).toBe(720); // 500 + 11 * 20
    expect(missFromSkill(300, 311, 0, 0)).toBeGreaterThan(missFromSkill(300, 310, 0, 0));
  });

  it('adds the full dual-wield penalty', () => {
    expect(missFromSkill(300, 315, 0, 1900)).toBe(2700);
  });

  it('subtracts hit, and melee hit caps at 8 rather than 9', () => {
    expect(missFromSkill(300, 315, 300, 0)).toBe(500);
    /*
     * THE CAP MOVED WITH THE BASE, which is the consequence a reader would not
     * go looking for: melee and ranged have no miss FLOOR -- that is a spell
     * rule the owner stated for spells alone -- so the eighth point of hit is
     * the last one that buys anything and the ninth buys nothing.
     */
    expect(missFromSkill(300, 315, 800, 0)).toBe(0);
    expect(missFromSkill(300, 315, 700, 0)).toBe(100);
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

    expect(chances.miss).toBe(800); // 8%
    expect(chances.dodge).toBe(650); // 6.5%
    expect(chances.glance).toBe(4000); // 40%
    expect(chances.glanceMultiplierMin).toBeCloseTo(0.55, 10);
    expect(chances.glanceMultiplierMax).toBeCloseTo(0.75, 10);
  });

  it('adds the dual-wield penalty to the main hand too', () => {
    // Both weapons are penalised, not just the off-hand.
    const player = warrior('dual_wield');
    const provider = providerFor('dual_wield');

    expect(provider('melee-auto', player, boss(), { slot: 'mainHand' }).miss).toBe(2700);
    expect(provider('melee-auto', player, boss(), { slot: 'offHand' }).miss).toBe(2700);
  });

  it('leaves a two-hander unpenalised', () => {
    const provider = providerFor('two_hander');
    expect(provider('melee-auto', warrior('two_hander'), boss(), { slot: 'mainHand' }).miss).toBe(
      800,
    );
  });
});

describe('melee special attack chances', () => {
  it('never carries the dual-wield penalty', () => {
    // A special is one strike, not one per hand.
    const chances = providerFor('dual_wield')('melee-special', warrior('dual_wield'), boss());
    expect(chances.miss).toBe(800);
  });

  it('keeps dodge but drops glancing', () => {
    const chances = providerFor('two_hander')('melee-special', warrior('two_hander'), boss());
    expect(chances.dodge).toBe(650);
    expect(chances.glance).toBe(0);
  });
});

describe('enemy parry', () => {
  /*
   * ============================================================================
   * IT DEPENDS ON WHETHER THE TARGET SWINGS BACK, NOT ON THE WEAPON IN HAND.
   *
   * The ruleset owner: "when the Target Attacks Back checkbox in the Encounter
   * panel is selected, the target gains a 14% chance to parry you." The source
   * line it replaces said 14%, "0% if 1H & Shield is not selected", which was
   * read as a statement about the STYLE -- a shield tank stands in front of the
   * boss and everybody else is behind it.
   *
   * That reading was right about a shield tank and wrong in both directions
   * either side of it: a BEAR tanks without a shield and was never parried, and
   * the SHOCKADIN holds a shield against a dummy that never swings and was
   * being parried by it.
   * ============================================================================
   */
  const swinging = createForeverAttackChances({ targetAttacks: true });
  const standing = createForeverAttackChances({ targetAttacks: false });

  it('applies when the target swings back, whatever the character holds', () => {
    for (const style of ['one_hand_shield', 'two_hander', 'dual_wield'] as CombatStyleId[]) {
      expect(swinging('melee-auto', warrior(style), boss()).parry, style).toBe(
        COMBAT_CONSTANTS.enemyParry,
      );
    }
  });

  it('does not apply when it does not, whatever the character holds', () => {
    for (const style of ['one_hand_shield', 'two_hander', 'dual_wield'] as CombatStyleId[]) {
      expect(standing('melee-auto', warrior(style), boss()).parry, style).toBe(0);
    }
  });

  it('reaches the special table as well as the swing', () => {
    // "0% if 1H & Shield is not selected" was never about one table: a parry
    // is the target turning a blow aside, and a special is a blow.
    expect(swinging('melee-special', warrior('two_hander'), boss()).parry).toBe(
      COMBAT_CONSTANTS.enemyParry,
    );
  });

  it('defaults to off, so a provider built with no encounter rolls none', () => {
    expect(createForeverAttackChances()('melee-auto', warrior('one_hand_shield'), boss()).parry).toBe(0);
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
