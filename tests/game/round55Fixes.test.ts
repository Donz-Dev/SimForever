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

  it('measures a Clearcasting saving against the STACKED cost, all five times the base', () => {
    const mage = mageWith((simulation, actor) => {
      const ramp = arcaneBlastAura(0);
      for (let stack = 0; stack < 4; stack++) simulation.applyAura(actor, ramp, actor.id);
      simulation.applyAura(actor, CLEARCASTING, actor.id);
    });
    const charges = chargesIn(mage.auras.active.filter((instance) => instance.definition.castModifier));
    // 1 + 4 x 100% since 1.60.1.70707, where 175% a stack made it eight.
    expect(resolveCast(mage, ARCANE_BLAST_ABILITY, charges).costAmount).toBeCloseTo(base * 5, 6);
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

/*
 * ============================================================================
 * ICE BARRIER IS A TALENT AT 1.60.1.70707, AND ONLY A BUILD TAKING IT GETS ITS
 * FROST DAMAGE -- the owner's instruction: "the Frostfire profile should NOT be
 * benefitting from Ice Barrier, and the Frost Mage profile SHALL benefit".
 * Round 55 declared it a trainer spell, so every Mage knew it; this block used
 * to assert the Frostfire Mage casting it at T-10 and recasting it.
 * ============================================================================
 */
describe('Ice Barrier, which only a build taking the talent knows', () => {
  it('is a 60 second +15% Frost buff and +5% more while shielded, added: 1.20', () => {
    expect(ICE_BARRIER.durationMs).toBe(seconds(60));
    expect(ICE_BARRIER.damageDoneBySchool).toEqual({ frost: ICE_BARRIER_FROST_DAMAGE });
    expect(ICE_BARRIER_FROST_DAMAGE).toBeCloseTo(1 + (15 + 5) / 100, 12);
  });

  it('reaches Frostfire Bolt, which counts as Frost as well as Fire', () => {
    const mage = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([mage]);
    const before = mage.damageDoneMultiplierFor('fire', ['frost']);
    simulation.applyAura(mage, ICE_BARRIER, mage.id);
    expect(mage.damageDoneMultiplierFor('fire', ['frost']) / before).toBeCloseTo(1.2, 10);
    // A plain Fire spell does not collect it.
    expect(mage.damageDoneMultiplierFor('fire') / before).toBeCloseTo(1, 10);
  });

  /** One fight's Ice Barrier casts and the buff at the pull, off the event stream. */
  const fight = (presetId: string) => {
    const events: TelemetryEvent[] = [];
    const preset = PRESETS_BY_ID.get(presetId)!.build();
    const simulation = new Simulation(trainingDummyEncounter(preset, 11), { emit: (e) => events.push(e) });
    simulation.begin();
    const mage = simulation.combatants.find((actor) => actor.kind === 'player')!;
    const atPull = mage.auras.remainingMs('ice_barrier', 0);
    simulation.advanceTo(seconds(600));
    return {
      preset,
      mage,
      atPull,
      casts: events.filter((event) => event.type === 'cast' && event.abilityId === 'ice_barrier'),
    };
  };

  it('is NOT known, cast or carried by the Frostfire Mage, which does not take it', () => {
    const { preset, mage, atPull, casts } = fight('mage_frostfire');
    expect(preset.talents.ice_barrier ?? 0).toBe(0);
    expect(mage.abilities.get('ice_barrier')).toBeUndefined();
    expect(atPull).toBe(0);
    expect(casts).toHaveLength(0);
    expect(preset.precombat?.some((action) => action.abilityId === 'ice_barrier') ?? false).toBe(false);
    expect(preset.rotation.entries.some((entry) => entry.abilityId === 'ice_barrier')).toBe(false);
  });

  it('IS known and carried by the Frost Mage, which takes it', () => {
    const { preset, mage, atPull, casts } = fight('mage_frost');
    expect(preset.talents.ice_barrier).toBe(1);
    expect(mage.abilities.get('ice_barrier')).toBeDefined();
    // Its opener casts it 3.5 seconds before the pull.
    expect(atPull).toBe(seconds(60 - 3.5));
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(mage.damageDoneMultiplierFor('frost')).toBeGreaterThan(0);
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
