import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { WARRIOR_REACTIONS } from '../../src/game/reactions/warrior';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { SHIELD_SLAM_DAMAGE } from '../../src/game/abilities/warrior';

/*
 * The Immovable Object's own numbers, transcribed BY HAND from
 * https://www.wowhead.com/forever/item=19321 rather than read from the data.
 */
const SHIELD = { id: 19321, blockChance: 44, blockValue: 27, armor: 2468, stamina: 15 };

const shieldWarrior = (talents: Record<string, number> = {}) =>
  createPlayer({
    race: 'human',
    characterClass: 'warrior',
    combatStyle: 'one_hand_shield',
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    talents,
  });

describe('a shield gives block chance and block value', () => {
  it('reads both off the item', () => {
    const item = ITEMS_BY_ID.get(SHIELD.id);
    expect(item?.stats.blockChance).toBe(SHIELD.blockChance);
    expect(item?.stats.blockValue).toBe(SHIELD.blockValue);
  });

  it('carries them onto the character', () => {
    const warrior = shieldWarrior();
    expect(warrior.stats.effective.blockChance).toBe(SHIELD.blockChance);
    expect(warrior.stats.effective.blockValue).toBe(SHIELD.blockValue);
  });

  it('gives a warrior without a shield neither', () => {
    const dualWield = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });
    expect(dualWield.stats.effective.blockChance).toBe(0);
    expect(dualWield.stats.effective.blockValue).toBe(0);
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
    // 44% as roll units on the 1-10000 die.
    expect(chances.block).toBe(4400);
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
    expect(warrior.stats.effective.blockValue).toBe(SHIELD.blockValue);

    const min = SHIELD_SLAM_DAMAGE.min + SHIELD.blockValue;
    const max = SHIELD_SLAM_DAMAGE.max + SHIELD.blockValue;
    expect(min).toBe(448);
    expect(max).toBe(466);
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
    // Rank 5 is "+5% block and a 100% chance of 5 rage": 5 and 100.
    const warrior = shieldWarrior({ shield_specialization: 5 });
    expect(warrior.stats.effective.blockChance).toBe(SHIELD.blockChance + 5);
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
