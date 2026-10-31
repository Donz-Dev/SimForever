import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import { LIGHTS_VIGIL_MANA_COST } from '../../src/game/abilities/paladin';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { healerEncounter, HEALER_ID } from '../../src/simulator/healerEncounter';

/*
 * ============================================================================
 * THE HOLY PAL'S MANA, the owner's report: "significant mana issues preventing
 * it from performing their basic function", and "ensure that a canceled cast
 * of Holy Light is NOT consuming the mana cost".
 *
 * THE CANCEL WAS ALREADY RIGHT and is pinned here so it stays so: the cost of a
 * pre-cast is paid as it LANDS (`CastOptions.payCostOnCompletion`), so a
 * cancelled Holy Light spends nothing and starts no five second rule.
 *
 * WHAT WAS WRONG IS ILLUMINATION ON LIGHT'S VIGIL. The tooltip names four
 * spells and only three were declared, and the party heal passed the module
 * constant rather than the caster's own copy -- so the build's most expensive
 * spell, 1,340 mana, never returned any.
 * ============================================================================
 */

function fight(kind: 'tank' | 'raid', seed: number) {
  const profile = PRESETS_BY_ID.get('holy_pal')!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(healerEncounter(profile, kind, seed), { emit: (e) => events.push(e) });
  simulation.begin();
  simulation.advanceTo(seconds(10_000));
  return events;
}

describe('a cancelled Holy Light', () => {
  it('spends no mana, in a fight where the pre-cast is cancelled', () => {
    let cancels = 0;
    for (const seed of [1001, 1002, 1003]) {
      const events = fight('tank', seed);
      const cancelledAt = new Set(
        events
          .filter((e) => e.type === 'channel_interrupted' && e.sourceId === HEALER_ID && e.abilityId === 'holy_light')
          .map((e) => e.timestamp),
      );
      cancels += cancelledAt.size;
      const spends = events.filter(
        (e): e is Extract<TelemetryEvent, { type: 'resource_spent' | 'resource_gained' }> =>
          e.type === 'resource_spent' && e.actorId === HEALER_ID && e.source === 'holy_light',
      );
      // Nothing is spent at the instant of a cancel...
      for (const spend of spends) expect(cancelledAt.has(spend.timestamp)).toBe(false);
      // ...and every Holy Light that spent paid its whole cost once, as it landed.
      for (const spend of spends) expect(spend.amount).toBe(660);
      const started = events.filter(
        (e) => e.type === 'cast' && e.sourceId === HEALER_ID && e.abilityId === 'holy_light',
      ).length;
      // At most one more start than spends-plus-cancels: a cast the fight's end cut off.
      expect(started - spends.length - cancelledAt.size).toBeLessThanOrEqual(1);
    }
    // The fixture has to exercise the cancel, or the assertions above say nothing.
    expect(cancels).toBeGreaterThan(0);
  });
});

describe("Illumination on Light's Vigil", () => {
  it('is declared on all four spells the tooltip names', () => {
    const abilities = PALADIN_TALENT_EFFECTS.illumination.map((e) => (e as { abilityId: string }).abilityId);
    expect([...new Set(abilities)].sort()).toEqual(
      ['flash_of_light', 'holy_light', 'holy_shock', 'lights_vigil'].sort(),
    );
  });

  it("refunds half the Vigil's base cost, at most once per Vigil party heal", () => {
    /*
     * ONCE PER CAST, the Revelation ruling applied to an area heal: two
     * refunds of 670 at the same instant would be the per-member reading.
     */
    const refund = LIGHTS_VIGIL_MANA_COST / 2;
    let refunds = 0;
    for (const seed of [2001, 2002, 2003]) {
      const events = fight('raid', seed);
      const at = events
        .filter(
          (e) =>
            e.type === 'resource_gained' &&
            e.actorId === HEALER_ID &&
            e.source === 'illumination' &&
            Math.abs(e.amount - refund) < 1e-6,
        )
        .map((e) => e.timestamp);
      refunds += at.length;
      expect(new Set(at).size, `seed ${seed}`).toBe(at.length);
    }
    expect(refunds).toBeGreaterThan(0);
  });
});
