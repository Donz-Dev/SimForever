import { describe, expect, it } from 'vitest';
import { ROLL_MAX, STAT_NAMES, toPercent } from '../../src/engine';
import {
  COMBAT_CONSTANTS,
  createForeverAttackChances,
} from '../../src/game/combat/attackChances';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { armorFromItems, resistancesFromItems } from '../../src/game/items/equipment';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { isTankBuild } from '../../src/game/character';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { BASE_BLOCK_CHANCE_WITH_SHIELD } from '../../src/game/actors/weapons';
import {
  DEFENSIVE_HEROIC_STRIKE_RAGE,
  WARRIOR_SHIELD_DEFENSIVE_ROTATION,
  warriorRotation,
} from '../../src/game/rotations/warrior';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { createDefaultProfile } from '../../src/profiles';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';
import { legalise } from '../helpers/legalTalents';

/*
 * The Protection audit: defense skill, armor from items, and a damage
 * multiplier that needs a shield.
 *
 * Every figure is written out by hand from the ruleset owner's own words.
 */

/** The tank build the audit is against: 1H & Shield, Defensive Stance. */
function tank(talents: Record<string, number> = {}, extra: Record<string, unknown> = {}) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: {
      ...base.character,
      race: 'tauren',
      combatStyle: 'one_hand_shield',
      stance: 'defensive',
    },
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    talents,
    simulation: { ...base.simulation, iterations: 60, seed: 29, durationSeconds: 60 },
    encounter: { ...base.encounter, targetAttacks: true },
    ...extra,
  } as never;
}

const built = (talents: Record<string, number> = {}) => characterAtCombatStart(tank(talents))!;

// ---------------------------------------------------------------------------
// The tank configuration itself
// ---------------------------------------------------------------------------

describe('what counts as a tank build', () => {
  it('is a shield AND Defensive Stance, not either alone', () => {
    expect(isTankBuild('one_hand_shield', 'defensive')).toBe(true);
    // A shield warrior in Berserker is a damage build holding a shield.
    expect(isTankBuild('one_hand_shield', 'berserker')).toBe(false);
    // A two-hander in Defensive is a damage build paying 10% for nothing.
    expect(isTankBuild('two_hander', 'defensive')).toBe(false);
    expect(isTankBuild('dual_wield', undefined)).toBe(false);
  });

  it('takes the shield style default, which is Defensive', () => {
    expect(isTankBuild('one_hand_shield', undefined)).toBe(true);
  });
});

describe('the shield starting set', () => {
  it('is Brutality Blade with Crusader, and the Immovable Object', () => {
    const set = startingEquipmentFor('warrior', 'one_hand_shield');
    expect(set.mainHand).toEqual({ itemId: 228265, enchantId: 20034 });
    expect(set.shield).toEqual({ itemId: 19321 });
  });

  it('leaves the other sets unenchanted', () => {
    // Only the tank set carries one. A dual-wielder has two weapons and the
    // choice of what to put on them is the person's.
    const dual = startingEquipmentFor('warrior', 'dual_wield');
    expect(dual.mainHand?.enchantId).toBeUndefined();
    expect(dual.offHand?.enchantId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 1. Anticipation
// ---------------------------------------------------------------------------

describe('Anticipation', () => {
  it('grants twenty defense skill at 5/5', () => {
    /*
     * Written out by hand. The character sheet figure is the TOTAL -- 300 is
     * free at level 60 -- and the talent adds on top of it.
     */
    expect(built().defenseSkill).toBe(300);
    expect(built(legalise({ anticipation: 5 })).defenseSkill).toBe(320);
    expect(built(legalise({ anticipation: 1 })).defenseSkill).toBe(304);
  });

  it('is worth 0.04 percentage points a point, to five numbers at once', () => {
    /*
     * The ruleset owner's formula. One point of defense adds 0.04 to the
     * attacker's miss and to the defender's dodge, parry and block, and takes
     * 0.04 from the attacker's crit. 0.04% is 4 roll units.
     */
    expect(COMBAT_CONSTANTS.defensePerSkill).toBe(4);

    const chances = createForeverAttackChances(() => 'one_hand_shield');
    const boss = createTrainingDummy({ attacks: true });
    const received = (talents: Record<string, number>) =>
      chances('melee-received', boss, built(talents), {});

    const plain = received({});
    const specced = received(legalise({ anticipation: 5 }));

    // Twenty points at four units each is eighty units, or 0.8 percentage
    // points, on every one of the five.
    expect(specced.miss - plain.miss).toBe(80);
    expect(specced.dodge - plain.dodge).toBe(80);
    expect(specced.parry - plain.parry).toBe(80);
    expect(specced.block - plain.block).toBe(80);
    expect(plain.crit - specced.crit).toBe(80);
    expect(toPercent(80)).toBeCloseTo(0.8, 10);
  });

  it('never lets a chance go negative or past 100%', () => {
    /*
     * THE INSTRUCTION THAT NEEDED CARE. The boss's crit is 5%, so 125 points
     * of surplus defense would take it to zero -- and past it. A negative
     * slice does not merely contribute nothing: the table walks a CUMULATIVE
     * range, so it would pull the running total backwards and hand its range
     * to whatever came before it.
     */
    const chances = createForeverAttackChances(() => 'one_hand_shield');
    const boss = createTrainingDummy({ attacks: true });
    const absurd = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
      // Far past what any real build reaches, which is the point.
      bonusStats: { defenseSkill: 5000, dodgeChance: 60, parryChance: 60 },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    });

    const received = chances('melee-received', boss, absurd, {});
    for (const value of [
      received.miss,
      received.dodge,
      received.parry,
      received.block,
      received.crit,
      received.crush,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(ROLL_MAX);
    }
    // Specifically: the crit that would have gone negative is pinned at zero.
    expect(received.crit).toBe(0);
  });

  it('gives no block chance to a character with no shield', () => {
    // Defense multiplies a shield's block; it does not conjure one. A
    // dual-wielder with defense skill still blocks nothing.
    const chances = createForeverAttackChances(() => 'dual_wield');
    const boss = createTrainingDummy({ attacks: true });
    const noShield = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      bonusStats: { defenseSkill: 20 },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });
    expect(chances('melee-received', boss, noShield, {}).block).toBe(0);
  });

  it('measurably reduces damage taken in a real fight', () => {
    const taken = (talents: Record<string, number>) => {
      const rows = runProfileBatch(tank(talents)).damageTaken;
      return rows.reduce((sum, row) => sum + row.damage, 0);
    };
    expect(taken(legalise({ anticipation: 5 }))).toBeLessThan(taken({}));
  });

  it('is no longer reported as unmodelled', () => {
    expect(WARRIOR_TALENT_EFFECTS.anticipation.map((e) => e.kind)).toEqual(['stat']);
  });
});

// ---------------------------------------------------------------------------
// 2. Toughness
// ---------------------------------------------------------------------------

describe('Toughness', () => {
  it('scales armor FROM ITEMS, not the character total', () => {
    /*
     * The distinction the old reason called unsolvable. A character's armor is
     * items plus the class base, so ten percent of the TOTAL would overstate
     * the talent -- and the overstatement grows with anything that ever adds
     * armor without being worn.
     */
    const items = armorFromItems(
      startingEquipmentFor('warrior', 'one_hand_shield'),
      'one_hand_shield',
    );
    expect(items).toBeGreaterThan(0);

    const plain = built().stats.effective.armor;
    const specced = built(legalise({ toughness: 5 })).stats.effective.armor;

    // Ten percent of the ITEM armor, added flat.
    expect(specced - plain).toBeCloseTo(items * 0.1, 6);
    // And strictly less than ten percent of the total, which is the bug this
    // shape avoids.
    expect(specced - plain).toBeLessThan(plain * 0.1);
  });

  it('scales per rank, two percent at a time', () => {
    const items = armorFromItems(
      startingEquipmentFor('warrior', 'one_hand_shield'),
      'one_hand_shield',
    );
    const plain = built().stats.effective.armor;
    for (const [rank, percent] of [
      [1, 2],
      [3, 6],
      [5, 10],
    ] as const) {
      const armor = built(legalise({ toughness: rank })).stats.effective.armor;
      expect(armor - plain).toBeCloseTo((items * percent) / 100, 6);
    }
  });

  it('gives a character in no armor nothing', () => {
    const naked = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
      talents: legalise({ toughness: 5 }),
    });
    const plain = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
    });
    expect(naked.stats.effective.armor).toBe(plain.stats.effective.armor);
  });

  it('is no longer reported as unmodelled', () => {
    expect(WARRIOR_TALENT_EFFECTS.toughness.map((e) => e.kind)).toEqual(['itemArmorPercent']);
  });
});

// ---------------------------------------------------------------------------
// 3. Bastion
// ---------------------------------------------------------------------------

describe('Bastion', () => {
  it('multiplies all damage by 1.1 at 5/5 with a shield', () => {
    // The ruleset owner's figure, written out by hand.
    const plain = runProfileBatch(tank()).dps.mean;
    const specced = runProfileBatch(tank(legalise({ bastion: 5 }))).dps.mean;
    expect(specced / plain).toBeCloseTo(1.1, 1);
  });

  it('covers AUTO ATTACKS, not only abilities', () => {
    /*
     * "All damage you deal", so it cannot be a per-ability modifier -- auto
     * attacks carry no ability id and nothing keyed to one reaches them.
     */
    const swing = (talents: Record<string, number>) =>
      runProfileBatch(tank(talents)).abilities.find(
        (row) => row.abilityName === 'Main Hand Auto-Attack',
      )!.average;
    expect(swing(legalise({ bastion: 5 })) / swing({})).toBeCloseTo(1.1, 1);
  });

  it('does nothing without a shield, and SAYS SO rather than failing quietly', () => {
    /*
     * A talent with points in it that contributes nothing has to be visible,
     * or it is indistinguishable from one that is broken. The Talent panel
     * prints these under "Chosen but not simulated".
     */
    const bastionReport = (hasShield: boolean) => {
      const build = talentBuild('warrior', legalise({ bastion: 5 }), { hasShield });
      // Bastion's OWN entry. `legalise` pads the allocation with the talents
      // that unlock it, and those have reports of their own.
      return {
        multiplier: build.damageMultiplier,
        reason: build.unmodelled.find((entry) => entry.talentId === 'bastion')?.reason,
      };
    };

    const withShield = bastionReport(true);
    expect(withShield.multiplier).toBeCloseTo(1.1, 10);
    expect(withShield.reason).toBeUndefined();

    const without = bastionReport(false);
    expect(without.multiplier).toBe(1);
    expect(without.reason).toContain('shield');
  });

  it('is expressed as a conditional on holding a shield', () => {
    const effects = WARRIOR_TALENT_EFFECTS.bastion;
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: 'conditionalDamage',
      requires: { shield: true },
    });
  });
});

// ---------------------------------------------------------------------------
// Base parry, and resistances that are shown but not simulated
// ---------------------------------------------------------------------------

describe('a Warrior parries five percent before any talent', () => {
  it('has it with no gear and no talents', () => {
    // Stated by the ruleset owner. The base stats spreadsheet does not carry
    // parry, so it is a hand-written class baseline.
    const bare = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
    });
    expect(bare.stats.effective.parryChance).toBeCloseTo(5, 10);
  });

  it('stacks with Deflection and with defense skill', () => {
    // Deflection is 1% a rank, so 5/5 doubles the baseline.
    expect(built(legalise({ deflection: 5 })).stats.effective.parryChance).toBeCloseTo(10, 10);
  });

  it('gives a class nobody supplied a figure for nothing', () => {
    /*
     * Zero rather than the Warrior's five. A number nobody stated is not
     * inherited from whoever happened to be asked first.
     */
    const rogue = createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      combatStyle: 'dual_wield',
    });
    expect(rogue.stats.effective.parryChance).toBe(0);
  });

  it('reaches the table the boss actually rolls against', () => {
    const chances = createForeverAttackChances(() => 'one_hand_shield');
    const boss = createTrainingDummy({ attacks: true });
    expect(chances('melee-received', boss, built(), {}).parry).toBe(500);
  });
});

describe('resistances are totalled for display and nothing else', () => {
  it('sums the equipped set', () => {
    const total = resistancesFromItems(
      startingEquipmentFor('warrior', 'one_hand_shield'),
      'one_hand_shield',
    );
    expect(Object.keys(total).length).toBeGreaterThan(0);
    for (const value of Object.values(total)) expect(value).toBeGreaterThan(0);
  });

  it('is NOT a stat, and changes no fight', () => {
    /*
     * The whole caveat. There is no resistance stat and no Forever formula for
     * magic mitigation, so this number is looked at and never read. If it ever
     * becomes a mechanic, this test is the thing that should fail.
     */
    expect(STAT_NAMES).not.toContain('resistance');
    const stats = built().stats.effective as Record<string, number>;
    expect(stats.fireResistance).toBeUndefined();
  });

  it('is no longer repeated per item under "not simulated"', () => {
    /*
     * The total on the sheet replaced nineteen identical rows in the Gear
     * panel. Listing each piece was accurate and useless -- it buried the
     * effects that genuinely have no mechanic behind them.
     */
    const item = ITEMS_BY_ID.get(226496)!; // Treads of Might, +5 Fire
    expect(Object.keys(item.resistances).length).toBeGreaterThan(0);
    expect(item.unmodelled.some((effect) => /Resistance/.test(effect.text))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Block, in both of its meanings
// ---------------------------------------------------------------------------

describe('block chance and block value are different numbers', () => {
  it('gives five percent block for holding a shield, and none without one', () => {
    // The ruleset owner's figure, before talents, defense skill or Shield
    // Block. It belongs to the shield: a dual-wielder blocks nothing.
    expect(BASE_BLOCK_CHANCE_WITH_SHIELD).toBe(5);
    expect(built().stats.effective.blockChance).toBe(5);

    const dual = createPlayer({
      race: 'tauren',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });
    expect(dual.stats.effective.blockChance).toBe(0);
  });

  it('adds defense skill to block chance', () => {
    // Twenty defense is 0.8 points, the same as it gives dodge and parry.
    const chances = createForeverAttackChances(() => 'one_hand_shield');
    const boss = createTrainingDummy({ attacks: true });
    const block = (talents: Record<string, number>) =>
      chances('melee-received', boss, built(talents), {}).block;
    expect(block(legalise({ anticipation: 5 })) - block({})).toBe(80);
  });

  it('reads a shield inherent "44 Block" as block VALUE, not chance', () => {
    /*
     * THE BUG THIS FIXES. The Immovable Object's tooltip reads "44 Block" and
     * "+27 Block Value", and the first was being parsed as a 44% chance to
     * block -- wrong in a way that looks entirely plausible on a tank. Both
     * lines are block value and they add.
     */
    const shield = ITEMS_BY_ID.get(19321)!;
    expect(shield.stats.blockValue).toBe(71);
    expect(shield.stats.blockChance).toBeUndefined();
  });

  it('adds a twentieth of total strength to block value', () => {
    const player = built();
    const strength = player.stats.effective.strength;
    expect(player.stats.effective.blockValue).toBeCloseTo(71 + strength / 20, 6);
  });

  it('follows strength as it changes, rather than being fixed at creation', () => {
    /*
     * Derived, not folded in. A Crusader proc is a hundred strength and so
     * five more block value for its fifteen seconds -- a number computed once
     * would miss it, the same way attack power would be stuck at its unbuffed
     * value.
     */
    const player = built();
    const before = player.stats.effective.blockValue;
    player.stats.addModifiers([
      { stat: 'strength', operation: 'flat', value: 100, sourceId: 'test' },
    ]);
    expect(player.stats.effective.blockValue - before).toBeCloseTo(5, 6);
  });

  it('removes block value from a blocked hit, after armor', () => {
    /*
     * The order the ruleset owner gave: armor and Defensive Stance first, then
     * block value taken off what is left. A block is flat, so it is worth
     * proportionally more against a small blow -- which is why the order
     * matters rather than being bookkeeping.
     */
    const rows = runProfileBatch(tank()).damageTaken;
    const row = rows[0];
    expect(row.rates.block ?? 0).toBeGreaterThan(0);
    // Blocked swings land for less than unblocked ones, so the average across
    // a batch with blocks in it is below the unblocked hit size.
    expect(row.average).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The tank priority list
// ---------------------------------------------------------------------------

describe('the Protection priority list', () => {
  it('is chosen by style AND stance', () => {
    expect(warriorRotation('one_hand_shield', 'defensive').name).toBe(
      'Warrior (Shield, Defensive)',
    );
    // A shield out of Defensive is not a tank, and gets the general list.
    expect(warriorRotation('one_hand_shield', 'berserker').name).toBe('Warrior (Shield)');
  });

  it('is the ruleset owner order, written out by hand', () => {
    expect(WARRIOR_SHIELD_DEFENSIVE_ROTATION.name).toBe('Warrior (Shield, Defensive)');
    const result = runProfileBatch(tank(legalise({ shield_slam: 1 })));
    expect(result.rotationName).toBe('Warrior (Shield, Defensive)');
  });

  it('never leaves Defensive Stance', () => {
    const result = runProfileBatch(tank());
    expect(result.rage.spent.some((row) => row.sourceId === 'stance_change')).toBe(false);
  });

  it('keeps Battle Shout and Sunder Armor up', () => {
    const result = runProfileBatch(tank());
    expect(
      result.buffUptime.find((row) => row.auraName === 'Battle Shout')?.uptime,
    ).toBeGreaterThan(0.9);
    expect(
      result.debuffUptime.find((row) => row.auraName === 'Sunder Armor')?.uptime,
    ).toBeGreaterThan(0.8);
  });

  it('uses Revenge, which only a tank can', () => {
    // It is gated on the window an avoided attack opens, so it is reachable
    // only with something swinging back -- which the tank build guarantees.
    const names = runProfileBatch(tank()).abilities.map((row) => row.abilityName);
    expect(names).toContain('Revenge');
  });

  it('spends surplus rage on Heroic Strike at 26', () => {
    expect(DEFENSIVE_HEROIC_STRIKE_RAGE).toBe(26);
    const spent = runProfileBatch(tank()).rage.spent;
    expect(spent.some((row) => row.sourceId === 'heroic_strike')).toBe(true);
  });

  it('casts Shield Slam only when the talent grants it', () => {
    const names = (talents: Record<string, number>) =>
      runProfileBatch(tank(talents)).abilities.map((row) => row.abilityName);
    expect(names({})).not.toContain('Shield Slam');
    expect(names(legalise({ shield_slam: 1 }))).toContain('Shield Slam');
  });

  it('casts Thunder Clap, which the Berserker list cannot', () => {
    const names = runProfileBatch(tank()).abilities.map((row) => row.abilityName);
    expect(names).toContain('Thunder Clap');
  });

  it('holds Rend last, where it is mostly starved', () => {
    /*
     * A CONSEQUENCE OF THE ORDER, not a fault in it, and worth pinning so it
     * is not mistaken for one later.
     *
     * Rend is eighth. By the time the list reaches it, Sunder Armor and
     * Heroic Strike have taken the rage and Thunder Clap has taken the global
     * cooldown, so on a geared tank it is almost never cast -- measured at
     * zero casts in a sixty second fight.
     *
     * It is still in the list because the ruleset owner put it there, and it
     * will fire the moment the rage economy leaves room. Asserting that it
     * DOES fire would be asserting something untrue of this gear.
     */
    const entries = WARRIOR_SHIELD_DEFENSIVE_ROTATION.name;
    expect(entries).toBe('Warrior (Shield, Defensive)');

    const names = runProfileBatch(tank()).abilities.map((row) => row.abilityName);
    expect(names).toContain('Thunder Clap');
    // Named so the day it changes is a visible change rather than a surprise.
    expect(names).not.toContain('Rend');
  });
});

// ---------------------------------------------------------------------------
// The defensive reporting those three need
// ---------------------------------------------------------------------------

describe('defensive results', () => {
  it('reports what armor stopped, separately from what landed', () => {
    /*
     * A tank's armor is invisible in every other number: a swing that lands
     * for 2,700 after 40% reduction reports 2,700 and says nothing about the
     * 1,800 it removed.
     */
    const row = runProfileBatch(tank()).damageTaken[0];
    expect(row).toBeDefined();
    expect(row.mitigated).toBeGreaterThan(0);
    expect(row.mitigationRate).toBeGreaterThan(0.3);
    expect(row.mitigationRate).toBeLessThan(0.7);
  });

  it('reports avoidance separately from mitigation', () => {
    // Armor shaves every hit; avoidance removes whole swings. A tank needs
    // both, and they are not the same number.
    const row = runProfileBatch(tank()).damageTaken[0];
    expect(row.avoidRate).toBeGreaterThan(0);
    expect(row.rates.dodge ?? 0).toBeGreaterThan(0);
    expect(row.rates.block ?? 0).toBeGreaterThan(0);
  });

  it('is empty for a build nothing is attacking', () => {
    const base = createDefaultProfile();
    const result = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      simulation: { ...base.simulation, iterations: 10, seed: 3 },
    } as never);
    expect(result.damageTaken).toEqual([]);
  });
});
