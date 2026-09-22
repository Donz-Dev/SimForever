import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { WARRIOR_REACTIONS } from '../../src/game/reactions/warrior';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { SHIELD_SLAM_DAMAGE } from '../../src/game/abilities/warrior';
import { legalise } from '../helpers/legalTalents';

/*
 * The Immovable Object's own numbers, transcribed BY HAND from
 * https://www.wowhead.com/forever/item=19321 rather than read from the data.
 *
 * "44 Block" IS BLOCK VALUE, not block chance. This file used to say
 * otherwise, which gave the shield a 44% chance to block -- wrong in a way
 * that looks entirely plausible on a tank. The two block lines add:
 * 44 inherent + 27 bonus = 71.
 */
const SHIELD = { id: 19321, blockValue: 44 + 27, armor: 2468, stamina: 15 };

/** Block chance for holding a shield at all, before anything adds to it. */
const BASE_BLOCK = 5;

/** A point of strength is a twentieth of a point of block value. */
const blockValueFromStrength = (strength: number) => strength / 20;

/*
 * `createPlayer` strips talents whose tier gate or prerequisite is not met, so
 * `{ shield_slam: 1 }` alone -- a 31-point capstone needing Concussion Blow --
 * now builds a warrior with no Shield Slam. `legalise` pads the allocation up
 * to something a player could actually have.
 */
const shieldWarrior = (talents: Record<string, number> = {}) =>
  createPlayer({
    race: 'human',
    characterClass: 'warrior',
    combatStyle: 'one_hand_shield',
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    talents: legalise(talents),
  });

describe('a shield gives block chance and block value', () => {
  it('reads BLOCK VALUE off the item, and no block chance at all', () => {
    const item = ITEMS_BY_ID.get(SHIELD.id);
    expect(item?.stats.blockValue).toBe(SHIELD.blockValue);
    // A shield grants no chance. That comes from the flat 5% for holding one,
    // from talents, from defense skill and from Shield Block.
    expect(item?.stats.blockChance).toBeUndefined();
  });

  it('gives five percent block for holding a shield', () => {
    expect(shieldWarrior().stats.effective.blockChance).toBe(BASE_BLOCK);
  });

  it('adds the shield value and a twentieth of strength', () => {
    /*
     * Block value follows TOTAL strength, so it moves when anything buffs it
     * -- a Crusader proc is a hundred strength and five more block value.
     * Computing it once at creation would miss that.
     */
    const warrior = shieldWarrior();
    const strength = warrior.stats.effective.strength;
    expect(warrior.stats.effective.blockValue).toBeCloseTo(
      SHIELD.blockValue + blockValueFromStrength(strength),
      6,
    );
  });

  it('gives a warrior without a shield neither', () => {
    const dualWield = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });
    expect(dualWield.stats.effective.blockChance).toBe(0);
    // Block VALUE is not zero -- strength gives it -- but it can never be used,
    // because nothing without a shield ever rolls a block.
    expect(dualWield.stats.effective.blockValue).toBeGreaterThan(0);
  });

  it('reaches the attacks-received table', () => {
    const warrior = shieldWarrior();
    const dummy = createTrainingDummy({ name: 'D', health: 1000, armor: 0, level: 63 });
    const chances = createForeverAttackChances(() => 'one_hand_shield')(
      'melee-received',
      dummy,
      warrior,
      {},
    );
    // 5% as roll units on the 1-10000 die.
    expect(chances.block).toBe(500);
  });
});

describe('Shield Slam', () => {
  it('adds the block value of the shield being carried', () => {
    /*
     * "causing 421 to 439 damage, increased by your Block Value". The range is
     * rolled, so the assertion is on the BAND rather than a single number.
     */
    const warrior = shieldWarrior({ shield_slam: 1 });
    const slam = warrior.abilities.get('shield_slam');
    expect(slam).toBeDefined();

    /*
     * 655 from Forever plus the character's block value -- the shield's 71
     * and a twentieth of its strength, which is what makes Shield Slam scale
     * with strength at all.
     */
    const blockValue = warrior.stats.effective.blockValue;
    expect(blockValue).toBeGreaterThan(SHIELD.blockValue);
    expect(SHIELD_SLAM_DAMAGE + SHIELD.blockValue).toBe(726);
  });
});

describe('Revenge', () => {
  it('triggers on a block as well as a dodge and a parry', () => {
    const revenge = WARRIOR_REACTIONS.find((reaction) => reaction.id === 'revenge_on_avoid');
    expect(revenge).toBeDefined();
    // All three of the ways Classic opens the window. Block was missing until
    // the engine had the outcome, and Revenge caught two thirds of its chances.
    expect([...(revenge?.outcomes ?? [])].sort()).toEqual(['block', 'dodge', 'parry']);
  });
});

describe('Shield Specialization', () => {
  it('adds block chance from its FIRST value', () => {
    // Rank 5 is "+5% block and a 100% chance of 5 rage": 5 and 100. On top of
    // the flat 5% for holding a shield.
    const warrior = shieldWarrior({ shield_specialization: 5 });
    expect(warrior.stats.effective.blockChance).toBe(BASE_BLOCK + 5);
  });

  it('grants a rage reaction from its SECOND value', () => {
    const build = talentBuild('warrior', { shield_specialization: 5 });
    expect(build.reactions.map((reaction) => reaction.id)).toContain('shield_specialization');
    const reaction = build.reactions.find((r) => r.id === 'shield_specialization');
    // Fires on attacks RECEIVED, and only on a block.
    expect(reaction?.on).toBe('taken');
    expect(reaction?.outcomes).toEqual(['block']);
  });

  /*
   * This assertion used to be its exact opposite: it required the talent to
   * report that it could not fire because nothing attacked the player. That was
   * true when it was written and stopped being true when `targetAttacks`
   * landed, and the test went on enforcing the stale caveat rather than
   * catching it -- a test pinned to a temporary limitation outlives the
   * limitation. It now pins the thing that should stay true instead: both
   * halves are modelled, so the talent claims no gap.
   */
  it('reports no unmodelled gap, because both halves are implemented', () => {
    const build = talentBuild('warrior', { shield_specialization: 5 });
    expect(build.unmodelled.map((entry) => entry.talentId)).not.toContain(
      'shield_specialization',
    );
  });
});
