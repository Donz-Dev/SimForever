import { describe, expect, it } from 'vitest';
import type { DamageTelemetryEvent } from '../../src/engine';
import type { AttackResolution } from '../../src/engine';
import {
  ARMOR_CONSTANT,
  MAX_ARMOR_REDUCTION,
  armorReduction,
  dealDamage,
  resolveDamage,
  scaleByPower,
} from '../../src/engine';

/*
 * The combat table roll and the damage calculation are separate steps, so these
 * tests hand `resolveDamage` an explicit outcome rather than rolling for one.
 * That makes each case exact instead of probabilistic.
 */
const HIT: AttackResolution = {
  outcome: 'hit',
  avoided: false,
  damageMultiplier: 1,
  rolls: [],
};
const CRIT: AttackResolution = {
  outcome: 'crit',
  avoided: false,
  damageMultiplier: 2,
  rolls: [],
};
const GLANCE: AttackResolution = {
  outcome: 'glance',
  avoided: false,
  damageMultiplier: 0.7,
  rolls: [],
};
const MISS: AttackResolution = {
  outcome: 'miss',
  avoided: true,
  damageMultiplier: 0,
  rolls: [],
};
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

describe('scaleByPower', () => {
  it('adds attack power for physical damage', () => {
    const source = makeAttacker({ stats: { attackPower: 200, spellPower: 999 } });
    const target = makeTarget();

    const amount = scaleByPower({
      source,
      target,
      abilityName: 'Test',
      school: 'physical',
      baseAmount: 100,
      powerCoefficient: 0.5,
    });

    expect(amount).toBe(200); // 100 + 0.5 * 200
  });

  it('adds spell power for magical damage', () => {
    const source = makeAttacker({ stats: { attackPower: 999, spellPower: 300 } });
    const target = makeTarget();

    const amount = scaleByPower({
      source,
      target,
      abilityName: 'Test',
      school: 'fire',
      baseAmount: 100,
      powerCoefficient: 0.5,
    });

    expect(amount).toBe(250); // 100 + 0.5 * 300
  });

  it('ignores power when there is no coefficient', () => {
    const source = makeAttacker({ stats: { attackPower: 5000 } });
    const target = makeTarget();
    expect(
      scaleByPower({ source, target, abilityName: 'Test', school: 'physical', baseAmount: 42 }),
    ).toBe(42);
  });
});

describe('armorReduction', () => {
  it('is zero without armor', () => {
    expect(armorReduction(0, 'physical')).toBe(0);
  });

  it('never applies to magical schools', () => {
    expect(armorReduction(50_000, 'fire')).toBe(0);
    expect(armorReduction(50_000, 'shadow')).toBe(0);
  });

  it('removes half at the armor constant', () => {
    expect(armorReduction(ARMOR_CONSTANT, 'physical')).toBeCloseTo(0.5, 6);
  });

  it('diminishes rather than scaling linearly', () => {
    const single = armorReduction(5000, 'physical');
    const double = armorReduction(10_000, 'physical');
    expect(double).toBeGreaterThan(single);
    expect(double).toBeLessThan(single * 2);
  });

  it('is capped', () => {
    expect(armorReduction(100_000_000, 'physical')).toBe(MAX_ARMOR_REDUCTION);
  });
});

describe('resolveDamage', () => {
  it('leaves a non-crit at its scaled value when nothing mitigates it', () => {
    const source = makeAttacker({ stats: { attackPower: 100 } });
    const target = makeTarget({ stats: { armor: 0 } });

    const result = resolveDamage(
      {
        source,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 100,
        powerCoefficient: 1,
      },
      HIT,
    );

    expect(result.critical).toBe(false);
    expect(result.amount).toBe(200);
    expect(result.mitigated).toBe(0);
  });

  it('deals nothing at all when the attack is avoided', () => {
    const source = makeAttacker({ stats: { attackPower: 1000 } });
    const target = makeTarget({ stats: { armor: 0 } });

    const result = resolveDamage(
      {
        source,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 100,
        powerCoefficient: 1,
      },
      MISS,
    );

    expect(result.amount).toBe(0);
    expect(result.avoided).toBe(true);
    expect(result.outcome).toBe('miss');
    expect(result.raw).toBe(0);
  });

  it('reduces a glancing blow by the glance multiplier', () => {
    const source = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ stats: { armor: 0 } });

    const result = resolveDamage(
      { source, target, abilityName: 'Test', school: 'physical', baseAmount: 100 },
      GLANCE,
    );

    expect(result.outcome).toBe('glance');
    expect(result.amount).toBeCloseTo(70, 6);
  });

  it('multiplies a critical strike', () => {
    const source = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ stats: { armor: 0 } });

    const result = resolveDamage(
      { source, target, abilityName: 'Test', school: 'physical', baseAmount: 100 },
      CRIT,
    );

    expect(result.critical).toBe(true);
    expect(result.amount).toBe(200);
  });

  it('reduces physical damage by the target armor', () => {
    const source = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ stats: { armor: ARMOR_CONSTANT } });

    const result = resolveDamage(
      {
        source,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 1000,
      },
      HIT,
    );

    expect(result.amount).toBeCloseTo(500, 6);
    expect(result.mitigated).toBeCloseTo(500, 6);
  });

  it('is a pure function of its inputs', () => {
    const run = (): number => {
      const source = makeAttacker();
      const target = makeTarget();
      return resolveDamage(
        { source, target, abilityName: 'Test', school: 'physical', baseAmount: 100 },
        HIT,
      ).amount;
    };
    expect(run()).toBe(run());
  });
});

describe('dealDamage', () => {
  it('reduces the target health by the damage dealt', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 1000 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    dealDamage(sim, {
      source: attacker,
      target,
      abilityName: 'Test',
      school: 'physical',
      baseAmount: 250,
    });

    expect(target.health.current).toBe(750);
  });

  it('accumulates over several hits', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 1000 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    for (let i = 0; i < 3; i++) {
      dealDamage(sim, {
        source: attacker,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 100,
      });
    }

    expect(target.health.current).toBe(700);
  });

  it('emits a telemetry event describing the hit', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 1000 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    dealDamage(sim, {
      source: attacker,
      target,
      abilityId: 'test_ability',
      abilityName: 'Test Ability',
      school: 'fire',
      baseAmount: 300,
    });

    const damageEvents = sim.recordedTelemetry.filter(
      (event): event is DamageTelemetryEvent => event.type === 'damage',
    );

    expect(damageEvents).toHaveLength(1);
    expect(damageEvents[0]).toMatchObject({
      sourceId: 'attacker',
      targetId: 'target',
      abilityId: 'test_ability',
      abilityName: 'Test Ability',
      school: 'fire',
      amount: 300,
      critical: false,
      overkill: 0,
      periodic: false,
    });
  });

  it('reports exactly zero overkill on a target that survives', () => {
    // Regression: overkill used to be derived by subtracting two large floats,
    // which left a fraction of a point of phantom overkill on a healthy target.
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 100_000 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    for (let i = 0; i < 20; i++) {
      dealDamage(sim, {
        source: attacker,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 81.7,
      });
    }

    const overkill = sim.recordedTelemetry
      .filter((event): event is DamageTelemetryEvent => event.type === 'damage')
      .reduce((sum, event) => sum + event.overkill, 0);

    expect(overkill).toBe(0);
  });

  it('floors health at zero and reports the overkill', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 100 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    dealDamage(sim, {
      source: attacker,
      target,
      abilityName: 'Overkill',
      school: 'physical',
      baseAmount: 250,
    });

    expect(target.health.current).toBe(0);

    const event = sim.recordedTelemetry.find(
      (candidate): candidate is DamageTelemetryEvent => candidate.type === 'damage',
    );
    expect(event?.amount).toBe(250);
    expect(event?.overkill).toBe(150);
  });

  it('kills the target and ends combat when the last enemy dies', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 100 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    dealDamage(sim, {
      source: attacker,
      target,
      abilityName: 'Killing Blow',
      school: 'physical',
      baseAmount: 100,
    });

    expect(target.isAlive).toBe(false);
    expect(sim.recordedTelemetry.some((event) => event.type === 'death')).toBe(true);
    expect(sim.hasEnded).toBe(true);
  });

  it('records a death only once when two lethal hits land in the same instant', () => {
    const attacker = makeAttacker({ stats: { attackPower: 0 } });
    const target = makeTarget({ maxHealth: 50 });
    const sim = buildSimulation([attacker, target]);
    sim.begin();

    for (let i = 0; i < 2; i++) {
      dealDamage(sim, {
        source: attacker,
        target,
        abilityName: 'Test',
        school: 'physical',
        baseAmount: 100,
      });
    }

    const deaths = sim.recordedTelemetry.filter((event) => event.type === 'death');
    expect(deaths).toHaveLength(1);
  });
});
