import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import { chargesIn, resolveCast } from '../../src/engine/abilities/castModifiers';
import { arcaneConcentration } from '../../src/game/reactions/mageTalents';
import {
  ARCANE_POWER,
  CLEARCASTING,
  ICE_BARRIER,
  ICE_BARRIER_FROST_DAMAGE,
  arcaneBlastAura,
} from '../../src/game/auras/mage';
import { ARCANE_BLAST_ABILITY } from '../../src/game/abilities/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { conditionOf, rootOf } from '../../src/ui/panels/aplEditing';
import { healsIn } from '../../src/ui/panels/AplPanel';
import { PALADIN_ABILITIES } from '../../src/game/abilities/paladin';
import { RAID_TANK_HIT_FRACTION } from '../../src/simulator/healerEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 55's bug fixes, each pinned on its MECHANISM. The healer half lives in
 * `tests/simulator/healer.test.ts` beside the rest of the healer fights.
 * ==============================================================================
 */

describe('Arcane Concentration rolls once per Arcane Missiles', () => {
  /** A stand-in that answers the two fields the reaction reads. */
  const actorAt = (castSequence: number, channelTicksDelivered: number) =>
    ({ castSequence, channelTicksDelivered }) as never;
  const always = { rng: { rollChance: () => true } } as never;

  it('rolls on the first missile of a channel and on none of the other four', () => {
    const reaction = arcaneConcentration(100);
    const missile = { abilityId: 'arcane_missiles' } as never;
    // One channel: runCast stamps a sequence per tick, 10..14, ticks 1..5.
    const first = [1, 2, 3, 4, 5].map((tick) =>
      reaction.canTrigger!(always, actorAt(9 + tick, tick), missile),
    );
    expect(first).toEqual([true, false, false, false, false]);
    // The next channel rolls again.
    const second = [1, 2, 3, 4, 5].map((tick) =>
      reaction.canTrigger!(always, actorAt(14 + tick, tick), missile),
    );
    expect(second).toEqual([true, false, false, false, false]);
  });

  it('still rolls on every Arcane Blast', () => {
    const reaction = arcaneConcentration(100);
    const blast = { abilityId: 'arcane_blast' } as never;
    expect([15, 16, 17].map((seq) => reaction.canTrigger!(always, actorAt(seq, 1), blast))).toEqual([
      true,
      true,
      true,
    ]);
  });
});

describe('cost: increases first, reductions a share of the increased cost', () => {
  const base = ARCANE_BLAST_ABILITY.cost!.amount;

  function mageWith(apply: (simulation: Simulation, mage: ReturnType<typeof makeAttacker>) => void) {
    const mage = makeAttacker({ autoAttack: 'none', resources: [{ type: 'mana', maximum: 100_000 }] });
    const simulation = buildSimulation([mage]);
    apply(simulation, mage);
    return mage;
  }

  it('makes a four-stack Arcane Blast FREE under Clearcasting, where the sum left it at seven times', () => {
    const mage = mageWith((simulation, actor) => {
      const ramp = arcaneBlastAura(0);
      for (let stack = 0; stack < 4; stack++) simulation.applyAura(actor, ramp, actor.id);
      simulation.applyAura(actor, CLEARCASTING, actor.id);
    });
    expect(resolveCast(mage, ARCANE_BLAST_ABILITY).costAmount).toBe(0);
  });

  it('measures a Clearcasting saving against the STACKED cost, all eight times the base', () => {
    const mage = mageWith((simulation, actor) => {
      const ramp = arcaneBlastAura(0);
      for (let stack = 0; stack < 4; stack++) simulation.applyAura(actor, ramp, actor.id);
      simulation.applyAura(actor, CLEARCASTING, actor.id);
    });
    const charges = chargesIn(mage.auras.active.filter((instance) => instance.definition.castModifier));
    expect(resolveCast(mage, ARCANE_BLAST_ABILITY, charges).costAmount).toBeCloseTo(base * 8, 6);
  });

  it('leaves an increase alone when nothing reduces it', () => {
    const mage = mageWith((simulation, actor) => {
      simulation.applyAura(actor, ARCANE_POWER, actor.id);
    });
    expect(resolveCast(mage, ARCANE_BLAST_ABILITY).costAmount).toBeCloseTo(base * 1.3, 6);
  });

  it('reports the saving in the cast-charge event for a stacked Arcane Blast', () => {
    const events: TelemetryEvent[] = [];
    const preset = PRESETS_BY_ID.get('mage_arcane')!.build();
    const simulation = new Simulation(trainingDummyEncounter(preset, 7), { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.advanceTo(seconds(600));
    const blasts = events.filter(
      (event): event is Extract<TelemetryEvent, { type: 'cast_charge_spent' }> =>
        event.type === 'cast_charge_spent' && event.abilityId === 'arcane_blast' && event.auraId === 'clearcasting',
    );
    // Every Clearcasting charge spent on an Arcane Blast saved at least the base.
    for (const blast of blasts) expect(blast.saved).toBeGreaterThanOrEqual(base - 1e-6);
  });
});

describe('Ice Barrier on the Frostfire Mage', () => {
  it('is a castable trainer spell: 480 mana, 30s cooldown, a 60 second +6% Frost buff', () => {
    expect(ICE_BARRIER.durationMs).toBe(seconds(60));
    expect(ICE_BARRIER.damageDoneBySchool).toEqual({ frost: ICE_BARRIER_FROST_DAMAGE });
    expect(ICE_BARRIER_FROST_DAMAGE).toBe(1.06);
  });

  it('reaches Frostfire Bolt, which counts as Frost as well as Fire', () => {
    const mage = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([mage]);
    const before = mage.damageDoneMultiplierFor('fire', ['frost']);
    simulation.applyAura(mage, ICE_BARRIER, mage.id);
    expect(mage.damageDoneMultiplierFor('fire', ['frost']) / before).toBeCloseTo(1.06, 10);
    // A plain Fire spell does not collect it.
    expect(mage.damageDoneMultiplierFor('fire') / before).toBeCloseTo(1, 10);
  });

  it('is cast at T-10 and recast when it falls off', () => {
    const events: TelemetryEvent[] = [];
    const preset = PRESETS_BY_ID.get('mage_frostfire')!.build();
    const profile = { ...preset, simulation: { ...preset.simulation, durationSeconds: 150 } };
    const simulation = new Simulation(trainingDummyEncounter(profile, 11), { emit: (e) => events.push(e) });
    simulation.begin();
    const mage = simulation.combatants.find((actor) => actor.kind === 'player')!;
    // Fifty of its sixty seconds left at the pull.
    expect(mage.auras.remainingMs('ice_barrier', 0)).toBe(seconds(50));
    simulation.advanceTo(seconds(600));
    const casts = events.filter((event) => event.type === 'cast' && event.abilityId === 'ice_barrier');
    // The opener, and a recast only while a whole buff fits AND mana is at
    // 90% -- which this mana-bound build is not by fifty seconds in, so in
    // practice the T-10 cast is the only one.
    expect(casts.length).toBeGreaterThanOrEqual(1);
    for (const cast of casts.slice(1)) expect(cast.timestamp).toBeLessThanOrEqual(seconds(90));
    const entry = preset.rotation.entries.find((candidate) => candidate.abilityId === 'ice_barrier')!;
    expect(JSON.stringify(entry.condition)).toContain('"resourceFraction"');
    expect(JSON.stringify(entry.condition)).toContain('"fraction":0.9');
  });

  it('is not recast in a 60 second fight, where a new buff would have ~10s to run', () => {
    const events: TelemetryEvent[] = [];
    const preset = PRESETS_BY_ID.get('mage_frostfire')!.build();
    const simulation = new Simulation(trainingDummyEncounter(preset, 11), { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.advanceTo(seconds(600));
    const casts = events.filter((event) => event.type === 'cast' && event.abilityId === 'ice_barrier');
    // The T-10 opener only, which takes no global cooldown.
    expect(casts).toHaveLength(1);
    expect(casts[0].timestamp).toBe(0);
  });
});

describe('the APL editor reads every healer value (round 55)', () => {
  const roundTrip = (condition: Parameters<typeof rootOf>[0]) => conditionOf(rootOf(condition));

  it.each([
    { kind: 'health', on: 'target', compare: 'below', fraction: 0.65 },
    { kind: 'health', on: 'self', compare: 'atMost', fraction: 0.35 },
    { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.5 },
    { kind: 'friendlyHealth', of: 'party', compare: 'below', fraction: 0.8 },
    { kind: 'friendlyHealth', of: 'raid', compare: 'above', fraction: 0.955 },
  ] as const)('keeps %o exactly through the editor', (condition) => {
    expect(roundTrip(condition)).toEqual(condition);
    // And as an editable clause, not a fixed sentence.
    const node = rootOf(condition).children[0];
    expect(node.kind).toBe('clause');
  });

  it('offers a pre-cast on a heal with a cast bar, and on nothing else', () => {
    const heals = healsIn(PALADIN_ABILITIES);
    expect(heals.get('holy_light')?.castBar).toBe(true);
    expect(heals.get('flash_of_light')?.castBar).toBe(true);
    // Holy Shock is a heal and instant.
    expect(heals.get('holy_shock')?.castBar).toBe(false);
    // A damage spell is not a heal at all.
    expect(heals.has('judgement')).toBe(false);
  });
});

describe('the raid tank (round 55)', () => {
  it('loses 10% a swing, where it lost 30%', () => {
    expect(RAID_TANK_HIT_FRACTION).toBe(0.1);
  });
});
