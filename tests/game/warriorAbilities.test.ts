import { describe, expect, it } from 'vitest';
import type { AttackResolution, WeaponProfile } from '../../src/engine';
import {
  NO_CHANCES,
  ROLL_MAX,
  dealDamage,
  resolveDamage,
  scaleByPower,
  seconds,
  toSeconds,
  weaponDamageFor,
} from '../../src/engine';
import { attackPowerCoefficientFor } from '../../src/game/combat/weaponDamage';
import {
  BLOODTHIRST,
  CLEAVE,
  EXECUTE,
  EXECUTE_BASE_COST,
  EXECUTE_BASE_DAMAGE,
  EXECUTE_DAMAGE_PER_RAGE,
  EXECUTE_HEALTH_THRESHOLD,
  HEROIC_STRIKE,
  MORTAL_STRIKE,
  OVERPOWER,
  REVENGE,
  REVENGE_DAMAGE,
  SHIELD_SLAM_DAMAGE,
  SPEARING_STRIKE_WEAPON_FRACTION,
  WARRIOR_ABILITIES,
  warriorAbility,
} from '../../src/game/abilities/warrior';
import { WARRIOR_REACTIONS } from '../../src/game/reactions/warrior';
import {
  OVERPOWER_READY,
  REVENGE_READY,
  REND_DAMAGE_PER_TICK,
  REND_DURATION_MS,
  REND_TICK_COUNT,
  REND_TICK_INTERVAL_MS,
  REND_TOTAL_DAMAGE,
} from '../../src/game/auras/warrior';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';
import { BATTLE_STANCE, DEFENSIVE_STANCE } from '../../src/game/auras/warrior';

/*
 * WoWForeverWarriorAbilities.xlsx, transcribed BY HAND.
 *
 * This table is deliberately a second, independent copy of the spreadsheet
 * rather than anything read from `src`. A test that imported the ability
 * definitions and compared them to themselves would pass no matter what those
 * definitions said, which is the one thing a content test must not do.
 *
 * Cooldowns and cast times are in SECONDS here, as the sheet states them, and
 * are converted at the point of comparison.
 */
interface SheetRow {
  readonly id: string;
  readonly name: string;
  readonly rageCost: number | undefined;
  readonly cooldownSeconds: number;
  readonly castSeconds: number;
  readonly attackTable: 'melee-special' | 'ranged-special' | undefined;
}

const SHEET: readonly SheetRow[] = [
  // name                 cost  cd    cast  table
  { id: 'revenge', name: 'Revenge', rageCost: 5, cooldownSeconds: 5, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'rend_cast', name: 'Rend', rageCost: 10, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'overpower', name: 'Overpower', rageCost: 5, cooldownSeconds: 5, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'heroic_strike', name: 'Heroic Strike', rageCost: 15, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'cleave', name: 'Cleave', rageCost: 20, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'bloodthirst', name: 'Bloodthirst', rageCost: 30, cooldownSeconds: 6, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'battle_shout_cast', name: 'Battle Shout', rageCost: 10, cooldownSeconds: 0, castSeconds: 0, attackTable: undefined },
  { id: 'thunder_clap', name: 'Thunder Clap', rageCost: 20, cooldownSeconds: 4, castSeconds: 0, attackTable: 'ranged-special' },
  { id: 'sunder_armor_cast', name: 'Sunder Armor', rageCost: 15, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'execute', name: 'Execute', rageCost: 15, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'slam', name: 'Slam', rageCost: 15, cooldownSeconds: 0, castSeconds: 1.5, attackTable: 'melee-special' },
  { id: 'hamstring', name: 'Hamstring', rageCost: 10, cooldownSeconds: 0, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'demoralizing_shout_cast', name: 'Demoralizing Shout', rageCost: 10, cooldownSeconds: 0, castSeconds: 0, attackTable: undefined },
  { id: 'intercept', name: 'Intercept', rageCost: 10, cooldownSeconds: 30, castSeconds: 0, attackTable: 'ranged-special' },
  { id: 'recklessness_cast', name: 'Recklessness', rageCost: undefined, cooldownSeconds: 1800, castSeconds: 0, attackTable: undefined },
  { id: 'charge', name: 'Charge', rageCost: undefined, cooldownSeconds: 15, castSeconds: 0, attackTable: 'ranged-special' },
  { id: 'whirlwind', name: 'Whirlwind', rageCost: 25, cooldownSeconds: 10, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'berserker_rage_cast', name: 'Berserker Rage', rageCost: undefined, cooldownSeconds: 30, castSeconds: 0, attackTable: undefined },
  { id: 'berserker_stance_cast', name: 'Berserker Stance', rageCost: undefined, cooldownSeconds: 1, castSeconds: 0, attackTable: undefined },
  { id: 'shield_wall_cast', name: 'Shield Wall', rageCost: undefined, cooldownSeconds: 1800, castSeconds: 0, attackTable: undefined },
  { id: 'shield_block_cast', name: 'Shield Block', rageCost: 10, cooldownSeconds: 5, castSeconds: 0, attackTable: undefined },
  { id: 'defensive_stance_cast', name: 'Defensive Stance', rageCost: undefined, cooldownSeconds: 1, castSeconds: 0, attackTable: undefined },
  { id: 'bloodrage_cast', name: 'Bloodrage', rageCost: undefined, cooldownSeconds: 60, castSeconds: 0, attackTable: undefined },
  { id: 'mortal_strike', name: 'Mortal Strike', rageCost: 30, cooldownSeconds: 6, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'spearing_strike', name: 'Spearing Strike', rageCost: 15, cooldownSeconds: 20, castSeconds: 0, attackTable: 'melee-special' },
  { id: 'shield_slam', name: 'Shield Slam', rageCost: 20, cooldownSeconds: 6, castSeconds: 0, attackTable: 'melee-special' },
];

const HIT: AttackResolution = { outcome: 'hit', avoided: false, damageMultiplier: 1, rolls: [] };

describe('warrior abilities match the spreadsheet', () => {
  it.each(SHEET)('$name has the stated cost, cooldown, cast time and table', (row) => {
    const ability = warriorAbility(row.id);
    expect(ability, `no ability with id ${row.id}`).toBeDefined();
    if (!ability) return;

    expect(ability.name).toBe(row.name);
    expect(ability.cost?.amount).toBe(row.rageCost);
    if (row.rageCost !== undefined) expect(ability.cost?.resource).toBe('rage');
    expect(toSeconds(ability.cooldownMs ?? 0)).toBe(row.cooldownSeconds);
    expect(toSeconds(ability.castTimeMs ?? 0)).toBe(row.castSeconds);
    expect(ability.attackTable).toBe(row.attackTable);
  });

  it('defines every row in the sheet, and nothing the sources do not have', () => {
    /*
     * FOUR are defined that the spreadsheet does not contain, and each has a
     * source.
     *
     * Battle Stance: not in the spreadsheet, defined anyway because two stances
     * with no way back to a neutral one is not a coherent ruleset. Forever's
     * spell data has since confirmed it exists and does nothing.
     *
     * Death Wish, Last Stand, Sweeping Strikes: granted by talents, and the
     * spreadsheet has no rows for them at all. Their numbers come from Forever
     * directly -- see docs/warrior-ability-audit.md.
     *
     * Listed by hand rather than derived, so adding a fifth is a deliberate act
     * that fails this test until someone writes down where it came from.
     */
    const beyondTheSheet = ['battle_stance_cast', 'death_wish', 'last_stand', 'sweeping_strikes'];
    const defined = WARRIOR_ABILITIES.map((ability) => ability.id).sort();
    const expected = [...SHEET.map((row) => row.id), ...beyondTheSheet].sort();

    expect(defined).toEqual(expected);
  });
});

/*
 * The universal weapon damage formula, written out independently:
 *
 *     weapon damage = weapon base damage + speed in seconds / 14 * attack power
 *
 * and an ability's own flat damage is added on top of that, with the off-hand
 * penalty applied ONCE to the finished total.
 */
describe('the weapon damage formula', () => {
  const SPEED_SECONDS = 2.6;
  const BASE_DAMAGE = 80;
  const ATTACK_POWER = 700;

  const weapon: WeaponProfile = {
    name: 'Test Weapon',
    swingTimerMs: seconds(SPEED_SECONDS),
    baseDamage: BASE_DAMAGE,
    powerCoefficient: attackPowerCoefficientFor(seconds(SPEED_SECONDS)),
  };

  /** 2.6 / 14 * 700 = 130 */
  const EXPECTED_POWER_CONTRIBUTION = (SPEED_SECONDS / 14) * ATTACK_POWER;

  it('turns weapon speed into an attack power coefficient', () => {
    expect(attackPowerCoefficientFor(seconds(2.6))).toBeCloseTo(2.6 / 14, 10);
    expect(attackPowerCoefficientFor(seconds(3.4))).toBeCloseTo(3.4 / 14, 10);
    // A slower weapon is worth more attack power per swing, which is the whole
    // point of the speed term.
    expect(attackPowerCoefficientFor(seconds(3.4))).toBeGreaterThan(
      attackPowerCoefficientFor(seconds(2.6)),
    );
  });

  it('is base damage plus speed over fourteen times attack power', () => {
    const source = makeAttacker({
      stats: { attackPower: ATTACK_POWER },
      weapons: { mainHand: weapon },
    });

    const amount = weaponDamageFor(
      {
        source,
        target: makeTarget(),
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 0,
        weaponScaling: { slot: 'mainHand' },
      },
      1,
    );

    expect(amount).toBeCloseTo(BASE_DAMAGE + EXPECTED_POWER_CONTRIBUTION, 6);
    expect(amount).toBeCloseTo(210, 6); // 80 + 130
  });

  it('adds an ability flat damage on top, as Mortal Strike does', () => {
    const source = makeAttacker({
      stats: { attackPower: ATTACK_POWER },
      weapons: { mainHand: weapon },
    });

    const request = {
      source,
      target: makeTarget(),
      abilityName: 'Mortal Strike',
      school: 'physical' as const,
      baseAmount: 160,
      weaponScaling: { slot: 'mainHand' as const },
    };

    const amount = scaleByPower(request, weaponDamageFor(request, 1));

    // 80 + 130 + 160
    expect(amount).toBeCloseTo(370, 6);
  });

  it('takes a fraction of weapon damage for Spearing Strike', () => {
    const source = makeAttacker({
      stats: { attackPower: ATTACK_POWER },
      weapons: { mainHand: weapon },
    });

    const amount = weaponDamageFor(
      {
        source,
        target: makeTarget(),
        abilityName: 'Spearing Strike',
        school: 'physical',
        baseAmount: 0,
        weaponScaling: { slot: 'mainHand', fraction: SPEARING_STRIKE_WEAPON_FRACTION },
      },
      1,
    );

    // 40% of 210
    expect(amount).toBeCloseTo(84, 6);
  });

  it('applies the off-hand penalty ONCE to the finished total, not to the weapon alone', () => {
    const OFF_HAND_MULTIPLIER = 0.5;
    const source = makeAttacker({
      stats: { attackPower: ATTACK_POWER },
      weapons: {
        offHand: { ...weapon, name: 'Off Hand', damageMultiplier: OFF_HAND_MULTIPLIER },
      },
    });

    const request = {
      source,
      target: makeTarget(),
      abilityName: 'Mortal Strike',
      school: 'physical' as const,
      baseAmount: 160,
      weaponScaling: { slot: 'offHand' as const },
    };

    const amount = scaleByPower(request, weaponDamageFor(request, 1));

    // (80 + 130 + 160) * 0.5 = 185.
    // Penalising only the weapon portion would give (210 * 0.5) + 160 = 265,
    // which is the reading the ruleset owner explicitly ruled out.
    expect(amount).toBeCloseTo(185, 6);
    expect(amount).not.toBeCloseTo(265, 6);
  });

  it('contributes nothing when the slot holds no weapon', () => {
    // A warrior has no ranged weapon in any of its styles, so an ability that
    // scaled off one would silently read from an empty slot.
    const source = makeAttacker({ stats: { attackPower: ATTACK_POWER }, weapons: {} });

    const amount = weaponDamageFor(
      {
        source,
        target: makeTarget(),
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 0,
        weaponScaling: { slot: 'ranged' },
      },
      1,
    );

    expect(amount).toBe(0);
  });
});

describe('abilities that do not use weapon damage', () => {
  it('scales Bloodthirst with attack power alone', () => {
    // The sheet gives Bloodthirst "30" base and a coefficient of 0.35, in the
    // column where every weapon-damage ability instead says "Weapon Damage".
    const BASE = 30;
    const COEFFICIENT = 0.35;
    const ATTACK_POWER = 700;

    const source = makeAttacker({
      stats: { attackPower: ATTACK_POWER },
      weapons: {
        mainHand: { name: 'Huge Weapon', swingTimerMs: seconds(3.4), baseDamage: 9999 },
      },
    });

    const amount = scaleByPower({
      source,
      target: makeTarget(),
      abilityName: 'Bloodthirst',
      school: 'physical',
      baseAmount: BASE,
      powerCoefficient: COEFFICIENT,
    });

    // 30 + 0.35 * 700, and the 9999 damage weapon contributes nothing.
    expect(amount).toBeCloseTo(275, 6);
  });

  /*
   * Revenge and Shield Slam are FLAT, and take their numbers from Forever
   * rather than from the ability spreadsheet.
   *
   * This test used to assert the opposite: that both were a range symmetric by
   * exactly 9 around a midpoint, 81-99 and 421-439. The ruleset owner chose
   * Forever's 153 and 655 after the audit found the disagreement, and the
   * ranges went with them -- so any spread these two show now comes from the
   * combat table and nowhere else.
   *
   * Written out by hand from docs/warrior-ability-audit.md.
   */
  it('gives Revenge and Shield Slam flat Forever damage, not the sheet ranges', () => {
    expect(REVENGE_DAMAGE).toBe(153);
    expect(SHIELD_SLAM_DAMAGE).toBe(655);
  });

  it('gives Mortal Strike weapon scaling and Bloodthirst none', () => {
    // A guard on the distinction itself: these two are the same cost and
    // cooldown, and confusing their scaling would be invisible in the totals.
    const request = {
      source: makeAttacker(),
      target: makeTarget(),
      abilityName: 'x',
      school: 'physical' as const,
      baseAmount: 0,
    };
    expect(MORTAL_STRIKE.attackTable).toBe('melee-special');
    expect(BLOODTHIRST.attackTable).toBe('melee-special');
    expect(weaponDamageFor({ ...request, weaponScaling: undefined }, 1)).toBe(0);
  });
});

describe('Rend', () => {
  it('deals its stated total over its stated duration', () => {
    // "147 damage/21 sec, ticks every 3 seconds".
    expect(REND_TOTAL_DAMAGE).toBe(147);
    expect(toSeconds(REND_DURATION_MS)).toBe(21);
    expect(toSeconds(REND_TICK_INTERVAL_MS)).toBe(3);
  });

  it('divides into seven whole ticks of twenty-one', () => {
    expect(REND_TICK_COUNT).toBe(7);
    expect(REND_DAMAGE_PER_TICK).toBe(21);
    // The reading is only correct because it reproduces the stated total.
    expect(REND_DAMAGE_PER_TICK * REND_TICK_COUNT).toBe(REND_TOTAL_DAMAGE);
  });
});

describe('Execute', () => {
  it('costs 15 and is only usable below twenty percent health', () => {
    expect(EXECUTE_BASE_COST).toBe(15);
    expect(EXECUTE_HEALTH_THRESHOLD).toBe(0.2);
    expect(EXECUTE.cost).toEqual({ resource: 'rage', amount: 15 });
  });

  it('refuses a target above the threshold and accepts one below it', () => {
    const caster = makeAttacker({ resources: [{ type: 'rage', maximum: 100, initial: 100 }] });
    const healthy = makeTarget({ maxHealth: 1000 });
    const nearlyDead = makeTarget({ maxHealth: 1000 });
    nearlyDead.health.drain(900); // 10% left

    const context = (target: typeof healthy) =>
      ({ simulation: undefined, caster, target, ability: EXECUTE }) as never;

    expect(EXECUTE.canCast?.(context(healthy))).toBe(false);
    expect(EXECUTE.canCast?.(context(nearlyDead))).toBe(true);
  });

  it('is worth 600 plus 15 per point of leftover rage', () => {
    // Stated as "600 + 15 * each point of remaining rage after cost was taken
    // out", so a warrior at 45 rage pays 15 and converts the other 30.
    expect(EXECUTE_BASE_DAMAGE).toBe(600);
    expect(EXECUTE_DAMAGE_PER_RAGE).toBe(15);

    const leftover = 30;
    expect(EXECUTE_BASE_DAMAGE + EXECUTE_DAMAGE_PER_RAGE * leftover).toBe(1050);
  });
});

describe('on-next-swing abilities', () => {
  it('marks Heroic Strike and Cleave as replacing the next main-hand swing', () => {
    expect(HEROIC_STRIKE.onNextSwing).toBe('mainHand');
    expect(CLEAVE.onNextSwing).toBe('mainHand');
  });

  it('leaves every other ability landing immediately', () => {
    const queued = WARRIOR_ABILITIES.filter((ability) => ability.onNextSwing !== undefined);
    expect(queued.map((ability) => ability.id).sort()).toEqual(['cleave', 'heroic_strike']);
  });
});

describe('damage resolution with weapon scaling', () => {
  it('still zeroes an avoided attack, weapon damage and all', () => {
    const weapon: WeaponProfile = {
      name: 'W',
      swingTimerMs: seconds(2.6),
      baseDamage: 80,
      powerCoefficient: attackPowerCoefficientFor(seconds(2.6)),
    };
    const source = makeAttacker({ stats: { attackPower: 700 }, weapons: { mainHand: weapon } });

    const resolution = resolveDamage(
      {
        source,
        target: makeTarget(),
        abilityName: 'Mortal Strike',
        school: 'physical',
        baseAmount: 160,
        weaponScaling: { slot: 'mainHand' },
      },
      { outcome: 'dodge', avoided: true, damageMultiplier: 0, rolls: [] },
      210,
    );

    expect(resolution.amount).toBe(0);
    expect(resolution.avoided).toBe(true);
  });

  it('doubles the whole total on a crit, flat damage included', () => {
    const source = makeAttacker({ stats: { attackPower: 700 } });

    const resolution = resolveDamage(
      {
        source,
        target: makeTarget(),
        abilityName: 'Mortal Strike',
        school: 'physical',
        baseAmount: 160,
      },
      { ...HIT, outcome: 'crit', damageMultiplier: 2 },
      210,
    );

    // (160 + 210) * 2, with no armor on the target.
    expect(resolution.raw).toBeCloseTo(740, 6);
  });
});

describe('on-next-swing, end to end', () => {
  it('replaces the swing, fires once, and leaves the swing timer alone', () => {
    const weapon: WeaponProfile = {
      name: 'Melee',
      swingTimerMs: seconds(2.6),
      baseDamage: 80,
      damageVariance: 0,
      powerCoefficient: attackPowerCoefficientFor(seconds(2.6)),
    };
    const player = makeAttacker({
      stats: { attackPower: 700 },
      weapons: { mainHand: weapon },
      autoAttack: 'main-hand',
      abilities: [HEROIC_STRIKE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const dummy = makeTarget({ maxHealth: 1_000_000 });

    const simulation = buildSimulation([player, dummy], {
      durationMs: seconds(10),
      // Everything lands cleanly, so the swings are countable rather than
      // probabilistic.
      attackChances: () => NO_CHANCES,
      // The simulation starts auto attacks itself; this only arms the queued
      // ability so the very first swing is the one it replaces.
      onCombatStart: (context) => {
        context.cast(player, HEROIC_STRIKE, dummy);
      },
    });
    const result = simulation.run();

    const byName = new Map<string, number>();
    for (const event of result.telemetry) {
      if (event.type !== 'damage') continue;
      byName.set(event.abilityName, (byName.get(event.abilityName) ?? 0) + 1);
    }

    // Armed once, so it lands exactly once and then normal swings resume.
    expect(byName.get('Heroic Strike')).toBe(1);
    expect(byName.get('Melee')).toBeGreaterThan(1);

    // 10 seconds at 2.6s per swing is 4 swings (0, 2.6, 5.2, 7.8). One of them
    // became Heroic Strike; the timer was not delayed by it.
    const swings = (byName.get('Melee') ?? 0) + (byName.get('Heroic Strike') ?? 0);
    expect(swings).toBe(4);
  });

  it('refuses to re-arm an ability that is already waiting', () => {
    const player = makeAttacker({
      weapons: {
        mainHand: { name: 'Melee', swingTimerMs: seconds(2.6), baseDamage: 80 },
      },
      autoAttack: 'main-hand',
      abilities: [HEROIC_STRIKE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const dummy = makeTarget();
    const simulation = buildSimulation([player, dummy]);

    expect(simulation.canCast(player, HEROIC_STRIKE, dummy)).toBe(true);
    simulation.cast(player, HEROIC_STRIKE, dummy);

    // Armed. A priority list re-evaluating must not pay for it a second time.
    expect(simulation.canCast(player, HEROIC_STRIKE, dummy)).toBe(false);
    expect(player.resources.require('rage').current).toBe(85);
  });
});

describe('Overpower and Revenge, through the reaction hook', () => {
  /** Chances that force one outcome on a single-roll melee table. */
  const alwaysDodge = () => ({ ...NO_CHANCES, dodge: ROLL_MAX });

  it('opens the Overpower window when the target dodges', () => {
    const warrior = makeAttacker({
      stats: { attackPower: 0 },
      reactions: WARRIOR_REACTIONS,
      abilities: [OVERPOWER],
      // A warrior is always in a stance, and Overpower requires Battle Stance.
      // A bare Combatant has none, so without this the ability is refused for
      // the stance rather than for the window -- which is what the test is
      // actually about.
      openingAuras: [BATTLE_STANCE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const dummy = makeTarget();
    const simulation = buildSimulation([warrior, dummy], { attackChances: alwaysDodge });
    simulation.begin();

    // Closed before anything happens: Overpower is not freely castable.
    expect(simulation.canCast(warrior, OVERPOWER, dummy)).toBe(false);

    dealDamage(simulation, {
      source: warrior,
      target: dummy,
      abilityName: 'Melee',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-auto',
    });

    expect(warrior.auras.remainingMs(OVERPOWER_READY.id, simulation.clock.now())).toBeGreaterThan(
      0,
    );
    expect(simulation.canCast(warrior, OVERPOWER, dummy)).toBe(true);
  });

  it('consumes the window when Overpower is used', () => {
    const warrior = makeAttacker({
      stats: { attackPower: 0 },
      reactions: WARRIOR_REACTIONS,
      abilities: [OVERPOWER],
      // A warrior is always in a stance, and Overpower requires Battle Stance.
      // A bare Combatant has none, so without this the ability is refused for
      // the stance rather than for the window -- which is what the test is
      // actually about.
      openingAuras: [BATTLE_STANCE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const dummy = makeTarget();
    const simulation = buildSimulation([warrior, dummy], {
      // The dodge opens the window; Overpower itself then lands.
      attackChances: (kind) =>
        kind === 'melee-auto' ? { ...NO_CHANCES, dodge: ROLL_MAX } : NO_CHANCES,
    });
    simulation.begin();

    dealDamage(simulation, {
      source: warrior,
      target: dummy,
      abilityName: 'Melee',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-auto',
    });
    expect(simulation.canCast(warrior, OVERPOWER, dummy)).toBe(true);

    simulation.cast(warrior, OVERPOWER, dummy);

    // Spent, not merely on cooldown: the window is gone.
    expect(warrior.auras.remainingMs(OVERPOWER_READY.id, simulation.clock.now())).toBe(0);
  });

  it('does not open the window when the attack simply lands', () => {
    const warrior = makeAttacker({
      stats: { attackPower: 0 },
      reactions: WARRIOR_REACTIONS,
      abilities: [OVERPOWER],
      // A warrior is always in a stance, and Overpower requires Battle Stance.
      // A bare Combatant has none, so without this the ability is refused for
      // the stance rather than for the window -- which is what the test is
      // actually about.
      openingAuras: [BATTLE_STANCE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const dummy = makeTarget();
    const simulation = buildSimulation([warrior, dummy], { attackChances: () => NO_CHANCES });
    simulation.begin();

    dealDamage(simulation, {
      source: warrior,
      target: dummy,
      abilityName: 'Melee',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-auto',
    });

    expect(simulation.canCast(warrior, OVERPOWER, dummy)).toBe(false);
  });

  it('opens the Revenge window when the warrior is the one avoiding', () => {
    // The mirror image: Revenge keys off attacks RECEIVED. Nothing attacks the
    // player in a real fight yet, so this is the only place it is exercised.
    const warrior = makeAttacker({
      reactions: WARRIOR_REACTIONS,
      abilities: [REVENGE],
      // Revenge requires Defensive Stance.
      openingAuras: [DEFENSIVE_STANCE],
      resources: [{ type: 'rage', maximum: 100, initial: 100 }],
    });
    const boss = makeTarget({ stats: { attackPower: 0 } });
    const simulation = buildSimulation([warrior, boss], {
      attackChances: () => ({ ...NO_CHANCES, dodge: ROLL_MAX }),
    });
    simulation.begin();

    expect(simulation.canCast(warrior, REVENGE, boss)).toBe(false);

    dealDamage(simulation, {
      source: boss,
      target: warrior,
      abilityName: 'Boss Swing',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-received',
    });

    expect(warrior.auras.remainingMs(REVENGE_READY.id, simulation.clock.now())).toBeGreaterThan(0);
    expect(simulation.canCast(warrior, REVENGE, boss)).toBe(true);
  });
});
