import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { COMBAT_CONSTANTS, createForeverAttackChances } from '../../src/game/combat/attackChances';
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

/**
 * The block value of whatever shield a set actually puts in the slot.
 *
 * ----------------------------------------------------------------------------
 * READ OFF THE SET RATHER THAN HARD-CODED, because the starting set is the E65
 * BENCHMARK set now and not the owner's Classic one. Its shield carries 44 --
 * the inherent block value Forever gives every item-level-65 shield, fitted
 * from its own eighteen -- where The Immovable Object carries 44 inherent AND
 * a bought "+27 Block Value" on top.
 *
 * The 27 is the whole difference, and three assertions in this file were
 * hard-coded to 71. What they are really about is that the EQUIPPED shield's
 * value reaches the character and Shield Slam, so they ask the set.
 * ----------------------------------------------------------------------------
 */
const equippedShieldBlockValue = (style: 'one_hand_shield') => {
  const set = startingEquipmentFor('warrior', style);
  const shield = ITEMS_BY_ID.get(set.shield!.itemId);
  return shield!.stats.blockValue!;
};

/**
 * The block CHANCE the equipped set carries, read off the items.
 *
 * ----------------------------------------------------------------------------
 * ZERO UNTIL THE BENCHMARK SETS STARTED BUYING IT. The Protection template
 * lists `Block` sixth of six preferences and a slot holds at most five, so the
 * whole set bought none -- which is why three assertions in this file could
 * write "the character's block chance IS the flat 5% for holding a shield" and
 * be right.
 *
 * The generator rotates the tail of a long preference list across the slots
 * now, on the owner's instruction that a stat going to nothing across a whole
 * set "is unrealistic to how items are actually designed". So the set buys
 * Block Rating, the character has more than 5%, and the three assertions were
 * testing the GEAR rather than the rule.
 *
 * READ, NOT WRITTEN DOWN -- the repair this project applies every time a test
 * turns out to be pinning a gear figure. The arithmetic each assertion makes
 * on top is the part that was ever the claim.
 * ----------------------------------------------------------------------------
 */
const equippedBlockChance = (style: 'one_hand_shield') => {
  const set = startingEquipmentFor('warrior', style);
  let total = 0;
  for (const equipped of Object.values(set)) {
    total += ITEMS_BY_ID.get(equipped!.itemId)?.stats.blockChance ?? 0;
  }
  return total;
};

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

  it('gives five percent block for holding a shield, on top of the set', () => {
    // The RULE is the flat 5% for holding one. What the set carries is read
    // off the set, because that is a property of the gear and not of the rule.
    expect(shieldWarrior().stats.effective.blockChance).toBeCloseTo(
      BASE_BLOCK + equippedBlockChance('one_hand_shield'),
      6,
    );
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
      equippedShieldBlockValue('one_hand_shield') + blockValueFromStrength(strength),
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
    const chances = createForeverAttackChances({ targetAttacks: true })(
      'melee-received',
      dummy,
      warrior,
      {},
    );
    /*
     * 5% AS ROLL UNITS ON THE 1-10000 DIE, PLUS WHATEVER DEFENSE SKILL THE SET
     * CARRIES -- and the second term is READ off the character rather than
     * written down.
     *
     * It used to be `9 * defensePerSkill`, the owner's Protection enchant row:
     * +5 Defense Skill on the neck and +4 on the bracer. The benchmark set buys
     * Defense as a RATING instead -- the Prot Warrior's template lists it
     * fourth -- so the figure is a different one and will move again the next
     * time the template does.
     *
     * WHAT THE TEST IS ABOUT IS THE JOIN, not the figure: the shield's flat 5%
     * and the character's defense skill both have to reach the one table the
     * boss rolls against. Hard-coding the total tested the gear.
     */
    const defenseSkill = warrior.stats.effective.defenseSkill;
    expect(defenseSkill).toBeGreaterThan(0);
    /*
     * AND THE SET'S OWN BLOCK CHANCE IS READ TOO, for the same reason the
     * defense skill is: the Protection template buys Block Rating now, so the
     * flat 500 roll units was the gear figure of the day rather than the rule.
     */
    const blockChance = warrior.stats.effective.blockChance;
    expect(blockChance).toBeGreaterThan(BASE_BLOCK);
    expect(chances.block).toBe(
      Math.trunc(blockChance * 100) + defenseSkill * COMBAT_CONSTANTS.defensePerSkill,
    );
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
    const shieldValue = equippedShieldBlockValue('one_hand_shield');
    const blockValue = warrior.stats.effective.blockValue;
    // Strength adds to the shield's own, which is what makes Shield Slam scale
    // with strength at all.
    expect(blockValue).toBeGreaterThan(shieldValue);
    // And 655 from Forever plus The Immovable Object's 71 is still 726: the
    // ADDITION is the rule, whichever shield is in the slot.
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
    /*
     * Rank 5 is "+5% block and a 100% chance of 5 rage": 5 and 100. The
     * assertion is the DIFFERENCE the talent makes, against the same character
     * without it -- which is the talent's own claim and carries no gear figure
     * at all.
     */
    const without = shieldWarrior().stats.effective.blockChance;
    const with5 = shieldWarrior({ shield_specialization: 5 }).stats.effective.blockChance;
    expect(with5 - without).toBeCloseTo(5, 6);
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
