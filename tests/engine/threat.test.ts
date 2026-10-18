import { describe, expect, it } from 'vitest';
import type { AuraDefinition, Combatant, ThreatRules } from '../../src/engine';
import { TelemetryRecorder, dealDamage, seconds, threatMultiplierFor } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ============================================================================
 * THE THREAT RULE, written out by hand (round 47):
 *
 *   threat = (damage x ability multiplier + ability flat) x every modifier
 *
 * Every modifier MULTIPLIES, the flat sits inside them, a miss threatens
 * nothing, and a resource gain threatens per point.
 * ============================================================================
 */

const RULES: ThreatRules = {
  ability: (id) =>
    id === 'flat_strike' ? { flat: 100 } : id === 'double' ? { multiplier: 2 } : undefined,
  resource: (resource, source) =>
    resource === 'rage' && source === 'bonus'
      ? { perPoint: 5 }
      : resource === 'mana' && source === 'potion'
        ? { perPoint: 0.5, ignoresModifiers: true }
        : undefined,
};

const STANCE: AuraDefinition = {
  id: 'stance',
  name: 'Stance',
  durationMs: 0,
  threatModifiers: [{ multiplier: 1.3 }],
};
const SALVATION: AuraDefinition = {
  id: 'salvation',
  name: 'Salvation',
  durationMs: seconds(60),
  threatModifiers: [{ multiplier: 0.7 }],
};
const HOLY_FURY: AuraDefinition = {
  id: 'fury',
  name: 'Fury',
  durationMs: 0,
  threatModifiers: [{ multiplier: 1.9, schools: ['holy'] }],
};

function fight(options: { auras?: AuraDefinition[]; modifiers?: Combatant['threatModifiers'] } = {}) {
  const attacker = makeAttacker({
    threatModifiers: options.modifiers ?? [],
    resources: [{ type: 'rage', maximum: 100, initial: 0 }, { type: 'mana', maximum: 5000, initial: 0 }],
  } as never);
  const target = makeTarget();
  const recorder = new TelemetryRecorder();
  const simulation = buildSimulation([attacker, target], { threatRules: RULES }, recorder);
  for (const aura of options.auras ?? []) simulation.applyAura(attacker, aura, attacker.id);
  const hit = (abilityId: string, school: 'physical' | 'holy' = 'physical') =>
    dealDamage(simulation, {
      source: attacker,
      target,
      abilityId,
      abilityName: abilityId,
      school,
      baseAmount: 1000,
      appliesArmor: false,
    });
  const threat = () => recorder.ofType('threat').reduce((sum, e) => sum + e.amount, 0);
  return { simulation, attacker, target, recorder, hit, threat };
}

describe('threat from damage', () => {
  it('is one point per point of damage with nothing else applied', () => {
    const f = fight();
    f.hit('plain');
    expect(f.threat()).toBeCloseTo(1000, 6);
  });

  it('MULTIPLIES every modifier, an aura and a fight-long one alike', () => {
    const f = fight({ auras: [STANCE, SALVATION], modifiers: [{ multiplier: 1.02 }] });
    f.hit('plain');
    expect(f.threat()).toBeCloseTo(1000 * 1.3 * 0.7 * 1.02, 6);
  });

  it('adds an ability flat INSIDE the modifiers', () => {
    const f = fight({ auras: [STANCE] });
    f.hit('flat_strike');
    expect(f.threat()).toBeCloseTo((1000 + 100) * 1.3, 6);
  });

  it('applies an ability multiplier to the damage and not to the flat', () => {
    const f = fight();
    f.hit('double');
    expect(f.threat()).toBeCloseTo(2000, 6);
  });

  it('scopes a school modifier to that school', () => {
    const f = fight({ auras: [HOLY_FURY] });
    f.hit('plain', 'holy');
    f.hit('plain', 'physical');
    expect(f.threat()).toBeCloseTo(1900 + 1000, 6);
  });

  it('reads a fight-long modifier conditioned on an aura only while it is up', () => {
    const modifiers = [{ multiplier: 0.8, whileNotAura: 'fury' }];
    expect(threatMultiplierFor(fight({ modifiers }).attacker, { kind: 'damage' })).toBeCloseTo(0.8, 10);
    expect(
      threatMultiplierFor(fight({ modifiers, auras: [HOLY_FURY] }).attacker, { kind: 'damage' }),
    ).toBeCloseTo(1, 10);
  });
});

describe('threat from resources', () => {
  it('is per point, modifiers applied, and only from sources the rules name', () => {
    const f = fight({ auras: [STANCE] });
    f.simulation.grantResource(f.attacker, 'rage', 10, { id: 'bonus', name: 'Bonus' });
    f.simulation.grantResource(f.attacker, 'rage', 10, { id: 'damage_taken', name: 'Hit' });
    expect(f.threat()).toBeCloseTo(10 * 5 * 1.3, 6);
  });

  it('can ignore every modifier, which is mana', () => {
    const f = fight({ auras: [STANCE, SALVATION] });
    f.simulation.grantResource(f.attacker, 'mana', 1000, { id: 'potion', name: 'Potion' });
    expect(f.threat()).toBeCloseTo(500, 6);
  });
});

describe('with no rules', () => {
  it('emits no threat at all', () => {
    const attacker = makeAttacker();
    const target = makeTarget();
    const recorder = new TelemetryRecorder();
    const simulation = buildSimulation([attacker, target], {}, recorder);
    dealDamage(simulation, {
      source: attacker,
      target,
      abilityId: 'plain',
      abilityName: 'Plain',
      school: 'physical',
      baseAmount: 1000,
      appliesArmor: false,
    });
    expect(recorder.ofType('threat')).toHaveLength(0);
  });
});
