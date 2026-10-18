import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalAllocation } from '../../src/game/talents/talentRules';
import { talentNumber } from '../../src/game/talents/talentValues';
import { DECIMATION_PHASE_FRACTION } from '../../src/game/rotations/warlock';

/*
 * THE DEMONOLOGY WARLOCK: the owner's fixed points, and the mechanisms the
 * profile is built around actually arriving in a fight.
 */
const preset = () => PRESETS_BY_ID.get('warlock_demonology')!.build();

describe('the Demonology preset', () => {
  it('is a legal 5/31/15 with every talent the owner named', () => {
    const { talents } = preset();
    const tree = talentsForClass('warlock')!;
    const { allocation, dropped } = legalAllocation(tree, talents);
    expect(dropped).toEqual([]);
    expect(allocation).toEqual(talents);

    const split: Record<string, number> = {};
    for (const [id, points] of Object.entries(talents)) {
      const tab = tree.byId.get(id)!.tree;
      split[tab] = (split[tab] ?? 0) + points;
    }
    expect(split).toEqual({ affliction: 5, demonology: 31, destruction: 15 });

    // The owner's named points.
    expect(talents.suppression).toBe(5);
    expect(talents.ruin).toBe(5);
    expect(talents.demonic_sacrifice).toBe(1);
    expect(talents.master_demonologist).toBe(5);
    expect(talents.decimation).toBe(2);
    expect(talents.demonic_brand).toBe(3);
    // Forced: without Pact, summoning the Imp cancels the sacrifice.
    expect(talents.demonic_pact).toBe(1);
  });

  it('sacrifices the Succubus and summons the Imp, and keeps both', () => {
    const profile = preset();
    expect(profile.character.petFamily).toBe('succubus');
    expect(profile.character.summonedDemon).toBe('imp');

    const sim = new Simulation(trainingDummyEncounter(profile, 1));
    sim.begin();
    const warlock = sim.combatants.find((a) => a.kind === 'player')!;
    const pet = sim.combatants.find((a) => a.kind === 'pet');
    expect(pet?.name).toBe('Imp');
    expect(warlock.auras.has('demonic_sacrifice_succubus')).toBe(true);
  });

  it('reads Decimation\'s window off the same 35% the talent states', () => {
    // A test that pins two separate facts by IDENTITY rather than deriving one
    // from the other: the list's constant and the talent's own row.
    expect(DECIMATION_PHASE_FRACTION * 100).toBe(talentNumber('warlock', 'decimation', 2, 1));
  });

  it('casts Soul Fire only in the last 35% of the fight, and casts it there', () => {
    let windows = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const events: TelemetryEvent[] = [];
      const sim = new Simulation(trainingDummyEncounter(preset(), seed), {
        emit: (e) => events.push(e),
      });
      sim.run();
      const end = sim.clock.now();
      const fires = events.filter(
        (e) => e.type === 'cast' && (e as { abilityId: string }).abilityId === 'soul_fire',
      );
      // A cast event is stamped when the cast STARTS, which is when the
      // window was read. The fight ends at its planned length.
      for (const cast of fires) expect(cast.timestamp).toBeGreaterThanOrEqual(end * 0.65 - 1);
      if (fires.length > 0) windows++;
    }
    expect(windows).toBe(5);
  });
});
