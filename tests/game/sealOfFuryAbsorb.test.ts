import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, deriveSeed, seconds } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { SEAL_OF_FURY_SHIELD_ID, sealOfFuryShield } from '../../src/game/auras/paladin';

/*
 * ==============================================================================
 * PROT PALLY RUNS SEAL OF FURY, AND ITS ABSORB WORKS (round 90).
 *
 * The owner: "ensure Prot Pally is using Seal of Fury instead of Seal of
 * Righteousness and that the absorb is working correctly". The shield had a
 * registration test and a constant test and nothing that DROVE IT -- so these
 * read a real Prot Pally fight's event stream.
 *
 * ONLY HITS BEFORE THE FIRST TEMPLAR'S BULWARK are checked for size, because
 * the engine spends shields in the order they were applied and two shields in
 * play make a hit's absorb a sum nobody can attribute. The Bulwark fires at 35%
 * health, so the opening of every fight has plenty of hits under Fury alone.
 * And a spent shield is REMOVED in the same millisecond as the hit that spent
 * it, logged first -- so "armed" is "granted since the last landed hit".
 * ==============================================================================
 */

function protFight(seed: number) {
  const profile = PRESETS_BY_ID.get('prot_pally')!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation({ ...trainingDummyEncounter(profile, seed), seed }, { emit: (e) => events.push(e) });
  const player = simulation.combatants.find((c) => c.kind === 'player')!;
  simulation.begin();
  // Read in the opening, before the Spellblasting Potion moves Holy power.
  simulation.advanceTo(seconds(5));
  const pool = sealOfFuryShield().absorb!(player);
  simulation.advanceTo(seconds(profile.simulation.durationSeconds * 2));
  return { events, player, pool };
}

describe("Prot Pally's Seal of Fury", () => {
  const fights = [0, 1, 2].map((i) => protFight(deriveSeed(90, i)));

  it('is the seal it fights with, and Righteousness is not', () => {
    for (const { events, player } of fights) {
      const sealDamage = (id: string) =>
        events.filter((e) => e.type === 'damage' && e.sourceId === player.id && e.abilityId === id).length;
      expect(sealDamage('seal_of_fury')).toBeGreaterThan(10);
      expect(sealDamage('seal_of_righteousness')).toBe(0);
    }
  });

  it('grants its shield once for every seal hit that lands', () => {
    for (const { events, player } of fights) {
      const hits = events.filter(
        (e) => e.type === 'damage' && e.sourceId === player.id && e.abilityId === 'seal_of_fury',
      ).length;
      const grants = events.filter(
        (e) =>
          (e.type === 'aura_applied' || e.type === 'aura_refreshed') &&
          e.targetId === player.id &&
          e.auraId === SEAL_OF_FURY_SHIELD_ID,
      ).length;
      expect(grants).toBe(hits);
    }
  });

  it('absorbs half the seal, once, from the next hit taken -- and does not stack', () => {
    let checked = 0;
    for (const { events, player, pool } of fights) {
      let armed = false;
      for (const e of events) {
        if (e.type === 'aura_applied' && e.targetId === player.id && e.auraId === 'templars_bulwark') break;
        if (e.type === 'damage' && e.timestamp > seconds(30)) break;
        if ((e.type === 'aura_applied' || e.type === 'aura_refreshed') && e.auraId === SEAL_OF_FURY_SHIELD_ID) {
          armed = true;
        }
        if (e.type === 'damage' && e.targetId === player.id && !e.periodic) {
          if (e.outcome === 'miss' || e.outcome === 'dodge' || e.outcome === 'parry') continue;
          expect(e.absorbed).toBeCloseTo(armed ? Math.min(pool, e.amount + e.absorbed) : 0, 6);
          if (armed) checked += 1;
          armed = false;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
