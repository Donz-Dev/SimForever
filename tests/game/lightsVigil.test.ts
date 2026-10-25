import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Combatant as CombatantClass, Simulation, castAbility, seconds } from '../../src/engine';
import {
  HOLY_SHOCK,
  HOLY_SHOCK_HEAL,
  LIGHTS_VIGIL_ABILITY,
  LIGHTS_VIGIL_DAMAGE,
  LIGHTS_VIGIL_MANA_COST,
  LIGHTS_VIGIL_PARTY_HEAL,
  LIGHTS_VIGIL_REFUND_FRACTION,
} from '../../src/game/abilities/paladin';
import { LIGHTS_VIGIL } from '../../src/game/auras/paladin';
import { PLACEHOLDER_LIGHTS_VIGIL_COEFFICIENT } from '../../src/game/combat/coefficients';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { compileCondition } from '../../src/game/rotations/apl';
import type { AplCondition } from '../../src/game/rotations/apl';
import { lowestPartyMember } from '../../src/game/rotations/apl/friendlies';
import { conditionOf, rootOf } from '../../src/ui/panels/aplEditing';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { HEALER_ID, RAID_PULSE_FIRST_MS, TANK_ID, healerEncounter } from '../../src/simulator/healerEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 61: Light's Vigil, and the Holy Pal's raid healer chain built on it.
 * Each block pins a mechanism. Every heal coefficient here is a placeholder, so
 * the figures asserted are the stated ranges at zero healing power.
 * ==============================================================================
 */

/** A raid member in a party, at a given share of its health. */
function member(id: string, party: number, healthFraction: number): Combatant {
  const actor = new CombatantClass({
    id,
    name: id,
    kind: 'summon',
    faction: 'friendly',
    maxHealth: 10_000,
    party,
  });
  actor.health.set(10_000 * healthFraction);
  return actor;
}

function paladin() {
  return makeAttacker({
    id: 'paladin',
    autoAttack: 'none',
    abilities: [HOLY_SHOCK, LIGHTS_VIGIL_ABILITY],
    resources: [{ type: 'mana', maximum: 10_000 }],
    // No crit, no healing power: every heal is its stated midpoint.
    stats: { spellCritChance: -100, healingPower: 0 },
  });
}

function heals(events: readonly TelemetryEvent[]) {
  return events.filter((event): event is Extract<TelemetryEvent, { type: 'heal' }> => event.type === 'heal');
}

describe("Light's Vigil, the spell", () => {
  it('is rank 3 off the capture: 1,340 mana, a 1.5 second cast, a 6 second cooldown, 30 seconds up', () => {
    expect(LIGHTS_VIGIL_ABILITY.cost).toEqual({ resource: 'mana', amount: 1340 });
    expect(LIGHTS_VIGIL_ABILITY.castTimeMs).toBe(seconds(1.5));
    expect(LIGHTS_VIGIL_ABILITY.cooldownMs).toBe(seconds(6));
    expect(LIGHTS_VIGIL.durationMs).toBe(seconds(30));
    expect(LIGHTS_VIGIL_PARTY_HEAL).toBe((684 + 724) / 2);
    expect(LIGHTS_VIGIL_DAMAGE).toBe((380 + 410) / 2);
  });

  it('is granted by the talent, which is no longer a gap', () => {
    expect(PALADIN_TALENT_EFFECTS.light_s_vigil).toEqual([{ kind: 'grantAbility', abilityId: 'lights_vigil' }]);
  });

  it('carries NO spell power coefficient, because no source states one', () => {
    expect(PLACEHOLDER_LIGHTS_VIGIL_COEFFICIENT).toBe(0);
  });
});

describe("Holy Shock on a Light's Vigil target", () => {
  function shock(party: readonly Combatant[], vigilOn: Combatant | undefined, shockOn: Combatant) {
    const caster = paladin();
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, ...party], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    if (vigilOn) castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, vigilOn);
    simulation.advanceTo(seconds(2));
    events.length = 0;
    castAbility(simulation, caster, caster.abilities.get('holy_shock')!, shockOn);
    simulation.advanceTo(seconds(2.1));
    return { caster, simulation, events };
  }

  it('heals the target, then its whole party -- the target included -- and nobody outside it', () => {
    const party = [1, 2, 3, 4, 5].map((n) => member(`p${n}`, 1, 0.5));
    const outsider = member('q', 2, 0.5);
    const { events } = shock([...party, outsider], party[0], party[0]);
    const healed = heals(events);
    const raw = (event: (typeof healed)[number]) => event.amount + event.overhealing;
    const own = healed.filter((event) => event.abilityId === 'holy_shock');
    expect(own.map((event) => event.targetId)).toEqual(['p1']);
    expect(raw(own[0])).toBeCloseTo(HOLY_SHOCK_HEAL, 6);
    const vigil = healed.filter((event) => event.abilityId === 'lights_vigil');
    expect(vigil.map((event) => event.targetId).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    for (const event of vigil) expect(raw(event)).toBeCloseTo(LIGHTS_VIGIL_PARTY_HEAL, 6);
  });

  it('spends the Vigil and triggers no cooldown', () => {
    const party = [member('a', 1, 0.5), member('b', 1, 0.5)];
    const { caster } = shock(party, party[0], party[0]);
    expect(party[0].auras.has(LIGHTS_VIGIL.id)).toBe(false);
    expect(caster.abilities.isReady('holy_shock', seconds(2.1))).toBe(true);
  });

  it('without a Vigil: no party heal, and the ordinary ten second cooldown', () => {
    const party = [member('a', 1, 0.5), member('b', 1, 0.5)];
    const { caster, events } = shock(party, undefined, party[0]);
    expect(heals(events).filter((event) => event.abilityId === 'lights_vigil')).toEqual([]);
    expect(caster.abilities.isReady('holy_shock', seconds(2.1))).toBe(false);
  });

  it('on an enemy: the Holy damage, and 75% of the Vigil refunded', () => {
    const caster = paladin();
    const boss = makeTarget({ maxHealth: 1_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, boss], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, boss);
    simulation.advanceTo(seconds(2));
    events.length = 0;
    castAbility(simulation, caster, caster.abilities.get('holy_shock')!, boss);
    const refund = events.find(
      // One event type carries both directions, so it is extracted by both.
      (event): event is Extract<TelemetryEvent, { type: 'resource_gained' | 'resource_spent' }> =>
        event.type === 'resource_gained' && event.sourceName === "Light's Vigil",
    );
    expect(refund?.amount).toBeCloseTo(LIGHTS_VIGIL_MANA_COST * LIGHTS_VIGIL_REFUND_FRACTION, 6);
    expect(events.some((event) => event.type === 'damage' && event.abilityId === 'lights_vigil')).toBe(true);
  });
});

describe('one Light\'s Vigil per party', () => {
  it('moves within a party and stays put across parties', () => {
    const caster = paladin();
    const a = member('a', 1, 1);
    const b = member('b', 1, 1);
    const c = member('c', 2, 1);
    const simulation = buildSimulation([caster, a, b, c]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, a);
    simulation.advanceTo(seconds(7));
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, b);
    simulation.advanceTo(seconds(14));
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, c);
    simulation.advanceTo(seconds(16));
    expect([a, b, c].map((m) => m.auras.has(LIGHTS_VIGIL.id))).toEqual([false, true, true]);
  });
});

describe('the APL pieces', () => {
  function raid(fractions: readonly (readonly number[])[]) {
    const caster = paladin();
    const members = fractions.flatMap((party, index) =>
      party.map((fraction, at) => member(`m${index + 1}_${at}`, index + 1, fraction)),
    );
    const simulation = buildSimulation([caster, ...members]);
    simulation.begin();
    return { caster, members, simulation };
  }

  it('aims at the lowest member of the lowest-average party, skipping one that holds your Vigil', () => {
    const { caster, members, simulation } = raid([
      [0.9, 0.9],
      [0.5, 0.8],
      [0.6, 0.6],
    ]);
    // Party 2 averages 65%, party 3 60%: party 3, whose two tie, gives its first.
    expect(lowestPartyMember(simulation, caster)?.id).toBe('m3_0');
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, members[4]);
    simulation.advanceTo(seconds(2));
    expect(lowestPartyMember(simulation, caster, { withoutAura: LIGHTS_VIGIL.id })?.id).toBe('m2_0');
  });

  it("reads the lowest party's average, the raid's size, and whether your aura is on anyone", () => {
    const { caster, members, simulation } = raid([
      [1, 1],
      [0.5, 0.7],
    ]);
    const check = (condition: AplCondition) => compileCondition(condition)(simulation, caster, undefined);
    expect(check({ kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.61 })).toBe(true);
    expect(check({ kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.6 })).toBe(false);
    expect(check({ kind: 'raidSize', compare: 'exactly', count: 4 })).toBe(true);
    expect(check({ kind: 'raidAura', auraId: LIGHTS_VIGIL.id, present: false })).toBe(true);
    castAbility(simulation, caster, caster.abilities.get('lights_vigil')!, members[0]);
    simulation.advanceTo(seconds(2));
    expect(check({ kind: 'raidAura', auraId: LIGHTS_VIGIL.id, present: true })).toBe(true);
  });

  it('round-trips the three new readings through the editor', () => {
    const conditions: readonly AplCondition[] = [
      { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.8 },
      { kind: 'raidSize', compare: 'atLeast', count: 6 },
      { kind: 'raidAura', auraId: 'lights_vigil', present: false },
      { kind: 'raidAura', auraId: 'lights_vigil', present: true },
    ];
    for (const condition of conditions) {
      expect(conditionOf(rootOf(condition))).toEqual(condition);
      expect(rootOf(condition).children[0].kind).toBe('clause');
    }
  });
});

describe("the Holy Pal's raid healer chain", () => {
  function fight(kind: 'tank' | 'raid') {
    const profile = PRESETS_BY_ID.get('holy_pal')!.build();
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(healerEncounter(profile, kind, 4242), { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.advanceTo(seconds(60));
    const casts = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'cast' }> =>
        event.type === 'cast' && event.sourceId === HEALER_ID,
    );
    return { simulation, casts };
  }

  it('puts the Vigil on the tank at the pull and HOLDS Holy Shock until the raid pulse', () => {
    const { casts } = fight('raid');
    const vigils = casts.filter((event) => event.abilityId === 'lights_vigil');
    const shocks = casts.filter((event) => event.abilityId === 'holy_shock');
    expect(vigils[0].timestamp).toBe(0);
    expect(vigils[0].targetId).toBe(TANK_ID);
    expect(shocks.length).toBeGreaterThan(0);
    // Held until the first raid pulse, wherever that is (5 seconds since round 70).
    expect(shocks[0].timestamp).toBeGreaterThanOrEqual(RAID_PULSE_FIRST_MS);
    expect(shocks[0].targetId).toBe(TANK_ID);
  });

  it('then moves the Vigil to another party and shocks THAT one', () => {
    const { simulation, casts } = fight('raid');
    const partyOf = (id: string | undefined) => simulation.combatants.find((actor) => actor.id === id)?.party;
    const vigils = casts.filter((event) => event.abilityId === 'lights_vigil');
    const shocks = casts.filter((event) => event.abilityId === 'holy_shock');
    expect(vigils.length).toBeGreaterThan(1);
    expect(partyOf(vigils[1].targetId)).not.toBe(1);
    expect(shocks[1].targetId).toBe(vigils[1].targetId);
  });

  it('is never cast in the tank fight, which keeps its own Holy Shock', () => {
    const { casts } = fight('tank');
    expect(casts.some((event) => event.abilityId === 'lights_vigil')).toBe(false);
  });
});
